import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import {
  DatabaseStatistics,
  DatabaseTable,
  TableSchema,
  TableIndex,
  DatabaseQueryRequest,
  DatabaseQueryResponse,
  UpdateRecordRequest,
  ExportDataRequest,
  DataExport
} from '../types/disk-management.js';

export class DatabaseAnalysisService {
  private db: Database.Database;
  private dbPath: string;

  constructor(database: Database.Database, databasePath: string) {
    this.db = database;
    this.dbPath = databasePath;
  }

  /**
   * Get comprehensive database statistics
   */
  async getDatabaseStatistics(): Promise<DatabaseStatistics> {
    const totalTables = await this.getTotalTables();
    const totalRecords = await this.getTotalRecords();
    const totalIndexes = await this.getTotalIndexes();
    const totalSize = await this.getTotalDatabaseSize();
    const fragmentationLevel = await this.getFragmentationLevel();
    const lastVacuum = await this.getLastVacuum();
    const lastAnalyze = await this.getLastAnalyze();
    const walMode = await this.getWalMode();
    const pageSize = await this.getPageSize();
    const cacheSize = await this.getCacheSize();

    return {
      totalTables,
      totalRecords,
      totalIndexes,
      totalSize,
      fragmentationLevel,
      lastVacuum,
      lastAnalyze,
      walMode,
      pageSize,
      cacheSize
    };
  }

  /**
   * Get all database tables with detailed information
   */
  async getDatabaseTables(): Promise<DatabaseTable[]> {
    const tablesQuery = `
      SELECT 
        name,
        type,
        sql
      FROM sqlite_master 
      WHERE type IN ('table', 'view')
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;

    const tables = this.db.prepare(tablesQuery).all() as Array<{
      name: string;
      type: 'table' | 'view';
      sql: string;
    }>;

    const databaseTables: DatabaseTable[] = [];

    for (const table of tables) {
      try {
        const recordCount = await this.getTableRecordCount(table.name);
        const schema = await this.getTableSchema(table.name);
        const indexes = await this.getTableIndexes(table.name);
        const sizeBytes = await this.getTableSize(table.name);
        const lastModified = await this.getTableLastModified(table.name);

        databaseTables.push({
          name: table.name,
          type: table.type,
          recordCount,
          schema,
          indexes,
          sizeBytes,
          lastModified
        });
      } catch (error) {
        console.error(`Error analyzing table ${table.name}:`, error);
        // Continue with other tables
      }
    }

    return databaseTables;
  }

  /**
   * Get table schema information
   */
  async getTableSchema(tableName: string): Promise<TableSchema[]> {
    const pragmaQuery = `PRAGMA table_info("${tableName}")`;
    const columns = this.db.prepare(pragmaQuery).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    // Get foreign key information
    const foreignKeysQuery = `PRAGMA foreign_key_list("${tableName}")`;
    const foreignKeys = this.db.prepare(foreignKeysQuery).all() as Array<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
      on_update: string;
      on_delete: string;
      match: string;
    }>;

    const schema: TableSchema[] = columns.map(column => {
      const foreignKey = foreignKeys.find(fk => fk.from === column.name);
      
      return {
        columnName: column.name,
        dataType: column.type,
        nullable: column.notnull === 0,
        primaryKey: column.pk === 1,
        foreignKey: foreignKey ? {
          referencedTable: foreignKey.table,
          referencedColumn: foreignKey.to
        } : undefined,
        defaultValue: column.dflt_value || undefined
      };
    });

    return schema;
  }

  /**
   * Get table indexes information
   */
  async getTableIndexes(tableName: string): Promise<TableIndex[]> {
    const indexesQuery = `PRAGMA index_list("${tableName}")`;
    const indexes = this.db.prepare(indexesQuery).all() as Array<{
      seq: number;
      name: string;
      unique: number;
      origin: string;
      partial: number;
    }>;

    const tableIndexes: TableIndex[] = [];

    for (const index of indexes) {
      try {
        // Get index columns
        const indexInfoQuery = `PRAGMA index_info("${index.name}")`;
        const indexInfo = this.db.prepare(indexInfoQuery).all() as Array<{
          seqno: number;
          cid: number;
          name: string;
        }>;

        const columns = indexInfo
          .sort((a, b) => a.seqno - b.seqno)
          .map(info => info.name);

        // Get index size (approximation)
        const sizeQuery = `
          SELECT SUM(pgsize) as indexSize
          FROM dbstat 
          WHERE name = ?
        `;
        const sizeResult = this.db.prepare(sizeQuery).get(index.name) as {
          indexSize: number | null;
        };

        tableIndexes.push({
          name: index.name,
          columns,
          unique: index.unique === 1,
          partial: index.partial === 1,
          sizeBytes: sizeResult?.indexSize || 0
        });
      } catch (error) {
        console.error(`Error analyzing index ${index.name}:`, error);
      }
    }

    return tableIndexes;
  }

  /**
   * Execute database query with pagination and filtering
   */
  async executeQuery(request: DatabaseQueryRequest): Promise<DatabaseQueryResponse> {
    const startTime = Date.now();
    
    try {
      let query = '';
      let countQuery = '';
      const params: any[] = [];

      if (request.query) {
        // Custom query provided
        query = request.query;
        // For count, we'll estimate based on the result
        countQuery = `SELECT COUNT(*) as total FROM (${request.query})`;
      } else {
        // Build query from parameters
        const { tableName, limit = 100, offset = 0, orderBy, orderDirection = 'ASC', filters } = request;
        
        let whereClause = '';
        if (filters && Object.keys(filters || {}).length > 0) {
          const conditions = Object.entries(filters)
            .filter(([_, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => {
              params.push(`%${value}%`);
              return `"${key}" LIKE ?`;
            });
          
          if (conditions.length > 0) {
            whereClause = `WHERE ${conditions.join(' AND ')}`;
          }
        }

        const orderClause = orderBy ? `ORDER BY "${orderBy}" ${orderDirection}` : '';
        const limitClause = `LIMIT ${limit} OFFSET ${offset}`;

        query = `SELECT * FROM "${tableName}" ${whereClause} ${orderClause} ${limitClause}`;
        countQuery = `SELECT COUNT(*) as total FROM "${tableName}" ${whereClause}`;
      }

      // Execute count query
      const countParams = params.slice(0, params.length - (request.limit ? 2 : 0));
      const countResult = this.db.prepare(countQuery).get(countParams) as { total: number };
      const totalCount = countResult.total;

      // Execute main query
      const data = this.db.prepare(query).all(params) as Record<string, any>[];

      // Get column names
      const columns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];

      const executionTime = Date.now() - startTime;
      const hasMore = (request.offset || 0) + data.length < totalCount;

      return {
        data,
        totalCount,
        hasMore,
        executionTime,
        columns
      };

    } catch (error) {
      console.error('Error executing database query:', error);
      throw new Error(`Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update a record in a table
   */
  async updateRecord(request: UpdateRecordRequest): Promise<boolean> {
    const { tableName, id, data } = request;

    try {
      // Build update query
      const columns = Object.keys(data);
      const setClause = columns.map(col => `"${col}" = ?`).join(', ');
      const values = Object.values(data);

      // Determine primary key column
      const pkColumn = await this.getPrimaryKeyColumn(tableName);
      if (!pkColumn) {
        throw new Error(`No primary key found for table ${tableName}`);
      }

      const query = `UPDATE "${tableName}" SET ${setClause} WHERE "${pkColumn}" = ?`;
      const result = this.db.prepare(query).run(...values, id);

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating record:', error);
      throw new Error(`Failed to update record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a record from a table
   */
  async deleteRecord(tableName: string, id: string | number): Promise<boolean> {
    try {
      // Determine primary key column
      const pkColumn = await this.getPrimaryKeyColumn(tableName);
      if (!pkColumn) {
        throw new Error(`No primary key found for table ${tableName}`);
      }

      const query = `DELETE FROM "${tableName}" WHERE "${pkColumn}" = ?`;
      const result = this.db.prepare(query).run(id);

      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting record:', error);
      throw new Error(`Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export table data
   */
  async exportTableData(request: ExportDataRequest): Promise<DataExport> {
    const { tableName, format, filters, columns, limit } = request;

    try {
      // Build query
      const selectColumns = columns && columns.length > 0 ? columns.map(col => `"${col}"`).join(', ') : '*';
      let query = `SELECT ${selectColumns} FROM "${tableName}"`;
      const params: any[] = [];

      if (filters && Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters)
          .filter(([_, value]) => value !== undefined && value !== null && value !== '')
          .map(([key, value]) => {
            params.push(`%${value}%`);
            return `"${key}" LIKE ?`;
          });
        
        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }
      }

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const data = this.db.prepare(query).all(params) as Record<string, any>[];

      // Convert data based on format
      let exportData = '';
      let fileSizeBytes = 0;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(data, null, 2);
          break;
        case 'csv':
          exportData = this.convertToCSV(data);
          break;
        case 'sql':
          exportData = this.convertToSQL(tableName, data);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      fileSizeBytes = Buffer.byteLength(exportData, 'utf8');

      // In a real implementation, you'd save this to a file and return a download URL
      const downloadUrl = `/api/admin/database/exports/${Date.now()}-${tableName}.${format}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Expire in 24 hours

      return {
        id: Date.now(),
        tableName,
        format,
        recordCount: data.length,
        fileSizeBytes,
        exportedAt: new Date(),
        downloadUrl,
        expiresAt
      };

    } catch (error) {
      console.error('Error exporting table data:', error);
      throw new Error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get index optimization recommendations
   */
  async getIndexRecommendations(tableName: string): Promise<string[]> {
    const recommendations: string[] = [];

    try {
      // Check for tables without indexes
      const indexCount = await this.getTableIndexCount(tableName);
      const recordCount = await this.getTableRecordCount(tableName);

      if (indexCount === 0 && recordCount > 1000) {
        recommendations.push(`Consider adding indexes to table ${tableName} - it has ${recordCount} records but no indexes`);
      }

      // Check for unused indexes (simplified check)
      const indexes = await this.getTableIndexes(tableName);
      for (const index of indexes) {
        if (index.sizeBytes > 0 && !index.unique && index.columns.length === 1) {
          // This is a simplified check - in reality you'd analyze query patterns
          recommendations.push(`Index ${index.name} may be redundant - consider reviewing its usage`);
        }
      }

      // Check for missing primary key
      const hasPrimaryKey = await this.hasPrimaryKey(tableName);
      if (!hasPrimaryKey && recordCount > 0) {
        recommendations.push(`Table ${tableName} has no primary key - consider adding one for better performance`);
      }

    } catch (error) {
      console.error(`Error getting index recommendations for ${tableName}:`, error);
    }

    return recommendations;
  }

  /**
   * Analyze query performance
   */
  async analyzeQueryPerformance(query: string): Promise<{
    executionTime: number;
    plan: string;
    recommendations: string[];
  }> {
    const startTime = Date.now();
    const recommendations: string[] = [];

    try {
      // Get query plan
      const explainQuery = `EXPLAIN QUERY PLAN ${query}`;
      const plan = this.db.prepare(explainQuery).all() as Array<{
        id: number;
        parent: number;
        notused: number;
        detail: string;
      }>;

      // Execute query to measure time
      this.db.prepare(query).all();
      const executionTime = Date.now() - startTime;

      // Analyze plan for recommendations
      const planText = plan.map(p => p.detail).join('\n');
      
      if (planText.includes('SCAN TABLE')) {
        recommendations.push('Query uses table scan - consider adding appropriate indexes');
      }
      
      if (executionTime > 1000) {
        recommendations.push('Query execution time is high - consider optimization');
      }

      if (planText.includes('TEMP B-TREE')) {
        recommendations.push('Query uses temporary storage - consider adding indexes for sorting/grouping');
      }

      return {
        executionTime,
        plan: planText,
        recommendations
      };

    } catch (error) {
      console.error('Error analyzing query performance:', error);
      throw new Error(`Failed to analyze query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper methods
   */
  private async getTotalTables(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `;
    const result = this.db.prepare(query).get() as { count: number };
    return result.count;
  }

  private async getTotalRecords(): Promise<number> {
    const tables = await this.getAllTableNames();
    let totalRecords = 0;

    for (const tableName of tables) {
      try {
        const count = await this.getTableRecordCount(tableName);
        totalRecords += count;
      } catch (error) {
        // Continue with other tables
      }
    }

    return totalRecords;
  }

  private async getTotalIndexes(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND name NOT LIKE 'sqlite_%'
    `;
    const result = this.db.prepare(query).get() as { count: number };
    return result.count;
  }

  private async getFragmentationLevel(): Promise<number> {
    try {
      const query = `SELECT freelist_count, page_count FROM pragma_freelist_count(), pragma_page_count()`;
      const result = this.db.prepare(query).get() as { freelist_count: number; page_count: number };
      return result.page_count > 0 ? (result.freelist_count / result.page_count) * 100 : 0;
    } catch (error) {
      return 0;
    }
  }

  private async getLastVacuum(): Promise<Date | null> {
    return null; // SQLite doesn't track vacuum history by default
  }

  private async getLastAnalyze(): Promise<Date | null> {
    return null; // SQLite doesn't track analyze history by default
  }

  private async getWalMode(): Promise<boolean> {
    try {
      const query = `PRAGMA journal_mode`;
      const result = this.db.prepare(query).get() as { journal_mode: string };
      return result.journal_mode === 'wal';
    } catch (error) {
      return false;
    }
  }

  private async getPageSize(): Promise<number> {
    try {
      const query = `PRAGMA page_size`;
      const result = this.db.prepare(query).get() as { page_size: number };
      return result.page_size;
    } catch (error) {
      return 0;
    }
  }

  private async getCacheSize(): Promise<number> {
    try {
      const query = `PRAGMA cache_size`;
      const result = this.db.prepare(query).get() as { cache_size: number };
      return result.cache_size;
    } catch (error) {
      return 0;
    }
  }

  private async getAllTableNames(): Promise<string[]> {
    const query = `
      SELECT name 
      FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
    `;
    const tables = this.db.prepare(query).all() as Array<{ name: string }>;
    return tables.map(t => t.name);
  }

  private async getTableRecordCount(tableName: string): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const result = this.db.prepare(query).get() as { count: number };
    return result.count;
  }

  private async getTableSize(tableName: string): Promise<number> {
    try {
      const query = `
        SELECT SUM(pgsize) as totalSize
        FROM dbstat 
        WHERE name = ?
      `;
      const result = this.db.prepare(query).get(tableName) as { totalSize: number | null };
      return result?.totalSize || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getTableLastModified(tableName: string): Promise<Date> {
    return new Date(); // Simplified - in reality you'd check timestamp columns
  }

  private async getTableIndexCount(tableName: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM sqlite_master 
      WHERE type = 'index' 
      AND tbl_name = ?
      AND name NOT LIKE 'sqlite_%'
    `;
    const result = this.db.prepare(query).get(tableName) as { count: number };
    return result.count;
  }

  private async getPrimaryKeyColumn(tableName: string): Promise<string | null> {
    const schema = await this.getTableSchema(tableName);
    const pkColumn = schema.find(col => col.primaryKey);
    return pkColumn?.columnName || null;
  }

  private async hasPrimaryKey(tableName: string): Promise<boolean> {
    const pkColumn = await this.getPrimaryKeyColumn(tableName);
    return pkColumn !== null;
  }

  private convertToCSV(data: Record<string, any>[]): string {
    if (data.length === 0) return '';

    const headers = data[0] ? Object.keys(data[0]) : [];
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  private convertToSQL(tableName: string, data: Record<string, any>[]): string {
    if (data.length === 0) return '';

    const headers = data[0] ? Object.keys(data[0]) : [];
    const sqlStatements: string[] = [];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        }
        return String(value);
      });

      const sql = `INSERT INTO "${tableName}" (${headers.map(h => `"${h}"`).join(', ')}) VALUES (${values.join(', ')});`;
      sqlStatements.push(sql);
    }

    return sqlStatements.join('\n');
  }

  private async getTotalDatabaseSize(): Promise<number> {
    try {
      // Get actual database file size (same as DiskManagementService)
      const dbSize = await this.getDatabaseFileSize();
      const walSize = await this.getWalFileSize();
      const shmSize = await this.getShmFileSize();
      
      console.log('DatabaseAnalysisService - Database size calculation:');
      console.log(`  DB Path: ${this.dbPath}`);
      console.log(`  DB Size: ${dbSize} bytes (${(dbSize / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  WAL Size: ${walSize} bytes (${(walSize / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  SHM Size: ${shmSize} bytes (${(shmSize / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`  Total: ${dbSize + walSize + shmSize} bytes (${((dbSize + walSize + shmSize) / 1024 / 1024).toFixed(2)} MB)`);
      
      return dbSize + walSize + shmSize;
    } catch (error) {
      console.error('Error getting total database size:', error);
      return 0;
    }
  }

  /**
   * Get database file size in bytes
   */
  private async getDatabaseFileSize(): Promise<number> {
    try {
      const stats = await fs.stat(this.dbPath);
      return stats.size;
    } catch (error) {
      console.error('Error getting database file size:', error);
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
} 