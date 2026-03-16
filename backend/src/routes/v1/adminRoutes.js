/**
 * ======================================================================
 * FILE: backend/src/routes/v1/adminRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Admin routes for user, role, and permission management.
 * All routes require super_admin role.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - express: Router
 * - userController: User management
 * - roleService: Role management
 * - permissionService: Permission management
 * - validators: Request validation
 * - auth middleware: Authentication & authorization
 * 
 * BASE PATH: /api/v1/admin
 * 
 * ENDPOINT CATEGORIES:
 * - User Management (20+ endpoints)
 * - Role Management (10+ endpoints)
 * - Permission Management (10+ endpoints)
 * - System & Health (5+ endpoints)
 * 
 * AUTHORIZATION:
 * - All routes require authentication
 * - Most routes require super_admin role
 * - Some routes available to it_admin
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Controllers
const userController = require('../../controllers/admin/userController');
const roleService = require('../../services/admin/roleService');
const permissionService = require('../../services/admin/permissionService');

// Middlewares
const { authenticate, authorize } = require('../../middlewares/auth');

// Validators
const { 
    validateUserCreate,
    validateUserUpdate,
    validateUserStatusUpdate,
    validateBulkUserOperation,
    validateRoleCreate,
    validateRoleUpdate,
    validatePermissionAssignment,
    validateBulkPermissionAssignment,
    validatePermissionCreate,
    validateUUID,
    validatePagination,
    validateSearchQuery,
    validateDateRange,
    handleValidationErrors
} = require('../../validators/adminValidators');

const logger = require('../../utils/logger');

/**
 * ======================================================================
 * RATE LIMITING
 * ======================================================================
 */

// Stricter rate limit for admin endpoints
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many admin requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting to all admin routes
router.use(adminLimiter);

/**
 * ======================================================================
 * ROOT ROUTE - Admin API Information
 * ======================================================================
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Admin module is healthy',
        timestamp: new Date().toISOString()
    });
});

/**
 * ======================================================================
 * USER MANAGEMENT ROUTES
 * ======================================================================
 */

/**
 * Get all users with pagination
 * GET /api/v1/admin/users
 */
router.get('/users',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validatePagination,
    userController.getAllUsers
);

/**
 * Search users
 * GET /api/v1/admin/users/search
 */
router.get('/users/search',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateSearchQuery,
    validatePagination,
    userController.searchUsers
);

/**
 * Get user statistics
 * GET /api/v1/admin/users/stats/summary
 */
router.get('/users/stats/summary',
    authenticate,
    authorize(['super_admin']),
    userController.getUserStats
);

/**
 * Get current admin profile
 * GET /api/v1/admin/users/profile/me
 */
router.get('/users/profile/me',
    authenticate,
    userController.getMyProfile
);

/**
 * Get user by ID
 * GET /api/v1/admin/users/:id
 */
router.get('/users/:id',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('id'),
    userController.getUserById
);

/**
 * Create new user
 * POST /api/v1/admin/users
 */
router.post('/users',
    authenticate,
    authorize(['super_admin']),
    validateUserCreate,
    userController.createUser
);

/**
 * Update user
 * PUT /api/v1/admin/users/:id
 */
router.put('/users/:id',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    validateUserUpdate,
    userController.updateUser
);

/**
 * Delete user (soft delete)
 * DELETE /api/v1/admin/users/:id
 */
router.delete('/users/:id',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    userController.deleteUser
);

/**
 * Update user status
 * PUT /api/v1/admin/users/:id/status
 */
router.put('/users/:id/status',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    validateUserStatusUpdate,
    userController.updateUserStatus
);

/**
 * Get user roles
 * GET /api/v1/admin/users/:id/roles
 */
router.get('/users/:id/roles',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('id'),
    userController.getUserRoles
);

/**
 * Assign role to user
 * POST /api/v1/admin/users/:id/roles
 */
router.post('/users/:id/roles',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    validatePermissionAssignment,
    userController.assignRoleToUser
);

/**
 * Remove role from user
 * DELETE /api/v1/admin/users/:id/roles/:roleId
 */
router.delete('/users/:id/roles/:roleId',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    validateUUID('roleId'),
    userController.removeRoleFromUser
);

/**
 * Get user permissions
 * GET /api/v1/admin/users/:id/permissions
 */
router.get('/users/:id/permissions',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('id'),
    userController.getUserPermissions
);

/**
 * Get user audit logs
 * GET /api/v1/admin/users/:id/audit-logs
 */
router.get('/users/:id/audit-logs',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('id'),
    validatePagination,
    validateDateRange,
    userController.getUserAuditLogs
);

/**
 * Bulk user operations
 * POST /api/v1/admin/users/bulk
 */
router.post('/users/bulk',
    authenticate,
    authorize(['super_admin']),
    validateBulkUserOperation,
    userController.bulkUserOperations
);

/**
 * ======================================================================
 * ROLE MANAGEMENT ROUTES
 * ======================================================================
 */

/**
 * Get all roles
 * GET /api/v1/admin/roles
 */
router.get('/roles',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validatePagination,
    async (req, res, next) => {
        try {
            const { page = 1, limit = 20, includeSystem = true } = req.query;
            const roles = await roleService.getAllRoles({
                page: parseInt(page),
                limit: parseInt(limit),
                includeSystem: includeSystem === 'true'
            });
            res.json({ success: true, ...roles });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get role hierarchy
 * GET /api/v1/admin/roles/hierarchy
 */
router.get('/roles/hierarchy',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    async (req, res, next) => {
        try {
            const hierarchy = await roleService.getRoleHierarchy();
            res.json({ success: true, data: hierarchy });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get role by ID
 * GET /api/v1/admin/roles/:id
 */
router.get('/roles/:id',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('id'),
    async (req, res, next) => {
        try {
            const role = await roleService.getRoleById(req.params.id);
            res.json({ success: true, data: role });
        } catch (error) {
            if (error.message === 'Role not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
);

/**
 * Create new role
 * POST /api/v1/admin/roles
 */
router.post('/roles',
    authenticate,
    authorize(['super_admin']),
    validateRoleCreate,
    async (req, res, next) => {
        try {
            const role = await roleService.createRole(req.body, {
                ...req.user,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            res.status(201).json({
                success: true,
                data: role,
                message: 'Role created successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Update role
 * PUT /api/v1/admin/roles/:id
 */
router.put('/roles/:id',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    validateRoleUpdate,
    async (req, res, next) => {
        try {
            const role = await roleService.updateRole(req.params.id, req.body, {
                ...req.user,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            res.json({
                success: true,
                data: role,
                message: 'Role updated successfully'
            });
        } catch (error) {
            if (error.message === 'Role not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
);

/**
 * Delete role
 * DELETE /api/v1/admin/roles/:id
 */
router.delete('/roles/:id',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    async (req, res, next) => {
        try {
            await roleService.deleteRole(req.params.id, {
                ...req.user,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            res.json({ success: true, message: 'Role deleted successfully' });
        } catch (error) {
            if (error.message === 'Role not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('assigned users')) {
                return res.status(409).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
);

/**
 * Get role permissions
 * GET /api/v1/admin/roles/:id/permissions
 */
router.get('/roles/:id/permissions',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('id'),
    async (req, res, next) => {
        try {
            const permissions = await roleService.getRolePermissions(req.params.id);
            res.json({ success: true, data: permissions });
        } catch (error) {
            if (error.message === 'Role not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
);

/**
 * Assign permission to role
 * POST /api/v1/admin/roles/:id/permissions
 */
router.post('/roles/:id/permissions',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    validatePermissionAssignment,
    async (req, res, next) => {
        try {
            await roleService.assignPermissionToRole(
                req.params.id,
                req.body.permissionId,
                {
                    ...req.user,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                },
                {
                    grant_type: req.body.grant_type,
                    conditions: req.body.conditions
                }
            );
            res.json({ success: true, message: 'Permission assigned successfully' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Bulk assign permissions to role
 * POST /api/v1/admin/roles/:id/permissions/bulk
 */
router.post('/roles/:id/permissions/bulk',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    validateBulkPermissionAssignment,
    async (req, res, next) => {
        try {
            const result = await roleService.bulkAssignPermissions(
                req.params.id,
                req.body.permissionIds,
                {
                    ...req.user,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            );
            res.json({
                success: true,
                data: result,
                message: 'Bulk permission assignment completed'
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Remove permission from role
 * DELETE /api/v1/admin/roles/:id/permissions/:permissionId
 */
router.delete('/roles/:id/permissions/:permissionId',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    validateUUID('permissionId'),
    async (req, res, next) => {
        try {
            await roleService.removePermissionFromRole(
                req.params.id,
                req.params.permissionId,
                {
                    ...req.user,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            );
            res.json({ success: true, message: 'Permission removed successfully' });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get users with this role
 * GET /api/v1/admin/roles/:id/users
 */
router.get('/roles/:id/users',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('id'),
    validatePagination,
    async (req, res, next) => {
        try {
            const { page = 1, limit = 20 } = req.query;
            const users = await roleService.getRoleUsers(req.params.id, {
                page: parseInt(page),
                limit: parseInt(limit)
            });
            res.json({ success: true, ...users });
        } catch (error) {
            if (error.message === 'Role not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
);

/**
 * ======================================================================
 * PERMISSION MANAGEMENT ROUTES
 * ======================================================================
 */

/**
 * Get all permissions
 * GET /api/v1/admin/permissions
 */
router.get('/permissions',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validatePagination,
    async (req, res, next) => {
        try {
            const { page = 1, limit = 50, category } = req.query;
            const permissions = await permissionService.getAllPermissions({
                page: parseInt(page),
                limit: parseInt(limit),
                category
            });
            res.json({ success: true, ...permissions });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get permission categories
 * GET /api/v1/admin/permissions/categories
 */
router.get('/permissions/categories',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    async (req, res, next) => {
        try {
            const categories = await permissionService.getPermissionCategories();
            res.json({ success: true, data: categories });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get permissions by category
 * GET /api/v1/admin/permissions/categories/:category
 */
router.get('/permissions/categories/:category',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    async (req, res, next) => {
        try {
            const permissions = await permissionService.getPermissionsByCategory(req.params.category);
            res.json({ success: true, data: permissions });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Get permission by ID
 * GET /api/v1/admin/permissions/:id
 */
router.get('/permissions/:id',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('id'),
    async (req, res, next) => {
        try {
            const permission = await permissionService.getPermissionById(req.params.id);
            res.json({ success: true, data: permission });
        } catch (error) {
            if (error.message === 'Permission not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
);

/**
 * Create new permission
 * POST /api/v1/admin/permissions
 */
router.post('/permissions',
    authenticate,
    authorize(['super_admin']),
    validatePermissionCreate,
    async (req, res, next) => {
        try {
            const permission = await permissionService.createPermission(req.body, {
                ...req.user,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            res.status(201).json({
                success: true,
                data: permission,
                message: 'Permission created successfully'
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Update permission
 * PUT /api/v1/admin/permissions/:id
 */
router.put('/permissions/:id',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    async (req, res, next) => {
        try {
            const permission = await permissionService.updatePermission(
                req.params.id,
                req.body,
                {
                    ...req.user,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            );
            res.json({
                success: true,
                data: permission,
                message: 'Permission updated successfully'
            });
        } catch (error) {
            if (error.message === 'Permission not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
);

/**
 * Delete permission
 * DELETE /api/v1/admin/permissions/:id
 */
router.delete('/permissions/:id',
    authenticate,
    authorize(['super_admin']),
    validateUUID('id'),
    async (req, res, next) => {
        try {
            await permissionService.deletePermission(req.params.id, {
                ...req.user,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            res.json({ success: true, message: 'Permission deleted successfully' });
        } catch (error) {
            if (error.message === 'Permission not found') {
                return res.status(404).json({ success: false, error: error.message });
            }
            if (error.message.includes('assigned to roles')) {
                return res.status(409).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
);

/**
 * Check if user has permission
 * GET /api/v1/admin/permissions/check/:userId/:permission
 */
router.get('/permissions/check/:userId/:permission',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateUUID('userId'),
    async (req, res, next) => {
        try {
            const hasPermission = await permissionService.userHasPermission(
                req.params.userId,
                req.params.permission
            );
            res.json({
                success: true,
                data: {
                    userId: req.params.userId,
                    permission: req.params.permission,
                    hasPermission
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * ======================================================================
 * SYSTEM & HEALTH ROUTES
 * ======================================================================
 */

/**
 * Health check for admin service
 * GET /api/v1/admin/health
 */
router.get('/health',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    (req, res) => {
        res.json({
            success: true,
            service: 'admin-api',
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    }
);

/**
 * Get all routes
 * GET /api/v1/admin/routes
 */
router.get('/routes',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    (req, res) => {
        const routes = [
            // User routes
            { method: 'GET', path: '/users', description: 'List all users' },
            { method: 'GET', path: '/users/search', description: 'Search users' },
            { method: 'GET', path: '/users/stats', description: 'User statistics' },
            { method: 'GET', path: '/users/:id', description: 'Get user details' },
            { method: 'POST', path: '/users', description: 'Create user' },
            { method: 'PUT', path: '/users/:id', description: 'Update user' },
            { method: 'DELETE', path: '/users/:id', description: 'Delete user' },
            { method: 'PUT', path: '/users/:id/status', description: 'Update user status' },
            { method: 'GET', path: '/users/:id/roles', description: 'Get user roles' },
            { method: 'POST', path: '/users/:id/roles', description: 'Assign role' },
            { method: 'DELETE', path: '/users/:id/roles/:roleId', description: 'Remove role' },
            { method: 'GET', path: '/users/:id/permissions', description: 'Get user permissions' },
            { method: 'GET', path: '/users/:id/audit-logs', description: 'Get audit logs' },
            { method: 'POST', path: '/users/bulk', description: 'Bulk operations' },
            
            // Role routes
            { method: 'GET', path: '/roles', description: 'List roles' },
            { method: 'GET', path: '/roles/hierarchy', description: 'Role hierarchy' },
            { method: 'GET', path: '/roles/:id', description: 'Get role details' },
            { method: 'POST', path: '/roles', description: 'Create role' },
            { method: 'PUT', path: '/roles/:id', description: 'Update role' },
            { method: 'DELETE', path: '/roles/:id', description: 'Delete role' },
            { method: 'GET', path: '/roles/:id/permissions', description: 'Get role permissions' },
            { method: 'POST', path: '/roles/:id/permissions', description: 'Assign permission' },
            { method: 'POST', path: '/roles/:id/permissions/bulk', description: 'Bulk assign' },
            { method: 'DELETE', path: '/roles/:id/permissions/:permissionId', description: 'Remove permission' },
            { method: 'GET', path: '/roles/:id/users', description: 'Get users with role' },
            
            // Permission routes
            { method: 'GET', path: '/permissions', description: 'List permissions' },
            { method: 'GET', path: '/permissions/categories', description: 'Permission categories' },
            { method: 'GET', path: '/permissions/categories/:category', description: 'Permissions by category' },
            { method: 'GET', path: '/permissions/:id', description: 'Get permission' },
            { method: 'POST', path: '/permissions', description: 'Create permission' },
            { method: 'PUT', path: '/permissions/:id', description: 'Update permission' },
            { method: 'DELETE', path: '/permissions/:id', description: 'Delete permission' },
            { method: 'GET', path: '/permissions/check/:userId/:permission', description: 'Check permission' }
        ];
        
        res.json({
            success: true,
            basePath: '/api/v1/admin',
            totalRoutes: routes.length,
            routes
        });
    }
);

module.exports = router;

/**
 * ======================================================================
 * USAGE IN MAIN APP:
 * ======================================================================
 * 
 * // In server.js or app.js:
 * const adminRoutes = require('./src/routes/v1/adminRoutes');
 * app.use('/api/v1/admin', adminRoutes);
 * 
 * ======================================================================
 */