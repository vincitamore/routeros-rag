'use client';

import React from 'react';

interface ConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onDelete?: () => void;
  title: string;
  type?: 'add' | 'edit' | 'delete';
  isLoading?: boolean;
  isSubmitting?: boolean;
  submitLabel?: string;
  submitStyle?: 'primary' | 'danger';
  children: React.ReactNode;
}

export function ConfigurationModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  title,
  type,
  isLoading = false,
  isSubmitting = false,
  submitLabel,
  submitStyle = 'primary',
  children
}: ConfigurationModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="card"
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 'var(--space-6)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0, color: 'rgb(var(--foreground-rgb))' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'rgba(var(--secondary-rgb), 0.8)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              borderRadius: 'var(--space-1)',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
              e.currentTarget.style.color = 'rgb(var(--foreground-rgb))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'rgba(var(--secondary-rgb), 0.8)';
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {type === 'delete' ? (
          /* Delete Confirmation */
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" 
                   style={{ margin: '0 auto var(--space-4)', color: 'rgb(var(--error-rgb))' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p style={{ fontSize: '1rem', color: 'rgb(var(--foreground-rgb))', margin: 0 }}>
                Are you sure you want to delete this item?
              </p>
              <p style={{ fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.8)', marginTop: 'var(--space-2)' }}>
                This action cannot be undone.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading || isSubmitting}
                style={{
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  color: 'rgb(var(--foreground-rgb))',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--space-2)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: (isLoading || isSubmitting) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  opacity: (isLoading || isSubmitting) ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isLoading || isSubmitting}
                style={{
                  backgroundColor: 'rgba(var(--error-rgb), 0.2)',
                  border: '1px solid rgba(var(--error-rgb), 0.5)',
                  color: 'rgb(var(--error-rgb))',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--space-2)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: (isLoading || isSubmitting) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  opacity: (isLoading || isSubmitting) ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && !isSubmitting) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && !isSubmitting) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
                  }
                }}
              >
                {(isLoading || isSubmitting) ? (submitLabel ? `${submitLabel.slice(0, -1)}ing...` : 'Deleting...') : (submitLabel || 'Delete')}
              </button>
            </div>
          </div>
        ) : (
          /* Add/Edit Form */
          <form onSubmit={onSubmit}>
            {children}
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-6)' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading || isSubmitting}
                style={{
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  color: 'rgb(var(--foreground-rgb))',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--space-2)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: (isLoading || isSubmitting) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  opacity: (isLoading || isSubmitting) ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isSubmitting}
                style={{
                  backgroundColor: submitStyle === 'danger' ? 'rgba(var(--error-rgb), 0.2)' : 'rgba(var(--primary-rgb), 0.2)',
                  border: submitStyle === 'danger' ? '1px solid rgba(var(--error-rgb), 0.5)' : '1px solid rgba(var(--primary-rgb), 0.5)',
                  color: submitStyle === 'danger' ? 'rgb(var(--error-rgb))' : 'rgb(var(--primary-rgb))',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--space-2)',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: (isLoading || isSubmitting) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  opacity: (isLoading || isSubmitting) ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && !isSubmitting) {
                    e.currentTarget.style.backgroundColor = submitStyle === 'danger' ? 'rgba(var(--error-rgb), 0.3)' : 'rgba(var(--primary-rgb), 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && !isSubmitting) {
                    e.currentTarget.style.backgroundColor = submitStyle === 'danger' ? 'rgba(var(--error-rgb), 0.2)' : 'rgba(var(--primary-rgb), 0.2)';
                  }
                }}
              >
                {(isLoading || isSubmitting) ? 
                  (submitLabel ? `${submitLabel.slice(0, -1)}ing...` : (type === 'add' ? 'Adding...' : 'Updating...')) : 
                  (submitLabel || (type === 'add' ? 'Add' : 'Update'))
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
} 