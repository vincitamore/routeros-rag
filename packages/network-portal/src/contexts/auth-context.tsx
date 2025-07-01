'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'operator' | 'user' | 'viewer';
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isSetupRequired: boolean;
  setupAdmin: (data: SetupData) => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

interface SetupData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsSetupRequired(false);
      } else if (response.status === 401) {
        // Check if setup is required
        const setupResponse = await fetch('/api/auth/setup-status', {
          credentials: 'include'
        });
        if (setupResponse.ok) {
          const setupData = await setupResponse.json();
          setIsSetupRequired(setupData.setupRequired);
        }
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    setUser(data.user);
    setIsSetupRequired(false);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const setupAdmin = async (data: SetupData) => {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Setup failed');
    }

    const responseData = await response.json();
    
    // The backend now automatically logs in the user after setup
    setUser(responseData.user);
    setIsSetupRequired(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isSetupRequired,
      setupAdmin,
      checkAuthStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}; 