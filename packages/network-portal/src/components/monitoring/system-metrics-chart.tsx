/**
 * System Metrics Chart Component
 * 
 * Displays real-time system metrics (CPU, memory, storage) in chart format
 * using Recharts with live updates from WebSocket data.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SystemMetrics, ChartDataPoint, TimeRange, TIME_RANGES } from '../../types/monitoring';

interface SystemMetricsChartProps {
  metrics: SystemMetrics[];
  isLoading?: boolean;
  error?: string | null;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
}

export function SystemMetricsChart({
  metrics,
  isLoading = false,
  error = null,
  timeRange = '24h',
  onTimeRangeChange
}: SystemMetricsChartProps) {

  const [selectedMetrics, setSelectedMetrics] = useState({
    cpu: true,
    memory: true,
    storage: true
  });

  // Transform metrics data for chart display
  const chartData = useMemo(() => {
    if (!metrics || metrics.length === 0) {
      return [];
    }

    const transformedData = metrics.map((metric, index) => {
      // Ensure metric properties are numbers before calculation
      const totalMemory = Number(metric.total_memory) || 0;
      const freeMemory = Number(metric.free_memory) || 0;
      const totalHdd = Number(metric.total_hdd_space) || 0;
      const freeHdd = Number(metric.free_hdd_space) || 0;
      const cpuLoad = Number(metric.cpu_load) || 0;

      // Calculate memory and storage usage percentages with precision
      const memoryUsage = totalMemory > 0 
        ? parseFloat((( (totalMemory - freeMemory) / totalMemory) * 100).toFixed(2))
        : 0;
      
      const storageUsage = totalHdd > 0
        ? parseFloat((( (totalHdd - freeHdd) / totalHdd) * 100).toFixed(2))
        : 0;

      return {
        timestamp: new Date(metric.timestamp),
        cpu: cpuLoad,
        memory: memoryUsage,
        storage: storageUsage
      };
    });

    return transformedData;
  }, [metrics]);

  // Get latest metrics for display
  const latestMetrics = useMemo(() => {
    if (!metrics || metrics.length === 0) return null;
    return metrics[metrics.length - 1];
  }, [metrics]);

  // Calculate Y-axis domain based on actual data range
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];
    
    const selectedData = chartData.flatMap(point => {
      const values = [];
      if (selectedMetrics.cpu) values.push(point.cpu);
      if (selectedMetrics.memory) values.push(point.memory);
      if (selectedMetrics.storage) values.push(point.storage);
      return values;
    }).filter(val => val != null);

    if (selectedData.length === 0) return [0, 100];

    const min = Math.min(...selectedData);
    const max = Math.max(...selectedData);
    
    // Add padding (10% of range, minimum 5 units)
    const range = max - min;
    const padding = Math.max(range * 0.1, 5);
    
    const domainMin = Math.max(0, min - padding);
    const domainMax = Math.min(100, max + padding);
    
    // Ensure minimum range of 10 units for better visualization
    if (domainMax - domainMin < 10) {
      const center = (domainMin + domainMax) / 2;
      return [Math.max(0, center - 5), Math.min(100, center + 5)];
    }
    
    return [domainMin, domainMax];
  }, [chartData, selectedMetrics]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (uptime: string): string => {
    // RouterOS uptime format: "1w2d3h4m5s"
    const regex = /(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
    const match = uptime.match(regex);
    
    if (!match) return uptime;
    
    const [, weeks, days, hours, minutes, seconds] = match;
    const parts = [];
    
    if (weeks) parts.push(`${weeks}w`);
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '0m';
  };

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Handle both Date objects and timestamp strings
      let time = '';
      if (label instanceof Date) {
        time = label.toLocaleTimeString();
      } else if (typeof label === 'string') {
        time = new Date(label).toLocaleTimeString();
      } else {
        time = new Date(label).toLocaleTimeString();
      }
      
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{time}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(1)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleLegendClick = (dataKey: string) => {
    // ... existing code ...
  };

  if (error) {
    return (
      <div className="metrics-chart-container">
        <div className="metrics-header">
          <h3>System Metrics</h3>
        </div>
        <div className="error-state">
          <p>Error loading metrics: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Current Values Display */}
      {latestMetrics && (
        <div className="current-metrics">
          <div className="metric-card">
            <div className="metric-label">CPU Load</div>
            <div className="metric-value cpu">{latestMetrics.cpu_load.toFixed(1)}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Memory Usage</div>
            <div className="metric-value memory">
              {latestMetrics.total_memory > 0 
                ? ((latestMetrics.total_memory - latestMetrics.free_memory) / latestMetrics.total_memory * 100).toFixed(1)
                : '0'
              }%
            </div>
            <div className="metric-detail">
              {formatBytes(latestMetrics.total_memory - latestMetrics.free_memory)} / {formatBytes(latestMetrics.total_memory)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Storage Usage</div>
            <div className="metric-value storage">
              {latestMetrics.total_hdd_space > 0 
                ? ((latestMetrics.total_hdd_space - latestMetrics.free_hdd_space) / latestMetrics.total_hdd_space * 100).toFixed(1)
                : '0'
              }%
            </div>
            <div className="metric-detail">
              {formatBytes(latestMetrics.total_hdd_space - latestMetrics.free_hdd_space)} / {formatBytes(latestMetrics.total_hdd_space)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Uptime</div>
            <div className="metric-value uptime">{formatUptime(latestMetrics.uptime)}</div>
          </div>
        </div>
      )}

      {/* Chart Controls */}
      <div className="chart-controls">
        <div className="metric-toggles">
          <label className="metric-toggle">
            <input
              type="checkbox"
              checked={selectedMetrics.cpu}
              onChange={(e) => setSelectedMetrics(prev => ({ ...prev, cpu: e.target.checked }))}
            />
            <span className="toggle-label cpu">CPU Load</span>
          </label>
          <label className="metric-toggle">
            <input
              type="checkbox"
              checked={selectedMetrics.memory}
              onChange={(e) => setSelectedMetrics(prev => ({ ...prev, memory: e.target.checked }))}
            />
            <span className="toggle-label memory">Memory Usage</span>
          </label>
          <label className="metric-toggle">
            <input
              type="checkbox"
              checked={selectedMetrics.storage}
              onChange={(e) => setSelectedMetrics(prev => ({ ...prev, storage: e.target.checked }))}
            />
            <span className="toggle-label storage">Storage Usage</span>
          </label>
        </div>
      </div>
      
      {/* Chart */}
      {isLoading ? (
        <div className="loading-state">
          <p>Loading metrics...</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="empty-state">
          <p>No metrics data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
            <XAxis 
              dataKey="timestamp" 
              stroke="var(--text-secondary)"
              fontSize={12}
              tickFormatter={(timestamp) => {
                // Handle both Date objects and timestamp values
                const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
                return date.toLocaleTimeString();
              }}
            />
            <YAxis 
              domain={yAxisDomain}
              stroke="var(--text-secondary)"
              fontSize={12}
              label={{ value: '%', position: 'insideLeft', angle: -90, dy: -10, fill: 'var(--text-secondary)' }}
            />
            <Tooltip content={customTooltip} />
            
            {selectedMetrics.cpu && (
              <Line
                type="monotone"
                dataKey="cpu"
                stroke="var(--cpu-color, #ef4444)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--cpu-color, #ef4444)', strokeWidth: 2, fill: 'var(--background)' }}
                name="CPU Load"
                connectNulls={false}
              />
            )}
            
            {selectedMetrics.memory && (
              <Line
                type="monotone"
                dataKey="memory"
                stroke="var(--memory-color, #3b82f6)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--memory-color, #3b82f6)', strokeWidth: 2, fill: 'var(--background)' }}
                name="Memory Usage"
                connectNulls={false}
              />
            )}
            
            {selectedMetrics.storage && (
              <Line
                type="monotone"
                dataKey="storage"
                stroke="var(--storage-color, #059669)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--storage-color, #059669)', strokeWidth: 2, fill: 'var(--background)' }}
                name="Storage Usage"
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
} 