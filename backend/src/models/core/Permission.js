/**
 * ======================================================================
 * FILE: backend/src/models/core/Permission.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Permission model for database operations.
 * Handles all permission-related database queries for RBAC.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: permissions
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - permission_name: string (unique)
 * - permission_category: enum (patient, clinical, billing, admin, report)
 * - resource_type: enum (table, api, page, feature)
 * - resource_name: string
 * - action_type: enum (create, read, update, delete, execute)
 * - description: text
 * - created_at: timestamp
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

const Permission = {
    /**
     * Table name
     */
    tableName: 'permissions',

    /**
     * Find permission by ID
     * @param {string} id - Permission UUID
     * @returns {Promise<Object|null>} Permission object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                FROM permissions 
                WHERE id = $1 AND is_deleted = false
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Permission found by ID', { permissionId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding permission by ID', {
                error: error.message,
                permissionId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find permission by name
     * @param {string} permissionName - Permission name
     * @returns {Promise<Object|null>} Permission object or null
     */
    async findByName(permissionName) {
        try {
            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                FROM permissions 
                WHERE permission_name = $1 AND is_deleted = false
            `;
            
            const result = await db.query(query, [permissionName]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Permission found by name', { permissionName });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding permission by name', {
                error: error.message,
                permissionName
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all permissions with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {string} [filters.category] - Permission category
     * @param {string} [filters.resource_type] - Resource type
     * @param {string} [filters.action_type] - Action type
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of permissions
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.category) {
                conditions.push(`permission_category = $${paramIndex++}`);
                values.push(filters.category);
            }
            if (filters.resource_type) {
                conditions.push(`resource_type = $${paramIndex++}`);
                values.push(filters.resource_type);
            }
            if (filters.action_type) {
                conditions.push(`action_type = $${paramIndex++}`);
                values.push(filters.action_type);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                FROM permissions 
                ${whereClause}
                ORDER BY permission_category ASC, permission_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all permissions', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all permissions', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new permission
     * @param {Object} permissionData - Permission data
     * @param {string} permissionData.permission_name - Permission name
     * @param {string} permissionData.permission_category - Category (patient, clinical, billing, admin, report)
     * @param {string} permissionData.resource_type - Resource type (table, api, page, feature)
     * @param {string} permissionData.resource_name - Resource name
     * @param {string} permissionData.action_type - Action type (create, read, update, delete, execute)
     * @param {string} [permissionData.description] - Description
     * @returns {Promise<Object>} Created permission
     */
    async create(permissionData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existingPermission = await this.findByName(permissionData.permission_name);
            if (existingPermission) {
                throw new Error('Permission name already exists');
            }

            const query = `
                INSERT INTO permissions (
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
                )
                RETURNING 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
            `;

            const values = [
                permissionData.permission_name,
                permissionData.permission_category,
                permissionData.resource_type,
                permissionData.resource_name,
                permissionData.action_type,
                permissionData.description || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Permission created successfully', {
                permissionId: result.rows[0].id,
                permissionName: permissionData.permission_name,
                category: permissionData.permission_category
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating permission', {
                error: error.message,
                permissionName: permissionData.permission_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update permission
     * @param {string} id - Permission ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated permission
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const permission = await this.findById(id);
            if (!permission) {
                throw new Error('Permission not found');
            }

            if (updates.permission_name) {
                const existingPermission = await this.findByName(updates.permission_name);
                if (existingPermission && existingPermission.id !== id) {
                    throw new Error('Permission name already exists');
                }
            }

            const allowedFields = [
                'permission_name', 'permission_category',
                'resource_type', 'resource_name', 'action_type', 'description'
            ];

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

            values.push(id);

            const query = `
                UPDATE permissions 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Permission not found');
            }

            await db.commitTransaction(client);

            logger.info('Permission updated successfully', {
                permissionId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating permission', {
                error: error.message,
                permissionId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete permission (soft delete)
     * @param {string} id - Permission ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const permission = await this.findById(id);
            if (!permission) {
                throw new Error('Permission not found');
            }

            const rolePermissionQuery = `
                SELECT COUNT(*) as count FROM role_permissions 
                WHERE permission_id = $1
            `;
            const rolePermissionResult = await client.query(rolePermissionQuery, [id]);
            
            if (parseInt(rolePermissionResult.rows[0].count) > 0) {
                throw new Error('Cannot delete permission assigned to roles');
            }

            const userPermissionQuery = `
                SELECT COUNT(*) as count FROM user_permissions 
                WHERE permission_id = $1
            `;
            const userPermissionResult = await client.query(userPermissionQuery, [id]);
            
            if (parseInt(userPermissionResult.rows[0].count) > 0) {
                throw new Error('Cannot delete permission assigned to users');
            }

            const query = `
                UPDATE permissions 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Permission not found');
            }

            await db.commitTransaction(client);

            logger.info('Permission soft deleted', {
                permissionId: id,
                permissionName: permission.permission_name,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting permission', {
                error: error.message,
                permissionId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get permissions by role ID
     * @param {string} roleId - Role UUID
     * @returns {Promise<Array>} List of permissions
     */
    async getByRoleId(roleId) {
        try {
            const query = `
                SELECT 
                    p.id, p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    p.description, rp.grant_type, rp.conditions
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role_id = $1
                    AND p.is_deleted = false
                ORDER BY p.permission_category ASC, p.permission_name ASC
            `;

            const result = await db.query(query, [roleId]);

            logger.debug('Permissions found by role ID', {
                roleId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting permissions by role ID', {
                error: error.message,
                roleId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get permissions by user ID (including role permissions)
     * @param {string} userId - User UUID
     * @returns {Promise<Array>} List of permissions
     */
    async getByUserId(userId) {
        try {
            const query = `
                SELECT DISTINCT
                    p.id, p.permission_name, p.permission_category,
                    p.resource_type, p.resource_name, p.action_type,
                    p.description,
                    CASE 
                        WHEN up.grant_type IS NOT NULL THEN up.grant_type
                        ELSE rp.grant_type
                    END as grant_type,
                    COALESCE(up.conditions, rp.conditions) as conditions
                FROM permissions p
                LEFT JOIN role_permissions rp ON p.id = rp.permission_id
                LEFT JOIN user_roles ur ON rp.role_id = ur.role_id
                LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = $1
                WHERE (ur.user_id = $1 AND ur.is_active = true)
                    OR (up.user_id = $1)
                    AND p.is_deleted = false
                ORDER BY p.permission_category ASC, p.permission_name ASC
            `;

            const result = await db.query(query, [userId]);

            logger.debug('Permissions found by user ID', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting permissions by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get permissions by category
     * @param {string} category - Permission category
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of permissions
     */
    async getByCategory(category, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                FROM permissions 
                WHERE permission_category = $1 AND is_deleted = false
                ORDER BY permission_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [category, limit, offset]);

            logger.debug('Permissions found by category', {
                category,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting permissions by category', {
                error: error.message,
                category
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get permissions by resource
     * @param {string} resourceType - Resource type (table, api, page, feature)
     * @param {string} resourceName - Resource name
     * @returns {Promise<Array>} List of permissions
     */
    async getByResource(resourceType, resourceName) {
        try {
            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description
                FROM permissions 
                WHERE resource_type = $1 
                    AND resource_name = $2
                    AND is_deleted = false
                ORDER BY action_type ASC
            `;

            const result = await db.query(query, [resourceType, resourceName]);

            logger.debug('Permissions found by resource', {
                resourceType,
                resourceName,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting permissions by resource', {
                error: error.message,
                resourceType,
                resourceName
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Check if user has permission
     * @param {string} userId - User UUID
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
                        WHEN rp.grant_type = 'deny' THEN false
                        WHEN rp.grant_type = 'allow' THEN true
                        ELSE false
                    END as has_permission
                FROM permissions p
                LEFT JOIN role_permissions rp ON p.id = rp.permission_id
                LEFT JOIN user_roles ur ON rp.role_id = ur.role_id
                LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = $1
                WHERE p.permission_name = $2
                    AND (ur.user_id = $1 OR up.user_id = $1)
                    AND p.is_deleted = false
                LIMIT 1
            `;

            const result = await db.query(query, [userId, permissionName]);

            if (result.rows.length === 0) {
                return false;
            }

            const hasPermission = result.rows[0].has_permission === true;

            logger.debug('User permission check', {
                userId,
                permissionName,
                hasPermission
            });

            return hasPermission;
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
     * Get permission categories (for UI)
     * @returns {Promise<Array>} List of categories with counts
     */
    async getCategories() {
        try {
            const query = `
                SELECT 
                    permission_category,
                    COUNT(*) as permission_count
                FROM permissions
                WHERE is_deleted = false
                GROUP BY permission_category
                ORDER BY permission_category
            `;

            const result = await db.query(query);

            logger.debug('Permission categories retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting permission categories', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count total permissions
     * @param {Object} filters - Filter conditions
     * @returns {Promise<number>} Total count
     */
    async count(filters = {}) {
        try {
            let query = 'SELECT COUNT(*) as total FROM permissions WHERE is_deleted = false';
            const values = [];
            const conditions = [];

            if (filters.category) {
                conditions.push(`permission_category = $${values.length + 1}`);
                values.push(filters.category);
            }
            if (filters.resource_type) {
                conditions.push(`resource_type = $${values.length + 1}`);
                values.push(filters.resource_type);
            }
            if (filters.action_type) {
                conditions.push(`action_type = $${values.length + 1}`);
                values.push(filters.action_type);
            }

            if (conditions.length > 0) {
                query += ' AND ' + conditions.join(' AND ');
            }

            const result = await db.query(query, values);

            return parseInt(result.rows[0].total);
        } catch (error) {
            logger.error('Error counting permissions', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Seed default permissions (for initial setup)
     * @returns {Promise<Array>} List of created permissions
     */
    async seedDefault() {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const defaultPermissions = [
                // Patient permissions
                { name: 'patient.view', category: 'patient', resource_type: 'api', resource_name: 'patient', action_type: 'read', description: 'View patient profile' },
                { name: 'patient.edit', category: 'patient', resource_type: 'api', resource_name: 'patient', action_type: 'update', description: 'Edit patient profile' },
                { name: 'patient.delete', category: 'patient', resource_type: 'api', resource_name: 'patient', action_type: 'delete', description: 'Delete patient record' },
                { name: 'patient.appointment.view', category: 'patient', resource_type: 'api', resource_name: 'appointment', action_type: 'read', description: 'View patient appointments' },
                { name: 'patient.appointment.book', category: 'patient', resource_type: 'api', resource_name: 'appointment', action_type: 'create', description: 'Book appointments' },
                { name: 'patient.prescription.view', category: 'patient', resource_type: 'api', resource_name: 'prescription', action_type: 'read', description: 'View prescriptions' },
                { name: 'patient.lab.view', category: 'patient', resource_type: 'api', resource_name: 'lab', action_type: 'read', description: 'View lab results' },
                { name: 'patient.billing.view', category: 'patient', resource_type: 'api', resource_name: 'billing', action_type: 'read', description: 'View bills and invoices' },
                
                // Clinical permissions
                { name: 'clinical.diagnosis.create', category: 'clinical', resource_type: 'api', resource_name: 'diagnosis', action_type: 'create', description: 'Create diagnosis' },
                { name: 'clinical.diagnosis.edit', category: 'clinical', resource_type: 'api', resource_name: 'diagnosis', action_type: 'update', description: 'Edit diagnosis' },
                { name: 'clinical.prescription.create', category: 'clinical', resource_type: 'api', resource_name: 'prescription', action_type: 'create', description: 'Create prescription' },
                { name: 'clinical.prescription.edit', category: 'clinical', resource_type: 'api', resource_name: 'prescription', action_type: 'update', description: 'Edit prescription' },
                { name: 'clinical.notes.create', category: 'clinical', resource_type: 'api', resource_name: 'notes', action_type: 'create', description: 'Create clinical notes' },
                { name: 'clinical.vitals.record', category: 'clinical', resource_type: 'api', resource_name: 'vitals', action_type: 'create', description: 'Record vitals' },
                
                // Billing permissions
                { name: 'billing.invoice.create', category: 'billing', resource_type: 'api', resource_name: 'invoice', action_type: 'create', description: 'Create invoice' },
                { name: 'billing.invoice.view', category: 'billing', resource_type: 'api', resource_name: 'invoice', action_type: 'read', description: 'View invoices' },
                { name: 'billing.payment.process', category: 'billing', resource_type: 'api', resource_name: 'payment', action_type: 'execute', description: 'Process payments' },
                { name: 'billing.refund.process', category: 'billing', resource_type: 'api', resource_name: 'refund', action_type: 'execute', description: 'Process refunds' },
                { name: 'billing.insurance.claim', category: 'billing', resource_type: 'api', resource_name: 'insurance', action_type: 'create', description: 'Submit insurance claims' },
                
                // Admin permissions
                { name: 'admin.user.create', category: 'admin', resource_type: 'api', resource_name: 'user', action_type: 'create', description: 'Create users' },
                { name: 'admin.user.edit', category: 'admin', resource_type: 'api', resource_name: 'user', action_type: 'update', description: 'Edit users' },
                { name: 'admin.user.delete', category: 'admin', resource_type: 'api', resource_name: 'user', action_type: 'delete', description: 'Delete users' },
                { name: 'admin.role.create', category: 'admin', resource_type: 'api', resource_name: 'role', action_type: 'create', description: 'Create roles' },
                { name: 'admin.role.edit', category: 'admin', resource_type: 'api', resource_name: 'role', action_type: 'update', description: 'Edit roles' },
                { name: 'admin.permission.assign', category: 'admin', resource_type: 'api', resource_name: 'permission', action_type: 'execute', description: 'Assign permissions' },
                { name: 'admin.system.config', category: 'admin', resource_type: 'api', resource_name: 'system', action_type: 'execute', description: 'Configure system settings' },
                { name: 'admin.audit.view', category: 'admin', resource_type: 'api', resource_name: 'audit', action_type: 'read', description: 'View audit logs' },
                
                // Report permissions
                { name: 'report.patient.generate', category: 'report', resource_type: 'api', resource_name: 'patient_report', action_type: 'execute', description: 'Generate patient reports' },
                { name: 'report.clinical.generate', category: 'report', resource_type: 'api', resource_name: 'clinical_report', action_type: 'execute', description: 'Generate clinical reports' },
                { name: 'report.financial.generate', category: 'report', resource_type: 'api', resource_name: 'financial_report', action_type: 'execute', description: 'Generate financial reports' },
                { name: 'report.operational.generate', category: 'report', resource_type: 'api', resource_name: 'operational_report', action_type: 'execute', description: 'Generate operational reports' },
                { name: 'report.export', category: 'report', resource_type: 'api', resource_name: 'export', action_type: 'execute', description: 'Export reports' }
            ];

            const created = [];

            for (const perm of defaultPermissions) {
                const existing = await this.findByName(perm.name);
                if (!existing) {
                    const result = await this.create({
                        permission_name: perm.name,
                        permission_category: perm.category,
                        resource_type: perm.resource_type,
                        resource_name: perm.resource_name,
                        action_type: perm.action_type,
                        description: perm.description
                    });
                    created.push(result);
                }
            }

            await db.commitTransaction(client);

            logger.info('Default permissions seeded', {
                createdCount: created.length
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error seeding default permissions', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Permission;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create new permission
 * const permission = await Permission.create({
 *     permission_name: 'patient.view',
 *     permission_category: 'patient',
 *     resource_type: 'api',
 *     resource_name: 'patient',
 *     action_type: 'read',
 *     description: 'View patient profile'
 * });
 * 
 * // Find permission by name
 * const permission = await Permission.findByName('patient.view');
 * 
 * // Get all permissions with filters
 * const permissions = await Permission.getAll(
 *     { category: 'patient', action_type: 'read' },
 *     { limit: 50, offset: 0 }
 * );
 * 
 * // Get permissions by role
 * const rolePermissions = await Permission.getByRoleId(roleId);
 * 
 * // Get permissions by user (including role permissions)
 * const userPermissions = await Permission.getByUserId(userId);
 * 
 * // Get permissions by category
 * const patientPerms = await Permission.getByCategory('patient');
 * 
 * // Get permissions by resource
 * const patientApiPerms = await Permission.getByResource('api', 'patient');
 * 
 * // Check if user has permission
 * const canView = await Permission.userHasPermission(userId, 'patient.view');
 * 
 * // Update permission
 * const updated = await Permission.update(permissionId, {
 *     description: 'Updated description'
 * });
 * 
 * // Get permission categories statistics
 * const categories = await Permission.getCategories();
 * 
 * // Count total permissions
 * const total = await Permission.count({ category: 'patient' });
 * 
 * // Delete permission (if not assigned)
 * await Permission.delete(permissionId, adminUserId);
 * 
 * // Seed default permissions (for initial setup)
 * await Permission.seedDefault();
 * 
 * ======================================================================
 */