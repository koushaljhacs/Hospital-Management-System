/**
 * ======================================================================
 * FILE: backend/server.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Main entry point for the backend server.
 * 
 * VERSION: 2.6.0
 * CREATED: 2026-03-15
 * UPDATED: 2026-03-16
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
 * 
 * DEPENDENCIES:
 * - express v4.22.1
 * - cors v2.8.6
 * - helmet v7.2.0
 * - dotenv v16.0.3
 * - express-rate-limit (for auth endpoints)
 * ======================================================================
 */

const express = require('express');
const path = require('path');           
const dotenv = require('dotenv');       
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ============================================
// LOAD ENVIRONMENT VARIABLES FIRST!
// ============================================
const envPath = path.resolve(__dirname, '.env');
console.log('📁 Loading .env from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Failed to load .env file!');
    console.error('Error:', result.error.message);
    console.error('💡 Make sure .env file exists at:', envPath);
    process.exit(1);
}
console.log('✅ .env file loaded successfully!');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('📊 DB Host:', process.env.DB_HOST);
console.log('📊 Port:', process.env.PORT);

// ============================================
// NOW import config (which uses process.env)
// ============================================
const config = require('./src/config/env');      
const db = require('./src/config/database');
const logger = require('./src/utils/logger');     

const app = express();
const PORT = config.server.port;

// ============================================
// GLOBAL RATE LIMITING
// ============================================
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply global rate limiting to all requests
app.use(globalLimiter);

// Middleware
app.use(helmet());
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.http(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

// ============================================
// IMPORT ROUTES
// ============================================
const authRoutes = require('./src/routes/v1/authRoutes');
const adminRoutes = require('./src/routes/v1/adminRoutes');
const patientRoutes = require('./src/routes/v1/patientRoutes');
const doctorRoutes = require('./src/routes/v1/doctorRoutes');
const publicRoutes = require('./src/routes/v1/publicRoutes'); // ADDED: Public routes
const nurseRoutes = require('./src/routes/v1/nurseRoutes');   // ADDED: Nurse routes

// ============================================
// API ROUTES
// ============================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/patient', patientRoutes);
app.use('/api/v1/doctor', doctorRoutes);
app.use('/api/v1/public', publicRoutes); // ADDED: Mount public routes
app.use('/api/v1/nurse', nurseRoutes);   // ADDED: Mount nurse routes

// Basic test route
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
            nurse: '/api/v1/nurse',      // ADDED: Show nurse endpoints
            public: '/api/v1/public',     // ADDED: Show public endpoints
            health: '/health',
            docs: '/api-docs',
            testDb: '/test-db',
            config: '/config'
        },
        environment: config.server.env,
        timestamp: new Date().toISOString()
    });
});

// Health check route
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await db.healthCheck();
        res.status(200).json({
            status: 'healthy',
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                node: process.version,
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

// Test database route
app.get('/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW() as time, current_database() as db');
        res.json({
            success: true,
            data: result.rows[0],
            connection: {
                host: config.database.host,
                port: config.database.port,
                database: config.database.name
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Database test failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Config test route (development only)
app.get('/config', (req, res) => {
    if (config.isDevelopment) {
        res.json({
            success: true,
            config: config.getSanitized(),
            env: {
                port: process.env.PORT,
                dbHost: process.env.DB_HOST,
                nodeEnv: process.env.NODE_ENV
            }
        });
    } else {
        res.status(404).json({ success: false, error: 'Not found' });
    }
});

// API Routes listing (helpful for developers)
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
            '/api/v1/nurse',      // ADDED: Show in available routes
            '/api/v1/public',     // ADDED: Show in available routes
            '/health',
            '/test-db',
            '/config'
        ],
        documentation: 'See individual route endpoints for details'
    });
});

// 404 handler
app.use((req, res) => {
    logger.warn('Route not found', { path: req.url, method: req.method });
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.url
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Server error', { 
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    res.status(500).json({
        success: false,
        error: config.isDevelopment ? err.message : 'Internal server error'
    });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    const interfaces = require('os').networkInterfaces();
    const addresses = [];
    
    Object.keys(interfaces).forEach(iface => {
        interfaces[iface].forEach(addr => {
            if (addr.family === 'IPv4' && !addr.internal) {
                addresses.push(addr.address);
            }
        });
    });

    logger.info('\n========================================');
    logger.info('🚀 SERVER STARTED SUCCESSFULLY!');
    logger.info('========================================');
    logger.info(`📍 Local:    http://localhost:${PORT}`);
    logger.info(`📍 Network:   http://${addresses[0] || '127.0.0.1'}:${PORT}`);
    logger.info(`📍 Tailscale: http://100.81.13.80:${PORT}`);
    logger.info(`📍 Health:    http://localhost:${PORT}/health`);
    logger.info(`📍 Config:    http://localhost:${PORT}/config`);
    logger.info(`📍 Auth API:  http://localhost:${PORT}/api/v1/auth`);
    logger.info(`📍 Admin API: http://localhost:${PORT}/api/v1/admin`);
    logger.info(`📍 Patient API: http://localhost:${PORT}/api/v1/patient`);
    logger.info(`📍 Doctor API: http://localhost:${PORT}/api/v1/doctor`);
    logger.info(`📍 Nurse API:  http://localhost:${PORT}/api/v1/nurse`);   // ADDED: Show nurse API
    logger.info(`📍 Public API: http://localhost:${PORT}/api/v1/public`);  // ADDED: Show public API
    logger.info('========================================');
    logger.info(`Team: OctNov`);
    logger.info(`Lead: Koushal Jha`);
    logger.info(`Server PID: ${process.pid}`);
    logger.info(`Node Version: ${process.version}`);
    logger.info(`Environment: ${config.server.env}`);
    logger.info(`Config Version: 2.6.0`); // UPDATED: Version
    logger.info('========================================\n');
});

// Server error handling
server.on('error', (error) => {
    logger.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use!`);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Closing server...');
    server.close(() => {
        logger.info('Server closed.');
        db.shutdown();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received. Closing server...');
    server.close(() => {
        logger.info('Server closed.');
        db.shutdown();
        process.exit(0);
    });
});