/**
 * ======================================================================
 * FILE: backend/src/services/admin/permissionService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Permission management service handling business logic for permission operations.
 * Includes permission CRUD, categorization, and role-permission management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - Permission model
 * - Role model
 * - logger
 * 
 * BUSINESS RULES:
 * - Permission names must be unique and follow 'resource:action' format
 * - System permissions cannot be deleted
 * - Permission categories help organize UI
 * - All permission operations are audited
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const Permission = require('../../models/Permission');
const Role = require('../../models/Role');
const logger = require('../../utils/logger');
const db = require('../../config/database');

/**
 * Permission categories for organization
 */
const PERMISSION_CATEGORIES = [
    'admin',
    'user',
    'patient',
    'clinical',
    'appointment',
    'prescription',
    'lab',
    'radiology',
    'pharmacy',
    'billing',
    'inventory',
    'facility',
    'report',
    'integration',
    'system'
];

/**
 * Permission Service - Business logic for permission management
 */
const permissionService = {
    /**
     * Get all permissions with pagination and filtering
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Permissions list and pagination info
     */
    async getAllPermissions(options = {}) {
        try {
            const { 
                page = 1, 
                limit = 50, 
                category,
                resource,
                action,
                search
            } = options;

            const offset = (page - 1) * limit;

            let permissions;
            let total;

            if (search) {
                // Search permissions
                permissions = await Permission.search(search);
                total = permissions.length;
                
                // Apply pagination manually since search returns all
                permissions = permissions.slice(offset, offset + limit);
            } else {
                // Get with filters
                permissions = await Permission.getAll({ 
                    limit, 
                    offset, 
                    category,
                    resource,
                    action 
                });
                total = await this.countPermissions({ category, resource, action });
            }

            // Get role assignments for each permission
            for (const perm of permissions) {
                const roleCount = await db.query(`
                    SELECT COUNT(DISTINCT role_id) as count
                    FROM role_permissions
                    WHERE permission_id = $1
                `, [perm.id]);
                perm.assigned_to_roles = parseInt(roleCount.rows[0].count);
            }

            logger.info('Permissions retrieved', { 
                count: permissions.length, 
                total,
                page,
                filters: { category, resource, action, search }
            });

            return {
                data: permissions,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting permissions', { error: error.message, options });
            throw new Error(`Failed to get permissions: ${error.message}`);
        }
    },

    /**
     * Count permissions with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<number>} Total count
     */
    async countPermissions(filters = {}) {
        try {
            let query = 'SELECT COUNT(*) as total FROM permissions WHERE 1=1';
            const values = [];
            let paramIndex = 1;

            if (filters.category) {
                query += ` AND permission_category = $${paramIndex}`;
                values.push(filters.category);
                paramIndex++;
            }

            if (filters.resource) {
                query += ` AND resource_name = $${paramIndex}`;
                values.push(filters.resource);
                paramIndex++;
            }

            if (filters.action) {
                query += ` AND action_type = $${paramIndex}`;
                values.push(filters.action);
                paramIndex++;
            }

            const result = await db.query(query, values);
            return parseInt(result.rows[0].total);
        } catch (error) {
            logger.error('Error counting permissions', { error: error.message, filters });
            throw error;
        }
    },

    /**
     * Get permission by ID
     * @param {string} permissionId - Permission ID
     * @returns {Promise<Object>} Permission details
     */
    async getPermissionById(permissionId) {
        try {
            const permission = await Permission.findById(permissionId);
            if (!permission) {
                throw new Error('Permission not found');
            }

            // Get roles that have this permission
            const rolesResult = await db.query(`
                SELECT 
                    r.id, r.role_name, r.role_level, r.is_system_role,
                    rp.grant_type, rp.conditions, rp.created_at as assigned_at
                FROM role_permissions rp
                JOIN roles r ON rp.role_id = r.id
                WHERE rp.permission_id = $1
                ORDER BY r.role_level DESC, r.role_name
            `, [permissionId]);

            permission.assigned_to_roles = rolesResult.rows;
            permission.assigned_to_roles_count = rolesResult.rows.length;

            logger.debug('Permission details retrieved', { 
                permissionId,
                rolesCount: rolesResult.rows.length 
            });

            return permission;
        } catch (error) {
            logger.error('Error getting permission by ID', { error: error.message, permissionId });
            throw error;
        }
    },

    /**
     * Create new permission
     * @param {Object} permissionData - Permission data
     * @param {string} createdBy - User ID creating the permission
     * @returns {Promise<Object>} Created permission
     */
    async createPermission(permissionData, createdBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Validate permission name format
            if (!this.validatePermissionName(permissionData.permission_name)) {
                throw new Error('Invalid permission name format. Must be "resource:action"');
            }

            // Check if permission already exists
            const existing = await Permission.findByName(permissionData.permission_name);
            if (existing) {
                throw new Error('Permission already exists');
            }

            // Validate category
            if (permissionData.permission_category && 
                !PERMISSION_CATEGORIES.includes(permissionData.permission_category)) {
                throw new Error(`Invalid category. Must be one of: ${PERMISSION_CATEGORIES.join(', ')}`);
            }

            // Create permission
            const permission = await Permission.create(permissionData);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'create', $1, 'permission_create',
                    'permissions', $2, $3, $4, $5
                )
            `, [createdBy.id, permission.id, JSON.stringify(permissionData),
                createdBy.ip, createdBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Permission created successfully', { 
                permissionId: permission.id, 
                permissionName: permission.permission_name,
                createdBy 
            });

            return permission;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating permission', { error: error.message, permissionData });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update permission
     * @param {string} permissionId - Permission ID
     * @param {Object} updates - Fields to update
     * @param {string} updatedBy - User ID performing update
     * @returns {Promise<Object>} Updated permission
     */
    async updatePermission(permissionId, updates, updatedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Get current permission for audit
            const currentPermission = await Permission.findById(permissionId);
            if (!currentPermission) {
                throw new Error('Permission not found');
            }

            // Only description can be updated for existing permissions
            const allowedUpdates = ['description'];
            const filteredUpdates = {};
            
            for (const key of allowedUpdates) {
                if (updates[key] !== undefined) {
                    filteredUpdates[key] = updates[key];
                }
            }

            if (Object.keys(filteredUpdates).length === 0) {
                throw new Error('No valid fields to update');
            }

            // Update permission
            const updatedPermission = await Permission.update(permissionId, filteredUpdates);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'update', $1, 'permission_update',
                    'permissions', $2, $3, $4, $5, $6
                )
            `, [updatedBy.id, permissionId, JSON.stringify(currentPermission),
                JSON.stringify(filteredUpdates), updatedBy.ip, updatedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Permission updated successfully', { 
                permissionId, 
                updatedBy,
                updates: Object.keys(filteredUpdates)
            });

            return updatedPermission;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating permission', { error: error.message, permissionId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete permission
     * @param {string} permissionId - Permission ID
     * @param {string} deletedBy - User ID performing deletion
     */
    async deletePermission(permissionId, deletedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Get permission for audit
            const permission = await Permission.findById(permissionId);
            if (!permission) {
                throw new Error('Permission not found');
            }

            // Check if system permission
            const systemPermissions = [
                'user:create', 'user:read', 'user:update', 'user:delete',
                'patient:create', 'patient:read', 'patient:update', 'patient:delete'
            ];

            if (systemPermissions.includes(permission.permission_name)) {
                throw new Error('Cannot delete system permission');
            }

            // Check if permission is assigned to any role
            const assigned = await db.query(`
                SELECT COUNT(*) as count 
                FROM role_permissions 
                WHERE permission_id = $1
            `, [permissionId]);

            if (parseInt(assigned.rows[0].count) > 0) {
                throw new Error('Cannot delete permission assigned to roles');
            }

            // Delete permission
            await Permission.delete(permissionId);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'delete', $1, 'permission_delete',
                    'permissions', $2, $3, $4, $5
                )
            `, [deletedBy.id, permissionId, JSON.stringify(permission),
                deletedBy.ip, deletedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Permission deleted', { permissionId, deletedBy });
            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting permission', { error: error.message, permissionId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get permissions by category
     * @param {string} category - Permission category
     * @returns {Promise<Array>} Permissions in category
     */
    async getPermissionsByCategory(category) {
        try {
            if (!PERMISSION_CATEGORIES.includes(category)) {
                throw new Error(`Invalid category. Must be one of: ${PERMISSION_CATEGORIES.join(', ')}`);
            }

            const permissions = await Permission.getByCategory(category);
            
            // Group by resource
            const byResource = {};
            permissions.forEach(perm => {
                if (!byResource[perm.resource_name]) {
                    byResource[perm.resource_name] = [];
                }
                byResource[perm.resource_name].push(perm);
            });

            return {
                category,
                total: permissions.length,
                resources: Object.keys(byResource).length,
                byResource,
                list: permissions
            };
        } catch (error) {
            logger.error('Error getting permissions by category', { error: error.message, category });
            throw error;
        }
    },

    /**
     * Get all permission categories with counts
     * @returns {Promise<Array>} Categories with counts
     */
    async getPermissionCategories() {
        try {
            const result = await db.query(`
                SELECT 
                    permission_category,
                    COUNT(*) as total,
                    COUNT(DISTINCT resource_name) as resources,
                    COUNT(DISTINCT action_type) as actions
                FROM permissions
                GROUP BY permission_category
                ORDER BY permission_category
            `);

            const categories = result.rows.map(row => ({
                name: row.permission_category,
                total: parseInt(row.total),
                resources: parseInt(row.resources),
                actions: parseInt(row.actions)
            }));

            // Add predefined categories that might have no permissions yet
            for (const cat of PERMISSION_CATEGORIES) {
                if (!categories.find(c => c.name === cat)) {
                    categories.push({
                        name: cat,
                        total: 0,
                        resources: 0,
                        actions: 0
                    });
                }
            }

            return categories.sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            logger.error('Error getting permission categories', { error: error.message });
            throw error;
        }
    },

    /**
     * Get permissions for a role
     * @param {string} roleId - Role ID
     * @returns {Promise<Object>} Permissions with assignment status
     */
    async getPermissionsForRole(roleId) {
        try {
            // Check if role exists
            const role = await Role.findById(roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            // Get all permissions
            const allPermissions = await Permission.getAll({ limit: 1000 });
            
            // Get permissions assigned to this role
            const assignedResult = await db.query(`
                SELECT permission_id, grant_type, conditions
                FROM role_permissions
                WHERE role_id = $1
            `, [roleId]);

            const assignedIds = new Set(assignedResult.rows.map(r => r.permission_id));
            
            // Build permission tree
            const categorized = {};
            
            for (const perm of allPermissions) {
                if (!categorized[perm.permission_category]) {
                    categorized[perm.permission_category] = {
                        category: perm.permission_category,
                        permissions: []
                    };
                }
                
                categorized[perm.permission_category].permissions.push({
                    ...perm,
                    assigned: assignedIds.has(perm.id),
                    grant_type: assignedResult.rows.find(r => r.permission_id === perm.id)?.grant_type || null,
                    conditions: assignedResult.rows.find(r => r.permission_id === perm.id)?.conditions || null
                });
            }

            return {
                roleId,
                roleName: role.role_name,
                totalPermissions: allPermissions.length,
                assignedCount: assignedIds.size,
                categories: Object.values(categorized)
            };
        } catch (error) {
            logger.error('Error getting permissions for role', { error: error.message, roleId });
            throw error;
        }
    },

    /**
     * Validate permission name format
     * @param {string} name - Permission name
     * @returns {boolean} True if valid
     */
    validatePermissionName(name) {
        // Format should be "resource:action" (e.g., "patient:read", "user:create")
        const pattern = /^[a-z]+:[a-z]+$/;
        return pattern.test(name);
    },

    /**
     * Parse permission name into components
     * @param {string} name - Permission name
     * @returns {Object} Parsed components
     */
    parsePermissionName(name) {
        const [resource, action] = name.split(':');
        return { resource, action };
    },

    /**
     * Check if user has permission
     * @param {string} userId - User ID
     * @param {string} permissionName - Permission name
     * @returns {Promise<boolean>} True if user has permission
     */
    async userHasPermission(userId, permissionName) {
        try {
            const result = await db.query(`
                SELECT EXISTS(
                    SELECT 1
                    FROM user_roles ur
                    JOIN role_permissions rp ON ur.role_id = rp.role_id
                    JOIN permissions p ON rp.permission_id = p.id
                    WHERE ur.user_id = $1 
                        AND p.permission_name = $2
                        AND ur.is_active = true
                        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                ) as has_permission
            `, [userId, permissionName]);

            return result.rows[0].has_permission;
        } catch (error) {
            logger.error('Error checking user permission', { 
                error: error.message, 
                userId, 
                permissionName 
            });
            return false;
        }
    },

    /**
     * Get all permissions for a user
     * @param {string} userId - User ID
     * @returns {Promise<Array>} List of permissions
     */
    async getUserPermissions(userId) {
        try {
            const result = await db.query(`
                SELECT DISTINCT 
                    p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type
                FROM user_roles ur
                JOIN role_permissions rp ON ur.role_id = rp.role_id
                JOIN permissions p ON rp.permission_id = p.id
                WHERE ur.user_id = $1 
                    AND ur.is_active = true
                    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
                ORDER BY p.permission_category, p.permission_name
            `, [userId]);

            return result.rows;
        } catch (error) {
            logger.error('Error getting user permissions', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Sync permissions from code to database
     * @param {Array} permissionList - List of permission definitions from code
     * @param {string} syncedBy - User ID performing sync
     */
    async syncPermissions(permissionList, syncedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const results = {
                created: [],
                updated: [],
                skipped: [],
                errors: []
            };

            for (const permDef of permissionList) {
                try {
                    // Validate format
                    if (!this.validatePermissionName(permDef.name)) {
                        results.skipped.push({ name: permDef.name, reason: 'Invalid format' });
                        continue;
                    }

                    const { resource, action } = this.parsePermissionName(permDef.name);
                    
                    // Check if exists
                    const existing = await Permission.findByName(permDef.name);

                    if (!existing) {
                        // Create new
                        await Permission.create({
                            permission_name: permDef.name,
                            permission_category: permDef.category || resource,
                            resource_type: 'api',
                            resource_name: resource,
                            action_type: action,
                            description: permDef.description || `${resource} ${action} permission`
                        });
                        results.created.push(permDef.name);
                    } else {
                        // Update description if changed
                        if (permDef.description && existing.description !== permDef.description) {
                            await Permission.update(existing.id, { description: permDef.description });
                            results.updated.push(permDef.name);
                        }
                    }
                } catch (error) {
                    results.errors.push({ name: permDef.name, error: error.message });
                }
            }

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'sync', $1, 'permissions_sync',
                    'permissions', 'bulk', $2, $3, $4
                )
            `, [syncedBy.id, JSON.stringify(results), syncedBy.ip, syncedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Permissions sync completed', results);

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error syncing permissions', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = permissionService;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Get all permissions with filters
 * const permissions = await permissionService.getAllPermissions({ 
 *     page: 1, 
 *     limit: 50,
 *     category: 'patient'
 * });
 * 
 * // Get permission by ID
 * const permission = await permissionService.getPermissionById(permId);
 * 
 * // Create new permission
 * const newPerm = await permissionService.createPermission({
 *     permission_name: 'department:manage',
 *     permission_category: 'admin',
 *     description: 'Manage departments'
 * }, adminUserId);
 * 
 * // Get permissions by category
 * const patientPerms = await permissionService.getPermissionsByCategory('patient');
 * 
 * // Get permissions for role
 * const rolePerms = await permissionService.getPermissionsForRole(roleId);
 * 
 * // Check if user has permission
 * const hasAccess = await permissionService.userHasPermission(userId, 'patient:read');
 * 
 * // Get all permissions for user
 * const userPerms = await permissionService.getUserPermissions(userId);
 * 
 * // Sync permissions from code
 * await permissionService.syncPermissions([
 *     { name: 'patient:read', category: 'patient', description: 'View patient records' },
 *     { name: 'patient:write', category: 'patient', description: 'Modify patient records' }
 * ], adminUserId);
 * 
 * ======================================================================
 */