'use client';

import { useState, useEffect } from 'react';

interface CleanupOperation {
  id: number;
  operationType: string;
  dataType: string;
  recordsAffected: number;
  bytesFreed: number;
  durationMs: number;
  status: string;
  errorMessage?: string;
  startedAt: string;
  completedAt: string;
}

interface CleanupEstimate {
  dataType: string;
  estimatedRecords: number;
  estimatedBytes: number;
  oldestRecord: string;
  newestRecord: string;
}

export function CleanupOperations() {
  const [operations, setOperations] = useState<CleanupOperation[]>([]);
  const [estimates, setEstimates] = useState<CleanupEstimate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch operations history
      const operationsRes = await fetch('/api/admin/disk/cleanup/history');
      if (operationsRes.ok) {
        const operationsData = await operationsRes.json();
        // Ensure we set an array - the API returns { history: [...] }
        setOperations(Array.isArray(operationsData) ? operationsData : operationsData.history || []);
      }

      // Fetch estimates for default data types
      const dataTypes = ['system_metrics', 'interface_metrics', 'terminal_logs', 'connection_tracking'];
      const estimatePromises = dataTypes.map(async (dataType) => {
        try {
          const res = await fetch(`/api/admin/disk/cleanup/estimate?dataType=${dataType}`);
          if (res.ok) {
            const data = await res.json();
            // Ensure the estimate has the dataType field
            const estimate = data.estimate || data;
            return { ...estimate, dataType };
          }
          return null;
        } catch {
          return null;
        }
      });

      const estimateResults = await Promise.all(estimatePromises);
      const validEstimates = estimateResults.filter(Boolean);
      setEstimates(validEstimates);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching cleanup data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const runCleanup = async () => {
    if (selectedDataTypes.length === 0) return;

    try {
      setIsRunningCleanup(true);
      const response = await fetch('/api/admin/disk/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataTypes: selectedDataTypes,
          dryRun: false
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run cleanup');
      }

      await fetchData();
      setSelectedDataTypes([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunningCleanup(false);
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

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const toggleDataType = (dataType: string) => {
    setSelectedDataTypes(prev => 
      prev.includes(dataType) 
        ? prev.filter(dt => dt !== dataType)
        : [...prev, dataType]
    );
  };

  const getTotalEstimate = () => {
    const selected = estimates.filter(e => selectedDataTypes.includes(e.dataType));
    return {
      records: selected.reduce((sum, e) => sum + e.estimatedRecords, 0),
      bytes: selected.reduce((sum, e) => sum + e.estimatedBytes, 0)
    };
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

  const totalEstimate = getTotalEstimate();

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-4)',
        backgroundColor: 'rgba(var(--border-rgb), 0.2)',
        borderRadius: 'var(--space-3)',
        border: '1px solid rgba(var(--border-rgb), 0.3)'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          margin: '0 0 var(--space-2) 0',
          color: 'rgb(var(--foreground-rgb))'
        }}>
          Manual Cleanup Operations
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'rgb(var(--secondary-rgb))',
          margin: 0,
          lineHeight: 1.5
        }}>
          Manually trigger cleanup operations for specific data types.
          Review estimates before running cleanup to understand the impact.
        </p>
      </div>

      {error && (
        <div style={{
          padding: 'var(--space-3)',
          backgroundColor: 'rgba(var(--error-rgb), 0.1)',
          border: '1px solid rgba(var(--error-rgb), 0.3)',
          borderRadius: 'var(--space-2)',
          marginBottom: 'var(--space-4)'
        }}>
          <p style={{
            color: 'rgb(var(--error-rgb))',
            fontSize: '14px',
            margin: 0
          }}>
            {error}
          </p>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        {/* Cleanup Estimates */}
        <div className="card">
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            margin: '0 0 var(--space-4) 0',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            Cleanup Estimates
          </h3>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)'
          }}>
            {estimates.map((estimate) => (
              <label
                key={estimate.dataType}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3)',
                  backgroundColor: selectedDataTypes.includes(estimate.dataType)
                    ? 'rgba(var(--primary-rgb), 0.1)'
                    : 'rgba(var(--border-rgb), 0.2)',
                  border: '1px solid',
                  borderColor: selectedDataTypes.includes(estimate.dataType)
                    ? 'rgba(var(--primary-rgb), 0.3)'
                    : 'rgba(var(--border-rgb), 0.3)',
                  borderRadius: 'var(--space-2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  if (!selectedDataTypes.includes(estimate.dataType)) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedDataTypes.includes(estimate.dataType)) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <input
                    type="checkbox"
                    checked={selectedDataTypes.includes(estimate.dataType)}
                    onChange={() => toggleDataType(estimate.dataType)}
                    style={{ accentColor: 'rgb(var(--primary-rgb))' }}
                  />
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'rgb(var(--foreground-rgb))',
                      fontFamily: 'monospace'
                    }}>
                      {estimate.dataType}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'rgb(var(--secondary-rgb))'
                    }}>
                      {formatNumber(estimate.estimatedRecords)} records
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'rgb(var(--foreground-rgb))'
                }}>
                  {formatBytes(estimate.estimatedBytes)}
                </div>
              </label>
            ))}
          </div>

          {selectedDataTypes.length > 0 && (
            <div style={{
              padding: 'var(--space-3)',
              backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
              border: '1px solid rgba(var(--warning-rgb), 0.3)',
              borderRadius: 'var(--space-2)',
              marginBottom: 'var(--space-4)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgb(var(--warning-rgb))'
                }}>
                  Total Impact
                </span>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'rgb(var(--warning-rgb))'
                }}>
                  {formatBytes(totalEstimate.bytes)}
                </span>
              </div>
              <div style={{
                fontSize: '12px',
                color: 'rgb(var(--secondary-rgb))'
              }}>
                {formatNumber(totalEstimate.records)} records will be removed
              </div>
            </div>
          )}

          <button
            onClick={runCleanup}
            disabled={selectedDataTypes.length === 0 || isRunningCleanup}
            style={{
              width: '100%',
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: selectedDataTypes.length > 0 && !isRunningCleanup
                ? 'rgb(var(--warning-rgb))'
                : 'rgba(var(--border-rgb), 0.3)',
              color: selectedDataTypes.length > 0 && !isRunningCleanup
                ? 'white'
                : 'rgb(var(--secondary-rgb))',
              border: 'none',
              borderRadius: 'var(--space-2)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: selectedDataTypes.length > 0 && !isRunningCleanup ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            {isRunningCleanup ? 'Running Cleanup...' : 'Run Cleanup'}
          </button>
        </div>

        {/* Recent Operations */}
        <div className="card">
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            margin: '0 0 var(--space-4) 0',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            Recent Operations
          </h3>

          <div style={{
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 'var(--space-3)',
            maxHeight: '400px',
            overflowY: 'auto' as const
          }}>
            {operations.length === 0 ? (
              <div style={{
                textAlign: 'center' as const,
                padding: 'var(--space-4)',
                color: 'rgb(var(--secondary-rgb))'
              }}>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  No cleanup operations performed yet
                </p>
              </div>
            ) : (
              operations.slice(0, 10).map((operation) => (
                <div
                  key={operation.id}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                    borderRadius: 'var(--space-2)',
                    border: '1px solid rgba(var(--border-rgb), 0.3)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 'var(--space-2)'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: 'rgb(var(--foreground-rgb))',
                        fontFamily: 'monospace'
                      }}>
                        {operation.dataType}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'rgb(var(--secondary-rgb))'
                      }}>
                        {formatDate(operation.completedAt)}
                      </div>
                    </div>
                    <div style={{
                      padding: 'var(--space-1) var(--space-2)',
                      backgroundColor: operation.status === 'success'
                        ? 'rgba(var(--success-rgb), 0.2)'
                        : 'rgba(var(--error-rgb), 0.2)',
                      border: '1px solid',
                      borderColor: operation.status === 'success'
                        ? 'rgba(var(--success-rgb), 0.5)'
                        : 'rgba(var(--error-rgb), 0.5)',
                      borderRadius: 'var(--space-1)',
                      fontSize: '11px',
                      color: operation.status === 'success'
                        ? 'rgb(var(--success-rgb))'
                        : 'rgb(var(--error-rgb))'
                    }}>
                      {operation.status}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: 'rgb(var(--secondary-rgb))'
                  }}>
                    <span>{formatNumber(operation.recordsAffected)} records</span>
                    <span>{formatBytes(operation.bytesFreed)} freed</span>
                    <span>{formatDuration(operation.durationMs)}</span>
                  </div>

                  {operation.errorMessage && (
                    <div style={{
                      marginTop: 'var(--space-2)',
                      padding: 'var(--space-2)',
                      backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                      borderRadius: 'var(--space-1)',
                      fontSize: '12px',
                      color: 'rgb(var(--error-rgb))'
                    }}>
                      {operation.errorMessage}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 