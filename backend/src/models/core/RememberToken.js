/**
 * ======================================================================
 * FILE: backend/src/models/core/RememberToken.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * RememberToken model for database operations.
 * Handles "Remember Me" functionality with secure token rotation.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * - crypto: for generating secure tokens
 * 
 * TABLE: remember_tokens
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users)
 * - series_identifier: string (unique)
 * - token_hash: string
 * - ip_address: inet
 * - user_agent: text
 * - last_used: timestamp
 * - expires_at: timestamp
 * - created_at: timestamp
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

const RememberToken = {
    /**
     * Table name
     */
    tableName: 'remember_tokens',

    /**
     * Generate series identifier
     * @returns {string} Random series identifier
     */
    generateSeriesIdentifier() {
        return crypto.randomBytes(20).toString('hex');
    },

    /**
     * Generate token value
     * @returns {string} Random token value
     */
    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    },

    /**
     * Hash token for storage
     * @param {string} token - Raw token
     * @returns {string} Hashed token
     */
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    },

    /**
     * Create remember token for user
     * @param {Object} tokenData - Token data
     * @param {string} tokenData.user_id - User ID
     * @param {string} [tokenData.ip_address] - IP address
     * @param {string} [tokenData.user_agent] - User agent
     * @param {number} [tokenData.expiry_days] - Expiry in days (default: 30)
     * @returns {Promise<Object>} Created token with series and token
     */
    async create(tokenData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const seriesIdentifier = this.generateSeriesIdentifier();
            const token = this.generateToken();
            const tokenHash = this.hashToken(token);
            const expiryDays = tokenData.expiry_days || 30;
            const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

            const query = `
                INSERT INTO remember_tokens (
                    id, user_id, series_identifier, token_hash,
                    ip_address, user_agent, last_used, expires_at,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), $6, NOW()
                )
                RETURNING 
                    id, user_id, series_identifier, expires_at,
                    created_at
            `;

            const values = [
                tokenData.user_id,
                seriesIdentifier,
                tokenHash,
                tokenData.ip_address || null,
                tokenData.user_agent || null,
                expiresAt
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Remember token created', {
                userId: tokenData.user_id,
                seriesId: seriesIdentifier,
                expiresAt
            });

            return {
                ...result.rows[0],
                token: token
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating remember token', {
                error: error.message,
                userId: tokenData.user_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Find token by series identifier
     * @param {string} seriesIdentifier - Series identifier
     * @returns {Promise<Object|null>} Token object or null
     */
    async findBySeries(seriesIdentifier) {
        try {
            const query = `
                SELECT 
                    id, user_id, series_identifier, token_hash,
                    ip_address, user_agent, last_used, expires_at,
                    created_at
                FROM remember_tokens
                WHERE series_identifier = $1 
                    AND is_deleted = false
                    AND expires_at > NOW()
                LIMIT 1
            `;

            const result = await db.query(query, [seriesIdentifier]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Remember token found by series', { seriesIdentifier });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding remember token by series', {
                error: error.message,
                seriesIdentifier
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find token by user ID
     * @param {string} userId - User ID
     * @returns {Promise<Array>} List of tokens
     */
    async findByUserId(userId) {
        try {
            const query = `
                SELECT 
                    id, user_id, series_identifier,
                    ip_address, user_agent, last_used, expires_at,
                    created_at
                FROM remember_tokens
                WHERE user_id = $1 
                    AND is_deleted = false
                    AND expires_at > NOW()
                ORDER BY created_at DESC
            `;

            const result = await db.query(query, [userId]);

            logger.debug('Remember tokens found by user ID', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding remember tokens by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Validate token and rotate (if valid)
     * @param {string} seriesIdentifier - Series identifier
     * @param {string} token - Token to validate
     * @param {string} ipAddress - Current IP address
     * @param {string} userAgent - Current user agent
     * @returns {Promise<Object>} Validation result with new token on success
     */
    async validateAndRotate(seriesIdentifier, token, ipAddress, userAgent) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const storedToken = await this.findBySeries(seriesIdentifier);
            if (!storedToken) {
                return { success: false, reason: 'not_found' };
            }

            const tokenHash = this.hashToken(token);
            if (storedToken.token_hash !== tokenHash) {
                await this.invalidateSeries(seriesIdentifier);
                logger.warn('Remember token validation failed - token mismatch', {
                    seriesIdentifier,
                    userId: storedToken.user_id
                });
                return { success: false, reason: 'invalid_token' };
            }

            const newToken = this.generateToken();
            const newTokenHash = this.hashToken(newToken);

            const query = `
                UPDATE remember_tokens 
                SET token_hash = $1,
                    ip_address = $2,
                    user_agent = $3,
                    last_used = NOW(),
                    updated_at = NOW()
                WHERE series_identifier = $4
                RETURNING 
                    id, user_id, series_identifier, expires_at
            `;

            const values = [newTokenHash, ipAddress, userAgent, seriesIdentifier];
            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Remember token validated and rotated', {
                userId: storedToken.user_id,
                seriesIdentifier
            });

            return {
                success: true,
                user_id: storedToken.user_id,
                token: newToken,
                expires_at: result.rows[0].expires_at
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error validating remember token', {
                error: error.message,
                seriesIdentifier
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Invalidate a specific token series
     * @param {string} seriesIdentifier - Series identifier
     * @returns {Promise<boolean>} True if invalidated
     */
    async invalidateSeries(seriesIdentifier) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE remember_tokens 
                SET is_deleted = true,
                    deleted_at = NOW()
                WHERE series_identifier = $1 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [seriesIdentifier]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Remember token series invalidated', { seriesIdentifier });
            }

            return result.rowCount > 0;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error invalidating token series', {
                error: error.message,
                seriesIdentifier
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Invalidate all tokens for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Number of tokens invalidated
     */
    async invalidateAllForUser(userId) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE remember_tokens 
                SET is_deleted = true,
                    deleted_at = NOW()
                WHERE user_id = $1 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [userId]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('All remember tokens invalidated for user', {
                    userId,
                    count: result.rowCount
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error invalidating all user tokens', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Clean up expired tokens (run via cron)
     * @returns {Promise<number>} Number of tokens cleaned up
     */
    async cleanupExpired() {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE remember_tokens 
                SET is_deleted = true,
                    deleted_at = NOW()
                WHERE expires_at < NOW() AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Expired remember tokens cleaned up', {
                    count: result.rowCount
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cleaning up expired tokens', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Get token statistics
     * @returns {Promise<Object>} Token statistics
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_tokens,
                    COUNT(*) FILTER (WHERE expires_at > NOW()) as active_tokens,
                    COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_tokens,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(EXTRACT(EPOCH FROM (expires_at - created_at))/86400)::numeric(10,2) as avg_lifetime_days
                FROM remember_tokens
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Remember token statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting remember token statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get tokens expiring soon (for notifications)
     * @param {number} daysBefore - Days before expiry to consider
     * @returns {Promise<Array>} List of tokens expiring soon
     */
    async getExpiringSoon(daysBefore = 7) {
        try {
            const query = `
                SELECT 
                    rt.id, rt.user_id, rt.series_identifier,
                    rt.expires_at, rt.last_used,
                    u.username, u.email
                FROM remember_tokens rt
                JOIN users u ON rt.user_id = u.id
                WHERE rt.is_deleted = false
                    AND rt.expires_at > NOW()
                    AND rt.expires_at <= NOW() + ($1 || ' days')::INTERVAL
                ORDER BY rt.expires_at ASC
            `;

            const result = await db.query(query, [daysBefore]);

            logger.debug('Tokens expiring soon retrieved', {
                count: result.rows.length,
                daysBefore
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting tokens expiring soon', {
                error: error.message,
                daysBefore
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = RememberToken;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create remember token on login
 * const token = await RememberToken.create({
 *     user_id: userId,
 *     ip_address: '192.168.1.100',
 *     user_agent: 'Mozilla/5.0...',
 *     expiry_days: 30
 * });
 * 
 * // Store in cookie
 * res.cookie('remember_series', token.series_identifier, {
 *     httpOnly: true,
 *     secure: true,
 *     maxAge: 30 * 24 * 60 * 60 * 1000
 * });
 * res.cookie('remember_token', token.token, {
 *     httpOnly: true,
 *     secure: true,
 *     maxAge: 30 * 24 * 60 * 60 * 1000
 * });
 * 
 * // Validate token on subsequent requests
 * const series = req.cookies.remember_series;
 * const token = req.cookies.remember_token;
 * 
 * if (series && token) {
 *     const result = await RememberToken.validateAndRotate(
 *         series, token, req.ip, req.headers['user-agent']
 *     );
 *     
 *     if (result.success) {
 *         // Update cookies with new token
 *         res.cookie('remember_token', result.token, { ... });
 *         // Auto-login user (result.user_id)
 *     }
 * }
 * 
 * // Logout - invalidate all user tokens
 * await RememberToken.invalidateAllForUser(userId);
 * 
 * // Logout from specific device
 * await RememberToken.invalidateSeries(seriesIdentifier);
 * 
 * // Clean up expired tokens (run via cron daily)
 * await RememberToken.cleanupExpired();
 * 
 * // Get token statistics
 * const stats = await RememberToken.getStatistics();
 * 
 * // Get tokens expiring soon (for notifications)
 * const expiring = await RememberToken.getExpiringSoon(7);
 * 
 * ======================================================================
 */