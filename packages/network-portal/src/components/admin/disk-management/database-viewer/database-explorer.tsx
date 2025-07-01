'use client';

import { useState, useEffect } from 'react';

interface TableInfo {
  name: string;
  type: 'table' | 'view' | 'index';
  rowCount: number;
  sizeBytes: number;
  columns: Array<{
    name: string;
    type: string;
    notNull: boolean;
    primaryKey: boolean;
    defaultValue?: string;
  }>;
  indexes: Array<{
    name: string;
    unique: boolean;
    columns: string[];
  }>;
}

interface DatabaseStats {
  totalTables: number;
  totalRows: number;
  totalSize: number;
  lastAnalyzed: string;
}

export function DatabaseViewer() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDatabaseInfo();
  }, []);

  const fetchDatabaseInfo = async () => {
    try {
      setIsLoading(true);
      
      const [tablesResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/database/tables'),
        fetch('/api/admin/database/statistics')
      ]);

      if (!tablesResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to fetch database information');
      }

      const tablesData = await tablesResponse.json();
      const statsData = await statsResponse.json();
      
      setTables(tablesData);
      setStats(statsData);
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

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTableTypeIcon = (type: string) => {
    switch (type) {
      case 'table':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="15" x2="21" y2="15"/>
            <line x1="3" y1="9" x2="9" y2="9"/>
            <line x1="3" y1="15" x2="9" y2="15"/>
          </svg>
        );
      case 'view':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        );
      case 'index':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        );
      default:
        return null;
    }
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
          Error loading database: {error}
        </p>
        <button
          onClick={fetchDatabaseInfo}
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

  return (
    <div>
      {/* Database Statistics */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-6)'
        }}>
          <div className="card" style={{ textAlign: 'center' as const }}>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(var(--primary-rgb))',
              marginBottom: 'var(--space-2)'
            }}>
              {stats.totalTables}
            </div>
            <div style={{
              fontSize: '14px',
              color: 'rgb(var(--secondary-rgb))',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.025em'
            }}>
              Total Tables
            </div>
          </div>

          <div className="card" style={{ textAlign: 'center' as const }}>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(var(--success-rgb))',
              marginBottom: 'var(--space-2)'
            }}>
              {formatNumber(stats.totalRows)}
            </div>
            <div style={{
              fontSize: '14px',
              color: 'rgb(var(--secondary-rgb))',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.025em'
            }}>
              Total Records
            </div>
          </div>

          <div className="card" style={{ textAlign: 'center' as const }}>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(var(--warning-rgb))',
              marginBottom: 'var(--space-2)'
            }}>
              {formatBytes(stats.totalSize)}
            </div>
            <div style={{
              fontSize: '14px',
              color: 'rgb(var(--secondary-rgb))',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.025em'
            }}>
              Database Size
            </div>
          </div>

          <div className="card" style={{ textAlign: 'center' as const }}>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'rgb(var(--foreground-rgb))',
              marginBottom: 'var(--space-2)'
            }}>
              {new Date(stats.lastAnalyzed).toLocaleDateString()}
            </div>
            <div style={{
              fontSize: '14px',
              color: 'rgb(var(--secondary-rgb))',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.025em'
            }}>
              Last Analyzed
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedTable ? '300px 1fr' : '1fr',
        gap: 'var(--space-4)',
        minHeight: '500px'
      }}>
        {/* Tables List */}
        <div className="card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-4)'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))',
              margin: 0
            }}>
              Database Tables
            </h3>
            
            <button
              onClick={fetchDatabaseInfo}
              style={{
                padding: 'var(--space-2)',
                backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                border: '1px solid rgba(var(--primary-rgb), 0.5)',
                borderRadius: 'var(--space-2)',
                color: 'rgb(var(--primary-rgb))',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              title="Refresh tables"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            </button>
          </div>

          {/* Search */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <input
              type="text"
              placeholder="Search tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                border: '1px solid rgba(var(--border-rgb), 0.5)',
                borderRadius: 'var(--space-2)',
                color: 'rgb(var(--foreground-rgb))',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          {/* Tables List */}
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto' as const,
            display: 'flex',
            flexDirection: 'column' as const,
            gap: 'var(--space-1)'
          }}>
            {filteredTables.map((table) => (
              <div
                key={table.name}
                onClick={() => setSelectedTable(table)}
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: selectedTable?.name === table.name 
                    ? 'rgba(var(--primary-rgb), 0.2)' 
                    : 'rgba(var(--border-rgb), 0.2)',
                  border: selectedTable?.name === table.name 
                    ? '1px solid rgba(var(--primary-rgb), 0.5)' 
                    : '1px solid rgba(var(--border-rgb), 0.3)',
                  borderRadius: 'var(--space-2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  if (selectedTable?.name !== table.name) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedTable?.name !== table.name) {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                  }
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginBottom: 'var(--space-2)'
                }}>
                  <div style={{
                    color: 'rgb(var(--primary-rgb))',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {getTableTypeIcon(table.type)}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'rgb(var(--foreground-rgb))',
                    fontFamily: 'monospace'
                  }}>
                    {table.name}
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'rgb(var(--secondary-rgb))'
                }}>
                  <span>{formatNumber(table.rowCount)} rows</span>
                  <span>{formatBytes(table.sizeBytes)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Details */}
        {selectedTable && (
          <div className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-4)'
            }}>
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'rgb(var(--foreground-rgb))',
                  margin: 0,
                  fontFamily: 'monospace'
                }}>
                  {selectedTable.name}
                </h3>
                <p style={{
                  fontSize: '12px',
                  color: 'rgb(var(--secondary-rgb))',
                  margin: 'var(--space-1) 0 0 0',
                  textTransform: 'capitalize' as const
                }}>
                  {selectedTable.type} • {formatNumber(selectedTable.rowCount)} rows • {formatBytes(selectedTable.sizeBytes)}
                </p>
              </div>

              <button
                onClick={() => setSelectedTable(null)}
                style={{
                  padding: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-2)',
                  color: 'rgb(var(--secondary-rgb))',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                title="Close details"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Columns */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '500',
                color: 'rgb(var(--foreground-rgb))',
                margin: '0 0 var(--space-3) 0'
              }}>
                Columns ({selectedTable.columns.length})
              </h4>
              
              <div style={{
                backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                borderRadius: 'var(--space-2)',
                overflow: 'hidden'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 80px 80px',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.4)',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: 'rgb(var(--secondary-rgb))',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.025em'
                }}>
                  <div>Name</div>
                  <div>Type</div>
                  <div>Primary</div>
                  <div>Not Null</div>
                </div>
                
                {selectedTable.columns.map((column, index) => (
                  <div
                    key={column.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 80px 80px',
                      padding: 'var(--space-2) var(--space-3)',
                      borderTop: index > 0 ? '1px solid rgba(var(--border-rgb), 0.3)' : 'none',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{
                      color: 'rgb(var(--foreground-rgb))',
                      fontFamily: 'monospace',
                      fontWeight: column.primaryKey ? '600' : '400'
                    }}>
                      {column.name}
                    </div>
                    <div style={{
                      color: 'rgb(var(--secondary-rgb))',
                      fontFamily: 'monospace'
                    }}>
                      {column.type}
                    </div>
                    <div style={{
                      color: column.primaryKey ? 'rgb(var(--primary-rgb))' : 'rgb(var(--secondary-rgb))'
                    }}>
                      {column.primaryKey ? '✓' : '—'}
                    </div>
                    <div style={{
                      color: column.notNull ? 'rgb(var(--warning-rgb))' : 'rgb(var(--secondary-rgb))'
                    }}>
                      {column.notNull ? '✓' : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Indexes */}
            {selectedTable.indexes.length > 0 && (
              <div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: 'rgb(var(--foreground-rgb))',
                  margin: '0 0 var(--space-3) 0'
                }}>
                  Indexes ({selectedTable.indexes.length})
                </h4>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column' as const,
                  gap: 'var(--space-2)'
                }}>
                  {selectedTable.indexes.map((index) => (
                    <div
                      key={index.name}
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
                        alignItems: 'center',
                        marginBottom: 'var(--space-1)'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: 'rgb(var(--foreground-rgb))',
                          fontFamily: 'monospace'
                        }}>
                          {index.name}
                        </div>
                        {index.unique && (
                          <div style={{
                            fontSize: '11px',
                            color: 'rgb(var(--primary-rgb))',
                            backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                            padding: 'var(--space-1) var(--space-2)',
                            borderRadius: 'var(--space-1)',
                            textTransform: 'uppercase' as const,
                            letterSpacing: '0.025em'
                          }}>
                            Unique
                          </div>
                        )}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'rgb(var(--secondary-rgb))',
                        fontFamily: 'monospace'
                      }}>
                        {index.columns.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 