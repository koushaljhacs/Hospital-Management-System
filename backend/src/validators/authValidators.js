/**
 * ======================================================================
 * FILE: backend/src/validators/authValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Request validation rules for authentication endpoints.
 * Uses express-validator for input validation and sanitization.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - express-validator v7.0.1
 * 
 * VALIDATION RULES:
 * - Email: Valid format, max length, normalization
 * - Password: Min 8 chars, complexity requirements
 * - Username: Alphanumeric, min/max length
 * - Role: Must be valid system role
 * - Input sanitization to prevent XSS
 * - Custom validation for business rules
 * 
 * ERROR HANDLING:
 * - Returns first validation error
 * - Custom error messages for each rule
 * - Sanitized inputs before passing to controller
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Allowed user roles in the system
 * Based on database enum user_role
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
 * Password complexity requirements
 */
const PASSWORD_REQUIREMENTS = {
    minLength: 8,
    maxLength: 100,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*'
};

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
 * Custom validation to check password complexity
 */
const validatePasswordComplexity = (password) => {
    if (password.length < PASSWORD_REQUIREMENTS.minLength) {
        throw new Error(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
    }

    if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
        throw new Error(`Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
    }

    if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
        throw new Error('Password must contain at least one uppercase letter');
    }

    if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
        throw new Error('Password must contain at least one lowercase letter');
    }

    if (PASSWORD_REQUIREMENTS.requireNumbers && !/[0-9]/.test(password)) {
        throw new Error('Password must contain at least one number');
    }

    if (PASSWORD_REQUIREMENTS.requireSpecialChars) {
        const specialRegex = new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
        if (!specialRegex.test(password)) {
            throw new Error(`Password must contain at least one special character (${PASSWORD_REQUIREMENTS.specialChars})`);
        }
    }

    return true;
};

/**
 * Registration validation rules
 */
const validateRegister = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail()
        .isLength({ max: 255 }).withMessage('Email must not exceed 255 characters'),

    body('password')
        .notEmpty().withMessage('Password is required')
        .custom(validatePasswordComplexity),

    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
        .toLowerCase(),

    body('role')
        .optional()
        .isIn(ALLOWED_ROLES).withMessage(`Role must be one of: ${ALLOWED_ROLES.join(', ')}`),

    body('first_name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('First name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

    body('last_name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Last name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

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

    handleValidationErrors
];

/**
 * Login validation rules
 */
const validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required'),

    body('remember_me')
        .optional()
        .isBoolean().withMessage('Remember me must be a boolean value')
        .toBoolean(),

    handleValidationErrors
];

/**
 * Refresh token validation
 */
const validateRefreshToken = [
    body('refreshToken')
        .notEmpty().withMessage('Refresh token is required')
        .isString().withMessage('Invalid refresh token format'),

    handleValidationErrors
];

/**
 * Change password validation
 */
const validateChangePassword = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),

    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .custom(validatePasswordComplexity)
        .custom((value, { req }) => {
            if (value === req.body.currentPassword) {
                throw new Error('New password must be different from current password');
            }
            return true;
        }),

    handleValidationErrors
];

/**
 * Forgot password validation
 */
const validateForgotPassword = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),

    handleValidationErrors
];

/**
 * Reset password validation
 */
const validateResetPassword = [
    param('token')
        .notEmpty().withMessage('Reset token is required')
        .isString().withMessage('Invalid token format'),

    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .custom(validatePasswordComplexity),

    handleValidationErrors
];

/**
 * Verify email validation
 */
const validateVerifyEmail = [
    body('token')
        .notEmpty().withMessage('Verification token is required')
        .isString().withMessage('Invalid token format'),

    handleValidationErrors
];

/**
 * Update profile validation
 */
const validateUpdateProfile = [
    body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores')
        .toLowerCase(),

    body('first_name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('First name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s-']+$/).withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

    body('last_name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Last name must not exceed 100 characters')
        .matches(/^[a-zA-Z\s-']+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

    body('phone')
        .optional()
        .trim()
        .matches(/^[0-9+\-\s]{10,20}$/).withMessage('Please provide a valid phone number'),

    body('profile_picture')
        .optional()
        .isURL().withMessage('Profile picture must be a valid URL')
        .isLength({ max: 500 }).withMessage('Profile picture URL too long'),

    handleValidationErrors
];

/**
 * User ID param validation
 */
const validateUserId = [
    param('id')
        .notEmpty().withMessage('User ID is required')
        .isUUID().withMessage('Invalid user ID format'),

    handleValidationErrors
];

/**
 * OTP validation
 */
const validateOtp = [
    body('phone')
        .optional()
        .trim()
        .matches(/^[0-9+\-\s]{10,20}$/).withMessage('Please provide a valid phone number'),

    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('otp')
        .notEmpty().withMessage('OTP is required')
        .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
        .isNumeric().withMessage('OTP must contain only numbers'),

    handleValidationErrors
];

/**
 * Logout validation
 */
const validateLogout = [
    body('refreshToken')
        .optional()
        .isString().withMessage('Invalid refresh token format'),

    handleValidationErrors
];

/**
 * Bulk user operations validation
 */
const validateBulkUserAction = [
    body('user_ids')
        .isArray({ min: 1 }).withMessage('At least one user ID is required')
        .custom((userIds) => {
            return userIds.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
        }).withMessage('All user IDs must be valid UUIDs'),

    body('action')
        .notEmpty().withMessage('Action is required')
        .isIn(['activate', 'deactivate', 'lock', 'unlock', 'delete']).withMessage('Invalid action'),

    handleValidationErrors
];

/**
 * Export all validation middleware
 */
module.exports = {
    validateRegister,
    validateLogin,
    validateRefreshToken,
    validateChangePassword,
    validateForgotPassword,
    validateResetPassword,
    validateVerifyEmail,
    validateUpdateProfile,
    validateUserId,
    validateOtp,
    validateLogout,
    validateBulkUserAction,
    
    // Export constants for use in other files
    ALLOWED_ROLES,
    PASSWORD_REQUIREMENTS,
    
    // Export helper for custom validation
    validatePasswordComplexity
};

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // In routes file:
 * const { validateRegister, validateLogin } = require('../validators/authValidators');
 * 
 * // Register route with validation
 * router.post('/register', 
 *   validateRegister,
 *   authController.register
 * );
 * 
 * // Login route with validation
 * router.post('/login',
 *   validateLogin,
 *   authController.login
 * );
 * 
 * // Change password with validation
 * router.post('/change-password',
 *   authenticate,
 *   validateChangePassword,
 *   authController.changePassword
 * );
 * 
 * // Protected route with user ID validation
 * router.get('/users/:id',
 *   authenticate,
 *   authorize(['admin']),
 *   validateUserId,
 *   userController.getById
 * );
 * 
 * ======================================================================
 */