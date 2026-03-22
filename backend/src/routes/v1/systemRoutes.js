// backend/src/routes/v1/systemRoutes.js
/**
 * ======================================================================
 * FILE: backend/src/routes/v1/systemRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * System Management module routes - Health checks, version, API docs, system info.
 * Total Endpoints: 10
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all system endpoints
 * 
 * BUSINESS RULES:
 * - [BR-SYS-01] Health checks must return within 500ms
 * - [BR-SYS-02] Version info must be publicly accessible
 * - [BR-SYS-03] System info restricted to authenticated users
 * - [BR-SYS-04] Rate limits excluded for health checks
 * - [BR-SYS-05] All system events are logged
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();

// ============================================
// IMPORT MIDDLEWARES
// ============================================
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/rbac');
const { standard, sensitive } = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');

// ============================================
// IMPORT CONTROLLERS
// ============================================
const systemController = require('../../controllers/system/systemController');

// ============================================
// PUBLIC SYSTEM ENDPOINTS (No Auth Required)
// ============================================

/**
 * Public root endpoint for System module
 * GET /api/v1/system
 */
router.get('/system', (req, res) => {
    res.json({
        success: true,
        module: 'System Management API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/system/health',
        endpoints: {
            health: '/api/v1/system/health',
            version: '/api/v1/system/version',
            info: '/api/v1/system/info',
            status: '/api/v1/system/status'
        },
        timestamp: new Date().toISOString()
    });
});

/**
 * Basic health check (Public)
 * GET /api/v1/system/health
 * 
 * BUSINESS RULE: [BR-SYS-01] Response within 500ms
 */
router.get('/system/health',
    standard,
    systemController.healthCheck
);

/**
 * Detailed health check (Public)
 * GET /api/v1/system/health/detailed
 */
router.get('/system/health/detailed',
    standard,
    systemController.detailedHealthCheck
);

/**
 * Database health check (Public)
 * GET /api/v1/system/health/db
 */
router.get('/system/health/db',
    standard,
    systemController.dbHealthCheck
);

/**
 * Cache health check (Public)
 * GET /api/v1/system/health/cache
 */
router.get('/system/health/cache',
    standard,
    systemController.cacheHealthCheck
);

/**
 * Get API version (Public)
 * GET /api/v1/system/version
 * 
 * BUSINESS RULE: [BR-SYS-02] Version info publicly accessible
 */
router.get('/system/version',
    standard,
    systemController.getVersion
);

/**
 * Get API documentation
 * GET /api/v1/system/api-docs
 */
router.get('/system/api-docs',
    standard,
    systemController.getApiDocs
);

/**
 * Get Swagger JSON
 * GET /api/v1/system/swagger.json
 */
router.get('/system/swagger.json',
    standard,
    systemController.getSwaggerJson
);

/**
 * Get Swagger YAML
 * GET /api/v1/system/swagger.yaml
 */
router.get('/system/swagger.yaml',
    standard,
    systemController.getSwaggerYaml
);

// ============================================
// PROTECTED SYSTEM ENDPOINTS (Auth Required)
// ============================================

/**
 * Get system information (Protected)
 * GET /api/v1/system/info
 * 
 * BUSINESS RULE: [BR-SYS-03] System info restricted to authenticated users
 */
router.get('/system/info',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    auditLogger('SYSTEM_INFO_VIEW'),
    systemController.getSystemInfo
);

/**
 * Get system status (Protected)
 * GET /api/v1/system/status
 */
router.get('/system/status',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    auditLogger('SYSTEM_STATUS_VIEW'),
    systemController.getSystemStatus
);

// ============================================
// PROTECTED HEALTH CHECK
// ============================================

/**
 * Health check for System module (Protected)
 * GET /api/v1/system/health/auth
 */
router.get('/system/health/auth',
    authenticate,
    authorize('super_admin', 'it_admin'),
    (req, res) => {
        res.json({
            success: true,
            module: 'System Management API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            userId: req.user.id,
            endpoints: {
                total: 10,
                public: 8,
                protected: 2
            },
            business_rules: [
                'BR-SYS-01: Health check response < 500ms',
                'BR-SYS-02: Version info public',
                'BR-SYS-03: System info protected',
                'BR-SYS-04: Health checks bypass rate limits',
                'BR-SYS-05: All events logged'
            ]
        });
    }
);

module.exports = router;

/**
 * ======================================================================
 * ROUTE SUMMARY:
 * ======================================================================
 * 
 * Category           | Endpoints | Business Rules | Authentication
 * -------------------|-----------|----------------|----------------
 * Public Health      | 4         | [BR-SYS-01]    | 🔓 Public
 * Public Version/Docs| 4         | [BR-SYS-02]    | 🔓 Public
 * Protected System   | 2         | [BR-SYS-03]    | 🔒 Admin Only
 * -------------------|-----------|----------------|----------------
 * TOTAL              | 10        | Complete System Management
 * 
 * ENDPOINTS:
 * 1. GET /system                     - Module info
 * 2. GET /system/health              - Basic health check
 * 3. GET /system/health/detailed     - Detailed health
 * 4. GET /system/health/db           - Database health
 * 5. GET /system/health/cache        - Cache health
 * 6. GET /system/version             - API version
 * 7. GET /system/api-docs            - API documentation
 * 8. GET /system/swagger.json        - Swagger JSON
 * 9. GET /system/swagger.yaml        - Swagger YAML
 * 10. GET /system/info               - System info (protected)
 * 11. GET /system/status             - System status (protected)
 * 
 * ======================================================================
 */