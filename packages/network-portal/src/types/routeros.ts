/**
 * RouterOS REST API Type Definitions
 * 
 * Comprehensive TypeScript interfaces for all RouterOS REST API endpoints
 * and data structures for network monitoring and configuration.
 */

// ==================== CORE TYPES ====================

export interface RouterOSCredentials {
  username: string;
  password: string;
}

export interface RouterOSConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useSSL: boolean;
  apiPath: string;
  timeout: number;
  rejectUnauthorized: boolean; // For self-signed certificates
}

export interface RouterOSResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

// ==================== SYSTEM INFORMATION ====================

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

export interface SystemRouterboard {
  routerboard: boolean;
  model: string;
  'serial-number': string;
  firmware: string;
  'current-firmware': string;
  'upgrade-firmware': string;
}

export interface SystemClock {
  time: string;
  date: string;
  'time-zone-autodetect': boolean;
  'time-zone-name': string;
  'gmt-offset': string;
  'dst-active': boolean;
}

export interface SystemHealth {
  voltage: string;
  temperature: string;
  'cpu-temperature'?: string;
  'board-temperature1'?: string;
  'board-temperature2'?: string;
  fan1?: string;
  fan2?: string;
  'power-consumption': string;
  'current-consumption': string;
}

// ==================== INTERFACE MANAGEMENT ====================

export interface RouterOSInterface {
  '.id': string;
  name: string;
  type: string;
  mtu: number;
  'actual-mtu': number;
  'mac-address': string;
  'last-link-down-time': string;
  'last-link-up-time': string;
  'link-downs': number;
  running: boolean;
  disabled: boolean;
  comment?: string;
  'slave-ids'?: string;
  'fp-rx-byte': number;
  'fp-tx-byte': number;
  'fp-rx-packet': number;
  'fp-tx-packet': number;
  'rx-byte': number;
  'tx-byte': number;
  'rx-packet': number;
  'tx-packet': number;
  'rx-error': number;
  'tx-error': number;
  'rx-drop': number;
  'tx-drop': number;
}

export interface EthernetInterface extends RouterOSInterface {
  'auto-negotiation': boolean;
  'advertise': string;
  'link-speed': string;
  'full-duplex': boolean;
  'tx-flow-control': boolean;
  'rx-flow-control': boolean;
}

export interface WiFiInterface extends RouterOSInterface {
  'ssid': string;
  'frequency': string;
  'channel-width': string;
  'tx-power': number;
  'distance': string;
  'tx-power-mode': string;
  'antenna-gain': number;
}

export interface InterfaceTrafficData {
  'interface': string;
  'rx-bits-per-second': number;
  'tx-bits-per-second': number;
  'rx-packets-per-second': number;
  'tx-packets-per-second': number;
  duration: string;
}

// ==================== IP & NETWORKING ====================

export interface IPAddress {
  '.id': string;
  address: string;
  network: string;
  interface: string;
  'actual-interface': string;
  invalid: boolean;
  dynamic: boolean;
  disabled: boolean;
  comment?: string;
}

export interface IPRoute {
  '.id': string;
  'dst-address': string;
  gateway?: string;
  'gateway-status'?: string;
  distance: number;
  scope: number;
  'target-scope': number;
  'suppress-hw-offload': boolean;
  'immediate-gw': string;
  'routing-table': string;
  'rib-id': string;
  'active': boolean;
  'dynamic': boolean;
  'connect': boolean;
  'static': boolean;
  'rip': boolean;
  'bgp': boolean;
  'ospf': boolean;
  'mme': boolean;
  'blackhole': boolean;
  'unreachable': boolean;
  'prohibit': boolean;
  comment?: string;
}

export interface ARPEntry {
  '.id': string;
  address: string;
  'mac-address': string;
  interface: string;
  published: boolean;
  invalid: boolean;
  DHCP: boolean;
  dynamic: boolean;
  complete: boolean;
  disabled: boolean;
  comment?: string;
}

export interface DNSConfiguration {
  servers: string;
  'dynamic-servers': string;
  'use-doh-server': string;
  'verify-doh-cert': boolean;
  'allow-remote-requests': boolean;
  'max-udp-packet-size': number;
  'query-server-timeout': string;
  'query-total-timeout': string;
  'max-concurrent-queries': number;
  'max-concurrent-tcp-sessions': number;
  cache: boolean;
  'cache-size': string;
  'cache-max-ttl': string;
  'cache-used': number;
}

// ==================== DHCP SERVICES ====================

export interface DHCPServer {
  '.id': string;
  name: string;
  interface: string;
  'relay-interface': string;
  'address-pool': string;
  'lease-time': string;
  'add-arp': boolean;
  disabled: boolean;
  comment?: string;
}

export interface DHCPLease {
  '.id': string;
  address: string;
  'mac-address': string;
  'client-id': string;
  server: string;
  'dhcp-option': string;
  status: string;
  'expires-after': string;
  'last-seen': string;
  'active-address': string;
  'active-mac-address': string;
  'active-client-id': string;
  'active-server': string;
  hostname?: string;
  comment?: string;
  dynamic: boolean;
  blocked: boolean;
  disabled: boolean;
}

export interface DHCPNetwork {
  '.id': string;
  address: string;
  gateway: string;
  'netmask': string;
  'dns-server': string;
  'ntp-server': string;
  'wins-server': string;
  'dhcp-option': string;
  'dhcp-option-set': string;
  comment?: string;
  disabled: boolean;
}

// ==================== FIREWALL & SECURITY ====================

export interface FirewallRule {
  '.id': string;
  chain: string;
  action: string;
  'src-address'?: string;
  'dst-address'?: string;
  'src-port'?: string;
  'dst-port'?: string;
  protocol?: string;
  'in-interface'?: string;
  'out-interface'?: string;
  'connection-state'?: string;
  'src-address-list'?: string;
  'dst-address-list'?: string;
  bytes: number;
  packets: number;
  disabled: boolean;
  invalid: boolean;
  dynamic: boolean;
  comment?: string;
}

export interface FirewallNATRule {
  '.id': string;
  chain: string;
  action: string;
  'src-address'?: string;
  'dst-address'?: string;
  'src-port'?: string;
  'dst-port'?: string;
  'to-addresses'?: string;
  'to-ports'?: string;
  protocol?: string;
  'in-interface'?: string;
  'out-interface'?: string;
  bytes: number;
  packets: number;
  disabled: boolean;
  invalid: boolean;
  dynamic: boolean;
  comment?: string;
}

export interface FirewallConnection {
  '.id': string;
  protocol: string;
  'src-address': string;
  'dst-address': string;
  'reply-src-address': string;
  'reply-dst-address': string;
  'gre-key': string;
  'tcp-state': string;
  'connection-mark': string;
  timeout: string;
  'orig-packets': number;
  'orig-bytes': number;
  'repl-packets': number;
  'repl-bytes': number;
  'orig-rate': number;
  'repl-rate': number;
  'assured': boolean;
  'confirmed': boolean;
}

export interface AddressList {
  '.id': string;
  list: string;
  address: string;
  comment?: string;
  disabled: boolean;
  dynamic: boolean;
  timeout?: string;
}

// ==================== WIFI & WIRELESS ====================

export interface WiFiRegistrationEntry {
  '.id': string;
  interface: string;
  'mac-address': string;
  'ip-address': string;
  'ap-tx-power': number;
  'rx-signal': number;
  'tx-signal': number;
  'noise-floor': number;
  'signal-to-noise': number;
  'tx-rate': string;
  'rx-rate': string;
  'tx-packets': number;
  'rx-packets': number;
  'tx-bytes': number;
  'rx-bytes': number;
  'tx-frames-retried': number;
  'tx-frames-failed': number;
  uptime: string;
  comment?: string;
}

export interface WiFiScanResult {
  'mac-address': string;
  ssid: string;
  bssid: string;
  frequency: string;
  band: string;
  channel: string;
  'signal-strength': number;
  quality: number;
  security: string;
  'wps-flags': string;
  'radio-name': string;
  age: string;
}

export interface WiFiConfiguration {
  '.id': string;
  name: string;
  ssid: string;
  'hide-ssid': boolean;
  'wireless-protocol': string;
  'installation': string;
  'country': string;
  'antenna-gain': number;
  'frequency': string;
  'channel-width': string;
  'extension-channel': string;
  'tx-power': number;
  'tx-power-mode': string;
  'distance': string;
  'bridge-mode': boolean;
  disabled: boolean;
  comment?: string;
}

// ==================== USER MANAGEMENT ====================

export interface User {
  '.id': string;
  name: string;
  group: string;
  address: string;
  netmask: string;
  'last-logged-in': string;
  disabled: boolean;
  comment?: string;
}

export interface UserGroup {
  '.id': string;
  name: string;
  policy: string;
  comment?: string;
}

export interface ActiveUser {
  '.id': string;
  name: string;
  address: string;
  via: string;
  when: string;
}

// ==================== MONITORING & TOOLS ====================

export interface PingResult {
  host: string;
  'packet-size': number;
  count: number;
  interval: string;
  ttl: number;
  'routing-table': string;
  sent: number;
  received: number;
  'packet-loss': number;
  'min-rtt': string;
  'avg-rtt': string;
  'max-rtt': string;
  'std-dev-rtt': string;
}

export interface TracerouteHop {
  address: string;
  'loss': number;
  sent: number;
  'last': string;
  'avg': string;
  'best': string;
  'worst': string;
  'std-dev': string;
  status: string;
}

export interface BandwidthTestResult {
  status: string;
  duration: string;
  'tx-current': number;
  'rx-current': number;
  'tx-total-average': number;
  'rx-total-average': number;
  'random-data': boolean;
  direction: string;
  'tx-size': number;
  'rx-size': number;
  'connection-count': number;
}

// ==================== VPN & TUNNELING ====================

export interface IPSecPeer {
  '.id': string;
  name: string;
  address: string;
  port: number;
  'local-address': string;
  'passive': boolean;
  'exchange-mode': string;
  'send-initial-contact': boolean;
  'nat-traversal': boolean;
  'hash-algorithm': string;
  'enc-algorithm': string;
  'dh-group': string;
  'lifetime': string;
  'dpd-interval': string;
  'dpd-maximum-failures': number;
  disabled: boolean;
  comment?: string;
}

export interface L2TPServer {
  '.id': string;
  'default-profile': string;
  'enabled': boolean;
  'use-ipsec': boolean;
  'ipsec-secret': string;
  'authentication': string;
  'certificate': string;
  'max-mtu': number;
  'max-mru': number;
  comment?: string;
}

export interface WireGuardInterface {
  '.id': string;
  name: string;
  'private-key': string;
  'public-key': string;
  'listen-port': number;
  mtu: number;
  disabled: boolean;
  comment?: string;
}

export interface WireGuardPeer {
  '.id': string;
  interface: string;
  'public-key': string;
  'endpoint-address': string;
  'endpoint-port': number;
  'allowed-address': string;
  'persistent-keepalive': string;
  'current-endpoint-address': string;
  'current-endpoint-port': number;
  'last-handshake': string;
  'rx': number;
  'tx': number;
  disabled: boolean;
  comment?: string;
}

// ==================== QUALITY OF SERVICE ====================

export interface QueueSimple {
  '.id': string;
  name: string;
  target: string;
  'parent': string;
  'packet-marks': string;
  priority: number;
  'queue': string;
  'max-limit': string;
  'burst-limit': string;
  'burst-threshold': string;
  'burst-time': string;
  'limit-at': string;
  bytes: number;
  packets: number;
  dropped: number;
  rate: string;
  'packet-rate': string;
  queued: number;
  'invalid': boolean;
  disabled: boolean;
  comment?: string;
}

export interface QueueTree {
  '.id': string;
  name: string;
  parent: string;
  'packet-mark': string;
  priority: number;
  queue: string;
  'max-limit': string;
  'burst-limit': string;
  'burst-threshold': string;
  'burst-time': string;
  'limit-at': string;
  bytes: number;
  packets: number;
  dropped: number;
  rate: string;
  'packet-rate': string;
  queued: number;
  invalid: boolean;
  disabled: boolean;
  comment?: string;
}

// ==================== HOTSPOT ====================

export interface HotSpotServer {
  '.id': string;
  name: string;
  interface: string;
  'address-pool': string;
  profile: string;
  'idle-timeout': string;
  'keepalive-timeout': string;
  'login-timeout': string;
  'addresses-per-mac': number;
  disabled: boolean;
  comment?: string;
}

export interface HotSpotUser {
  '.id': string;
  name: string;
  password: string;
  profile: string;
  'limit-uptime': string;
  'limit-bytes-in': number;
  'limit-bytes-out': number;
  'limit-bytes-total': number;
  disabled: boolean;
  comment?: string;
}

export interface HotSpotActiveUser {
  '.id': string;
  user: string;
  address: string;
  'mac-address': string;
  'login-by': string;
  uptime: string;
  'idle-time': string;
  'keepalive-timeout': string;
  'bytes-in': number;
  'bytes-out': number;
  'packets-in': number;
  'packets-out': number;
  'radius': boolean;
}

// ==================== CERTIFICATES & LOGGING ====================

export interface Certificate {
  '.id': string;
  name: string;
  'common-name': string;
  subject: string;
  'key-size': string;
  'key-usage': string;
  'ca': boolean;
  'authority': boolean;
  'serial-number': string;
  fingerprint: string;
  'not-before': string;
  'not-after': string;
  expired: boolean;
  invalid: boolean;
  'revoked': boolean;
  trusted: boolean;
  comment?: string;
}

export interface LogEntry {
  '.id': string;
  time: string;
  topics: string;
  message: string;
  buffer: string;
}

// ==================== ERROR HANDLING ====================

export interface RouterOSError {
  code: string;
  message: string;
  category?: string;
  details?: Record<string, any>;
}

export interface ConnectionError extends Error {
  code: 'CONNECTION_FAILED' | 'AUTHENTICATION_FAILED' | 'TIMEOUT' | 'SSL_ERROR';
  host: string;
  port: number;
  originalError?: Error;
}

// ==================== API CLIENT INTERFACES ====================

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
}

export interface RouterOSRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  data?: any;
  params?: Record<string, string | number | boolean>;
}

export interface RouterOSListQuery {
  '.proplist'?: string;
  '?'?: string;
  '?='?: string;
  '?<'?: string;
  '?>'?: string;
  '?in'?: string;
  '?has'?: string;
  [key: string]: string | number | boolean | undefined;
}

// ==================== DEVICE STATUS & HEALTH ====================

export interface DeviceStatus {
  id: string;
  name: string;
  ipAddress: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  lastSeen?: Date;
  lastError?: string;
  connectionAttempts: number;
  routerosVersion?: string;
  boardName?: string;
  architecture?: string;
  uptime?: string;
}

export interface SystemMetrics {
  cpuLoad: number;
  freeMemory: number;
  totalMemory: number;
  freeHddSpace: number;
  totalHddSpace: number;
  temperature?: number;
  voltage?: number;
  uptime: string;
  timestamp: Date;
}

export interface InterfaceMetrics {
  name: string;
  type: string;
  status: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDrops: number;
  txDrops: number;
  linkSpeed?: string;
  macAddress?: string;
  mtu?: number;
  timestamp: Date;
}

// ==================== MONITORING DATA ====================

export interface MonitoringData {
  deviceId: string;
  system: SystemMetrics;
  interfaces: InterfaceMetrics[];
  timestamp: Date;
}

export interface HistoricalData {
  deviceId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  systemMetrics: SystemMetrics[];
  interfaceMetrics: InterfaceMetrics[];
}

export interface TimeRange {
  start: Date;
  end: Date;
  interval?: 'minute' | 'hour' | 'day' | 'week' | 'month';
} 