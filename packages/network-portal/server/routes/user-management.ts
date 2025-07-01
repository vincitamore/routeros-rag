import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserManagementService } from '../services/user-management-service.js';
import { SessionManagementService } from '../services/session-management-service.js';
import { AuditService } from '../services/audit-service.js';
import { requireAdmin, getClientInfo } from '../middleware/admin-auth-middleware.js';
import { CreateUserRequest, UpdateUserRequest, UserFilters } from '../types/user-management.js';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    username: string;
    role: string;
    sessionId: string;
  };
}

export async function userManagementRoutes(fastify: FastifyInstance) {
  const userService = new UserManagementService(fastify.db);
  const sessionService = new SessionManagementService(fastify.db);
  const auditService = new AuditService(fastify.db);

  // Get all users with filtering and pagination
  fastify.get('/users', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          role: { type: 'string' },
          account_status: { type: 'string' },
          department: { type: 'string' },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 25 },
          created_after: { type: 'string' },
          created_before: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { search, role, account_status, department, page, limit, created_after, created_before } = request.query as any;
      
      const filters: UserFilters = {
        search,
        role,
        account_status,
        department,
        created_after,
        created_before
      };

      const result = await userService.getUsers(filters, page, limit);
      reply.send(result);
    } catch (error: any) {
      fastify.log.error('Failed to fetch users:', error);
      reply.code(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Get single user by ID
  fastify.get('/users/:id', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = await userService.getUserById(id);
      
      if (!user) {
        reply.code(404).send({ error: 'User not found' });
        return;
      }

      reply.send(user);
    } catch (error: any) {
      fastify.log.error('Failed to fetch user:', error);
      reply.code(500).send({ error: 'Failed to fetch user' });
    }
  });

  // Create new user
  fastify.post('/users', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string', maxLength: 100 },
          last_name: { type: 'string', maxLength: 100 },
          phone: { type: 'string', maxLength: 20 },
          department: { type: 'string', maxLength: 100 },
          notes: { type: 'string', maxLength: 500 },
          role: { type: 'string', enum: ['admin', 'operator', 'user', 'viewer'] },
          password: { type: 'string', minLength: 8 },
          password_reset_required: { type: 'boolean' }
        },
        required: ['username', 'role', 'password']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userData = request.body as CreateUserRequest;
    try {
      const authRequest = request as AuthenticatedRequest;
      const { ipAddress, userAgent } = getClientInfo(request);

      const newUser = await userService.createUser(userData, authRequest.user.userId, ipAddress, userAgent);
      reply.code(201).send(newUser);
    } catch (error: any) {
      fastify.log.error('Failed to create user - Error details:', {
        message: error?.message,
        stack: error?.stack,
        type: typeof error,
        constructor: error?.constructor?.name,
        code: error?.code,
        errno: error?.errno,
        sql: error?.sql
      });
      
      if (error && error.message && error.message.includes('already exists')) {
        reply.code(409).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to create user', details: error?.message || 'Unknown error' });
      }
    }
  });

  // Update user
  fastify.put('/users/:id', {
    preHandler: requireAdmin,
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
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string', maxLength: 100 },
          last_name: { type: 'string', maxLength: 100 },
          phone: { type: 'string', maxLength: 20 },
          department: { type: 'string', maxLength: 100 },
          notes: { type: 'string', maxLength: 500 },
          role: { type: 'string', enum: ['admin', 'operator', 'user', 'viewer'] },
          account_status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
          password_reset_required: { type: 'boolean' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const userData = request.body as UpdateUserRequest;
      const authRequest = request as AuthenticatedRequest;
      const { ipAddress, userAgent } = getClientInfo(request);

      const updatedUser = await userService.updateUser(id, userData, authRequest.user.userId, ipAddress, userAgent);
      reply.send(updatedUser);
    } catch (error: any) {
      fastify.log.error('Failed to update user:', error);
      if (error?.message === 'User not found') {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to update user', details: error?.message || 'Unknown error' });
      }
    }
  });

  // Delete user
  fastify.delete('/users/:id', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const authRequest = request as AuthenticatedRequest;
      const { ipAddress, userAgent } = getClientInfo(request);

      await userService.deleteUser(id, authRequest.user.userId, ipAddress, userAgent);
      reply.code(204).send();
    } catch (error: any) {
      fastify.log.error('Failed to delete user:', error);
      if (error.message === 'User not found') {
        reply.code(404).send({ error: error.message });
      } else if (error.message.includes('Cannot delete')) {
        reply.code(403).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to delete user' });
      }
    }
  });

  // Reset user password
  fastify.post('/users/:id/reset-password', {
    preHandler: requireAdmin,
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
          new_password: { type: 'string', minLength: 8 },
          require_reset: { type: 'boolean', default: true }
        },
        required: ['new_password']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { new_password, require_reset } = request.body as { new_password: string; require_reset?: boolean };
      const authRequest = request as AuthenticatedRequest;
      const { ipAddress, userAgent } = getClientInfo(request);

      await userService.resetUserPassword(id, new_password, authRequest.user.userId, require_reset, ipAddress, userAgent);
      reply.send({ message: 'Password reset successfully' });
    } catch (error: any) {
      fastify.log.error('Failed to reset password:', error);
      if (error.message === 'User not found') {
        reply.code(404).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to reset password' });
      }
    }
  });

  // Get user statistics
  fastify.get('/users/stats', {
    preHandler: requireAdmin
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await userService.getUserStats();
      reply.send(stats);
    } catch (error: any) {
      fastify.log.error('Failed to fetch user statistics:', error);
      reply.code(500).send({ error: 'Failed to fetch user statistics' });
    }
  });

  // Bulk update users
  fastify.put('/users/bulk', {
    preHandler: requireAdmin,
    schema: {
      body: {
        type: 'object',
        properties: {
          user_ids: { type: 'array', items: { type: 'string' } },
          updates: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['admin', 'operator', 'user', 'viewer'] },
              account_status: { type: 'string', enum: ['active', 'inactive', 'locked'] },
              department: { type: 'string', maxLength: 100 }
            }
          }
        },
        required: ['user_ids', 'updates']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { user_ids, updates } = request.body as { user_ids: string[]; updates: Partial<UpdateUserRequest> };
      const authRequest = request as AuthenticatedRequest;
      const { ipAddress, userAgent } = getClientInfo(request);

      const updatedCount = await userService.bulkUpdateUsers(user_ids, updates, authRequest.user.userId, ipAddress, userAgent);
      reply.send({ updated_count: updatedCount });
    } catch (error: any) {
      fastify.log.error('Failed to bulk update users:', error);
      if (error.message.includes('Cannot perform bulk operations')) {
        reply.code(403).send({ error: error.message });
      } else {
        reply.code(500).send({ error: 'Failed to update users' });
      }
    }
  });

  // Get user sessions
  fastify.get('/users/:id/sessions', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const sessions = await sessionService.getUserSessions(id);
      reply.send(sessions);
    } catch (error: any) {
      fastify.log.error('Failed to fetch user sessions:', error);
      reply.code(500).send({ error: 'Failed to fetch user sessions' });
    }
  });

  // Terminate user sessions
  fastify.delete('/users/:id/sessions', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const authRequest = request as AuthenticatedRequest;
      const terminatedCount = await sessionService.terminateUserSessions(id, authRequest.user.userId);
      reply.send({ terminated_sessions: terminatedCount });
    } catch (error: any) {
      fastify.log.error('Failed to terminate sessions:', error);
      reply.code(500).send({ error: 'Failed to terminate sessions' });
    }
  });

  // Get all active sessions (admin view)
  fastify.get('/sessions', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { page, limit } = request.query as { page?: number; limit?: number };
      const result = await sessionService.getAllActiveSessions(page, limit);
      reply.send(result);
    } catch (error: any) {
      fastify.log.error('Failed to fetch sessions:', error);
      reply.code(500).send({ error: 'Failed to fetch sessions' });
    }
  });

  // Terminate specific session
  fastify.delete('/sessions/:sessionId', {
    preHandler: requireAdmin,
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        },
        required: ['sessionId']
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const authRequest = request as AuthenticatedRequest;
      const success = await sessionService.terminateSession(sessionId, authRequest.user.userId);
      
      if (success) {
        reply.send({ message: 'Session terminated successfully' });
      } else {
        reply.code(404).send({ error: 'Session not found or already terminated' });
      }
    } catch (error: any) {
      fastify.log.error('Failed to terminate session:', error);
      reply.code(500).send({ error: 'Failed to terminate session' });
    }
  });

  // Get session statistics
  fastify.get('/sessions/stats', {
    preHandler: requireAdmin
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await sessionService.getSessionStats();
      reply.send(stats);
    } catch (error: any) {
      fastify.log.error('Failed to fetch session statistics:', error);
      reply.code(500).send({ error: 'Failed to fetch session statistics' });
    }
  });

  // Get audit logs
  fastify.get('/audit', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          admin_user_id: { type: 'string' },
          target_user_id: { type: 'string' },
          action: { type: 'string' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 50 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { admin_user_id, target_user_id, action, date_from, date_to, page, limit } = request.query as any;
      
      const filters = {
        adminUserId: admin_user_id,
        targetUserId: target_user_id,
        action,
        dateFrom: date_from,
        dateTo: date_to
      };

      const result = await auditService.getAuditLogs(filters, page, limit);
      reply.send(result);
    } catch (error: any) {
      fastify.log.error('Failed to fetch audit logs:', error);
      reply.code(500).send({ error: 'Failed to fetch audit logs' });
    }
  });

  // Get audit statistics
  fastify.get('/audit/stats', {
    preHandler: requireAdmin,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'number', default: 30 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { days } = request.query as { days?: number };
      const stats = await auditService.getAuditStats(days);
      reply.send(stats);
    } catch (error: any) {
      fastify.log.error('Failed to fetch audit statistics:', error);
      reply.code(500).send({ error: 'Failed to fetch audit statistics' });
    }
  });
} 