/**
 * RouterOS REST API Client
 * 
 * A comprehensive client for connecting to and managing RouterOS devices
 * via their REST API. Supports authentication, HTTPS, error handling,
 * and retry logic for robust network monitoring.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import type {
  RouterOSClientOptions,
  RouterOSResponse,
  RouterOSRequest,
  RouterOSListQuery,
  SystemResource,
  SystemIdentity,
  SystemRouterboard,
  SystemHealth,
  RouterOSInterface,
  InterfaceTrafficData,
  IPAddress,
  IPRoute,
  ARPEntry,
  DHCPServer,
  DHCPLease,
  FirewallRule,
  FirewallNATRule,
  WiFiRegistrationEntry,
  ConnectionError,
  RouterOSError,
  DeviceStatus,
  SystemMetrics,
  InterfaceMetrics
} from '../../types/routeros';

export class RouterOSClient {
  private readonly options: Required<RouterOSClientOptions>;
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
      retryDelay: options.retryDelay ?? 1000
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
         lastSeen: new Date(),
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

  // ==================== SYSTEM INFORMATION ====================

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
   * Get system routerboard information
   */
  async getSystemRouterboard(): Promise<RouterOSResponse<SystemRouterboard>> {
    return this.request<SystemRouterboard>({
      method: 'GET',
      path: '/system/routerboard'
    });
  }

  /**
   * Get system health information (temperature, voltage, etc.)
   */
  async getSystemHealth(): Promise<RouterOSResponse<SystemHealth>> {
    return this.request<SystemHealth>({
      method: 'GET',
      path: '/system/health'
    });
  }

  /**
   * Get formatted system metrics for monitoring
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const resourceResponse = await this.getSystemResource();
    
    if (!resourceResponse.success || !resourceResponse.data) {
      throw new Error('Failed to get system metrics');
    }

    const resource = resourceResponse.data;
    
    // Parse CPU load percentage
    const cpuLoadString = resource['cpu-load'] || '';
    const cpuLoadMatch = cpuLoadString.match(/(\d+)%/);
    const cpuLoad = cpuLoadMatch ? parseInt(cpuLoadMatch[1], 10) : 0;

    // Parse memory values
    const freeMemory = resource['free-memory'] || 0;
    const totalMemory = resource['total-memory'] || 0;

    // Parse storage values
    const freeHddSpace = resource['free-hdd-space'] || 0;
    const totalHddSpace = resource['total-hdd-space'] || 0;

    // Try to get health information for temperature
    let temperature: number | undefined;
    try {
      const healthResponse = await this.getSystemHealth();
      if (healthResponse.success && healthResponse.data?.temperature) {
        const tempString = healthResponse.data.temperature || '';
        const tempMatch = tempString.match(/(\d+(?:\.\d+)?)/);
        temperature = tempMatch ? parseFloat(tempMatch[1]) : undefined;
      }
    } catch {
      // Health endpoint might not be available on all devices
    }

    return {
      cpuLoad,
      freeMemory,
      totalMemory,
      freeHddSpace,
      totalHddSpace,
      temperature,
      voltage: undefined, // TODO: Parse from health if needed
      uptime: resource.uptime || '',
      timestamp: new Date()
    };
  }

  // ==================== INTERFACE MANAGEMENT ====================

  /**
   * Get all network interfaces
   */
  async getInterfaces(query?: RouterOSListQuery): Promise<RouterOSResponse<RouterOSInterface[]>> {
    return this.request<RouterOSInterface[]>({
      method: 'GET',
      path: '/interface',
      params: query
    });
  }

  /**
   * Get specific interface by ID
   */
  async getInterface(id: string): Promise<RouterOSResponse<RouterOSInterface>> {
    return this.request<RouterOSInterface>({
      method: 'GET',
      path: `/interface/${id}`
    });
  }

  /**
   * Monitor interface traffic
   */
  async monitorInterfaceTraffic(interfaceNames: string[]): Promise<RouterOSResponse<InterfaceTrafficData[]>> {
    return this.request<InterfaceTrafficData[]>({
      method: 'POST',
      path: '/interface/monitor-traffic',
      data: {
        interface: interfaceNames.join(','),
        duration: '1'
      }
    });
  }

  /**
   * Get formatted interface metrics for monitoring
   */
  async getInterfaceMetrics(): Promise<InterfaceMetrics[]> {
    const interfacesResponse = await this.getInterfaces();
    
    if (!interfacesResponse.success || !interfacesResponse.data) {
      throw new Error('Failed to get interface metrics');
    }

    return interfacesResponse.data.map(iface => ({
      name: iface.name,
      type: iface.type,
      status: iface.running ? 'running' : 'down',
      rxBytes: iface['rx-byte'] || 0,
      txBytes: iface['tx-byte'] || 0,
      rxPackets: iface['rx-packet'] || 0,
      txPackets: iface['tx-packet'] || 0,
      rxErrors: iface['rx-error'] || 0,
      txErrors: iface['tx-error'] || 0,
      rxDrops: iface['rx-drop'] || 0,
      txDrops: iface['tx-drop'] || 0,
      linkSpeed: undefined, // TODO: Extract from specific interface types
      macAddress: iface['mac-address'],
      mtu: iface.mtu,
      timestamp: new Date()
    }));
  }

  // ==================== IP & NETWORKING ====================

  /**
   * Get IP addresses
   */
  async getIPAddresses(query?: RouterOSListQuery): Promise<RouterOSResponse<IPAddress[]>> {
    return this.request<IPAddress[]>({
      method: 'GET',
      path: '/ip/address',
      params: query
    });
  }

  /**
   * Get routing table
   */
  async getRoutes(query?: RouterOSListQuery): Promise<RouterOSResponse<IPRoute[]>> {
    return this.request<IPRoute[]>({
      method: 'GET',
      path: '/ip/route',
      params: query
    });
  }

  /**
   * Get ARP table
   */
  async getARPEntries(query?: RouterOSListQuery): Promise<RouterOSResponse<ARPEntry[]>> {
    return this.request<ARPEntry[]>({
      method: 'GET',
      path: '/ip/arp',
      params: query
    });
  }

  // ==================== DHCP SERVICES ====================

  /**
   * Get DHCP servers
   */
  async getDHCPServers(query?: RouterOSListQuery): Promise<RouterOSResponse<DHCPServer[]>> {
    return this.request<DHCPServer[]>({
      method: 'GET',
      path: '/ip/dhcp-server',
      params: query
    });
  }

  /**
   * Get DHCP leases
   */
  async getDHCPLeases(query?: RouterOSListQuery): Promise<RouterOSResponse<DHCPLease[]>> {
    return this.request<DHCPLease[]>({
      method: 'GET',
      path: '/ip/dhcp-server/lease',
      params: query
    });
  }

  // ==================== FIREWALL & SECURITY ====================

  /**
   * Get firewall filter rules
   */
  async getFirewallRules(query?: RouterOSListQuery): Promise<RouterOSResponse<FirewallRule[]>> {
    return this.request<FirewallRule[]>({
      method: 'GET',
      path: '/ip/firewall/filter',
      params: query
    });
  }

  /**
   * Get firewall NAT rules
   */
  async getNATRules(query?: RouterOSListQuery): Promise<RouterOSResponse<FirewallNATRule[]>> {
    return this.request<FirewallNATRule[]>({
      method: 'GET',
      path: '/ip/firewall/nat',
      params: query
    });
  }

  // ==================== WIFI & WIRELESS ====================

  /**
   * Get WiFi registration table (connected clients)
   */
  async getWiFiClients(query?: RouterOSListQuery): Promise<RouterOSResponse<WiFiRegistrationEntry[]>> {
    return this.request<WiFiRegistrationEntry[]>({
      method: 'GET',
      path: '/interface/wifi/registration-table',
      params: query
    });
  }

  // ==================== CORE REQUEST METHODS ====================

  /**
   * Convert RouterOSListQuery to params object, filtering out undefined values
   */
  private convertQueryToParams(query?: RouterOSListQuery): Record<string, string | number | boolean> | undefined {
    if (!query) return undefined;
    
    const params: Record<string, string | number | boolean> = {};
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params[key] = value;
      }
    });
    
    return Object.keys(params).length > 0 ? params : undefined;
  }

  /**
   * Make a request to the RouterOS REST API
   */
  private async request<T>(requestConfig: Omit<RouterOSRequest, 'params'> & { params?: RouterOSListQuery }): Promise<RouterOSResponse<T>> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const actualRequest: RouterOSRequest = {
          ...requestConfig,
          params: this.convertQueryToParams(requestConfig.params)
        };
        const response = await this.makeHTTPRequest<T>(actualRequest);
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
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64')
        },
        agent: this.agent,
        timeout: this.options.timeout
      };

      const httpModule = this.options.useSSL ? https : http;
      const req = httpModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const statusCode = res.statusCode || 0;
            
            if (statusCode >= 200 && statusCode < 300) {
              // Handle empty responses
              if (!data.trim()) {
                resolve({
                  success: true,
                  data: null as T,
                  status: statusCode
                });
                return;
              }

              // Parse JSON response
              let parsedData: T;
              try {
                parsedData = JSON.parse(data);
              } catch (parseError) {
                reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`));
                return;
              }

              resolve({
                success: true,
                data: parsedData,
                status: statusCode
              });
            } else {
              // Handle error responses
              let errorMessage = `HTTP ${statusCode}`;
              try {
                const errorData = JSON.parse(data);
                errorMessage = errorData.message || errorData.error || errorMessage;
              } catch {
                errorMessage = data || errorMessage;
              }

              resolve({
                success: false,
                error: errorMessage,
                status: statusCode
              });
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(this.createConnectionError(error));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(this.createConnectionError(new Error('Request timeout')));
      });

      // Send request body for POST/PUT/PATCH
      if (requestConfig.data && 
          ['POST', 'PUT', 'PATCH'].includes(requestConfig.method)) {
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
    if (this.agent) {
      this.agent.destroy();
    }
  }
}

/**
 * Factory function to create RouterOS client
 */
export function createRouterOSClient(options: RouterOSClientOptions): RouterOSClient {
  return new RouterOSClient(options);
}

export default RouterOSClient; 