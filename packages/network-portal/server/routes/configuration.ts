import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Database } from 'better-sqlite3';
import { ConfigurationService } from '../services/configuration-service';
import { IPsecService } from '../services/ipsec-service';

/**
 * Configuration Routes
 * 
 * Handles RouterOS device configuration management
 * for the network monitoring portal.
 */

async function configurationRoutes(fastify: FastifyInstance) {
  const db = fastify.db as Database;
  const configService = new ConfigurationService(db);
  const ipsecService = new IPsecService(db);

  // ==================== IP ADDRESS MANAGEMENT ====================

  /**
   * GET /api/config/devices/:id/ip-addresses - Get IP addresses
   */
  fastify.get('/devices/:id/ip-addresses', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const addresses = await configService.getIPAddresses(id);
      reply.send({ addresses });
    } catch (error) {
      fastify.log.error('Failed to get IP addresses:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve IP addresses' });
    }
  });

  /**
   * POST /api/config/devices/:id/ip-addresses - Add IP address
   */
  fastify.post('/devices/:id/ip-addresses', {
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
          address: { type: 'string' },
          interface: { type: 'string' },
          comment: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['address', 'interface']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { address: string, interface: string, comment?: string, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { address, interface: interfaceName, comment, userId } = request.body;
      
      const result = await configService.addIPAddress(id, address, interfaceName, comment, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to add IP address:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to add IP address' });
    }
  });

  /**
   * PUT /api/config/devices/:id/ip-addresses/:addressId - Update IP address
   */
  fastify.put('/devices/:id/ip-addresses/:addressId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          addressId: { type: 'string' }
        },
        required: ['id', 'addressId']
      },
      body: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          interface: { type: 'string' },
          comment: { type: 'string' },
          disabled: { type: 'boolean' },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, addressId: string },
    Body: { [key: string]: any }
  }>, reply: FastifyReply) => {
    try {
      const { id, addressId } = request.params;
      const { userId, ...updates } = request.body as { userId?: string, [key: string]: any };
      
      const result = await configService.updateIPAddress(id, addressId, updates, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to update IP address:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to update IP address' });
    }
  });

  /**
   * DELETE /api/config/devices/:id/ip-addresses/:addressId - Remove IP address
   */
  fastify.delete('/devices/:id/ip-addresses/:addressId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          addressId: { type: 'string' }
        },
        required: ['id', 'addressId']
      },
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, addressId: string },
    Querystring: { userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, addressId } = request.params;
      const { userId } = request.query;
      
      await configService.removeIPAddress(id, addressId, userId);
      reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Failed to remove IP address:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to remove IP address' });
    }
  });

  // ==================== ROUTING MANAGEMENT ====================

  /**
   * GET /api/config/devices/:id/routes - Get routes
   */
  fastify.get('/devices/:id/routes', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const routes = await configService.getRoutes(id);
      reply.send({ routes });
    } catch (error) {
      fastify.log.error('Failed to get routes:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve routes' });
    }
  });

  /**
   * POST /api/config/devices/:id/routes - Add route
   */
  fastify.post('/devices/:id/routes', {
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
          'dst-address': { type: 'string' },
          gateway: { type: 'string' },
          interface: { type: 'string' },
          distance: { type: 'number' },
          comment: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['dst-address']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { [key: string]: any, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId, ...routeData } = request.body;
      
      const result = await configService.addRoute(id, routeData, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to add route:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to add route' });
    }
  });

  // ==================== FIREWALL MANAGEMENT ====================

  /**
   * GET /api/config/devices/:id/firewall-rules - Get firewall rules
   */
  fastify.get('/devices/:id/firewall-rules', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const rules = await configService.getFirewallRules(id);
      reply.send({ rules });
    } catch (error) {
      fastify.log.error('Failed to get firewall rules:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve firewall rules' });
    }
  });

  /**
   * POST /api/config/devices/:id/firewall-rules - Add firewall rule
   */
  fastify.post('/devices/:id/firewall-rules', {
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
          chain: { type: 'string' },
          action: { type: 'string' },
          'src-address': { type: 'string' },
          'dst-address': { type: 'string' },
          'src-port': { type: 'string' },
          'dst-port': { type: 'string' },
          protocol: { type: 'string' },
          comment: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['chain', 'action']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { [key: string]: any, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId, ...ruleData } = request.body;
      
      const result = await configService.addFirewallRule(id, ruleData, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to add firewall rule:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to add firewall rule' });
    }
  });

  // ==================== NAT RULES MANAGEMENT ====================

  /**
   * GET /api/config/devices/:id/nat-rules - Get NAT rules
   */
  fastify.get('/devices/:id/nat-rules', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const rules = await configService.getNATRules(id);
      reply.send({ rules });
    } catch (error) {
      fastify.log.error('Failed to get NAT rules:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve NAT rules' });
    }
  });

  /**
   * POST /api/config/devices/:id/nat-rules - Add NAT rule
   */
  fastify.post('/devices/:id/nat-rules', {
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
          chain: { type: 'string' },
          action: { type: 'string' },
          'src-address': { type: 'string' },
          'dst-address': { type: 'string' },
          'src-port': { type: 'string' },
          'dst-port': { type: 'string' },
          protocol: { type: 'string' },
          'out-interface': { type: 'string' },
          'in-interface': { type: 'string' },
          'to-addresses': { type: 'string' },
          'to-ports': { type: 'string' },
          comment: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['chain', 'action']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { [key: string]: any, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId, ...ruleData } = request.body;
      
      const result = await configService.addNATRule(id, ruleData, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to add NAT rule:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to add NAT rule' });
    }
  });

  /**
   * PUT /api/config/devices/:id/nat-rules/:ruleId - Update NAT rule
   */
  fastify.put('/devices/:id/nat-rules/:ruleId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ruleId: { type: 'string' }
        },
        required: ['id', 'ruleId']
      },
      body: {
        type: 'object',
        properties: {
          chain: { type: 'string' },
          action: { type: 'string' },
          'src-address': { type: 'string' },
          'dst-address': { type: 'string' },
          'src-port': { type: 'string' },
          'dst-port': { type: 'string' },
          protocol: { type: 'string' },
          'out-interface': { type: 'string' },
          'in-interface': { type: 'string' },
          'to-addresses': { type: 'string' },
          'to-ports': { type: 'string' },
          comment: { type: 'string' },
          disabled: { type: 'boolean' },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, ruleId: string },
    Body: { [key: string]: any, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, ruleId } = request.params;
      const { userId, ...updates } = request.body;
      
      const result = await configService.updateNATRule(id, ruleId, updates, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to update NAT rule:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to update NAT rule' });
    }
  });

  /**
   * DELETE /api/config/devices/:id/nat-rules/:ruleId - Remove NAT rule
   */
  fastify.delete('/devices/:id/nat-rules/:ruleId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ruleId: { type: 'string' }
        },
        required: ['id', 'ruleId']
      },
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, ruleId: string },
    Querystring: { userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, ruleId } = request.params;
      const { userId } = request.query;
      
      await configService.removeNATRule(id, ruleId, userId);
      reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Failed to remove NAT rule:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to remove NAT rule' });
    }
  });

  // ==================== ADDRESS LISTS MANAGEMENT ====================

  /**
   * GET /api/config/devices/:id/address-lists - Get address lists
   */
  fastify.get('/devices/:id/address-lists', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const lists = await configService.getAddressLists(id);
      reply.send({ entries: lists });
    } catch (error) {
      fastify.log.error('Failed to get address lists:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve address lists' });
    }
  });

  /**
   * POST /api/config/devices/:id/address-lists - Add address list entry
   */
  fastify.post('/devices/:id/address-lists', {
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
          list: { type: 'string' },
          address: { type: 'string' },
          comment: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['list', 'address']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { list: string, address: string, comment?: string, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId, ...entryData } = request.body;
      
      const result = await configService.addAddressListEntry(id, entryData, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to add address list entry:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to add address list entry' });
    }
  });

  /**
   * PUT /api/config/devices/:id/address-lists/:entryId - Update address list entry
   */
  fastify.put('/devices/:id/address-lists/:entryId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entryId: { type: 'string' }
        },
        required: ['id', 'entryId']
      },
      body: {
        type: 'object',
        properties: {
          list: { type: 'string' },
          address: { type: 'string' },
          comment: { type: 'string' },
          disabled: { type: 'boolean' },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, entryId: string },
    Body: { [key: string]: any, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, entryId } = request.params;
      const { userId, ...updates } = request.body;
      
      const result = await configService.updateAddressListEntry(id, entryId, updates, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to update address list entry:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to update address list entry' });
    }
  });

  /**
   * DELETE /api/config/devices/:id/address-lists/:entryId - Remove address list entry
   */
  fastify.delete('/devices/:id/address-lists/:entryId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entryId: { type: 'string' }
        },
        required: ['id', 'entryId']
      },
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, entryId: string },
    Querystring: { userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, entryId } = request.params;
      const { userId } = request.query;
      
      await configService.removeAddressListEntry(id, entryId, userId);
      reply.send({ success: true });
    } catch (error) {
      fastify.log.error('Failed to remove address list entry:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to remove address list entry' });
    }
  });

  // ==================== BACKUP MANAGEMENT ====================

  /**
   * POST /api/config/devices/:id/backup - Create configuration backup
   */
  fastify.post('/devices/:id/backup', {
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
          name: { type: 'string' },
          password: { type: 'string' },
          type: { type: 'string', enum: ['manual', 'scheduled', 'pre_change'] },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { name?: string, password?: string, type?: 'manual' | 'scheduled' | 'pre_change', userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { name, password, type = 'manual', userId } = request.body;

      fastify.log.info(`Creating backup for device ${id} with type ${type}`);

      const backup = await configService.createBackup(id, name, password, type, userId);
      
      fastify.log.info(`Backup created successfully for device ${id}:`, backup);
      
      reply.send({ success: true, backup });
    } catch (error) {
      fastify.log.error('Failed to create backup:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create configuration backup';
      reply.status(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/config/devices/:id/backups - Get all backups (local and device)
   */
  fastify.get('/devices/:id/backups', {
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
          include_device: { type: 'boolean' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Querystring: { include_device?: boolean }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { include_device = true } = request.query;
      
      const backups = include_device ? 
        await configService.getAllBackups(id) : 
        await configService.getBackupHistory(id);
        
      reply.send({ backups });
    } catch (error) {
      fastify.log.error('Failed to get backup history:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve backup history' });
    }
  });

  /**
   * POST /api/config/devices/:id/backup/:backupName/download - Download backup from device to local storage
   */
  fastify.post('/devices/:id/backup/:backupName/download', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          backupName: { type: 'string' }
        },
        required: ['id', 'backupName']
      },
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, backupName: string },
    Body: { userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, backupName } = request.params;
      const { userId } = request.body;
      
      const backup = await configService.downloadBackupFromDevice(id, backupName, userId);
      reply.send({ success: true, backup });
    } catch (error) {
      fastify.log.error('Failed to download backup from device:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to download backup from device' });
    }
  });

  /**
   * GET /api/config/devices/:id/backup/:backupId/download - Download backup file
   */
  fastify.get('/devices/:id/backup/:backupId/download', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          backupId: { type: 'string' }
        },
        required: ['id', 'backupId']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string, backupId: string } }>, reply: FastifyReply) => {
    try {
      const { id, backupId } = request.params;
      
      // Get backup info from all backups (local + device)
      const backups = await configService.getAllBackups(id);
      
      // Find backup by ID (ensuring string comparison)
      const backup = backups.find(b => String(b.id) === String(backupId));
      
      if (!backup) {
        return reply.status(404).send({ error: 'Backup not found' });
      }

      // Only allow downloading local backups (not device-only backups)
      if (!backup.stored_locally) {
        return reply.status(400).send({ error: 'Backup is not stored locally. Download from device first.' });
      }

      // Get backup data from database using the actual numeric ID
      const actualBackupId = backup.id.startsWith('device_') ? null : backup.id;
      if (!actualBackupId) {
        return reply.status(400).send({ error: 'Cannot download device-only backup directly' });
      }

      const backupData = fastify.db.prepare('SELECT backup_data FROM configuration_backups WHERE id = ?').get(actualBackupId) as any;
      
      if (!backupData || !backupData.backup_data) {
        return reply.status(404).send({ error: 'Backup data not found locally' });
      }

      // Set appropriate headers for file download
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${backup.backup_name}.backup"`);
      reply.send(backupData.backup_data);
    } catch (error) {
      fastify.log.error('Failed to download backup:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to download backup' });
    }
  });

  /**
   * DELETE /api/config/devices/:id/backup/:backupId - Delete a local backup
   */
  fastify.delete('/devices/:id/backup/:backupId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          backupId: { type: 'string' }
        },
        required: ['id', 'backupId']
      },
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, backupId: string },
    Querystring: { userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, backupId } = request.params;
      const { userId } = request.query;
      
      await configService.deleteLocalBackup(id, backupId, userId);
      reply.send({ success: true, message: 'Local backup deleted successfully' });
    } catch (error) {
      fastify.log.error('Failed to delete local backup:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to delete local backup' });
    }
  });

  /**
   * POST /api/config/devices/:id/backup/:backupId/restore - Restore a backup
   */
  fastify.post('/devices/:id/backup/:backupId/restore', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          backupId: { type: 'string' }
        },
        required: ['id', 'backupId']
      },
      body: {
        type: 'object',
        properties: {
          password: { type: 'string' },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, backupId: string },
    Body: { password?: string, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, backupId } = request.params;
      const { password, userId } = request.body;
      
      await configService.restoreBackup(id, backupId, password, userId);
      reply.send({ success: true, message: 'Backup restoration initiated. Device will reboot.' });
    } catch (error) {
      fastify.log.error('Failed to restore backup:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to restore backup' });
    }
  });

  /**
   * GET /api/config/devices/:id/device-backups - List backup files on RouterOS device
   */
  fastify.get('/devices/:id/device-backups', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      const device = configService['getDeviceStmt'].get(id);
      if (!device) {
        return reply.status(404).send({ error: `Device not found: ${id}` });
      }

      const { createRouterOSClient } = await import('../lib/routeros-client');
      const client = createRouterOSClient({
        host: device.ip_address,
        port: device.port || (device.use_ssl ? 443 : 80),
        username: device.username,
        password: device.password,
        useSSL: Boolean(device.use_ssl),
        timeout: 10000,
        retryAttempts: 2
      });

      const backupFiles = await client.listBackupFiles();
      client.close();
      
      if (!backupFiles.success) {
        return reply.status(500).send({ error: backupFiles.error });
      }
      
      reply.send({ backups: backupFiles.data || [] });
    } catch (error) {
      fastify.log.error('Failed to list device backup files:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to list device backup files' });
    }
  });

  /**
   * POST /api/config/devices/:id/cleanup-backups - Clean up stale backup entries
   */
  fastify.post('/devices/:id/cleanup-backups', {
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
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId } = request.body;
      
      const result = await configService.cleanupStaleBackups(id, userId);
      reply.send({ 
        success: true, 
        message: `Cleaned up ${result.deletedCount} stale backup entries`,
        deletedCount: result.deletedCount,
        errors: result.errors
      });
    } catch (error) {
      fastify.log.error('Failed to cleanup stale backups:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to cleanup stale backups' });
    }
  });

  /**
   * DELETE /api/config/devices/:id/backup/:backupId/device - Delete backup from RouterOS device
   */
  fastify.delete('/devices/:id/backup/:backupId/device', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          backupId: { type: 'string' }
        },
        required: ['id', 'backupId']
      },
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, backupId: string },
    Body: { userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, backupId } = request.params;
      const { userId } = request.body;
      
      // Get backup info from all backups (local + device)
      const backups = await configService.getAllBackups(id);
      
      // Find backup by ID (ensuring string comparison)
      const backup = backups.find(b => String(b.id) === String(backupId));
      
      if (!backup) {
        return reply.status(404).send({ error: 'Backup not found' });
      }
      
      if (!backup.available_on_device) {
        return reply.status(400).send({ error: 'Backup is not available on the RouterOS device' });
      }
      
      await configService.deleteBackupFromDevice(id, backup.backup_name, userId);
      
      return reply.send({ success: true, message: 'Backup deleted from RouterOS device successfully' });
    } catch (error) {
      console.error('Error deleting backup from device:', error);
      return reply.status(500).send({ 
        error: 'Failed to delete backup from device',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/config/devices/:id/backup/:backupId/upload - Upload backup to RouterOS device
   */
  fastify.post('/devices/:id/backup/:backupId/upload', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          backupId: { type: 'string' }
        },
        required: ['id', 'backupId']
      },
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string, backupId: string },
    Body: { userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id, backupId } = request.params;
      const { userId } = request.body;
      
      await configService.uploadBackupToDevice(id, backupId, userId);
      reply.send({ success: true, message: 'Backup uploaded to RouterOS device successfully' });
    } catch (error) {
      fastify.log.error('Failed to upload backup to device:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to upload backup to device' });
    }
  });

  /**
   * POST /api/config/devices/:id/backup/upload - Upload backup file
   */
  fastify.post('/devices/:id/backup/upload', {
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
          backupName: { type: 'string' },
          backupData: { type: 'string' }, // Base64 encoded backup file
          userId: { type: 'string' }
        },
        required: ['backupName', 'backupData']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { backupName: string, backupData: string, userId?: string }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { backupName, backupData, userId } = request.body;

      fastify.log.info(`Uploading backup ${backupName} for device ${id}`);

      // Decode base64 backup data
      const backupBuffer = Buffer.from(backupData, 'base64');
      
      // Store backup in database
      const backup = await configService.uploadBackupFile(id, backupName, backupBuffer, userId);
      
      fastify.log.info(`Backup uploaded successfully for device ${id}:`, backup);
      
      reply.send({ success: true, backup });
    } catch (error) {
      fastify.log.error('Failed to upload backup:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload backup file';
      reply.status(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/config/devices/:id/test-backup - Test backup capabilities
   */
  fastify.get('/devices/:id/test-backup', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      fastify.log.info(`Testing backup capabilities for device ${id}`);
      
      // Get the RouterOS client directly for testing
      const device = configService['getDeviceStmt'].get(id);
      if (!device) {
        return reply.status(404).send({ error: `Device not found: ${id}` });
      }

      const { createRouterOSClient } = await import('../lib/routeros-client');
      const client = createRouterOSClient({
        host: device.ip_address,
        port: device.port || (device.use_ssl ? 443 : 80),
        username: device.username,
        password: device.password,
        useSSL: Boolean(device.use_ssl),
        timeout: 10000,
        retryAttempts: 2
      });

      // Test basic connectivity and backup file listing
      const resourceTest = await client.getSystemResource();
      const identityTest = await client.getSystemIdentity();
      const backupFilesTest = await client.listBackupFiles();
      
      const testResults = {
        deviceId: id,
        deviceInfo: {
          name: device.name,
          ipAddress: device.ip_address,
          port: device.port,
          useSSL: device.use_ssl
        },
        connectivity: {
          resource: {
            success: resourceTest.success,
            error: resourceTest.error,
            data: resourceTest.success ? {
              version: resourceTest.data?.version,
              architecture: resourceTest.data?.architecture,
              boardName: resourceTest.data?.['board-name']
            } : null
          },
          identity: {
            success: identityTest.success,
            error: identityTest.error,
            data: identityTest.success ? identityTest.data : null
          },
          backupFiles: {
            success: backupFilesTest.success,
            error: backupFilesTest.error,
            count: backupFilesTest.success ? backupFilesTest.data?.length || 0 : 0
          }
        },
        backupSupport: backupFilesTest.success ? 'supported' : 'unsupported'
      };

      // Close the test client
      client.close();
      
      reply.send(testResults);
    } catch (error) {
      fastify.log.error('Failed to test backup capabilities:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to test backup capabilities';
      reply.status(500).send({ error: errorMessage });
    }
  });

  /**
   * GET /api/config/devices/:id/test-backup-api - Test backup API capabilities
   */
  fastify.get('/devices/:id/test-backup-api', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const testResult = await configService.testBackupRestoreAPI(id);
      reply.send({ success: true, data: testResult });
    } catch (error) {
      fastify.log.error('Failed to test backup API:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to test backup API' });
    }
  });

  // ==================== CHANGE TRACKING ====================

  /**
   * GET /api/config/devices/:id/changes - Get configuration change history
   */
  fastify.get('/devices/:id/changes', {
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
          limit: { type: 'number', minimum: 1, maximum: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Querystring: { limit?: number }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { limit = 50 } = request.query;
      
      const changes = await configService.getChangeHistory(id, limit);
      reply.send({ changes });
    } catch (error) {
      fastify.log.error('Failed to get change history:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve change history' });
    }
  });

  // ==================== IPSEC VPN MANAGEMENT ====================

  /**
   * GET /api/config/devices/:id/ipsec/policies - Get IPsec policies
   */
  fastify.get('/devices/:id/ipsec/policies', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      console.log(`🌐 [API] GET /devices/${id}/ipsec/policies - Request received`);
      
      const policies = await ipsecService.getIPsecPolicies(id);
      console.log(`📤 [API] Sending ${policies.length} policies to frontend`);
      console.log(`📋 [API] Policies sample:`, policies.length > 0 ? policies[0] : 'none');
      
      const response = { policies };
      console.log(`📦 [API] Final response structure:`, {
        policiesCount: policies.length,
        responseKeys: Object.keys(response)
      });
      
      reply.send(response);
    } catch (error) {
      console.error(`❌ [API] Error in GET /devices/${request.params.id}/ipsec/policies:`, error);
      fastify.log.error('Failed to get IPsec policies:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve IPsec policies' });
    }
  });

  /**
   * POST /api/config/devices/:id/ipsec/policies - Add IPsec policy
   */
  fastify.post('/devices/:id/ipsec/policies', {
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
          src_address: { type: 'string' },
          dst_address: { type: 'string' },
          protocol: { type: 'string' },
          action: { type: 'string' },
          tunnel: { type: 'boolean' },
          peer_name: { type: 'string' },
          proposal_name: { type: 'string' },
          comment: { type: 'string' },
          disabled: { type: 'boolean' },
          userId: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { [key: string]: any }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId, ...policyData } = request.body;
      
      const result = await ipsecService.addIPsecPolicy(id, policyData, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to add IPsec policy:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to add IPsec policy' });
    }
  });

  /**
   * GET /api/config/devices/:id/ipsec/peers - Get IPsec peers
   */
  fastify.get('/devices/:id/ipsec/peers', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      console.log(`🌐 [API] GET /devices/${id}/ipsec/peers - Request received`);
      
      const peers = await ipsecService.getIPsecPeers(id);
      console.log(`📤 [API] Sending ${peers.length} peers to frontend`);
      console.log(`📋 [API] Peers sample:`, peers.length > 0 ? peers[0] : 'none');
      
      const response = { peers };
      console.log(`📦 [API] Final response structure:`, {
        peersCount: peers.length,
        responseKeys: Object.keys(response)
      });
      
      reply.send(response);
    } catch (error) {
      console.error(`❌ [API] Error in GET /devices/${request.params.id}/ipsec/peers:`, error);
      fastify.log.error('Failed to get IPsec peers:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve IPsec peers' });
    }
  });

  /**
   * POST /api/config/devices/:id/ipsec/peers - Add IPsec peer
   */
  fastify.post('/devices/:id/ipsec/peers', {
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
          name: { type: 'string' },
          address: { type: 'string' },
          local_address: { type: 'string' },
          exchange_mode: { type: 'string' },
          profile_name: { type: 'string' },
          passive: { type: 'boolean' },
          comment: { type: 'string' },
          disabled: { type: 'boolean' },
          userId: { type: 'string' }
        },
        required: ['name']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { [key: string]: any }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId, ...peerData } = request.body;
      
      const result = await ipsecService.addIPsecPeer(id, peerData, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to add IPsec peer:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to add IPsec peer' });
    }
  });

  /**
   * GET /api/config/devices/:id/ipsec/profiles - Get IPsec profiles
   */
  fastify.get('/devices/:id/ipsec/profiles', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      console.log(`🌐 [API] GET /devices/${id}/ipsec/profiles - Request received`);
      
      const profiles = await ipsecService.getIPsecProfiles(id);
      console.log(`📤 [API] Sending ${profiles.length} profiles to frontend`);
      console.log(`📋 [API] Profiles sample:`, profiles.length > 0 ? profiles[0] : 'none');
      
      const response = { profiles };
      console.log(`📦 [API] Final response structure:`, {
        profilesCount: profiles.length,
        responseKeys: Object.keys(response)
      });
      
      reply.send(response);
    } catch (error) {
      console.error(`❌ [API] Error in GET /devices/${request.params.id}/ipsec/profiles:`, error);
      fastify.log.error('Failed to get IPsec profiles:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve IPsec profiles' });
    }
  });

  /**
   * POST /api/config/devices/:id/ipsec/profiles - Add IPsec profile
   */
  fastify.post('/devices/:id/ipsec/profiles', {
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
          name: { type: 'string' },
          dh_group: { type: 'string' },
          enc_algorithm: { type: 'string' },
          hash_algorithm: { type: 'string' },
          lifetime: { type: 'string' },
          nat_traversal: { type: 'boolean' },
          dpd_interval: { type: 'string' },
          dpd_maximum_failures: { type: 'number' },
          comment: { type: 'string' },
          disabled: { type: 'boolean' },
          userId: { type: 'string' }
        },
        required: ['name']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { [key: string]: any }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId, ...profileData } = request.body;
      
      const result = await ipsecService.addIPsecProfile(id, profileData, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to add IPsec profile:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to add IPsec profile' });
    }
  });

  /**
   * GET /api/config/devices/:id/ipsec/active-peers - Get active IPsec peers
   */
  fastify.get('/devices/:id/ipsec/active-peers', {
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
          limit: { type: 'number', default: 100 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Querystring: { limit?: number }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { limit = 100 } = request.query;
      const activePeers = await ipsecService.getActivePeers(id, limit);
      reply.send({ activePeers });
    } catch (error) {
      fastify.log.error('Failed to get active IPsec peers:', error);
      reply.status(500).send({ error: (error as Error).message || 'Failed to retrieve active IPsec peers' });
    }
  });

  /**
   * POST /api/config/devices/:id/ipsec/site-to-site - Create site-to-site tunnel
   */
  fastify.post('/devices/:id/ipsec/site-to-site', {
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
          remotePeerIP: { type: 'string' },
          localNetworks: { 
            type: 'array',
            items: { type: 'string' }
          },
          remoteNetworks: { 
            type: 'array',
            items: { type: 'string' }
          },
          psk: { type: 'string' },
          profileName: { type: 'string' },
          peerName: { type: 'string' },
          comment: { type: 'string' },
          userId: { type: 'string' }
        },
        required: ['remotePeerIP', 'localNetworks', 'remoteNetworks', 'psk']
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { 
      remotePeerIP: string,
      localNetworks: string[],
      remoteNetworks: string[],
      psk: string,
      profileName?: string,
      peerName?: string,
      comment?: string,
      userId?: string
    }
  }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { userId, ...configData } = request.body;
      
      const config = {
        deviceId: id,
        ...configData
      };
      
      const result = await ipsecService.createSiteToSiteTunnel(config, userId);
      reply.send({ success: true, data: result });
    } catch (error) {
      fastify.log.error('Failed to create site-to-site tunnel:', error);
      reply.status(400).send({ error: (error as Error).message || 'Failed to create site-to-site tunnel' });
    }
  });

  // Cleanup connections when the server shuts down
  fastify.addHook('onClose', async () => {
    await configService.cleanup();
  });
}

export default configurationRoutes; 