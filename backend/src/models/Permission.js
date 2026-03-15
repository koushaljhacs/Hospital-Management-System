/**
 * ======================================================================
 * FILE: backend/src/models/Permission.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Permission model for granular access control.
 * Defines all available permissions in the system.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * TABLE: permissions
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - permission_name: string (unique)
 * - permission_category: string (patient/clinical/billing/admin)
 * - resource_type: string (table/api/page/feature)
 * - resource_name: string
 * - action_type: string (create/read/update/delete/execute)
 * - description: text
 * - created_at: timestamp
 * 
 * RELATIONSHIPS:
 * - One permission belongs to many roles (via role_permissions table)
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Predefined system permissions based on PERMISSIONS object from auth middleware
 * This ensures consistency between code and database
 */
const SYSTEM_PERMISSIONS = [
    // User management
    { name: 'user:create', category: 'admin', resource: 'user', action: 'create', description: 'Create new users' },
    { name: 'user:read', category: 'admin', resource: 'user', action: 'read', description: 'View user details' },
    { name: 'user:update', category: 'admin', resource: 'user', action: 'update', description: 'Update user details' },
    { name: 'user:delete', category: 'admin', resource: 'user', action: 'delete', description: 'Delete users' },
    
    // Patient management
    { name: 'patient:create', category: 'patient', resource: 'patient', action: 'create', description: 'Register new patients' },
    { name: 'patient:read', category: 'patient', resource: 'patient', action: 'read', description: 'View patient details' },
    { name: 'patient:update', category: 'patient', resource: 'patient', action: 'update', description: 'Update patient details' },
    { name: 'patient:delete', category: 'patient', resource: 'patient', action: 'delete', description: 'Delete patients' },
    
    // Appointment management
    { name: 'appointment:create', category: 'clinical', resource: 'appointment', action: 'create', description: 'Create appointments' },
    { name: 'appointment:read', category: 'clinical', resource: 'appointment', action: 'read', description: 'View appointments' },
    { name: 'appointment:update', category: 'clinical', resource: 'appointment', action: 'update', description: 'Update appointments' },
    { name: 'appointment:delete', category: 'clinical', resource: 'appointment', action: 'delete', description: 'Delete appointments' },
    { name: 'appointment:approve', category: 'clinical', resource: 'appointment', action: 'approve', description: 'Approve appointments' },
    
    // Medical records
    { name: 'medical:read', category: 'clinical', resource: 'medical', action: 'read', description: 'View medical records' },
    { name: 'medical:write', category: 'clinical', resource: 'medical', action: 'write', description: 'Write medical records' },
    { name: 'medical:delete', category: 'clinical', resource: 'medical', action: 'delete', description: 'Delete medical records' },
    
    // Prescriptions
    { name: 'prescription:create', category: 'clinical', resource: 'prescription', action: 'create', description: 'Create prescriptions' },
    { name: 'prescription:read', category: 'clinical', resource: 'prescription', action: 'read', description: 'View prescriptions' },
    { name: 'prescription:update', category: 'clinical', resource: 'prescription', action: 'update', description: 'Update prescriptions' },
    { name: 'prescription:dispense', category: 'pharmacy', resource: 'prescription', action: 'dispense', description: 'Dispense medications' },
    
    // Lab tests
    { name: 'lab:order', category: 'lab', resource: 'lab', action: 'order', description: 'Order lab tests' },
    { name: 'lab:read', category: 'lab', resource: 'lab', action: 'read', description: 'View lab results' },
    { name: 'lab:write', category: 'lab', resource: 'lab', action: 'write', description: 'Enter lab results' },
    { name: 'lab:verify', category: 'lab', resource: 'lab', action: 'verify', description: 'Verify lab results' },
    
    // Radiology
    { name: 'radiology:order', category: 'radiology', resource: 'radiology', action: 'order', description: 'Order radiology exams' },
    { name: 'radiology:read', category: 'radiology', resource: 'radiology', action: 'read', description: 'View radiology images' },
    { name: 'radiology:write', category: 'radiology', resource: 'radiology', action: 'write', description: 'Write radiology reports' },
    { name: 'radiology:upload', category: 'radiology', resource: 'radiology', action: 'upload', description: 'Upload radiology images' },
    
    // Pharmacy
    { name: 'pharmacy:read', category: 'pharmacy', resource: 'pharmacy', action: 'read', description: 'View pharmacy inventory' },
    { name: 'pharmacy:write', category: 'pharmacy', resource: 'pharmacy', action: 'write', description: 'Manage pharmacy inventory' },
    { name: 'pharmacy:dispense', category: 'pharmacy', resource: 'pharmacy', action: 'dispense', description: 'Dispense medications' },
    
    // Billing
    { name: 'billing:read', category: 'billing', resource: 'billing', action: 'read', description: 'View invoices' },
    { name: 'billing:write', category: 'billing', resource: 'billing', action: 'write', description: 'Create/update invoices' },
    { name: 'billing:delete', category: 'billing', resource: 'billing', action: 'delete', description: 'Delete invoices' },
    { name: 'billing:refund', category: 'billing', resource: 'billing', action: 'refund', description: 'Process refunds' },
    
    // Inventory
    { name: 'inventory:read', category: 'inventory', resource: 'inventory', action: 'read', description: 'View inventory' },
    { name: 'inventory:write', category: 'inventory', resource: 'inventory', action: 'write', description: 'Manage inventory' },
    { name: 'inventory:order', category: 'inventory', resource: 'inventory', action: 'order', description: 'Create purchase orders' },
    
    // Bed management
    { name: 'bed:read', category: 'facility', resource: 'bed', action: 'read', description: 'View bed status' },
    { name: 'bed:assign', category: 'facility', resource: 'bed', action: 'assign', description: 'Assign beds' },
    { name: 'bed:update', category: 'facility', resource: 'bed', action: 'update', description: 'Update bed status' },
    
    // Admin
    { name: 'admin:access', category: 'admin', resource: 'admin', action: 'access', description: 'Access admin panel' },
    { name: 'admin:users', category: 'admin', resource: 'admin', action: 'users', description: 'Manage users' },
    { name: 'admin:roles', category: 'admin', resource: 'admin', action: 'roles', description: 'Manage roles' },
    { name: 'admin:system', category: 'admin', resource: 'admin', action: 'system', description: 'System administration' },
    { name: 'admin:audit', category: 'admin', resource: 'admin', action: 'audit', description: 'View audit logs' },
    { name: 'admin:config', category: 'admin', resource: 'admin', action: 'config', description: 'Manage configuration' },
    
    // Reports
    { name: 'report:generate', category: 'report', resource: 'report', action: 'generate', description: 'Generate reports' },
    { name: 'report:export', category: 'report', resource: 'report', action: 'export', description: 'Export reports' }
];

/**
 * Permission model with database operations
 */
const Permission = {
    /**
     * Table name
     */
    tableName: 'permissions',

    /**
     * Find permission by ID
     * @param {string} id - Permission UUID
     * @returns {Promise<Object>} Permission object
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                FROM permissions 
                WHERE id = $1
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
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
     * @param {string} permissionName - Permission name (e.g., 'patient:read')
     * @returns {Promise<Object>} Permission object
     */
    async findByName(permissionName) {
        try {
            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                FROM permissions 
                WHERE permission_name = $1
            `;
            
            const result = await db.query(query, [permissionName]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
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
     * Create new permission
     * @param {Object} permissionData - Permission data
     * @returns {Promise<Object>} Created permission
     */
    async create(permissionData) {
        try {
            // Check if permission already exists
            const existing = await this.findByName(permissionData.permission_name);
            if (existing) {
                throw new Error('Permission already exists');
            }

            const query = `
                INSERT INTO permissions (
                    permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                RETURNING id, permission_name, permission_category,
                          resource_type, resource_name, action_type,
                          description, created_at
            `;

            const values = [
                permissionData.permission_name,
                permissionData.permission_category || 'other',
                permissionData.resource_type || 'api',
                permissionData.resource_name,
                permissionData.action_type,
                permissionData.description || null
            ];

            const result = await db.query(query, values);
            
            logger.info('Permission created successfully', { 
                permissionId: result.rows[0].id,
                permissionName: result.rows[0].permission_name
            });
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error creating permission', { 
                error: error.message,
                permissionName: permissionData.permission_name 
            });
            throw error;
        }
    },

    /**
     * Update permission
     * @param {string} id - Permission ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated permission
     */
    async update(id, updates) {
        try {
            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Allowed update fields
            const allowedFields = ['description'];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            // Add ID as last parameter
            values.push(id);

            const query = `
                UPDATE permissions 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING id, permission_name, permission_category,
                          resource_type, resource_name, action_type,
                          description, created_at
            `;

            const result = await db.query(query, values);
            
            if (result.rows.length === 0) {
                throw new Error('Permission not found');
            }

            logger.info('Permission updated successfully', { 
                permissionId: id,
                updates: Object.keys(updates)
            });
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating permission', { 
                error: error.message,
                permissionId: id 
            });
            throw error;
        }
    },

    /**
     * Delete permission
     * @param {string} id - Permission ID
     */
    async delete(id) {
        try {
            // Check if permission is assigned to any role
            const checkQuery = `
                SELECT COUNT(*) as count FROM role_permissions 
                WHERE permission_id = $1
            `;
            const checkResult = await db.query(checkQuery, [id]);

            if (parseInt(checkResult.rows[0].count) > 0) {
                throw new Error('Cannot delete permission assigned to roles');
            }

            const query = `
                DELETE FROM permissions 
                WHERE id = $1
                RETURNING id
            `;

            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                throw new Error('Permission not found');
            }

            logger.info('Permission deleted', { permissionId: id });
            return true;
        } catch (error) {
            logger.error('Error deleting permission', { 
                error: error.message,
                permissionId: id 
            });
            throw error;
        }
    },

    /**
     * Get all permissions with pagination and filtering
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of permissions
     */
    async getAll(options = {}) {
        try {
            const { 
                limit = 100, 
                offset = 0, 
                category,
                resource,
                action 
            } = options;

            let query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description, created_at
                FROM permissions 
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (category) {
                query += ` AND permission_category = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            if (resource) {
                query += ` AND resource_name = $${paramIndex}`;
                values.push(resource);
                paramIndex++;
            }

            if (action) {
                query += ` AND action_type = $${paramIndex}`;
                values.push(action);
                paramIndex++;
            }

            query += ` ORDER BY permission_category, permission_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting permissions', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Initialize system permissions (run during setup)
     * @param {string} createdBy - User ID creating permissions
     */
    async initializeSystemPermissions(createdBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            for (const perm of SYSTEM_PERMISSIONS) {
                // Check if permission already exists
                const existing = await this.findByName(perm.name);
                
                if (!existing) {
                    await client.query(`
                        INSERT INTO permissions (
                            permission_name, permission_category,
                            resource_type, resource_name, action_type,
                            description, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                    `, [
                        perm.name,
                        perm.category,
                        'api',
                        perm.resource,
                        perm.action,
                        perm.description
                    ]);
                    
                    logger.debug('System permission created', { permission: perm.name });
                }
            }

            await db.commitTransaction(client);
            logger.info('System permissions initialized', { 
                count: SYSTEM_PERMISSIONS.length 
            });
            
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error initializing system permissions', { 
                error: error.message 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get permissions by category
     * @param {string} category - Permission category
     * @returns {Promise<Array>} List of permissions
     */
    async getByCategory(category) {
        try {
            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description
                FROM permissions 
                WHERE permission_category = $1
                ORDER BY permission_name
            `;

            const result = await db.query(query, [category]);
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
     * Search permissions
     * @param {string} searchTerm - Search term
     * @returns {Promise<Array>} List of permissions
     */
    async search(searchTerm) {
        try {
            const query = `
                SELECT 
                    id, permission_name, permission_category,
                    resource_type, resource_name, action_type,
                    description
                FROM permissions 
                WHERE permission_name ILIKE $1 
                   OR description ILIKE $1
                   OR permission_category ILIKE $1
                ORDER BY permission_name
                LIMIT 50
            `;

            const result = await db.query(query, [`%${searchTerm}%`]);
            return result.rows;
        } catch (error) {
            logger.error('Error searching permissions', { 
                error: error.message,
                searchTerm 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = Permission;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Get all permissions
 * const permissions = await Permission.getAll({ limit: 50 });
 * 
 * // Get permissions by category
 * const adminPerms = await Permission.getByCategory('admin');
 * 
 * // Search permissions
 * const results = await Permission.search('patient');
 * 
 * // Initialize system permissions (run once during setup)
 * await Permission.initializeSystemPermissions(adminUserId);
 * 
 * // Create custom permission
 * const newPerm = await Permission.create({
 *     permission_name: 'department:manage',
 *     permission_category: 'admin',
 *     resource_type: 'feature',
 *     resource_name: 'department',
 *     action_type: 'manage',
 *     description: 'Manage departments'
 * });
 * 
 * ======================================================================
 */