/**
 * ======================================================================
 * FILE: backend/src/models/core/LoginAttempt.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * LoginAttempt model for database operations.
 * Handles all login attempt tracking for security monitoring.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: login_attempts
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users, nullable)
 * - username: string
 * - email: string
 * - ip_address: inet
 * - user_agent: text
 * - attempt_time: timestamp
 * - success: boolean
 * - failure_reason: string
 * - created_at: timestamp
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation with core CRUD operations
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const LoginAttempt = {
    /**
     * Table name
     */
    tableName: 'login_attempts',

    /**
     * Record a login attempt
     * @param {Object} attemptData - Login attempt data
     * @param {string} [attemptData.user_id] - User ID (if known)
     * @param {string} [attemptData.username] - Username attempted
     * @param {string} [attemptData.email] - Email attempted
     * @param {string} attemptData.ip_address - IP address
     * @param {string} [attemptData.user_agent] - User agent
     * @param {boolean} attemptData.success - Whether login was successful
     * @param {string} [attemptData.failure_reason] - Reason for failure
     * @returns {Promise<Object>} Created login attempt record
     */
    async record(attemptData) {
        try {
            const query = `
                INSERT INTO login_attempts (
                    id, user_id, username, email, ip_address,
                    user_agent, attempt_time, success, failure_reason,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), $6, $7, NOW()
                )
                RETURNING 
                    id, user_id, username, email, ip_address,
                    attempt_time, success, failure_reason
            `;

            const values = [
                attemptData.user_id || null,
                attemptData.username || null,
                attemptData.email || null,
                attemptData.ip_address,
                attemptData.user_agent || null,
                attemptData.success,
                attemptData.failure_reason || null
            ];

            const result = await db.query(query, values);

            logger.debug('Login attempt recorded', {
                userId: attemptData.user_id,
                username: attemptData.username,
                email: attemptData.email,
                ip: attemptData.ip_address,
                success: attemptData.success
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error recording login attempt', {
                error: error.message,
                ipAddress: attemptData.ip_address
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find failed attempts by IP address
     * @param {string} ipAddress - IP address
     * @param {number} minutes - Minutes to look back
     * @returns {Promise<number>} Count of failed attempts
     */
    async countFailedByIp(ipAddress, minutes = 15) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM login_attempts
                WHERE ip_address = $1
                    AND success = false
                    AND attempt_time > NOW() - ($2 || ' minutes')::INTERVAL
            `;

            const result = await db.query(query, [ipAddress, minutes]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting failed attempts by IP', {
                error: error.message,
                ipAddress
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find failed attempts by username
     * @param {string} username - Username
     * @param {number} minutes - Minutes to look back
     * @returns {Promise<number>} Count of failed attempts
     */
    async countFailedByUsername(username, minutes = 15) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM login_attempts
                WHERE username = $1
                    AND success = false
                    AND attempt_time > NOW() - ($2 || ' minutes')::INTERVAL
            `;

            const result = await db.query(query, [username, minutes]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting failed attempts by username', {
                error: error.message,
                username
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find failed attempts by email
     * @param {string} email - Email address
     * @param {number} minutes - Minutes to look back
     * @returns {Promise<number>} Count of failed attempts
     */
    async countFailedByEmail(email, minutes = 15) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM login_attempts
                WHERE email = $1
                    AND success = false
                    AND attempt_time > NOW() - ($2 || ' minutes')::INTERVAL
            `;

            const result = await db.query(query, [email, minutes]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting failed attempts by email', {
                error: error.message,
                email
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find failed attempts by user ID
     * @param {string} userId - User ID
     * @param {number} minutes - Minutes to look back
     * @returns {Promise<number>} Count of failed attempts
     */
    async countFailedByUserId(userId, minutes = 15) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM login_attempts
                WHERE user_id = $1
                    AND success = false
                    AND attempt_time > NOW() - ($2 || ' minutes')::INTERVAL
            `;

            const result = await db.query(query, [userId, minutes]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting failed attempts by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get recent login attempts by IP
     * @param {string} ipAddress - IP address
     * @param {number} limit - Number of attempts to return
     * @returns {Promise<Array>} List of login attempts
     */
    async getByIp(ipAddress, limit = 10) {
        try {
            const query = `
                SELECT 
                    id, user_id, username, email, ip_address,
                    user_agent, attempt_time, success, failure_reason
                FROM login_attempts
                WHERE ip_address = $1
                ORDER BY attempt_time DESC
                LIMIT $2
            `;

            const result = await db.query(query, [ipAddress, limit]);

            logger.debug('Login attempts retrieved by IP', {
                ipAddress,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting login attempts by IP', {
                error: error.message,
                ipAddress
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get recent login attempts by username
     * @param {string} username - Username
     * @param {number} limit - Number of attempts to return
     * @returns {Promise<Array>} List of login attempts
     */
    async getByUsername(username, limit = 10) {
        try {
            const query = `
                SELECT 
                    id, user_id, username, email, ip_address,
                    user_agent, attempt_time, success, failure_reason
                FROM login_attempts
                WHERE username = $1
                ORDER BY attempt_time DESC
                LIMIT $2
            `;

            const result = await db.query(query, [username, limit]);

            logger.debug('Login attempts retrieved by username', {
                username,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting login attempts by username', {
                error: error.message,
                username
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get recent login attempts by user ID
     * @param {string} userId - User ID
     * @param {number} limit - Number of attempts to return
     * @returns {Promise<Array>} List of login attempts
     */
    async getByUserId(userId, limit = 10) {
        try {
            const query = `
                SELECT 
                    id, user_id, username, email, ip_address,
                    user_agent, attempt_time, success, failure_reason
                FROM login_attempts
                WHERE user_id = $1
                ORDER BY attempt_time DESC
                LIMIT $2
            `;

            const result = await db.query(query, [userId, limit]);

            logger.debug('Login attempts retrieved by user ID', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting login attempts by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get recent failed login attempts (for security monitoring)
     * @param {number} minutes - Minutes to look back
     * @param {number} limit - Number of attempts to return
     * @returns {Promise<Array>} List of failed login attempts
     */
    async getRecentFailed(minutes = 60, limit = 100) {
        try {
            const query = `
                SELECT 
                    id, user_id, username, email, ip_address,
                    user_agent, attempt_time, failure_reason
                FROM login_attempts
                WHERE success = false
                    AND attempt_time > NOW() - ($1 || ' minutes')::INTERVAL
                ORDER BY attempt_time DESC
                LIMIT $2
            `;

            const result = await db.query(query, [minutes, limit]);

            logger.debug('Recent failed login attempts retrieved', {
                minutes,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting recent failed login attempts', {
                error: error.message,
                minutes
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get login attempt statistics
     * @param {number} days - Days to look back
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(days = 7) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_attempts,
                    COUNT(*) FILTER (WHERE success = true) as successful,
                    COUNT(*) FILTER (WHERE success = false) as failed,
                    COUNT(DISTINCT ip_address) as unique_ips,
                    COUNT(DISTINCT username) as unique_usernames,
                    COUNT(DISTINCT user_id) as unique_users,
                    ROUND((COUNT(*) FILTER (WHERE success = true)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as success_rate
                FROM login_attempts
                WHERE attempt_time > NOW() - ($1 || ' days')::INTERVAL
            `;

            const result = await db.query(query, [days]);

            logger.debug('Login attempt statistics retrieved', { days });

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting login attempt statistics', {
                error: error.message,
                days
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get daily login attempt counts (for charts)
     * @param {number} days - Days to look back
     * @returns {Promise<Array>} Daily counts
     */
    async getDailyCounts(days = 7) {
        try {
            const query = `
                SELECT 
                    DATE(attempt_time) as date,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE success = true) as successful,
                    COUNT(*) FILTER (WHERE success = false) as failed
                FROM login_attempts
                WHERE attempt_time > NOW() - ($1 || ' days')::INTERVAL
                GROUP BY DATE(attempt_time)
                ORDER BY date ASC
            `;

            const result = await db.query(query, [days]);

            logger.debug('Daily login attempt counts retrieved', {
                days,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting daily login attempt counts', {
                error: error.message,
                days
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get hourly login attempt counts (for peak hour analysis)
     * @param {string} date - Date to analyze
     * @returns {Promise<Array>} Hourly counts
     */
    async getHourlyCounts(date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                SELECT 
                    EXTRACT(HOUR FROM attempt_time) as hour,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE success = true) as successful,
                    COUNT(*) FILTER (WHERE success = false) as failed
                FROM login_attempts
                WHERE DATE(attempt_time) = $1
                GROUP BY EXTRACT(HOUR FROM attempt_time)
                ORDER BY hour ASC
            `;

            const result = await db.query(query, [targetDate]);

            logger.debug('Hourly login attempt counts retrieved', {
                date: targetDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting hourly login attempt counts', {
                error: error.message,
                date
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get top IPs by failed attempts (for security monitoring)
     * @param {number} limit - Number of IPs to return
     * @param {number} minutes - Minutes to look back
     * @returns {Promise<Array>} List of IPs with failed attempt counts
     */
    async getTopFailedIps(limit = 10, minutes = 60) {
        try {
            const query = `
                SELECT 
                    ip_address,
                    COUNT(*) as failed_count,
                    MAX(attempt_time) as last_attempt,
                    COUNT(DISTINCT username) as unique_usernames
                FROM login_attempts
                WHERE success = false
                    AND attempt_time > NOW() - ($1 || ' minutes')::INTERVAL
                GROUP BY ip_address
                ORDER BY failed_count DESC
                LIMIT $2
            `;

            const result = await db.query(query, [minutes, limit]);

            logger.debug('Top failed IPs retrieved', {
                minutes,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting top failed IPs', {
                error: error.message,
                minutes
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get top usernames by failed attempts (for security monitoring)
     * @param {number} limit - Number of usernames to return
     * @param {number} minutes - Minutes to look back
     * @returns {Promise<Array>} List of usernames with failed attempt counts
     */
    async getTopFailedUsernames(limit = 10, minutes = 60) {
        try {
            const query = `
                SELECT 
                    username,
                    COUNT(*) as failed_count,
                    MAX(attempt_time) as last_attempt,
                    COUNT(DISTINCT ip_address) as unique_ips
                FROM login_attempts
                WHERE success = false
                    AND username IS NOT NULL
                    AND attempt_time > NOW() - ($1 || ' minutes')::INTERVAL
                GROUP BY username
                ORDER BY failed_count DESC
                LIMIT $2
            `;

            const result = await db.query(query, [minutes, limit]);

            logger.debug('Top failed usernames retrieved', {
                minutes,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting top failed usernames', {
                error: error.message,
                minutes
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Clean up old login attempts (run via cron)
     * @param {number} daysToKeep - Days to keep login attempt records
     * @returns {Promise<number>} Number of records deleted
     */
    async cleanup(daysToKeep = 90) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                DELETE FROM login_attempts
                WHERE attempt_time < NOW() - ($1 || ' days')::INTERVAL
                RETURNING id
            `;

            const result = await client.query(query, [daysToKeep]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Old login attempts cleaned up', {
                    count: result.rowCount,
                    daysToKeep
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cleaning up login attempts', {
                error: error.message,
                daysToKeep
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Get suspicious IPs (high failure rate)
     * @param {number} threshold - Minimum failed attempts
     * @param {number} minutes - Minutes to look back
     * @returns {Promise<Array>} List of suspicious IPs
     */
    async getSuspiciousIps(threshold = 10, minutes = 60) {
        try {
            const query = `
                SELECT 
                    ip_address,
                    COUNT(*) as total_attempts,
                    COUNT(*) FILTER (WHERE success = true) as successful,
                    COUNT(*) FILTER (WHERE success = false) as failed,
                    ROUND((COUNT(*) FILTER (WHERE success = false)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as failure_rate
                FROM login_attempts
                WHERE attempt_time > NOW() - ($1 || ' minutes')::INTERVAL
                GROUP BY ip_address
                HAVING COUNT(*) FILTER (WHERE success = false) >= $2
                ORDER BY failed DESC
            `;

            const result = await db.query(query, [minutes, threshold]);

            logger.debug('Suspicious IPs retrieved', {
                threshold,
                minutes,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting suspicious IPs', {
                error: error.message,
                threshold,
                minutes
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = LoginAttempt;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Record successful login
 * await LoginAttempt.record({
 *     user_id: userId,
 *     username: 'john.doe',
 *     email: 'john@hospital.com',
 *     ip_address: '192.168.1.100',
 *     user_agent: 'Mozilla/5.0...',
 *     success: true
 * });
 * 
 * // Record failed login
 * await LoginAttempt.record({
 *     username: 'john.doe',
 *     ip_address: '192.168.1.100',
 *     success: false,
 *     failure_reason: 'invalid_password'
 * });
 * 
 * // Check failed attempts from IP (for rate limiting)
 * const failedCount = await LoginAttempt.countFailedByIp('192.168.1.100', 15);
 * if (failedCount >= 5) {
 *     // Block or require captcha
 * }
 * 
 * // Check failed attempts for username
 * const failedUsername = await LoginAttempt.countFailedByUsername('john.doe', 15);
 * 
 * // Get recent failed attempts for security monitoring
 * const recentFailed = await LoginAttempt.getRecentFailed(60, 100);
 * 
 * // Get top suspicious IPs
 * const suspicious = await LoginAttempt.getSuspiciousIps(10, 60);
 * 
 * // Get login statistics for dashboard
 * const stats = await LoginAttempt.getStatistics(7);
 * 
 * // Get daily counts for chart
 * const dailyCounts = await LoginAttempt.getDailyCounts(7);
 * 
 * // Get hourly counts for peak hour analysis
 * const hourlyCounts = await LoginAttempt.getHourlyCounts('2024-01-15');
 * 
 * // Get top failed IPs
 * const topIps = await LoginAttempt.getTopFailedIps(10, 60);
 * 
 * // Get top failed usernames
 * const topUsernames = await LoginAttempt.getTopFailedUsernames(10, 60);
 * 
 * // Clean up old records (run via cron monthly)
 * await LoginAttempt.cleanup(90);
 * 
 * ======================================================================
 */