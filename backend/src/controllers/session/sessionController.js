// backend/src/controllers/session/sessionController.js
/**
 * ======================================================================
 * FILE: backend/src/controllers/session/sessionController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Session Management controller - Handles HTTP requests for session operations.
 * Total Endpoints: 13
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-SES-01] Sessions expire after inactivity (30 min default)
 * - [BR-SES-02] Max concurrent sessions per user (5 default)
 * - [BR-SES-03] Session tokens can be revoked
 * - [BR-SES-04] Device fingerprint for session binding
 * - [BR-SES-05] All session events are logged
 * 
 * ======================================================================
 */

const sessionService = require('../../services/session/sessionService');
const logger = require('../../utils/logger');

const sessionController = {
    // ============================================
    // ADMIN SESSION MANAGEMENT
    // ============================================

    /**
     * List all sessions
     * GET /api/v1/admin/sessions
     */
    async listSessions(req, res, next) {
        try {
            const { page, limit, sort_by, sort_order, status, user_id } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                sort_by: sort_by || 'created_at',
                sort_order: sort_order || 'desc',
                status,
                user_id
            };

            const result = await sessionService.listSessions(options);

            logger.info('Sessions listed', {
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
            logger.error('Error listing sessions', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get active sessions
     * GET /api/v1/admin/sessions/active
     */
    async getActiveSessions(req, res, next) {
        try {
            const { page, limit } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                status: 'active'
            };

            const result = await sessionService.listSessions(options);

            logger.info('Active sessions retrieved', {
                userId: req.user.id,
                count: result.data?.length || 0
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Error getting active sessions', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Terminate session by ID
     * DELETE /api/v1/admin/sessions/:id
     */
    async terminateSession(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const result = await sessionService.terminateSession(
                id,
                null,
                reason || 'admin_terminated'
            );

            logger.info('Session terminated by admin', {
                userId: req.user.id,
                sessionId: id,
                targetUserId: result.user_id,
                reason: reason || 'admin_terminated'
            });

            res.json({
                success: true,
                data: result,
                message: 'Session terminated successfully'
            });
        } catch (error) {
            if (error.message === 'Session not found or already terminated') {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or already terminated'
                });
            }
            logger.error('Error terminating session', {
                error: error.message,
                userId: req.user.id,
                sessionId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Terminate all sessions for a user
     * DELETE /api/v1/admin/sessions/user/:userId
     */
    async terminateUserSessions(req, res, next) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;

            const result = await sessionService.terminateUserSessions(
                userId,
                reason || 'admin_action'
            );

            logger.info('User sessions terminated by admin', {
                userId: req.user.id,
                targetUserId: userId,
                terminatedCount: result.terminated_count,
                reason: reason || 'admin_action'
            });

            res.json({
                success: true,
                data: result,
                message: `Terminated ${result.terminated_count} sessions for user`
            });
        } catch (error) {
            logger.error('Error terminating user sessions', {
                error: error.message,
                userId: req.user.id,
                targetUserId: req.params.userId
            });
            next(error);
        }
    },

    /**
     * Get session statistics
     * GET /api/v1/admin/sessions/statistics
     */
    async getSessionStats(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const options = { from_date, to_date };
            const stats = await sessionService.getSessionStats(options);

            logger.info('Session statistics retrieved', {
                userId: req.user.id,
                totalSessions: stats.summary?.total_sessions || 0,
                activeSessions: stats.summary?.active_sessions || 0
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting session statistics', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update session timeout configuration
     * PUT /api/v1/admin/sessions/timeout/:minutes
     */
    async updateSessionTimeout(req, res, next) {
        try {
            const { minutes } = req.params;

            const result = await sessionService.setSessionTimeout(parseInt(minutes));

            logger.info('Session timeout updated', {
                userId: req.user.id,
                timeoutMinutes: minutes
            });

            res.json({
                success: true,
                data: result,
                message: `Session timeout set to ${minutes} minutes`
            });
        } catch (error) {
            logger.error('Error updating session timeout', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // USER SESSION OPERATIONS
    // ============================================

    /**
     * Get current session
     * GET /api/v1/auth/sessions/current
     */
    async getCurrentSession(req, res, next) {
        try {
            const session = await sessionService.getSessionById(req.sessionId, req.user.id);

            if (!session) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found'
                });
            }

            logger.info('Current session retrieved', {
                userId: req.user.id,
                sessionId: req.sessionId
            });

            res.json({
                success: true,
                data: session
            });
        } catch (error) {
            logger.error('Error getting current session', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * List my sessions
     * GET /api/v1/auth/sessions
     */
    async listMySessions(req, res, next) {
        try {
            const { page, limit } = req.query;

            const options = {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 20,
                current_session_id: req.sessionId
            };

            const result = await sessionService.getUserSessions(req.user.id, options);

            logger.info('User sessions listed', {
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
            logger.error('Error listing user sessions', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Terminate a specific session (user's own)
     * DELETE /api/v1/auth/sessions/:id
     */
    async terminateMySession(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (id === req.sessionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot terminate current session. Use logout instead.'
                });
            }

            const result = await sessionService.terminateSession(
                id,
                req.user.id,
                reason || 'user_action'
            );

            logger.info('User terminated own session', {
                userId: req.user.id,
                sessionId: id,
                reason: reason || 'user_action'
            });

            res.json({
                success: true,
                data: result,
                message: 'Session terminated successfully'
            });
        } catch (error) {
            if (error.message === 'Session not found or already terminated') {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or already terminated'
                });
            }
            logger.error('Error terminating user session', {
                error: error.message,
                userId: req.user.id,
                sessionId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Terminate all other sessions (keep current)
     * DELETE /api/v1/auth/sessions/others
     */
    async terminateOtherSessions(req, res, next) {
        try {
            const { reason } = req.body;

            const result = await sessionService.terminateUserSessions(
                req.user.id,
                reason || 'user_action',
                req.sessionId
            );

            logger.info('User terminated other sessions', {
                userId: req.user.id,
                terminatedCount: result.terminated_count,
                reason: reason || 'user_action'
            });

            res.json({
                success: true,
                data: result,
                message: `Terminated ${result.terminated_count} other sessions`
            });
        } catch (error) {
            logger.error('Error terminating other sessions', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Terminate all my sessions (including current)
     * DELETE /api/v1/auth/sessions/all
     */
    async terminateAllMySessions(req, res, next) {
        try {
            const { reason } = req.body;

            const result = await sessionService.terminateUserSessions(
                req.user.id,
                reason || 'user_action'
            );

            logger.info('User terminated all sessions', {
                userId: req.user.id,
                terminatedCount: result.terminated_count,
                reason: reason || 'user_action'
            });

            res.json({
                success: true,
                data: result,
                message: `Terminated ${result.terminated_count} sessions. Please login again.`
            });
        } catch (error) {
            logger.error('Error terminating all sessions', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Extend session
     * POST /api/v1/auth/sessions/extend
     */
    async extendSession(req, res, next) {
        try {
            const { extend_minutes } = req.body;
            const extendMinutes = extend_minutes || 30;

            const result = await sessionService.extendSession(req.sessionId, extendMinutes);

            logger.info('Session extended', {
                userId: req.user.id,
                sessionId: req.sessionId,
                extendMinutes
            });

            res.json({
                success: true,
                data: result,
                message: `Session extended by ${extendMinutes} minutes`
            });
        } catch (error) {
            if (error.message === 'Session not found or inactive') {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or inactive'
                });
            }
            logger.error('Error extending session', {
                error: error.message,
                userId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = sessionController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Admin Management       | 6         | List, active, terminate, stats, timeout
 * User Operations        | 6         | Current, list, terminate, terminate others, extend
 * -----------------------|-----------|----------------------
 * TOTAL                  | 12        | Complete Session Management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-SES-01] Session timeout extension
 * - [BR-SES-02] Max concurrent sessions (service layer)
 * - [BR-SES-03] Session termination
 * - [BR-SES-04] Device fingerprint tracking
 * - [BR-SES-05] Full audit logging
 * 
 * ======================================================================
 */