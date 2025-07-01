/**
 * Device-related TypeScript interfaces
 * 
 * Defines data structures for device management, monitoring,
 * and API responses in the network monitoring portal.
 */

// ==================== DEVICE MANAGEMENT ====================

export interface Device {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  username: string;
  useSSL: boolean;
  status: DeviceStatus;
  lastSeen: Date | null;
  lastError: string | null;
  connectionAttempts: number;
  deviceType: string | null;
  routerosVersion: string | null;
  architecture: string | null;
  boardName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DeviceStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export interface DeviceCreateInput {
  name: string;
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  useSSL: boolean;
  comment?: string;
}

export interface DeviceUpdateInput extends Partial<DeviceCreateInput> {}

export interface DeviceTestConnectionInput {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  useSSL: boolean;
}

export interface DeviceConnectionTest {
  success: boolean;
  message: string;
  routerosVersion?: string;
  deviceType?: string;
  architecture?: string;
  boardName?: string;
}

export interface DeviceConnectionTestResult {
  success: boolean;
  status: string;
  message: string;
  deviceInfo?: {
    name?: string;
    version?: string;
    boardName?: string;
    architecture?: string;
    uptime?: string;
  };
}

// ==================== DEVICE DISCOVERY ====================

export interface DeviceDiscoveryRequest {
  networkRange: string; // CIDR notation (e.g., "192.168.1.0/24")
  port?: number;
  useSSL?: boolean;
  timeout?: number;
}

export interface DiscoveredDevice {
  ipAddress: string;
  port: number;
  reachable: boolean;
  isRouterOS: boolean;
  deviceInfo?: {
    name?: string;
    version?: string;
    boardName?: string;
  };
}

export interface DeviceDiscoveryResult {
  discoveredDevices: DiscoveredDevice[];
  totalScanned: number;
  totalReachable: number;
}

// ==================== DEVICE MONITORING ====================

export interface DeviceMonitoringData {
  deviceId: string;
  timestamp: Date;
  system: SystemMetrics;
  interfaces: InterfaceMetrics[];
  network: NetworkMetrics;
  performance: PerformanceMetrics;
}

export interface SystemMetrics {
  cpuLoad: number; // Percentage (0-100)
  memoryUsage: MemoryMetrics;
  storageUsage: StorageMetrics;
  temperature?: number; // Celsius
  voltage?: number; // Volts
  uptime: string;
  processes?: number;
}

export interface MemoryMetrics {
  total: number; // Bytes
  used: number; // Bytes
  free: number; // Bytes
  percentage: number; // Percentage (0-100)
}

export interface StorageMetrics {
  total: number; // Bytes
  used: number; // Bytes
  free: number; // Bytes
  percentage: number; // Percentage (0-100)
}

export interface InterfaceMetrics {
  name: string;
  type: string;
  status: 'up' | 'down' | 'disabled';
  speed?: string; // e.g., "1Gbps"
  duplex?: 'full' | 'half';
  macAddress?: string;
  mtu: number;
  traffic: TrafficMetrics;
  errors: ErrorMetrics;
}

export interface TrafficMetrics {
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxBitsPerSecond: number;
  txBitsPerSecond: number;
  rxPacketsPerSecond: number;
  txPacketsPerSecond: number;
}

export interface ErrorMetrics {
  rxErrors: number;
  txErrors: number;
  rxDrops: number;
  txDrops: number;
  collisions: number;
}

export interface NetworkMetrics {
  routes: RouteMetrics;
  arp: ArpMetrics;
  dhcp: DhcpMetrics;
  firewall: FirewallMetrics;
}

export interface RouteMetrics {
  totalRoutes: number;
  activeRoutes: number;
  staticRoutes: number;
  dynamicRoutes: number;
}

export interface ArpMetrics {
  totalEntries: number;
  dynamicEntries: number;
  staticEntries: number;
}

export interface DhcpMetrics {
  totalLeases: number;
  activeLeases: number;
  availableAddresses: number;
  leaseUtilization: number; // Percentage
}

export interface FirewallMetrics {
  totalRules: number;
  activeConnections: number;
  blockedConnections: number;
  allowedConnections: number;
}

export interface PerformanceMetrics {
  responseTime: number; // Milliseconds
  availability: number; // Percentage (0-100)
  packetLoss: number; // Percentage (0-100)
  throughput: ThroughputMetrics;
}

export interface ThroughputMetrics {
  upload: number; // Bits per second
  download: number; // Bits per second
  total: number; // Bits per second
}

// ==================== DEVICE GROUPS ====================

export interface DeviceGroup {
  id: number;
  name: string;
  description?: string;
  color: string;
  deviceCount: number;
  createdAt: Date;
}

export interface DeviceGroupMembership {
  deviceId: string;
  groupId: number;
}

export interface DeviceGroupCreateInput {
  name: string;
  description?: string;
  color?: string;
}

export interface DeviceGroupUpdateInput {
  name?: string;
  description?: string;
  color?: string;
}

// ==================== ALERT CONFIGURATION ====================

export interface AlertRule {
  id: number;
  deviceId?: string; // null for global rules
  name: string;
  metricType: 'system' | 'interface' | 'network' | 'custom';
  metricName: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isEnabled: boolean;
  notificationChannels: string[]; // JSON array of notification methods
  createdAt: Date;
  updatedAt: Date;
}

export interface Alert {
  id: number;
  deviceId: string;
  ruleId?: number;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metricValue?: number;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface AlertRuleCreateInput {
  deviceId?: string;
  name: string;
  metricType: AlertRule['metricType'];
  metricName: string;
  condition: AlertRule['condition'];
  threshold: number;
  severity: AlertRule['severity'];
  isEnabled?: boolean;
  notificationChannels?: string[];
}

export interface AlertRuleUpdateInput {
  name?: string;
  metricType?: AlertRule['metricType'];
  metricName?: string;
  condition?: AlertRule['condition'];
  threshold?: number;
  severity?: AlertRule['severity'];
  isEnabled?: boolean;
  notificationChannels?: string[];
}

// ==================== CONFIGURATION BACKUP ====================

export interface ConfigurationBackup {
  id: number;
  deviceId: string;
  backupName: string;
  backupData: string; // Base64 or text content
  backupType: 'manual' | 'scheduled' | 'auto';
  fileSize: number;
  createdAt: Date;
}

export interface ConfigurationBackupCreateInput {
  deviceId: string;
  backupName: string;
  backupType?: ConfigurationBackup['backupType'];
}

// ==================== API RESPONSES ====================

export interface DevicesResponse {
  devices: Device[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeviceMonitoringResponse {
  deviceId: string;
  data: DeviceMonitoringData;
  timestamp: Date;
}

export interface DeviceHistoricalDataResponse {
  deviceId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  interval: 'minute' | 'hour' | 'day' | 'week' | 'month';
  systemMetrics: SystemMetrics[];
  interfaceMetrics: InterfaceMetrics[];
}

// ==================== QUERY PARAMETERS ====================

export interface DeviceQueryParams {
  status?: DeviceStatus;
  groupId?: number;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'name' | 'ipAddress' | 'status' | 'lastSeen' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface MonitoringQueryParams {
  timeRange?: {
    start: Date;
    end: Date;
  };
  interval?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  metrics?: string[]; // Array of metric names to include
}

// ==================== WEBSOCKET EVENTS ====================

export interface DeviceStatusUpdate {
  type: 'device_status_update';
  deviceId: string;
  status: DeviceStatus;
  timestamp: Date;
}

export interface DeviceMetricsUpdate {
  type: 'device_metrics_update';
  deviceId: string;
  metrics: DeviceMonitoringData;
  timestamp: Date;
}

export interface AlertTriggered {
  type: 'alert_triggered';
  alert: Alert;
  timestamp: Date;
}

export type WebSocketEvent = DeviceStatusUpdate | DeviceMetricsUpdate | AlertTriggered;

// ==================== ERROR TYPES ====================

export interface DeviceError {
  code: string;
  message: string;
  deviceId?: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: ValidationError[];
  timestamp: Date;
} 