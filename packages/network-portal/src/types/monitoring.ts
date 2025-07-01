/**
 * TypeScript interfaces for monitoring data
 * Used by frontend components for system monitoring
 */

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

export interface MonitoringData {
  device: any; // Device from database
  monitoring: {
    isActive: boolean;
    latest: SystemMetrics | null;
    historical: SystemMetrics[];
    timeRange: string;
  };
}

export interface MonitoringOverview {
  totalDevices: number;
  connectedDevices: number;
  disconnectedDevices: number;
  errorDevices: number;
  monitoringStatus: { [deviceId: string]: boolean };
}

export interface MonitoringStatus {
  serviceAvailable: boolean;
  activeDevices: number;
  webSocketClients?: number;
  uptime?: number;
}

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'error' | 'metrics' | 'device-status' | 'interface-metrics-collected';
  deviceId?: string;
  data?: any;
  timestamp?: string;
}

export interface ChartDataPoint {
  timestamp: string;
  cpuLoad: number;
  memoryUsage: number;
  storageUsage: number;
}

export interface DeviceMetrics {
  deviceId: string;
  name: string;
  latest: SystemMetrics | null;
  isMonitoring: boolean;
  lastUpdate?: Date;
}

export interface TimeRange {
  label: string;
  value: string;
  duration: number;
  unit: 'minute' | 'hour' | 'day';
}

export const TIME_RANGES: TimeRange[] = [
    { label: '1 Minute', value: '1m', duration: 1, unit: 'minute' },
    { label: '5 Minutes', value: '5m', duration: 5, unit: 'minute' },
    { label: '15 Minutes', value: '15m', duration: 15, unit: 'minute' },
    { label: '30 Minutes', value: '30m', duration: 30, unit: 'minute' },
    { label: '1 Hour', value: '1h', duration: 1, unit: 'hour' },
    { label: '6 Hours', value: '6h', duration: 6, unit: 'hour' },
    { label: '24 Hours', value: '24h', duration: 24, unit: 'hour' },
    { label: '7 Days', value: '7d', duration: 7, unit: 'day' },
    { label: '30 Days', value: '30d', duration: 30, unit: 'day' }
];

export interface MonitoringConfig {
  refreshInterval: number; // WebSocket reconnection interval
  maxDataPoints: number; // Maximum historical data points to keep in memory
  alertThresholds: {
    cpu: number;
    memory: number;
    storage: number;
  };
} 