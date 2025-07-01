import React, { useState } from 'react';
import { InterfaceMetrics } from '../../types/monitoring';
import { Tooltip } from '../ui/Tooltip';
import styles from './InterfacesTable.module.css';

interface InterfacesTableProps {
  metrics: InterfaceMetrics[];
  isLoading: boolean;
  deviceId?: string;
  refreshMetrics?: () => Promise<void>;
}

export function InterfacesTable({ metrics, isLoading, deviceId, refreshMetrics }: InterfacesTableProps) {
  const [resettingInterfaces, setResettingInterfaces] = useState<Set<string>>(new Set());
  const [togglingInterfaces, setTogglingInterfaces] = useState<Set<string>>(new Set());

  const resetInterfaceCounters = async (interfaceName: string) => {
    if (!deviceId) {
      console.error('Device ID is required to reset counters');
      return;
    }

    try {
      setResettingInterfaces(prev => new Set(prev).add(interfaceName));

      const response = await fetch(`/api/monitoring/devices/${deviceId}/reset-counters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interfaceName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset counters');
      }

      const result = await response.json();
      console.log('Reset successful:', result.message);
      
      // Refresh the interface metrics immediately after successful reset
      if (refreshMetrics) {
        await refreshMetrics();
      }
      
    } catch (error) {
      console.error('Failed to reset interface counters:', error);
      // You could add error handling UI here
    } finally {
      setResettingInterfaces(prev => {
        const newSet = new Set(prev);
        newSet.delete(interfaceName);
        return newSet;
      });
    }
  };

  const toggleInterfaceState = async (interfaceName: string, currentlyEnabled: boolean) => {
    if (!deviceId) {
      console.error('Device ID is required to toggle interface state');
      return;
    }

    try {
      setTogglingInterfaces(prev => new Set(prev).add(interfaceName));

      const response = await fetch(`/api/monitoring/devices/${deviceId}/interface-state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          interfaceName, 
          enabled: !currentlyEnabled 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle interface state');
      }

      const result = await response.json();
      console.log('Interface toggle successful:', result.message);
      
      // Refresh the interface metrics immediately after successful toggle
      if (refreshMetrics) {
        await refreshMetrics();
      }
      
    } catch (error) {
      console.error('Failed to toggle interface state:', error);
      // You could add error handling UI here
    } finally {
      setTogglingInterfaces(prev => {
        const newSet = new Set(prev);
        newSet.delete(interfaceName);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-primary">Interface Monitoring</h2>
          <div className="animate-pulse">
            <div className="h-8 rounded mb-4" style={{ backgroundColor: 'var(--border-light)', width: '40%' }}></div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 rounded" style={{ backgroundColor: 'var(--border-light)' }}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="card text-center p-12">
        <h3 className="font-medium text-lg">No Interface Data</h3>
        <p className="text-secondary">No interface metrics have been recorded for the selected time range.</p>
      </div>
    );
  }

  // Get the latest metric for each interface
  const latestMetrics = Array.from(
    metrics.reduce((acc, metric) => {
      if (!acc.has(metric.interface_name) || new Date(acc.get(metric.interface_name)!.timestamp) < new Date(metric.timestamp)) {
        acc.set(metric.interface_name, metric);
      }
      return acc;
    }, new Map<string, InterfaceMetrics>()).values()
  ).sort((a,b) => a.interface_name.localeCompare(b.interface_name));

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>Interface Monitoring</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Type</th>
                <th>MAC Address</th>
                <th>MTU</th>
                <th>RX Bytes</th>
                <th>TX Bytes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {latestMetrics.map((metric) => (
                <tr key={metric.id}>
                  <td style={{ fontWeight: '500' }}>{metric.interface_name}</td>
                  <td>
                    <span className={`${styles.status} ${styles[metric.status?.toLowerCase() || '']}`}>
                      {metric.status}
                    </span>
                  </td>
                  <td>{metric.interface_type}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{metric.mac_address}</td>
                  <td>{metric.mtu}</td>
                  <td style={{ textAlign: 'right' }}>{metric.rx_bytes?.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{metric.tx_bytes?.toLocaleString()}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center' }}>
                      {/* Enable/Disable Button */}
                      <Tooltip content={metric.status === 'disabled' ? 'Enable interface' : 'Disable interface'}>
                        <button
                          onClick={() => toggleInterfaceState(metric.interface_name, metric.status !== 'disabled')}
                          disabled={togglingInterfaces.has(metric.interface_name) || !deviceId}
                          style={{
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--space-2)',
                            backgroundColor: togglingInterfaces.has(metric.interface_name) || !deviceId
                              ? 'rgba(var(--border-rgb), 0.2)'
                              : metric.status === 'disabled'
                                ? 'rgba(var(--success-rgb), 0.2)'
                                : 'rgba(var(--warning-rgb), 0.2)',
                            color: togglingInterfaces.has(metric.interface_name) || !deviceId
                              ? 'var(--text-secondary)'
                              : metric.status === 'disabled'
                                ? 'rgb(var(--success-rgb))'
                                : 'rgb(var(--warning-rgb))',
                            border: `1px solid ${togglingInterfaces.has(metric.interface_name) || !deviceId
                              ? 'rgba(var(--border-rgb), 0.3)'
                              : metric.status === 'disabled'
                                ? 'rgba(var(--success-rgb), 0.3)'
                                : 'rgba(var(--warning-rgb), 0.3)'}`,
                            cursor: togglingInterfaces.has(metric.interface_name) || !deviceId
                              ? 'not-allowed'
                              : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!togglingInterfaces.has(metric.interface_name) && deviceId) {
                              const isDisabled = metric.status === 'disabled';
                              const bgColor = isDisabled ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(var(--warning-rgb), 0.3)';
                              const borderColor = isDisabled ? 'rgba(var(--success-rgb), 0.5)' : 'rgba(var(--warning-rgb), 0.5)';
                              e.currentTarget.style.backgroundColor = bgColor;
                              e.currentTarget.style.borderColor = borderColor;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!togglingInterfaces.has(metric.interface_name) && deviceId) {
                              const isDisabled = metric.status === 'disabled';
                              const bgColor = isDisabled ? 'rgba(var(--success-rgb), 0.2)' : 'rgba(var(--warning-rgb), 0.2)';
                              const borderColor = isDisabled ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(var(--warning-rgb), 0.3)';
                              e.currentTarget.style.backgroundColor = bgColor;
                              e.currentTarget.style.borderColor = borderColor;
                            }
                          }}
                        >
                          {togglingInterfaces.has(metric.interface_name) ? (
                            <svg 
                              width="14" 
                              height="14" 
                              viewBox="0 0 24 24" 
                              style={{ 
                                animation: 'spin 1s linear infinite'
                              }}
                            >
                              <path 
                                fill="currentColor" 
                                d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                              />
                            </svg>
                          ) : metric.status === 'disabled' ? (
                            // Play icon for enabling
                            <svg 
                              width="14" 
                              height="14" 
                              viewBox="0 0 24 24" 
                              fill="currentColor"
                            >
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          ) : (
                            // Pause icon for disabling
                            <svg 
                              width="14" 
                              height="14" 
                              viewBox="0 0 24 24" 
                              fill="currentColor"
                            >
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                            </svg>
                          )}
                        </button>
                      </Tooltip>

                      {/* Reset Button */}
                      <Tooltip content="Reset interface counters">
                        <button
                          onClick={() => resetInterfaceCounters(metric.interface_name)}
                          disabled={resettingInterfaces.has(metric.interface_name) || !deviceId}
                          style={{
                            padding: 'var(--space-2)',
                            borderRadius: 'var(--space-2)',
                            backgroundColor: resettingInterfaces.has(metric.interface_name) || !deviceId
                              ? 'rgba(var(--border-rgb), 0.2)'
                              : 'rgba(var(--primary-rgb), 0.2)',
                            color: resettingInterfaces.has(metric.interface_name) || !deviceId
                              ? 'var(--text-secondary)'
                              : 'rgb(var(--primary-rgb))',
                            border: `1px solid ${resettingInterfaces.has(metric.interface_name) || !deviceId
                              ? 'rgba(var(--border-rgb), 0.3)'
                              : 'rgba(var(--primary-rgb), 0.3)'}`,
                            cursor: resettingInterfaces.has(metric.interface_name) || !deviceId
                              ? 'not-allowed'
                              : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!resettingInterfaces.has(metric.interface_name) && deviceId) {
                              e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
                              e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!resettingInterfaces.has(metric.interface_name) && deviceId) {
                              e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                              e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                            }
                          }}
                        >
                          {resettingInterfaces.has(metric.interface_name) ? (
                            <svg 
                              width="14" 
                              height="14" 
                              viewBox="0 0 24 24" 
                              style={{ 
                                animation: 'spin 1s linear infinite'
                              }}
                            >
                              <path 
                                fill="currentColor" 
                                d="M12,4a8,8,0,0,1,7.89,6.7A1.53,1.53,0,0,0,21.38,12h0a1.5,1.5,0,0,0,1.48-1.75,11,11,0,0,0-21.72,0A1.5,1.5,0,0,0,2.62,12h0a1.53,1.53,0,0,0,1.49-1.3A8,8,0,0,1,12,4Z"
                              />
                            </svg>
                          ) : (
                            <svg 
                              width="14" 
                              height="14" 
                              viewBox="0 0 24 24" 
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8m0 0v-5m0 5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16m0 0v5m0-5h5"
                              />
                            </svg>
                          )}
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {latestMetrics.length > 8 && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Showing {latestMetrics.length} interfaces
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
} 