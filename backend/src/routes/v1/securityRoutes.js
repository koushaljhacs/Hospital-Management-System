/**
 * ======================================================================
 * FILE: backend/src/routes/v1/securityRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Security Guard module routes - All security guard-facing endpoints.
 * Total Endpoints: 18 (including root endpoint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all security guard endpoints
 * 
 * BUSINESS RULES COVERED:
 * - [BR-49] All entries must be logged with ID verification
 * - [BR-50] Visitors must be registered before entry
 * - [BR-51] Exit must be recorded for all entries
 * - [BR-52] Active visitors cannot exceed capacity
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
const entryController = require('../../controllers/security/entryController');
const exitController = require('../../controllers/security/exitController');
const visitorController = require('../../controllers/security/visitorController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateEntry,
    validateEntryStatus,
    validateExit,
    validateVisitor,
    validateVisitorStatus,
    validatePagination
} = require('../../validators/securityValidators');

// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// v1.0.0 - Added public root endpoint

/**
 * Public root endpoint for security guard module
 * GET /api/v1/security
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Security API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/security/health',
        authentication: 'Bearer token required for all data endpoints',
        available: {
            health: '/api/v1/security/health'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ============================================
// ENTRY MANAGEMENT ROUTES (5 endpoints)
// ============================================
// ============================================

/**
 * Get all entries
 * GET /api/v1/security/entries
 */
router.get('/entries',
    authenticate,
    authorize('security_guard'),
    standard,
    validatePagination,
    auditLogger('SECURITY_VIEW_ENTRIES'),
    entryController.getAllEntries
);

/**
 * Get today's entries
 * GET /api/v1/security/entries/today
 */
router.get('/entries/today',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_TODAY_ENTRIES'),
    entryController.getTodayEntries
);

/**
 * Get entry by ID
 * GET /api/v1/security/entries/:id
 */
router.get('/entries/:id',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_ENTRY'),
    entryController.getEntryById
);

/**
 * Record entry
 * POST /api/v1/security/entries
 * 
 * BUSINESS RULE: [BR-49] All entries must be logged with ID verification
 */
router.post('/entries',
    authenticate,
    authorize('security_guard'),
    sensitive,
    validateEntry,
    auditLogger('SECURITY_RECORD_ENTRY'),
    entryController.recordEntry
);

/**
 * Mark exit for entry
 * PUT /api/v1/security/entries/:id/exit
 * 
 * BUSINESS RULE: [BR-51] Exit must be recorded for all entries
 */
router.put('/entries/:id/exit',
    authenticate,
    authorize('security_guard'),
    sensitive,
    validateEntryStatus,
    auditLogger('SECURITY_MARK_EXIT'),
    entryController.markExit
);

/**
 * Get active entries
 * GET /api/v1/security/entries/active
 */
router.get('/entries/active',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_ACTIVE_ENTRIES'),
    entryController.getActiveEntries
);

// ============================================
// ============================================
// EXIT MANAGEMENT ROUTES (2 endpoints)
// ============================================
// ============================================

/**
 * Record exit (separate endpoint)
 * POST /api/v1/security/exits
 * 
 * BUSINESS RULE: [BR-51] Exit must be recorded for all entries
 */
router.post('/exits',
    authenticate,
    authorize('security_guard'),
    sensitive,
    validateExit,
    auditLogger('SECURITY_RECORD_EXIT'),
    exitController.recordExit
);

/**
 * Get today's exits
 * GET /api/v1/security/exits/today
 */
router.get('/exits/today',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_TODAY_EXITS'),
    exitController.getTodayExits
);

// ============================================
// ============================================
// VISITOR MANAGEMENT ROUTES (8 endpoints)
// ============================================
// ============================================

/**
 * Get all visitors
 * GET /api/v1/security/visitors
 */
router.get('/visitors',
    authenticate,
    authorize('security_guard'),
    standard,
    validatePagination,
    auditLogger('SECURITY_VIEW_VISITORS'),
    visitorController.getAllVisitors
);

/**
 * Get active visitors
 * GET /api/v1/security/visitors/active
 * 
 * BUSINESS RULE: [BR-52] Active visitors cannot exceed capacity
 */
router.get('/visitors/active',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_ACTIVE_VISITORS'),
    visitorController.getActiveVisitors
);

/**
 * Get visitor by ID
 * GET /api/v1/security/visitors/:id
 */
router.get('/visitors/:id',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_VISITOR'),
    visitorController.getVisitorById
);

/**
 * Register visitor
 * POST /api/v1/security/visitors
 * 
 * BUSINESS RULE: [BR-50] Visitors must be registered before entry
 */
router.post('/visitors',
    authenticate,
    authorize('security_guard'),
    sensitive,
    validateVisitor,
    auditLogger('SECURITY_REGISTER_VISITOR'),
    visitorController.registerVisitor
);

/**
 * Check out visitor
 * PUT /api/v1/security/visitors/:id/check-out
 */
router.put('/visitors/:id/check-out',
    authenticate,
    authorize('security_guard'),
    sensitive,
    validateVisitorStatus,
    auditLogger('SECURITY_CHECKOUT_VISITOR'),
    visitorController.checkOutVisitor
);

/**
 * Get visitor history
 * GET /api/v1/security/visitors/history
 */
router.get('/visitors/history',
    authenticate,
    authorize('security_guard'),
    standard,
    validatePagination,
    auditLogger('SECURITY_VIEW_VISITOR_HISTORY'),
    visitorController.getVisitorHistory
);

/**
 * Get visitor statistics
 * GET /api/v1/security/visitors/stats
 */
router.get('/visitors/stats',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_VISITOR_STATS'),
    visitorController.getVisitorStats
);

/**
 * Get visitor by ID card
 * GET /api/v1/security/visitors/id-card/:id_card
 */
router.get('/visitors/id-card/:id_card',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_VISITOR_BY_IDCARD'),
    visitorController.getVisitorByIdCard
);

// ============================================
// ============================================
// DASHBOARD ROUTES (1 endpoint)
// ============================================
// ============================================

/**
 * Get security dashboard
 * GET /api/v1/security/dashboard
 */
router.get('/dashboard',
    authenticate,
    authorize('security_guard'),
    standard,
    auditLogger('SECURITY_VIEW_DASHBOARD'),
    async (req, res, next) => {
        try {
            const securityService = require('../../services/security/securityDashboardService');
            const dashboard = await securityService.getDashboard(req.user.id);
            res.json({
                success: true,
                data: dashboard,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            next(error);
        }
    }
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.0 - Protected with authentication

/**
 * Health check for security guard module
 * GET /api/v1/security/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('security_guard'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Security API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            guardId: req.user.id,
            endpoints: {
                total: 18,
                root: 1,
                entries: 5,
                exits: 2,
                visitors: 8,
                dashboard: 1,
                health: 1
            }
        });
    }
);

module.exports = router;

/**
 * ======================================================================
 * ROUTE SUMMARY:
 * ======================================================================
 * 
 * Category           | Count | Business Rules | Authentication
 * -------------------|-------|----------------|----------------
 * Root               | 1     | Base URL info  | 🔓 Public
 * Entry Management   | 5     | [BR-49][BR-51] | 🔒 Protected
 * Exit Management    | 2     | [BR-51]        | 🔒 Protected
 * Visitor Management | 8     | [BR-50][BR-52] | 🔒 Protected
 * Dashboard          | 1     | Overview       | 🔒 Protected
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 18    | Complete Security Guard Module
 * 
 * RBAC PERMISSIONS USED:
 * - view_entries, record_entry, mark_exit
 * - view_exits, record_exit
 * - view_visitors, register_visitor, checkout_visitor
 * - view_dashboard
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All data endpoints: Require valid authentication
 * 
 * ======================================================================
 */