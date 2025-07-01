/**
 * Disk Usage Chart Component
 * 
 * Displays disk usage over time with live updates and time range selection
 * Similar to SystemMetricsChart but for disk usage data
 */

import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DiskUsageHistoryItem {
  totalSize: number;
  walSize: number;
  shmSize: number;
  tableCount: number;
  timestamp: string;
}

interface DiskUsageChartProps {
  isLoading?: boolean;
  error?: string | null;
  timeRange?: string;
  onTimeRangeChange?: (range: string) => void;
}

const TIME_RANGES = [
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

export function DiskUsageChart({
  isLoading = false,
  error = null,
  timeRange = '1h',
  onTimeRangeChange
}: DiskUsageChartProps) {
  const [diskHistory, setDiskHistory] = useState<DiskUsageHistoryItem[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Fetch disk usage history
  const fetchDiskHistory = async (range: string) => {
    try {
      setRefreshError(null);
      const response = await fetch(`/api/admin/disk/usage/history?timeRange=${range}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Ensure we have an array
      const historyData = Array.isArray(data) ? data : [];
      setDiskHistory(historyData);
    } catch (error) {
      console.error('Error fetching disk usage history:', error);
      setRefreshError(error instanceof Error ? error.message : 'Failed to fetch data');
      setDiskHistory([]);
    }
  };

  // Initial load and time range changes
  useEffect(() => {
    fetchDiskHistory(timeRange);
  }, [timeRange]);

  // Auto-refresh every 30 seconds (less frequent than monitoring since disk usage changes slower)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDiskHistory(timeRange);
    }, 30000);

    return () => clearInterval(interval);
  }, [timeRange]);

  // Transform data for chart display
  const chartData = useMemo(() => {
    return diskHistory.map(item => {
      const totalCombinedBytes = item.totalSize + item.walSize + item.shmSize;
      const totalCombinedMB = Number((totalCombinedBytes / (1024 * 1024)).toFixed(2));
      
      // Debug logging (can be removed after testing)
      // console.log('DEBUG Chart Transform:', {
      //   timestamp: item.timestamp,
      //   totalSize: item.totalSize,
      //   walSize: item.walSize,
      //   shmSize: item.shmSize,
      //   totalCombinedBytes,
      //   totalCombinedMB
      // });
      
      return {
        timestamp: new Date(item.timestamp),
        totalCombinedSizeMB: totalCombinedMB,
        dbSizeMB: Number((item.totalSize / (1024 * 1024)).toFixed(2)), // Just the .db file (logical + indexes)
        walSizeMB: Number((item.walSize / (1024 * 1024)).toFixed(2)),
        shmSizeMB: Number((item.shmSize / (1024 * 1024)).toFixed(2))
      };
    });
  }, [diskHistory]);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const time = label instanceof Date ? label.toLocaleTimeString() : new Date(label).toLocaleTimeString();
      
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{time}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value.toFixed(2)} MB
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const currentError = error || refreshError;

  if (currentError) {
    return (
      <div style={{ 
        padding: 'var(--space-6)', 
        textAlign: 'center',
        background: 'rgba(var(--error-rgb), 0.1)',
        borderRadius: 'var(--space-2)',
        border: '1px solid rgba(var(--error-rgb), 0.3)'
      }}>
        <h3>Disk Usage Trend</h3>
        <p style={{ color: 'rgb(var(--error-rgb))' }}>Error: {currentError}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Chart Header with Time Range Selection */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 'var(--space-2)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
          Disk Usage Trend
        </h3>
        
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {TIME_RANGES.map(range => (
            <button
              key={range.value}
              onClick={() => onTimeRangeChange?.(range.value)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--space-1)',
                border: '1px solid rgba(var(--border-rgb), 0.3)',
                background: timeRange === range.value 
                  ? 'rgba(var(--primary-rgb), 0.2)' 
                  : 'rgba(var(--border-rgb), 0.1)',
                color: timeRange === range.value 
                  ? 'rgb(var(--primary-rgb))' 
                  : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s ease'
              }}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Chart */}
      {isLoading ? (
        <div className="loading-state" style={{ 
          padding: 'var(--space-8)', 
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          <p>Loading disk usage data...</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="empty-state" style={{ 
          padding: 'var(--space-8)', 
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          <p>No disk usage data available for the selected time range</p>
          <p style={{ fontSize: '0.875rem', marginTop: 'var(--space-2)' }}>
            Data is recorded every 5 minutes. Check back after some activity.
          </p>
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
                const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
                return date.toLocaleTimeString();
              }}
            />
            <YAxis 
              stroke="var(--text-secondary)"
              fontSize={12}
              label={{ value: 'MB', position: 'insideLeft', angle: -90, dy: -10, fill: 'var(--text-secondary)' }}
            />
            <Tooltip content={customTooltip} />
            
            <Line
              type="monotone"
              dataKey="totalCombinedSizeMB"
              stroke="rgb(var(--primary-rgb))"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, stroke: 'rgb(var(--primary-rgb))', strokeWidth: 2, fill: 'var(--background)' }}
              name="Total Database Size (DB + WAL + SHM)"
              connectNulls={false}
            />
            
            <Line
              type="monotone"
              dataKey="dbSizeMB"
              stroke="rgba(var(--primary-rgb), 0.7)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: 'rgba(var(--primary-rgb), 0.7)', strokeWidth: 2, fill: 'var(--background)' }}
              name="DB Size (Logical + Indexes)"
              connectNulls={false}
            />
            
            <Line
              type="monotone"
              dataKey="walSizeMB"
              stroke="rgba(var(--warning-rgb), 0.8)"
              strokeWidth={1}
              dot={false}
              activeDot={{ r: 3, stroke: 'rgba(var(--warning-rgb), 0.8)', strokeWidth: 2, fill: 'var(--background)' }}
              name="WAL File Size"
              connectNulls={false}
            />
            
            <Line
              type="monotone"
              dataKey="shmSizeMB"
              stroke="rgba(var(--success-rgb), 0.6)"
              strokeWidth={1}
              dot={false}
              activeDot={{ r: 3, stroke: 'rgba(var(--success-rgb), 0.6)', strokeWidth: 2, fill: 'var(--background)' }}
              name="SHM File Size"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
} 