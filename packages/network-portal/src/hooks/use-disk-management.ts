import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  DiskUsageMetrics,
  RetentionPolicy,
  CleanupOperation,
  DatabaseStats,
  CleanupRequest,
  CleanupEstimate,
  UseDiskManagementOptions,
  UseDiskManagementReturn,
  DiskUsageResponse,
  RetentionPoliciesResponse,
  CleanupResponse,
  DatabaseStatsResponse
} from '@/types/disk-management';

export function useDiskManagement(options: UseDiskManagementOptions = {}): UseDiskManagementReturn {
  const {
    refreshInterval = 30000, // 30 seconds
    autoRefresh = true
  } = options;
  


  // Data state
  const [diskUsage, setDiskUsage] = useState<DiskUsageMetrics | null>(null);
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([]);
  const [cleanupHistory, setCleanupHistory] = useState<CleanupOperation[]>([]);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [isLoadingCleanup, setIsLoadingCleanup] = useState(false);
  const [isLoadingDatabase, setIsLoadingDatabase] = useState(false);

  // Error states
  const [error, setError] = useState<string | null>(null);
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);

  // Refs for cleanup
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Fetch disk usage metrics
  const refreshDiskUsage = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get('/api/admin/disk/usage');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch disk usage');
      }

      const data: DiskUsageMetrics = await response.json();
      
      if (mountedRef.current) {
        setDiskUsage(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error fetching disk usage:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch retention policies
  const refreshPolicies = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      setIsLoadingPolicies(true);
      setPoliciesError(null);
      
      const response = await apiClient.get('/api/admin/disk/retention-policies');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || 'Failed to fetch retention policies');
      }

      const data = await response.json();
      
      if (mountedRef.current) {
        // Ensure we always set an array, even if API returns unexpected data
        const policies = Array.isArray(data?.policies) ? data.policies : 
                        Array.isArray(data) ? data : [];
        setRetentionPolicies(policies);
      }
    } catch (err) {
      if (mountedRef.current) {
        setPoliciesError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error fetching retention policies:', err);
        // Set empty array on error to prevent undefined issues
        setRetentionPolicies([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingPolicies(false);
      }
    }
  }, []);

  // Update retention policy
  const updateRetentionPolicy = useCallback(async (dataType: string, policy: Partial<RetentionPolicy>) => {
    if (!mountedRef.current) return;
    
    try {
      setPoliciesError(null);

      const response = await apiClient.put(`/api/admin/disk/retention-policies/${dataType}`, policy);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update retention policy');
      }

      // Refresh policies after update
      await refreshPolicies();
    } catch (err) {
      if (mountedRef.current) {
        setPoliciesError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error updating retention policy:', err);
        throw err; // Re-throw to allow component to handle
      }
    }
  }, [refreshPolicies]);

  // Run cleanup operation
  const runCleanup = useCallback(async (request: CleanupRequest): Promise<CleanupOperation> => {
    if (!mountedRef.current) throw new Error('Component unmounted');
    
    try {
      setCleanupError(null);

      const response = await apiClient.post('/api/admin/disk/cleanup', request);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run cleanup');
      }

      const operation: CleanupOperation = await response.json();
      
      // Refresh data after cleanup
      await Promise.all([
        refreshDiskUsage(),
        refreshPolicies()
      ]);

      return operation;
    } catch (err) {
      if (mountedRef.current) {
        setCleanupError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error running cleanup:', err);
      }
      throw err;
    }
  }, [refreshDiskUsage, refreshPolicies]);

  // Estimate cleanup impact
  const estimateCleanup = useCallback(async (dataTypes: string[]): Promise<CleanupEstimate[]> => {
    if (!mountedRef.current) throw new Error('Component unmounted');
    
    try {
      setCleanupError(null);

      const queryParams = new URLSearchParams();
      dataTypes.forEach(type => queryParams.append('dataTypes', type));

      const response = await apiClient.get(`/api/admin/disk/cleanup/estimate?${queryParams.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to estimate cleanup');
      }

      const estimates: CleanupEstimate[] = await response.json();
      return estimates;
    } catch (err) {
      if (mountedRef.current) {
        setCleanupError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error estimating cleanup:', err);
      }
      throw err;
    }
  }, []);

  // Fetch database statistics
  const refreshDatabase = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      setIsLoadingDatabase(true);
      setDatabaseError(null);

      const response = await apiClient.get('/api/admin/database/statistics');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        throw new Error(errorData.error || 'Failed to fetch database statistics');
      }

      const data = await response.json();
      
      if (mountedRef.current) {
        // The API returns { statistics: DatabaseStats }, so extract the statistics
        const stats = data.statistics || data;
        setDatabaseStats(stats);
      }
    } catch (err) {
      if (mountedRef.current) {
        setDatabaseError(err instanceof Error ? err.message : 'Unknown error occurred');
        console.error('Error fetching database statistics:', err);
        // Set null on error instead of empty object
        setDatabaseStats(null);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingDatabase(false);
      }
    }
  }, []);

  // Initial data load
  useEffect(() => {
    let isMounted = true;
    
    const loadInitialData = async () => {
      if (!isMounted) return;
      
      // Load policies first since that's what we're debugging
      await refreshPolicies();
      
      if (!isMounted) return;
      
      // Then load other data
      await Promise.all([
        refreshDiskUsage(),
        refreshDatabase()
      ]);
    };

    loadInitialData();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - run only once on mount

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    refreshIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        refreshDiskUsage();
        refreshDatabase();
      }
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval]); // Only depend on primitive values

  return {
    // Data
    diskUsage,
    retentionPolicies,
    cleanupHistory,
    databaseStats,
    
    // Loading states
    isLoading,
    isLoadingPolicies,
    isLoadingCleanup,
    isLoadingDatabase,
    
    // Error states
    error,
    policiesError,
    cleanupError,
    databaseError,
    
    // Actions
    refreshDiskUsage,
    refreshPolicies,
    updateRetentionPolicy,
    runCleanup,
    estimateCleanup,
    refreshDatabase
  };
}

// Default retention configuration
export const DEFAULT_RETENTION_CONFIG = {
  system_metrics: {
    dataType: 'system_metrics',
    maxAgeDays: 30,
    maxRecords: 1000000,
    compressionEnabled: true,
    archivalEnabled: false,
    cleanupFrequency: 'daily' as const,
    isEnabled: true,
    description: 'System performance metrics (CPU, memory, storage)',
    category: 'monitoring'
  },
  interface_metrics: {
    dataType: 'interface_metrics',
    maxAgeDays: 30,
    maxRecords: 2000000,
    compressionEnabled: true,
    archivalEnabled: false,
    cleanupFrequency: 'daily' as const,
    isEnabled: true,
    description: 'Network interface traffic and error metrics',
    category: 'monitoring'
  },
  terminal_sessions: {
    dataType: 'terminal_sessions',
    maxAgeDays: 90,
    maxRecords: 10000,
    compressionEnabled: false,
    archivalEnabled: true,
    cleanupFrequency: 'weekly' as const,
    isEnabled: true,
    description: 'Terminal session records and metadata',
    category: 'audit'
  },
  terminal_logs: {
    dataType: 'terminal_logs',
    maxAgeDays: 30,
    maxRecords: 100000,
    compressionEnabled: true,
    archivalEnabled: true,
    cleanupFrequency: 'daily' as const,
    isEnabled: true,
    description: 'Terminal command logs and outputs',
    category: 'audit'
  },
  connection_tracking: {
    dataType: 'connection_tracking',
    maxAgeDays: 7,
    maxRecords: 500000,
    compressionEnabled: true,
    archivalEnabled: false,
    cleanupFrequency: 'daily' as const,
    isEnabled: true,
    description: 'Network connection tracking data',
    category: 'security'
  },
  user_audit: {
    dataType: 'user_audit',
    maxAgeDays: 365,
    maxRecords: 50000,
    compressionEnabled: false,
    archivalEnabled: true,
    cleanupFrequency: 'monthly' as const,
    isEnabled: true,
    description: 'User management and authentication audit logs',
    category: 'audit'
  },
  alerts: {
    dataType: 'alerts',
    maxAgeDays: 90,
    maxRecords: 20000,
    compressionEnabled: false,
    archivalEnabled: true,
    cleanupFrequency: 'weekly' as const,
    isEnabled: true,
    description: 'System alerts and notifications',
    category: 'monitoring'
  },
  backups: {
    dataType: 'backups',
    maxAgeDays: 180,
    maxRecords: 1000,
    compressionEnabled: false,
    archivalEnabled: true,
    cleanupFrequency: 'monthly' as const,
    isEnabled: true,
    description: 'Configuration backups and restore points',
    category: 'backup'
  }
} as const;

// Utility functions
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num);
};

export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
};

export const getRetentionPolicyColor = (dataType: string): string => {
  const colors: Record<string, string> = {
    system_metrics: 'rgb(var(--primary-rgb))',
    interface_metrics: 'rgb(var(--success-rgb))',
    terminal_sessions: 'rgb(var(--warning-rgb))',
    terminal_logs: 'rgb(var(--warning-rgb))',
    connection_tracking: 'rgb(var(--error-rgb))',
    user_audit: 'rgb(var(--primary-rgb))',
    alerts: 'rgb(var(--warning-rgb))',
    backups: 'rgb(var(--success-rgb))'
  };
  return colors[dataType] || 'rgb(var(--text-secondary))';
}; 