import React, { useState } from 'react';
import { User } from '../../../types/user-management';
import { apiClient } from '@/lib/api-client';

interface PasswordResetModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PasswordResetModal({ user, isOpen, onClose, onSuccess }: PasswordResetModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetRequired, setPasswordResetRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(newPassword);
    setConfirmPassword(newPassword);
  };

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!password) {
      setError('Password is required');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.post(`/api/admin/users/${user.id}/reset-password`, {
        password,
        password_reset_required: passwordResetRequired,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to reset password');
      }

      onSuccess();
      onClose();
      
      // Reset form
      setPassword('');
      setConfirmPassword('');
      setPasswordResetRequired(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPassword('');
    setConfirmPassword('');
    setPasswordResetRequired(true);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-4)'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          paddingTop: 'var(--space-6)',
          paddingBottom: 'var(--space-4)',
          paddingLeft: 'var(--space-6)',
          paddingRight: 'var(--space-6)',
          borderBottom: '1px solid rgba(var(--border-rgb), 0.5)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              margin: 0,
              marginBottom: 'var(--space-1)',
              color: 'var(--text-primary)'
            }}>
              Reset Password
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: 0
            }}>
              Reset password for {user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}` 
                : user.username
              }
            </p>
          </div>
          
          <button
            onClick={handleCancel}
            style={{
              padding: 'var(--space-2)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-1)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
              e.currentTarget.style.borderColor = 'rgba(var(--error-rgb), 0.3)';
              e.currentTarget.style.color = 'rgb(var(--error-rgb))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
              e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{
          paddingTop: 'var(--space-6)',
          paddingLeft: 'var(--space-6)',
          paddingRight: 'var(--space-6)',
          paddingBottom: 'var(--space-4)'
        }}>
          {/* Error Display */}
          {error && (
            <div style={{
              marginBottom: 'var(--space-4)',
              paddingTop: 'var(--space-3)',
              paddingBottom: 'var(--space-3)',
              paddingLeft: 'var(--space-4)',
              paddingRight: 'var(--space-4)',
              backgroundColor: 'rgba(var(--error-rgb), 0.1)',
              border: '1px solid rgba(var(--error-rgb), 0.3)',
              borderRadius: 'var(--space-2)',
              color: 'rgb(var(--error-rgb))',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          {/* Password Field */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              New Password *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                style={{
                  width: '100%',
                  paddingTop: 'var(--space-3)',
                  paddingBottom: 'var(--space-3)',
                  paddingLeft: 'var(--space-4)',
                  paddingRight: '3rem',
                  fontSize: '0.875rem',
                  backgroundColor: 'rgba(var(--border-rgb), 0.1)',
                  border: '1px solid rgba(var(--border-rgb), 0.3)',
                  borderRadius: 'var(--space-2)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all 0.2s ease-in-out',
                  fontFamily: showPassword ? 'inherit' : 'monospace'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.05)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.3)';
                  e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.1)';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 'var(--space-3)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: 'var(--space-1)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  borderRadius: 'var(--space-1)',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <path d="M1 1l22 22" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            
            {/* Password Generator */}
            <div style={{ 
              marginTop: 'var(--space-2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)'
              }}>
                Password requirements: 8+ characters, uppercase, lowercase, number
              </div>
              <button
                type="button"
                onClick={generatePassword}
                style={{
                  paddingTop: 'var(--space-1)',
                  paddingBottom: 'var(--space-1)',
                  paddingLeft: 'var(--space-2)',
                  paddingRight: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                  border: '1px solid rgba(var(--primary-rgb), 0.3)',
                  borderRadius: 'var(--space-1)',
                  color: 'rgb(var(--primary-rgb))',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                }}
              >
                Generate
              </button>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)'
            }}>
              Confirm Password *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={{
                width: '100%',
                paddingTop: 'var(--space-3)',
                paddingBottom: 'var(--space-3)',
                paddingLeft: 'var(--space-4)',
                paddingRight: 'var(--space-4)',
                fontSize: '0.875rem',
                backgroundColor: 'rgba(var(--border-rgb), 0.1)',
                border: '1px solid rgba(var(--border-rgb), 0.3)',
                borderRadius: 'var(--space-2)',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease-in-out',
                fontFamily: showPassword ? 'inherit' : 'monospace'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.05)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.3)';
                e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.1)';
              }}
            />
          </div>

          {/* Options */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={passwordResetRequired}
                onChange={(e) => setPasswordResetRequired(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: 'rgb(var(--primary-rgb))'
                }}
              />
              <span>Require user to change password on next login</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          paddingTop: 'var(--space-4)',
          paddingBottom: 'var(--space-6)',
          paddingLeft: 'var(--space-6)',
          paddingRight: 'var(--space-6)',
          borderTop: '1px solid rgba(var(--border-rgb), 0.5)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--space-3)'
        }}>
          <button
            onClick={handleCancel}
            disabled={loading}
            style={{
              paddingTop: 'var(--space-3)',
              paddingBottom: 'var(--space-3)',
              paddingLeft: 'var(--space-4)',
              paddingRight: 'var(--space-4)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
              }
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={loading || !password || !confirmPassword}
            style={{
              paddingTop: 'var(--space-3)',
              paddingBottom: 'var(--space-3)',
              paddingLeft: 'var(--space-4)',
              paddingRight: 'var(--space-4)',
              backgroundColor: loading || !password || !confirmPassword 
                ? 'rgba(var(--primary-rgb), 0.3)' 
                : 'rgb(var(--primary-rgb))',
              border: 'none',
              borderRadius: 'var(--space-2)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: loading || !password || !confirmPassword ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease-in-out',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}
            onMouseEnter={(e) => {
              if (!loading && password && confirmPassword) {
                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.9)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && password && confirmPassword) {
                e.currentTarget.style.backgroundColor = 'rgb(var(--primary-rgb))';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                Resetting...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Reset Password
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 