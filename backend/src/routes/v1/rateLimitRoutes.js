// backend/src/routes/v1/rateLimitRoutes.js
/**
 * ======================================================================
 * FILE: backend/src/routes/v1/rateLimitRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Rate Limit Management module routes - Dynamic rate limit configuration.
 * Total Endpoints: 8
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all rate limit endpoints
 * 
 * BUSINESS RULES:
 * - [BR-RL-01] Rate limits apply per user/role/endpoint/IP
 * - [BR-RL-02] Rules are evaluated by priority
 * - [BR-RL-03] Rate limit exceeded triggers block/throttle
 * - [BR-RL-04] Exemptions for whitelisted users/roles
 * - [BR-RL-05] All rate limit events are logged
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
const rateLimitController = require('../../controllers/rateLimit/rateLimitController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateRuleId,
    validateRuleCreate,
    validateRuleUpdate,
    validateExemptionId,
    validateExemptionCreate,
    validatePagination,
    validateDateRange
} = require('../../validators/rateLimitValidators');

// ============================================
// PUBLIC ROOT ENDPOINT
// ============================================

/**
 * Public root endpoint for Rate Limit Management module
 * GET /api/v1/rate-limits
 */
router.get('/rate-limits', (req, res) => {
    res.json({
        success: true,
        module: 'Rate Limit Management API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/rate-limits/health',
        authentication: 'Admin access required for all endpoints',
        endpoints: {
            rules: '/api/v1/admin/rate-limits/rules',
            exemptions: '/api/v1/admin/rate-limits/exemptions'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// RATE LIMIT RULES MANAGEMENT (Admin Only)
// ============================================

/**
 * List all rate limit rules
 * GET /api/v1/admin/rate-limits/rules
 */
router.get('/admin/rate-limits/rules',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    auditLogger('RATE_LIMIT_RULES_LIST'),
    rateLimitController.listRules
);

/**
 * Get rate limit rule by ID
 * GET /api/v1/admin/rate-limits/rules/:id
 */
router.get('/admin/rate-limits/rules/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateRuleId,
    auditLogger('RATE_LIMIT_RULE_VIEW'),
    rateLimitController.getRuleById
);

/**
 * Create rate limit rule
 * POST /api/v1/admin/rate-limits/rules
 * 
 * BUSINESS RULE: [BR-RL-02] Rules evaluated by priority
 */
router.post('/admin/rate-limits/rules',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateRuleCreate,
    auditLogger('RATE_LIMIT_RULE_CREATE'),
    rateLimitController.createRule
);

/**
 * Update rate limit rule
 * PUT /api/v1/admin/rate-limits/rules/:id
 */
router.put('/admin/rate-limits/rules/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateRuleUpdate,
    auditLogger('RATE_LIMIT_RULE_UPDATE'),
    rateLimitController.updateRule
);

/**
 * Delete rate limit rule
 * DELETE /api/v1/admin/rate-limits/rules/:id
 */
router.delete('/admin/rate-limits/rules/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateRuleId,
    auditLogger('RATE_LIMIT_RULE_DELETE'),
    rateLimitController.deleteRule
);

// ============================================
// RATE LIMIT EXEMPTIONS MANAGEMENT (Admin Only)
// ============================================

/**
 * List all rate limit exemptions
 * GET /api/v1/admin/rate-limits/exemptions
 */
router.get('/admin/rate-limits/exemptions',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    auditLogger('RATE_LIMIT_EXEMPTIONS_LIST'),
    rateLimitController.listExemptions
);

/**
 * Get exemption by ID
 * GET /api/v1/admin/rate-limits/exemptions/:id
 */
router.get('/admin/rate-limits/exemptions/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateExemptionId,
    auditLogger('RATE_LIMIT_EXEMPTION_VIEW'),
    rateLimitController.getExemptionById
);

/**
 * Create rate limit exemption
 * POST /api/v1/admin/rate-limits/exemptions
 * 
 * BUSINESS RULE: [BR-RL-04] Exemptions for whitelisted users/roles
 */
router.post('/admin/rate-limits/exemptions',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateExemptionCreate,
    auditLogger('RATE_LIMIT_EXEMPTION_CREATE'),
    rateLimitController.createExemption
);

/**
 * Delete rate limit exemption
 * DELETE /api/v1/admin/rate-limits/exemptions/:id
 */
router.delete('/admin/rate-limits/exemptions/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateExemptionId,
    auditLogger('RATE_LIMIT_EXEMPTION_DELETE'),
    rateLimitController.deleteExemption
);

// ============================================
// RATE LIMIT STATISTICS (Admin Only)
// ============================================

/**
 * Get rate limit statistics
 * GET /api/v1/admin/rate-limits/stats
 */
router.get('/admin/rate-limits/stats',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateDateRange,
    auditLogger('RATE_LIMIT_STATS_VIEW'),
    rateLimitController.getRateLimitStats
);

/**
 * Get rate limit breaches
 * GET /api/v1/admin/rate-limits/breaches
 */
router.get('/admin/rate-limits/breaches',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('RATE_LIMIT_BREACHES_VIEW'),
    rateLimitController.getRateLimitBreaches
);

// ============================================
// PROTECTED HEALTH CHECK
// ============================================

/**
 * Health check for Rate Limit module
 * GET /api/v1/rate-limits/health
 */
router.get('/rate-limits/health',
    authenticate,
    authorize('super_admin', 'it_admin'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Rate Limit Management API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            userId: req.user.id,
            endpoints: {
                total: 8,
                rules: 5,
                exemptions: 4,
                stats: 2,
                health: 1
            },
            business_rules: [
                'BR-RL-01: Rate limits per user/role/endpoint/IP',
                'BR-RL-02: Rules evaluated by priority',
                'BR-RL-03: Exceeded triggers block/throttle',
                'BR-RL-04: Exemptions for whitelisted',
                'BR-RL-05: All events logged'
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
 * Rules Management   | 5         | [BR-RL-01][02] | 🔒 Admin Only
 * Exemptions         | 4         | [BR-RL-04]     | 🔒 Admin Only
 * Statistics         | 2         | [BR-RL-03][05] | 🔒 Admin Only
 * Health             | 1         | Status & info  | 🔒 Admin Only
 * -------------------|-----------|----------------|----------------
 * TOTAL              | 13        | Complete Rate Limit Management
 * 
 * ======================================================================
 */