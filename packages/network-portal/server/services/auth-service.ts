import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Database } from 'better-sqlite3';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'operator' | 'user' | 'viewer';
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  role?: 'admin' | 'operator' | 'user' | 'viewer';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export class AuthService {
  constructor(private db: Database) {}

  async createUser(userData: CreateUserRequest): Promise<User> {
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(userData.password, 12);

    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      userData.username,
      userData.email,
      passwordHash,
      userData.full_name || null,
      userData.role || 'user'
    );

    return this.getUserById(userId)!;
  }

  async validateLogin(credentials: LoginRequest, clientInfo: {
    ip: string;
    userAgent: string;
  }): Promise<User | null> {
    // Log attempt
    this.logLoginAttempt(credentials.username, clientInfo, false);

    const user = this.db.prepare(`
      SELECT * FROM users 
      WHERE username = ? AND is_active = true
    `).get(credentials.username) as any;

    if (!user) return null;

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new Error('Account temporarily locked. Try again later.');
    }

    const isValid = await bcrypt.compare(credentials.password, user.password_hash);
    
    if (!isValid) {
      this.handleFailedLogin(user.id);
      return null;
    }

    // Success - reset failed attempts and update last login
    this.db.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0, last_login = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(user.id);

    this.logLoginAttempt(credentials.username, clientInfo, true);
    return this.mapUserFromDb(user);
  }

  private handleFailedLogin(userId: string): void {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET failed_login_attempts = failed_login_attempts + 1,
          locked_until = CASE 
            WHEN failed_login_attempts >= 4 
            THEN datetime('now', '+15 minutes')
            ELSE locked_until 
          END
      WHERE id = ?
    `);
    stmt.run(userId);
  }

  getUserById(id: string): User | null {
    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    return user ? this.mapUserFromDb(user) : null;
  }

  isSetupRequired(): boolean {
    const adminCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM users WHERE role = 'admin'
    `).get() as { count: number };
    
    return adminCount.count === 0;
  }

  private mapUserFromDb(dbUser: any): User {
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      full_name: dbUser.full_name,
      role: dbUser.role,
      is_active: dbUser.is_active,
      last_login: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
      created_at: new Date(dbUser.created_at)
    };
  }

  private logLoginAttempt(username: string, clientInfo: { ip: string; userAgent: string }, success: boolean): void {
    this.db.prepare(`
      INSERT INTO login_attempts (username, ip_address, user_agent, success)
      VALUES (?, ?, ?, ?)
    `).run(username, clientInfo.ip, clientInfo.userAgent || '', success ? 1 : 0);
  }
}

export function createFirstTimeSetupData(db: Database): void {
  // This function can be used to create any initial data needed for first-time setup
  // For now, it's just a placeholder that can be extended later
  console.log('First-time setup initialization complete');
} 