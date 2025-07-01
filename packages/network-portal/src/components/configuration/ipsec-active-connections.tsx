'use client';

import React, { useState, useEffect, useMemo } from 'react';

// SVG Icons matching our design system
const ActivityIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

interface IPsecActiveConnection {
  id: string;
  peer_name?: string;
  local_address?: string;
  remote_address?: string;
  state?: string;
  uptime?: string;
  rx_bytes?: number;
  tx_bytes?: number;
  encryption?: string;
  hash?: string;
  dh_group?: string;
  role?: string;
  last_seen?: Date;
}

interface IPsecActiveConnectionsProps {
  deviceId: string;
  connections: IPsecActiveConnection[];
  onRefresh: () => void;
  isLoading: boolean;
}

type SortField = 'peer_name' | 'state' | 'uptime' | 'rx_bytes' | 'tx_bytes' | 'last_seen';
type SortDirection = 'asc' | 'desc';

export function IPsecActiveConnections({ deviceId, connections = [], onRefresh, isLoading }: IPsecActiveConnectionsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [sortField, setSortField] = useState<SortField>('peer_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh > 0 && !isLoading) {
      const interval = setInterval(() => {
        onRefresh();
      }, autoRefresh * 1000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, isLoading, onRefresh]);

  // Filter and sort connections
  const filteredAndSortedConnections = useMemo(() => {
    // Ensure connections is always an array
    const safeConnections = Array.isArray(connections) ? connections : [];
    let filtered = safeConnections;
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = safeConnections.filter(conn => 
        conn.peer_name?.toLowerCase().includes(searchLower) ||
        conn.local_address?.toLowerCase().includes(searchLower) ||
        conn.remote_address?.toLowerCase().includes(searchLower) ||
        conn.state?.toLowerCase().includes(searchLower) ||
        conn.encryption?.toLowerCase().includes(searchLower) ||
        conn.role?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle special cases
      if (sortField === 'rx_bytes' || sortField === 'tx_bytes') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      } else if (sortField === 'last_seen') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else {
        aValue = aValue || '';
        bValue = bValue || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [connections, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatUptime = (uptime?: string) => {
    if (!uptime) return '-';
    return uptime;
  };

  const getStateColor = (state?: string) => {
    switch (state?.toLowerCase()) {
      case 'established':
        return 'var(--success)';
      case 'connecting':
      case 'rekeying':
        return 'var(--warning)';
      case 'disconnected':
      case 'failed':
        return 'var(--error)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStateBackground = (state?: string) => {
    switch (state?.toLowerCase()) {
      case 'established':
        return 'rgba(var(--success-rgb), 0.15)';
      case 'connecting':
      case 'rekeying':
        return 'rgba(var(--warning-rgb), 0.15)';
      case 'disconnected':
      case 'failed':
        return 'rgba(var(--error-rgb), 0.15)';
      default:
        return 'rgba(var(--border-rgb), 0.15)';
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    // Ensure connections is always an array
    const safeConnections = Array.isArray(connections) ? connections : [];
    const total = safeConnections.length;
    const established = safeConnections.filter(c => c.state?.toLowerCase() === 'established').length;
    const totalRx = safeConnections.reduce((sum, c) => sum + (c.rx_bytes || 0), 0);
    const totalTx = safeConnections.reduce((sum, c) => sum + (c.tx_bytes || 0), 0);
    
    return { total, established, totalRx, totalTx };
  }, [connections]);

  return (
    <div style={{ padding: 'var(--space-6)' }}>
      {/* Header Section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
        gap: 'var(--space-4)'
      }}>
        <div>
          <h3 style={{ 
            fontSize: 'var(--text-xl)', 
            fontWeight: '600', 
            color: 'var(--text-primary)',
            marginBottom: 'var(--space-2)' 
          }}>
            Active IPsec Connections ({filteredAndSortedConnections.length})
          </h3>
          <p style={{ 
            fontSize: 'var(--text-sm)', 
            color: 'var(--text-secondary)',
            margin: 0 
          }}>
            Monitor active IPsec tunnel connections and traffic statistics
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search connections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              width: '200px',
              transition: 'all 0.2s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
              e.target.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
              e.target.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
            }}
          />

          {/* Auto-refresh selector */}
          <select
            value={autoRefresh}
            onChange={(e) => setAutoRefresh(Number(e.target.value))}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              cursor: 'pointer'
            }}
          >
            <option value={0}>No auto-refresh</option>
            <option value={10}>10 seconds</option>
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={300}>5 minutes</option>
          </select>
          
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)'
            }}
          >
            <RefreshIcon className="w-4 h-4" />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(var(--primary-rgb), 0.15)',
              borderRadius: 'var(--radius)',
              color: 'var(--primary)'
            }}>
              <ActivityIcon className="w-6 h-6" />
            </div>
            <div>
              <div style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: '700',
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                {stats.total}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-1)'
              }}>
                Total Connections
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(var(--success-rgb), 0.15)',
              borderRadius: 'var(--radius)',
              color: 'var(--success)'
            }}>
              <ActivityIcon className="w-6 h-6" />
            </div>
            <div>
              <div style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: '700',
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                {stats.established}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-1)'
              }}>
                Established
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(var(--warning-rgb), 0.15)',
              borderRadius: 'var(--radius)',
              color: 'var(--warning)'
            }}>
              <ActivityIcon className="w-6 h-6" />
            </div>
            <div>
              <div style={{
                fontSize: 'var(--text-lg)',
                fontWeight: '700',
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                {formatBytes(stats.totalRx)}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-1)'
              }}>
                Total RX
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              padding: 'var(--space-3)',
                             backgroundColor: 'rgba(var(--primary-rgb), 0.15)',
               borderRadius: 'var(--radius)',
               color: 'var(--primary)'
            }}>
              <ActivityIcon className="w-6 h-6" />
            </div>
            <div>
              <div style={{
                fontSize: 'var(--text-lg)',
                fontWeight: '700',
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                {formatBytes(stats.totalTx)}
              </div>
              <div style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                marginTop: 'var(--space-1)'
              }}>
                Total TX
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {filteredAndSortedConnections.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-16)',
            textAlign: 'center'
          }}>
            <div style={{ 
              color: 'var(--text-muted)', 
              marginBottom: 'var(--space-4)' 
            }}>
              <ActivityIcon className="w-16 h-16" />
            </div>
            <h4 style={{ 
              fontSize: 'var(--text-lg)', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              marginBottom: 'var(--space-2)' 
            }}>
              No Active Connections
            </h4>
            <p style={{ 
              fontSize: 'var(--text-sm)', 
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-4)',
              maxWidth: '400px' 
            }}>
              {searchTerm 
                ? 'No connections match your search criteria. Try adjusting your search terms.'
                : 'No active IPsec connections found. Connections will appear here once established.'
              }
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ 
                  backgroundColor: 'rgba(var(--border-rgb), 0.4)',
                  borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
                }}>
                  <th 
                    onClick={() => handleSort('peer_name')}
                    style={{ 
                      padding: 'var(--space-3) var(--space-4)', 
                      textAlign: 'left',
                      fontSize: 'var(--text-sm)',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      Peer
                      {sortField === 'peer_name' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th style={{ 
                    padding: 'var(--space-3) var(--space-4)', 
                    textAlign: 'left',
                    fontSize: 'var(--text-sm)',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>Local Address</th>
                  <th style={{ 
                    padding: 'var(--space-3) var(--space-4)', 
                    textAlign: 'left',
                    fontSize: 'var(--text-sm)',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>Remote Address</th>
                  <th 
                    onClick={() => handleSort('state')}
                    style={{ 
                      padding: 'var(--space-3) var(--space-4)', 
                      textAlign: 'left',
                      fontSize: 'var(--text-sm)',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      State
                      {sortField === 'state' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('uptime')}
                    style={{ 
                      padding: 'var(--space-3) var(--space-4)', 
                      textAlign: 'left',
                      fontSize: 'var(--text-sm)',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      Uptime
                      {sortField === 'uptime' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('rx_bytes')}
                    style={{ 
                      padding: 'var(--space-3) var(--space-4)', 
                      textAlign: 'left',
                      fontSize: 'var(--text-sm)',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      RX Bytes
                      {sortField === 'rx_bytes' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('tx_bytes')}
                    style={{ 
                      padding: 'var(--space-3) var(--space-4)', 
                      textAlign: 'left',
                      fontSize: 'var(--text-sm)',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      TX Bytes
                      {sortField === 'tx_bytes' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th style={{ 
                    padding: 'var(--space-3) var(--space-4)', 
                    textAlign: 'left',
                    fontSize: 'var(--text-sm)',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>Encryption</th>
                  <th style={{ 
                    padding: 'var(--space-3) var(--space-4)', 
                    textAlign: 'left',
                    fontSize: 'var(--text-sm)',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>Role</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedConnections.map((connection, index) => (
                  <tr 
                    key={connection.id || `${connection.peer_name}-${connection.remote_address}-${index}`}
                    style={{
                      borderBottom: '1px solid rgba(var(--border-rgb), 0.2)',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)'
                    }}>
                      <div style={{ 
                        fontWeight: '500', 
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {connection.peer_name || '-'}
                      </div>
                    </td>
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {connection.local_address || '-'}
                    </td>
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {connection.remote_address || '-'}
                    </td>
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)'
                    }}>
                      <span style={{
                        padding: 'var(--space-1) var(--space-2)',
                        backgroundColor: getStateBackground(connection.state),
                        color: getStateColor(connection.state),
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: '500',
                        textTransform: 'capitalize'
                      }}>
                        {connection.state || 'unknown'}
                      </span>
                    </td>
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {formatUptime(connection.uptime)}
                    </td>
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {formatBytes(connection.rx_bytes)}
                    </td>
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {formatBytes(connection.tx_bytes)}
                    </td>
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)'
                    }}>
                      {connection.encryption && (
                        <span style={{
                          padding: 'var(--space-1) var(--space-2)',
                          backgroundColor: 'rgba(var(--primary-rgb), 0.15)',
                          color: 'var(--primary)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--text-xs)',
                          fontWeight: '500',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {connection.encryption}
                        </span>
                      )}
                    </td>
                    <td style={{ 
                      padding: 'var(--space-3) var(--space-4)',
                      fontSize: 'var(--text-sm)'
                    }}>
                      <span style={{
                        padding: 'var(--space-1) var(--space-2)',
                        backgroundColor: connection.role === 'initiator' 
                          ? 'rgba(var(--success-rgb), 0.15)' 
                          : 'rgba(var(--warning-rgb), 0.15)',
                        color: connection.role === 'initiator' ? 'var(--success)' : 'var(--warning)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: '500',
                        textTransform: 'capitalize'
                      }}>
                        {connection.role || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 