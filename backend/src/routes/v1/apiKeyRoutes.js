// backend/src/routes/v1/apiKeyRoutes.js
/**
 * ======================================================================
 * FILE: backend/src/routes/v1/apiKeyRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * API Key Management module routes - Third-party style authentication.
 * Total Endpoints: 12
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all API key management endpoints
 * 
 * BUSINESS RULES:
 * - [BR-API-01] API keys must be unique per user
 * - [BR-API-02] Keys expire after configured duration
 * - [BR-API-03] Rate limits enforced per key
 * - [BR-API-04] Keys can be revoked/rotated
 * - [BR-API-05] All API key usage is audited
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
const apiKeyController = require('../../controllers/apiKey/apiKeyController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateApiKeyCreate,
    validateApiKeyUpdate,
    validateApiKeyId,
    validateApiKeyRevoke,
    validateApiKeyRotate,
    validatePagination,
    validateDateRange
} = require('../../validators/apiKeyValidators');

// ============================================
// PUBLIC ROOT ENDPOINT
// ============================================

/**
 * Public root endpoint for API Key Management module
 * GET /api/v1/api-keys
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'API Key Management',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/api-keys/health',
        authentication: 'Admin access required for all management endpoints',
        available: {
            health: '/api/v1/api-keys/health'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ============================================
// API KEY MANAGEMENT ROUTES (12 endpoints)
// ============================================
// ============================================

// ========== LIST & RETRIEVAL ==========

/**
 * List all API keys
 * GET /api/v1/api-keys
 * 
 * BUSINESS RULE: [BR-API-01] Keys are unique per user
 */
router.get('/api-keys',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    auditLogger('API_KEY_LIST'),
    apiKeyController.listApiKeys
);

/**
 * Get API key by ID
 * GET /api/v1/api-keys/:id
 */
router.get('/api-keys/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateApiKeyId,
    auditLogger('API_KEY_VIEW'),
    apiKeyController.getApiKeyById
);

/**
 * Get API key usage logs
 * GET /api/v1/api-keys/logs
 */
router.get('/api-keys/logs',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('API_KEY_LOGS_VIEW'),
    apiKeyController.getApiKeyLogs
);

/**
 * Get API key statistics
 * GET /api/v1/api-keys/stats
 */
router.get('/api-keys/stats',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    auditLogger('API_KEY_STATS_VIEW'),
    apiKeyController.getApiKeyStats
);

/**
 * Get available permissions for API keys
 * GET /api/v1/api-keys/permissions
 */
router.get('/api-keys/permissions',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    auditLogger('API_KEY_PERMISSIONS_VIEW'),
    apiKeyController.getAvailablePermissions
);

/**
 * Get usage details for specific API key
 * GET /api/v1/api-keys/usage/:id
 */
router.get('/api-keys/usage/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateApiKeyId,
    auditLogger('API_KEY_USAGE_VIEW'),
    apiKeyController.getApiKeyUsage
);

// ========== CREATE & UPDATE ==========

/**
 * Create new API key
 * POST /api/v1/api-keys
 * 
 * BUSINESS RULE: [BR-API-02] Keys expire after configured duration
 * BUSINESS RULE: [BR-API-03] Rate limits configured per key
 */
router.post('/api-keys',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateApiKeyCreate,
    auditLogger('API_KEY_CREATE'),
    apiKeyController.createApiKey
);

/**
 * Update API key
 * PUT /api/v1/api-keys/:id
 */
router.put('/api-keys/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateApiKeyUpdate,
    auditLogger('API_KEY_UPDATE'),
    apiKeyController.updateApiKey
);

/**
 * Delete API key (soft delete)
 * DELETE /api/v1/api-keys/:id
 */
router.delete('/api-keys/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateApiKeyId,
    auditLogger('API_KEY_DELETE'),
    apiKeyController.deleteApiKey
);

// ========== OPERATIONS ==========

/**
 * Revoke API key
 * POST /api/v1/api-keys/:id/revoke
 * 
 * BUSINESS RULE: [BR-API-04] Keys can be revoked
 */
router.post('/api-keys/:id/revoke',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateApiKeyRevoke,
    auditLogger('API_KEY_REVOKE'),
    apiKeyController.revokeApiKey
);

/**
 * Rotate API key (generate new key, keep old for grace period)
 * POST /api/v1/api-keys/:id/rotate
 * 
 * BUSINESS RULE: [BR-API-04] Keys can be rotated
 */
router.post('/api-keys/:id/rotate',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateApiKeyRotate,
    auditLogger('API_KEY_ROTATE'),
    apiKeyController.rotateApiKey
);

/**
 * Validate API key (public endpoint for key validation)
 * POST /api/v1/api-keys/validate
 * 
 * BUSINESS RULE: [BR-API-05] All API key usage is audited
 */
router.post('/api-keys/validate',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    auditLogger('API_KEY_VALIDATE'),
    apiKeyController.validateApiKey
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================

/**
 * Health check for API Key Management module
 * GET /api/v1/api-keys/health
 * Authentication required - provides detailed module status
 */
router.get('/health',
    authenticate,
    authorize('super_admin', 'it_admin'),
    (req, res) => {
        res.json({
            success: true,
            module: 'API Key Management API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            userId: req.user.id,
            endpoints: {
                total: 12,
                root: 1,
                list: 6,
                create_update: 3,
                operations: 3,
                health: 1
            },
            business_rules: [
                'BR-API-01: Keys are unique per user',
                'BR-API-02: Keys expire after configured duration',
                'BR-API-03: Rate limits enforced per key',
                'BR-API-04: Keys can be revoked/rotated',
                'BR-API-05: All usage is audited'
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
 * List & Retrieval   | 6         | [BR-API-01]    | 🔒 Protected (Admin)
 * Create & Update    | 3         | [BR-API-02][03]| 🔒 Protected (Admin)
 * Operations         | 3         | [BR-API-04][05]| 🔒 Protected (Admin)
 * Health             | 1         | Status & info  | 🔒 Protected (Admin)
 * -------------------|-----------|----------------|----------------
 * TOTAL              | 14        | Complete API Key Management
 * 
 * RBAC PERMISSIONS USED:
 * - super_admin: Full access to all API key operations
 * - it_admin: Full access to all API key operations
 * - All endpoints require authentication
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-API-01] Unique keys per user (database constraint)
 * - [BR-API-02] Expiry validation in service layer
 * - [BR-API-03] Rate limit configuration in service
 * - [BR-API-04] Revoke/rotate with audit trail
 * - [BR-API-05] Audit logging for all operations
 * 
 * ======================================================================
 */