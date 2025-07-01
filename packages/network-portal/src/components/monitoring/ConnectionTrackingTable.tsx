/**
 * Connection Tracking Table Component
 * 
 * Displays active network connections with real-time monitoring
 * using glassmorphism design patterns.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from './ConnectionTrackingTable.module.css';

interface ConnectionTrackingEntry {
  id?: number;
  device_id: string;
  src_address?: string;
  dst_address?: string;
  src_port?: number;
  dst_port?: number;
  protocol?: string;
  state?: string;
  tcp_state?: string;
  connection?: string; // Connection tracking state (SAC, SC, C, etc.)
  timeout?: number;
  orig_bytes?: number;
  repl_bytes?: number;
  orig_packets?: number;
  repl_packets?: number;
  orig_rate?: string;
  repl_rate?: string;
  assured?: boolean;
  seen_reply?: boolean;
  timestamp: Date;
}

interface ConnectionTrackingTableProps {
  deviceId: string;
  isLoading?: boolean;
  refreshInterval?: number; // in milliseconds
}

export function ConnectionTrackingTable({ 
  deviceId, 
  isLoading = false,
  refreshInterval = 5000 
}: ConnectionTrackingTableProps) {
  const [connections, setConnections] = useState<ConnectionTrackingEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof ConnectionTrackingEntry>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'live' | 'historical'>('live');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch connection tracking data
  const fetchConnections = async (live: boolean = true) => {
    try {
      setError(null);
      const response = await fetch(
        `/api/monitoring/devices/${deviceId}/connection-tracking?live=${live}&hours=1`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch connection tracking data');
      }
      
      const data = await response.json();
      
      if (data.connections) {
        const processedConnections = data.connections.map((conn: any) => {
          // Handle various timestamp formats
          let timestamp: Date;
          const timeValue = conn.timestamp || conn.collected_at;
          
          if (!timeValue) {
            timestamp = new Date(); // Default to now if no timestamp
          } else if (typeof timeValue === 'string') {
            // Handle ISO string or other string formats
            timestamp = new Date(timeValue);
            // If still invalid, try parsing as a different format
            if (isNaN(timestamp.getTime())) {
              timestamp = new Date(); // Fallback to now
            }
          } else if (typeof timeValue === 'number') {
            // Handle Unix timestamp (seconds or milliseconds)
            timestamp = new Date(timeValue > 1000000000000 ? timeValue : timeValue * 1000);
          } else {
            timestamp = new Date(); // Fallback to now
          }
          
          return {
            ...conn,
            timestamp
          };
        });
        setConnections(processedConnections);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch connection tracking:', error);
      setError(error instanceof Error ? error.message : 'Failed to load connection data');
    }
  };

  // Initial load
  useEffect(() => {
    if (deviceId) {
      fetchConnections(viewMode === 'live');
    }
  }, [deviceId, viewMode]);

  // Auto-refresh for live mode
  useEffect(() => {
    if (deviceId && viewMode === 'live') {
      const interval = setInterval(() => {
        fetchConnections(true);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [deviceId, viewMode, refreshInterval]);

  // Filter and sort connections
  const filteredAndSortedConnections = useMemo(() => {
    let filtered = connections.filter(conn => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        conn.src_address?.toLowerCase().includes(searchLower) ||
        conn.dst_address?.toLowerCase().includes(searchLower) ||
        conn.protocol?.toLowerCase().includes(searchLower) ||
        conn.state?.toLowerCase().includes(searchLower) ||
        conn.tcp_state?.toLowerCase().includes(searchLower) ||
        conn.repl_rate?.toLowerCase().includes(searchLower) ||
        conn.src_port?.toString().includes(searchLower) ||
        conn.dst_port?.toString().includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [connections, searchTerm, sortBy, sortOrder]);

  const handleSort = (column: keyof ConnectionTrackingEntry) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getStateColor = (state?: string): string => {
    if (!state) return 'var(--text-secondary)';
    
    switch (state.toLowerCase()) {
      case 'established':
      case 'connected':
        return 'var(--success)';
      case 'syn_sent':
      case 'syn_recv':
      case 'connecting':
        return 'var(--warning)';
      case 'close_wait':
      case 'closing':
      case 'closed':
        return 'var(--error)';
      default:
        return 'var(--text-primary)';
    }
  };



  const formatTimeout = (timeout?: number): string => {
    if (!timeout) return '-';
    
    if (timeout < 60) return `${timeout}s`;
    if (timeout < 3600) return `${Math.floor(timeout / 60)}m`;
    return `${Math.floor(timeout / 3600)}h`;
  };

  const formatTimestamp = (timestamp: Date): string => {
    // Check if timestamp is valid
    if (!timestamp || isNaN(timestamp.getTime())) {
      return 'Unknown';
    }
    
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    // Handle future timestamps (clock skew)
    if (diff < 0) {
      return timestamp.toLocaleTimeString();
    }
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    // For older timestamps, show the actual time
    return timestamp.toLocaleString();
  };

  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '-';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatRate = (rate?: string): string => {
    if (!rate || rate === '0' || rate === '0bps') return '-';
    
    // Handle numeric values (assume bits per second)
    const numericRate = parseInt(rate);
    if (!isNaN(numericRate)) {
      if (numericRate === 0) return '-';
      
      // Convert bps to Kbps for better readability
      if (numericRate >= 1000) {
        const kbps = (numericRate / 1000).toFixed(1);
        return `${kbps} Kbps`;
      } else {
        return `${numericRate} bps`;
      }
    }
    
    // Handle string values that already have units
    if (rate.includes('bps') || rate.includes('Kbps') || rate.includes('Mbps')) {
      return rate;
    }
    
    return rate;
  };

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>
            Connection Tracking
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {lastUpdate && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Updated {formatTimestamp(lastUpdate)}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: viewMode === 'live' ? 'var(--success)' : 'var(--warning)'
              }}></span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {viewMode === 'live' ? 'Live' : 'Historical'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search connections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              color: 'rgb(var(--foreground-rgb))',
              fontSize: '0.875rem',
              backdropFilter: 'blur(12px)',
              outline: 'none',
              transition: 'all 0.2s ease-in-out'
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

          <div style={{ display: 'flex', backgroundColor: 'rgba(var(--border-rgb), 0.3)', borderRadius: 'var(--space-2)', padding: '2px' }}>
            {['live', 'historical'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as 'live' | 'historical')}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  borderRadius: 'calc(var(--space-2) - 2px)',
                  border: 'none',
                  backgroundColor: viewMode === mode ? 'rgba(var(--primary-rgb), 0.3)' : 'transparent',
                  color: viewMode === mode ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  textTransform: 'capitalize'
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchConnections(viewMode === 'live')}
            disabled={isLoading}
            style={{
              padding: 'var(--space-2)',
              backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
              border: '1px solid rgba(var(--primary-rgb), 0.3)',
              borderRadius: 'var(--space-2)',
              color: 'var(--primary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
            }}
          >
            <svg 
              width="16" 
              height="16" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2} 
              viewBox="0 0 24 24"
              style={{ 
                transform: isLoading ? 'rotate(360deg)' : 'rotate(0deg)',
                transition: 'transform 0.5s ease-in-out'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {error && (
          <div style={{ 
            marginTop: 'var(--space-3)', 
            padding: 'var(--space-2) var(--space-3)', 
            backgroundColor: 'rgba(var(--error-rgb), 0.1)', 
            border: '1px solid rgba(var(--error-rgb), 0.3)', 
            borderRadius: 'var(--space-2)', 
            color: 'var(--error)',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '200px',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div className={styles.spinner}></div>
              Loading connections...
            </div>
          </div>
        ) : filteredAndSortedConnections.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '200px',
            color: 'var(--text-secondary)',
            flexDirection: 'column',
            gap: 'var(--space-2)'
          }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                No active connections
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                {searchTerm ? 'No connections match your search criteria' : 'No network connections are currently active'}
              </div>
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                {[
                  { key: 'src_address', label: 'Source' },
                  { key: 'dst_address', label: 'Destination' },
                  { key: 'protocol', label: 'Protocol' },
                  { key: 'repl_rate', label: 'Reply Rate' },
                  { key: 'repl_bytes', label: 'Reply Bytes' },
                  { key: 'tcp_state', label: 'TCP State' },
                  { key: 'timeout', label: 'Timeout' },
                  { key: 'timestamp', label: 'Last Seen' }
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key as keyof ConnectionTrackingEntry)}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(var(--border-rgb), 0.3)',
                      transition: 'background-color 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      {label}
                      {sortBy === key && (
                        <svg 
                          width="12" 
                          height="12" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth={2} 
                          viewBox="0 0 24 24"
                          style={{ 
                            transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease-in-out'
                          }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedConnections.map((connection, index) => (
                <tr
                  key={`${connection.id || index}`}
                  style={{
                    borderBottom: '1px solid rgba(var(--border-rgb), 0.2)',
                    transition: 'background-color 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {connection.src_address || '-'}
                      {connection.src_port && (
                        <span style={{ color: 'var(--text-secondary)' }}>:{connection.src_port}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {connection.dst_address || '-'}
                      {connection.dst_port && (
                        <span style={{ color: 'var(--text-secondary)' }}>:{connection.dst_port}</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      color: 'var(--text-primary)'
                    }}>
                      {connection.protocol || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      color: connection.repl_rate && connection.repl_rate !== '0' && connection.repl_rate !== '0bps' 
                        ? 'var(--warning)' 
                        : 'var(--text-secondary)'
                    }}>
                      {formatRate(connection.repl_rate)}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      color: connection.repl_bytes && connection.repl_bytes > 0 
                        ? 'var(--primary)' 
                        : 'var(--text-secondary)'
                    }}>
                      {formatBytes(connection.repl_bytes)}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      color: getStateColor(connection.tcp_state || connection.state)
                    }}>
                      {connection.tcp_state || connection.state || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {formatTimeout(connection.timeout)}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {formatTimestamp(connection.timestamp)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {filteredAndSortedConnections.length > 0 && (
        <div style={{ 
          padding: 'var(--space-3) var(--space-4)', 
          borderTop: '1px solid rgba(var(--border-rgb), 0.3)',
          backgroundColor: 'rgba(var(--border-rgb), 0.1)',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>
            Showing {filteredAndSortedConnections.length} of {connections.length} connections
          </span>
          <span>
            Auto-refresh: {viewMode === 'live' ? `${refreshInterval / 1000}s` : 'Off'}
          </span>
        </div>
      )}
    </div>
  );
} 