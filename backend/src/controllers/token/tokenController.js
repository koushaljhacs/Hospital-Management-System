// backend/src/controllers/token/tokenController.js
/**
 * ======================================================================
 * FILE: backend/src/controllers/token/tokenController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Token Management controller - Handles HTTP requests for token operations.
 * Total Endpoints: 10
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
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

const tokenService = require('../../services/token/tokenService');
const logger = require('../../utils/logger');

const tokenController = {
    // ============================================
    // ADMIN TOKEN MANAGEMENT
    // ============================================

    /**
     * List all active tokens
     * GET /api/v1/admin/tokens
     */
    async listTokens(req, res, next) {
        try {
            const { page, limit, sort_by, sort_order, token_type, status, user_id } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                sort_by: sort_by || 'created_at',
                sort_order: sort_order || 'desc',
                token_type,
                status,
                user_id
            };

            const result = await tokenService.listTokens(options);

            logger.info('Tokens listed', {
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
            logger.error('Error listing tokens', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get tokens by user ID
     * GET /api/v1/admin/tokens/user/:userId
     */
    async getTokensByUser(req, res, next) {
        try {
            const { userId } = req.params;
            const { page, limit, status } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                status
            };

            const result = await tokenService.getTokensByUser(userId, options);

            logger.info('Tokens by user retrieved', {
                userId: req.user.id,
                targetUserId: userId,
                count: result.data?.length || 0
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Error getting tokens by user', {
                error: error.message,
                userId: req.user.id,
                targetUserId: req.params.userId
            });
            next(error);
        }
    },

    /**
     * Revoke token
     * DELETE /api/v1/admin/tokens/:id
     */
    async revokeToken(req, res, next) {
        try {
            const { id } = req.params;
            const { reason, notes } = req.body;

            const result = await tokenService.revokeToken(id, req.user.id, {
                reason: reason || 'admin_revoke',
                notes
            });

            logger.info('Token revoked', {
                userId: req.user.id,
                tokenId: id,
                tokenNumber: result.token_number
            });

            res.json({
                success: true,
                data: result,
                message: 'Token revoked successfully'
            });
        } catch (error) {
            if (error.message === 'Token not found or already revoked') {
                return res.status(404).json({
                    success: false,
                    error: 'Token not found or already revoked'
                });
            }
            logger.error('Error revoking token', {
                error: error.message,
                userId: req.user.id,
                tokenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Blacklist token
     * POST /api/v1/admin/tokens/blacklist/:id
     */
    async blacklistToken(req, res, next) {
        try {
            const { id } = req.params;
            const { reason, expires_at } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Blacklist reason is required'
                });
            }

            const result = await tokenService.blacklistToken(id, req.user.id, {
                reason,
                expires_at,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            });

            logger.info('Token blacklisted', {
                userId: req.user.id,
                tokenId: id,
                tokenNumber: result.token_number,
                reason
            });

            res.json({
                success: true,
                data: result,
                message: 'Token blacklisted successfully'
            });
        } catch (error) {
            if (error.message === 'Token not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Token not found'
                });
            }
            logger.error('Error blacklisting token', {
                error: error.message,
                userId: req.user.id,
                tokenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * List blacklisted tokens
     * GET /api/v1/admin/tokens/blacklist
     */
    async listBlacklistedTokens(req, res, next) {
        try {
            const { page, limit, sort_by, sort_order } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                sort_by: sort_by || 'created_at',
                sort_order: sort_order || 'desc'
            };

            const result = await tokenService.listBlacklistedTokens(options);

            logger.info('Blacklisted tokens listed', {
                userId: req.user.id,
                count: result.data?.length || 0
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Error listing blacklisted tokens', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Remove token from blacklist
     * DELETE /api/v1/admin/tokens/blacklist/:id
     */
    async removeFromBlacklist(req, res, next) {
        try {
            const { id } = req.params;

            const result = await tokenService.removeFromBlacklist(id, req.user.id);

            logger.info('Token removed from blacklist', {
                userId: req.user.id,
                blacklistId: id,
                tokenId: result.token_id
            });

            res.json({
                success: true,
                data: result,
                message: 'Token removed from blacklist successfully'
            });
        } catch (error) {
            if (error.message === 'Blacklist entry not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Blacklist entry not found'
                });
            }
            logger.error('Error removing token from blacklist', {
                error: error.message,
                userId: req.user.id,
                blacklistId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get token statistics
     * GET /api/v1/admin/tokens/stats
     */
    async getTokenStats(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const options = { from_date, to_date };
            const stats = await tokenService.getTokenStats(options);

            logger.info('Token statistics retrieved', {
                userId: req.user.id,
                totalTokens: stats.summary?.total_tokens || 0
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting token statistics', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // AUTH TOKEN OPERATIONS
    // ============================================

    /**
     * Refresh token
     * POST /api/v1/auth/tokens/refresh
     * 
     * BUSINESS RULE: [BR-TKN-04] Token rotation for security
     */
    async refreshToken(req, res, next) {
        try {
            const { refresh_token } = req.body;
            const deviceInfo = {
                ip_address: req.ip,
                user_agent: req.headers['user-agent'],
                device_fingerprint: req.headers['x-device-fingerprint']
            };

            if (!refresh_token) {
                return res.status(400).json({
                    success: false,
                    error: 'Refresh token is required'
                });
            }

            const result = await tokenService.refreshToken(refresh_token, deviceInfo);

            logger.info('Token refreshed', {
                userId: req.user?.id,
                ip: req.ip
            });

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            if (error.message === 'Invalid or expired refresh token') {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired refresh token'
                });
            }
            logger.error('Error refreshing token', {
                error: error.message,
                userId: req.user?.id
            });
            next(error);
        }
    },

    /**
     * Revoke all tokens for current user
     * DELETE /api/v1/auth/tokens/all
     */
    async revokeAllUserTokens(req, res, next) {
        try {
            const { reason } = req.body;

            const result = await tokenService.revokeAllUserTokens(
                req.user.id,
                reason || 'user_logout'
            );

            logger.info('All user tokens revoked', {
                userId: req.user.id,
                revokedCount: result.revoked_count
            });

            res.json({
                success: true,
                data: result,
                message: `Revoked ${result.revoked_count} tokens successfully`
            });
        } catch (error) {
            logger.error('Error revoking all user tokens', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Validate token
     * GET /api/v1/auth/tokens/validate
     */
    async validateToken(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            const token = authHeader?.split(' ')[1] || req.query.token;

            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: 'Token is required'
                });
            }

            const result = await tokenService.validateToken(token);

            if (!result.valid) {
                return res.status(401).json({
                    success: false,
                    error: result.reason,
                    code: 'INVALID_TOKEN'
                });
            }

            logger.info('Token validated', {
                userId: result.token?.user_id,
                tokenId: result.token?.id,
                tokenType: result.token?.type
            });

            res.json({
                success: true,
                data: result.token,
                message: 'Token is valid'
            });
        } catch (error) {
            logger.error('Error validating token', {
                error: error.message,
                userId: req.user?.id
            });
            next(error);
        }
    }
};

module.exports = tokenController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Admin Management       | 7         | List, get by user, revoke, blacklist, stats
 * Auth Operations        | 3         | Refresh, revoke all, validate
 * -----------------------|-----------|----------------------
 * TOTAL                  | 10        | Complete Token Management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-TKN-01] Expiry validation
 * - [BR-TKN-02] Revoke/blacklist support
 * - [BR-TKN-03] One-time token validation
 * - [BR-TKN-04] Token rotation
 * - [BR-TKN-05] Full audit logging
 * 
 * ======================================================================
 */