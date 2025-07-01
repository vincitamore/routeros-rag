/**
 * RouterOS REST API Client - Server Version
 * 
 * A comprehensive client for connecting to and managing RouterOS devices
 * via their REST API. Supports authentication, HTTPS, error handling,
 * and retry logic for robust network monitoring.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { FTPClient, FTPConfig } from './ftp-client';
import { Client as SSHClient } from 'ssh2';

// ==================== CORE TYPES ====================

export interface RouterOSCredentials {
  username: string;
  password: string;
}

export interface RouterOSClientOptions {
  host: string;
  port?: number;
  username: string;
  password: string;
  useSSL?: boolean;
  apiPath?: string;
  timeout?: number;
  rejectUnauthorized?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  // FTP settings for backup downloads
  ftpPort?: number;
  ftpUsername?: string;
  ftpPassword?: string;
  // SSH key authentication
  sshPrivateKey?: string;
  sshPublicKey?: string;
}

export interface RouterOSResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

export interface RouterOSRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  data?: any;
  params?: Record<string, string | number | boolean>;
}

export interface DeviceStatus {
  id: string;
  name: string;
  ipAddress: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastSeen?: string; // Changed from Date to string for JSON serialization
  lastError?: string;
  connectionAttempts: number;
  routerosVersion?: string;
  boardName?: string;
  architecture?: string;
  uptime?: string;
}

export interface SystemResource {
  uptime: string;
  version: string;
  'build-time': string;
  'factory-software': string;
  'free-memory': number;
  'total-memory': number;
  cpu: string;
  'cpu-count': string;
  'cpu-frequency': string;
  'cpu-load': string;
  'free-hdd-space': number;
  'total-hdd-space': number;
  'write-sect-since-reboot': number;
  'write-sect-total': number;
  'bad-blocks': string;
  architecture: string;
  'board-name': string;
  platform: string;
}

export interface SystemIdentity {
  name: string;
}

export interface Interface {
  '.id': string;
  name: string;
  type: string;
  comment?: string;
  disabled: string; // "true" or "false"
  'last-link-down-time'?: string;
  'last-link-up-time'?: string;
  'link-downs'?: string;
  'mac-address'?: string;
  mtu: string;
  'running': string; // "true" or "false"
  'tx-byte'?: string;
  'rx-byte'?: string;
  'tx-packet'?: string;
  'rx-packet'?: string;
  'tx-error'?: string;
  'rx-error'?: string;
}

export interface InterfaceTraffic {
    name: string;
    'rx-bits-per-second': string;
    'tx-bits-per-second': string;
    'rx-packets-per-second': string;
    'tx-packets-per-second': string;
  // Add actual counters for rate calculation
  'rx-byte'?: number;
  'tx-byte'?: number;
  'rx-packet'?: number;
  'tx-packet'?: number;
}

export interface DHCPLease {
  '.id': string;
  address: string;
  'mac-address': string;
  'client-id'?: string;
  server: string;
  'expires-after'?: string;
  'last-seen'?: string;
  'host-name'?: string;
  comment?: string;
  disabled: string; // "true" or "false"
  dynamic: string; // "true" or "false"
  blocked?: string; // "true" or "false"
  'radius'?: string; // "true" or "false"
}

export interface ARPEntry {
  '.id': string;
  address: string;
  'mac-address'?: string;  // Can be missing for incomplete entries
  interface: string;
  published?: string; // "true" or "false"
  invalid?: string; // "true" or "false"
  'DHCP'?: string; // "true" or "false"
  dynamic?: string; // "true" or "false" 
  complete?: string; // "true" or "false"
  disabled?: string; // "true" or "false"
  status?: string; // ARP status: "delay" | "failed" | "incomplete" | "permanent" | "probe" | "reachable" | "stale"
}

export interface IPAddress {
  '.id': string;
  address: string;
  network: string;
  interface: string;
  'actual-interface'?: string;
  invalid?: string; // "true" or "false"
  dynamic?: string; // "true" or "false"
  disabled?: string; // "true" or "false"
  comment?: string;
}

export interface NetworkTopology {
  interfaces: Interface[];
  ipAddresses: IPAddress[];
  arpTable: ARPEntry[];
  dhcpLeases: DHCPLease[];
  routes?: any[]; // Will be implemented in configuration phase
}

export interface ConnectionTracking {
  '.id': string;
  'src-address': string;
  'dst-address': string;
  'src-port'?: string;
  'dst-port'?: string;
  protocol: string;
  state?: string;
  'tcp-state'?: string;
  timeout: string;
  'orig-bytes'?: string;
  'repl-bytes'?: string;
  'orig-packets'?: string;
  'repl-packets'?: string;
  'orig-rate'?: string;
  'repl-rate'?: string;
  connection?: string; // Connection tracking state (SAC, SC, C, etc.)
  'connection-mark'?: string;
  'assured'?: string;
  'seen-reply'?: string;
}

export interface ConnectionError extends Error {
  code: 'CONNECTION_FAILED' | 'AUTHENTICATION_FAILED' | 'TIMEOUT' | 'SSL_ERROR';
  host: string;
  port: number;
  originalError?: Error;
}

export class RouterOSClient {
  private readonly options: RouterOSClientOptions & {
    port: number;
    useSSL: boolean;
    apiPath: string;
    timeout: number;
    rejectUnauthorized: boolean;
    retryAttempts: number;
    retryDelay: number;
    sshPrivateKey?: string;
    sshPublicKey?: string;
  };
  private readonly agent: https.Agent | http.Agent;
  
  constructor(options: RouterOSClientOptions) {
    // Set default options
    this.options = {
      host: options.host,
      port: options.port ?? (options.useSSL !== false ? 443 : 80),
      username: options.username,
      password: options.password,
      useSSL: options.useSSL ?? true,
      apiPath: options.apiPath ?? '/rest',
      timeout: options.timeout ?? 10000,
      rejectUnauthorized: options.rejectUnauthorized ?? false,
      retryAttempts: options.retryAttempts ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      // SSH key authentication options
      sshPrivateKey: options.sshPrivateKey,
      sshPublicKey: options.sshPublicKey
    };

    // Create HTTP/HTTPS agent for connection pooling and SSL configuration
    if (this.options.useSSL) {
      this.agent = new https.Agent({
        rejectUnauthorized: this.options.rejectUnauthorized,
        keepAlive: true,
        maxSockets: 5,
        timeout: this.options.timeout
      });
    } else {
      this.agent = new http.Agent({
        keepAlive: true,
        maxSockets: 5,
        timeout: this.options.timeout
      });
    }
  }

  /**
   * Test connection to RouterOS device
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.getSystemResource();
      return result.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get device status and basic information
   */
  async getDeviceStatus(): Promise<DeviceStatus> {
    try {
      const [resource, identity] = await Promise.all([
        this.getSystemResource(),
        this.getSystemIdentity()
      ]);

      if (!resource.success || !identity.success) {
        throw new Error('Failed to get device status');
      }

      return {
        id: `${this.options.host}:${this.options.port}`,
        name: identity.data?.name || this.options.host,
        ipAddress: this.options.host,
        status: 'connected',
        lastSeen: new Date().toISOString(),
        lastError: undefined,
        connectionAttempts: 0,
        routerosVersion: resource.data?.version || undefined,
        boardName: resource.data?.['board-name'] || undefined,
        architecture: resource.data?.architecture || undefined,
        uptime: resource.data?.uptime || undefined
      };
    } catch (error) {
      return {
        id: `${this.options.host}:${this.options.port}`,
        name: this.options.host,
        ipAddress: this.options.host,
        status: 'error',
        lastSeen: undefined,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        connectionAttempts: 1,
        routerosVersion: undefined,
        boardName: undefined,
        architecture: undefined,
        uptime: undefined
      };
    }
  }

  /**
   * Get system resource information (CPU, memory, etc.)
   */
  async getSystemResource(): Promise<RouterOSResponse<SystemResource>> {
    return this.request<SystemResource>({
      method: 'GET',
      path: '/system/resource'
    });
  }

  /**
   * Get system identity (router name)
   */
  async getSystemIdentity(): Promise<RouterOSResponse<SystemIdentity>> {
    return this.request<SystemIdentity>({
      method: 'GET',
      path: '/system/identity'
    });
  }

  /**
   * Get all interfaces
   */
  async getInterfaces(): Promise<RouterOSResponse<Interface[]>> {
    return this.request<Interface[]>({
      method: 'GET',
      path: '/interface'
    });
  }

  /**
   * Monitor traffic on specified interfaces
   */
  async monitorTraffic(interfaceIds?: string[]): Promise<RouterOSResponse<InterfaceTraffic[]>> {
    try {
      // Use the interface endpoint to get current interface statistics
      // This includes counters that can be used to calculate rates
      const result = await this.request<any[]>({
        method: 'GET',
        path: '/interface',
        params: {
          // Request specific properties including traffic counters
          '.proplist': 'name,rx-byte,tx-byte,rx-packet,tx-packet,running,disabled'
        }
      });
      
      if (result.success && result.data) {
        // Filter interfaces if specific ones were requested
        let interfaces = result.data;
        if (interfaceIds && interfaceIds.length > 0) {
          interfaces = interfaces.filter((iface: any) => 
            interfaceIds.includes(iface['.id']) || interfaceIds.includes(iface.name)
          );
        }
        
        // Convert to InterfaceTraffic format and include the actual byte/packet counters
        // The network service will use these counters to calculate rates
        const trafficData: InterfaceTraffic[] = interfaces.map((iface: any) => {
          const rxBytes = parseInt(iface['rx-byte'] || '0');
          const txBytes = parseInt(iface['tx-byte'] || '0');
          const rxPackets = parseInt(iface['rx-packet'] || '0');
          const txPackets = parseInt(iface['tx-packet'] || '0');
          
          return {
            name: iface.name || '',
            'rx-bits-per-second': '0', // Will be calculated by network service
            'tx-bits-per-second': '0', // Will be calculated by network service
            'rx-packets-per-second': '0', // Will be calculated by network service
            'tx-packets-per-second': '0', // Will be calculated by network service
            // Add the actual counters for rate calculation
            'rx-byte': rxBytes,
            'tx-byte': txBytes,
            'rx-packet': rxPackets,
            'tx-packet': txPackets
          };
        });
        
        return {
          success: true,
          data: trafficData,
          status: 200
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to get interface statistics',
          status: result.status || 500
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Monitor traffic failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Get DHCP server leases
   */
  async getDHCPLeases(): Promise<RouterOSResponse<DHCPLease[]>> {
    return this.request<DHCPLease[]>({
      method: 'GET',
      path: '/ip/dhcp-server/lease'
    });
  }

  /**
   * Get ARP table
   */
  async getARPTable(): Promise<RouterOSResponse<ARPEntry[]>> {
    return this.request<ARPEntry[]>({
      method: 'GET',
      path: '/ip/arp'
    });
  }

  /**
   * Get IP addresses
   */
  async getIPAddresses(): Promise<RouterOSResponse<IPAddress[]>> {
    return this.request<IPAddress[]>({
      method: 'GET',
      path: '/ip/address'
    });
  }

  /**
   * Get complete network topology (interfaces, IPs, ARP, DHCP)
   */
  async getNetworkTopology(): Promise<RouterOSResponse<NetworkTopology>> {
    try {
      const [interfacesRes, ipAddressesRes, arpTableRes, dhcpLeasesRes] = await Promise.all([
        this.getInterfaces(),
        this.getIPAddresses(), 
        this.getARPTable(),
        this.getDHCPLeases()
      ]);

      // Check if any request failed
      if (!interfacesRes.success || !ipAddressesRes.success || !arpTableRes.success || !dhcpLeasesRes.success) {
        const errors = [
          !interfacesRes.success ? `Interfaces: ${interfacesRes.error}` : null,
          !ipAddressesRes.success ? `IP Addresses: ${ipAddressesRes.error}` : null,
          !arpTableRes.success ? `ARP Table: ${arpTableRes.error}` : null,
          !dhcpLeasesRes.success ? `DHCP Leases: ${dhcpLeasesRes.error}` : null
        ].filter(Boolean).join(', ');
        
        return {
          success: false,
          error: `Failed to get network topology: ${errors}`,
          status: 500
        };
      }

      const topology: NetworkTopology = {
        interfaces: interfacesRes.data || [],
        ipAddresses: ipAddressesRes.data || [],
        arpTable: arpTableRes.data || [],
        dhcpLeases: dhcpLeasesRes.data || []
      };

      return {
        success: true,
        data: topology,
        status: 200
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500
      };
    }
  }

  /**
   * Get traffic statistics for specific interfaces
   */
  async getInterfaceTrafficStats(interfaceNames: string[]): Promise<RouterOSResponse<any[]>> {
    try {
      // Monitor traffic on all interfaces and filter the results
      const trafficRes = await this.monitorTraffic();
      if (!trafficRes.success || !trafficRes.data) {
        return {
          success: false,
          error: 'Failed to get traffic statistics',
          status: 500
        };
      }

      // Filter results to include only the requested interfaces
      const filteredData = trafficRes.data.filter(traffic => 
        interfaceNames.length === 0 || interfaceNames.includes(traffic.name)
      );

      return {
        success: true,
        data: filteredData,
        status: 200
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get traffic stats',
        status: 500
      };
    }
  }

  // ==================== CONFIGURATION MANAGEMENT ====================

  /**
   * Get IP address configuration
   */
  async getIPAddressConfiguration(): Promise<RouterOSResponse<IPAddress[]>> {
    return this.request<IPAddress[]>({
      method: 'GET',
      path: '/ip/address'
    });
  }

  /**
   * Add new IP address to interface
   */
  async addIPAddress(address: string, interfaceName: string, comment?: string): Promise<RouterOSResponse<IPAddress>> {
    const data: any = {
      address,
      interface: interfaceName
    };
    
    if (comment) {
      data.comment = comment;
    }

    return this.request<IPAddress>({
      method: 'PUT',
      path: '/ip/address',
      data
    });
  }

  /**
   * Update IP address configuration
   */
  async updateIPAddress(id: string, updates: Partial<IPAddress>): Promise<RouterOSResponse<IPAddress>> {
    return this.request<IPAddress>({
      method: 'PATCH',
      path: `/ip/address/${id}`,
      data: updates
    });
  }

  /**
   * Remove IP address
   */
  async removeIPAddress(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/address/${id}`
    });
  }

  /**
   * Get routing table
   */
  async getRoutes(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/route'
    });
  }

  /**
   * Add new route
   */
  async addRoute(route: {
    'dst-address': string;
    gateway?: string;
    interface?: string;
    distance?: number;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/route',
      data: route
    });
  }

  /**
   * Update route
   */
  async updateRoute(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/route/${id}`,
      data: updates
    });
  }

  /**
   * Remove route
   */
  async removeRoute(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/route/${id}`
    });
  }

  /**
   * Get firewall filter rules
   */
  async getFirewallRules(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/firewall/filter'
    });
  }

  /**
   * Add firewall rule
   */
  async addFirewallRule(rule: {
    chain: string;
    action: string;
    protocol?: string;
    'src-address'?: string;
    'dst-address'?: string;
    'src-port'?: string;
    'dst-port'?: string;
    'in-interface'?: string;
    'out-interface'?: string;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/firewall/filter',
      data: rule
    });
  }

  /**
   * Update firewall rule
   */
  async updateFirewallRule(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/firewall/filter/${id}`,
      data: updates
    });
  }

  /**
   * Remove firewall rule
   */
  async removeFirewallRule(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/firewall/filter/${id}`
    });
  }

  /**
   * Get NAT rules
   */
  async getNATRules(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/firewall/nat'
    });
  }

  /**
   * Add NAT rule
   */
  async addNATRule(rule: {
    chain: string;
    action: string;
    'src-address'?: string;
    'dst-address'?: string;
    'src-port'?: string;
    'dst-port'?: string;
    protocol?: string;
    'out-interface'?: string;
    'in-interface'?: string;
    'to-addresses'?: string;
    'to-ports'?: string;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/firewall/nat',
      data: rule
    });
  }

  /**
   * Update NAT rule
   */
  async updateNATRule(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/firewall/nat/${id}`,
      data: updates
    });
  }

  /**
   * Remove NAT rule
   */
  async removeNATRule(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/firewall/nat/${id}`
    });
  }

  /**
   * Get address lists
   */
  async getAddressLists(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/firewall/address-list'
    });
  }

  /**
   * Add address to address list
   */
  async addAddressListEntry(entry: {
    list: string;
    address: string;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/firewall/address-list',
      data: entry
    });
  }

  /**
   * Update address list entry
   */
  async updateAddressListEntry(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/firewall/address-list/${id}`,
      data: updates
    });
  }

  /**
   * Remove address list entry
   */
  async removeAddressListEntry(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/firewall/address-list/${id}`
    });
  }

  /**
   * Get connection tracking
   */
  async getConnectionTracking(): Promise<RouterOSResponse<ConnectionTracking[]>> {
    return this.request<ConnectionTracking[]>({
      method: 'GET',
      path: '/ip/firewall/connection'
    });
  }

  /**
   * Create system backup
   */
  async createBackup(name?: string, password?: string): Promise<RouterOSResponse<any>> {
    // First try to test basic connectivity
    try {
      const connectTest = await this.getSystemResource();
      if (!connectTest.success) {
        return {
          success: false,
          error: `Device not reachable: ${connectTest.error}`,
          status: 500
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Device connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }

    const data: any = {};
    
    // Set backup name - if not provided, use default naming convention
    if (name) {
      data.name = name;
    }
    
    // Set password if provided - without password, backup will be unencrypted in v6.43+
    if (password) {
      data.password = password;
    }
    
    // Set encryption to AES-SHA256 (default and recommended)
    data.encryption = 'aes-sha256';
    
    // Don't encrypt flag - let password parameter handle encryption
    if (!password) {
      data['dont-encrypt'] = 'yes';
    }

    try {
      // Use POST method to execute the backup save command
      const response = await this.request<any>({
        method: 'POST',
        path: '/system/backup/save',
        data
      });
      
      return response;
    } catch (error) {
      // If the standard endpoint fails, try the alternative format
      console.log('Standard backup endpoint failed, trying alternative approach...');
      return this.createBackupAlternative(name, password);
    }
  }

  /**
   * Alternative backup method for different RouterOS versions
   */
  private async createBackupAlternative(name?: string, password?: string): Promise<RouterOSResponse<any>> {
    try {
      // Some RouterOS versions may need the command structured differently
      const data: any = {};
      
      if (name) {
        data.name = name;
      }
      
      if (password) {
        data.password = password;
      }

      // Try direct command execution
      return await this.request<any>({
        method: 'POST',
        path: '/system/backup',
        data: {
          ...data,
          '.action': 'save'
        }
      });
    } catch (error) {
      return {
        success: false,
        error: `Backup creation failed: ${error instanceof Error ? error.message : 'Unknown error'}. This may indicate that backup functionality is not supported via REST API on this RouterOS version.`,
        status: 500
      };
    }
  }

  /**
   * List backup files on the router
   */
  async listBackupFiles(): Promise<RouterOSResponse<any[]>> {
    try {
      // Get all files and filter for .backup files
      const response = await this.request<any[]>({
        method: 'GET',
        path: '/file'
      });
      
      if (!response.success || !response.data) {
        return response;
      }
      
      // Filter for backup files
      const backupFiles = response.data.filter((file: any) => {
        const name = file.name || '';
        return name.toLowerCase().endsWith('.backup') && file.type !== 'directory';
      });
      
      return {
        success: true,
        data: backupFiles,
        status: response.status
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list backup files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Download backup file from RouterOS device via FTP
   * This is the most reliable method for downloading backup files
   */
  async downloadBackupFileViaFTP(fileName: string): Promise<RouterOSResponse<Buffer>> {
    try {
      console.log(`Attempting to download backup file ${fileName} via FTP...`);
      
      const ftpConfig: FTPConfig = {
        host: this.options.host,
        port: this.options.ftpPort || 21,
        user: this.options.ftpUsername || this.options.username,
        password: this.options.ftpPassword || this.options.password,
        secure: false // RouterOS FTP is typically not secure
      };

      const ftpClient = new FTPClient(ftpConfig);
      
      // Test connection first
      const canConnect = await ftpClient.testConnection();
      if (!canConnect) {
        return {
          success: false,
          error: 'Failed to connect to FTP server',
          status: 500
        };
      }

      // Download the backup file
      const fileBuffer = await ftpClient.downloadFile(fileName);
      
      console.log(`Successfully downloaded ${fileName} via FTP, size: ${fileBuffer.length} bytes`);
      
      return {
        success: true,
        data: fileBuffer,
        status: 200
      };
    } catch (error) {
      console.error(`FTP download failed for ${fileName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown FTP error',
        status: 500
      };
    }
  }

  /**
   * Download a backup file from the router via FTP
   * RouterOS REST API doesn't support file downloads, so FTP is required
   */
  async downloadBackupFile(fileName: string): Promise<RouterOSResponse<Buffer>> {
    try {
      // First check if file exists
      const fileList = await this.listBackupFiles();
      if (!fileList.success) {
        return {
          success: false,
          error: 'Failed to list backup files',
          status: 500
        };
      }

      const backupFile = fileList.data?.find((file: any) => file.name === fileName);
      if (!backupFile) {
        return {
          success: false,
          error: `Backup file '${fileName}' not found on device`,
          status: 404
        };
      }

      // Download via FTP (only reliable method for RouterOS backup files)
      console.log(`Downloading backup file ${fileName} via FTP...`);
      const ftpResult = await this.downloadBackupFileViaFTP(fileName);
      
      if (ftpResult.success) {
        console.log(`Successfully downloaded ${fileName} via FTP`);
        return ftpResult;
      } else {
        console.error(`FTP download failed for ${fileName}: ${ftpResult.error}`);
        return {
          success: false,
          error: `FTP download failed: ${ftpResult.error}. RouterOS requires FTP access for backup file downloads.`,
          status: 500
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to download backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Alternative method to download backup files
   */
  private async downloadBackupFileAlternative(fileName: string): Promise<RouterOSResponse<Buffer>> {
    try {
      // First, try to get the file info to check if it exists
      const fileListResponse = await this.request<any[]>({
        method: 'GET',
        path: '/file'
      });

      if (!fileListResponse.success || !fileListResponse.data) {
        return {
          success: false,
          error: 'Failed to list files on device',
          status: 500
        };
      }

      // Find the backup file in the file list
      const backupFile = fileListResponse.data.find((file: any) => file.name === fileName);
      if (!backupFile) {
        return {
          success: false,
          error: `Backup file '${fileName}' not found on device`,
          status: 404
        };
      }

      // Try downloading via web interface (winbox-style download)
      const downloadUrl = `${this.options.useSSL ? 'https' : 'http'}://${this.options.host}:${this.options.port}/webfig/file?name=${encodeURIComponent(fileName)}`;
      
      return new Promise((resolve) => {
        const requestModule = this.options.useSSL ? https : http;
        
        const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
        
        const req = requestModule.request(downloadUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'User-Agent': 'RouterOS-Portal/1.0'
          },
          agent: this.agent,
          timeout: this.options.timeout
        }, (res) => {
          const chunks: Buffer[] = [];
          
          res.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          
          res.on('end', () => {
            const fileBuffer = Buffer.concat(chunks);
            
            if (res.statusCode === 200) {
              resolve({
                success: true,
                data: fileBuffer,
                status: 200
              });
            } else {
              // If webfig doesn't work, try simple file download
              resolve(this.downloadViaSimpleHTTP(fileName));
            }
          });
        });

        req.on('error', (error) => {
          // Fallback to simple HTTP download
          resolve(this.downloadViaSimpleHTTP(fileName));
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            error: 'Download timeout',
            status: 408
          });
        });

        req.end();
      });
    } catch (error) {
      return {
        success: false,
        error: `Alternative download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Simple HTTP download fallback
   */
  private async downloadViaSimpleHTTP(fileName: string): Promise<RouterOSResponse<Buffer>> {
    const simpleUrl = `${this.options.useSSL ? 'https' : 'http'}://${this.options.host}:${this.options.port}/${encodeURIComponent(fileName)}`;
    
    return new Promise((resolve) => {
      const requestModule = this.options.useSSL ? https : http;
      const auth = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
      
      const req = requestModule.request(simpleUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'RouterOS-Portal/1.0'
        },
        agent: this.agent,
        timeout: this.options.timeout
      }, (res) => {
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          const fileBuffer = Buffer.concat(chunks);
          
          if (res.statusCode === 200) {
            resolve({
              success: true,
              data: fileBuffer,
              status: 200
            });
          } else {
            resolve({
              success: false,
              error: `File download failed. RouterOS may not support direct backup file download via REST API. Status: ${res.statusCode}`,
              status: res.statusCode || 500
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: `HTTP download failed: ${error.message}`,
          status: 500
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'HTTP download timeout',
          status: 408
        });
      });

      req.end();
    });
  }

  /**
   * Delete a file from RouterOS device
   */
  async deleteFile(fileName: string): Promise<RouterOSResponse<any>> {
    try {
      console.log(`🗑️ Deleting file from RouterOS: ${fileName}`);
      
      // First, get the file list to find the file ID
      const listResult = await this.request<any[]>({
        method: 'GET',
        path: '/file'
      });
      
      if (!listResult.success || !listResult.data) {
        return {
          success: false,
          error: 'Failed to get file list',
          status: 500
        };
      }
      
      // Find the file in the list
      const files = Array.isArray(listResult.data) ? listResult.data : [listResult.data];
      const targetFile = files.find((file: any) => 
        file.name === fileName || 
        file.name === `/${fileName}` ||
        file.name.endsWith(`/${fileName}`)
      );
      
      if (!targetFile) {
        return {
          success: false,
          error: `File not found: ${fileName}`,
          status: 404
        };
      }
      
      // Delete the file using its ID
      const deleteResult = await this.request<void>({
        method: 'DELETE',
        path: `/file/${targetFile['.id']}`
      });
      
      if (deleteResult.success) {
        console.log(`✅ Successfully deleted file: ${fileName}`);
      }
      
      return deleteResult;
    } catch (error) {
      console.error(`❌ Error deleting file ${fileName}:`, error);
      return {
        success: false,
        error: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Upload backup file to RouterOS device via FTP
   */
  async uploadBackupFile(fileName: string, backupData: Buffer): Promise<RouterOSResponse<any>> {
    try {
      console.log(`Attempting to upload backup file ${fileName} via FTP...`);
      
      const ftpConfig: FTPConfig = {
        host: this.options.host,
        port: this.options.ftpPort || 21,
        user: this.options.ftpUsername || this.options.username,
        password: this.options.ftpPassword || this.options.password,
        secure: false // RouterOS FTP is typically not secure
      };

      const ftpClient = new FTPClient(ftpConfig);
      
      // Test connection first
      const canConnect = await ftpClient.testConnection();
      if (!canConnect) {
        return {
          success: false,
          error: 'Failed to connect to FTP server for upload',
          status: 500
        };
      }

      // Upload the backup file
      await ftpClient.uploadFile(fileName, backupData);
      
      console.log(`Successfully uploaded ${fileName} via FTP, size: ${backupData.length} bytes`);
      
      return {
        success: true,
        data: { 
          message: 'Backup file uploaded successfully',
          fileName,
          fileSize: backupData.length
        },
        status: 200
      };
    } catch (error) {
      console.error(`FTP upload failed for ${fileName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown FTP upload error',
        status: 500
      };
    }
  }

  /**
   * Execute console command via REST API
   * This uses the universal POST method to execute any RouterOS console command
   */
  async executeConsoleCommand(command: string, params: Record<string, string> = {}): Promise<RouterOSResponse<any>> {
    try {
      console.log(`🖥️ Executing console command: ${command}`);
      console.log(`📋 Parameters:`, params);
      
      // Build the request data with command parameters
      const data = { ...params };
      
      // For console commands via REST API, use the command path directly
      // Example: /system/backup/load becomes /rest/system/backup/load
      const response = await this.request<any>({
        method: 'POST',
        path: `/${command}`,
        data
      });
      
      console.log(`📥 Console command response:`, {
        success: response.success,
        status: response.status,
        error: response.error,
        hasData: !!response.data
      });
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Console command failed: ${errorMessage}`);
      
      return {
        success: false,
        error: `Console command failed: ${errorMessage}`,
        status: 500
      };
    }
  }

  /**
   * SSH-based backup restore method
   * This method connects via SSH and executes the backup restore command directly
   * This bypasses the problematic REST API entirely
   */
  async restoreBackupViaSSH(backupFileName: string, password?: string): Promise<RouterOSResponse<any>> {
    try {
      const backupName = backupFileName.replace(/\.backup$/, '');
      
      console.log(`🔄 SSH backup restore approach for: "${backupName}"`);
      console.log(`🔗 Connecting to RouterOS via SSH...`);
      
      const ssh = new SSHClient();
      
      return new Promise((resolve, reject) => {
        let commandOutput = '';
        let errorOutput = '';
        
        ssh.on('ready', () => {
          console.log(`✅ SSH connection established`);
          
          // Prepare the backup restore command
          let command = `/system backup load name="${backupName}"`;
          // Always include password parameter, even if empty (RouterOS requires it)
          if (password) {
            command += ` password="${password}"`;
          } else {
            command += ` password=""`;
          }
          
          console.log(`🔄 Executing command: ${command}`);
          
          ssh.exec(command, (err: any, stream: any) => {
            if (err) {
              console.error(`❌ SSH exec error:`, err);
              ssh.end();
              return reject(err);
            }
            
            stream.on('close', (code: number, signal: string) => {
              console.log(`📤 SSH command completed with code: ${code}, signal: ${signal}`);
              ssh.end();
              
              if (code === 0) {
                console.log(`✅ SSH backup restore command executed successfully`);
                console.log(`📋 Command output:`, commandOutput);
                resolve({
                  success: true,
                  data: {
                    message: 'Backup restore command executed successfully via SSH. Device will reboot.',
                    method: 'ssh-direct-command',
                    backupFile: `${backupName}.backup`,
                    commandOutput: commandOutput.trim(),
                    exitCode: code
                  },
                  status: 200
                });
              } else {
                console.error(`❌ SSH command failed with exit code: ${code}`);
                console.error(`📋 Error output:`, errorOutput);
                resolve({
                  success: false,
                  error: `SSH command failed with exit code ${code}: ${errorOutput || commandOutput}`,
                  status: 500
                });
              }
            });
            
            stream.on('data', (data: Buffer) => {
              const output = data.toString();
              commandOutput += output;
              console.log(`📤 SSH output:`, output.trim());
            });
            
            stream.stderr.on('data', (data: Buffer) => {
              const error = data.toString();
              errorOutput += error;
              console.error(`📤 SSH error:`, error.trim());
            });
          });
        });
        
        ssh.on('error', (err: any) => {
          console.error(`❌ SSH connection error:`, err);
          reject(err);
        });
        
        // Connect using the same credentials as REST API
        const connectOptions = {
          host: this.options.host,
          port: 22, // SSH port
          username: this.options.username,
          password: this.options.password,
          readyTimeout: 10000,
          keepaliveInterval: 5000
        };
        
        console.log(`🔗 Connecting to SSH at ${connectOptions.host}:${connectOptions.port}`);
        ssh.connect(connectOptions);
      });
      
    } catch (error) {
      console.error(`❌ SSH backup restore failed:`, error);
      return {
        success: false,
        error: `SSH backup restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Alternative backup restore using export/import approach
   */
  async restoreBackupAlternative(backupFileName: string, password?: string): Promise<RouterOSResponse<any>> {
    try {
      const backupName = backupFileName.replace(/\.backup$/, '');
      
      console.log(`🔄 Alternative backup restore approach for: "${backupName}"`);
      console.log(`📋 This method will use system reset + run-after-reset approach`);
      
             // Step 1: First check if backup file exists
       const backupFiles = await this.listBackupFiles();
      if (!backupFiles.success || !backupFiles.data) {
        return {
          success: false,
          error: 'Failed to get backup files list',
          status: 500
        };
      }
      
      const backupExists = backupFiles.data.some((file: any) => 
        file.name === backupName || file.name === `${backupName}.backup`
      );
      
      if (!backupExists) {
        return {
          success: false,
          error: `Backup file "${backupName}" not found on device`,
          status: 404
        };
      }
      
      console.log(`✅ Backup file "${backupName}" found on device`);
      
      // Step 2: Try the system reset with run-after-reset approach
      // This is the recommended method from RouterOS community
      const resetData: any = {
        'no-defaults': 'yes',
        'run-after-reset': `${backupName}.backup`
      };
      
      if (password) {
        resetData.password = password;
      }
      
      console.log(`🔄 Attempting system reset with run-after-reset...`);
      console.log(`📋 Reset parameters:`, resetData);
      
      const resetResponse = await this.request<any>({
        method: 'POST',
        path: '/system/reset-configuration',
        data: resetData
      });
      
      if (resetResponse.success) {
        console.log(`✅ System reset with backup restore initiated successfully`);
        console.log(`⏰ Device will reboot and restore backup automatically`);
        
        return {
          success: true,
          data: {
            message: 'Backup restore initiated successfully. Device will reboot and restore configuration.',
            method: 'system-reset-with-run-after-reset',
            backupFile: `${backupName}.backup`
          },
          status: 200
        };
      } else {
        console.log(`❌ System reset approach failed:`, resetResponse);
        
        return {
          success: false,
          error: `System reset approach failed: ${resetResponse.error}`,
          status: resetResponse.status || 500
        };
      }
      
    } catch (error) {
      console.error(`❌ Alternative backup restore failed:`, error);
      return {
        success: false,
        error: `Alternative backup restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Setup HTTPS certificates via SSH
   * Uses the same SSH pattern as restoreBackupViaSSH()
   */
  async setupHTTPSCertificatesViaSSH(): Promise<RouterOSResponse<any>> {
    try {
      console.log(`🔐 Setting up HTTPS certificates via SSH for: ${this.options.host}`);
      
      const ssh = new SSHClient();
      
      return new Promise((resolve, reject) => {
        let commandOutput = '';
        let errorOutput = '';
        
        ssh.on('ready', () => {
          console.log(`✅ SSH connection established for HTTPS setup`);
          
          // Execute certificate setup commands sequentially
          const commands = [
            '/certificate add name=local-ca common-name=local-ca key-usage=key-cert-sign,crl-sign',
            '/certificate sign local-ca',
            `/certificate add name=https-cert common-name=${this.options.host}`,
            '/certificate sign https-cert ca=local-ca',
            '/certificate set https-cert trusted=yes',
            '/ip service set www-ssl certificate=https-cert disabled=no',
            '/ip service set www-ssl port=443'
          ];
          
          this.executeSSHCommandSequence(ssh, commands, 0, '', '')
            .then((result) => {
              ssh.end();
              resolve(result);
            })
            .catch((error) => {
              ssh.end();
              reject(error);
            });
        });
        
        ssh.on('error', (err: any) => {
          console.error(`❌ SSH connection error for HTTPS setup:`, err);
          reject(err);
        });
        
        // Use SSH key authentication if available, fallback to password
        const connectOptions: any = {
          host: this.options.host,
          port: 22,
          username: this.options.username,
          readyTimeout: 10000,
          keepaliveInterval: 5000
        };

        // Prefer SSH key authentication over password
        if (this.options.sshPrivateKey) {
          console.log('🔑 Using SSH key authentication for HTTPS setup');
          connectOptions.privateKey = this.options.sshPrivateKey;
        } else {
          console.log('🔐 Using password authentication for HTTPS setup');
          connectOptions.password = this.options.password;
        }
        
        ssh.connect(connectOptions);
      });
    } catch (error) {
      return {
        success: false,
        error: `HTTPS setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Execute SSH commands sequentially with progress tracking
   */
  private async executeSSHCommandSequence(
    ssh: any, 
    commands: string[], 
    index: number,
    allOutput: string,
    allErrors: string
  ): Promise<RouterOSResponse<any>> {
    if (index >= commands.length) {
      return {
        success: true,
        data: {
          message: 'HTTPS certificates configured successfully',
          commandOutput: allOutput,
          commandsExecuted: commands.length
        },
        status: 200
      };
    }
    
    const command = commands[index];
    if (!command) {
      return Promise.reject(new Error(`Command at index ${index} is undefined`));
    }
    console.log(`🔄 Executing command ${index + 1}/${commands.length}: ${command}`);
    
    return new Promise((resolve, reject) => {
      ssh.exec(command, (err: any, stream: any) => {
        if (err) {
          reject(err);
          return;
        }
        
        let commandOutput = '';
        let commandError = '';
        
        stream.on('close', async (code: number) => {
          if (code === 0) {
            console.log(`✅ Command ${index + 1} completed successfully`);
            // Add delay for certificate signing operations
            if (command.includes('sign')) {
              console.log(`⏳ Waiting for certificate signing...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            try {
              const result = await this.executeSSHCommandSequence(
                ssh, 
                commands, 
                index + 1, 
                allOutput + commandOutput, 
                allErrors + commandError
              );
              resolve(result);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`Command failed with exit code ${code}: ${commandError || commandOutput}`));
          }
        });
        
        stream.on('data', (data: Buffer) => {
          const output = data.toString();
          commandOutput += output;
          console.log(`📤 SSH output: ${output.trim()}`);
        });
        
        stream.stderr.on('data', (data: Buffer) => {
          const error = data.toString();
          commandError += error;
          console.error(`📤 SSH error: ${error.trim()}`);
        });
      });
    });
  }

  /**
   * Test HTTPS connection after certificate setup
   */
  async testHTTPSConnection(): Promise<boolean> {
    try {
      // Create a temporary HTTPS client to test the connection
      const httpsClient = new RouterOSClient({
        ...this.options,
        useSSL: true,
        port: 443,
        rejectUnauthorized: false // Accept self-signed certificates
      });
      
      const result = await httpsClient.getSystemResource();
      httpsClient.close();
      
      return result.success;
    } catch (error) {
      console.error('HTTPS connection test failed:', error);
      return false;
    }
  }

  /**
   * Harden security by disabling insecure services (HTTP and FTP)
   * WARNING: This will disable HTTP and FTP access to the router
   * FTP must be re-enabled for backup/restore operations and disabled again afterwards
   */
  async hardenSecurityServices(): Promise<RouterOSResponse<any>> {
    try {
      console.log(`🔒 Hardening security services on: ${this.options.host}`);
      
      const ssh = new SSHClient();
      
      return new Promise((resolve, reject) => {
        ssh.on('ready', () => {
          console.log(`✅ SSH connection established for security hardening`);
          
          // Security hardening commands
          const commands = [
            // Disable HTTP service (port 80) - users must use HTTPS
            '/ip service set www disabled=yes',
            // Disable FTP service for security (can be re-enabled when needed for backups)
            '/ip service set ftp disabled=yes'
          ];
          
          this.executeSSHCommandSequence(ssh, commands, 0, '', '')
            .then((result) => {
              ssh.end();
              resolve(result);
            })
            .catch((error) => {
              ssh.end();
              reject(error);
            });
        });
        
        ssh.on('error', (err: any) => {
          console.error(`❌ SSH connection error for security hardening:`, err);
          reject(err);
        });
        
        // Use SSH key authentication if available, fallback to password
        const connectOptions: any = {
          host: this.options.host,
          port: 22,
          username: this.options.username,
          readyTimeout: 10000,
          keepaliveInterval: 5000
        };

        // Prefer SSH key authentication over password
        if (this.options.sshPrivateKey) {
          console.log('🔑 Using SSH key authentication for security hardening');
          connectOptions.privateKey = this.options.sshPrivateKey;
        } else {
          console.log('🔐 Using password authentication for security hardening');
          connectOptions.password = this.options.password;
        }
        
        ssh.connect(connectOptions);
      });
    } catch (error) {
      return {
        success: false,
        error: `Security hardening failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Restore backup from file (Enhanced with multiple approaches)
   */
  async restoreBackup(backupFileName: string, password?: string): Promise<RouterOSResponse<any>> {
    try {
      // Ensure we don't have .backup extension in the name parameter
      const backupName = backupFileName.replace(/\.backup$/, '');
      
      console.log(`🔄 Attempting to restore backup: "${backupName}" (original: "${backupFileName}")`);
      console.log(`🔍 RouterOS API base path: ${this.options.apiPath}`);
      console.log(`🏠 RouterOS host: ${this.options.host}:${this.options.port}`);
      
      // Method 1: Use console command approach - as per RouterOS REST API documentation
      console.log(`🔄 Method 1: Using REST API console command approach`);
      
      const commandParams: Record<string, string> = {
        name: backupName
      };
      
      if (password) {
        commandParams.password = password;
        console.log(`🔐 Backup restore with password protection`);
      } else {
        console.log(`🔓 Backup restore without password`);
      }

      console.log(`📤 Executing REST API console command: POST /system/backup/load`);
      console.log(`📤 Parameters:`, commandParams);

      // Execute the CLI command via REST API POST (universal method)
      let response = await this.executeConsoleCommand('system/backup/load', commandParams);

      console.log(`📥 Method 1 (REST API console command) response:`, {
        success: response.success,
        status: response.status,
        error: response.error
      });

      // If console command approach works, we're done!
      if (response.success) {
        console.log(`✅ Backup restore command executed successfully via REST API console command!`);
        return response;
      }

      // Method 2: Try alternative path formatting (if method 1 fails)
      if (!response.success && response.status === 400) {
        console.log(`🔄 Method 2: Trying alternative REST API path format`);
        
        // Try with 'rest' prefix explicitly
        const alternativeResponse = await this.request<any>({
          method: 'POST',
          path: '/rest/system/backup/load',
          data: commandParams
        });

        console.log(`📥 Method 2 response:`, {
          success: alternativeResponse.success,
          status: alternativeResponse.status,
          error: alternativeResponse.error
        });

        if (alternativeResponse.success) {
          console.log(`✅ Backup restore successful via alternative REST API path!`);
          return alternativeResponse;
        }

        response = alternativeResponse; // Update response for final error handling
      }

      // If all methods fail, provide detailed error message
      console.error(`❌ All restore methods failed.`);
      
      const errorMessage = response.status === 400 
        ? `400 Bad Request: RouterOS rejected backup restore command. This could indicate:
          - Backup file doesn't exist on device
          - RouterOS version incompatibility 
          - Backup file is corrupted
          - Password is incorrect (if backup is encrypted)
          Error: ${response.error}`
        : `Failed to restore backup: ${response.error}`;
        
      return {
        success: false,
        error: errorMessage,
        status: response.status
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Backup restore failed for "${backupFileName}":`, errorMessage);
      console.error(`🔍 Error details:`, error);
      
      return {
        success: false,
        error: `Failed to restore backup: ${errorMessage}`,
        status: 500
      };
    }
  }

  /**
   * Export configuration to text
   */
  async exportConfiguration(compact: boolean = true): Promise<RouterOSResponse<string>> {
    return this.request<string>({
      method: 'POST',
      path: '/export',
      data: compact ? { compact: 'yes' } : { verbose: 'yes' }
    });
  }

  /**
   * Enable/disable interface
   */
  async setInterfaceState(interfaceName: string, enabled: boolean): Promise<RouterOSResponse<Interface>> {
    return this.request<Interface>({
      method: 'PATCH',
      path: `/interface/${interfaceName}`,
      data: { disabled: enabled ? 'no' : 'yes' }
    });
  }

  /**
   * Update interface configuration
   */
  async updateInterface(interfaceName: string, config: {
    mtu?: number;
    comment?: string;
    disabled?: boolean;
  }): Promise<RouterOSResponse<Interface>> {
    const data: any = {};
    
    if (config.mtu !== undefined) data.mtu = config.mtu.toString();
    if (config.comment !== undefined) data.comment = config.comment;
    if (config.disabled !== undefined) data.disabled = config.disabled ? 'yes' : 'no';

    return this.request<Interface>({
      method: 'PATCH',
      path: `/interface/${interfaceName}`,
      data
    });
  }

  /**
   * Reset interface counters (clears rx/tx byte and packet statistics)
   */
  async resetInterfaceCounters(interfaceName?: string): Promise<RouterOSResponse<any>> {
    try {
      if (interfaceName) {
        // Reset counters for a specific interface
        return this.request<any>({
          method: 'POST',
          path: `/interface/reset-counters`,
          data: { numbers: interfaceName }
        });
      } else {
        // Reset counters for all interfaces
        return this.request<any>({
          method: 'POST',
          path: `/interface/reset-counters`
        });
      }
    } catch (error) {
      return {
        success: false,
        error: `Reset interface counters failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Test RouterOS REST API backup capabilities
   */
  async testBackupRestoreAPI(): Promise<RouterOSResponse<any>> {
    try {
      console.log(`🧪 Testing RouterOS backup restore API capabilities...`);
      
      // Test 1: Check system resource to verify API connectivity
      const systemTest = await this.getSystemResource();
      if (!systemTest.success) {
        return {
          success: false,
          error: 'Failed to connect to RouterOS API',
          status: 500
        };
      }
      
      console.log(`✅ Basic API connectivity verified`);
      console.log(`📊 RouterOS Version: ${systemTest.data?.version}`);
      
      // Test 2: Try to list backup files to verify backup API access
      const backupListTest = await this.listBackupFiles();
      if (!backupListTest.success) {
        return {
          success: false,
          error: 'Failed to access backup files via API',
          status: 500
        };
      }
      
      console.log(`✅ Backup file listing works`);
      console.log(`📂 Found ${backupListTest.data?.length || 0} backup files`);
      
      // Test 3: Test console command execution capability
      console.log(`🧪 Testing console command execution capability...`);
      try {
        // Test with a safe command that should always work
        const consoleTest = await this.executeConsoleCommand('system/identity/print', {});
        console.log(`✅ Console command execution test result:`, {
          success: consoleTest.success,
          status: consoleTest.status,
          hasData: !!consoleTest.data
        });
        
        if (consoleTest.success) {
          console.log(`🎉 Console command execution is SUPPORTED!`);
        } else {
          console.log(`❌ Console command execution failed:`, consoleTest.error);
        }
      } catch (error) {
        console.log(`❌ Console command test failed:`, error);
      }
      
      // Test 4: Test specific backup-related console commands
      if (backupListTest.data && backupListTest.data.length > 0) {
        const firstBackup = backupListTest.data[0];
        console.log(`🧪 Testing backup load command syntax with: ${firstBackup.name}`);
        
        // Just test the command structure (without actually restoring)
        const testParams = {
          name: firstBackup.name.replace(/\.backup$/, ''),
          'dry-run': 'yes'  // If RouterOS supports dry-run mode
        };
        
        try {
          const loadTest = await this.executeConsoleCommand('system/backup/load', testParams);
          console.log(`📋 Backup load command test:`, {
            success: loadTest.success,
            status: loadTest.status,
            error: loadTest.error
          });
        } catch (error) {
          console.log(`❌ Backup load command test failed:`, error);
        }
      }
      
      return {
        success: true,
        data: {
          apiConnectivity: true,
          backupAccess: true,
          routerOSVersion: systemTest.data?.version,
          backupCount: backupListTest.data?.length || 0
        },
        status: 200
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ API test failed:`, errorMessage);
      
      return {
        success: false,
        error: `API test failed: ${errorMessage}`,
        status: 500
      };
    }
  }

  // ==================== IPSEC VPN MANAGEMENT ====================

  /**
   * Get IPsec policies
   */
  async getIPsecPolicies(): Promise<RouterOSResponse<any[]>> {
    try {
      // Try REST API first
      const restResult = await this.request<any[]>({
        method: 'GET',
        path: '/ip/ipsec/policy'
      });
      
      // If REST API returns data, use it
      if (restResult.success && restResult.data && Array.isArray(restResult.data) && restResult.data.length > 0) {
        console.log(`✅ [RouterOSClient] IPsec policies retrieved via REST API: ${restResult.data.length} policies`);
        console.log(`📊 [RouterOSClient] Raw policies data sample:`, JSON.stringify(restResult.data.slice(0, 2), null, 2));
        return restResult;
      }
      
      // Fallback to SSH if REST API returns empty or fails
      console.log(`🔄 REST API returned empty/failed, falling back to SSH for IPsec policies`);
      return await this.getIPsecPoliciesViaSSH();
    } catch (error) {
      // If REST API completely fails, use SSH
      console.log(`❌ REST API failed, using SSH fallback for IPsec policies`);
      return await this.getIPsecPoliciesViaSSH();
    }
  }

  /**
   * Get IPsec peers
   */
  async getIPsecPeers(): Promise<RouterOSResponse<any[]>> {
    try {
      // Try REST API first
      const restResult = await this.request<any[]>({
        method: 'GET',
        path: '/ip/ipsec/peer'
      });
      
             // If REST API returns data, use it
       if (restResult.success && restResult.data && Array.isArray(restResult.data) && restResult.data.length > 0) {
         console.log(`✅ [RouterOSClient] IPsec peers retrieved via REST API: ${restResult.data.length} peers`);
         console.log(`📊 [RouterOSClient] Raw peers data sample:`, JSON.stringify(restResult.data.slice(0, 2), null, 2));
         return restResult;
       }
      
      // Fallback to SSH if REST API returns empty or fails
      console.log(`🔄 REST API returned empty/failed, falling back to SSH for IPsec peers`);
      return await this.getIPsecPeersViaSSH();
    } catch (error) {
      // If REST API completely fails, use SSH
      console.log(`❌ REST API failed, using SSH fallback for IPsec peers`);
      return await this.getIPsecPeersViaSSH();
    }
  }

  /**
   * Get IPsec profiles
   */
  async getIPsecProfiles(): Promise<RouterOSResponse<any[]>> {
    try {
      // Try REST API first
      const restResult = await this.request<any[]>({
        method: 'GET',
        path: '/ip/ipsec/profile'
      });
      
             // If REST API returns data, use it
       if (restResult.success && restResult.data && Array.isArray(restResult.data) && restResult.data.length > 0) {
         console.log(`✅ [RouterOSClient] IPsec profiles retrieved via REST API: ${restResult.data.length} profiles`);
         console.log(`📊 [RouterOSClient] Raw profiles data sample:`, JSON.stringify(restResult.data.slice(0, 2), null, 2));
         return restResult;
       }
      
      // Fallback to SSH if REST API returns empty or fails
      console.log(`🔄 REST API returned empty/failed, falling back to SSH for IPsec profiles`);
      return await this.getIPsecProfilesViaSSH();
    } catch (error) {
      // If REST API completely fails, use SSH
      console.log(`❌ REST API failed, using SSH fallback for IPsec profiles`);
      return await this.getIPsecProfilesViaSSH();
    }
  }

  /**
   * Add IPsec policy
   */
  async addIPsecPolicy(policy: {
    'src-address'?: string;
    'dst-address'?: string;
    protocol?: string;
    action?: string;
    tunnel?: boolean;
    peer?: string;
    proposal?: string;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/ipsec/policy',
      data: policy
    });
  }

  /**
   * Update IPsec policy
   */
  async updateIPsecPolicy(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/ipsec/policy/${id}`,
      data: updates
    });
  }

  /**
   * Remove IPsec policy
   */
  async removeIPsecPolicy(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/ipsec/policy/${id}`
    });
  }

  /**
   * Add IPsec peer
   */
  async addIPsecPeer(peer: {
    name?: string;
    address?: string;
    'local-address'?: string;
    'exchange-mode'?: string;
    profile?: string;
    passive?: boolean;
    'send-initial-contact'?: boolean;
    'nat-traversal'?: boolean;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/ipsec/peer',
      data: peer
    });
  }

  /**
   * Update IPsec peer
   */
  async updateIPsecPeer(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/ipsec/peer/${id}`,
      data: updates
    });
  }

  /**
   * Remove IPsec peer
   */
  async removeIPsecPeer(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/ipsec/peer/${id}`
    });
  }

  /**
   * Add IPsec profile
   */
  async addIPsecProfile(profile: {
    name: string;
    'dh-group'?: string;
    'enc-algorithm'?: string;
    'hash-algorithm'?: string;
    lifetime?: string;
    'nat-traversal'?: boolean;
    'dpd-interval'?: string;
    'dpd-maximum-failures'?: number;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/ipsec/profile',
      data: profile
    });
  }

  /**
   * Update IPsec profile
   */
  async updateIPsecProfile(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/ipsec/profile/${id}`,
      data: updates
    });
  }

  /**
   * Remove IPsec profile
   */
  async removeIPsecProfile(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/ipsec/profile/${id}`
    });
  }

  /**
   * Get IPsec identities
   */
  async getIPsecIdentities(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/ipsec/identity'
    });
  }

  /**
   * Add IPsec identity
   */
  async addIPsecIdentity(identity: {
    peer: string;
    'auth-method'?: string;
    secret?: string;
    certificate?: string;
    'generate-policy'?: string;
    'match-by'?: string;
    'mode-config'?: string;
    'policy-template-group'?: string;
    'my-id'?: string;
    'remote-id'?: string;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/ipsec/identity',
      data: identity
    });
  }

  /**
   * Update IPsec identity
   */
  async updateIPsecIdentity(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/ipsec/identity/${id}`,
      data: updates
    });
  }

  /**
   * Remove IPsec identity
   */
  async removeIPsecIdentity(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/ipsec/identity/${id}`
    });
  }

  /**
   * Get IPsec proposals
   */
  async getIPsecProposals(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/ipsec/proposal'
    });
  }

  /**
   * Add IPsec proposal
   */
  async addIPsecProposal(proposal: {
    name: string;
    'auth-algorithms'?: string;
    'enc-algorithms'?: string;
    'pfs-group'?: string;
    lifetime?: string;
    comment?: string;
  }): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PUT',
      path: '/ip/ipsec/proposal',
      data: proposal
    });
  }

  /**
   * Update IPsec proposal
   */
  async updateIPsecProposal(id: string, updates: any): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'PATCH',
      path: `/ip/ipsec/proposal/${id}`,
      data: updates
    });
  }

  /**
   * Remove IPsec proposal
   */
  async removeIPsecProposal(id: string): Promise<RouterOSResponse<void>> {
    return this.request<void>({
      method: 'DELETE',
      path: `/ip/ipsec/proposal/${id}`
    });
  }

  /**
   * Get active IPsec peers
   */
  async getIPsecActivePeers(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/ipsec/active-peers'
    });
  }

  /**
   * Get installed IPsec SAs (Security Associations)
   */
  async getIPsecInstalledSAs(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/ipsec/installed-sa'
    });
  }

  /**
   * Get IPsec statistics
   */
  async getIPsecStatistics(): Promise<RouterOSResponse<any[]>> {
    return this.request<any[]>({
      method: 'GET',
      path: '/ip/ipsec/statistics'
    });
  }

  /**
   * Kill IPsec SA (Security Association)
   */
  async killIPsecSA(saId: string): Promise<RouterOSResponse<any>> {
    return this.request<any>({
      method: 'POST',
      path: '/ip/ipsec/installed-sa/kill-sa',
      data: { 'numbers': saId }
    });
  }

  /**
   * Create IPsec site-to-site tunnel configuration
   */
  async createIPsecSiteToSite(config: {
    deviceId: string;
    remotePeerIP: string;
    localNetworks: string[];
    remoteNetworks: string[];
    psk: string;
    profileName?: string;
    peerName?: string;
  }): Promise<RouterOSResponse<any>> {
    const { remotePeerIP, localNetworks, remoteNetworks, psk, profileName, peerName } = config;
    
    const finalProfileName = profileName || `site2site-${Date.now()}`;
    const finalPeerName = peerName || `peer-${remotePeerIP.replace(/\./g, '-')}`;

    try {
      // Create profile
      const profileResult = await this.addIPsecProfile({
        name: finalProfileName,
        'dh-group': 'modp2048',
        'enc-algorithm': 'aes-256',
        'hash-algorithm': 'sha256',
        lifetime: '1d',
        'nat-traversal': true
      });

      if (!profileResult.success) {
        return { success: false, error: `Failed to create profile: ${profileResult.error}`, status: 500 };
      }

      // Create peer
      const peerResult = await this.addIPsecPeer({
        name: finalPeerName,
        address: remotePeerIP,
        'exchange-mode': 'ike2',
        profile: finalProfileName,
        'send-initial-contact': true,
        'nat-traversal': true
      });

      if (!peerResult.success) {
        return { success: false, error: `Failed to create peer: ${peerResult.error}`, status: 500 };
      }

      // Create identity
      const identityResult = await this.addIPsecIdentity({
        peer: finalPeerName,
        'auth-method': 'pre-shared-key',
        secret: psk,
        'generate-policy': 'port-strict'
      });

      if (!identityResult.success) {
        return { success: false, error: `Failed to create identity: ${identityResult.error}`, status: 500 };
      }

      // Create policies for each network pair
      const policies = [];
      for (const localNet of localNetworks) {
        for (const remoteNet of remoteNetworks) {
          const policyResult = await this.addIPsecPolicy({
            'src-address': localNet,
            'dst-address': remoteNet,
            tunnel: true,
            action: 'encrypt',
            peer: finalPeerName
          });

          if (policyResult.success) {
            policies.push(policyResult.data);
          }
        }
      }

      return {
        success: true,
        data: {
          profile: profileResult.data,
          peer: peerResult.data,
          identity: identityResult.data,
          policies: policies
        },
        status: 200
      };

    } catch (error) {
      return {
        success: false,
        error: `Site-to-site setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Make a request to the RouterOS REST API
   */
  private async request<T>(requestConfig: RouterOSRequest): Promise<RouterOSResponse<T>> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const response = await this.makeHTTPRequest<T>(requestConfig);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry authentication errors
        if (error instanceof Error && error.message.includes('401')) {
          break;
        }
        
        // Wait before retrying
        if (attempt < this.options.retryAttempts) {
          await this.delay(this.options.retryDelay * attempt);
        }
      }
    }
    
    throw this.createConnectionError(lastError);
  }

  /**
   * Make HTTP/HTTPS request to RouterOS device
   */
  private async makeHTTPRequest<T>(requestConfig: RouterOSRequest): Promise<RouterOSResponse<T>> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.options.apiPath + requestConfig.path, 
        `${this.options.useSSL ? 'https' : 'http'}://${this.options.host}:${this.options.port}`);
      
      // Add query parameters
      if (requestConfig.params) {
        Object.entries(requestConfig.params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }

      const requestOptions: https.RequestOptions = {
        hostname: this.options.host,
        port: this.options.port,
        path: url.pathname + url.search,
        method: requestConfig.method,
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64'),
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        agent: this.agent,
        timeout: this.options.timeout
      };

      const req = (this.options.useSSL ? https : http).request(requestOptions, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              // Handle empty response body for commands like 'enable'/'disable'
              if (responseBody.length === 0) {
                resolve({ success: true, data: {} as T, status: res.statusCode });
                return;
              }
              const parsedBody = JSON.parse(responseBody);
              resolve({ success: true, data: parsedBody, status: res.statusCode });
            } catch (error) {
                const parseError = error instanceof Error ? error : new Error('Unknown parsing error');
                reject(new Error(`Failed to parse response body as JSON: ${parseError.message}`));
            }
          } else {
             let errorMessage = `Request failed with status ${res.statusCode}`;
              try {
                const errorBody = JSON.parse(responseBody);
                errorMessage += `: ${errorBody.message || errorBody.detail || responseBody}`;
              } catch (e) {
                errorMessage += `: ${responseBody}`;
              }
              reject(new Error(errorMessage));
          }
        });
      });

      req.on('error', (error) => {
        reject(this.createConnectionError(error));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      // Write request body if present
      if (requestConfig.data && ['POST', 'PUT', 'PATCH'].includes(requestConfig.method)) {
        const body = JSON.stringify(requestConfig.data);
        req.setHeader('Content-Length', Buffer.byteLength(body));
        req.write(body);
      }

      req.end();
    });
  }

  /**
   * Create a standardized connection error
   */
  private createConnectionError(originalError?: Error): ConnectionError {
    let code: ConnectionError['code'] = 'CONNECTION_FAILED';
    let message = 'Failed to connect to RouterOS device';

    if (originalError) {
      if (originalError.message.includes('401') || 
          originalError.message.includes('authentication') ||
          originalError.message.includes('unauthorized')) {
        code = 'AUTHENTICATION_FAILED';
        message = 'Authentication failed - check username and password';
      } else if (originalError.message.includes('timeout')) {
        code = 'TIMEOUT';
        message = 'Connection timeout - device may be unreachable';
      } else if (originalError.message.includes('SSL') || 
                 originalError.message.includes('certificate') ||
                 originalError.message.includes('TLS')) {
        code = 'SSL_ERROR';
        message = 'SSL/TLS error - check certificate settings';
      } else {
        message = originalError.message;
      }
    }

    const error = new Error(message) as ConnectionError;
    error.code = code;
    error.host = this.options.host;
    error.port = this.options.port;
    error.originalError = originalError;
    
    return error;
  }

  /**
   * Delay function for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close the client and clean up connections
   */
  public close(): void {
    if (this.agent && this.agent.destroy) {
      this.agent.destroy();
    }
  }

  /**
   * Get IPsec policies via SSH (since REST API doesn't support this)
   */
  async getIPsecPoliciesViaSSH(): Promise<RouterOSResponse<any[]>> {
    try {
      console.log(`📋 Getting IPsec policies via SSH for: ${this.options.host}`);
      
      const ssh = new SSHClient();
      
      return new Promise((resolve, reject) => {
        let commandOutput = '';
        let errorOutput = '';
        
        ssh.on('ready', () => {
          console.log(`✅ SSH connection established for IPsec policies`);
          
          // Execute IPsec policy print command
          const command = '/ip ipsec policy print detail without-paging';
          console.log(`🔄 Executing command: ${command}`);
          
          ssh.exec(command, (err: any, stream: any) => {
            if (err) {
              console.error(`❌ SSH exec error:`, err);
              ssh.end();
              return reject(err);
            }
            
            stream.on('close', (code: number) => {
              console.log(`📤 SSH command completed with code: ${code}`);
              ssh.end();
              
              if (code === 0) {
                console.log(`✅ IPsec policies retrieved successfully via SSH`);
                const policies = this.parseIPsecPoliciesFromSSH(commandOutput);
                resolve({
                  success: true,
                  data: policies,
                  status: 200
                });
              } else {
                console.error(`❌ SSH command failed with exit code: ${code}`);
                resolve({
                  success: false,
                  error: `SSH command failed with exit code ${code}: ${errorOutput || commandOutput}`,
                  status: 500
                });
              }
            });
            
            stream.on('data', (data: Buffer) => {
              const output = data.toString();
              commandOutput += output;
              console.log(`📤 SSH output:`, output.trim());
            });
            
            stream.stderr.on('data', (data: Buffer) => {
              const error = data.toString();
              errorOutput += error;
              console.error(`📤 SSH error:`, error.trim());
            });
          });
        });
        
        ssh.on('error', (err: any) => {
          console.error(`❌ SSH connection error for IPsec policies:`, err);
          reject(err);
        });
        
        // Use SSH key authentication if available, fallback to password
        const connectOptions: any = {
          host: this.options.host,
          port: 22,
          username: this.options.username,
          readyTimeout: 10000,
          keepaliveInterval: 5000
        };

        if (this.options.sshPrivateKey) {
          console.log('🔑 Using SSH key authentication for IPsec policies');
          connectOptions.privateKey = this.options.sshPrivateKey;
        } else {
          console.log('🔐 Using password authentication for IPsec policies');
          connectOptions.password = this.options.password;
        }
        
        ssh.connect(connectOptions);
      });
    } catch (error) {
      return {
        success: false,
        error: `IPsec policies SSH retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Get IPsec peers via SSH
   */
  async getIPsecPeersViaSSH(): Promise<RouterOSResponse<any[]>> {
    try {
      console.log(`📋 Getting IPsec peers via SSH for: ${this.options.host}`);
      
      const ssh = new SSHClient();
      
      return new Promise((resolve, reject) => {
        let commandOutput = '';
        let errorOutput = '';
        
        ssh.on('ready', () => {
          console.log(`✅ SSH connection established for IPsec peers`);
          
          const command = '/ip ipsec peer print detail without-paging';
          console.log(`🔄 Executing command: ${command}`);
          
          ssh.exec(command, (err: any, stream: any) => {
            if (err) {
              console.error(`❌ SSH exec error:`, err);
              ssh.end();
              return reject(err);
            }
            
            stream.on('close', (code: number) => {
              console.log(`📤 SSH command completed with code: ${code}`);
              ssh.end();
              
              if (code === 0) {
                console.log(`✅ IPsec peers retrieved successfully via SSH`);
                const peers = this.parseIPsecPeersFromSSH(commandOutput);
                resolve({
                  success: true,
                  data: peers,
                  status: 200
                });
              } else {
                console.error(`❌ SSH command failed with exit code: ${code}`);
                resolve({
                  success: false,
                  error: `SSH command failed with exit code ${code}: ${errorOutput || commandOutput}`,
                  status: 500
                });
              }
            });
            
            stream.on('data', (data: Buffer) => {
              const output = data.toString();
              commandOutput += output;
            });
            
            stream.stderr.on('data', (data: Buffer) => {
              const error = data.toString();
              errorOutput += error;
            });
          });
        });
        
        ssh.on('error', (err: any) => {
          console.error(`❌ SSH connection error for IPsec peers:`, err);
          reject(err);
        });
        
        const connectOptions: any = {
          host: this.options.host,
          port: 22,
          username: this.options.username,
          readyTimeout: 10000,
          keepaliveInterval: 5000
        };

        if (this.options.sshPrivateKey) {
          connectOptions.privateKey = this.options.sshPrivateKey;
        } else {
          connectOptions.password = this.options.password;
        }
        
        ssh.connect(connectOptions);
      });
    } catch (error) {
      return {
        success: false,
        error: `IPsec peers SSH retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Get IPsec profiles via SSH
   */
  async getIPsecProfilesViaSSH(): Promise<RouterOSResponse<any[]>> {
    try {
      console.log(`📋 Getting IPsec profiles via SSH for: ${this.options.host}`);
      
      const ssh = new SSHClient();
      
      return new Promise((resolve, reject) => {
        let commandOutput = '';
        let errorOutput = '';
        
        ssh.on('ready', () => {
          console.log(`✅ SSH connection established for IPsec profiles`);
          
          const command = '/ip ipsec profile print detail without-paging';
          console.log(`🔄 Executing command: ${command}`);
          
          ssh.exec(command, (err: any, stream: any) => {
            if (err) {
              console.error(`❌ SSH exec error:`, err);
              ssh.end();
              return reject(err);
            }
            
            stream.on('close', (code: number) => {
              console.log(`📤 SSH command completed with code: ${code}`);
              ssh.end();
              
              if (code === 0) {
                console.log(`✅ IPsec profiles retrieved successfully via SSH`);
                const profiles = this.parseIPsecProfilesFromSSH(commandOutput);
                resolve({
                  success: true,
                  data: profiles,
                  status: 200
                });
              } else {
                console.error(`❌ SSH command failed with exit code: ${code}`);
                resolve({
                  success: false,
                  error: `SSH command failed with exit code ${code}: ${errorOutput || commandOutput}`,
                  status: 500
                });
              }
            });
            
            stream.on('data', (data: Buffer) => {
              const output = data.toString();
              commandOutput += output;
            });
            
            stream.stderr.on('data', (data: Buffer) => {
              const error = data.toString();
              errorOutput += error;
            });
          });
        });
        
        ssh.on('error', (err: any) => {
          console.error(`❌ SSH connection error for IPsec profiles:`, err);
          reject(err);
        });
        
        const connectOptions: any = {
          host: this.options.host,
          port: 22,
          username: this.options.username,
          readyTimeout: 10000,
          keepaliveInterval: 5000
        };

        if (this.options.sshPrivateKey) {
          connectOptions.privateKey = this.options.sshPrivateKey;
        } else {
          connectOptions.password = this.options.password;
        }
        
        ssh.connect(connectOptions);
      });
    } catch (error) {
      return {
        success: false,
        error: `IPsec profiles SSH retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 500
      };
    }
  }

  /**
   * Parse IPsec policies from SSH command output
   */
  private parseIPsecPoliciesFromSSH(output: string): any[] {
    const policies: any[] = [];
    const lines = output.split('\n');
    let currentPolicy: any = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.match(/^\d+/)) {
        // New policy entry
        if (Object.keys(currentPolicy).length > 0) {
          policies.push(currentPolicy);
        }
        currentPolicy = {};
        
        // Parse the header line for basic info
        const headerMatch = trimmedLine.match(/^(\d+)\s+([XD\s]*)\s*(.*)/);
        if (headerMatch && headerMatch[1] && headerMatch[2]) {
          currentPolicy['.id'] = `*${headerMatch[1]}`;
          currentPolicy.disabled = headerMatch[2].includes('X') ? 'true' : 'false';
          currentPolicy.dynamic = headerMatch[2].includes('D') ? 'true' : 'false';
        }
      } else if (trimmedLine.includes('=')) {
        // Property line
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          currentPolicy[key.trim()] = value;
        }
      }
    }
    
    // Add the last policy
    if (Object.keys(currentPolicy).length > 0) {
      policies.push(currentPolicy);
    }
    
    return policies;
  }

  /**
   * Parse IPsec peers from SSH command output
   */
  private parseIPsecPeersFromSSH(output: string): any[] {
    const peers: any[] = [];
    const lines = output.split('\n');
    let currentPeer: any = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.match(/^\d+/)) {
        // New peer entry
        if (Object.keys(currentPeer).length > 0) {
          peers.push(currentPeer);
        }
        currentPeer = {};
        
        // Parse the header line for basic info
        const headerMatch = trimmedLine.match(/^(\d+)\s+([XD\s]*)\s*(.*)/);
        if (headerMatch && headerMatch[1] && headerMatch[2]) {
          currentPeer['.id'] = `*${headerMatch[1]}`;
          currentPeer.disabled = headerMatch[2].includes('X') ? 'true' : 'false';
          currentPeer.dynamic = headerMatch[2].includes('D') ? 'true' : 'false';
        }
      } else if (trimmedLine.includes('=')) {
        // Property line
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          currentPeer[key.trim()] = value;
        }
      }
    }
    
    // Add the last peer
    if (Object.keys(currentPeer).length > 0) {
      peers.push(currentPeer);
    }
    
    return peers;
  }

  /**
   * Parse IPsec profiles from SSH command output
   */
  private parseIPsecProfilesFromSSH(output: string): any[] {
    const profiles: any[] = [];
    const lines = output.split('\n');
    let currentProfile: any = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.match(/^\d+/)) {
        // New profile entry
        if (Object.keys(currentProfile).length > 0) {
          profiles.push(currentProfile);
        }
        currentProfile = {};
        
        // Parse the header line for basic info
        const headerMatch = trimmedLine.match(/^(\d+)\s+([XD\s]*)\s*(.*)/);
        if (headerMatch && headerMatch[1] && headerMatch[2]) {
          currentProfile['.id'] = `*${headerMatch[1]}`;
          currentProfile.disabled = headerMatch[2].includes('X') ? 'true' : 'false';
          currentProfile.dynamic = headerMatch[2].includes('D') ? 'true' : 'false';
        }
      } else if (trimmedLine.includes('=')) {
        // Property line
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          currentProfile[key.trim()] = value;
        }
      }
    }
    
    // Add the last profile
    if (Object.keys(currentProfile).length > 0) {
      profiles.push(currentProfile);
    }
    
    return profiles;
  }
}

/**
 * Factory function to create RouterOS client
 */
export function createRouterOSClient(options: RouterOSClientOptions): RouterOSClient {
  return new RouterOSClient(options);
}

export default RouterOSClient; 