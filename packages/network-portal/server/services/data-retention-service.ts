import Database from 'better-sqlite3';
import {
  RetentionPolicy,
  CleanupOperation,
  CleanupEstimate
} from '../types/disk-management.js';

interface CleanupJob {
  id: string;
  dataType: string;
  scheduledTime: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  operationType: 'scheduled' | 'manual' | 'emergency';
}

export class DataRetentionService {
  private db: Database.Database;
  private cleanupJobs: Map<string, CleanupJob> = new Map();
  private isRunning = false;

  constructor(database: Database.Database) {
    this.db = database;
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default retention policies if they don't exist
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicies = [
      {
        dataType: 'system_metrics',
        maxAgeDays: 30,
        maxRecords: 1000000,
        compressionEnabled: false,
        archivalEnabled: false,
        cleanupFrequency: 'daily' as const,
        isEnabled: true,
        description: 'System monitoring data (CPU, memory, storage)',
        category: 'monitoring'
      },
      {
        dataType: 'interface_metrics',
        maxAgeDays: 30,
        maxRecords: 2000000,
        compressionEnabled: false,
        archivalEnabled: false,
        cleanupFrequency: 'daily' as const,
        isEnabled: true,
        description: 'Network interface monitoring data',
        category: 'monitoring'
      },
      {
        dataType: 'terminal_logs',
        maxAgeDays: 90,
        maxRecords: 100000,
        compressionEnabled: true,
        archivalEnabled: false,
        cleanupFrequency: 'weekly' as const,
        isEnabled: true,
        description: 'Terminal session logs and command history',
        category: 'logs'
      },
      {
        dataType: 'connection_tracking',
        maxAgeDays: 7,
        maxRecords: 500000,
        compressionEnabled: false,
        archivalEnabled: false,
        cleanupFrequency: 'daily' as const,
        isEnabled: true,
        description: 'Network connection tracking data',
        category: 'monitoring'
      },
      {
        dataType: 'user_audit',
        maxAgeDays: 365,
        maxRecords: 50000,
        compressionEnabled: true,
        archivalEnabled: true,
        cleanupFrequency: 'monthly' as const,
        isEnabled: true,
        description: 'User management and authentication audit logs',
        category: 'audit'
      },
      {
        dataType: 'alerts',
        maxAgeDays: 90,
        maxRecords: 20000,
        compressionEnabled: false,
        archivalEnabled: false,
        cleanupFrequency: 'weekly' as const,
        isEnabled: true,
        description: 'System alerts and notifications',
        category: 'alerts'
      },
      {
        dataType: 'login_attempts',
        maxAgeDays: 30,
        maxRecords: 100000,
        compressionEnabled: false,
        archivalEnabled: false,
        cleanupFrequency: 'daily' as const,
        isEnabled: true,
        description: 'User login attempts and security events',
        category: 'security'
      }
    ];

    for (const policy of defaultPolicies) {
      this.ensureRetentionPolicy(policy);
    }
  }

  /**
   * Ensure retention policy exists, create if not
   */
  private ensureRetentionPolicy(policy: Omit<RetentionPolicy, 'id' | 'created_at' | 'updated_at'>): void {
    const existingQuery = `SELECT id FROM data_retention_policies WHERE data_type = ?`;
    const existing = this.db.prepare(existingQuery).get(policy.dataType);

    if (!existing) {
      const insertQuery = `
        INSERT INTO data_retention_policies (
          data_type, max_age_days, max_records, compression_enabled,
          archival_enabled, cleanup_frequency, is_enabled, description, category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.prepare(insertQuery).run(
        policy.dataType,
        policy.maxAgeDays,
        policy.maxRecords || null,
        policy.compressionEnabled ? 1 : 0,
        policy.archivalEnabled ? 1 : 0,
        policy.cleanupFrequency,
        policy.isEnabled ? 1 : 0,
        policy.description,
        policy.category
      );
    }
  }

  /**
   * Get all retention policies
   */
  async getRetentionPolicies(): Promise<RetentionPolicy[]> {
    const query = `SELECT * FROM data_retention_policies ORDER BY data_type`;
    const policies = this.db.prepare(query).all() as any[];
    
    return policies.map(policy => ({
      ...policy,
      compressionEnabled: Boolean(policy.compression_enabled),
      archivalEnabled: Boolean(policy.archival_enabled),
      isEnabled: Boolean(policy.is_enabled),
      created_at: new Date(policy.created_at),
      updated_at: new Date(policy.updated_at)
    }));
  }

  /**
   * Update retention policy
   */
  async updateRetentionPolicy(policy: RetentionPolicy): Promise<RetentionPolicy> {
    const query = `
      UPDATE data_retention_policies 
      SET 
        max_age_days = ?,
        max_records = ?,
        compression_enabled = ?,
        archival_enabled = ?,
        cleanup_frequency = ?,
        is_enabled = ?,
        description = ?,
        category = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const result = this.db.prepare(query).run(
      policy.maxAgeDays,
      policy.maxRecords || null,
      policy.compressionEnabled ? 1 : 0,
      policy.archivalEnabled ? 1 : 0,
      policy.cleanupFrequency,
      policy.isEnabled ? 1 : 0,
      policy.description,
      policy.category,
      policy.id
    );

    if (result.changes === 0) {
      throw new Error(`Retention policy with id ${policy.id} not found`);
    }

    return this.getRetentionPolicyById(policy.id);
  }

  /**
   * Get retention policy by ID
   */
  async getRetentionPolicyById(id: number): Promise<RetentionPolicy> {
    const query = `SELECT * FROM data_retention_policies WHERE id = ?`;
    const policy = this.db.prepare(query).get(id) as any;
    
    if (!policy) {
      throw new Error(`Retention policy with id ${id} not found`);
    }

    return {
      ...policy,
      compressionEnabled: Boolean(policy.compression_enabled),
      archivalEnabled: Boolean(policy.archival_enabled),
      isEnabled: Boolean(policy.is_enabled),
      created_at: new Date(policy.created_at),
      updated_at: new Date(policy.updated_at)
    };
  }

  /**
   * Get retention policy by data type
   */
  async getRetentionPolicyByType(dataType: string): Promise<RetentionPolicy | null> {
    const query = `SELECT * FROM data_retention_policies WHERE data_type = ?`;
    const policy = this.db.prepare(query).get(dataType) as any;
    
    if (!policy) return null;

    return {
      ...policy,
      compressionEnabled: Boolean(policy.compression_enabled),
      archivalEnabled: Boolean(policy.archival_enabled),
      isEnabled: Boolean(policy.is_enabled),
      created_at: new Date(policy.created_at),
      updated_at: new Date(policy.updated_at)
    };
  }

  /**
   * Estimate cleanup impact for a data type
   */
  async estimateCleanup(dataType: string): Promise<CleanupEstimate> {
    try {
      const policy = await this.getRetentionPolicyByType(dataType);
      if (!policy) {
        throw new Error(`No retention policy found for data type: ${dataType}`);
      }

      const tableName = this.getTableNameForDataType(dataType);
      const timestampColumn = this.getTimestampColumnForDataType(dataType);
      
      if (!timestampColumn) {
        throw new Error(`No timestamp column configured for data type: ${dataType}`);
      }

      // Check if table exists
      if (!this.tableExists(tableName)) {
        console.warn(`Table ${tableName} does not exist for data type ${dataType}, returning empty estimate`);
        return {
          dataType,
          estimatedRecords: 0,
          estimatedBytes: 0,
          oldestRecord: new Date(),
          newestRecord: new Date(),
          impactAnalysis: {
            performanceImpact: 'low',
            dataIntegrityRisk: 'low',
            recommendedTime: 'any time'
          }
        };
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.maxAgeDays);

      // Get count and date range of records to be deleted
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
        oldestRecord: string | null;
        newestRecord: string | null;
      };

      // Handle null results (empty table or no matching records)
      const estimatedRecords = result?.estimatedRecords || 0;
      const oldestRecord = result?.oldestRecord;
      const newestRecord = result?.newestRecord;

      // Estimate bytes (simplified calculation)
      const avgRowSize = await this.getAverageRowSize(tableName);
      const estimatedBytes = estimatedRecords * avgRowSize;

      // Determine impact levels
      const performanceImpact = estimatedRecords > 100000 ? 'high' : 
                              estimatedRecords > 10000 ? 'medium' : 'low';
      
      const dataIntegrityRisk = policy.category === 'audit' ? 'medium' : 'low';

      return {
        dataType,
        estimatedRecords,
        estimatedBytes,
        oldestRecord: oldestRecord ? new Date(oldestRecord) : new Date(),
        newestRecord: newestRecord ? new Date(newestRecord) : new Date(),
        impactAnalysis: {
          performanceImpact,
          dataIntegrityRisk,
          recommendedTime: performanceImpact === 'high' ? 'off-peak hours' : 'any time'
        }
      };
    } catch (error) {
      console.error(`Error estimating cleanup for ${dataType}:`, error);
      // Return a safe fallback estimate instead of throwing
      return {
        dataType,
        estimatedRecords: 0,
        estimatedBytes: 0,
        oldestRecord: new Date(),
        newestRecord: new Date(),
        impactAnalysis: {
          performanceImpact: 'low',
          dataIntegrityRisk: 'low',
          recommendedTime: 'any time'
        }
      };
    }
  }

  /**
   * Perform cleanup for a specific data type
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
      const timestampColumn = this.getTimestampColumnForDataType(dataType);
      
      if (!timestampColumn) {
        throw new Error(`No timestamp column configured for data type: ${dataType}`);
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.maxAgeDays);

      // Archive data if enabled
      if (policy.archivalEnabled) {
        await this.archiveData(tableName, timestampColumn, cutoffDate);
      }

      // Compress data if enabled (simplified implementation)
      if (policy.compressionEnabled) {
        await this.compressData(tableName, timestampColumn, cutoffDate);
      }

      // Count records to be deleted
      const countQuery = `
        SELECT COUNT(*) as count
        FROM "${tableName}"
        WHERE "${timestampColumn}" < ?
      `;
      const countResult = this.db.prepare(countQuery).get(cutoffDate.toISOString()) as { count: number };

      // Delete old records
      const deleteQuery = `
        DELETE FROM "${tableName}"
        WHERE "${timestampColumn}" < ?
      `;
      const deleteResult = this.db.prepare(deleteQuery).run(cutoffDate.toISOString());

      const durationMs = Date.now() - startTime;
      const avgRowSize = await this.getAverageRowSize(tableName);
      const bytesFreed = deleteResult.changes * avgRowSize;

      // Log the operation
      await this.logCleanupOperation({
        id: operationId,
        operationType: force ? 'manual' : 'scheduled',
        dataType,
        recordsAffected: deleteResult.changes,
        bytesFreed,
        durationMs,
        status: 'success',
        startedAt: new Date(startTime),
        completedAt: new Date()
      });

      return {
        id: operationId,
        operationType: force ? 'manual' : 'scheduled',
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
      
      const operation: CleanupOperation = {
        id: operationId,
        operationType: force ? 'manual' : 'scheduled',
        dataType,
        recordsAffected: 0,
        bytesFreed: 0,
        durationMs,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        startedAt: new Date(startTime),
        completedAt: new Date()
      };

      await this.logCleanupOperation(operation);
      throw error;
    }
  }

  /**
   * Schedule automated cleanup jobs
   */
  async scheduleCleanupJobs(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    
    try {
      const policies = await this.getRetentionPolicies();
      const enabledPolicies = policies.filter(p => p.isEnabled);

      for (const policy of enabledPolicies) {
        const lastCleanup = await this.getLastCleanupTime(policy.dataType);
        const nextCleanup = this.calculateNextCleanupTime(policy.cleanupFrequency, lastCleanup);

        if (new Date() >= nextCleanup) {
          const jobId = `cleanup-${policy.dataType}-${Date.now()}`;
          
          const job: CleanupJob = {
            id: jobId,
            dataType: policy.dataType,
            scheduledTime: new Date(),
            status: 'pending',
            operationType: 'scheduled'
          };

          this.cleanupJobs.set(jobId, job);
          
          // Execute cleanup job
          this.executeCleanupJob(job);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute a cleanup job
   */
  private async executeCleanupJob(job: CleanupJob): Promise<void> {
    try {
      job.status = 'running';
      await this.performCleanup(job.dataType);
      job.status = 'completed';
    } catch (error) {
      job.status = 'failed';
      console.error(`Cleanup job ${job.id} failed:`, error);
    } finally {
      // Remove job after completion
      setTimeout(() => {
        this.cleanupJobs.delete(job.id);
      }, 60000); // Keep job info for 1 minute
    }
  }

  /**
   * Get active cleanup jobs
   */
  getActiveJobs(): CleanupJob[] {
    return Array.from(this.cleanupJobs.values());
  }

  /**
   * Validate retention policy
   */
  validateRetentionPolicy(policy: Omit<RetentionPolicy, 'id' | 'created_at' | 'updated_at'>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!policy.dataType || policy.dataType.trim() === '') {
      errors.push('Data type is required');
    }

    if (policy.maxAgeDays <= 0) {
      errors.push('Max age days must be greater than 0');
    }

    if (policy.maxRecords && policy.maxRecords <= 0) {
      errors.push('Max records must be greater than 0 if specified');
    }

    if (!['daily', 'weekly', 'monthly'].includes(policy.cleanupFrequency)) {
      errors.push('Cleanup frequency must be daily, weekly, or monthly');
    }

    if (!policy.description || policy.description.trim() === '') {
      errors.push('Description is required');
    }

    if (!policy.category || policy.category.trim() === '') {
      errors.push('Category is required');
    }

    // Validate that table exists for data type
    const tableName = this.getTableNameForDataType(policy.dataType);
    if (!this.tableExists(tableName)) {
      errors.push(`Table ${tableName} does not exist for data type ${policy.dataType}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Helper methods
   */
  private getTableNameForDataType(dataType: string): string {
    const mapping: Record<string, string> = {
      'system_metrics': 'system_metrics',
      'interface_metrics': 'interface_metrics',
      'terminal_logs': 'terminal_session_logs',
      'connection_tracking': 'connection_tracking',
      'user_audit': 'user_management_audit',
      'alerts': 'alerts',
      'login_attempts': 'login_attempts'
    };

    return mapping[dataType] || dataType;
  }

  private getTimestampColumnForDataType(dataType: string): string | null {
    const mapping: Record<string, string> = {
      'system_metrics': 'timestamp',
      'interface_metrics': 'timestamp',
      'terminal_logs': 'timestamp',
      'connection_tracking': 'collected_at',
      'user_audit': 'created_at',
      'alerts': 'created_at',
      'login_attempts': 'created_at'
    };

    return mapping[dataType] || null;
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

      // Handle cases where table exists but has no data or dbstat doesn't have info
      if (!result || !result.totalSize || !result.totalRecords || result.totalRecords === 0) {
        return 100; // Default estimate for empty or unmeasured tables
      }

      return result.totalSize / result.totalRecords;
    } catch (error) {
      console.warn(`Could not get average row size for ${tableName}:`, error);
      return 100; // Default estimate
    }
  }

  private async logCleanupOperation(operation: CleanupOperation): Promise<void> {
    const query = `
      INSERT INTO data_cleanup_logs (
        operation_type, data_type, records_affected, bytes_freed,
        duration_ms, status, error_message, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.prepare(query).run(
      operation.operationType,
      operation.dataType,
      operation.recordsAffected,
      operation.bytesFreed,
      operation.durationMs,
      operation.status,
      operation.errorMessage || null,
      operation.startedAt.toISOString(),
      operation.completedAt.toISOString()
    );
  }

  private async getLastCleanupTime(dataType: string): Promise<Date | null> {
    const query = `
      SELECT MAX(completed_at) as lastCleanup
      FROM data_cleanup_logs
      WHERE data_type = ? AND status = 'success'
    `;
    const result = this.db.prepare(query).get(dataType) as { lastCleanup: string | null };
    return result.lastCleanup ? new Date(result.lastCleanup) : null;
  }

  private calculateNextCleanupTime(frequency: 'daily' | 'weekly' | 'monthly', lastCleanup: Date | null): Date {
    const now = new Date();
    const base = lastCleanup || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday if no last cleanup

    switch (frequency) {
      case 'daily':
        return new Date(base.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(base);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      default:
        return new Date(base.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private tableExists(tableName: string): boolean {
    const query = `
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'table' AND name = ?
    `;
    const result = this.db.prepare(query).get(tableName);
    return !!result;
  }

  private async archiveData(tableName: string, timestampColumn: string, cutoffDate: Date): Promise<void> {
    // Simplified archive implementation - in reality you'd compress and store data
    console.log(`Archiving data from ${tableName} before ${cutoffDate.toISOString()}`);
  }

  private async compressData(tableName: string, timestampColumn: string, cutoffDate: Date): Promise<void> {
    // Simplified compression implementation - in reality you'd compress old data
    console.log(`Compressing data from ${tableName} before ${cutoffDate.toISOString()}`);
  }
} 