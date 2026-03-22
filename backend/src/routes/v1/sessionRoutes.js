// backend/src/routes/v1/sessionRoutes.js
/**
 * ======================================================================
 * FILE: backend/src/routes/v1/sessionRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Session Management module routes - User session tracking and management.
 * Total Endpoints: 6
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all session management endpoints
 * 
 * BUSINESS RULES:
 * - [BR-SES-01] Sessions expire after inactivity (30 min default)
 * - [BR-SES-02] Max concurrent sessions per user (configurable)
 * - [BR-SES-03] Session tokens can be revoked
 * - [BR-SES-04] Device fingerprint for session binding
 * - [BR-SES-05] All session events are logged
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
const sessionController = require('../../controllers/session/sessionController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateSessionId,
    validateSessionTimeout,
    validatePagination,
    validateDateRange
} = require('../../validators/sessionValidators');

// ============================================
// PUBLIC ROOT ENDPOINT
// ============================================

/**
 * Public root endpoint for Session Management module
 * GET /api/v1/sessions
 */
router.get('/sessions', (req, res) => {
    res.json({
        success: true,
        module: 'Session Management API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/sessions/health',
        authentication: 'Admin access required for management endpoints',
        endpoints: {
            admin: '/api/v1/admin/sessions',
            user: '/api/v1/auth/sessions'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ADMIN SESSION MANAGEMENT (Admin Only)
// ============================================

/**
 * List all active sessions
 * GET /api/v1/admin/sessions
 */
router.get('/admin/sessions',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    auditLogger('SESSION_LIST'),
    sessionController.listSessions
);

/**
 * Get active sessions
 * GET /api/v1/admin/sessions/active
 */
router.get('/admin/sessions/active',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    auditLogger('ACTIVE_SESSIONS_LIST'),
    sessionController.getActiveSessions
);

/**
 * Terminate session by ID
 * DELETE /api/v1/admin/sessions/:id
 * 
 * BUSINESS RULE: [BR-SES-03] Session tokens can be revoked
 */
router.delete('/admin/sessions/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateSessionId,
    auditLogger('SESSION_TERMINATE'),
    sessionController.terminateSession
);

/**
 * Terminate all sessions for a user
 * DELETE /api/v1/admin/sessions/user/:userId
 */
router.delete('/admin/sessions/user/:userId',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateSessionId,
    auditLogger('USER_SESSIONS_TERMINATE'),
    sessionController.terminateUserSessions
);

/**
 * Get session statistics
 * GET /api/v1/admin/sessions/statistics
 */
router.get('/admin/sessions/statistics',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateDateRange,
    auditLogger('SESSION_STATS_VIEW'),
    sessionController.getSessionStats
);

/**
 * Update session timeout configuration
 * PUT /api/v1/admin/sessions/timeout/:minutes
 * 
 * BUSINESS RULE: [BR-SES-01] Sessions expire after inactivity
 */
router.put('/admin/sessions/timeout/:minutes',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateSessionTimeout,
    auditLogger('SESSION_TIMEOUT_UPDATE'),
    sessionController.updateSessionTimeout
);

// ============================================
// USER SESSION OPERATIONS (Authenticated Users)
// ============================================

/**
 * Get my current session
 * GET /api/v1/auth/sessions/current
 */
router.get('/auth/sessions/current',
    authenticate,
    standard,
    auditLogger('CURRENT_SESSION_VIEW'),
    sessionController.getCurrentSession
);

/**
 * List my sessions
 * GET /api/v1/auth/sessions
 */
router.get('/auth/sessions',
    authenticate,
    standard,
    validatePagination,
    auditLogger('USER_SESSIONS_LIST'),
    sessionController.listMySessions
);

/**
 * Terminate a specific session (user's own)
 * DELETE /api/v1/auth/sessions/:id
 */
router.delete('/auth/sessions/:id',
    authenticate,
    sensitive,
    validateSessionId,
    auditLogger('USER_SESSION_TERMINATE'),
    sessionController.terminateMySession
);

/**
 * Terminate all other sessions (keep current)
 * DELETE /api/v1/auth/sessions/others
 */
router.delete('/auth/sessions/others',
    authenticate,
    sensitive,
    auditLogger('OTHER_SESSIONS_TERMINATE'),
    sessionController.terminateOtherSessions
);

/**
 * Terminate all my sessions (including current)
 * DELETE /api/v1/auth/sessions/all
 */
router.delete('/auth/sessions/all',
    authenticate,
    sensitive,
    auditLogger('ALL_SESSIONS_TERMINATE'),
    sessionController.terminateAllMySessions
);

/**
 * Extend session (refresh activity)
 * POST /api/v1/auth/sessions/extend
 */
router.post('/auth/sessions/extend',
    authenticate,
    standard,
    auditLogger('SESSION_EXTEND'),
    sessionController.extendSession
);

// ============================================
// PROTECTED HEALTH CHECK
// ============================================

/**
 * Health check for Session module
 * GET /api/v1/sessions/health
 */
router.get('/sessions/health',
    authenticate,
    authorize('super_admin', 'it_admin'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Session Management API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            userId: req.user.id,
            endpoints: {
                total: 12,
                admin: 6,
                user: 6,
                health: 1
            },
            business_rules: [
                'BR-SES-01: Session timeout after inactivity',
                'BR-SES-02: Max concurrent sessions limit',
                'BR-SES-03: Session revocation support',
                'BR-SES-04: Device fingerprint binding',
                'BR-SES-05: Full audit logging'
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
 * Root               | 1         | Base URL info  | 🔓 Public
 * Admin Management   | 6         | [BR-SES-01][03]| 🔒 Admin Only
 * User Operations    | 7         | [BR-SES-02][04]| 🔒 Authenticated
 * Health             | 1         | Status & info  | 🔒 Admin Only
 * -------------------|-----------|----------------|----------------
 * TOTAL              | 15        | Complete Session Management
 * 
 * ======================================================================
 */