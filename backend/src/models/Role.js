/**
 * ======================================================================
 * FILE: backend/src/models/Role.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Role model for role-based access control (RBAC).
 * Handles all role-related database operations.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
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
 * - created_by: UUID (FK to users.id)
 * 
 * RELATIONSHIPS:
 * - One role has many users (via user_roles table)
 * - One role has many permissions (via role_permissions table)
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Role model with database operations
 */
const Role = {
    /**
     * Table name
     */
    tableName: 'roles',

    /**
     * Find role by ID
     * @param {string} id - Role UUID
     * @returns {Promise<Object>} Role object
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
            
            logger.debug('Role found by ID', { roleId: id, roleName: result.rows[0].role_name });
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
     * @returns {Promise<Object>} Role object
     */
    async findByName(roleName) {
        try {
            const query = `
                SELECT 
                    id, role_name, role_description, role_level, 
                    is_system_role, created_at, updated_at, created_by
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
     * Create new role
     * @param {Object} roleData - Role data
     * @param {string} createdBy - User ID creating the role
     * @returns {Promise<Object>} Created role
     */
    async create(roleData, createdBy) {
        try {
            // Check if role already exists
            const existingRole = await this.findByName(roleData.role_name);
            if (existingRole) {
                throw new Error('Role already exists');
            }

            const query = `
                INSERT INTO roles (
                    role_name, role_description, role_level, is_system_role,
                    created_by, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                RETURNING id, role_name, role_description, role_level, is_system_role, created_at
            `;

            const values = [
                roleData.role_name,
                roleData.role_description || null,
                roleData.role_level || 1,
                roleData.is_system_role || false,
                createdBy
            ];

            const result = await db.query(query, values);
            
            logger.info('Role created successfully', { 
                roleId: result.rows[0].id,
                roleName: result.rows[0].role_name,
                createdBy
            });
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating role', { 
                error: error.message,
                roleName: roleData.role_name 
            });
            throw error;
        }
    },

    /**
     * Update role
     * @param {string} id - Role ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated role
     */
    async update(id, updates) {
        try {
            // Check if role exists and is not system role (if trying to modify system fields)
            const existingRole = await this.findById(id);
            if (!existingRole) {
                throw new Error('Role not found');
            }

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Allowed update fields
            const allowedFields = [
                'role_description', 'role_level'
            ];

            // System roles can only update description
            if (existingRole.is_system_role) {
                if (updates.role_name || updates.role_level !== undefined) {
                    throw new Error('System roles cannot modify name or level');
                }
            } else {
                // Non-system roles can update more fields
                if (updates.role_name) {
                    setClause.push(`role_name = $${paramIndex}`);
                    values.push(updates.role_name);
                    paramIndex++;
                }
                if (updates.role_level !== undefined) {
                    setClause.push(`role_level = $${paramIndex}`);
                    values.push(updates.role_level);
                    paramIndex++;
                }
            }

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            // Add updated_at
            setClause.push(`updated_at = NOW()`);

            if (setClause.length === 1) {
                throw new Error('No valid fields to update');
            }

            // Add ID as last parameter
            values.push(id);

            const query = `
                UPDATE roles 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING id, role_name, role_description, role_level, is_system_role, updated_at
            `;

            const result = await db.query(query, values);
            
            logger.info('Role updated successfully', { 
                roleId: id,
                updates: Object.keys(updates)
            });
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating role', { 
                error: error.message,
                roleId: id 
            });
            throw error;
        }
    },

    /**
     * Delete role (soft delete)
     * @param {string} id - Role ID
     * @param {string} deletedBy - User performing deletion
     */
    async delete(id, deletedBy) {
        try {
            // Check if role exists and is not system role
            const role = await this.findById(id);
            if (!role) {
                throw new Error('Role not found');
            }

            if (role.is_system_role) {
                throw new Error('Cannot delete system role');
            }

            // Check if role has any users assigned
            const userCheck = await db.query(
                'SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1 AND is_active = true',
                [id]
            );

            if (parseInt(userCheck.rows[0].count) > 0) {
                throw new Error('Cannot delete role with assigned users');
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

            const result = await db.query(query, [deletedBy, id]);
            
            logger.info('Role soft deleted', { 
                roleId: id,
                deletedBy 
            });
            
            return true;
        } catch (error) {
            logger.error('Error deleting role', { 
                error: error.message,
                roleId: id 
            });
            throw error;
        }
    },

    /**
     * Get all roles with pagination
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of roles
     */
    async getAll(options = {}) {
        try {
            const { limit = 20, offset = 0, includeSystem = true } = options;

            let query = `
                SELECT 
                    id, role_name, role_description, role_level, 
                    is_system_role, created_at, updated_at, created_by
                FROM roles 
                WHERE is_deleted = false
            `;

            if (!includeSystem) {
                query += ` AND is_system_role = false`;
            }

            query += ` ORDER BY role_level DESC, role_name ASC LIMIT $1 OFFSET $2`;

            const result = await db.query(query, [limit, offset]);
            
            logger.debug('Retrieved all roles', { count: result.rows.length });
            return result.rows;
        } catch (error) {
            logger.error('Error getting roles', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count total roles
     * @param {Object} filters - Filters
     * @returns {Promise<number>} Total count
     */
    async count(filters = {}) {
        try {
            let query = 'SELECT COUNT(*) as total FROM roles WHERE is_deleted = false';
            const values = [];

            if (filters.includeSystem === false) {
                query += ' AND is_system_role = false';
            }

            const result = await db.query(query, values);
            return parseInt(result.rows[0].total);
        } catch (error) {
            logger.error('Error counting roles', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get permissions for a role
     * @param {string} roleId - Role ID
     * @returns {Promise<Array>} List of permissions
     */
    async getPermissions(roleId) {
        try {
            const query = `
                SELECT p.id, p.permission_name, p.permission_category,
                       p.resource_type, p.resource_name, p.action_type,
                       p.description, rp.grant_type, rp.conditions
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role_id = $1
                ORDER BY p.permission_category, p.permission_name
            `;

            const result = await db.query(query, [roleId]);
            
            logger.debug('Retrieved role permissions', { 
                roleId, 
                count: result.rows.length 
            });
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting role permissions', { 
                error: error.message,
                roleId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Assign permission to role
     * @param {string} roleId - Role ID
     * @param {string} permissionId - Permission ID
     * @param {string} assignedBy - User assigning permission
     * @param {Object} options - Additional options (grant_type, conditions)
     */
    async assignPermission(roleId, permissionId, assignedBy, options = {}) {
        try {
            const { grant_type = 'allow', conditions = null } = options;

            // Check if assignment already exists
            const checkQuery = `
                SELECT id FROM role_permissions 
                WHERE role_id = $1 AND permission_id = $2
            `;
            const checkResult = await db.query(checkQuery, [roleId, permissionId]);

            if (checkResult.rows.length > 0) {
                // Update existing
                const updateQuery = `
                    UPDATE role_permissions 
                    SET grant_type = $1, conditions = $2, updated_at = NOW()
                    WHERE role_id = $3 AND permission_id = $4
                    RETURNING id
                `;
                await db.query(updateQuery, [grant_type, conditions, roleId, permissionId]);
                
                logger.info('Role permission updated', { roleId, permissionId, assignedBy });
            } else {
                // Insert new
                const insertQuery = `
                    INSERT INTO role_permissions (role_id, permission_id, grant_type, conditions, created_by)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                `;
                await db.query(insertQuery, [roleId, permissionId, grant_type, conditions, assignedBy]);
                
                logger.info('Role permission assigned', { roleId, permissionId, assignedBy });
            }

            return true;
        } catch (error) {
            logger.error('Error assigning permission to role', { 
                error: error.message,
                roleId,
                permissionId
            });
            throw error;
        }
    },

    /**
     * Remove permission from role
     * @param {string} roleId - Role ID
     * @param {string} permissionId - Permission ID
     */
    async removePermission(roleId, permissionId) {
        try {
            const query = `
                DELETE FROM role_permissions 
                WHERE role_id = $1 AND permission_id = $2
                RETURNING id
            `;

            const result = await db.query(query, [roleId, permissionId]);
            
            if (result.rows.length === 0) {
                throw new Error('Permission assignment not found');
            }

            logger.info('Permission removed from role', { roleId, permissionId });
            return true;
        } catch (error) {
            logger.error('Error removing permission from role', { 
                error: error.message,
                roleId,
                permissionId
            });
            throw error;
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
 *     role_name: 'department_head',
 *     role_description: 'Department Head with elevated privileges',
 *     role_level: 85
 * }, adminUserId);
 * 
 * // Get role by name
 * const role = await Role.findByName('doctor');
 * 
 * // Update role
 * const updated = await Role.update(roleId, {
 *     role_description: 'Updated description',
 *     role_level: 82
 * });
 * 
 * // Get all roles
 * const roles = await Role.getAll({ limit: 10, offset: 0 });
 * 
 * // Get role permissions
 * const permissions = await Role.getPermissions(roleId);
 * 
 * // Assign permission to role
 * await Role.assignPermission(roleId, permissionId, adminUserId, {
 *     grant_type: 'allow',
 *     conditions: { department: 'cardiology' }
 * });
 * 
 * // Remove permission from role
 * await Role.removePermission(roleId, permissionId);
 * 
 * ======================================================================
 */