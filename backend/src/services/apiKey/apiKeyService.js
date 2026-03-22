// backend/src/services/apiKey/apiKeyService.js
/**
 * ======================================================================
 * FILE: backend/src/services/apiKey/apiKeyService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * API Key Management service - Handles business logic for API key operations.
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
 * DATABASE TABLES:
 * - api_keys (main table)
 * - api_keys_log (usage logs)
 * - api_keys_rate_limit (rate limit tracking)
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const apiKeyService = {
    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Generate a new API key
     * Format: [prefix]_[random_string]
     */
    generateApiKey(prefix = 'key') {
        const randomBytes = crypto.randomBytes(32);
        const randomString = randomBytes.toString('hex');
        const timestamp = Date.now().toString(36);
        return `${prefix}_${randomString.substring(0, 24)}${timestamp.substring(0, 6)}`;
    },

    /**
     * Hash API key for storage
     */
    hashApiKey(apiKey) {
        return bcrypt.hashSync(apiKey, 10);
    },

    /**
     * Get last 4 characters for display
     */
    getKeyLastFour(apiKey) {
        return apiKey.slice(-4);
    },

    /**
     * Generate unique key number
     */
    async generateKeyNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM api_keys
                WHERE key_number LIKE $1
            `, [`KEY-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `KEY-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error generating key number', { error: error.message });
            throw error;
        }
    },

    /**
     * Determine key prefix based on type
     */
    getKeyPrefix(keyType) {
        const prefixes = {
            live: 'sk_live',
            test: 'sk_test',
            client: 'pk_',
            internal: 'int_',
            temporary: 'tmp_',
            integration: 'intg_'
        };
        return prefixes[keyType] || 'key_';
    },

    /**
     * Check if key is expired
     */
    isKeyExpired(expiresAt) {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    },

    // ============================================
    // LIST & RETRIEVAL
    // ============================================

    /**
     * List all API keys with pagination
     */
    async listApiKeys(userId, options = {}) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                sort_by = 'created_at', 
                sort_order = 'desc',
                status,
                key_type,
                user_id
            } = options;
            
            const offset = (page - 1) * limit;
            const targetUserId = user_id || userId;

            let query = `
                SELECT 
                    ak.id,
                    ak.key_number,
                    ak.key_name,
                    ak.key_description,
                    ak.key_type,
                    ak.key_prefix,
                    ak.key_last_four,
                    ak.status,
                    ak.permission_scope,
                    ak.rate_limit,
                    ak.rate_limit_window,
                    ak.burst_multiplier,
                    ak.issued_at,
                    ak.expires_at,
                    ak.last_used,
                    ak.usage_count,
                    ak.is_active,
                    ak.created_at,
                    ak.user_id,
                    u.username,
                    u.email
                FROM api_keys ak
                LEFT JOIN users u ON ak.user_id = u.id
                WHERE ak.is_deleted = false
            `;
            
            const values = [];
            let paramIndex = 1;

            if (targetUserId) {
                query += ` AND ak.user_id = $${paramIndex}`;
                values.push(targetUserId);
                paramIndex++;
            }

            if (status) {
                query += ` AND ak.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (key_type) {
                query += ` AND ak.key_type = $${paramIndex}`;
                values.push(key_type);
                paramIndex++;
            }

            const orderBy = sort_order === 'desc' ? 'DESC' : 'ASC';
            query += ` ORDER BY ak.${sort_by} ${orderBy}
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get total count
            let countQuery = `
                SELECT COUNT(*) as total
                FROM api_keys
                WHERE is_deleted = false
            `;
            const countValues = [];
            let countIndex = 1;

            if (targetUserId) {
                countQuery += ` AND user_id = $${countIndex}`;
                countValues.push(targetUserId);
                countIndex++;
            }

            if (status) {
                countQuery += ` AND status = $${countIndex}`;
                countValues.push(status);
                countIndex++;
            }

            if (key_type) {
                countQuery += ` AND key_type = $${countIndex}`;
                countValues.push(key_type);
            }

            const countResult = await db.query(countQuery, countValues);

            // Get summary stats
            const statsQuery = `
                SELECT 
                    COUNT(*) as total_keys,
                    COUNT(*) FILTER (WHERE status = 'active') as active_keys,
                    COUNT(*) FILTER (WHERE status = 'expired') as expired_keys,
                    COUNT(*) FILTER (WHERE status = 'revoked') as revoked_keys,
                    COUNT(*) FILTER (WHERE key_type = 'live') as live_keys,
                    COUNT(*) FILTER (WHERE key_type = 'test') as test_keys,
                    SUM(usage_count) as total_usage
                FROM api_keys
                WHERE is_deleted = false
                ${targetUserId ? 'AND user_id = $1' : ''}
            `;
            const statsValues = targetUserId ? [targetUserId] : [];
            const statsResult = await db.query(statsQuery, statsValues);

            return {
                data: result.rows,
                summary: statsResult.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0]?.total || 0),
                    pages: Math.ceil(parseInt(countResult.rows[0]?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error listing API keys', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get API key by ID
     */
    async getApiKeyById(apiKeyId, userId = null) {
        try {
            let query = `
                SELECT 
                    ak.*,
                    u.username,
                    u.email,
                    r.role_name as role_name
                FROM api_keys ak
                LEFT JOIN users u ON ak.user_id = u.id
                LEFT JOIN roles r ON ak.role_id = r.id
                WHERE ak.id = $1 AND ak.is_deleted = false
            `;
            const values = [apiKeyId];

            const result = await db.query(query, values);
            
            if (result.rows.length === 0) {
                return null;
            }

            const key = result.rows[0];
            
            // Check if user has access
            if (userId && key.user_id !== userId) {
                return null;
            }

            // Add expiry status
            key.is_expired = this.isKeyExpired(key.expires_at);
            
            return key;
        } catch (error) {
            logger.error('Error getting API key by ID', { error: error.message, apiKeyId });
            throw error;
        }
    },

    /**
     * Get API key logs
     */
    async getApiKeyLogs(options = {}) {
        try {
            const { 
                page = 1, 
                limit = 50, 
                api_key_id,
                user_id,
                from_date,
                to_date
            } = options;
            
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    l.*,
                    ak.key_name,
                    ak.key_type,
                    u.username
                FROM api_keys_log l
                LEFT JOIN api_keys ak ON l.api_key_id = ak.id
                LEFT JOIN users u ON l.user_id = u.id
                WHERE 1=1
            `;
            
            const values = [];
            let paramIndex = 1;

            if (api_key_id) {
                query += ` AND l.api_key_id = $${paramIndex}`;
                values.push(api_key_id);
                paramIndex++;
            }

            if (user_id) {
                query += ` AND l.user_id = $${paramIndex}`;
                values.push(user_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND l.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND l.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY l.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get total count
            let countQuery = `SELECT COUNT(*) as total FROM api_keys_log WHERE 1=1`;
            const countValues = [];
            let countIndex = 1;

            if (api_key_id) {
                countQuery += ` AND api_key_id = $${countIndex}`;
                countValues.push(api_key_id);
                countIndex++;
            }

            if (user_id) {
                countQuery += ` AND user_id = $${countIndex}`;
                countValues.push(user_id);
                countIndex++;
            }

            if (from_date) {
                countQuery += ` AND created_at >= $${countIndex}`;
                countValues.push(from_date);
                countIndex++;
            }

            if (to_date) {
                countQuery += ` AND created_at <= $${countIndex}`;
                countValues.push(to_date);
            }

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
            logger.error('Error getting API key logs', { error: error.message });
            throw error;
        }
    },

    /**
     * Get API key statistics
     */
    async getApiKeyStats(userId = null) {
        try {
            const whereClause = userId ? 'WHERE ak.user_id = $1 AND ak.is_deleted = false' : 'WHERE ak.is_deleted = false';
            const values = userId ? [userId] : [];

            const query = `
                SELECT 
                    COUNT(*) as total_keys,
                    COUNT(*) FILTER (WHERE ak.status = 'active') as active_keys,
                    COUNT(*) FILTER (WHERE ak.status = 'expired') as expired_keys,
                    COUNT(*) FILTER (WHERE ak.status = 'revoked') as revoked_keys,
                    COUNT(*) FILTER (WHERE ak.status = 'suspended') as suspended_keys,
                    COUNT(*) FILTER (WHERE ak.key_type = 'live') as live_keys,
                    COUNT(*) FILTER (WHERE ak.key_type = 'test') as test_keys,
                    COUNT(*) FILTER (WHERE ak.key_type = 'client') as client_keys,
                    COUNT(*) FILTER (WHERE ak.key_type = 'internal') as internal_keys,
                    SUM(ak.usage_count) as total_usage,
                    AVG(ak.usage_count) as avg_usage,
                    MAX(ak.last_used) as last_used_at,
                    COUNT(*) FILTER (WHERE ak.expires_at IS NOT NULL AND ak.expires_at < NOW()) as expired_count,
                    COUNT(*) FILTER (WHERE ak.expires_at IS NOT NULL AND ak.expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_soon
                FROM api_keys ak
                ${whereClause}
            `;

            const result = await db.query(query, values);
            
            // Get daily usage for last 30 days
            const dailyQuery = `
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as request_count,
                    COUNT(*) FILTER (WHERE auth_successful = true) as successful,
                    COUNT(*) FILTER (WHERE auth_successful = false) as failed,
                    AVG(response_time_ms)::INTEGER as avg_response_time
                FROM api_keys_log
                ${userId ? 'WHERE user_id = $1' : ''}
                AND created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `;
            const dailyValues = userId ? [userId] : [];
            const dailyResult = await db.query(dailyQuery, dailyValues);

            return {
                summary: result.rows[0],
                daily_usage: dailyResult.rows
            };
        } catch (error) {
            logger.error('Error getting API key stats', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get available permissions
     */
    async getAvailablePermissions() {
        try {
            const query = `
                SELECT 
                    p.id,
                    p.permission_name,
                    p.permission_category,
                    p.resource_type,
                    p.action_type,
                    p.description
                FROM permissions p
                WHERE p.is_deleted = false
                ORDER BY p.permission_category, p.permission_name
            `;

            const result = await db.query(query);
            
            // Group by category
            const grouped = {};
            result.rows.forEach(perm => {
                if (!grouped[perm.permission_category]) {
                    grouped[perm.permission_category] = [];
                }
                grouped[perm.permission_category].push(perm);
            });

            return {
                total: result.rows.length,
                permissions: result.rows,
                grouped
            };
        } catch (error) {
            logger.error('Error getting available permissions', { error: error.message });
            throw error;
        }
    },

    /**
     * Get usage details for specific API key
     */
    async getApiKeyUsage(apiKeyId, options = {}) {
        try {
            const { from_date, to_date, limit = 100 } = options;

            let query = `
                SELECT 
                    l.*,
                    u.username
                FROM api_keys_log l
                LEFT JOIN users u ON l.user_id = u.id
                WHERE l.api_key_id = $1
            `;
            const values = [apiKeyId];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND l.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND l.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex}`;
            values.push(limit);

            const result = await db.query(query, values);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(*) FILTER (WHERE auth_successful = true) as successful,
                    COUNT(*) FILTER (WHERE auth_successful = false) as failed,
                    AVG(response_time_ms)::INTEGER as avg_response_time,
                    MIN(created_at) as first_used,
                    MAX(created_at) as last_used,
                    COUNT(DISTINCT DATE(created_at)) as active_days
                FROM api_keys_log
                WHERE api_key_id = $1
                ${from_date ? 'AND created_at >= $2' : ''}
                ${to_date ? 'AND created_at <= $3' : ''}
            `;
            const summaryValues = [apiKeyId];
            if (from_date) summaryValues.push(from_date);
            if (to_date) summaryValues.push(to_date);
            const summaryResult = await db.query(summaryQuery, summaryValues);

            // Get endpoint breakdown
            const endpointQuery = `
                SELECT 
                    endpoint,
                    method,
                    COUNT(*) as request_count,
                    AVG(response_time_ms)::INTEGER as avg_response_time,
                    COUNT(*) FILTER (WHERE response_status >= 400) as error_count
                FROM api_keys_log
                WHERE api_key_id = $1
                ${from_date ? 'AND created_at >= $2' : ''}
                ${to_date ? 'AND created_at <= $3' : ''}
                GROUP BY endpoint, method
                ORDER BY request_count DESC
                LIMIT 10
            `;
            const endpointValues = [apiKeyId];
            if (from_date) endpointValues.push(from_date);
            if (to_date) endpointValues.push(to_date);
            const endpointResult = await db.query(endpointQuery, endpointValues);

            return {
                logs: result.rows,
                summary: summaryResult.rows[0],
                top_endpoints: endpointResult.rows
            };
        } catch (error) {
            logger.error('Error getting API key usage', { error: error.message, apiKeyId });
            throw error;
        }
    },

    // ============================================
    // CREATE & UPDATE
    // ============================================

    /**
     * Create new API key
     */
    async createApiKey(userId, keyData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate key number
            const keyNumber = await this.generateKeyNumber();

            // Determine key prefix
            const keyType = keyData.key_type || 'live';
            const keyPrefix = this.getKeyPrefix(keyType);

            // Generate actual API key
            const rawApiKey = this.generateApiKey(keyPrefix);
            const keyHash = this.hashApiKey(rawApiKey);
            const keyLastFour = this.getKeyLastFour(rawApiKey);

            // Set defaults
            const rateLimit = keyData.rate_limit || 100;
            const rateLimitWindow = keyData.rate_limit_window || 60;
            const burstMultiplier = keyData.burst_multiplier || 1.5;
            const permissionScope = keyData.permission_scope || 'restricted';

            const query = `
                INSERT INTO api_keys (
                    id, key_number, user_id, key_name, key_description,
                    key_type, key_prefix, key_hash, key_last_four,
                    permission_scope, permissions, role_id,
                    rate_limit, rate_limit_window, burst_multiplier,
                    expires_at, allowed_ips, allowed_domains, allowed_origins,
                    allowed_days, allowed_hours_start, allowed_hours_end,
                    requires_mfa, metadata, notes,
                    status, issued_at, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7, $8,
                    $9, $10, $11,
                    $12, $13, $14,
                    $15, $16, $17, $18,
                    $19, $20, $21,
                    $22, $23, $24,
                    'active', NOW(), NOW(), NOW()
                ) RETURNING id, key_number, key_name, key_type, key_prefix, key_last_four
            `;

            const values = [
                keyNumber,
                userId,
                keyData.key_name,
                keyData.key_description || null,
                keyType,
                keyPrefix,
                keyHash,
                keyLastFour,
                permissionScope,
                JSON.stringify(keyData.permissions || []),
                keyData.role_id || null,
                rateLimit,
                rateLimitWindow,
                burstMultiplier,
                keyData.expires_at || null,
                keyData.allowed_ips ? JSON.stringify(keyData.allowed_ips) : null,
                keyData.allowed_domains ? JSON.stringify(keyData.allowed_domains) : null,
                keyData.allowed_origins ? JSON.stringify(keyData.allowed_origins) : null,
                keyData.allowed_days ? JSON.stringify(keyData.allowed_days) : null,
                keyData.allowed_hours_start || null,
                keyData.allowed_hours_end || null,
                keyData.requires_mfa || false,
                keyData.metadata ? JSON.stringify(keyData.metadata) : '{}',
                keyData.notes || null
            ];

            const result = await client.query(query, values);

            // Log key creation
            await client.query(`
                INSERT INTO api_keys_log (
                    id, api_key_id, user_id, endpoint, method,
                    auth_successful, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'KEY_CREATE', 'POST',
                    true, NOW()
                )
            `, [result.rows[0].id, userId]);

            await db.commitTransaction(client);

            return {
                ...result.rows[0],
                api_key: rawApiKey,
                message: 'Save this API key securely. It will not be shown again.'
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating API key', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update API key
     */
    async updateApiKey(apiKeyId, userId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if key exists
            const existing = await this.getApiKeyById(apiKeyId);
            if (!existing) {
                throw new Error('API key not found');
            }

            const allowedFields = [
                'key_name', 'key_description', 'permission_scope', 'permissions',
                'role_id', 'rate_limit', 'rate_limit_window', 'burst_multiplier',
                'expires_at', 'allowed_ips', 'allowed_domains', 'allowed_origins',
                'allowed_days', 'allowed_hours_start', 'allowed_hours_end',
                'requires_mfa', 'metadata', 'notes'
            ];

            const updates = [];
            const values = [];
            let paramIndex = 1;

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    let value = updateData[field];
                    if (['permissions', 'allowed_ips', 'allowed_domains', 'allowed_origins', 'allowed_days', 'metadata'].includes(field)) {
                        value = JSON.stringify(value);
                    }
                    updates.push(`${field} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (updates.length === 0) {
                throw new Error('No fields to update');
            }

            updates.push(`updated_at = NOW()`);
            values.push(apiKeyId);

            const query = `
                UPDATE api_keys 
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING id, key_name, key_type, status, permission_scope
            `;

            const result = await client.query(query, values);

            // Log update
            await client.query(`
                INSERT INTO api_keys_log (
                    id, api_key_id, user_id, endpoint, method,
                    auth_successful, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'KEY_UPDATE', 'PUT',
                    true, NOW()
                )
            `, [apiKeyId, userId]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating API key', { error: error.message, apiKeyId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete API key (soft delete)
     */
    async deleteApiKey(apiKeyId, userId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE api_keys 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    status = 'revoked',
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id, key_name
            `;

            const result = await client.query(query, [userId, apiKeyId]);

            if (result.rows.length === 0) {
                throw new Error('API key not found');
            }

            // Log deletion
            await client.query(`
                INSERT INTO api_keys_log (
                    id, api_key_id, user_id, endpoint, method,
                    auth_successful, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'KEY_DELETE', 'DELETE',
                    true, NOW()
                )
            `, [apiKeyId, userId]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting API key', { error: error.message, apiKeyId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    // ============================================
    // OPERATIONS
    // ============================================

    /**
     * Revoke API key
     */
    async revokeApiKey(apiKeyId, userId, revokeData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE api_keys 
                SET status = 'revoked',
                    revoked_at = NOW(),
                    revoked_by = $1,
                    revocation_reason = $2,
                    updated_at = NOW()
                WHERE id = $3 
                    AND status = 'active'
                    AND is_deleted = false
                RETURNING id, key_name, key_type
            `;

            const result = await client.query(query, [userId, revokeData.reason, apiKeyId]);

            if (result.rows.length === 0) {
                throw new Error('API key not found or already revoked');
            }

            // Log revocation
            await client.query(`
                INSERT INTO api_keys_log (
                    id, api_key_id, user_id, endpoint, method,
                    auth_successful, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'KEY_REVOKE', 'POST',
                    true, NOW()
                )
            `, [apiKeyId, userId]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error revoking API key', { error: error.message, apiKeyId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Rotate API key (generate new, keep old for grace period)
     */
    async rotateApiKey(apiKeyId, userId, rotateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get existing key
            const existing = await this.getApiKeyById(apiKeyId);
            if (!existing) {
                throw new Error('API key not found');
            }

            if (existing.status !== 'active') {
                throw new Error('Only active keys can be rotated');
            }

            // Generate new key
            const keyPrefix = this.getKeyPrefix(existing.key_type);
            const rawApiKey = this.generateApiKey(keyPrefix);
            const keyHash = this.hashApiKey(rawApiKey);
            const keyLastFour = this.getKeyLastFour(rawApiKey);

            // Generate new key number
            const keyNumber = await this.generateKeyNumber();

            // Create new key (copy settings from old)
            const insertQuery = `
                INSERT INTO api_keys (
                    id, key_number, user_id, key_name, key_description,
                    key_type, key_prefix, key_hash, key_last_four,
                    permission_scope, permissions, role_id,
                    rate_limit, rate_limit_window, burst_multiplier,
                    expires_at, allowed_ips, allowed_domains, allowed_origins,
                    allowed_days, allowed_hours_start, allowed_hours_end,
                    requires_mfa, metadata, notes,
                    rotated_from_id, status, issued_at, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7, $8,
                    $9, $10, $11,
                    $12, $13, $14,
                    $15, $16, $17, $18,
                    $19, $20, $21,
                    $22, $23, $24,
                    $25, 'active', NOW(), NOW(), NOW()
                ) RETURNING id, key_number, key_name, key_last_four
            `;

            const values = [
                keyNumber,
                existing.user_id,
                `${existing.key_name} (Rotated)`,
                existing.key_description,
                existing.key_type,
                keyPrefix,
                keyHash,
                keyLastFour,
                existing.permission_scope,
                existing.permissions,
                existing.role_id,
                existing.rate_limit,
                existing.rate_limit_window,
                existing.burst_multiplier,
                existing.expires_at,
                existing.allowed_ips,
                existing.allowed_domains,
                existing.allowed_origins,
                existing.allowed_days,
                existing.allowed_hours_start,
                existing.allowed_hours_end,
                existing.requires_mfa,
                existing.metadata,
                existing.notes,
                apiKeyId
            ];

            const insertResult = await client.query(insertQuery, values);
            const newKeyId = insertResult.rows[0].id;

            // Update old key (mark as rotated)
            await client.query(`
                UPDATE api_keys 
                SET status = 'revoked',
                    rotated_to_id = $1,
                    rotation_reason = $2,
                    rotation_grace_until = NOW() + ($3 || ' days')::INTERVAL,
                    updated_at = NOW()
                WHERE id = $4
            `, [newKeyId, rotateData.reason, rotateData.grace_period_days || 7, apiKeyId]);

            // Log rotation
            await client.query(`
                INSERT INTO api_keys_log (
                    id, api_key_id, user_id, endpoint, method,
                    auth_successful, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'KEY_ROTATE', 'POST',
                    true, NOW()
                )
            `, [newKeyId, userId]);

            await db.commitTransaction(client);

            return {
                old_key_id: apiKeyId,
                new_key: insertResult.rows[0],
                api_key: rawApiKey,
                message: `Old key will remain active for ${rotateData.grace_period_days || 7} days. Save the new key securely.`
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error rotating API key', { error: error.message, apiKeyId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Validate API key (public endpoint)
     */
    async validateApiKey(apiKey) {
        try {
            // Extract prefix to determine key type
            const prefix = apiKey.split('_')[0];
            
            const query = `
                SELECT 
                    ak.*,
                    u.username,
                    u.email,
                    u.role_id,
                    r.role_name
                FROM api_keys ak
                LEFT JOIN users u ON ak.user_id = u.id
                LEFT JOIN roles r ON ak.role_id = r.id
                WHERE ak.key_hash = $1 
                    AND ak.is_deleted = false
            `;

            // Hash the provided key to compare
            const hash = bcrypt.hashSync(apiKey, 10);
            const result = await db.query(query, [hash]);

            if (result.rows.length === 0) {
                return { valid: false, reason: 'Invalid API key' };
            }

            const key = result.rows[0];

            // Check status
            if (key.status !== 'active') {
                return { valid: false, reason: `Key is ${key.status}` };
            }

            // Check expiry
            if (this.isKeyExpired(key.expires_at)) {
                await this.revokeApiKey(key.id, null, { reason: 'expired' });
                return { valid: false, reason: 'Key has expired' };
            }

            // Update last used
            await db.query(`
                UPDATE api_keys 
                SET last_used = NOW(),
                    usage_count = usage_count + 1
                WHERE id = $1
            `, [key.id]);

            // Log validation
            await db.query(`
                INSERT INTO api_keys_log (
                    id, api_key_id, user_id, endpoint, method,
                    auth_successful, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'KEY_VALIDATE', 'POST',
                    true, NOW()
                )
            `, [key.id, key.user_id]);

            return {
                valid: true,
                key: {
                    id: key.id,
                    name: key.key_name,
                    type: key.key_type,
                    scope: key.permission_scope,
                    permissions: key.permissions,
                    user_id: key.user_id,
                    username: key.username,
                    role: key.role_name,
                    rate_limit: key.rate_limit,
                    rate_limit_window: key.rate_limit_window
                }
            };
        } catch (error) {
            logger.error('Error validating API key', { error: error.message });
            throw error;
        }
    },

    /**
     * Check rate limit for API key
     */
    async checkRateLimit(apiKeyId, endpoint, method) {
        try {
            // Get key details
            const key = await this.getApiKeyById(apiKeyId);
            if (!key) return { allowed: false, reason: 'Invalid key' };

            const windowSeconds = key.rate_limit_window || 60;
            const maxRequests = key.rate_limit || 100;

            // Get current window
            const windowStart = new Date(Date.now() - (windowSeconds * 1000));

            const query = `
                SELECT COUNT(*) as request_count
                FROM api_keys_log
                WHERE api_key_id = $1
                    AND created_at >= $2
                    AND endpoint = $3
                    AND method = $4
            `;

            const result = await db.query(query, [apiKeyId, windowStart, endpoint, method]);
            const currentCount = parseInt(result.rows[0].request_count);

            if (currentCount >= maxRequests) {
                // Log rate limit breach
                await db.query(`
                    INSERT INTO api_keys_log (
                        id, api_key_id, endpoint, method,
                        rate_limit_exceeded, auth_successful, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3,
                        true, true, NOW()
                    )
                `, [apiKeyId, endpoint, method]);

                return { 
                    allowed: false, 
                    reason: 'Rate limit exceeded',
                    limit: maxRequests,
                    window: windowSeconds,
                    remaining: 0,
                    reset: new Date(Date.now() + (windowSeconds * 1000))
                };
            }

            return {
                allowed: true,
                limit: maxRequests,
                remaining: maxRequests - currentCount - 1,
                window: windowSeconds,
                reset: new Date(Date.now() + (windowSeconds * 1000))
            };
        } catch (error) {
            logger.error('Error checking rate limit', { error: error.message, apiKeyId });
            return { allowed: true }; // Allow on error
        }
    },

    /**
     * Log API key usage
     */
    async logApiKeyUsage(apiKeyId, userId, logData) {
        try {
            const query = `
                INSERT INTO api_keys_log (
                    id, api_key_id, user_id, endpoint, method,
                    request_headers, request_body, request_size_bytes,
                    response_status, response_body_size_bytes, response_time_ms,
                    auth_successful, ip_address, user_agent, referer, origin,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, NOW()
                )
            `;

            const values = [
                apiKeyId,
                userId,
                logData.endpoint,
                logData.method,
                logData.request_headers ? JSON.stringify(logData.request_headers) : null,
                logData.request_body ? JSON.stringify(logData.request_body) : null,
                logData.request_size_bytes || null,
                logData.response_status || null,
                logData.response_body_size_bytes || null,
                logData.response_time_ms || null,
                logData.auth_successful !== false,
                logData.ip_address || null,
                logData.user_agent || null,
                logData.referer || null,
                logData.origin || null
            ];

            await db.query(query, values);
        } catch (error) {
            logger.error('Error logging API key usage', { error: error.message, apiKeyId });
            // Don't throw, just log the error
        }
    }
};

module.exports = apiKeyService;