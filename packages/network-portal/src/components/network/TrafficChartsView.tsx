/**
 * Traffic Charts View Component
 * 
 * Displays real-time and historical traffic statistics for RouterOS device interfaces
 * with interactive charts and filtering capabilities.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { CustomSelect, SelectOption } from '../ui/CustomSelect';

interface TrafficStats {
  id: number;
  device_id: string;
  interface_name: string;
  rx_bits_per_second: number;
  tx_bits_per_second: number;
  rx_packets_per_second: number;
  tx_packets_per_second: number;
  timestamp: string;
}

interface TrafficChartsViewProps {
  deviceId: string;
  isLoading: boolean;
}

interface ChartDataPoint {
  timestamp: string;
  timestampMs: number;
  time: string;
  [key: string]: string | number | null; // For dynamic interface data, allow null for missing values
}

type TimeRange = '1h' | '6h' | '24h' | '7d';
type ViewMode = 'bandwidth' | 'packets' | 'combined';

export function TrafficChartsView({ deviceId, isLoading }: TrafficChartsViewProps) {
  const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [viewMode, setViewMode] = useState<ViewMode>('bandwidth');
  const [trafficStats, setTrafficStats] = useState<TrafficStats[]>([]);
  const [availableInterfaces, setAvailableInterfaces] = useState<string[]>([]);
  const [filteredStats, setFilteredStats] = useState<TrafficStats[]>([]);
  const [isTrafficMonitoring, setIsTrafficMonitoring] = useState(false);
  const [isStartingMonitoring, setIsStartingMonitoring] = useState(false);
  const [trafficMonitoringEnabled, setTrafficMonitoringEnabled] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isLoadingTrafficData, setIsLoadingTrafficData] = useState(false);

  // Fetch available interfaces
  const fetchAvailableInterfaces = async (deviceId: string) => {
    if (!deviceId) return;
    
    try {
      const response = await fetch(`/api/devices/${deviceId}/interfaces`);
      if (!response.ok) throw new Error('Failed to fetch available interfaces');
      const data = await response.json();
      const interfaceNames: string[] = data.interfaces
        ?.map((iface: any) => iface.name)
        .filter((name: any): name is string => typeof name === 'string') || [];
      setAvailableInterfaces(Array.from(new Set(interfaceNames)).sort());
    } catch (error) {
      console.error('Failed to fetch available interfaces:', error);
      setAvailableInterfaces([]);
    }
  };

  // Fetch traffic statistics
  const fetchTrafficStats = async (deviceId: string, hours: number, isRefresh: boolean = false) => {
    if (!deviceId) return;
    
    // Only show loading state for initial load, not for refresh
    if (!isRefresh) {
      setIsLoadingTrafficData(true);
    }
    
    try {
      const response = await fetch(`/api/network/devices/${deviceId}/traffic-stats?hours=${hours}`);
      if (!response.ok) throw new Error('Failed to fetch traffic statistics');
      const data = await response.json();
      setTrafficStats(data.traffic_statistics || []);
    } catch (error) {
      console.error('Failed to fetch traffic stats:', error);
      // Only clear data on error if it's not a refresh (to avoid clearing existing data)
      if (!isRefresh) {
        setTrafficStats([]);
      }
    } finally {
      if (!isRefresh) {
        setIsLoadingTrafficData(false);
      }
    }
  };

  // Check traffic monitoring status and settings on device change
  useEffect(() => {
    if (deviceId) {
      checkTrafficMonitoringStatus();
      loadTrafficMonitoringSettings();
      fetchAvailableInterfaces(deviceId);
    }
  }, [deviceId]);

  // Fetch traffic stats when device or time range changes
  useEffect(() => {
    if (deviceId) {
      const timeRangeHours = {
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '7d': 168
      }[timeRange];
      
      fetchTrafficStats(deviceId, timeRangeHours);
    }
  }, [deviceId, timeRange]);

  // Check if traffic monitoring is running
  const checkTrafficMonitoringStatus = async () => {
    if (!deviceId) return;
    
    try {
      // Check service status to see if traffic monitoring is active
      const response = await fetch(`/api/network/overview`);
      if (response.ok) {
        const data = await response.json();
        // Check if this device has traffic monitoring active
        const deviceStatus = data.serviceStatus?.[deviceId];
        const isActive = deviceStatus?.traffic === true;
        setIsTrafficMonitoring(isActive);
      }
    } catch (error) {
      console.error('Failed to check traffic monitoring status:', error);
    }
  };

  // Load traffic monitoring settings
  const loadTrafficMonitoringSettings = async () => {
    if (!deviceId) return;
    
    try {
      const response = await fetch(`/api/network/settings/traffic-monitoring/${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setTrafficMonitoringEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Failed to load traffic monitoring settings:', error);
    }
  };

  // Toggle traffic monitoring preference
  const toggleTrafficMonitoringPreference = async () => {
    if (!deviceId || isLoadingSettings) return;
    
    setIsLoadingSettings(true);
    try {
      const newEnabled = !trafficMonitoringEnabled;
      const response = await fetch(`/api/network/settings/traffic-monitoring/${deviceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled })
      });
      
      if (response.ok) {
        setTrafficMonitoringEnabled(newEnabled);
        // Refresh the monitoring status after changing preference
        setTimeout(() => {
          checkTrafficMonitoringStatus();
        }, 1000);
      } else {
        const errorData = await response.json();
        console.error('Failed to update traffic monitoring preference:', errorData);
        alert(`Failed to update preference: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to toggle traffic monitoring preference:', error);
      alert('Failed to update traffic monitoring preference. Please check the console.');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Start traffic monitoring
  const startTrafficMonitoring = async () => {
    if (!deviceId || isStartingMonitoring) return;
    
    setIsStartingMonitoring(true);
    try {
      const response = await fetch(`/api/network/devices/${deviceId}/traffic/start`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setIsTrafficMonitoring(true);
        // Check for new traffic data periodically instead of refreshing
        setTimeout(() => {
          checkTrafficMonitoringStatus();
        }, 3000);
      } else {
        const errorData = await response.json();
        const errorMessage = errorData?.error || 'Unknown error';
        console.error('Failed to start traffic monitoring:', errorData);
        alert(`Failed to start traffic monitoring: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Failed to start traffic monitoring:', error);
      alert('Failed to start traffic monitoring. Please check the console.');
    } finally {
      setIsStartingMonitoring(false);
    }
  };

  // Stop traffic monitoring
  const stopTrafficMonitoring = async () => {
    if (!deviceId) return;
    
    try {
      const response = await fetch(`/api/network/devices/${deviceId}/traffic/stop`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setIsTrafficMonitoring(false);
      } else {
        const errorData = await response.json();
        console.error('Failed to stop traffic monitoring:', errorData);
      }
    } catch (error) {
      console.error('Failed to stop traffic monitoring:', error);
    }
  };

  // Filter and process traffic data
  useEffect(() => {
    let filtered = trafficStats;

    // Filter by selected interfaces
    if (selectedInterfaces.length > 0) {
      filtered = filtered.filter(stat => selectedInterfaces.includes(stat.interface_name));
    }

    // Sort by timestamp (time range filtering is now handled by the API)
    filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    setFilteredStats(filtered);
  }, [trafficStats, selectedInterfaces]);

  // Auto-select top interfaces by traffic volume
  useEffect(() => {
    if (availableInterfaces.length > 0 && selectedInterfaces.length === 0) {
      if (trafficStats.length > 0) {
        // Calculate total traffic per interface and select top 3
        const interfaceTraffic = availableInterfaces.map(iface => {
          const stats = trafficStats.filter(stat => stat.interface_name === iface);
          const totalBits = stats.reduce((sum, stat) => sum + stat.rx_bits_per_second + stat.tx_bits_per_second, 0);
          return { interface: iface, traffic: totalBits };
        });

        const topInterfaces = interfaceTraffic
          .sort((a, b) => b.traffic - a.traffic)
          .slice(0, 3)
          .map(item => item.interface);

        setSelectedInterfaces(topInterfaces);
      } else {
        // If no traffic stats yet, select first 3 interfaces
        const defaultInterfaces = availableInterfaces.slice(0, 3);
        setSelectedInterfaces(defaultInterfaces);
      }
    }
  }, [availableInterfaces, trafficStats, selectedInterfaces.length]);

  // Reset selected interfaces and clear traffic stats when device changes
  useEffect(() => {
    setSelectedInterfaces([]);
    setTrafficStats([]);
    setAvailableInterfaces([]);
  }, [deviceId]);

  // Auto-start traffic monitoring if enabled but not running
  useEffect(() => {
    if (deviceId && trafficMonitoringEnabled && !isTrafficMonitoring && !isStartingMonitoring) {
      const timer = setTimeout(() => {
        startTrafficMonitoring();
      }, 2000); // Small delay to avoid conflicts with status checking

      return () => clearTimeout(timer);
    }
    // Return undefined for cases where the condition is not met
    return undefined;
  }, [deviceId, trafficMonitoringEnabled, isTrafficMonitoring, isStartingMonitoring]);

  // Auto-refresh traffic stats
  useEffect(() => {
    if (deviceId) {
      const timeRangeHours = {
        '1h': 1,
        '6h': 6,
        '24h': 24,
        '7d': 168
      }[timeRange];

      const interval = setInterval(() => {
        fetchTrafficStats(deviceId, timeRangeHours, true); // true = isRefresh
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
    // Return undefined for cases where the condition is not met
    return undefined;
  }, [deviceId, timeRange]);

  // Prepare chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    if (filteredStats.length === 0) return [];

    // Instead of grouping by timestamp, create a comprehensive time series
    // First, get all unique timestamps and sort them
    const allTimestamps = Array.from(new Set(filteredStats.map(stat => stat.timestamp)))
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    // Create a data point for each timestamp
    const chartPoints = allTimestamps.map(timestamp => {
      const timestampMs = new Date(timestamp).getTime();
      const dataPoint: ChartDataPoint = {
        timestamp,
        timestampMs, // Add numeric timestamp for proper chart ordering
        time: new Date(timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      };

      // For each selected interface, find the data at this timestamp
      selectedInterfaces.forEach(interfaceName => {
        const interfaceStats = filteredStats.find(stat => 
          stat.timestamp === timestamp && stat.interface_name === interfaceName
        );
        
        if (interfaceStats) {
          // Add actual data values - ensure they are numbers
          if (viewMode === 'bandwidth' || viewMode === 'combined') {
            dataPoint[`${interfaceName}_rx`] = Math.max(0, Number(interfaceStats.rx_bits_per_second) || 0);
            dataPoint[`${interfaceName}_tx`] = Math.max(0, Number(interfaceStats.tx_bits_per_second) || 0);
          }
          if (viewMode === 'packets' || viewMode === 'combined') {
            dataPoint[`${interfaceName}_rx_pps`] = Math.max(0, Number(interfaceStats.rx_packets_per_second) || 0);
            dataPoint[`${interfaceName}_tx_pps`] = Math.max(0, Number(interfaceStats.tx_packets_per_second) || 0);
          }
        } else {
          // If no data for this interface at this timestamp, use null to break the line
          if (viewMode === 'bandwidth' || viewMode === 'combined') {
            dataPoint[`${interfaceName}_rx`] = null;
            dataPoint[`${interfaceName}_tx`] = null;
          }
          if (viewMode === 'packets' || viewMode === 'combined') {
            dataPoint[`${interfaceName}_rx_pps`] = null;
            dataPoint[`${interfaceName}_tx_pps`] = null;
          }
        }
      });

      return dataPoint;
    });

    // Sort by numeric timestamp to ensure correct ordering
    const sortedChartPoints = chartPoints.sort((a, b) => 
      (a.timestampMs as number) - (b.timestampMs as number)
    );

    // Only filter out data points if interfaces are selected
    // If no interfaces are selected, keep all data points to maintain timeline continuity
    const validChartPoints = selectedInterfaces.length === 0 
      ? sortedChartPoints // Keep all data points when no interfaces selected
      : sortedChartPoints.filter(point => {
          return selectedInterfaces.some(interfaceName => {
            const hasData = 
              (viewMode === 'bandwidth' || viewMode === 'combined') && 
              (point[`${interfaceName}_rx`] !== null || point[`${interfaceName}_tx`] !== null) ||
              (viewMode === 'packets' || viewMode === 'combined') && 
              (point[`${interfaceName}_rx_pps`] !== null || point[`${interfaceName}_tx_pps`] !== null);
            return hasData;
          });
        });

    return validChartPoints;
  }, [filteredStats, selectedInterfaces, viewMode]);



  const formatBits = (bits: number): string => {
    const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    let value = bits;
    let unitIndex = 0;

    while (value >= 1000 && unitIndex < units.length - 1) {
      value /= 1000;
      unitIndex++;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatPackets = (packets: number): string => {
    if (packets >= 1000000) {
      return `${(packets / 1000000).toFixed(1)}M pps`;
    } else if (packets >= 1000) {
      return `${(packets / 1000).toFixed(1)}K pps`;
    }
    return `${packets} pps`;
  };

  const getInterfaceColor = (interfaceName: string): string => {
    const colors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Purple
      '#06b6d4', // Cyan
      '#f97316', // Orange
      '#84cc16'  // Lime
    ];
    // Use the interface's position in availableInterfaces for consistent coloring
    const index = availableInterfaces.indexOf(interfaceName);
    return colors[index % colors.length] || '#3b82f6'; // Fallback to blue
  };

  const calculateStats = () => {
    if (filteredStats.length === 0) return null;
    const totalRx = selectedInterfaces.reduce((sum, iface) => {
      const ifaceStats = filteredStats.filter(s => s.interface_name === iface);
      const latestStat = ifaceStats[ifaceStats.length - 1];
      return sum + (latestStat?.rx_bits_per_second || 0);
    }, 0);

    const totalTx = selectedInterfaces.reduce((sum, iface) => {
      const ifaceStats = filteredStats.filter(s => s.interface_name === iface);
      const latestStat = ifaceStats[ifaceStats.length - 1];
      return sum + (latestStat?.tx_bits_per_second || 0);
    }, 0);

    const totalRxPackets = selectedInterfaces.reduce((sum, iface) => {
      const ifaceStats = filteredStats.filter(s => s.interface_name === iface);
      const latestStat = ifaceStats[ifaceStats.length - 1];
      return sum + (latestStat?.rx_packets_per_second || 0);
    }, 0);

    const totalTxPackets = selectedInterfaces.reduce((sum, iface) => {
      const ifaceStats = filteredStats.filter(s => s.interface_name === iface);
      const latestStat = ifaceStats[ifaceStats.length - 1];
      return sum + (latestStat?.tx_packets_per_second || 0);
    }, 0);

    return {
      totalRx,
      totalTx,
      totalRxPackets,
      totalTxPackets,
      totalBandwidth: totalRx + totalTx,
      totalPackets: totalRxPackets + totalTxPackets
    };
  };

  const stats = calculateStats();

  const timeRangeOptions: SelectOption[] = [
    { value: '1h', label: 'Last Hour' },
    { value: '6h', label: 'Last 6 Hours' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' }
  ];

  const viewModeOptions: SelectOption[] = [
    { value: 'bandwidth', label: 'Bandwidth' },
    { value: 'packets', label: 'Packets' },
    { value: 'combined', label: 'Combined' }
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(var(--background-card-rgb), 0.95)',
          border: '1px solid rgba(var(--border-rgb), 0.3)',
          borderRadius: '8px',
          padding: 'var(--space-3)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <p style={{ 
            color: 'var(--text-primary)', 
            fontWeight: '600', 
            marginBottom: 'var(--space-3)',
            fontSize: '1rem',
            borderBottom: '1px solid rgba(var(--border-rgb), 0.2)',
            paddingBottom: 'var(--space-2)'
          }}>
            {`Time: ${label}`}
          </p>
          <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
            {payload.map((entry: any, index: number) => (
              <div key={index} style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.875rem'
              }}>
                <span style={{ color: entry.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '10px',
                    height: '10px',
                    backgroundColor: entry.color,
                    borderRadius: '2px'
                  }}></span>
                  {entry.name}
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                  {entry.name.includes('pps') 
                    ? formatPackets(entry.value) 
                    : formatBits(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="traffic-charts-view" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-4)',
      height: '100%'
    }}>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-spinner {
          animation: spin 1s linear infinite;
        }
      `}</style>

      {/* Controls Card */}
      <div className="traffic-controls-card" style={{
        backgroundColor: 'rgba(var(--background-card-rgb), 0.5)',
        border: '1px solid rgba(var(--border-rgb), 0.3)',
        borderRadius: '12px',
        padding: 'var(--space-4)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}>
        {/* Header */}
        <div className="traffic-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
          flexWrap: 'wrap',
          gap: 'var(--space-3)'
        }}>
          <h3 style={{
            margin: 0,
            color: 'var(--text-primary)',
            fontSize: '1.25rem',
            fontWeight: 600,
            flex: '0 0 auto'
          }}>
            Traffic Analysis
          </h3>

          <div className="traffic-controls" style={{
            display: 'flex',
            gap: 'var(--space-2)',
            alignItems: 'center',
            flex: '0 0 auto'
          }}>
            {/* Time Range Selector */}
            <CustomSelect
              options={timeRangeOptions}
              value={timeRange}
              onChange={(value) => setTimeRange(value as TimeRange)}
              style={{
                fontSize: '0.875rem',
                minWidth: '140px'
              }}
            />

            {/* View Mode Selector */}
            <CustomSelect
              options={viewModeOptions}
              value={viewMode}
              onChange={(value) => setViewMode(value as ViewMode)}
              style={{
                fontSize: '0.875rem',
                minWidth: '120px'
              }}
            />
          </div>
        </div>

        {/* Statistics Summary */}
        {stats && (
          <div className="traffic-summary" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-3)'
          }}>
            <div className="stat-card" style={{
              backgroundColor: 'rgba(var(--border-rgb), 0.1)',
              padding: 'var(--space-3)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Total Download
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatBits(stats.totalRx)}
              </div>
            </div>

            <div className="stat-card" style={{
              backgroundColor: 'rgba(var(--border-rgb), 0.1)',
              padding: 'var(--space-3)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Total Upload
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatBits(stats.totalTx)}
              </div>
            </div>

            <div className="stat-card" style={{
              backgroundColor: 'rgba(var(--border-rgb), 0.1)',
              padding: 'var(--space-3)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Total Bandwidth
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatBits(stats.totalBandwidth)}
              </div>
            </div>

            <div className="stat-card" style={{
              backgroundColor: 'rgba(var(--border-rgb), 0.1)',
              padding: 'var(--space-3)',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Total Packets/sec
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {formatPackets(stats.totalPackets)}
              </div>
            </div>
          </div>
        )}

        {/* Traffic Monitoring Status & Control */}
        <div className="traffic-monitoring-control" style={{
          marginBottom: 'var(--space-3)',
          padding: 'var(--space-3)',
          backgroundColor: 'rgba(var(--border-rgb), 0.1)',
          borderRadius: '8px',
          border: `1px solid ${isTrafficMonitoring ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(var(--warning-rgb), 0.3)'}`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-2)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isTrafficMonitoring ? 'var(--success)' : 'var(--warning)'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)'
              }}>
                Traffic Monitoring: {isTrafficMonitoring ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              gap: 'var(--space-2)',
              alignItems: 'center'
            }}>
              {/* Preference Toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={trafficMonitoringEnabled}
                  onChange={toggleTrafficMonitoringPreference}
                  disabled={isLoadingSettings}
                  style={{
                    width: '14px',
                    height: '14px',
                    accentColor: 'var(--primary)'
                  }}
                />
                Auto-enable
              </label>
              
              {/* Manual Control */}
              <button
                onClick={isTrafficMonitoring ? stopTrafficMonitoring : startTrafficMonitoring}
                disabled={isStartingMonitoring}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isTrafficMonitoring ? 'rgba(var(--error-rgb), 0.2)' : 'rgba(var(--success-rgb), 0.2)',
                  color: isTrafficMonitoring ? 'var(--error)' : 'var(--success)',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  cursor: isStartingMonitoring ? 'not-allowed' : 'pointer',
                  opacity: isStartingMonitoring ? 0.6 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {isStartingMonitoring ? 'Starting...' : isTrafficMonitoring ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>
          
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.4'
          }}>
            {trafficMonitoringEnabled 
              ? isTrafficMonitoring 
                ? 'Traffic data is being collected every 30 seconds. Disable auto-enable to prevent automatic startup.'
                : 'Auto-enable is on - traffic monitoring will start automatically when the device connects. You can also start it manually.'
              : 'Auto-enable is off - traffic monitoring must be started manually for this device.'
            }
          </div>
        </div>

        {/* Interface Selection */}
        <div className="interface-selection">
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--space-2)'
          }}>
            Select Interfaces ({selectedInterfaces.length} of {availableInterfaces.length} selected)
          </div>
          
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            padding: 'var(--space-2)',
            backgroundColor: 'rgba(var(--border-rgb), 0.05)',
            borderRadius: '8px',
            minHeight: '60px',
            alignItems: 'center',
            justifyContent: isLoading ? 'center' : 'flex-start'
          }}>
            {isLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem'
              }}>
                <div className="loading-spinner" style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(var(--text-secondary-rgb), 0.2)',
                  borderTop: '2px solid var(--text-secondary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Loading interfaces...
              </div>
            ) : availableInterfaces.length === 0 ? (
              <div style={{
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
                textAlign: 'center'
              }}>
                No interfaces found. Check device connection.
              </div>
            ) : (
              availableInterfaces.map((iface, index) => {
              const isSelected = selectedInterfaces.includes(iface);
              const color = getInterfaceColor(iface);
              
              return (
                <button
                  key={iface}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedInterfaces(prev => prev.filter(i => i !== iface));
                    } else {
                      setSelectedInterfaces(prev => [...prev, iface]);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: isSelected ? `2px solid ${color}` : '1px solid rgba(var(--border-rgb), 0.3)',
                    backgroundColor: isSelected ? `${color}20` : 'rgba(var(--background-card-rgb), 0.8)',
                    color: isSelected ? color : 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = `${color}15`;
                      e.currentTarget.style.borderColor = `${color}60`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--background-card-rgb), 0.8)';
                      e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.3)';
                    }
                  }}
                >
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    display: 'inline-block'
                  }}></span>
                  {iface}
                </button>
              );
            }))}
          </div>
        </div>
      </div>

      {/* Chart Cards */}
      {isLoading || isLoadingTrafficData ? (
        <div className="chart-card" style={{
          backgroundColor: 'rgba(var(--background-card-rgb), 0.5)',
          border: '1px solid rgba(var(--border-rgb), 0.3)',
          borderRadius: '12px',
          padding: 'var(--space-6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'var(--text-secondary)'
          }}>
            <div className="loading-spinner" style={{
              width: '24px',
              height: '24px',
              border: '2px solid rgba(var(--text-secondary-rgb), 0.2)',
              borderTop: '2px solid var(--text-secondary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Loading traffic data...
          </div>
        </div>
      ) : chartData.length === 0 ? (
        <div className="chart-card" style={{
          backgroundColor: 'rgba(var(--background-card-rgb), 0.5)',
          border: '1px solid rgba(var(--border-rgb), 0.3)',
          borderRadius: '12px',
          padding: 'var(--space-6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px'
        }}>
          <div style={{
            textAlign: 'center',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)', opacity: 0.5 }}>📊</div>
            <div style={{ fontSize: '1.125rem', marginBottom: 'var(--space-1)' }}>No Traffic Data</div>
            <div style={{ fontSize: '0.875rem' }}>
              Select interfaces and ensure traffic monitoring is enabled
            </div>
          </div>
        </div>
      ) : (
        <div 
          className="charts-container" 
          style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'combined' ? '1fr 1fr' : '1fr',
            gap: 'var(--space-4)'
          }}
        >
          {/* Bandwidth Chart Card */}
          {(viewMode === 'bandwidth' || viewMode === 'combined') && (
            <div className="chart-card" style={{
              backgroundColor: 'rgba(var(--background-card-rgb), 0.5)',
              border: '1px solid rgba(var(--border-rgb), 0.3)',
              borderRadius: '12px',
              padding: 'var(--space-4)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              height: '500px'
            }}>
              <h4 style={{ 
                margin: '0 0 var(--space-3) 0', 
                color: 'var(--text-primary)', 
                fontSize: '1rem',
                fontWeight: '500'
              }}>
                Bandwidth Usage
              </h4>
              <div style={{ height: 'calc(100% - 40px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      {selectedInterfaces.flatMap((iface, index) => {
                        const color = getInterfaceColor(iface);
                        return [
                          <linearGradient key={`${iface}-rx-gradient`} id={`color-${iface}-rx`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
                          </linearGradient>,
                          <linearGradient key={`${iface}-tx-gradient`} id={`color-${iface}-tx`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={`${color}80`} stopOpacity={0.6}/>
                            <stop offset="95%" stopColor={`${color}80`} stopOpacity={0.1}/>
                          </linearGradient>
                        ];
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--border-rgb), 0.3)" />
                    <XAxis 
                      dataKey="time" 
                      stroke="var(--text-secondary)"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tickFormatter={(value) => formatBits(value)}
                      allowDataOverflow={true}
                      domain={[0, 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(var(--border-rgb), 0.5)" strokeWidth={1} />
                    {selectedInterfaces.flatMap((iface, index) => {
                      const color = getInterfaceColor(iface);
                      const rxColor = color;
                      const txColor = `${color}80`;
                      return [
                        <Area
                          key={`${iface}_rx`}
                          type="linear"
                          dataKey={`${iface}_rx`}
                          stroke={rxColor}
                          fill={`url(#color-${iface}-rx)`}
                          name={`${iface} RX`}
                          strokeWidth={2}
                          fillOpacity={0.6}
                          connectNulls={false}
                        />,
                        <Area
                          key={`${iface}_tx`}
                          type="linear"
                          dataKey={`${iface}_tx`}
                          stroke={txColor}
                          fill={`url(#color-${iface}-tx)`}
                          name={`${iface} TX`}
                          strokeWidth={2}
                          fillOpacity={0.4}
                          connectNulls={false}
                        />
                      ];
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Packet Rate Chart Card */}
          {(viewMode === 'packets' || viewMode === 'combined') && (
            <div className="chart-card" style={{
              backgroundColor: 'rgba(var(--background-card-rgb), 0.5)',
              border: '1px solid rgba(var(--border-rgb), 0.3)',
              borderRadius: '12px',
              padding: 'var(--space-4)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              height: '500px'
            }}>
              <h4 style={{ 
                margin: '0 0 var(--space-3) 0', 
                color: 'var(--text-primary)', 
                fontSize: '1rem',
                fontWeight: '500'
              }}>
                Packet Rate
              </h4>
              <div style={{ height: 'calc(100% - 40px)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart 
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      {selectedInterfaces.flatMap((iface, index) => {
                        const color = getInterfaceColor(iface);
                        return [
                          <linearGradient key={`${iface}-rx-gradient`} id={`color-${iface}-rx`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
                          </linearGradient>,
                          <linearGradient key={`${iface}-tx-gradient`} id={`color-${iface}-tx`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={`${color}80`} stopOpacity={0.6}/>
                            <stop offset="95%" stopColor={`${color}80`} stopOpacity={0.1}/>
                          </linearGradient>
                        ];
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(var(--border-rgb), 0.3)" />
                    <XAxis 
                      dataKey="time" 
                      stroke="var(--text-secondary)"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="var(--text-secondary)"
                      fontSize={12}
                      tickFormatter={(value) => formatPackets(value)}
                      domain={[0, 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="rgba(var(--border-rgb), 0.5)" strokeWidth={1} />
                    {selectedInterfaces.flatMap((iface, index) => {
                      const color = getInterfaceColor(iface);
                      const rxColor = color;
                      const txColor = `${color}80`;
                      return [
                        <Line
                          key={`${iface}_rx_pps`}
                          type="linear"
                          dataKey={`${iface}_rx_pps`}
                          stroke={rxColor}
                          name={`${iface} RX pps`}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                        />,
                        <Line
                          key={`${iface}_tx_pps`}
                          type="linear"
                          dataKey={`${iface}_tx_pps`}
                          stroke={txColor}
                          name={`${iface} TX pps`}
                          strokeWidth={2}
                          dot={false}
                          connectNulls={false}
                        />
                      ];
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 