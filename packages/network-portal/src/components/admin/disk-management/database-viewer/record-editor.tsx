'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, AlertCircle, Eye, EyeOff, Calendar, Clock } from 'lucide-react';

interface Column {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  defaultValue?: any;
}

interface RecordEditorProps {
  isOpen: boolean;
  onClose: () => void;
  tableName: string;
  record?: Record<string, any> | null;
  columns: Column[];
  onSave: (record: Record<string, any>) => Promise<void>;
  mode: 'create' | 'edit';
}

interface FieldError {
  field: string;
  message: string;
}

export default function RecordEditor({
  isOpen,
  onClose,
  tableName,
  record,
  columns,
  onSave,
  mode
}: RecordEditorProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [originalData, setOriginalData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [loading, setSaving] = useState(false);
  const [showJsonFields, setShowJsonFields] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data when modal opens or record changes
  useEffect(() => {
    if (isOpen) {
      const initialData = record || {};
      
      // Set default values for new records
      if (mode === 'create') {
        const defaultValues = columns.reduce((acc, column) => {
          if (column.defaultValue !== undefined && column.defaultValue !== null) {
            acc[column.name] = column.defaultValue;
          } else if (column.type.toLowerCase().includes('datetime') || column.type.toLowerCase().includes('timestamp')) {
            if (column.name.toLowerCase().includes('created') || column.name.toLowerCase().includes('updated')) {
              acc[column.name] = new Date().toISOString();
            }
          }
          return acc;
        }, {} as Record<string, any>);
        
        setFormData({ ...defaultValues, ...initialData });
        setOriginalData({ ...defaultValues, ...initialData });
      } else {
        setFormData({ ...initialData });
        setOriginalData({ ...initialData });
      }
      
      setErrors([]);
      setHasChanges(false);
    }
  }, [isOpen, record, columns, mode]);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(originalData);
    setHasChanges(changed);
  }, [formData, originalData]);

  // Handle field value change
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear error for this field
    setErrors(prev => prev.filter(error => error.field !== fieldName));
  };

  // Validate form data
  const validateForm = (): FieldError[] => {
    const newErrors: FieldError[] = [];

    columns.forEach(column => {
      const value = formData[column.name];
      
      // Check required fields
      if (column.notNull && !column.primaryKey && (value === undefined || value === null || value === '')) {
        newErrors.push({
          field: column.name,
          message: 'This field is required'
        });
      }

      // Validate data types
      if (value !== undefined && value !== null && value !== '') {
        const columnType = column.type.toLowerCase();
        
        if (columnType.includes('integer') || columnType.includes('int')) {
          if (isNaN(Number(value))) {
            newErrors.push({
              field: column.name,
              message: 'Must be a valid integer'
            });
          }
        }
        
        if (columnType.includes('real') || columnType.includes('float') || columnType.includes('double')) {
          if (isNaN(Number(value))) {
            newErrors.push({
              field: column.name,
              message: 'Must be a valid number'
            });
          }
        }
        
        if (columnType.includes('datetime') || columnType.includes('timestamp')) {
          if (isNaN(Date.parse(value))) {
            newErrors.push({
              field: column.name,
              message: 'Must be a valid date/time'
            });
          }
        }
        
        if (columnType.includes('json')) {
          try {
            JSON.parse(value);
          } catch {
            newErrors.push({
              field: column.name,
              message: 'Must be valid JSON'
            });
          }
        }
      }
    });

    return newErrors;
  };

  // Handle form submission
  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      setErrors([{
        field: 'general',
        message: error instanceof Error ? error.message : 'Failed to save record'
      }]);
    } finally {
      setSaving(false);
    }
  };

  // Handle reset
  const handleReset = () => {
    setFormData({ ...originalData });
    setErrors([]);
  };

  // Get field input type based on column type
  const getInputType = (column: Column): string => {
    const columnType = column.type.toLowerCase();
    
    if (columnType.includes('integer') || columnType.includes('int')) {
      return 'number';
    }
    if (columnType.includes('real') || columnType.includes('float') || columnType.includes('double')) {
      return 'number';
    }
    if (columnType.includes('datetime') || columnType.includes('timestamp')) {
      return 'datetime-local';
    }
    if (columnType.includes('date')) {
      return 'date';
    }
    if (columnType.includes('time')) {
      return 'time';
    }
    if (columnType.includes('boolean') || columnType.includes('bool')) {
      return 'checkbox';
    }
    if (columnType.includes('text') && columnType.includes('long')) {
      return 'textarea';
    }
    if (columnType.includes('json')) {
      return 'json';
    }
    
    return 'text';
  };

  // Format value for input
  const formatValueForInput = (value: any, column: Column): string => {
    if (value === null || value === undefined) {
      return '';
    }

    const inputType = getInputType(column);
    
    if (inputType === 'datetime-local') {
      try {
        return new Date(value).toISOString().slice(0, 16);
      } catch {
        return '';
      }
    }
    
    if (inputType === 'date') {
      try {
        return new Date(value).toISOString().slice(0, 10);
      } catch {
        return '';
      }
    }
    
    if (inputType === 'json') {
      try {
        return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    
    return String(value);
  };

  // Get error for field
  const getFieldError = (fieldName: string): string | undefined => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  // Get general errors
  const generalErrors = errors.filter(error => error.field === 'general');

  if (!isOpen) {
    return null;
  }

  return (
    <div className="record-editor-overlay">
      <div className="record-editor-modal">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{mode === 'create' ? 'Create New Record' : 'Edit Record'}</h2>
            <p className="table-name">Table: {tableName}</p>
          </div>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        {/* General Errors */}
        {generalErrors.length > 0 && (
          <div className="general-errors">
            {generalErrors.map((error, index) => (
              <div key={index} className="error-message">
                <AlertCircle size={16} />
                {error.message}
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <div className="modal-body">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="form-grid">
              {columns.map((column) => {
                const inputType = getInputType(column);
                const fieldError = getFieldError(column.name);
                const value = formData[column.name];
                const isJsonField = inputType === 'json';
                const showJsonEditor = showJsonFields.has(column.name);

                return (
                  <div key={column.name} className={`form-field ${fieldError ? 'error' : ''}`}>
                    <label className="field-label">
                      <span className="label-text">
                        {column.name}
                        {column.notNull && <span className="required">*</span>}
                      </span>
                      <div className="field-meta">
                        <span className="field-type">{column.type}</span>
                        {column.primaryKey && <span className="pk-badge">PK</span>}
                      </div>
                    </label>

                    <div className="input-container">
                      {inputType === 'checkbox' ? (
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => handleFieldChange(column.name, e.target.checked)}
                            disabled={column.primaryKey && mode === 'edit'}
                          />
                          <span className="checkbox-text">
                            {value ? 'True' : 'False'}
                          </span>
                        </label>
                      ) : inputType === 'textarea' || (isJsonField && showJsonEditor) ? (
                        <div className="textarea-container">
                          {isJsonField && (
                            <div className="json-controls">
                              <button
                                type="button"
                                onClick={() => {
                                  const newSet = new Set(showJsonFields);
                                  if (showJsonEditor) {
                                    newSet.delete(column.name);
                                  } else {
                                    newSet.add(column.name);
                                  }
                                  setShowJsonFields(newSet);
                                }}
                                className="json-toggle"
                              >
                                {showJsonEditor ? <EyeOff size={14} /> : <Eye size={14} />}
                                {showJsonEditor ? 'Simple' : 'JSON'}
                              </button>
                            </div>
                          )}
                          <textarea
                            value={formatValueForInput(value, column)}
                            onChange={(e) => handleFieldChange(column.name, e.target.value)}
                            disabled={column.primaryKey && mode === 'edit'}
                            placeholder={column.defaultValue ? `Default: ${column.defaultValue}` : ''}
                            rows={isJsonField ? 8 : 4}
                            className="textarea-input"
                          />
                        </div>
                      ) : (
                        <input
                          type={inputType}
                          value={formatValueForInput(value, column)}
                          onChange={(e) => {
                            let newValue = e.target.value;
                            if (inputType === 'number' && newValue !== '') {
                              newValue = column.type.toLowerCase().includes('integer') ? 
                                parseInt(newValue) : parseFloat(newValue);
                            }
                            handleFieldChange(column.name, newValue);
                          }}
                          disabled={column.primaryKey && mode === 'edit'}
                          placeholder={column.defaultValue ? `Default: ${column.defaultValue}` : ''}
                          className="text-input"
                          step={inputType === 'number' && column.type.toLowerCase().includes('real') ? 'any' : undefined}
                        />
                      )}

                      {/* Input helpers */}
                      {(column.type.toLowerCase().includes('datetime') || column.type.toLowerCase().includes('timestamp')) && (
                        <div className="input-helpers">
                          <button
                            type="button"
                            onClick={() => handleFieldChange(column.name, new Date().toISOString())}
                            className="helper-button"
                          >
                            <Clock size={12} />
                            Now
                          </button>
                        </div>
                      )}

                      {isJsonField && !showJsonEditor && (
                        <button
                          type="button"
                          onClick={() => {
                            const newSet = new Set(showJsonFields);
                            newSet.add(column.name);
                            setShowJsonFields(newSet);
                          }}
                          className="json-expand-button"
                        >
                          <Eye size={14} />
                          Edit JSON
                        </button>
                      )}
                    </div>

                    {fieldError && (
                      <div className="field-error">
                        <AlertCircle size={14} />
                        {fieldError}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="footer-left">
            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                className="reset-button"
                disabled={loading}
              >
                <RotateCcw size={16} />
                Reset
              </button>
            )}
          </div>

          <div className="footer-right">
            <button
              type="button"
              onClick={onClose}
              className="cancel-button"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="save-button"
              disabled={loading || errors.length > 0}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  {mode === 'create' ? 'Create' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .record-editor-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: var(--space-4);
        }

        .record-editor-modal {
          background: rgba(var(--background-rgb), 0.9);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          backdrop-filter: blur(12px);
          border-radius: var(--space-4);
          max-width: 800px;
          max-height: 90vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: var(--space-6);
          border-bottom: 1px solid rgba(var(--border-rgb), 0.3);
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: rgb(var(--foreground-rgb));
        }

        .table-name {
          margin: var(--space-1) 0 0 0;
          font-size: 14px;
          color: rgba(var(--foreground-rgb), 0.6);
        }

        .close-button {
          padding: var(--space-2);
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-2);
          color: rgba(var(--foreground-rgb), 0.6);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-button:hover {
          background: rgba(var(--error-rgb), 0.1);
          border-color: rgba(var(--error-rgb), 0.3);
          color: rgb(var(--error-rgb));
        }

        .general-errors {
          padding: var(--space-4) var(--space-6);
          background: rgba(var(--error-rgb), 0.1);
          border-bottom: 1px solid rgba(var(--error-rgb), 0.3);
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: rgb(var(--error-rgb));
          font-size: 14px;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-6);
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--space-4);
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .form-field.error .text-input,
        .form-field.error .textarea-input {
          border-color: rgba(var(--error-rgb), 0.5);
          box-shadow: 0 0 0 2px rgba(var(--error-rgb), 0.1);
        }

        .field-label {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .label-text {
          font-weight: 500;
          color: rgb(var(--foreground-rgb));
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .required {
          color: rgb(var(--error-rgb));
        }

        .field-meta {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .field-type {
          font-size: 12px;
          color: rgba(var(--foreground-rgb), 0.6);
        }

        .pk-badge {
          font-size: 10px;
          padding: 2px 6px;
          background: rgba(var(--primary-rgb), 0.2);
          color: rgb(var(--primary-rgb));
          border-radius: 4px;
          font-weight: 600;
        }

        .input-container {
          position: relative;
        }

        .text-input,
        .textarea-input {
          width: 100%;
          padding: var(--space-3);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .text-input:focus,
        .textarea-input:focus {
          outline: none;
          border-color: rgb(var(--primary-rgb));
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }

        .text-input:disabled,
        .textarea-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .textarea-container {
          position: relative;
        }

        .json-controls {
          position: absolute;
          top: var(--space-2);
          right: var(--space-2);
          z-index: 1;
        }

        .json-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          background: rgba(var(--background-rgb), 0.8);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-1);
          color: rgba(var(--foreground-rgb), 0.8);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .json-toggle:hover {
          background: rgba(var(--primary-rgb), 0.1);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: rgb(var(--primary-rgb));
        }

        .json-expand-button {
          position: absolute;
          top: var(--space-2);
          right: var(--space-2);
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          background: rgba(var(--primary-rgb), 0.1);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          border-radius: var(--space-1);
          color: rgb(var(--primary-rgb));
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .json-expand-button:hover {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
        }

        .checkbox-text {
          font-size: 14px;
          color: rgb(var(--foreground-rgb));
        }

        .input-helpers {
          position: absolute;
          top: var(--space-2);
          right: var(--space-2);
        }

        .helper-button {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          background: rgba(var(--background-rgb), 0.8);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-1);
          color: rgba(var(--foreground-rgb), 0.8);
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .helper-button:hover {
          background: rgba(var(--primary-rgb), 0.1);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: rgb(var(--primary-rgb));
        }

        .field-error {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          color: rgb(var(--error-rgb));
          font-size: 12px;
        }

        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-6);
          border-top: 1px solid rgba(var(--border-rgb), 0.3);
        }

        .footer-left,
        .footer-right {
          display: flex;
          gap: var(--space-3);
        }

        .reset-button,
        .cancel-button,
        .save-button {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          border-radius: var(--space-2);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
          font-weight: 500;
        }

        .reset-button {
          background: rgba(var(--warning-rgb), 0.1);
          border: 1px solid rgba(var(--warning-rgb), 0.3);
          color: rgb(var(--warning-rgb));
        }

        .reset-button:hover:not(:disabled) {
          background: rgba(var(--warning-rgb), 0.2);
          border-color: rgba(var(--warning-rgb), 0.5);
        }

        .cancel-button {
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          color: rgba(var(--foreground-rgb), 0.8);
        }

        .cancel-button:hover:not(:disabled) {
          background: rgba(var(--border-rgb), 0.3);
          border-color: rgba(var(--border-rgb), 0.5);
        }

        .save-button {
          background: rgba(var(--primary-rgb), 0.1);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          color: rgb(var(--primary-rgb));
        }

        .save-button:hover:not(:disabled) {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(var(--primary-rgb), 0.3);
          border-top: 2px solid rgb(var(--primary-rgb));
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .record-editor-overlay {
            padding: var(--space-2);
          }

          .record-editor-modal {
            max-height: 95vh;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .modal-footer {
            flex-direction: column;
            gap: var(--space-3);
            align-items: stretch;
          }

          .footer-left,
          .footer-right {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
} 