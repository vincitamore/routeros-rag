// Disk Management Types
export interface DiskUsageMetrics {
  totalDatabaseSize: number;
  walFileSize: number;
  shmFileSize: number;
  freeSpace: number;
  totalSpace: number;
  tableUsages: TableUsage[];
  growthRates: GrowthRate[];
  predictions: StoragePrediction[];
  lastCleanup: string | null;
}

export interface TableUsage {
  tableName: string;
  recordCount: number;
  sizeBytes: number;
  averageRowSize: number;
  indexSizeBytes: number;
  lastUpdated: string;
  growthRate: number;
}

export interface GrowthRate {
  tableName: string;
  dailyGrowthBytes: number;
  weeklyGrowthBytes: number;
  monthlyGrowthBytes: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface StoragePrediction {
  timeframe: '30d' | '60d' | '90d' | '180d' | '1y';
  predictedSizeBytes: number;
  confidenceLevel: number;
  projectedFullDate: string | null;
  recommendedAction: string;
}

// Frontend-specific prediction interfaces
export interface FrontendStoragePrediction {
  days: number;
  predictedSize: number;
  confidence: number;
  category: 'optimistic' | 'realistic' | 'pessimistic';
}

export interface PredictionMetrics {
  currentSize: number;
  dailyGrowthRate: number;
  weeklyGrowthRate: number;
  monthlyGrowthRate: number;
  predictions: FrontendStoragePrediction[];
  recommendations: Array<{
    type: 'cleanup' | 'optimization' | 'capacity';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    expectedSavings?: number;
  }>;
  thresholds: {
    warning: number;
    critical: number;
  };
}

// Retention Policy Types
export interface RetentionPolicy {
  id?: number;
  dataType: string;
  maxAgeDays: number;
  maxRecords?: number;
  compressionEnabled: boolean;
  archivalEnabled: boolean;
  cleanupFrequency: 'daily' | 'weekly' | 'monthly';
  isEnabled: boolean;
  description?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RetentionConfiguration {
  system_metrics: RetentionPolicy;
  interface_metrics: RetentionPolicy;
  terminal_sessions: RetentionPolicy;
  terminal_logs: RetentionPolicy;
  connection_tracking: RetentionPolicy;
  user_audit: RetentionPolicy;
  alerts: RetentionPolicy;
  backups: RetentionPolicy;
}

// Cleanup Operations Types
export interface CleanupOperation {
  id?: number;
  operationType: 'manual' | 'scheduled' | 'emergency';
  dataType: string;
  recordsAffected: number;
  bytesFreed: number;
  durationMs: number;
  status: 'running' | 'completed' | 'failed';
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface CleanupEstimate {
  dataType: string;
  estimatedRecords: number;
  estimatedBytes: number;
  estimatedDuration: number;
  impact: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface CleanupRequest {
  dataTypes: string[];
  dryRun?: boolean;
  force?: boolean;
}

// Database Viewer Types
export interface DatabaseTable {
  name: string;
  type: 'table' | 'view' | 'index';
  recordCount: number;
  sizeBytes: number;
  lastModified: string;
  schema?: TableSchema;
}

export interface TableSchema {
  columns: TableColumn[];
  indexes: TableIndex[];
  constraints: TableConstraint[];
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export interface TableConstraint {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

export interface DatabaseStats {
  totalTables: number;
  totalRecords: number;
  totalIndexes?: number;
  totalSize: number;
  fragmentationLevel?: number;
  lastVacuum?: string | null;
  lastAnalyze?: string | null;
  walMode?: boolean;
  pageSize?: number;
  cacheSize?: number;
  lastBackup?: string;
}

// API Response Types
export interface DiskUsageResponse {
  success: boolean;
  data: DiskUsageMetrics;
  timestamp: string;
}

export interface RetentionPoliciesResponse {
  success: boolean;
  data: { policies: RetentionPolicy[] };
  timestamp: string;
}

export interface CleanupResponse {
  success: boolean;
  data: CleanupOperation;
  timestamp: string;
}

export interface DatabaseTablesResponse {
  success: boolean;
  data: { tables: DatabaseTable[] };
  timestamp: string;
}

export interface DatabaseStatsResponse {
  success: boolean;
  data: DatabaseStats;
  timestamp: string;
}

// Hook Types
export interface UseDiskManagementOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
}

export interface UseDiskManagementReturn {
  // Data
  diskUsage: DiskUsageMetrics | null;
  retentionPolicies: RetentionPolicy[];
  cleanupHistory: CleanupOperation[];
  databaseStats: DatabaseStats | null;
  
  // Loading states
  isLoading: boolean;
  isLoadingPolicies: boolean;
  isLoadingCleanup: boolean;
  isLoadingDatabase: boolean;
  
  // Error states
  error: string | null;
  policiesError: string | null;
  cleanupError: string | null;
  databaseError: string | null;
  
  // Actions
  refreshDiskUsage: () => Promise<void>;
  refreshPolicies: () => Promise<void>;
  updateRetentionPolicy: (dataType: string, policy: Partial<RetentionPolicy>) => Promise<void>;
  runCleanup: (request: CleanupRequest) => Promise<CleanupOperation>;
  estimateCleanup: (dataTypes: string[]) => Promise<CleanupEstimate[]>;
  refreshDatabase: () => Promise<void>;
}

// Chart Data Types
export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface DiskUsageChartData {
  totalSize: ChartDataPoint[];
  walSize: ChartDataPoint[];
  shmSize: ChartDataPoint[];
}

export interface TableBreakdownChartData {
  tableName: string;
  sizeBytes: number;
  recordCount: number;
  percentage: number;
}

export interface GrowthTrendChartData {
  tableName: string;
  data: ChartDataPoint[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface StorageDistributionChartData {
  category: string;
  sizeBytes: number;
  percentage: number;
  color: string;
}

// Utility Types
export type DataCategory = 
  | 'system_metrics'
  | 'interface_metrics' 
  | 'terminal_sessions'
  | 'terminal_logs'
  | 'connection_tracking'
  | 'user_audit'
  | 'alerts'
  | 'backups';

export type CleanupFrequency = 'daily' | 'weekly' | 'monthly';
export type CleanupStatus = 'running' | 'completed' | 'failed';
export type TrendDirection = 'increasing' | 'decreasing' | 'stable';
export type ImpactLevel = 'low' | 'medium' | 'high'; 