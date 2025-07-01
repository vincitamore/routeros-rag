'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, rgb(var(--background-rgb)) 0%, rgba(var(--primary-rgb), 0.1) 100%)'
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
            RouterOS Network Portal
          </h1>
          <p 
            style={{ 
              color: 'rgb(var(--secondary-rgb))',
              fontSize: '15px',
              margin: 0,
              fontWeight: '400'
            }}
          >
            Sign in to your account
          </p>
        </div>
        
        {/* Login Form */}
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
              <label htmlFor="username" className="sr-only">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                style={{
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
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                  e.target.style.boxShadow = '0 0 0 2px rgba(var(--primary-rgb), 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(var(--border-rgb), 0.6)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                style={{
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
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                  e.target.style.boxShadow = '0 0 0 2px rgba(var(--primary-rgb), 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(var(--border-rgb), 0.6)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: loading ? 'rgba(var(--primary-rgb), 0.5)' : 'rgb(var(--primary-rgb))',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease-in-out',
                opacity: loading ? 0.7 : 1,
                outline: 'none',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.9)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--primary-rgb), 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--primary-rgb))';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 