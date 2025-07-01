/**
 * Network Service
 * 
 * Handles network topology discovery, DHCP lease monitoring, and traffic statistics
 * for RouterOS devices. Provides enhanced network visibility beyond basic monitoring.
 */

import { Database } from 'better-sqlite3';
import { RouterOSClient, NetworkTopology, DHCPLease, ARPEntry, IPAddress } from '../lib/routeros-client';
import { EventEmitter } from 'events';

export interface NetworkNodeInfo {
  mac_address: string;
  ip_address: string;
  hostname?: string;
  interface_name?: string;
  device_type: 'dhcp_client' | 'arp_entry' | 'static_ip' | 'unknown';
  is_online: boolean;
  last_seen: Date;
  vendor?: string;
}

export interface NetworkTopologyData {
  device_id: string;
  nodes: NetworkNodeInfo[];
  interfaces: any[];
  dhcp_leases: any[];
  arp_entries: any[];
  ip_addresses: any[];
  discovery_timestamp: Date;
}

export interface TrafficStatistics {
  interface_name: string;
  rx_bits_per_second: number;
  tx_bits_per_second: number;
  rx_packets_per_second: number;
  tx_packets_per_second: number;
  timestamp: Date;
}

export interface NetworkServiceConfig {
  topologyRefreshInterval: number; // milliseconds
  trafficMonitoringInterval: number; // milliseconds
  retentionDays: number;
}

interface DeviceConfig {
  id: string;
  ip_address: string;
  username: string;
  password: string;
  port?: number;
}

interface ServiceStatus {
  topology: boolean;
  traffic: boolean;
}

// Interface for storing previous traffic measurements for rate calculation
interface PreviousTrafficMeasurement {
  timestamp: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

// Storage for previous measurements by device and interface
interface TrafficMeasurementStore {
  [deviceId: string]: {
    [interfaceName: string]: PreviousTrafficMeasurement;
  };
}

export class NetworkService extends EventEmitter {
  private db: Database;
  private config: NetworkServiceConfig;
  private topologyJobs: Map<string, NodeJS.Timeout> = new Map();
  private trafficJobs: Map<string, NodeJS.Timeout> = new Map();
  private activeConnections: Map<string, RouterOSClient> = new Map();

  // Database statements
  private insertTopologyStmt: any;
  private insertDHCPLeaseStmt: any;
  private insertARPEntryStmt: any;
  private insertTrafficStatsStmt: any;
  private getLatestTopologyStmt: any;
  private getTopologyHistoryStmt: any;
  private getTrafficHistoryStmt: any;
  private cleanupOldDataStmt: any;

  // Store for previous traffic measurements to calculate rates
  private previousMeasurements: TrafficMeasurementStore = {};

  constructor(db: Database, config: NetworkServiceConfig = {
    topologyRefreshInterval: 60000, // 1 minute
    trafficMonitoringInterval: 30000, // 30 seconds  
    retentionDays: 30
  }) {
    super();
    this.db = db;
    this.config = config;
    
    this.initializeDatabase();
    this.prepareStatements();
    this.startCleanupJob();
    this.initializeDefaultSettings();
    
    // Auto-start traffic monitoring for devices with enabled preferences
    // Use setTimeout to ensure all initialization is complete
    setTimeout(() => {
      this.autoStartTrafficMonitoring().catch(error => {
        console.error('Failed to auto-start traffic monitoring on service startup:', error);
      });
    }, 1000);
  }

  /**
   * Initialize database tables for network features
   */
  private initializeDatabase(): void {
    // Network topology snapshots
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS network_topology (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        topology_data TEXT NOT NULL, -- JSON data
        nodes_count INTEGER DEFAULT 0,
        discovery_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);

    // DHCP leases tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dhcp_leases_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        lease_id TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        mac_address TEXT NOT NULL,
        hostname TEXT,
        server_name TEXT,
        expires_after TEXT,
        is_dynamic BOOLEAN DEFAULT true,
        is_active BOOLEAN DEFAULT true,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        UNIQUE(device_id, lease_id)
      )
    `);

    // ARP table tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS arp_entries_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        mac_address TEXT,
        interface_name TEXT NOT NULL,
        is_dynamic BOOLEAN DEFAULT true,
        is_complete BOOLEAN DEFAULT true,
        arp_status TEXT DEFAULT 'unknown',
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        UNIQUE(device_id, ip_address)
      )
    `);

    // Traffic statistics (high-frequency data)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traffic_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        interface_name TEXT NOT NULL,
        rx_bits_per_second INTEGER DEFAULT 0,
        tx_bits_per_second INTEGER DEFAULT 0,
        rx_packets_per_second INTEGER DEFAULT 0,
        tx_packets_per_second INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);

    // User settings table for preferences
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT NOT NULL,
        setting_value TEXT NOT NULL,
        device_id TEXT,
        user_id TEXT DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
        UNIQUE(setting_key, device_id, user_id)
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_network_topology_device_timestamp 
      ON network_topology(device_id, discovery_timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_dhcp_leases_device_ip 
      ON dhcp_leases_history(device_id, ip_address);
      
      CREATE INDEX IF NOT EXISTS idx_arp_entries_device_timestamp 
      ON arp_entries_history(device_id, last_seen);
      
      CREATE INDEX IF NOT EXISTS idx_traffic_stats_device_interface_timestamp 
      ON traffic_statistics(device_id, interface_name, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_user_settings_key_device 
      ON user_settings(setting_key, device_id, user_id);
    `);
  }

  /**
   * Prepare database statements for performance
   */
  private prepareStatements(): void {
    this.insertTopologyStmt = this.db.prepare(`
      INSERT INTO network_topology (device_id, topology_data, nodes_count)
      VALUES (?, ?, ?)
    `);

    this.insertDHCPLeaseStmt = this.db.prepare(`
      INSERT OR REPLACE INTO dhcp_leases_history 
      (device_id, lease_id, ip_address, mac_address, hostname, server_name, expires_after, is_dynamic, is_active, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertARPEntryStmt = this.db.prepare(`
      INSERT OR REPLACE INTO arp_entries_history 
      (device_id, ip_address, mac_address, interface_name, is_dynamic, is_complete, arp_status, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertTrafficStatsStmt = this.db.prepare(`
      INSERT INTO traffic_statistics 
      (device_id, interface_name, rx_bits_per_second, tx_bits_per_second, rx_packets_per_second, tx_packets_per_second)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.getLatestTopologyStmt = this.db.prepare(`
      SELECT * FROM network_topology 
      WHERE device_id = ? 
      ORDER BY discovery_timestamp DESC 
      LIMIT 1
    `);

    this.getTopologyHistoryStmt = this.db.prepare(`
      SELECT * FROM network_topology 
      WHERE device_id = ? 
      AND discovery_timestamp >= datetime('now', '-? hours')
      ORDER BY discovery_timestamp DESC
    `);

    this.getTrafficHistoryStmt = this.db.prepare(`
      SELECT * FROM traffic_statistics 
      WHERE device_id = ? 
      AND timestamp >= datetime('now', '-? hours')
      ORDER BY timestamp ASC
    `);

    this.cleanupOldDataStmt = this.db.prepare(`
      DELETE FROM network_topology 
      WHERE discovery_timestamp < datetime('now', '-? days')
    `);
  }

  /**
   * Start topology discovery for a device
   */
  async startTopologyDiscovery(deviceId: string): Promise<void> {
    try {
      // Check if already discovering
      if (this.topologyJobs.has(deviceId)) {
        console.log(`Already discovering topology for device ${deviceId}`);
        return;
      }

      // Get device information
      const device = this.db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Create RouterOS client
      const client = new RouterOSClient({
        host: device.ip_address,
        port: device.port,
        username: device.username,
        password: device.password,
        useSSL: device.use_ssl,
        timeout: 15000 // Slightly longer timeout for topology discovery
      });

      this.activeConnections.set(deviceId, client);

      // Start topology discovery job
      const job = setInterval(async () => {
        await this.discoverNetworkTopology(deviceId, client);
      }, this.config.topologyRefreshInterval);

      this.topologyJobs.set(deviceId, job);
      
      // Collect initial topology
      await this.discoverNetworkTopology(deviceId, client);
      
      // Auto-start traffic monitoring if enabled for this device
      if (this.shouldAutoStartTrafficMonitoring(deviceId) && !this.trafficJobs.has(deviceId)) {
        try {
          await this.startTrafficMonitoring(deviceId);
          console.log(`Auto-started traffic monitoring for device ${deviceId}`);
        } catch (error) {
          console.error(`Failed to auto-start traffic monitoring for device ${deviceId}:`, error);
        }
      }
      
      console.log(`Started topology discovery for device ${deviceId}`);
      this.emit('topology-discovery-started', deviceId);
      
    } catch (error) {
      console.error(`Failed to start topology discovery for device ${deviceId}:`, error);
      this.emit('topology-discovery-error', deviceId, error);
      throw error;
    }
  }

  /**
   * Stop topology discovery for a device
   */
  async stopTopologyDiscovery(deviceId: string): Promise<void> {
    const job = this.topologyJobs.get(deviceId);
    if (job) {
      clearInterval(job);
      this.topologyJobs.delete(deviceId);
    }

    const client = this.activeConnections.get(deviceId);
    if (client) {
      client.close();
      this.activeConnections.delete(deviceId);
    }

    console.log(`Stopped topology discovery for device ${deviceId}`);
    this.emit('topology-discovery-stopped', deviceId);
  }

  /**
   * Start traffic monitoring for a device
   */
  async startTrafficMonitoring(deviceId: string): Promise<void> {
    try {
      // Check if already monitoring traffic
      if (this.trafficJobs.has(deviceId)) {
        console.log(`Already monitoring traffic for device ${deviceId}`);
        return;
      }

      // Get device information
      const device = this.db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
      if (!device) {
        throw new Error(`Device ${deviceId} not found`);
      }

      // Create RouterOS client if not exists
      let client = this.activeConnections.get(deviceId);
      if (!client) {
        client = new RouterOSClient({
          host: device.ip_address,
          port: device.port,
          username: device.username,
          password: device.password,
          useSSL: device.use_ssl,
          timeout: 10000
        });
        this.activeConnections.set(deviceId, client);
      }

      // Start traffic monitoring job
      const job = setInterval(async () => {
        await this.collectTrafficStatistics(deviceId, client);
      }, this.config.trafficMonitoringInterval);

      this.trafficJobs.set(deviceId, job);
      
      // Initialize previous measurements from database to avoid zero rates after restart
      await this.initializePreviousMeasurements(deviceId);
      
      // Collect initial traffic data
      await this.collectTrafficStatistics(deviceId, client);
      
      console.log(`Started traffic monitoring for device ${deviceId}`);
      this.emit('traffic-monitoring-started', deviceId);
      
    } catch (error) {
      console.error(`Failed to start traffic monitoring for device ${deviceId}:`, error);
      this.emit('traffic-monitoring-error', deviceId, error);
      throw error;
    }
  }

  /**
   * Stop traffic monitoring for a device
   */
  async stopTrafficMonitoring(deviceId: string): Promise<void> {
    const job = this.trafficJobs.get(deviceId);
    if (job) {
      clearInterval(job);
      this.trafficJobs.delete(deviceId);
    }

    console.log(`Stopped traffic monitoring for device ${deviceId}`);
    this.emit('traffic-monitoring-stopped', deviceId);
  }

  /**
   * Collect traffic statistics for a device
   */
  private async collectTrafficStatistics(deviceId: string, client: RouterOSClient): Promise<void> {
    try {
      // Get all interfaces first
      const interfacesResult = await client.getInterfaces();
      if (!interfacesResult.success || !interfacesResult.data) {
        throw new Error(interfacesResult.error || 'Failed to get interfaces');
      }

      const interfaces = interfacesResult.data;
      if (interfaces.length === 0) {
        return; // No interfaces to monitor
      }

      // Monitor traffic on all interfaces
      const trafficResult = await client.monitorTraffic();
      if (!trafficResult.success || !trafficResult.data) {
        throw new Error(trafficResult.error || 'Failed to get traffic data');
      }

      const trafficData = trafficResult.data;

      // Store traffic statistics using rate calculation
      for (const traffic of trafficData) {
        // Extract current byte/packet counters from the interface data
        const currentRxBytes = traffic['rx-byte'] || 0;
        const currentTxBytes = traffic['tx-byte'] || 0;
        const currentRxPackets = traffic['rx-packet'] || 0;
        const currentTxPackets = traffic['tx-packet'] || 0;
        
        // Calculate rates based on previous measurements
        const rates = this.calculateTrafficRates(
          deviceId,
          traffic.name,
          currentRxBytes,
          currentTxBytes,
          currentRxPackets,
          currentTxPackets
        );

        this.insertTrafficStatsStmt.run(
          deviceId,
          traffic.name,
          rates.rxBitsPerSecond,
          rates.txBitsPerSecond,
          rates.rxPacketsPerSecond,
          rates.txPacketsPerSecond
        );
      }

      this.emit('traffic-statistics-collected', deviceId, trafficData);
      
    } catch (error) {
      console.error(`Failed to collect traffic statistics for device ${deviceId}:`, error);
      // TODO: Consider stopping monitoring after repeated failures
      // For now, just log and continue trying
    }
  }

  /**
   * Discover network topology for a device
   */
  private async discoverNetworkTopology(deviceId: string, client: RouterOSClient): Promise<void> {
    try {
      const result = await client.getNetworkTopology();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to get network topology');
      }

      const topology = result.data;
      
      // Process and store DHCP leases
      await this.processDHCPLeases(deviceId, topology.dhcpLeases);
      
      // Process and store ARP entries
      await this.processARPEntries(deviceId, topology.arpTable);
      
      // Create network nodes summary
      const nodes = this.createNetworkNodes(topology);
      
      // Store topology snapshot
      const topologyData: NetworkTopologyData = {
        device_id: deviceId,
        nodes,
        interfaces: topology.interfaces,
        dhcp_leases: topology.dhcpLeases,
        arp_entries: topology.arpTable,
        ip_addresses: topology.ipAddresses,
        discovery_timestamp: new Date()
      };

      this.insertTopologyStmt.run(
        deviceId,
        JSON.stringify(topologyData),
        nodes.length
      );

      this.emit('topology-discovered', deviceId, topologyData);
      
    } catch (error) {
      console.error(`Failed to discover topology for device ${deviceId}:`, error);
      this.emit('topology-discovery-error', deviceId, error);
    }
  }

  /**
   * Process DHCP leases and store in database
   */
  private async processDHCPLeases(deviceId: string, leases: DHCPLease[]): Promise<void> {
    const now = new Date().toISOString();
    
    for (const lease of leases) {
      this.insertDHCPLeaseStmt.run(
        deviceId,
        lease['.id'],
        lease.address,
        lease['mac-address'],
        lease['host-name'] || null,
        lease.server,
        lease['expires-after'] || null,
        lease.dynamic === 'true' ? 1 : 0,
        lease.disabled !== 'true' ? 1 : 0,
        now
      );
    }
  }

  /**
   * Process ARP entries and store in database
   */
  private async processARPEntries(deviceId: string, arpEntries: ARPEntry[]): Promise<void> {
    const now = new Date().toISOString();
    
    for (const entry of arpEntries) {
      // Handle incomplete ARP entries that may not have MAC addresses
      const macAddress = entry['mac-address'] || null;
      const arpStatus = entry.status || (entry.complete === 'true' ? 'complete' : 'unknown');
      
      this.insertARPEntryStmt.run(
        deviceId,
        entry.address,
        macAddress,
        entry.interface,
        entry.dynamic === 'true' ? 1 : 0,
        entry.complete === 'true' ? 1 : 0,
        arpStatus,
        now
      );
    }
  }

  /**
   * Create network nodes from topology data
   */
  private createNetworkNodes(topology: NetworkTopology): NetworkNodeInfo[] {
    const nodes = new Map<string, NetworkNodeInfo>();
    
    // Add DHCP clients
    topology.dhcpLeases.forEach(lease => {
      const key = `${lease.address}-${lease['mac-address']}`;
      nodes.set(key, {
        mac_address: lease['mac-address'],
        ip_address: lease.address,
        hostname: lease['host-name'],
        device_type: 'dhcp_client',
        is_online: lease.disabled !== 'true',
        last_seen: new Date()
      });
    });

    // Add ARP entries (merge with DHCP if exists)
    topology.arpTable.forEach(entry => {
      // Skip incomplete ARP entries without MAC addresses
      if (!entry['mac-address']) {
        return;
      }
      
      const key = `${entry.address}-${entry['mac-address']}`;
      const existing = nodes.get(key);
      
      if (existing) {
        existing.interface_name = entry.interface;
        existing.is_online = entry.complete === 'true';
      } else {
        nodes.set(key, {
          mac_address: entry['mac-address'],
          ip_address: entry.address,
          interface_name: entry.interface,
          device_type: 'arp_entry',
          is_online: entry.complete === 'true',
          last_seen: new Date()
        });
      }
    });

    return Array.from(nodes.values());
  }

  /**
   * Get latest network topology for a device
   */
  async getLatestTopology(deviceId: string): Promise<NetworkTopologyData | null> {
    const result = this.getLatestTopologyStmt.get(deviceId);
    if (!result) return null;

    return {
      ...JSON.parse(result.topology_data),
      discovery_timestamp: new Date(result.discovery_timestamp)
    };
  }

  /**
   * Get DHCP leases for a device
   */
  async getDHCPLeases(deviceId: string, hours: number = 24): Promise<any[]> {
    return this.db.prepare(`
      SELECT * FROM dhcp_leases_history 
      WHERE device_id = ? 
      AND last_seen >= datetime('now', '-' || ? || ' hours')
      ORDER BY last_seen DESC
    `).all(deviceId, hours);
  }

  /**
   * Get ARP entries for a device
   */
  async getARPEntries(deviceId: string, hours: number = 24): Promise<any[]> {
    return this.db.prepare(`
      SELECT * FROM arp_entries_history 
      WHERE device_id = ? 
      AND last_seen >= datetime('now', '-' || ? || ' hours')
      ORDER BY last_seen DESC
    `).all(deviceId, hours);
  }

  /**
   * Start cleanup job for old data
   */
  private startCleanupJob(): void {
    setInterval(() => {
      try {
        // Clean up old topology data
        this.cleanupOldDataStmt.run(this.config.retentionDays);
        
        // Clean up old traffic statistics (keep only 7 days)
        this.db.prepare(`
          DELETE FROM traffic_statistics 
          WHERE timestamp < datetime('now', '-7 days')
        `).run();
        
        console.log('Network service cleanup completed');
      } catch (error) {
        console.error('Network service cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run daily
  }

  /**
   * Get service status
   */
  getServiceStatus(): { [deviceId: string]: { topology: boolean; traffic: boolean } } {
    const status: { [deviceId: string]: { topology: boolean; traffic: boolean } } = {};
    
    // Get unique device IDs from both topology and traffic jobs
    const allDeviceIds = new Set([
      ...this.topologyJobs.keys(),
      ...this.trafficJobs.keys()
    ]);
    
    for (const deviceId of allDeviceIds) {
      status[deviceId] = {
        topology: this.topologyJobs.has(deviceId),
        traffic: this.trafficJobs.has(deviceId)
      };
    }
    
    return status;
  }

  /**
   * Get traffic statistics for a device
   */
  async getTrafficStatistics(deviceId: string, hours: number = 1): Promise<any[]> {
    return this.getTrafficHistoryStmt.all(deviceId, hours);
  }

  /**
   * Clean up all jobs and connections
   */
  async cleanup(): Promise<void> {
    // Stop all topology jobs
    for (const [deviceId] of this.topologyJobs) {
      await this.stopTopologyDiscovery(deviceId);
    }
    
    // Stop all traffic jobs
    for (const [deviceId, job] of this.trafficJobs) {
      clearInterval(job);
    }
    this.trafficJobs.clear();
    
    // Close all connections
    for (const [deviceId, client] of this.activeConnections) {
      client.close();
    }
    this.activeConnections.clear();
    
    console.log('Network service cleanup completed');
  }

  /**
   * Initialize previous measurements from database to avoid zero rates after restart
   */
  private async initializePreviousMeasurements(deviceId: string): Promise<void> {
    try {
      // Get the most recent traffic measurement for each interface
      const recentMeasurements = this.db.prepare(`
        SELECT 
          interface_name,
          timestamp,
          rx_bits_per_second,
          tx_bits_per_second,
          rx_packets_per_second,
          tx_packets_per_second
        FROM traffic_statistics 
        WHERE device_id = ? 
        AND timestamp >= datetime('now', '-1 hour')
        ORDER BY timestamp DESC
      `).all(deviceId) as any[];

      if (recentMeasurements.length === 0) {
        return; // No recent data to initialize from
      }

      // Get current interface counters to use as baseline
      const client = this.activeConnections.get(deviceId);
      if (!client) {
        return;
      }

      const trafficResult = await client.monitorTraffic();
      if (!trafficResult.success || !trafficResult.data) {
        return;
      }

      // Initialize device storage if it doesn't exist
      if (!this.previousMeasurements[deviceId]) {
        this.previousMeasurements[deviceId] = {};
      }

      // For each interface, use current counters as the baseline
      for (const traffic of trafficResult.data) {
        const interfaceName = traffic.name;
        const currentRxBytes = traffic['rx-byte'] || 0;
        const currentTxBytes = traffic['tx-byte'] || 0;
        const currentRxPackets = traffic['rx-packet'] || 0;
        const currentTxPackets = traffic['tx-packet'] || 0;

        // Store current counters as previous measurement
        this.previousMeasurements[deviceId][interfaceName] = {
          timestamp: Date.now(),
          rxBytes: currentRxBytes,
          txBytes: currentTxBytes,
          rxPackets: currentRxPackets,
          txPackets: currentTxPackets
        };
      }

      console.log(`Initialized previous measurements for device ${deviceId} with ${trafficResult.data.length} interfaces`);
    } catch (error) {
      console.error(`Failed to initialize previous measurements for device ${deviceId}:`, error);
      // Continue without initialization - will just have zero rates for first measurement
    }
  }

  /**
   * Calculate traffic rates based on previous measurements
   */
  private calculateTrafficRates(
    deviceId: string, 
    interfaceName: string, 
    currentRxBytes: number, 
    currentTxBytes: number,
    currentRxPackets: number,
    currentTxPackets: number
  ): {
    rxBitsPerSecond: number;
    txBitsPerSecond: number;
    rxPacketsPerSecond: number;
    txPacketsPerSecond: number;
  } {
    const currentTime = Date.now();
    
    // Initialize device storage if it doesn't exist
    if (!this.previousMeasurements[deviceId]) {
      this.previousMeasurements[deviceId] = {};
    }
    
    const previous = this.previousMeasurements[deviceId][interfaceName];
    
    let rxBitsPerSecond = 0;
    let txBitsPerSecond = 0;
    let rxPacketsPerSecond = 0;
    let txPacketsPerSecond = 0;
    
    if (previous) {
      const timeDiffSeconds = (currentTime - previous.timestamp) / 1000;
      
      if (timeDiffSeconds > 0) {
        // Calculate byte differences (handle counter wraps)
        const rxByteDiff = currentRxBytes >= previous.rxBytes ? 
          currentRxBytes - previous.rxBytes : 
          currentRxBytes; // Simple wrap handling
          
        const txByteDiff = currentTxBytes >= previous.txBytes ? 
          currentTxBytes - previous.txBytes : 
          currentTxBytes; // Simple wrap handling
          
        const rxPacketDiff = currentRxPackets >= previous.rxPackets ? 
          currentRxPackets - previous.rxPackets : 
          currentRxPackets; // Simple wrap handling
          
        const txPacketDiff = currentTxPackets >= previous.txPackets ? 
          currentTxPackets - previous.txPackets : 
          currentTxPackets; // Simple wrap handling
        
        // Calculate rates (bytes to bits conversion: multiply by 8)
        rxBitsPerSecond = Math.round((rxByteDiff * 8) / timeDiffSeconds);
        txBitsPerSecond = Math.round((txByteDiff * 8) / timeDiffSeconds);
        rxPacketsPerSecond = Math.round(rxPacketDiff / timeDiffSeconds);
        txPacketsPerSecond = Math.round(txPacketDiff / timeDiffSeconds);
      }
    }
    
    // Store current measurement for next calculation
    this.previousMeasurements[deviceId][interfaceName] = {
      timestamp: currentTime,
      rxBytes: currentRxBytes,
      txBytes: currentTxBytes,
      rxPackets: currentRxPackets,
      txPackets: currentTxPackets
    };
    
    return {
      rxBitsPerSecond,
      txBitsPerSecond,
      rxPacketsPerSecond,
      txPacketsPerSecond
    };
  }

  /**
   * Initialize default settings
   */
  private initializeDefaultSettings(): void {
    try {
      // Set default traffic monitoring to enabled globally
      const existingGlobalSetting = this.db.prepare(`
        SELECT * FROM user_settings 
        WHERE setting_key = 'traffic_monitoring_default' 
        AND device_id IS NULL 
        AND user_id = 'default'
      `).get();

      if (!existingGlobalSetting) {
        this.db.prepare(`
          INSERT INTO user_settings (setting_key, setting_value, device_id, user_id)
          VALUES (?, ?, NULL, 'default')
        `).run('traffic_monitoring_default', 'true');
        console.log('Initialized default traffic monitoring setting to enabled');
      }
    } catch (error) {
      console.error('Failed to initialize default settings:', error);
    }
  }

  /**
   * Get user setting
   */
  getUserSetting(settingKey: string, deviceId?: string, userId: string = 'default'): string | null {
    try {
      const result = this.db.prepare(`
        SELECT setting_value FROM user_settings 
        WHERE setting_key = ? AND device_id ${deviceId ? '= ?' : 'IS NULL'} AND user_id = ?
      `).get(settingKey, ...(deviceId ? [deviceId, userId] : [userId])) as { setting_value: string } | undefined;
      
      return result ? result.setting_value : null;
    } catch (error) {
      console.error('Failed to get user setting:', error);
      return null;
    }
  }

  /**
   * Set user setting
   */
  setUserSetting(settingKey: string, settingValue: string, deviceId?: string, userId: string = 'default'): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO user_settings (setting_key, setting_value, device_id, user_id, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(settingKey, settingValue, deviceId || null, userId);
    } catch (error) {
      console.error('Failed to set user setting:', error);
      throw error;
    }
  }

  /**
   * Check if traffic monitoring should be enabled by default for a device
   */
  shouldAutoStartTrafficMonitoring(deviceId: string): boolean {
    // Check device-specific setting first
    const deviceSetting = this.getUserSetting('traffic_monitoring_enabled', deviceId);
    if (deviceSetting !== null) {
      return deviceSetting === 'true';
    }

    // Fall back to global default
    const globalDefault = this.getUserSetting('traffic_monitoring_default');
    return globalDefault === 'true';
  }

  /**
   * Auto-start traffic monitoring for devices based on user preferences
   */
  async autoStartTrafficMonitoring(): Promise<void> {
    try {
      // Get all connected devices
      const devices = this.db.prepare(`
        SELECT id FROM devices WHERE status = 'connected'
      `).all() as { id: string }[];

      for (const device of devices) {
        if (this.shouldAutoStartTrafficMonitoring(device.id) && !this.trafficJobs.has(device.id)) {
          try {
            await this.startTrafficMonitoring(device.id);
            console.log(`Auto-started traffic monitoring for device ${device.id}`);
          } catch (error) {
            console.error(`Failed to auto-start traffic monitoring for device ${device.id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to auto-start traffic monitoring:', error);
    }
  }
} 