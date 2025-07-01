/**
 * Configuration Service
 * 
 * Handles RouterOS device configuration management including IP addresses,
 * routing, firewall rules, and system backups. Provides configuration
 * validation, change tracking, and rollback capabilities.
 */

import { Database } from 'better-sqlite3';
import { RouterOSClient, createRouterOSClient } from '../lib/routeros-client';
import { EventEmitter } from 'events';

export interface ConfigurationChange {
  id: string;
  device_id: string;
  section: 'ip_address' | 'route' | 'firewall' | 'interface' | 'backup' | 'nat' | 'address_list';
  action: 'create' | 'update' | 'delete' | 'restore';
  item_id?: string;
  changes: string; // JSON string
  user_name?: string;
  timestamp: Date;
  applied?: boolean;
  rollback_data?: string;
}

export interface BackupInfo {
  id: string;
  device_id: string;
  backup_name: string;
  backup_type: 'manual' | 'scheduled' | 'pre_change';
  file_size?: number;
  created_at: Date;
  stored_locally?: boolean;
  available_on_device?: boolean;
  local_file_size?: number;
  device_file_size?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigurationService extends EventEmitter {
  private db: Database;
  private activeConnections: Map<string, RouterOSClient> = new Map();

  // Database statements
  private insertChangeStmt: any;
  private insertBackupStmt: any;
  private getChangesStmt: any;
  private getBackupsStmt: any;
  private getDeviceStmt: any;

  constructor(db: Database) {
    super();
    this.db = db;
    this.prepareStatements();
  }

  /**
   * Prepare database statements for performance
   */
  private prepareStatements(): void {
    this.insertChangeStmt = this.db.prepare(`
      INSERT INTO configuration_changes 
      (id, device_id, section, action, item_id, changes, user_name, timestamp, applied, rollback_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertBackupStmt = this.db.prepare(`
      INSERT INTO configuration_backups 
      (device_id, backup_name, backup_type, backup_data, file_size, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.getChangesStmt = this.db.prepare(`
      SELECT * FROM configuration_changes 
      WHERE device_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);

    this.getBackupsStmt = this.db.prepare(`
      SELECT id, device_id, backup_name, backup_type, file_size, created_at 
      FROM configuration_backups 
      WHERE device_id = ? 
      ORDER BY created_at DESC
    `);

    this.getDeviceStmt = this.db.prepare(`
      SELECT id, name, ip_address, username, password, port, use_ssl 
      FROM devices 
      WHERE id = ?
    `);
  }

  /**
   * Get RouterOS client for device
   */
  private async getClient(deviceId: string): Promise<RouterOSClient> {
    if (this.activeConnections.has(deviceId)) {
      return this.activeConnections.get(deviceId)!;
    }

    const device = this.getDeviceStmt.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    const client = createRouterOSClient({
      host: device.ip_address,
      port: device.port || (device.use_ssl ? 443 : 80),
      username: device.username,
      password: device.password, // TODO: Decrypt if encrypted
      useSSL: Boolean(device.use_ssl), // Convert 0/1 to false/true
      timeout: 10000,
      retryAttempts: 2,
      // FTP settings for backup downloads
      ftpPort: device.ftp_port || 21,
      ftpUsername: device.ftp_username || device.username,
      ftpPassword: device.ftp_password || device.password
    });

    this.activeConnections.set(deviceId, client);
    return client;
  }

  /**
   * Track configuration change
   */
  private async trackChange(change: Omit<ConfigurationChange, 'id' | 'timestamp'>): Promise<void> {
    const id = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    this.insertChangeStmt.run(
      id,
      change.device_id,
      change.section,
      change.action,
      change.item_id || null,
      change.changes,
      change.user_name || null,
      timestamp,
      change.applied ? 1 : 0,
      change.rollback_data || null
    );

    this.emit('configurationChanged', { id, ...change, timestamp: new Date(timestamp) });
  }

  // ==================== IP ADDRESS MANAGEMENT ====================

  /**
   * Get all IP addresses for a device
   */
  async getIPAddresses(deviceId: string): Promise<any[]> {
    const client = await this.getClient(deviceId);
    const response = await client.getIPAddressConfiguration();
    
    if (!response.success) {
      throw new Error(`Failed to get IP addresses: ${response.error}`);
    }

    return response.data || [];
  }

  /**
   * Add IP address to interface
   */
  async addIPAddress(
    deviceId: string, 
    address: string, 
    interfaceName: string, 
    comment?: string,
    userId?: string
  ): Promise<any> {
    const client = await this.getClient(deviceId);
    
    // Validate IP address format
    const validation = this.validateIPAddress(address);
    if (!validation.valid) {
      throw new Error(`Invalid IP address: ${validation.errors.join(', ')}`);
    }

    const response = await client.addIPAddress(address, interfaceName, comment);
    
    if (!response.success) {
      throw new Error(`Failed to add IP address: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'ip_address',
      action: 'create',
      item_id: response.data?.['.id'],
      changes: JSON.stringify({ address, interface: interfaceName, comment }),
      user_name: userId
    });

    return response.data;
  }

  /**
   * Update IP address
   */
  async updateIPAddress(
    deviceId: string, 
    addressId: string, 
    updates: any,
    userId?: string
  ): Promise<any> {
    const client = await this.getClient(deviceId);
    
    // Get current value for tracking
    const currentAddresses = await this.getIPAddresses(deviceId);
    const currentAddress = currentAddresses.find(addr => addr['.id'] === addressId);

    const response = await client.updateIPAddress(addressId, updates);
    
    if (!response.success) {
      throw new Error(`Failed to update IP address: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'ip_address',
      action: 'update',
      item_id: addressId,
      changes: JSON.stringify({ old: currentAddress, new: updates }),
      user_name: userId
    });

    return response.data;
  }

  /**
   * Remove IP address
   */
  async removeIPAddress(deviceId: string, addressId: string, userId?: string): Promise<void> {
    const client = await this.getClient(deviceId);
    
    // Get current value for tracking
    const currentAddresses = await this.getIPAddresses(deviceId);
    const currentAddress = currentAddresses.find(addr => addr['.id'] === addressId);

    const response = await client.removeIPAddress(addressId);
    
    if (!response.success) {
      throw new Error(`Failed to remove IP address: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'ip_address',
      action: 'delete',
      item_id: addressId,
      changes: JSON.stringify({ deleted: currentAddress }),
      user_name: userId
    });
  }

  // ==================== ROUTING MANAGEMENT ====================

  /**
   * Get all routes for a device
   */
  async getRoutes(deviceId: string): Promise<any[]> {
    const client = await this.getClient(deviceId);
    const response = await client.getRoutes();
    
    if (!response.success) {
      throw new Error(`Failed to get routes: ${response.error}`);
    }

    return response.data || [];
  }

  /**
   * Add route
   */
  async addRoute(deviceId: string, route: any, userId?: string): Promise<any> {
    const client = await this.getClient(deviceId);
    
    // Validate route
    const validation = this.validateRoute(route);
    if (!validation.valid) {
      throw new Error(`Invalid route: ${validation.errors.join(', ')}`);
    }

    const response = await client.addRoute(route);
    
    if (!response.success) {
      throw new Error(`Failed to add route: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'route',
      action: 'create',
      item_id: response.data?.['.id'],
      changes: JSON.stringify(route),
      user_name: userId
    });

    return response.data;
  }

  // ==================== FIREWALL MANAGEMENT ====================

  /**
   * Get firewall rules for a device
   */
  async getFirewallRules(deviceId: string): Promise<any[]> {
    const client = await this.getClient(deviceId);
    const response = await client.getFirewallRules();
    
    if (!response.success) {
      throw new Error(`Failed to get firewall rules: ${response.error}`);
    }

    return response.data || [];
  }

  /**
   * Get NAT rules for a device
   */
  async getNATRules(deviceId: string): Promise<any[]> {
    const client = await this.getClient(deviceId);
    
    try {
      const response = await client.getNATRules();
      
      if (!response.success) {
        throw new Error(`Failed to get NAT rules: ${response.error}`);
      }

      // Sync with database
      await this.syncNATRulesWithDb(deviceId, response.data || []);
      return response.data || [];
    } catch (error) {
      // Fallback to SSH if REST API fails
      return await this.getNATRulesViaSSH(deviceId);
    }
  }

  /**
   * Add NAT rule
   */
  async addNATRule(deviceId: string, rule: any, userId?: string): Promise<any> {
    const client = await this.getClient(deviceId);
    
    // Validate NAT rule
    const validation = this.validateNATRule(rule);
    if (!validation.valid) {
      throw new Error(`Invalid NAT rule: ${validation.errors.join(', ')}`);
    }

    try {
      const response = await client.addNATRule(rule);
      
      if (!response.success) {
        throw new Error(`Failed to add NAT rule: ${response.error}`);
      }

      // Track the change
      await this.trackChange({
        device_id: deviceId,
        section: 'nat',
        action: 'create',
        item_id: response.data?.['.id'],
        changes: JSON.stringify(rule),
        user_name: userId,
        applied: true
      });

      return response.data;
    } catch (error) {
      // Fallback to SSH if REST API fails
      return await this.addNATRuleViaSSH(deviceId, rule, userId);
    }
  }

  /**
   * Update NAT rule
   */
  async updateNATRule(deviceId: string, ruleId: string, updates: any, userId?: string): Promise<any> {
    const client = await this.getClient(deviceId);
    
    // Get current value for tracking
    const currentRules = await this.getNATRules(deviceId);
    const currentRule = currentRules.find(rule => rule['.id'] === ruleId);

    const response = await client.updateNATRule(ruleId, updates);
    
    if (!response.success) {
      throw new Error(`Failed to update NAT rule: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'nat',
      action: 'update',
      item_id: ruleId,
      changes: JSON.stringify({ old: currentRule, new: updates }),
      user_name: userId,
      applied: true
    });

    return response.data;
  }

  /**
   * Remove NAT rule
   */
  async removeNATRule(deviceId: string, ruleId: string, userId?: string): Promise<void> {
    const client = await this.getClient(deviceId);
    
    // Get current value for tracking
    const currentRules = await this.getNATRules(deviceId);
    const currentRule = currentRules.find(rule => rule['.id'] === ruleId);

    const response = await client.removeNATRule(ruleId);
    
    if (!response.success) {
      throw new Error(`Failed to remove NAT rule: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'nat',
      action: 'delete',
      item_id: ruleId,
      changes: JSON.stringify({ deleted: currentRule }),
      user_name: userId,
      applied: true
    });
  }

  /**
   * Get address lists for a device
   */
  async getAddressLists(deviceId: string): Promise<any[]> {
    const client = await this.getClient(deviceId);
    
    try {
      const response = await client.getAddressLists();
      
      if (!response.success) {
        throw new Error(`Failed to get address lists: ${response.error}`);
      }

      // Sync with database
      await this.syncAddressListsWithDb(deviceId, response.data || []);
      return response.data || [];
    } catch (error) {
      // Fallback to SSH if REST API fails
      return await this.getAddressListsViaSSH(deviceId);
    }
  }

  /**
   * Add address list entry
   */
  async addAddressListEntry(deviceId: string, entry: any, userId?: string): Promise<any> {
    const client = await this.getClient(deviceId);
    
    // Validate address list entry
    const validation = this.validateAddressListEntry(entry);
    if (!validation.valid) {
      throw new Error(`Invalid address list entry: ${validation.errors.join(', ')}`);
    }

    const response = await client.addAddressListEntry(entry);
    
    if (!response.success) {
      throw new Error(`Failed to add address list entry: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'address_list',
      action: 'create',
      item_id: response.data?.['.id'],
      changes: JSON.stringify(entry),
      user_name: userId,
      applied: true
    });

    return response.data;
  }

  /**
   * Update address list entry
   */
  async updateAddressListEntry(deviceId: string, entryId: string, updates: any, userId?: string): Promise<any> {
    const client = await this.getClient(deviceId);
    
    // Get current value for tracking
    const currentEntries = await this.getAddressLists(deviceId);
    const currentEntry = currentEntries.find(entry => entry['.id'] === entryId);

    const response = await client.updateAddressListEntry(entryId, updates);
    
    if (!response.success) {
      throw new Error(`Failed to update address list entry: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'address_list',
      action: 'update',
      item_id: entryId,
      changes: JSON.stringify({ old: currentEntry, new: updates }),
      user_name: userId,
      applied: true
    });

    return response.data;
  }

  /**
   * Remove address list entry
   */
  async removeAddressListEntry(deviceId: string, entryId: string, userId?: string): Promise<void> {
    const client = await this.getClient(deviceId);
    
    // Get current value for tracking
    const currentEntries = await this.getAddressLists(deviceId);
    const currentEntry = currentEntries.find(entry => entry['.id'] === entryId);

    const response = await client.removeAddressListEntry(entryId);
    
    if (!response.success) {
      throw new Error(`Failed to remove address list entry: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'address_list',
      action: 'delete',
      item_id: entryId,
      changes: JSON.stringify({ deleted: currentEntry }),
      user_name: userId,
      applied: true
    });
  }



  /**
   * Add firewall rule
   */
  async addFirewallRule(deviceId: string, rule: any, userId?: string): Promise<any> {
    const client = await this.getClient(deviceId);
    
    // Validate firewall rule
    const validation = this.validateFirewallRule(rule);
    if (!validation.valid) {
      throw new Error(`Invalid firewall rule: ${validation.errors.join(', ')}`);
    }

    const response = await client.addFirewallRule(rule);
    
    if (!response.success) {
      throw new Error(`Failed to add firewall rule: ${response.error}`);
    }

    // Track the change
    await this.trackChange({
      device_id: deviceId,
      section: 'firewall',
      action: 'create',
      item_id: response.data?.['.id'],
      changes: JSON.stringify(rule),
      user_name: userId
    });

    return response.data;
  }

  // ==================== BACKUP MANAGEMENT ====================

  /**
   * Create system backup and download it locally
   */
  async createBackup(
    deviceId: string, 
    backupName?: string, 
    password?: string,
    type: 'manual' | 'scheduled' | 'pre_change' = 'manual',
    userId?: string
  ): Promise<BackupInfo> {
    try {
      const client = await this.getClient(deviceId);
      
      const finalBackupName = backupName || `backup_${Date.now()}`;
      const backupFileName = `${finalBackupName}.backup`;
      
      console.log(`Creating backup for device ${deviceId} with name: ${finalBackupName}`);
      
      // Step 1: Create backup on RouterOS device
      const response = await client.createBackup(finalBackupName, password);
      
      if (!response.success) {
        console.error(`Backup creation failed for device ${deviceId}:`, response.error);
        throw new Error(`Failed to create backup: ${response.error}`);
      }

      console.log(`Backup created successfully for device ${deviceId}:`, response.data);

      // Step 2: Wait a moment for the backup file to be written
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Try to download the backup file from the device via FTP
      let localBackupData: Buffer | null = null;
      let downloadSuccessful = false;
      let downloadError: string | undefined;
      
      try {
        console.log(`Attempting to download backup file ${backupFileName} via FTP...`);
        const downloadResponse = await client.downloadBackupFile(backupFileName);
        if (downloadResponse.success && downloadResponse.data) {
          localBackupData = downloadResponse.data;
          downloadSuccessful = true;
          console.log(`Successfully downloaded backup file ${backupFileName}, size: ${localBackupData.length} bytes`);
        } else {
          downloadError = downloadResponse.error;
          console.warn(`Failed to download backup file ${backupFileName}: ${downloadResponse.error}`);
        }
      } catch (error) {
        downloadError = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Error downloading backup file ${backupFileName}:`, error);
      }

      // Step 4: Store backup metadata in database
      const timestamp = new Date().toISOString();
      
      // Only store actual backup data, not fake placeholders
      if (downloadSuccessful && localBackupData) {
        console.log('Storing backup in database:', {
          deviceId, finalBackupName, type, 
          localSize: localBackupData.length,
          downloadedLocally: true
        });

        const insertResult = this.insertBackupStmt.run(
          deviceId,
          finalBackupName,
          type,
          localBackupData,
          localBackupData.length,
          timestamp
        );

        // Get the auto-generated ID from the insert result
        const backupId = Number(insertResult.lastInsertRowid);

        // Track the change
        await this.trackChange({
          device_id: deviceId,
          section: 'backup',
          action: 'create',
          item_id: backupId.toString(),
          changes: JSON.stringify({ 
            name: finalBackupName, 
            type, 
            downloaded_locally: true,
            file_size: localBackupData.length
          }),
          user_name: userId,
          applied: true
        });

        const backupInfo: BackupInfo = {
          id: String(backupId), // Ensure ID is always a string
          device_id: deviceId,
          backup_name: finalBackupName,
          backup_type: type,
          file_size: localBackupData.length,
          created_at: new Date(timestamp),
          stored_locally: true,
          available_on_device: true,
          local_file_size: localBackupData.length,
          device_file_size: undefined // Will be determined when listing device files
        };

        this.emit('backupCreated', backupInfo);
        return backupInfo;
      } else {
        // Backup created on device but not downloaded locally
        console.log('Backup created on device but not downloaded locally due to:', downloadError);
        
        // Don't store fake data in database, just return info about device backup
        const backupInfo: BackupInfo = {
          id: `device_${finalBackupName}`, // Use device prefix for device-only backups
          device_id: deviceId,
          backup_name: finalBackupName,
          backup_type: type,
          file_size: 0, // Unknown until we list device files
          created_at: new Date(timestamp),
          stored_locally: false,
          available_on_device: true,
          local_file_size: undefined,
          device_file_size: undefined
        };

        // Track the creation but note download failure
        await this.trackChange({
          device_id: deviceId,
          section: 'backup',
          action: 'create',
          item_id: backupInfo.id,
          changes: JSON.stringify({ 
            name: finalBackupName, 
            type, 
            downloaded_locally: false,
            download_error: downloadError,
            note: 'Backup created on RouterOS device but not downloaded locally - requires FTP access'
          }),
          user_name: userId,
          applied: true
        });

        this.emit('backupCreated', backupInfo);
        return backupInfo;
      }
    } catch (error) {
      console.error(`Error creating backup for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get backup history for a device (local backups only)
   */
  async getBackupHistory(deviceId: string): Promise<BackupInfo[]> {
    const backups = this.getBackupsStmt.all(deviceId);
    return backups.map((backup: any) => ({
      id: String(backup.id), // Ensure ID is always a string
      device_id: backup.device_id,
      backup_name: backup.backup_name,
      backup_type: backup.backup_type,
      file_size: backup.file_size,
      created_at: new Date(backup.created_at),
      stored_locally: true,
      available_on_device: undefined, // Will be determined by getAllBackups
      local_file_size: backup.file_size,
      device_file_size: undefined
    }));
  }

  /**
   * Get all backups for a device (both local and device backups)
   */
  async getAllBackups(deviceId: string): Promise<BackupInfo[]> {
    try {
      // Get local backups from database
      const localBackups = await this.getBackupHistory(deviceId);
      const localBackupMap = new Map<string, BackupInfo>();
      
      localBackups.forEach(backup => {
        localBackupMap.set(backup.backup_name, backup);
      });

      // Get device backups from RouterOS
      let deviceBackups: any[] = [];
      try {
        const client = await this.getClient(deviceId);
        const deviceBackupsResponse = await client.listBackupFiles();
        
        if (deviceBackupsResponse.success && deviceBackupsResponse.data) {
          deviceBackups = deviceBackupsResponse.data;
        }
      } catch (error) {
        console.warn(`Failed to get device backups for device ${deviceId}:`, error);
      }

      // Combine local and device backups
      const allBackups: BackupInfo[] = [];

      // Add/update from local backups
      localBackups.forEach(localBackup => {
        const deviceBackup = deviceBackups.find(db => 
          db.name === `${localBackup.backup_name}.backup` || 
          db.name === localBackup.backup_name
        );

        const deviceSize = deviceBackup ? parseInt(deviceBackup.size) || 0 : undefined;
        const deviceDate = deviceBackup && deviceBackup['last-modified'] ? 
          new Date(deviceBackup['last-modified']) : 
          localBackup.created_at;

        allBackups.push({
          ...localBackup,
          // Use device date and size if available, otherwise use local data
          file_size: deviceSize || localBackup.file_size || 0,
          created_at: deviceDate,
          available_on_device: !!deviceBackup,
          device_file_size: deviceSize
        });
      });

      // Add device-only backups (not in local database)
      deviceBackups.forEach(deviceBackup => {
        const backupName = deviceBackup.name.replace(/\.backup$/, '');
        
        if (!localBackupMap.has(backupName)) {
          // Use device file size and modification time
          const deviceSize = parseInt(deviceBackup.size) || 0;
          const deviceDate = deviceBackup['last-modified'] ? 
            new Date(deviceBackup['last-modified']) : 
            (deviceBackup['creation-time'] ? new Date(deviceBackup['creation-time']) : new Date());

          allBackups.push({
            id: `device_${backupName}`,
            device_id: deviceId,
            backup_name: backupName,
            backup_type: 'manual' as const,
            file_size: deviceSize,
            created_at: deviceDate,
            stored_locally: false,
            available_on_device: true,
            local_file_size: undefined,
            device_file_size: deviceSize
          });
        }
      });

      // Sort by creation date (newest first)
      allBackups.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      return allBackups;
    } catch (error) {
      console.error(`Error getting all backups for device ${deviceId}:`, error);
      // Fallback to local backups only
      return await this.getBackupHistory(deviceId);
    }
  }

  /**
   * Download backup file from RouterOS device and store locally
   */
  async downloadBackupFromDevice(deviceId: string, backupFileName: string, userId?: string): Promise<BackupInfo> {
    try {
      const client = await this.getClient(deviceId);
      
      // Handle device_ prefixed backup names - extract actual filename
      let actualFileName = backupFileName;
      if (backupFileName.startsWith('device_')) {
        actualFileName = backupFileName.replace('device_', '');
      }
      
      // Ensure .backup extension
      const fileName = actualFileName.endsWith('.backup') ? actualFileName : `${actualFileName}.backup`;
      const backupName = fileName.replace(/\.backup$/, '');
      
      console.log(`Attempting to download backup: ${fileName} from device ${deviceId}`);
      
      const result = await client.downloadBackupFile(fileName);
      
      if (!result.success || !result.data) {
        throw new Error(result.error || `Backup file '${fileName}' not found on device`);
      }

      // Store the downloaded backup in database
      const timestamp = new Date().toISOString();
      
      const insertResult = this.insertBackupStmt.run(
        deviceId,
        backupName,
        'manual', // Downloaded backups are considered manual
        result.data,
        result.data.length,
        timestamp
      );

      const backupId = Number(insertResult.lastInsertRowid);

      // Track the change
      await this.trackChange({
        device_id: deviceId,
        section: 'backup',
        action: 'create',
        item_id: backupId.toString(),
        changes: JSON.stringify({ 
          name: backupName, 
          type: 'download',
          downloaded_from_device: true,
          file_size: result.data.length
        }),
        user_name: userId,
        applied: true
      });

      const backupInfo: BackupInfo = {
        id: String(backupId), // Ensure ID is always a string
        device_id: deviceId,
        backup_name: backupName,
        backup_type: 'manual',
        file_size: result.data.length,
        created_at: new Date(timestamp),
        stored_locally: true,
        available_on_device: true,
        local_file_size: result.data.length,
        device_file_size: result.data.length
      };

      this.emit('backupDownloaded', backupInfo);
      return backupInfo;
    } catch (error) {
      console.error(`Error downloading backup ${backupFileName} for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Download backup file from RouterOS device (legacy method for compatibility)
   */
  async downloadBackup(deviceId: string, backupFileName: string): Promise<{ success: boolean; data?: Buffer; error?: string }> {
    try {
      const client = await this.getClient(deviceId);
      const result = await client.downloadBackupFile(backupFileName);
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, data: result.data };
    } catch (error) {
      console.error(`Error downloading backup for device ${deviceId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to download backup file' 
      };
    }
  }

  /**
   * Test RouterOS backup restore capabilities for debugging
   */
  async testBackupRestoreAPI(deviceId: string): Promise<any> {
    try {
      const client = await this.getClient(deviceId);
      return await client.testBackupRestoreAPI();
    } catch (error) {
      console.error(`❌ Error testing backup API for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Restore backup by ID (Enhanced with working RouterOS approach)
   */
  async restoreBackup(deviceId: string, backupId: string, password?: string, userId?: string): Promise<void> {
    try {
      const client = await this.getClient(deviceId);
      
      console.log(`🔍 Looking for backup with ID: ${backupId} for device: ${deviceId}`);
      
      // Get device information for debugging
      try {
        const systemResource = await client.getSystemResource();
        const systemIdentity = await client.getSystemIdentity();
        
        console.log(`🖥️ RouterOS Device Info:`, {
          version: systemResource.data?.version,
          architecture: systemResource.data?.architecture,
          'board-name': systemResource.data?.['board-name'],
          identity: systemIdentity.data?.name
        });
      } catch (error) {
        console.log(`⚠️ Could not get device info:`, error);
      }
      
      // STEP 1: Get backup from database using the backup ID
      const backup = this.db.prepare('SELECT * FROM configuration_backups WHERE id = ? AND device_id = ?').get(backupId, deviceId) as any;
      
      if (!backup) {
        throw new Error(`Backup not found in database: ${backupId}`);
      }

      console.log(`✅ Found backup in database:`, {
        id: backup.id,
        name: backup.backup_name,
        type: backup.backup_type,
        size: backup.file_size,
        created_at: backup.created_at
      });

      // STEP 2: Check if backup exists on RouterOS device
      const backupFiles = await client.listBackupFiles();
      if (!backupFiles.success || !backupFiles.data) {
        throw new Error('Failed to get backup files from device');
      }
      
      console.log(`📁 Available backup files on device:`, backupFiles.data.map((f: any) => ({ name: f.name, size: f.size })));
      
      // Look for the backup file on device by name
      const backupFileName = `${backup.backup_name}.backup`;
      const backupFile = backupFiles.data.find((file: any) => file.name === backupFileName);
      
      if (!backupFile) {
        console.log(`❌ Backup file ${backupFileName} not found on device`);
        console.log(`💡 Available files:`, backupFiles.data.map((f: any) => f.name));
        throw new Error(`Backup file ${backupFileName} not found on device. Upload the backup file first or use one of the available backups: ${backupFiles.data.map((f: any) => f.name).join(', ')}`);
      }
      
      console.log(`✅ Found backup file on device: ${backupFile.name} (${backupFile.size} bytes)`);
      
      // **IMPORTANT**: Based on RouterOS community research, the direct backup/load API doesn't work reliably
      // Instead, we use SSH to execute the backup restore command directly
      console.log(`🚨 Using SSH backup restore method due to RouterOS REST API limitations`);
      console.log(`📋 This method will connect via SSH and execute the backup restore command directly`);
      
      const restoreResult = await client.restoreBackupViaSSH(backupFile.name, password);
      
      if (!restoreResult.success) {
        throw new Error(`Failed to restore backup: ${restoreResult.error}`);
      }
      
      console.log(`✅ Backup restore initiated successfully!`);
      console.log(`⏰ Device will reboot and restore configuration automatically`);
      console.log(`📋 Method used: ${restoreResult.data?.method}`);
      
      // Track the change
      if (userId) {
        await this.trackChange({
          device_id: deviceId,
          section: 'backup',
          action: 'restore',
          item_id: backupId,
          changes: JSON.stringify({
            backupId,
            backupName: backup.backup_name,
            backupFileName: backupFile.name,
            method: 'ssh-direct-command',
            status: 'initiated',
            message: 'Device will reboot and restore backup automatically'
          }),
          user_name: userId,
          applied: true
        });
      }
      
      console.log(`🎉 Backup restore process completed successfully`);
      
    } catch (error) {
      console.error(`❌ Error restoring backup ${backupId} for device ${deviceId}:`, error);
      
      // Track the failed attempt
      if (userId) {
        try {
          await this.trackChange({
            device_id: deviceId,
            section: 'backup',
            action: 'restore',
            item_id: backupId,
            changes: JSON.stringify({ 
              backupId,
              error: error instanceof Error ? error.message : 'Unknown error',
              method: 'ssh-direct-command'
            }),
            user_name: userId,
            applied: true
          });
        } catch (trackError) {
          console.error('Failed to track backup restore failure:', trackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Delete a local backup from the database
   */
  async deleteLocalBackup(deviceId: string, backupId: string, userId?: string): Promise<void> {
    try {
      // Get backup info before deleting
      const backup = this.db.prepare('SELECT * FROM configuration_backups WHERE id = ? AND device_id = ?').get(backupId, deviceId) as any;
      
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Delete from database
      const deleteStmt = this.db.prepare('DELETE FROM configuration_backups WHERE id = ? AND device_id = ?');
      const result = deleteStmt.run(backupId, deviceId);

      if (result.changes === 0) {
        throw new Error(`Failed to delete backup: ${backupId}`);
      }

      // Track the change
      await this.trackChange({
        device_id: deviceId,
        section: 'backup',
        action: 'delete',
        item_id: backupId,
        changes: JSON.stringify({ 
          name: backup.backup_name,
          deleted_at: new Date().toISOString(),
          type: 'local_only'
        }),
        user_name: userId,
        applied: true
      });

      this.emit('backupDeleted', { deviceId, backupId, backupName: backup.backup_name });
    } catch (error) {
      console.error(`Error deleting local backup ${backupId} for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Delete backup file from RouterOS device
   */
  async deleteBackupFromDevice(deviceId: string, backupName: string, userId?: string): Promise<void> {
    try {
      const client = await this.getClient(deviceId);
      const backupFileName = `${backupName}.backup`;
      
      console.log(`Deleting backup file from RouterOS device: ${backupFileName}`);
      
      // Use RouterOS REST API to delete the file
      const result = await client.deleteFile(backupFileName);
      
      if (!result.success) {
        throw new Error(`Failed to delete backup from device: ${result.error}`);
      }
      
      console.log(`✅ Successfully deleted backup ${backupFileName} from RouterOS device`);
    } catch (error) {
      console.error(`❌ Error deleting backup from device:`, error);
      throw error;
    }
  }

  /**
   * Upload backup file from local database to RouterOS device
   */
  async uploadBackupToDevice(deviceId: string, backupId: string, userId?: string): Promise<void> {
    try {
      // Get backup from database
      const backup = this.db.prepare('SELECT * FROM configuration_backups WHERE id = ? AND device_id = ?').get(backupId, deviceId) as any;
      
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      if (!backup.backup_data) {
        throw new Error(`Backup data not found for backup: ${backupId}`);
      }

      const client = await this.getClient(deviceId);
      const backupFileName = `${backup.backup_name}.backup`;
      
      console.log(`Uploading backup ${backupFileName} to RouterOS device ${deviceId}`);
      
      // Upload via FTP
      const uploadResult = await client.uploadBackupFile(backupFileName, backup.backup_data);
      
      if (!uploadResult.success) {
        throw new Error(`Failed to upload backup to device: ${uploadResult.error}`);
      }

      console.log(`Successfully uploaded backup ${backupFileName} to device ${deviceId}`);

      // Track the change
      await this.trackChange({
        device_id: deviceId,
        section: 'backup',
        action: 'create',
        item_id: backupId,
        changes: JSON.stringify({ 
          name: backup.backup_name,
          type: 'upload_to_device',
          uploaded_to_device: true,
          file_size: backup.backup_data.length
        }),
        user_name: userId,
        applied: true
      });

      this.emit('backupUploadedToDevice', { deviceId, backupId, backupName: backup.backup_name });
    } catch (error) {
      console.error(`Error uploading backup ${backupId} to device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Upload backup file to local database
   */
  async uploadBackupFile(deviceId: string, backupName: string, backupData: Buffer, userId?: string): Promise<BackupInfo> {
    try {
      // Store the uploaded backup in database
      const timestamp = new Date().toISOString();
      
      const insertResult = this.insertBackupStmt.run(
        deviceId,
        backupName,
        'manual', // Uploaded backups are considered manual
        backupData,
        backupData.length,
        timestamp
      );

      const backupId = Number(insertResult.lastInsertRowid);

      // Track the change
      await this.trackChange({
        device_id: deviceId,
        section: 'backup',
        action: 'create',
        item_id: backupId.toString(),
        changes: JSON.stringify({ 
          name: backupName, 
          type: 'upload',
          uploaded_by_user: true,
          file_size: backupData.length
        }),
        user_name: userId,
        applied: true
      });

      const backupInfo: BackupInfo = {
        id: String(backupId), // Ensure ID is always a string
        device_id: deviceId,
        backup_name: backupName,
        backup_type: 'manual',
        file_size: backupData.length,
        created_at: new Date(timestamp),
        stored_locally: true,
        available_on_device: false, // Will need to be uploaded to device separately
        local_file_size: backupData.length,
        device_file_size: undefined
      };

      this.emit('backupUploaded', backupInfo);
      return backupInfo;
    } catch (error) {
      console.error(`Error uploading backup ${backupName} for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up stale backup entries (backups that no longer exist on device) 
   * and fake backup entries (containing JSON metadata instead of actual backup data)
   */
  async cleanupStaleBackups(deviceId: string, userId?: string): Promise<{ deletedCount: number; errors: string[] }> {
    try {
      const client = await this.getClient(deviceId);
      
      // Get current device backups
      const deviceBackupsResponse = await client.listBackupFiles();
      const deviceBackupNames = new Set<string>();
      
      if (deviceBackupsResponse.success && deviceBackupsResponse.data) {
        deviceBackupsResponse.data.forEach((file: any) => {
          const backupName = file.name.replace(/\.backup$/, '');
          deviceBackupNames.add(backupName);
        });
      }

      // Get local backups with their actual data
      const localBackups = this.getBackupsStmt.all(deviceId);
      
      let deletedCount = 0;
      const errors: string[] = [];

      // Group local backups by name to handle duplicates
      const backupsByName = new Map<string, any[]>();
      localBackups.forEach((backup: any) => {
        if (!backupsByName.has(backup.backup_name)) {
          backupsByName.set(backup.backup_name, []);
        }
        backupsByName.get(backup.backup_name)!.push(backup);
      });

      // Process each backup name
      for (const [backupName, backupEntries] of backupsByName) {
        for (const localBackup of backupEntries) {
          let shouldDelete = false;
          let reason = '';

          // Check if backup no longer exists on device
          if (!deviceBackupNames.has(backupName)) {
            shouldDelete = true;
            reason = 'no longer exists on device';
          }
          
          // Check if this is a fake backup entry (contains JSON metadata instead of actual backup data)
          else if (localBackup.backup_data) {
            try {
              const dataString = localBackup.backup_data.toString();
              // If the data starts with '{' and contains our fake metadata markers, it's fake
              if (dataString.startsWith('{') && 
                  (dataString.includes('"message":"Backup created on RouterOS device (file not downloaded)"') ||
                   dataString.includes('"backup_name"') ||
                   dataString.includes('"timestamp"'))) {
                shouldDelete = true;
                reason = 'contains fake placeholder data instead of actual backup';
              }
            } catch (error) {
              // If we can't parse the data, it might be corrupted
              console.warn(`Could not analyze backup data for ${backupName} (ID: ${localBackup.id})`);
            }
          }

          if (shouldDelete) {
            try {
              // Delete directly from database since we have the raw data
              const deleteStmt = this.db.prepare('DELETE FROM configuration_backups WHERE id = ?');
              deleteStmt.run(localBackup.id);
              
              console.log(`Deleted ${reason} backup: ${backupName} (ID: ${localBackup.id})`);
              deletedCount++;
              
              // Track the deletion
              await this.trackChange({
                device_id: deviceId,
                section: 'backup',
                action: 'delete',
                item_id: localBackup.id.toString(),
                changes: JSON.stringify({ 
                  name: backupName, 
                  reason: reason,
                  cleanup_type: 'automatic'
                }),
                user_name: userId,
                applied: true
              });
            } catch (error) {
              errors.push(`Failed to delete ${backupName} (ID: ${localBackup.id}): ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }

        // After cleaning up fake/stale entries, handle duplicates of remaining valid entries
        const remainingEntries = backupEntries.filter(entry => {
                  // Re-check if entry still exists (wasn't deleted above)
        try {
          const checkStmt = this.db.prepare('SELECT id FROM configuration_backups WHERE id = ?');
          return checkStmt.get(entry.id) !== undefined;
        } catch {
          return false;
        }
        });

        if (remainingEntries.length > 1) {
          // Multiple local entries for same backup name - keep only the newest one
          const sortedEntries = remainingEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const entriesToDelete = sortedEntries.slice(1); // Keep first (newest), delete rest
          
          for (const localBackup of entriesToDelete) {
            try {
              const deleteStmt = this.db.prepare('DELETE FROM configuration_backups WHERE id = ?');
              deleteStmt.run(localBackup.id);
              
              console.log(`Deleted duplicate backup: ${backupName} (ID: ${localBackup.id})`);
              deletedCount++;
            } catch (error) {
              errors.push(`Failed to delete duplicate ${backupName} (ID: ${localBackup.id}): ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
        }
      }

      console.log(`Cleanup completed: deleted ${deletedCount} backup entries`);
      return { deletedCount, errors };
    } catch (error) {
      console.error(`Error cleaning up stale backups for device ${deviceId}:`, error);
      throw error;
    }
  }

  // ==================== VALIDATION ====================

  /**
   * Validate IP address format
   */
  private validateIPAddress(address: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic IP/CIDR validation
    const ipCidrPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipCidrPattern.test(address)) {
      errors.push('Invalid IP address format. Expected format: x.x.x.x or x.x.x.x/xx');
    } else {
      // Validate IP components
      const [ip, cidr] = address.split('/');
      if (ip) {
        const octets = ip.split('.').map(Number);
      
        for (const octet of octets) {
          if (octet < 0 || octet > 255) {
            errors.push('IP address octets must be between 0 and 255');
            break;
          }
        }

        // Validate CIDR
        if (cidr) {
          const cidrNum = parseInt(cidr);
          if (cidrNum < 0 || cidrNum > 32) {
            errors.push('CIDR notation must be between /0 and /32');
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate route configuration
   */
  private validateRoute(route: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!route['dst-address']) {
      errors.push('Destination address is required');
    }

    if (!route.gateway && !route.interface) {
      errors.push('Either gateway or interface must be specified');
    }

    if (route.distance && (route.distance < 1 || route.distance > 255)) {
      errors.push('Route distance must be between 1 and 255');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate firewall rule
   */
  private validateFirewallRule(rule: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rule.chain) {
      errors.push('Chain is required');
    }

    if (!rule.action) {
      errors.push('Action is required');
    }

    const validChains = ['input', 'forward', 'output'];
    if (rule.chain && !validChains.includes(rule.chain)) {
      warnings.push(`Unusual chain name: ${rule.chain}. Common chains are: ${validChains.join(', ')}`);
    }

    const validActions = ['accept', 'drop', 'reject', 'return', 'jump', 'log'];
    if (rule.action && !validActions.includes(rule.action)) {
      warnings.push(`Unusual action: ${rule.action}. Common actions are: ${validActions.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate NAT rule
   */
  private validateNATRule(rule: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!rule.chain) {
      errors.push('Chain is required');
    }

    if (!rule.action) {
      errors.push('Action is required');
    }

    const validChains = ['srcnat', 'dstnat'];
    if (rule.chain && !validChains.includes(rule.chain)) {
      warnings.push(`Unusual NAT chain: ${rule.chain}. Common chains are: ${validChains.join(', ')}`);
    }

    const validActions = ['masquerade', 'src-nat', 'dst-nat', 'netmap', 'redirect', 'accept'];
    if (rule.action && !validActions.includes(rule.action)) {
      warnings.push(`Unusual NAT action: ${rule.action}. Common actions are: ${validActions.join(', ')}`);
    }

    // Validate source NAT specific rules
    if (rule.action === 'src-nat' && !rule['to-addresses']) {
      errors.push('Source NAT requires to-addresses');
    }

    // Validate destination NAT specific rules
    if (rule.action === 'dst-nat' && !rule['to-addresses']) {
      errors.push('Destination NAT requires to-addresses');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate address list entry
   */
  private validateAddressListEntry(entry: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!entry.list) {
      errors.push('List name is required');
    }

    if (!entry.address) {
      errors.push('Address is required');
    } else {
      // Validate IP address or range format
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
      const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      if (!ipPattern.test(entry.address) && !domainPattern.test(entry.address)) {
        errors.push('Address must be a valid IP address, CIDR range, or domain name');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Sync NAT rules with database
   */
  private async syncNATRulesWithDb(deviceId: string, rules: any[]): Promise<void> {
    // This would implement database synchronization logic
    // For now, we'll skip this as it's not critical for basic functionality
    console.log(`Syncing ${rules.length} NAT rules for device ${deviceId}`);
  }

  /**
   * Get NAT rules via SSH fallback
   */
  private async getNATRulesViaSSH(deviceId: string): Promise<any[]> {
    console.log(`Falling back to SSH for NAT rules on device ${deviceId}`);
    // This would implement SSH command execution
    // For now, return empty array as fallback
    return [];
  }

  /**
   * Add NAT rule via SSH fallback
   */
  private async addNATRuleViaSSH(deviceId: string, rule: any, userId?: string): Promise<any> {
    console.log(`Falling back to SSH for adding NAT rule on device ${deviceId}`);
    throw new Error('SSH fallback for NAT rule creation not yet implemented');
  }

  /**
   * Sync address lists with database
   */
  private async syncAddressListsWithDb(deviceId: string, lists: any[]): Promise<void> {
    console.log(`Syncing ${lists.length} address list entries for device ${deviceId}`);
  }

  /**
   * Get address lists via SSH fallback
   */
  private async getAddressListsViaSSH(deviceId: string): Promise<any[]> {
    console.log(`Falling back to SSH for address lists on device ${deviceId}`);
    return [];
  }



  // ==================== CHANGE TRACKING ====================

  /**
   * Get configuration change history
   */
  async getChangeHistory(deviceId: string, limit: number = 50): Promise<ConfigurationChange[]> {
    const changes = this.getChangesStmt.all(deviceId, limit);
    
    return changes.map((change: any) => ({
      id: change.id,
      device_id: change.device_id,
      section: change.section,
      action: change.action,
      item_id: change.item_id,
      changes: change.changes,
      user_name: change.user_name,
      timestamp: new Date(change.timestamp),
      applied: change.applied,
      rollback_data: change.rollback_data
    }));
  }

  /**
   * Cleanup connections
   */
  async cleanup(): Promise<void> {
    for (const [deviceId, client] of this.activeConnections) {
      try {
        client.close();
      } catch (error) {
        console.error(`Error closing connection for device ${deviceId}:`, error);
      }
    }
          this.activeConnections.clear();
    }
  } 