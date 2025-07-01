/**
 * SSH Proxy Service
 * 
 * Provides WebSocket-to-SSH proxy functionality for in-browser terminal sessions.
 * Manages SSH connections and forwards data between WebSocket clients and RouterOS devices.
 */

import { Client as SSHClient } from 'ssh2';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Database } from 'better-sqlite3';
import { TerminalStateManager } from './terminal-state-manager';

export interface DeviceCredentials {
  host: string;
  username: string;
  password?: string;
  port?: number;
  // SSH key authentication support
  privateKey?: string;
  publicKey?: string;
  authMethod?: 'password' | 'key';
  sessionName?: string;
}

/**
 * STEP 1.2: Enhanced Command Builder for proper tab completion handling
 */
class CommandBuilder {
  private partialCommand: string = '';
  private isBuilding: boolean = false;
  private tabCompletionBuffer: string = '';
  private lastInputTime: number = 0;
  private commandStartTime: number = 0;

  constructor() {
    this.reset();
  }

  /**
   * Process input data and determine if command is complete
   */
  processInput(data: string): { isComplete: boolean; command?: string; duration?: number } {
    const now = Date.now();
    this.lastInputTime = now;

    // Detect tab completion sequences
    if (data.includes('\t')) {
      if (!this.isBuilding) {
        this.isBuilding = true;
        this.commandStartTime = now;
      }
      // Store the current state before tab completion
      this.tabCompletionBuffer = this.partialCommand;
      return { isComplete: false };
    }

    // Handle backspace/delete
    if (data.includes('\x7f') || data.includes('\b')) {
      if (this.partialCommand.length > 0) {
        this.partialCommand = this.partialCommand.slice(0, -1);
      }
      return { isComplete: false };
    }

    // Check for command completion (Enter pressed)
    if (data.includes('\r') || data.includes('\n')) {
      const command = this.partialCommand.trim();
      const duration = this.commandStartTime > 0 ? now - this.commandStartTime : 0;
      
      // Reset state
      const wasBuilding = this.isBuilding;
      this.reset();
      
      // Return complete command if it's substantial
      if (command.length > 0 && this.isSubstantialCommand(command)) {
        return { isComplete: true, command, duration };
      }
      
      return { isComplete: false };
    }

    // Regular character input
    const cleanInput = data.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (cleanInput) {
      if (!this.isBuilding) {
        this.isBuilding = true;
        this.commandStartTime = now;
      }
      this.partialCommand += cleanInput;
    }

    return { isComplete: false };
  }

  /**
   * Reset the command builder state
   */
  reset(): void {
    this.partialCommand = '';
    this.isBuilding = false;
    this.tabCompletionBuffer = '';
    this.commandStartTime = 0;
  }

  /**
   * Get current partial command
   */
  getCurrentCommand(): string {
    return this.partialCommand;
  }

  /**
   * Check if command is substantial enough to log
   */
  private isSubstantialCommand(command: string): boolean {
    // Skip empty commands
    if (!command || command.length === 0) return false;
    
    // Skip single characters or very short commands
    if (command.length < 2) return false;
    
    // Skip common non-commands
    const skipCommands = [
      'q', 'quit', 'exit', 'y', 'n', 'yes', 'no',
      '?', 'help', 'h', 'clear', 'cls'
    ];
    
    if (skipCommands.includes(command.toLowerCase())) return false;
    
    // Skip navigation commands
    if (/^(cd|ls|pwd|ll)(\s|$)/.test(command.toLowerCase())) return false;
    
    return true;
  }
}

export interface TerminalSession {
  id: string;
  deviceId: string;
  ssh: SSHClient;
  stream: any;
  websocket: WebSocket | null; // Allow null for detached sessions
  lastActivity: Date;
  isConnected: boolean;
  authMethod: 'password' | 'key';
  startTime: Date;
  commandCount: number;
  bytesTransmitted: number;
  sessionName?: string;
  // Raw terminal data capture
  lastDataTime: number;
  sequenceNumber: number;
  // History restoration buffer (persistent)
  historyBuffer: string;
  // Terminal state tracking
  currentInputBuffer: string;
  lastUserInput: string;
  isWaitingForOutput: boolean;
  // Terminal state manager for proper ANSI handling
  terminalState: TerminalStateManager;
}

interface SSHProxyMessage {
  type: 'data' | 'terminal-data' | 'resize' | 'terminal-resize' | 'disconnect' | 'bookmark' | 'export' | 'connect' | 'error' | 'close';
  data?: string;
  cols?: number;
  rows?: number;
  bookmarkName?: string;
  exportFormat?: string;
  message?: string;
}

export class SSHProxy extends EventEmitter {
  private sessions = new Map<string, TerminalSession>();
  private cleanupInterval: NodeJS.Timeout;
  private db: Database;

  constructor(db: Database) {
    super();
    this.db = db;
    
    // Cleanup inactive sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);

    console.log(`🚀 SSH Proxy service initialized - Server starting/restarting at ${new Date().toISOString()}`);
    console.log(`📊 Initial sessions map size: ${this.sessions.size}`);
    
    // Restore active sessions from database on startup
    this.restoreSessionsFromDatabase();
  }

  /**
   * Create a new SSH terminal session
   */
  async createSession(
    sessionId: string,
    deviceId: string,
    credentials: DeviceCredentials,
    websocket: WebSocket
  ): Promise<void> {
    console.log(`Creating SSH session ${sessionId} for device ${deviceId}`);

    const ssh = new SSHClient();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ssh.destroy();
        reject(new Error('SSH connection timeout'));
      }, 30000); // 30 second timeout

      ssh.on('ready', () => {
        clearTimeout(timeout);
        console.log(`SSH connection established for session ${sessionId}`);
        
        ssh.shell((err, stream) => {
          if (err) {
            console.error(`Failed to create shell for session ${sessionId}:`, err);
            reject(err);
            return;
          }

          const session: TerminalSession = {
            id: sessionId,
            deviceId,
            ssh,
            stream,
            websocket,
            lastActivity: new Date(),
            isConnected: true,
            authMethod: credentials.authMethod || 'password',
            startTime: new Date(),
            commandCount: 0,
            bytesTransmitted: 0,
            sessionName: credentials.sessionName,
            // Raw terminal data capture
            lastDataTime: 0,
            sequenceNumber: 0,
            // History restoration buffer (persistent)
            historyBuffer: '',
            // Terminal state tracking
            currentInputBuffer: '',
            lastUserInput: '',
            isWaitingForOutput: false,
            // Terminal state manager for proper ANSI handling
            terminalState: new TerminalStateManager(80, 24)
          };

          this.sessions.set(sessionId, session);
          this.setupStreamHandlers(session);
          
          // Create session in database
          this.createSessionInDatabase(session);
          
          // Send connection success message
          this.sendToWebSocket(websocket, {
            type: 'connect',
            message: 'SSH connection established'
          });

          this.emit('session-created', sessionId, deviceId);
          resolve();
        });
      });

      ssh.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`SSH connection error for session ${sessionId}:`, err);
        
        this.sendToWebSocket(websocket, {
          type: 'error',
          message: `SSH connection failed: ${err.message}`
        });
        
        reject(err);
      });

      // Determine connection method and configure SSH client
      const connectOptions: any = {
        host: credentials.host,
        username: credentials.username,
        port: credentials.port || 22,
        // More aggressive keepalive for persistent sessions
        keepaliveInterval: 60000,     // 60 seconds between keepalives
        keepaliveCountMax: 10,        // Allow 10 failed keepalives (10 minutes tolerance)
        readyTimeout: 30000           // 30 second initial connection timeout
      };

      if (credentials.privateKey && credentials.authMethod === 'key') {
        // Use SSH key authentication
        console.log(`🔑 Using SSH key authentication for session ${sessionId}`);
        try {
          // Decrypt the private key if it's encrypted
          const privateKey = this.decryptSSHKey(credentials.privateKey);
          connectOptions.privateKey = privateKey;
        } catch (decryptError) {
          console.error(`Failed to decrypt SSH key for session ${sessionId}:`, decryptError);
          reject(new Error('Failed to decrypt SSH private key'));
          return;
        }
      } else if (credentials.password) {
        // Use password authentication
        console.log(`🔐 Using password authentication for session ${sessionId}`);
        connectOptions.password = credentials.password;
      } else {
        reject(new Error('No valid authentication method provided'));
        return;
      }

      ssh.connect(connectOptions);
    });
  }

  /**
   * Setup SSH stream event handlers
   */
  private setupStreamHandlers(session: TerminalSession): void {
    const { stream, id } = session;

    // Forward SSH output to WebSocket
    stream.on('data', (data: Buffer) => {
      const output = data.toString();
      
      // Update last activity even if websocket is detached
      session.lastActivity = new Date();
      
      // Accumulate ALL output in history buffer for restoration (with size limit)
      session.historyBuffer += output;
      // Keep history buffer to reasonable size (last 100KB)
      if (session.historyBuffer.length > 100000) {
        session.historyBuffer = session.historyBuffer.slice(-80000); // Keep last 80KB
      }
      
      // Use session.websocket instead of closure websocket so it works with reattached WebSockets
      if (session.websocket && session.websocket.readyState === WebSocket.OPEN) {
        this.sendToWebSocket(session.websocket, {
          type: 'data',
          data: output
        });
      }
      
      // Process and buffer terminal output for intelligent logging
      this.processTerminalOutput(session, output);
    });

    // Handle SSH stream close
    stream.on('close', () => {
      console.log(`SSH stream closed for session ${id}`);
      this.logSessionActivity(id, 'system', 'SSH connection closed', false);
      
      // Mark session as disconnected but don't destroy it immediately
      session.isConnected = false;
      this.updateSessionStatusInDatabase(id, 'closed');
      
      if (session.websocket && session.websocket.readyState === WebSocket.OPEN) {
        this.sendToWebSocket(session.websocket, {
          type: 'close',
          message: 'SSH connection closed'
        });
        session.websocket.close();
      }
      
      // Remove from sessions map since SSH is actually dead
      console.log(`🗑️ REMOVING session ${id} from memory due to SSH stream close`);
      console.log(`📊 Sessions map size before removal: ${this.sessions.size}`);
      this.sessions.delete(id);
      console.log(`📊 Sessions map size after removal: ${this.sessions.size}`);
      this.emit('session-destroyed', id, session.deviceId);
    });

    // Handle SSH stream errors
    stream.on('error', (error: Error) => {
      console.error(`SSH stream error for session ${id}:`, error);
      this.logSessionActivity(id, 'error', `SSH stream error: ${error.message}`, false);
      
      if (session.websocket && session.websocket.readyState === WebSocket.OPEN) {
        this.sendToWebSocket(session.websocket, {
          type: 'error',
          message: `SSH stream error: ${error.message}`
        });
      }
    });

    // Note: WebSocket message handling is now done through the WebSocket server
    // The server will forward terminal data and resize events directly to the session

    // Handle WebSocket close - detach instead of destroy for persistence
    if (session.websocket) {
      session.websocket.on('close', () => {
        console.log(`WebSocket closed for session ${id}`);
        this.logSessionActivity(id, 'system', 'WebSocket connection closed', false);
        this.detachWebSocket(id); // Detach instead of destroy
      });

      // Handle WebSocket errors
      session.websocket.on('error', (error: Error) => {
        console.error(`WebSocket error for session ${id}:`, error);
        this.logSessionActivity(id, 'error', `WebSocket error: ${error.message}`, false);
        this.detachWebSocket(id); // Detach instead of destroy
      });
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(session: TerminalSession, message: SSHProxyMessage): void {
    const { stream } = session;
    
    switch (message.type) {
      case 'data':
      case 'terminal-data':
        if (message.data && stream.writable) {
          stream.write(message.data);
          session.lastActivity = new Date();
          
          // Process user input for command tracking
          this.processUserInput(session, message.data);
        }
        break;
        
      case 'resize':
      case 'terminal-resize':
        if (message.cols && message.rows && stream.setWindow) {
          stream.setWindow(message.rows, message.cols);
        }
        break;
        
      case 'disconnect':
        this.destroySession(session.id);
        break;
        
      default:
        console.warn(`Unknown WebSocket message type: ${message.type}`);
    }
  }

  /**
   * Send message to WebSocket client
   */
  private sendToWebSocket(websocket: WebSocket, message: SSHProxyMessage): void {
    if (websocket.readyState === WebSocket.OPEN) {
      try {
        // Debug: Log what we're sending to help troubleshoot display issues
        if (message.type === 'data' && message.data) {
          console.log(`📤 Sending ${message.data.length} bytes to WebSocket: "${message.data.substring(0, 50)}${message.data.length > 50 ? '...' : ''}"`);
        } else {
          console.log(`📤 Sending WebSocket message: ${message.type}`);
        }
        websocket.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    } else {
      console.warn(`🚫 Cannot send WebSocket message (${message.type}): WebSocket not open (readyState: ${websocket.readyState})`);
    }
  }

  /**
   * Detach WebSocket from session (keep SSH alive for persistence)
   */
  detachWebSocket(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`Session ${sessionId} not found for WebSocket detach`);
      return;
    }

    console.log(`🔌 Detaching WebSocket from session ${sessionId} (keeping SSH alive)`);
    console.log(`📊 Sessions map size before detach: ${this.sessions.size}`);
    
    try {
      // Update session status to 'disconnected' but keep SSH alive
      this.updateSessionStatusInDatabase(sessionId, 'disconnected');
      
      // Clear websocket reference but keep SSH session running in memory
      // IMPORTANT: Don't remove from sessions map - keep SSH connection alive
      session.websocket = null;
      
      console.log(`✅ WebSocket detached from session ${sessionId}, SSH remains active in memory`);
      console.log(`📊 Sessions map size after detach: ${this.sessions.size}`);
      console.log(`🔍 Session ${sessionId} still in map: ${this.sessions.has(sessionId)}`);
    } catch (error) {
      console.error(`❌ Error detaching WebSocket from session ${sessionId}:`, error);
    }
  }

  /**
   * Restore session from database and recreate SSH connection
   */
  async restoreSessionFromDatabase(sessionId: string, websocket: WebSocket): Promise<boolean> {
    try {
      console.log(`🔄 Attempting to restore session ${sessionId} from database`);
      
      // Get session info from database
      const stmt = this.db.prepare(`
        SELECT ts.*, d.ip_address, d.username, d.password, d.ssh_private_key, d.ssh_public_key
        FROM terminal_sessions ts
        JOIN devices d ON ts.device_id = d.id
        WHERE ts.id = ? AND ts.status IN ('active', 'disconnected')
        AND ts.start_time > datetime('now', '-4 hours')
      `);
      
      const dbSession = stmt.get(sessionId) as any;
      if (!dbSession) {
        console.log(`❌ Session ${sessionId} not found in database or too old to restore`);
        return false;
      }
      
      console.log(`✅ Found session ${sessionId} in database, recreating SSH connection`);
      
      // Recreate credentials from database
      const credentials: DeviceCredentials = {
        host: dbSession.ip_address,
        username: dbSession.username,
        password: dbSession.password,
        port: 22,
        privateKey: dbSession.ssh_private_key,
        publicKey: dbSession.ssh_public_key,
        authMethod: dbSession.ssh_private_key ? 'key' : 'password',
        sessionName: dbSession.session_name
      };
      
      // Recreate the SSH session with the same session ID
      await this.createSession(sessionId, dbSession.device_id, credentials, websocket);
      
      // Session restored successfully - the terminal will show the current state through the historyBuffer
      
      console.log(`✅ Session ${sessionId} successfully restored from database`);
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to restore session ${sessionId} from database:`, error);
      return false;
    }
  }

  /**
   * Attach WebSocket to existing session (for persistence)
   */
  attachWebSocket(sessionId: string, websocket: WebSocket): boolean {
    console.log(`🔍 Attempting to attach WebSocket to session ${sessionId}`);
    console.log(`📊 Current sessions in map: ${Array.from(this.sessions.keys()).join(', ')}`);
    console.log(`📊 Sessions map size: ${this.sessions.size}`);
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`❌ Session ${sessionId} not found in memory - checking database for restoration possibility`);
      return false;
    }

    // Check if SSH connection is still alive
    if (!session.isConnected || !session.ssh) {
      console.log(`❌ Session ${sessionId} SSH connection is dead, cannot attach`);
      return false;
    }

    console.log(`🔌 Attaching WebSocket to existing session ${sessionId} (SSH still alive)`);
    
    try {
      // Attach new websocket
      session.websocket = websocket;
      
      // Update session status back to 'active'
      this.updateSessionStatusInDatabase(sessionId, 'active');
      
      // WebSocket message handling is done by the WebSocket server, not here
      // This prevents duplicate processing of the same messages

      websocket.on('close', () => {
        console.log(`WebSocket closed for session ${sessionId}`);
        this.detachWebSocket(sessionId); // Detach, don't destroy
      });

      websocket.on('error', (error: Error) => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
        this.detachWebSocket(sessionId); // Detach, don't destroy
      });
      
      // Send reconnection success message with current terminal state
      this.sendToWebSocket(websocket, {
        type: 'connect',
        message: `Reconnected to live SSH session ${sessionId}`
      });

      // Send the accumulated output buffer to restore terminal history
      if (session.historyBuffer && session.historyBuffer.length > 0) {
        console.log(`📜 Restoring ${session.historyBuffer.length} characters of terminal history for session ${sessionId}`);
        this.sendToWebSocket(websocket, {
          type: 'data',
          data: session.historyBuffer
        });
      }

      // Terminal state is restored through the historyBuffer - no need to send extra commands
      
      console.log(`✅ WebSocket attached to live session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error attaching WebSocket to session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Destroy a terminal session (permanently close SSH)
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      console.log(`🔚 Permanently destroying SSH session ${sessionId}`);
      console.log(`📊 Sessions map size before destroy: ${this.sessions.size}`);
      
      try {
        // Update final session metrics in database
        this.updateSessionInDatabase(session);
        // Close session in database
        this.closeSessionInDatabase(sessionId);
        
        session.stream?.destroy();
        session.ssh?.end();
        if (session.websocket && session.websocket.readyState === WebSocket.OPEN) {
          session.websocket.close();
        }
      } catch (error) {
        console.error(`❌ Error destroying session ${sessionId}:`, error);
      }
      
      console.log(`🗑️ REMOVING session ${sessionId} from memory due to destroy`);
      this.sessions.delete(sessionId);
      console.log(`📊 Sessions map size after destroy: ${this.sessions.size}`);
      this.emit('session-destroyed', sessionId, session.deviceId);
    }
  }

  /**
   * Restore active sessions from database on server startup
   */
  private async restoreSessionsFromDatabase(): Promise<void> {
    try {
      console.log('🔄 Restoring active sessions from database...');
      
      // Get all active/disconnected sessions from database
      const stmt = this.db.prepare(`
        SELECT * FROM terminal_sessions 
        WHERE status IN ('active', 'disconnected') 
        AND start_time > datetime('now', '-4 hours')
        ORDER BY last_activity DESC
      `);
      
      const dbSessions = stmt.all() as any[];
      console.log(`📊 Found ${dbSessions.length} sessions to potentially restore`);
      
      for (const dbSession of dbSessions) {
        console.log(`🔄 Marking session ${dbSession.id} as available for reconnection`);
        // Don't recreate SSH connections immediately - just mark them as restorable
        // The actual SSH reconnection will happen when a WebSocket tries to attach
        
        // Update status to 'disconnected' so they show up in the UI as reconnectable
        this.updateSessionStatusInDatabase(dbSession.id, 'disconnected');
      }
      
      console.log(`✅ Session restoration complete - ${dbSessions.length} sessions available for reconnection`);
    } catch (error) {
      console.error('❌ Error restoring sessions from database:', error);
    }
  }

  /**
   * Clean up inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = new Date();
    const timeout = 4 * 60 * 60 * 1000; // 4 hours - much longer for persistent sessions

    for (const [sessionId, session] of this.sessions) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      
      // Only destroy sessions that have been inactive for a very long time
      // AND don't have an active WebSocket (are truly abandoned)
      if (timeSinceLastActivity > timeout && !session.websocket) {
        console.log(`Cleaning up abandoned session: ${sessionId} (inactive for ${Math.round(timeSinceLastActivity / 1000 / 60)} minutes)`);
        this.destroySession(sessionId);
      }
    }
  }

  /**
   * Get session information
   */
  getSessionInfo(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): Array<{ id: string; deviceId: string; lastActivity: Date }> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      deviceId: session.deviceId,
      lastActivity: session.lastActivity
    }));
  }

  /**
   * Get sessions count
   */
  getSessionsCount(): number {
    return this.sessions.size;
  }

  /**
   * Handle WebSocket message for a session (public method for WebSocket server)
   */
  handleMessage(sessionId: string, message: SSHProxyMessage): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.handleWebSocketMessage(session, message);
    }
  }

  /**
   * Destroy all sessions and cleanup
   */
  destroy(): void {
    console.log('Destroying SSH Proxy service');
    
    clearInterval(this.cleanupInterval);
    
    for (const sessionId of this.sessions.keys()) {
      this.destroySession(sessionId);
    }
  }

  /**
   * Decrypt SSH private key using the same method as devices.ts
   */
  private decryptSSHKey(encryptedKey: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const password = process.env.SSH_KEY_ENCRYPTION_PASSWORD || 'default-key';
      const key = crypto.scryptSync(password, 'salt', 32);
      
      // Parse the encrypted key (format: iv:encrypted - same as devices.ts)
      const parts = encryptedKey.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted private key format');
      }
      
      const ivHex = parts[0]!;
      const encrypted = parts[1]!;
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt SSH key:', error);
      throw new Error('Failed to decrypt SSH private key');
    }
  }

  /**
   * Create session in database (only if it doesn't exist)
   */
  private createSessionInDatabase(session: TerminalSession): void {
    try {
      // Check if session already exists
      const existingSession = this.db.prepare('SELECT id FROM terminal_sessions WHERE id = ?').get(session.id);
      
      if (existingSession) {
        console.log(`📝 Session ${session.id} already exists in database, updating status to active`);
        this.updateSessionStatusInDatabase(session.id, 'active');
        return;
      }

      const stmt = this.db.prepare(`
        INSERT INTO terminal_sessions (
          id, device_id, user_id, session_name, status, authentication_method,
          start_time, last_activity, total_duration, command_count, bytes_transmitted,
          client_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        session.id,
        session.deviceId,
        null, // user_id - we don't have user management yet
        session.sessionName || `Terminal Session - ${new Date().toLocaleString()}`,
        'active',
        session.authMethod,
        session.startTime.toISOString(),
        session.lastActivity.toISOString(),
        0, // total_duration starts at 0
        0, // command_count starts at 0
        0, // bytes_transmitted starts at 0
        JSON.stringify({ type: 'websocket', created: new Date().toISOString() })
      );
      
      console.log(`✅ Session ${session.id} created in database`);
    } catch (error) {
      console.error(`❌ Failed to create session ${session.id} in database:`, error);
    }
  }

  /**
   * Update session in database
   */
  private updateSessionInDatabase(session: TerminalSession): void {
    try {
      const duration = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
      
      const stmt = this.db.prepare(`
        UPDATE terminal_sessions 
        SET last_activity = ?, total_duration = ?, command_count = ?, bytes_transmitted = ?
        WHERE id = ?
      `);
      
      stmt.run(
        session.lastActivity.toISOString(),
        duration,
        session.commandCount,
        session.bytesTransmitted,
        session.id
      );
    } catch (error) {
      console.error(`❌ Failed to update session ${session.id} in database:`, error);
    }
  }

  /**
   * Update session status in database
   */
  private updateSessionStatusInDatabase(sessionId: string, status: 'active' | 'disconnected' | 'closed'): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE terminal_sessions 
        SET status = ?, last_activity = ?
        WHERE id = ?
      `);
      
      stmt.run(status, new Date().toISOString(), sessionId);
      console.log(`✅ Session ${sessionId} status updated to '${status}' in database`);
    } catch (error) {
      console.error(`❌ Failed to update session ${sessionId} status in database:`, error);
    }
  }

  /**
   * Close session in database
   */
  private closeSessionInDatabase(sessionId: string): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE terminal_sessions 
        SET status = 'closed', end_time = ?
        WHERE id = ?
      `);
      
      stmt.run(new Date().toISOString(), sessionId);
      console.log(`✅ Session ${sessionId} closed in database`);
    } catch (error) {
      console.error(`❌ Failed to close session ${sessionId} in database:`, error);
    }
  }

  /**
   * Clean ANSI escape sequences and control characters from terminal content
   */
  private cleanTerminalContent(content: string): string {
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
  }

  /**
   * Check if content looks like system output rather than user command
   */
  private isSystemOutput(content: string): boolean {
    // Skip empty content
    if (!content.trim()) return true;
    
    // Common RouterOS system output patterns
    const systemPatterns = [
      /^\s*routerboard:/i,
      /^\s*board-name:/i,
      /^\s*model:/i,
      /^\s*revision:/i,
      /^\s*serial-number:/i,
      /^\s*firmware-type:/i,
      /^\s*factory-firmware:/i,
      /^\s*current-firmware:/i,
      /^\s*upgrade-firmware:/i,
      /^\s*MikroTik RouterOS/i,
      /^\s*Press F1 for help/i,
      /^\s*\[.*\]\s*>/,  // Command prompt
      /^\s*yes$/i,
      /^\s*no$/i
    ];
    
    return systemPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if content is a command prompt
   */
  private isCommandPrompt(content: string): boolean {
    const promptPatterns = [
      /^\s*\[.*\]\s*>\s*$/,  // RouterOS prompt like [admin@MikroTik] >
      /^\s*>\s*$/,           // Simple prompt
      /^\s*#\s*$/,           // Root prompt
      /^\s*\$\s*$/           // User prompt
    ];
    
    return promptPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check if content is tab completion fragment
   */
  private isTabCompletion(content: string): boolean {
    // Tab completion typically shows short command fragments or single words
    const trimmed = content.trim();
    
    // Skip very short fragments (likely tab completion)
    if (trimmed.length <= 3) return true;
    
    // Common RouterOS command fragments that appear during tab completion
    const tabCompletionPatterns = [
      /^(sys|system)$/i,
      /^(rou|route)$/i,
      /^(pri|print)$/i,
      /^(int|interface)$/i,
      /^(ip)$/i,
      /^(add|remove|set|get)$/i,
      /^(ena|enable|dis|disable)$/i,
      /^[a-z]{1,4}$/,  // Short abbreviations
    ];
    
    return tabCompletionPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Check if output is substantial enough to log
   */
  private isSubstantialOutput(content: string): boolean {
    const trimmed = content.trim();
    
    // Skip very short content
    if (trimmed.length < 3) return false;
    
    // Skip tab completion menus (common patterns)
    if (this.isTabCompletionMenu(trimmed)) {
      return false;
    }
    
    // Skip single words that are likely fragments
    if (!trimmed.includes(' ') && !trimmed.includes('\n') && trimmed.length < 10) {
      return false;
    }
    
    // Skip common single-word responses
    const skipWords = ['yes', 'no', 'ok', 'done', 'error', 'true', 'false'];
    if (skipWords.includes(trimmed.toLowerCase())) {
      return false;
    }
    
    // Log multi-line output or substantial single lines
    return trimmed.includes('\n') || trimmed.length > 15;
  }

  /**
   * Check if content is a tab completion menu
   */
  private isTabCompletionMenu(content: string): boolean {
    // Tab completion menus typically have multiple short commands in columns
    const lines = content.split('\n');
    
    // Check for RouterOS command list patterns
    if (lines.length > 1) {
      // Count how many lines look like command lists
      let commandListLines = 0;
      for (const line of lines) {
        const words = line.trim().split(/\s+/);
        // If line has multiple short words (likely commands), it's probably a tab completion menu
        if (words.length >= 3 && words.every(word => word.length <= 20)) {
          commandListLines++;
        }
      }
      
      // If most lines look like command lists, it's probably tab completion
      if (commandListLines >= lines.length * 0.6) {
        return true;
      }
    }
    
    // Single line with multiple short words separated by spaces (command list)
    const words = content.trim().split(/\s+/);
    if (words.length >= 4 && words.every(word => word.length <= 15 && /^[a-z-]+$/.test(word))) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if a command is worth logging (not just navigation or system commands)
   */
  private isActualCommand(command: string): boolean {
    // Skip empty commands
    if (!command.trim()) return false;
    
    // Skip very short commands that are likely just navigation
    if (command.length < 2) return false;
    
    // Skip common navigation and system commands that aren't useful in history
    const skipCommands = [
      /^\.\.?$/,           // cd .. or .
      /^cd\s*$/,           // empty cd
      /^ls\s*$/,           // empty ls
      /^help\s*$/,         // help command
      /^exit\s*$/,         // exit
      /^quit\s*$/,         // quit
      /^\?$/,              // help shortcut
    ];
    
    if (skipCommands.some(pattern => pattern.test(command.trim()))) {
      return false;
    }
    
    // Log substantial commands
    return true;
  }

  /**
   * Process user input and capture raw terminal data
   */
  private processUserInput(session: TerminalSession, input: string): void {
    const now = Date.now();
    
    // Store raw input data with timestamp
    this.logRawTerminalData(session, input, 'input', now);
    
    // Track current input buffer for command detection
    if (input.includes('\r') || input.includes('\n')) {
      // Command completed
      const command = session.currentInputBuffer.trim();
      if (command.length > 0) {
        console.log(`🎯 Complete command detected: "${command}"`);
      session.commandCount++;
        session.lastUserInput = command;
        session.isWaitingForOutput = true;
      }
      session.currentInputBuffer = '';
    } else if (input.includes('\x7f') || input.includes('\b')) {
      // Backspace/delete
      if (session.currentInputBuffer.length > 0) {
        session.currentInputBuffer = session.currentInputBuffer.slice(0, -1);
      }
    } else {
      // Regular input (including tab completions)
      session.currentInputBuffer += input;
    }
  }

  /**
   * Process terminal output and capture raw data
   */
  private processTerminalOutput(session: TerminalSession, output: string): void {
    const now = Date.now();
    
    // Store raw output data with timestamp
    this.logRawTerminalData(session, output, 'output', now);
    
    // If we were waiting for output after a command, mark as received
    if (session.isWaitingForOutput) {
      session.isWaitingForOutput = false;
    }
    }
    
  /**
   * Process terminal data through state manager and log meaningful frames
   */
  private logRawTerminalData(session: TerminalSession, data: string, direction: 'input' | 'output', timestamp: number): void {
    // Filter out only pure terminal protocol noise, not actual content
    if (this.isTerminalProtocolNoise(data)) {
      return; // Skip logging terminal protocol chatter
    }
    
    // Process data through terminal state manager
    session.terminalState.processData(data, direction, timestamp);
    
    // Get any new frames from the terminal state manager
    const newFrames = session.terminalState.getFramesSince(session.lastDataTime);
    
    // Log each meaningful frame
    for (const frame of newFrames) {
      this.logSessionActivity(
        session.id,
        frame.type === 'input' ? 'input' : 'output',
        frame.content,
        frame.type === 'input',
        undefined, // No duration for raw data logs
        true // Mark as raw data
      );
      
      session.sequenceNumber++;
    }
    
    session.lastDataTime = timestamp;
  }

  /**
   * Check if data is terminal protocol noise that should be filtered out
   * Only filter out pure protocol negotiation, not actual content
   */
  private isTerminalProtocolNoise(data: string): boolean {
    // Only filter out pure protocol responses with no meaningful content
    
    // Device Status Report responses (cursor position reports)
    if (/^\x1b\[\d+;\d+R$/.test(data)) return true;
    
    // Pure cursor positioning queries during terminal setup
    if (/^\x1b\[6n$/.test(data)) return true;
    
    // Pure terminal mode setting responses (no content)
    if (/^\x1b\[\?[\d;]*[lh]$/.test(data)) return true;
    
    // Large cursor movements for terminal size detection (no content)
    if (/^\x1b\[9999[ABCD]$/.test(data)) return true;
    
    // Empty or single control character responses
    if (data.length === 1 && /[\x00-\x1F\x7F]/.test(data)) return true;
    
    // Very short whitespace-only responses
    if (/^\s{0,3}$/.test(data)) return true;
    
    return false;
  }

  /**
   * Log session activity for history tracking
   */
  private logSessionActivity(sessionId: string, type: 'input' | 'output' | 'command' | 'system' | 'error', content: string, isInput: boolean = false, commandDuration?: number, isRawData: boolean = false): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Update session metrics
    session.bytesTransmitted += Buffer.byteLength(content, 'utf8');
    session.lastActivity = new Date();

    // Log to database
    try {
      const stmt = this.db.prepare(`
        INSERT INTO terminal_session_logs (
          session_id, log_type, content, timestamp, sequence_number, is_input, command_duration, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        sessionId,
        type,
        content, // Store full content for raw data
        new Date().toISOString(),
        session.sequenceNumber,
        isInput ? 1 : 0,
        commandDuration || null,
        isRawData ? 1 : 0
      );
      
      console.log(`📝 Logged ${isRawData ? 'raw ' : ''}${type} for session ${sessionId}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
      
      // Update session in database periodically (every 10 logs for raw data)
      if (session.sequenceNumber % 10 === 0) {
        this.updateSessionInDatabase(session);
      }
    } catch (error) {
      console.error(`❌ Failed to log session activity for ${sessionId}:`, error);
    }
  }

  /**
   * Create session bookmark
   */
  createBookmark(sessionId: string, bookmarkName: string, description?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      // Get the most recent log entry for this session
      const latestLog = this.db.prepare(`
        SELECT id FROM terminal_session_logs 
        WHERE session_id = ? 
        ORDER BY sequence_number DESC 
        LIMIT 1
      `).get(sessionId) as { id: number } | undefined;

      if (!latestLog) {
        console.warn(`No logs found for session ${sessionId} to bookmark`);
        return false;
      }

      const stmt = this.db.prepare(`
        INSERT INTO terminal_session_bookmarks (
          session_id, log_id, bookmark_name, description, tags, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        sessionId,
        latestLog.id,
        bookmarkName,
        description || null,
        JSON.stringify([]), // empty tags array
        new Date().toISOString()
      );
      
      console.log(`✅ Bookmark created for session ${sessionId}: ${bookmarkName}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to create bookmark for session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Export session history
   */
  exportSession(sessionId: string, format: 'json' | 'txt' | 'html' | 'csv' = 'txt'): string | null {
    try {
      // Get session data from database
      const sessionData = this.db.prepare(`
        SELECT ts.*, d.name as device_name, d.ip_address
        FROM terminal_sessions ts
        LEFT JOIN devices d ON ts.device_id = d.id
        WHERE ts.id = ?
      `).get(sessionId);

      if (!sessionData) {
        console.warn(`Session ${sessionId} not found in database`);
        return null;
      }

      // Get session logs
      const logs = this.db.prepare(`
        SELECT * FROM terminal_session_logs 
        WHERE session_id = ? 
        ORDER BY sequence_number ASC
      `).all(sessionId);

      const exportData = {
        session: sessionData,
        logs,
        exportedAt: new Date().toISOString(),
        format
      };

      // Save export record to database
      try {
        const exportStmt = this.db.prepare(`
          INSERT INTO terminal_session_exports (
            session_id, export_name, export_format, export_data, export_settings, file_size, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        const exportContent = this.formatExportData(exportData, format);
        const exportName = `session_${sessionId}_${format}_${Date.now()}`;
        
        exportStmt.run(
          sessionId,
          exportName,
          format,
          exportContent,
          JSON.stringify({ format, includeLogs: true }),
          Buffer.byteLength(exportContent, 'utf8'),
          new Date().toISOString()
        );
      } catch (exportError) {
        console.error(`Failed to save export record:`, exportError);
      }

      return this.formatExportData(exportData, format);
    } catch (error) {
      console.error(`❌ Failed to export session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Format export data based on format
   */
  private formatExportData(exportData: any, format: string): string {
    const { session, logs } = exportData;
    
    switch (format) {
      case 'json':
        return JSON.stringify(exportData, null, 2);
        
      case 'txt':
        let txtContent = `Terminal Session Export\n`;
        txtContent += `========================\n\n`;
        txtContent += `Session ID: ${session.id}\n`;
        txtContent += `Device: ${session.device_name} (${session.ip_address})\n`;
        txtContent += `Authentication: ${session.authentication_method}\n`;
        txtContent += `Start Time: ${session.start_time}\n`;
        txtContent += `End Time: ${session.end_time || 'Session still active'}\n`;
        txtContent += `Duration: ${session.total_duration} seconds\n`;
        txtContent += `Commands: ${session.command_count}\n`;
        txtContent += `Bytes Transmitted: ${session.bytes_transmitted}\n\n`;
        txtContent += `Session Log:\n`;
        txtContent += `============\n\n`;
        
        logs.forEach((log: any) => {
          const timestamp = new Date(log.timestamp).toLocaleString();
          const prefix = log.is_input ? '> ' : '  ';
          txtContent += `[${timestamp}] ${prefix}${log.content}\n`;
        });
        
        return txtContent;
        
      case 'html':
        let htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Terminal Session Export - ${session.id}</title>
    <style>
        body { font-family: 'Courier New', monospace; margin: 20px; background: #1e1e1e; color: #d4d4d4; }
        .header { background: #2d2d30; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .log-entry { margin: 2px 0; }
        .input { color: #569cd6; font-weight: bold; }
        .output { color: #d4d4d4; }
        .timestamp { color: #608b4e; font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Terminal Session Export</h1>
        <p><strong>Session ID:</strong> ${session.id}</p>
        <p><strong>Device:</strong> ${session.device_name} (${session.ip_address})</p>
        <p><strong>Authentication:</strong> ${session.authentication_method}</p>
        <p><strong>Duration:</strong> ${session.total_duration} seconds</p>
        <p><strong>Commands:</strong> ${session.command_count}</p>
    </div>
    <div class="log">`;
        
        logs.forEach((log: any) => {
          const timestamp = new Date(log.timestamp).toLocaleString();
          const className = log.is_input ? 'input' : 'output';
          htmlContent += `<div class="log-entry ${className}">`;
          htmlContent += `<span class="timestamp">[${timestamp}]</span> `;
          htmlContent += `${log.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
          htmlContent += `</div>`;
        });
        
        htmlContent += `</div></body></html>`;
        return htmlContent;
        
      case 'csv':
        let csvContent = `"Timestamp","Type","Content","Sequence"\n`;
        logs.forEach((log: any) => {
          const type = log.is_input ? 'INPUT' : 'OUTPUT';
          const content = log.content.replace(/"/g, '""'); // Escape quotes
          csvContent += `"${log.timestamp}","${type}","${content}","${log.sequence_number}"\n`;
        });
        return csvContent;
        
      default:
        return JSON.stringify(exportData);
    }
  }
} 