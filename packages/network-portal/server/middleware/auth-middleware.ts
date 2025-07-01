import { FastifyRequest, FastifyReply } from 'fastify';
import { JWTPayload, JWT_CONFIG } from '../lib/jwt-config';

declare module 'fastify' {
  interface FastifyRequest {
    jwtVerify(): Promise<void>;
  }
  interface FastifyInstance {
    authenticate: typeof authMiddleware;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // First, try to extract the token manually
    let token: string | null = null;
    
    // Try to get token from cookie first
    if (request.cookies && request.cookies[JWT_CONFIG.cookieName]) {
      token = request.cookies[JWT_CONFIG.cookieName] || null;
    } else {
      // Fallback to Authorization header
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      console.log('No JWT token found in cookies or headers');
      console.log('Available cookies:', request.cookies);
      console.log('Authorization header:', request.headers.authorization);
      return reply.status(401).send({ error: 'Authentication required - no token provided' });
    }
    
    // Verify the token manually
    try {
      const payload = request.server.jwt.verify(token) as JWTPayload;
      
      // CRITICAL SECURITY CHECK: Verify session is still active in database
      const sessionCheck = request.server.db.prepare(`
        SELECT is_active, expires_at 
        FROM user_sessions 
        WHERE id = ? AND user_id = ?
      `).get(payload.sessionId, payload.userId) as { is_active: number; expires_at: string } | undefined;
      
      if (!sessionCheck) {
        console.log('Session not found in database:', payload.sessionId);
        return reply.status(401).send({ error: 'Session not found' });
      }
      
      if (!sessionCheck.is_active) {
        console.log('Session has been terminated:', payload.sessionId);
        return reply.status(401).send({ error: 'Session terminated' });
      }
      
      // Check if session has expired
      if (new Date(sessionCheck.expires_at) < new Date()) {
        console.log('Session has expired:', payload.sessionId);
        // Mark session as inactive
        request.server.db.prepare(`
          UPDATE user_sessions SET is_active = 0 WHERE id = ?
        `).run(payload.sessionId);
        return reply.status(401).send({ error: 'Session expired' });
      }
      
      // Manually set the user property
      (request as any).user = payload;
      
      console.log('JWT verification and session validation successful for user:', payload.username);
      
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return reply.status(401).send({ error: 'Invalid token' });
    }
    
  } catch (err) {
    console.error('Authentication middleware error:', err);
    return reply.status(401).send({ error: 'Authentication failed' });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const userPayload = request.user as JWTPayload;
    if (!roles.includes(userPayload.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
} 