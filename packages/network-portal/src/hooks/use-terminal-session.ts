import { useState, useRef, useEffect } from 'react';

interface TerminalSessionOptions {
  deviceId: string;
  sessionName?: string;
  sessionId?: string; // NEW: Specific session ID to connect to (for resuming existing sessions)
  reconnectOnClose?: boolean;
  maxReconnectAttempts?: number;
  logHistory?: boolean;
  persistSession?: boolean; // NEW: Keep session alive when component unmounts
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
  onSessionCreated?: (sessionId: string) => void;
  onCommandExecuted?: (command: string) => void;
}

export const useTerminalSession = (options: TerminalSessionOptions) => {
  const { 
    deviceId, 
    sessionName,
    sessionId: existingSessionId,
    persistSession = true, // Default to persisting sessions
    onConnect, 
    onDisconnect, 
    onError, 
    onSessionCreated,
    onCommandExecuted 
  } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);

  const connect = async (element: HTMLElement) => {
    if (isConnecting || isConnected) return;

    console.log(`🔌 Connecting terminal session for device ${deviceId} with persistSession=${persistSession}`);
    setIsConnecting(true);

    try {
      // Dynamically import xterm modules (client-side only)
      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      
      // Dynamically import xterm CSS
      await import('@xterm/xterm/css/xterm.css');

      // Create terminal instance with glassmorphism theme
      const terminal = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Consolas, Monaco, "Courier New", monospace',
        theme: {
          background: 'rgba(10, 10, 30, 0.8)',
          foreground: '#dcddde',
          cursor: '#ffffff',
          selectionBackground: 'rgba(130, 110, 255, 0.3)',
          black: '#000000',
          red: '#ff5555',
          green: '#50fa7b',
          yellow: '#f1fa8c',
          blue: '#bd93f9',
          magenta: '#ff79c6',
          cyan: '#8be9fd',
          white: '#bfbfbf',
          brightBlack: '#44475a',
          brightRed: '#ff6e6e',
          brightGreen: '#69ff94',
          brightYellow: '#ffffa5',
          brightBlue: '#d6acff',
          brightMagenta: '#ff92df',
          brightCyan: '#a4ffff',
          brightWhite: '#ffffff'
        },
        allowProposedApi: true
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminal.open(element);
      
      // Wait for terminal to be fully rendered before fitting
      setTimeout(() => {
        try {
          if (element.offsetWidth > 0 && element.offsetHeight > 0) {
            fitAddon.fit();
          }
        } catch (error) {
          console.warn('Initial fit error:', error);
        }
      }, 50);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      // Check if we're connecting to an existing session
      if (existingSessionId) {
        console.log(`🔗 Connecting to existing session ${existingSessionId} - using Terminal Manager WebSocket`);
        
        // For existing sessions, don't create a new WebSocket
        // Instead, listen for terminal data events from Terminal Manager
        const handleTerminalData = (event: CustomEvent) => {
          const { data, sessionId } = event.detail;
          console.log(`🎧 Terminal listening for session ${existingSessionId}, received event for session ${sessionId}, data: ${data ? data.length + ' bytes' : 'none'}`);
          if (sessionId === existingSessionId && data) {
            console.log(`📥 Terminal received data via event: ${data.length} bytes`);
            terminal.write(data);
          } else if (sessionId !== existingSessionId) {
            console.log(`🚫 Terminal ignoring data for different session: expected ${existingSessionId}, got ${sessionId}`);
          } else if (!data) {
            console.log(`🚫 Terminal ignoring event with no data`);
          }
        };

        // Listen for terminal data events
        window.addEventListener('terminal-data', handleTerminalData as EventListener);
        
        // Store event listener for cleanup
        (terminal as any)._terminalDataListener = handleTerminalData;
        (terminal as any)._isExistingSession = true; // Mark as existing session
        
        // Set up terminal input handling to send to Terminal Manager WebSocket
        terminal.onData((data: string) => {
          // Send input via custom event that Terminal Manager can listen to
          window.dispatchEvent(new CustomEvent('terminal-input', { 
            detail: { 
              data: data,
              sessionId: existingSessionId 
            } 
          }));

          // Track command execution for session history
          if ((data.includes('\r') || data.includes('\n')) && onCommandExecuted) {
            const command = data.replace(/[\r\n]+$/, '').trim();
            if (command) {
              onCommandExecuted(command);
            }
          }
        });

        // Set up terminal resize handling
        terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
          // Send resize via custom event
          window.dispatchEvent(new CustomEvent('terminal-resize', { 
            detail: { 
              cols: cols,
              rows: rows,
              sessionId: existingSessionId 
            } 
          }));
        });

        // Mark as connected and notify session creation
        setIsConnected(true);
        setIsConnecting(false);
        setSessionId(existingSessionId);
        onConnect?.();
        onSessionCreated?.(existingSessionId);
        
        // Fit terminal and trigger initial resize
        setTimeout(() => {
          try {
            if (terminal.element && terminal.element.offsetWidth > 0) {
              fitAddon.fit();
              // Send initial resize event
              window.dispatchEvent(new CustomEvent('terminal-resize', { 
                detail: { 
                  cols: terminal.cols,
                  rows: terminal.rows,
                  sessionId: existingSessionId 
                } 
              }));
            }
          } catch (error) {
            console.warn('Terminal resize on existing session connect error:', error);
          }
        }, 150);

        return; // Don't create WebSocket for existing sessions
      }

      // For NEW sessions, use the normal WebSocket flow
      console.log(`🆕 Creating new session - using direct WebSocket connection`);

      // Create WebSocket connection to the existing WebSocket server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPort = '3004'; // Use the WebSocket port from server
      const wsUrl = `${protocol}//${window.location.hostname}:${wsPort}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Send terminal connection request
        // If we have an existing session ID, try to resume it
        // Otherwise create a new session with the given session name
        const connectMessage = {
          type: 'terminal-connect',
          deviceId: deviceId,
          sessionName: existingSessionId ? undefined : sessionName, // Only set sessionName for new sessions
          sessionId: existingSessionId // Pass existing session ID if resuming
        };
        
        console.log(`🔗 Terminal connecting: ${existingSessionId ? `resuming session ${existingSessionId}` : `creating new session "${sessionName}"`}`);
        ws.send(JSON.stringify(connectMessage));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connect':
              setIsConnected(true);
              setIsConnecting(false);
              onConnect?.();
              
              // Extract session ID if provided
              if (message.sessionId) {
                setSessionId(message.sessionId);
                onSessionCreated?.(message.sessionId);
              }
              
              // Fit terminal to container and send resize
              setTimeout(() => {
                try {
                  if (terminal.element && terminal.element.offsetWidth > 0) {
                    fitAddon.fit();
                    ws.send(JSON.stringify({
                      type: 'terminal-resize',
                      cols: terminal.cols,
                      rows: terminal.rows
                    }));
                  }
                } catch (error) {
                  console.warn('Terminal resize on connect error:', error);
                }
              }, 150);
              break;

            case 'terminal-session-info':
              // Handle session info message (sent when resuming sessions)
              if (message.data?.sessionId) {
                console.log(`🔗 Terminal session info received: ${message.data.sessionId} (resumed: ${message.data.isResumed})`);
                setSessionId(message.data.sessionId);
                onSessionCreated?.(message.data.sessionId);
                
                // If this is a resumed session, ensure terminal is properly sized
                if (message.data.isResumed) {
                  setTimeout(() => {
                    try {
                      if (terminal.element && terminal.element.offsetWidth > 0) {
                        fitAddon.fit();
                        ws.send(JSON.stringify({
                          type: 'terminal-resize',
                          cols: terminal.cols,
                          rows: terminal.rows
                        }));
                      }
                    } catch (error) {
                      console.warn('Terminal resize on resume error:', error);
                    }
                  }, 150);
                }
              }
              break;
              
            case 'data':
              // Add debug logging to see if data is being received
              console.log(`📥 Terminal received ${message.data?.length || 0} bytes: "${message.data?.substring(0, 50)}${message.data?.length > 50 ? '...' : ''}"`);
              console.log(`📟 Terminal state: element=${!!terminal.element}, cols=${terminal.cols}, rows=${terminal.rows}`);
              
              if (terminal && message.data) {
                try {
                  terminal.write(message.data);
                  console.log(`✅ Data written to terminal successfully`);
                } catch (error) {
                  console.error(`❌ Error writing to terminal:`, error);
                }
              } else {
                console.warn(`⚠️ Cannot write to terminal: terminal=${!!terminal}, data=${!!message.data}`);
              }
              break;
              
            case 'error':
              setIsConnecting(false);
              onError?.(message.data?.message || message.message || 'Connection error');
              break;
              
            case 'close':
              disconnect();
              break;
              
            default:
              console.warn(`🔍 Unhandled WebSocket message type: ${message.type}`);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        setSessionId(null);
        onDisconnect?.();
      };

      ws.onerror = (error) => {
        setIsConnecting(false);
        onError?.('WebSocket connection error');
      };

      // Handle terminal input
      terminal.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal-data',
            data: data
          }));

          // Track command execution for session history
          if ((data.includes('\r') || data.includes('\n')) && onCommandExecuted) {
            const command = data.replace(/[\r\n]+$/, '').trim();
            if (command) {
              onCommandExecuted(command);
            }
          }
        }
      });

      // Handle terminal resize
      terminal.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal-resize',
            cols,
            rows
          }));
        }
      });

      wsRef.current = ws;

    } catch (error) {
      setIsConnecting(false);
      onError?.(`Connection failed: ${error}`);
    }
  };

  const disconnect = (terminateSession = false) => {
    console.log(`🔌 Disconnecting terminal session ${sessionId} (terminate: ${terminateSession}, persistSession: ${persistSession})`);
    
    const isExistingSession = terminalRef.current && (terminalRef.current as any)._isExistingSession;
    
    // Clean up event listener for existing sessions
    if (terminalRef.current && (terminalRef.current as any)._terminalDataListener) {
      window.removeEventListener('terminal-data', (terminalRef.current as any)._terminalDataListener);
      (terminalRef.current as any)._terminalDataListener = null;
      (terminalRef.current as any)._isExistingSession = false;
    }
    
    // For existing sessions using events, send disconnect via event
    if (isExistingSession && terminateSession) {
      console.log(`🔴 Sending terminal-terminate via event for existing session`);
      window.dispatchEvent(new CustomEvent('terminal-terminate', { 
        detail: { 
          sessionId: sessionId 
        } 
      }));
    } else if (isExistingSession) {
      console.log(`🔶 Sending terminal-disconnect via event for existing session (detach only)`);
      window.dispatchEvent(new CustomEvent('terminal-disconnect', { 
        detail: { 
          sessionId: sessionId 
        } 
      }));
    }
    
    // For new sessions using WebSocket, send disconnect via WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN && terminateSession && !isExistingSession) {
      console.log(`🔴 Sending terminal-disconnect message to backend via WebSocket`);
      wsRef.current.send(JSON.stringify({
        type: 'terminal-disconnect'
      }));
    } else if (!isExistingSession) {
      console.log(`🔶 Detaching UI from terminal session without terminating SSH connection`);
    }
    
    // Close WebSocket only for new sessions
    if (!isExistingSession) {
      wsRef.current?.close();
    }
    
    terminalRef.current?.dispose();
    setIsConnected(false);
    setIsConnecting(false);
    
    if (terminateSession) {
      setSessionId(null);
    }
  };

  const resize = () => {
    try {
      if (fitAddonRef.current && terminalRef.current && terminalRef.current.element) {
        const element = terminalRef.current.element;
        // Only resize if the terminal container has actual dimensions
        if (element.offsetWidth > 0 && element.offsetHeight > 0) {
          fitAddonRef.current.fit();
        }
      }
    } catch (error) {
      console.warn('Terminal resize error:', error);
    }
  };

  const writeToTerminal = (data: string) => {
    terminalRef.current?.write(data);
  };

  const createBookmark = (bookmarkName: string, description?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionId) {
      wsRef.current.send(JSON.stringify({
        type: 'terminal-bookmark',
        sessionId,
        bookmarkName,
        description
      }));
    }
  };

  const exportSession = (format: 'json' | 'txt' | 'html' | 'csv' = 'txt') => {
    if (wsRef.current?.readyState === WebSocket.OPEN && sessionId) {
      wsRef.current.send(JSON.stringify({
        type: 'terminal-export',
        sessionId,
        exportFormat: format
      }));
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup when component unmounts or dependencies change
      // If persistSession=true (default): detach UI but keep SSH session alive
      // If persistSession=false: terminate the SSH session completely
      console.log(`🧹 Terminal session cleanup (persistSession: ${persistSession})`);
      disconnect(!persistSession);
    };
  }, [persistSession]);

  const terminateSession = () => {
    disconnect(true); // Force termination
  };

  return {
    connect,
    disconnect, // Detaches UI but keeps session alive (if persistSession=true)
    terminateSession, // Actually terminates the SSH session
    resize,
    writeToTerminal,
    createBookmark,
    exportSession,
    isConnected,
    isConnecting,
    sessionId,
    terminal: terminalRef.current
  };
}; 