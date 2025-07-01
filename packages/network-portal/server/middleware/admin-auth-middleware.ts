import { FastifyRequest, FastifyReply } from 'fastify';

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: 'admin' | 'operator' | 'user' | 'viewer';
  email?: string;
}

// Extend FastifyRequest to include our user type
interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

// Admin authorization middleware
export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Verify JWT token (this calls the existing JWT verification)
    await request.jwtVerify();

    // Cast to our authenticated request type
    const authRequest = request as AuthenticatedRequest;

    // Check if user has admin role
    if (!authRequest.user || authRequest.user.role !== 'admin') {
      reply.code(403).send({ 
        error: 'Admin access required',
        message: 'This endpoint requires administrator privileges.'
      });
      return;
    }

    // Admin verification successful, continue to the route handler
  } catch (error) {
    reply.code(401).send({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource.'
    });
    return;
  }
};

// Operator or higher authorization middleware
export const requireOperator = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();

    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user || !['admin', 'operator'].includes(authRequest.user.role)) {
      reply.code(403).send({ 
        error: 'Operator access required',
        message: 'This endpoint requires operator or administrator privileges.'
      });
      return;
    }
  } catch (error) {
    reply.code(401).send({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource.'
    });
    return;
  }
};

// User or higher authorization middleware (for general authenticated access)
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();

    const authRequest = request as AuthenticatedRequest;

    if (!authRequest.user) {
      reply.code(401).send({ 
        error: 'Authentication required',
        message: 'Please log in to access this resource.'
      });
      return;
    }
  } catch (error) {
    reply.code(401).send({ 
      error: 'Authentication required',
      message: 'Please log in to access this resource.'
    });
    return;
  }
};

// Utility function to get client info for audit logging
export const getClientInfo = (request: FastifyRequest) => {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'] || 'Unknown'
  };
}; 