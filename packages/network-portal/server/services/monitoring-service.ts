/**
 * Monitoring Service
 * 
 * Handles real-time system resource monitoring for RouterOS devices.
 * Collects CPU, memory, storage, and other system metrics.
 */

import { Database } from 'better-sqlite3';
import { RouterOSClient, SystemResource } from '../lib/routeros-client';
import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface SystemMetrics {
  device_id: string;
  cpu_load: number;
  free_memory: number;
  total_memory: number;
  free_hdd_space: number;
  total_hdd_space: number;
  uptime: string;
  temperature?: number;
  voltage?: number;
  timestamp: Date;
}

export interface InterfaceMetrics {
    id?: number;
    device_id: string;
    interface_name: string;
    interface_type?: string;
    status?: string;
    rx_bytes?: number;
    tx_bytes?: number;
    rx_packets?: number;
    tx_packets?: number;
    rx_errors?: number;
    tx_errors?: number;
    rx_drops?: number;
    tx_drops?: number;
    link_speed?: string;
    mac_address?: string;
    mtu?: number;
    timestamp: Date;
}

export interface MonitoringConfig {
  interval: number; // Collection interval in milliseconds
  retentionDays: number; // How long to keep historical data
}

export interface ConnectionTrackingEntry {
  id?: number;
  device_id: string;
  src_address?: string;
  dst_address?: string;
  src_port?: number;
  dst_port?: number;
  protocol?: string;
  state?: string;
  tcp_state?: string;
  connection?: string; // Connection tracking state (SAC, SC, C, etc.)
  timeout?: number;
  orig_bytes?: number;
  repl_bytes?: number;
  orig_packets?: number;
  repl_packets?: number;
  orig_rate?: string;
  repl_rate?: string;
  assured?: boolean;
  seen_reply?: boolean;
  timestamp: Date;
}

export class MonitoringService extends EventEmitter {
  private db: Database;
  private monitoringJobs: Map<string, NodeJS.Timeout> = new Map();
  private activeConnections: Map<string, RouterOSClient> = new Map();
  private config: MonitoringConfig;
  private insertMetricsStmt: any;
  private getLatestMetricsStmt: any;
  private getHistoricalMetricsStmt: any;
  private getDevicesStmt: any;
  private updateDeviceStatusStmt: any;
  private insertInterfaceMetricsStmt: any;
  private getHistoricalInterfaceMetricsStmt: any;
  private insertConnectionTrackingStmt: any;
  private getConnectionTrackingStmt: any;

  constructor(db: Database, config: MonitoringConfig = { interval: 30000, retentionDays: 30 }) {
    super();
    this.db = db;
    this.config = config;
    
    // Prepare database statements for better performance
    this.prepareStatements();
    
    // Start cleanup job for old data
    this.startCleanupJob();
  }

  private prepareStatements(): void {
    this.insertMetricsStmt = this.db.prepare(`
      INSERT INTO system_metrics (
        device_id, cpu_load, free_memory, total_memory, 
        free_hdd_space, total_hdd_space, uptime, temperature, voltage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getLatestMetricsStmt = this.db.prepare(`
      SELECT * FROM system_metrics 
      WHERE device_id = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);

    this.getHistoricalMetricsStmt = this.db.prepare(`
      SELECT * FROM system_metrics 
      WHERE device_id = ? 
      AND timestamp >= datetime('now', '-' || ? || ' hours')
      ORDER BY timestamp ASC
    `);

    this.getDevicesStmt = this.db.prepare(`
      SELECT id, ip_address, port, username, password, use_ssl, 
             ssh_private_key, ssh_public_key
      FROM devices 
      WHERE status != 'deleted'
    `);

    this.updateDeviceStatusStmt = this.db.prepare(`
      UPDATE devices 
      SET status = ?, last_seen = ?, last_error = ? 
      WHERE id = ?
    `);

    this.insertInterfaceMetricsStmt = this.db.prepare(`
      INSERT INTO interface_metrics (
        device_id, interface_name, interface_type, status, 
        rx_bytes, tx_bytes, rx_packets, tx_packets, rx_errors, tx_errors, 
        rx_drops, tx_drops, mac_address, mtu, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getHistoricalInterfaceMetricsStmt = this.db.prepare(`
      SELECT * FROM interface_metrics
      WHERE device_id = ? 
      AND timestamp >= datetime('now', '-' || ? || ' hours')
      ORDER BY timestamp ASC
    `);

    this.insertConnectionTrackingStmt = this.db.prepare(`
      INSERT INTO connection_tracking (
        device_id, src_address, dst_address, src_port, dst_port, protocol, state, tcp_state, 
        connection, timeout, orig_bytes, repl_bytes, orig_packets, repl_packets, 
        orig_rate, repl_rate, assured, seen_reply, collected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getConnectionTrackingStmt = this.db.prepare(`
      SELECT * FROM connection_tracking
      WHERE device_id = ? 
      AND collected_at >= datetime('now', '-' || ? || ' hours')
      ORDER BY collected_at ASC
    `);
  }

  /**
   * Decrypt private key for SSH authentication
   * Uses the same algorithm as devices.ts for compatibility
   */
  private decryptPrivateKey(encryptedPrivateKey: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const password = process.env.SSH_KEY_ENCRYPTION_PASSWORD || 'default-key';
      const key = crypto.scryptSync(password, 'salt', 32);
      
      const parts = encryptedPrivateKey.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted private key format');
      }
      
      const ivHex = parts[0]!;
      const encrypted = parts[1]!;
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt private key:', error);
      throw new Error('Failed to decrypt SSH private key');
    }
  }

  /**
   * Start monitoring a specific device
   */
  async startMonitoring(deviceId: string): Promise<void> {
    try {
      // Check if already monitoring
      if (this.monitoringJobs.has(deviceId)) {
        console.log(`Already monitoring device ${deviceId}`);
        return;
      }

      // Get device information including SSH keys
      const device = this.db.prepare(`
        SELECT id, ip_address, port, username, password, use_ssl, 
               ssh_private_key, ssh_public_key
        FROM devices 
        WHERE id = ?
      `).get(deviceId) as any;
      
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Create RouterOS client with SSH key support
      const clientOptions: any = {
        host: device.ip_address,
        port: device.port,
        username: device.username,
        password: device.password,
        useSSL: device.use_ssl,
        timeout: 10000
      };

      // Add SSH key authentication if available
      if (device.ssh_private_key) {
        try {
          clientOptions.sshPrivateKey = this.decryptPrivateKey(device.ssh_private_key);
          clientOptions.sshPublicKey = device.ssh_public_key;
          console.log(`🔑 Using SSH key authentication for monitoring device ${deviceId}`);
        } catch (error) {
          console.warn(`⚠️ Failed to decrypt SSH key for device ${deviceId}, falling back to password auth:`, error);
        }
      }

      const client = new RouterOSClient(clientOptions);
      this.activeConnections.set(deviceId, client);

      // Start monitoring job
      const job = setInterval(async () => {
        await this.collectMetrics(deviceId, client);
        await this.collectInterfaceMetrics(deviceId, client);
        await this.collectConnectionTracking(deviceId, client);
      }, this.config.interval);

      this.monitoringJobs.set(deviceId, job);
      
      // Collect initial metrics
      await this.collectMetrics(deviceId, client);
      await this.collectInterfaceMetrics(deviceId, client);
      await this.collectConnectionTracking(deviceId, client);
      
      console.log(`✅ Started monitoring device ${deviceId} (${device.use_ssl ? 'HTTPS' : 'HTTP'}:${device.port})`);
      this.emit('monitoring-started', deviceId);
      
    } catch (error) {
      console.error(`Failed to start monitoring for device ${deviceId}:`, error);
      this.emit('monitoring-error', deviceId, error);
      throw error;
    }
  }

  /**
   * Restart monitoring for a specific device (useful after HTTPS setup)
   */
  async restartMonitoring(deviceId: string): Promise<void> {
    try {
      console.log(`🔄 Restarting monitoring for device ${deviceId} (likely after HTTPS setup)`);
      
      // Stop current monitoring
      await this.stopMonitoring(deviceId);
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start monitoring with updated configuration
      await this.startMonitoring(deviceId);
      
      console.log(`✅ Successfully restarted monitoring for device ${deviceId}`);
      
    } catch (error) {
      console.error(`Failed to restart monitoring for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Stop monitoring a specific device
   */
  async stopMonitoring(deviceId: string): Promise<void> {
    try {
      // Clear monitoring job
      const job = this.monitoringJobs.get(deviceId);
      if (job) {
        clearInterval(job);
        this.monitoringJobs.delete(deviceId);
      }

      // Close client connection
      const client = this.activeConnections.get(deviceId);
      if (client) {
        client.close();
        this.activeConnections.delete(deviceId);
      }

      console.log(`Stopped monitoring device ${deviceId}`);
      this.emit('monitoring-stopped', deviceId);
      
    } catch (error) {
      console.error(`Failed to stop monitoring for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Start monitoring all connected devices
   */
  async startMonitoringAll(): Promise<void> {
    try {
      const devices = this.getDevicesStmt.all() as any[];
      
      for (const device of devices) {
        try {
          await this.startMonitoring(device.id);
        } catch (error) {
          console.error(`Failed to start monitoring for device ${device.id}:`, error);
        }
      }
      
      console.log(`Started monitoring ${devices.length} devices`);
      
    } catch (error) {
      console.error('Failed to start monitoring all devices:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring all devices
   */
  async stopMonitoringAll(): Promise<void> {
    const deviceIds = Array.from(this.monitoringJobs.keys());
    
    for (const deviceId of deviceIds) {
      await this.stopMonitoring(deviceId);
    }
    
    console.log('Stopped monitoring all devices');
  }

  /**
   * Refresh and start monitoring any new devices
   */
  async refreshDevices(): Promise<void> {
    try {
      const devices = this.getDevicesStmt.all() as any[];
      let newDevicesCount = 0;
      
      for (const device of devices) {
        // Only start monitoring if not already monitoring
        if (!this.monitoringJobs.has(device.id)) {
          try {
            await this.startMonitoring(device.id);
            newDevicesCount++;
          } catch (error) {
            console.error(`Failed to start monitoring for device ${device.id}:`, error);
          }
        }
      }
      
      if (newDevicesCount > 0) {
        console.log(`Started monitoring ${newDevicesCount} new devices`);
      }
      
    } catch (error) {
      console.error('Failed to refresh devices:', error);
      throw error;
    }
  }

  /**
   * Collect metrics from a specific device
   */
  private async collectMetrics(deviceId: string, client: RouterOSClient): Promise<void> {
    try {
      const result = await client.getSystemResource();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get system resource');
      }

      const resource = result.data as SystemResource;
      
      // Parse CPU load percentage
      const cpuLoad = parseFloat(resource['cpu-load'].replace('%', '')) || 0;
      
      // Store metrics in database
      this.insertMetricsStmt.run(
        deviceId,
        cpuLoad,
        resource['free-memory'] || 0,
        resource['total-memory'] || 0,
        resource['free-hdd-space'] || 0,
        resource['total-hdd-space'] || 0,
        resource.uptime || '',
        null, // temperature - RouterOS doesn't always provide this via REST API
        null  // voltage - RouterOS doesn't always provide this via REST API
      );

      // Update device status
      this.updateDeviceStatusStmt.run('connected', new Date().toISOString(), null, deviceId);

      // Emit real-time update event
      const metrics: SystemMetrics = {
        device_id: deviceId,
        cpu_load: cpuLoad,
        free_memory: resource['free-memory'] || 0,
        total_memory: resource['total-memory'] || 0,
        free_hdd_space: resource['free-hdd-space'] || 0,
        total_hdd_space: resource['total-hdd-space'] || 0,
        uptime: resource.uptime || '',
        timestamp: new Date()
      };

      this.emit('metrics-collected', deviceId, metrics);
      
    } catch (error) {
      console.error(`Failed to collect metrics for device ${deviceId}:`, error);
      
      // Update device status to error
      this.updateDeviceStatusStmt.run(
        'error', 
        new Date().toISOString(), 
        error instanceof Error ? error.message : 'Unknown error',
        deviceId
      );
      
      this.emit('metrics-error', deviceId, error);
    }
  }

  /**
   * Collect interface metrics from a specific device
   */
  private async collectInterfaceMetrics(deviceId: string, client: RouterOSClient): Promise<void> {
    try {
      const result = await client.getInterfaces();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get interfaces');
      }

      const interfaces = result.data;
      const now = new Date();

      for (const iface of interfaces) {
        const metrics: InterfaceMetrics = {
          device_id: deviceId,
          interface_name: iface.name,
          interface_type: iface.type,
          status: iface.running === 'true' ? 'running' : (iface.disabled === 'true' ? 'disabled' : 'down'),
          rx_bytes: parseInt(iface['rx-byte'] || '0', 10),
          tx_bytes: parseInt(iface['tx-byte'] || '0', 10),
          rx_packets: parseInt(iface['rx-packet'] || '0', 10),
          tx_packets: parseInt(iface['tx-packet'] || '0', 10),
          rx_errors: parseInt(iface['rx-error'] || '0', 10),
          tx_errors: parseInt(iface['tx-error'] || '0', 10),
          mac_address: iface['mac-address'],
          mtu: parseInt(iface.mtu, 10),
          timestamp: now
        };
        
        this.insertInterfaceMetricsStmt.run(
          metrics.device_id, metrics.interface_name, metrics.interface_type, metrics.status,
          metrics.rx_bytes, metrics.tx_bytes, metrics.rx_packets, metrics.tx_packets,
          metrics.rx_errors, metrics.tx_errors, 0, 0, // rx/tx drops not in getInterfaces
          metrics.mac_address, metrics.mtu, metrics.timestamp.toISOString()
        );
        
        this.emit('interface-metrics-collected', deviceId, metrics);
      }
    } catch (error) {
      console.error(`Failed to collect interface metrics for device ${deviceId}:`, error);
      // We don't emit a separate monitoring error for this, as the system one is enough
    }
  }

  /**
   * Collect connection tracking data from a specific device
   */
  private async collectConnectionTracking(deviceId: string, client: RouterOSClient): Promise<void> {
    try {
      const result = await client.getConnectionTracking();
      
      if (!result.success || !result.data) {
        console.warn(`Connection tracking data not available for device ${deviceId}: ${result.error}`);
        return;
      }

      const connections = result.data;
      const now = new Date();

      // Clear old connection tracking data for this device (keep only last hour)
      this.db.prepare(`
        DELETE FROM connection_tracking 
        WHERE device_id = ? AND collected_at < datetime('now', '-1 hour')
      `).run(deviceId);

      // Store new connection tracking data
      connections.forEach((conn: any) => {
        try {
          this.insertConnectionTrackingStmt.run(
            deviceId,
            conn['src-address'] || null,
            conn['dst-address'] || null,
            parseInt(conn['src-port']) || null,
            parseInt(conn['dst-port']) || null,
            conn.protocol || null,
            conn.state || null,
            conn['tcp-state'] || null,
            conn.connection || null,
            parseInt(conn.timeout) || null,
            parseInt(conn['orig-bytes']) || null,
            parseInt(conn['repl-bytes']) || null,
            parseInt(conn['orig-packets']) || null,
            parseInt(conn['repl-packets']) || null,
            conn['orig-rate'] || null,
            conn['repl-rate'] || null,
            conn.assured === 'true' ? 1 : 0,
            conn['seen-reply'] === 'true' ? 1 : 0,
            now.toISOString()
          );
        } catch (error) {
          console.warn(`Failed to store connection tracking entry for device ${deviceId}:`, error);
        }
      });

      this.emit('connection-tracking-collected', deviceId, connections);
      
    } catch (error) {
      console.error(`Failed to collect connection tracking for device ${deviceId}:`, error);
      // Don't emit error for connection tracking as it's not critical
    }
  }

  /**
   * Get latest metrics for a device
   */
  getLatestMetrics(deviceId: string): SystemMetrics | null {
    try {
      const result = this.getLatestMetricsStmt.get(deviceId) as any;
      return result ? {
        device_id: result.device_id,
        cpu_load: result.cpu_load,
        free_memory: result.free_memory,
        total_memory: result.total_memory,
        free_hdd_space: result.free_hdd_space,
        total_hdd_space: result.total_hdd_space,
        uptime: result.uptime,
        temperature: result.temperature,
        voltage: result.voltage,
        timestamp: new Date(result.timestamp)
      } : null;
    } catch (error) {
      console.error(`Failed to get latest metrics for device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Get historical metrics for a device
   */
  getHistoricalMetrics(deviceId: string, hoursBack: number = 24): SystemMetrics[] {
    try {
      const results = this.getHistoricalMetricsStmt.all(deviceId, hoursBack) as any[];
      return results.map(result => ({
        device_id: result.device_id,
        cpu_load: result.cpu_load,
        free_memory: result.free_memory,
        total_memory: result.total_memory,
        free_hdd_space: result.free_hdd_space,
        total_hdd_space: result.total_hdd_space,
        uptime: result.uptime,
        temperature: result.temperature,
        voltage: result.voltage,
        timestamp: new Date(result.timestamp)
      }));
    } catch (error) {
      console.error(`Failed to get historical metrics for device ${deviceId}:`, error);
      return [];
    }
  }

  /**
   * Get historical interface metrics for a device
   */
  getHistoricalInterfaceMetrics(deviceId: string, hoursBack: number = 24): InterfaceMetrics[] {
    try {
      const rows = this.getHistoricalInterfaceMetricsStmt.all(deviceId, hoursBack) as any[];
      return rows.map(row => ({
        ...row,
        timestamp: new Date(row.timestamp)
      }));
    } catch (error) {
      console.error(`Failed to get historical interface metrics for device ${deviceId}:`, error);
      return [];
    }
  }

  /**
   * Get connection tracking data for a device
   */
  getConnectionTracking(deviceId: string, hoursBack: number = 1): ConnectionTrackingEntry[] {
    try {
      const rows = this.getConnectionTrackingStmt.all(deviceId, hoursBack) as any[];
      return rows.map(row => ({
        ...row,
        assured: row.assured === 1,
        seen_reply: row.seen_reply === 1,
        timestamp: new Date(row.collected_at)
      }));
    } catch (error) {
      console.error(`Failed to get connection tracking for device ${deviceId}:`, error);
      return [];
    }
  }

  /**
   * Get current (live) connection tracking data directly from device
   */
  async getCurrentConnectionTracking(deviceId: string): Promise<any[]> {
    try {
      const client = this.activeConnections.get(deviceId);
      if (!client) {
        throw new Error(`No active connection for device ${deviceId}`);
      }

      const result = await client.getConnectionTracking();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get connection tracking data');
      }

      return result.data;
    } catch (error) {
      console.error(`Failed to get current connection tracking for device ${deviceId}:`, error);
      return [];
    }
  }

  /**
   * Get monitoring status for all devices
   */
  getMonitoringStatus(): { [deviceId: string]: boolean } {
    const status: { [deviceId: string]: boolean } = {};
    
    for (const deviceId of this.monitoringJobs.keys()) {
      status[deviceId] = true;
    }
    
    return status;
  }

  /**
   * Start cleanup job for old data
   */
  private startCleanupJob(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  /**
   * Clean up old monitoring data
   */
  private cleanupOldData(): void {
    try {
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - this.config.retentionDays);
      const retentionTimestamp = retentionDate.toISOString();

      this.db.prepare('DELETE FROM system_metrics WHERE timestamp < ?').run(retentionTimestamp);
      this.db.prepare('DELETE FROM interface_metrics WHERE timestamp < ?').run(retentionTimestamp);
      
      console.log(`Cleaned up data older than ${this.config.retentionDays} days`);
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }

  /**
   * Close monitoring service and cleanup resources
   */
  async close(): Promise<void> {
    await this.stopMonitoringAll();
    this.removeAllListeners();
  }
} 