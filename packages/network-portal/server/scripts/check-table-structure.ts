#!/usr/bin/env node

/**
 * Check Table Structure Script
 * 
 * This script checks the current structure of database tables
 * to help debug migration issues.
 */

import Database from 'better-sqlite3';
import { join } from 'path';

function checkTableStructure(dbPath: string = 'network-portal.db'): void {
  console.log('🔍 Checking database table structures...');
  
  let db: Database.Database | null = null;
  
  try {
    // Connect to database
    const fullDbPath = join(process.cwd(), dbPath);
    db = new Database(fullDbPath);
    console.log(`📊 Connected to database: ${fullDbPath}`);

    // List all tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[];

    console.log('\n📋 Available tables:');
    tables.forEach(table => console.log(`  - ${table.name}`));

    // Check configuration_changes table specifically
    const configTable = tables.find(t => t.name === 'configuration_changes');
    
    if (configTable) {
      console.log('\n🔍 configuration_changes table structure:');
      
      // Get table schema
      const schema = db.prepare(`
        SELECT sql FROM sqlite_master 
        WHERE type='table' AND name='configuration_changes'
      `).get() as { sql: string } | undefined;
      
      if (schema) {
        console.log('📋 CREATE statement:');
        console.log(schema.sql);
      }
      
      // Get column info
      const columns = db.prepare("PRAGMA table_info(configuration_changes)").all();
      console.log('\n📊 Columns:');
      console.table(columns);
      
      // Get indexes
      const indexes = db.prepare(`
        SELECT name, sql FROM sqlite_master 
        WHERE type='index' AND tbl_name='configuration_changes'
      `).all();
      
      console.log('\n🔍 Indexes:');
      if (indexes.length > 0) {
        console.table(indexes);
      } else {
        console.log('  No indexes found');
      }
    } else {
      console.log('\n❌ configuration_changes table not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (db) {
      db.close();
      console.log('\n🔐 Database connection closed');
    }
  }
}

// Run if called directly
if (require.main === module) {
  const dbPath = process.argv[2] || 'network-portal.db';
  checkTableStructure(dbPath);
}

export { checkTableStructure }; 