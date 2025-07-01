import { FastifyInstance } from 'fastify';
import { DiskManagementService } from '../services/disk-management-service.js';
import { DataRetentionService } from '../services/data-retention-service.js';
import {
  CreateRetentionPolicyRequest,
  UpdateRetentionPolicyRequest,
  CleanupRequest,
  VacuumRequest
} from '../types/disk-management.js';

export default async function diskManagementRoutes(fastify: FastifyInstance) {
  // Use global services
  const diskService = fastify.diskManagementService;
  const retentionService = new DataRetentionService(fastify.db);

  // Admin authentication prehandler
  const requireAdmin = async (request: any, reply: any) => {
    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin access required' });
    }
  };

  /**
   * GET /api/admin/disk/usage
   * Get current disk usage metrics
   */
  fastify.get('/usage', {
    preHandler: requireAdmin,
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            totalDatabaseSize: { type: 'number' },
            walFileSize: { type: 'number' },
            shmFileSize: { type: 'number' },
            tableUsages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tableName: { type: 'string' },
                  recordCount: { type: 'number' },
                  sizeBytes: { type: 'number' },
                  averageRowSize: { type: 'number' },
                  indexSizeBytes: { type: 'number' },
                  lastUpdated: { type: 'string', format: 'date-time' },
                  growthRate: { type: 'number' }
                }
              }
            },
            growthRates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tableName: { type: 'string' },
                  dailyGrowthBytes: { type: 'number' },
                  weeklyGrowthBytes: { type: 'number' },
                  monthlyGrowthBytes: { type: 'number' },
                  trend: { type: 'string', enum: ['increasing', 'decreasing', 'stable'] }
                }
              }
            },
            predictions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  timeframe: { type: 'string', enum: ['30d', '60d', '90d', '180d', '1y'] },
                  predictedSizeBytes: { type: 'number' },
                  confidenceLevel: { type: 'number' },
                  projectedFullDate: { type: ['string', 'null'], format: 'date-time' },
                  recommendedAction: { type: 'string' }
                }
              }
            },
            lastCleanup: { type: ['string', 'null'], format: 'date-time' },
            freeSpace: { type: 'number' },
            totalSpace: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const metrics = await diskService.getDiskUsageMetrics();
      return metrics;
    } catch (error) {
      fastify.log.error('Error getting disk usage metrics:', error);
      return reply.code(500).send({ error: 'Failed to get disk usage metrics' });
    }
  });

  /**
   * GET /api/admin/disk/usage/history
   * Get historical disk usage data with time range support (like monitoring charts)
   */
  fastify.get('/usage/history', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          timeRange: { type: 'string', default: '1h' },
          limit: { type: 'number', default: 500 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { timeRange = '1h', limit = 500 } = request.query as { timeRange?: string; limit?: number };
      
      // Parse time range like monitoring charts
      let hours = 1;
      if (timeRange.endsWith('h')) {
        hours = parseInt(timeRange.slice(0, -1));
      } else if (timeRange.endsWith('d')) {
        hours = parseInt(timeRange.slice(0, -1)) * 24;
      }
      
      const query = `
        SELECT 
          total_size as totalSize,
          wal_size as walSize,
          shm_size as shmSize,
          table_count as tableCount,
          timestamp
        FROM disk_usage_history 
        WHERE timestamp >= datetime('now', '-${hours} hours')
        ORDER BY timestamp ASC 
        LIMIT ${limit}
      `;
      
      const history = fastify.db.prepare(query).all();
      
      // Return array directly (not wrapped in object) since chart expects Array.isArray(data)
      return history;
    } catch (error) {
      fastify.log.error('Error getting disk usage history:', error);
      return reply.code(500).send({ error: 'Failed to get disk usage history' });
    }
  });

  /**
   * GET /api/admin/disk/tables
   * Get table-by-table breakdown
   */
  fastify.get('/tables', {
    preHandler: requireAdmin
  }, async (request, reply) => {
    try {
      const metrics = await diskService.getDiskUsageMetrics();
      return { tables: metrics.tableUsages };
    } catch (error) {
      fastify.log.error('Error getting table breakdown:', error);
      return reply.code(500).send({ error: 'Failed to get table breakdown' });
    }
  });

  /**
   * GET /api/admin/disk/retention-policies
   * Get all retention policies
   */
  fastify.get('/retention-policies', {
    preHandler: requireAdmin
  }, async (request, reply) => {
    try {
      const policies = await retentionService.getRetentionPolicies();
      return { policies };
    } catch (error) {
      fastify.log.error('Error getting retention policies:', error);
      return reply.code(500).send({ error: 'Failed to get retention policies' });
    }
  });

  /**
   * PUT /api/admin/disk/retention-policies/:type
   * Update retention policy
   */
  fastify.put('/retention-policies/:type', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        properties: {
          type: { type: 'string' }
        },
        required: ['type']
      },
      body: {
        type: 'object',
        properties: {
          maxAgeDays: { type: 'number' },
          maxRecords: { type: 'number' },
          compressionEnabled: { type: 'boolean' },
          archivalEnabled: { type: 'boolean' },
          cleanupFrequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
          isEnabled: { type: 'boolean' },
          description: { type: 'string' },
          category: { type: 'string' }
        },
        required: ['maxAgeDays', 'cleanupFrequency', 'isEnabled', 'description', 'category']
      }
    }
  }, async (request, reply) => {
    try {
      const { type } = request.params as { type: string };
      const updateData = request.body as Omit<UpdateRetentionPolicyRequest, 'id'>;

      // Get existing policy
      const existingPolicy = await retentionService.getRetentionPolicyByType(type);
      if (!existingPolicy) {
        return reply.code(404).send({ error: `Retention policy for ${type} not found` });
      }

      // Update policy
      const updatedPolicy = await retentionService.updateRetentionPolicy({
        ...existingPolicy,
        ...updateData
      });

      return { policy: updatedPolicy };
    } catch (error) {
      fastify.log.error('Error updating retention policy:', error);
      return reply.code(500).send({ error: 'Failed to update retention policy' });
    }
  });

  /**
   * POST /api/admin/disk/cleanup
   * Trigger manual cleanup
   */
  fastify.post('/cleanup', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        properties: {
          dataType: { type: 'string' },
          force: { type: 'boolean', default: false },
          estimateOnly: { type: 'boolean', default: false }
        },
        required: ['dataType']
      }
    }
  }, async (request, reply) => {
    try {
      const { dataType, force = false, estimateOnly = false } = request.body as CleanupRequest;

      if (estimateOnly) {
        const estimate = await retentionService.estimateCleanup(dataType);
        return { estimate };
      }

      const operation = await retentionService.performCleanup(dataType, force);
      return { operation };
    } catch (error) {
      fastify.log.error('Error performing cleanup:', error);
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to perform cleanup' 
      });
    }
  });

  /**
   * GET /api/admin/disk/cleanup/estimate
   * Estimate cleanup impact
   */
  fastify.get('/cleanup/estimate', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          dataType: { type: 'string' }
        },
        required: ['dataType']
      }
    }
  }, async (request, reply) => {
    try {
      const { dataType } = request.query as { dataType: string };
      const estimate = await retentionService.estimateCleanup(dataType);
      return { estimate };
    } catch (error) {
      fastify.log.error('Error estimating cleanup:', error);
      return reply.code(500).send({ 
        error: error instanceof Error ? error.message : 'Failed to estimate cleanup' 
      });
    }
  });

  /**
   * POST /api/admin/disk/vacuum
   * Database optimization
   */
  fastify.post('/vacuum', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        properties: {
          analyze: { type: 'boolean', default: true },
          incremental: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { analyze = true } = request.body as VacuumRequest;
      const result = await diskService.vacuumDatabase(analyze);
      return { result };
    } catch (error) {
      fastify.log.error('Error performing vacuum:', error);
      return reply.code(500).send({ error: 'Failed to perform database vacuum' });
    }
  });

  /**
   * GET /api/admin/disk/predictions
   * Storage growth predictions
   */
  fastify.get('/predictions', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'number', default: 30 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { days = 30 } = request.query as { days?: number };
      const metrics = await diskService.getDiskUsageMetrics();
      
      // Transform backend StoragePrediction[] to frontend PredictionMetrics format
      const transformedPredictions = metrics.predictions.map(p => ({
        days: p.timeframe === '30d' ? 30 : p.timeframe === '60d' ? 60 : p.timeframe === '90d' ? 90 : 180,
        predictedSize: p.predictedSizeBytes,
        confidence: p.confidenceLevel / 100, // Convert 0-100 to 0-1
        category: 'realistic' as const
      }));
      
      // Calculate growth rates from table data
      const totalDailyGrowth = metrics.growthRates.reduce((sum, rate) => sum + rate.dailyGrowthBytes, 0);
      const totalWeeklyGrowth = metrics.growthRates.reduce((sum, rate) => sum + rate.weeklyGrowthBytes, 0);
      
      // Calculate thresholds based on total space
      const warningThreshold = metrics.totalSpace * 0.8;
      const criticalThreshold = metrics.totalSpace * 0.9;
      
      // Generate recommendations based on current usage
      const recommendations = [];
      if (metrics.totalDatabaseSize > criticalThreshold) {
        recommendations.push({
          type: 'cleanup' as const,
          priority: 'high' as const,
          title: 'Critical: Immediate cleanup required',
          description: 'Database size has exceeded critical threshold. Immediate cleanup is required to prevent system issues.',
          expectedSavings: totalDailyGrowth * 30
        });
      } else if (metrics.totalDatabaseSize > warningThreshold) {
        recommendations.push({
          type: 'optimization' as const,
          priority: 'medium' as const,
          title: 'Warning: Review retention policies',
          description: 'Database size is approaching warning threshold. Consider reviewing and updating retention policies.',
          expectedSavings: totalDailyGrowth * 14
        });
      } else {
        recommendations.push({
          type: 'capacity' as const,
          priority: 'low' as const,
          title: 'Monitor usage trends',
          description: 'Database size is within normal limits. Continue monitoring usage trends and growth patterns.',
        });
      }
      
      const predictionMetrics = {
        currentSize: metrics.totalDatabaseSize,
        dailyGrowthRate: totalDailyGrowth,
        weeklyGrowthRate: totalWeeklyGrowth,
        monthlyGrowthRate: totalDailyGrowth * 30,
        predictions: transformedPredictions,
        recommendations,
        thresholds: {
          warning: warningThreshold,
          critical: criticalThreshold
        }
      };
      
      return predictionMetrics;
    } catch (error) {
      fastify.log.error('Error getting predictions:', error);
      return reply.code(500).send({ error: 'Failed to get storage predictions' });
    }
  });

  /**
   * GET /api/admin/disk/cleanup/history
   * Get cleanup operation history
   */
  fastify.get('/cleanup/history', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50 },
          dataType: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { limit = 50, dataType } = request.query as { limit?: number; dataType?: string };
      
      let query = `
        SELECT * FROM data_cleanup_logs 
        ${dataType ? 'WHERE data_type = ?' : ''}
        ORDER BY completed_at DESC 
        LIMIT ${limit}
      `;
      
      const params = dataType ? [dataType] : [];
      const history = fastify.db.prepare(query).all(params);
      
      return { history };
    } catch (error) {
      fastify.log.error('Error getting cleanup history:', error);
      return reply.code(500).send({ error: 'Failed to get cleanup history' });
    }
  });

  /**
   * GET /api/admin/disk/jobs
   * Get active cleanup jobs
   */
  fastify.get('/jobs', {
    preHandler: requireAdmin
  }, async (request, reply) => {
    try {
      const jobs = retentionService.getActiveJobs();
      return { jobs };
    } catch (error) {
      fastify.log.error('Error getting active jobs:', error);
      return reply.code(500).send({ error: 'Failed to get active jobs' });
    }
  });

  /**
   * POST /api/admin/disk/schedule-cleanup
   * Schedule cleanup jobs
   */
  fastify.post('/schedule-cleanup', {
    preHandler: requireAdmin
  }, async (request, reply) => {
    try {
      await retentionService.scheduleCleanupJobs();
      return { message: 'Cleanup jobs scheduled successfully' };
    } catch (error) {
      fastify.log.error('Error scheduling cleanup jobs:', error);
      return reply.code(500).send({ error: 'Failed to schedule cleanup jobs' });
    }
  });
} 