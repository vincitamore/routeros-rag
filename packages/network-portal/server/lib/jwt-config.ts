export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-super-secure-secret-key-change-in-production-minimum-32-characters',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  issuer: process.env.JWT_ISSUER || 'network-portal',
  audience: process.env.JWT_AUDIENCE || 'network-portal-users',
  cookieName: process.env.JWT_COOKIE_NAME || 'auth-token'
};

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  sessionId: string;
} 