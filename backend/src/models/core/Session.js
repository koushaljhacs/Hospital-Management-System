/**
 * ======================================================================
 * FILE: backend/src/models/core/Session.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Session model for database operations.
 * Handles all session-related database queries for user session management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: sessions
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users)
 * - session_token: string (unique)
 * - refresh_token: string (unique)
 * - ip_address: inet
 * - user_agent: text
 * - device_info: jsonb
 * - login_time: timestamp
 * - last_activity: timestamp
 * - expires_at: timestamp
 * - is_active: boolean
 * - logout_time: timestamp
 * - logout_reason: enum (user_logout, timeout, admin_terminated, password_changed)
 * - created_at: timestamp
 * - updated_at: timestamp
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation with core CRUD operations
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');

const Session = {
    /**
     * Table name
     */
    tableName: 'sessions',

    /**
     * Generate session token
     * @returns {Promise<string>} Generated session token
     */
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    },

    /**
     * Generate refresh token
     * @returns {Promise<string>} Generated refresh token
     */
    generateRefreshToken() {
        return crypto.randomBytes(40).toString('hex');
    },

    /**
     * Find session by ID
     * @param {string} id - Session UUID
     * @returns {Promise<Object|null>} Session object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    s.id, s.user_id, s.session_token, s.refresh_token,
                    s.ip_address, s.user_agent, s.device_info,
                    s.login_time, s.last_activity, s.expires_at,
                    s.is_active, s.logout_time, s.logout_reason,
                    s.created_at, s.updated_at,
                    u.username, u.email, u.role, u.status as user_status
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.id = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Session found by ID', { sessionId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding session by ID', {
                error: error.message,
                sessionId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find session by session token
     * @param {string} sessionToken - Session token
     * @returns {Promise<Object|null>} Session object or null
     */
    async findByToken(sessionToken) {
        try {
            const query = `
                SELECT 
                    s.id, s.user_id, s.session_token, s.refresh_token,
                    s.ip_address, s.user_agent, s.device_info,
                    s.login_time, s.last_activity, s.expires_at,
                    s.is_active, s.logout_time, s.logout_reason,
                    s.created_at, s.updated_at,
                    u.username, u.email, u.role, u.status as user_status
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_token = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [sessionToken]);

            if (result.rows.length === 0) {
                return null;
            }

            const session = result.rows[0];

            if (session.is_active && session.expires_at && new Date(session.expires_at) < new Date()) {
                await this.expire(session.id);
                return null;
            }

            logger.debug('Session found by token', { sessionToken: sessionToken.substring(0, 10) + '...' });
            return session;
        } catch (error) {
            logger.error('Error finding session by token', {
                error: error.message,
                sessionToken: sessionToken ? sessionToken.substring(0, 10) + '...' : null
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find session by refresh token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<Object|null>} Session object or null
     */
    async findByRefreshToken(refreshToken) {
        try {
            const query = `
                SELECT 
                    s.id, s.user_id, s.session_token, s.refresh_token,
                    s.ip_address, s.user_agent, s.device_info,
                    s.login_time, s.last_activity, s.expires_at,
                    s.is_active, s.logout_time, s.logout_reason,
                    s.created_at, s.updated_at,
                    u.username, u.email, u.role
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.refresh_token = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [refreshToken]);

            if (result.rows.length === 0) {
                return null;
            }

            const session = result.rows[0];

            if (session.is_active && session.expires_at && new Date(session.expires_at) < new Date()) {
                await this.expire(session.id);
                return null;
            }

            logger.debug('Session found by refresh token');
            return session;
        } catch (error) {
            logger.error('Error finding session by refresh token', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find active sessions by user ID
     * @param {string} userId - User UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of sessions
     */
    async findActiveByUserId(userId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    s.id, s.user_id, s.session_token, s.refresh_token,
                    s.ip_address, s.user_agent, s.device_info,
                    s.login_time, s.last_activity, s.expires_at,
                    s.is_active, s.created_at
                FROM sessions s
                WHERE s.user_id = $1 
                    AND s.is_active = true
                    AND s.is_deleted = false
                    AND (s.expires_at IS NULL OR s.expires_at > NOW())
                ORDER BY s.last_activity DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, limit, offset]);

            logger.debug('Active sessions found by user ID', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding active sessions by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new session
     * @param {Object} sessionData - Session data
     * @param {string} sessionData.user_id - User ID
     * @param {string} [sessionData.ip_address] - IP address
     * @param {string} [sessionData.user_agent] - User agent
     * @param {Object} [sessionData.device_info] - Device information
     * @param {number} [sessionData.expires_in_seconds] - Expiry in seconds (default: 7 days)
     * @returns {Promise<Object>} Created session
     */
    async create(sessionData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const sessionToken = await this.generateSessionToken();
            const refreshToken = await this.generateRefreshToken();
            const expiresInSeconds = sessionData.expires_in_seconds || 7 * 24 * 60 * 60;
            const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

            const query = `
                INSERT INTO sessions (
                    id, user_id, session_token, refresh_token,
                    ip_address, user_agent, device_info,
                    login_time, last_activity, expires_at,
                    is_active, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW(), $7, true, NOW(), NOW()
                )
                RETURNING 
                    id, user_id, session_token, refresh_token,
                    ip_address, user_agent, device_info,
                    login_time, expires_at, is_active
            `;

            const values = [
                sessionData.user_id,
                sessionToken,
                refreshToken,
                sessionData.ip_address || null,
                sessionData.user_agent || null,
                sessionData.device_info || null,
                expiresAt
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Session created successfully', {
                sessionId: result.rows[0].id,
                userId: sessionData.user_id,
                expiresAt
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating session', {
                error: error.message,
                userId: sessionData.user_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update session last activity
     * @param {string} id - Session ID
     * @returns {Promise<Object>} Updated session
     */
    async updateActivity(id) {
        try {
            const query = `
                UPDATE sessions 
                SET last_activity = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND is_active = true AND is_deleted = false
                RETURNING id, last_activity
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Session activity updated', { sessionId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating session activity', {
                error: error.message,
                sessionId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Refresh session (rotate tokens)
     * @param {string} id - Session ID
     * @param {number} [expires_in_seconds] - New expiry in seconds
     * @returns {Promise<Object>} Refreshed session with new tokens
     */
    async refresh(id, expiresInSeconds = null) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const session = await this.findById(id);
            if (!session) {
                throw new Error('Session not found');
            }

            if (!session.is_active) {
                throw new Error('Session is inactive');
            }

            const newSessionToken = await this.generateSessionToken();
            const newRefreshToken = await this.generateRefreshToken();
            const expiresAt = expiresInSeconds 
                ? new Date(Date.now() + expiresInSeconds * 1000)
                : session.expires_at;

            const query = `
                UPDATE sessions 
                SET session_token = $1,
                    refresh_token = $2,
                    expires_at = $3,
                    last_activity = NOW(),
                    updated_at = NOW()
                WHERE id = $4 AND is_active = true AND is_deleted = false
                RETURNING 
                    id, user_id, session_token, refresh_token,
                    login_time, expires_at, is_active
            `;

            const result = await client.query(query, [newSessionToken, newRefreshToken, expiresAt, id]);

            if (result.rows.length === 0) {
                throw new Error('Session not found or inactive');
            }

            await db.commitTransaction(client);

            logger.info('Session refreshed successfully', { sessionId: id });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error refreshing session', {
                error: error.message,
                sessionId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Logout (end session)
     * @param {string} id - Session ID
     * @param {string} logoutReason - Reason for logout
     * @returns {Promise<boolean>} True if logged out
     */
    async logout(id, logoutReason = 'user_logout') {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE sessions 
                SET is_active = false,
                    logout_time = NOW(),
                    logout_reason = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_active = true AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [logoutReason, id]);

            if (result.rows.length === 0) {
                return false;
            }

            await db.commitTransaction(client);

            logger.info('Session logged out', {
                sessionId: id,
                logoutReason
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error logging out session', {
                error: error.message,
                sessionId: id
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Terminate all sessions for user (except current)
     * @param {string} userId - User ID
     * @param {string} currentSessionId - Current session ID to keep
     * @param {string} logoutReason - Reason for termination
     * @returns {Promise<number>} Number of sessions terminated
     */
    async terminateAllExcept(userId, currentSessionId, logoutReason = 'admin_terminated') {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE sessions 
                SET is_active = false,
                    logout_time = NOW(),
                    logout_reason = $1,
                    updated_at = NOW()
                WHERE user_id = $2 
                    AND id != $3
                    AND is_active = true
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [logoutReason, userId, currentSessionId]);

            await db.commitTransaction(client);

            logger.info('All other sessions terminated', {
                userId,
                terminatedCount: result.rowCount,
                keptSessionId: currentSessionId
            });

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error terminating all sessions', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Terminate all sessions for user
     * @param {string} userId - User ID
     * @param {string} logoutReason - Reason for termination
     * @returns {Promise<number>} Number of sessions terminated
     */
    async terminateAll(userId, logoutReason = 'admin_terminated') {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE sessions 
                SET is_active = false,
                    logout_time = NOW(),
                    logout_reason = $1,
                    updated_at = NOW()
                WHERE user_id = $2 
                    AND is_active = true
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [logoutReason, userId]);

            await db.commitTransaction(client);

            logger.info('All sessions terminated', {
                userId,
                terminatedCount: result.rowCount
            });

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error terminating all sessions', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Expire inactive sessions (run via cron)
     * @param {number} inactivityMinutes - Minutes of inactivity to consider expired
     * @returns {Promise<number>} Number of sessions expired
     */
    async expireInactiveSessions(inactivityMinutes = 30) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE sessions 
                SET is_active = false,
                    logout_time = NOW(),
                    logout_reason = 'timeout',
                    updated_at = NOW()
                WHERE is_active = true
                    AND is_deleted = false
                    AND last_activity < NOW() - ($1 || ' minutes')::INTERVAL
                RETURNING id
            `;

            const result = await client.query(query, [inactivityMinutes]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Inactive sessions expired', {
                    count: result.rowCount,
                    inactivityMinutes
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error expiring inactive sessions', {
                error: error.message,
                inactivityMinutes
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Expire sessions by expiry date (run via cron)
     * @returns {Promise<number>} Number of sessions expired
     */
    async expireByDate() {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE sessions 
                SET is_active = false,
                    logout_time = NOW(),
                    logout_reason = 'timeout',
                    updated_at = NOW()
                WHERE is_active = true
                    AND is_deleted = false
                    AND expires_at IS NOT NULL
                    AND expires_at <= NOW()
                RETURNING id
            `;

            const result = await client.query(query);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Expired sessions terminated', {
                    count: result.rowCount
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error expiring sessions by date', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Get session statistics
     * @returns {Promise<Object>} Session statistics
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_sessions,
                    COUNT(*) FILTER (WHERE is_active = true) as active_sessions,
                    COUNT(*) FILTER (WHERE is_active = false) as inactive_sessions,
                    COUNT(*) FILTER (WHERE logout_reason = 'user_logout') as user_logout,
                    COUNT(*) FILTER (WHERE logout_reason = 'timeout') as timeout,
                    COUNT(*) FILTER (WHERE logout_reason = 'admin_terminated') as admin_terminated,
                    COUNT(*) FILTER (WHERE logout_reason = 'password_changed') as password_changed,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(EXTRACT(EPOCH FROM (COALESCE(logout_time, NOW()) - login_time))/3600)::numeric(10,2) as avg_session_hours
                FROM sessions
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Session statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting session statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active sessions by device type
     * @returns {Promise<Array>} Active sessions grouped by device type
     */
    async getActiveByDeviceType() {
        try {
            const query = `
                SELECT 
                    device_info->>'type' as device_type,
                    COUNT(*) as session_count,
                    COUNT(DISTINCT user_id) as unique_users
                FROM sessions
                WHERE is_active = true
                    AND is_deleted = false
                    AND device_info IS NOT NULL
                GROUP BY device_info->>'type'
                ORDER BY session_count DESC
            `;

            const result = await db.query(query);

            logger.debug('Active sessions by device type retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active sessions by device type', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Clean up old sessions (run via cron)
     * @param {number} daysToKeep - Days to keep session records
     * @returns {Promise<number>} Number of sessions deleted
     */
    async cleanup(daysToKeep = 90) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE sessions 
                SET is_deleted = true,
                    deleted_at = NOW()
                WHERE is_deleted = false
                    AND logout_time IS NOT NULL
                    AND logout_time < NOW() - ($1 || ' days')::INTERVAL
                RETURNING id
            `;

            const result = await client.query(query, [daysToKeep]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Old sessions cleaned up', {
                    count: result.rowCount,
                    daysToKeep
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cleaning up sessions', {
                error: error.message,
                daysToKeep
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    }
};

module.exports = Session;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create new session on login
 * const session = await Session.create({
 *     user_id: userId,
 *     ip_address: '192.168.1.100',
 *     user_agent: 'Mozilla/5.0...',
 *     device_info: { type: 'mobile', os: 'iOS', browser: 'Safari' },
 *     expires_in_seconds: 7 * 24 * 60 * 60
 * });
 * 
 * // Validate session token
 * const session = await Session.findByToken(sessionToken);
 * 
 * // Update session activity (for keep-alive)
 * await Session.updateActivity(sessionId);
 * 
 * // Refresh session tokens
 * const refreshed = await Session.refresh(sessionId);
 * 
 * // Logout (end session)
 * await Session.logout(sessionId, 'user_logout');
 * 
 * // Terminate all other sessions (password change)
 * const terminatedCount = await Session.terminateAllExcept(userId, currentSessionId, 'password_changed');
 * 
 * // Terminate all user sessions (admin)
 * await Session.terminateAll(userId, 'admin_terminated');
 * 
 * // Get active sessions for user
 * const activeSessions = await Session.findActiveByUserId(userId);
 * 
 * // Expire inactive sessions (run via cron every minute)
 * await Session.expireInactiveSessions(30);
 * 
 * // Expire sessions by expiry date (run via cron)
 * await Session.expireByDate();
 * 
 * // Get session statistics
 * const stats = await Session.getStatistics();
 * 
 * // Get active sessions by device type
 * const deviceStats = await Session.getActiveByDeviceType();
 * 
 * // Clean up old sessions (run via cron monthly)
 * await Session.cleanup(90);
 * 
 * ======================================================================
 */