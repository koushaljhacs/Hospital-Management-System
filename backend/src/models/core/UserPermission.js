/**
 * ======================================================================
 * FILE: backend/src/models/core/UserPermission.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * UserPermission model for database operations.
 * Handles direct user-permission assignment queries for RBAC.
 * Allows overriding role-based permissions at user level.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: user_permissions
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users)
 * - permission_id: UUID (foreign key to permissions)
 * - grant_type: enum (allow, deny)
 * - conditions: JSONB (dynamic conditions for permission)
 * - granted_by: UUID (foreign key to users)
 * - granted_at: timestamp
 * - expires_at: timestamp
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

const UserPermission = {
    /**
     * Table name
     */
    tableName: 'user_permissions',

    /**
     * Find user-permission assignment by ID
     * @param {string} id - UserPermission UUID
     * @returns {Promise<Object|null>} UserPermission object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    up.id, up.user_id, up.permission_id,
                    up.grant_type, up.conditions,
                    up.granted_by, up.granted_at, up.expires_at,
                    up.created_at, up.updated_at,
                    u.username as user_username,
                    u.email as user_email,
                    p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    granter.username as granted_by_username
                FROM user_permissions up
                JOIN users u ON up.user_id = u.id
                JOIN permissions p ON up.permission_id = p.id
                LEFT JOIN users granter ON up.granted_by = granter.id
                WHERE up.id = $1 AND up.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('UserPermission found by ID', { userPermissionId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding user-permission by ID', {
                error: error.message,
                userPermissionId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find active user-permission assignments by user ID
     * @param {string} userId - User UUID
     * @returns {Promise<Array>} List of user-permission assignments
     */
    async findByUserId(userId) {
        try {
            const query = `
                SELECT 
                    up.id, up.user_id, up.permission_id,
                    up.grant_type, up.conditions,
                    up.granted_by, up.granted_at, up.expires_at,
                    p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    p.description
                FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = $1 
                    AND up.is_deleted = false
                    AND (up.expires_at IS NULL OR up.expires_at > NOW())
                ORDER BY p.permission_category ASC, p.permission_name ASC
            `;

            const result = await db.query(query, [userId]);

            logger.debug('UserPermission assignments found by user ID', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding user-permissions by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find active user-permission assignments by permission ID
     * @param {string} permissionId - Permission UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of user-permission assignments
     */
    async findByPermissionId(permissionId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    up.id, up.user_id, up.permission_id,
                    up.grant_type, up.conditions,
                    up.granted_by, up.granted_at, up.expires_at,
                    u.username, u.email, u.role as user_role
                FROM user_permissions up
                JOIN users u ON up.user_id = u.id
                WHERE up.permission_id = $1 
                    AND up.is_deleted = false
                    AND (up.expires_at IS NULL OR up.expires_at > NOW())
                ORDER BY up.granted_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [permissionId, limit, offset]);

            logger.debug('UserPermission assignments found by permission ID', {
                permissionId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding user-permissions by permission ID', {
                error: error.message,
                permissionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Grant permission to user
     * @param {Object} grantData - Grant data
     * @param {string} grantData.user_id - User ID
     * @param {string} grantData.permission_id - Permission ID
     * @param {string} [grantData.grant_type] - Grant type (allow/deny)
     * @param {Object} [grantData.conditions] - Dynamic conditions
     * @param {string} [grantData.granted_by] - User who granted
     * @param {string} [grantData.expires_at] - Expiration timestamp
     * @returns {Promise<Object>} Created assignment
     */
    async grant(grantData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existing = await this.getActiveGrant(
                grantData.user_id,
                grantData.permission_id
            );

            if (existing) {
                throw new Error('User already has this permission assigned');
            }

            const query = `
                INSERT INTO user_permissions (
                    id, user_id, permission_id, grant_type,
                    conditions, granted_by, granted_at, expires_at,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), $6, NOW(), NOW()
                )
                RETURNING 
                    id, user_id, permission_id, grant_type,
                    conditions, granted_by, granted_at, expires_at
            `;

            const values = [
                grantData.user_id,
                grantData.permission_id,
                grantData.grant_type || 'allow',
                grantData.conditions || null,
                grantData.granted_by || null,
                grantData.expires_at || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Permission granted to user', {
                userId: grantData.user_id,
                permissionId: grantData.permission_id,
                grantType: grantData.grant_type,
                grantedBy: grantData.granted_by
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error granting permission to user', {
                error: error.message,
                userId: grantData.user_id,
                permissionId: grantData.permission_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Revoke permission from user (soft delete)
     * @param {string} userId - User ID
     * @param {string} permissionId - Permission ID
     * @param {string} revokedBy - User who performed revocation
     * @returns {Promise<boolean>} True if revoked
     */
    async revoke(userId, permissionId, revokedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const grant = await this.getActiveGrant(userId, permissionId);
            if (!grant) {
                throw new Error('Permission grant not found');
            }

            const query = `
                UPDATE user_permissions 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE user_id = $2 AND permission_id = $3 
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [revokedBy, userId, permissionId]);

            if (result.rows.length === 0) {
                throw new Error('Permission grant not found');
            }

            await db.commitTransaction(client);

            logger.info('Permission revoked from user', {
                userId,
                permissionId,
                revokedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error revoking permission from user', {
                error: error.message,
                userId,
                permissionId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get active grant by user and permission
     * @param {string} userId - User ID
     * @param {string} permissionId - Permission ID
     * @returns {Promise<Object|null>} Grant object or null
     */
    async getActiveGrant(userId, permissionId) {
        try {
            const query = `
                SELECT 
                    id, user_id, permission_id, grant_type, conditions,
                    granted_by, granted_at, expires_at
                FROM user_permissions
                WHERE user_id = $1 
                    AND permission_id = $2
                    AND is_deleted = false
                    AND (expires_at IS NULL OR expires_at > NOW())
                LIMIT 1
            `;

            const result = await db.query(query, [userId, permissionId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting active grant', {
                error: error.message,
                userId,
                permissionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Check if user has permission (direct grant)
     * @param {string} userId - User ID
     * @param {string} permissionName - Permission name
     * @returns {Promise<boolean>} True if user has permission
     */
    async userHasPermission(userId, permissionName) {
        try {
            const query = `
                SELECT 
                    CASE 
                        WHEN up.grant_type = 'deny' THEN false
                        WHEN up.grant_type = 'allow' THEN true
                        ELSE false
                    END as has_permission
                FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = $1 
                    AND p.permission_name = $2
                    AND up.is_deleted = false
                    AND (up.expires_at IS NULL OR up.expires_at > NOW())
                LIMIT 1
            `;

            const result = await db.query(query, [userId, permissionName]);

            if (result.rows.length === 0) {
                return false;
            }

            const hasPermission = result.rows[0].has_permission === true;

            logger.debug('User direct permission check', {
                userId,
                permissionName,
                hasPermission
            });

            return hasPermission;
        } catch (error) {
            logger.error('Error checking user direct permission', {
                error: error.message,
                userId,
                permissionName
            });
            return false;
        }
    },

    /**
     * Get effective permissions for user (combining role and direct grants)
     * @param {string} userId - User ID
     * @returns {Promise<Array>} List of effective permissions
     */
    async getEffectivePermissions(userId) {
        try {
            const query = `
                WITH role_perms AS (
                    SELECT 
                        p.id, p.permission_name, p.permission_category,
                        p.resource_type, p.resource_name, p.action_type,
                        rp.grant_type,
                        rp.conditions,
                        'role' as source
                    FROM user_roles ur
                    JOIN role_permissions rp ON ur.role_id = rp.role_id
                    JOIN permissions p ON rp.permission_id = p.id
                    WHERE ur.user_id = $1 
                        AND ur.is_deleted = false
                        AND ur.is_active = true
                        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                        AND rp.is_deleted = false
                ),
                direct_perms AS (
                    SELECT 
                        p.id, p.permission_name, p.permission_category,
                        p.resource_type, p.resource_name, p.action_type,
                        up.grant_type,
                        up.conditions,
                        'direct' as source
                    FROM user_permissions up
                    JOIN permissions p ON up.permission_id = p.id
                    WHERE up.user_id = $1 
                        AND up.is_deleted = false
                        AND (up.expires_at IS NULL OR up.expires_at > NOW())
                ),
                combined AS (
                    SELECT * FROM role_perms
                    UNION ALL
                    SELECT * FROM direct_perms
                ),
                deduped AS (
                    SELECT DISTINCT ON (permission_name) 
                        permission_name, permission_category,
                        resource_type, resource_name, action_type,
                        grant_type, conditions, source
                    FROM combined
                    ORDER BY permission_name, 
                        CASE 
                            WHEN source = 'direct' THEN 1
                            ELSE 2
                        END,
                        CASE grant_type
                            WHEN 'deny' THEN 1
                            WHEN 'allow' THEN 2
                            ELSE 3
                        END
                )
                SELECT * FROM deduped
                ORDER BY permission_category ASC, permission_name ASC
            `;

            const result = await db.query(query, [userId]);

            logger.debug('User effective permissions retrieved', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting user effective permissions', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all grants with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {string} [filters.user_id] - User ID
     * @param {string} [filters.permission_id] - Permission ID
     * @param {string} [filters.grant_type] - Grant type
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of grants
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['up.is_deleted = false'];

            if (filters.user_id) {
                conditions.push(`up.user_id = $${paramIndex++}`);
                values.push(filters.user_id);
            }
            if (filters.permission_id) {
                conditions.push(`up.permission_id = $${paramIndex++}`);
                values.push(filters.permission_id);
            }
            if (filters.grant_type) {
                conditions.push(`up.grant_type = $${paramIndex++}`);
                values.push(filters.grant_type);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    up.id, up.user_id, up.permission_id,
                    up.grant_type, up.conditions,
                    up.granted_by, up.granted_at, up.expires_at,
                    u.username, u.email,
                    p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    granter.username as granted_by_username
                FROM user_permissions up
                JOIN users u ON up.user_id = u.id
                JOIN permissions p ON up.permission_id = p.id
                LEFT JOIN users granter ON up.granted_by = granter.id
                ${whereClause}
                ORDER BY up.granted_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all user-permission grants', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all user-permission grants', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count active grants by user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Count
     */
    async countActiveByUser(userId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM user_permissions
                WHERE user_id = $1 
                    AND is_deleted = false
                    AND (expires_at IS NULL OR expires_at > NOW())
            `;

            const result = await db.query(query, [userId]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting active grants by user', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count active grants by permission
     * @param {string} permissionId - Permission ID
     * @returns {Promise<number>} Count
     */
    async countActiveByPermission(permissionId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM user_permissions
                WHERE permission_id = $1 
                    AND is_deleted = false
                    AND (expires_at IS NULL OR expires_at > NOW())
            `;

            const result = await db.query(query, [permissionId]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting active grants by permission', {
                error: error.message,
                permissionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expiring grants (for notifications)
     * @param {number} daysBefore - Days before expiry to consider
     * @returns {Promise<Array>} List of expiring grants
     */
    async getExpiringGrants(daysBefore = 7) {
        try {
            const query = `
                SELECT 
                    up.id, up.user_id, up.permission_id, up.expires_at,
                    u.username, u.email,
                    p.permission_name, p.permission_category
                FROM user_permissions up
                JOIN users u ON up.user_id = u.id
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.is_deleted = false
                    AND up.expires_at IS NOT NULL
                    AND up.expires_at > NOW()
                    AND up.expires_at <= NOW() + ($1 || ' days')::INTERVAL
                ORDER BY up.expires_at ASC
            `;

            const result = await db.query(query, [daysBefore]);

            logger.debug('Expiring user-permission grants retrieved', {
                count: result.rows.length,
                daysBefore
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiring grants', {
                error: error.message,
                daysBefore
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Auto-expire grants (for cron job)
     * @returns {Promise<number>} Number of grants expired
     */
    async autoExpire() {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE user_permissions 
                SET is_deleted = true,
                    updated_at = NOW()
                WHERE is_deleted = false
                    AND expires_at IS NOT NULL
                    AND expires_at <= NOW()
                RETURNING id, user_id, permission_id
            `;

            const result = await client.query(query);

            await db.commitTransaction(client);

            if (result.rows.length > 0) {
                logger.info('Auto-expired user-permission grants', {
                    count: result.rows.length
                });
            }

            return result.rows.length;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error auto-expiring grants', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Get grant statistics
     * @returns {Promise<Object>} Grant statistics
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_grants,
                    COUNT(*) FILTER (WHERE expires_at IS NOT NULL) as expiring_grants,
                    COUNT(*) FILTER (WHERE expires_at <= NOW() + INTERVAL '7 days') as expiring_soon,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT permission_id) as unique_permissions,
                    COUNT(*) FILTER (WHERE grant_type = 'allow') as allow_count,
                    COUNT(*) FILTER (WHERE grant_type = 'deny') as deny_count
                FROM user_permissions
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('User-permission grant statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting grant statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Bulk grant permissions to user
     * @param {string} userId - User ID
     * @param {Array} permissionIds - Array of permission IDs
     * @param {string} grantType - Grant type (allow/deny)
     * @param {string} grantedBy - User who granted
     * @returns {Promise<Array>} List of created grants
     */
    async bulkGrant(userId, permissionIds, grantType = 'allow', grantedBy = null) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const created = [];

            for (const permissionId of permissionIds) {
                const existing = await this.getActiveGrant(userId, permissionId);
                if (!existing) {
                    const result = await this.grant({
                        user_id: userId,
                        permission_id: permissionId,
                        grant_type: grantType,
                        granted_by: grantedBy
                    });
                    created.push(result);
                }
            }

            await db.commitTransaction(client);

            logger.info('Bulk permissions granted to user', {
                userId,
                count: created.length,
                grantType
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk granting permissions to user', {
                error: error.message,
                userId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Bulk revoke permissions from user
     * @param {string} userId - User ID
     * @param {Array} permissionIds - Array of permission IDs
     * @param {string} revokedBy - User who performed revocation
     * @returns {Promise<number>} Number of revoked grants
     */
    async bulkRevoke(userId, permissionIds, revokedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            let revokedCount = 0;

            for (const permissionId of permissionIds) {
                const existing = await this.getActiveGrant(userId, permissionId);
                if (existing) {
                    await this.revoke(userId, permissionId, revokedBy);
                    revokedCount++;
                }
            }

            await db.commitTransaction(client);

            logger.info('Bulk permissions revoked from user', {
                userId,
                count: revokedCount
            });

            return revokedCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk revoking permissions from user', {
                error: error.message,
                userId
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = UserPermission;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Grant permission to user
 * const grant = await UserPermission.grant({
 *     user_id: userId,
 *     permission_id: permissionId,
 *     grant_type: 'allow',
 *     conditions: { department_id: 'cardiology' },
 *     granted_by: adminUserId,
 *     expires_at: '2025-12-31 23:59:59'
 * });
 * 
 * // Check if user has direct permission
 * const hasPermission = await UserPermission.userHasPermission(userId, 'patient.view');
 * 
 * // Get effective permissions (role + direct)
 * const effectivePerms = await UserPermission.getEffectivePermissions(userId);
 * 
 * // Get all direct grants for user
 * const userGrants = await UserPermission.findByUserId(userId);
 * 
 * // Revoke permission from user
 * await UserPermission.revoke(userId, permissionId, adminUserId);
 * 
 * // Bulk grant permissions
 * await UserPermission.bulkGrant(userId, permissionIds, 'allow', adminUserId);
 * 
 * // Bulk revoke permissions
 * await UserPermission.bulkRevoke(userId, permissionIds, adminUserId);
 * 
 * // Get expiring grants (for notifications)
 * const expiring = await UserPermission.getExpiringGrants(7);
 * 
 * // Auto-expire past grants (run via cron)
 * const expiredCount = await UserPermission.autoExpire();
 * 
 * // Get all grants with filters
 * const grants = await UserPermission.getAll(
 *     { user_id: userId, grant_type: 'allow' },
 *     { limit: 20, offset: 0 }
 * );
 * 
 * // Count active grants
 * const count = await UserPermission.countActiveByUser(userId);
 * 
 * // Get grant statistics
 * const stats = await UserPermission.getStatistics();
 * 
 * ======================================================================
 */