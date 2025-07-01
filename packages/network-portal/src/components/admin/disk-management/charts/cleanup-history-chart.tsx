'use client';

import { useState, useEffect } from 'react';

interface CleanupOperation {
  id: number;
  operationType: string;
  dataType: string;
  recordsAffected: number;
  bytesFreed: number;
  durationMs: number;
  status: 'success' | 'error' | 'warning';
  startedAt: string;
  completedAt: string;
}

interface CleanupHistoryChartProps {
  days?: number;
  operationType?: string;
}

export function CleanupHistoryChart({ days = 30, operationType = 'all' }: CleanupHistoryChartProps) {
  const [operations, setOperations] = useState<CleanupOperation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCleanupHistory();
  }, [days, operationType]);

  const fetchCleanupHistory = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({ 
        days: days.toString(),
        ...(operationType !== 'all' && { type: operationType })
      });
      const response = await fetch(`/api/admin/disk/cleanup/history?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cleanup history');
      }
      
      const data = await response.json();
      setOperations(data);
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
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: 'success' | 'error' | 'warning'): string => {
    switch (status) {
      case 'success': return 'rgb(var(--success-rgb))';
      case 'error': return 'rgb(var(--error-rgb))';
      case 'warning': return 'rgb(var(--warning-rgb))';
    }
  };

  const getOperationTypeColor = (type: string): string => {
    const colors = {
      'manual': 'rgb(var(--primary-rgb))',
      'scheduled': 'rgb(var(--success-rgb))',
      'automatic': 'rgba(var(--primary-rgb), 0.7)',
      'emergency': 'rgb(var(--error-rgb))',
      'vacuum': 'rgb(var(--warning-rgb))'
    };
    return colors[type as keyof typeof colors] || 'rgb(var(--secondary-rgb))';
  };

  if (isLoading) {
    return (
      <div style={{
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '2px solid rgba(var(--primary-rgb), 0.3)',
          borderTop: '2px solid rgb(var(--primary-rgb))',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column' as const,
        gap: 'var(--space-2)'
      }}>
        <p style={{
          color: 'rgb(var(--error-rgb))',
          fontSize: '14px',
          margin: 0
        }}>
          Failed to load cleanup history
        </p>
        <button
          onClick={fetchCleanupHistory}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
            border: '1px solid rgba(var(--primary-rgb), 0.5)',
            borderRadius: 'var(--space-2)',
            color: 'rgb(var(--primary-rgb))',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div style={{
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column' as const,
        gap: 'var(--space-2)'
      }}>
        <p style={{
          color: 'rgb(var(--secondary-rgb))',
          fontSize: '14px',
          margin: 0,
          textAlign: 'center' as const
        }}>
          No cleanup operations found
        </p>
        <p style={{
          color: 'rgb(var(--secondary-rgb))',
          fontSize: '12px',
          margin: 0,
          textAlign: 'center' as const
        }}>
          Try running a cleanup operation or adjusting the time range
        </p>
      </div>
    );
  }

  // Group operations by day and calculate statistics
  const operationsByDay = operations.reduce((acc, op) => {
    const day = new Date(op.startedAt).toDateString();
    if (!acc[day]) {
      acc[day] = {
        date: day,
        operations: [],
        totalBytesFreed: 0,
        totalRecordsAffected: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0
      };
    }
    acc[day].operations.push(op);
    acc[day].totalBytesFreed += op.bytesFreed;
    acc[day].totalRecordsAffected += op.recordsAffected;
    acc[day][`${op.status}Count` as keyof typeof acc[string]]++;
    return acc;
  }, {} as Record<string, {
    date: string;
    operations: CleanupOperation[];
    totalBytesFreed: number;
    totalRecordsAffected: number;
    successCount: number;
    errorCount: number;
    warningCount: number;
  }>);

  const dailyStats = Object.values(operationsByDay).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const maxBytesFreed = Math.max(...dailyStats.map(d => d.totalBytesFreed));
  const totalOperations = operations.length;
  const totalBytesFreed = operations.reduce((sum, op) => sum + op.bytesFreed, 0);
  const successRate = operations.filter(op => op.status === 'success').length / totalOperations;

  return (
    <div style={{ width: '100%' }}>
      {/* Summary Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3)',
        backgroundColor: 'rgba(var(--border-rgb), 0.2)',
        borderRadius: 'var(--space-3)',
        border: '1px solid rgba(var(--border-rgb), 0.3)'
      }}>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'rgb(var(--foreground-rgb))',
            marginBottom: 'var(--space-1)'
          }}>
            {totalOperations}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgb(var(--secondary-rgb))',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.025em'
          }}>
            Total Operations
          </div>
        </div>

        <div style={{ textAlign: 'center' as const }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'rgb(var(--success-rgb))',
            marginBottom: 'var(--space-1)'
          }}>
            {formatBytes(totalBytesFreed)}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgb(var(--secondary-rgb))',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.025em'
          }}>
            Space Freed
          </div>
        </div>

        <div style={{ textAlign: 'center' as const }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: successRate >= 0.9 ? 'rgb(var(--success-rgb))' : successRate >= 0.7 ? 'rgb(var(--warning-rgb))' : 'rgb(var(--error-rgb))',
            marginBottom: 'var(--space-1)'
          }}>
            {(successRate * 100).toFixed(1)}%
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgb(var(--secondary-rgb))',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.025em'
          }}>
            Success Rate
          </div>
        </div>

        <div style={{ textAlign: 'center' as const }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '600',
            color: 'rgb(var(--primary-rgb))',
            marginBottom: 'var(--space-1)'
          }}>
            {formatDuration(operations.reduce((sum, op) => sum + op.durationMs, 0) / operations.length)}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgb(var(--secondary-rgb))',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.025em'
          }}>
            Avg Duration
          </div>
        </div>
      </div>

      {/* Operations Timeline */}
      <div style={{
        backgroundColor: 'rgba(var(--border-rgb), 0.2)',
        borderRadius: 'var(--space-3)',
        padding: 'var(--space-4)',
        border: '1px solid rgba(var(--border-rgb), 0.3)'
      }}>
        <h4 style={{
          fontSize: '16px',
          fontWeight: '500',
          color: 'rgb(var(--foreground-rgb))',
          margin: '0 0 var(--space-4) 0'
        }}>
          Recent Operations
        </h4>

        <div style={{
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 'var(--space-2)',
          maxHeight: '300px',
          overflowY: 'auto' as const
        }}>
          {operations.slice(0, 10).map((operation) => (
            <div
              key={operation.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-3)',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                borderRadius: 'var(--space-2)',
                border: `1px solid ${getStatusColor(operation.status)}`,
                borderLeftWidth: '4px',
                fontSize: '13px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(operation.status)
                }} />
                
                <div>
                  <div style={{
                    fontWeight: '500',
                    color: 'rgb(var(--foreground-rgb))',
                    marginBottom: 'var(--space-1)'
                  }}>
                    {operation.operationType} - {operation.dataType}
                  </div>
                  <div style={{
                    color: 'rgb(var(--secondary-rgb))',
                    fontSize: '11px'
                  }}>
                    {formatDate(operation.startedAt)}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                fontSize: '12px'
              }}>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ color: 'rgb(var(--success-rgb))', fontWeight: '500' }}>
                    {formatBytes(operation.bytesFreed)}
                  </div>
                  <div style={{ color: 'rgb(var(--secondary-rgb))' }}>
                    {formatNumber(operation.recordsAffected)} records
                  </div>
                </div>
                
                <div style={{
                  color: 'rgb(var(--secondary-rgb))',
                  fontSize: '11px',
                  minWidth: '50px',
                  textAlign: 'right' as const
                }}>
                  {formatDuration(operation.durationMs)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {operations.length > 10 && (
          <div style={{
            textAlign: 'center' as const,
            marginTop: 'var(--space-3)',
            padding: 'var(--space-2)',
            color: 'rgb(var(--secondary-rgb))',
            fontSize: '12px'
          }}>
            Showing 10 of {operations.length} operations
          </div>
        )}
      </div>

      {/* Daily Chart */}
      {dailyStats.length > 1 && (
        <div style={{
          marginTop: 'var(--space-4)',
          backgroundColor: 'rgba(var(--border-rgb), 0.2)',
          borderRadius: 'var(--space-3)',
          padding: 'var(--space-4)',
          border: '1px solid rgba(var(--border-rgb), 0.3)'
        }}>
          <h4 style={{
            fontSize: '16px',
            fontWeight: '500',
            color: 'rgb(var(--foreground-rgb))',
            margin: '0 0 var(--space-4) 0'
          }}>
            Daily Cleanup Impact
          </h4>

          <div style={{
            display: 'flex',
            alignItems: 'end',
            gap: 'var(--space-2)',
            height: '120px',
            padding: 'var(--space-2)',
            backgroundColor: 'rgba(var(--background-rgb), 0.5)',
            borderRadius: 'var(--space-2)'
          }}>
            {dailyStats.map((day, index) => {
              const height = maxBytesFreed > 0 ? (day.totalBytesFreed / maxBytesFreed) * 80 : 0;
              const hasErrors = day.errorCount > 0;
              
              return (
                <div
                  key={day.date}
                  style={{
                    display: 'flex',
                    flexDirection: 'column' as const,
                    alignItems: 'center',
                    flex: 1,
                    minWidth: '40px'
                  }}
                  title={`${new Date(day.date).toLocaleDateString()}: ${formatBytes(day.totalBytesFreed)} freed, ${day.operations.length} operations`}
                >
                  <div style={{
                    width: '100%',
                    maxWidth: '24px',
                    height: `${Math.max(height, 2)}px`,
                    backgroundColor: hasErrors ? 'rgb(var(--error-rgb))' : 'rgb(var(--success-rgb))',
                    borderRadius: '2px 2px 0 0',
                    marginBottom: 'var(--space-1)',
                    transition: 'all 0.2s ease-in-out'
                  }} />
                  
                  <div style={{
                    fontSize: '10px',
                    color: 'rgb(var(--secondary-rgb))',
                    textAlign: 'center' as const,
                    transform: 'rotate(-45deg)',
                    transformOrigin: 'center',
                    whiteSpace: 'nowrap' as const,
                    marginTop: 'var(--space-2)'
                  }}>
                    {new Date(day.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 