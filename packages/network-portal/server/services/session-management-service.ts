import Database from 'better-sqlite3';
import { UserSession } from '../types/user-management.js';

export class SessionManagementService {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  // Get all active sessions for a user
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const query = `
      SELECT id, user_id, device_info, location, ip_address, 
             user_agent, is_active, created_at, expires_at
      FROM user_sessions 
      WHERE user_id = ? AND is_active = 1
      ORDER BY created_at DESC
    `;

    return this.db.prepare(query).all(userId) as UserSession[];
  }

  // Get all active sessions (admin view)
  async getAllActiveSessions(page = 1, limit = 50): Promise<{
    sessions: (UserSession & { username: string })[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = this.db.prepare(`
      SELECT COUNT(*) as total 
      FROM user_sessions 
      WHERE is_active = 1
    `).get() as { total: number };

    // Get sessions with user information
    const query = `
      SELECT 
        s.id, s.user_id, s.device_info, s.location, s.ip_address,
        s.user_agent, s.is_active, s.created_at, s.expires_at,
        u.username
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = 1
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const sessions = this.db.prepare(query).all(limit, offset) as (UserSession & { username: string })[];

    return {
      sessions,
      total: countResult.total,
      page,
      totalPages: Math.ceil(countResult.total / limit)
    };
  }

  // Terminate a specific session
  async terminateSession(sessionId: string, adminUserId: string): Promise<boolean> {
    const result = this.db.prepare(`
      UPDATE user_sessions 
      SET is_active = 0 
      WHERE id = ? AND is_active = 1
    `).run(sessionId);

    if (result.changes > 0) {
      // Log the session termination (you might want to add this to audit)
      console.log(`Session ${sessionId} terminated by admin ${adminUserId}`);
      return true;
    }

    return false;
  }

  // Terminate all sessions for a user
  async terminateUserSessions(userId: string, adminUserId: string): Promise<number> {
    const result = this.db.prepare(`
      UPDATE user_sessions 
      SET is_active = 0 
      WHERE user_id = ? AND is_active = 1
    `).run(userId);

    if (result.changes > 0) {
      console.log(`${result.changes} sessions terminated for user ${userId} by admin ${adminUserId}`);
    }

    return result.changes;
  }

  // Get session statistics
  async getSessionStats(): Promise<{
    totalActive: number;
    totalToday: number;
    byUser: Array<{ username: string; sessionCount: number }>;
    byLocation: Record<string, number>;
  }> {
    // Get total active sessions
    const activeResult = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM user_sessions 
      WHERE is_active = 1
    `).get() as { count: number };

    // Get sessions created today
    const todayResult = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM user_sessions 
      WHERE date(created_at) = date('now')
    `).get() as { count: number };

    // Get sessions by user
    const userResults = this.db.prepare(`
      SELECT u.username, COUNT(*) as sessionCount
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = 1
      GROUP BY s.user_id, u.username
      ORDER BY sessionCount DESC
      LIMIT 10
    `).all() as Array<{ username: string; sessionCount: number }>;

    // Get sessions by location (if available)
    const locationResults = this.db.prepare(`
      SELECT location, COUNT(*) as count
      FROM user_sessions
      WHERE is_active = 1 AND location IS NOT NULL
      GROUP BY location
      ORDER BY count DESC
    `).all() as Array<{ location: string; count: number }>;

    const byLocation: Record<string, number> = {};
    locationResults.forEach(result => {
      byLocation[result.location] = result.count;
    });

    return {
      totalActive: activeResult.count,
      totalToday: todayResult.count,
      byUser: userResults,
      byLocation
    };
  }

  // Clean up expired sessions
  async cleanupExpiredSessions(): Promise<number> {
    const result = this.db.prepare(`
      UPDATE user_sessions 
      SET is_active = 0 
      WHERE expires_at < datetime('now') AND is_active = 1
    `).run();

    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} expired sessions`);
    }

    return result.changes;
  }

  // Update session activity
  async updateSessionActivity(sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (ipAddress) {
      updateFields.push('ip_address = ?');
      params.push(ipAddress);
    }

    if (userAgent) {
      updateFields.push('user_agent = ?');
      params.push(userAgent);
    }

    if (updateFields.length === 0) return;

    params.push(sessionId);

    const query = `
      UPDATE user_sessions 
      SET ${updateFields.join(', ')}
      WHERE id = ? AND is_active = 1
    `;

    this.db.prepare(query).run(...params);
  }
} 