import React, { useState, useEffect } from 'react';
import { User } from '../../../types/user-management';
import { apiClient } from '@/lib/api-client';

interface UserSession {
  id: string;
  user_id: string;
  device_info?: string;
  location?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

interface SessionManagementModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

export function SessionManagementModal({ user, isOpen, onClose }: SessionManagementModalProps) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminating, setTerminating] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/admin/users/${user.id}/sessions`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to fetch sessions');
      }
      
      const data = await response.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    setTerminating(sessionId);
    
    try {
      const response = await apiClient.delete(`/api/admin/sessions/${sessionId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to terminate session');
      }
      
      // Remove session from local state
      setSessions(prevSessions => 
        prevSessions.filter(session => session.id !== sessionId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to terminate session');
    } finally {
      setTerminating(null);
    }
  };

  const terminateAllSessions = async () => {
    setLoading(true);
    
    try {
      const response = await apiClient.delete(`/api/admin/users/${user.id}/sessions`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to terminate all sessions');
      }
      
      setSessions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to terminate all sessions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDeviceIcon = (userAgent?: string) => {
    if (!userAgent) return '🖥️';
    if (userAgent.includes('Mobile')) return '📱';
    if (userAgent.includes('Tablet')) return '📲';
    return '🖥️';
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

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
        maxWidth: '800px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
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
              Active Sessions
            </h2>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              margin: 0
            }}>
              Manage active sessions for {user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}` 
                : user.username
              }
            </p>
          </div>
          
          <button
            onClick={onClose}
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
          flex: 1,
          overflow: 'auto',
          paddingTop: 'var(--space-4)',
          paddingLeft: 'var(--space-6)',
          paddingRight: 'var(--space-6)'
        }}>
          {/* Actions Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)',
            paddingBottom: 'var(--space-3)',
            borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4l-3 3" />
              </svg>
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </div>
            
            {sessions.length > 0 && (
              <button
                onClick={terminateAllSessions}
                disabled={loading}
                style={{
                  paddingTop: 'var(--space-2)',
                  paddingBottom: 'var(--space-2)',
                  paddingLeft: 'var(--space-3)',
                  paddingRight: 'var(--space-3)',
                  backgroundColor: 'rgba(var(--error-rgb), 0.2)',
                  border: '1px solid rgba(var(--error-rgb), 0.3)',
                  borderRadius: 'var(--space-1)',
                  color: 'rgb(var(--error-rgb))',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
                  }
                }}
              >
                {loading ? 'Terminating...' : 'Terminate All Sessions'}
              </button>
            )}
          </div>

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

          {/* Sessions List */}
          {loading ? (
            <div style={{
              textAlign: 'center',
              paddingTop: 'var(--space-8)',
              paddingBottom: 'var(--space-8)',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem'
            }}>
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              paddingTop: 'var(--space-8)',
              paddingBottom: 'var(--space-8)',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem'
            }}>
              No active sessions found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 'var(--space-4)',
                    paddingBottom: 'var(--space-4)',
                    paddingLeft: 'var(--space-4)',
                    paddingRight: 'var(--space-4)',
                    backgroundColor: 'rgba(var(--border-rgb), 0.1)',
                    border: '1px solid rgba(var(--border-rgb), 0.3)',
                    borderRadius: 'var(--space-2)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.1)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                    <div style={{ fontSize: '1.25rem' }}>
                      {getDeviceIcon(session.user_agent)}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: '500', 
                        color: 'var(--text-primary)',
                        marginBottom: 'var(--space-1)'
                      }}>
                        {session.device_info || 'Unknown Device'}
                      </div>
                      
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-1)'
                      }}>
                        <div>IP: {session.ip_address}</div>
                        <div>Expires: {formatDate(session.expires_at)}</div>
                        {session.location && <div>Location: {session.location}</div>}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => terminateSession(session.id)}
                    disabled={terminating === session.id}
                    style={{
                      paddingTop: 'var(--space-2)',
                      paddingBottom: 'var(--space-2)',
                      paddingLeft: 'var(--space-3)',
                      paddingRight: 'var(--space-3)',
                      backgroundColor: 'rgba(var(--error-rgb), 0.2)',
                      border: '1px solid rgba(var(--error-rgb), 0.3)',
                      borderRadius: 'var(--space-1)',
                      color: 'rgb(var(--error-rgb))',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      cursor: terminating === session.id ? 'not-allowed' : 'pointer',
                      opacity: terminating === session.id ? 0.6 : 1,
                      transition: 'all 0.2s ease-in-out',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      if (terminating !== session.id) {
                        e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (terminating !== session.id) {
                        e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
                      }
                    }}
                  >
                    {terminating === session.id ? 'Terminating...' : 'Terminate'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          paddingTop: 'var(--space-4)',
          paddingBottom: 'var(--space-6)',
          paddingLeft: 'var(--space-6)',
          paddingRight: 'var(--space-6)',
          borderTop: '1px solid rgba(var(--border-rgb), 0.5)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
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
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 