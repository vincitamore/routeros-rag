'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export function SetupForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setupAdmin } = useAuth();

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (!formData.username.trim() || !formData.email.trim()) {
      setError('Username and email are required');
      return;
    }

    setLoading(true);

    try {
      await setupAdmin({
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        full_name: formData.full_name.trim() || undefined
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: 'rgba(var(--border-rgb), 0.4)',
    border: '1px solid rgba(var(--border-rgb), 0.6)',
    borderRadius: '8px',
    color: 'rgb(var(--foreground-rgb))',
    fontSize: '14px',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    transition: 'all 0.2s ease-in-out',
    outline: 'none'
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
    e.target.style.boxShadow = '0 0 0 2px rgba(var(--primary-rgb), 0.1)';
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(var(--border-rgb), 0.6)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, rgb(var(--background-rgb)) 0%, rgba(var(--success-rgb), 0.1) 100%)'
      }}
    >
      <div 
        className="w-full max-w-sm mx-auto px-6"
        style={{ maxWidth: '400px' }}
      >
        {/* Header */}
        <div 
          className="text-center mb-6"
          style={{ 
            textAlign: 'center',
            marginBottom: '32px'
          }}
        >
          <h1 
            style={{ 
              color: 'rgb(var(--foreground-rgb))',
              fontSize: '28px',
              fontWeight: '700',
              margin: '0 0 8px 0',
              letterSpacing: '-0.025em'
            }}
          >
            Initial Setup
          </h1>
          <p 
            style={{ 
              color: 'rgb(var(--secondary-rgb))',
              fontSize: '15px',
              margin: 0,
              fontWeight: '400'
            }}
          >
            Create your administrator account
          </p>
        </div>
        
        {/* Setup Form */}
        <div 
          className="card"
          style={{
            backgroundColor: 'rgba(var(--border-rgb), 0.3)',
            border: '1px solid rgba(var(--border-rgb), 0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div 
                style={{
                  backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                  border: '1px solid rgba(var(--error-rgb), 0.3)',
                  color: 'rgb(var(--error-rgb))',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              >
                {error}
              </div>
            )}
            
            <div>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                placeholder="Username"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            
            <div>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Email address"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            
            <div>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                placeholder="Full name (optional)"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            
            <div>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="Password (min 8 characters)"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>
            
            <div>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="Confirm password"
                style={inputStyle}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: loading ? 'rgba(var(--success-rgb), 0.5)' : 'rgb(var(--success-rgb))',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease-in-out',
                opacity: loading ? 0.7 : 1,
                marginTop: '8px',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.9)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--success-rgb), 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--success-rgb))';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {loading ? 'Creating Account...' : 'Create Admin Account'}
            </button>
          </form>
        </div>

        {/* Info Message */}
        <div 
          className="text-center mt-4"
          style={{
            backgroundColor: 'rgba(var(--success-rgb), 0.1)',
            border: '1px solid rgba(var(--success-rgb), 0.3)',
            borderRadius: '8px',
            padding: '12px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
          }}
        >
          <p 
            style={{ 
              color: 'rgb(var(--success-rgb))', 
              fontSize: '13px',
              margin: 0,
              lineHeight: '1.4'
            }}
          >
            This admin account will have full access to manage the network portal
          </p>
        </div>
      </div>
    </div>
  );
} 