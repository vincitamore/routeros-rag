import { FastifyInstance } from 'fastify';
import { DatabaseAnalysisService } from '../services/database-analysis-service.js';

export default async function databaseViewerRoutes(fastify: FastifyInstance) {
  const dbAnalysisService = new DatabaseAnalysisService(fastify.db, fastify.dbPath);

  // Admin authentication prehandler
  const requireAdmin = async (request: any, reply: any) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }
  };

  // GET /api/admin/database/tables - List all tables
  fastify.get('/tables', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const tables = await dbAnalysisService.getDatabaseTables();
      return { tables };
    } catch (error) {
      fastify.log.error('Error getting database tables:', error);
      return reply.code(500).send({ error: 'Failed to get database tables' });
    }
  });

  // GET /api/admin/database/tables/:table/schema - Table schema
  fastify.get('/tables/:table/schema', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { table } = request.params as { table: string };
      const schema = await dbAnalysisService.getTableSchema(table);
      return { schema };
    } catch (error) {
      fastify.log.error(`Error getting schema for table ${(request.params as any).table}:`, error);
      return reply.code(500).send({ error: 'Failed to get table schema' });
    }
  });

  // GET /api/admin/database/tables/:table/data - Table data with pagination
  fastify.get('/tables/:table/data', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { table } = request.params as { table: string };
      const query = request.query as any;
      
      const result = await dbAnalysisService.executeQuery({
        tableName: table,
        limit: query.limit ? parseInt(query.limit) : 100,
        offset: query.offset ? parseInt(query.offset) : 0,
        orderBy: query.orderBy,
        orderDirection: query.orderDirection,
        filters: query.filters ? JSON.parse(query.filters) : undefined
      });
      
      return result;
    } catch (error) {
      fastify.log.error(`Error getting data for table ${(request.params as any).table}:`, error);
      return reply.code(500).send({ error: 'Failed to get table data' });
    }
  });

  // POST /api/admin/database/tables/:table/query - Custom SQL queries
  fastify.post('/tables/:table/query', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { table } = request.params as { table: string };
      const { query, limit, offset } = request.body as any;
      
      const result = await dbAnalysisService.executeQuery({
        tableName: table,
        query,
        limit,
        offset
      });
      
      return result;
    } catch (error) {
      fastify.log.error(`Error executing query on table ${(request.params as any).table}:`, error);
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to execute query' 
      });
    }
  });

  // PUT /api/admin/database/tables/:table/records/:id - Update record
  fastify.put('/tables/:table/records/:id', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { table, id } = request.params as { table: string; id: string };
      const data = request.body as any;
      
      const success = await dbAnalysisService.updateRecord({
        tableName: table,
        id,
        data
      });
      
      if (success) {
        return { message: 'Record updated successfully' };
      } else {
        return reply.code(404).send({ error: 'Record not found' });
      }
    } catch (error) {
      fastify.log.error(`Error updating record in table ${(request.params as any).table}:`, error);
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to update record' 
      });
    }
  });

  // DELETE /api/admin/database/tables/:table/records/:id - Delete record
  fastify.delete('/tables/:table/records/:id', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { table, id } = request.params as { table: string; id: string };
      
      const success = await dbAnalysisService.deleteRecord(table, id);
      
      if (success) {
        return { message: 'Record deleted successfully' };
      } else {
        return reply.code(404).send({ error: 'Record not found' });
      }
    } catch (error) {
      fastify.log.error(`Error deleting record from table ${(request.params as any).table}:`, error);
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to delete record' 
      });
    }
  });

  // POST /api/admin/database/export - Export table data
  fastify.post('/export', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const exportRequest = request.body as any;
      const exportData = await dbAnalysisService.exportTableData(exportRequest);
      return { export: exportData };
    } catch (error) {
      fastify.log.error('Error exporting table data:', error);
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to export data' 
      });
    }
  });

  // GET /api/admin/database/statistics - Database statistics
  fastify.get('/statistics', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const statistics = await dbAnalysisService.getDatabaseStatistics();
      return { statistics };
    } catch (error) {
      fastify.log.error('Error getting database statistics:', error);
      return reply.code(500).send({ error: 'Failed to get database statistics' });
    }
  });

  // GET /api/admin/database/tables/:table/indexes - Get table indexes
  fastify.get('/tables/:table/indexes', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { table } = request.params as { table: string };
      const indexes = await dbAnalysisService.getTableIndexes(table);
      return { indexes };
    } catch (error) {
      fastify.log.error(`Error getting indexes for table ${(request.params as any).table}:`, error);
      return reply.code(500).send({ error: 'Failed to get table indexes' });
    }
  });

  // POST /api/admin/database/query - Execute custom SQL query
  fastify.post('/query', { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const { query, limit, offset } = request.body as any;
      
      // Basic SQL injection protection - only allow SELECT statements
      const trimmedQuery = query.trim().toLowerCase();
      if (!trimmedQuery.startsWith('select')) {
        return reply.code(400).send({ error: 'Only SELECT queries are allowed' });
      }
      
      const result = await dbAnalysisService.executeQuery({
        tableName: '', // Not used for custom queries
        query,
        limit,
        offset
      });
      
      return result;
    } catch (error) {
      fastify.log.error('Error executing custom query:', error);
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to execute query' 
      });
    }
  });
} 