import Database from 'better-sqlite3';
import { AuditLog } from '../types/user-management.js';

export class AuditService {
  private db: Database.Database;

  constructor(database: Database.Database) {
    this.db = database;
  }

  // Log user management action
  async logUserManagementAction(
    adminUserId: string,
    targetUserId: string | null,
    action: string,
    details: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const insertQuery = `
      INSERT INTO user_management_audit (
        admin_user_id, target_user_id, action, details, 
        ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `;

    this.db.prepare(insertQuery).run(
      adminUserId,
      targetUserId,
      action,
      JSON.stringify(details),
      ipAddress || null,
      userAgent || null
    );
  }

  // Get audit logs with filtering
  async getAuditLogs(
    filters: {
      adminUserId?: string;
      targetUserId?: string;
      action?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {},
    page = 1,
    limit = 50
  ): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.adminUserId) {
      whereClause += ' AND aud.admin_user_id = ?';
      params.push(filters.adminUserId);
    }

    if (filters.targetUserId) {
      whereClause += ' AND aud.target_user_id = ?';
      params.push(filters.targetUserId);
    }

    if (filters.action) {
      whereClause += ' AND aud.action = ?';
      params.push(filters.action);
    }

    if (filters.dateFrom) {
      whereClause += ' AND aud.created_at >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      whereClause += ' AND aud.created_at <= ?';
      params.push(filters.dateTo);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM user_management_audit aud 
      ${whereClause}
    `;
    const countResult = this.db.prepare(countQuery).get(...params) as { total: number };

    // Get audit logs with user information
    const query = `
      SELECT 
        aud.id, aud.admin_user_id, aud.target_user_id, aud.action,
        aud.details, aud.ip_address, aud.user_agent, aud.created_at,
        admin.username as admin_username,
        target.username as target_username
      FROM user_management_audit aud
      LEFT JOIN users admin ON aud.admin_user_id = admin.id
      LEFT JOIN users target ON aud.target_user_id = target.id
      ${whereClause}
      ORDER BY aud.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const logs = this.db.prepare(query).all(...params, limit, offset) as AuditLog[];

    return {
      logs,
      total: countResult.total,
      page,
      totalPages: Math.ceil(countResult.total / limit)
    };
  }

  // Get audit statistics
  async getAuditStats(days = 30): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByAdmin: Record<string, number>;
    recentActivity: AuditLog[];
  }> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    const thresholdString = dateThreshold.toISOString();

    // Get total actions
    const totalResult = this.db.prepare(`
      SELECT COUNT(*) as total 
      FROM user_management_audit 
      WHERE created_at >= ?
    `).get(thresholdString) as { total: number };

    // Get actions by type
    const actionTypeResults = this.db.prepare(`
      SELECT action, COUNT(*) as count 
      FROM user_management_audit 
      WHERE created_at >= ?
      GROUP BY action
      ORDER BY count DESC
    `).all(thresholdString) as { action: string; count: number }[];

    const actionsByType: Record<string, number> = {};
    actionTypeResults.forEach(result => {
      actionsByType[result.action] = result.count;
    });

    // Get actions by admin
    const adminResults = this.db.prepare(`
      SELECT u.username, COUNT(*) as count 
      FROM user_management_audit aud
      JOIN users u ON aud.admin_user_id = u.id
      WHERE aud.created_at >= ?
      GROUP BY aud.admin_user_id, u.username
      ORDER BY count DESC
    `).all(thresholdString) as { username: string; count: number }[];

    const actionsByAdmin: Record<string, number> = {};
    adminResults.forEach(result => {
      actionsByAdmin[result.username] = result.count;
    });

    // Get recent activity
    const recentActivity = this.db.prepare(`
      SELECT 
        aud.id, aud.admin_user_id, aud.target_user_id, aud.action,
        aud.details, aud.ip_address, aud.user_agent, aud.created_at,
        admin.username as admin_username,
        target.username as target_username
      FROM user_management_audit aud
      LEFT JOIN users admin ON aud.admin_user_id = admin.id
      LEFT JOIN users target ON aud.target_user_id = target.id
      ORDER BY aud.created_at DESC
      LIMIT 10
    `).all() as AuditLog[];

    return {
      totalActions: totalResult.total,
      actionsByType,
      actionsByAdmin,
      recentActivity
    };
  }
} 