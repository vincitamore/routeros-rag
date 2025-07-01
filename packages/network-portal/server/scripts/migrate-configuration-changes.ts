#!/usr/bin/env node

/**
 * Database Migration: Add Configuration Changes Table
 * 
 * This migration adds the configuration_changes table and related indexes
 * to support the new Configuration Management features.
 */

import Database from 'better-sqlite3';
import { join } from 'path';

function runMigration(dbPath: string = 'network-portal.db'): void {
  console.log('🔄 Starting configuration changes table migration...');
  
  let db: Database.Database | null = null;
  
  try {
    // Connect to database
    const fullDbPath = join(process.cwd(), dbPath);
    db = new Database(fullDbPath);
    console.log(`📊 Connected to database: ${fullDbPath}`);

    // Check if table already exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='configuration_changes'
    `).get();

    if (tableExists) {
      console.log('✅ configuration_changes table already exists, skipping creation');
    } else {
      console.log('🏗️  Creating configuration_changes table...');
      
      // Create the table
      db.exec(`
        CREATE TABLE configuration_changes (
          id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL,
          change_type TEXT NOT NULL,           -- ip_address, route, firewall, interface, backup
          operation TEXT NOT NULL,             -- create, update, delete
          object_id TEXT,                      -- RouterOS object ID
          old_value TEXT,                      -- JSON data of old values
          new_value TEXT,                      -- JSON data of new values
          user_id TEXT,                        -- User who made the change
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
        )
      `);
      
      console.log('✅ configuration_changes table created successfully');
    }

    // Check and create indexes
    const indexes = [
      {
        name: 'idx_config_changes_device_timestamp',
        sql: 'CREATE INDEX IF NOT EXISTS idx_config_changes_device_timestamp ON configuration_changes(device_id, timestamp)'
      },
      {
        name: 'idx_config_changes_section',
        sql: 'CREATE INDEX IF NOT EXISTS idx_config_changes_section ON configuration_changes(section)'
      }
    ];

    for (const index of indexes) {
      console.log(`🔍 Creating index: ${index.name}...`);
      db.exec(index.sql);
      console.log(`✅ Index ${index.name} created successfully`);
    }

    // Verify the migration
    const verifyTable = db.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='configuration_changes'
    `).get() as { sql: string } | undefined;

    if (verifyTable) {
      console.log('✅ Migration verification successful');
      console.log('📋 Table schema:');
      console.log(verifyTable.sql);
    } else {
      throw new Error('Migration verification failed - table not found');
    }

    // Show table info
    const tableInfo = db.prepare("PRAGMA table_info(configuration_changes)").all();
    console.log('\n📊 Table structure:');
    console.table(tableInfo);

    console.log('\n🎉 Migration completed successfully!');
    console.log('✨ Configuration Management features are now ready to use.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (db) {
      db.close();
      console.log('🔐 Database connection closed');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const dbPath = process.argv[2] || 'network-portal.db';
  runMigration(dbPath);
}

export { runMigration }; 