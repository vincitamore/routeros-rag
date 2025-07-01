import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from 'better-sqlite3';

/**
 * Monitoring Routes
 * 
 * Handles real-time monitoring data collection and retrieval
 * for RouterOS devices in the network monitoring portal.
 */

async function monitoringRoutes(fastify: FastifyInstance) {
  const db = fastify.db as Database;

  /**
   * GET /api/monitoring/devices - Get monitoring data for all devices
   */
  fastify.get('/devices', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'integer', minimum: 0, default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            devices: { type: 'array' },
            total: { type: 'number' },
            limit: { type: 'number' },
            offset: { type: 'number' }
          },
          required: ['devices', 'total', 'limit', 'offset']
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: { limit?: number; offset?: number } 
  }>, reply: FastifyReply) => {
    try {
      const { limit = 50, offset = 0 } = request.query;

      // Get devices with basic monitoring status
      const devices = db.prepare(`
        SELECT id, name, ip_address, status, last_seen, 
               routeros_version, board_name, architecture
        FROM devices 
        ORDER BY last_seen DESC 
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      const total = db.prepare('SELECT COUNT(*) as count FROM devices').get() as { count: number };

      reply.send({
        devices,
        total: total.count,
        limit,
        offset
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve monitoring data' });
    }
  });

  /**
   * GET /api/monitoring/devices/:id - Get detailed monitoring data for specific device
   */
  fastify.get('/devices/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          duration: { type: 'integer', minimum: 1 },
          unit: { type: 'string', enum: ['minute', 'hour', 'day'] },
          hours: { type: 'integer', minimum: 1 } // Backward compatibility
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Querystring: { 
      duration?: number; 
      unit?: 'minute' | 'hour' | 'day';
      hours?: number; // Backward compatibility
    } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      let { duration, unit, hours } = request.query;

      // Handle backward compatibility for 'hours' parameter
      if (hours && !duration) {
        duration = hours;
        unit = 'hour';
        fastify.log.info(`Using backward compatibility: hours=${hours} converted to duration=${duration}, unit=${unit}`);
      }

      // Set defaults
      duration = duration || 24;
      unit = unit || 'hour';

      fastify.log.info(`Processing request for device ${id} with duration=${duration}, unit=${unit}`);

      const device = db.prepare(`
        SELECT * FROM devices WHERE id = ?
      `).get(id);

      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Get latest system metrics
      const latestMetrics = db.prepare(`
        SELECT * FROM system_metrics 
        WHERE device_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `).get(id);

      // Validate unit to prevent SQL injection
      const validUnits = ['minute', 'hour', 'day'];
      if (!validUnits.includes(unit)) {
        return reply.status(400).send({ error: 'Invalid time unit' });
      }

      // Construct time modifier for SQLite query and build the query string
      const timeModifier = `-${duration} ${unit}s`;
      const query = `
        SELECT 
          id, device_id, cpu_load, free_memory, total_memory, free_hdd_space, total_hdd_space, uptime, temperature, voltage,
          timestamp
        FROM system_metrics 
        WHERE device_id = ? 
        AND timestamp >= datetime('now', '${timeModifier}')
        ORDER BY timestamp ASC
      `;

      // Get historical metrics
      const historicalMetrics = db.prepare(query).all(id);
      
      fastify.log.info(`Fetched ${historicalMetrics.length} historical metrics for device ${id} over the last ${duration} ${unit}s.`);

      // Convert timestamps to consistent format (ISO strings) for frontend processing
      const processedHistoricalMetrics = historicalMetrics.map((metric: any) => ({
        ...metric,
        timestamp: new Date(metric.timestamp).toISOString()
      }));

      // Check if monitoring service is available
      const monitoringService = (fastify as any).monitoringService;
      const isMonitoring = monitoringService ? 
        monitoringService.getMonitoringStatus()[id] || false : false;

      const responseData = {
        device,
        monitoring: {
          isActive: isMonitoring,
          latest: latestMetrics,
          historical: processedHistoricalMetrics,
          timeRange: `${duration} ${unit}s`
        }
      };
      
      reply.send(responseData);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve device monitoring data' });
    }
  });

  /**
   * GET /api/devices/:id/monitoring/interfaces - Get historical interface metrics
   */
  fastify.get('/devices/:id/monitoring/interfaces', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          hours: { type: 'integer', minimum: 1, default: 24 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Querystring: { hours?: number } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { hours = 24 } = request.query;

      // Check if monitoring service is available and has the required method
      const monitoringService = (fastify as any).monitoringService;
      if (!monitoringService || typeof monitoringService.getHistoricalInterfaceMetrics !== 'function') {
        return reply.status(503).send({ error: 'Interface monitoring service not available' });
      }

      const historicalMetrics = monitoringService.getHistoricalInterfaceMetrics(id, hours);

      fastify.log.info(`Fetched ${historicalMetrics.length} historical interface metrics for device ${id} over the last ${hours} hours.`);

      reply.send({
        historical: historicalMetrics
      });

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve historical interface metrics' });
    }
  });

  /**
   * POST /api/monitoring/devices/:id/start - Start monitoring for a device
   */
  fastify.post('/devices/:id/start', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      // Check if device exists
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Check if monitoring service is available
      const monitoringService = (fastify as any).monitoringService;
      if (!monitoringService) {
        return reply.status(503).send({ error: 'Monitoring service not available' });
      }

      await monitoringService.startMonitoring(id);

      reply.send({
        success: true,
        message: `Started monitoring device ${id}`
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to start monitoring' });
    }
  });

  /**
   * POST /api/monitoring/devices/:id/stop - Stop monitoring for a device
   */
  fastify.post('/devices/:id/stop', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      // Check if device exists
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Check if monitoring service is available
      const monitoringService = (fastify as any).monitoringService;
      if (!monitoringService) {
        return reply.status(503).send({ error: 'Monitoring service not available' });
      }

      await monitoringService.stopMonitoring(id);

      reply.send({
        success: true,
        message: `Stopped monitoring device ${id}`
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to stop monitoring' });
    }
  });

  /**
   * GET /api/monitoring/metrics - Get system metrics overview
   */
  fastify.get('/metrics', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            totalDevices: { type: 'number' },
            connectedDevices: { type: 'number' },
            disconnectedDevices: { type: 'number' },
            errorDevices: { type: 'number' },
            monitoringStatus: { type: 'object' }
          },
          required: ['totalDevices', 'connectedDevices', 'disconnectedDevices', 'errorDevices']
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const totalDevices = db.prepare('SELECT COUNT(*) as count FROM devices').get() as { count: number };
      const connectedDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'connected'").get() as { count: number };
      const disconnectedDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'disconnected'").get() as { count: number };
      const errorDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'error'").get() as { count: number };

      // Get monitoring status if service is available
      const monitoringService = (fastify as any).monitoringService;
      const monitoringStatus = monitoringService ? 
        monitoringService.getMonitoringStatus() : {};

      reply.send({
        totalDevices: totalDevices.count,
        connectedDevices: connectedDevices.count,
        disconnectedDevices: disconnectedDevices.count,
        errorDevices: errorDevices.count,
        monitoringStatus
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve metrics' });
    }
  });

  /**
   * POST /api/monitoring/refresh - Refresh and start monitoring new devices
   */
  fastify.post('/refresh', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        },
        503: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if monitoring service is available
      const monitoringService = (fastify as any).monitoringService;
      if (!monitoringService) {
        return reply.status(503).send({ error: 'Monitoring service not available' });
      }

      await monitoringService.refreshDevices();

      reply.send({
        success: true,
        message: 'Device monitoring refreshed successfully'
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to refresh device monitoring' });
    }
  });

  /**
   * GET /api/monitoring/status - Get monitoring service status
   */
  fastify.get('/status', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            serviceAvailable: { type: 'boolean' },
            activeDevices: { type: 'number' },
            webSocketClients: { type: 'number' },
            uptime: { type: 'number' }
          },
          required: ['serviceAvailable', 'activeDevices']
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const monitoringService = (fastify as any).monitoringService;
      const webSocketServer = (fastify as any).webSocketServer;
      
      if (!monitoringService) {
        return reply.send({
          serviceAvailable: false,
          activeDevices: 0
        });
      }

      const monitoringStatus = monitoringService.getMonitoringStatus();
      const activeDevices = Object.keys(monitoringStatus).length;
      const webSocketClients = webSocketServer ? webSocketServer.getConnectedClientsCount() : 0;

      reply.send({
        serviceAvailable: true,
        activeDevices,
        webSocketClients,
        uptime: process.uptime()
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve monitoring status' });
    }
  });

  /**
   * POST /api/monitoring/devices/:id/reset-counters - Reset interface counters for a device
   */
  fastify.post('/devices/:id/reset-counters', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          interfaceName: { 
            type: 'string',
            description: 'Specific interface name to reset counters for. If not provided, resets all interfaces.'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }, 
    Body: { interfaceName?: string } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { interfaceName } = request.body || {};

      // Check if device exists and get its connection info
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as any;
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Import RouterOSClient
      const { RouterOSClient } = await import('../lib/routeros-client');
      
      // Create client connection
      const client = new RouterOSClient({
        host: device.ip_address,
        port: device.port || 8728,
        username: device.username,
        password: device.password,
        useSSL: device.use_ssl
      });

      // Reset interface counters
      const result = await client.resetInterfaceCounters(interfaceName);
      
      if (!result.success) {
        return reply.status(500).send({ 
          error: `Failed to reset interface counters: ${result.error}` 
        });
      }

      const message = interfaceName 
        ? `Successfully reset counters for interface ${interfaceName}` 
        : 'Successfully reset counters for all interfaces';

      reply.send({
        success: true,
        message
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        error: 'Failed to reset interface counters' 
      });
    }
  });

  /**
   * GET /api/monitoring/devices/:id/connection-tracking - Get connection tracking data
   */
  fastify.get('/devices/:id/connection-tracking', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      querystring: {
        type: 'object',
        properties: {
          hours: { type: 'integer', minimum: 1, default: 1 },
          live: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Querystring: { hours?: number; live?: boolean } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { hours = 1, live = false } = request.query;

      // Check if monitoring service is available
      const monitoringService = (fastify as any).monitoringService;
      if (!monitoringService) {
        return reply.status(503).send({ error: 'Monitoring service not available' });
      }

      let connections;
      if (live) {
        // Get current live connection tracking data
        const rawConnections = await monitoringService.getCurrentConnectionTracking(id);
        const currentTime = new Date();
        
        // Add timestamp to live data for consistency
        connections = rawConnections.map((conn: any) => ({
          device_id: id,
          src_address: conn['src-address'] || null,
          dst_address: conn['dst-address'] || null,
          src_port: parseInt(conn['src-port']) || null,
          dst_port: parseInt(conn['dst-port']) || null,
          protocol: conn.protocol || null,
          state: conn.state || null,
          tcp_state: conn['tcp-state'] || null,
          connection: conn.connection || null,
          timeout: parseInt(conn.timeout) || null,
          orig_bytes: parseInt(conn['orig-bytes']) || null,
          repl_bytes: parseInt(conn['repl-bytes']) || null,
          orig_packets: parseInt(conn['orig-packets']) || null,
          repl_packets: parseInt(conn['repl-packets']) || null,
          orig_rate: conn['orig-rate'] || null,
          repl_rate: conn['repl-rate'] || null,
          assured: conn.assured === 'true',
          seen_reply: conn['seen-reply'] === 'true',
          timestamp: currentTime.toISOString()
        }));
      } else {
        // Get historical connection tracking data
        const historicalConnections = monitoringService.getConnectionTracking(id, hours);
        
        // Convert Date objects to ISO strings for consistent JSON serialization
        connections = historicalConnections.map((conn: any) => ({
          ...conn,
          timestamp: conn.timestamp.toISOString()
        }));
      }

      fastify.log.info(`Fetched ${connections.length} connection tracking entries for device ${id} (${live ? 'live' : `${hours}h history`})`);

      reply.send({
        connections,
        mode: live ? 'live' : 'historical',
        timeRange: live ? 'current' : `${hours} hours`
      });

    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve connection tracking data' });
    }
  });

  /**
   * POST /api/monitoring/devices/:id/interface-state - Enable or disable an interface
   */
  fastify.post('/devices/:id/interface-state', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          interfaceName: { 
            type: 'string',
            description: 'Name of the interface to enable/disable'
          },
          enabled: {
            type: 'boolean',
            description: 'True to enable the interface, false to disable'
          }
        },
        required: ['interfaceName', 'enabled']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          },
          required: ['error']
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }, 
    Body: { interfaceName: string; enabled: boolean } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { interfaceName, enabled } = request.body;

      // Check if device exists and get its connection info
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as any;
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Import RouterOSClient
      const { RouterOSClient } = await import('../lib/routeros-client');
      
      // Create client connection
      const client = new RouterOSClient({
        host: device.ip_address,
        port: device.port || 8728,
        username: device.username,
        password: device.password,
        useSSL: device.use_ssl
      });

      // Set interface state
      const result = await client.setInterfaceState(interfaceName, enabled);
      
      if (!result.success) {
        return reply.status(500).send({ 
          error: `Failed to ${enabled ? 'enable' : 'disable'} interface: ${result.error}` 
        });
      }

      const message = `Successfully ${enabled ? 'enabled' : 'disabled'} interface ${interfaceName}`;

      reply.send({
        success: true,
        message
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        error: `Failed to ${request.body.enabled ? 'enable' : 'disable'} interface` 
      });
    }
  });
}

export default monitoringRoutes; 