/**
 * Terminal API Routes
 * 
 * Implements HTTP API endpoints for SSH terminal functionality.
 * Terminal WebSocket connections are handled by the main WebSocket server.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from 'better-sqlite3';
import * as crypto from 'crypto';

// ==================== INTERFACES ====================

interface DeviceRow {
  id: string;
  name: string;
  ip_address: string;
  username: string;
  password: string;
  port: number;
  use_ssl: boolean;
  status: string;
  ssh_private_key?: string;
  ssh_public_key?: string;
}

interface TerminalSession {
  id: string;
  device_id: string;
  user_id?: string;
  session_name?: string;
  status: string;
  authentication_method: string;
  start_time: string;
  end_time?: string;
  last_activity: string;
  total_duration: number;
  command_count: number;
  bytes_transmitted: number;
  client_info?: string;
}

interface SessionLog {
  id: number;
  session_id: string;
  log_type: string;
  content: string;
  timestamp: string;
  sequence_number: number;
  is_input: boolean;
  command_duration?: number;
}

interface SessionBookmark {
  id: number;
  session_id: string;
  log_id: number;
  bookmark_name: string;
  description?: string;
  tags?: string;
  created_at: string;
}

// ==================== ROUTE HANDLERS ====================

async function terminalRoutes(fastify: FastifyInstance) {
  const db = fastify.db as Database;

  /**
   * GET /api/terminal/devices/:deviceId/info - Get device info for terminal
   */
  fastify.get('/devices/:deviceId/info', async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    try {
      const { deviceId } = request.params;
      const device = getDeviceById(db, deviceId);

      if (!device) {
        reply.status(404).send({ error: 'Device not found' });
        return;
      }

      // Don't send password or SSH keys in response
      const { password, ssh_private_key, ssh_public_key, ...deviceInfo } = device;

      reply.send({
        device: {
          ...deviceInfo,
          terminalAvailable: device.status === 'connected',
          authMethod: device.ssh_private_key ? 'key' : 'password',
          sshKeysConfigured: !!device.ssh_private_key
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to get device info:', error);
      reply.status(500).send({ error: 'Failed to retrieve device information' });
    }
  });

  /**
   * POST /api/terminal/devices/:deviceId/test - Test SSH connectivity
   */
  fastify.post('/devices/:deviceId/test', async (request: FastifyRequest<{ Params: { deviceId: string } }>, reply: FastifyReply) => {
    try {
      const { deviceId } = request.params;
      const device = getDeviceById(db, deviceId);

      if (!device) {
        reply.status(404).send({ error: 'Device not found' });
        return;
      }

      // This would test SSH connectivity
      // For now, we'll just check if the device is marked as connected
      const sshAvailable = device.status === 'connected';
      const authMethod = device.ssh_private_key ? 'key' : 'password';

      reply.send({
        deviceId,
        sshAvailable,
        authMethod,
        message: sshAvailable 
          ? `SSH connection should be available using ${authMethod} authentication` 
          : 'Device is not connected',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to test SSH connectivity:', error);
      reply.status(500).send({ error: 'Failed to test SSH connectivity' });
    }
  });

  /**
   * POST /api/terminal/sessions - Create a new terminal session
   */
  fastify.post('/sessions', async (request: FastifyRequest<{ 
    Body: { deviceId: string; sessionName?: string }
  }>, reply: FastifyReply) => {
    try {
      const { deviceId, sessionName } = request.body;
      
      if (!deviceId) {
        reply.status(400).send({ error: 'Device ID is required' });
        return;
      }

      // Check if device exists
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
      if (!device) {
        reply.status(404).send({ error: 'Device not found' });
        return;
      }

      // Generate session ID
      const sessionId = crypto.randomUUID();
      const finalSessionName = sessionName || `Terminal Session - ${new Date().toLocaleString()}`;

      // Create session record in database immediately
      const stmt = db.prepare(`
        INSERT INTO terminal_sessions (
          id, device_id, user_id, session_name, status, authentication_method,
          start_time, last_activity, total_duration, command_count, bytes_transmitted,
          client_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        sessionId,
        deviceId,
        null, // user_id - we don't have user management yet
        finalSessionName,
        'active', // Start as active, will be updated when SSH connects
        'password', // Default, will be updated based on device config
        new Date().toISOString(),
        new Date().toISOString(),
        0,
        0,
        0,
        JSON.stringify({ type: 'api', created: new Date().toISOString() })
      );

      reply.send({
        sessionId,
        message: 'Terminal session created successfully',
        session: {
          id: sessionId,
          device_id: deviceId,
          session_name: finalSessionName,
          status: 'active',
          start_time: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to create terminal session:', error);
      reply.status(500).send({ error: 'Failed to create terminal session' });
    }
  });

  /**
   * GET /api/terminal/sessions - Get terminal sessions
   */
  fastify.get('/sessions', async (request: FastifyRequest<{ 
    Querystring: { deviceId?: string; status?: string; limit?: string; offset?: string } 
  }>, reply: FastifyReply) => {
    try {
      const { deviceId, status, limit = '50', offset = '0' } = request.query;
      
      let query = `
        SELECT ts.*, d.name as device_name, d.ip_address
        FROM terminal_sessions ts
        LEFT JOIN devices d ON ts.device_id = d.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (deviceId) {
        query += ' AND ts.device_id = ?';
        params.push(deviceId);
      }

      if (status) {
        query += ' AND ts.status = ?';
        params.push(status);
      }

      query += ' ORDER BY ts.start_time DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const sessions = db.prepare(query).all(...params) as (TerminalSession & { device_name: string; ip_address: string })[];

      reply.send({
        sessions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: sessions.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to get terminal sessions:', error);
      reply.status(500).send({ error: 'Failed to retrieve terminal sessions' });
    }
  });

  /**
   * GET /api/terminal/sessions/:sessionId - Get specific session details
   */
  fastify.get('/sessions/:sessionId', async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      
      const session = db.prepare(`
        SELECT ts.*, d.name as device_name, d.ip_address
        FROM terminal_sessions ts
        LEFT JOIN devices d ON ts.device_id = d.id
        WHERE ts.id = ?
      `).get(sessionId) as (TerminalSession & { device_name: string; ip_address: string }) | undefined;

      if (!session) {
        reply.status(404).send({ error: 'Session not found' });
        return;
      }

      reply.send({
        session,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to get session details:', error);
      reply.status(500).send({ error: 'Failed to retrieve session details' });
    }
  });

  /**
   * GET /api/terminal/sessions/:sessionId/logs - Get session history/logs
   */
  fastify.get('/sessions/:sessionId/logs', async (request: FastifyRequest<{ 
    Params: { sessionId: string };
    Querystring: { type?: string; limit?: string; offset?: string }
  }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      const { type, limit = '1000', offset = '0' } = request.query;
      
      let query = `
        SELECT * FROM terminal_session_logs
        WHERE session_id = ?
      `;
      const params: any[] = [sessionId];

      if (type) {
        query += ' AND log_type = ?';
        params.push(type);
      }

      query += ' ORDER BY sequence_number ASC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const logs = db.prepare(query).all(...params) as SessionLog[];

      reply.send({
        sessionId,
        logs,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: logs.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to get session logs:', error);
      reply.status(500).send({ error: 'Failed to retrieve session logs' });
    }
  });

  /**
   * POST /api/terminal/sessions/:sessionId/bookmarks - Create session bookmark
   */
  fastify.post('/sessions/:sessionId/bookmarks', async (request: FastifyRequest<{ 
    Params: { sessionId: string };
    Body: { bookmarkName: string; description?: string; logId?: number; tags?: string[] }
  }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      const { bookmarkName, description, logId, tags } = request.body;
      
      // Verify session exists
      const session = db.prepare('SELECT id FROM terminal_sessions WHERE id = ?').get(sessionId);
      if (!session) {
        reply.status(404).send({ error: 'Session not found' });
        return;
      }

      // If no logId provided, use the latest log entry
      let targetLogId = logId;
      if (!targetLogId) {
        const latestLog = db.prepare(`
          SELECT id FROM terminal_session_logs 
          WHERE session_id = ? 
          ORDER BY sequence_number DESC 
          LIMIT 1
        `).get(sessionId) as { id: number } | undefined;
        
        if (!latestLog) {
          reply.status(400).send({ error: 'No log entries found for this session' });
          return;
        }
        
        targetLogId = latestLog.id;
      }

      const bookmarkId = db.prepare(`
        INSERT INTO terminal_session_bookmarks (session_id, log_id, bookmark_name, description, tags)
        VALUES (?, ?, ?, ?, ?)
        RETURNING id
      `).get(sessionId, targetLogId, bookmarkName, description, tags ? JSON.stringify(tags) : null) as { id: number };

      reply.send({
        bookmarkId: bookmarkId.id,
        message: 'Bookmark created successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to create bookmark:', error);
      reply.status(500).send({ error: 'Failed to create bookmark' });
    }
  });

  /**
   * GET /api/terminal/sessions/:sessionId/bookmarks - Get session bookmarks
   */
  fastify.get('/sessions/:sessionId/bookmarks', async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      
      const bookmarks = db.prepare(`
        SELECT b.*, l.content as log_content, l.timestamp as log_timestamp
        FROM terminal_session_bookmarks b
        LEFT JOIN terminal_session_logs l ON b.log_id = l.id
        WHERE b.session_id = ?
        ORDER BY b.created_at DESC
      `).all(sessionId) as (SessionBookmark & { log_content: string; log_timestamp: string })[];

      reply.send({
        sessionId,
        bookmarks: bookmarks.map(bookmark => ({
          ...bookmark,
          tags: bookmark.tags ? JSON.parse(bookmark.tags) : []
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to get session bookmarks:', error);
      reply.status(500).send({ error: 'Failed to retrieve session bookmarks' });
    }
  });

  /**
   * POST /api/terminal/sessions/:sessionId/export - Export session history
   */
  fastify.post('/sessions/:sessionId/export', async (request: FastifyRequest<{ 
    Params: { sessionId: string };
    Body: { format: 'json' | 'txt' | 'html' | 'csv'; name?: string; includeOutput?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      const { format, name, includeOutput = true } = request.body;
      
      // Get session details
      const session = db.prepare(`
        SELECT ts.*, d.name as device_name, d.ip_address
        FROM terminal_sessions ts
        LEFT JOIN devices d ON ts.device_id = d.id
        WHERE ts.id = ?
      `).get(sessionId) as (TerminalSession & { device_name: string; ip_address: string }) | undefined;

      if (!session) {
        reply.status(404).send({ error: 'Session not found' });
        return;
      }

      // Get session logs
      let logQuery = 'SELECT * FROM terminal_session_logs WHERE session_id = ?';
      const logParams: any[] = [sessionId];
      
      if (!includeOutput) {
        logQuery += ' AND is_input = 1'; // Only include user input commands
      }
      
      logQuery += ' ORDER BY sequence_number ASC';
      
      const logs = db.prepare(logQuery).all(...logParams) as SessionLog[];

      // Generate export data based on format
      let exportData: string;
      let mimeType: string;
      let fileExtension: string;

      switch (format) {
        case 'json':
          exportData = JSON.stringify({
            session,
            logs,
            exportedAt: new Date().toISOString()
          }, null, 2);
          mimeType = 'application/json';
          fileExtension = 'json';
          break;

        case 'txt':
          exportData = generateTextExport(session, logs);
          mimeType = 'text/plain';
          fileExtension = 'txt';
          break;

        case 'html':
          exportData = generateHTMLExport(session, logs);
          mimeType = 'text/html';
          fileExtension = 'html';
          break;

        case 'csv':
          exportData = generateCSVExport(session, logs);
          mimeType = 'text/csv';
          fileExtension = 'csv';
          break;

        default:
          reply.status(400).send({ error: 'Invalid export format' });
          return;
      }

      // Save export record
      const exportName = name || `${session.device_name}_${session.start_time.replace(/[^0-9]/g, '')}`;
      
      db.prepare(`
        INSERT INTO terminal_session_exports (session_id, export_name, export_format, export_data, file_size)
        VALUES (?, ?, ?, ?, ?)
      `).run(sessionId, exportName, format, exportData, Buffer.byteLength(exportData, 'utf8'));

      // Set response headers for download
      reply.header('Content-Type', mimeType);
      reply.header('Content-Disposition', `attachment; filename="${exportName}.${fileExtension}"`);
      reply.send(exportData);

    } catch (error) {
      fastify.log.error('Failed to export session:', error);
      reply.status(500).send({ error: 'Failed to export session' });
    }
  });

  /**
   * POST /api/terminal/sessions/:sessionId/end - End a terminal session (disconnect SSH but keep history)
   */
  fastify.post('/sessions/:sessionId/end', async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      
      console.log(`🔚 Ending session: ${sessionId}`);
      
      // Check if session exists
      const session = db.prepare('SELECT * FROM terminal_sessions WHERE id = ?').get(sessionId);
      if (!session) {
        reply.status(404).send({ error: 'Session not found' });
        return;
      }
      
      // Get WebSocket server to access SSH proxy
      const webSocketServer = (fastify as any).webSocketServer;
      if (webSocketServer && webSocketServer.sshProxy) {
        // Destroy the SSH session (this will disconnect SSH and clean up resources)
        console.log(`🔌 Destroying SSH session: ${sessionId}`);
        webSocketServer.sshProxy.destroySession(sessionId);
      } else {
        console.warn(`⚠️ WebSocket server or SSH proxy not available for session ${sessionId}`);
      }
      
      // Update session status to 'closed' and set end time
      const stmt = db.prepare(`
        UPDATE terminal_sessions 
        SET status = 'closed', end_time = ? 
        WHERE id = ?
      `);
      stmt.run(new Date().toISOString(), sessionId);
      
      console.log(`✅ Session ${sessionId} ended successfully (SSH disconnected, history preserved)`);
      
      reply.send({ 
        success: true, 
        message: 'Session ended successfully',
        sessionId: sessionId 
      });
    } catch (error) {
      fastify.log.error('Error ending session:', error);
      reply.status(500).send({ error: 'Failed to end session' });
    }
  });

  /**
   * DELETE /api/terminal/sessions/:sessionId - Delete a terminal session and all related data
   */
  fastify.delete('/sessions/:sessionId', async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      
      // Check if session exists
      const session = db.prepare('SELECT id, status FROM terminal_sessions WHERE id = ?').get(sessionId) as { id: string; status: string } | undefined;
      
      if (!session) {
        reply.status(404).send({ error: 'Session not found' });
        return;
      }

      // Don't allow deletion of active sessions
      if (session.status === 'active') {
        reply.status(400).send({ error: 'Cannot delete active session. Please close the session first.' });
        return;
      }

      // Start transaction to delete all related data
      const deleteTransaction = db.transaction(() => {
        // Delete session exports
        db.prepare('DELETE FROM terminal_session_exports WHERE session_id = ?').run(sessionId);
        
        // Delete session bookmarks
        db.prepare('DELETE FROM terminal_session_bookmarks WHERE session_id = ?').run(sessionId);
        
        // Delete session logs
        const deletedLogs = db.prepare('DELETE FROM terminal_session_logs WHERE session_id = ?').run(sessionId);
        
        // Delete the session itself
        const deletedSession = db.prepare('DELETE FROM terminal_sessions WHERE id = ?').run(sessionId);
        
        return { deletedLogs: deletedLogs.changes, deletedSession: deletedSession.changes };
      });

      const result = deleteTransaction();

      reply.send({
        message: 'Session deleted successfully',
        sessionId,
        deletedLogs: result.deletedLogs,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to delete session:', error);
      reply.status(500).send({ error: 'Failed to delete session' });
    }
  });

  /**
   * DELETE /api/terminal/sessions - Delete multiple terminal sessions
   */
  fastify.delete('/sessions', async (request: FastifyRequest<{ 
    Body: { sessionIds: string[]; deleteAll?: boolean; olderThan?: string }
  }>, reply: FastifyReply) => {
    try {
      const { sessionIds, deleteAll, olderThan } = request.body;
      
      let sessionsToDelete: string[] = [];
      
      if (deleteAll) {
        // Get all non-active sessions
        const sessions = db.prepare('SELECT id FROM terminal_sessions WHERE status != ?').all('active') as { id: string }[];
        sessionsToDelete = sessions.map(s => s.id);
      } else if (olderThan) {
        // Get sessions older than specified date
        const sessions = db.prepare('SELECT id FROM terminal_sessions WHERE status != ? AND start_time < ?').all('active', olderThan) as { id: string }[];
        sessionsToDelete = sessions.map(s => s.id);
      } else if (sessionIds && sessionIds.length > 0) {
        // Use provided session IDs, but filter out active ones
        const activeSessions = db.prepare(`
          SELECT id FROM terminal_sessions 
          WHERE id IN (${sessionIds.map(() => '?').join(',')}) AND status = 'active'
        `).all(...sessionIds) as { id: string }[];
        
        const activeIds = activeSessions.map(s => s.id);
        sessionsToDelete = sessionIds.filter(id => !activeIds.includes(id));
        
        if (activeIds.length > 0) {
          reply.status(400).send({ 
            error: 'Cannot delete active sessions', 
            activeSessions: activeIds 
          });
          return;
        }
      } else {
        reply.status(400).send({ error: 'No sessions specified for deletion' });
        return;
      }

      if (sessionsToDelete.length === 0) {
        reply.send({
          message: 'No sessions to delete',
          deletedCount: 0,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Delete sessions in batches to avoid SQL limits
      const batchSize = 100;
      let totalDeleted = 0;
      let totalLogsDeleted = 0;

      for (let i = 0; i < sessionsToDelete.length; i += batchSize) {
        const batch = sessionsToDelete.slice(i, i + batchSize);
        const placeholders = batch.map(() => '?').join(',');
        
        const deleteTransaction = db.transaction(() => {
          // Delete exports
          db.prepare(`DELETE FROM terminal_session_exports WHERE session_id IN (${placeholders})`).run(...batch);
          
          // Delete bookmarks
          db.prepare(`DELETE FROM terminal_session_bookmarks WHERE session_id IN (${placeholders})`).run(...batch);
          
          // Delete logs
          const logsResult = db.prepare(`DELETE FROM terminal_session_logs WHERE session_id IN (${placeholders})`).run(...batch);
          
          // Delete sessions
          const sessionsResult = db.prepare(`DELETE FROM terminal_sessions WHERE id IN (${placeholders})`).run(...batch);
          
          return { deletedSessions: sessionsResult.changes, deletedLogs: logsResult.changes };
        });

        const result = deleteTransaction();
        totalDeleted += result.deletedSessions;
        totalLogsDeleted += result.deletedLogs;
      }

      reply.send({
        message: `Successfully deleted ${totalDeleted} sessions`,
        deletedCount: totalDeleted,
        deletedLogs: totalLogsDeleted,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to delete sessions:', error);
      reply.status(500).send({ error: 'Failed to delete sessions' });
    }
  });

  /**
   * GET /api/terminal/status - Get terminal service status
   */
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const webSocketServer = (fastify as any).webSocketServer;
      const connectedClients = webSocketServer ? webSocketServer.getConnectedClientsCount() : 0;

      // Get active sessions count
      const activeSessions = db.prepare(`
        SELECT COUNT(*) as count FROM terminal_sessions WHERE status = 'active'
      `).get() as { count: number };

      reply.send({
        status: 'active',
        webSocketClients: connectedClients,
        activeSessions: activeSessions.count,
        webSocketPort: process.env.WS_PORT || 3004,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error('Failed to get terminal status:', error);
      reply.status(500).send({ error: 'Failed to retrieve terminal status' });
    }
  });

  /**
   * POST /api/terminal/sessions/cleanup - Remove duplicate sessions and orphaned data
   * STEP 1.3: Session Cleanup and Deduplication
   */
  fastify.post('/sessions/cleanup', async (request: FastifyRequest<{
    Body: { deviceId?: string; olderThanHours?: number; dryRun?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { deviceId, olderThanHours = 24, dryRun = false } = request.body || {};
      
      const cleanupResults = {
        duplicateSessions: 0,
        orphanedLogs: 0,
        orphanedBookmarks: 0,
        orphanedExports: 0,
        totalCleaned: 0,
        message: dryRun ? 'Dry run - no actual changes made' : 'Cleanup completed'
      };

      // Start cleanup transaction
      const cleanupTransaction = db.transaction(() => {
        // Step 1: Find and handle duplicate active sessions for each device
        let deviceQuery = 'SELECT device_id, COUNT(*) as count FROM terminal_sessions WHERE status = "active"';
        const params: any[] = [];
        
        if (deviceId) {
          deviceQuery += ' AND device_id = ?';
          params.push(deviceId);
        }
        
        deviceQuery += ' GROUP BY device_id HAVING count > 1';
        
        const devicesWithDuplicates = db.prepare(deviceQuery).all(...params) as Array<{ device_id: string; count: number }>;
        
        for (const device of devicesWithDuplicates) {
          // Get all active sessions for this device, ordered by last_activity (newest first)
          const duplicateSessions = db.prepare(`
            SELECT id, last_activity, start_time 
            FROM terminal_sessions 
            WHERE device_id = ? AND status = 'active'
            ORDER BY last_activity DESC
          `).all(device.device_id) as Array<{ id: string; last_activity: string; start_time: string }>;
          
          // Keep the most recent session, close the others
          const sessionsToClose = duplicateSessions.slice(1);
          
          for (const session of sessionsToClose) {
            if (!dryRun) {
              db.prepare(`
                UPDATE terminal_sessions 
                SET status = 'closed', end_time = CURRENT_TIMESTAMP 
                WHERE id = ?
              `).run(session.id);
            }
            cleanupResults.duplicateSessions++;
          }
          
          console.log(`🧹 Found ${sessionsToClose.length} duplicate sessions for device ${device.device_id}`);
        }

        // Step 2: Clean up old sessions (older than specified hours)
        const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000)).toISOString();
        
        let oldSessionsQuery = `
          SELECT id FROM terminal_sessions 
          WHERE status IN ('disconnected', 'closed') AND start_time < ?
        `;
        const oldSessionsParams = [cutoffTime];
        
        if (deviceId) {
          oldSessionsQuery += ' AND device_id = ?';
          oldSessionsParams.push(deviceId);
        }
        
        const oldSessions = db.prepare(oldSessionsQuery).all(...oldSessionsParams) as Array<{ id: string }>;
        
        if (oldSessions.length > 0 && !dryRun) {
          const sessionIds = oldSessions.map(s => s.id);
          const placeholders = sessionIds.map(() => '?').join(',');
          
          // Delete in correct order due to foreign key constraints
          db.prepare(`DELETE FROM terminal_session_exports WHERE session_id IN (${placeholders})`).run(...sessionIds);
          db.prepare(`DELETE FROM terminal_session_bookmarks WHERE session_id IN (${placeholders})`).run(...sessionIds);
          db.prepare(`DELETE FROM terminal_session_logs WHERE session_id IN (${placeholders})`).run(...sessionIds);
          db.prepare(`DELETE FROM terminal_sessions WHERE id IN (${placeholders})`).run(...sessionIds);
        }

        // Step 3: Find and clean orphaned logs (logs without parent session)
        const orphanedLogs = db.prepare(`
          SELECT COUNT(*) as count 
          FROM terminal_session_logs tsl 
          LEFT JOIN terminal_sessions ts ON tsl.session_id = ts.id 
          WHERE ts.id IS NULL
        `).get() as { count: number };
        
        if (orphanedLogs.count > 0 && !dryRun) {
          db.prepare(`
            DELETE FROM terminal_session_logs 
            WHERE session_id NOT IN (SELECT id FROM terminal_sessions)
          `).run();
        }
        cleanupResults.orphanedLogs = orphanedLogs.count;

        // Step 4: Find and clean orphaned bookmarks
        const orphanedBookmarks = db.prepare(`
          SELECT COUNT(*) as count 
          FROM terminal_session_bookmarks tsb 
          LEFT JOIN terminal_sessions ts ON tsb.session_id = ts.id 
          WHERE ts.id IS NULL
        `).get() as { count: number };
        
        if (orphanedBookmarks.count > 0 && !dryRun) {
          db.prepare(`
            DELETE FROM terminal_session_bookmarks 
            WHERE session_id NOT IN (SELECT id FROM terminal_sessions)
          `).run();
        }
        cleanupResults.orphanedBookmarks = orphanedBookmarks.count;

        // Step 5: Find and clean orphaned exports
        const orphanedExports = db.prepare(`
          SELECT COUNT(*) as count 
          FROM terminal_session_exports tse 
          LEFT JOIN terminal_sessions ts ON tse.session_id = ts.id 
          WHERE ts.id IS NULL
        `).get() as { count: number };
        
        if (orphanedExports.count > 0 && !dryRun) {
          db.prepare(`
            DELETE FROM terminal_session_exports 
            WHERE session_id NOT IN (SELECT id FROM terminal_sessions)
          `).run();
        }
        cleanupResults.orphanedExports = orphanedExports.count;

        // Calculate total cleaned items
        cleanupResults.totalCleaned = 
          cleanupResults.duplicateSessions + 
          cleanupResults.orphanedLogs + 
          cleanupResults.orphanedBookmarks + 
          cleanupResults.orphanedExports;

        return cleanupResults;
      });

      const results = cleanupTransaction();
      
      // Log cleanup results
      console.log(`🧹 Terminal session cleanup ${dryRun ? '(dry run)' : 'completed'}:`, results);

      reply.send({
        success: true,
        results,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      fastify.log.error('Failed to cleanup terminal sessions:', error);
      reply.status(500).send({ error: 'Failed to cleanup terminal sessions' });
    }
  });
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get device by ID from database including SSH keys
 */
function getDeviceById(db: Database, deviceId: string): DeviceRow | null {
  try {
    const query = `
      SELECT id, name, ip_address, username, password, port, use_ssl, status, ssh_private_key, ssh_public_key
      FROM devices 
      WHERE id = ?
    `;
    
    const device = db.prepare(query).get(deviceId) as DeviceRow | undefined;
    return device || null;
  } catch (error) {
    console.error(`Error getting device ${deviceId}:`, error);
    return null;
  }
}

/**
 * Generate text export format
 */
function generateTextExport(session: TerminalSession & { device_name: string; ip_address: string }, logs: SessionLog[]): string {
  let output = `RouterOS Terminal Session Export\n`;
  output += `=====================================\n\n`;
  output += `Session ID: ${session.id}\n`;
  output += `Device: ${session.device_name} (${session.ip_address})\n`;
  output += `Start Time: ${session.start_time}\n`;
  output += `Duration: ${Math.floor(session.total_duration / 60)} minutes\n`;
  output += `Commands: ${session.command_count}\n`;
  output += `Authentication: ${session.authentication_method}\n\n`;
  output += `Session Log:\n`;
  output += `============\n\n`;

  logs.forEach(log => {
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    const prefix = log.is_input ? '[CMD]' : '[OUT]';
    output += `${timestamp} ${prefix} ${log.content}\n`;
  });

  output += `\n\nExported: ${new Date().toISOString()}\n`;
  return output;
}

/**
 * Generate HTML export format
 */
function generateHTMLExport(session: TerminalSession & { device_name: string; ip_address: string }, logs: SessionLog[]): string {
  let html = `<!DOCTYPE html>
<html>
<head>
  <title>Terminal Session - ${session.device_name}</title>
  <style>
    body { font-family: 'Courier New', monospace; margin: 20px; background: #1a1a1a; color: #ffffff; }
    .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
    .session-info { background: #2a2a2a; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .log-entry { margin: 2px 0; padding: 5px; }
    .command { color: #00ff00; background: rgba(0, 255, 0, 0.1); }
    .output { color: #cccccc; }
    .system { color: #ffaa00; font-style: italic; }
    .error { color: #ff4444; }
    .timestamp { color: #888; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RouterOS Terminal Session</h1>
    <h2>${session.device_name} (${session.ip_address})</h2>
  </div>
  
  <div class="session-info">
    <strong>Session ID:</strong> ${session.id}<br>
    <strong>Start Time:</strong> ${session.start_time}<br>
    <strong>Duration:</strong> ${Math.floor(session.total_duration / 60)} minutes<br>
    <strong>Commands:</strong> ${session.command_count}<br>
    <strong>Authentication:</strong> ${session.authentication_method}
  </div>
  
  <div class="session-log">
    <h3>Session Log:</h3>`;

  logs.forEach(log => {
    const timestamp = new Date(log.timestamp).toLocaleTimeString();
    const cssClass = log.is_input ? 'command' : (log.log_type === 'error' ? 'error' : log.log_type === 'system' ? 'system' : 'output');
    const escapedContent = log.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html += `<div class="log-entry ${cssClass}">
      <span class="timestamp">${timestamp}</span> ${escapedContent}
    </div>`;
  });

  html += `
  </div>
  
  <footer style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #333; color: #888;">
    Exported: ${new Date().toISOString()}
  </footer>
</body>
</html>`;

  return html;
}

/**
 * Generate CSV export format
 */
function generateCSVExport(session: TerminalSession & { device_name: string; ip_address: string }, logs: SessionLog[]): string {
  let csv = `Session ID,Device Name,IP Address,Timestamp,Type,Is Input,Content\n`;
  
  logs.forEach(log => {
    const escapedContent = `"${log.content.replace(/"/g, '""')}"`;
    csv += `"${session.id}","${session.device_name}","${session.ip_address}","${log.timestamp}","${log.log_type}",${log.is_input},${escapedContent}\n`;
  });

  return csv;
}

export default terminalRoutes; 