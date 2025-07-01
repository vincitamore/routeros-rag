'use client';

import React, { useState, useEffect } from 'react';
import { TerminalSession, SessionLog, SessionBookmark } from '../../types/terminal';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface TerminalSessionManagerProps {
  deviceId?: string;
  deviceName?: string;
  onClose: () => void;
}

export default function TerminalSessionManager({ 
  deviceId, 
  deviceName, 
  onClose 
}: TerminalSessionManagerProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<TerminalSession | null>(null);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [sessionBookmarks, setSessionBookmarks] = useState<SessionBookmark[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'sessions' | 'history' | 'bookmarks'>('sessions');
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchSessions();
  }, [deviceId]);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const url = deviceId 
        ? `/api/terminal/sessions?deviceId=${deviceId}` 
        : '/api/terminal/sessions';
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch sessions');
      
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSessionHistory = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/terminal/sessions/${sessionId}/logs`);
      if (!response.ok) throw new Error('Failed to fetch session history');
      
      const data = await response.json();
      setSessionLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session history');
    }
  };

  const fetchSessionBookmarks = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/terminal/sessions/${sessionId}/bookmarks`);
      if (!response.ok) throw new Error('Failed to fetch session bookmarks');
      
      const data = await response.json();
      setSessionBookmarks(data.bookmarks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session bookmarks');
    }
  };

  const handleSessionSelect = async (session: TerminalSession) => {
    setSelectedSession(session);
    if (currentView === 'history') {
      await fetchSessionHistory(session.id);
    } else if (currentView === 'bookmarks') {
      await fetchSessionBookmarks(session.id);
    }
  };

  const handleViewChange = async (view: 'sessions' | 'history' | 'bookmarks') => {
    setCurrentView(view);
    if (selectedSession) {
      if (view === 'history') {
        await fetchSessionHistory(selectedSession.id);
      } else if (view === 'bookmarks') {
        await fetchSessionBookmarks(selectedSession.id);
      }
    }
  };

  const exportSession = async (sessionId: string, format: 'json' | 'txt' | 'html' | 'csv') => {
    try {
      const response = await fetch(`/api/terminal/sessions/${sessionId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      });

      if (!response.ok) throw new Error('Failed to export session');

      const blob = await response.blob();
      const filename = response.headers.get('content-disposition')?.split('filename=')[1] || `session.${format}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/"/g, '');
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export session');
    }
  };

  const deleteSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    const sessionName = session?.session_name || 'this session';
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Terminal Session',
      message: `Are you sure you want to delete "${sessionName}"? This will permanently remove all session history, bookmarks, and logs. This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/terminal/sessions/${sessionId}`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete session');
          }

          // Refresh sessions list
          await fetchSessions();
          
          // If we deleted the currently selected session, clear selection
          if (selectedSession?.id === sessionId) {
            setSelectedSession(null);
            setSessionLogs([]);
            setSessionBookmarks([]);
            setCurrentView('sessions');
          }
          
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to delete session');
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const deleteMultipleSessions = (sessionIds: string[]) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Multiple Sessions',
      message: `Are you sure you want to delete ${sessionIds.length} terminal sessions? This will permanently remove all session history, bookmarks, and logs for these sessions. This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/terminal/sessions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionIds })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete sessions');
          }

          // Refresh sessions list
          await fetchSessions();
          
          // Clear selection if deleted session was selected
          if (selectedSession && sessionIds.includes(selectedSession.id)) {
            setSelectedSession(null);
            setSessionLogs([]);
            setSessionBookmarks([]);
            setCurrentView('sessions');
          }
          
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to delete sessions');
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getAuthMethodIcon = (method: string) => {
    return method === 'key' ? (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ) : (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    );
  };

  const cleanTerminalContent = (content: string): string => {
    // More comprehensive ANSI escape sequence removal
    let cleaned = content;
    
    // Remove ANSI escape sequences (colors, cursor movement, etc.)
    cleaned = cleaned.replace(/\x1b\[[0-9;]*[mGKH]/g, ''); // Colors and cursor
    cleaned = cleaned.replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''); // General ANSI sequences
    cleaned = cleaned.replace(/\x1b\([AB]/g, ''); // Character set
    cleaned = cleaned.replace(/\x1b\]0;[^\x07]*\x07/g, ''); // Window title
    cleaned = cleaned.replace(/\x1b\[[\d;]*[A-Za-z]/g, ''); // Catch remaining sequences
    
    // Remove specific terminal control sequences
    cleaned = cleaned.replace(/\x1b\[6n/g, ''); // Cursor position query
    cleaned = cleaned.replace(/\x1b\[9999[AB]/g, ''); // Large cursor movements
    cleaned = cleaned.replace(/\x1b\[H/g, ''); // Home cursor
    cleaned = cleaned.replace(/\x1b\[2J/g, ''); // Clear screen
    cleaned = cleaned.replace(/\x1b\[K/g, ''); // Clear line
    
    // Remove other control characters but keep printable content and newlines
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Remove cursor position reports and similar
    cleaned = cleaned.replace(/\[\d+;\d+R/g, '');
    
    // Normalize line endings and clean up whitespace
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    cleaned = cleaned.replace(/\n\s*\n/g, '\n'); // Remove empty lines
    
    return cleaned.trim();
  };

  const formatLogContent = (log: SessionLog): string => {
    const cleaned = cleanTerminalContent(log.content);
    
    // If it's input (command), just return the cleaned content
    if (log.is_input || log.log_type === 'command') {
      return cleaned || '[Empty command]';
    }
    
    // For output, check if we have meaningful content
    if (cleaned.length > 0) {
      // Skip very short fragments that are likely noise
      if (cleaned.length <= 2) {
        return '[Brief output]';
      }
      
      // Skip common single-word responses that aren't meaningful
      const skipWords = ['yes', 'no', 'ok', 'done', 'error', 'true', 'false'];
      if (skipWords.includes(cleaned.toLowerCase())) {
        return `[System response: ${cleaned}]`;
      }
      
      return cleaned;
    }
    
    return '[No readable output]';
  };

  return (
    <div className="terminal-session-manager">
      <div className="session-manager-header">
        <div className="session-manager-title">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span>Terminal Sessions {deviceName ? `- ${deviceName}` : ''}</span>
        </div>
        <div className="session-manager-controls">
          <div className="view-tabs">
            <button 
              className={`tab-btn ${currentView === 'sessions' ? 'active' : ''}`}
              onClick={() => handleViewChange('sessions')}
            >
              Sessions
            </button>
            <button 
              className={`tab-btn ${currentView === 'history' ? 'active' : ''}`}
              onClick={() => handleViewChange('history')}
              disabled={!selectedSession}
            >
              History
            </button>
            <button 
              className={`tab-btn ${currentView === 'bookmarks' ? 'active' : ''}`}
              onClick={() => handleViewChange('bookmarks')}
              disabled={!selectedSession}
            >
              Bookmarks
            </button>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
      </div>

      {error && (
        <div className="session-error">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="session-manager-content">
        {isLoading ? (
          <div className="session-loading">
            <div className="loading-spinner"></div>
            <span>Loading sessions...</span>
          </div>
        ) : (
          <>
            {currentView === 'sessions' && (
              <div className="sessions-view">
                {sessions.length === 0 ? (
                  <div className="no-sessions">
                    <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>No terminal sessions found</p>
                  </div>
                ) : (
                  <div className="sessions-list">
                    {sessions.map((session) => (
                      <div 
                        key={session.id}
                        className={`session-card ${selectedSession?.id === session.id ? 'selected' : ''}`}
                        onClick={() => handleSessionSelect(session)}
                      >
                        <div className="session-header">
                          <span className="session-name">{session.session_name}</span>
                                                     <div className="session-auth">
                             <span className="auth-icon">{getAuthMethodIcon(session.authentication_method)}</span>
                             <span className="auth-text">{session.authentication_method === 'key' ? 'SSH Key' : 'Password'}</span>
                           </div>
                        </div>
                        <div className="session-details">
                          <div className="session-time">
                            <span>Started: {new Date(session.start_time).toLocaleString()}</span>
                            {session.end_time && (
                              <span>Ended: {new Date(session.end_time).toLocaleString()}</span>
                            )}
                          </div>
                                                     <div className="session-stats">
                             <span>Duration: {formatDuration(session.total_duration || 0)}</span>
                             <span>Commands: {session.command_count}</span>
                           </div>
                        </div>
                        <div className="session-actions">
                          <button 
                            className="action-btn primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportSession(session.id, 'txt');
                            }}
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export
                          </button>
                          {session.status !== 'active' && (
                            <button 
                              className="action-btn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSession(session.id);
                              }}
                              title="Delete session"
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentView === 'history' && selectedSession && (
              <div className="history-view">
                <div className="history-header">
                  <h3>Session History: {selectedSession.session_name}</h3>
                  <div className="export-options">
                    <button onClick={() => exportSession(selectedSession.id, 'txt')}>Export TXT</button>
                    <button onClick={() => exportSession(selectedSession.id, 'html')}>Export HTML</button>
                    <button onClick={() => exportSession(selectedSession.id, 'csv')}>Export CSV</button>
                  </div>
                </div>
                {sessionLogs.length === 0 ? (
                  <div className="no-logs">
                    <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>No command history found for this session</p>
                  </div>
                ) : (
                  <div className="logs-list">
                    {sessionLogs.map((log) => (
                      <div key={log.id} className="log-entry">
                        <div className="log-header">
                          <span className="log-sequence">#{log.sequence_number}</span>
                          <span className="log-timestamp">{new Date(log.timestamp).toLocaleString()}</span>
                          <span className={`log-type ${log.is_input ? 'type-input' : 'type-output'}`}>
                            {log.is_input ? 'command' : log.log_type}
                          </span>
                        </div>
                        <div className={`log-content ${log.is_input ? 'log-input' : 'log-output'}`}>
                          <pre>{formatLogContent(log)}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {currentView === 'bookmarks' && selectedSession && (
              <div className="bookmarks-view">
                <div className="bookmarks-header">
                  <h3>Session Bookmarks: {selectedSession.session_name}</h3>
                </div>
                {sessionBookmarks.length === 0 ? (
                  <div className="no-bookmarks">
                    <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    <p>No bookmarks found for this session</p>
                  </div>
                ) : (
                  <div className="bookmarks-list">
                    {sessionBookmarks.map((bookmark) => (
                      <div key={bookmark.id} className="bookmark-entry">
                                                 <div className="bookmark-header">
                           <span className="bookmark-title">{bookmark.bookmark_name}</span>
                           <span className="bookmark-timestamp">{new Date(bookmark.created_at).toLocaleString()}</span>
                         </div>
                         {bookmark.description && (
                           <div className="bookmark-description">{bookmark.description}</div>
                         )}
                         <div className="bookmark-content">
                           <pre>{bookmark.log_content || 'No content available'}</pre>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .terminal-session-manager {
          background: rgba(17, 24, 39, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-3);
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          color: var(--text-primary);
        }

        .session-manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          border-bottom: 1px solid rgba(var(--border-rgb), 0.3);
          background: rgba(var(--border-rgb), 0.2);
        }

        .session-manager-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-weight: 600;
          font-size: 1.1rem;
        }

        .session-manager-controls {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .view-tabs {
          display: flex;
          gap: var(--space-1);
        }

        .tab-btn {
          padding: var(--space-2) var(--space-3);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          background: rgba(var(--border-rgb), 0.2);
          color: var(--text-secondary);
          border-radius: var(--space-2);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab-btn:hover:not(:disabled) {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: var(--primary);
        }

        .tab-btn.active {
          background: rgba(var(--primary-rgb), 0.3);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: var(--primary);
        }

        .tab-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .close-btn {
          background: rgba(var(--error-rgb), 0.2);
          border: 1px solid rgba(var(--error-rgb), 0.3);
          color: var(--error);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(var(--error-rgb), 0.3);
          border-color: rgba(var(--error-rgb), 0.5);
        }

        .session-manager-content {
          flex: 1;
          overflow: auto;
          padding: var(--space-4);
        }

        .session-error {
          background: rgba(var(--error-rgb), 0.1);
          border: 1px solid rgba(var(--error-rgb), 0.3);
          border-radius: var(--space-2);
          padding: var(--space-3);
          margin-bottom: var(--space-4);
          display: flex;
          align-items: center;
          gap: var(--space-2);
          color: var(--error);
        }

        .session-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: var(--space-3);
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(var(--border-rgb), 0.3);
          border-top: 3px solid var(--primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .no-sessions, .no-logs, .no-bookmarks {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: var(--space-3);
          color: var(--text-secondary);
        }

        .no-data-icon {
          font-size: 3rem;
        }

        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .session-card {
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-3);
          padding: var(--space-4);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .session-card:hover {
          background: rgba(var(--primary-rgb), 0.1);
          border-color: rgba(var(--primary-rgb), 0.3);
        }

        .session-card.selected {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .session-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-2);
        }

        .session-name {
          font-weight: 600;
          font-size: 1rem;
        }

        .session-auth {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .session-details {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          margin-bottom: var(--space-3);
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .session-stats {
          display: flex;
          gap: var(--space-4);
        }

        .session-actions {
          display: flex;
          gap: var(--space-2);
        }

        .action-btn {
          padding: var(--space-1) var(--space-2);
          border-radius: var(--space-1);
          border: 1px solid;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .action-btn.primary {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.3);
          color: var(--primary);
        }

        .action-btn.primary:hover {
          background: rgba(var(--primary-rgb), 0.3);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .action-btn.secondary {
          background: rgba(var(--border-rgb), 0.2);
          border-color: rgba(var(--border-rgb), 0.3);
          color: var(--text-secondary);
        }

        .action-btn.secondary:hover {
          background: rgba(var(--border-rgb), 0.3);
          border-color: rgba(var(--border-rgb), 0.5);
        }

        .action-btn.danger {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .action-btn.danger:hover {
          background: rgba(239, 68, 68, 0.3);
          border-color: rgba(239, 68, 68, 0.5);
        }

        .history-view, .bookmarks-view {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .history-header, .bookmarks-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
          padding-bottom: var(--space-2);
          border-bottom: 1px solid rgba(var(--border-rgb), 0.3);
        }

        .export-options {
          display: flex;
          gap: var(--space-2);
        }

        .export-options button {
          padding: var(--space-1) var(--space-2);
          background: rgba(var(--primary-rgb), 0.2);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          color: var(--primary);
          border-radius: var(--space-1);
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s ease;
        }

        .export-options button:hover {
          background: rgba(var(--primary-rgb), 0.3);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .logs-list, .bookmarks-list {
          flex: 1;
          overflow: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .log-entry, .bookmark-entry {
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-2);
          padding: var(--space-3);
        }

        .log-header, .bookmark-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-2);
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .log-sequence {
          font-weight: 600;
          color: var(--primary);
        }

        .log-type {
          background: rgba(var(--border-rgb), 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.7rem;
          text-transform: uppercase;
          font-weight: 600;
        }

        .log-type.type-input {
          background: rgba(var(--primary-rgb), 0.3);
          color: var(--primary);
        }

        .log-type.type-output {
          background: rgba(var(--secondary-rgb), 0.3);
          color: var(--text-secondary);
        }

        .log-content, .bookmark-content {
          background: rgba(0, 0, 0, 0.3);
          border-radius: var(--space-1);
          padding: var(--space-2);
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          line-height: 1.4;
          overflow-x: auto;
          border-left: 3px solid rgba(var(--border-rgb), 0.5);
          margin-top: var(--space-2);
        }

        .log-content.log-input {
          background: rgba(var(--primary-rgb), 0.1);
          border-left-color: var(--primary);
        }

        .log-content.log-input pre {
          color: var(--primary);
          font-weight: 600;
        }

        .log-content.log-output {
          background: rgba(var(--border-rgb), 0.15);
          border-left-color: rgba(var(--secondary-rgb), 0.7);
        }

        .log-content.log-output pre {
          color: var(--text-secondary);
        }

        .log-content pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .bookmark-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .bookmark-description {
          margin-bottom: var(--space-2);
          color: var(--text-secondary);
          font-style: italic;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
} 