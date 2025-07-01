'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTerminalManager } from '../../hooks/use-terminal-manager';
import { useTerminalSession } from '../../hooks/use-terminal-session';
import { TerminalSession, DeviceInfo } from '../../types/terminal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { CustomSelect } from '../ui/CustomSelect';
import { ExportDialog } from './ExportDialog';
import { TerminalDataParser, ParsedTerminalSession, TerminalFrame } from '../../lib/terminal-parser';
import '../../styles/terminal.css';

interface UnifiedTerminalManagerProps {
  onClose: () => void;
  deviceId?: string; // Optional device ID to pre-select when opened from device context
  devices?: DeviceInfo[]; // Optional devices array to avoid API call if already available
}

export default function UnifiedTerminalManager({ onClose, deviceId, devices: providedDevices }: UnifiedTerminalManagerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const [parsedSession, setParsedSession] = useState<ParsedTerminalSession | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Export dialog state
  const [exportDialog, setExportDialog] = useState<{
    isOpen: boolean;
    sessionId: string;
    sessionName: string;
  }>({
    isOpen: false,
    sessionId: '',
    sessionName: ''
  });
  
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

  const {
    activeSessions,
    selectedSessionId,
    isConnected: isManagerConnected,
    isLoading,
    error: managerError,
    createSession,
    resumeSession,
    closeSession,
    selectSession,
    refreshSessions,
    cleanupSessions,
    exportSession,
    connectToSession,
    disconnectFromSession,
    clearError,
    resetState
  } = useTerminalManager();

  // Get selected device for terminal connection
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);
  const selectedSession = activeSessions.find(s => s.id === selectedSessionId);

  // Use terminal session hook for actual terminal rendering
  const {
    connect: connectTerminal,
    disconnect: disconnectTerminal,
    terminateSession: terminateTerminalSession,
    resize: resizeTerminal,
    isConnected: isTerminalConnected,
    isConnecting: isTerminalConnecting,
    sessionId: terminalSessionId
  } = useTerminalSession({
    deviceId: selectedSession?.device_id || '',
    sessionName: selectedSession?.session_name,
    sessionId: selectedSession?.id, // Pass existing session ID for resuming
    persistSession: true, // Keep sessions alive when modal closes
    onConnect: () => {
      console.log('Terminal connected successfully');
    },
    onDisconnect: () => {
      console.log('Terminal disconnected');
    },
    onError: (error) => {
      console.error('Terminal error:', error);
    },
    onSessionCreated: (sessionId) => {
      console.log('Terminal session created:', sessionId);
      // Refresh sessions to pick up the new session
      refreshSessions();
    }
  });

  // Initialize devices from props or fetch from API
  useEffect(() => {
    const initializeDevices = async () => {
      let deviceList: DeviceInfo[] = [];
      
      if (providedDevices && providedDevices.length > 0) {
        // Use provided devices if available
        deviceList = providedDevices;
        setDevices(deviceList);
      } else {
        // Fetch devices from API if not provided
        try {
          const response = await fetch('/api/devices');
          if (response.ok) {
            const data = await response.json();
            deviceList = data.devices || [];
            setDevices(deviceList);
          } else {
            console.error('Failed to fetch devices:', response.statusText);
          }
        } catch (error) {
          console.error('Failed to fetch devices:', error);
        }
      }
      
      // Pre-select device if deviceId prop is provided
      if (deviceId && deviceList.find((d: DeviceInfo) => d.id === deviceId)) {
        setSelectedDeviceId(deviceId);
      } else if (deviceList.length > 0 && !selectedDeviceId) {
        // Auto-select first device if none selected and no deviceId prop
        setSelectedDeviceId(deviceList[0]?.id || '');
      }
    };

    initializeDevices();
  }, [deviceId, providedDevices]);

  // Handle terminal connection for both new and existing sessions
  const handleConnectTerminal = async () => {
    if (terminalRef.current && selectedSession && !isTerminalConnected) {
      console.log(`🔌 Connecting terminal to session: ${selectedSession.session_name} (${selectedSession.status})`);
      
      // FIRST: Connect the terminal UI and set up event listeners
      console.log(`🎯 Setting up terminal UI for session: ${selectedSession.id}`);
      connectTerminal(terminalRef.current);
      
      // Wait for terminal to be fully set up
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // SECOND: Connect Terminal Manager to the session (this will start receiving data)
      if (selectedSession.status === 'active' || selectedSession.status === 'disconnected') {
        console.log(`🎯 Connecting Terminal Manager to existing session: ${selectedSession.id}`);
        const connected = await connectToSession(selectedSession.id);
        if (!connected) {
          console.error('Failed to connect Terminal Manager to session');
          return;
        }
      }
    }
  };

  // Handle resuming live sessions vs viewing historical sessions
  const canReconnectToSession = (session: TerminalSession): boolean => {
    // We can always try to reconnect, but success depends on backend state
    // Active sessions should reconnect to existing SSH
    // Disconnected sessions will create new SSH connection but keep session record
    return true;
  };

  // Handle window resize for terminal
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        if (isTerminalConnected) {
          resizeTerminal();
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeTerminal, isTerminalConnected]);

  // Clear session history when switching sessions
  useEffect(() => {
    setSessionLogs([]);
    setParsedSession(null);
    setShowSessionHistory(false);
  }, [selectedSessionId]);

  // Get sessions for selected device
  const deviceSessions = selectedDeviceId 
    ? activeSessions.filter(s => s.device_id === selectedDeviceId)
    : activeSessions;

  // Get active sessions count
  const activeSessionsCount = activeSessions.filter(s => s.status === 'active').length;

  // State to prevent multiple session creations
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Create session directly via API instead of broken WebSocket flow
  const handleCreateAndConnectSession = async () => {
    if (!selectedDevice || isCreatingSession) return;
    
    setIsCreatingSession(true);
    console.log('🚀 Creating new session for device:', selectedDevice.name);
    
    try {
      const sessionName = `${selectedDevice.name} - ${new Date().toLocaleString()}`;
      
      // Create session directly via API POST call
      const response = await fetch('/api/terminal/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          sessionName: sessionName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const data = await response.json();
      const newSessionId = data.sessionId;
      
      console.log('✅ Session created successfully:', newSessionId);
      
      // Refresh sessions and auto-select the new one
      await refreshSessions();
      if (newSessionId) {
        selectSession(newSessionId);
      }
      
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      // Show error via the error state from useTerminalManager
      // The error will be displayed by the UI components
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSessionSelect = (session: TerminalSession) => {
    if (selectedSessionId !== session.id) {
      console.log(`🎯 Selecting session: ${session.session_name} (status: ${session.status})`);
      
      // Disconnect from current terminal session (but don't terminate it)
      disconnectTerminal();
      
      // Disconnect Terminal Manager from previous session
      disconnectFromSession();
      
      // Select new session
      selectSession(session.id);
      
      // For active and disconnected sessions, we can try to reconnect
      // Only closed sessions should default to history view
      if (session.status === 'closed' && !showSessionHistory) {
        console.log(`📜 Session ${session.status}, switching to history view`);
        setShowSessionHistory(true);
        // Load history immediately for closed sessions
        setTimeout(() => {
          setIsLoadingHistory(true);
          fetch(`/api/terminal/sessions/${session.id}/logs`)
            .then(response => {
              if (response.ok) {
                return response.json();
              } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
            })
            .then(data => {
              const logs = data.logs || [];
              setSessionLogs(logs);
              
              // Parse raw terminal data for modern display
              const parsed = TerminalDataParser.parseTerminalLogs(logs);
              setParsedSession(parsed);
              
              console.log(`📜 Loaded and parsed ${logs.length} log entries for session ${session.id} (${parsed.frames.length} frames)`);
            })
            .catch(error => {
              console.error('Error fetching session history:', error);
              setSessionLogs([]);
              setParsedSession(null);
            })
            .finally(() => {
              setIsLoadingHistory(false);
            });
        }, 100);
      } else {
        // For active/disconnected sessions that can be resumed, connect Terminal Manager
        // This ensures currentSessionRef is set properly for input forwarding
        if (session.status === 'active' || session.status === 'disconnected') {
          console.log(`🔗 Connecting Terminal Manager to resumable session: ${session.id}`);
          setTimeout(async () => {
            const connected = await connectToSession(session.id);
            if (!connected) {
              console.error('Failed to connect Terminal Manager to session');
            }
          }, 100);
        }
      }
    }
  };

  const handleCloseSession = (sessionId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Session',
      message: 'This will permanently delete the session and all its history. This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        // First disconnect terminal if it's the current session
        if (selectedSessionId === sessionId) {
          disconnectTerminal();
          disconnectFromSession();
          selectSession(''); // Clear selection
          setSessionLogs([]); // Clear loaded history
          setShowSessionHistory(false); // Reset history view
        }
        
        const success = await closeSession(sessionId);
        if (success) {
          console.log(`✅ Session ${sessionId} deleted successfully`);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEndSession = (sessionId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'End Session',
      message: 'This will disconnect the SSH connection but keep the session history available for viewing.',
      type: 'warning',
      onConfirm: async () => {
        try {
          // First disconnect terminal if it's the current session
          if (selectedSessionId === sessionId) {
            disconnectTerminal();
            disconnectFromSession();
          }
          
          // Call backend to end the session (disconnect SSH but keep record)
          const response = await fetch(`/api/terminal/sessions/${sessionId}/end`, {
            method: 'POST'
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to end session');
          }
          
          console.log(`✅ Session ${sessionId} ended successfully`);
          
          // Refresh sessions to update status
          await refreshSessions();
          
        } catch (error) {
          console.error('Failed to end session:', error);
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCleanupSessions = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cleanup Terminal Sessions',
      message: 'This will clean up old inactive sessions and duplicate sessions. Active sessions will not be affected. Continue?',
      type: 'info',
      onConfirm: async () => {
        try {
          await cleanupSessions({
            deviceId: selectedDeviceId || undefined,
            olderThanHours: 24,
            dryRun: false
          });
          await refreshSessions();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error('Cleanup failed:', error);
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleExportSession = (sessionId: string) => {
    const session = activeSessions.find(s => s.id === sessionId);
    if (session) {
      setExportDialog({
        isOpen: true,
        sessionId: sessionId,
        sessionName: session.session_name || `Session ${sessionId.substring(0, 8)}`
      });
    }
  };

  const handleExportFormat = async (format: 'json' | 'txt' | 'html' | 'csv') => {
    if (!exportDialog.sessionId) return;

    try {
      await exportSession(exportDialog.sessionId, format);
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  };

  const handleToggleHistory = async () => {
    if (!showSessionHistory && selectedSession) {
      // Load session history - this should work for ALL sessions (active, disconnected, or closed)
      setIsLoadingHistory(true);
      try {
        const response = await fetch(`/api/terminal/sessions/${selectedSession.id}/logs`);
        if (response.ok) {
          const data = await response.json();
          const logs = data.logs || [];
          setSessionLogs(logs);
          
          // Parse raw terminal data for modern display
          const parsed = TerminalDataParser.parseTerminalLogs(logs);
          setParsedSession(parsed);
          
          console.log(`📜 Loaded and parsed ${logs.length} log entries for session ${selectedSession.id} (${parsed.frames.length} frames)`);
        } else {
          console.error('Failed to fetch session history:', response.status, response.statusText);
          // Show error to user
          setSessionLogs([]);
          setParsedSession(null);
        }
      } catch (error) {
        console.error('Error fetching session history:', error);
        setSessionLogs([]);
          setParsedSession(null);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    setShowSessionHistory(!showSessionHistory);
  };

  const getStatusIcon = (session: TerminalSession) => {
    switch (session.status) {
      case 'active': 
        return (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <circle cx="4" cy="4" r="4" fill="rgb(var(--success-rgb))" />
          </svg>
        );
      case 'disconnected': 
        return (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <circle cx="4" cy="4" r="4" fill="rgb(var(--warning-rgb))" />
          </svg>
        );
      case 'closed': 
        return (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <circle cx="4" cy="4" r="4" fill="rgb(var(--error-rgb))" />
          </svg>
        );
      default: 
        return (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <circle cx="4" cy="4" r="4" fill="rgb(var(--secondary-rgb))" />
          </svg>
        );
    }
  };

  const getStatusColor = () => {
    if (isTerminalConnecting || isLoading) return 'var(--warning-rgb)';
    if (isTerminalConnected) return 'var(--success-rgb)';
    return 'var(--error-rgb)';
  };

  const getStatusText = () => {
    if (isTerminalConnecting || isLoading) return 'Connecting...';
    if (isTerminalConnected) return 'Connected';
    return 'Disconnected';
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

  return (
    <>
      <div className="unified-terminal-manager">
        <div className="terminal-manager-header">
          <div className="header-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Terminal Manager</span>
          </div>
          <div className="header-controls">
            <div className="device-selector">
              <label htmlFor="device-select">Device:</label>
              <CustomSelect
                options={[
                  { value: '', label: 'All Devices' },
                  ...devices.map(device => ({
                    value: device.id,
                    label: `${device.name} (${device.ip_address})`
                  }))
                ]}
                value={selectedDeviceId}
                onChange={setSelectedDeviceId}
                placeholder="Select a device..."
                style={{
                  minWidth: '200px',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-2)',
                  color: 'rgb(var(--foreground-rgb))',
                  fontSize: '0.875rem'
                }}
                portal={true}
              />
            </div>
            <div className="session-stats">
              <span>Sessions: {activeSessionsCount} Active, {activeSessions.length} Total</span>
            </div>
            <button onClick={onClose} className="close-button" title="Close Terminal Manager">
              ✕
            </button>
          </div>
        </div>

        <div className="terminal-manager-content">
          {/* Left Panel: Session Management */}
          <div className="sessions-panel">
            <div className="sessions-header">
              <h3>Sessions</h3>
              <div className="session-controls">
                <button
                  onClick={handleCreateAndConnectSession}
                  disabled={!selectedDevice || isCreatingSession}
                  className="btn btn-primary btn-sm"
                  title="Create New Session"
                >
                  {isCreatingSession ? 'Creating...' : '+ New'}
                </button>
                <button
                  onClick={handleCleanupSessions}
                  className="btn btn-secondary btn-sm"
                  title="Cleanup Old Sessions"
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Cleanup
                </button>
                <button
                  onClick={handleToggleHistory}
                  className="btn btn-secondary btn-sm"
                  title="Toggle Session History"
                  disabled={!selectedSession}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  {showSessionHistory ? 'Terminal' : 'History'}
                </button>
              </div>
            </div>

            <div className="sessions-list">
              {deviceSessions.length === 0 ? (
                <div className="no-sessions">
                  <p>No sessions found</p>
                  {selectedDevice && (
                    <button 
                      onClick={handleCreateAndConnectSession} 
                      disabled={isCreatingSession}
                      className="btn btn-primary"
                    >
                      {isCreatingSession ? 'Creating Session...' : 'Create First Session'}
                    </button>
                  )}
                </div>
              ) : (
                deviceSessions.map(session => (
                  <div
                    key={session.id}
                    className={`session-item ${selectedSessionId === session.id ? 'selected' : ''}`}
                    onClick={() => handleSessionSelect(session)}
                  >
                    <div className="session-status">
                      {getStatusIcon(session)}
                    </div>
                    <div className="session-info">
                      <div className="session-name">{session.session_name}</div>
                      <div className="session-details">
                        <span className="session-device">{session.device_name}</span>
                        <span className="session-duration">
                          {session.total_duration ? formatDuration(session.total_duration) : 'Active'}
                        </span>
                      </div>
                      <div className="session-time">
                        Started: {new Date(session.start_time).toLocaleString()}
                      </div>
                    </div>
                    <div className="session-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportSession(session.id);
                        }}
                        className="action-btn export-btn"
                        title="Export Session"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                      </button>
                      {session.status === 'active' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEndSession(session.id);
                          }}
                          className="action-btn end-btn"
                          title="End Session (Keep History)"
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L12 12m6.364 6.364L12 12m0 0L5.636 5.636M12 12l6.364-6.364M12 12l-6.364 6.364" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseSession(session.id);
                        }}
                        className="action-btn delete-btn"
                        title="Delete Session"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Active Terminal */}
          <div className="terminal-panel">
            <div className="terminal-header">
              <div className="terminal-title">
                {selectedSession ? (
                  <>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{selectedSession.session_name}</span>
                  </>
                ) : (
                  <span className="no-session">No Active Session</span>
                )}
              </div>
              <div className="connection-status">
                <div 
                  className="status-indicator"
                  style={{ backgroundColor: `rgb(${getStatusColor()})` }}
                ></div>
                <span className="status-text">{getStatusText()}</span>
              </div>
            </div>

            <div className="terminal-content">
              {selectedSession ? (
                showSessionHistory ? (
                  /* Session History View */
                  <div style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(var(--background-rgb), 0.98)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)'
                  }}>
                    {/* History Header */}
                    <div style={{
                      padding: 'var(--space-4)',
                      borderBottom: '1px solid rgba(var(--border-rgb), 0.2)',
                      background: 'rgba(var(--border-rgb), 0.05)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--space-3)'
                      }}>
                        <div>
                          <h3 style={{
                            margin: 0,
                            fontSize: '1.1rem',
                            fontWeight: '600',
                            color: 'var(--text-primary)',
                            marginBottom: 'var(--space-1)'
                          }}>
                            Session History
                          </h3>
                          <p style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)',
                            fontFamily: '"JetBrains Mono", "Courier New", monospace'
                          }}>
                            {selectedSession.session_name}
                          </p>
                      </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)'
                        }}>
                          <button
                            onClick={() => handleExportSession(selectedSession.id)}
                            style={{
                              padding: 'var(--space-2) var(--space-3)',
                              borderRadius: 'var(--space-2)',
                              border: '1px solid rgba(var(--primary-rgb), 0.3)',
                              background: 'rgba(var(--primary-rgb), 0.1)',
                              color: 'rgb(var(--primary-rgb))',
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-1)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.2)';
                              e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(var(--primary-rgb), 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                            }}
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export
                          </button>
                    </div>
                      </div>
                      
                      {/* Session Stats */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 'var(--space-3)',
                        marginTop: 'var(--space-3)'
                      }}>
                        {[
                          {
                            label: 'Commands',
                            value: selectedSession.command_count,
                            icon: (
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3" />
                              </svg>
                            ),
                            color: 'var(--primary-rgb)'
                          },
                          {
                            label: 'Duration',
                            value: formatDuration(selectedSession.total_duration),
                            icon: (
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ),
                            color: 'var(--success-rgb)'
                          },
                          {
                            label: 'Started',
                            value: new Date(selectedSession.start_time).toLocaleDateString(),
                            icon: (
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ),
                            color: 'var(--secondary-rgb)'
                          },
                          {
                            label: 'Device',
                            value: selectedSession.device_name,
                            icon: (
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                              </svg>
                            ),
                            color: 'var(--warning-rgb)'
                          }
                        ].map((stat, index) => (
                          <div
                            key={index}
                            style={{
                              padding: 'var(--space-3)',
                              borderRadius: 'var(--space-2)',
                              background: `rgba(${stat.color}, 0.1)`,
                              border: `1px solid rgba(${stat.color}, 0.2)`,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-2)'
                            }}
                          >
                            <div style={{ color: `rgb(${stat.color})`, flexShrink: 0 }}>
                              {stat.icon}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                marginBottom: '2px',
                                fontWeight: '500'
                              }}>
                                {stat.label}
                              </div>
                              <div style={{
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: 'var(--text-primary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {stat.value}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* History Content */}
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {isLoadingHistory ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          gap: 'var(--space-3)',
                          color: 'var(--text-secondary)'
                        }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            border: '3px solid rgba(var(--primary-rgb), 0.3)',
                            borderTop: '3px solid rgb(var(--primary-rgb))',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }}></div>
                          <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Loading session history...</span>
                        </div>
                      ) : !parsedSession || parsedSession.frames.length === 0 ? (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          gap: 'var(--space-3)',
                          color: 'var(--text-secondary)'
                        }}>
                          <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '1rem', fontWeight: '500', margin: '0 0 var(--space-1)', color: 'var(--text-primary)' }}>
                              No History Available
                            </p>
                            <p style={{ fontSize: '0.875rem', margin: 0 }}>
                              No terminal activity has been recorded for this session yet.
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Modern Asciinema-style Terminal Playback */
                        <div style={{
                          flex: 1,
                          overflow: 'auto',
                          padding: 'var(--space-3)',
                          background: 'rgba(var(--background-rgb), 0.8)'
                        }}>
                          {/* Command Summary Bar */}
                          {parsedSession && (
                            <div style={{
                              marginBottom: 'var(--space-4)',
                              padding: 'var(--space-3)',
                              background: 'rgba(var(--border-rgb), 0.1)',
                              borderRadius: 'var(--space-2)',
                              border: '1px solid rgba(var(--border-rgb), 0.2)'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  Session Duration: <strong style={{ color: 'var(--text-primary)' }}>
                                    {TerminalDataParser.formatTimestamp(parsedSession.totalDuration)}
                                  </strong>
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  Commands Executed: <strong style={{ color: 'var(--text-primary)' }}>
                                    {parsedSession.commandCount}
                                  </strong>
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  Total Frames: <strong style={{ color: 'var(--text-primary)' }}>
                                    {parsedSession.frames.length}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Terminal Frames */}
                          <div style={{
                            background: 'rgba(var(--background-rgb), 0.9)',
                            borderRadius: 'var(--space-2)',
                            border: '1px solid rgba(var(--border-rgb), 0.3)',
                            overflow: 'hidden'
                          }}>
                            {/* Terminal Header */}
                            <div style={{
                              padding: 'var(--space-2) var(--space-3)',
                              background: 'rgba(var(--border-rgb), 0.2)',
                              borderBottom: '1px solid rgba(var(--border-rgb), 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-2)',
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)'
                            }}>
                              <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }}></div>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27ca3f' }}></div>
                              </div>
                              <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                                Terminal Session — {selectedSession.session_name}
                              </span>
                              </div>
                            
                            {/* Terminal Content */}
                            <div style={{
                              padding: 'var(--space-3)',
                              background: '#1a1a1a',
                              color: '#ffffff',
                              fontFamily: '"JetBrains Mono", "Courier New", monospace',
                              fontSize: '0.875rem',
                              lineHeight: '1.4',
                              minHeight: '400px',
                              maxHeight: '600px',
                              overflow: 'auto'
                            }}>
                              {parsedSession?.frames.map((frame, index) => (
                                <div key={index} style={{ marginBottom: '2px' }}>
                                  {/* Timestamp indicator for commands */}
                                  {frame.commandContext?.isCommand && (
                                    <div style={{
                                      fontSize: '0.7rem',
                                      color: '#666',
                                      marginBottom: '4px',
                                      fontStyle: 'italic'
                                    }}>
                                      [{TerminalDataParser.formatTimestamp(frame.timestamp)}]
                                    </div>
                                  )}
                                  
                                  {/* Frame content */}
                                  <div 
                                    className="terminal-frame-content"
                                    style={{
                                      whiteSpace: 'pre',
                                      overflowX: 'auto',
                                      fontFamily: '"JetBrains Mono", "Courier New", monospace',
                                      fontSize: '14px',
                                      lineHeight: '1.2'
                                    }}
                                    dangerouslySetInnerHTML={{ 
                                      __html: frame.highlightedContent || frame.cleanContent 
                                    }}
                                  />
                                  
                                  {/* Command indicator */}
                                  {frame.commandContext?.isCommand && frame.commandContext.command && (
                                    <div style={{
                                      fontSize: '0.7rem',
                                      color: '#608b4e',
                                      marginTop: '2px',
                                      fontStyle: 'italic'
                                    }}>
                                      ↑ Command: {frame.commandContext.command}
                                    </div>
                                  )}
                                  
                                  {/* Tab completion indicator */}
                                  {frame.commandContext?.isTabCompletion && (
                                    <div style={{
                                      fontSize: '0.7rem',
                                      color: '#dcdcaa',
                                      marginTop: '2px',
                                      fontStyle: 'italic'
                                    }}>
                                      ↑ Tab completion
                                    </div>
                                  )}
                            </div>
                          ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Terminal View */
                  <div 
                    ref={terminalRef}
                    className="terminal-display"
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      background: 'rgba(21, 21, 21, 0.95)',
                      backdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 'var(--radius-lg)',
                      color: '#fff',
                      fontFamily: '"JetBrains Mono", "Courier New", monospace',
                      fontSize: '14px',
                      overflow: 'hidden',
                      cursor: !isTerminalConnected && !isTerminalConnecting ? 'pointer' : 'default'
                    }}
                    onClick={!isTerminalConnected && !isTerminalConnecting ? handleConnectTerminal : undefined}
                  >
                    {!isTerminalConnected && !isTerminalConnecting && !isLoading && (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Terminal Header */}
                        <div style={{
                          padding: 'var(--space-3)',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.02)',
                          color: 'var(--text-secondary)'
                        }}>
                          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }}></div>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }}></div>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27ca3f' }}></div>
                          </div>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.875rem' }}>
                            Terminal Session — {selectedSession.device_name}
                          </span>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: getStatusColor(),
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-1)'
                          }}>
                            {getStatusIcon(selectedSession)}
                            {selectedSession.status === 'active' ? 'Disconnected' : selectedSession.status}
                          </div>
                        </div>

                        {/* Terminal Content */}
                        <div style={{
                          flex: 1,
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                          padding: 'var(--space-6)',
                          background: '#1a1a1a',
                          color: '#d4d4d4',
                          gap: 'var(--space-4)'
                      }}>
                          {/* Connection Status Message */}
                          <div style={{
                            textAlign: 'center',
                            fontSize: '1rem',
                            fontStyle: 'italic',
                            color: '#8b949e',
                            maxWidth: '400px',
                            lineHeight: '1.5'
                          }}>
                          {selectedSession.status === 'active' 
                            ? `Reconnect to live session on ${selectedSession.device_name}...`
                            : selectedSession.status === 'disconnected'
                            ? `Resume session on ${selectedSession.device_name}...`
                            : `View session history from ${selectedSession.device_name}`
                          }
                        </div>

                          {/* Action Buttons */}
                          <div style={{ 
                            display: 'flex', 
                            gap: 'var(--space-3)', 
                            flexWrap: 'wrap',
                            justifyContent: 'center'
                          }}>
                        {selectedSession.status !== 'closed' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnectTerminal();
                            }}
                                style={{
                                  background: 'rgba(59, 130, 246, 0.15)',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  borderRadius: 'var(--radius-md)',
                                  color: '#60a5fa',
                                  padding: 'var(--space-2) var(--space-4)',
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  fontFamily: 'inherit'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)';
                                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)';
                                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                                }}
                          >
                            {selectedSession.status === 'active' ? 'Reconnect' : 'Resume Session'}
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleHistory();
                          }}
                              style={{
                                background: 'rgba(107, 114, 128, 0.15)',
                                border: '1px solid rgba(107, 114, 128, 0.3)',
                                borderRadius: 'var(--radius-md)',
                                color: '#9ca3af',
                                padding: 'var(--space-2) var(--space-4)',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                fontFamily: 'inherit'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.25)';
                                e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.5)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(107, 114, 128, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.3)';
                              }}
                        >
                          View History ({selectedSession.command_count} commands)
                        </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {isTerminalConnecting && (
                      <div style={{
                        height: '100%',
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        padding: 'var(--space-6)',
                        background: '#1a1a1a',
                        gap: 'var(--space-3)'
                      }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          border: '3px solid rgba(59, 130, 246, 0.3)',
                          borderTop: '3px solid #3b82f6',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }}></div>
                        <span style={{ color: '#8b949e', fontSize: '0.875rem' }}>
                          Connecting to {selectedSession.device_name}...
                        </span>
                      </div>
                    )}
                    {managerError && (
                      <div style={{
                        height: '100%',
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        padding: 'var(--space-6)',
                        background: '#1a1a1a',
                        gap: 'var(--space-4)'
                      }}>
                        <div style={{ 
                          color: '#ef4444',
                          fontSize: '0.875rem',
                          textAlign: 'center',
                          maxWidth: '400px',
                          lineHeight: '1.5'
                        }}>
                          Connection failed: {managerError}
                        </div>
                        <button 
                          onClick={clearError}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            color: '#f87171',
                            padding: 'var(--space-2) var(--space-4)',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontFamily: 'inherit'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                          }}
                        >
                          Retry Connection
                        </button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="no-terminal">
                  <div className="no-terminal-content">
                    <h3>No Session Selected</h3>
                    <p>Select a session from the left panel or create a new one</p>
                    {selectedDevice && (
                      <button 
                        onClick={handleCreateAndConnectSession} 
                        disabled={isCreatingSession}
                        className="btn btn-primary"
                      >
                        {isCreatingSession ? 'Creating Session...' : 'Create New Session'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportDialog.isOpen}
        onClose={() => setExportDialog(prev => ({ ...prev, isOpen: false }))}
        onExport={handleExportFormat}
        sessionId={exportDialog.sessionId}
        terminalElement={null} // Not used for regular exports
        deviceName={exportDialog.sessionName}
        parsedSession={parsedSession}
      />
    </>
  );
} 