export interface DiskUsageMetrics {
  totalDatabaseSize: number;
  walFileSize: number;
  shmFileSize: number;
  tableUsages: TableUsage[];
  growthRates: GrowthRate[];
  predictions: StoragePrediction[];
  lastCleanup: Date | null;
  freeSpace: number;
  totalSpace: number;
}

export interface TableUsage {
  tableName: string;
  recordCount: number;
  sizeBytes: number;
  averageRowSize: number;
  indexSizeBytes: number;
  lastUpdated: Date;
  growthRate: number; // bytes per day
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
  confidenceLevel: number; // 0-100
  projectedFullDate: Date | null;
  recommendedAction: string;
}

export interface RetentionPolicy {
  id: number;
  dataType: string;
  maxAgeDays: number;
  maxRecords?: number;
  compressionEnabled: boolean;
  archivalEnabled: boolean;
  cleanupFrequency: 'daily' | 'weekly' | 'monthly';
  isEnabled: boolean;
  description: string;
  category: string;
  created_at: Date;
  updated_at: Date;
}

export interface CleanupOperation {
  id: number;
  operationType: 'manual' | 'scheduled' | 'emergency';
  dataType: string;
  recordsAffected: number;
  bytesFreed: number;
  durationMs: number;
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  startedAt: Date;
  completedAt: Date;
}

export interface CleanupEstimate {
  dataType: string;
  estimatedRecords: number;
  estimatedBytes: number;
  oldestRecord: Date;
  newestRecord: Date;
  impactAnalysis: {
    performanceImpact: 'low' | 'medium' | 'high';
    dataIntegrityRisk: 'low' | 'medium' | 'high';
    recommendedTime: string;
  };
}

export interface DatabaseStatistics {
  totalTables: number;
  totalRecords: number;
  totalIndexes: number;
  totalSize: number;
  fragmentationLevel: number;
  lastVacuum: Date | null;
  lastAnalyze: Date | null;
  walMode: boolean;
  pageSize: number;
  cacheSize: number;
}

export interface DatabaseTable {
  name: string;
  type: 'table' | 'view' | 'index';
  recordCount: number;
  schema: TableSchema[];
  indexes: TableIndex[];
  sizeBytes: number;
  lastModified: Date;
}

export interface TableSchema {
  columnName: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: {
    referencedTable: string;
    referencedColumn: string;
  };
  defaultValue?: string;
}

export interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
  partial: boolean;
  sizeBytes: number;
}

export interface DataExport {
  id: number;
  tableName: string;
  format: 'csv' | 'json' | 'sql' | 'xlsx';
  recordCount: number;
  fileSizeBytes: number;
  exportedAt: Date;
  downloadUrl: string;
  expiresAt: Date;
}

// Disk management settings
export interface DiskManagementSettings {
  autoCleanupEnabled: boolean;
  cleanupSchedule: string; // cron expression
  alertThresholds: {
    diskUsageWarning: number; // percentage
    diskUsageCritical: number; // percentage
    growthRateWarning: number; // bytes per day
  };
  retentionDefaults: {
    systemMetrics: number; // days
    interfaceMetrics: number; // days
    terminalLogs: number; // days
    auditLogs: number; // days
  };
  compressionSettings: {
    enableCompression: boolean;
    compressionAge: number; // days
    compressionRatio: number; // target ratio
  };
  backupSettings: {
    enableAutoBackup: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    backupRetention: number; // days
  };
}

// API Request/Response types
export interface CreateRetentionPolicyRequest {
  dataType: string;
  maxAgeDays: number;
  maxRecords?: number;
  compressionEnabled: boolean;
  archivalEnabled: boolean;
  cleanupFrequency: 'daily' | 'weekly' | 'monthly';
  isEnabled: boolean;
  description: string;
  category: string;
}

export interface UpdateRetentionPolicyRequest extends Partial<CreateRetentionPolicyRequest> {
  id: number;
}

export interface CleanupRequest {
  dataType: string;
  force?: boolean;
  estimateOnly?: boolean;
}

export interface VacuumRequest {
  analyze?: boolean;
  incremental?: boolean;
}

export interface DatabaseQueryRequest {
  tableName: string;
  query?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

export interface DatabaseQueryResponse {
  data: Record<string, any>[];
  totalCount: number;
  hasMore: boolean;
  executionTime: number;
  columns: string[];
}

export interface UpdateRecordRequest {
  tableName: string;
  id: string | number;
  data: Record<string, any>;
}

export interface ExportDataRequest {
  tableName: string;
  format: 'csv' | 'json' | 'sql' | 'xlsx';
  filters?: Record<string, any>;
  columns?: string[];
  limit?: number;
} 