import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createFirstTimeSetupData } from '../services/auth-service';

export function initializeDatabase(dbPath: string = 'network-portal.db'): Database.Database {
  try {
    // Create database connection
    const db = new Database(dbPath);
    
    // Enable WAL mode for better concurrent performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 1000000');
    db.pragma('foreign_keys = ON');
    
    // Read and execute schema
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
        // Execute schema directly - SQLite can handle it
    console.log('Executing database schema...');
    
    try {
      db.exec(schema);
      console.log('✅ Schema executed successfully');
    } catch (error: any) {
      console.error('❌ Schema execution failed:', error.message);
      throw error;
    }
    
    // Run database migrations for existing installations
    runMigrations(db);
    
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Run database migrations for existing installations
 */
function runMigrations(db: Database.Database): void {
  try {
    // Create migrations tracking table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Helper function to check if migration was already applied
    const isMigrationApplied = (version: number): boolean => {
      const result = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
      return !!result;
    };
    
    // Helper function to mark migration as applied
    const markMigrationApplied = (version: number): void => {
      db.prepare('INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)').run(version);
    };
    // Migration 1: Add SSH key columns to devices table
    if (!isMigrationApplied(1)) {
      try {
        db.exec(`
          ALTER TABLE devices ADD COLUMN ssh_private_key TEXT;
          ALTER TABLE devices ADD COLUMN ssh_public_key TEXT;
        `);
        markMigrationApplied(1);
        console.log('Migration 1: Added SSH key columns to devices table');
      } catch (error: any) {
        console.error('Migration 1 error:', error.message);
      }
    }

    // Migration 2: Add enhanced connection tracking columns
    if (!isMigrationApplied(2)) {
      try {
        db.exec(`
          ALTER TABLE connection_tracking ADD COLUMN tcp_state TEXT;
          ALTER TABLE connection_tracking ADD COLUMN connection TEXT;
          ALTER TABLE connection_tracking ADD COLUMN orig_bytes INTEGER;
          ALTER TABLE connection_tracking ADD COLUMN repl_bytes INTEGER;
          ALTER TABLE connection_tracking ADD COLUMN orig_packets INTEGER;
          ALTER TABLE connection_tracking ADD COLUMN repl_packets INTEGER;
          ALTER TABLE connection_tracking ADD COLUMN orig_rate TEXT;
          ALTER TABLE connection_tracking ADD COLUMN repl_rate TEXT;
          ALTER TABLE connection_tracking ADD COLUMN assured INTEGER DEFAULT 0;
          ALTER TABLE connection_tracking ADD COLUMN seen_reply INTEGER DEFAULT 0;
        `);
        markMigrationApplied(2);
        console.log('Migration 2: Added enhanced connection tracking columns');
      } catch (error: any) {
        console.error('Migration 2 error:', error.message);
      }
    }

    // Migration 3: User management enhancements (now handled by schema.sql for new installations)
    // This migration is no longer needed since schema.sql contains the complete structure

    // Migration 4: Add IPsec tables for VPN functionality
    try {
      // Check if ipsec_identities table has the correct schema (match_by column)
      let needsRecreation = false;
      
      try {
        // Use PRAGMA table_info to check if the column exists
        const tableInfo = db.prepare('PRAGMA table_info(ipsec_identities)').all();
        const hasMatchByColumn = tableInfo.some((col: any) => col.name === 'match_by');
        
        if (!hasMatchByColumn) {
          needsRecreation = true;
          console.log('Migration: ipsec_identities table missing match_by column');
        }
      } catch (error: any) {
        if (error.message.includes('no such table')) {
          needsRecreation = true;
          console.log('Migration: ipsec_identities table does not exist');
        } else {
          throw error;
        }
      }

      if (needsRecreation) {
        console.log('Migration 4: IPsec tables need recreation due to schema changes...');
        
        // Drop existing IPsec tables if they exist with wrong schema
        try {
          db.exec(`
            DROP INDEX IF EXISTS idx_ipsec_policies_device_id;
            DROP INDEX IF EXISTS idx_ipsec_policies_ros_id;
            DROP INDEX IF EXISTS idx_ipsec_peers_device_id;
            DROP INDEX IF EXISTS idx_ipsec_peers_name;
            DROP INDEX IF EXISTS idx_ipsec_peers_ros_id;
            DROP INDEX IF EXISTS idx_ipsec_profiles_device_id;
            DROP INDEX IF EXISTS idx_ipsec_profiles_name;
            DROP INDEX IF EXISTS idx_ipsec_profiles_ros_id;
            DROP INDEX IF EXISTS idx_ipsec_active_peers_device_id;
            DROP INDEX IF EXISTS idx_ipsec_active_peers_collected_at;
            DROP INDEX IF EXISTS idx_ipsec_identities_device_id;
            DROP INDEX IF EXISTS idx_ipsec_identities_peer_name;
            DROP INDEX IF EXISTS idx_ipsec_identities_ros_id;
            DROP INDEX IF EXISTS idx_ipsec_proposals_device_id;
            DROP INDEX IF EXISTS idx_ipsec_proposals_name;
            DROP INDEX IF EXISTS idx_ipsec_proposals_ros_id;
            
            DROP TABLE IF EXISTS ipsec_policies;
            DROP TABLE IF EXISTS ipsec_peers;
            DROP TABLE IF EXISTS ipsec_profiles;
            DROP TABLE IF EXISTS ipsec_active_peers;
            DROP TABLE IF EXISTS ipsec_identities;
            DROP TABLE IF EXISTS ipsec_proposals;
          `);
          console.log('Migration 4: Dropped existing IPsec tables');
        } catch (dropError) {
          console.log('Migration 4: No existing IPsec tables to drop');
        }
        
        // Create all IPsec tables with correct schema
        db.exec(`
          -- IPsec Policies Table
          CREATE TABLE ipsec_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            src_address TEXT,
            dst_address TEXT,
            protocol TEXT DEFAULT 'all',
            action TEXT DEFAULT 'encrypt',
            tunnel INTEGER DEFAULT 1,
            peer_name TEXT,
            proposal_name TEXT,
            ph2_state TEXT,
            comment TEXT,
            disabled INTEGER DEFAULT 0,
            ros_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
          );

          -- IPsec Peers Table
          CREATE TABLE ipsec_peers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            name TEXT NOT NULL,
            address TEXT,
            local_address TEXT,
            exchange_mode TEXT DEFAULT 'ike2',
            profile_name TEXT,
            passive INTEGER DEFAULT 0,
            comment TEXT,
            disabled INTEGER DEFAULT 0,
            ros_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
          );

          -- IPsec Profiles Table
          CREATE TABLE ipsec_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            name TEXT NOT NULL,
            dh_group TEXT DEFAULT 'modp2048',
            enc_algorithm TEXT DEFAULT 'aes-256',
            hash_algorithm TEXT DEFAULT 'sha256',
            lifetime TEXT DEFAULT '1d',
            nat_traversal INTEGER DEFAULT 1,
            dpd_interval TEXT DEFAULT '8s',
            dpd_maximum_failures INTEGER DEFAULT 4,
            comment TEXT,
            disabled INTEGER DEFAULT 0,
            ros_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
          );

          -- IPsec Active Peers Table (for monitoring)
          CREATE TABLE ipsec_active_peers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            remote_address TEXT,
            local_address TEXT,
            state TEXT,
            uptime TEXT,
            rx_bytes INTEGER,
            tx_bytes INTEGER,
            last_seen TEXT,
            responder INTEGER,
            collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
          );

          -- IPsec Identities Table
          CREATE TABLE ipsec_identities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            peer_name TEXT NOT NULL,
            auth_method TEXT DEFAULT 'pre-shared-key',
            secret TEXT,
            certificate TEXT,
            generate_policy TEXT DEFAULT 'port-strict',
            match_by TEXT DEFAULT 'remote-id',
            mode_config TEXT,
            policy_template_group TEXT,
            my_id TEXT,
            remote_id TEXT,
            comment TEXT,
            disabled INTEGER DEFAULT 0,
            ros_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
          );

          -- IPsec Proposals Table
          CREATE TABLE ipsec_proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            name TEXT NOT NULL,
            auth_algorithms TEXT DEFAULT 'sha256',
            enc_algorithms TEXT DEFAULT 'aes-256-cbc',
            pfs_group TEXT DEFAULT 'modp2048',
            lifetime TEXT DEFAULT '30m',
            comment TEXT,
            disabled INTEGER DEFAULT 0,
            ros_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
          );

          -- Create indexes for IPsec tables
          CREATE INDEX idx_ipsec_policies_device_id ON ipsec_policies(device_id);
          CREATE INDEX idx_ipsec_policies_ros_id ON ipsec_policies(ros_id);
          CREATE INDEX idx_ipsec_peers_device_id ON ipsec_peers(device_id);
          CREATE INDEX idx_ipsec_peers_name ON ipsec_peers(name);
          CREATE INDEX idx_ipsec_peers_ros_id ON ipsec_peers(ros_id);
          CREATE INDEX idx_ipsec_profiles_device_id ON ipsec_profiles(device_id);
          CREATE INDEX idx_ipsec_profiles_name ON ipsec_profiles(name);
          CREATE INDEX idx_ipsec_profiles_ros_id ON ipsec_profiles(ros_id);
          CREATE INDEX idx_ipsec_active_peers_device_id ON ipsec_active_peers(device_id);
          CREATE INDEX idx_ipsec_active_peers_collected_at ON ipsec_active_peers(collected_at);
          CREATE INDEX idx_ipsec_identities_device_id ON ipsec_identities(device_id);
          CREATE INDEX idx_ipsec_identities_peer_name ON ipsec_identities(peer_name);
          CREATE INDEX idx_ipsec_identities_ros_id ON ipsec_identities(ros_id);
          CREATE INDEX idx_ipsec_proposals_device_id ON ipsec_proposals(device_id);
          CREATE INDEX idx_ipsec_proposals_name ON ipsec_proposals(name);
          CREATE INDEX idx_ipsec_proposals_ros_id ON ipsec_proposals(ros_id);
        `);
        
        console.log('Migration: Created IPsec tables with correct schema successfully');
      } else {
        console.log('Migration: IPsec tables already exist with correct schema, skipping...');
      }
    } catch (error: any) {
      console.error('Migration error creating IPsec tables:', error.message);
      // Don't throw - this is non-critical for existing functionality
    }
    
    // Migration 4: Add ph2_state column to ipsec_policies table
    try {
      db.exec(`
        ALTER TABLE ipsec_policies ADD COLUMN ph2_state TEXT;
      `);
      console.log('Migration: Added ph2_state column to ipsec_policies table');
    } catch (error: any) {
      // Ignore "duplicate column name" errors - column already exists
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    // Don't throw - migrations are non-critical
  }

  // Migration 5: Add user management fields to users table
  try {
    db.exec(`
      ALTER TABLE users ADD COLUMN first_name TEXT;
      ALTER TABLE users ADD COLUMN last_name TEXT;
      ALTER TABLE users ADD COLUMN phone TEXT;
      ALTER TABLE users ADD COLUMN department TEXT;
      ALTER TABLE users ADD COLUMN notes TEXT;
      ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active';
      ALTER TABLE users ADD COLUMN password_reset_required BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN last_password_change DATETIME;
      ALTER TABLE users ADD COLUMN account_locked_until DATETIME;
      ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN avatar_url TEXT;
      ALTER TABLE users ADD COLUMN preferences TEXT;
    `);
    console.log('Migration: Added user management fields to users table');
  } catch (error: any) {
    // Ignore "duplicate column name" errors - columns already exist
    if (!error.message.includes('duplicate column name')) {
      console.error('Migration error:', error.message);
    }
  }

  // Migration 6: Create user management audit table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_management_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_user_id TEXT NOT NULL,
        target_user_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_user_id) REFERENCES users(id),
        FOREIGN KEY (target_user_id) REFERENCES users(id)
      );
    `);
    console.log('Migration: Created user_management_audit table');
  } catch (error: any) {
    if (!error.message.includes('already exists')) {
      console.error('Migration error:', error.message);
    }
  }

  // Migration 7: Enhance user sessions table with device tracking
  try {
    db.exec(`
      ALTER TABLE user_sessions ADD COLUMN device_info TEXT;
      ALTER TABLE user_sessions ADD COLUMN location TEXT;
      ALTER TABLE user_sessions ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    `);
    console.log('Migration: Enhanced user_sessions table with device tracking');
  } catch (error: any) {
    // Ignore "duplicate column name" errors - columns already exist
    if (!error.message.includes('duplicate column name')) {
      console.error('Migration error:', error.message);
    }
  }

  // Migration 8: Create indexes for user management performance
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
      CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
      CREATE INDEX IF NOT EXISTS idx_users_first_name ON users(first_name);
      CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
      CREATE INDEX IF NOT EXISTS idx_audit_admin_user_id ON user_management_audit(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_target_user_id ON user_management_audit(target_user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON user_management_audit(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON user_management_audit(action);
      CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON user_sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_sessions_device_info ON user_sessions(device_info);
    `);
    console.log('Migration: Created user management performance indexes');
  } catch (error: any) {
    if (!error.message.includes('already exists')) {
      console.error('Migration error:', error.message);
    }
  }
}

export function createTestData(db: Database.Database): void {
  try {
    // Check if this is first-time setup (no users exist)
    const userCountStmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const userCount = userCountStmt.get() as { count: number };
    
    if (userCount.count === 0) {
      // Setup first-time setup flag
      createFirstTimeSetupData(db);
      console.log('First-time setup data created - admin account required');
    }
    
    // Test device creation removed - no longer needed for production
    
    // Insert a sample device group
    const insertGroup = db.prepare(`
      INSERT OR IGNORE INTO device_groups (name, description, color)
      VALUES (?, ?, ?)
    `);
    
    insertGroup.run('Default Group', 'Default device group', '#3b82f6');
    
    console.log('Test data created successfully');
    
  } catch (error) {
    console.error('Failed to create test data:', error);
    throw error;
  }
} 