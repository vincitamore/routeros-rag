'use client';

import { useState, useEffect } from 'react';
import { StatCard } from '../../ui/StatCard';
import { DataTable } from '../../ui/DataTable';
import { DiskUsageChart } from './charts/disk-usage-chart';
import { TableBreakdownChart } from './charts/table-breakdown-chart';

interface DiskUsageMetrics {
  totalDatabaseSize: number;
  walFileSize: number;
  shmFileSize: number;
  freeSpace: number;
  totalSpace: number;
  tableUsages: Array<{
    tableName: string;
    recordCount: number;
    sizeBytes: number;
    averageRowSize: number;
    indexSizeBytes: number;
    lastUpdated: string;
    growthRate: number;
  }>;
  lastCleanup: string | null;
}

export function DiskUsageDashboard() {
  const [metrics, setMetrics] = useState<DiskUsageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('1h');

  useEffect(() => {
    fetchDiskUsage();
  }, []);

  const fetchDiskUsage = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/disk/usage');
      
      if (!response.ok) {
        throw new Error('Failed to fetch disk usage');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  const calculateUsagePercentage = (): number => {
    if (!metrics || metrics.totalSpace === 0) return 0;
    const used = metrics.totalSpace - metrics.freeSpace;
    return (used / metrics.totalSpace) * 100;
  };

  const getGrowthRateColor = (growthRate: number): string => {
    if (growthRate > 100000) return 'rgb(var(--error-rgb))'; // > 100KB/day
    if (growthRate > 10000) return 'rgb(var(--warning-rgb))'; // > 10KB/day
    return 'rgb(var(--success-rgb))';
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(var(--primary-rgb), 0.3)',
          borderTop: '3px solid rgb(var(--primary-rgb))',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{
        padding: 'var(--space-6)',
        textAlign: 'center' as const
      }}>
        <p style={{
          color: 'rgb(var(--error-rgb))',
          fontSize: '14px',
          margin: '0 0 var(--space-4) 0'
        }}>
          Error loading disk usage: {error}
        </p>
        <button
          onClick={fetchDiskUsage}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'rgb(var(--primary-rgb))',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--space-2)',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const usagePercentage = calculateUsagePercentage();
  const totalRecords = metrics.tableUsages.reduce((sum, table) => sum + table.recordCount, 0);

  // Prepare table columns for DataTable
  const tableColumns = [
    {
      key: 'tableName',
      header: 'Table Name',
      sortable: true,
      render: (value: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
          {value}
        </span>
      ),
      width: '25%'
    },
    {
      key: 'recordCount',
      header: 'Records',
      sortable: true,
      align: 'right' as const,
      render: (value: number) => formatNumber(value),
      width: '15%'
    },
    {
      key: 'sizeBytes',
      header: 'Size',
      sortable: true,
      align: 'right' as const,
      render: (value: number) => formatBytes(value),
      width: '15%'
    },
    {
      key: 'averageRowSize',
      header: 'Avg Row Size',
      sortable: true,
      align: 'right' as const,
      render: (value: number) => formatBytes(value),
      width: '15%'
    },
    {
      key: 'indexSizeBytes',
      header: 'Index Size',
      sortable: true,
      align: 'right' as const,
      render: (value: number) => formatBytes(value || 0),
      width: '15%'
    },
    {
      key: 'growthRate',
      header: 'Growth Rate',
      sortable: true,
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ 
          color: getGrowthRateColor(value),
          fontWeight: '500'
        }}>
          {value > 0 ? '+' : ''}{formatBytes(value)}/day
        </span>
      ),
      width: '15%'
    }
  ];

  return (
    <div>
      {/* Statistics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        <StatCard
          title="Total Database Size"
          value={formatBytes(metrics.totalDatabaseSize + metrics.walFileSize + metrics.shmFileSize)}
          subtitle={`${formatBytes(metrics.walFileSize)} WAL, ${formatBytes(metrics.shmFileSize)} SHM`}
          trend="neutral"
        />
        
        <StatCard
          title="Disk Usage"
          value={`${usagePercentage.toFixed(1)}%`}
          subtitle={`${formatBytes(metrics.totalSpace - metrics.freeSpace)} of ${formatBytes(metrics.totalSpace)}`}
          trend={usagePercentage > 80 ? "down" : usagePercentage > 60 ? "neutral" : "up"}
        />
        
        <StatCard
          title="Total Records"
          value={formatNumber(totalRecords)}
          subtitle={`Across ${metrics.tableUsages.length} tables`}
          trend="neutral"
        />
        
        <StatCard
          title="Last Cleanup"
          value={metrics.lastCleanup ? new Date(metrics.lastCleanup).toLocaleDateString() : 'Never'}
          subtitle={metrics.lastCleanup ? `${Math.floor((Date.now() - new Date(metrics.lastCleanup).getTime()) / (1000 * 60 * 60 * 24))} days ago` : 'No cleanup performed'}
          trend={metrics.lastCleanup ? "neutral" : "down"}
        />
      </div>

      {/* Charts Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-4)'
      }}>
        {/* Disk Usage Over Time Chart */}
        <div className="card">
          <DiskUsageChart 
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </div>

        {/* Table Size Breakdown */}
        <div className="card">
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 var(--space-4) 0',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            Storage by Table
          </h3>
          <TableBreakdownChart data={metrics.tableUsages} />
        </div>
      </div>

      {/* Table Details with proper DataTable */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          margin: '0 0 var(--space-4) 0',
          color: 'rgb(var(--foreground-rgb))'
        }}>
          Table Details
        </h3>
        
        <DataTable
          data={metrics.tableUsages.sort((a, b) => b.sizeBytes - a.sizeBytes)}
          columns={tableColumns}
          searchPlaceholder="Search tables..."
          itemsPerPage={10}
          showSearch={true}
          showPagination={true}
          loading={false}
          emptyMessage="No table data available"
        />
      </div>
    </div>
  );
} 