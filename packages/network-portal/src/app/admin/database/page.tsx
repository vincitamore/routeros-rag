'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { DataTable } from '@/components/ui/DataTable';
import { useDiskManagement } from '@/hooks/use-disk-management';

interface DatabaseTable {
  name: string;
  type: string;
  recordCount: number;
  sizeBytes: number;
  lastModified: string;
}

type TabType = 'overview' | 'tables' | 'query' | 'maintenance';

// Mock data for tables when backend is not available
const MOCK_TABLES: DatabaseTable[] = [
  {
    name: 'devices',
    type: 'table',
    recordCount: 45,
    sizeBytes: 2048000,
    lastModified: new Date().toISOString()
  },
  {
    name: 'system_metrics',
    type: 'table',
    recordCount: 150000,
    sizeBytes: 45000000,
    lastModified: new Date().toISOString()
  },
  {
    name: 'interface_metrics',
    type: 'table',
    recordCount: 250000,
    sizeBytes: 78000000,
    lastModified: new Date().toISOString()
  },
  {
    name: 'users',
    type: 'table',
    recordCount: 12,
    sizeBytes: 4096,
    lastModified: new Date().toISOString()
  },
  {
    name: 'user_sessions',
    type: 'table',
    recordCount: 567,
    sizeBytes: 125000,
    lastModified: new Date().toISOString()
  },
  {
    name: 'data_retention_policies',
    type: 'table',
    recordCount: 8,
    sizeBytes: 2048,
    lastModified: new Date().toISOString()
  },
  {
    name: 'disk_usage_history',
    type: 'table',
    recordCount: 720,
    sizeBytes: 156000,
    lastModified: new Date().toISOString()
  },
  {
    name: 'data_cleanup_logs',
    type: 'table',
    recordCount: 234,
    sizeBytes: 67000,
    lastModified: new Date().toISOString()
  }
];

export default function DatabaseAdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [tables, setTables] = useState<DatabaseTable[]>(MOCK_TABLES);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);

  // Use the disk management hook for database stats
  const {
    databaseStats,
    isLoadingDatabase,
    databaseError,
    refreshDatabase
  } = useDiskManagement();

  useEffect(() => {
    // Try to fetch real table data, fall back to mock data
    async function fetchTableData() {
      try {
        setIsLoadingTables(true);
        setTablesError(null);
        
        const response = await fetch('/api/admin/database/tables');
        
        if (response.ok) {
          const data = await response.json();
          
          // The backend returns { tables: [...] }, so extract the tables array
          if (data.tables && Array.isArray(data.tables)) {
            // Map backend table format to frontend format
            const mappedTables = data.tables.map((table: any) => ({
              name: table.name,
              type: table.type || 'table',
              recordCount: table.recordCount || 0,
              sizeBytes: table.sizeBytes || 0,
              lastModified: table.lastModified || new Date().toISOString()
            }));
            setTables(mappedTables);
          } else if (Array.isArray(data)) {
            // Handle case where API returns array directly
            setTables(data);
          } else {
            console.warn('API returned unexpected data format, using mock tables');
            setTables(MOCK_TABLES);
          }
        } else {
          // API returned error, log it and use mock data
          console.warn(`API returned ${response.status}: ${response.statusText}, using mock data`);
          setTables(MOCK_TABLES);
          setTablesError(`API error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.warn('Database API not available, using mock data:', error);
        setTables(MOCK_TABLES);
        setTablesError('Backend API not available - using mock data');
      } finally {
        setIsLoadingTables(false);
      }
    }

    fetchTableData();
  }, []);

  // Fetch database statistics when component mounts
  useEffect(() => {
    console.log('🔄 Database Admin page mounted - calling refreshDatabase()');
    refreshDatabase();
  }, [refreshDatabase]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  // Calculate stats from tables if database stats not available
  const calculatedStats = {
    totalTables: tables.length,
    totalRecords: tables.reduce((sum, table) => sum + table.recordCount, 0),
    totalSize: tables.reduce((sum, table) => sum + table.sizeBytes, 0),
    lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  };

  const stats = databaseStats || calculatedStats;

  const tabs = [
    { 
      id: 'overview' as TabType, 
      label: 'Overview', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    },
    { 
      id: 'tables' as TabType, 
      label: 'Tables', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 9h6v6h-6z" />
          <path d="M21 9h-6v6h6z" />
          <path d="M9 21h6v-6h-6z" />
          <path d="M21 21h-6v-6h6z" />
          <path d="M3 9h6v6H3z" />
          <path d="M3 21h6v-6H3z" />
          <path d="M9 3h6v6h-6z" />
          <path d="M21 3h-6v6h6z" />
          <path d="M3 3h6v6H3z" />
        </svg>
      )
    },
    { 
      id: 'query' as TabType, 
      label: 'Query Runner', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4,17 10,11 4,5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      )
    },
    { 
      id: 'maintenance' as TabType, 
      label: 'Maintenance', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      )
    }
  ];

  const tableColumns = [
    {
      key: 'name',
      header: 'Table Name',
      sortable: true,
      render: (value: string) => (
        <span style={{ 
          fontFamily: 'monospace', 
          color: 'rgb(var(--primary-rgb))',
          fontWeight: '500'
        }}>
          {value}
        </span>
      )
    },
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      width: '100px',
      render: (value: string) => (
        <span style={{ 
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          padding: '2px 6px',
          backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
          borderRadius: '4px',
          color: 'rgb(var(--primary-rgb))'
        }}>
          {value}
        </span>
      )
    },
    {
      key: 'recordCount',
      header: 'Records',
      sortable: true,
      width: '120px',
      render: (value: number) => formatNumber(value)
    },
    {
      key: 'sizeBytes',
      header: 'Size',
      sortable: true,
      width: '100px',
      render: (value: number) => formatBytes(value)
    },
    {
      key: 'lastModified',
      header: 'Last Modified',
      sortable: true,
      width: '150px',
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];

  const renderOverview = () => (
    <div>
      {/* Database Statistics */}
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
            {stats.totalTables || stats.totalTables === 0 ? stats.totalTables : calculatedStats.totalTables}
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
                         {formatNumber(stats.totalRecords || calculatedStats.totalRecords)}
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
            {formatBytes(stats.totalSize || calculatedStats.totalSize)}
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
            {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString() : 'Never'}
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgb(var(--secondary-rgb))',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.025em'
          }}>
            Last Backup
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {(databaseError || tablesError) && (
        <div style={{
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3)',
          backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
          border: '1px solid rgba(var(--warning-rgb), 0.3)',
          borderRadius: 'var(--space-2)',
          color: 'rgb(var(--warning-rgb))',
          fontSize: '14px'
        }}>
          <strong>Demo Mode:</strong> Using mock database data. Backend services are not yet implemented.
        </div>
      )}

      {/* Recent Activity */}
      <div className="card">
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          margin: '0 0 var(--space-4) 0',
          color: 'rgb(var(--foreground-rgb))'
        }}>
          Recent Activity
        </h3>
        <div style={{ color: 'rgb(var(--secondary-rgb))', fontSize: '14px' }}>
          <p>• Database schema initialized with {tables.length} tables</p>
          <p>• Mock data loaded for development and testing</p>
          <p>• Retention policies configured for data management</p>
          <p>• Ready for backend integration</p>
        </div>
      </div>
    </div>
  );

  const renderTables = () => (
    <div>
      {isLoadingTables ? (
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
      ) : (
                 <DataTable
           data={tables}
           columns={tableColumns}
         />
      )}
    </div>
  );

  const renderQueryRunner = () => (
    <div className="card">
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        margin: '0 0 var(--space-4) 0',
        color: 'rgb(var(--foreground-rgb))'
      }}>
        SQL Query Runner
      </h3>
      <div style={{
        padding: 'var(--space-4)',
        backgroundColor: 'rgba(var(--border-rgb), 0.2)',
        borderRadius: 'var(--space-2)',
        textAlign: 'center' as const,
        color: 'rgb(var(--secondary-rgb))'
      }}>
        <p>Query runner will be implemented in Phase 5.</p>
        <p>This will allow executing custom SQL queries safely.</p>
      </div>
    </div>
  );

  const renderMaintenance = () => (
    <div className="card">
      <h3 style={{
        fontSize: '18px',
        fontWeight: '600',
        margin: '0 0 var(--space-4) 0',
        color: 'rgb(var(--foreground-rgb))'
      }}>
        Database Maintenance
      </h3>
      <div style={{
        padding: 'var(--space-4)',
        backgroundColor: 'rgba(var(--border-rgb), 0.2)',
        borderRadius: 'var(--space-2)',
        textAlign: 'center' as const,
        color: 'rgb(var(--secondary-rgb))'
      }}>
        <p>Maintenance tools will be implemented in Phase 5.</p>
        <p>This will include VACUUM, ANALYZE, and integrity checks.</p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'tables':
        return renderTables();
      case 'query':
        return renderQueryRunner();
      case 'maintenance':
        return renderMaintenance();
      default:
        return renderOverview();
    }
  };

  return (
    <AppLayout>
      <div style={{ padding: 'var(--space-6)' }}>
        {/* Header */}
        <div style={{
          marginBottom: 'var(--space-6)',
          padding: 'var(--space-4)',
          backgroundColor: 'rgba(var(--border-rgb), 0.2)',
          borderRadius: 'var(--space-3)',
          border: '1px solid rgba(var(--border-rgb), 0.3)'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            margin: '0 0 var(--space-2) 0',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            Database Administration
          </h1>
          <p style={{
            fontSize: '14px',
            color: 'rgb(var(--secondary-rgb))',
            margin: 0,
            lineHeight: 1.5
          }}>
            View and manage database tables, run queries, and perform maintenance operations.
            Monitor database health and optimize performance.
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: 'var(--space-1)',
          marginBottom: 'var(--space-6)',
          borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: activeTab === tab.id 
                  ? 'rgba(var(--primary-rgb), 0.1)' 
                  : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id 
                  ? '2px solid rgb(var(--primary-rgb))' 
                  : '2px solid transparent',
                color: activeTab === tab.id 
                  ? 'rgb(var(--primary-rgb))' 
                  : 'rgb(var(--secondary-rgb))',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>
    </AppLayout>
  );
} 