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
 * VERSION: 3.12.0
 * CREATED: 2026-03-11
 * UPDATED: 2026-03-22
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
 * v3.1.0 - Added radiologist module routes
 * v3.2.0 - Added billing module routes
 * v3.3.0 - Added ground staff module routes
 * v3.4.0 - Added security guard module routes
 * v3.5.0 - Added employee common module routes
 * v3.6.0 - Added dashboard module routes (admin, doctor, nurse, pharmacist, 
 *          lab, billing, reception dashboards)
 *          Updated API documentation to include dashboard endpoints
 *          Added dashboard to root route endpoints listing
 *          Updated server startup log to show dashboard API
 * v3.7.0 - Added API Key Management module routes
 *          Created new folder structure for API Keys (services/apiKey, controllers/apiKey)
 *          Added apiKeyRoutes to route loader and documentation
 *          Updated root route and API docs to include api-key endpoints
 * v3.8.0 - Added Webhook Management module routes
 *          Created new folder structure for Webhooks (services/webhook, controllers/webhook)
 *          Added webhookRoutes to route loader and documentation
 *          Updated root route and API docs to include webhook endpoints
 *          Added webhook endpoints to server startup log
 * v3.9.0 - Added System Management module routes
 *          Created new folder structure for System (services/system, controllers/system)
 *          Added systemRoutes to route loader and documentation
 *          Updated root route and API docs to include system endpoints
 *          Added system endpoints to server startup log
 *          Added health check routes to global rate limiter skip
 * v3.10.0 - Added Rate Limit Management module routes
 *           Created new folder structure for Rate Limits (services/rateLimit, controllers/rateLimit)
 *           Added rateLimitRoutes to route loader and documentation
 *           Updated root route and API docs to include rate limit endpoints
 *           Added rate limit endpoints to server startup log
 *           Updated global rate limiter to skip rate limit admin endpoints
 * v3.11.0 - Added Token Management module routes
 *           Created new folder structure for Tokens (services/token, controllers/token)
 *           Added tokenRoutes to route loader and documentation
 *           Updated root route and API docs to include token endpoints
 *           Added token endpoints to server startup log
 *           Updated global rate limiter to skip token validation endpoints
 * v3.12.0 - Added Session Management module routes
 *           Created new folder structure for Sessions (services/session, controllers/session)
 *           Added sessionRoutes to route loader and documentation
 *           Updated root route and API docs to include session endpoints
 *           Added session endpoints to server startup log
 *           Updated global rate limiter to skip session validation endpoints
 * 
 * DEPENDENCIES:
 * - express v4.22.1
 * - cors v2.8.6
 * - helmet v7.2.0
 * - dotenv v16.0.3
 * - express-rate-limit (for auth endpoints)
 * - compression (for response compression)
 * - response-time (for response time monitoring)
 * - axios (for webhook delivery)
 * - redis (optional for rate limit tracking)
 * - jsonwebtoken (for token generation)
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
        // Skip rate limiting for health checks, webhooks, system health, rate limit admin, token validation, and session endpoints
        return req.path === '/health' || 
               req.path === '/' || 
               req.path.startsWith('/webhooks') ||
               req.path.startsWith('/system/health') ||
               req.path.startsWith('/admin/rate-limits') ||
               req.path.startsWith('/auth/tokens/validate') ||
               req.path.startsWith('/auth/sessions');
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
logger.info('Mounting API routes...');
mountRouteSafely('/api/v1/auth', path.join(__dirname, './src/routes/v1/authRoutes'));
mountRouteSafely('/api/v1/admin', path.join(__dirname, './src/routes/v1/adminRoutes'));
mountRouteSafely('/api/v1/patient', path.join(__dirname, './src/routes/v1/patientRoutes'));
mountRouteSafely('/api/v1/doctor', path.join(__dirname, './src/routes/v1/doctorRoutes'));
mountRouteSafely('/api/v1/nurse', path.join(__dirname, './src/routes/v1/nurseRoutes'));
mountRouteSafely('/api/v1/pharmacist', path.join(__dirname, './src/routes/v1/pharmacistRoutes'));
mountRouteSafely('/api/v1/receptionist', path.join(__dirname, './src/routes/v1/receptionistRoutes'));
mountRouteSafely('/api/v1/lab', path.join(__dirname, './src/routes/v1/labTechnicianRoutes'));
mountRouteSafely('/api/v1/radiology', path.join(__dirname, './src/routes/v1/radiologistRoutes'));
mountRouteSafely('/api/v1/billing', path.join(__dirname, './src/routes/v1/billingRoutes'));
mountRouteSafely('/api/v1/staff', path.join(__dirname, './src/routes/v1/staffRoutes'));
mountRouteSafely('/api/v1/security', path.join(__dirname, './src/routes/v1/securityRoutes'));
mountRouteSafely('/api/v1/employee', path.join(__dirname, './src/routes/v1/employeeRoutes'));
mountRouteSafely('/api/v1/public', path.join(__dirname, './src/routes/v1/publicRoutes'));
mountRouteSafely('/api/v1/dashboard', path.join(__dirname, './src/routes/v1/dashboardRoutes'));
mountRouteSafely('/api/v1/admin', path.join(__dirname, './src/routes/v1/apiKeyRoutes'));
mountRouteSafely('/api/v1', path.join(__dirname, './src/routes/v1/webhookRoutes'));
mountRouteSafely('/api/v1', path.join(__dirname, './src/routes/v1/systemRoutes'));
mountRouteSafely('/api/v1/admin', path.join(__dirname, './src/routes/v1/rateLimitRoutes'));
mountRouteSafely('/api/v1', path.join(__dirname, './src/routes/v1/tokenRoutes'));
mountRouteSafely('/api/v1', path.join(__dirname, './src/routes/v1/sessionRoutes'));

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
            radiology: {
                description: 'Radiologist operations',
                url: '/api/v1/radiology',
                methods: ['GET', 'POST', 'PUT', 'DELETE']
            },
            billing: {
                description: 'Billing operations',
                url: '/api/v1/billing',
                methods: ['GET', 'POST', 'PUT', 'DELETE']
            },
            staff: {
                description: 'Ground staff operations',
                url: '/api/v1/staff',
                methods: ['GET', 'POST', 'PUT']
            },
            security: {
                description: 'Security guard operations',
                url: '/api/v1/security',
                methods: ['GET', 'POST', 'PUT']
            },
            employee: {
                description: 'Employee common operations',
                url: '/api/v1/employee',
                methods: ['GET', 'POST', 'PUT', 'DELETE']
            },
            dashboard: {
                description: 'Role-based dashboards',
                url: '/api/v1/dashboard',
                methods: ['GET']
            },
            public: {
                description: 'Public information',
                url: '/api/v1/public',
                methods: ['GET']
            },
            apiKeys: {
                description: 'API Key Management (Third-party authentication)',
                url: '/api/v1',
                basePath: '/api/v1/admin/api-keys',
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                endpoints: [
                    'GET    /admin/api-keys           - List all API keys',
                    'GET    /admin/api-keys/:id       - Get API key by ID',
                    'POST   /admin/api-keys           - Create new API key',
                    'PUT    /admin/api-keys/:id       - Update API key',
                    'DELETE /admin/api-keys/:id       - Delete API key',
                    'POST   /admin/api-keys/:id/revoke - Revoke API key',
                    'POST   /admin/api-keys/:id/rotate - Rotate API key',
                    'GET    /admin/api-keys/logs      - Get API key logs',
                    'GET    /admin/api-keys/stats     - Get API key statistics',
                    'GET    /admin/api-keys/permissions - Available permissions',
                    'POST   /admin/api-keys/validate  - Validate API key',
                    'GET    /admin/api-keys/usage/:id - Get key usage details'
                ]
            },
            webhooks: {
                description: 'Webhook Management (Payment gateways, SMS, Email)',
                url: '/api/v1',
                basePath: '/api/v1/webhooks',
                methods: ['POST', 'GET', 'PUT', 'DELETE'],
                endpoints: [
                    'POST   /webhooks/payment/razorpay   - Razorpay payment webhook',
                    'POST   /webhooks/payment/stripe     - Stripe payment webhook',
                    'POST   /webhooks/payment/phonepe    - PhonePe payment webhook',
                    'POST   /webhooks/payment/paytm      - Paytm payment webhook',
                    'POST   /webhooks/sms/delivery       - SMS delivery status',
                    'POST   /webhooks/email/bounce       - Email bounce notification',
                    'POST   /webhooks/email/open         - Email open tracking',
                    'GET    /webhooks/endpoints          - List webhook endpoints',
                    'GET    /webhooks/endpoints/:id      - Get endpoint by ID',
                    'POST   /webhooks/endpoints          - Create webhook endpoint',
                    'PUT    /webhooks/endpoints/:id      - Update endpoint',
                    'DELETE /webhooks/endpoints/:id      - Delete endpoint',
                    'POST   /webhooks/endpoints/:id/test - Test endpoint',
                    'GET    /webhooks/deliveries         - List deliveries',
                    'GET    /webhooks/deliveries/:id     - Get delivery details',
                    'POST   /webhooks/deliveries/:id/retry - Retry failed delivery',
                    'GET    /webhooks/logs               - Webhook logs',
                    'GET    /webhooks/statistics         - Webhook statistics',
                    'GET    /webhooks/events             - Available webhook events'
                ]
            },
            system: {
                description: 'System Management (Health checks, Version, Info)',
                url: '/api/v1',
                basePath: '/api/v1/system',
                methods: ['GET'],
                endpoints: [
                    'GET    /system                      - Module info',
                    'GET    /system/health              - Basic health check',
                    'GET    /system/health/detailed     - Detailed health check',
                    'GET    /system/health/db           - Database health check',
                    'GET    /system/health/cache        - Cache health check',
                    'GET    /system/version             - API version info',
                    'GET    /system/api-docs            - API documentation',
                    'GET    /system/swagger.json        - Swagger JSON',
                    'GET    /system/swagger.yaml        - Swagger YAML',
                    'GET    /system/info                - System information (protected)',
                    'GET    /system/status              - System status (protected)'
                ]
            },
            rateLimits: {
                description: 'Rate Limit Management (Dynamic rate limit configuration)',
                url: '/api/v1',
                basePath: '/api/v1/admin/rate-limits',
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                endpoints: [
                    'GET    /admin/rate-limits/rules          - List rate limit rules',
                    'GET    /admin/rate-limits/rules/:id      - Get rule by ID',
                    'POST   /admin/rate-limits/rules          - Create rate limit rule',
                    'PUT    /admin/rate-limits/rules/:id      - Update rule',
                    'DELETE /admin/rate-limits/rules/:id      - Delete rule',
                    'GET    /admin/rate-limits/exemptions     - List exemptions',
                    'GET    /admin/rate-limits/exemptions/:id - Get exemption by ID',
                    'POST   /admin/rate-limits/exemptions     - Create exemption',
                    'DELETE /admin/rate-limits/exemptions/:id - Delete exemption',
                    'GET    /admin/rate-limits/stats          - Rate limit statistics',
                    'GET    /admin/rate-limits/breaches       - Rate limit breaches'
                ]
            },
            tokens: {
                description: 'Token Management (JWT, refresh, blacklist)',
                url: '/api/v1',
                basePath: '/api/v1/admin/tokens',
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                endpoints: [
                    'GET    /admin/tokens                      - List all tokens',
                    'GET    /admin/tokens/user/:userId         - Get tokens by user',
                    'DELETE /admin/tokens/:id                  - Revoke token',
                    'POST   /admin/tokens/blacklist/:id        - Blacklist token',
                    'GET    /admin/tokens/blacklist            - List blacklisted tokens',
                    'DELETE /admin/tokens/blacklist/:id        - Remove from blacklist',
                    'GET    /admin/tokens/stats                - Token statistics',
                    'POST   /auth/tokens/refresh               - Refresh token',
                    'DELETE /auth/tokens/all                   - Revoke all user tokens',
                    'GET    /auth/tokens/validate              - Validate token'
                ]
            },
            sessions: {
                description: 'Session Management (User sessions, activity tracking)',
                url: '/api/v1',
                basePath: '/api/v1/admin/sessions',
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                endpoints: [
                    'GET    /admin/sessions                      - List all sessions',
                    'GET    /admin/sessions/active               - Get active sessions',
                    'DELETE /admin/sessions/:id                  - Terminate session',
                    'DELETE /admin/sessions/user/:userId         - Terminate user sessions',
                    'GET    /admin/sessions/statistics           - Session statistics',
                    'PUT    /admin/sessions/timeout/:minutes     - Update session timeout',
                    'GET    /auth/sessions/current               - Get current session',
                    'GET    /auth/sessions                       - List my sessions',
                    'DELETE /auth/sessions/:id                   - Terminate my session',
                    'DELETE /auth/sessions/others                - Terminate other sessions',
                    'DELETE /auth/sessions/all                   - Terminate all sessions',
                    'POST   /auth/sessions/extend                - Extend current session'
                ]
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
            radiology: '/api/v1/radiology',
            billing: '/api/v1/billing',
            staff: '/api/v1/staff',
            security: '/api/v1/security',
            employee: '/api/v1/employee',
            dashboard: '/api/v1/dashboard',
            public: '/api/v1/public',
            apiKeys: '/api/v1/admin/api-keys',
            webhooks: '/api/v1/webhooks',
            system: '/api/v1/system',
            rateLimits: '/api/v1/admin/rate-limits',
            tokens: '/api/v1/admin/tokens',
            sessions: '/api/v1/admin/sessions',
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
            '/api/v1/radiology',
            '/api/v1/billing',
            '/api/v1/staff',
            '/api/v1/security',
            '/api/v1/employee',
            '/api/v1/dashboard',
            '/api/v1/public',
            '/api/v1/admin/api-keys (API Key Management)',
            '/api/v1/webhooks (Webhook Management)',
            '/api/v1/system (System Management)',
            '/api/v1/admin/rate-limits (Rate Limit Management)',
            '/api/v1/admin/tokens (Token Management)',
            '/api/v1/admin/sessions (Session Management)',
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

    const networkIp = addresses[0] || '127.0.0.1';
    const tailscaleIp = '100.81.13.80';

    logger.info('\n' + '='.repeat(40));
    logger.info('SERVER STARTED SUCCESSFULLY!');
    logger.info('='.repeat(40));
    logger.info(`Local:    http://localhost:${PORT}`);
    logger.info(`Network:  http://${networkIp}:${PORT}`);
    logger.info(`Tailscale: http://${tailscaleIp}:${PORT}`);
    logger.info('─'.repeat(40));
    logger.info('UTILITY ENDPOINTS:');
    logger.info(`Health:    http://${tailscaleIp}:${PORT}/health`);
    logger.info(`Deep Health: http://${tailscaleIp}:${PORT}/health/deep`);
    logger.info(`Config:    http://${tailscaleIp}:${PORT}/config`);
    logger.info(`API Docs:  http://${tailscaleIp}:${PORT}/api-docs`);
    logger.info(`Test DB:   http://${tailscaleIp}:${PORT}/test-db`);
    logger.info('─'.repeat(40));
    logger.info('API ENDPOINTS:');
    logger.info(`Auth API:  http://${tailscaleIp}:${PORT}/api/v1/auth`);
    logger.info(`Admin API: http://${tailscaleIp}:${PORT}/api/v1/admin`);
    logger.info(`Patient API: http://${tailscaleIp}:${PORT}/api/v1/patient`);
    logger.info(`Doctor API: http://${tailscaleIp}:${PORT}/api/v1/doctor`);
    logger.info(`Nurse API:  http://${tailscaleIp}:${PORT}/api/v1/nurse`);
    logger.info(`Pharmacist API: http://${tailscaleIp}:${PORT}/api/v1/pharmacist`);
    logger.info(`Receptionist API: http://${tailscaleIp}:${PORT}/api/v1/receptionist`);
    logger.info(`Lab API: http://${tailscaleIp}:${PORT}/api/v1/lab`);
    logger.info(`Radiology API: http://${tailscaleIp}:${PORT}/api/v1/radiology`);
    logger.info(`Billing API: http://${tailscaleIp}:${PORT}/api/v1/billing`);
    logger.info(`Staff API: http://${tailscaleIp}:${PORT}/api/v1/staff`);
    logger.info(`Security API: http://${tailscaleIp}:${PORT}/api/v1/security`);
    logger.info(`Employee API: http://${tailscaleIp}:${PORT}/api/v1/employee`);
    logger.info(`Dashboard API: http://${tailscaleIp}:${PORT}/api/v1/dashboard`);
    logger.info(`Public API: http://${tailscaleIp}:${PORT}/api/v1/public`);
    logger.info(`API Key Management: http://${tailscaleIp}:${PORT}/api/v1/admin/api-keys`);
    logger.info(`Webhook Management: http://${tailscaleIp}:${PORT}/api/v1/webhooks`);
    logger.info(`System Management: http://${tailscaleIp}:${PORT}/api/v1/system`);
    logger.info(`Rate Limit Management: http://${tailscaleIp}:${PORT}/api/v1/admin/rate-limits`);
    logger.info(`Token Management: http://${tailscaleIp}:${PORT}/api/v1/admin/tokens`);
    logger.info(`Session Management: http://${tailscaleIp}:${PORT}/api/v1/admin/sessions`);
    logger.info('─'.repeat(40));
    logger.info('SERVER & APP INFO:');
    logger.info(`Team: OctNov`);
    logger.info(`Lead: Koushal Jha`);
    logger.info(`Server PID: ${process.pid}`);
    logger.info(`Node Version: ${process.version}`);
    logger.info(`Environment: ${config.server.env}`);
    logger.info(`API Version: ${config.server.api.version}`);
    logger.info(`Config Version: 3.12.0`);
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