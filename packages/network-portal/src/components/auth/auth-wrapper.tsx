'use client';

import { useAuth } from '@/contexts/auth-context';
import { LoginForm } from './login-form';
import { SetupForm } from './setup-form';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, isSetupRequired } = useAuth();

  if (loading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--background-rgb)) 0%, rgba(var(--primary-rgb), 0.1) 100%)'
        }}
      >
        <div 
          className="card text-center"
          style={{
            minWidth: '300px',
            backgroundColor: 'rgba(var(--border-rgb), 0.3)',
            border: '1px solid rgba(var(--border-rgb), 0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <div 
            className="animate-spin rounded-full h-8 w-8 border-2 mx-auto mb-4"
            style={{
              borderColor: 'rgba(var(--primary-rgb), 0.3)',
              borderTopColor: 'rgb(var(--primary-rgb))'
            }}
          ></div>
          <p style={{ color: 'rgb(var(--secondary-rgb))' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (isSetupRequired) {
    return <SetupForm />;
  }

  if (!user) {
    return <LoginForm />;
  }

  return <>{children}</>;
} 