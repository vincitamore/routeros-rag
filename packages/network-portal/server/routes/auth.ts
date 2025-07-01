import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, LoginRequest } from '../services/auth-service';
import { JWT_CONFIG, JWTPayload } from '../lib/jwt-config';
import { authMiddleware } from '../middleware/auth-middleware';
import { v4 as uuidv4 } from 'uuid';

// Type declaration handled in auth-middleware.ts

async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService(fastify.db);

  // Setup status endpoint (check if setup is required)
  fastify.get('/setup-status', async (request, reply) => {
    const setupRequired = authService.isSetupRequired();
    return { setupRequired };
  });

  // Login endpoint
  fastify.post<{ Body: LoginRequest }>('/login', async (request, reply) => {
    const { username, password } = request.body;
    
    try {
      const user = await authService.validateLogin(
        { username, password },
        {
          ip: request.ip,
          userAgent: request.headers['user-agent'] || ''
        }
      );

      if (!user) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }

      const sessionId = uuidv4();
      const payload: JWTPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
        sessionId
      };

      const token = fastify.jwt.sign(payload);

      // Store session
      fastify.db.prepare(`
        INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at)
        VALUES (?, ?, ?, ?, datetime('now', '+24 hours'))
      `).run(sessionId, user.id, request.ip, request.headers['user-agent'] || '');

      reply.setCookie('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        path: '/',
        domain: process.env.NODE_ENV === 'development' ? undefined : undefined,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      return { user, token };
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'Login failed' });
    }
  });

  // Logout endpoint
  fastify.post('/logout', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = request.user as JWTPayload;
    
    // Invalidate session
    fastify.db.prepare(`
      UPDATE user_sessions SET is_active = false WHERE id = ?
    `).run(user.sessionId);

    reply.clearCookie('auth-token');
    return { message: 'Logged out successfully' };
  });

  // Current user endpoint
  fastify.get('/me', { preHandler: [authMiddleware] }, async (request, reply) => {
    const user = request.user as JWTPayload;
    const userData = authService.getUserById(user.userId);
    return { user: userData };
  });

  // First-time setup endpoint (only works if no admin exists)
  fastify.post<{ Body: { username: string; email: string; password: string; full_name?: string } }>(
    '/setup',
    async (request, reply) => {
      // Check if any admin exists
      const adminCount = fastify.db.prepare(`
        SELECT COUNT(*) as count FROM users WHERE role = 'admin'
      `).get() as { count: number };

      if (adminCount.count > 0) {
        return reply.status(400).send({ error: 'Setup already completed' });
      }

      try {
        const admin = await authService.createUser({
          ...request.body,
          role: 'admin'
        });

        // Automatically log in the new admin user
        const sessionId = uuidv4();
        const payload: JWTPayload = {
          userId: admin.id,
          username: admin.username,
          role: admin.role,
          sessionId
        };

        const token = fastify.jwt.sign(payload);

        // Store session
        fastify.db.prepare(`
          INSERT INTO user_sessions (id, user_id, ip_address, user_agent, expires_at)
          VALUES (?, ?, ?, ?, datetime('now', '+24 hours'))
        `).run(sessionId, admin.id, request.ip, request.headers['user-agent'] || '');

        reply.setCookie('auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
          path: '/',
          domain: process.env.NODE_ENV === 'development' ? undefined : undefined,
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        return { message: 'Admin account created successfully', user: admin, token };
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : 'Setup failed' });
      }
    }
  );
}

export default authRoutes; 