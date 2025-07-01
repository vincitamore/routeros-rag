import React, { useState, useMemo } from 'react';

interface NetworkNode {
  mac_address: string;
  ip_address: string;
  hostname?: string;
  interface_name?: string;
  device_type: 'dhcp_client' | 'arp_entry' | 'static_ip' | 'unknown';
  is_online: boolean;
  last_seen: Date;
}

interface NetworkTopologyData {
  device_id: string;
  nodes: NetworkNode[];
  interfaces: any[];
  dhcp_leases: any[];
  arp_entries: any[];
  ip_addresses: any[];
  discovery_timestamp: Date;
}

interface NetworkTopologyViewProps {
  deviceId: string;
  topologyData: NetworkTopologyData | null;
  isLoading: boolean;
  isDiscovering?: boolean;
  onStartDiscovery: () => void;
  onStopDiscovery: () => void;
}

export function NetworkTopologyView({ 
  deviceId, 
  topologyData, 
  isLoading, 
  isDiscovering = false,
  onStartDiscovery, 
  onStopDiscovery 
}: NetworkTopologyViewProps) {
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and paginate nodes
  const filteredNodes = useMemo(() => {
    if (!topologyData?.nodes) return [];
    
    let filtered = topologyData.nodes;
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(node => 
        node.ip_address.toLowerCase().includes(term) ||
        node.mac_address.toLowerCase().includes(term) ||
        (node.hostname && node.hostname.toLowerCase().includes(term)) ||
        (node.interface_name && node.interface_name.toLowerCase().includes(term))
      );
    }
    
    // Sort by online status, then by IP
    filtered.sort((a, b) => {
      if (a.is_online !== b.is_online) return b.is_online ? 1 : -1;
      return a.ip_address.localeCompare(b.ip_address);
    });
    
    return filtered;
  }, [topologyData?.nodes, searchTerm]);

  const displayedNodes = showAllNodes ? filteredNodes : filteredNodes.slice(0, 10);

  const getNodeTypeColor = (nodeType: string): string => {
    switch (nodeType) {
      case 'dhcp_client': return 'var(--success)';
      case 'arp_entry': return 'var(--primary)';
      case 'static_ip': return 'var(--warning)';
      default: return 'var(--text-secondary)';
    }
  };

  const getNodeTypeLabel = (nodeType: string): string => {
    switch (nodeType) {
      case 'dhcp_client': return 'DHCP Client';
      case 'arp_entry': return 'ARP Entry';
      case 'static_ip': return 'Static IP';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div style={{ padding: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>Network Topology</h2>
          <div className="animate-pulse">
            <div style={{ height: '200px', backgroundColor: 'var(--border-light)', borderRadius: 'var(--space-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-secondary)' }}>Loading topology data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>Network Topology</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isDiscovering ? 'var(--success)' : 'var(--text-secondary)'
              }}></div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {isDiscovering ? 'Discovery Active' : 'Discovery Stopped'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={onStartDiscovery}
              disabled={isDiscovering}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--space-2)',
                border: 'none',
                backgroundColor: isDiscovering ? 'var(--text-secondary)' : 'var(--success)',
                color: 'white',
                cursor: isDiscovering ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: '500',
                opacity: isDiscovering ? 0.6 : 1
              }}
            >
              {isDiscovering ? 'Discovering...' : 'Start Discovery'}
            </button>
            <button
              onClick={onStopDiscovery}
              disabled={!isDiscovering}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--space-2)',
                border: 'none',
                backgroundColor: !isDiscovering ? 'var(--text-secondary)' : 'var(--error)',
                color: 'white',
                cursor: !isDiscovering ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: '500',
                opacity: !isDiscovering ? 0.6 : 1
              }}
            >
              Stop Discovery
            </button>
          </div>
        </div>

        {topologyData ? (
          <>
            {/* Topology Summary */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
              gap: 'var(--space-3)', 
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(var(--border-rgb), 0.1)',
              borderRadius: 'var(--space-2)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                  {topologyData.nodes.length}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Network Nodes
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--success)' }}>
                  {topologyData.nodes.filter(n => n.is_online).length}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Online Devices
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--warning)' }}>
                  {topologyData.interfaces.length}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Interfaces
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {topologyData.dhcp_leases.length}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  DHCP Leases
                </div>
              </div>
            </div>

            {/* Network Nodes List */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Discovered Network Nodes ({filteredNodes.length})
                </h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--space-2)',
                      border: '1px solid rgba(var(--border-rgb), 0.3)',
                      fontSize: '0.8rem',
                      width: '200px',
                      backgroundColor: 'var(--background)'
                    }}
                  />
                  {filteredNodes.length > 10 && (
                    <button
                      onClick={() => setShowAllNodes(!showAllNodes)}
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        borderRadius: 'var(--space-2)',
                        border: '1px solid rgba(var(--border-rgb), 0.3)',
                        backgroundColor: 'var(--background)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      {showAllNodes ? 'Show Less' : `Show All (${filteredNodes.length})`}
                    </button>
                  )}
                </div>
              </div>
              {filteredNodes.length > 0 ? (
                <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                  {displayedNodes.map((node, index) => (
                    <div 
                      key={`${node.ip_address}-${node.mac_address}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-3)',
                        backgroundColor: 'rgba(var(--border-rgb), 0.1)',
                        borderRadius: 'var(--space-2)',
                        border: '1px solid rgba(var(--border-rgb), 0.2)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: node.is_online ? 'var(--success)' : 'var(--text-secondary)'
                        }}></div>
                        <div>
                          <div style={{ fontWeight: '500', fontSize: '0.85rem' }}>
                            {node.hostname || node.ip_address}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {node.mac_address}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: 'var(--space-1)',
                          backgroundColor: getNodeTypeColor(node.device_type),
                          color: 'white',
                          fontSize: '0.7rem',
                          fontWeight: '500'
                        }}>
                          {getNodeTypeLabel(node.device_type)}
                        </div>
                        {node.interface_name && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                            via {node.interface_name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {!showAllNodes && filteredNodes.length > 10 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: 'var(--space-3)', 
                      backgroundColor: 'rgba(var(--border-rgb), 0.1)',
                      borderRadius: 'var(--space-2)',
                      border: '1px dashed rgba(var(--border-rgb), 0.3)'
                    }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                        Showing {displayedNodes.length} of {filteredNodes.length} nodes
                      </p>
                      <button
                        onClick={() => setShowAllNodes(true)}
                        style={{
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--space-2)',
                          border: 'none',
                          backgroundColor: 'var(--primary)',
                          color: 'white',
                          cursor: 'pointer',
                          fontSize: '0.8rem'
                        }}
                      >
                        Load All {filteredNodes.length} Nodes
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 'var(--space-6)', 
                  color: 'var(--text-secondary)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.1)',
                  borderRadius: 'var(--space-2)'
                }}>
                  <p>No network nodes discovered yet</p>
                  <p style={{ fontSize: '0.8rem', marginTop: 'var(--space-1)' }}>
                    Click "Start Discovery" to begin network topology scanning
                  </p>
                </div>
              )}
            </div>

            {/* Discovery Information */}
            <div style={{ 
              padding: 'var(--space-3)', 
              backgroundColor: 'rgba(var(--border-rgb), 0.05)', 
              borderRadius: 'var(--space-2)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}>
              Last discovery: {new Date(topologyData.discovery_timestamp).toLocaleString()}
            </div>
          </>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--space-8)', 
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(var(--border-rgb), 0.1)',
            borderRadius: 'var(--space-2)'
          }}>
            <h3 style={{ fontWeight: '500', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>No Topology Data</h3>
            <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-3)' }}>
              Start network discovery to explore your network topology
            </p>
            <button
              onClick={onStartDiscovery}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--space-2)',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500'
              }}
            >
              Start Network Discovery
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 