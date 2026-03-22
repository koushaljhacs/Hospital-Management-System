// backend/src/services/session/sessionService.js
/**
 * ======================================================================
 * FILE: backend/src/services/session/sessionService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Session Management service - Handles session lifecycle and tracking.
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
 * DATABASE TABLES:
 * - sessions
 * - session_logs
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const sessionService = {
    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Generate session token
     */
    generateSessionToken() {
        const randomBytes = crypto.randomBytes(48);
        const randomString = randomBytes.toString('hex');
        const timestamp = Date.now().toString(36);
        return `sess_${randomString.substring(0, 32)}${timestamp.substring(0, 8)}`;
    },

    /**
     * Hash session token
     */
    hashSessionToken(token) {
        return bcrypt.hashSync(token, 10);
    },

    /**
     * Generate session number
     */
    async generateSessionNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM sessions
                WHERE session_number LIKE $1
            `, [`SES-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `SES-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error generating session number', { error: error.message });
            throw error;
        }
    },

    /**
     * Check if session is expired
     */
    isSessionExpired(expiresAt) {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    },

    /**
     * Check if session is idle (inactive for too long)
     */
    isSessionIdle(lastActivity, timeoutMinutes = 30) {
        if (!lastActivity) return false;
        const idleMinutes = (Date.now() - new Date(lastActivity)) / (1000 * 60);
        return idleMinutes > timeoutMinutes;
    },

    /**
     * Get device fingerprint from request
     */
    getDeviceFingerprint(req) {
        const components = [
            req.headers['user-agent'],
            req.headers['accept-language'],
            req.headers['accept-encoding'],
            req.ip
        ];
        const fingerprint = components.join('|');
        return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 32);
    },

    /**
     * Parse device info from user agent
     */
    parseDeviceInfo(userAgent) {
        const deviceInfo = {
            device_type: 'other',
            os: 'other',
            browser: 'other',
            device_name: null
        };

        if (!userAgent) return deviceInfo;

        // Detect device type
        if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
            deviceInfo.device_type = 'mobile';
        } else if (/Tablet|iPad/i.test(userAgent)) {
            deviceInfo.device_type = 'tablet';
        } else {
            deviceInfo.device_type = 'desktop';
        }

        // Detect OS
        if (/Windows/i.test(userAgent)) deviceInfo.os = 'windows';
        else if (/Mac/i.test(userAgent)) deviceInfo.os = 'macos';
        else if (/Linux/i.test(userAgent)) deviceInfo.os = 'linux';
        else if (/Android/i.test(userAgent)) deviceInfo.os = 'android';
        else if (/iPhone|iPad|iPod/i.test(userAgent)) deviceInfo.os = 'ios';

        // Detect Browser
        if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) deviceInfo.browser = 'chrome';
        else if (/Firefox/i.test(userAgent)) deviceInfo.browser = 'firefox';
        else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) deviceInfo.browser = 'safari';
        else if (/Edg/i.test(userAgent)) deviceInfo.browser = 'edge';
        else if (/Opera|OPR/i.test(userAgent)) deviceInfo.browser = 'opera';

        return deviceInfo;
    },

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Create new session
     */
    async createSession(userId, sessionData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check max concurrent sessions
            const maxSessions = await this.getMaxConcurrentSessions();
            const activeCount = await this.getActiveSessionCount(userId);

            if (activeCount >= maxSessions) {
                // Terminate oldest session
                await this.terminateOldestSession(userId);
            }

            const sessionNumber = await this.generateSessionNumber();
            const sessionToken = this.generateSessionToken();
            const tokenHash = this.hashSessionToken(sessionToken);
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

            const query = `
                INSERT INTO sessions (
                    id, session_number, user_id, session_token, token_hash,
                    ip_address, user_agent, device_fingerprint, device_info,
                    login_time, last_activity, expires_at, status, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7, $8,
                    NOW(), NOW(), $9, 'active', NOW(), NOW()
                ) RETURNING id, session_number, session_token
            `;

            const deviceInfo = this.parseDeviceInfo(sessionData.user_agent);
            const deviceFingerprint = sessionData.device_fingerprint || this.getDeviceFingerprint({ 
                headers: { 'user-agent': sessionData.user_agent },
                ip: sessionData.ip_address 
            });

            const values = [
                sessionNumber,
                userId,
                sessionToken,
                tokenHash,
                sessionData.ip_address || null,
                sessionData.user_agent || null,
                deviceFingerprint,
                JSON.stringify(deviceInfo),
                expiresAt
            ];

            const result = await client.query(query, values);

            // Log session creation
            await client.query(`
                INSERT INTO session_logs (id, session_id, user_id, action, ip_address, user_agent, created_at)
                VALUES (gen_random_uuid(), $1, $2, 'CREATE', $3, $4, NOW())
            `, [result.rows[0].id, userId, sessionData.ip_address, sessionData.user_agent]);

            await db.commitTransaction(client);

            return {
                ...result.rows[0],
                expires_at: expiresAt,
                device_info: deviceInfo
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating session', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get session by token
     */
    async getSessionByToken(sessionToken) {
        try {
            const tokenHash = this.hashSessionToken(sessionToken);
            const query = `
                SELECT s.*, u.username, u.email, u.role_id
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token_hash = $1 AND s.is_deleted = false
            `;
            const result = await db.query(query, [tokenHash]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting session by token', { error: error.message });
            throw error;
        }
    },

    /**
     * Get session by ID
     */
    async getSessionById(sessionId, userId = null) {
        try {
            let query = `
                SELECT s.*, u.username, u.email, u.role_id
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.id = $1 AND s.is_deleted = false
            `;
            const values = [sessionId];
            
            if (userId) {
                query += ` AND s.user_id = $2`;
                values.push(userId);
            }

            const result = await db.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting session by ID', { error: error.message, sessionId });
            throw error;
        }
    },

    /**
     * Update session activity
     */
    async updateSessionActivity(sessionId) {
        try {
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
            const query = `
                UPDATE sessions 
                SET last_activity = NOW(),
                    expires_at = $1,
                    updated_at = NOW()
                WHERE id = $2 AND status = 'active' AND is_deleted = false
                RETURNING id
            `;
            const result = await db.query(query, [expiresAt, sessionId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error updating session activity', { error: error.message, sessionId });
            throw error;
        }
    },

    /**
     * Extend session
     */
    async extendSession(sessionId, extendMinutes = 30) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const expiresAt = new Date(Date.now() + extendMinutes * 60 * 1000);
            const query = `
                UPDATE sessions 
                SET expires_at = $1,
                    last_activity = NOW(),
                    updated_at = NOW()
                WHERE id = $2 AND status = 'active' AND is_deleted = false
                RETURNING id, expires_at
            `;
            const result = await client.query(query, [expiresAt, sessionId]);

            if (result.rows.length === 0) {
                throw new Error('Session not found or inactive');
            }

            await client.query(`
                INSERT INTO session_logs (id, session_id, user_id, action, details, created_at)
                VALUES (gen_random_uuid(), $1, (SELECT user_id FROM sessions WHERE id = $1), 'EXTEND', $2, NOW())
            `, [sessionId, JSON.stringify({ extend_minutes: extendMinutes })]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error extending session', { error: error.message, sessionId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Terminate session
     */
    async terminateSession(sessionId, userId = null, reason = 'user_action') {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            let query = `
                UPDATE sessions 
                SET status = 'terminated',
                    logout_time = NOW(),
                    logout_reason = $1,
                    updated_at = NOW()
                WHERE id = $2 AND status = 'active' AND is_deleted = false
            `;
            const values = [reason, sessionId];

            if (userId) {
                query += ` AND user_id = $3`;
                values.push(userId);
            }

            query += ` RETURNING id, user_id`;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Session not found or already terminated');
            }

            await client.query(`
                INSERT INTO session_logs (id, session_id, user_id, action, details, created_at)
                VALUES (gen_random_uuid(), $1, $2, 'TERMINATE', $3, NOW())
            `, [sessionId, result.rows[0].user_id, JSON.stringify({ reason })]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error terminating session', { error: error.message, sessionId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Terminate all user sessions
     */
    async terminateUserSessions(userId, reason = 'admin_action', excludeSessionId = null) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            let query = `
                UPDATE sessions 
                SET status = 'terminated',
                    logout_time = NOW(),
                    logout_reason = $1,
                    updated_at = NOW()
                WHERE user_id = $2 AND status = 'active' AND is_deleted = false
            `;
            const values = [reason, userId];

            if (excludeSessionId) {
                query += ` AND id != $3`;
                values.push(excludeSessionId);
            }

            const result = await client.query(query, values);

            await client.query(`
                INSERT INTO session_logs (id, session_id, user_id, action, details, created_at)
                SELECT gen_random_uuid(), id, $1, 'TERMINATE_ALL', $2, NOW()
                FROM sessions
                WHERE user_id = $1 AND status = 'terminated' AND logout_reason = $3
            `, [userId, JSON.stringify({ reason, count: result.rowCount }), reason]);

            await db.commitTransaction(client);

            return { terminated_count: result.rowCount };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error terminating user sessions', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Terminate oldest session for user
     */
    async terminateOldestSession(userId) {
        try {
            const query = `
                SELECT id FROM sessions
                WHERE user_id = $1 AND status = 'active' AND is_deleted = false
                ORDER BY created_at ASC
                LIMIT 1
            `;
            const result = await db.query(query, [userId]);
            
            if (result.rows.length > 0) {
                await this.terminateSession(result.rows[0].id, userId, 'max_sessions_reached');
            }
        } catch (error) {
            logger.error('Error terminating oldest session', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get active session count for user
     */
    async getActiveSessionCount(userId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM sessions
                WHERE user_id = $1 AND status = 'active' AND is_deleted = false
            `;
            const result = await db.query(query, [userId]);
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error getting active session count', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get max concurrent sessions limit
     */
    async getMaxConcurrentSessions() {
        try {
            const result = await db.query(`
                SELECT value::int as max_sessions
                FROM system_config
                WHERE key = 'max_concurrent_sessions'
            `);
            return result.rows[0]?.max_sessions || 5;
        } catch (error) {
            return 5;
        }
    },

    /**
     * Set session timeout
     */
    async setSessionTimeout(minutes) {
        try {
            await db.query(`
                INSERT INTO system_config (key, value, updated_at)
                VALUES ('session_timeout_minutes', $1, NOW())
                ON CONFLICT (key) DO UPDATE
                SET value = $1, updated_at = NOW()
            `, [minutes.toString()]);
            
            logger.info('Session timeout updated', { minutes });
            return { timeout_minutes: minutes };
        } catch (error) {
            logger.error('Error setting session timeout', { error: error.message });
            throw error;
        }
    },

    /**
     * Get session timeout
     */
    async getSessionTimeout() {
        try {
            const result = await db.query(`
                SELECT value::int as timeout_minutes
                FROM system_config
                WHERE key = 'session_timeout_minutes'
            `);
            return result.rows[0]?.timeout_minutes || 30;
        } catch (error) {
            return 30;
        }
    },

    /**
     * List sessions with pagination
     */
    async listSessions(options = {}) {
        try {
            const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc', status, user_id } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT s.*, u.username, u.email, u.role_id
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND s.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (user_id) {
                query += ` AND s.user_id = $${paramIndex}`;
                values.push(user_id);
                paramIndex++;
            }

            query += ` ORDER BY s.${sort_by} ${sort_order === 'desc' ? 'DESC' : 'ASC'}
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM sessions
                WHERE is_deleted = false
                ${status ? 'AND status = $1' : ''}
                ${user_id ? 'AND user_id = $2' : ''}
            `;
            const countValues = [];
            if (status) countValues.push(status);
            if (user_id) countValues.push(user_id);
            const countResult = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error listing sessions', { error: error.message });
            throw error;
        }
    },

    /**
     * Get session statistics
     */
    async getSessionStats(options = {}) {
        try {
            const { from_date, to_date } = options;

            let whereClause = '';
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                whereClause += ` AND created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                whereClause += ` AND created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            const query = `
                SELECT 
                    COUNT(*) as total_sessions,
                    COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
                    COUNT(*) FILTER (WHERE status = 'terminated') as terminated_sessions,
                    COUNT(*) FILTER (WHERE status = 'expired') as expired_sessions,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(EXTRACT(EPOCH FROM (logout_time - login_time))/3600)::numeric(10,2) as avg_session_hours
                FROM sessions
                WHERE is_deleted = false ${whereClause}
            `;

            const result = await db.query(query, values);

            // Daily session creation
            const dailyQuery = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as created,
                    COUNT(*) FILTER (WHERE status = 'active') as active
                FROM sessions
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `;
            const dailyResult = await db.query(dailyQuery);

            // Device type distribution
            const deviceQuery = `
                SELECT 
                    device_info->>'device_type' as device_type,
                    COUNT(*) as count
                FROM sessions
                WHERE created_at >= NOW() - INTERVAL '30 days'
                    AND device_info IS NOT NULL
                GROUP BY device_info->>'device_type'
                ORDER BY count DESC
            `;
            const deviceResult = await db.query(deviceQuery);

            return {
                summary: result.rows[0],
                daily_creation: dailyResult.rows,
                device_distribution: deviceResult.rows
            };
        } catch (error) {
            logger.error('Error getting session stats', { error: error.message });
            throw error;
        }
    },

    /**
     * Clean expired sessions
     */
    async cleanExpiredSessions() {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE sessions 
                SET status = 'expired',
                    logout_time = NOW(),
                    logout_reason = 'timeout',
                    updated_at = NOW()
                WHERE status = 'active' 
                    AND expires_at < NOW()
                    AND is_deleted = false
                RETURNING id, user_id
            `;
            const result = await client.query(query);

            for (const session of result.rows) {
                await client.query(`
                    INSERT INTO session_logs (id, session_id, user_id, action, details, created_at)
                    VALUES (gen_random_uuid(), $1, $2, 'EXPIRED', $3, NOW())
                `, [session.id, session.user_id, JSON.stringify({ reason: 'timeout' })]);
            }

            await db.commitTransaction(client);

            return { expired_count: result.rowCount };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cleaning expired sessions', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get user sessions
     */
    async getUserSessions(userId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT id, session_number, device_info, ip_address,
                       login_time, last_activity, expires_at, status,
                       CASE WHEN id = $1 THEN true ELSE false END as is_current
                FROM sessions
                WHERE user_id = $2 AND is_deleted = false
                ORDER BY last_activity DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [options.current_session_id, userId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM sessions
                WHERE user_id = $1 AND is_deleted = false
            `;
            const countResult = await db.query(countQuery, [userId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error getting user sessions', { error: error.message, userId });
            throw error;
        }
    }
};

module.exports = sessionService;