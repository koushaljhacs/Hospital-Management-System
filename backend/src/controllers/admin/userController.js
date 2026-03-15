/**
 * ======================================================================
 * FILE: backend/src/controllers/admin/userController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * User management controller handling HTTP requests for user operations.
 * Implements comprehensive CRUD operations with proper authorization.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - userService: Business logic for users
 * - roleService: Business logic for roles
 * - logger: Logging utility
 * 
 * ENDPOINTS:
 * GET    /admin/users          - List all users (paginated)
 * GET    /admin/users/search   - Search users
 * GET    /admin/users/:id      - Get user details
 * POST   /admin/users          - Create new user
 * PUT    /admin/users/:id      - Update user
 * DELETE /admin/users/:id      - Soft delete user
 * PUT    /admin/users/:id/status - Update user status
 * GET    /admin/users/:id/roles - Get user roles
 * POST   /admin/users/:id/roles - Assign role to user
 * DELETE /admin/users/:id/roles/:roleId - Remove role from user
 * GET    /admin/users/:id/permissions - Get user permissions
 * GET    /admin/users/:id/audit-logs - Get user audit logs
 * POST   /admin/users/bulk      - Bulk operations on users
 * 
 * AUTHORIZATION:
 * - All endpoints require super_admin role
 * - Some operations restricted for system users
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const userService = require('../../services/admin/userService');
const roleService = require('../../services/admin/roleService');
const permissionService = require('../../services/admin/permissionService');
const logger = require('../../utils/logger');

/**
 * User Controller - Handle user management HTTP requests
 */
const userController = {
    /**
     * Get all users with pagination and filtering
     * GET /api/v1/admin/users
     */
    async getAllUsers(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                role, 
                status,
                search,
                department 
            } = req.query;

            const result = await userService.getAllUsers({
                page: parseInt(page),
                limit: parseInt(limit),
                role,
                status,
                search,
                department
            });

            logger.info('Users retrieved successfully', { 
                userId: req.user.id,
                count: result.data.length,
                page: result.pagination.page
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Error in getAllUsers', { 
                error: error.message, 
                userId: req.user.id,
                query: req.query
            });
            next(error);
        }
    },

    /**
     * Search users
     * GET /api/v1/admin/users/search
     */
    async searchUsers(req, res, next) {
        try {
            const { q, page = 1, limit = 20 } = req.query;

            if (!q) {
                return res.status(400).json({
                    success: false,
                    error: 'Search query is required'
                });
            }

            const result = await userService.getAllUsers({
                page: parseInt(page),
                limit: parseInt(limit),
                search: q
            });

            logger.info('User search performed', { 
                userId: req.user.id,
                query: q,
                results: result.data.length
            });

            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            logger.error('Error in searchUsers', { 
                error: error.message, 
                userId: req.user.id,
                query: req.query
            });
            next(error);
        }
    },

    /**
     * Get user by ID with full details
     * GET /api/v1/admin/users/:id
     */
    async getUserById(req, res, next) {
        try {
            const { id } = req.params;

            const user = await userService.getUserById(id);

            logger.info('User details retrieved', { 
                userId: req.user.id,
                targetUserId: id
            });

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            logger.error('Error in getUserById', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Create new user
     * POST /api/v1/admin/users
     */
    async createUser(req, res, next) {
        try {
            const userData = {
                ...req.body,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            };

            // Validate required fields
            if (!userData.email || !userData.password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            const newUser = await userService.createUser(userData, req.user.id);

            logger.info('User created by admin', { 
                userId: req.user.id,
                createdUserId: newUser.id,
                email: newUser.email
            });

            res.status(201).json({
                success: true,
                data: newUser,
                message: 'User created successfully'
            });
        } catch (error) {
            if (error.message.includes('already')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }

            logger.error('Error in createUser', { 
                error: error.message, 
                userId: req.user.id,
                body: req.body
            });
            next(error);
        }
    },

    /**
     * Update user
     * PUT /api/v1/admin/users/:id
     */
    async updateUser(req, res, next) {
        try {
            const { id } = req.params;
            const updates = {
                ...req.body,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            };

            // Prevent updating own account through this endpoint
            if (id === req.user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Use profile update endpoint to update your own account'
                });
            }

            const updatedUser = await userService.updateUser(id, updates, req.user.id);

            logger.info('User updated by admin', { 
                userId: req.user.id,
                targetUserId: id,
                updates: Object.keys(req.body)
            });

            res.json({
                success: true,
                data: updatedUser,
                message: 'User updated successfully'
            });
        } catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            logger.error('Error in updateUser', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id,
                body: req.body
            });
            next(error);
        }
    },

    /**
     * Delete user (soft delete)
     * DELETE /api/v1/admin/users/:id
     */
    async deleteUser(req, res, next) {
        try {
            const { id } = req.params;

            // Prevent deleting own account
            if (id === req.user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'You cannot delete your own account'
                });
            }

            await userService.deleteUser(id, {
                ...req.user,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            logger.info('User deleted by admin', { 
                userId: req.user.id,
                deletedUserId: id
            });

            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            if (error.message.includes('Cannot delete system')) {
                return res.status(403).json({
                    success: false,
                    error: error.message
                });
            }

            logger.error('Error in deleteUser', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update user status
     * PUT /api/v1/admin/users/:id/status
     */
    async updateUserStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }

            // Prevent locking own account
            if (id === req.user.id && status === 'locked') {
                return res.status(400).json({
                    success: false,
                    error: 'You cannot lock your own account'
                });
            }

            await userService.updateUserStatus(id, status, {
                ...req.user,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            logger.info('User status updated', { 
                userId: req.user.id,
                targetUserId: id,
                newStatus: status
            });

            res.json({
                success: true,
                message: `User status updated to ${status}`
            });
        } catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            logger.error('Error in updateUserStatus', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id,
                status: req.body.status
            });
            next(error);
        }
    },

    /**
     * Get user roles
     * GET /api/v1/admin/users/:id/roles
     */
    async getUserRoles(req, res, next) {
        try {
            const { id } = req.params;

            const user = await userService.getUserById(id);
            
            res.json({
                success: true,
                data: {
                    user_id: id,
                    user_email: user.email,
                    user_username: user.username,
                    roles: user.roles || [],
                    total: user.roles?.length || 0
                }
            });
        } catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            logger.error('Error in getUserRoles', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Assign role to user
     * POST /api/v1/admin/users/:id/roles
     */
    async assignRoleToUser(req, res, next) {
        try {
            const { id } = req.params;
            const { roleId, expires_at } = req.body;

            if (!roleId) {
                return res.status(400).json({
                    success: false,
                    error: 'Role ID is required'
                });
            }

            await userService.assignRoleToUser(
                id, 
                roleId, 
                {
                    ...req.user,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                },
                { expires_at }
            );

            logger.info('Role assigned to user', { 
                userId: req.user.id,
                targetUserId: id,
                roleId
            });

            res.json({
                success: true,
                message: 'Role assigned successfully'
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            if (error.message.includes('already assigned')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }

            logger.error('Error in assignRoleToUser', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id,
                roleId: req.body.roleId
            });
            next(error);
        }
    },

    /**
     * Remove role from user
     * DELETE /api/v1/admin/users/:id/roles/:roleId
     */
    async removeRoleFromUser(req, res, next) {
        try {
            const { id, roleId } = req.params;

            await userService.removeRoleFromUser(
                id, 
                roleId, 
                {
                    ...req.user,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            );

            logger.info('Role removed from user', { 
                userId: req.user.id,
                targetUserId: id,
                roleId
            });

            res.json({
                success: true,
                message: 'Role removed successfully'
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }

            logger.error('Error in removeRoleFromUser', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id,
                roleId: req.params.roleId
            });
            next(error);
        }
    },

    /**
     * Get user permissions
     * GET /api/v1/admin/users/:id/permissions
     */
    async getUserPermissions(req, res, next) {
        try {
            const { id } = req.params;

            const permissions = await permissionService.getUserPermissions(id);

            // Group by category
            const grouped = {};
            permissions.forEach(perm => {
                if (!grouped[perm.permission_category]) {
                    grouped[perm.permission_category] = [];
                }
                grouped[perm.permission_category].push(perm);
            });

            res.json({
                success: true,
                data: {
                    user_id: id,
                    total: permissions.length,
                    list: permissions,
                    grouped
                }
            });
        } catch (error) {
            logger.error('Error in getUserPermissions', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get user audit logs
     * GET /api/v1/admin/users/:id/audit-logs
     */
    async getUserAuditLogs(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const logs = await userService.getUserAuditLogs(id, {
                page: parseInt(page),
                limit: parseInt(limit)
            });

            res.json({
                success: true,
                data: logs.data,
                pagination: logs.pagination
            });
        } catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            logger.error('Error in getUserAuditLogs', { 
                error: error.message, 
                userId: req.user.id,
                targetUserId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Bulk operations on users
     * POST /api/v1/admin/users/bulk
     */
    async bulkUserOperations(req, res, next) {
        try {
            const { operation, userIds, data } = req.body;

            if (!operation || !userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Operation and user IDs array are required'
                });
            }

            // Prevent self-operation in bulk
            if (userIds.includes(req.user.id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Bulk operations cannot include your own account'
                });
            }

            let result;

            switch (operation) {
                case 'update_status':
                    if (!data || !data.status) {
                        return res.status(400).json({
                            success: false,
                            error: 'Status is required for update_status operation'
                        });
                    }
                    result = await userService.bulkUpdateUsers(
                        userIds, 
                        { status: data.status }, 
                        {
                            ...req.user,
                            ip: req.ip,
                            userAgent: req.headers['user-agent']
                        }
                    );
                    break;

                case 'assign_role':
                    if (!data || !data.roleId) {
                        return res.status(400).json({
                            success: false,
                            error: 'Role ID is required for assign_role operation'
                        });
                    }
                    // This would need a bulk role assignment method
                    return res.status(501).json({
                        success: false,
                        error: 'Bulk role assignment not implemented yet'
                    });

                default:
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid operation'
                    });
            }

            logger.info('Bulk user operation completed', { 
                userId: req.user.id,
                operation,
                total: userIds.length,
                success: result.success.length,
                failed: result.failed.length
            });

            res.json({
                success: true,
                data: result,
                message: `Bulk ${operation} completed`
            });
        } catch (error) {
            logger.error('Error in bulkUserOperations', { 
                error: error.message, 
                userId: req.user.id,
                operation: req.body.operation
            });
            next(error);
        }
    },

    /**
     * Get current user profile (also available in auth controller)
     * GET /api/v1/admin/users/profile/me
     */
    async getMyProfile(req, res, next) {
        try {
            const user = await userService.getUserById(req.user.id);

            res.json({
                success: true,
                data: user
            });
        } catch (error) {
            logger.error('Error in getMyProfile', { 
                error: error.message, 
                userId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get user statistics
     * GET /api/v1/admin/users/stats/summary
     */
    async getUserStats(req, res, next) {
        try {
            const stats = await db.query(`
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(*) FILTER (WHERE status = 'active') as active_users,
                    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_users,
                    COUNT(*) FILTER (WHERE status = 'locked') as locked_users,
                    COUNT(*) FILTER (WHERE email_verified = true) as verified_users,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_users_30d
                FROM users
                WHERE is_deleted = false
            `);

            const roleStats = await db.query(`
                SELECT 
                    role, COUNT(*) as count
                FROM users
                WHERE is_deleted = false
                GROUP BY role
                ORDER BY count DESC
            `);

            res.json({
                success: true,
                data: {
                    overview: stats.rows[0],
                    byRole: roleStats.rows
                }
            });
        } catch (error) {
            logger.error('Error in getUserStats', { 
                error: error.message, 
                userId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = userController;

/**
 * ======================================================================
 * USAGE IN ROUTES:
 * ======================================================================
 * 
 * const userController = require('./controllers/admin/userController');
 * 
 * // User management routes
 * router.get('/users', authorize(['super_admin']), userController.getAllUsers);
 * router.get('/users/search', authorize(['super_admin']), userController.searchUsers);
 * router.get('/users/stats', authorize(['super_admin']), userController.getUserStats);
 * router.get('/users/profile/me', authenticate, userController.getMyProfile);
 * router.get('/users/:id', authorize(['super_admin']), userController.getUserById);
 * router.post('/users', authorize(['super_admin']), validateUserCreate, userController.createUser);
 * router.put('/users/:id', authorize(['super_admin']), validateUserUpdate, userController.updateUser);
 * router.delete('/users/:id', authorize(['super_admin']), userController.deleteUser);
 * router.put('/users/:id/status', authorize(['super_admin']), userController.updateUserStatus);
 * 
 * // Role management for users
 * router.get('/users/:id/roles', authorize(['super_admin']), userController.getUserRoles);
 * router.post('/users/:id/roles', authorize(['super_admin']), userController.assignRoleToUser);
 * router.delete('/users/:id/roles/:roleId', authorize(['super_admin']), userController.removeRoleFromUser);
 * 
 * // Permissions and audit
 * router.get('/users/:id/permissions', authorize(['super_admin']), userController.getUserPermissions);
 * router.get('/users/:id/audit-logs', authorize(['super_admin']), userController.getUserAuditLogs);
 * 
 * // Bulk operations
 * router.post('/users/bulk', authorize(['super_admin']), userController.bulkUserOperations);
 * 
 * ======================================================================
 */