/**
 * ======================================================================
 * FILE: backend/src/validators/adminValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Request validation rules for admin endpoints.
 * Uses express-validator for input validation and sanitization.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - express-validator v7.0.1
 * 
 * VALIDATION RULES:
 * - User creation/updates
 * - Role management
 * - Permission assignment
 * - Bulk operations
 * - Pagination parameters
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const { body, param, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const logger = require('../utils/logger');

/**
 * Allowed user roles in the system
 */
const ALLOWED_ROLES = [
    'super_admin',
    'it_admin',
    'billing_admin',
    'doctor',
    'nurse',
    'receptionist',
    'pharmacist',
    'lab_technician',
    'radiologist',
    'ground_staff',
    'security_guard',
    'patient',
    'guest'
];

/**
 * Allowed user status values
 */
const ALLOWED_STATUS = ['active', 'inactive', 'locked'];

/**
 * Validation result handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0];
        
        logger.warn('Validation failed', {
            path: req.path,
            field: firstError.param,
            error: firstError.msg,
            body: req.body
        });

        return res.status(400).json({
            success: false,
            error: firstError.msg,
            field: firstError.param,
            code: 'VALIDATION_ERROR'
        });
    }
    
    next();
};

/**
 * Validate UUID parameter
 */
const validateUUID = (field) => {
    return param(field)
        .isUUID().withMessage(`Invalid ${field} format. Must be a valid UUID`)
        .notEmpty().withMessage(`${field} is required`);
};

/**
 * Validate pagination parameters
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt()
];

/**
 * Validate search query
 */
const validateSearchQuery = [
    query('q')
        .notEmpty().withMessage('Search query is required')
        .isLength({ min: 2, max: 100 }).withMessage('Search query must be between 2 and 100 characters')
        .trim()
        .escape()
];

/**
 * User creation validation
 */
const validateUserCreate = [
    body('email')
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters')
        .custom(async (email) => {
            const existing = await User.findByEmail(email);
            if (existing) {
                throw new Error('Email already registered');
            }
            return true;
        }),

    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
        .toLowerCase()
        .custom(async (username) => {
            if (username) {
                const existing = await User.findByUsername(username);
                if (existing) {
                    throw new Error('Username already taken');
                }
            }
            return true;
        }),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character (!@#$%^&*)'),

    body('first_name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('First name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s-']*$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

    body('last_name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Last name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s-']*$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

    body('role')
        .optional()
        .isIn(ALLOWED_ROLES).withMessage(`Role must be one of: ${ALLOWED_ROLES.join(', ')}`),

    body('phone')
        .optional()
        .trim()
        .matches(/^[0-9+\-\s]{10,20}$/).withMessage('Please provide a valid phone number'),

    body('date_of_birth')
        .optional()
        .isISO8601().withMessage('Please provide a valid date of birth')
        .toDate(),

    body('gender')
        .optional()
        .isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Invalid gender value'),

    body('status')
        .optional()
        .isIn(ALLOWED_STATUS).withMessage(`Status must be one of: ${ALLOWED_STATUS.join(', ')}`),

    handleValidationErrors
];

/**
 * User update validation
 */
const validateUserUpdate = [
    validateUUID('id'),

    body('email')
        .optional()
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters')
        .custom(async (email, { req }) => {
            const existing = await User.findByEmail(email);
            if (existing && existing.id !== req.params.id) {
                throw new Error('Email already registered by another user');
            }
            return true;
        }),

    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
        .toLowerCase()
        .custom(async (username, { req }) => {
            const existing = await User.findByUsername(username);
            if (existing && existing.id !== req.params.id) {
                throw new Error('Username already taken by another user');
            }
            return true;
        }),

    body('first_name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('First name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s-']*$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

    body('last_name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Last name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s-']*$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

    body('phone')
        .optional()
        .trim()
        .matches(/^[0-9+\-\s]{10,20}$/).withMessage('Please provide a valid phone number'),

    body('date_of_birth')
        .optional()
        .isISO8601().withMessage('Please provide a valid date of birth')
        .toDate(),

    body('gender')
        .optional()
        .isIn(['male', 'female', 'other', 'prefer_not_to_say']).withMessage('Invalid gender value'),

    body('profile_picture')
        .optional()
        .isURL().withMessage('Profile picture must be a valid URL')
        .isLength({ max: 500 }).withMessage('Profile picture URL too long'),

    handleValidationErrors
];

/**
 * User status update validation
 */
const validateUserStatusUpdate = [
    validateUUID('id'),
    
    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(ALLOWED_STATUS).withMessage(`Status must be one of: ${ALLOWED_STATUS.join(', ')}`),

    handleValidationErrors
];

/**
 * Role creation validation
 */
const validateRoleCreate = [
    body('role_name')
        .notEmpty().withMessage('Role name is required')
        .isLength({ min: 3, max: 50 }).withMessage('Role name must be between 3 and 50 characters')
        .matches(/^[a-z_]+$/).withMessage('Role name can only contain lowercase letters and underscores')
        .custom(async (roleName) => {
            const existing = await Role.findByName(roleName);
            if (existing) {
                throw new Error('Role name already exists');
            }
            return true;
        }),

    body('role_description')
        .optional()
        .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters')
        .trim()
        .escape(),

    body('role_level')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Role level must be between 1 and 100')
        .toInt(),

    body('permissions')
        .optional()
        .isArray().withMessage('Permissions must be an array')
        .custom((permissions) => {
            if (permissions && !permissions.every(p => typeof p === 'string')) {
                throw new Error('Each permission must be a string');
            }
            return true;
        }),

    handleValidationErrors
];

/**
 * Role update validation
 */
const validateRoleUpdate = [
    validateUUID('id'),

    body('role_description')
        .optional()
        .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters')
        .trim()
        .escape(),

    body('role_level')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Role level must be between 1 and 100')
        .toInt()
        .custom(async (level, { req }) => {
            const role = await Role.findById(req.params.id);
            if (role && role.is_system_role && level !== role.role_level) {
                throw new Error('Cannot modify system role level');
            }
            return true;
        }),

    handleValidationErrors
];

/**
 * Permission assignment validation
 */
const validatePermissionAssignment = [
    validateUUID('id'),

    body('permissionId')
        .notEmpty().withMessage('Permission ID is required')
        .isUUID().withMessage('Invalid permission ID format')
        .custom(async (permissionId) => {
            const permission = await Permission.findById(permissionId);
            if (!permission) {
                throw new Error('Permission not found');
            }
            return true;
        }),

    body('grant_type')
        .optional()
        .isIn(['allow', 'deny']).withMessage('Grant type must be allow or deny'),

    body('conditions')
        .optional()
        .isObject().withMessage('Conditions must be an object'),

    handleValidationErrors
];

/**
 * Bulk permission assignment validation
 */
const validateBulkPermissionAssignment = [
    validateUUID('id'),

    body('permissionIds')
        .notEmpty().withMessage('Permission IDs array is required')
        .isArray().withMessage('Permission IDs must be an array')
        .custom((permissionIds) => {
            if (permissionIds.length === 0) {
                throw new Error('At least one permission ID is required');
            }
            if (!permissionIds.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
                throw new Error('All permission IDs must be valid UUIDs');
            }
            return true;
        }),

    handleValidationErrors
];

/**
 * Bulk user operation validation
 */
const validateBulkUserOperation = [
    body('operation')
        .notEmpty().withMessage('Operation is required')
        .isIn(['update_status', 'assign_role', 'deactivate', 'activate', 'lock']).withMessage('Invalid operation'),

    body('userIds')
        .notEmpty().withMessage('User IDs array is required')
        .isArray().withMessage('User IDs must be an array')
        .custom((userIds) => {
            if (userIds.length === 0) {
                throw new Error('At least one user ID is required');
            }
            if (userIds.length > 100) {
                throw new Error('Cannot process more than 100 users at once');
            }
            if (!userIds.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
                throw new Error('All user IDs must be valid UUIDs');
            }
            return true;
        }),

    body('data')
        .optional()
        .isObject().withMessage('Data must be an object'),

    body('data.status')
        .if(body('operation').equals('update_status'))
        .notEmpty().withMessage('Status is required for update_status operation')
        .isIn(ALLOWED_STATUS).withMessage(`Status must be one of: ${ALLOWED_STATUS.join(', ')}`),

    body('data.roleId')
        .if(body('operation').equals('assign_role'))
        .notEmpty().withMessage('Role ID is required for assign_role operation')
        .isUUID().withMessage('Invalid role ID format'),

    handleValidationErrors
];

/**
 * Permission creation validation
 */
const validatePermissionCreate = [
    body('permission_name')
        .notEmpty().withMessage('Permission name is required')
        .matches(/^[a-z]+:[a-z]+$/).withMessage('Permission name must be in format "resource:action" (e.g., "patient:read")')
        .isLength({ max: 100 }).withMessage('Permission name must not exceed 100 characters')
        .custom(async (name) => {
            const existing = await Permission.findByName(name);
            if (existing) {
                throw new Error('Permission already exists');
            }
            return true;
        }),

    body('permission_category')
        .notEmpty().withMessage('Permission category is required')
        .isIn(['admin', 'user', 'patient', 'clinical', 'appointment', 'prescription', 
               'lab', 'radiology', 'pharmacy', 'billing', 'inventory', 'facility', 
               'report', 'integration', 'system'])
        .withMessage('Invalid permission category'),

    body('description')
        .optional()
        .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters')
        .trim()
        .escape(),

    handleValidationErrors
];

/**
 * Date range validation for reports/audit logs
 */
const validateDateRange = [
    query('startDate')
        .optional()
        .isISO8601().withMessage('Start date must be a valid date')
        .toDate(),

    query('endDate')
        .optional()
        .isISO8601().withMessage('End date must be a valid date')
        .toDate()
        .custom((endDate, { req }) => {
            if (req.query.startDate && endDate < new Date(req.query.startDate)) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),

    handleValidationErrors
];

/**
 * Export all validation middleware
 */
module.exports = {
    // User validations
    validateUserCreate,
    validateUserUpdate,
    validateUserStatusUpdate,
    validateBulkUserOperation,
    
    // Role validations
    validateRoleCreate,
    validateRoleUpdate,
    validatePermissionAssignment,
    validateBulkPermissionAssignment,
    
    // Permission validations
    validatePermissionCreate,
    
    // Common validations
    validateUUID,
    validatePagination,
    validateSearchQuery,
    validateDateRange,
    
    // Helper
    handleValidationErrors,
    
    // Constants
    ALLOWED_ROLES,
    ALLOWED_STATUS
};

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // In routes file:
 * const { 
 *     validateUserCreate, 
 *     validateUserUpdate,
 *     validateRoleCreate,
 *     validatePagination,
 *     validateUUID
 * } = require('../../validators/adminValidators');
 * 
 * // Create user with validation
 * router.post('/users', 
 *   authenticate,
 *   authorize(['super_admin']),
 *   validateUserCreate,
 *   userController.createUser
 * );
 * 
 * // Get user with UUID validation
 * router.get('/users/:id',
 *   authenticate,
 *   authorize(['super_admin']),
 *   validateUUID('id'),
 *   userController.getUserById
 * );
 * 
 * // List users with pagination
 * router.get('/users',
 *   authenticate,
 *   authorize(['super_admin']),
 *   validatePagination,
 *   userController.getAllUsers
 * );
 * 
 * ======================================================================
 */