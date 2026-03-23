/**
 * ======================================================================
 * FILE: backend/src/models/core/Role.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Role model for database operations.
 * Handles all role-related database queries for RBAC.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: roles
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - role_name: string (unique)
 * - role_description: text
 * - role_level: integer (1-10, higher = more privileged)
 * - is_system_role: boolean (system roles cannot be deleted)
 * - created_at: timestamp
 * - updated_at: timestamp
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

const Role = {
    /**
     * Table name
     */
    tableName: 'roles',

    /**
     * Find role by ID
     * @param {string} id - Role UUID
     * @returns {Promise<Object|null>} Role object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    id, role_name, role_description, role_level,
                    is_system_role, created_at, updated_at, created_by
                FROM roles 
                WHERE id = $1 AND is_deleted = false
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Role found by ID', { roleId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding role by ID', {
                error: error.message,
                roleId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find role by name
     * @param {string} roleName - Role name
     * @returns {Promise<Object|null>} Role object or null
     */
    async findByName(roleName) {
        try {
            const query = `
                SELECT 
                    id, role_name, role_description, role_level,
                    is_system_role, created_at, updated_at
                FROM roles 
                WHERE role_name = $1 AND is_deleted = false
            `;
            
            const result = await db.query(query, [roleName]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Role found by name', { roleName });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding role by name', {
                error: error.message,
                roleName
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all roles
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of roles
     */
    async getAll(options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, role_name, role_description, role_level,
                    is_system_role, created_at, updated_at
                FROM roles 
                WHERE is_deleted = false
                ORDER BY role_level DESC, role_name ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Retrieved all roles', {
                count: result.rows.length,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all roles', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new role
     * @param {Object} roleData - Role data
     * @param {string} roleData.role_name - Role name
     * @param {string} [roleData.role_description] - Role description
     * @param {number} [roleData.role_level] - Role level (1-10)
     * @param {boolean} [roleData.is_system_role] - Whether system role
     * @param {string} [roleData.created_by] - User who created
     * @returns {Promise<Object>} Created role
     */
    async create(roleData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existingRole = await this.findByName(roleData.role_name);
            if (existingRole) {
                throw new Error('Role name already exists');
            }

            const query = `
                INSERT INTO roles (
                    id, role_name, role_description, role_level,
                    is_system_role, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW()
                )
                RETURNING 
                    id, role_name, role_description, role_level,
                    is_system_role, created_at
            `;

            const values = [
                roleData.role_name,
                roleData.role_description || null,
                roleData.role_level || 1,
                roleData.is_system_role || false,
                roleData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Role created successfully', {
                roleId: result.rows[0].id,
                roleName: roleData.role_name,
                roleLevel: roleData.role_level
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating role', {
                error: error.message,
                roleName: roleData.role_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update role
     * @param {string} id - Role ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated role
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const role = await this.findById(id);
            if (!role) {
                throw new Error('Role not found');
            }

            if (role.is_system_role && (updates.role_name || updates.is_system_role === false)) {
                throw new Error('System roles cannot be modified');
            }

            if (updates.role_name) {
                const existingRole = await this.findByName(updates.role_name);
                if (existingRole && existingRole.id !== id) {
                    throw new Error('Role name already exists');
                }
            }

            const allowedFields = ['role_name', 'role_description', 'role_level'];
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(id);

            const query = `
                UPDATE roles 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, role_name, role_description, role_level,
                    is_system_role, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Role not found');
            }

            await db.commitTransaction(client);

            logger.info('Role updated successfully', {
                roleId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating role', {
                error: error.message,
                roleId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete role (soft delete)
     * @param {string} id - Role ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const role = await this.findById(id);
            if (!role) {
                throw new Error('Role not found');
            }

            if (role.is_system_role) {
                throw new Error('System roles cannot be deleted');
            }

            const userRoleQuery = `
                SELECT COUNT(*) as count FROM user_roles 
                WHERE role_id = $1 AND is_active = true
            `;
            const userRoleResult = await client.query(userRoleQuery, [id]);
            
            if (parseInt(userRoleResult.rows[0].count) > 0) {
                throw new Error('Cannot delete role with active users assigned');
            }

            const query = `
                UPDATE roles 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Role not found');
            }

            await db.commitTransaction(client);

            logger.info('Role soft deleted', {
                roleId: id,
                roleName: role.role_name,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting role', {
                error: error.message,
                roleId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get roles by user ID
     * @param {string} userId - User UUID
     * @returns {Promise<Array>} List of roles
     */
    async getByUserId(userId) {
        try {
            const query = `
                SELECT 
                    r.id, r.role_name, r.role_description, r.role_level,
                    r.is_system_role, ur.assigned_at, ur.expires_at,
                    ur.is_active
                FROM roles r
                JOIN user_roles ur ON r.id = ur.role_id
                WHERE ur.user_id = $1
                    AND ur.is_active = true
                    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                    AND r.is_deleted = false
                ORDER BY r.role_level DESC
            `;

            const result = await db.query(query, [userId]);

            logger.debug('Roles found by user ID', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting roles by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get role with permissions
     * @param {string} id - Role ID
     * @returns {Promise<Object>} Role with permissions
     */
    async getWithPermissions(id) {
        try {
            const roleQuery = `
                SELECT 
                    id, role_name, role_description, role_level,
                    is_system_role, created_at
                FROM roles 
                WHERE id = $1 AND is_deleted = false
            `;
            
            const roleResult = await db.query(roleQuery, [id]);
            
            if (roleResult.rows.length === 0) {
                return null;
            }

            const permissionsQuery = `
                SELECT 
                    p.id, p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    rp.grant_type, rp.conditions
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role_id = $1
                    AND p.is_deleted = false
                ORDER BY p.permission_category, p.permission_name
            `;

            const permissionsResult = await db.query(permissionsQuery, [id]);

            const role = roleResult.rows[0];
            role.permissions = permissionsResult.rows;

            logger.debug('Role with permissions retrieved', {
                roleId: id,
                permissionCount: permissionsResult.rows.length
            });

            return role;
        } catch (error) {
            logger.error('Error getting role with permissions', {
                error: error.message,
                roleId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get available role levels
     * @returns {Promise<Array>} List of role levels
     */
    async getLevels() {
        try {
            const query = `
                SELECT DISTINCT role_level, COUNT(*) as role_count
                FROM roles
                WHERE is_deleted = false
                GROUP BY role_level
                ORDER BY role_level DESC
            `;

            const result = await db.query(query);

            logger.debug('Role levels retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting role levels', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count total roles
     * @returns {Promise<number>} Total count
     */
    async count() {
        try {
            const query = `
                SELECT COUNT(*) as total 
                FROM roles 
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            return parseInt(result.rows[0].total);
        } catch (error) {
            logger.error('Error counting roles', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get system roles (cannot be deleted)
     * @returns {Promise<Array>} List of system roles
     */
    async getSystemRoles() {
        try {
            const query = `
                SELECT 
                    id, role_name, role_description, role_level
                FROM roles 
                WHERE is_system_role = true AND is_deleted = false
                ORDER BY role_level DESC
            `;

            const result = await db.query(query);

            logger.debug('System roles retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting system roles', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = Role;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create new role
 * const role = await Role.create({
 *     role_name: 'doctor',
 *     role_description: 'Medical doctor with patient care access',
 *     role_level: 7,
 *     is_system_role: true,
 *     created_by: adminUserId
 * });
 * 
 * // Find role by name
 * const role = await Role.findByName('doctor');
 * 
 * // Get all roles
 * const roles = await Role.getAll({ limit: 20, offset: 0 });
 * 
 * // Get role with permissions
 * const roleWithPermissions = await Role.getWithPermissions(roleId);
 * 
 * // Get roles by user
 * const userRoles = await Role.getByUserId(userId);
 * 
 * // Update role
 * const updated = await Role.update(roleId, {
 *     role_description: 'Updated description',
 *     role_level: 8
 * });
 * 
 * // Get system roles
 * const systemRoles = await Role.getSystemRoles();
 * 
 * // Get role levels statistics
 * const levels = await Role.getLevels();
 * 
 * // Count total roles
 * const total = await Role.count();
 * 
 * // Delete role (only non-system roles with no active users)
 * await Role.delete(roleId, adminUserId);
 * 
 * ======================================================================
 */