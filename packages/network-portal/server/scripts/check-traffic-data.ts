import Database from 'better-sqlite3';
import { join } from 'path';

// This script checks traffic data in the database
function checkTrafficData() {
  const dbPath = join(process.cwd(), 'network-portal.db');
  let db: Database.Database | null = null;
  
  try {
    db = new Database(dbPath);
    console.log('Connected to the database.');
    
    // Check if traffic_statistics table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='traffic_statistics'
    `).get();
    
    if (!tableExists) {
      console.log('traffic_statistics table does not exist');
      return;
    }
    
    // Get total count of traffic records
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM traffic_statistics').get() as { count: number };
    console.log(`Total traffic records: ${totalCount.count}`);
    
    // Get recent traffic data (last hour)
    const recentData = db.prepare(`
      SELECT 
        device_id,
        interface_name,
        rx_bits_per_second,
        tx_bits_per_second,
        timestamp
      FROM traffic_statistics 
      WHERE timestamp >= datetime('now', '-1 hour')
      ORDER BY timestamp DESC
      LIMIT 10
    `).all();
    
    console.log(`Recent traffic records (last hour): ${recentData.length}`);
    
    if (recentData.length > 0) {
      console.log('\nSample recent records:');
      recentData.forEach((record: any, index) => {
        console.log(`${index + 1}. Device: ${record.device_id}, Interface: ${record.interface_name}, RX: ${record.rx_bits_per_second} bps, TX: ${record.tx_bits_per_second} bps, Time: ${record.timestamp}`);
      });
    }
    
    // Get traffic data by device
    const deviceData = db.prepare(`
      SELECT 
        device_id,
        COUNT(*) as record_count,
        MIN(timestamp) as first_record,
        MAX(timestamp) as last_record
      FROM traffic_statistics 
      GROUP BY device_id
    `).all();
    
    console.log('\nTraffic data by device:');
    deviceData.forEach((device: any) => {
      console.log(`Device: ${device.device_id}, Records: ${device.record_count}, First: ${device.first_record}, Last: ${device.last_record}`);
    });
    
  } catch (error) {
    console.error('Failed to check traffic data:', error);
  } finally {
    if (db) {
      db.close();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run the check
checkTrafficData(); 