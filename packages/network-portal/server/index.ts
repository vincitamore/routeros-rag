import dotenv from 'dotenv';
import Fastify from 'fastify';
import { Database } from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Failed to load .env file:', result.error);
} else {
  console.log('✅ Environment variables loaded successfully');
}

// Import monitoring services
import { MonitoringService } from './services/monitoring-service';
import { NetworkService } from './services/network-service';
import { DiskManagementService } from './services/disk-management-service';
import { NetworkPortalWebSocketServer } from './lib/websocket-server';

// Import authentication
import { authMiddleware } from './middleware/auth-middleware';
import { JWT_CONFIG } from './lib/jwt-config';

// Environment configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 3004;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: NODE_ENV === 'development' ? 'info' : 'warn',
    transport: NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true
      }
    } : undefined
  }
});

// Database initialization
let db: Database;
let monitoringService: MonitoringService;
let networkService: NetworkService;
let diskManagementService: DiskManagementService;
let webSocketServer: NetworkPortalWebSocketServer;

try {
  const { initializeDatabase, createTestData } = require('./database/init');
  const dbPath = path.join(__dirname, 'database', 'network-portal.db');
  db = initializeDatabase(dbPath);
  
  // Create test data if in development mode and database is empty
  if (NODE_ENV === 'development') {
    const deviceCount = db.prepare('SELECT COUNT(*) as count FROM devices').get() as { count: number };
    if (deviceCount.count === 0) {
      createTestData(db);
    }
  }
  
  // Add database to Fastify instance
  fastify.decorate('db', db);
  fastify.decorate('dbPath', dbPath);
  
  // Initialize monitoring service
  monitoringService = new MonitoringService(db, {
    interval: 30000, // 30 seconds
    retentionDays: 30
  });
  
  // Add monitoring service to Fastify instance
  fastify.decorate('monitoringService', monitoringService);
  
  // Initialize network service
  networkService = new NetworkService(db, {
    topologyRefreshInterval: 60000, // 1 minute
    trafficMonitoringInterval: 30000, // 30 seconds
    retentionDays: 30
  });
  
  // Add network service to Fastify instance
  fastify.decorate('networkService', networkService);
  
  // Initialize disk management service and start recording
  diskManagementService = new DiskManagementService(db, dbPath);
  diskManagementService.initializeDiskRecording();
  
  // Add disk management service to Fastify instance
  fastify.decorate('diskManagementService', diskManagementService);
  
  // Initialize WebSocket server
  webSocketServer = new NetworkPortalWebSocketServer(WS_PORT, monitoringService, db);
  
  // Add WebSocket server to Fastify instance
  fastify.decorate('webSocketServer', webSocketServer);
  
  fastify.log.info('Database connected successfully');
  fastify.log.info('Monitoring service initialized');
  fastify.log.info('Network service initialized');
  fastify.log.info('Disk management service initialized - recording every 5 minutes');
  fastify.log.info(`WebSocket server initialized on port ${WS_PORT}`);
  
  // Debug: Check if SSH key encryption password is loaded
  const hasSSHPassword = !!process.env.SSH_KEY_ENCRYPTION_PASSWORD;
  fastify.log.info(`SSH key encryption password loaded: ${hasSSHPassword}`);
  
} catch (error) {
  fastify.log.error('Failed to initialize services:', error);
  process.exit(1);
}

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  
  if (error.validation) {
    reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation
    });
    return;
  }
  
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal Server Error' : error.message;
  
  reply.status(statusCode).send({
    error: message,
    statusCode
  });
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const monitoringStatus = monitoringService ? monitoringService.getMonitoringStatus() : {};
  const activeDevices = Object.keys(monitoringStatus).length;
  const webSocketClients = webSocketServer ? webSocketServer.getConnectedClientsCount() : 0;
  
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
    services: {
      database: !!db,
      monitoring: !!monitoringService,
      websocket: !!webSocketServer,
      activeDevices,
      webSocketClients
    }
  };
});

// Register plugins and routes
fastify.register(async function (fastify) {
  // CORS configuration
  const cors = await import('@fastify/cors');
  const corsOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',')
    : NODE_ENV === 'development' 
      ? ['http://localhost:3003', 'ws://localhost:3004'] 
      : false;
  
  await fastify.register(cors.default, {
    origin: corsOrigins,
    credentials: process.env.CORS_CREDENTIALS === 'true' || true
  });

  // JWT authentication
  const jwt = await import('@fastify/jwt');
  await fastify.register(jwt.default, {
    secret: JWT_CONFIG.secret,
    cookie: { 
      cookieName: JWT_CONFIG.cookieName, 
      signed: false 
    }
  });

  // Cookie support
  const cookie = await import('@fastify/cookie');
  await fastify.register(cookie.default);

  // Authentication decorator
  fastify.decorate('authenticate', authMiddleware);

  // Enable rate limiting
  const rateLimit = await import('@fastify/rate-limit');
  await fastify.register(rateLimit.default, {
    max: 100,
    timeWindow: '1 minute'
  });

  // Register routes after plugins are loaded
  // API prefix
  fastify.register(async function (fastify) {
    // Auth routes (NO authentication required)
    const authRoutes = await import('./routes/auth');
    fastify.register(authRoutes.default, { prefix: '/auth' });
    
    // ALL OTHER ROUTES REQUIRE AUTHENTICATION
    fastify.register(async function (fastify) {
      // Add authentication to all routes in this group
      fastify.addHook('preHandler', fastify.authenticate);
      
      // Device management routes
      const devicesRoutes = await import('./routes/devices');
      fastify.register(devicesRoutes.default, { prefix: '/devices' });
      
      // Monitoring routes  
      const monitoringRoutes = await import('./routes/monitoring');
      fastify.register(monitoringRoutes.default, { prefix: '/monitoring' });
      
      // Configuration routes
      const configRoutes = await import('./routes/configuration');
      fastify.register(configRoutes.default, { prefix: '/config' });
      
      // Alert routes
      const alertRoutes = await import('./routes/alerts');
      fastify.register(alertRoutes.default, { prefix: '/alerts' });
      
      // Network routes
      const networkRoutes = await import('./routes/network');
      fastify.register(networkRoutes.default, { prefix: '/network' });

      // Terminal routes
      const terminalRoutes = await import('./routes/terminal');
      fastify.register(terminalRoutes.default, { prefix: '/terminal' });

      // User management routes (Admin only)
      const userManagementRoutes = await import('./routes/user-management');
      fastify.register(userManagementRoutes.userManagementRoutes, { prefix: '/admin' });

      // Disk management routes (Admin only)
      const diskManagementRoutes = await import('./routes/disk-management');
      fastify.register(diskManagementRoutes.default, { prefix: '/admin/disk' });

      // Database viewer routes (Admin only)
      const databaseViewerRoutes = await import('./routes/database-viewer');
      fastify.register(databaseViewerRoutes.default, { prefix: '/admin/database' });
    });
  }, { prefix: '/api' });
});

// Start monitoring for connected devices after server startup
const startInitialMonitoring = async () => {
  try {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for server to be ready
    
    if (monitoringService) {
      fastify.log.info('Starting monitoring for connected devices...');
      await monitoringService.startMonitoringAll();
    }
  } catch (error) {
    fastify.log.error('Failed to start initial monitoring:', error);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully`);
  
  try {
    // Stop monitoring service
    if (monitoringService) {
      await monitoringService.close();
      fastify.log.info('Monitoring service closed');
    }
    
    // Stop network service
    if (networkService) {
      await networkService.cleanup();
      fastify.log.info('Network service closed');
    }
    
    // Close WebSocket server
    if (webSocketServer) {
      await webSocketServer.close();
      fastify.log.info('WebSocket server closed');
    }
    
    // Close database connection
    if (db) {
      db.close();
      fastify.log.info('Database connection closed');
    }
    
    // Close Fastify server
    await fastify.close();
    fastify.log.info('Server closed successfully');
    
    process.exit(0);
  } catch (error) {
    fastify.log.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Server listening on http://${HOST}:${PORT}`);
    fastify.log.info(`WebSocket server on ws://${HOST}:${WS_PORT}`);
    
    // Start initial monitoring
    startInitialMonitoring();
    
  } catch (error) {
    console.error('DETAILED ERROR STARTING SERVER:');
    console.error('Error message:', error instanceof Error ? error.message : error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);
    fastify.log.error('Error starting server:', error);
    process.exit(1);
  }
};

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  fastify.log.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
start();

// Export for testing
export default fastify; 