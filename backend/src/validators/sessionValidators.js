// backend/src/validators/sessionValidators.js
/**
 * ======================================================================
 * FILE: backend/src/validators/sessionValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Session Management module request validators.
 * Total Validators: 6 main validators with 15+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-SES-01] Sessions expire after inactivity (30 min default)
 * - [BR-SES-02] Max concurrent sessions per user (configurable)
 * - [BR-SES-03] Session tokens can be revoked
 * - [BR-SES-04] Device fingerprint for session binding
 * - [BR-SES-05] All session events are logged
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
 * Custom validators for session module
 */
const customValidators = {
    // Valid session status
    isValidSessionStatus: (status) => {
        const validStatuses = ['active', 'expired', 'terminated', 'timeout'];
        return validStatuses.includes(status);
    },

    // Valid timeout minutes (5 min to 24 hours)
    isValidTimeoutMinutes: (minutes) => {
        return Number.isInteger(minutes) && minutes >= 5 && minutes <= 1440;
    },

    // Valid device type
    isValidDeviceType: (type) => {
        const validTypes = ['desktop', 'mobile', 'tablet', 'other'];
        return validTypes.includes(type);
    },

    // Valid OS
    isValidOS: (os) => {
        const validOS = ['windows', 'macos', 'linux', 'ios', 'android', 'other'];
        return validOS.includes(os);
    },

    // Valid browser
    isValidBrowser: (browser) => {
        const validBrowsers = ['chrome', 'firefox', 'safari', 'edge', 'opera', 'other'];
        return validBrowsers.includes(browser);
    },

    // Valid date range
    isValidDateRange: (start, end) => {
        if (!start || !end) return true;
        return new Date(end) >= new Date(start);
    },

    // Valid user agent length
    isValidUserAgent: (ua) => {
        return ua && ua.length <= 500;
    },

    // Valid IP address
    isValidIP: (ip) => {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }
};

// ============================================
// ID VALIDATORS
// ============================================

const validateSessionId = [
    param('id')
        .isUUID().withMessage('Invalid session ID format')
        .notEmpty().withMessage('Session ID is required'),
    validate
];

const validateUserId = [
    param('userId')
        .isUUID().withMessage('Invalid user ID format'),
    validate
];

// ============================================
// SESSION TIMEOUT VALIDATOR
// ============================================

const validateSessionTimeout = [
    param('minutes')
        .notEmpty().withMessage('Timeout minutes is required')
        .custom(customValidators.isValidTimeoutMinutes).withMessage('Timeout must be between 5-1440 minutes')
        .toInt(),
    validate
];

// ============================================
// SESSION CREATE VALIDATOR
// ============================================

const validateSessionCreate = [
    body('user_id')
        .notEmpty().withMessage('User ID is required')
        .isUUID().withMessage('Invalid user ID format'),

    body('device_info')
        .optional()
        .isObject().withMessage('Device info must be object'),

    body('device_info.device_type')
        .optional()
        .custom(customValidators.isValidDeviceType).withMessage('Invalid device type'),

    body('device_info.os')
        .optional()
        .custom(customValidators.isValidOS).withMessage('Invalid OS'),

    body('device_info.browser')
        .optional()
        .custom(customValidators.isValidBrowser).withMessage('Invalid browser'),

    body('device_info.device_name')
        .optional()
        .isString().withMessage('Device name must be string')
        .isLength({ max: 100 }).withMessage('Device name too long')
        .trim()
        .escape(),

    body('ip_address')
        .optional()
        .custom(customValidators.isValidIP).withMessage('Invalid IP address'),

    body('user_agent')
        .optional()
        .custom(customValidators.isValidUserAgent).withMessage('User agent too long')
        .trim(),

    body('session_token')
        .optional()
        .isString().withMessage('Session token must be string'),

    validate
];

// ============================================
// SESSION EXTEND VALIDATOR
// ============================================

const validateSessionExtend = [
    body('session_token')
        .optional()
        .isString().withMessage('Session token must be string'),

    body('extend_minutes')
        .optional()
        .custom(customValidators.isValidTimeoutMinutes).withMessage('Extend minutes must be between 5-1440'),

    validate
];

// ============================================
// SESSION TERMINATE VALIDATOR
// ============================================

const validateSessionTerminate = [
    param('id')
        .isUUID().withMessage('Invalid session ID format'),

    body('reason')
        .optional()
        .isString().withMessage('Reason must be string')
        .isLength({ max: 200 }).withMessage('Reason too long')
        .trim()
        .escape(),

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
        .isIn(['created_at', 'last_activity', 'expires_at', 'login_time'])
        .withMessage('Invalid sort field'),

    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),

    query('status')
        .optional()
        .custom(customValidators.isValidSessionStatus).withMessage('Invalid status'),

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
    validateSessionId,
    validateUserId,
    
    // Operation validators
    validateSessionTimeout,
    validateSessionCreate,
    validateSessionExtend,
    validateSessionTerminate,
    
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
 * validateSessionId      | Get/Terminate session   | UUID validation
 * validateUserId         | Terminate user sessions | UUID validation
 * validateSessionTimeout | Set timeout             | 5-1440 minutes
 * validateSessionCreate  | Create session          | device info, IP
 * validateSessionExtend  | Extend session          | extend minutes
 * validateSessionTerminate| Terminate session       | reason
 * validatePagination     | List endpoints          | page, limit, sort
 * validateDateRange      | Stats & logs            | from_date, to_date
 * -----------------------|-------------------------|----------------------
 * TOTAL: 8 Validators with 15+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-SES-01] Timeout range validation
 * - [BR-SES-02] Session limits (service layer)
 * - [BR-SES-03] Termination reason tracking
 * - [BR-SES-04] Device info validation
 * - [BR-SES-05] All fields validated
 * 
 * ======================================================================
 */