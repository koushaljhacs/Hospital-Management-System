/**
 * ======================================================================
 * FILE: backend/src/services/admin/roleService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Role management service handling business logic for role operations.
 * Includes role CRUD, permission assignment, and user-role management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - Role model
 * - Permission model
 * - User model
 * - logger
 * 
 * BUSINESS RULES:
 * - System roles cannot be deleted or modified (name/level)
 * - Role names must be unique
 * - Role level affects permission hierarchy
 * - Cannot delete role with assigned users
 * - All role operations are audited
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const Role = require('../../models/Role');
const Permission = require('../../models/Permission');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const db = require('../../config/database');

/**
 * Role Service - Business logic for role management
 */
const roleService = {
    /**
     * Get all roles with pagination and filtering
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Roles list and pagination info
     */
    async getAllRoles(options = {}) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                includeSystem = true,
                search
            } = options;

            const offset = (page - 1) * limit;

            let roles;
            let total;

            if (search) {
                // Search roles by name or description
                const searchResult = await db.query(`
                    SELECT 
                        id, role_name, role_description, role_level, 
                        is_system_role, created_at, updated_at,
                        (SELECT COUNT(*) FROM user_roles WHERE role_id = roles.id AND is_active = true) as user_count
                    FROM roles
                    WHERE (role_name ILIKE $1 OR role_description ILIKE $1)
                        AND is_deleted = false
                        ${includeSystem ? '' : 'AND is_system_role = false'}
                    ORDER BY role_level DESC, role_name
                    LIMIT $2 OFFSET $3
                `, [`%${search}%`, limit, offset]);

                const countResult = await db.query(`
                    SELECT COUNT(*) as total
                    FROM roles
                    WHERE (role_name ILIKE $1 OR role_description ILIKE $1)
                        AND is_deleted = false
                        ${includeSystem ? '' : 'AND is_system_role = false'}
                `, [`%${search}%`]);

                roles = searchResult.rows;
                total = parseInt(countResult.rows[0].total);
            } else {
                // Get all roles with pagination
                roles = await Role.getAll({ limit, offset, includeSystem });
                
                // Add user count to each role
                for (const role of roles) {
                    const countResult = await db.query(`
                        SELECT COUNT(*) as count 
                        FROM user_roles 
                        WHERE role_id = $1 AND is_active = true
                    `, [role.id]);
                    role.user_count = parseInt(countResult.rows[0].count);
                }

                total = await Role.count({ includeSystem });
            }

            logger.info('Roles retrieved', { 
                count: roles.length, 
                total,
                page,
                includeSystem
            });

            return {
                data: roles,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting roles', { error: error.message, options });
            throw new Error(`Failed to get roles: ${error.message}`);
        }
    },

    /**
     * Get role by ID with full details
     * @param {string} roleId - Role ID
     * @returns {Promise<Object>} Role details with permissions and users
     */
    async getRoleById(roleId) {
        try {
            // Get basic role info
            const role = await Role.findById(roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            // Get role permissions
            const permissions = await Role.getPermissions(roleId);

            // Get users with this role
            const usersResult = await db.query(`
                SELECT 
                    u.id, u.username, u.email, u.role as primary_role,
                    u.status, u.created_at,
                    ur.assigned_at, ur.expires_at
                FROM user_roles ur
                JOIN users u ON ur.user_id = u.id
                WHERE ur.role_id = $1 AND ur.is_active = true
                ORDER BY u.created_at DESC
                LIMIT 50
            `, [roleId]);

            // Get permission categories for grouping
            const categories = {};
            permissions.forEach(perm => {
                if (!categories[perm.permission_category]) {
                    categories[perm.permission_category] = [];
                }
                categories[perm.permission_category].push(perm);
            });

            const roleDetails = {
                ...role,
                permissions: {
                    list: permissions,
                    categories,
                    total: permissions.length
                },
                users: usersResult.rows,
                usersCount: usersResult.rows.length
            };

            logger.debug('Role details retrieved', { 
                roleId, 
                permissionsCount: permissions.length,
                usersCount: usersResult.rows.length 
            });

            return roleDetails;
        } catch (error) {
            logger.error('Error getting role by ID', { error: error.message, roleId });
            throw error;
        }
    },

    /**
     * Create new role
     * @param {Object} roleData - Role data
     * @param {string} createdBy - User ID creating the role
     * @returns {Promise<Object>} Created role
     */
    async createRole(roleData, createdBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Check if role name already exists
            const existing = await Role.findByName(roleData.role_name);
            if (existing) {
                throw new Error('Role name already exists');
            }

            // Validate role level
            if (roleData.role_level && (roleData.role_level < 1 || roleData.role_level > 100)) {
                throw new Error('Role level must be between 1 and 100');
            }

            // Create role
            const role = await Role.create({
                role_name: roleData.role_name,
                role_description: roleData.role_description,
                role_level: roleData.role_level || 1,
                is_system_role: false
            }, createdBy);

            // Assign initial permissions if provided
            if (roleData.permissions && roleData.permissions.length > 0) {
                for (const permId of roleData.permissions) {
                    await Role.assignPermission(role.id, permId, createdBy);
                }
            }

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'create', $1, 'role_create',
                    'roles', $2, $3, $4, $5
                )
            `, [createdBy, role.id, JSON.stringify(roleData), createdBy.ip, createdBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Role created successfully', { 
                roleId: role.id, 
                roleName: role.role_name,
                createdBy 
            });

            return role;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating role', { error: error.message, roleData });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update role
     * @param {string} roleId - Role ID
     * @param {Object} updates - Fields to update
     * @param {string} updatedBy - User ID performing update
     * @returns {Promise<Object>} Updated role
     */
    async updateRole(roleId, updates, updatedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Get current role data for audit
            const currentRole = await Role.findById(roleId);
            if (!currentRole) {
                throw new Error('Role not found');
            }

            // Check if trying to update system role
            if (currentRole.is_system_role && (updates.role_name || updates.role_level !== undefined)) {
                throw new Error('Cannot modify system role name or level');
            }

            // Check if new role name already exists
            if (updates.role_name && updates.role_name !== currentRole.role_name) {
                const existing = await Role.findByName(updates.role_name);
                if (existing) {
                    throw new Error('Role name already exists');
                }
            }

            // Update role
            const updatedRole = await Role.update(roleId, updates);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'update', $1, 'role_update',
                    'roles', $2, $3, $4, $5, $6
                )
            `, [updatedBy, roleId, JSON.stringify(currentRole), JSON.stringify(updates), 
                updatedBy.ip, updatedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Role updated successfully', { 
                roleId, 
                updatedBy,
                updates: Object.keys(updates)
            });

            return updatedRole;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating role', { error: error.message, roleId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete role
     * @param {string} roleId - Role ID
     * @param {string} deletedBy - User ID performing deletion
     */
    async deleteRole(roleId, deletedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Get role data for audit
            const role = await Role.findById(roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            // Check if system role
            if (role.is_system_role) {
                throw new Error('Cannot delete system role');
            }

            // Check if role has users assigned
            const userCount = await db.query(`
                SELECT COUNT(*) as count 
                FROM user_roles 
                WHERE role_id = $1 AND is_active = true
            `, [roleId]);

            if (parseInt(userCount.rows[0].count) > 0) {
                throw new Error('Cannot delete role with assigned users');
            }

            // Soft delete role
            await Role.delete(roleId, deletedBy);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'delete', $1, 'role_delete',
                    'roles', $2, $3, $4, $5
                )
            `, [deletedBy, roleId, JSON.stringify(role), deletedBy.ip, deletedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Role deleted', { roleId, deletedBy });
            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting role', { error: error.message, roleId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get role permissions
     * @param {string} roleId - Role ID
     * @returns {Promise<Array>} List of permissions
     */
    async getRolePermissions(roleId) {
        try {
            const role = await Role.findById(roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            const permissions = await Role.getPermissions(roleId);
            
            // Group by category for easier consumption
            const grouped = {};
            permissions.forEach(perm => {
                if (!grouped[perm.permission_category]) {
                    grouped[perm.permission_category] = [];
                }
                grouped[perm.permission_category].push(perm);
            });

            return {
                roleId,
                roleName: role.role_name,
                total: permissions.length,
                list: permissions,
                grouped
            };
        } catch (error) {
            logger.error('Error getting role permissions', { error: error.message, roleId });
            throw error;
        }
    },

    /**
     * Assign permission to role
     * @param {string} roleId - Role ID
     * @param {string} permissionId - Permission ID
     * @param {string} assignedBy - User ID assigning permission
     * @param {Object} options - Assignment options
     */
    async assignPermissionToRole(roleId, permissionId, assignedBy, options = {}) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Check if role exists
            const role = await Role.findById(roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            // Check if permission exists
            const permission = await Permission.findById(permissionId);
            if (!permission) {
                throw new Error('Permission not found');
            }

            // Assign permission
            await Role.assignPermission(roleId, permissionId, assignedBy, options);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'assign', $1, 'permission_assign',
                    'role_permissions', $2, $3, $4, $5
                )
            `, [assignedBy, `${roleId}-${permissionId}`, 
                JSON.stringify({ roleId, permissionId, options }), 
                assignedBy.ip, assignedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Permission assigned to role', { 
                roleId, 
                permissionId, 
                assignedBy 
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error assigning permission to role', { 
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
     * Remove permission from role
     * @param {string} roleId - Role ID
     * @param {string} permissionId - Permission ID
     * @param {string} removedBy - User ID removing permission
     */
    async removePermissionFromRole(roleId, permissionId, removedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Remove permission
            await Role.removePermission(roleId, permissionId);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'remove', $1, 'permission_remove',
                    'role_permissions', $2, $3, $4, $5
                )
            `, [removedBy, `${roleId}-${permissionId}`, 
                JSON.stringify({ roleId, permissionId }), 
                removedBy.ip, removedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Permission removed from role', { 
                roleId, 
                permissionId, 
                removedBy 
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
     * Bulk assign permissions to role
     * @param {string} roleId - Role ID
     * @param {Array} permissionIds - Array of permission IDs
     * @param {string} assignedBy - User ID assigning permissions
     */
    async bulkAssignPermissions(roleId, permissionIds, assignedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const results = {
                success: [],
                failed: []
            };

            for (const permissionId of permissionIds) {
                try {
                    await Role.assignPermission(roleId, permissionId, assignedBy);
                    results.success.push(permissionId);
                } catch (error) {
                    results.failed.push({ permissionId, error: error.message });
                }
            }

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'bulk_assign', $1, 'permissions_bulk_assign',
                    'role_permissions', $2, $3, $4, $5
                )
            `, [assignedBy, roleId, JSON.stringify({ success: results.success, failed: results.failed }), 
                assignedBy.ip, assignedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Bulk permissions assigned to role', { 
                roleId,
                total: permissionIds.length,
                success: results.success.length,
                failed: results.failed.length
            });

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error in bulk permission assignment', { 
                error: error.message, 
                roleId 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get users with specific role
     * @param {string} roleId - Role ID
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Users list
     */
    async getRoleUsers(roleId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const role = await Role.findById(roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            const users = await db.query(`
                SELECT 
                    u.id, u.username, u.email, u.role as primary_role,
                    u.status, u.created_at,
                    ur.assigned_at, ur.expires_at
                FROM user_roles ur
                JOIN users u ON ur.user_id = u.id
                WHERE ur.role_id = $1 AND ur.is_active = true
                ORDER BY u.created_at DESC
                LIMIT $2 OFFSET $3
            `, [roleId, limit, offset]);

            const total = await db.query(`
                SELECT COUNT(*) as count
                FROM user_roles
                WHERE role_id = $1 AND is_active = true
            `, [roleId]);

            return {
                roleId,
                roleName: role.role_name,
                data: users.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(total.rows[0].count),
                    pages: Math.ceil(parseInt(total.rows[0].count) / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting role users', { error: error.message, roleId });
            throw error;
        }
    },

    /**
     * Get role hierarchy
     * @returns {Promise<Array>} Roles ordered by level
     */
    async getRoleHierarchy() {
        try {
            const roles = await db.query(`
                SELECT 
                    id, role_name, role_level, is_system_role,
                    role_description,
                    (SELECT COUNT(*) FROM user_roles WHERE role_id = roles.id AND is_active = true) as user_count
                FROM roles
                WHERE is_deleted = false
                ORDER BY role_level DESC, role_name ASC
            `);

            // Group by level for easier consumption
            const byLevel = {};
            roles.rows.forEach(role => {
                if (!byLevel[role.role_level]) {
                    byLevel[role.role_level] = [];
                }
                byLevel[role.role_level].push(role);
            });

            return {
                total: roles.rows.length,
                levels: Object.keys(byLevel).length,
                byLevel,
                list: roles.rows
            };
        } catch (error) {
            logger.error('Error getting role hierarchy', { error: error.message });
            throw error;
        }
    },

    /**
     * Initialize default roles (run during setup)
     * @param {string} createdBy - User ID creating roles
     */
    async initializeDefaultRoles(createdBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const defaultRoles = [
                { name: 'super_admin', level: 100, description: 'System Administrator with full access', system: true },
                { name: 'it_admin', level: 90, description: 'IT Administrator for system management', system: true },
                { name: 'billing_admin', level: 85, description: 'Billing Administrator', system: true },
                { name: 'doctor', level: 80, description: 'Medical Doctor', system: true },
                { name: 'radiologist', level: 75, description: 'Radiologist', system: true },
                { name: 'lab_technician', level: 70, description: 'Laboratory Technician', system: true },
                { name: 'pharmacist', level: 70, description: 'Pharmacist', system: true },
                { name: 'nurse', level: 65, description: 'Nurse', system: true },
                { name: 'receptionist', level: 60, description: 'Receptionist', system: true },
                { name: 'billing_staff', level: 55, description: 'Billing Staff', system: true },
                { name: 'ground_staff', level: 50, description: 'Ground Staff', system: true },
                { name: 'security_guard', level: 45, description: 'Security Guard', system: true },
                { name: 'patient', level: 40, description: 'Patient', system: true },
                { name: 'guest', level: 10, description: 'Guest User', system: true }
            ];

            for (const roleData of defaultRoles) {
                const existing = await Role.findByName(roleData.name);
                if (!existing) {
                    await Role.create({
                        role_name: roleData.name,
                        role_description: roleData.description,
                        role_level: roleData.level,
                        is_system_role: roleData.system
                    }, createdBy);
                    
                    logger.debug('Default role created', { role: roleData.name });
                }
            }

            await db.commitTransaction(client);

            logger.info('Default roles initialized', { 
                count: defaultRoles.length 
            });
            
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error initializing default roles', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = roleService;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Get all roles with pagination
 * const roles = await roleService.getAllRoles({ 
 *     page: 1, 
 *     limit: 20,
 *     includeSystem: true 
 * });
 * 
 * // Get role details with permissions
 * const role = await roleService.getRoleById(roleId);
 * 
 * // Create new role
 * const newRole = await roleService.createRole({
 *     role_name: 'department_head',
 *     role_description: 'Department Head',
 *     role_level: 85,
 *     permissions: [permId1, permId2]
 * }, adminUserId);
 * 
 * // Assign permission to role
 * await roleService.assignPermissionToRole(roleId, permissionId, adminUserId);
 * 
 * // Get role hierarchy
 * const hierarchy = await roleService.getRoleHierarchy();
 * 
 * // Initialize default roles (run once)
 * await roleService.initializeDefaultRoles(adminUserId);
 * 
 * ======================================================================
 */