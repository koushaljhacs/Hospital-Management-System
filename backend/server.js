/**
 * ======================================================================
 * FILE: backend/server.js (UPDATED)
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Main entry point for the backend server.
 * Updated with enhanced security, monitoring, and production-ready features.
 * 
 * VERSION: 3.0.0
 * CREATED: 2026-03-11
 * UPDATED: 2026-03-18
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial server setup with basic routes
 * v2.0.0 - Integrated environment configuration (env.js)
 * v2.1.0 - Fixed dotenv loading order issue
 * v2.2.0 - Added explicit path for .env file
 * v2.3.0 - Added authentication routes and rate limiting
 * v2.4.0 - Added admin routes for user management
 * v2.5.0 - Added patient and doctor module routes
 * v2.6.0 - Added public and nurse module routes
 * v2.7.0 - Added pharmacist module routes
 * v2.8.0 - Fixed runtime bugs in services and improved code quality
 * v2.9.0 - Implemented safe route loader to prevent crashes from missing modules
 * v3.0.0 - Enhanced security, added monitoring, improved error handling
 * 
 * DEPENDENCIES:
 * - express v4.22.1
 * - cors v2.8.6
 * - helmet v7.2.0
 * - dotenv v16.0.3
 * - express-rate-limit (for auth endpoints)
 * - compression (for response compression)
 * - response-time (for response time monitoring)
 * ======================================================================
 */

const express = require('express');
const path = require('path');           
const dotenv = require('dotenv');       
const cors = require('cors');
const helmet = require('helmet');
const os = require('os');
const compression = require('compression');
const responseTime = require('response-time');
const rateLimit = require('express-rate-limit');

// ============================================
// LOAD ENVIRONMENT VARIABLES FIRST!
// ============================================
const envPath = path.resolve(__dirname, '.env');
console.log('Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Failed to load .env file!');
    console.error('Error:', result.error.message);
    console.error('Make sure .env file exists at:', envPath);
    process.exit(1);
}
console.log(' .env file loaded successfully!');
console.log(' Environment:', process.env.NODE_ENV || 'development');
console.log(' DB Host:', process.env.DB_HOST);
console.log(' Port:', process.env.PORT);

// ============================================
// NOW import config (which uses process.env)
// ============================================
const config = require('./src/config/env');      
const db = require('./src/config/database');
const logger = require('./src/utils/logger');     

const app = express();
const PORT = config.server.port;

// ============================================
// TRUST PROXY - Required for rate limiting behind reverse proxy
// ============================================
app.set('trust proxy', 1);

// ============================================
// GLOBAL MIDDLEWARES
// ============================================

// Security headers with helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    optionsSuccessStatus: 200
}));

// Response compression
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Response time monitoring
app.use(responseTime((req, res, time) => {
    logger.debug(`Response time for ${req.method} ${req.url}: ${time.toFixed(2)}ms`);
    
    // Log slow requests (>1s)
    if (time > 1000) {
        logger.warn('Slow request detected', {
            method: req.method,
            url: req.url,
            responseTime: time.toFixed(2),
            ip: req.ip
        });
    }
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    
    // Log after response is sent
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        };
        
        if (res.statusCode >= 400) {
            logger.warn('Request completed with error', logData);
        } else {
            logger.http(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
        }
    });
    
    next();
});

// ============================================
// GLOBAL RATE LIMITING
// ============================================
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.ip;
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/';
    }
});

// Apply global rate limiting to all requests
app.use(globalLimiter);

// ============================================
// DATABASE CONNECTION VERIFICATION
// ============================================
(async () => {
    try {
        await db.testConnection();
        logger.info('Database connection verified');
    } catch (error) {
        logger.error('Database connection failed', { error: error.message });
        // Don't exit, let the server try to reconnect
    }
})();

// ============================================
// SAFE API ROUTE LOADER
// Prevents server crash if a route/controller file is not yet created
// ============================================
const mountRouteSafely = (path, modulePath) => {
    try {
        const route = require(modulePath);
        app.use(path, route);
        logger.info(`Mounted route successfully: ${path}`);
    } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') {
            logger.warn(`Route module not found: ${modulePath}`);
            // Fallback for under-development routes
            app.use(path, (req, res) => {
                res.status(501).json({
                    success: false,
                    error: 'Not Implemented',
                    message: `The module for ${path} is currently under development.`,
                    code: 'NOT_IMPLEMENTED'
                });
            });
        } else {
            console.log(error);
            logger.error(`Error loading route ${path}:`, { error: error.message });
            // Still mount a fallback to prevent server crash
            app.use(path, (req, res) => {
                res.status(500).json({
                    success: false,
                    error: 'Internal Server Error',
                    message: 'Error loading route module',
                    code: 'ROUTE_LOAD_ERROR'
                });
            });
        }
    }
};

// Mount all API routes
mountRouteSafely('/api/v1/auth', path.join(__dirname, './src/routes/v1/authRoutes'));
mountRouteSafely('/api/v1/admin', path.join(__dirname, './src/routes/v1/adminRoutes'));
mountRouteSafely('/api/v1/patient', path.join(__dirname, './src/routes/v1/patientRoutes'));
mountRouteSafely('/api/v1/doctor', path.join(__dirname, './src/routes/v1/doctorRoutes'));
mountRouteSafely('/api/v1/nurse', path.join(__dirname, './src/routes/v1/nurseRoutes'));
mountRouteSafely('/api/v1/pharmacist', path.join(__dirname, './src/routes/v1/pharmacistRoutes'));
mountRouteSafely('/api/v1/receptionist', path.join(__dirname, './src/routes/v1/receptionistRoutes'));
mountRouteSafely('/api/v1/lab', path.join(__dirname, './src/routes/v1/labTechnicianRoutes'));
mountRouteSafely('/api/v1/public', path.join(__dirname, './src/routes/v1/publicRoutes'));

// ============================================
// API DOCUMENTATION ROUTE
// ============================================
app.get('/api-docs', (req, res) => {
    res.json({
        success: true,
        message: 'API Documentation',
        version: config.server.api.version,
        baseUrl: `${req.protocol}://${req.get('host')}/api/v1`,
        endpoints: {
            auth: {
                description: 'Authentication endpoints',
                url: '/api/v1/auth',
                methods: ['POST', 'GET']
            },
            admin: {
                description: 'Admin management',
                url: '/api/v1/admin',
                methods: ['GET', 'POST', 'PUT', 'DELETE']
            },
            patient: {
                description: 'Patient operations',
                url: '/api/v1/patient',
                methods: ['GET', 'POST', 'PUT', 'DELETE']
            },
            doctor: {
                description: 'Doctor operations',
                url: '/api/v1/doctor',
                methods: ['GET', 'POST', 'PUT', 'DELETE']
            },
            nurse: {
                description: 'Nurse operations',
                url: '/api/v1/nurse',
                methods: ['GET', 'POST', 'PUT']
            },
            pharmacist: {
                description: 'Pharmacist operations',
                url: '/api/v1/pharmacist',
                methods: ['GET', 'POST', 'PUT']
            },
            receptionist: {
                description: 'Receptionist operations',
                url: '/api/v1/receptionist',
                methods: ['GET', 'POST', 'PUT']
            },
            lab: {
                description: 'Lab technician operations',
                url: '/api/v1/lab',
                methods: ['GET', 'POST', 'PUT']
            },
            public: {
                description: 'Public information',
                url: '/api/v1/public',
                methods: ['GET']
            }
        },
        utilities: {
            health: '/health',
            testDb: '/test-db',
            config: '/config',
            api: '/api'
        },
        documentation: 'For detailed API documentation, please refer to the API blueprint',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ROOT ROUTE
// ============================================
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Hospital Management System API',
        version: config.server.api.version,
        team: 'OctNov',
        lead: 'Koushal Jha',
        endpoints: {
            auth: '/api/v1/auth',
            admin: '/api/v1/admin',
            patient: '/api/v1/patient',
            doctor: '/api/v1/doctor',
            nurse: '/api/v1/nurse',
            pharmacist: '/api/v1/pharmacist',
            receptionist: '/api/v1/receptionist',
            lab: '/api/v1/lab',
            public: '/api/v1/public',
            health: '/health',
            docs: '/api-docs',
            testDb: '/test-db',
            config: '/config',
            api: '/api'
        },
        environment: config.server.env,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// HEALTH CHECK ROUTE
// ============================================
app.get('/health', async (req, res) => {
    try {
        const start = Date.now();
        const dbHealth = await db.healthCheck();
        const responseTime = Date.now() - start;
        
        res.status(200).json({
            status: 'healthy',
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                node: process.version,
                pid: process.pid,
                responseTime: responseTime,
                config: config.getSanitized()
            },
            database: dbHealth,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Health check failed', { error: error.message });
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// DEEP HEALTH CHECK (for monitoring systems)
// ============================================
app.get('/health/deep', async (req, res) => {
    try {
        // Check database
        const dbResult = await db.query('SELECT 1 as healthy');
        
        // Check disk space
        const diskSpace = {
            free: os.freemem(),
            total: os.totalmem(),
            usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2)
        };
        
        // Check load average
        const loadAvg = os.loadavg();
        
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
                connected: true,
                responseTime: dbResult.duration
            },
            system: {
                uptime: os.uptime(),
                memory: diskSpace,
                loadAverage: {
                    '1m': loadAvg[0],
                    '5m': loadAvg[1],
                    '15m': loadAvg[2]
                },
                cpus: os.cpus().length
            },
            process: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.version
            }
        });
    } catch (error) {
        logger.error('Deep health check failed', { error: error.message });
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// TEST DATABASE ROUTE
// ============================================
app.get('/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW() as time, current_database() as db, current_user as user');
        res.json({
            success: true,
            data: result.rows[0],
            connection: {
                host: config.database.host,
                port: config.database.port,
                database: config.database.name,
                user: config.database.user,
                pool: db.getPoolMetrics()
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Database test failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'DB_TEST_FAILED'
        });
    }
});

// ============================================
// CONFIG ROUTE (development only)
// ============================================
app.get('/config', (req, res) => {
    if (config.isDevelopment) {
        res.json({
            success: true,
            config: config.getSanitized(),
            env: {
                port: process.env.PORT,
                dbHost: process.env.DB_HOST,
                nodeEnv: process.env.NODE_ENV,
                jwtExpiry: process.env.JWT_EXPIRES_IN
            },
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(404).json({ 
            success: false, 
            error: 'Not found',
            code: 'NOT_FOUND'
        });
    }
});

// ============================================
// API ROUTES LISTING
// ============================================
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'Hospital Management System API',
        version: config.server.api.version,
        basePath: '/api/v1',
        availableRoutes: [
            '/api/v1/auth',
            '/api/v1/admin',
            '/api/v1/patient',
            '/api/v1/doctor',
            '/api/v1/nurse',
            '/api/v1/pharmacist',
            '/api/v1/receptionist',
            '/api/v1/lab',
            '/api/v1/public',
            '/health',
            '/health/deep',
            '/test-db',
            '/config',
            '/api-docs'
        ],
        documentation: '/api-docs',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
    logger.warn('Route not found', { 
        path: req.url, 
        method: req.method,
        ip: req.ip
    });
    
    res.status(404).json({
        success: false,
        error: 'Route not found',
        code: 'NOT_FOUND',
        path: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    // Log error
    logger.error('Server error', { 
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        user: req.user?.id
    });

    // Determine error type and status code
    let statusCode = err.statusCode || 500;
    let errorMessage = err.message || 'Internal server error';
    let errorCode = err.code || 'INTERNAL_ERROR';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
    } else if (err.name === 'NotFoundError') {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
    } else if (err.code === '23505') { // PostgreSQL unique violation
        statusCode = 409;
        errorCode = 'DUPLICATE_ERROR';
        errorMessage = 'Resource already exists';
    } else if (err.code === '23503') { // PostgreSQL foreign key violation
        statusCode = 409;
        errorCode = 'REFERENCE_ERROR';
        errorMessage = 'Referenced resource not found';
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: config.isDevelopment ? errorMessage : 'Internal server error',
        code: errorCode,
        ...(config.isDevelopment && { stack: err.stack }),
        timestamp: new Date().toISOString()
    });
});

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    Object.keys(interfaces).forEach(iface => {
        interfaces[iface].forEach(addr => {
            if (addr.family === 'IPv4' && !addr.internal) {
                addresses.push(addr.address);
            }
        });
    });

    logger.info('\n' + '='.repeat(40));
    logger.info('SERVER STARTED SUCCESSFULLY!');
    logger.info('='.repeat(40));
    logger.info(`Local:    http://localhost:${PORT}`);
    logger.info(`Network:   http://${addresses[0] || '127.0.0.1'}:${PORT}`);
    logger.info(`Tailscale: http://100.81.13.80:${PORT}`);
    logger.info('─'.repeat(40));
    logger.info(`Health:    http://localhost:${PORT}/health`);
    logger.info(`Deep Health: http://localhost:${PORT}/health/deep`);
    logger.info(`Config:    http://localhost:${PORT}/config`);
    logger.info(`API Docs:  http://localhost:${PORT}/api-docs`);
    logger.info(`Test DB:   http://localhost:${PORT}/test-db`);
    logger.info('─'.repeat(40));
    logger.info(`Auth API:  http://localhost:${PORT}/api/v1/auth`);
    logger.info(`Admin API: http://localhost:${PORT}/api/v1/admin`);
    logger.info(`Patient API: http://localhost:${PORT}/api/v1/patient`);
    logger.info(`Doctor API: http://localhost:${PORT}/api/v1/doctor`);
    logger.info(`Nurse API:  http://localhost:${PORT}/api/v1/nurse`);
    logger.info(`Pharmacist API: http://localhost:${PORT}/api/v1/pharmacist`);
    logger.info(`Receptionist API: http://localhost:${PORT}/api/v1/receptionist`);
    logger.info(`Lab API: http://localhost:${PORT}/api/v1/lab`);
    logger.info(`Public API: http://localhost:${PORT}/api/v1/public`);
    logger.info('─'.repeat(40));
    logger.info(`Team: OctNov`);
    logger.info(`Lead: Koushal Jha`);
    logger.info(`Server PID: ${process.pid}`);
    logger.info(`Node Version: ${process.version}`);
    logger.info(`Environment: ${config.server.env}`);
    logger.info(`API Version: ${config.server.api.version}`);
    logger.info(`Config Version: 3.0.0`);
    logger.info('='.repeat(40) + '\n');
});

// ============================================
// SERVER ERROR HANDLING
// ============================================
server.on('error', (error) => {
    logger.error('Server error:', error);
    
    if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use!`);
        logger.info(`Try: lsof -i :${PORT} | grep LISTEN`);
        logger.info(`Then: kill -9 <PID>`);
        process.exit(1);
    } else if (error.code === 'EACCES') {
        logger.error(`Permission denied for port ${PORT}`);
        logger.info(`Try: sudo setcap cap_net_bind_service=+ep $(which node)`);
        process.exit(1);
    }
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    
    // Stop accepting new requests
    server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
            // Close database connections
            await db.shutdown();
            logger.info('Database connections closed');
            
            // Close any other connections (Redis, etc.)
            
            logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown:', { error: error.message });
            process.exit(1);
        }
    });

    // Force shutdown after timeout
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { 
        error: error.message,
        stack: error.stack 
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection:', { 
        reason: reason,
        promise: promise 
    });
});

// ============================================
// EXPORT FOR TESTING
// ============================================
module.exports = { app, server };