// backend/src/services/token/tokenService.js
/**
 * ======================================================================
 * FILE: backend/src/services/token/tokenService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Token Management service - Handles token lifecycle operations.
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
 * DATABASE TABLES:
 * - tokens
 * - token_blacklist
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const tokenService = {
    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Generate random token
     */
    generateToken(prefix = 'tok') {
        const randomBytes = crypto.randomBytes(32);
        const randomString = randomBytes.toString('hex');
        const timestamp = Date.now().toString(36);
        return `${prefix}_${randomString.substring(0, 24)}${timestamp.substring(0, 6)}`;
    },

    /**
     * Hash token for storage
     */
    hashToken(token) {
        return bcrypt.hashSync(token, 10);
    },

    /**
     * Get last 4 characters for display
     */
    getTokenLastFour(token) {
        return token.slice(-4);
    },

    /**
     * Get token prefix based on type
     */
    getTokenPrefix(tokenType) {
        const prefixes = {
            access: 'acc',
            refresh: 'ref',
            reset: 'rst',
            verify: 'vrf',
            mfa: 'mfa',
            api_key: 'key',
            oauth: 'oat'
        };
        return prefixes[tokenType] || 'tok';
    },

    /**
     * Generate token number
     */
    async generateTokenNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM tokens
                WHERE token_number LIKE $1
            `, [`TKN-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `TKN-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error generating token number', { error: error.message });
            throw error;
        }
    },

    /**
     * Check if token is expired
     */
    isTokenExpired(expiresAt) {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    },

    /**
     * Check if token is blacklisted
     */
    async isTokenBlacklisted(tokenHash) {
        try {
            const result = await db.query(`
                SELECT id FROM token_blacklist tb
                JOIN tokens t ON tb.token_id = t.id
                WHERE t.token_hash = $1 
                    AND (tb.expires_at IS NULL OR tb.expires_at > NOW())
            `, [tokenHash]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error checking blacklist', { error: error.message });
            return false;
        }
    },

    /**
     * Generate JWT token
     */
    generateJWT(payload, expiresIn = '15m') {
        const secret = process.env.JWT_SECRET || 'your-secret-key';
        return jwt.sign(payload, secret, { expiresIn });
    },

    /**
     * Verify JWT token
     */
    verifyJWT(token) {
        try {
            const secret = process.env.JWT_SECRET || 'your-secret-key';
            return jwt.verify(token, secret);
        } catch (error) {
            return null;
        }
    },

    // ============================================
    // TOKEN CRUD OPERATIONS
    // ============================================

    /**
     * List all tokens with pagination
     */
    async listTokens(options = {}) {
        try {
            const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc', token_type, status, user_id } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    t.id,
                    t.token_number,
                    t.user_id,
                    t.token_type,
                    t.token_status,
                    t.token_prefix,
                    t.token_last_four,
                    t.purpose,
                    t.issued_at,
                    t.expires_at,
                    t.used_at,
                    t.revoked_at,
                    t.requires_mfa,
                    t.mfa_verified_at,
                    t.created_at,
                    u.username,
                    u.email
                FROM tokens t
                LEFT JOIN users u ON t.user_id = u.id
                WHERE t.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (token_type) {
                query += ` AND t.token_type = $${paramIndex}`;
                values.push(token_type);
                paramIndex++;
            }

            if (status) {
                query += ` AND t.token_status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (user_id) {
                query += ` AND t.user_id = $${paramIndex}`;
                values.push(user_id);
                paramIndex++;
            }

            query += ` ORDER BY t.${sort_by} ${sort_order === 'desc' ? 'DESC' : 'ASC'}
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tokens
                WHERE is_deleted = false
                ${token_type ? 'AND token_type = $1' : ''}
                ${status ? 'AND token_status = $2' : ''}
                ${user_id ? 'AND user_id = $3' : ''}
            `;
            const countValues = [];
            if (token_type) countValues.push(token_type);
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
            logger.error('Error listing tokens', { error: error.message });
            throw error;
        }
    },

    /**
     * Get tokens by user
     */
    async getTokensByUser(userId, options = {}) {
        try {
            const { page = 1, limit = 20, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    t.id,
                    t.token_number,
                    t.token_type,
                    t.token_status,
                    t.token_prefix,
                    t.token_last_four,
                    t.purpose,
                    t.issued_at,
                    t.expires_at,
                    t.used_at,
                    t.revoked_at,
                    t.last_used_at,
                    t.usage_count
                FROM tokens t
                WHERE t.user_id = $1 AND t.is_deleted = false
            `;
            const values = [userId];
            let paramIndex = 2;

            if (status) {
                query += ` AND t.token_status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` ORDER BY t.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tokens
                WHERE user_id = $1 AND is_deleted = false
                ${status ? 'AND token_status = $2' : ''}
            `;
            const countValues = [userId];
            if (status) countValues.push(status);
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
            logger.error('Error getting tokens by user', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Create token
     */
    async createToken(userId, tokenData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const tokenNumber = await this.generateTokenNumber();
            const tokenType = tokenData.token_type;
            const tokenPrefix = this.getTokenPrefix(tokenType);
            const rawToken = this.generateToken(tokenPrefix);
            const tokenHash = this.hashToken(rawToken);
            const tokenLastFour = this.getTokenLastFour(rawToken);

            const expiresAt = tokenData.expires_at || (tokenType === 'access' ? 
                new Date(Date.now() + 15 * 60 * 1000) : 
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

            const query = `
                INSERT INTO tokens (
                    id, token_number, user_id, token_type, token_status,
                    token_prefix, token_hash, token_last_four, purpose,
                    issued_at, expires_at, requires_mfa, metadata,
                    ip_address, user_agent, device_fingerprint, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, 'active',
                    $4, $5, $6, $7,
                    NOW(), $8, $9, $10,
                    $11, $12, $13, NOW(), NOW()
                ) RETURNING id, token_number, token_type, token_prefix, token_last_four
            `;

            const values = [
                tokenNumber,
                userId,
                tokenType,
                tokenPrefix,
                tokenHash,
                tokenLastFour,
                tokenData.purpose || null,
                expiresAt,
                tokenData.requires_mfa || false,
                tokenData.metadata ? JSON.stringify(tokenData.metadata) : null,
                tokenData.ip_address || null,
                tokenData.user_agent || null,
                tokenData.device_fingerprint || null
            ];

            const result = await client.query(query, values);

            // Log token creation
            await client.query(`
                INSERT INTO audit_logs (id, audit_id, user_id, action, table_name, record_id, created_at)
                VALUES (gen_random_uuid(), gen_random_uuid()::text, $1, 'CREATE', 'tokens', $2, NOW())
            `, [userId, result.rows[0].id]);

            await db.commitTransaction(client);

            return {
                ...result.rows[0],
                token: rawToken,
                expires_at: expiresAt,
                message: 'Save this token securely. It will not be shown again.'
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating token', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Revoke token
     */
    async revokeToken(tokenId, userId, revokeData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tokens 
                SET token_status = 'revoked',
                    revoked_at = NOW(),
                    revocation_reason = $1,
                    updated_at = NOW()
                WHERE id = $2 
                    AND (user_id = $3 OR $3 IS NULL)
                    AND token_status = 'active'
                    AND is_deleted = false
                RETURNING id, token_number, token_type, user_id
            `;

            const result = await client.query(query, [revokeData.reason, tokenId, userId]);

            if (result.rows.length === 0) {
                throw new Error('Token not found or already revoked');
            }

            // Log revocation
            await client.query(`
                INSERT INTO audit_logs (id, audit_id, user_id, action, table_name, record_id, created_at)
                VALUES (gen_random_uuid(), gen_random_uuid()::text, $1, 'REVOKE', 'tokens', $2, NOW())
            `, [userId || result.rows[0].user_id, tokenId]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error revoking token', { error: error.message, tokenId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Blacklist token
     */
    async blacklistToken(tokenId, userId, blacklistData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Update token status
            const tokenQuery = `
                UPDATE tokens 
                SET token_status = 'blacklisted',
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING id, token_number, user_id
            `;
            const tokenResult = await client.query(tokenQuery, [tokenId]);

            if (tokenResult.rows.length === 0) {
                throw new Error('Token not found');
            }

            const token = tokenResult.rows[0];

            // Add to blacklist
            const blacklistQuery = `
                INSERT INTO token_blacklist (
                    id, token_id, user_id, blacklist_reason, blacklisted_by,
                    expires_at, ip_address, user_agent, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7, NOW()
                )
                RETURNING id
            `;

            await client.query(blacklistQuery, [
                tokenId,
                token.user_id,
                blacklistData.reason,
                userId,
                blacklistData.expires_at || null,
                blacklistData.ip_address || null,
                blacklistData.user_agent || null
            ]);

            await db.commitTransaction(client);

            return token;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error blacklisting token', { error: error.message, tokenId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * List blacklisted tokens
     */
    async listBlacklistedTokens(options = {}) {
        try {
            const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc' } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    tb.*,
                    t.token_number,
                    t.token_type,
                    t.token_prefix,
                    t.token_last_four,
                    t.issued_at,
                    t.expires_at,
                    u.username,
                    u.email,
                    CONCAT(admin.first_name, ' ', admin.last_name) as blacklisted_by_name
                FROM token_blacklist tb
                JOIN tokens t ON tb.token_id = t.id
                JOIN users u ON t.user_id = u.id
                LEFT JOIN users admin ON tb.blacklisted_by = admin.id
                ORDER BY tb.${sort_by} ${sort_order === 'desc' ? 'DESC' : 'ASC'}
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `SELECT COUNT(*) as total FROM token_blacklist`;
            const countResult = await db.query(countQuery);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error listing blacklisted tokens', { error: error.message });
            throw error;
        }
    },

    /**
     * Remove token from blacklist
     */
    async removeFromBlacklist(blacklistId, userId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                DELETE FROM token_blacklist
                WHERE id = $1
                RETURNING token_id
            `;
            const result = await client.query(query, [blacklistId]);

            if (result.rows.length === 0) {
                throw new Error('Blacklist entry not found');
            }

            // Update token status back to active
            await client.query(`
                UPDATE tokens 
                SET token_status = 'active',
                    updated_at = NOW()
                WHERE id = $1
            `, [result.rows[0].token_id]);

            await db.commitTransaction(client);

            return { id: blacklistId, token_id: result.rows[0].token_id };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error removing from blacklist', { error: error.message, blacklistId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Refresh token (rotate)
     */
    async refreshToken(refreshToken, deviceInfo) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Find and validate refresh token
            const tokenQuery = `
                SELECT t.*, u.id as user_id, u.username, u.email
                FROM tokens t
                JOIN users u ON t.user_id = u.id
                WHERE t.token_hash = $1 
                    AND t.token_type = 'refresh'
                    AND t.token_status = 'active'
                    AND t.is_deleted = false
                    AND (t.expires_at IS NULL OR t.expires_at > NOW())
            `;

            const tokenResult = await client.query(tokenQuery, [this.hashToken(refreshToken)]);

            if (tokenResult.rows.length === 0) {
                throw new Error('Invalid or expired refresh token');
            }

            const existingToken = tokenResult.rows[0];

            // Revoke old refresh token
            await this.revokeToken(existingToken.id, existingToken.user_id, { reason: 'rotation' });

            // Generate new access and refresh tokens
            const accessToken = this.generateJWT(
                { id: existingToken.user_id, username: existingToken.username, email: existingToken.email },
                '15m'
            );

            const newRefreshToken = await this.createToken(existingToken.user_id, {
                token_type: 'refresh',
                purpose: 'login',
                ip_address: deviceInfo?.ip_address,
                user_agent: deviceInfo?.user_agent,
                device_fingerprint: deviceInfo?.device_fingerprint,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            });

            await db.commitTransaction(client);

            return {
                access_token: accessToken,
                refresh_token: newRefreshToken.token,
                expires_in: 900, // 15 minutes in seconds
                token_type: 'Bearer'
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error refreshing token', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Revoke all user tokens
     */
    async revokeAllUserTokens(userId, reason = 'logout') {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tokens 
                SET token_status = 'revoked',
                    revoked_at = NOW(),
                    revocation_reason = $1,
                    updated_at = NOW()
                WHERE user_id = $2 
                    AND token_status = 'active'
                    AND is_deleted = false
                RETURNING id, token_number, token_type
            `;

            const result = await client.query(query, [reason, userId]);

            await db.commitTransaction(client);

            return {
                revoked_count: result.rows.length,
                tokens: result.rows
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error revoking all user tokens', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Validate token
     */
    async validateToken(token) {
        try {
            const tokenHash = this.hashToken(token);

            // Check if blacklisted
            const blacklisted = await this.isTokenBlacklisted(tokenHash);
            if (blacklisted) {
                return { valid: false, reason: 'Token is blacklisted' };
            }

            // Find token in database
            const query = `
                SELECT 
                    t.*,
                    u.username,
                    u.email,
                    u.role_id
                FROM tokens t
                JOIN users u ON t.user_id = u.id
                WHERE t.token_hash = $1 
                    AND t.token_status = 'active'
                    AND t.is_deleted = false
            `;

            const result = await db.query(query, [tokenHash]);

            if (result.rows.length === 0) {
                return { valid: false, reason: 'Token not found' };
            }

            const tokenRecord = result.rows[0];

            // Check expiry
            if (this.isTokenExpired(tokenRecord.expires_at)) {
                await this.revokeToken(tokenRecord.id, tokenRecord.user_id, { reason: 'expired' });
                return { valid: false, reason: 'Token expired' };
            }

            // For one-time tokens (reset, verify), mark as used
            if (['reset', 'verify'].includes(tokenRecord.token_type) && !tokenRecord.used_at) {
                await db.query(`
                    UPDATE tokens 
                    SET used_at = NOW(),
                        token_status = 'used',
                        updated_at = NOW()
                    WHERE id = $1
                `, [tokenRecord.id]);
            }

            // Update last used
            await db.query(`
                UPDATE tokens 
                SET last_used_at = NOW(),
                    usage_count = usage_count + 1,
                    updated_at = NOW()
                WHERE id = $1
            `, [tokenRecord.id]);

            return {
                valid: true,
                token: {
                    id: tokenRecord.id,
                    type: tokenRecord.token_type,
                    user_id: tokenRecord.user_id,
                    username: tokenRecord.username,
                    email: tokenRecord.email,
                    role_id: tokenRecord.role_id,
                    issued_at: tokenRecord.issued_at,
                    expires_at: tokenRecord.expires_at
                }
            };
        } catch (error) {
            logger.error('Error validating token', { error: error.message });
            return { valid: false, reason: 'Validation error' };
        }
    },

    /**
     * Get token statistics
     */
    async getTokenStats(options = {}) {
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
                    COUNT(*) as total_tokens,
                    COUNT(*) FILTER (WHERE token_status = 'active') as active_tokens,
                    COUNT(*) FILTER (WHERE token_status = 'revoked') as revoked_tokens,
                    COUNT(*) FILTER (WHERE token_status = 'expired') as expired_tokens,
                    COUNT(*) FILTER (WHERE token_status = 'used') as used_tokens,
                    COUNT(*) FILTER (WHERE token_status = 'blacklisted') as blacklisted_tokens,
                    COUNT(*) FILTER (WHERE token_type = 'access') as access_tokens,
                    COUNT(*) FILTER (WHERE token_type = 'refresh') as refresh_tokens,
                    COUNT(*) FILTER (WHERE token_type = 'reset') as reset_tokens,
                    COUNT(*) FILTER (WHERE token_type = 'verify') as verify_tokens,
                    COUNT(*) FILTER (WHERE token_type = 'mfa') as mfa_tokens,
                    AVG(usage_count)::INTEGER as avg_usage
                FROM tokens
                WHERE is_deleted = false ${whereClause}
            `;

            const result = await db.query(query, values);

            // Daily token creation
            const dailyQuery = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as created,
                    COUNT(*) FILTER (WHERE token_type = 'access') as access_created,
                    COUNT(*) FILTER (WHERE token_type = 'refresh') as refresh_created
                FROM tokens
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `;
            const dailyResult = await db.query(dailyQuery);

            return {
                summary: result.rows[0],
                daily_creation: dailyResult.rows
            };
        } catch (error) {
            logger.error('Error getting token stats', { error: error.message });
            throw error;
        }
    }
};

module.exports = tokenService;