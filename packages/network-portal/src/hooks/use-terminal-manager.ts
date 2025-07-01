import { useState, useEffect, useCallback, useRef } from 'react';
import { TerminalSession } from '../types/terminal';

export interface TerminalManagerState {
  activeSessions: TerminalSession[];
  selectedSessionId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface TerminalManagerActions {
  // Session Management
  createSession: (deviceId: string, deviceName: string, sessionName?: string) => Promise<string | null>;
  resumeSession: (sessionId: string) => Promise<boolean>;
  closeSession: (sessionId: string) => Promise<boolean>;
  selectSession: (sessionId: string) => void;
  refreshSessions: () => Promise<void>;
  
  // Session Operations
  cleanupSessions: (options?: { deviceId?: string; olderThanHours?: number; dryRun?: boolean }) => Promise<any>;
  exportSession: (sessionId: string, format?: 'json' | 'txt' | 'html' | 'csv') => Promise<boolean>;
  
  // Connection Management
  connectToSession: (sessionId: string) => Promise<boolean>;
  disconnectFromSession: () => void;
  
  // State Management
  clearError: () => void;
  resetState: () => void;
}

const STORAGE_KEY = 'terminal-manager-state';

/**
 * STEP 2.2: Session State Management Hook
 * Global session state management with persistence across page navigation
 */
export const useTerminalManager = (): TerminalManagerState & TerminalManagerActions => {
  const [state, setState] = useState<TerminalManagerState>({
    activeSessions: [],
    selectedSessionId: null,
    isConnected: false,
    isLoading: false,
    error: null
  });

  const wsRef = useRef<WebSocket | null>(null);
  const terminalElementRef = useRef<HTMLElement | null>(null);
  const currentSessionRef = useRef<string | null>(null);

  // Load persisted state on mount
  useEffect(() => {
    const loadPersistedState = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const persistedState = JSON.parse(stored);
          setState(prev => ({
            ...prev,
            selectedSessionId: persistedState.selectedSessionId || null
          }));
        }
      } catch (error) {
        console.warn('Failed to load persisted terminal manager state:', error);
      }
    };

    loadPersistedState();
    refreshSessions();
  }, []);

  // Persist state changes
  useEffect(() => {
    try {
      const stateToStore = {
        selectedSessionId: state.selectedSessionId,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToStore));
    } catch (error) {
      console.warn('Failed to persist terminal manager state:', error);
    }
  }, [state.selectedSessionId]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPort = '3004';
      const wsUrl = `${protocol}//${window.location.hostname}:${wsPort}`;
      
      try {
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('🔌 Terminal Manager WebSocket connected');
          setState(prev => ({ ...prev, isConnected: true, error: null }));
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log(`📨 Terminal Manager received WebSocket message:`, message.type, message);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('🔌 Terminal Manager WebSocket disconnected');
          setState(prev => ({ ...prev, isConnected: false }));
          wsRef.current = null;
          
          // Attempt to reconnect after 3 seconds (only if we were previously connected)
          setTimeout(() => {
            if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
              connectWebSocket().catch(console.error);
            }
          }, 3000);
        };

        ws.onerror = (error) => {
          console.error('Terminal Manager WebSocket error:', error);
          setState(prev => ({ ...prev, error: 'WebSocket connection failed', isConnected: false }));
          reject(error);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        setState(prev => ({ ...prev, error: 'Failed to connect to terminal service' }));
        reject(error);
      }
    });
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Refresh sessions from backend
  const refreshSessions = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await fetch('/api/terminal/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      const data = await response.json();
      setState(prev => ({
        ...prev,
        activeSessions: data.sessions || [],
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load sessions',
        isLoading: false
      }));
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    console.log(`🎯 Terminal Manager handling message type: ${message.type}`);
    
    switch (message.type) {
      case 'terminal-session-info':
        if (message.data) {
          const { sessionId, isResumed } = message.data;
          console.log(`📡 Session ${isResumed ? 'resumed' : 'created'}: ${sessionId}`);
          console.log(`🔄 Previous currentSessionRef: ${currentSessionRef.current}, new sessionId: ${sessionId}`);
          
          // Update current session reference
          currentSessionRef.current = sessionId;
          console.log(`🔗 Updated currentSessionRef to: ${currentSessionRef.current}`);
          
          // Update selected session if this was a new creation or successful resume
          setState(prev => ({ ...prev, selectedSessionId: sessionId }));
          
          refreshSessions();
        }
        break;
        
      case 'connect':
        console.log('📡 Terminal session connected');
        setState(prev => ({ ...prev, isConnected: true, error: null }));
        break;
        
      case 'data':
        // Forward terminal data to the active terminal component
        console.log(`📡 Terminal Manager received data: ${message.data?.length || 0} bytes for session ${currentSessionRef.current}`);
        console.log(`🎯 Dispatching terminal-data event with sessionId: ${currentSessionRef.current}`);
        // Dispatch custom event for terminal component to listen to
        window.dispatchEvent(new CustomEvent('terminal-data', { 
          detail: { 
            data: message.data,
            sessionId: currentSessionRef.current 
          } 
        }));
        break;
        
      case 'error':
        console.error('📡 Terminal session error:', message.data?.message);
        setState(prev => ({ 
          ...prev, 
          error: message.data?.message || 'Terminal connection error',
          isLoading: false 
        }));
        break;
        
      case 'close':
        console.log('📡 Terminal session closed');
        setState(prev => ({ ...prev, isConnected: false }));
        currentSessionRef.current = null;
        break;
        
      default:
        console.log(`📡 Unhandled Terminal Manager message: ${message.type}`);
        break;
    }
  }, [refreshSessions]);

  // Handle terminal input events from individual terminal components
  useEffect(() => {
    const handleTerminalInput = (event: CustomEvent) => {
      const { data, sessionId } = event.detail;
      if (wsRef.current?.readyState === WebSocket.OPEN && sessionId === currentSessionRef.current) {
        console.log(`📤 Terminal Manager forwarding input: ${data.length} bytes`);
        wsRef.current.send(JSON.stringify({
          type: 'terminal-data',
          data: data
        }));
      }
    };

    const handleTerminalResize = (event: CustomEvent) => {
      const { cols, rows, sessionId } = event.detail;
      if (wsRef.current?.readyState === WebSocket.OPEN && sessionId === currentSessionRef.current) {
        console.log(`📤 Terminal Manager forwarding resize: ${cols}x${rows}`);
        wsRef.current.send(JSON.stringify({
          type: 'terminal-resize',
          cols: cols,
          rows: rows
        }));
      }
    };

    const handleTerminalDisconnect = (event: CustomEvent) => {
      const { sessionId } = event.detail;
      if (wsRef.current?.readyState === WebSocket.OPEN && sessionId === currentSessionRef.current) {
        console.log(`📤 Terminal Manager forwarding disconnect for session: ${sessionId}`);
        wsRef.current.send(JSON.stringify({
          type: 'terminal-disconnect'
        }));
        currentSessionRef.current = null;
      }
    };

    const handleTerminalTerminate = (event: CustomEvent) => {
      const { sessionId } = event.detail;
      if (wsRef.current?.readyState === WebSocket.OPEN && sessionId === currentSessionRef.current) {
        console.log(`📤 Terminal Manager forwarding terminate for session: ${sessionId}`);
        wsRef.current.send(JSON.stringify({
          type: 'terminal-terminate'
        }));
        currentSessionRef.current = null;
      }
    };

    // Listen for terminal events
    window.addEventListener('terminal-input', handleTerminalInput as EventListener);
    window.addEventListener('terminal-resize', handleTerminalResize as EventListener);
    window.addEventListener('terminal-disconnect', handleTerminalDisconnect as EventListener);
    window.addEventListener('terminal-terminate', handleTerminalTerminate as EventListener);

    return () => {
      window.removeEventListener('terminal-input', handleTerminalInput as EventListener);
      window.removeEventListener('terminal-resize', handleTerminalResize as EventListener);
      window.removeEventListener('terminal-disconnect', handleTerminalDisconnect as EventListener);
      window.removeEventListener('terminal-terminate', handleTerminalTerminate as EventListener);
    };
  }, []);

  // Create new session
  const createSession = useCallback(async (deviceId: string, deviceName: string, sessionName?: string): Promise<string | null> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Ensure WebSocket is connected before creating session
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('🔌 WebSocket not connected, connecting now...');
        await connectWebSocket();
      }

      // Double-check connection after attempt
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('Failed to establish WebSocket connection');
      }

      // Send session creation request via WebSocket
      wsRef.current.send(JSON.stringify({
        type: 'terminal-connect',
        deviceId: deviceId,
        data: { sessionName: sessionName || `${deviceName} - ${new Date().toLocaleString()}` }
      }));

      setState(prev => ({ ...prev, isLoading: false }));
      
      // The actual session ID will be received via WebSocket message
      return 'pending';
    } catch (error) {
      console.error('Failed to create session:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create session',
        isLoading: false
      }));
      return null;
    }
  }, [connectWebSocket]);

  // Resume existing session
  const resumeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Find the session in our local state
      const session = state.activeSessions.find(s => s.id === sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // For now, just select the session - actual reconnection logic would go here
      setState(prev => ({ 
        ...prev, 
        selectedSessionId: sessionId,
        isLoading: false 
      }));
      
      return true;
    } catch (error) {
      console.error('Failed to resume session:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to resume session',
        isLoading: false
      }));
      return false;
    }
  }, [state.activeSessions]);

  // Close session
  const closeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // First, terminate the SSH session if it's currently connected via Terminal Manager
      if (wsRef.current?.readyState === WebSocket.OPEN && currentSessionRef.current === sessionId) {
        console.log(`🔴 Terminating SSH session ${sessionId} via Terminal Manager`);
        wsRef.current.send(JSON.stringify({
          type: 'terminal-terminate'
        }));
        currentSessionRef.current = null;
        
        // Wait a moment for the session to be properly terminated
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Now attempt to delete the session (backend will only allow if status is not 'active')
      const response = await fetch(`/api/terminal/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to close session');
      }
      
      // Update local state
      setState(prev => ({
        ...prev,
        activeSessions: prev.activeSessions.filter(s => s.id !== sessionId),
        selectedSessionId: prev.selectedSessionId === sessionId ? null : prev.selectedSessionId,
        isLoading: false
      }));
      
      console.log(`✅ Session ${sessionId} closed and deleted successfully`);
      return true;
    } catch (error) {
      console.error('Failed to close session:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to close session',
        isLoading: false
      }));
      return false;
    }
  }, []);

  // Select session
  const selectSession = useCallback((sessionId: string) => {
    setState(prev => ({ ...prev, selectedSessionId: sessionId }));
  }, []);

  // Cleanup sessions
  const cleanupSessions = useCallback(async (options?: { deviceId?: string; olderThanHours?: number; dryRun?: boolean }) => {
    try {
      const response = await fetch('/api/terminal/sessions/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {})
      });
      
      if (!response.ok) {
        throw new Error('Failed to cleanup sessions');
      }
      
      const result = await response.json();
      
      // Refresh sessions after cleanup
      await refreshSessions();
      
      return result;
    } catch (error) {
      console.error('Failed to cleanup sessions:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to cleanup sessions'
      }));
      throw error;
    }
  }, [refreshSessions]);

  // Export session
  const exportSession = useCallback(async (sessionId: string, format: 'json' | 'txt' | 'html' | 'csv' = 'txt'): Promise<boolean> => {
    try {
      const response = await fetch(`/api/terminal/sessions/${sessionId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format })
      });

      if (!response.ok) {
        throw new Error('Failed to export session');
      }

      // Trigger download
      const blob = await response.blob();
      const filename = response.headers.get('content-disposition')?.split('filename=')[1] || `session.${format}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/"/g, '');
      a.click();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Failed to export session:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to export session'
      }));
      return false;
    }
  }, []);

  // Connect to a specific session (for resuming existing sessions)
  const connectToSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Ensure WebSocket is connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('🔌 WebSocket not connected, connecting now...');
        await connectWebSocket();
      }

      // Double-check connection after attempt
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('Failed to establish WebSocket connection');
      }

      // Get session details from our current state
      const session = state.activeSessions.find(s => s.id === sessionId);
      if (!session) {
        throw new Error('Session not found in current state');
      }

      console.log(`🎯 Terminal Manager connecting to existing session: ${sessionId}`);
      
      // Send terminal connection request for existing session
      wsRef.current.send(JSON.stringify({
        type: 'terminal-connect',
        deviceId: session.device_id,
        sessionId: sessionId // This tells backend to resume existing session
      }));

      // Update current session reference for message routing
      currentSessionRef.current = sessionId;
      console.log(`🔗 Set currentSessionRef to: ${currentSessionRef.current}`);
      
      setState(prev => ({ ...prev, isLoading: false, selectedSessionId: sessionId }));
      return true;
      
    } catch (error) {
      console.error('Failed to connect to session:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect to session',
        isLoading: false
      }));
      return false;
    }
  }, [connectWebSocket, state.activeSessions]);

  // Disconnect from current session (detach but keep SSH alive)
  const disconnectFromSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentSessionRef.current) {
      console.log(`🔌 Terminal Manager disconnecting from session: ${currentSessionRef.current}`);
      wsRef.current.send(JSON.stringify({
        type: 'terminal-disconnect'
      }));
    }
    currentSessionRef.current = null;
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setState({
      activeSessions: [],
      selectedSessionId: null,
      isConnected: false,
      isLoading: false,
      error: null
    });
    
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    // State
    activeSessions: state.activeSessions,
    selectedSessionId: state.selectedSessionId,
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,
    
    // Actions
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
  };
}; 