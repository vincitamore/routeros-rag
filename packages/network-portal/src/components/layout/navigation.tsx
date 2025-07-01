'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

interface NavigationProps {
  className?: string;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Devices',
    href: '/devices',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line>
      </svg>
    ),
  },
  {
    name: 'Monitoring',
    href: '/monitoring',
    icon: (
                    <svg width="20" height="20" viewBox="0 0 128 128" fill="currentColor">
                <path d="M128 104.9v7.1H0V16h7v88.9h12.7V54.3h22.7v50.6h5.3V43.7h22.8v61.2h5.2V64.4h22.8v40.5z"/>
              </svg>
    ),
  },
  {
    name: 'Network',
    href: '/network',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
];

// Admin-only navigation items
const adminNavigation = [
  {
    name: 'User Management',
    href: '/admin/users',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
      </svg>
    ),
  },
  {
    name: 'Disk Management',
    href: '/admin/disk-management',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    name: 'Database Admin',
    href: '/admin/database',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
];

export function Navigation({ className = '' }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const { logout, user } = useAuth();

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleCloseMobileMenu = () => {
    console.log('Closing mobile menu, current state:', isMobileMenuOpen);
    setIsMobileMenuOpen(false);
  };

  const handleOpenMobileMenu = () => {
    console.log('Opening mobile menu');
    setIsMobileMenuOpen(true);
  };

  return (
    <>
      {/* Mobile overlay - only show on mobile when menu is open */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(2px)' }}
          onClick={handleCloseMobileMenu}
        />
      )}

      {/* Mobile menu button - only show on mobile */}
      {isMobile && (
        <button
          type="button"
          className="fixed top-4 left-4 z-30"
          style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '3rem',
            height: '3rem',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgba(var(--background-rgb), 0.95)',
            color: 'var(--text-primary)',
            border: '1px solid rgba(var(--border-rgb), 0.5)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
            e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
            e.currentTarget.style.color = 'rgb(var(--primary-rgb))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(var(--background-rgb), 0.95)';
            e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onClick={handleOpenMobileMenu}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Sidebar */}
      <div 
        className={className}
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: '16rem',
          backgroundColor: 'var(--background-sidebar)',
          borderRight: '1px solid var(--border)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 50,
          transform: isMobile ? (isMobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          height: '4rem', 
          padding: '0 1.5rem',
          borderBottom: '1px solid var(--border)'
        }}>
          <h1 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700', 
            color: 'var(--text-primary)',
            margin: 0
          }}>
            RouterOS Portal
          </h1>
          
          {/* Close button - only show on mobile when menu is open */}
          {isMobile && (
            <button
              type="button"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2rem',
                height: '2rem',
                padding: '0.25rem',
                borderRadius: '0.375rem',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
              }}
              onClick={handleCloseMobileMenu}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav style={{ marginTop: '1.5rem', padding: '0 0.75rem', height: 'calc(100vh - 8rem)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
            {/* Main Navigation */}
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    backgroundColor: isActive ? 'rgba(var(--primary-rgb), 0.2)' : 'transparent',
                    borderLeft: isActive ? '3px solid rgb(var(--primary-rgb))' : '3px solid transparent',
                    color: isActive ? 'rgb(var(--primary-rgb))' : 'var(--text-primary)',
                    marginLeft: isActive ? '-3px' : '0'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
                      e.currentTarget.style.color = 'rgb(var(--primary-rgb))';
                      e.currentTarget.style.textDecoration = 'none';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.textDecoration = 'none';
                    }
                  }}
                  onClick={isMobile ? handleCloseMobileMenu : undefined}
                >
                  <div style={{ flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <span style={{ 
                    textDecoration: 'none',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.name}
                  </span>
                </Link>
              );
            })}

            {/* Admin Navigation - Only show for admin users */}
            {user && user.role === 'admin' && (
              <>
                <div style={{
                  borderTop: '1px solid var(--border)',
                  margin: '1rem 0',
                  paddingTop: '1rem'
                }}>
                  <h3 style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.75rem',
                    paddingLeft: '0.75rem'
                  }}>
                    Administration
                  </h3>
                </div>
                {adminNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        borderRadius: '0.5rem',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        backgroundColor: isActive ? 'rgba(var(--primary-rgb), 0.2)' : 'transparent',
                        borderLeft: isActive ? '3px solid rgb(var(--primary-rgb))' : '3px solid transparent',
                        color: isActive ? 'rgb(var(--primary-rgb))' : 'var(--text-primary)',
                        marginLeft: isActive ? '-3px' : '0'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
                          e.currentTarget.style.color = 'rgb(var(--primary-rgb))';
                          e.currentTarget.style.textDecoration = 'none';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-primary)';
                          e.currentTarget.style.textDecoration = 'none';
                        }
                      }}
                      onClick={isMobile ? handleCloseMobileMenu : undefined}
                    >
                      <div style={{ flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <span style={{ 
                        textDecoration: 'none',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </>
            )}
          </div>
          
          {/* User info and logout section */}
          <div style={{ 
            borderTop: '1px solid var(--border)', 
            paddingTop: '1rem', 
            marginTop: '1rem',
            marginBottom: '1rem'
          }}>
            {user && (
              <div style={{ 
                padding: '0.75rem',
                marginBottom: '0.5rem',
                backgroundColor: 'rgba(var(--border-rgb), 0.1)',
                borderRadius: '0.5rem'
              }}>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)', 
                  marginBottom: '0.25rem' 
                }}>
                  Logged in as
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: 'var(--text-primary)' 
                }}>
                  {user.username} ({user.role})
                </div>
              </div>
            )}
            
            <button
              onClick={async () => {
                try {
                  await logout();
                  if (isMobile) handleCloseMobileMenu();
                } catch (error) {
                  console.error('Logout failed:', error);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                fontSize: '0.875rem',
                fontWeight: '500',
                borderRadius: '0.5rem',
                width: '100%',
                border: 'none',
                backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                color: 'rgb(var(--error-rgb))',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.1)';
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </div>
    </>
  );
} 