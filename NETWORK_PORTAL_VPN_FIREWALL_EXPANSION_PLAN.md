# RouterOS Network Portal - VPN & Advanced Firewall Expansion Implementation Plan

## Overview

This document outlines a comprehensive implementation plan for expanding the RouterOS Network Portal's configuration page with advanced firewall features and full VPN configuration capabilities. The portal is currently at 60% completion with working device management, real-time monitoring, SSH terminal integration, and JWT authentication.

**Current Stack:**
- Frontend: Next.js 15 with TypeScript
- Backend: Fastify with SQLite database
- Authentication: JWT with role-based access
- Design: Custom CSS with glassmorphism (no Tailwind)
- API Integration: RouterOS REST API with SSH fallback
- Real-time: WebSocket monitoring

## Phase 1: Firewall Expansion - NAT Rules & Address Lists

### 1.1 Backend Implementation (REST API & Database)

#### 1.1.1 Database Schema Extensions
```sql
-- NAT Rules Table
CREATE TABLE nat_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'srcnat',
  action TEXT NOT NULL,
  src_address TEXT,
  dst_address TEXT,
  src_port TEXT,
  dst_port TEXT,
  protocol TEXT,
  out_interface TEXT,
  in_interface TEXT,
  to_addresses TEXT,
  to_ports TEXT,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- Address Lists Table
CREATE TABLE address_lists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  list_name TEXT NOT NULL,
  address TEXT NOT NULL,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- Connection Tracking Table (for monitoring)
CREATE TABLE connection_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  src_address TEXT,
  dst_address TEXT,
  src_port INTEGER,
  dst_port INTEGER,
  protocol TEXT,
  state TEXT,
  timeout INTEGER,
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

#### 1.1.2 Fastify Route Extensions
```typescript
// packages/network-portal/server/routes/firewall-nat.ts
export async function natRoutes(fastify: FastifyInstance) {
  // GET /api/firewall/nat - List NAT rules
  fastify.get('/nat', {
    preHandler: [fastify.authenticate, fastify.requireRole(['admin', 'operator'])],
    handler: async (request, reply) => {
      const { deviceId } = request.query;
      return await firewallNatService.getNatRules(deviceId);
    }
  });

  // POST /api/firewall/nat - Create NAT rule
  fastify.post('/nat', {
    preHandler: [fastify.authenticate, fastify.requireRole(['admin'])],
    handler: async (request, reply) => {
      const natRule = request.body;
      return await firewallNatService.createNatRule(natRule);
    }
  });

  // PUT /api/firewall/nat/:id - Update NAT rule
  // DELETE /api/firewall/nat/:id - Delete NAT rule
}

// packages/network-portal/server/routes/firewall-address-list.ts
export async function addressListRoutes(fastify: FastifyInstance) {
  // Similar structure for address list management
}
```

#### 1.1.3 Service Layer Implementation
```typescript
// packages/network-portal/server/services/firewall-nat-service.ts
export class FirewallNatService {
  async getNatRules(deviceId: string) {
    const device = await this.deviceService.getDevice(deviceId);
    
    try {
      // Try REST API first
      const response = await this.routerosClient.request(device, {
        method: 'GET',
        path: '/ip/firewall/nat'
      });
      
      // Sync with database
      await this.syncNatRulesWithDb(deviceId, response.data);
      return response.data;
    } catch (error) {
      // Fallback to SSH if REST API fails
      return await this.getNatRulesViaSSH(device);
    }
  }

  async createNatRule(natRule: NatRuleConfig) {
    const device = await this.deviceService.getDevice(natRule.deviceId);
    
    try {
      // REST API approach
      const response = await this.routerosClient.request(device, {
        method: 'PUT',
        path: '/ip/firewall/nat',
        data: this.formatNatRuleForROS(natRule)
      });
      
      // Save to database with ROS ID
      await this.saveNatRuleToDb({ ...natRule, ros_id: response.data['.id'] });
      return response.data;
    } catch (error) {
      // SSH fallback
      return await this.createNatRuleViaSSH(device, natRule);
    }
  }

  private async getNatRulesViaSSH(device: Device) {
    const command = '/ip firewall nat print detail';
    const result = await this.routerosClient.executeSSHCommand(device, command);
    return this.parseNatRulesFromSSH(result);
  }
}
```

#### 1.1.4 Enhanced Connection Tracking Implementation ✅ COMPLETED

**Comprehensive Connection Tracking System**:
The connection tracking system has been fully implemented with enterprise-grade features that match and exceed RouterOS's native connection tracking capabilities.

**Key Features Implemented**:
- **Complete Data Collection**: All RouterOS connection tracking fields including TCP states, byte/packet counters, rates, and connection flags
- **Real-time & Historical Modes**: Live connection monitoring with auto-refresh and historical data analysis
- **Advanced Filtering**: Search across all connection parameters with real-time filtering
- **Intelligent Data Presentation**: Reply rate (formatted as Kbps) and reply bytes prominently displayed for immediate active connection identification
- **Connection State Visualization**: Color-coded connection states (established=green, connecting=yellow, etc.)
- **Responsive Design**: Glassmorphism UI with mobile-responsive table and controls

**Database Schema Enhancement**:
```sql
-- Enhanced connection_tracking table with all RouterOS fields
ALTER TABLE connection_tracking ADD COLUMN tcp_state TEXT;
ALTER TABLE connection_tracking ADD COLUMN connection TEXT;
ALTER TABLE connection_tracking ADD COLUMN orig_bytes INTEGER;
ALTER TABLE connection_tracking ADD COLUMN repl_bytes INTEGER;
ALTER TABLE connection_tracking ADD COLUMN orig_packets INTEGER;
ALTER TABLE connection_tracking ADD COLUMN repl_packets INTEGER;
ALTER TABLE connection_tracking ADD COLUMN orig_rate TEXT;
ALTER TABLE connection_tracking ADD COLUMN repl_rate TEXT;
ALTER TABLE connection_tracking ADD COLUMN assured INTEGER DEFAULT 0;
ALTER TABLE connection_tracking ADD COLUMN seen_reply INTEGER DEFAULT 0;
```

**Advanced Monitoring Service**:
```typescript
// Enhanced connection tracking data collection
const connectionTracking = await this.routerosClient.request(device, {
  method: 'GET',
  path: '/ip/firewall/connection/tracking'
});

// Comprehensive field mapping including rates and counters
const enhancedConnections = connectionTracking.data.map(conn => ({
  src_address: conn['src-address'],
  dst_address: conn['dst-address'],
  protocol: conn.protocol,
  tcp_state: conn['tcp-state'],
  orig_bytes: parseInt(conn['orig-bytes']) || 0,
  repl_bytes: parseInt(conn['repl-bytes']) || 0,
  orig_rate: conn['orig-rate'],
  repl_rate: conn['repl-rate'], // Formatted as Kbps in frontend
  assured: conn.assured === 'true' ? 1 : 0,
  seen_reply: conn['seen-reply'] === 'true' ? 1 : 0,
  timeout: parseInt(conn.timeout) || 0
}));
```

**Frontend Implementation**:
```typescript
// Advanced connection tracking table with intelligent data presentation
export function ConnectionTrackingTable() {
  // Key columns optimized for network monitoring:
  // - Source/Destination with ports
  // - Protocol identification
  // - Reply Rate (formatted as Kbps) - CRITICAL for identifying active connections
  // - Reply Bytes (formatted as MB/GB) - Shows total data transfer
  // - TCP State (color-coded) - Connection health
  // - Timeout and Last Seen - Connection freshness
  
  const formatRate = (rate?: string): string => {
    const numericRate = parseInt(rate);
    if (numericRate >= 1000) {
      return `${(numericRate / 1000).toFixed(1)} Kbps`;
    }
    return `${numericRate} bps`;
  };
}
```

**User Experience Enhancements**:
- **Immediate Value Identification**: Reply rate and bytes prominently displayed to quickly identify active connections
- **Live/Historical Toggle**: Switch between real-time monitoring and historical analysis
- **Auto-refresh Control**: Configurable refresh intervals with visual indicators
- **Search & Sort**: Real-time search across all connection parameters with sortable columns
- **Mobile Responsive**: Full functionality on mobile devices with responsive table design
- **Visual Status Indicators**: Color-coded connection states and activity levels

### 1.2 Frontend Implementation

#### 1.2.1 NAT Rules Management Component
```typescript
// packages/network-portal/src/components/configuration/FirewallNatTab.tsx
export function FirewallNatTab() {
  const [natRules, setNatRules] = useState<NatRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['nat-rules', selectedDevice?.id],
    queryFn: () => firewallApi.getNatRules(selectedDevice?.id),
    enabled: !!selectedDevice
  });

  return (
    <div className="firewall-nat-container">
      <div className="section-header">
        <h3>NAT Rules</h3>
        <button 
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Add NAT Rule
        </button>
      </div>

      <div className="rules-table">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Chain</th>
              <th>Action</th>
              <th>Src Address</th>
              <th>Dst Address</th>
              <th>Protocol</th>
              <th>Interface</th>
              <th>To Address</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules?.map(rule => (
              <NatRuleRow 
                key={rule.id} 
                rule={rule}
                onEdit={handleEditRule}
                onDelete={handleDeleteRule}
                onToggle={handleToggleRule}
              />
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <NatRuleModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateRule}
        />
      )}
    </div>
  );
}
```

#### 1.2.2 Address Lists Management
```typescript
// packages/network-portal/src/components/configuration/AddressListTab.tsx
export function AddressListTab() {
  // Similar structure to NAT rules but for address list management
  // Features:
  // - Grouped by list name
  // - Bulk operations (add multiple IPs)
  // - Import from CSV
  // - Real-time validation of IP addresses/ranges
}
```

#### 1.2.3 Connection Tracking Monitor
```typescript
// packages/network-portal/src/components/monitoring/ConnectionTracking.tsx
export function ConnectionTracking() {
  // Real-time connection tracking display
  // WebSocket integration for live updates
  // Filtering and search capabilities
  // Export functionality
}
```

## Phase 2: IPsec VPN Configuration

### 2.1 Backend Implementation

#### 2.1.1 Database Schema for IPsec
```sql
-- IPsec Policies Table
CREATE TABLE ipsec_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  src_address TEXT,
  dst_address TEXT,
  protocol TEXT DEFAULT 'all',
  action TEXT DEFAULT 'encrypt',
  tunnel INTEGER DEFAULT 1,
  peer_name TEXT,
  proposal_name TEXT,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- IPsec Peers Table
CREATE TABLE ipsec_peers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  local_address TEXT,
  exchange_mode TEXT DEFAULT 'ike2',
  profile_name TEXT,
  passive INTEGER DEFAULT 0,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- IPsec Profiles Table
CREATE TABLE ipsec_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  dh_group TEXT DEFAULT 'modp2048',
  enc_algorithm TEXT DEFAULT 'aes-256',
  hash_algorithm TEXT DEFAULT 'sha256',
  lifetime TEXT DEFAULT '1d',
  nat_traversal INTEGER DEFAULT 1,
  dpd_interval TEXT DEFAULT '8s',
  dpd_maximum_failures INTEGER DEFAULT 4,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- IPsec Active Peers Table (for monitoring)
CREATE TABLE ipsec_active_peers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  remote_address TEXT,
  local_address TEXT,
  state TEXT,
  uptime TEXT,
  rx_bytes BIGINT,
  tx_bytes BIGINT,
  last_seen TEXT,
  responder INTEGER,
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

#### 2.1.2 IPsec Service Implementation
```typescript
// packages/network-portal/server/services/ipsec-service.ts
export class IpsecService {
  async getIpsecPolicies(deviceId: string) {
    const device = await this.deviceService.getDevice(deviceId);
    
    try {
      const response = await this.routerosClient.request(device, {
        method: 'GET',
        path: '/ip/ipsec/policy'
      });
      
      await this.syncIpsecPoliciesWithDb(deviceId, response.data);
      return response.data;
    } catch (error) {
      return await this.getIpsecPoliciesViaSSH(device);
    }
  }

  async createIpsecSiteToSite(config: SiteToSiteConfig) {
    const { deviceId, remotePeerIP, localNetworks, remoteNetworks, psk } = config;
    const device = await this.deviceService.getDevice(deviceId);

    // Create profile
    const profile = await this.createIpsecProfile(device, {
      name: `site2site-${Date.now()}`,
      dhGroup: 'modp2048',
      encryption: 'aes-256',
      hash: 'sha256'
    });

    // Create peer
    const peer = await this.createIpsecPeer(device, {
      name: profile.name,
      address: remotePeerIP,
      exchangeMode: 'ike2',
      profile: profile.name
    });

    // Create identity
    await this.createIpsecIdentity(device, {
      peer: peer.name,
      secret: psk,
      authMethod: 'pre-shared-key'
    });

    // Create policies for each network pair
    for (const localNet of localNetworks) {
      for (const remoteNet of remoteNetworks) {
        await this.createIpsecPolicy(device, {
          srcAddress: localNet,
          dstAddress: remoteNet,
          tunnel: true,
          action: 'encrypt',
          peer: peer.name
        });
      }
    }

    return { profile, peer, success: true };
  }

  async getActiveIpsecPeers(deviceId: string) {
    const device = await this.deviceService.getDevice(deviceId);
    
    try {
      const response = await this.routerosClient.request(device, {
        method: 'GET',
        path: '/ip/ipsec/active-peers'
      });
      
      // Store in database for historical tracking
      await this.storeActivePeersData(deviceId, response.data);
      return response.data;
    } catch (error) {
      return await this.getActivePeersViaSSH(device);
    }
  }
}
```

### 2.2 Frontend Implementation

#### 2.2.1 IPsec Configuration Component
```typescript
// packages/network-portal/src/components/configuration/IpsecTab.tsx
export function IpsecTab() {
  const [activeTab, setActiveTab] = useState<'policies' | 'peers' | 'active' | 'wizard'>('wizard');

  return (
    <div className="ipsec-container">
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'wizard' ? 'active' : ''}`}
          onClick={() => setActiveTab('wizard')}
        >
          Setup Wizard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          Policies
        </button>
        <button 
          className={`tab-btn ${activeTab === 'peers' ? 'active' : ''}`}
          onClick={() => setActiveTab('peers')}
        >
          Peers
        </button>
        <button 
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Connections
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'wizard' && <IpsecSetupWizard />}
        {activeTab === 'policies' && <IpsecPolicies />}
        {activeTab === 'peers' && <IpsecPeers />}
        {activeTab === 'active' && <IpsecActiveConnections />}
      </div>
    </div>
  );
}
```

#### 2.2.2 IPsec Setup Wizard
```typescript
// packages/network-portal/src/components/configuration/IpsecSetupWizard.tsx
export function IpsecSetupWizard() {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<IpsecWizardConfig>({
    type: 'site-to-site',
    remotePeerIP: '',
    localNetworks: [],
    remoteNetworks: [],
    encryption: 'aes-256',
    authentication: 'sha256',
    dhGroup: 'modp2048',
    psk: ''
  });

  const steps = [
    { number: 1, title: 'Connection Type', component: <ConnectionTypeStep /> },
    { number: 2, title: 'Peer Configuration', component: <PeerConfigStep /> },
    { number: 3, title: 'Networks', component: <NetworksStep /> },
    { number: 4, title: 'Security', component: <SecurityStep /> },
    { number: 5, title: 'Review & Deploy', component: <ReviewStep /> }
  ];

  return (
    <div className="wizard-container">
      <div className="wizard-progress">
        {steps.map(s => (
          <div 
            key={s.number}
            className={`step ${step >= s.number ? 'completed' : ''} ${step === s.number ? 'active' : ''}`}
          >
            <span className="step-number">{s.number}</span>
            <span className="step-title">{s.title}</span>
          </div>
        ))}
      </div>

      <div className="wizard-content">
        {steps[step - 1].component}
      </div>

      <div className="wizard-actions">
        {step > 1 && (
          <button className="btn-secondary" onClick={() => setStep(step - 1)}>
            Previous
          </button>
        )}
        {step < steps.length ? (
          <button className="btn-primary" onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button className="btn-success" onClick={handleDeploy}>
            Deploy Configuration
          </button>
        )}
      </div>
    </div>
  );
}
```

## Phase 3: WireGuard VPN Configuration

### 3.1 Backend Implementation

#### 3.1.1 WireGuard Database Schema
```sql
-- WireGuard Interfaces Table
CREATE TABLE wireguard_interfaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  listen_port INTEGER DEFAULT 51820,
  private_key TEXT,
  public_key TEXT,
  mtu INTEGER DEFAULT 1420,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- WireGuard Peers Table
CREATE TABLE wireguard_peers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  interface_name TEXT NOT NULL,
  name TEXT,
  public_key TEXT NOT NULL,
  preshared_key TEXT,
  allowed_address TEXT,
  endpoint_address TEXT,
  endpoint_port INTEGER,
  persistent_keepalive INTEGER DEFAULT 0,
  comment TEXT,
  disabled INTEGER DEFAULT 0,
  ros_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);

-- WireGuard Active Peers (for monitoring)
CREATE TABLE wireguard_active_peers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  interface_name TEXT,
  peer_public_key TEXT,
  current_endpoint_address TEXT,
  current_endpoint_port INTEGER,
  last_handshake INTEGER,
  rx_bytes BIGINT,
  tx_bytes BIGINT,
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id)
);
```

#### 3.1.2 WireGuard Service Implementation
```typescript
// packages/network-portal/server/services/wireguard-service.ts
export class WireGuardService {
  async createWireGuardServer(config: WireGuardServerConfig) {
    const { deviceId, serverIP, port, clientNetwork } = config;
    const device = await this.deviceService.getDevice(deviceId);

    try {
      // Create WireGuard interface
      const interfaceResponse = await this.routerosClient.request(device, {
        method: 'PUT',
        path: '/interface/wireguard',
        data: {
          name: config.name,
          'listen-port': port,
          mtu: config.mtu || 1420
        }
      });

      // Add IP address to interface
      await this.routerosClient.request(device, {
        method: 'PUT',
        path: '/ip/address',
        data: {
          address: serverIP,
          interface: config.name
        }
      });

      // Store in database
      await this.saveWireGuardInterfaceToDb({
        deviceId,
        ...config,
        ros_id: interfaceResponse.data['.id']
      });

      return interfaceResponse.data;
    } catch (error) {
      return await this.createWireGuardServerViaSSH(device, config);
    }
  }

  async generateClientConfig(deviceId: string, interfaceName: string, clientName: string) {
    const device = await this.deviceService.getDevice(deviceId);
    
    // Generate client keys
    const clientKeys = this.generateWireGuardKeys();
    
    // Add peer to server
    const peer = await this.addWireGuardPeer(device, {
      interface: interfaceName,
      name: clientName,
      publicKey: clientKeys.publicKey,
      allowedAddress: this.getNextClientIP(deviceId, interfaceName)
    });

    // Generate client configuration file
    const clientConfig = this.generateClientConfigFile({
      clientKeys,
      serverPublicKey: await this.getServerPublicKey(device, interfaceName),
      serverEndpoint: device.address,
      allowedIPs: '0.0.0.0/0',
      dns: await this.getServerDNS(device)
    });

    return {
      peer,
      config: clientConfig,
      qrCode: this.generateQRCode(clientConfig)
    };
  }

  private generateWireGuardKeys() {
    // Use RouterOS to generate keys or external crypto library
    // For security, prefer RouterOS generation
  }
}
```

### 3.2 Frontend Implementation

#### 3.2.1 WireGuard Configuration Component
```typescript
// packages/network-portal/src/components/configuration/WireGuardTab.tsx
export function WireGuardTab() {
  const [activeTab, setActiveTab] = useState<'servers' | 'clients' | 'monitor'>('servers');

  return (
    <div className="wireguard-container">
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'servers' ? 'active' : ''}`}
          onClick={() => setActiveTab('servers')}
        >
          Server Setup
        </button>
        <button 
          className={`tab-btn ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          Client Management
        </button>
        <button 
          className={`tab-btn ${activeTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitor')}
        >
          Connection Monitor
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'servers' && <WireGuardServers />}
        {activeTab === 'clients' && <WireGuardClients />}
        {activeTab === 'monitor' && <WireGuardMonitor />}
      </div>
    </div>
  );
}
```

#### 3.2.2 WireGuard Client Management
```typescript
// packages/network-portal/src/components/configuration/WireGuardClients.tsx
export function WireGuardClients() {
  const [clients, setClients] = useState<WireGuardPeer[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<WireGuardPeer | null>(null);

  const handleGenerateConfig = async (client: WireGuardPeer) => {
    const config = await wireGuardApi.generateClientConfig(
      selectedDevice.id,
      client.interface,
      client.name
    );
    setSelectedClient({ ...client, config: config.config, qrCode: config.qrCode });
    setShowConfigModal(true);
  };

  return (
    <div className="wireguard-clients">
      <div className="section-header">
        <h3>WireGuard Clients</h3>
        <button 
          className="btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          Add Client
        </button>
      </div>

      <div className="clients-grid">
        {clients.map(client => (
          <div key={client.id} className="client-card">
            <div className="client-info">
              <h4>{client.name}</h4>
              <p>IP: {client.allowedAddress}</p>
              <p>Status: {client.lastHandshake ? 'Connected' : 'Offline'}</p>
            </div>
            <div className="client-actions">
              <button 
                className="btn-secondary"
                onClick={() => handleGenerateConfig(client)}
              >
                Config
              </button>
              <button 
                className="btn-danger"
                onClick={() => handleRemoveClient(client)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {showConfigModal && selectedClient && (
        <ClientConfigModal
          client={selectedClient}
          onClose={() => setShowConfigModal(false)}
        />
      )}
    </div>
  );
}
```

## Phase 4: Real-time Monitoring & Alerting

### 4.1 IPsec Link Monitoring

#### 4.1.1 Monitoring Service Enhancement
```typescript
// packages/network-portal/server/services/vpn-monitoring-service.ts
export class VpnMonitoringService {
  private vpnWebSocketClients = new Set<WebSocket>();

  async startVpnMonitoring(deviceId: string) {
    setInterval(async () => {
      await this.collectIpsecMetrics(deviceId);
      await this.collectWireGuardMetrics(deviceId);
    }, 30000); // Collect every 30 seconds
  }

  private async collectIpsecMetrics(deviceId: string) {
    const device = await this.deviceService.getDevice(deviceId);
    
    try {
      // Get active peers
      const activePeers = await this.routerosClient.request(device, {
        method: 'GET',
        path: '/ip/ipsec/active-peers'
      });

      // Get installed SAs
      const installedSAs = await this.routerosClient.request(device, {
        method: 'GET',
        path: '/ip/ipsec/installed-sa'
      });

      // Store metrics
      await this.storeIpsecMetrics(deviceId, activePeers.data, installedSAs.data);

      // Check for alerts
      await this.checkIpsecAlerts(deviceId, activePeers.data);

      // Broadcast to WebSocket clients
      this.broadcastVpnUpdate('ipsec', {
        deviceId,
        activePeers: activePeers.data,
        installedSAs: installedSAs.data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('IPsec monitoring error:', error);
    }
  }

  private async checkIpsecAlerts(deviceId: string, activePeers: any[]) {
    const device = await this.deviceService.getDevice(deviceId);
    const expectedPeers = await this.getExpectedIpsecPeers(deviceId);

    for (const expectedPeer of expectedPeers) {
      const activePeer = activePeers.find(p => p['remote-address'] === expectedPeer.address);
      
      if (!activePeer) {
        await this.alertService.createAlert({
          deviceId,
          type: 'ipsec_peer_down',
          severity: 'high',
          message: `IPsec peer ${expectedPeer.name} (${expectedPeer.address}) is down`,
          details: { peer: expectedPeer }
        });
      } else if (activePeer.state !== 'established') {
        await this.alertService.createAlert({
          deviceId,
          type: 'ipsec_peer_unstable',
          severity: 'medium',
          message: `IPsec peer ${expectedPeer.name} is in ${activePeer.state} state`,
          details: { peer: expectedPeer, state: activePeer.state }
        });
      }
    }
  }
}
```

#### 4.1.2 Alert Management System
```typescript
// packages/network-portal/server/services/alert-service.ts
export class AlertService {
  async createAlert(alert: Alert) {
    // Store in database
    const savedAlert = await this.db.alerts.create(alert);

    // Send notifications based on severity
    switch (alert.severity) {
      case 'critical':
        await this.sendEmailAlert(alert);
        await this.sendWebhookAlert(alert);
        break;
      case 'high':
        await this.sendEmailAlert(alert);
        break;
      case 'medium':
        // Only dashboard notification
        break;
    }

    // Broadcast to WebSocket clients
    this.broadcastAlert(savedAlert);

    return savedAlert;
  }

  async getActiveAlerts(deviceId?: string) {
    return await this.db.alerts.findMany({
      where: {
        resolved: false,
        ...(deviceId && { deviceId })
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
```

### 4.2 Frontend Monitoring Dashboard

#### 4.2.1 VPN Status Dashboard
```typescript
// packages/network-portal/src/components/monitoring/VpnDashboard.tsx
export function VpnDashboard() {
  const [vpnStatus, setVpnStatus] = useState<VpnStatus>({
    ipsec: { activePeers: [], totalTunnels: 0, healthScore: 0 },
    wireguard: { activePeers: [], totalInterfaces: 0, healthScore: 0 }
  });

  useEffect(() => {
    const ws = new WebSocket(`${getWebSocketUrl()}/vpn-monitoring`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'vpn_update') {
        updateVpnStatus(data.payload);
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="vpn-dashboard">
      <div className="dashboard-grid">
        <div className="status-card ipsec">
          <div className="card-header">
            <h3>IPsec Status</h3>
            <div className={`health-indicator ${getHealthClass(vpnStatus.ipsec.healthScore)}`}>
              {vpnStatus.ipsec.healthScore}%
            </div>
          </div>
          <div className="card-content">
            <div className="metric">
              <span className="metric-label">Active Tunnels</span>
              <span className="metric-value">{vpnStatus.ipsec.activePeers.length}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Total Configured</span>
              <span className="metric-value">{vpnStatus.ipsec.totalTunnels}</span>
            </div>
          </div>
        </div>

        <div className="status-card wireguard">
          <div className="card-header">
            <h3>WireGuard Status</h3>
            <div className={`health-indicator ${getHealthClass(vpnStatus.wireguard.healthScore)}`}>
              {vpnStatus.wireguard.healthScore}%
            </div>
          </div>
          <div className="card-content">
            <div className="metric">
              <span className="metric-label">Active Peers</span>
              <span className="metric-value">{vpnStatus.wireguard.activePeers.length}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Interfaces</span>
              <span className="metric-value">{vpnStatus.wireguard.totalInterfaces}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="active-connections">
        <h3>Active VPN Connections</h3>
        <div className="connections-table">
          <VpnConnectionsTable connections={getAllActiveConnections()} />
        </div>
      </div>
    </div>
  );
}
```

## Phase 5: UI/UX Design Implementation

### 5.1 Design System Extensions

#### 5.1.1 VPN-Specific CSS Components
```css
/* packages/network-portal/src/styles/vpn-components.css */

/* VPN Status Cards */
.vpn-dashboard {
  padding: var(--spacing-lg);
  background: var(--surface-primary);
}

.status-card {
  background: var(--glass-surface);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  position: relative;
  overflow: hidden;
}

.status-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
}

.status-card.ipsec::before {
  background: linear-gradient(90deg, #4f46e5, #7c3aed);
}

.status-card.wireguard::before {
  background: linear-gradient(90deg, #059669, #0891b2);
}

/* Health Indicators */
.health-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  height: 30px;
  border-radius: var(--radius-full);
  font-weight: 600;
  font-size: 0.875rem;
}

.health-indicator.healthy {
  background: rgba(34, 197, 94, 0.15);
  color: rgb(34, 197, 94);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.health-indicator.warning {
  background: rgba(251, 191, 36, 0.15);
  color: rgb(251, 191, 36);
  border: 1px solid rgba(251, 191, 36, 0.3);
}

.health-indicator.critical {
  background: rgba(239, 68, 68, 0.15);
  color: rgb(239, 68, 68);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

/* VPN Configuration Forms */
.vpn-wizard {
  background: var(--glass-surface);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  max-width: 800px;
  margin: 0 auto;
}

.wizard-progress {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-xl);
  position: relative;
}

.wizard-progress::before {
  content: '';
  position: absolute;
  top: 20px;
  left: 10%;
  right: 10%;
  height: 2px;
  background: var(--border-secondary);
  z-index: 1;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 2;
}

.step-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-secondary);
  border: 2px solid var(--border-secondary);
  color: var(--text-secondary);
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
  transition: all 0.3s ease;
}

.step.active .step-number {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.step.completed .step-number {
  background: var(--success-color);
  border-color: var(--success-color);
  color: white;
}

/* Connection Status Indicators */
.connection-status {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
}

.connection-status.connected {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.connection-status.connecting {
  background: rgba(251, 191, 36, 0.1);
  color: rgb(251, 191, 36);
}

.connection-status.disconnected {
  background: rgba(107, 114, 128, 0.1);
  color: rgb(107, 114, 128);
}

.connection-status.error {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
}

/* QR Code Modal */
.qr-code-modal {
  background: var(--glass-surface);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-xl);
  max-width: 500px;
  margin: 0 auto;
  text-align: center;
}

.qr-code-container {
  background: white;
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  margin: var(--spacing-lg) 0;
  display: inline-block;
}

/* VPN Metrics */
.vpn-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
  margin: var(--spacing-lg) 0;
}

.metric-card {
  background: var(--glass-surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  text-align: center;
}

.metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent-primary);
  display: block;
  margin-bottom: var(--spacing-xs);
}

.metric-label {
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### 5.2 Responsive Design Considerations

#### 5.2.1 Mobile-First VPN Interface
```css
/* Mobile VPN Dashboard */
@media (max-width: 768px) {
  .vpn-dashboard {
    padding: var(--spacing-md);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  .status-card {
    padding: var(--spacing-md);
  }

  .wizard-progress {
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .wizard-progress::before {
    display: none;
  }

  .step {
    flex-direction: row;
    justify-content: flex-start;
    text-align: left;
  }

  .step-number {
    margin-right: var(--spacing-md);
    margin-bottom: 0;
  }

  .connections-table {
    overflow-x: auto;
  }

  .vpn-metrics {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }
}
```

## Phase 6: Progress Tracking & Documentation

### 6.1 Implementation Checklist

#### Phase 1: Firewall Expansion (Weeks 1-2) ✅ COMPLETED
- [x] Database schema for NAT rules and address lists
- [x] Backend API endpoints for firewall management
- [x] RouterOS REST API integration for firewall operations
- [x] SSH fallback for unsupported operations
- [x] Frontend components for NAT rule management
- [x] Address list management interface
- [x] **Enhanced Connection tracking monitor with comprehensive data collection** ✅
- [x] **Real-time connection tracking with live/historical modes** ✅
- [x] **Complete RouterOS connection tracking field integration** ✅
- [x] **Advanced connection state monitoring with color coding** ✅
- [x] **Reply rate and bytes tracking for active connection identification** ✅
- [x] **Glassmorphism UI with search, sorting, and auto-refresh** ✅
- [ ] Unit tests for firewall services
- [ ] Integration tests for API endpoints

#### Phase 2: IPsec VPN (Weeks 3-5) ✅ BACKEND COMPLETED, 🔄 FRONTEND IN PROGRESS
- [x] **IPsec database schema design** ✅ COMPLETED
  - [x] ipsec_policies table with comprehensive configuration options
  - [x] ipsec_peers table for remote peer management  
  - [x] ipsec_profiles table for encryption/authentication settings
  - [x] ipsec_active_peers table for real-time monitoring
  - [x] ipsec_identities table for authentication management
  - [x] ipsec_proposals table for Phase 2 configurations
  - [x] Comprehensive indexes for performance optimization
- [x] **IPsec service layer implementation** ✅ COMPLETED
  - [x] Complete RouterOS client IPsec methods (15+ API methods)
  - [x] Comprehensive CRUD operations for all IPsec components
  - [x] Site-to-site tunnel creation wizard automation
  - [x] Real-time active peer monitoring with database storage
  - [x] Validation functions for all IPsec configurations
  - [x] Event emission system for real-time updates
  - [x] Database synchronization with RouterOS
- [x] **IPsec API routes implementation** ✅ COMPLETED
  - [x] GET/POST endpoints for policies, peers, profiles
  - [x] Active peer monitoring endpoint
  - [x] Site-to-site tunnel creation endpoint
  - [x] Comprehensive request validation and error handling
- [x] **Frontend IPsec tab component** ✅ COMPLETED
  - [x] Tabbed interface for different IPsec components
  - [x] Integration with existing configuration page structure
  - [x] Real-time data loading and refresh functionality
- [x] **Site-to-site VPN wizard** ✅ COMPLETED
  - [x] 5-step wizard interface with validation
  - [x] Connection type selection (site-to-site focus)
  - [x] Peer configuration with PSK generation
  - [x] Multi-network support for local/remote networks
  - [x] Security settings with encryption/hash algorithms
  - [x] Configuration review and deployment
  - [x] Mobile-responsive glassmorphism design
- [ ] Road warrior setup wizard
- [ ] **IPsec policy management interface** 🔄 IN PROGRESS (placeholder components)
- [ ] **Peer and profile management** 🔄 IN PROGRESS (placeholder components)  
- [ ] **Active connection monitoring** 🔄 IN PROGRESS (placeholder components)
- [ ] IPsec troubleshooting tools
- [ ] Certificate management integration

#### Phase 3: WireGuard VPN (Weeks 6-7)
- [ ] WireGuard database schema
- [ ] WireGuard service implementation
- [ ] Server setup interface
- [ ] Client management system
- [ ] QR code generation for mobile clients
- [ ] Configuration file export
- [ ] Real-time connection monitoring
- [ ] Key management and rotation

#### Phase 4: Monitoring & Alerting (Week 8)
- [ ] VPN monitoring service enhancement
- [ ] Alert system implementation
- [ ] Real-time WebSocket updates
- [ ] Dashboard for VPN status
- [ ] Historical metrics storage
- [ ] Performance analytics
- [ ] Email/webhook notifications
- [ ] Alert acknowledgment system

#### Phase 5: UI/UX Polish (Week 9)
- [ ] VPN-specific design components
- [ ] Mobile responsiveness optimization
- [ ] Accessibility improvements
- [ ] User experience testing
- [ ] Performance optimization
- [ ] Cross-browser compatibility
- [ ] Documentation updates

#### Phase 6: Testing & Deployment (Week 10)
- [ ] Comprehensive integration testing
- [ ] Performance testing under load
- [ ] Security audit of VPN features
- [ ] User acceptance testing
- [ ] Documentation completion
- [ ] Deployment preparation
- [ ] Rollback procedures
- [ ] Monitoring setup

### 6.2 Phase 2 Implementation Status - IPsec VPN

#### 6.2.1 Completed Components ✅

**Backend Infrastructure:**
- **Database Schema**: Complete IPsec table structure with 6 tables supporting all VPN components
- **RouterOS Client**: 15+ IPsec methods covering policies, peers, profiles, identities, proposals, and monitoring
- **IPsec Service**: Comprehensive service layer with CRUD operations, validation, and real-time monitoring
- **API Routes**: Full REST API with proper validation, error handling, and authentication

**Frontend Components:**
- **IPsec Tab Component**: Tabbed interface with navigation between different IPsec management sections
- **Setup Wizard**: Complete 5-step site-to-site VPN creation wizard with validation and deployment
- **Configuration Integration**: IPsec section properly integrated into device configuration page
- **Data Loading**: Parallel API calls for efficient data loading with proper state management

#### 6.2.2 Technical Implementation Details

**Architecture Patterns:**
- Database-first approach with RouterOS synchronization
- Event-driven updates for real-time monitoring
- Consistent API patterns following existing codebase structure
- Glassmorphism UI design maintaining visual consistency

**Key Features Implemented:**
- Multi-network site-to-site tunnel support
- Automatic PSK generation with secure random strings  
- Comprehensive security configuration (AES-256, SHA256, MODP2048 defaults)
- Real-time active peer monitoring with historical data storage
- Mobile-responsive wizard interface with step validation

**Database Design:**
- Proper foreign key relationships to devices table
- Comprehensive indexing for performance
- All RouterOS IPsec fields mapped with appropriate data types
- Prepared statements for optimal query performance

#### 6.2.3 Next Steps - Remaining Frontend Components

**Priority 1 - Management Tables:**
1. **IPsec Policies Table**: CRUD interface for policy management with filtering and search
2. **IPsec Peers Table**: Peer management with connection status and actions (enable/disable)
3. **IPsec Profiles Table**: Profile management with encryption/authentication templates
4. **Active Peers Monitoring**: Real-time monitoring similar to connection tracking implementation

**Priority 2 - Advanced Features:**
1. **Certificate Management**: PKI integration for certificate-based authentication
2. **Road Warrior Setup**: Client VPN configuration for remote access
3. **Troubleshooting Tools**: Connection diagnostics and log analysis
4. **Bulk Operations**: Import/export configurations and batch management

#### 6.2.4 Implementation Notes

**Patterns to Follow:**
- Use existing table components as templates (e.g., connection-tracking implementation)
- Maintain glassmorphism design consistency
- Implement search, filtering, and sorting capabilities
- Include real-time refresh and WebSocket integration
- Follow mobile-responsive design patterns

**Technical Considerations:**
- Active peer monitoring should follow connection tracking pattern with live/historical modes
- Implement proper error boundaries for API failures
- Add loading states and optimistic updates for better UX
- Consider implementing bulk actions for policy management

### 6.3 Notes and Progress Tracking

Each phase should include:

1. **Technical Notes**: Document any API limitations, RouterOS version compatibility, and workarounds
2. **Testing Results**: Record test outcomes and any issues discovered
3. **Performance Metrics**: Track response times and system resource usage
4. **User Feedback**: Collect and address feedback from beta users
5. **Security Considerations**: Document security measures and potential vulnerabilities

### 6.3 Risk Mitigation

1. **RouterOS API Limitations**: Maintain SSH fallback for all operations
2. **Version Compatibility**: Test with multiple RouterOS versions
3. **Performance Impact**: Monitor system resources during VPN operations
4. **Security Concerns**: Regular security audits and penetration testing
5. **User Experience**: Continuous UX testing and iteration

## Conclusion

This implementation plan provides a comprehensive roadmap for expanding the RouterOS Network Portal with advanced firewall and VPN capabilities. The phased approach ensures steady progress while maintaining system stability and user experience quality.

The modular design allows for independent development and testing of each component, while the consistent API patterns and design system ensure a cohesive user experience across all features.

The focus on real-time monitoring and alerting will provide the foundation for future alarm system integration, making this expansion not just a feature addition but a strategic platform enhancement. 