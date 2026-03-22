// backend/src/services/rateLimit/rateLimitService.js
/**
 * ======================================================================
 * FILE: backend/src/services/rateLimit/rateLimitService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Rate Limit Management service - Handles business logic for rate limit rules.
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
 * DATABASE TABLES:
 * - rate_limit_rules
 * - rate_limit_tracking
 * - rate_limit_exemptions
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const redis = require('redis');

// Redis client for rate limit tracking (optional)
let redisClient = null;
try {
    redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    redisClient.on('error', (err) => logger.warn('Redis error:', err));
} catch (error) {
    logger.warn('Redis not available, using in-memory tracking');
}

// In-memory fallback for rate limiting
const memoryStore = new Map();

const rateLimitService = {
    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Generate rule number
     */
    async generateRuleNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM rate_limit_rules
                WHERE rule_number LIKE $1
            `, [`RRL-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `RRL-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error generating rule number', { error: error.message });
            throw error;
        }
    },

    /**
     * Generate exemption number
     */
    async generateExemptionNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM rate_limit_exemptions
                WHERE exemption_number LIKE $1
            `, [`RLE-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `RLE-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error generating exemption number', { error: error.message });
            throw error;
        }
    },

    /**
     * Check if target is exempted
     */
    async isExempted(target, endpoint, method) {
        try {
            const query = `
                SELECT * FROM rate_limit_exemptions
                WHERE is_active = true
                    AND is_deleted = false
                    AND (expires_at IS NULL OR expires_at > NOW())
                    AND (
                        (user_id = $1 AND $2::text IS NOT NULL) OR
                        (role_id = $1 AND $2::text IS NOT NULL) OR
                        (api_key_id = $1 AND $2::text IS NOT NULL) OR
                        (ip_address = $1 AND $2::text IS NOT NULL) OR
                        (ip_range >>= $1::inet)
                    )
                    AND ($3::text IS NULL OR applies_to_endpoints IS NULL OR $3 = ANY(applies_to_endpoints))
                    AND ($4::text IS NULL OR applies_to_methods IS NULL OR $4 = ANY(applies_to_methods))
                LIMIT 1
            `;

            const result = await db.query(query, [target, target, endpoint, method]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error checking exemption', { error: error.message, target });
            return false;
        }
    },

    /**
     * Get applicable rule for request
     */
    async getApplicableRule(targetType, targetId, endpoint, method) {
        try {
            const query = `
                SELECT * FROM rate_limit_rules
                WHERE is_active = true
                    AND is_deleted = false
                    AND (valid_from IS NULL OR valid_from <= NOW())
                    AND (valid_to IS NULL OR valid_to >= NOW())
                    AND (
                        (rule_type = 'global') OR
                        (rule_type = 'user' AND $1::uuid IS NOT NULL AND $1 = ANY(applies_to_users)) OR
                        (rule_type = 'role' AND $2::uuid IS NOT NULL AND $2 = ANY(applies_to_roles)) OR
                        (rule_type = 'api_key' AND $3::uuid IS NOT NULL AND $3 = ANY(applies_to_api_keys)) OR
                        (rule_type = 'ip' AND $4::inet IS NOT NULL AND $4 = ANY(applies_to_ips)) OR
                        (rule_type = 'endpoint' AND endpoint_pattern IS NOT NULL AND $5::text ~ endpoint_pattern)
                    )
                    AND (http_methods IS NULL OR $6 = ANY(http_methods))
                    AND (exclude_endpoints IS NULL OR NOT ($5 = ANY(exclude_endpoints)))
                ORDER BY priority DESC, created_at ASC
                LIMIT 1
            `;

            const result = await db.query(query, [
                targetType === 'user' ? targetId : null,
                targetType === 'role' ? targetId : null,
                targetType === 'api_key' ? targetId : null,
                targetType === 'ip' ? targetId : null,
                endpoint,
                method
            ]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting applicable rule', { error: error.message });
            return null;
        }
    },

    /**
     * Check rate limit for request
     */
    async checkRateLimit(targetType, targetId, endpoint, method) {
        try {
            // Check exemptions first
            const exempted = await this.isExempted(targetId, endpoint, method);
            if (exempted) {
                return { allowed: true, exempted: true };
            }

            // Get applicable rule
            const rule = await this.getApplicableRule(targetType, targetId, endpoint, method);
            if (!rule) {
                return { allowed: true, rule: null };
            }

            const key = `${rule.id}:${targetType}:${targetId}:${endpoint}:${method}`;
            const windowSeconds = rule.window_seconds;
            const maxRequests = rule.max_requests;
            const burstMultiplier = rule.burst_multiplier || 1.0;
            const burstLimit = Math.floor(maxRequests * burstMultiplier);

            let currentCount;
            let windowStart;

            // Use Redis if available, otherwise memory store
            if (redisClient && redisClient.isOpen) {
                const data = await redisClient.get(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    currentCount = parsed.count;
                    windowStart = new Date(parsed.windowStart);
                } else {
                    currentCount = 0;
                    windowStart = new Date();
                }
            } else {
                const data = memoryStore.get(key);
                if (data && data.windowStart > Date.now() - windowSeconds * 1000) {
                    currentCount = data.count;
                    windowStart = new Date(data.windowStart);
                } else {
                    currentCount = 0;
                    windowStart = new Date();
                    memoryStore.delete(key);
                }
            }

            const allowed = currentCount < burstLimit;
            const remaining = Math.max(0, burstLimit - currentCount - 1);
            const resetTime = new Date(windowStart.getTime() + windowSeconds * 1000);

            // Log rate limit check
            if (!allowed) {
                await this.logRateLimitBreach(rule.id, targetType, targetId, endpoint, method, currentCount, burstLimit);
            }

            return {
                allowed,
                rule: {
                    id: rule.id,
                    name: rule.rule_name,
                    window_seconds: windowSeconds,
                    max_requests: maxRequests,
                    burst_limit: burstLimit,
                    action: rule.action,
                    penalty_duration: rule.penalty_duration
                },
                current: currentCount,
                limit: burstLimit,
                remaining,
                reset_at: resetTime.toISOString()
            };
        } catch (error) {
            logger.error('Error checking rate limit', { error: error.message });
            return { allowed: true }; // Allow on error
        }
    },

    /**
     * Increment rate limit counter
     */
    async incrementRateLimit(targetType, targetId, endpoint, method) {
        try {
            const rule = await this.getApplicableRule(targetType, targetId, endpoint, method);
            if (!rule) return;

            const key = `${rule.id}:${targetType}:${targetId}:${endpoint}:${method}`;
            const windowSeconds = rule.window_seconds;

            if (redisClient && redisClient.isOpen) {
                const now = Date.now();
                const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);

                await redisClient.multi()
                    .incr(key)
                    .expire(key, windowSeconds)
                    .exec();

                // Store window start
                await redisClient.set(`${key}:start`, windowStart, { EX: windowSeconds });
            } else {
                const now = Date.now();
                const existing = memoryStore.get(key);
                if (existing && existing.windowStart > now - windowSeconds * 1000) {
                    existing.count++;
                    memoryStore.set(key, existing);
                } else {
                    memoryStore.set(key, {
                        count: 1,
                        windowStart: now
                    });
                }
            }
        } catch (error) {
            logger.error('Error incrementing rate limit', { error: error.message });
        }
    },

    /**
     * Log rate limit breach
     */
    async logRateLimitBreach(ruleId, targetType, targetId, endpoint, method, currentCount, limit) {
        try {
            await db.query(`
                INSERT INTO rate_limit_breaches (
                    id, rule_id, target_type, target_id, endpoint, method,
                    current_count, limit_value, breached_at, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
                )
            `, [ruleId, targetType, targetId, endpoint, method, currentCount, limit]);

            logger.warn('Rate limit breached', {
                ruleId,
                targetType,
                targetId,
                endpoint,
                method,
                currentCount,
                limit
            });
        } catch (error) {
            logger.error('Error logging rate limit breach', { error: error.message });
        }
    },

    // ============================================
    // RULE MANAGEMENT
    // ============================================

    /**
     * List rate limit rules
     */
    async listRules(options = {}) {
        try {
            const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc', rule_type, is_active } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    rl.*,
                    COUNT(rlb.id) as breach_count
                FROM rate_limit_rules rl
                LEFT JOIN rate_limit_breaches rlb ON rl.id = rlb.rule_id
                WHERE rl.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (rule_type) {
                query += ` AND rl.rule_type = $${paramIndex}`;
                values.push(rule_type);
                paramIndex++;
            }

            if (is_active !== undefined) {
                query += ` AND rl.is_active = $${paramIndex}`;
                values.push(is_active);
                paramIndex++;
            }

            query += ` GROUP BY rl.id ORDER BY rl.${sort_by} ${sort_order === 'desc' ? 'DESC' : 'ASC'}
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM rate_limit_rules
                WHERE is_deleted = false
                ${rule_type ? 'AND rule_type = $1' : ''}
                ${is_active !== undefined ? 'AND is_active = $2' : ''}
            `;
            const countValues = [];
            if (rule_type) countValues.push(rule_type);
            if (is_active !== undefined) countValues.push(is_active);
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
            logger.error('Error listing rate limit rules', { error: error.message });
            throw error;
        }
    },

    /**
     * Get rule by ID
     */
    async getRuleById(ruleId) {
        try {
            const query = `
                SELECT rl.*,
                       COUNT(rlb.id) as breach_count
                FROM rate_limit_rules rl
                LEFT JOIN rate_limit_breaches rlb ON rl.id = rlb.rule_id
                WHERE rl.id = $1 AND rl.is_deleted = false
                GROUP BY rl.id
            `;
            const result = await db.query(query, [ruleId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting rate limit rule', { error: error.message, ruleId });
            throw error;
        }
    },

    /**
     * Create rate limit rule
     */
    async createRule(ruleData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const ruleNumber = await this.generateRuleNumber();

            const query = `
                INSERT INTO rate_limit_rules (
                    id, rule_number, rule_name, rule_description, rule_type,
                    applies_to_users, applies_to_roles, applies_to_api_keys,
                    applies_to_ips, applies_to_ip_ranges, endpoint_pattern,
                    http_methods, exclude_endpoints, window_seconds, max_requests,
                    burst_multiplier, action, penalty_duration, penalty_multiplier,
                    priority, is_active, valid_from, valid_to, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17, $18, $19,
                    $20, $21, $22, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                ruleNumber,
                ruleData.rule_name,
                ruleData.rule_description || null,
                ruleData.rule_type,
                ruleData.applies_to_users ? JSON.stringify(ruleData.applies_to_users) : null,
                ruleData.applies_to_roles ? JSON.stringify(ruleData.applies_to_roles) : null,
                ruleData.applies_to_api_keys ? JSON.stringify(ruleData.applies_to_api_keys) : null,
                ruleData.applies_to_ips ? JSON.stringify(ruleData.applies_to_ips) : null,
                ruleData.applies_to_ip_ranges ? JSON.stringify(ruleData.applies_to_ip_ranges) : null,
                ruleData.endpoint_pattern || null,
                ruleData.http_methods ? JSON.stringify(ruleData.http_methods) : null,
                ruleData.exclude_endpoints ? JSON.stringify(ruleData.exclude_endpoints) : null,
                ruleData.window_seconds,
                ruleData.max_requests,
                ruleData.burst_multiplier || 1.0,
                ruleData.action,
                ruleData.penalty_duration || null,
                ruleData.penalty_multiplier || 1.0,
                ruleData.priority || 0,
                ruleData.is_active !== undefined ? ruleData.is_active : true,
                ruleData.valid_from || null,
                ruleData.valid_to || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Rate limit rule created', {
                ruleId: result.rows[0].id,
                ruleName: ruleData.rule_name,
                ruleType: ruleData.rule_type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating rate limit rule', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update rate limit rule
     */
    async updateRule(ruleId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'rule_name', 'rule_description', 'applies_to_users', 'applies_to_roles',
                'applies_to_api_keys', 'applies_to_ips', 'applies_to_ip_ranges',
                'endpoint_pattern', 'http_methods', 'exclude_endpoints', 'window_seconds',
                'max_requests', 'burst_multiplier', 'action', 'penalty_duration',
                'penalty_multiplier', 'priority', 'is_active', 'valid_from', 'valid_to'
            ];

            const updates = [];
            const values = [];
            let paramIndex = 1;

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    let value = updateData[field];
                    if (['applies_to_users', 'applies_to_roles', 'applies_to_api_keys',
                          'applies_to_ips', 'applies_to_ip_ranges', 'http_methods',
                          'exclude_endpoints'].includes(field)) {
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
            values.push(ruleId);

            const query = `
                UPDATE rate_limit_rules 
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Rate limit rule not found');
            }

            await db.commitTransaction(client);

            logger.info('Rate limit rule updated', {
                ruleId,
                ruleName: result.rows[0].rule_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating rate limit rule', { error: error.message, ruleId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete rate limit rule
     */
    async deleteRule(ruleId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE rate_limit_rules 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING id, rule_name
            `;

            const result = await client.query(query, [ruleId]);

            if (result.rows.length === 0) {
                throw new Error('Rate limit rule not found');
            }

            await db.commitTransaction(client);

            logger.info('Rate limit rule deleted', {
                ruleId,
                ruleName: result.rows[0].rule_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting rate limit rule', { error: error.message, ruleId });
            throw error;
        } finally {
            client.release();
        }
    },

    // ============================================
    // EXEMPTION MANAGEMENT
    // ============================================

    /**
     * List exemptions
     */
    async listExemptions(options = {}) {
        try {
            const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc' } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT * FROM rate_limit_exemptions
                WHERE is_deleted = false
                ORDER BY ${sort_by} ${sort_order === 'desc' ? 'DESC' : 'ASC'}
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM rate_limit_exemptions
                WHERE is_deleted = false
            `;
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
            logger.error('Error listing exemptions', { error: error.message });
            throw error;
        }
    },

    /**
     * Get exemption by ID
     */
    async getExemptionById(exemptionId) {
        try {
            const query = `
                SELECT * FROM rate_limit_exemptions
                WHERE id = $1 AND is_deleted = false
            `;
            const result = await db.query(query, [exemptionId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting exemption', { error: error.message, exemptionId });
            throw error;
        }
    },

    /**
     * Create exemption
     */
    async createExemption(exemptionData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const exemptionNumber = await this.generateExemptionNumber();

            const query = `
                INSERT INTO rate_limit_exemptions (
                    id, exemption_number, exemption_name, exemption_description,
                    user_id, role_id, api_key_id, ip_address, ip_range,
                    applies_to_endpoints, applies_to_methods, reason,
                    expires_at, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                exemptionNumber,
                exemptionData.exemption_name,
                exemptionData.exemption_description || null,
                exemptionData.user_id || null,
                exemptionData.role_id || null,
                exemptionData.api_key_id || null,
                exemptionData.ip_address || null,
                exemptionData.ip_range || null,
                exemptionData.applies_to_endpoints ? JSON.stringify(exemptionData.applies_to_endpoints) : null,
                exemptionData.applies_to_methods ? JSON.stringify(exemptionData.applies_to_methods) : null,
                exemptionData.reason,
                exemptionData.expires_at || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Rate limit exemption created', {
                exemptionId: result.rows[0].id,
                exemptionName: exemptionData.exemption_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating exemption', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete exemption
     */
    async deleteExemption(exemptionId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE rate_limit_exemptions 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING id, exemption_name
            `;

            const result = await client.query(query, [exemptionId]);

            if (result.rows.length === 0) {
                throw new Error('Exemption not found');
            }

            await db.commitTransaction(client);

            logger.info('Rate limit exemption deleted', {
                exemptionId,
                exemptionName: result.rows[0].exemption_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting exemption', { error: error.message, exemptionId });
            throw error;
        } finally {
            client.release();
        }
    },

    // ============================================
    // STATISTICS
    // ============================================

    /**
     * Get rate limit statistics
     */
    async getRateLimitStats(options = {}) {
        try {
            const { from_date, to_date } = options;

            let whereClause = '';
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                whereClause += ` AND breached_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                whereClause += ` AND breached_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            const query = `
                SELECT 
                    COUNT(*) as total_breaches,
                    COUNT(DISTINCT rule_id) as rules_triggered,
                    COUNT(DISTINCT target_id) as unique_targets,
                    COUNT(DISTINCT endpoint) as endpoints_affected,
                    AVG(current_count)::INTEGER as avg_violation,
                    MAX(current_count) as max_violation
                FROM rate_limit_breaches
                WHERE 1=1 ${whereClause}
            `;

            const result = await db.query(query, values);

            const topRulesQuery = `
                SELECT 
                    rl.rule_name,
                    rl.rule_type,
                    COUNT(rlb.id) as breach_count
                FROM rate_limit_breaches rlb
                JOIN rate_limit_rules rl ON rlb.rule_id = rl.id
                WHERE 1=1 ${whereClause}
                GROUP BY rl.id, rl.rule_name, rl.rule_type
                ORDER BY breach_count DESC
                LIMIT 10
            `;

            const topRules = await db.query(topRulesQuery, values);

            const dailyQuery = `
                SELECT 
                    DATE(breached_at) as date,
                    COUNT(*) as breaches
                FROM rate_limit_breaches
                WHERE breached_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(breached_at)
                ORDER BY date DESC
            `;

            const daily = await db.query(dailyQuery);

            return {
                summary: result.rows[0],
                top_rules: topRules.rows,
                daily_breaches: daily.rows
            };
        } catch (error) {
            logger.error('Error getting rate limit stats', { error: error.message });
            throw error;
        }
    },

    /**
     * Get rate limit breaches
     */
    async getRateLimitBreaches(options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT rlb.*, rl.rule_name, rl.rule_type
                FROM rate_limit_breaches rlb
                JOIN rate_limit_rules rl ON rlb.rule_id = rl.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                query += ` AND rlb.breached_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND rlb.breached_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY rlb.breached_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM rate_limit_breaches
                WHERE 1=1
                ${from_date ? 'AND breached_at >= $1' : ''}
                ${to_date ? 'AND breached_at <= $2' : ''}
            `;
            const countValues = [];
            if (from_date) countValues.push(from_date);
            if (to_date) countValues.push(to_date);
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
            logger.error('Error getting rate limit breaches', { error: error.message });
            throw error;
        }
    }
};

module.exports = rateLimitService;