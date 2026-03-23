/**
 * ======================================================================
 * FILE: backend/src/models/core/RolePermission.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * RolePermission model for database operations.
 * Handles role-permission assignment queries for RBAC.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: role_permissions
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - role_id: UUID (foreign key to roles)
 * - permission_id: UUID (foreign key to permissions)
 * - grant_type: enum (allow, deny)
 * - conditions: JSONB (dynamic conditions for permission)
 * - created_at: timestamp
 * - created_by: uuid
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

const RolePermission = {
    /**
     * Table name
     */
    tableName: 'role_permissions',

    /**
     * Find role-permission assignment by ID
     * @param {string} id - RolePermission UUID
     * @returns {Promise<Object|null>} RolePermission object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    rp.id, rp.role_id, rp.permission_id,
                    rp.grant_type, rp.conditions,
                    rp.created_at, rp.created_by,
                    r.role_name, r.role_level,
                    p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    creator.username as created_by_username
                FROM role_permissions rp
                JOIN roles r ON rp.role_id = r.id
                JOIN permissions p ON rp.permission_id = p.id
                LEFT JOIN users creator ON rp.created_by = creator.id
                WHERE rp.id = $1 AND rp.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('RolePermission found by ID', { rolePermissionId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding role-permission by ID', {
                error: error.message,
                rolePermissionId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find assignments by role ID
     * @param {string} roleId - Role UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of role-permission assignments
     */
    async findByRoleId(roleId, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    rp.id, rp.role_id, rp.permission_id,
                    rp.grant_type, rp.conditions,
                    rp.created_at,
                    p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    p.description
                FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = $1 AND rp.is_deleted = false
                ORDER BY p.permission_category ASC, p.permission_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [roleId, limit, offset]);

            logger.debug('RolePermission assignments found by role ID', {
                roleId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding role-permissions by role ID', {
                error: error.message,
                roleId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find assignments by permission ID
     * @param {string} permissionId - Permission UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of role-permission assignments
     */
    async findByPermissionId(permissionId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    rp.id, rp.role_id, rp.permission_id,
                    rp.grant_type, rp.conditions,
                    rp.created_at,
                    r.role_name, r.role_level
                FROM role_permissions rp
                JOIN roles r ON rp.role_id = r.id
                WHERE rp.permission_id = $1 AND rp.is_deleted = false
                ORDER BY r.role_level DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [permissionId, limit, offset]);

            logger.debug('RolePermission assignments found by permission ID', {
                permissionId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding role-permissions by permission ID', {
                error: error.message,
                permissionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Assign permission to role
     * @param {Object} assignmentData - Assignment data
     * @param {string} assignmentData.role_id - Role ID
     * @param {string} assignmentData.permission_id - Permission ID
     * @param {string} [assignmentData.grant_type] - Grant type (allow/deny)
     * @param {Object} [assignmentData.conditions] - Dynamic conditions
     * @param {string} [assignmentData.created_by] - User who created
     * @returns {Promise<Object>} Created assignment
     */
    async assign(assignmentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existing = await this.getAssignment(
                assignmentData.role_id,
                assignmentData.permission_id
            );

            if (existing) {
                throw new Error('Permission already assigned to this role');
            }

            const query = `
                INSERT INTO role_permissions (
                    id, role_id, permission_id, grant_type,
                    conditions, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
                )
                RETURNING 
                    id, role_id, permission_id, grant_type,
                    conditions, created_at
            `;

            const values = [
                assignmentData.role_id,
                assignmentData.permission_id,
                assignmentData.grant_type || 'allow',
                assignmentData.conditions || null,
                assignmentData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Permission assigned to role', {
                roleId: assignmentData.role_id,
                permissionId: assignmentData.permission_id,
                grantType: assignmentData.grant_type,
                createdBy: assignmentData.created_by
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error assigning permission to role', {
                error: error.message,
                roleId: assignmentData.role_id,
                permissionId: assignmentData.permission_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Remove permission from role (soft delete)
     * @param {string} roleId - Role ID
     * @param {string} permissionId - Permission ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if removed
     */
    async remove(roleId, permissionId, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const assignment = await this.getAssignment(roleId, permissionId);
            if (!assignment) {
                throw new Error('Permission assignment not found');
            }

            const query = `
                UPDATE role_permissions 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1
                WHERE role_id = $2 AND permission_id = $3 
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, roleId, permissionId]);

            if (result.rows.length === 0) {
                throw new Error('Permission assignment not found');
            }

            await db.commitTransaction(client);

            logger.info('Permission removed from role', {
                roleId,
                permissionId,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error removing permission from role', {
                error: error.message,
                roleId,
                permissionId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get assignment by role and permission
     * @param {string} roleId - Role ID
     * @param {string} permissionId - Permission ID
     * @returns {Promise<Object|null>} Assignment object or null
     */
    async getAssignment(roleId, permissionId) {
        try {
            const query = `
                SELECT 
                    id, role_id, permission_id, grant_type, conditions
                FROM role_permissions
                WHERE role_id = $1 
                    AND permission_id = $2
                    AND is_deleted = false
                LIMIT 1
            `;

            const result = await db.query(query, [roleId, permissionId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting role-permission assignment', {
                error: error.message,
                roleId,
                permissionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Check if role has permission
     * @param {string} roleId - Role ID
     * @param {string} permissionName - Permission name
     * @returns {Promise<boolean>} True if role has permission
     */
    async roleHasPermission(roleId, permissionName) {
        try {
            const query = `
                SELECT 
                    CASE 
                        WHEN rp.grant_type = 'deny' THEN false
                        WHEN rp.grant_type = 'allow' THEN true
                        ELSE false
                    END as has_permission
                FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = $1 
                    AND p.permission_name = $2
                    AND rp.is_deleted = false
                LIMIT 1
            `;

            const result = await db.query(query, [roleId, permissionName]);

            if (result.rows.length === 0) {
                return false;
            }

            const hasPermission = result.rows[0].has_permission === true;

            logger.debug('Role permission check', {
                roleId,
                permissionName,
                hasPermission
            });

            return hasPermission;
        } catch (error) {
            logger.error('Error checking role permission', {
                error: error.message,
                roleId,
                permissionName
            });
            return false;
        }
    },

    /**
     * Get all permissions for role with grant types
     * @param {string} roleId - Role ID
     * @returns {Promise<Array>} List of permissions with grant types
     */
    async getPermissionsWithGrantType(roleId) {
        try {
            const query = `
                SELECT 
                    p.id, p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    p.description,
                    rp.grant_type, rp.conditions
                FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = $1 AND rp.is_deleted = false
                ORDER BY 
                    CASE rp.grant_type
                        WHEN 'deny' THEN 1
                        WHEN 'allow' THEN 2
                        ELSE 3
                    END,
                    p.permission_category ASC,
                    p.permission_name ASC
            `;

            const result = await db.query(query, [roleId]);

            logger.debug('Role permissions with grant types retrieved', {
                roleId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting role permissions with grant types', {
                error: error.message,
                roleId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Bulk assign permissions to role
     * @param {string} roleId - Role ID
     * @param {Array} permissionIds - Array of permission IDs
     * @param {string} grantType - Grant type (allow/deny)
     * @param {string} createdBy - User who created
     * @returns {Promise<Array>} List of created assignments
     */
    async bulkAssign(roleId, permissionIds, grantType = 'allow', createdBy = null) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const created = [];

            for (const permissionId of permissionIds) {
                const existing = await this.getAssignment(roleId, permissionId);
                if (!existing) {
                    const result = await this.assign({
                        role_id: roleId,
                        permission_id: permissionId,
                        grant_type: grantType,
                        created_by: createdBy
                    });
                    created.push(result);
                }
            }

            await db.commitTransaction(client);

            logger.info('Bulk permissions assigned to role', {
                roleId,
                count: created.length,
                grantType
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk assigning permissions to role', {
                error: error.message,
                roleId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Bulk remove permissions from role
     * @param {string} roleId - Role ID
     * @param {Array} permissionIds - Array of permission IDs
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<number>} Number of removed assignments
     */
    async bulkRemove(roleId, permissionIds, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            let removedCount = 0;

            for (const permissionId of permissionIds) {
                const existing = await this.getAssignment(roleId, permissionId);
                if (existing) {
                    await this.remove(roleId, permissionId, deletedBy);
                    removedCount++;
                }
            }

            await db.commitTransaction(client);

            logger.info('Bulk permissions removed from role', {
                roleId,
                count: removedCount
            });

            return removedCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk removing permissions from role', {
                error: error.message,
                roleId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get all assignments with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {string} [filters.role_id] - Role ID
     * @param {string} [filters.permission_id] - Permission ID
     * @param {string} [filters.grant_type] - Grant type
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of assignments
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['rp.is_deleted = false'];

            if (filters.role_id) {
                conditions.push(`rp.role_id = $${paramIndex++}`);
                values.push(filters.role_id);
            }
            if (filters.permission_id) {
                conditions.push(`rp.permission_id = $${paramIndex++}`);
                values.push(filters.permission_id);
            }
            if (filters.grant_type) {
                conditions.push(`rp.grant_type = $${paramIndex++}`);
                values.push(filters.grant_type);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    rp.id, rp.role_id, rp.permission_id,
                    rp.grant_type, rp.conditions,
                    rp.created_at,
                    r.role_name, r.role_level,
                    p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type
                FROM role_permissions rp
                JOIN roles r ON rp.role_id = r.id
                JOIN permissions p ON rp.permission_id = p.id
                ${whereClause}
                ORDER BY r.role_level DESC, p.permission_category ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all role-permission assignments', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all role-permission assignments', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count assignments by role
     * @param {string} roleId - Role ID
     * @returns {Promise<number>} Count
     */
    async countByRole(roleId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM role_permissions
                WHERE role_id = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [roleId]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting assignments by role', {
                error: error.message,
                roleId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count assignments by permission
     * @param {string} permissionId - Permission ID
     * @returns {Promise<number>} Count
     */
    async countByPermission(permissionId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM role_permissions
                WHERE permission_id = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [permissionId]);

            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error counting assignments by permission', {
                error: error.message,
                permissionId
            });
            throw new Error(`Database error: ${error.message}`);
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
                    COUNT(DISTINCT role_id) as roles_with_permissions,
                    COUNT(DISTINCT permission_id) as permissions_assigned,
                    COUNT(*) FILTER (WHERE grant_type = 'allow') as allow_count,
                    COUNT(*) FILTER (WHERE grant_type = 'deny') as deny_count,
                    AVG(r.role_level)::numeric(10,2) as avg_role_level
                FROM role_permissions rp
                JOIN roles r ON rp.role_id = r.id
                WHERE rp.is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Role-permission assignment statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting assignment statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get permissions by role with conditions evaluation
     * @param {string} roleId - Role ID
     * @param {Object} context - Context for conditions evaluation
     * @returns {Promise<Array>} List of permissions with evaluated conditions
     */
    async getPermissionsWithConditions(roleId, context = {}) {
        try {
            const query = `
                SELECT 
                    p.id, p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    rp.grant_type, rp.conditions
                FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                WHERE rp.role_id = $1 AND rp.is_deleted = false
            `;

            const result = await db.query(query, [roleId]);

            const permissions = result.rows.map(row => {
                let conditionsMet = true;
                if (row.conditions && Object.keys(row.conditions).length > 0) {
                    for (const [key, value] of Object.entries(row.conditions)) {
                        if (context[key] !== undefined && context[key] !== value) {
                            conditionsMet = false;
                            break;
                        }
                    }
                }
                return {
                    ...row,
                    conditions_met: conditionsMet
                };
            });

            logger.debug('Role permissions with conditions evaluated', {
                roleId,
                count: permissions.length
            });

            return permissions;
        } catch (error) {
            logger.error('Error getting permissions with conditions', {
                error: error.message,
                roleId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = RolePermission;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Assign permission to role
 * const assignment = await RolePermission.assign({
 *     role_id: roleId,
 *     permission_id: permissionId,
 *     grant_type: 'allow',
 *     conditions: { department_id: 'cardiology' },
 *     created_by: adminUserId
 * });
 * 
 * // Check if role has permission
 * const hasPermission = await RolePermission.roleHasPermission(roleId, 'patient.view');
 * 
 * // Get all permissions for role
 * const permissions = await RolePermission.findByRoleId(roleId);
 * 
 * // Get permissions with grant types
 * const permissionsWithGrant = await RolePermission.getPermissionsWithGrantType(roleId);
 * 
 * // Get permissions with conditions evaluation
 * const permsWithConditions = await RolePermission.getPermissionsWithConditions(
 *     roleId,
 *     { department_id: 'cardiology' }
 * );
 * 
 * // Bulk assign permissions
 * await RolePermission.bulkAssign(roleId, permissionIds, 'allow', adminUserId);
 * 
 * // Bulk remove permissions
 * await RolePermission.bulkRemove(roleId, permissionIds, adminUserId);
 * 
 * // Remove single permission
 * await RolePermission.remove(roleId, permissionId, adminUserId);
 * 
 * // Get all assignments with filters
 * const assignments = await RolePermission.getAll(
 *     { role_id: roleId, grant_type: 'allow' },
 *     { limit: 50, offset: 0 }
 * );
 * 
 * // Count assignments
 * const count = await RolePermission.countByRole(roleId);
 * 
 * // Get statistics
 * const stats = await RolePermission.getStatistics();
 * 
 * ======================================================================
 */