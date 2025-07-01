/**
 * RouterOS API TypeScript Interfaces - Server Version
 * 
 * Comprehensive TypeScript type definitions for RouterOS REST API endpoints
 * and data structures used throughout the network monitoring portal.
 */

// ==================== CORE SYSTEM TYPES ====================

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

export interface SystemClock {
  date: string;
  time: string;
  'time-zone-name': string;
  'time-zone-autodetect': boolean;
  dst: boolean;
}

export interface SystemRouterboard {
  routerboard: boolean;
  model: string;
  revision: string;
  'serial-number': string;
  'firmware-type': string;
  'factory-firmware': string;
  'current-firmware': string;
  'upgrade-firmware': string;
}

export interface SystemLicense {
  'software-id': string;
  nlevel: number;
  features: string;
}

// ==================== DEVICE & CLIENT TYPES ====================

export interface DeviceCredentials {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  username: string;
  password?: string;
  useSSL: boolean;
}

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

export interface RouterOSResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
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
}

export interface ConnectionError extends Error {
  code: 'CONNECTION_FAILED' | 'AUTHENTICATION_FAILED' | 'TIMEOUT' | 'SSL_ERROR';
  host: string;
  port: number;
  originalError?: Error;
}

// ==================== CORE METRICS ====================

export interface SystemMetrics {
  uptime: string;
  version: string;
  cpuLoad: number;
  memoryUsage: number;
  freeMemory: number;
  totalMemory: number;
  diskUsage: number;
  freeDisk: number;
  totalDisk: number;
  temperature?: number;
  voltage?: number;
  architecture: string;
  boardName: string;
  cpuCount: number;
  cpuFrequency: string;
}

export interface InterfaceMetrics {
  name: string;
  type: string;
  running: boolean;
  enabled: boolean;
  comment?: string;
  mtu: number;
  macAddress: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  rxDrops: number;
  txDrops: number;
  linkDowns: number;
  lastLinkDownTime?: string;
  lastLinkUpTime?: string;
  actualMtu: number;
  linkSpeed?: string;
  fullDuplex?: boolean;
  switchId?: string;
}

// ==================== NETWORK INTERFACES ====================

export interface RouterOSInterface {
  '.id': string;
  name: string;
  type: string;
  'actual-mtu': number;
  l2mtu: number;
  'max-l2mtu': number;
  'mac-address': string;
  'last-link-down-time': string;
  'last-link-up-time': string;
  'link-downs': number;
  running: boolean;
  disabled: boolean;
  comment?: string;
  mtu: number;
  arp: string;
  'arp-timeout': string;
  loop_protect: string;
  'loop_protect_status': string;
  'loop_protect_send_interval': string;
  'loop_protect_disable_time': string;
}

export interface RouterOSBridge {
  '.id': string;
  name: string;
  mtu: number;
  'actual-mtu': number;
  l2mtu: number;
  arp: string;
  'arp-timeout': string;
  'mac-address': string;
  protocol: string;
  'fast-forward': boolean;
  'igmp-snooping': boolean;
  'auto-mac': boolean;
  'ageing-time': string;
  'vlan-filtering': boolean;
  dhcp: string;
  running: boolean;
  disabled: boolean;
}

export interface RouterOSVLAN {
  '.id': string;
  name: string;
  'vlan-id': number;
  interface: string;
  mtu: number;
  'arp-timeout': string;
  loop_protect: string;
  disabled: boolean;
}

// ==================== IP & NETWORKING ====================

export interface RouterOSIPAddress {
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

export interface RouterOSIPRoute {
  '.id': string;
  'dst-address': string;
  'pref-src': string;
  gateway: string;
  'gateway-status': string;
  distance: number;
  scope: number;
  'target-scope': number;
  comment?: string;
  disabled: boolean;
  active: boolean;
  dynamic: boolean;
  'route-tag': number;
  bgp?: boolean;
  ospf?: boolean;
  rip?: boolean;
  connected?: boolean;
  static?: boolean;
}

export interface RouterOSRouteTable {
  ['.id']: string;
  'dst-address': string;
  'pref-src': string;
  gateway: string;
  'gateway-status': string;
  distance: number;
  scope: number;
  'target-scope': number;
  comment?: string;
  disabled: boolean;
  active: boolean;
  dynamic: boolean;
  'route-tag': number;
  'routing-table': string;
}

export interface RouterOSIPPool {
  '.id': string;
  name: string;
  ranges: string;
  'next-pool': string;
  comment?: string;
}

export interface RouterOSIPService {
  '.id': string;
  name: string;
  port: number;
  address: string;
  certificate: string;
  disabled: boolean;
  invalid: boolean;
}

// ==================== DHCP ====================

export interface RouterOSDHCPServer {
  '.id': string;
  name: string;
  interface: string;
  'relay-agent-info': string;
  'add-arp': boolean;
  'lease-time': string;
  'address-pool': string;
  'authoritative': string;
  'bootp-support': string;
  'relay-agent-info-policy': string;
  disabled: boolean;
  invalid: boolean;
}

export interface RouterOSDHCPClient {
  '.id': string;
  interface: string;
  status: string;
  'expires-after': string;
  address: string;
  gateway: string;
  'dhcp-server': string;
  'primary-dns': string;
  'secondary-dns': string;
  invalid: boolean;
  dynamic: boolean;
  disabled: boolean;
}

export interface RouterOSDHCPLease {
  '.id': string;
  address: string;
  'mac-address': string;
  'client-id': string;
  'address-lists': string;
  server: string;
  'dhcp-option': string;
  status: string;
  'expires-after': string;
  'last-seen': string;
  'active-address': string;
  'active-mac-address': string;
  'active-client-id': string;
  'active-server': string;
  hostname: string;
  comment?: string;
  disabled: boolean;
  dynamic: boolean;
}

// ==================== FIREWALL ====================

export interface RouterOSFirewallFilter {
  '.id': string;
  chain: string;
  action: string;
  bytes: number;
  packets: number;
  'src-address': string;
  'dst-address': string;
  'src-port': string;
  'dst-port': string;
  protocol: string;
  'in-interface': string;
  'out-interface': string;
  'connection-state': string;
  'connection-type': string;
  'connection-mark': string;
  'packet-mark': string;
  'routing-mark': string;
  log: boolean;
  'log-prefix': string;
  comment?: string;
  disabled: boolean;
  invalid: boolean;
  dynamic: boolean;
}

export interface RouterOSFirewallNAT {
  '.id': string;
  chain: string;
  action: string;
  bytes: number;
  packets: number;
  'src-address': string;
  'dst-address': string;
  'src-port': string;
  'dst-port': string;
  protocol: string;
  'in-interface': string;
  'out-interface': string;
  'to-addresses': string;
  'to-ports': string;
  comment?: string;
  disabled: boolean;
  invalid: boolean;
  dynamic: boolean;
}

export interface RouterOSFirewallMangle {
  '.id': string;
  chain: string;
  action: string;
  bytes: number;
  packets: number;
  'src-address': string;
  'dst-address': string;
  'new-packet-mark': string;
  'new-connection-mark': string;
  'new-routing-mark': string;
  'passthrough': boolean;
  comment?: string;
  disabled: boolean;
  invalid: boolean;
  dynamic: boolean;
}

export interface RouterOSFirewallAddressList {
  '.id': string;
  list: string;
  address: string;
  'creation-time': string;
  timeout: string;
  comment?: string;
  disabled: boolean;
  dynamic: boolean;
}

// ==================== WIRELESS ====================

export interface RouterOSWirelessInterface {
  '.id': string;
  name: string;
  type: string;
  'mac-address': string;
  'master-interface': string;
  mode: string;
  ssid: string;
  frequency: number;
  band: string;
  'channel-width': string;
  'wireless-protocol': string;
  'security-profile': string;
  'wds-mode': string;
  'wds-default-bridge': string;
  'bridge-mode': string;
  running: boolean;
  disabled: boolean;
  comment?: string;
}

export interface RouterOSWirelessSecurityProfile {
  '.id': string;
  name: string;
  mode: string;
  'authentication-types': string;
  'unicast-ciphers': string;
  'group-ciphers': string;
  'wpa-pre-shared-key': string;
  'wpa2-pre-shared-key': string;
  'supplicant-identity': string;
  'eap-methods': string;
  comment?: string;
}

export interface RouterOSWirelessRegistrationTable {
  '.id': string;
  interface: string;
  'mac-address': string;
  'ap-tx-power': number;
  'client-tx-power': number;
  signal: string;
  'tx-rate': string;
  'rx-rate': string;
  bytes: string;
  frames: string;
  'frame-bytes': string;
  comment?: string;
  'p2p': boolean;
  'wds': boolean;
  bridge: boolean;
  'rx-signal': number;
  'tx-signal': number;
  distance: number;
  'last-activity': string;
}

// ==================== VPN ====================

export interface RouterOSPPPProfile {
  '.id': string;
  name: string;
  'local-address': string;
  'remote-address': string;
  'bridge-learning': string;
  'use-compression': string;
  'use-encryption': string;
  'use-vj-compression': string;
  'use-upnp': string;
  'address-list': string;
  'incoming-filter': string;
  'outgoing-filter': string;
  comment?: string;
}

export interface RouterOSPPPSecret {
  '.id': string;
  name: string;
  password: string;
  service: string;
  'caller-id': string;
  profile: string;
  'local-address': string;
  'remote-address': string;
  routes: string;
  'limit-bytes-in': number;
  'limit-bytes-out': number;
  comment?: string;
  disabled: boolean;
}

export interface RouterOSPPPActive {
  '.id': string;
  name: string;
  service: string;
  'caller-id': string;
  address: string;
  uptime: string;
  encoding: string;
  'session-id': string;
  'limit-bytes-in': number;
  'limit-bytes-out': number;
  radius: boolean;
}

export interface RouterOSIPSecPeer {
  '.id': string;
  name: string;
  address: string;
  port: number;
  'local-address': string;
  'passive': boolean;
  'send-initial-contact': boolean;
  'exchange-mode': string;
  'generate-policy': string;
  'policy-template-group': string;
  comment?: string;
  disabled: boolean;
}

export interface RouterOSIPSecProposal {
  '.id': string;
  name: string;
  'auth-algorithms': string;
  'enc-algorithms': string;
  'pfs-group': string;
  lifetime: string;
  comment?: string;
  disabled: boolean;
}

// ==================== QOS & QUEUES ====================

export interface RouterOSQueueSimple {
  '.id': string;
  name: string;
  target: string;
  parent: string;
  'packet-marks': string;
  direction: string;
  priority: number;
  'queue-type': string;
  'max-limit': string;
  'burst-limit': string;
  'burst-threshold': string;
  'burst-time': string;
  'limit-at': string;
  total: boolean;
  comment?: string;
  disabled: boolean;
  invalid: boolean;
  dynamic: boolean;
}

export interface RouterOSQueueTree {
  '.id': string;
  name: string;
  parent: string;
  'packet-mark': string;
  priority: number;
  'queue-type': string;
  'max-limit': string;
  'burst-limit': string;
  'burst-threshold': string;
  'burst-time': string;
  'limit-at': string;
  comment?: string;
  disabled: boolean;
  invalid: boolean;
}

export interface RouterOSQueueType {
  '.id': string;
  name: string;
  kind: string;
  'pfifo-limit': number;
  'bfifo-limit': string;
  'sfq-perturb': number;
  'sfq-allot': number;
  'red-limit': number;
  'red-min-threshold': number;
  'red-max-threshold': number;
  'red-burst': number;
  'red-avg-packet': number;
  comment?: string;
}

// ==================== MONITORING & TOOLS ====================

export interface RouterOSToolPing {
  '.id': string;
  host: string;
  count: number;
  interval: string;
  size: number;
  'do-not-fragment': boolean;
  routing_table?: string;
  'src-address': string;
  status: string;
  duration: string;
  sent: number;
  received: number;
  'packet-loss': number;
  'min-rtt': string;
  'avg-rtt': string;
  'max-rtt': string;
}

export interface RouterOSToolTraceroute {
  '.id': string;
  address: string;
  count: number;
  timeout: string;
  'use-dns': boolean;
  'src-address': string;
  'routing-table': string;
  status: string;
  duration: string;
}

export interface RouterOSLogEntry {
  '.id': string;
  time: string;
  topics: string;
  message: string;
  buffer?: string;
}

export interface RouterOSHealthMetrics {
  temperature?: number;
  voltage?: number;
  'cpu-temperature'?: number;
  'board-temperature1'?: number;
  'board-temperature2'?: number;
  'psu1-voltage'?: number;
  'psu2-voltage'?: number;
  'power-consumption'?: number;
  'current-consumption'?: number;
  'poe-out-consumption'?: number;
  'fan1-speed'?: number;
  'fan2-speed'?: number;
}

// ==================== USER MANAGEMENT ====================

export interface RouterOSUser {
  '.id': string;
  name: string;
  group: string;
  address: string;
  'last-logged-in': string;
  comment?: string;
  disabled: boolean;
}

export interface RouterOSUserGroup {
  '.id': string;
  name: string;
  policy: string;
  comment?: string;
}

// ==================== COMPOSITE & UTILITY TYPES ====================

export interface RouterOSMonitoringData {
  system: SystemMetrics;
  interfaces: InterfaceMetrics[];
  health?: RouterOSHealthMetrics;
  timestamp: Date;
}

export interface RouterOSListQuery {
  id?: string;
  proplist?: string;
  'detail'?: boolean;
  count?: boolean;
  where?: Record<string, any>;
}

export interface RouterOSOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

export interface RouterOSBulkOperation<T = any> {
  operation: 'create' | 'update' | 'delete';
  data: T;
  id?: string;
}

export interface RouterOSBulkResult<T = any> {
  success: boolean;
  results: RouterOSOperationResult<T>[];
  errors: string[];
  successCount: number;
  errorCount: number;
}

// ==================== HELPER TYPES ====================

export type RouterOSStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

export type RouterOSEndpoint = 
  | 'system/resource'
  | 'system/identity' 
  | 'system/clock'
  | 'system/routerboard'
  | 'system/license'
  | 'interface'
  | 'interface/bridge'
  | 'interface/vlan'
  | 'ip/address'
  | 'ip/route'
  | 'ip/pool'
  | 'ip/service'
  | 'ip/dhcp-server'
  | 'ip/dhcp-client'
  | 'ip/firewall/filter'
  | 'ip/firewall/nat'
  | 'ip/firewall/mangle'
  | 'ip/firewall/address-list'
  | 'interface/wireless'
  | 'interface/wireless/security-profiles'
  | 'interface/wireless/registration-table'
  | 'ppp/profile'
  | 'ppp/secret'
  | 'ppp/active'
  | 'ip/ipsec/peer'
  | 'ip/ipsec/proposal'
  | 'queue/simple'
  | 'queue/tree'
  | 'queue/type'
  | 'tool/ping'
  | 'tool/traceroute'
  | 'log'
  | 'system/health'
  | 'user'
  | 'user/group';

export type RouterOSMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; 