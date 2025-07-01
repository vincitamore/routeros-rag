/**
 * IPsec VPN Service
 * 
 * Handles RouterOS IPsec VPN configuration management including policies,
 * peers, profiles, identities, and active connection monitoring. Provides
 * comprehensive IPsec tunnel management with real-time monitoring capabilities.
 */

import { Database } from 'better-sqlite3';
import { RouterOSClient, createRouterOSClient } from '../lib/routeros-client';
import { EventEmitter } from 'events';

export interface IPsecPolicy {
  id: string;
  device_id: string;
  src_address?: string;
  dst_address?: string;
  protocol?: string;
  action?: string;
  tunnel?: boolean;
  peer_name?: string;
  proposal_name?: string;
  ph2_state?: string;
  comment?: string;
  disabled?: boolean;
  ros_id?: string;
  created_at: string;
  updated_at: string;
}

export interface IPsecPeer {
  id: string;
  device_id: string;
  name: string;
  address?: string;
  local_address?: string;
  exchange_mode?: string;
  profile_name?: string;
  passive?: boolean;
  comment?: string;
  disabled?: boolean;
  ros_id?: string;
  created_at: string;
  updated_at: string;
}

export interface IPsecProfile {
  id: string;
  device_id: string;
  name: string;
  dh_group?: string;
  enc_algorithm?: string;
  hash_algorithm?: string;
  lifetime?: string;
  nat_traversal?: boolean;
  dpd_interval?: string;
  dpd_maximum_failures?: number;
  comment?: string;
  disabled?: boolean;
  ros_id?: string;
  created_at: string;
  updated_at: string;
}

export interface IPsecIdentity {
  id: string;
  device_id: string;
  peer_name: string;
  auth_method?: string;
  secret?: string;
  certificate?: string;
  generate_policy?: string;
  match_by?: string;
  mode_config?: string;
  policy_template_group?: string;
  my_id?: string;
  remote_id?: string;
  comment?: string;
  disabled?: boolean;
  ros_id?: string;
  created_at: string;
  updated_at: string;
}

export interface IPsecActivePeer {
  id?: number;
  device_id: string;
  remote_address?: string;
  local_address?: string;
  state?: string;
  uptime?: string;
  rx_bytes?: number;
  tx_bytes?: number;
  last_seen?: string;
  responder?: boolean;
  collected_at: string;
}

export interface SiteToSiteConfig {
  deviceId: string;
  remotePeerIP: string;
  localNetworks: string[];
  remoteNetworks: string[];
  psk: string;
  profileName?: string;
  peerName?: string;
  comment?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class IPsecService extends EventEmitter {
  private db: Database;
  private activeConnections: Map<string, RouterOSClient> = new Map();

  // Database statements
  private insertPolicyStmt: any;
  private insertPeerStmt: any;
  private insertProfileStmt: any;
  private insertIdentityStmt: any;
  private insertActivePeerStmt: any;
  private getPoliciesStmt: any;
  private getPeersStmt: any;
  private getProfilesStmt: any;
  private getIdentitiesStmt: any;
  private getActivePeersStmt: any;
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
    this.insertPolicyStmt = this.db.prepare(`
      INSERT INTO ipsec_policies 
      (device_id, src_address, dst_address, protocol, action, tunnel, peer_name, proposal_name, ph2_state, comment, disabled, ros_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertPeerStmt = this.db.prepare(`
      INSERT INTO ipsec_peers 
      (device_id, name, address, local_address, exchange_mode, profile_name, passive, comment, disabled, ros_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertProfileStmt = this.db.prepare(`
      INSERT INTO ipsec_profiles 
      (device_id, name, dh_group, enc_algorithm, hash_algorithm, lifetime, nat_traversal, dpd_interval, dpd_maximum_failures, comment, disabled, ros_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertIdentityStmt = this.db.prepare(`
      INSERT INTO ipsec_identities 
      (device_id, peer_name, auth_method, secret, certificate, generate_policy, match_by, mode_config, policy_template_group, my_id, remote_id, comment, disabled, ros_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertActivePeerStmt = this.db.prepare(`
      INSERT INTO ipsec_active_peers 
      (device_id, remote_address, local_address, state, uptime, rx_bytes, tx_bytes, last_seen, responder, collected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.getPoliciesStmt = this.db.prepare(`
      SELECT * FROM ipsec_policies 
      WHERE device_id = ? 
      ORDER BY created_at DESC
    `);

    this.getPeersStmt = this.db.prepare(`
      SELECT * FROM ipsec_peers 
      WHERE device_id = ? 
      ORDER BY created_at DESC
    `);

    this.getProfilesStmt = this.db.prepare(`
      SELECT * FROM ipsec_profiles 
      WHERE device_id = ? 
      ORDER BY created_at DESC
    `);

    this.getIdentitiesStmt = this.db.prepare(`
      SELECT * FROM ipsec_identities 
      WHERE device_id = ? 
      ORDER BY created_at DESC
    `);

    this.getActivePeersStmt = this.db.prepare(`
      SELECT * FROM ipsec_active_peers 
      WHERE device_id = ? 
      ORDER BY collected_at DESC 
      LIMIT ?
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
      password: device.password,
      useSSL: Boolean(device.use_ssl),
      timeout: 10000,
      retryAttempts: 2
    });

    this.activeConnections.set(deviceId, client);
    return client;
  }

  // ==================== IPSEC POLICIES ====================

  /**
   * Get all IPsec policies for a device
   */
  async getIPsecPolicies(deviceId: string): Promise<IPsecPolicy[]> {
    console.log(`🔍 [IPsecService] Getting IPsec policies for device: ${deviceId}`);
    const client = await this.getClient(deviceId);
    
    try {
      console.log(`📡 [IPsecService] Calling RouterOS client.getIPsecPolicies()`);
      const response = await client.getIPsecPolicies();
      
      console.log(`📋 [IPsecService] RouterOS response:`, {
        success: response.success,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        error: response.error,
        firstItem: Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : 'none'
      });
      
      if (!response.success) {
        throw new Error(`Failed to get IPsec policies: ${response.error}`);
      }

      // Sync with database
      console.log(`💾 [IPsecService] Syncing ${Array.isArray(response.data) ? response.data.length : 0} policies with database`);
      await this.syncPoliciesWithDb(deviceId, response.data || []);
      
      // Return from database for consistency
      const policies = this.getPoliciesStmt.all(deviceId);
      console.log(`🗄️ [IPsecService] Retrieved ${policies.length} policies from database`);
      
      const mappedPolicies = policies.map(this.mapPolicy);
      console.log(`📤 [IPsecService] Returning ${mappedPolicies.length} mapped policies to frontend:`, 
        mappedPolicies.length > 0 ? mappedPolicies[0] : 'none');
      
      return mappedPolicies;
    } catch (error) {
      console.error(`❌ [IPsecService] Error getting IPsec policies for device ${deviceId}:`, error);
      // Fallback to database data
      const policies = this.getPoliciesStmt.all(deviceId);
      console.log(`🔄 [IPsecService] Fallback: Retrieved ${policies.length} policies from database`);
      return policies.map(this.mapPolicy);
    }
  }

  /**
   * Add IPsec policy
   */
  async addIPsecPolicy(deviceId: string, policy: Partial<IPsecPolicy>, userId?: string): Promise<IPsecPolicy> {
    const client = await this.getClient(deviceId);
    
    // Validate policy
    const validation = this.validateIPsecPolicy(policy);
    if (!validation.valid) {
      throw new Error(`Invalid IPsec policy: ${validation.errors.join(', ')}`);
    }

    try {
      const response = await client.addIPsecPolicy({
        'src-address': policy.src_address,
        'dst-address': policy.dst_address,
        protocol: policy.protocol,
        action: policy.action,
        tunnel: policy.tunnel,
        peer: policy.peer_name,
        proposal: policy.proposal_name,
        comment: policy.comment
      });
      
      if (!response.success) {
        throw new Error(`Failed to add IPsec policy: ${response.error}`);
      }

      // Store in database
      const timestamp = new Date().toISOString();
      const insertResult = this.insertPolicyStmt.run(
        deviceId,
        policy.src_address || null,
        policy.dst_address || null,
        policy.protocol || 'all',
        policy.action || 'encrypt',
        policy.tunnel ? 1 : 0,
        policy.peer_name || null,
        policy.proposal_name || null,
        policy.ph2_state || null,
        policy.comment || null,
        policy.disabled ? 1 : 0,
        response.data?.['.id'] || null,
        timestamp,
        timestamp
      );

      const newPolicy = {
        id: String(insertResult.lastInsertRowid),
        device_id: deviceId,
        ...policy,
        ros_id: response.data?.['.id'],
        created_at: timestamp,
        updated_at: timestamp
      } as IPsecPolicy;

      this.emit('ipsecPolicyAdded', newPolicy);
      return newPolicy;
    } catch (error) {
      console.error(`Error adding IPsec policy for device ${deviceId}:`, error);
      throw error;
    }
  }

  // ==================== IPSEC PEERS ====================

  /**
   * Get all IPsec peers for a device
   */
  async getIPsecPeers(deviceId: string): Promise<IPsecPeer[]> {
    console.log(`🔍 [IPsecService] Getting IPsec peers for device: ${deviceId}`);
    const client = await this.getClient(deviceId);
    
    try {
      console.log(`📡 [IPsecService] Calling RouterOS client.getIPsecPeers()`);
      const response = await client.getIPsecPeers();
      
      console.log(`📋 [IPsecService] RouterOS peers response:`, {
        success: response.success,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        error: response.error,
        firstItem: Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : 'none'
      });
      
      if (!response.success) {
        throw new Error(`Failed to get IPsec peers: ${response.error}`);
      }

      // Sync with database
      console.log(`💾 [IPsecService] Syncing ${Array.isArray(response.data) ? response.data.length : 0} peers with database`);
      await this.syncPeersWithDb(deviceId, response.data || []);
      
      // Return from database
      const peers = this.getPeersStmt.all(deviceId);
      console.log(`🗄️ [IPsecService] Retrieved ${peers.length} peers from database`);
      
      const mappedPeers = peers.map(this.mapPeer);
      console.log(`📤 [IPsecService] Returning ${mappedPeers.length} mapped peers to frontend:`, 
        mappedPeers.length > 0 ? mappedPeers[0] : 'none');
      
      return mappedPeers;
    } catch (error) {
      console.error(`❌ [IPsecService] Error getting IPsec peers for device ${deviceId}:`, error);
      const peers = this.getPeersStmt.all(deviceId);
      console.log(`🔄 [IPsecService] Fallback: Retrieved ${peers.length} peers from database`);
      return peers.map(this.mapPeer);
    }
  }

  /**
   * Add IPsec peer
   */
  async addIPsecPeer(deviceId: string, peer: Partial<IPsecPeer>, userId?: string): Promise<IPsecPeer> {
    const client = await this.getClient(deviceId);
    
    // Validate peer
    const validation = this.validateIPsecPeer(peer);
    if (!validation.valid) {
      throw new Error(`Invalid IPsec peer: ${validation.errors.join(', ')}`);
    }

    try {
      const response = await client.addIPsecPeer({
        name: peer.name,
        address: peer.address,
        'local-address': peer.local_address,
        'exchange-mode': peer.exchange_mode,
        profile: peer.profile_name,
        passive: peer.passive,
        comment: peer.comment
      });
      
      if (!response.success) {
        throw new Error(`Failed to add IPsec peer: ${response.error}`);
      }

      // Store in database
      const timestamp = new Date().toISOString();
      const insertResult = this.insertPeerStmt.run(
        deviceId,
        peer.name || null,
        peer.address || null,
        peer.local_address || null,
        peer.exchange_mode || 'ike2',
        peer.profile_name || null,
        peer.passive ? 1 : 0,
        peer.comment || null,
        peer.disabled ? 1 : 0,
        response.data?.['.id'] || null,
        timestamp,
        timestamp
      );

      const newPeer = {
        id: String(insertResult.lastInsertRowid),
        device_id: deviceId,
        ...peer,
        ros_id: response.data?.['.id'],
        created_at: timestamp,
        updated_at: timestamp
      } as IPsecPeer;

      this.emit('ipsecPeerAdded', newPeer);
      return newPeer;
    } catch (error) {
      console.error(`Error adding IPsec peer for device ${deviceId}:`, error);
      throw error;
    }
  }

  // ==================== IPSEC PROFILES ====================

  /**
   * Get all IPsec profiles for a device
   */
  async getIPsecProfiles(deviceId: string): Promise<IPsecProfile[]> {
    console.log(`🔍 [IPsecService] Getting IPsec profiles for device: ${deviceId}`);
    const client = await this.getClient(deviceId);
    
    try {
      console.log(`📡 [IPsecService] Calling RouterOS client.getIPsecProfiles()`);
      const response = await client.getIPsecProfiles();
      
      console.log(`📋 [IPsecService] RouterOS profiles response:`, {
        success: response.success,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        error: response.error,
        firstItem: Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : 'none'
      });
      
      if (!response.success) {
        throw new Error(`Failed to get IPsec profiles: ${response.error}`);
      }

      // Sync with database
      console.log(`💾 [IPsecService] Syncing ${Array.isArray(response.data) ? response.data.length : 0} profiles with database`);
      await this.syncProfilesWithDb(deviceId, response.data || []);
      
      // Return from database
      const profiles = this.getProfilesStmt.all(deviceId);
      console.log(`🗄️ [IPsecService] Retrieved ${profiles.length} profiles from database`);
      
      const mappedProfiles = profiles.map(this.mapProfile);
      console.log(`📤 [IPsecService] Returning ${mappedProfiles.length} mapped profiles to frontend:`, 
        mappedProfiles.length > 0 ? mappedProfiles[0] : 'none');
      
      return mappedProfiles;
    } catch (error) {
      console.error(`❌ [IPsecService] Error getting IPsec profiles for device ${deviceId}:`, error);
      const profiles = this.getProfilesStmt.all(deviceId);
      return profiles.map(this.mapProfile);
    }
  }

  /**
   * Add IPsec profile
   */
  async addIPsecProfile(deviceId: string, profile: Partial<IPsecProfile>, userId?: string): Promise<IPsecProfile> {
    const client = await this.getClient(deviceId);
    
    // Validate profile
    const validation = this.validateIPsecProfile(profile);
    if (!validation.valid) {
      throw new Error(`Invalid IPsec profile: ${validation.errors.join(', ')}`);
    }

    try {
      const response = await client.addIPsecProfile({
        name: profile.name!,
        'dh-group': profile.dh_group,
        'enc-algorithm': profile.enc_algorithm,
        'hash-algorithm': profile.hash_algorithm,
        lifetime: profile.lifetime,
        'nat-traversal': profile.nat_traversal,
        'dpd-interval': profile.dpd_interval,
        'dpd-maximum-failures': profile.dpd_maximum_failures,
        comment: profile.comment
      });
      
      if (!response.success) {
        throw new Error(`Failed to add IPsec profile: ${response.error}`);
      }

      // Store in database
      const timestamp = new Date().toISOString();
      const insertResult = this.insertProfileStmt.run(
        deviceId,
        profile.name,
        profile.dh_group || 'modp2048',
        profile.enc_algorithm || 'aes-256',
        profile.hash_algorithm || 'sha256',
        profile.lifetime || '1d',
        profile.nat_traversal ? 1 : 0,
        profile.dpd_interval || '8s',
        profile.dpd_maximum_failures || 4,
        profile.comment || null,
        profile.disabled ? 1 : 0,
        response.data?.['.id'] || null,
        timestamp,
        timestamp
      );

      const newProfile = {
        id: String(insertResult.lastInsertRowid),
        device_id: deviceId,
        ...profile,
        ros_id: response.data?.['.id'],
        created_at: timestamp,
        updated_at: timestamp
      } as IPsecProfile;

      this.emit('ipsecProfileAdded', newProfile);
      return newProfile;
    } catch (error) {
      console.error(`Error adding IPsec profile for device ${deviceId}:`, error);
      throw error;
    }
  }

  // ==================== SITE-TO-SITE SETUP ====================

  /**
   * Create complete site-to-site IPsec tunnel
   */
  async createSiteToSiteTunnel(config: SiteToSiteConfig, userId?: string): Promise<any> {
    const client = await this.getClient(config.deviceId);
    
    try {
      const response = await client.createIPsecSiteToSite(config);
      
      if (!response.success) {
        throw new Error(`Failed to create site-to-site tunnel: ${response.error}`);
      }

      // Store components in database
      const timestamp = new Date().toISOString();
      
      // Store profile
      if (response.data.profile) {
        this.insertProfileStmt.run(
          config.deviceId,
          response.data.profile.name || config.profileName,
          'modp2048',
          'aes-256',
          'sha256',
          '1d',
          1, // nat_traversal
          '8s',
          4,
          config.comment || `Site-to-site tunnel to ${config.remotePeerIP}`,
          0, // disabled
          response.data.profile['.id'],
          timestamp,
          timestamp
        );
      }

      // Store peer
      if (response.data.peer) {
        this.insertPeerStmt.run(
          config.deviceId,
          response.data.peer.name || config.peerName,
          config.remotePeerIP,
          null, // local_address
          'ike2',
          response.data.profile?.name || config.profileName,
          0, // passive
          config.comment || `Site-to-site peer ${config.remotePeerIP}`,
          0, // disabled
          response.data.peer['.id'],
          timestamp,
          timestamp
        );
      }

      // Store identity
      if (response.data.identity) {
        this.insertIdentityStmt.run(
          config.deviceId,
          response.data.peer?.name || config.peerName,
          'pre-shared-key',
          config.psk, // Note: In production, this should be encrypted
          null, // certificate
          'port-strict',
          'remote-id',
          null, // mode_config
          null, // policy_template_group
          null, // my_id
          null, // remote_id
          config.comment || `Identity for ${config.remotePeerIP}`,
          0, // disabled
          response.data.identity['.id'],
          timestamp,
          timestamp
        );
      }

      // Store policies
      if (response.data.policies && Array.isArray(response.data.policies)) {
        for (let i = 0; i < config.localNetworks.length; i++) {
          for (let j = 0; j < config.remoteNetworks.length; j++) {
            const policyIndex = i * config.remoteNetworks.length + j;
            const policy = response.data.policies[policyIndex];
            
            if (policy) {
              this.insertPolicyStmt.run(
                config.deviceId,
                config.localNetworks[i],
                config.remoteNetworks[j],
                'all',
                'encrypt',
                1, // tunnel
                response.data.peer?.name || config.peerName,
                null, // proposal_name
                config.comment || `Policy ${config.localNetworks[i]} -> ${config.remoteNetworks[j]}`,
                0, // disabled
                policy['.id'],
                timestamp,
                timestamp
              );
            }
          }
        }
      }

      this.emit('siteToSiteCreated', { deviceId: config.deviceId, config, response: response.data });
      return response.data;
    } catch (error) {
      console.error(`Error creating site-to-site tunnel for device ${config.deviceId}:`, error);
      throw error;
    }
  }

  // ==================== MONITORING ====================

  /**
   * Get active IPsec peers
   */
  async getActivePeers(deviceId: string, limit: number = 100): Promise<IPsecActivePeer[]> {
    const client = await this.getClient(deviceId);
    
    try {
      const response = await client.getIPsecActivePeers();
      
      if (!response.success) {
        throw new Error(`Failed to get active IPsec peers: ${response.error}`);
      }

      // Store in database for historical tracking
      await this.storeActivePeersData(deviceId, response.data || []);
      
      // Return processed data
      return (response.data || []).map((peer: any) => ({
        device_id: deviceId,
        remote_address: peer['remote-address'],
        local_address: peer['local-address'],
        state: peer.state,
        uptime: peer.uptime,
        rx_bytes: parseInt(peer['rx-bytes']) || 0,
        tx_bytes: parseInt(peer['tx-bytes']) || 0,
        last_seen: peer['last-seen'],
        responder: peer.responder === 'true',
        collected_at: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Error getting active IPsec peers for device ${deviceId}:`, error);
      // Fallback to database data
      const peers = this.getActivePeersStmt.all(deviceId, limit);
      return peers.map(this.mapActivePeer);
    }
  }

  /**
   * Store active peers data in database
   */
  private async storeActivePeersData(deviceId: string, peers: any[]): Promise<void> {
    const timestamp = new Date().toISOString();
    
    for (const peer of peers) {
      try {
        this.insertActivePeerStmt.run(
          deviceId,
          peer['remote-address'] || null,
          peer['local-address'] || null,
          peer.state || null,
          peer.uptime || null,
          parseInt(peer['rx-bytes']) || 0,
          parseInt(peer['tx-bytes']) || 0,
          peer['last-seen'] || null,
          peer.responder === 'true' ? 1 : 0,
          timestamp
        );
      } catch (error) {
        // Ignore insert errors (may be duplicates)
        console.debug(`Skipped storing active peer data:`, error);
      }
    }
  }

  // ==================== VALIDATION ====================

  /**
   * Validate IPsec policy
   */
  private validateIPsecPolicy(policy: Partial<IPsecPolicy>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!policy.src_address && !policy.dst_address) {
      errors.push('Either source or destination address must be specified');
    }

    if (policy.action && !['encrypt', 'bypass', 'discard'].includes(policy.action)) {
      warnings.push(`Unusual action: ${policy.action}. Common actions are: encrypt, bypass, discard`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate IPsec peer
   */
  private validateIPsecPeer(peer: Partial<IPsecPeer>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!peer.name) {
      errors.push('Peer name is required');
    }

    if (peer.exchange_mode && !['ike', 'ike2'].includes(peer.exchange_mode)) {
      warnings.push(`Unusual exchange mode: ${peer.exchange_mode}. Common modes are: ike, ike2`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate IPsec profile
   */
  private validateIPsecProfile(profile: Partial<IPsecProfile>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!profile.name) {
      errors.push('Profile name is required');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ==================== DATABASE SYNC ====================

  /**
   * Sync policies with database
   */
  private async syncPoliciesWithDb(deviceId: string, policies: any[]): Promise<void> {
    console.log(`💾 [Sync] Starting sync of ${policies.length} IPsec policies for device ${deviceId}`);
    
    // Clear existing policies for this device
    const deleteStmt = this.db.prepare('DELETE FROM ipsec_policies WHERE device_id = ?');
    const deleteResult = deleteStmt.run(deviceId);
    console.log(`🗑️ [Sync] Deleted ${deleteResult.changes} existing policies`);
    
    const timestamp = new Date().toISOString();
    let insertedCount = 0;
    
    for (const policy of policies) {
      try {
        this.insertPolicyStmt.run(
          deviceId,
          policy['src-address'] || null,
          policy['dst-address'] || null,
          policy.protocol || 'all',
          policy.action || 'encrypt',
          policy.tunnel === 'true' ? 1 : 0,
          policy.peer || null,
          policy.proposal || null,
          policy['ph2-state'] || null,
          policy.comment || null,
          policy.disabled === 'true' ? 1 : 0,
          policy['.id'] || null,
          timestamp,
          timestamp
        );
        insertedCount++;
      } catch (error) {
        console.error(`❌ [Sync] Failed to insert policy:`, error, policy);
      }
    }
    
    console.log(`✅ [Sync] Successfully inserted ${insertedCount} policies into database`);
  }

  /**
   * Sync peers with database
   */
  private async syncPeersWithDb(deviceId: string, peers: any[]): Promise<void> {
    console.log(`💾 [Sync] Starting sync of ${peers.length} IPsec peers for device ${deviceId}`);
    
    // Clear existing peers for this device
    const deleteStmt = this.db.prepare('DELETE FROM ipsec_peers WHERE device_id = ?');
    const deleteResult = deleteStmt.run(deviceId);
    console.log(`🗑️ [Sync] Deleted ${deleteResult.changes} existing peers`);
    
    const timestamp = new Date().toISOString();
    let insertedCount = 0;
    
    for (const peer of peers) {
      try {
        this.insertPeerStmt.run(
          deviceId,
          peer.name || null,
          peer.address || null,
          peer['local-address'] || null,
          peer['exchange-mode'] || 'ike2',
          peer.profile || null,
          peer.passive === 'true' ? 1 : 0,
          peer.comment || null,
          peer.disabled === 'true' ? 1 : 0,
          peer['.id'] || null,
          timestamp,
          timestamp
        );
        insertedCount++;
      } catch (error) {
        console.error(`❌ [Sync] Failed to insert peer:`, error, peer);
      }
    }
    
    console.log(`✅ [Sync] Successfully inserted ${insertedCount} peers into database`);
  }

  /**
   * Sync profiles with database
   */
  private async syncProfilesWithDb(deviceId: string, profiles: any[]): Promise<void> {
    console.log(`💾 [Sync] Starting sync of ${profiles.length} IPsec profiles for device ${deviceId}`);
    
    // Clear existing profiles for this device
    const deleteStmt = this.db.prepare('DELETE FROM ipsec_profiles WHERE device_id = ?');
    const deleteResult = deleteStmt.run(deviceId);
    console.log(`🗑️ [Sync] Deleted ${deleteResult.changes} existing profiles`);
    
    const timestamp = new Date().toISOString();
    let insertedCount = 0;
    
    for (const profile of profiles) {
      try {
        this.insertProfileStmt.run(
          deviceId,
          profile.name || null,
          profile['dh-group'] || null,
          profile['enc-algorithm'] || null,
          profile['hash-algorithm'] || null,
          profile.lifetime || null,
          profile['nat-traversal'] === 'true' ? 1 : 0,
          profile['dpd-interval'] || null,
          parseInt(profile['dpd-maximum-failures']) || null,
          profile.comment || null,
          profile.disabled === 'true' ? 1 : 0,
          profile['.id'] || null,
          timestamp,
          timestamp
        );
        insertedCount++;
      } catch (error) {
        console.error(`❌ [Sync] Failed to insert profile:`, error, profile);
      }
    }
    
    console.log(`✅ [Sync] Successfully inserted ${insertedCount} profiles into database`);
  }

  // ==================== MAPPING FUNCTIONS ====================

  private mapPolicy = (policy: any): IPsecPolicy => ({
    id: String(policy.id),
    device_id: policy.device_id,
    src_address: policy.src_address,
    dst_address: policy.dst_address,
    protocol: policy.protocol,
    action: policy.action,
    tunnel: Boolean(policy.tunnel),
    peer_name: policy.peer_name,
    proposal_name: policy.proposal_name,
    ph2_state: policy.ph2_state,
    comment: policy.comment,
    disabled: Boolean(policy.disabled),
    ros_id: policy.ros_id,
    created_at: policy.created_at ? new Date(policy.created_at).toISOString() : new Date().toISOString(),
    updated_at: policy.updated_at ? new Date(policy.updated_at).toISOString() : new Date().toISOString()
  } as any);

  private mapPeer = (peer: any): IPsecPeer => ({
    id: String(peer.id),
    device_id: peer.device_id,
    name: peer.name,
    address: peer.address,
    local_address: peer.local_address,
    exchange_mode: peer.exchange_mode,
    profile_name: peer.profile_name,
    passive: Boolean(peer.passive),
    comment: peer.comment,
    disabled: Boolean(peer.disabled),
    ros_id: peer.ros_id,
    created_at: peer.created_at ? new Date(peer.created_at).toISOString() : new Date().toISOString(),
    updated_at: peer.updated_at ? new Date(peer.updated_at).toISOString() : new Date().toISOString()
  } as any);

  private mapProfile = (profile: any): IPsecProfile => ({
    id: String(profile.id),
    device_id: profile.device_id,
    name: profile.name,
    dh_group: profile.dh_group,
    enc_algorithm: profile.enc_algorithm,
    hash_algorithm: profile.hash_algorithm,
    lifetime: profile.lifetime,
    nat_traversal: Boolean(profile.nat_traversal),
    dpd_interval: profile.dpd_interval,
    dpd_maximum_failures: profile.dpd_maximum_failures,
    comment: profile.comment,
    disabled: Boolean(profile.disabled),
    ros_id: profile.ros_id,
    created_at: profile.created_at ? new Date(profile.created_at).toISOString() : new Date().toISOString(),
    updated_at: profile.updated_at ? new Date(profile.updated_at).toISOString() : new Date().toISOString()
  } as any);

  private mapActivePeer = (peer: any): IPsecActivePeer => ({
    id: peer.id,
    device_id: peer.device_id,
    remote_address: peer.remote_address,
    local_address: peer.local_address,
    state: peer.state,
    uptime: peer.uptime,
    rx_bytes: peer.rx_bytes,
    tx_bytes: peer.tx_bytes,
    last_seen: peer.last_seen,
    responder: Boolean(peer.responder),
    collected_at: peer.collected_at ? new Date(peer.collected_at).toISOString() : new Date().toISOString()
  } as any);

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