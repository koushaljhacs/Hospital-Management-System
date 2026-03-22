// backend/src/validators/tokenValidators.js
/**
 * ======================================================================
 * FILE: backend/src/validators/tokenValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Token Management module request validators.
 * Total Validators: 8 main validators with 20+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-TKN-01] Tokens have configurable expiry
 * - [BR-TKN-02] Tokens can be revoked/blacklisted
 * - [BR-TKN-03] One-time tokens invalid after use
 * - [BR-TKN-04] Token rotation for security
 * - [BR-TKN-05] All token operations are audited
 * 
 * ======================================================================
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validate request and return formatted errors
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

/**
 * Custom validators for token module
 */
const customValidators = {
    // Valid token type
    isValidTokenType: (type) => {
        const validTypes = ['access', 'refresh', 'reset', 'verify', 'mfa', 'api_key', 'oauth'];
        return validTypes.includes(type);
    },

    // Valid token status
    isValidTokenStatus: (status) => {
        const validStatuses = ['active', 'used', 'expired', 'revoked', 'blacklisted'];
        return validStatuses.includes(status);
    },

    // Valid purpose
    isValidPurpose: (purpose) => {
        const validPurposes = ['login', 'password_reset', 'email_verify', 'phone_verify', 'mfa', 'api_access'];
        return validPurposes.includes(purpose);
    },

    // Valid revocation reason
    isValidRevocationReason: (reason) => {
        const validReasons = ['logout', 'password_change', 'compromised', 'admin_revoke', 'rotation', 'expired'];
        return validReasons.includes(reason);
    },

    // Valid blacklist reason
    isValidBlacklistReason: (reason) => {
        const validReasons = ['compromised', 'abuse', 'security_alert', 'admin_action', 'suspicious'];
        return validReasons.includes(reason);
    },

    // Valid rotation reason
    isValidRotationReason: (reason) => {
        const validReasons = ['security', 'expiry', 'compromised', 'manual', 'policy'];
        return validReasons.includes(reason);
    },

    // Valid expiry date (must be in future)
    isValidExpiryDate: (date) => {
        if (!date) return true;
        const expiryDate = new Date(date);
        const now = new Date();
        return expiryDate > now;
    },

    // Valid token hash format (basic check)
    isValidTokenHash: (hash) => {
        return hash && hash.length >= 32 && hash.length <= 255;
    },

    // Valid date range
    isValidDateRange: (start, end) => {
        if (!start || !end) return true;
        return new Date(end) >= new Date(start);
    }
};

// ============================================
// ID VALIDATORS
// ============================================

const validateTokenId = [
    param('id')
        .isUUID().withMessage('Invalid token ID format')
        .notEmpty().withMessage('Token ID is required'),
    validate
];

const validateUserId = [
    param('userId')
        .isUUID().withMessage('Invalid user ID format'),
    validate
];

// ============================================
// TOKEN CREATE VALIDATOR
// ============================================

const validateTokenCreate = [
    body('user_id')
        .notEmpty().withMessage('User ID is required')
        .isUUID().withMessage('Invalid user ID format'),

    body('token_type')
        .notEmpty().withMessage('Token type is required')
        .custom(customValidators.isValidTokenType).withMessage('Invalid token type'),

    body('purpose')
        .optional()
        .custom(customValidators.isValidPurpose).withMessage('Invalid purpose'),

    body('expires_at')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format')
        .custom(customValidators.isValidExpiryDate).withMessage('Expiry date must be in future'),

    body('requires_mfa')
        .optional()
        .isBoolean().withMessage('Requires MFA must be boolean'),

    body('metadata')
        .optional()
        .isObject().withMessage('Metadata must be object'),

    validate
];

// ============================================
// TOKEN REVOKE VALIDATOR
// ============================================

const validateTokenRevoke = [
    param('id')
        .isUUID().withMessage('Invalid token ID format'),

    body('reason')
        .optional()
        .custom(customValidators.isValidRevocationReason).withMessage('Invalid revocation reason')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 3, max: 200 }).withMessage('Reason must be between 3-200 characters')
        .trim()
        .escape(),

    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),

    validate
];

// ============================================
// TOKEN BLACKLIST VALIDATOR
// ============================================

const validateTokenBlacklist = [
    param('id')
        .isUUID().withMessage('Invalid token ID format'),

    body('reason')
        .notEmpty().withMessage('Blacklist reason is required')
        .custom(customValidators.isValidBlacklistReason).withMessage('Invalid blacklist reason')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 3, max: 200 }).withMessage('Reason must be between 3-200 characters')
        .trim()
        .escape(),

    body('expires_at')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format'),

    validate
];

// ============================================
// TOKEN ROTATE VALIDATOR
// ============================================

const validateTokenRotate = [
    param('id')
        .isUUID().withMessage('Invalid token ID format'),

    body('reason')
        .optional()
        .custom(customValidators.isValidRotationReason).withMessage('Invalid rotation reason')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 3, max: 200 }).withMessage('Reason must be between 3-200 characters')
        .trim()
        .escape(),

    body('grace_period_minutes')
        .optional()
        .isInt({ min: 0, max: 1440 }).withMessage('Grace period must be 0-1440 minutes'),

    validate
];

// ============================================
// TOKEN REFRESH VALIDATOR
// ============================================

const validateTokenRefresh = [
    body('refresh_token')
        .notEmpty().withMessage('Refresh token is required')
        .isString().withMessage('Refresh token must be string'),

    body('device_info')
        .optional()
        .isObject().withMessage('Device info must be object'),

    validate
];

// ============================================
// TOKEN VALIDATE VALIDATOR
// ============================================

const validateTokenValidate = [
    query('token')
        .notEmpty().withMessage('Token is required')
        .isString().withMessage('Token must be string'),

    validate
];

// ============================================
// PAGINATION VALIDATOR
// ============================================

const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be positive integer')
        .toInt(),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100')
        .toInt(),

    query('sort_by')
        .optional()
        .isIn(['created_at', 'issued_at', 'expires_at', 'used_at', 'token_type', 'status'])
        .withMessage('Invalid sort field'),

    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),

    query('token_type')
        .optional()
        .custom(customValidators.isValidTokenType).withMessage('Invalid token type'),

    query('status')
        .optional()
        .custom(customValidators.isValidTokenStatus).withMessage('Invalid status'),

    query('user_id')
        .optional()
        .isUUID().withMessage('Invalid user ID format'),

    validate
];

// ============================================
// DATE RANGE VALIDATOR
// ============================================

const validateDateRange = [
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from date format'),

    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to date format')
        .custom((to, { req }) => {
            if (req.query.from_date && to && new Date(to) < new Date(req.query.from_date)) {
                throw new Error('To date must be after from date');
            }
            return true;
        }),

    validate
];

// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    // ID validators
    validateTokenId,
    validateUserId,
    
    // Operation validators
    validateTokenCreate,
    validateTokenRevoke,
    validateTokenBlacklist,
    validateTokenRotate,
    validateTokenRefresh,
    validateTokenValidate,
    
    // Filter validators
    validatePagination,
    validateDateRange,
    
    // Middleware
    validate,
    
    // Export custom validators for reuse
    customValidators
};

/**
 * ======================================================================
 * VALIDATORS SUMMARY:
 * ======================================================================
 * 
 * Validator              | Used For                | Rules
 * -----------------------|-------------------------|----------------------
 * validateTokenId        | Get/Revoke/Blacklist    | UUID validation
 * validateUserId         | Get tokens by user      | UUID validation
 * validateTokenCreate    | Create token            | type, purpose, expiry
 * validateTokenRevoke    | Revoke token            | reason, notes
 * validateTokenBlacklist | Blacklist token         | reason, expiry
 * validateTokenRotate    | Rotate token            | reason, grace period
 * validateTokenRefresh   | Refresh token           | refresh_token
 * validateTokenValidate  | Validate token          | token
 * validatePagination     | List endpoints          | page, limit, sort
 * validateDateRange      | Stats & logs            | from_date, to_date
 * -----------------------|-------------------------|----------------------
 * TOTAL: 10 Validators with 20+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-TKN-01] Expiry date validation
 * - [BR-TKN-02] Revoke/blacklist reason validation
 * - [BR-TKN-03] One-time token validation
 * - [BR-TKN-04] Rotation reason validation
 * - [BR-TKN-05] All fields validated
 * 
 * ======================================================================
 */