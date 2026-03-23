/**
 * ======================================================================
 * FILE: backend/src/models/core/UserRole.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * UserRole model for database operations.
 * Handles user-role assignment queries for RBAC.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: user_roles
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users)
 * - role_id: UUID (foreign key to roles)
 * - assigned_by: UUID (foreign key to users)
 * - assigned_at: timestamp
 * - expires_at: timestamp
 * - is_active: boolean
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

const UserRole = {
    /**
     * Table name
     */
    tableName: 'user_roles',

    /**
     * Find user-role assignment by ID
     * @param {string} id - UserRole UUID
     * @returns {Promise<Object|null>} UserRole object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ur.id, ur.user_id, ur.role_id, ur.assigned_by,
                    ur.assigned_at, ur.expires_at, ur.is_active,
                    ur.created_at, ur.updated_at,
                    u.username as user_username,
                    u.email as user_email,
                    r.role_name, r.role_level,
                    assigned_by_user.username as assigned_by_username
                FROM user_roles ur
                JOIN users u ON ur.user_id = u.id
                JOIN roles r ON ur.role_id = r.id
                LEFT JOIN users assigned_by_user ON ur.assigned_by = assigned_by_user.id
                WHERE ur.id = $1 AND ur.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('UserRole found by ID', { userRoleId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding user-role by ID', {
                error: error.message,
                userRoleId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find active user-role assignments by user ID
     * @param {string} userId - User UUID
     * @returns {Promise<Array>} List of user-role assignments
     */
    async findByUserId(userId) {
        try {
            const query = `
                SELECT 
                    ur.id, ur.user_id, ur.role_id, ur.assigned_by,
                    ur.assigned_at, ur.expires_at, ur.is_active,
                    r.role_name, r.role_level, r.role_description,
                    r.is_system_role
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1 
                    AND ur.is_deleted = false
                    AND ur.is_active = true
                    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                ORDER BY r.role_level DESC
            `;

            const result = await db.query(query, [userId]);

            logger.debug('UserRole assignments found by user ID', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding user-roles by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find active user-role assignments by role ID
     * @param {string} roleId - Role UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of user-role assignments
     */
    async findByRoleId(roleId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    ur.id, ur.user_id, ur.role_id, ur.assigned_by,
                    ur.assigned_at, ur.expires_at, ur.is_active,
                    u.username, u.email, u.role as primary_role,
                    u.status as user_status
                FROM user_roles ur
                JOIN users u ON ur.user_id = u.id
                WHERE ur.role_id = $1 
                    AND ur.is_deleted = false
                    AND ur.is_active = true
                    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                ORDER BY ur.assigned_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [roleId, limit, offset]);

            logger.debug('UserRole assignments found by role ID', {
                roleId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding user-roles by role ID', {
                error: error.message,
                roleId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Assign role to user
     * @param {Object} assignmentData - Assignment data
     * @param {string} assignmentData.user_id - User ID
     * @param {string} assignmentData.role_id - Role ID
     * @param {string} [assignmentData.assigned_by] - User who assigned
     * @param {string} [assignmentData.expires_at] - Expiration timestamp
     * @returns {Promise<Object>} Created assignment
     */
    async assign(assignmentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existing = await this.getActiveAssignment(
                assignmentData.user_id,
                assignmentData.role_id
            );

            if (existing) {
                throw new Error('User already has this role assigned');
            }

            const query = `
                INSERT INTO user_roles (
                    id, user_id, role_id, assigned_by,
                    assigned_at, expires_at, is_active,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, NOW(), $4, true, NOW(), NOW()
                )
                RETURNING 
                    id, user_id, role_id, assigned_by,
                    assigned_at, expires_at, is_active
            `;

            const values = [
                assignmentData.user_id,
                assignmentData.role_id,
                assignmentData.assigned_by || null,
                assignmentData.expires_at || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Role assigned to user', {
                userId: assignmentData.user_id,
                roleId: assignmentData.role_id,
                assignedBy: assignmentData.assigned_by
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error assigning role to user', {
                error: error.message,
                userId: assignmentData.user_id,
                roleId: assignmentData.role_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Remove role from user (soft delete)
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if removed
     */
    async remove(userId, roleId, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const assignment = await this.getActiveAssignment(userId, roleId);
            if (!assignment) {
                throw new Error('Role assignment not found');
            }

            const query = `
                UPDATE user_roles 
                SET is_active = false,
                    is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE user_id = $2 AND role_id = $3 
                    AND is_deleted = false AND is_active = true
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, userId, roleId]);

            if (result.rows.length === 0) {
                throw new Error('Role assignment not found');
            }

            await db.commitTransaction(client);

            logger.info('Role removed from user', {
                userId,
                roleId,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error removing role from user', {
                error: error.message,
                userId,
                roleId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get active assignment
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @returns {Promise<Object|null>} Assignment object or null
     */
    async getActiveAssignment(userId, roleId) {
        try {
            const query = `
                SELECT 
                    id, user_id, role_id, assigned_by,
                    assigned_at, expires_at, is_active
                FROM user_roles
                WHERE user_id = $1 
                    AND role_id = $2
                    AND is_deleted = false
                    AND is_active = true
                    AND (expires_at IS NULL OR expires_at > NOW())
                LIMIT 1
            `;

            const result = await db.query(query, [userId, roleId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting active assignment', {
                error: error.message,
                userId,
                roleId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Check if user has role
     * @param {string} userId - User ID
     * @param {string} roleName - Role name
     * @returns {Promise<boolean>} True if user has role
     */
    async userHasRole(userId, roleName) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1 
                    AND r.role_name = $2
                    AND ur.is_deleted = false
                    AND ur.is_active = true
                    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
            `;

            const result = await db.query(query, [userId, roleName]);

            const hasRole = parseInt(result.rows[0].count) > 0;

            logger.debug('User role check', {
                userId,
                roleName,
                hasRole
            });

            return hasRole;
        } catch (error) {
            logger.error('Error checking user role', {
                error: error.message,
                userId,
                roleName
            });
            return false;
        }
    },

    /**
     * Get user's primary role (highest level)
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} Primary role or null
     */
    async getPrimaryRole(userId) {
        try {
            const query = `
                SELECT 
                    r.id, r.role_name, r.role_level, r.role_description,
                    ur.assigned_at, ur.expires_at
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1 
                    AND ur.is_deleted = false
                    AND ur.is_active = true
                    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                ORDER BY r.role_level DESC
                LIMIT 1
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('User primary role retrieved', {
                userId,
                roleName: result.rows[0].role_name
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting user primary role', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all assignments with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {string} [filters.user_id] - User ID
     * @param {string} [filters.role_id] - Role ID
     * @param {boolean} [filters.is_active] - Active status
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of assignments
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['ur.is_deleted = false'];

            if (filters.user_id) {
                conditions.push(`ur.user_id = $${paramIndex++}`);
                values.push(filters.user_id);
            }
            if (filters.role_id) {
                conditions.push(`ur.role_id = $${paramIndex++}`);
                values.push(filters.role_id);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`ur.is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    ur.id, ur.user_id, ur.role_id, ur.assigned_by,
                    ur.assigned_at, ur.expires_at, ur.is_active,
                    u.username, u.email, u.role as primary_role,
                    r.role_name, r.role_level,
                    assigned_by_user.username as assigned_by_username
                FROM user_roles ur
                JOIN users u ON ur.user_id = u.id
                JOIN roles r ON ur.role_id = r.id
                LEFT JOIN users assigned_by_user ON ur.assigned_by = assigned_by_user.id
                ${whereClause}
                ORDER BY ur.assigned_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all user-role assignments', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all user-role assignments', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count active assignments by role
     * @param {string} roleId - Role ID
     * @returns {Promise<number>} Count
     */
    async countActiveByRole(roleId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM user_roles
                WHERE role_id = $1 
                    AND is_deleted = false
                    AND is_active = true
                    AND (expires_at IS NULL OR expires_at > NOW())
            `;

            const result = await db.query(query, [roleId]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting active assignments by role', {
                error: error.message,
                roleId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count active assignments by user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Count
     */
    async countActiveByUser(userId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM user_roles
                WHERE user_id = $1 
                    AND is_deleted = false
                    AND is_active = true
                    AND (expires_at IS NULL OR expires_at > NOW())
            `;

            const result = await db.query(query, [userId]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting active assignments by user', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expiring assignments (for notifications)
     * @param {number} daysBefore - Days before expiry to consider
     * @returns {Promise<Array>} List of expiring assignments
     */
    async getExpiringAssignments(daysBefore = 7) {
        try {
            const query = `
                SELECT 
                    ur.id, ur.user_id, ur.role_id, ur.expires_at,
                    u.username, u.email,
                    r.role_name
                FROM user_roles ur
                JOIN users u ON ur.user_id = u.id
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.is_deleted = false
                    AND ur.is_active = true
                    AND ur.expires_at IS NOT NULL
                    AND ur.expires_at > NOW()
                    AND ur.expires_at <= NOW() + ($1 || ' days')::INTERVAL
                ORDER BY ur.expires_at ASC
            `;

            const result = await db.query(query, [daysBefore]);

            logger.debug('Expiring assignments retrieved', {
                count: result.rows.length,
                daysBefore
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiring assignments', {
                error: error.message,
                daysBefore
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Auto-expire assignments (for cron job)
     * @returns {Promise<number>} Number of assignments expired
     */
    async autoExpire() {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE user_roles 
                SET is_active = false,
                    updated_at = NOW()
                WHERE is_deleted = false
                    AND is_active = true
                    AND expires_at IS NOT NULL
                    AND expires_at <= NOW()
                RETURNING id, user_id, role_id
            `;

            const result = await client.query(query);

            await db.commitTransaction(client);

            if (result.rows.length > 0) {
                logger.info('Auto-expired user-role assignments', {
                    count: result.rows.length
                });
            }

            return result.rows.length;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error auto-expiring assignments', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Get assignment statistics
     * @returns {Promise<Object>} Assignment statistics
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_assignments,
                    COUNT(*) FILTER (WHERE is_active = true) as active_assignments,
                    COUNT(*) FILTER (WHERE expires_at IS NOT NULL) as expiring_assignments,
                    COUNT(*) FILTER (WHERE expires_at <= NOW() + INTERVAL '7 days') as expiring_soon,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT role_id) as unique_roles
                FROM user_roles
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('User-role assignment statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting assignment statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = UserRole;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Assign role to user
 * const assignment = await UserRole.assign({
 *     user_id: userId,
 *     role_id: roleId,
 *     assigned_by: adminUserId,
 *     expires_at: '2025-12-31 23:59:59'
 * });
 * 
 * // Check if user has role
 * const isDoctor = await UserRole.userHasRole(userId, 'doctor');
 * 
 * // Get user's primary role
 * const primaryRole = await UserRole.getPrimaryRole(userId);
 * 
 * // Get all assignments for user
 * const userRoles = await UserRole.findByUserId(userId);
 * 
 * // Get all users with specific role
 * const usersWithRole = await UserRole.findByRoleId(roleId);
 * 
 * // Remove role from user
 * await UserRole.remove(userId, roleId, adminUserId);
 * 
 * // Get expiring assignments (for notifications)
 * const expiring = await UserRole.getExpiringAssignments(7);
 * 
 * // Auto-expire past assignments (run via cron)
 * const expiredCount = await UserRole.autoExpire();
 * 
 * // Get all assignments with filters
 * const assignments = await UserRole.getAll(
 *     { role_id: roleId, is_active: true },
 *     { limit: 20, offset: 0 }
 * );
 * 
 * // Count active assignments by role
 * const count = await UserRole.countActiveByRole(roleId);
 * 
 * // Get assignment statistics
 * const stats = await UserRole.getStatistics();
 * 
 * ======================================================================
 */