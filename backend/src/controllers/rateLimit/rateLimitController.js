// backend/src/controllers/rateLimit/rateLimitController.js
/**
 * ======================================================================
 * FILE: backend/src/controllers/rateLimit/rateLimitController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Rate Limit Management controller - Handles HTTP requests for rate limit operations.
 * Total Endpoints: 13
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
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

const rateLimitService = require('../../services/rateLimit/rateLimitService');
const logger = require('../../utils/logger');

const rateLimitController = {
    // ============================================
    // RULE MANAGEMENT
    // ============================================

    /**
     * List all rate limit rules
     * GET /api/v1/admin/rate-limits/rules
     */
    async listRules(req, res, next) {
        try {
            const { page, limit, sort_by, sort_order, rule_type, is_active } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                sort_by: sort_by || 'created_at',
                sort_order: sort_order || 'desc',
                rule_type,
                is_active: is_active !== undefined ? is_active === 'true' : undefined
            };

            const result = await rateLimitService.listRules(options);

            logger.info('Rate limit rules listed', {
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
            logger.error('Error listing rate limit rules', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get rate limit rule by ID
     * GET /api/v1/admin/rate-limits/rules/:id
     */
    async getRuleById(req, res, next) {
        try {
            const { id } = req.params;

            const rule = await rateLimitService.getRuleById(id);

            if (!rule) {
                return res.status(404).json({
                    success: false,
                    error: 'Rate limit rule not found'
                });
            }

            logger.info('Rate limit rule retrieved', {
                userId: req.user.id,
                ruleId: id,
                ruleName: rule.rule_name
            });

            res.json({
                success: true,
                data: rule
            });
        } catch (error) {
            logger.error('Error getting rate limit rule', {
                error: error.message,
                userId: req.user.id,
                ruleId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Create rate limit rule
     * POST /api/v1/admin/rate-limits/rules
     * 
     * BUSINESS RULE: [BR-RL-02] Rules evaluated by priority
     */
    async createRule(req, res, next) {
        try {
            const {
                rule_name,
                rule_description,
                rule_type,
                applies_to_users,
                applies_to_roles,
                applies_to_api_keys,
                applies_to_ips,
                applies_to_ip_ranges,
                endpoint_pattern,
                http_methods,
                exclude_endpoints,
                window_seconds,
                max_requests,
                burst_multiplier,
                action,
                penalty_duration,
                penalty_multiplier,
                priority,
                is_active,
                valid_from,
                valid_to
            } = req.body;

            if (!rule_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Rule name is required'
                });
            }

            if (!rule_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Rule type is required'
                });
            }

            if (!window_seconds) {
                return res.status(400).json({
                    success: false,
                    error: 'Window seconds is required'
                });
            }

            if (!max_requests) {
                return res.status(400).json({
                    success: false,
                    error: 'Max requests is required'
                });
            }

            if (!action) {
                return res.status(400).json({
                    success: false,
                    error: 'Action is required'
                });
            }

            const ruleData = {
                rule_name,
                rule_description,
                rule_type,
                applies_to_users,
                applies_to_roles,
                applies_to_api_keys,
                applies_to_ips,
                applies_to_ip_ranges,
                endpoint_pattern,
                http_methods,
                exclude_endpoints,
                window_seconds,
                max_requests,
                burst_multiplier,
                action,
                penalty_duration,
                penalty_multiplier,
                priority,
                is_active,
                valid_from,
                valid_to
            };

            const result = await rateLimitService.createRule(ruleData);

            logger.info('Rate limit rule created', {
                userId: req.user.id,
                ruleId: result.id,
                ruleName: result.rule_name,
                ruleType: result.rule_type
            });

            res.status(201).json({
                success: true,
                data: result,
                message: 'Rate limit rule created successfully'
            });
        } catch (error) {
            logger.error('Error creating rate limit rule', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update rate limit rule
     * PUT /api/v1/admin/rate-limits/rules/:id
     */
    async updateRule(req, res, next) {
        try {
            const { id } = req.params;
            const updateData = { ...req.body };

            const result = await rateLimitService.updateRule(id, updateData);

            logger.info('Rate limit rule updated', {
                userId: req.user.id,
                ruleId: id,
                ruleName: result?.rule_name
            });

            res.json({
                success: true,
                data: result,
                message: 'Rate limit rule updated successfully'
            });
        } catch (error) {
            if (error.message === 'Rate limit rule not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Rate limit rule not found'
                });
            }
            logger.error('Error updating rate limit rule', {
                error: error.message,
                userId: req.user.id,
                ruleId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete rate limit rule
     * DELETE /api/v1/admin/rate-limits/rules/:id
     */
    async deleteRule(req, res, next) {
        try {
            const { id } = req.params;

            const result = await rateLimitService.deleteRule(id);

            logger.info('Rate limit rule deleted', {
                userId: req.user.id,
                ruleId: id,
                ruleName: result?.rule_name
            });

            res.json({
                success: true,
                data: result,
                message: 'Rate limit rule deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Rate limit rule not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Rate limit rule not found'
                });
            }
            logger.error('Error deleting rate limit rule', {
                error: error.message,
                userId: req.user.id,
                ruleId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EXEMPTION MANAGEMENT
    // ============================================

    /**
     * List all rate limit exemptions
     * GET /api/v1/admin/rate-limits/exemptions
     */
    async listExemptions(req, res, next) {
        try {
            const { page, limit, sort_by, sort_order } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                sort_by: sort_by || 'created_at',
                sort_order: sort_order || 'desc'
            };

            const result = await rateLimitService.listExemptions(options);

            logger.info('Rate limit exemptions listed', {
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
            logger.error('Error listing rate limit exemptions', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get exemption by ID
     * GET /api/v1/admin/rate-limits/exemptions/:id
     */
    async getExemptionById(req, res, next) {
        try {
            const { id } = req.params;

            const exemption = await rateLimitService.getExemptionById(id);

            if (!exemption) {
                return res.status(404).json({
                    success: false,
                    error: 'Rate limit exemption not found'
                });
            }

            logger.info('Rate limit exemption retrieved', {
                userId: req.user.id,
                exemptionId: id,
                exemptionName: exemption.exemption_name
            });

            res.json({
                success: true,
                data: exemption
            });
        } catch (error) {
            logger.error('Error getting rate limit exemption', {
                error: error.message,
                userId: req.user.id,
                exemptionId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Create rate limit exemption
     * POST /api/v1/admin/rate-limits/exemptions
     * 
     * BUSINESS RULE: [BR-RL-04] Exemptions for whitelisted users/roles
     */
    async createExemption(req, res, next) {
        try {
            const {
                exemption_name,
                exemption_description,
                user_id,
                role_id,
                api_key_id,
                ip_address,
                ip_range,
                applies_to_endpoints,
                applies_to_methods,
                reason,
                expires_at
            } = req.body;

            if (!exemption_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Exemption name is required'
                });
            }

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Reason is required'
                });
            }

            // Validate at least one target is specified
            if (!user_id && !role_id && !api_key_id && !ip_address && !ip_range) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one target (user, role, API key, IP) must be specified'
                });
            }

            const exemptionData = {
                exemption_name,
                exemption_description,
                user_id,
                role_id,
                api_key_id,
                ip_address,
                ip_range,
                applies_to_endpoints,
                applies_to_methods,
                reason,
                expires_at
            };

            const result = await rateLimitService.createExemption(exemptionData);

            logger.info('Rate limit exemption created', {
                userId: req.user.id,
                exemptionId: result.id,
                exemptionName: result.exemption_name,
                reason
            });

            res.status(201).json({
                success: true,
                data: result,
                message: 'Rate limit exemption created successfully'
            });
        } catch (error) {
            logger.error('Error creating rate limit exemption', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Delete rate limit exemption
     * DELETE /api/v1/admin/rate-limits/exemptions/:id
     */
    async deleteExemption(req, res, next) {
        try {
            const { id } = req.params;

            const result = await rateLimitService.deleteExemption(id);

            logger.info('Rate limit exemption deleted', {
                userId: req.user.id,
                exemptionId: id,
                exemptionName: result?.exemption_name
            });

            res.json({
                success: true,
                data: result,
                message: 'Rate limit exemption deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Exemption not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Rate limit exemption not found'
                });
            }
            logger.error('Error deleting rate limit exemption', {
                error: error.message,
                userId: req.user.id,
                exemptionId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // STATISTICS
    // ============================================

    /**
     * Get rate limit statistics
     * GET /api/v1/admin/rate-limits/stats
     */
    async getRateLimitStats(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const options = { from_date, to_date };
            const stats = await rateLimitService.getRateLimitStats(options);

            logger.info('Rate limit statistics retrieved', {
                userId: req.user.id,
                totalBreaches: stats.summary?.total_breaches || 0
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting rate limit statistics', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get rate limit breaches
     * GET /api/v1/admin/rate-limits/breaches
     */
    async getRateLimitBreaches(req, res, next) {
        try {
            const { page, limit, from_date, to_date } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                from_date,
                to_date
            };

            const result = await rateLimitService.getRateLimitBreaches(options);

            logger.info('Rate limit breaches retrieved', {
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
            logger.error('Error getting rate limit breaches', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = rateLimitController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Rule Management        | 5         | List, get, create, update, delete rules
 * Exemption Management   | 4         | List, get, create, delete exemptions
 * Statistics             | 2         | Stats, breaches
 * -----------------------|-----------|----------------------
 * TOTAL                  | 11        | Complete Rate Limit Management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-RL-01] Rule type validation
 * - [BR-RL-02] Priority-based evaluation
 * - [BR-RL-03] Action handling
 * - [BR-RL-04] Exemption creation
 * - [BR-RL-05] Full audit logging
 * 
 * ======================================================================
 */