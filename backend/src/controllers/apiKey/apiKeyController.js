// backend/src/controllers/apiKey/apiKeyController.js
/**
 * ======================================================================
 * FILE: backend/src/controllers/apiKey/apiKeyController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * API Key Management controller - Handles HTTP requests for API key operations.
 * Total Endpoints: 12
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
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

const apiKeyService = require('../../services/apiKey/apiKeyService');
const logger = require('../../utils/logger');

const apiKeyController = {
    // ============================================
    // LIST & RETRIEVAL (6 endpoints)
    // ============================================

    /**
     * List all API keys
     * GET /api/v1/admin/api-keys
     */
    async listApiKeys(req, res, next) {
        try {
            const { page, limit, sort_by, sort_order, status, key_type, user_id } = req.query;
            
            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                sort_by: sort_by || 'created_at',
                sort_order: sort_order || 'desc',
                status,
                key_type,
                user_id: user_id || req.user.id
            };

            const result = await apiKeyService.listApiKeys(req.user.id, options);

            logger.info('API keys listed', {
                userId: req.user.id,
                count: result.data?.length || 0,
                total: result.pagination?.total || 0
            });

            res.json({
                success: true,
                data: result.data,
                summary: result.summary,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Error listing API keys', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get API key by ID
     * GET /api/v1/admin/api-keys/:id
     */
    async getApiKeyById(req, res, next) {
        try {
            const { id } = req.params;

            const apiKey = await apiKeyService.getApiKeyById(id, req.user.id);

            if (!apiKey) {
                return res.status(404).json({
                    success: false,
                    error: 'API key not found'
                });
            }

            logger.info('API key retrieved', {
                userId: req.user.id,
                apiKeyId: id,
                keyName: apiKey.key_name
            });

            res.json({
                success: true,
                data: apiKey
            });
        } catch (error) {
            logger.error('Error getting API key', {
                error: error.message,
                userId: req.user.id,
                apiKeyId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get API key logs
     * GET /api/v1/admin/api-keys/logs
     */
    async getApiKeyLogs(req, res, next) {
        try {
            const { page, limit, api_key_id, user_id, from_date, to_date } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 50,
                api_key_id,
                user_id: user_id || req.user.id,
                from_date,
                to_date
            };

            const result = await apiKeyService.getApiKeyLogs(options);

            logger.info('API key logs retrieved', {
                userId: req.user.id,
                count: result.data?.length || 0,
                total: result.pagination?.total || 0
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Error getting API key logs', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get API key statistics
     * GET /api/v1/admin/api-keys/stats
     */
    async getApiKeyStats(req, res, next) {
        try {
            const { user_id } = req.query;
            const targetUserId = user_id || req.user.id;

            const stats = await apiKeyService.getApiKeyStats(targetUserId);

            logger.info('API key stats retrieved', {
                userId: req.user.id,
                targetUserId
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting API key stats', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get available permissions
     * GET /api/v1/admin/api-keys/permissions
     */
    async getAvailablePermissions(req, res, next) {
        try {
            const permissions = await apiKeyService.getAvailablePermissions();

            logger.info('Available permissions retrieved', {
                userId: req.user.id,
                total: permissions.total
            });

            res.json({
                success: true,
                data: permissions
            });
        } catch (error) {
            logger.error('Error getting available permissions', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get usage details for specific API key
     * GET /api/v1/admin/api-keys/usage/:id
     */
    async getApiKeyUsage(req, res, next) {
        try {
            const { id } = req.params;
            const { from_date, to_date, limit } = req.query;

            const options = {
                from_date,
                to_date,
                limit: limit ? parseInt(limit) : 100
            };

            const usage = await apiKeyService.getApiKeyUsage(id, options);

            if (!usage.summary) {
                return res.status(404).json({
                    success: false,
                    error: 'API key not found'
                });
            }

            logger.info('API key usage retrieved', {
                userId: req.user.id,
                apiKeyId: id,
                totalRequests: usage.summary?.total_requests || 0
            });

            res.json({
                success: true,
                data: usage
            });
        } catch (error) {
            logger.error('Error getting API key usage', {
                error: error.message,
                userId: req.user.id,
                apiKeyId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // CREATE & UPDATE (3 endpoints)
    // ============================================

    /**
     * Create new API key
     * POST /api/v1/admin/api-keys
     * 
     * BUSINESS RULE: [BR-API-02] Keys expire after configured duration
     * BUSINESS RULE: [BR-API-03] Rate limits configured per key
     */
    async createApiKey(req, res, next) {
        try {
            const {
                key_name,
                key_description,
                key_type,
                permission_scope,
                permissions,
                role_id,
                rate_limit,
                rate_limit_window,
                burst_multiplier,
                expires_at,
                allowed_ips,
                allowed_domains,
                allowed_origins,
                allowed_days,
                allowed_hours_start,
                allowed_hours_end,
                requires_mfa,
                metadata,
                notes
            } = req.body;

            // Validate required fields
            if (!key_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Key name is required'
                });
            }

            const keyData = {
                key_name,
                key_description,
                key_type,
                permission_scope,
                permissions,
                role_id,
                rate_limit,
                rate_limit_window,
                burst_multiplier,
                expires_at,
                allowed_ips,
                allowed_domains,
                allowed_origins,
                allowed_days,
                allowed_hours_start,
                allowed_hours_end,
                requires_mfa,
                metadata,
                notes
            };

            const result = await apiKeyService.createApiKey(req.user.id, keyData);

            logger.info('API key created', {
                userId: req.user.id,
                apiKeyId: result.id,
                keyName: result.key_name,
                keyType: result.key_type
            });

            res.status(201).json({
                success: true,
                data: result,
                message: 'API key created successfully. Store the key securely - it will not be shown again.'
            });
        } catch (error) {
            logger.error('Error creating API key', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update API key
     * PUT /api/v1/admin/api-keys/:id
     */
    async updateApiKey(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = { ...req.body };

            // Remove fields that cannot be updated directly
            delete updateData.key_hash;
            delete updateData.key_prefix;
            delete updateData.key_last_four;
            delete updateData.status;
            delete updateData.usage_count;
            delete updateData.last_used;

            const result = await apiKeyService.updateApiKey(id, req.user.id, updateData);

            logger.info('API key updated', {
                userId: req.user.id,
                apiKeyId: id,
                keyName: result?.key_name
            });

            res.json({
                success: true,
                data: result,
                message: 'API key updated successfully'
            });
        } catch (error) {
            if (error.message === 'API key not found') {
                return res.status(404).json({
                    success: false,
                    error: 'API key not found'
                });
            }
            logger.error('Error updating API key', {
                error: error.message,
                userId: req.user.id,
                apiKeyId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete API key (soft delete)
     * DELETE /api/v1/admin/api-keys/:id
     */
    async deleteApiKey(req, res, next) {
        try {
            const { id } = req.params;

            const result = await apiKeyService.deleteApiKey(id, req.user.id);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'API key not found'
                });
            }

            logger.info('API key deleted', {
                userId: req.user.id,
                apiKeyId: id,
                keyName: result.key_name
            });

            res.json({
                success: true,
                data: result,
                message: 'API key deleted successfully'
            });
        } catch (error) {
            if (error.message === 'API key not found') {
                return res.status(404).json({
                    success: false,
                    error: 'API key not found'
                });
            }
            logger.error('Error deleting API key', {
                error: error.message,
                userId: req.user.id,
                apiKeyId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // OPERATIONS (3 endpoints)
    // ============================================

    /**
     * Revoke API key
     * POST /api/v1/admin/api-keys/:id/revoke
     * 
     * BUSINESS RULE: [BR-API-04] Keys can be revoked
     */
    async revokeApiKey(req, res, next) {
        try {
            const { id } = req.params;
            const { reason, notes } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Revocation reason is required'
                });
            }

            const result = await apiKeyService.revokeApiKey(id, req.user.id, { reason, notes });

            logger.info('API key revoked', {
                userId: req.user.id,
                apiKeyId: id,
                reason
            });

            res.json({
                success: true,
                data: result,
                message: 'API key revoked successfully'
            });
        } catch (error) {
            if (error.message === 'API key not found or already revoked') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error revoking API key', {
                error: error.message,
                userId: req.user.id,
                apiKeyId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Rotate API key
     * POST /api/v1/admin/api-keys/:id/rotate
     * 
     * BUSINESS RULE: [BR-API-04] Keys can be rotated
     */
    async rotateApiKey(req, res, next) {
        try {
            const { id } = req.params;
            const { reason, grace_period_days } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Rotation reason is required'
                });
            }

            const result = await apiKeyService.rotateApiKey(id, req.user.id, {
                reason,
                grace_period_days: grace_period_days || 7
            });

            logger.info('API key rotated', {
                userId: req.user.id,
                oldKeyId: id,
                newKeyId: result.new_key.id,
                reason
            });

            res.json({
                success: true,
                data: result,
                message: `API key rotated successfully. Old key will remain active for ${grace_period_days || 7} days.`
            });
        } catch (error) {
            if (error.message === 'API key not found') {
                return res.status(404).json({
                    success: false,
                    error: 'API key not found'
                });
            }
            if (error.message === 'Only active keys can be rotated') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error rotating API key', {
                error: error.message,
                userId: req.user.id,
                apiKeyId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Validate API key
     * POST /api/v1/admin/api-keys/validate
     * 
     * BUSINESS RULE: [BR-API-05] All API key usage is audited
     */
    async validateApiKey(req, res, next) {
        try {
            const { api_key } = req.body;

            if (!api_key) {
                return res.status(400).json({
                    success: false,
                    error: 'API key is required'
                });
            }

            const result = await apiKeyService.validateApiKey(api_key);

            logger.info('API key validated', {
                userId: req.user.id,
                valid: result.valid,
                keyId: result.key?.id,
                reason: result.reason
            });

            if (!result.valid) {
                return res.status(401).json({
                    success: false,
                    error: result.reason,
                    code: 'INVALID_API_KEY'
                });
            }

            res.json({
                success: true,
                data: result.key,
                message: 'API key is valid'
            });
        } catch (error) {
            logger.error('Error validating API key', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = apiKeyController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * List & Retrieval       | 6         | List keys, get by ID, logs, stats, permissions, usage
 * Create & Update        | 3         | Create, update, delete
 * Operations             | 3         | Revoke, rotate, validate
 * -----------------------|-----------|----------------------
 * TOTAL                  | 12        | Complete API Key Management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-API-01] Unique key names (service layer)
 * - [BR-API-02] Expiry validation before use
 * - [BR-API-03] Rate limit checks
 * - [BR-API-04] Revoke/rotate with reason
 * - [BR-API-05] Full audit logging
 * 
 * ======================================================================
 */