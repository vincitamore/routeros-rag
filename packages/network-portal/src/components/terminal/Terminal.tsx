'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTerminalSession } from '../../hooks/use-terminal-session';
import { DeviceInfo, TerminalConnectionInfo } from '../../types/terminal';
import { ExportDialog } from './ExportDialog';
import '../../styles/terminal.css';

interface TerminalProps {
  deviceId: string;
  deviceName: string;
  onClose?: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({ 
  deviceId, 
  deviceName, 
  onClose 
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<TerminalConnectionInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  const {
    connect,
    disconnect,
    resize,
    isConnected,
    isConnecting
  } = useTerminalSession({
    deviceId,
    sessionName: `${deviceName} - ${new Date().toLocaleString()}`,
    onConnect: () => {
      setError(null);
      setShowSlowLoadingMessage(false);
      console.log('Terminal connected');
    },
    onDisconnect: () => {
      setShowSlowLoadingMessage(false);
      console.log('Terminal disconnected');
    },
    onError: (errorMessage) => {
      setError(errorMessage);
      setShowSlowLoadingMessage(false);
    },
    onSessionCreated: (id) => {
      setSessionId(id);
      console.log('Terminal session created:', id);
    }
  });

  // Fetch device info on mount
  useEffect(() => {
    const fetchDeviceInfo = async () => {
      try {
        const response = await fetch(`/api/terminal/devices/${deviceId}/info`);
        if (response.ok) {
          const data = await response.json();
          setDeviceInfo(data.device);
        }
      } catch (error) {
        console.error('Failed to fetch device info:', error);
      }
    };

    fetchDeviceInfo();
  }, [deviceId]);

  // Test SSH connection before attempting to connect
  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await fetch(`/api/terminal/devices/${deviceId}/test`, {
          method: 'POST'
        });
        if (response.ok) {
          const data = await response.json();
          setConnectionInfo(data);
        }
      } catch (error) {
        console.error('Failed to test SSH connection:', error);
      }
    };

    testConnection();
  }, [deviceId]);

  useEffect(() => {
    if (terminalRef.current && deviceInfo?.terminalAvailable) {
      // Small delay to ensure the DOM is fully rendered
      setTimeout(() => {
        if (terminalRef.current) {
          connect(terminalRef.current);
        }
      }, 100);
    }
  }, [deviceInfo]);

  // Show loading message only if connection takes longer than 1 second
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isConnecting && !isConnected) {
      timeoutId = setTimeout(() => {
        setShowSlowLoadingMessage(true);
      }, 1000);
    } else {
      setShowSlowLoadingMessage(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isConnecting, isConnected]);

  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        if (isConnected) {
          resize();
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resize, isConnected]);

  const handleClose = () => {
    disconnect();
    onClose?.();
  };

  const getStatusColor = () => {
    if (isConnecting) return 'var(--warning-rgb)';
    if (isConnected) return 'var(--success-rgb)';
    return 'var(--error-rgb)';
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    return 'Disconnected';
  };

  const getAuthMethodIcon = () => {
    if (!deviceInfo) return '🔐';
    return deviceInfo.authMethod === 'key' ? '🔑' : '🔐';
  };

  const getAuthMethodText = () => {
    if (!deviceInfo) return 'Unknown';
    return deviceInfo.authMethod === 'key' ? 'SSH Key' : 'Password';
  };

  const handleSessionHistory = () => {
    if (sessionId) {
      // Open session history in a new tab
      window.open(`/terminal/sessions/${sessionId}/history`, '_blank');
    }
  };

  const handleExportSession = () => {
    if (sessionId) {
      setShowExportDialog(true);
    }
  };

  const handleExportFormat = async (format: 'json' | 'txt' | 'html' | 'csv') => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/terminal/sessions/${sessionId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      });

      if (response.ok) {
        // Download the file
        const filename = response.headers.get('content-disposition')?.split('filename=')[1] || `session.${format}`;
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('Export failed');
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-title">
          <span className="terminal-icon">💻</span>
          <span>{deviceName} SSH Terminal</span>
          <div className="terminal-auth-info">
            <span className="auth-icon">{getAuthMethodIcon()}</span>
            <span className="auth-method">{getAuthMethodText()}</span>
            {deviceInfo?.sshKeysConfigured && (
              <span className="ssh-keys-badge">🔒 Secure</span>
            )}
          </div>
          <div 
            className="terminal-status"
            style={{ color: `rgb(${getStatusColor()})` }}
          >
            <span className="status-dot" />
            {getStatusText()}
          </div>
        </div>
        <div className="terminal-controls">
          {sessionId && isConnected && (
            <>
              <button 
                className="terminal-btn terminal-btn-secondary"
                onClick={handleSessionHistory}
                title="View session history"
              >
                📜
              </button>
              <button 
                className="terminal-btn terminal-btn-secondary"
                onClick={handleExportSession}
                title="Export session"
              >
                💾
              </button>
            </>
          )}
          <button 
            className="terminal-btn terminal-btn-secondary"
            onClick={() => {
              setTimeout(() => resize(), 50);
            }}
            title="Resize terminal"
          >
            ⟲
          </button>
          {onClose && (
            <button 
              className="terminal-btn terminal-btn-danger"
              onClick={handleClose}
              title="Close terminal"
            >
              ×
            </button>
          )}
        </div>
      </div>
      
      {!deviceInfo?.terminalAvailable && (
        <div className="terminal-error">
          <span className="error-icon">⚠️</span>
          <span>Terminal is not available for this device. Device status: {deviceInfo?.status || 'unknown'}</span>
        </div>
      )}

      {connectionInfo && !connectionInfo.sshAvailable && (
        <div className="terminal-error">
          <span className="error-icon">🔒</span>
          <span>{connectionInfo.message}</span>
        </div>
      )}

      {deviceInfo?.authMethod === 'key' && !deviceInfo.sshKeysConfigured && (
        <div className="terminal-warning">
          <span className="warning-icon">⚠️</span>
          <span>SSH keys are expected but not properly configured. Connection may fail.</span>
        </div>
      )}
      
      {error && (
        <div className="terminal-error">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          {error.includes('SSH') && deviceInfo?.authMethod === 'password' && (
            <div className="error-suggestion">
              <strong>Suggestion:</strong> This device may require SSH key authentication. 
              Consider running the HTTPS setup to configure secure SSH keys.
            </div>
          )}
        </div>
      )}
      
      {showSlowLoadingMessage && !error && (
        <div className="terminal-loading">
          <div className="loading-spinner"></div>
          <span>
            Establishing SSH connection using {getAuthMethodText()} authentication...
            {deviceInfo?.authMethod === 'key' && ' (Secure)'}
          </span>
        </div>
      )}

      {sessionId && (
        <div className="terminal-session-info">
          <span className="session-label">Session:</span>
          <span className="session-id">{sessionId.substring(0, 8)}...</span>
        </div>
      )}
      
      <div 
        ref={terminalRef} 
        className="terminal-body"
        style={{ height: '600px', width: '100%', overflow: 'hidden' }}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExportFormat}
        sessionId={sessionId || ''}
        terminalElement={terminalRef.current}
        deviceName={deviceName}
      />
    </div>
  );
}; 