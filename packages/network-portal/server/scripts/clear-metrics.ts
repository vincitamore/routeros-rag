import Database from 'better-sqlite3';
import { join } from 'path';

// This script clears all records from the system_metrics table.
function clearSystemMetrics() {
  const dbPath = join(process.cwd(), 'network-portal.db');
  let db: Database.Database | null = null;
  
  try {
    db = new Database(dbPath);
    console.log('Connected to the database.');
    
    const stmt = db.prepare('DELETE FROM system_metrics');
    const result = stmt.run();
    
    console.log(`Successfully cleared ${result.changes} records from system_metrics.`);
    
  } catch (error) {
    console.error('Failed to clear system metrics:', error);
  } finally {
    if (db) {
      db.close();
      console.log('Database connection closed.');
    }
  }
}

clearSystemMetrics(); 