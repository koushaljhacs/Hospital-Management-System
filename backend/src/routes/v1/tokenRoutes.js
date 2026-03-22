// backend/src/routes/v1/tokenRoutes.js
/**
 * ======================================================================
 * FILE: backend/src/routes/v1/tokenRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Token Management module routes - Comprehensive token lifecycle management.
 * Total Endpoints: 10
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all token management endpoints
 * 
 * BUSINESS RULES:
 * - [BR-TKN-01] Tokens have configurable expiry
 * - [BR-TKN-02] Tokens can be revoked/blacklisted
 * - [BR-TKN-03] One-time tokens invalid after use
 * - [BR-TKN-04] Token rotation for security
 * - [BR-TKN-05] All token operations are audited
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
const tokenController = require('../../controllers/token/tokenController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateTokenId,
    validateTokenCreate,
    validateTokenRevoke,
    validateTokenRotate,
    validateTokenBlacklist,
    validatePagination,
    validateDateRange
} = require('../../validators/tokenValidators');

// ============================================
// PUBLIC ROOT ENDPOINT
// ============================================

/**
 * Public root endpoint for Token Management module
 * GET /api/v1/tokens
 */
router.get('/tokens', (req, res) => {
    res.json({
        success: true,
        module: 'Token Management API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/tokens/health',
        authentication: 'Admin access required for management endpoints',
        endpoints: {
            admin: '/api/v1/admin/tokens',
            auth: '/api/v1/auth/tokens'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ADMIN TOKEN MANAGEMENT (Admin Only)
// ============================================

/**
 * List all active tokens
 * GET /api/v1/admin/tokens
 */
router.get('/admin/tokens',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    auditLogger('TOKEN_LIST'),
    tokenController.listTokens
);

/**
 * Get tokens by user ID
 * GET /api/v1/admin/tokens/user/:userId
 */
router.get('/admin/tokens/user/:userId',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateTokenId,
    auditLogger('TOKEN_LIST_BY_USER'),
    tokenController.getTokensByUser
);

/**
 * Revoke token
 * DELETE /api/v1/admin/tokens/:id
 * 
 * BUSINESS RULE: [BR-TKN-02] Tokens can be revoked
 */
router.delete('/admin/tokens/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateTokenId,
    auditLogger('TOKEN_REVOKE'),
    tokenController.revokeToken
);

/**
 * Blacklist token
 * POST /api/v1/admin/tokens/blacklist/:id
 * 
 * BUSINESS RULE: [BR-TKN-02] Tokens can be blacklisted
 */
router.post('/admin/tokens/blacklist/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateTokenBlacklist,
    auditLogger('TOKEN_BLACKLIST'),
    tokenController.blacklistToken
);

/**
 * List blacklisted tokens
 * GET /api/v1/admin/tokens/blacklist
 */
router.get('/admin/tokens/blacklist',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    auditLogger('TOKEN_BLACKLIST_LIST'),
    tokenController.listBlacklistedTokens
);

/**
 * Remove token from blacklist
 * DELETE /api/v1/admin/tokens/blacklist/:id
 */
router.delete('/admin/tokens/blacklist/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateTokenId,
    auditLogger('TOKEN_BLACKLIST_REMOVE'),
    tokenController.removeFromBlacklist
);

/**
 * Get token statistics
 * GET /api/v1/admin/tokens/stats
 */
router.get('/admin/tokens/stats',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateDateRange,
    auditLogger('TOKEN_STATS_VIEW'),
    tokenController.getTokenStats
);

// ============================================
// AUTH TOKEN OPERATIONS (User Level)
// ============================================

/**
 * Refresh token
 * POST /api/v1/auth/tokens/refresh
 * 
 * BUSINESS RULE: [BR-TKN-04] Token rotation for security
 */
router.post('/auth/tokens/refresh',
    authenticate,
    standard,
    auditLogger('TOKEN_REFRESH'),
    tokenController.refreshToken
);

/**
 * Revoke all tokens for current user
 * DELETE /api/v1/auth/tokens/all
 * 
 * BUSINESS RULE: [BR-TKN-02] Bulk token revocation
 */
router.delete('/auth/tokens/all',
    authenticate,
    sensitive,
    auditLogger('TOKEN_REVOKE_ALL'),
    tokenController.revokeAllUserTokens
);

/**
 * Validate token
 * GET /api/v1/auth/tokens/validate
 */
router.get('/auth/tokens/validate',
    authenticate,
    standard,
    auditLogger('TOKEN_VALIDATE'),
    tokenController.validateToken
);

// ============================================
// PROTECTED HEALTH CHECK
// ============================================

/**
 * Health check for Token module
 * GET /api/v1/tokens/health
 */
router.get('/tokens/health',
    authenticate,
    authorize('super_admin', 'it_admin'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Token Management API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            userId: req.user.id,
            endpoints: {
                total: 10,
                admin: 7,
                auth: 3,
                health: 1
            },
            business_rules: [
                'BR-TKN-01: Configurable token expiry',
                'BR-TKN-02: Revoke/blacklist support',
                'BR-TKN-03: One-time tokens invalid after use',
                'BR-TKN-04: Token rotation support',
                'BR-TKN-05: Full audit logging'
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
 * Admin Management   | 7         | [BR-TKN-01][02]| 🔒 Admin Only
 * Auth Operations    | 3         | [BR-TKN-03][04]| 🔒 Authenticated
 * Health             | 1         | Status & info  | 🔒 Admin Only
 * -------------------|-----------|----------------|----------------
 * TOTAL              | 12        | Complete Token Management
 * 
 * ======================================================================
 */