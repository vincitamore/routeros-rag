/**
 * WebSocket Server
 * 
 * Handles real-time data streaming for the network monitoring portal.
 * Manages WebSocket connections and broadcasts monitoring data to clients.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { MonitoringService, SystemMetrics } from '../services/monitoring-service';
import { EventEmitter } from 'events';
import { SSHProxy, DeviceCredentials } from './ssh-proxy';
import { Database } from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'error' | 'metrics' | 'device-status' | 'terminal-connect' | 'terminal-data' | 'terminal-resize' | 'terminal-disconnect' | 'terminal-terminate' | 'terminal-session-info';
  deviceId?: string;
  data?: any;
  timestamp?: string;
  cols?: number;
  rows?: number;
  sessionName?: string;
  sessionId?: string;
  terminate?: boolean;
}

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>; // Device IDs the client is subscribed to
  lastPing: Date;
  isAlive: boolean;
  terminalSession?: {
    deviceId: string;
    sessionId: string;
  };
}

export class NetworkPortalWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private monitoringService: MonitoringService;
  private heartbeatInterval!: NodeJS.Timeout;
  private sshProxy: SSHProxy;
  private db: Database;

  constructor(port: number, monitoringService: MonitoringService, db: Database) {
    super();
    this.monitoringService = monitoringService;
    this.db = db;
    this.sshProxy = new SSHProxy(db);
    
    // Create WebSocket server
    this.wss = new WebSocketServer({
      port,
      verifyClient: this.verifyClient.bind(this)
    });

    this.setupWebSocketServer();
    this.setupMonitoringListeners();
    this.startHeartbeat();
    
    console.log(`WebSocket server listening on port ${port}`);
  }

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientId = this.generateClientId();
      
      const client: ClientConnection = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastPing: new Date(),
        isAlive: true
      };

      this.clients.set(clientId, client);
      
      console.log(`Client ${clientId} connected (${request.socket.remoteAddress})`);
      this.emit('client-connected', clientId);

      // Setup client event handlers
      ws.on('message', (data: Buffer) => {
        this.handleClientMessage(clientId, data);
      });

      ws.on('close', (code: number, reason: Buffer) => {
        this.handleClientDisconnect(clientId, code, reason);
      });

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientError(clientId, error);
      });

      ws.on('pong', () => {
        client.isAlive = true;
        client.lastPing = new Date();
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'device-status',
        data: {
          connected: true,
          clientId,
          monitoringStatus: this.monitoringService.getMonitoringStatus()
        },
        timestamp: new Date().toISOString()
      });
    });

    this.wss.on('error', (error: Error) => {
      console.error('WebSocket server error:', error);
      this.emit('server-error', error);
    });
  }

  /**
   * Setup monitoring service event listeners
   */
  private setupMonitoringListeners(): void {
    // Listen for new metrics
    this.monitoringService.on('metrics-collected', (deviceId: string, metrics: SystemMetrics) => {
      this.broadcastToSubscribers(deviceId, {
        type: 'metrics',
        deviceId,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for monitoring errors
    this.monitoringService.on('metrics-error', (deviceId: string, error: Error) => {
      this.broadcastToSubscribers(deviceId, {
        type: 'error',
        deviceId,
        data: {
          message: error.message,
          type: 'metrics-error'
        },
        timestamp: new Date().toISOString()
      });
    });

    // Listen for monitoring status changes
    this.monitoringService.on('monitoring-started', (deviceId: string) => {
      this.broadcast({
        type: 'device-status',
        deviceId,
        data: {
          monitoring: true,
          status: 'monitoring-started'
        },
        timestamp: new Date().toISOString()
      });
    });

    this.monitoringService.on('monitoring-stopped', (deviceId: string) => {
      this.broadcast({
        type: 'device-status',
        deviceId,
        data: {
          monitoring: false,
          status: 'monitoring-stopped'
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(clientId: string, data: Buffer): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.deviceId);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.deviceId);
          break;
          
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'terminal-connect':
          this.handleTerminalConnect(clientId, message.deviceId, message.sessionName, message.sessionId);
          break;

        case 'terminal-data':
          this.handleTerminalData(clientId, message.data);
          break;

        case 'terminal-resize':
          this.handleTerminalResize(clientId, message.cols, message.rows);
          break;

        case 'terminal-disconnect':
          this.handleTerminalDisconnect(clientId);
          break;

        case 'terminal-terminate':
          this.handleTerminalTerminate(clientId);
          break;
          
        default:
          console.warn(`Unknown message type from client ${clientId}:`, message.type);
      }
      
    } catch (error) {
      console.error(`Failed to parse message from client ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid message format' },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle client subscription to device monitoring
   */
  private handleSubscribe(clientId: string, deviceId?: string): void {
    if (!deviceId) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Device ID required for subscription' },
        timestamp: new Date().toISOString()
      });
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(deviceId);
    
    console.log(`Client ${clientId} subscribed to device ${deviceId}`);
    
    // Send current metrics if available
    const latestMetrics = this.monitoringService.getLatestMetrics(deviceId);
    if (latestMetrics) {
      this.sendToClient(clientId, {
        type: 'metrics',
        deviceId,
        data: latestMetrics,
        timestamp: new Date().toISOString()
      });
    }

    // Confirm subscription
    this.sendToClient(clientId, {
      type: 'device-status',
      deviceId,
      data: { subscribed: true },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle client unsubscription from device monitoring
   */
  private handleUnsubscribe(clientId: string, deviceId?: string): void {
    if (!deviceId) return;

    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(deviceId);
    
    console.log(`Client ${clientId} unsubscribed from device ${deviceId}`);
    
    this.sendToClient(clientId, {
      type: 'device-status',
      deviceId,
      data: { subscribed: false },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle client disconnect
   */
  private handleClientDisconnect(clientId: string, code: number, reason: Buffer): void {
    console.log(`Client ${clientId} disconnected (code: ${code}, reason: ${reason.toString()})`);
    
    const client = this.clients.get(clientId);
    if (client?.terminalSession) {
      // Detach terminal session instead of destroying it
      this.handleTerminalDisconnect(clientId);
    }
    
    this.clients.delete(clientId);
    this.emit('client-disconnected', clientId, code, reason.toString());
  }

  /**
   * Handle client error
   */
  private handleClientError(clientId: string, error: Error): void {
    console.error(`Client ${clientId} error:`, error);
    
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Connection error occurred' },
        timestamp: new Date().toISOString()
      });
    }
    
    this.emit('client-error', clientId, error);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
        } catch (error) {
          console.error(`Failed to broadcast to client ${clientId}:`, error);
        }
      }
    }
  }

  /**
   * Broadcast message to clients subscribed to specific device
   */
  private broadcastToSubscribers(deviceId: string, message: WebSocketMessage): void {
    const messageStr = JSON.stringify(message);
    
    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(deviceId) && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr);
        } catch (error) {
          console.error(`Failed to broadcast to subscriber ${clientId}:`, error);
        }
      }
    }
  }

  /**
   * Start heartbeat to detect disconnected clients
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.isAlive) {
          console.log(`Terminating inactive client ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          continue;
        }

        client.isAlive = false;
        
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Handle terminal connection request
   */
  private async handleTerminalConnect(clientId: string, deviceId?: string, sessionName?: string, requestedSessionId?: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !deviceId) {
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: 'Invalid terminal connection request' },
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      // Get device credentials from database (including SSH keys)
      const device = this.getDeviceById(deviceId);
      if (!device) {
        this.sendToClient(clientId, {
          type: 'error',
          data: { message: 'Device not found' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (device.status !== 'connected') {
        this.sendToClient(clientId, {
          type: 'error',
          data: { message: `Device is not available (status: ${device.status})` },
          timestamp: new Date().toISOString()
        });
        return;
      }

      let sessionId: string = '';
      let isResumedSession = false;

      if (requestedSessionId) {
        // Client is requesting a specific session ID (resuming existing session)
        console.log(`🎯 Client requesting specific session: ${requestedSessionId}`);
        
        // Verify the session exists and belongs to this device
        const existingSession = this.db.prepare(`
          SELECT id, session_name, start_time, status
          FROM terminal_sessions 
          WHERE id = ? AND device_id = ? AND status IN ('active', 'disconnected')
          AND start_time > datetime('now', '-4 hours')
        `).get(requestedSessionId, deviceId) as { id: string; session_name: string; start_time: string; status: string } | undefined;

        if (existingSession) {
          sessionId = requestedSessionId;
          isResumedSession = true;
          
          // Update last activity for resumed session
          this.db.prepare(`
            UPDATE terminal_sessions 
            SET last_activity = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(sessionId);

          console.log(`🔄 Resuming requested terminal session ${sessionId} for device ${deviceId} (was ${existingSession.status})`);
        } else {
          console.warn(`⚠️ Requested session ${requestedSessionId} not found or invalid, falling back to session discovery`);
          // Fall back to automatic session discovery
          requestedSessionId = undefined;
        }
      }

      if (!requestedSessionId) {
        // STEP 1.1: Session Deduplication Logic (original logic for when no specific session requested)
        // Check for existing resumable sessions for this device (active or disconnected)
        const existingResumableSessions = this.db.prepare(`
          SELECT id, session_name, start_time, status
          FROM terminal_sessions 
          WHERE device_id = ? AND status IN ('active', 'disconnected')
          AND start_time > datetime('now', '-4 hours')
          ORDER BY last_activity DESC
        `).all(deviceId) as Array<{ id: string; session_name: string; start_time: string; status: string }>;

        if (existingResumableSessions.length > 0) {
          // Resume the most recent resumable session instead of creating a new one
          const mostRecentSession = existingResumableSessions[0];
          if (!mostRecentSession) {
            throw new Error('Unexpected error: session array is empty despite length check');
          }
          sessionId = mostRecentSession.id;
          isResumedSession = true;
          
          // Update last activity for resumed session
          this.db.prepare(`
            UPDATE terminal_sessions 
            SET last_activity = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(sessionId);

          console.log(`🔄 Resuming existing terminal session ${sessionId} for device ${deviceId} (was ${mostRecentSession.status})`);
          
          // If there are multiple resumable sessions, close the older ones
          if (existingResumableSessions.length > 1) {
            const sessionsToClose = existingResumableSessions.slice(1);
            for (const session of sessionsToClose) {
              this.db.prepare(`
                UPDATE terminal_sessions 
                SET status = 'closed', end_time = CURRENT_TIMESTAMP 
                WHERE id = ?
              `).run(session.id);
              console.log(`🧹 Auto-closed duplicate session ${session.id} during deduplication`);
            }
          }
        } else {
          // No resumable sessions found, create a new one
          sessionId = uuidv4();
        }
      }

      const credentials: DeviceCredentials = {
        host: device.ip_address,
        username: device.username,
        password: device.password,
        port: 22, // SSH port
        // SSH key authentication support
        privateKey: device.ssh_private_key,
        publicKey: device.ssh_public_key,
        authMethod: device.ssh_private_key ? 'key' : 'password',
        sessionName: sessionName || `${device.name} - ${new Date().toLocaleString()}`
      };

      console.log(`🔐 Terminal authentication method for device ${deviceId}: ${credentials.authMethod}`);

      if (isResumedSession) {
        // Try to attach to existing SSH session in memory
        const attached = this.sshProxy.attachWebSocket(sessionId, client.ws);
        if (!attached) {
          // Session not in memory, try to restore from database
          console.log(`🔄 Failed to attach to existing session ${sessionId}, attempting database restoration`);
          const restored = await this.sshProxy.restoreSessionFromDatabase(sessionId, client.ws);
          if (!restored) {
            console.log(`🔄 Failed to restore session ${sessionId} from database, creating new SSH connection`);
            await this.sshProxy.createSession(sessionId, deviceId, credentials, client.ws);
          }
        }
      } else {
        // Create new SSH session
        await this.sshProxy.createSession(sessionId, deviceId, credentials, client.ws);
      }
      
      // Track terminal session for this client
      client.terminalSession = { deviceId, sessionId };

      const actionText = isResumedSession ? 'resumed' : 'created';
      console.log(`Terminal session ${sessionId} ${actionText} for client ${clientId} on device ${deviceId} using ${credentials.authMethod} auth`);
      
      // Send session info back to client
      this.sendToClient(clientId, {
        type: 'terminal-session-info',
        data: { 
          sessionId, 
          deviceId, 
          isResumed: isResumedSession,
          sessionName: credentials.sessionName 
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Failed to create terminal session for client ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        data: { message: `SSH connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle terminal data input
   */
  private handleTerminalData(clientId: string, data?: string): void {
    const client = this.clients.get(clientId);
    if (!client?.terminalSession || !data) return;

    const { sessionId } = client.terminalSession;
    
    // Use SSH proxy's message handling which includes intelligent logging
    this.sshProxy.handleMessage(sessionId, {
      type: 'data',
      data: data
    });
    
    console.log(`Terminal data forwarded to session ${sessionId}`);
  }

  /**
   * Handle terminal resize
   */
  private handleTerminalResize(clientId: string, cols?: number, rows?: number): void {
    const client = this.clients.get(clientId);
    if (!client?.terminalSession || !cols || !rows) return;

    const { sessionId } = client.terminalSession;
    
    // Use SSH proxy's message handling
    this.sshProxy.handleMessage(sessionId, {
      type: 'resize',
      cols: cols,
      rows: rows
    });
    
    console.log(`Terminal resize forwarded to session ${sessionId}: ${cols}x${rows}`);
  }

  /**
   * Handle terminal disconnect
   */
  private handleTerminalDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client?.terminalSession) return;

    const { sessionId } = client.terminalSession;
    
    // Detach WebSocket but keep SSH session alive for persistence
    this.sshProxy.detachWebSocket(sessionId);
    
    client.terminalSession = undefined;

    console.log(`🔌 Terminal session detached for client ${clientId} (session ${sessionId} remains active)`);
  }

  /**
   * Handle terminal terminate
   */
  private handleTerminalTerminate(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client?.terminalSession) return;

    const { sessionId } = client.terminalSession;
    
    // Actually destroy the SSH session (not just detach)
    this.sshProxy.destroySession(sessionId);
    
    client.terminalSession = undefined;

    console.log(`🔚 Terminal session terminated and destroyed for client ${clientId} (session ${sessionId})`);
  }

  /**
   * Get device by ID from database
   */
  private getDeviceById(deviceId: string): any {
    try {
      const query = `
        SELECT id, name, ip_address, username, password, port, use_ssl, status, ssh_private_key, ssh_public_key
        FROM devices 
        WHERE id = ?
      `;
      
      return this.db.prepare(query).get(deviceId);
    } catch (error) {
      console.error(`Error getting device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Verify client connection (basic security)
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean {
    // Basic origin check - in production, implement proper authentication
    const allowedOrigins = ['http://localhost:3003', 'https://localhost:3003'];
    
    if (process.env.NODE_ENV === 'development') {
      return true; // Allow all connections in development
    }
    
    return allowedOrigins.includes(info.origin);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get client information
   */
  getClientInfo(): Array<{ id: string; subscriptions: string[]; lastPing: Date }> {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      subscriptions: Array.from(client.subscriptions),
      lastPing: client.lastPing
    }));
  }

  /**
   * Force disconnect a client
   */
  disconnectClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.terminate();
      this.clients.delete(clientId);
      return true;
    }
    return false;
  }

  /**
   * Close WebSocket server
   */
  async close(): Promise<void> {
    return new Promise((resolve) => {
      // Clear heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Close all client connections
      for (const client of this.clients.values()) {
        client.ws.terminate();
      }
      this.clients.clear();

      // Close server
      this.wss.close(() => {
        console.log('WebSocket server closed');
        resolve();
      });
    });
  }
}