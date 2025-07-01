import { promises as fs } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import {
  DiskUsageMetrics,
  TableUsage,
  GrowthRate,
  StoragePrediction,
  RetentionPolicy,
  CleanupOperation,
  CleanupEstimate,
  DatabaseStatistics,
  DiskManagementSettings
} from '../types/disk-management.js';

export class DiskManagementService {
  private db: Database.Database;
  private dbPath: string;

  constructor(database: Database.Database, databasePath: string) {
    this.db = database;
    this.dbPath = databasePath;
  }

  /**
   * Get comprehensive disk usage metrics
   */
  async getDiskUsageMetrics(): Promise<DiskUsageMetrics> {
    const [
      totalDatabaseSize,
      walFileSize,
      shmFileSize,
      tableUsages,
      growthRates,
      predictions,
      lastCleanup,
      freeSpace,
      totalSpace
    ] = await Promise.all([
      this.getDatabaseSize(),
      this.getWalFileSize(),
      this.getShmFileSize(),
      this.getTableUsages(),
      this.getGrowthRates(),
      this.getStoragePredictions(),
      this.getLastCleanupDate(),
      this.getFreeSpace(),
      this.getTotalSpace()
    ]);

    return {
      totalDatabaseSize,
      walFileSize,
      shmFileSize,
      tableUsages,
      growthRates,
      predictions,
      lastCleanup,
      freeSpace,
      totalSpace
    };
  }

  /**
   * Get database file size in bytes
   */
  private async getDatabaseSize(): Promise<number> {
    try {
      const stats = await fs.stat(this.dbPath);
      return stats.size;
    } catch (error) {
      console.error('Error getting database size:', error);
      return 0;
    }
  }

  /**
   * Get WAL (Write-Ahead Logging) file size
   */
  private async getWalFileSize(): Promise<number> {
    try {
      const walPath = `${this.dbPath}-wal`;
      const stats = await fs.stat(walPath);
      return stats.size;
    } catch (error) {
      return 0; // WAL file may not exist
    }
  }

  /**
   * Get SHM (Shared Memory) file size
   */
  private async getShmFileSize(): Promise<number> {
    try {
      const shmPath = `${this.dbPath}-shm`;
      const stats = await fs.stat(shmPath);
      return stats.size;
    } catch (error) {
      return 0; // SHM file may not exist
    }
  }

  /**
   * Analyze table usage and sizes
   */
  private async getTableUsages(): Promise<TableUsage[]> {
    const tableInfoQuery = `
      SELECT 
        name as tableName,
        sql
      FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;

    const tables = this.db.prepare(tableInfoQuery).all() as Array<{
      tableName: string;
      sql: string;
    }>;

    const tableUsages: TableUsage[] = [];

    for (const table of tables) {
      try {
        // Get record count
        const countQuery = `SELECT COUNT(*) as count FROM "${table.tableName}"`;
        const countResult = this.db.prepare(countQuery).get() as { count: number };
        const recordCount = countResult.count;

        // Get table size (approximation)
        const sizeQuery = `
          SELECT 
            SUM(pgsize) as totalSize,
            COUNT(*) as pageCount
          FROM dbstat 
          WHERE name = ?
        `;
        const sizeResult = this.db.prepare(sizeQuery).get(table.tableName) as {
          totalSize: number | null;
          pageCount: number | null;
        };

        const sizeBytes = sizeResult?.totalSize || 0;
        const averageRowSize = recordCount > 0 ? sizeBytes / recordCount : 0;

        // Get index size
        const indexQuery = `
          SELECT SUM(pgsize) as indexSize
          FROM dbstat 
          WHERE name IN (
            SELECT name FROM sqlite_master 
            WHERE type = 'index' 
            AND tbl_name = ?
            AND name NOT LIKE 'sqlite_%'
          )
        `;
        const indexResult = this.db.prepare(indexQuery).get(table.tableName) as {
          indexSize: number | null;
        };
        const indexSizeBytes = indexResult?.indexSize || 0;

        // Calculate growth rate (simplified - using recent data if available)
        const growthRate = await this.calculateTableGrowthRate(table.tableName);

        tableUsages.push({
          tableName: table.tableName,
          recordCount,
          sizeBytes,
          averageRowSize,
          indexSizeBytes,
          lastUpdated: new Date(),
          growthRate
        });
      } catch (error) {
        console.error(`Error analyzing table ${table.tableName}:`, error);
        // Continue with other tables
      }
    }

    return tableUsages;
  }

  /**
   * Calculate growth rates for tables
   */
  private async getGrowthRates(): Promise<GrowthRate[]> {
    const tables = ['system_metrics', 'interface_metrics', 'terminal_session_logs', 'connection_tracking'];
    const growthRates: GrowthRate[] = [];

    for (const tableName of tables) {
      try {
        const dailyGrowth = await this.calculateTableGrowthRate(tableName, 1);
        const weeklyGrowth = await this.calculateTableGrowthRate(tableName, 7);
        const monthlyGrowth = await this.calculateTableGrowthRate(tableName, 30);

        let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (dailyGrowth > weeklyGrowth / 7) trend = 'increasing';
        else if (dailyGrowth < weeklyGrowth / 7) trend = 'decreasing';

        growthRates.push({
          tableName,
          dailyGrowthBytes: dailyGrowth,
          weeklyGrowthBytes: weeklyGrowth,
          monthlyGrowthBytes: monthlyGrowth,
          trend
        });
      } catch (error) {
        console.error(`Error calculating growth rate for ${tableName}:`, error);
      }
    }

    return growthRates;
  }

  /**
   * Calculate table growth rate over specified days
   */
  private async calculateTableGrowthRate(tableName: string, days: number = 7): Promise<number> {
    try {
      // Check if table has timestamp column
      const columnsQuery = `PRAGMA table_info("${tableName}")`;
      const columns = this.db.prepare(columnsQuery).all() as Array<{
        name: string;
        type: string;
      }>;

      const timestampColumn = columns.find(col => 
        ['timestamp', 'created_at', 'collected_at'].includes(col.name.toLowerCase())
      );

      if (!timestampColumn) {
        return 0; // No timestamp column, can't calculate growth
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const growthQuery = `
        SELECT COUNT(*) as recentCount
        FROM "${tableName}"
        WHERE "${timestampColumn.name}" >= ?
      `;

      const result = this.db.prepare(growthQuery).get(startDate.toISOString()) as {
        recentCount: number;
      };

      // Estimate bytes per record (simplified)
      const avgRowSizeQuery = `
        SELECT 
          SUM(pgsize) as totalSize,
          COUNT(*) as totalRecords
        FROM dbstat 
        WHERE name = ?
      `;
      const sizeResult = this.db.prepare(avgRowSizeQuery).get(tableName) as {
        totalSize: number | null;
        totalRecords: number | null;
      };

      const avgRowSize = (sizeResult?.totalSize && sizeResult?.totalRecords) 
        ? sizeResult.totalSize / sizeResult.totalRecords 
        : 100; // Default estimate

      return (result.recentCount * avgRowSize) / days;
    } catch (error) {
      console.error(`Error calculating growth rate for ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Generate storage predictions
   */
  private async getStoragePredictions(): Promise<StoragePrediction[]> {
    const growthRates = await this.getGrowthRates();
    const currentSize = await this.getDatabaseSize();
    const totalSpace = await this.getTotalSpace();

    const predictions: StoragePrediction[] = [];
    const timeframes: Array<{ timeframe: '30d' | '60d' | '90d' | '180d' | '1y', days: number }> = [
      { timeframe: '30d', days: 30 },
      { timeframe: '60d', days: 60 },
      { timeframe: '90d', days: 90 },
      { timeframe: '180d', days: 180 },
      { timeframe: '1y', days: 365 }
    ];

    // Calculate total daily growth
    const totalDailyGrowth = growthRates.reduce((sum, rate) => sum + rate.dailyGrowthBytes, 0);

    for (const { timeframe, days } of timeframes) {
      const predictedGrowth = totalDailyGrowth * days;
      const predictedSizeBytes = currentSize + predictedGrowth;
      
      // Calculate confidence based on data consistency
      const confidenceLevel = this.calculatePredictionConfidence(growthRates, days);
      
      // Check if we'll run out of space
      const projectedFullDate = totalSpace > 0 && totalDailyGrowth > 0
        ? new Date(Date.now() + ((totalSpace - currentSize) / totalDailyGrowth) * 24 * 60 * 60 * 1000)
        : null;

      let recommendedAction = 'Monitor usage';
      if (predictedSizeBytes > totalSpace * 0.9) {
        recommendedAction = 'Critical: Implement aggressive cleanup policies';
      } else if (predictedSizeBytes > totalSpace * 0.8) {
        recommendedAction = 'Warning: Review and update retention policies';
      } else if (predictedSizeBytes > totalSpace * 0.7) {
        recommendedAction = 'Consider implementing cleanup policies';
      }

      predictions.push({
        timeframe,
        predictedSizeBytes,
        confidenceLevel,
        projectedFullDate,
        recommendedAction
      });
    }

    return predictions;
  }

  /**
   * Calculate prediction confidence based on growth rate consistency
   */
  private calculatePredictionConfidence(growthRates: GrowthRate[], days: number): number {
    if (growthRates.length === 0) return 0;

    // Simple confidence calculation based on trend consistency
    const stableTrends = growthRates.filter(rate => rate.trend === 'stable').length;
    const baseConfidence = (stableTrends / growthRates.length) * 100;
    
    // Reduce confidence for longer predictions
    const timeDecay = Math.max(0.3, 1 - (days / 365) * 0.7);
    
    return Math.round(baseConfidence * timeDecay);
  }

  /**
   * Get last cleanup date
   */
  private async getLastCleanupDate(): Promise<Date | null> {
    try {
      const query = `
        SELECT MAX(completed_at) as lastCleanup
        FROM data_cleanup_logs
        WHERE status = 'success'
      `;
      const result = this.db.prepare(query).get() as { lastCleanup: string | null };
      return result.lastCleanup ? new Date(result.lastCleanup) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get free disk space
   */
  private async getFreeSpace(): Promise<number> {
    try {
      // For SQLite database, calculate available space based on database size and reasonable limits
      const dbSize = await this.getDatabaseSize();
      const walSize = await this.getWalFileSize();
      const shmSize = await this.getShmFileSize();
      const totalUsed = dbSize + walSize + shmSize;
      
      // Assume a reasonable total capacity (e.g., 10GB for a typical deployment)
      // In production, you'd use statvfs or similar to get actual disk space
      const estimatedCapacity = 10 * 1024 * 1024 * 1024; // 10GB
      
      // Calculate free space
      const freeSpace = Math.max(0, estimatedCapacity - totalUsed);
      
      return freeSpace;
    } catch (error) {
      console.error('Error calculating free space:', error);
      // Return a reasonable default if calculation fails
      return 8 * 1024 * 1024 * 1024; // 8GB default
    }
  }

  /**
   * Get total disk space
   */
  private async getTotalSpace(): Promise<number> {
    // Return the same capacity used in getFreeSpace calculation
    // In production, this would query actual filesystem capacity
    return 10 * 1024 * 1024 * 1024; // 10GB
  }

  /**
   * Get retention policies
   */
  async getRetentionPolicies(): Promise<RetentionPolicy[]> {
    const query = `
      SELECT * FROM data_retention_policies
      ORDER BY data_type
    `;
    
    try {
      const policies = this.db.prepare(query).all() as RetentionPolicy[];
      return policies.map(policy => ({
        ...policy,
        created_at: new Date(policy.created_at),
        updated_at: new Date(policy.updated_at)
      }));
    } catch (error) {
      console.error('Error fetching retention policies:', error);
      return [];
    }
  }

  /**
   * Create or update retention policy
   */
  async upsertRetentionPolicy(policy: Omit<RetentionPolicy, 'id' | 'created_at' | 'updated_at'>): Promise<RetentionPolicy> {
    const query = `
      INSERT INTO data_retention_policies (
        data_type, max_age_days, max_records, compression_enabled,
        archival_enabled, cleanup_frequency, is_enabled, description, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(data_type) DO UPDATE SET
        max_age_days = excluded.max_age_days,
        max_records = excluded.max_records,
        compression_enabled = excluded.compression_enabled,
        archival_enabled = excluded.archival_enabled,
        cleanup_frequency = excluded.cleanup_frequency,
        is_enabled = excluded.is_enabled,
        description = excluded.description,
        category = excluded.category,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = this.db.prepare(query).get(
      policy.dataType,
      policy.maxAgeDays,
      policy.maxRecords || null,
      policy.compressionEnabled ? 1 : 0,
      policy.archivalEnabled ? 1 : 0,
      policy.cleanupFrequency,
      policy.isEnabled ? 1 : 0,
      policy.description,
      policy.category
    ) as RetentionPolicy;

    return {
      ...result,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at)
    };
  }

  /**
   * Estimate cleanup impact
   */
  async estimateCleanup(dataType: string): Promise<CleanupEstimate> {
    const policy = await this.getRetentionPolicyByType(dataType);
    if (!policy) {
      throw new Error(`No retention policy found for data type: ${dataType}`);
    }

    const tableName = this.getTableNameForDataType(dataType);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.maxAgeDays);

    // Find timestamp column
    const timestampColumn = await this.getTimestampColumn(tableName);
    if (!timestampColumn) {
      throw new Error(`No timestamp column found for table: ${tableName}`);
    }

    const estimateQuery = `
      SELECT 
        COUNT(*) as estimatedRecords,
        MIN("${timestampColumn}") as oldestRecord,
        MAX("${timestampColumn}") as newestRecord
      FROM "${tableName}"
      WHERE "${timestampColumn}" < ?
    `;

    const result = this.db.prepare(estimateQuery).get(cutoffDate.toISOString()) as {
      estimatedRecords: number;
      oldestRecord: string;
      newestRecord: string;
    };

    // Estimate bytes (simplified)
    const avgRowSize = await this.getAverageRowSize(tableName);
    const estimatedBytes = result.estimatedRecords * avgRowSize;

    return {
      dataType,
      estimatedRecords: result.estimatedRecords,
      estimatedBytes,
      oldestRecord: new Date(result.oldestRecord),
      newestRecord: new Date(result.newestRecord),
      impactAnalysis: {
        performanceImpact: result.estimatedRecords > 100000 ? 'high' : result.estimatedRecords > 10000 ? 'medium' : 'low',
        dataIntegrityRisk: 'low', // Simplified
        recommendedTime: 'off-peak hours'
      }
    };
  }

  /**
   * Perform cleanup operation
   */
  async performCleanup(dataType: string, force: boolean = false): Promise<CleanupOperation> {
    const startTime = Date.now();
    const operationId = Date.now();

    try {
      const policy = await this.getRetentionPolicyByType(dataType);
      if (!policy) {
        throw new Error(`No retention policy found for data type: ${dataType}`);
      }

      if (!policy.isEnabled && !force) {
        throw new Error(`Retention policy for ${dataType} is disabled`);
      }

      const tableName = this.getTableNameForDataType(dataType);
      const timestampColumn = await this.getTimestampColumn(tableName);
      
      if (!timestampColumn) {
        throw new Error(`No timestamp column found for table: ${tableName}`);
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.maxAgeDays);

      // Count records to be deleted
      const countQuery = `
        SELECT COUNT(*) as count
        FROM "${tableName}"
        WHERE "${timestampColumn}" < ?
      `;
      const countResult = this.db.prepare(countQuery).get(cutoffDate.toISOString()) as { count: number };

      // Perform deletion
      const deleteQuery = `
        DELETE FROM "${tableName}"
        WHERE "${timestampColumn}" < ?
      `;
      const deleteResult = this.db.prepare(deleteQuery).run(cutoffDate.toISOString());

      const durationMs = Date.now() - startTime;
      const avgRowSize = await this.getAverageRowSize(tableName);
      const bytesFreed = deleteResult.changes * avgRowSize;

      // Log the operation
      const logQuery = `
        INSERT INTO data_cleanup_logs (
          operation_type, data_type, records_affected, bytes_freed,
          duration_ms, status, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.prepare(logQuery).run(
        'manual',
        dataType,
        deleteResult.changes,
        bytesFreed,
        durationMs,
        'success',
        new Date(startTime).toISOString(),
        new Date().toISOString()
      );

      return {
        id: operationId,
        operationType: 'manual',
        dataType,
        recordsAffected: deleteResult.changes,
        bytesFreed,
        durationMs,
        status: 'success',
        startedAt: new Date(startTime),
        completedAt: new Date()
      };

    } catch (error) {
      const durationMs = Date.now() - startTime;
      
      // Log the failed operation
      const logQuery = `
        INSERT INTO data_cleanup_logs (
          operation_type, data_type, records_affected, bytes_freed,
          duration_ms, status, error_message, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.prepare(logQuery).run(
        'manual',
        dataType,
        0,
        0,
        durationMs,
        'failed',
        error instanceof Error ? error.message : 'Unknown error',
        new Date(startTime).toISOString(),
        new Date().toISOString()
      );

      throw error;
    }
  }

  /**
   * Vacuum database
   */
  async vacuumDatabase(analyze: boolean = true): Promise<{ duration: number; sizeBefore: number; sizeAfter: number }> {
    const sizeBefore = await this.getDatabaseSize();
    const startTime = Date.now();

    try {
      // Perform VACUUM
      this.db.exec('VACUUM');
      
      if (analyze) {
        this.db.exec('ANALYZE');
      }

      const duration = Date.now() - startTime;
      const sizeAfter = await this.getDatabaseSize();

      return {
        duration,
        sizeBefore,
        sizeAfter
      };
    } catch (error) {
      console.error('Error during vacuum operation:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  private async getRetentionPolicyByType(dataType: string): Promise<RetentionPolicy | null> {
    const query = `SELECT * FROM data_retention_policies WHERE data_type = ?`;
    const result = this.db.prepare(query).get(dataType) as RetentionPolicy | undefined;
    
    if (!result) return null;
    
    return {
      ...result,
      created_at: new Date(result.created_at),
      updated_at: new Date(result.updated_at)
    };
  }

  private getTableNameForDataType(dataType: string): string {
    const mapping: Record<string, string> = {
      'system_metrics': 'system_metrics',
      'interface_metrics': 'interface_metrics',
      'terminal_logs': 'terminal_session_logs',
      'connection_tracking': 'connection_tracking',
      'alerts': 'alerts',
      'user_audit': 'user_management_audit',
      'login_attempts': 'login_attempts'
    };

    return mapping[dataType] || dataType;
  }

  private async getTimestampColumn(tableName: string): Promise<string | null> {
    const columnsQuery = `PRAGMA table_info("${tableName}")`;
    const columns = this.db.prepare(columnsQuery).all() as Array<{
      name: string;
      type: string;
    }>;

    const timestampColumn = columns.find(col => 
      ['timestamp', 'created_at', 'collected_at'].includes(col.name.toLowerCase())
    );

    return timestampColumn?.name || null;
  }

  private async getAverageRowSize(tableName: string): Promise<number> {
    try {
      const query = `
        SELECT 
          SUM(pgsize) as totalSize,
          COUNT(*) as totalRecords
        FROM dbstat 
        WHERE name = ?
      `;
      const result = this.db.prepare(query).get(tableName) as {
        totalSize: number | null;
        totalRecords: number | null;
      };

      return (result?.totalSize && result?.totalRecords) 
        ? result.totalSize / result.totalRecords 
        : 100; // Default estimate
    } catch (error) {
      return 100; // Default estimate
    }
  }

  /**
   * Record current disk usage to history
   */
  async recordDiskUsageHistory(): Promise<void> {
    try {
      const totalSize = await this.getDatabaseSize();
      const walSize = await this.getWalFileSize();
      const shmSize = await this.getShmFileSize();
      
      // Get table count
      const tableCountQuery = `
        SELECT COUNT(*) as count 
        FROM sqlite_master 
        WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%'
      `;
      const tableCountResult = this.db.prepare(tableCountQuery).get() as { count: number };
      const tableCount = tableCountResult.count;

      // Get index count
      const indexCountQuery = `
        SELECT COUNT(*) as count 
        FROM sqlite_master 
        WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
      `;
      const indexCountResult = this.db.prepare(indexCountQuery).get() as { count: number };
      const indexCount = indexCountResult.count;

      // Insert into history
      const insertQuery = `
        INSERT INTO disk_usage_history (
          total_size, wal_size, shm_size, table_count, index_count
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.prepare(insertQuery).run(
        totalSize,
        walSize,
        shmSize,
        tableCount,
        indexCount
      );
    } catch (error) {
      console.error('Error recording disk usage history:', error);
    }
  }

  /**
   * Initialize disk usage recording (starts background recording process)
   */
  initializeDiskRecording(): void {
    // Record initial disk usage
    this.recordDiskUsageHistory();
    
    // Set up interval to record disk usage every 5 minutes
    const recordingInterval = 5 * 60 * 1000; // 5 minutes
    setInterval(() => {
      this.recordDiskUsageHistory();
    }, recordingInterval);
    
    console.log('Disk usage recording initialized - recording every 5 minutes');
  }
} 