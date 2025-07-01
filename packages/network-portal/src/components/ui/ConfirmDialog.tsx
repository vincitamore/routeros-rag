import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'info'
}) => {
  if (!isOpen) return null;

  const getTypeColor = () => {
    switch (type) {
      case 'danger': return 'var(--error, #ef4444)';
      case 'warning': return 'var(--warning, #f59e0b)';
      default: return 'var(--primary)';
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'danger':
        return (
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--space-4)'
      }}
      onClick={onCancel}
    >
      <div 
        className="card"
        style={{
          minWidth: '320px',
          maxWidth: '480px',
          width: '100%',
          padding: 'var(--space-6)',
          backgroundColor: 'rgba(var(--background-rgb), 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(var(--border-rgb), 0.8)',
          boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          <div style={{ color: getTypeColor(), flexShrink: 0, marginTop: 'var(--space-1)' }}>
            {getTypeIcon()}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              margin: 0, 
              marginBottom: 'var(--space-2)',
              color: 'var(--text-primary)'
            }}>
              {title}
            </h3>
            <p style={{ 
              fontSize: '0.9rem', 
              color: 'var(--text-secondary)', 
              margin: 0,
              lineHeight: '1.5'
            }}>
              {message}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              backdropFilter: 'blur(8px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
              e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
              e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: type === 'danger' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(var(--primary-rgb), 0.2)',
              border: `1px solid ${type === 'danger' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(var(--primary-rgb), 0.5)'}`,
              borderRadius: 'var(--space-2)',
              color: type === 'danger' ? '#ef4444' : 'rgb(var(--primary-rgb))',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              backdropFilter: 'blur(8px)'
            }}
            onMouseEnter={(e) => {
              if (type === 'danger') {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.7)';
              } else {
                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
                e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.7)';
              }
            }}
            onMouseLeave={(e) => {
              if (type === 'danger') {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
              } else {
                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
              }
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}; 