import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { User, CreateUserRequest, UpdateUserRequest, UserFilters, UserStats, PaginatedResponse } from '../types/user-management.js';
import { AuditService } from './audit-service.js';

export class UserManagementService {
  private db: Database.Database;
  private auditService: AuditService;

  constructor(database: Database.Database) {
    this.db = database;
    this.auditService = new AuditService(database);
  }

  // Get all users with filtering and pagination
  async getUsers(filters: UserFilters = {}, page = 1, limit = 25): Promise<{
    users: User[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    // Build dynamic WHERE clause
    if (filters.search) {
      whereClause += ` AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.role) {
      whereClause += ` AND role = ?`;
      params.push(filters.role);
    }

    if (filters.account_status) {
      whereClause += ` AND account_status = ?`;
      params.push(filters.account_status);
    }

    if (filters.department) {
      whereClause += ` AND department = ?`;
      params.push(filters.department);
    }

    if (filters.created_after) {
      whereClause += ` AND created_at >= ?`;
      params.push(filters.created_after);
    }

    if (filters.created_before) {
      whereClause += ` AND created_at <= ?`;
      params.push(filters.created_before);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = this.db.prepare(countQuery).get(...params) as { total: number };
    const total = countResult.total;

    // Get users with pagination
    const query = `
      SELECT id, username, email, full_name, first_name, last_name, phone, department, 
             notes, role, account_status, password_reset_required, 
             last_password_change, failed_login_attempts, account_locked_until,
             email_verified, two_factor_enabled, avatar_url, preferences,
             created_at, updated_at, last_login, is_active
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const users = this.db.prepare(query).all(...params, limit, offset) as User[];

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // Get single user by ID
  async getUserById(id: string): Promise<User | null> {
    const query = `
      SELECT id, username, email, full_name, first_name, last_name, phone, department, 
             notes, role, account_status, password_reset_required, 
             last_password_change, failed_login_attempts, account_locked_until,
             email_verified, two_factor_enabled, avatar_url, preferences,
             created_at, updated_at, last_login, is_active
      FROM users 
      WHERE id = ?
    `;
    
    return this.db.prepare(query).get(id) as User | null;
  }

  // Create new user
  async createUser(userData: CreateUserRequest, adminUserId: string, ipAddress?: string, userAgent?: string): Promise<User> {
    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const userId = uuidv4();

    // Check if username or email already exists
    const existingUser = this.db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(userData.username, userData.email);

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Insert new user - match the actual database schema
    const insertQuery = `
      INSERT INTO users (
        id, username, email, password_hash, full_name, role, is_active,
        failed_login_attempts, first_name, last_name, phone, department, 
        notes, account_status, password_reset_required, last_password_change,
        email_verified, two_factor_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Construct full name from first and last name
    const fullName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || null;

    this.db.prepare(insertQuery).run(
      userId,
      userData.username,
      userData.email || null,
      hashedPassword,
      fullName,
      userData.role,
      1, // is_active (1 = true)
      0, // failed_login_attempts
      userData.first_name || null,
      userData.last_name || null,
      userData.phone || null,
      userData.department || null,
      userData.notes || null,
      'active', // account_status
      userData.password_reset_required ? 1 : 0, // Convert boolean to integer
      new Date().toISOString(), // last_password_change
      0, // email_verified (0 = false)
      0 // two_factor_enabled (0 = false)
    );

    // Log audit event
    await this.auditService.logUserManagementAction(
      adminUserId,
      userId,
      'create',
      { 
        username: userData.username, 
        role: userData.role, 
        email: userData.email 
      },
      ipAddress,
      userAgent
    );

    const newUser = await this.getUserById(userId);
    if (!newUser) {
      throw new Error('Failed to retrieve created user');
    }

    return newUser;
  }

  // Update user
  async updateUser(
    userId: string, 
    userData: UpdateUserRequest, 
    adminUserId: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<User> {
    const currentUser = await this.getUserById(userId);
    if (!currentUser) {
      throw new Error('User not found');
    }

    // Build dynamic update query
    const updateFields: string[] = [];
    const params: any[] = [];

    if (userData.email !== undefined) {
      updateFields.push('email = ?');
      params.push(userData.email);
    }

    if (userData.first_name !== undefined) {
      updateFields.push('first_name = ?');
      params.push(userData.first_name);
    }

    if (userData.last_name !== undefined) {
      updateFields.push('last_name = ?');
      params.push(userData.last_name);
    }

    if (userData.phone !== undefined) {
      updateFields.push('phone = ?');
      params.push(userData.phone);
    }

    if (userData.department !== undefined) {
      updateFields.push('department = ?');
      params.push(userData.department);
    }

    if (userData.notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(userData.notes);
    }

    if (userData.role !== undefined) {
      updateFields.push('role = ?');
      params.push(userData.role);
    }

    if (userData.account_status !== undefined) {
      updateFields.push('account_status = ?');
      params.push(userData.account_status);
    }

    if (userData.password_reset_required !== undefined) {
      updateFields.push('password_reset_required = ?');
      params.push(userData.password_reset_required);
    }

    if (updateFields.length === 0) {
      return currentUser; // No changes to make
    }

    updateFields.push('updated_at = datetime(\'now\')');
    params.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    this.db.prepare(updateQuery).run(...params);

    // Log audit event
    await this.auditService.logUserManagementAction(
      adminUserId,
      userId,
      'update',
      { changes: userData },
      ipAddress,
      userAgent
    );

    const updatedUser = await this.getUserById(userId);
    if (!updatedUser) {
      throw new Error('Failed to retrieve updated user');
    }

    return updatedUser;
  }

  // Delete user
  async deleteUser(userId: string, adminUserId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent self-deletion
    if (userId === adminUserId) {
      throw new Error('Cannot delete your own account');
    }

    // Delete user sessions first
    this.db.prepare('DELETE FROM user_sessions WHERE user_id = ?').run(userId);

    // Delete the user
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    // Log audit event
    await this.auditService.logUserManagementAction(
      adminUserId,
      userId,
      'delete',
      { username: user.username, role: user.role },
      ipAddress,
      userAgent
    );
  }

  // Reset user password
  async resetUserPassword(
    userId: string, 
    newPassword: string, 
    adminUserId: string, 
    requireReset = true,
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    this.db.prepare(`
      UPDATE users 
      SET password_hash = ?, 
          password_reset_required = ?, 
          last_password_change = datetime('now'),
          failed_login_attempts = 0,
          account_locked_until = NULL,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(hashedPassword, requireReset ? 1 : 0, userId);

    // Log audit event
    await this.auditService.logUserManagementAction(
      adminUserId,
      userId,
      'reset_password',
      { require_reset: requireReset },
      ipAddress,
      userAgent
    );
  }

  // Get user statistics
  async getUserStats(): Promise<UserStats> {
    const stats = {
      total_users: 0,
      active_users: 0,
      inactive_users: 0,
      locked_users: 0,
      users_by_role: {} as Record<string, number>,
      recent_signups: 0,
      password_reset_required: 0,
      two_factor_enabled: 0
    };

    // Get total count
    const totalResult = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    stats.total_users = totalResult.count;

    // Get status counts
    const statusResults = this.db.prepare(`
      SELECT account_status, COUNT(*) as count 
      FROM users 
      GROUP BY account_status
    `).all() as { account_status: string; count: number }[];

    statusResults.forEach(result => {
      if (result.account_status === 'active') stats.active_users = result.count;
      else if (result.account_status === 'inactive') stats.inactive_users = result.count;
      else if (result.account_status === 'locked') stats.locked_users = result.count;
    });

    // Get role counts
    const roleResults = this.db.prepare(`
      SELECT role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `).all() as { role: string; count: number }[];

    roleResults.forEach(result => {
      stats.users_by_role[result.role] = result.count;
    });

    // Get recent signups (last 30 days)
    const recentSignupsResult = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE created_at >= datetime('now', '-30 days')
    `).get() as { count: number };
    stats.recent_signups = recentSignupsResult.count;

    // Get users requiring password reset
    const passwordResetResult = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE password_reset_required = 1
    `).get() as { count: number };
    stats.password_reset_required = passwordResetResult.count;

    // Get users with 2FA enabled
    const twoFactorResult = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE two_factor_enabled = 1
    `).get() as { count: number };
    stats.two_factor_enabled = twoFactorResult.count;

    return stats;
  }

  // Bulk operations
  async bulkUpdateUsers(
    userIds: string[], 
    updates: Partial<UpdateUserRequest>, 
    adminUserId: string,
    ipAddress?: string, 
    userAgent?: string
  ): Promise<number> {
    if (userIds.length === 0) return 0;

    // Prevent bulk operations on admin's own account
    if (userIds.includes(adminUserId)) {
      throw new Error('Cannot perform bulk operations on your own account');
    }

    const placeholders = userIds.map(() => '?').join(',');
    const updateFields: string[] = [];
    const params: any[] = [];

    // Build update fields
    if (updates.role !== undefined) {
      updateFields.push('role = ?');
      params.push(updates.role);
    }

    if (updates.account_status !== undefined) {
      updateFields.push('account_status = ?');
      params.push(updates.account_status);
    }

    if (updates.department !== undefined) {
      updateFields.push('department = ?');
      params.push(updates.department);
    }

    if (updateFields.length === 0) return 0;

    updateFields.push('updated_at = datetime(\'now\')');
    params.push(...userIds);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id IN (${placeholders})
    `;

    const result = this.db.prepare(query).run(...params);

    // Log audit event for bulk operation
    await this.auditService.logUserManagementAction(
      adminUserId,
      null,
      'bulk_update',
      { user_ids: userIds, updates },
      ipAddress,
      userAgent
    );

    return result.changes;
  }
} 