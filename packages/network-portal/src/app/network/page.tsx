/**
 * Network Page
 * 
 * Network topology discovery, DHCP monitoring, and traffic analysis
 * for RouterOS devices with enhanced network visibility.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '../../components/layout/app-layout';
import { CustomSelect, SelectOption } from '../../components/ui/CustomSelect';
import { NetworkTopologyView } from '../../components/network/NetworkTopologyView';
import { DHCPLeasesTable } from '../../components/network/DHCPLeasesTable';

interface Device {
  id: string;
  name: string;
  ip_address: string;
  status: string;
  last_seen?: string;
  routeros_version?: string;
}

interface NetworkTopologyData {
  device_id: string;
  nodes: any[];
  interfaces: any[];
  dhcp_leases: any[];
  arp_entries: any[];
  ip_addresses: any[];
  discovery_timestamp: Date;
}

type NetworkView = 'topology' | 'dhcp';

export default function NetworkPage() {
  const searchParams = useSearchParams();
  const preselectedDeviceId = searchParams?.get('deviceId');
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(preselectedDeviceId || '');
  const [currentView, setCurrentView] = useState<NetworkView>('topology');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Network data states
  const [topologyData, setTopologyData] = useState<NetworkTopologyData | null>(null);
  const [dhcpLeases, setDhcpLeases] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Fetch devices on component mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Pre-select device from URL parameter when devices are loaded
  useEffect(() => {
    if (preselectedDeviceId && devices.length > 0) {
      const deviceExists = devices.find(d => d.id === preselectedDeviceId);
      if (deviceExists) {
        setSelectedDevice(preselectedDeviceId);
      }
    }
  }, [preselectedDeviceId, devices]);

  // Fetch network data when device or view changes
  useEffect(() => {
    if (selectedDevice) {
      const loadDataForView = async () => {
        setIsDataLoading(true);
        setError(null);
        try {
          switch (currentView) {
            case 'topology':
              await fetchTopologyData(selectedDevice);
              break;
            case 'dhcp':
              await fetchDHCPLeases(selectedDevice);
              break;
          }
        } catch (err: any) {
          setError(err.message || 'Failed to load data.');
        } finally {
          setIsDataLoading(false);
        }
      };
      loadDataForView();
    } else {
      // Clear data when no device is selected
      setTopologyData(null);
      setDhcpLeases([]);
    }
  }, [selectedDevice, currentView]);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/monitoring/devices');
      if (!response.ok) throw new Error('Failed to fetch devices');
      
      const data = await response.json();
      setDevices(data.devices || []);
      
      // Select first connected device by default
      const connectedDevice = data.devices?.find((d: Device) => d.status === 'connected');
      if (connectedDevice && !selectedDevice) {
        setSelectedDevice(connectedDevice.id);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      setError('Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTopologyData = async (deviceId: string) => {
    const response = await fetch(`/api/network/devices/${deviceId}/topology`);
    if (!response.ok) throw new Error('Failed to fetch topology data');
    const data = await response.json();
    setTopologyData(data.topology.latest);
  };

  const fetchDHCPLeases = async (deviceId: string) => {
    const response = await fetch(`/api/network/devices/${deviceId}/dhcp-leases`);
    if (!response.ok) throw new Error('Failed to fetch DHCP leases');
    const data = await response.json();
    setDhcpLeases(data.dhcp_leases || []);
  };



  const startTopologyDiscovery = async (deviceId: string) => {
    try {
      setIsDiscovering(true);
      const response = await fetch(`/api/network/devices/${deviceId}/topology/start`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to start topology discovery');
      
      // Refresh topology data
      await fetchTopologyData(deviceId);
    } catch (error) {
      console.error('Failed to start topology discovery:', error);
      setError('Failed to start topology discovery');
      setIsDiscovering(false);
    }
  };

  const stopTopologyDiscovery = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/network/devices/${deviceId}/topology/stop`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to stop topology discovery');
      setIsDiscovering(false);
    } catch (error) {
      console.error('Failed to stop topology discovery:', error);
      setError('Failed to stop topology discovery');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': return 'var(--success)';
      case 'connecting': return 'var(--warning)';
      case 'error': return 'var(--danger)';
      default: return 'var(--text-secondary)';
    }
  };

  const selectedDeviceData = useMemo(() => {
    return devices.find(d => d.id === selectedDevice);
  }, [devices, selectedDevice]);

  // Convert devices to select options
  const deviceOptions: SelectOption[] = useMemo(() => {
    if (devices.length === 0) {
      return [{ value: '', label: 'No devices found', disabled: true }];
    }
    
    return devices.map(device => ({
      value: device.id,
      label: `${device.name} (${device.ip_address})`
    }));
  }, [devices]);

  const networkViews = [
    { value: 'topology', label: 'Network Topology' },
    { value: 'dhcp', label: 'DHCP Clients' }
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="network-dashboard" style={{ padding: 'var(--space-4)' }}>
          <div className="loading-state">
            <p>Loading network dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="network-dashboard" style={{ padding: 'var(--space-4)' }}>
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb-nav" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Link 
                href="/" 
                className="flex items-center transition-colors hover:text-primary"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 'var(--space-1)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Dashboard
              </Link>
              <span style={{ color: 'var(--text-muted)' }}>{'>'}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                Network
                {selectedDeviceData && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}> {'>'} </span>
                    <span>{selectedDeviceData.name}</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Header */}
        <div className="dashboard-header" style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: 'var(--space-2)' }}>
            Network Discovery & Analysis
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Explore network topology, monitor DHCP clients, and analyze traffic patterns
          </p>
        </div>

        <div className="monitoring-layout" style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          {/* Device & View Selection */}
          <div className="device-section" style={{ flex: '1', minWidth: '300px', maxWidth: '400px' }}>
            <div className="card">
              <div style={{ padding: 'var(--space-4)' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: 'var(--space-3)' }}>Device Selection</h2>
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <label htmlFor="device-select" style={{ display: 'block', marginBottom: 'var(--space-2)', fontWeight: '500', color: 'rgba(var(--foreground-rgb), 0.8)', fontSize: '0.9rem' }}>Select Device:</label>
                  <CustomSelect
                    options={deviceOptions}
                    value={selectedDevice}
                    onChange={setSelectedDevice}
                    placeholder={devices.length === 0 ? 'No devices found' : 'Choose device...'}
                    disabled={devices.length === 0}
                    style={{ fontSize: '0.9rem' }}
                  />
                </div>
                
                {selectedDeviceData && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2)', backgroundColor: 'rgba(var(--border-rgb), 0.2)', borderRadius: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        marginRight: 'var(--space-2)',
                        backgroundColor: getStatusColor(selectedDeviceData.status)
                      }}></span>
                      <span style={{ fontWeight: '500', color: 'rgba(var(--foreground-rgb), 0.8)', fontSize: '0.8rem' }}>
                        {selectedDeviceData.status}
                      </span>
                    </div>
                  </div>
                )}

                {/* View Selector */}
                {selectedDevice && (
                  <>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: 'var(--space-2)', color: 'rgba(var(--foreground-rgb), 0.8)' }}>Network View:</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      {networkViews.map((view) => (
                        <button
                          key={view.value}
                          onClick={() => setCurrentView(view.value as NetworkView)}
                          style={{
                            padding: 'var(--space-2) var(--space-3)',
                            borderRadius: 'var(--space-2)',
                            backgroundColor: currentView === view.value ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(var(--border-rgb), 0.2)',
                            border: `1px solid ${currentView === view.value ? 'rgba(var(--primary-rgb), 0.5)' : 'transparent'}`,
                            color: currentView === view.value ? 'rgba(var(--primary-rgb), 1)' : 'rgba(var(--foreground-rgb), 0.8)',
                            fontWeight: '500',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            fontSize: '0.85rem'
                          }}
                          onMouseEnter={(e) => {
                            if (currentView !== view.value) {
                              e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                              e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentView !== view.value) {
                              e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                              e.currentTarget.style.borderColor = 'transparent';
                            }
                          }}
                        >
                          {view.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Network View Content */}
          <div className="network-content" style={{ flex: '3', display: 'flex', flexDirection: 'column' }}>
            {selectedDevice ? (
              <>
                {currentView === 'topology' && (
                  <NetworkTopologyView
                    deviceId={selectedDevice}
                    topologyData={topologyData}
                    isLoading={isDataLoading}
                    isDiscovering={isDiscovering}
                    onStartDiscovery={() => startTopologyDiscovery(selectedDevice)}
                    onStopDiscovery={() => stopTopologyDiscovery(selectedDevice)}
                  />
                )}
                
                {currentView === 'dhcp' && (
                  <DHCPLeasesTable
                    deviceId={selectedDevice}
                    dhcpLeases={dhcpLeases}
                    isLoading={isDataLoading}
                  />
                )}
              </>
            ) : (
              <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
                <h3 style={{ fontWeight: '500', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>No Device Selected</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Please select a device to view network data.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
} 