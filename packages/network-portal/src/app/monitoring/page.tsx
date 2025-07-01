/**
 * Monitoring Dashboard Page
 * 
 * Main monitoring dashboard displaying real-time system metrics
 * for all RouterOS devices with charts and status indicators.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { SystemMetricsChart } from '../../components/monitoring/system-metrics-chart';
import { ViewSelector } from '../../components/monitoring/ViewSelector';
import { InterfacesTable } from '../../components/monitoring/InterfacesTable';
import { ConnectionTrackingTable } from '../../components/monitoring/ConnectionTrackingTable';
import { TrafficChartsView } from '../../components/network/TrafficChartsView';
import { useDeviceMonitoring } from '../../hooks/use-websocket';
import { CustomSelect, SelectOption } from '../../components/ui/CustomSelect';
import { MonitoringOverview, SystemMetrics, TIME_RANGES, TimeRange, InterfaceMetrics } from '../../types/monitoring';
import { AppLayout } from '../../components/layout/app-layout';
import { apiClient } from '@/lib/api-client';
// Dynamically import Unified Terminal Manager component with no SSR
const UnifiedTerminalManager = dynamic(() => import('../../components/terminal/UnifiedTerminalManager'), {
  ssr: false,
  loading: () => null
});

interface Device {
  id: string;
  name: string;
  ip_address: string;
  status: string;
  last_seen?: string;
  routeros_version?: string;
}

export default function MonitoringPage() {
  const searchParams = useSearchParams();
  const preselectedDeviceId = searchParams?.get('deviceId');
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(preselectedDeviceId || '');
  const [timeRange, setTimeRange] = useState('1h');
  const [overview, setOverview] = useState<MonitoringOverview | null>(null);
  const [historicalMetrics, setHistoricalMetrics] = useState<SystemMetrics[]>([]);
  const [interfaceMetrics, setInterfaceMetrics] = useState<InterfaceMetrics[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isMetricsLoading, setIsMetricsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'system' | 'interfaces' | 'traffic' | 'connections'>('system');
  const [showTerminalManager, setShowTerminalManager] = useState(false);

  // Use device monitoring hook for real-time updates
  const deviceMonitoring = useDeviceMonitoring(selectedDevice);

  // Fetch devices on component mount
  useEffect(() => {
    fetchDevices();
    fetchOverview();
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

  // Fetch historical data when device or time range changes
  useEffect(() => {
    if (selectedDevice) {
      const selectedTimeRange = TIME_RANGES.find(tr => tr.value === timeRange);
      if (selectedTimeRange) {
        setIsMetricsLoading(true);
        setHistoricalMetrics([]); // Clear previous data
        setInterfaceMetrics([]); // Clear previous data

        if (currentView === 'system') {
          fetchDeviceMetrics(selectedDevice, selectedTimeRange)
            .finally(() => setIsMetricsLoading(false));
        } else if (currentView === 'interfaces') {
          // Use live interface data for current view
          fetchLiveInterfaceData(selectedDevice)
            .finally(() => setIsMetricsLoading(false));
        } else if (currentView === 'traffic') {
          // TrafficChartsView handles its own data fetching
          setIsMetricsLoading(false);
        } else if (currentView === 'connections') {
          // ConnectionTrackingTable handles its own data fetching
          setIsMetricsLoading(false);
        }
      }
    } else {
      // Clear data when no device is selected
      setHistoricalMetrics([]);
      setInterfaceMetrics([]);
    }
  }, [selectedDevice, timeRange, currentView]);

  const fetchDevices = async () => {
    try {
      const response = await apiClient.get('/api/monitoring/devices');
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

  const fetchOverview = async () => {
    try {
      const response = await apiClient.get('/api/monitoring/metrics');
      if (!response.ok) throw new Error('Failed to fetch overview');
      
      const data = await response.json();
      setOverview(data);
    } catch (error) {
      console.error('Failed to fetch overview:', error);
    }
  };

  const fetchDeviceMetrics = async (deviceId: string, timeRange: TimeRange) => {
    try {
      const response = await apiClient.get(`/api/monitoring/devices/${deviceId}?duration=${timeRange.duration}&unit=${timeRange.unit}`);
      if (!response.ok) throw new Error('Failed to fetch device metrics');
      
      const data = await response.json();
      
      if (data.monitoring?.historical) {
        // Standardize timestamps and robustly parse all numeric fields
        const standardizedMetrics = data.monitoring.historical.map((m: any, index: number) => {
          const timestamp = new Date(m.timestamp); // Already a string from backend
          
          return {
            ...m,
            timestamp,
            // Ensure all metric fields are numbers, defaulting to 0
            cpu_load: Number(m.cpu_load) || 0,
            free_memory: Number(m.free_memory) || 0,
            total_memory: Number(m.total_memory) || 0,
            free_hdd_space: Number(m.free_hdd_space) || 0,
            total_hdd_space: Number(m.total_hdd_space) || 0
          };
        });
        setHistoricalMetrics(standardizedMetrics);
      } else {
        setHistoricalMetrics([]);
      }
    } catch (error) {
      console.error('Failed to fetch device metrics:', error);
      setError('Failed to load device metrics');
      setHistoricalMetrics([]);
    }
  };

  const fetchInterfaceMetrics = async (deviceId: string, timeRange: TimeRange) => {
    try {
      const response = await apiClient.get(`/api/monitoring/devices/${deviceId}/monitoring/interfaces?hours=${timeRange.duration}`);
      if (!response.ok) throw new Error('Failed to fetch interface metrics');
      
      const data = await response.json();
      
      if (data.historical) {
        const standardizedMetrics = data.historical.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setInterfaceMetrics(standardizedMetrics);
      } else {
        setInterfaceMetrics([]);
      }
    } catch (error) {
      console.error('Failed to fetch interface metrics:', error);
      setError('Failed to load interface metrics');
      setInterfaceMetrics([]);
    }
  };

  // Fetch live interface data (current state) for immediate updates
  const fetchLiveInterfaceData = async (deviceId: string) => {
    try {
      const response = await apiClient.get(`/api/devices/${deviceId}/interfaces`);
      if (!response.ok) throw new Error('Failed to fetch live interface data');
      
      const data = await response.json();
      
      if (data.interfaces) {
        // Convert live interface data to InterfaceMetrics format
        const currentTimestamp = new Date();
        const liveMetrics = data.interfaces.map((iface: any, index: number) => {
          // Handle MTU parsing - use actual-mtu when mtu is 'auto'
          let mtuValue = 0;
          if (iface.mtu === 'auto' && iface['actual-mtu']) {
            // Use actual-mtu for interfaces with auto MTU (like bridges)
            const parsedMtu = parseInt(String(iface['actual-mtu']), 10);
            if (!isNaN(parsedMtu) && parsedMtu > 0) {
              mtuValue = parsedMtu;
            }
          } else if (iface.mtu !== undefined && iface.mtu !== null && iface.mtu !== '' && iface.mtu !== 'auto') {
            // Use regular mtu for other interfaces
            const parsedMtu = parseInt(String(iface.mtu), 10);
            if (!isNaN(parsedMtu) && parsedMtu > 0) {
              mtuValue = parsedMtu;
            }
          }

          return {
            id: `live_${deviceId}_${iface.name}_${currentTimestamp.getTime()}`,
            device_id: deviceId,
            interface_name: iface.name,
            interface_type: iface.type,
            status: iface.disabled === 'true' ? 'disabled' : (iface.running === 'true' ? 'running' : 'down'),
            mac_address: iface['mac-address'] || '',
            mtu: mtuValue,
            rx_bytes: parseInt(iface['rx-byte']) || 0,
            tx_bytes: parseInt(iface['tx-byte']) || 0,
            rx_packets: parseInt(iface['rx-packet']) || 0,
            tx_packets: parseInt(iface['tx-packet']) || 0,
            timestamp: currentTimestamp
          };
        });
        
        // Replace the current interface metrics with live data
        setInterfaceMetrics(liveMetrics);
      }
    } catch (error) {
      console.error('Failed to fetch live interface data:', error);
      // Don't set error here as this is for refresh, fallback to existing data
    }
  };

  // Auto-refresh traffic stats is now handled by TrafficChartsView component

  // Auto-refresh interface metrics when on interfaces view
  useEffect(() => {
    if (currentView === 'interfaces' && selectedDevice) {
      const interval = setInterval(() => {
        // Use live data for frequent updates
        fetchLiveInterfaceData(selectedDevice);
      }, 5000); // Refresh every 5 seconds for live data

      return () => clearInterval(interval);
    }
    // Return undefined for cases where the condition is not met
    return undefined;
  }, [currentView, selectedDevice]);

  // Function to refresh interface metrics (for use by InterfacesTable after reset)
  const refreshInterfaceMetrics = async () => {
    if (selectedDevice) {
      // Use live data for immediate refresh after reset
      await fetchLiveInterfaceData(selectedDevice);
    }
  };

  const startMonitoring = async (deviceId: string) => {
    try {
      const response = await apiClient.post(`/api/monitoring/devices/${deviceId}/start`, {});
      
      if (!response.ok) throw new Error('Failed to start monitoring');
      
      // Refresh overview to update status
      await fetchOverview();
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      setError('Failed to start monitoring');
    }
  };

  const stopMonitoring = async (deviceId: string) => {
    try {
      const response = await apiClient.post(`/api/monitoring/devices/${deviceId}/stop`, {});
      
      if (!response.ok) throw new Error('Failed to stop monitoring');
      
      // Refresh overview to update status
      await fetchOverview();
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
      setError('Failed to stop monitoring');
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

  // Combine historical and real-time metrics for display
  const combinedMetrics = useMemo(() => {
    if (!selectedDevice) {
      return [];
    }

    const metricsMap = new Map<number, SystemMetrics>();

    // Add historical metrics
    historicalMetrics.forEach(metric => {
      const timestampKey = metric.timestamp.getTime();
      if (!metricsMap.has(timestampKey)) {
        metricsMap.set(timestampKey, metric);
      }
    });

    // Add real-time metrics, overwriting if timestamp exists
    deviceMonitoring.metrics.forEach(metric => {
      metricsMap.set(metric.timestamp.getTime(), metric);
    });

    const sortedMetrics = Array.from(metricsMap.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    return sortedMetrics;
  }, [selectedDevice, historicalMetrics, deviceMonitoring.metrics]);

  // Combine historical and real-time interface metrics for display
  const combinedInterfaceMetrics = useMemo(() => {
    if (!selectedDevice) {
      return [];
    }

    const metricsMap = new Map<string, InterfaceMetrics>();

    // Add historical metrics (use interface_name + timestamp as key for uniqueness)
    interfaceMetrics.forEach(metric => {
      const key = `${metric.interface_name}_${metric.timestamp.getTime()}`;
      metricsMap.set(key, metric);
    });

    // Add real-time metrics
    deviceMonitoring.interfaceMetrics.forEach(metric => {
      const key = `${metric.interface_name}_${metric.timestamp.getTime()}`;
      metricsMap.set(key, metric);
    });

    return Array.from(metricsMap.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }, [selectedDevice, interfaceMetrics, deviceMonitoring.interfaceMetrics]);

  const selectedDeviceData = useMemo(() => {
    return devices.find(d => d.id === selectedDevice);
  }, [devices, selectedDevice]);

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
  };

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

  // Convert time ranges to select options
  const timeRangeOptions: SelectOption[] = useMemo(() => {
    return TIME_RANGES.map(range => ({
      value: range.value,
      label: range.label
    }));
  }, []);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="monitoring-dashboard" style={{ padding: 'var(--space-4)' }}>
          <div className="loading-state">
            <p>Loading monitoring dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="monitoring-dashboard" style={{ padding: 'var(--space-3) var(--space-4)' }}>
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb-nav" style={{ marginBottom: 'var(--space-2)' }}>
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
                Monitoring
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
        <div className="dashboard-header" style={{ marginBottom: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
              System Monitoring
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                backgroundColor: deviceMonitoring.connectionStatus === 'connected' ? 'var(--success)' : 'var(--error)'
                }}></span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {deviceMonitoring.connectionStatus === 'connecting' ? 'Connecting...' : 
                   deviceMonitoring.connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Real-time system monitoring and performance analysis for RouterOS devices
          </p>
        </div>

        {error && (
          <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', backgroundColor: 'rgba(var(--error-rgb), 0.1)', borderColor: 'rgba(var(--error-rgb), 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: 'var(--error)', margin: 0, fontSize: '0.9rem' }}>{error}</p>
              <button onClick={() => setError(null)} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Control Bar */}
        <style jsx>{`
          .control-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(320px, auto);
            gap: var(--space-6);
            align-items: start;
          }
          
          @media (max-width: 1024px) {
            .control-grid {
              display: grid !important;
              grid-template-columns: 1fr !important;
              gap: var(--space-4) !important;
              align-items: start !important;
            }
            .monitoring-view-section {
              order: -1 !important;
              min-width: auto !important;
            }
            .device-selection-section {
              order: 1 !important;
            }
          }
        `}</style>
        <div className="control-bar">
          {selectedDevice ? (
            <div className="card" style={{ marginBottom: 'var(--space-0)' }}>
            <div style={{ padding: 'var(--space-4)' }}>
                <div className="control-grid">
                  {/* Left Section: Device Selection */}
                  <div className="device-selection-section">
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
                      Device Selection
                    </h3>
              <div style={{ marginBottom: 'var(--space-3)' }}>
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
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: 'var(--space-2) var(--space-3)', 
                        backgroundColor: 'rgba(var(--border-rgb), 0.2)', 
                        borderRadius: 'var(--space-2)',
                        border: `1px solid ${deviceMonitoring.connectionStatus === 'connected' ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(var(--border-rgb), 0.3)'}`
                      }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{
                            width: '8px',
                            height: '8px',
                      borderRadius: '50%',
                      marginRight: 'var(--space-2)',
                      backgroundColor: getStatusColor(deviceMonitoring.connectionStatus === 'connected' ? 'connected' : selectedDeviceData.status)
                    }}></span>
                          <span style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                            {deviceMonitoring.connectionStatus === 'connected' ? 'Live Monitoring' : selectedDeviceData.status}
                    </span>
                  </div>
                  <button
                    onClick={() => deviceMonitoring.connectionStatus === 'connected' ? stopMonitoring(selectedDevice) : startMonitoring(selectedDevice)}
                    style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                      border: 'none',
                      backgroundColor: deviceMonitoring.connectionStatus === 'connected' ? 'var(--error)' : 'var(--success)',
                      color: 'white',
                      cursor: 'pointer',
                            fontSize: '0.7rem',
                      fontWeight: '500'
                    }}
                  >
                    {deviceMonitoring.connectionStatus === 'connected' ? 'Stop' : 'Start'}
                  </button>
                </div>
              )}
                    
                    {/* Quick Actions */}
                    {selectedDeviceData && (
                      <div style={{ marginTop: 'var(--space-3)' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <Link
                            href={`/configuration/${selectedDevice}`}
                            style={{
                              flex: 1,
                              padding: 'var(--space-2) var(--space-3)',
                              borderRadius: 'var(--space-2)',
                              backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                              color: 'var(--primary)',
                              border: '1px solid rgba(var(--primary-rgb), 0.3)',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 'var(--space-2)',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
                              e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                              e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                            }}
                          >
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Configure
                          </Link>
                          
                          <button
                            onClick={() => setShowTerminalManager(true)}
                            style={{
                              flex: 1,
                              padding: 'var(--space-2) var(--space-3)',
                              borderRadius: 'var(--space-2)',
                              backgroundColor: 'rgba(168, 85, 247, 0.2)',
                              color: 'rgb(168, 85, 247)',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 'var(--space-2)',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.3)';
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
                              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.3)';
                            }}
                          >
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            Terminal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Section: Monitoring View Selector */}
                  <div className="monitoring-view-section" style={{ minWidth: '320px' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
                      Monitoring View
                    </h3>
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 'var(--space-2)' 
                    }}>
                      {[
                        { value: 'system', label: 'System Metrics' },
                        { value: 'interfaces', label: 'Interface Monitoring' },
                        { value: 'traffic', label: 'Traffic Analysis' },
                        { value: 'connections', label: 'Connection Tracking' }
                      ].map((view) => (
                        <button
                          key={view.value}
                          onClick={() => setCurrentView(view.value as 'system' | 'interfaces' | 'traffic' | 'connections')}
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--space-2)',
                            backgroundColor: currentView === view.value 
                              ? 'rgba(var(--primary-rgb), 0.2)' 
                              : 'rgba(var(--border-rgb), 0.2)',
                            border: `1px solid ${currentView === view.value 
                              ? 'rgba(var(--primary-rgb), 0.5)' 
                              : 'transparent'}`,
                            color: currentView === view.value 
                              ? 'var(--primary)' 
                              : 'var(--text-secondary)',
                            fontWeight: '500',
                            fontSize: '0.85rem',
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)'
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
                          <svg width="16" height="16" viewBox="0 0 24 24">
                            {view.value === 'system' && <g fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></g>}
                            {view.value === 'interfaces' && <g fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12l4-4m-4 4l4 4" /><path strokeLinecap="round" strokeLinejoin="round" d="M13 4h6a2 2 0 012 2v12a2 2 0 01-2 2h-6" /></g>}
                            {view.value === 'traffic' && <g fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></g>}
                            {view.value === 'connections' && <g fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></g>}
                          </svg>
                          {view.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-4)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
                  Device Selection
                </h3>
                <CustomSelect
                  options={deviceOptions}
                  value={selectedDevice}
                  onChange={setSelectedDevice}
                  placeholder={devices.length === 0 ? 'No devices found' : 'Choose device...'}
                  disabled={devices.length === 0}
                  style={{ fontSize: '0.9rem' }}
                />
            </div>
          </div>
          )}
        </div>
        
        {selectedDevice && (
          <>
            {currentView === 'system' ? (
              <div className="card">
                <div style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <h2 className="text-lg font-semibold">System Metrics</h2>
                    <div>
                      <CustomSelect
                        options={timeRangeOptions}
                        value={timeRange}
                        onChange={handleTimeRangeChange}
                        style={{ fontSize: '0.9rem', minWidth: '120px' }}
                      />
                    </div>
                  </div>
                  <SystemMetricsChart
                    metrics={combinedMetrics}
                    isLoading={isMetricsLoading}
                    timeRange={timeRange}
                    onTimeRangeChange={handleTimeRangeChange}
                  />
                </div>
              </div>
            ) : currentView === 'interfaces' ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '60vh', // Use viewport height percentage instead
                minHeight: '400px',
                maxHeight: '800px' // Prevent it from getting too large
              }}>
                <InterfacesTable
                  metrics={combinedInterfaceMetrics}
                  isLoading={isMetricsLoading}
                  deviceId={selectedDevice}
                  refreshMetrics={refreshInterfaceMetrics}
                />
              </div>
            ) : currentView === 'traffic' ? (
              <TrafficChartsView
                deviceId={selectedDevice}
                isLoading={isMetricsLoading}
              />
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '60vh',
                minHeight: '400px',
                maxHeight: '800px'
              }}>
                <ConnectionTrackingTable
                  deviceId={selectedDevice}
                  isLoading={isMetricsLoading}
                />
              </div>
            )}
          </>
        )}

        {!selectedDevice && !isLoading && (
          <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
            <h3 style={{ fontWeight: '500', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>No Device Selected</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Please select a device to view monitoring data.</p>
          </div>
        )}

        {/* Terminal Modal */}
        {showTerminalManager && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-4)'
          }}>
            <div style={{
              width: '95vw',
              height: '90vh',
              maxWidth: '1400px',
              backgroundColor: 'var(--background)',
              borderRadius: 'var(--space-3)',
              border: '1px solid rgba(var(--border-rgb), 0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{
                padding: 'var(--space-3)',
                borderBottom: '1px solid rgba(var(--border-rgb), 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  Terminal Manager
                </h3>
                <button
                  onClick={() => setShowTerminalManager(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: 'var(--space-1)',
                    borderRadius: 'var(--space-1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
                             <div style={{ flex: 1, overflow: 'hidden' }}>
                <UnifiedTerminalManager 
                  onClose={() => setShowTerminalManager(false)}
                  deviceId={selectedDevice}
                  devices={devices.map(device => ({
                    id: device.id,
                    name: device.name,
                    ip_address: device.ip_address,
                    username: 'admin', // Default username - this should come from device config
                    port: 22, // Default SSH port - this should come from device config
                    use_ssl: false, // Default - this should come from device config
                    status: device.status,
                    terminalAvailable: device.status === 'connected',
                    authMethod: 'password' as const,
                    sshKeysConfigured: false
                  }))}
                />
               </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}