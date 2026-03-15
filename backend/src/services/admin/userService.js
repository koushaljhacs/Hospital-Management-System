/**
 * ======================================================================
 * FILE: backend/src/services/admin/userService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * User management service handling business logic for user operations.
 * Includes user CRUD, role assignment, status management, and audit logging.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - User model
 * - Role model
 * - auth utilities
 * - logger
 * 
 * BUSINESS RULES:
 * - Users cannot be permanently deleted (soft delete only)
 * - Email must be unique across system
 * - Username must be unique across system
 * - System roles cannot be modified/deleted
 * - Password changes require verification
 * - All user operations are audited
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const User = require('../../models/User');
const Role = require('../../models/Role');
const auth = require('../../config/auth');
const logger = require('../../utils/logger');
const db = require('../../config/database');

/**
 * User Service - Business logic for user management
 */
const userService = {
    /**
     * Get all users with pagination and filtering
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Users list and pagination info
     */
    async getAllUsers(options = {}) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                role, 
                status,
                search,
                department
            } = options;

            const offset = (page - 1) * limit;

            // Build filter conditions
            const filters = {};
            if (role) filters.role = role;
            if (status) filters.status = status;
            if (department) filters.department_id = department;

            // Get users with filters
            let users;
            let total;

            if (search) {
                users = await User.search(search, { limit, offset });
                total = await User.count({ search });
            } else {
                users = await User.getAll(filters, { limit, offset });
                total = await User.count(filters);
            }

            logger.info('Users retrieved', { 
                count: users.length, 
                total,
                page,
                filters: { role, status, department, search }
            });

            return {
                data: users,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting users', { error: error.message, options });
            throw new Error(`Failed to get users: ${error.message}`);
        }
    },

    /**
     * Get user by ID with full details
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User details with roles and permissions
     */
    async getUserById(userId) {
        try {
            // Get basic user info
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Get user roles
            const rolesResult = await db.query(`
                SELECT r.id, r.role_name, r.role_level, r.is_system_role,
                       ur.assigned_at, ur.expires_at, ur.is_active
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = $1 AND ur.is_active = true
            `, [userId]);

            // Get user permissions (direct and from roles)
            const permissionsResult = await db.query(`
                SELECT DISTINCT p.permission_name, p.permission_category,
                       p.resource_type, p.resource_name, p.action_type
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                JOIN user_roles ur ON rp.role_id = ur.role_id
                WHERE ur.user_id = $1 AND ur.is_active = true
                ORDER BY p.permission_category, p.permission_name
            `, [userId]);

            const userDetails = {
                ...user,
                roles: rolesResult.rows,
                permissions: permissionsResult.rows,
                permissionsCount: permissionsResult.rows.length
            };

            logger.debug('User details retrieved', { userId, rolesCount: rolesResult.rows.length });

            return userDetails;
        } catch (error) {
            logger.error('Error getting user by ID', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Create new user
     * @param {Object} userData - User data
     * @param {string} createdBy - User ID creating the user
     * @returns {Promise<Object>} Created user
     */
    async createUser(userData, createdBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Validate email uniqueness
            const existingEmail = await User.findByEmail(userData.email);
            if (existingEmail) {
                throw new Error('Email already registered');
            }

            // Validate username uniqueness if provided
            if (userData.username) {
                const existingUsername = await User.findByUsername(userData.username);
                if (existingUsername) {
                    throw new Error('Username already taken');
                }
            }

            // Validate role exists if provided
            if (userData.role) {
                const role = await Role.findByName(userData.role);
                if (!role) {
                    throw new Error('Invalid role specified');
                }
            }

            // Create user
            const user = await User.create({
                ...userData,
                email_verified: userData.email_verified || false,
                status: userData.status || 'active'
            });

            // Assign role if provided
            if (userData.role) {
                await db.query(`
                    INSERT INTO user_roles (user_id, role_id, assigned_by)
                    VALUES ($1, $2, $3)
                `, [user.id, userData.role, createdBy]);
            }

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action, 
                    table_name, record_id, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'create', $1, 'user_create',
                    'users', $2, $3, $4, $5
                )
            `, [createdBy, user.id, JSON.stringify(userData), userData.ip, userData.userAgent]);

            await db.commitTransaction(client);

            logger.info('User created successfully', { 
                userId: user.id, 
                email: user.email,
                createdBy 
            });

            return user;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating user', { error: error.message, userData });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update user
     * @param {string} userId - User ID
     * @param {Object} updates - Fields to update
     * @param {string} updatedBy - User ID performing update
     * @returns {Promise<Object>} Updated user
     */
    async updateUser(userId, updates, updatedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Get current user data for audit
            const currentUser = await User.findById(userId);
            if (!currentUser) {
                throw new Error('User not found');
            }

            // Check if trying to update email to one that already exists
            if (updates.email && updates.email !== currentUser.email) {
                const existing = await User.findByEmail(updates.email);
                if (existing) {
                    throw new Error('Email already in use');
                }
            }

            // Check if trying to update username
            if (updates.username && updates.username !== currentUser.username) {
                const existing = await User.findByUsername(updates.username);
                if (existing) {
                    throw new Error('Username already taken');
                }
            }

            // Update user
            const updatedUser = await User.update(userId, updates);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'update', $1, 'user_update',
                    'users', $2, $3, $4, $5, $6
                )
            `, [updatedBy, userId, JSON.stringify(currentUser), JSON.stringify(updates), 
                updates.ip, updates.userAgent]);

            await db.commitTransaction(client);

            logger.info('User updated successfully', { 
                userId, 
                updatedBy,
                updates: Object.keys(updates)
            });

            return updatedUser;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating user', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete user (soft delete)
     * @param {string} userId - User ID
     * @param {string} deletedBy - User ID performing deletion
     */
    async deleteUser(userId, deletedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Get user data for audit
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Check if user is a system user (can't delete)
            if (user.role === 'super_admin' || user.role === 'it_admin') {
                throw new Error('Cannot delete system administrator users');
            }

            // Soft delete user
            await User.delete(userId, deletedBy);

            // Deactivate all user sessions
            await db.query(`
                UPDATE sessions 
                SET is_active = false, logout_time = NOW(), logout_reason = 'user_deleted'
                WHERE user_id = $1 AND is_active = true
            `, [userId]);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'delete', $1, 'user_delete',
                    'users', $2, $3, $4, $5
                )
            `, [deletedBy, userId, JSON.stringify(user), deletedBy.ip, deletedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('User soft deleted', { userId, deletedBy });
            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting user', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Assign role to user
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @param {string} assignedBy - User ID assigning role
     * @param {Object} options - Assignment options (expires_at)
     */
    async assignRoleToUser(userId, roleId, assignedBy, options = {}) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Check if user exists
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Check if role exists
            const role = await Role.findById(roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            // Check if already assigned
            const existing = await db.query(`
                SELECT id FROM user_roles 
                WHERE user_id = $1 AND role_id = $2 AND is_active = true
            `, [userId, roleId]);

            if (existing.rows.length > 0) {
                throw new Error('Role already assigned to user');
            }

            // Assign role
            await db.query(`
                INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
                VALUES ($1, $2, $3, $4)
            `, [userId, roleId, assignedBy, options.expires_at || null]);

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'assign', $1, 'role_assign',
                    'user_roles', $2, $3, $4, $5
                )
            `, [assignedBy, `${userId}-${roleId}`, JSON.stringify({ userId, roleId }), 
                assignedBy.ip, assignedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Role assigned to user', { userId, roleId, assignedBy });
            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error assigning role to user', { error: error.message, userId, roleId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Remove role from user
     * @param {string} userId - User ID
     * @param {string} roleId - Role ID
     * @param {string} removedBy - User ID removing role
     */
    async removeRoleFromUser(userId, roleId, removedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Check if assignment exists
            const result = await db.query(`
                UPDATE user_roles 
                SET is_active = false, updated_at = NOW()
                WHERE user_id = $1 AND role_id = $2 AND is_active = true
                RETURNING id
            `, [userId, roleId]);

            if (result.rows.length === 0) {
                throw new Error('Role assignment not found');
            }

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'remove', $1, 'role_remove',
                    'user_roles', $2, $3, $4, $5
                )
            `, [removedBy, `${userId}-${roleId}`, JSON.stringify({ userId, roleId }), 
                removedBy.ip, removedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('Role removed from user', { userId, roleId, removedBy });
            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error removing role from user', { error: error.message, userId, roleId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update user status
     * @param {string} userId - User ID
     * @param {string} status - New status (active/inactive/locked)
     * @param {string} updatedBy - User ID performing update
     */
    async updateUserStatus(userId, status, updatedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const validStatuses = ['active', 'inactive', 'locked'];
            if (!validStatuses.includes(status)) {
                throw new Error('Invalid status');
            }

            // Get current user data
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Update status
            await db.query(`
                UPDATE users 
                SET status = $1, updated_at = NOW()
                WHERE id = $2
            `, [status, userId]);

            // If locking account, terminate all sessions
            if (status === 'locked') {
                await db.query(`
                    UPDATE sessions 
                    SET is_active = false, logout_time = NOW(), logout_reason = 'account_locked'
                    WHERE user_id = $1 AND is_active = true
                `, [userId]);
            }

            // Audit log
            await db.query(`
                INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action,
                    table_name, record_id, old_data, new_data, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'update', $1, 'status_change',
                    'users', $2, $3, $4, $5, $6
                )
            `, [updatedBy, userId, JSON.stringify({ status: user.status }), 
                JSON.stringify({ status }), updatedBy.ip, updatedBy.userAgent]);

            await db.commitTransaction(client);

            logger.info('User status updated', { userId, status, updatedBy });
            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating user status', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get user audit logs
     * @param {string} userId - User ID
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} Audit logs
     */
    async getUserAuditLogs(userId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            // Verify user exists
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const logs = await db.query(`
                SELECT 
                    id, audit_type, action, table_name, record_id,
                    old_data, new_data, ip_address, user_agent, created_at
                FROM audit_logs
                WHERE user_id = $1 OR record_id::uuid = $1
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `, [userId, limit, offset]);

            const total = await db.query(`
                SELECT COUNT(*) as count
                FROM audit_logs
                WHERE user_id = $1 OR record_id::uuid = $1
            `, [userId]);

            logger.debug('User audit logs retrieved', { 
                userId, 
                count: logs.rows.length 
            });

            return {
                data: logs.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(total.rows[0].count),
                    pages: Math.ceil(parseInt(total.rows[0].count) / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting user audit logs', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Bulk update users (status, department)
     * @param {Array} userIds - Array of user IDs
     * @param {Object} updates - Updates to apply
     * @param {string} updatedBy - User ID performing update
     */
    async bulkUpdateUsers(userIds, updates, updatedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const results = {
                success: [],
                failed: []
            };

            for (const userId of userIds) {
                try {
                    if (updates.status) {
                        await this.updateUserStatus(userId, updates.status, updatedBy);
                    }
                    if (updates.role) {
                        await this.assignRoleToUser(userId, updates.role, updatedBy);
                    }
                    results.success.push(userId);
                } catch (error) {
                    results.failed.push({ userId, error: error.message });
                }
            }

            await db.commitTransaction(client);

            logger.info('Bulk user update completed', { 
                total: userIds.length,
                success: results.success.length,
                failed: results.failed.length
            });

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error in bulk user update', { error: error.message });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = userService;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Get all users with pagination
 * const result = await userService.getAllUsers({ 
 *     page: 1, 
 *     limit: 20, 
 *     role: 'doctor',
 *     search: 'john'
 * });
 * 
 * // Get user details with roles and permissions
 * const user = await userService.getUserById(userId);
 * 
 * // Create new user
 * const newUser = await userService.createUser({
 *     email: 'doctor@hospital.com',
 *     username: 'dr.smith',
 *     password: 'SecurePass123!',
 *     role: 'doctor',
 *     first_name: 'John',
 *     last_name: 'Smith'
 * }, adminUserId);
 * 
 * // Assign role to user
 * await userService.assignRoleToUser(userId, roleId, adminUserId);
 * 
 * // Update user status
 * await userService.updateUserStatus(userId, 'locked', adminUserId);
 * 
 * // Get user audit logs
 * const logs = await userService.getUserAuditLogs(userId, { page: 1 });
 * 
 * ======================================================================
 */