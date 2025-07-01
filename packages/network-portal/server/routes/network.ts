import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from 'better-sqlite3';

/**
 * Network Routes
 * 
 * Handles network topology discovery, DHCP lease monitoring, and traffic statistics
 * for RouterOS devices in the network monitoring portal.
 */

async function networkRoutes(fastify: FastifyInstance) {
  const db = fastify.db as Database;

  /**
   * GET /api/network/devices/:id/topology - Get network topology for device
   */
  fastify.get('/devices/:id/topology', {
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

      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      // Get latest topology
      const latestTopology = db.prepare(`
        SELECT * FROM network_topology 
        WHERE device_id = ? 
        ORDER BY discovery_timestamp DESC 
        LIMIT 1
      `).get(id) as any;

      // Get topology history
      const topologyHistory = db.prepare(`
        SELECT * FROM network_topology 
        WHERE device_id = ? 
        AND discovery_timestamp >= datetime('now', '-' || ? || ' hours')
        ORDER BY discovery_timestamp DESC
      `).all(id, hours) as any[];

      // Check if network service is available
      const networkService = (fastify as any).networkService;
      const isDiscovering = networkService ? 
        networkService.getServiceStatus()[id]?.topology || false : false;

      const responseData = {
        device,
        topology: {
          isActive: isDiscovering,
          latest: latestTopology ? JSON.parse(latestTopology.topology_data) : null,
          history: topologyHistory.map((h: any) => ({
            ...JSON.parse(h.topology_data),
            discovery_timestamp: h.discovery_timestamp
          })),
          timeRange: `${hours} hours`
        }
      };

      reply.send(responseData);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve network topology' });
    }
  });

  /**
   * POST /api/network/devices/:id/topology/start - Start topology discovery
   */
  fastify.post('/devices/:id/topology/start', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      const networkService = (fastify as any).networkService;
      if (!networkService) {
        return reply.status(503).send({ error: 'Network service not available' });
      }

      await networkService.startTopologyDiscovery(id);
      
      reply.send({ 
        success: true, 
        message: `Started topology discovery for device ${id}` 
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to start topology discovery' });
    }
  });

  /**
   * POST /api/network/devices/:id/topology/stop - Stop topology discovery
   */
  fastify.post('/devices/:id/topology/stop', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const networkService = (fastify as any).networkService;
      if (!networkService) {
        return reply.status(503).send({ error: 'Network service not available' });
      }

      await networkService.stopTopologyDiscovery(id);
      
      reply.send({ 
        success: true, 
        message: `Stopped topology discovery for device ${id}` 
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to stop topology discovery' });
    }
  });

  /**
   * POST /api/network/devices/:id/traffic/start - Start traffic monitoring
   */
  fastify.post('/devices/:id/traffic/start', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      const networkService = (fastify as any).networkService;
      if (!networkService) {
        return reply.status(503).send({ error: 'Network service not available' });
      }

      await networkService.startTrafficMonitoring(id);
      
      reply.send({ 
        success: true, 
        message: `Started traffic monitoring for device ${id}` 
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to start traffic monitoring' });
    }
  });

  /**
   * POST /api/network/devices/:id/traffic/stop - Stop traffic monitoring
   */
  fastify.post('/devices/:id/traffic/stop', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;

      const networkService = (fastify as any).networkService;
      if (!networkService) {
        return reply.status(503).send({ error: 'Network service not available' });
      }

      await networkService.stopTrafficMonitoring(id);
      
      reply.send({ 
        success: true, 
        message: `Stopped traffic monitoring for device ${id}` 
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to stop traffic monitoring' });
    }
  });

  /**
   * GET /api/network/settings/traffic-monitoring/:deviceId? - Get traffic monitoring preference
   */
  fastify.get('/settings/traffic-monitoring/:deviceId?', {
    schema: {
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { deviceId?: string } 
  }>, reply: FastifyReply) => {
    try {
      const { deviceId } = request.params;

      const networkService = (fastify as any).networkService;
      if (!networkService) {
        return reply.status(503).send({ error: 'Network service not available' });
      }

      const enabled = deviceId 
        ? networkService.shouldAutoStartTrafficMonitoring(deviceId)
        : networkService.getUserSetting('traffic_monitoring_default') === 'true';
      
      reply.send({ 
        enabled,
        deviceId: deviceId || null
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to get traffic monitoring preference' });
    }
  });

  /**
   * POST /api/network/settings/traffic-monitoring/:deviceId? - Set traffic monitoring preference
   */
  fastify.post('/settings/traffic-monitoring/:deviceId?', {
    schema: {
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' }
        },
        required: ['enabled']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { deviceId?: string };
    Body: { enabled: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { deviceId } = request.params;
      const { enabled } = request.body;

      const networkService = (fastify as any).networkService;
      if (!networkService) {
        return reply.status(503).send({ error: 'Network service not available' });
      }

      if (deviceId) {
        // Set device-specific preference
        networkService.setUserSetting('traffic_monitoring_enabled', enabled.toString(), deviceId);
        
        // Start or stop monitoring based on preference
        if (enabled && !networkService.trafficJobs.has(deviceId)) {
          await networkService.startTrafficMonitoring(deviceId);
        } else if (!enabled && networkService.trafficJobs.has(deviceId)) {
          await networkService.stopTrafficMonitoring(deviceId);
        }
      } else {
        // Set global default preference
        networkService.setUserSetting('traffic_monitoring_default', enabled.toString());
      }
      
      reply.send({ 
        success: true,
        enabled,
        deviceId: deviceId || null,
        message: `Traffic monitoring preference ${enabled ? 'enabled' : 'disabled'}${deviceId ? ` for device ${deviceId}` : ' globally'}`
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to set traffic monitoring preference' });
    }
  });

  /**
   * GET /api/network/devices/:id/dhcp-leases - Get DHCP leases
   */
  fastify.get('/devices/:id/dhcp-leases', {
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
          hours: { type: 'integer', minimum: 1, default: 24 },
          active_only: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Querystring: { hours?: number; active_only?: boolean } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { hours = 24, active_only = false } = request.query;

      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      let query = `
        SELECT * FROM dhcp_leases_history 
        WHERE device_id = ? 
        AND last_seen >= datetime('now', '-' || ? || ' hours')
      `;
      
      if (active_only) {
        query += ' AND is_active = 1';
      }
      
      query += ' ORDER BY last_seen DESC';

      const leases = db.prepare(query).all(id, hours);

      reply.send({
        device,
        dhcp_leases: leases,
        count: leases.length,
        timeRange: `${hours} hours`,
        activeOnly: active_only
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve DHCP leases' });
    }
  });

  /**
   * GET /api/network/devices/:id/arp-entries - Get ARP table entries
   */
  fastify.get('/devices/:id/arp-entries', {
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
          hours: { type: 'integer', minimum: 1, default: 24 },
          complete_only: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Querystring: { hours?: number; complete_only?: boolean } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { hours = 24, complete_only = false } = request.query;

      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      let query = `
        SELECT * FROM arp_entries_history 
        WHERE device_id = ? 
        AND last_seen >= datetime('now', '-' || ? || ' hours')
      `;
      
      if (complete_only) {
        query += ' AND is_complete = 1';
      }
      
      query += ' ORDER BY last_seen DESC';

      const arpEntries = db.prepare(query).all(id, hours);

      reply.send({
        device,
        arp_entries: arpEntries,
        count: arpEntries.length,
        timeRange: `${hours} hours`,
        completeOnly: complete_only
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve ARP entries' });
    }
  });

  /**
   * GET /api/network/devices/:id/traffic-stats - Get traffic statistics
   */
  fastify.get('/devices/:id/traffic-stats', {
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
          interface: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Querystring: { hours?: number; interface?: string } 
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { hours = 1, interface: interfaceName } = request.query;

      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
      if (!device) {
        return reply.status(404).send({ error: 'Device not found' });
      }

      let query = `
        SELECT * FROM traffic_statistics 
        WHERE device_id = ? 
        AND timestamp >= datetime('now', '-' || ? || ' hours')
      `;
      const params: any[] = [id, hours];

      if (interfaceName) {
        query += ' AND interface_name = ?';
        params.push(interfaceName);
      }

      query += ' ORDER BY timestamp ASC';

      const trafficStats = db.prepare(query).all(...params);

      const responseData = {
        device,
        traffic_statistics: trafficStats,
        count: trafficStats.length,
        timeRange: `${hours} hours`,
        interface: interfaceName || 'all'
      };

      reply.send(responseData);
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve traffic statistics' });
    }
  });

  /**
   * GET /api/network/overview - Get network overview for all devices
   */
  fastify.get('/overview', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Querystring: { limit?: number } 
  }>, reply: FastifyReply) => {
    try {
      const { limit = 50 } = request.query;

      // Get devices with latest topology info
      const devices = db.prepare(`
        SELECT 
          d.id, d.name, d.ip_address, d.status, d.last_seen,
          nt.nodes_count, nt.discovery_timestamp
        FROM devices d
        LEFT JOIN (
          SELECT device_id, nodes_count, discovery_timestamp,
                 ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY discovery_timestamp DESC) as rn
          FROM network_topology
        ) nt ON d.id = nt.device_id AND nt.rn = 1
        ORDER BY d.last_seen DESC
        LIMIT ?
      `).all(limit);

      // Get overall statistics
      const stats = {
        total_devices: devices.length,
        active_devices: devices.filter((d: any) => d.status === 'connected').length,
        total_network_nodes: devices.reduce((sum: number, d: any) => sum + (d.nodes_count || 0), 0),
        devices_with_topology: devices.filter((d: any) => d.discovery_timestamp).length
      };

      // Get service status for traffic monitoring and topology discovery
      const networkService = (fastify as any).networkService;
      const serviceStatus = networkService ? networkService.getServiceStatus() : {};

      reply.send({
        devices,
        statistics: stats,
        serviceStatus
      });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Failed to retrieve network overview' });
    }
  });
}

export default networkRoutes; 