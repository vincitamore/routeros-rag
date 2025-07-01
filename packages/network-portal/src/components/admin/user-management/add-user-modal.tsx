'use client';

import React, { useState } from 'react';
import { CreateUserRequest, UserRole, UserFormErrors } from '../../../types/user-management';
import { CustomSelect } from '../../ui/CustomSelect';
import { Tooltip } from '../../ui/Tooltip';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserRequest) => Promise<void>;
  loading?: boolean;
}

export function AddUserModal({ isOpen, onClose, onSubmit, loading = false }: AddUserModalProps) {
  const [formData, setFormData] = useState<CreateUserRequest>({
    username: '',
    email: '',
    password: '',
    role: 'user',
    first_name: '',
    last_name: '',
    phone: '',
    department: '',
    notes: '',
    account_status: 'active',
    password_reset_required: true,
    email_verified: false,
    two_factor_enabled: false,
  });

  const [errors, setErrors] = useState<UserFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (name: string, value: string) => {
    const newErrors: UserFormErrors = { ...errors };

    switch (name) {
      case 'username':
        if (!value.trim()) {
          newErrors.username = 'Username is required';
        } else if (value.length < 3) {
          newErrors.username = 'Username must be at least 3 characters';
        } else if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
          newErrors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
        } else {
          delete newErrors.username;
        }
        break;
      case 'email':
        if (!value.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = 'Please enter a valid email address';
        } else {
          delete newErrors.email;
        }
        break;
      case 'password':
        if (!value) {
          newErrors.password = 'Password is required';
        } else if (value.length < 8) {
          newErrors.password = 'Password must be at least 8 characters';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
        } else {
          delete newErrors.password;
        }
        break;
      case 'first_name':
        if (value && value.length > 100) {
          newErrors.first_name = 'First name must be less than 100 characters';
        } else {
          delete newErrors.first_name;
        }
        break;
      case 'last_name':
        if (value && value.length > 100) {
          newErrors.last_name = 'Last name must be less than 100 characters';
        } else {
          delete newErrors.last_name;
        }
        break;
      case 'phone':
        if (value && !/^[\d\s\-\+\(\)]+$/.test(value)) {
          newErrors.phone = 'Please enter a valid phone number';
        } else {
          delete newErrors.phone;
        }
        break;
      case 'department':
        if (value && value.length > 100) {
          newErrors.department = 'Department must be less than 100 characters';
        } else {
          delete newErrors.department;
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateField(name, formData[name as keyof CreateUserRequest] as string);
  };

  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one of each required character type
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleGeneratePassword = () => {
    const newPassword = generatePassword();
    handleInputChange('password', newPassword);
    setTouched(prev => ({ ...prev, password: true }));
    validateField('password', newPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const requiredFields = ['username', 'email', 'password'];
    const newTouched: Record<string, boolean> = {};
    
    requiredFields.forEach(field => {
      newTouched[field] = true;
      validateField(field, formData[field as keyof CreateUserRequest] as string);
    });
    
    setTouched(prev => ({ ...prev, ...newTouched }));
    
    // Check if there are any errors
    if (Object.keys(errors).length > 0) {
      return;
    }
    
    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'user',
        first_name: '',
        last_name: '',
        phone: '',
        department: '',
        notes: '',
        account_status: 'active',
        password_reset_required: true,
        email_verified: false,
        two_factor_enabled: false,
      });
      setErrors({});
      setTouched({});
      onClose();
    } catch (error) {
      // Error handling is done by the parent component
    }
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
      padding: 'var(--space-4)',
      overflowY: 'auto'
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: 'rgba(var(--background-rgb), 0.95)',
        border: '1px solid rgba(var(--border-rgb), 0.8)',
        borderRadius: 'var(--space-3)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.4)'
      }}>
        {/* Header */}
        <div style={{
          padding: 'var(--space-6)',
          paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid rgba(var(--border-rgb), 0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Add New User
            </h2>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                padding: 'var(--space-2)',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 'var(--space-1)',
                color: 'var(--text-secondary)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease-in-out',
                opacity: loading ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Username and Email Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  onBlur={() => handleBlur('username')}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--background-rgb), 0.8)',
                    border: `1px solid ${errors.username ? 'rgb(var(--error-rgb))' : 'rgba(var(--border-rgb), 0.6)'}`,
                    borderRadius: 'var(--space-2)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    transition: 'border-color 0.2s ease-in-out',
                    opacity: loading ? 0.7 : 1
                  }}
                  placeholder="Enter username"
                />
                {errors.username && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--error-rgb))',
                    margin: 0,
                    marginTop: 'var(--space-1)'
                  }}>
                    {errors.username}
                  </p>
                )}
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--background-rgb), 0.8)',
                    border: `1px solid ${errors.email ? 'rgb(var(--error-rgb))' : 'rgba(var(--border-rgb), 0.6)'}`,
                    borderRadius: 'var(--space-2)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    transition: 'border-color 0.2s ease-in-out',
                    opacity: loading ? 0.7 : 1
                  }}
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--error-rgb))',
                    margin: 0,
                    marginTop: 'var(--space-1)'
                  }}>
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-2)'
              }}>
                Password *
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--background-rgb), 0.8)',
                    border: `1px solid ${errors.password ? 'rgb(var(--error-rgb))' : 'rgba(var(--border-rgb), 0.6)'}`,
                    borderRadius: 'var(--space-2)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    transition: 'border-color 0.2s ease-in-out',
                    opacity: loading ? 0.7 : 1
                  }}
                  placeholder="Enter password"
                />
                <Tooltip content="Generate secure password">
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    disabled={loading}
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                      border: '1px solid rgba(var(--primary-rgb), 0.3)',
                      borderRadius: 'var(--space-2)',
                      color: 'rgb(var(--primary-rgb))',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      opacity: loading ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
              {errors.password && (
                <p style={{
                  fontSize: '0.75rem',
                  color: 'rgb(var(--error-rgb))',
                  margin: 0,
                  marginTop: 'var(--space-1)'
                }}>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Role and Status Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Role
                </label>
                <CustomSelect
                  value={formData.role}
                  onChange={(value) => handleInputChange('role', value)}
                  options={[
                    { value: 'admin', label: 'Admin' },
                    { value: 'operator', label: 'Operator' },
                    { value: 'user', label: 'User' },
                    { value: 'viewer', label: 'Viewer' }
                  ]}
                  disabled={loading}
                  portal={true}
                  minWidth="200px"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Account Status
                </label>
                <CustomSelect
                  value={formData.account_status || 'active'}
                  onChange={(value) => handleInputChange('account_status', value)}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'locked', label: 'Locked' }
                  ]}
                  disabled={loading}
                  portal={true}
                  minWidth="200px"
                />
              </div>
            </div>

            {/* Name Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.first_name || ''}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  onBlur={() => handleBlur('first_name')}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--background-rgb), 0.8)',
                    border: `1px solid ${errors.first_name ? 'rgb(var(--error-rgb))' : 'rgba(var(--border-rgb), 0.6)'}`,
                    borderRadius: 'var(--space-2)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    transition: 'border-color 0.2s ease-in-out',
                    opacity: loading ? 0.7 : 1
                  }}
                  placeholder="Enter first name"
                />
                {errors.first_name && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--error-rgb))',
                    margin: 0,
                    marginTop: 'var(--space-1)'
                  }}>
                    {errors.first_name}
                  </p>
                )}
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.last_name || ''}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  onBlur={() => handleBlur('last_name')}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--background-rgb), 0.8)',
                    border: `1px solid ${errors.last_name ? 'rgb(var(--error-rgb))' : 'rgba(var(--border-rgb), 0.6)'}`,
                    borderRadius: 'var(--space-2)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    transition: 'border-color 0.2s ease-in-out',
                    opacity: loading ? 0.7 : 1
                  }}
                  placeholder="Enter last name"
                />
                {errors.last_name && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--error-rgb))',
                    margin: 0,
                    marginTop: 'var(--space-1)'
                  }}>
                    {errors.last_name}
                  </p>
                )}
              </div>
            </div>

            {/* Phone and Department Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  onBlur={() => handleBlur('phone')}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--background-rgb), 0.8)',
                    border: `1px solid ${errors.phone ? 'rgb(var(--error-rgb))' : 'rgba(var(--border-rgb), 0.6)'}`,
                    borderRadius: 'var(--space-2)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    transition: 'border-color 0.2s ease-in-out',
                    opacity: loading ? 0.7 : 1
                  }}
                  placeholder="Enter phone number"
                />
                {errors.phone && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--error-rgb))',
                    margin: 0,
                    marginTop: 'var(--space-1)'
                  }}>
                    {errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => handleInputChange('department', e.target.value)}
                  onBlur={() => handleBlur('department')}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--background-rgb), 0.8)',
                    border: `1px solid ${errors.department ? 'rgb(var(--error-rgb))' : 'rgba(var(--border-rgb), 0.6)'}`,
                    borderRadius: 'var(--space-2)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    transition: 'border-color 0.2s ease-in-out',
                    opacity: loading ? 0.7 : 1
                  }}
                  placeholder="Enter department"
                />
                {errors.department && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'rgb(var(--error-rgb))',
                    margin: 0,
                    marginTop: 'var(--space-1)'
                  }}>
                    {errors.department}
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-2)'
              }}>
                Notes
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                disabled={loading}
                rows={3}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  backgroundColor: 'rgba(var(--background-rgb), 0.8)',
                  border: '1px solid rgba(var(--border-rgb), 0.6)',
                  borderRadius: 'var(--space-2)',
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  minHeight: '80px',
                  opacity: loading ? 0.7 : 1
                }}
                placeholder="Optional notes about the user"
              />
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={formData.password_reset_required || false}
                  onChange={(e) => handleInputChange('password_reset_required', e.target.checked.toString())}
                  disabled={loading}
                  style={{ opacity: loading ? 0.5 : 1 }}
                />
                Require password change on first login
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={formData.email_verified || false}
                  onChange={(e) => handleInputChange('email_verified', e.target.checked.toString())}
                  disabled={loading}
                  style={{ opacity: loading ? 0.5 : 1 }}
                />
                Mark email as verified
              </label>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid rgba(var(--border-rgb), 0.6)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                paddingTop: 'var(--space-3)',
                paddingBottom: 'var(--space-3)',
                paddingLeft: 'var(--space-4)',
                paddingRight: 'var(--space-4)',
                backgroundColor: 'rgba(var(--secondary-rgb), 0.2)',
                border: '1px solid rgba(var(--secondary-rgb), 0.3)',
                borderRadius: 'var(--space-2)',
                color: 'rgb(var(--secondary-rgb))',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease-in-out',
                opacity: loading ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--secondary-rgb), 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(var(--secondary-rgb), 0.2)';
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || Object.keys(errors).length > 0}
              style={{
                paddingTop: 'var(--space-3)',
                paddingBottom: 'var(--space-3)',
                paddingLeft: 'var(--space-4)',
                paddingRight: 'var(--space-4)',
                backgroundColor: loading || Object.keys(errors).length > 0 
                  ? 'rgba(var(--secondary-rgb), 0.3)' 
                  : 'rgb(var(--primary-rgb))',
                border: 'none',
                borderRadius: 'var(--space-2)',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: loading || Object.keys(errors).length > 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease-in-out',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}
              onMouseEnter={(e) => {
                if (!loading && Object.keys(errors).length === 0) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.9)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && Object.keys(errors).length === 0) {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--primary-rgb))';
                }
              }}
            >
              {loading && (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              )}
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
} 