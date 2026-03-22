// backend/src/validators/apiKeyValidators.js
/**
 * ======================================================================
 * FILE: backend/src/validators/apiKeyValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * API Key Management module request validators.
 * Total Validators: 8 main validators with 35+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-API-01] API keys must be unique per user
 * - [BR-API-02] Keys expire after configured duration
 * - [BR-API-03] Rate limits enforced per key
 * - [BR-API-04] Keys can be revoked/rotated
 * - [BR-API-05] All API key usage is audited
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
 * Custom validators for API key module
 */
const customValidators = {
    isValidApiKeyType: (type) => {
        const validTypes = ['live', 'test', 'client', 'internal', 'temporary', 'integration'];
        return validTypes.includes(type);
    },

    isValidApiKeyStatus: (status) => {
        const validStatuses = ['active', 'expired', 'revoked', 'suspended', 'pending', 'compromised'];
        return validStatuses.includes(status);
    },

    isValidPermissionScope: (scope) => {
        const validScopes = ['full', 'restricted', 'read_only', 'write_only', 'custom'];
        return validScopes.includes(scope);
    },

    isValidPermissions: (permissions) => {
        if (!permissions) return true;
        if (!Array.isArray(permissions)) return false;
        return permissions.every(p => typeof p === 'string');
    },

    isValidIpOrCidr: (ip) => {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        return ipv4Regex.test(ip) || cidrRegex.test(ip);
    },

    isValidRateLimit: (limit) => {
        return Number.isInteger(limit) && limit > 0 && limit <= 10000;
    },

    isValidRateLimitWindow: (window) => {
        return Number.isInteger(window) && window >= 1 && window <= 86400;
    },

    isValidBurstMultiplier: (multiplier) => {
        return typeof multiplier === 'number' && multiplier >= 1.0 && multiplier <= 5.0;
    },

    isValidExpiryDate: (date) => {
        if (!date) return true;
        const expiryDate = new Date(date);
        const now = new Date();
        return expiryDate > now;
    },

    isValidRotationReason: (reason) => {
        const validReasons = ['security', 'expiry', 'compromised', 'manual', 'policy'];
        return validReasons.includes(reason);
    },

    isValidRevocationReason: (reason) => {
        const validReasons = ['compromised', 'deprecated', 'misuse', 'user_request', 'admin_action'];
        return validReasons.includes(reason);
    },

    isValidDomain: (domain) => {
        const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    },

    isValidHourRange: (start, end) => {
        if (!start || !end) return true;
        return start < end;
    },

    isValidDays: (days) => {
        if (!days) return true;
        if (!Array.isArray(days)) return false;
        return days.every(d => Number.isInteger(d) && d >= 0 && d <= 6);
    }
};

// ============================================
// ID VALIDATOR
// ============================================

const validateApiKeyId = [
    param('id')
        .isUUID().withMessage('Invalid API key ID format')
        .notEmpty().withMessage('API key ID is required'),
    validate
];

// ============================================
// CREATE API KEY VALIDATOR
// ============================================

const validateApiKeyCreate = [
    body('key_name')
        .notEmpty().withMessage('Key name is required')
        .isString().withMessage('Key name must be string')
        .isLength({ min: 3, max: 100 }).withMessage('Key name must be between 3-100 characters')
        .trim()
        .escape(),

    body('key_description')
        .optional()
        .isString().withMessage('Description must be string')
        .isLength({ max: 500 }).withMessage('Description too long')
        .trim()
        .escape(),

    body('key_type')
        .optional()
        .default('live')
        .custom(customValidators.isValidApiKeyType).withMessage('Invalid API key type'),

    body('permission_scope')
        .optional()
        .default('restricted')
        .custom(customValidators.isValidPermissionScope).withMessage('Invalid permission scope'),

    body('permissions')
        .optional()
        .custom(customValidators.isValidPermissions).withMessage('Invalid permissions format'),

    body('role_id')
        .optional()
        .isUUID().withMessage('Invalid role ID format'),

    body('rate_limit')
        .optional()
        .custom(customValidators.isValidRateLimit).withMessage('Rate limit must be positive integer'),

    body('rate_limit_window')
        .optional()
        .custom(customValidators.isValidRateLimitWindow).withMessage('Rate limit window must be between 1-86400 seconds'),

    body('burst_multiplier')
        .optional()
        .custom(customValidators.isValidBurstMultiplier).withMessage('Burst multiplier must be between 1.0 and 5.0'),

    body('expires_at')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format')
        .custom(customValidators.isValidExpiryDate).withMessage('Expiry date must be in future'),

    body('allowed_ips')
        .optional()
        .isArray().withMessage('Allowed IPs must be array')
        .custom((ips) => {
            if (!ips) return true;
            return ips.every(ip => customValidators.isValidIpOrCidr(ip));
        }).withMessage('Invalid IP address or CIDR range'),

    body('allowed_domains')
        .optional()
        .isArray().withMessage('Allowed domains must be array')
        .custom((domains) => {
            if (!domains) return true;
            return domains.every(d => customValidators.isValidDomain(d));
        }).withMessage('Invalid domain format'),

    body('allowed_origins')
        .optional()
        .isArray().withMessage('Allowed origins must be array')
        .custom((origins) => {
            if (!origins) return true;
            return origins.every(o => customValidators.isValidDomain(o) || o === '*');
        }).withMessage('Invalid origin format'),

    body('allowed_days')
        .optional()
        .custom(customValidators.isValidDays).withMessage('Days must be 0-6 array'),

    body('allowed_hours_start')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid hour format (HH:MM)'),

    body('allowed_hours_end')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid hour format (HH:MM)')
        .custom((end, { req }) => {
            if (req.body.allowed_hours_start && end) {
                return customValidators.isValidHourRange(req.body.allowed_hours_start, end);
            }
            return true;
        }).withMessage('End hour must be after start hour'),

    body('requires_mfa')
        .optional()
        .isBoolean().withMessage('Requires MFA must be boolean'),

    validate
];

// ============================================
// UPDATE API KEY VALIDATOR
// ============================================

const validateApiKeyUpdate = [
    param('id')
        .isUUID().withMessage('Invalid API key ID format'),

    body('key_name')
        .optional()
        .isString().withMessage('Key name must be string')
        .isLength({ min: 3, max: 100 }).withMessage('Key name must be between 3-100 characters')
        .trim()
        .escape(),

    body('key_description')
        .optional()
        .isString().withMessage('Description must be string')
        .isLength({ max: 500 }).withMessage('Description too long')
        .trim()
        .escape(),

    body('permission_scope')
        .optional()
        .custom(customValidators.isValidPermissionScope).withMessage('Invalid permission scope'),

    body('permissions')
        .optional()
        .custom(customValidators.isValidPermissions).withMessage('Invalid permissions format'),

    body('rate_limit')
        .optional()
        .custom(customValidators.isValidRateLimit).withMessage('Rate limit must be positive integer'),

    body('rate_limit_window')
        .optional()
        .custom(customValidators.isValidRateLimitWindow).withMessage('Rate limit window must be between 1-86400 seconds'),

    body('burst_multiplier')
        .optional()
        .custom(customValidators.isValidBurstMultiplier).withMessage('Burst multiplier must be between 1.0 and 5.0'),

    body('expires_at')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format')
        .custom(customValidators.isValidExpiryDate).withMessage('Expiry date must be in future'),

    body('allowed_ips')
        .optional()
        .isArray().withMessage('Allowed IPs must be array')
        .custom((ips) => {
            if (!ips) return true;
            return ips.every(ip => customValidators.isValidIpOrCidr(ip));
        }).withMessage('Invalid IP address or CIDR range'),

    body('allowed_domains')
        .optional()
        .isArray().withMessage('Allowed domains must be array')
        .custom((domains) => {
            if (!domains) return true;
            return domains.every(d => customValidators.isValidDomain(d));
        }).withMessage('Invalid domain format'),

    body('allowed_origins')
        .optional()
        .isArray().withMessage('Allowed origins must be array')
        .custom((origins) => {
            if (!origins) return true;
            return origins.every(o => customValidators.isValidDomain(o) || o === '*');
        }).withMessage('Invalid origin format'),

    body('allowed_days')
        .optional()
        .custom(customValidators.isValidDays).withMessage('Days must be 0-6 array'),

    body('allowed_hours_start')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid hour format (HH:MM)'),

    body('allowed_hours_end')
        .optional()
        .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid hour format (HH:MM)'),

    body('requires_mfa')
        .optional()
        .isBoolean().withMessage('Requires MFA must be boolean'),

    validate
];

// ============================================
// REVOKE API KEY VALIDATOR
// ============================================

const validateApiKeyRevoke = [
    param('id')
        .isUUID().withMessage('Invalid API key ID format'),

    body('reason')
        .notEmpty().withMessage('Revocation reason is required')
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
// ROTATE API KEY VALIDATOR
// ============================================

const validateApiKeyRotate = [
    param('id')
        .isUUID().withMessage('Invalid API key ID format'),

    body('reason')
        .notEmpty().withMessage('Rotation reason is required')
        .custom(customValidators.isValidRotationReason).withMessage('Invalid rotation reason')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 3, max: 200 }).withMessage('Reason must be between 3-200 characters')
        .trim()
        .escape(),

    body('grace_period_days')
        .optional()
        .isInt({ min: 0, max: 30 }).withMessage('Grace period must be between 0-30 days'),

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
        .isIn(['created_at', 'issued_at', 'expires_at', 'last_used', 'key_name', 'status', 'usage_count'])
        .withMessage('Invalid sort field'),

    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),

    query('status')
        .optional()
        .custom(customValidators.isValidApiKeyStatus).withMessage('Invalid status'),

    query('key_type')
        .optional()
        .custom(customValidators.isValidApiKeyType).withMessage('Invalid key type'),

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
            if (req.query.from_date && new Date(to) < new Date(req.query.from_date)) {
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
    validateApiKeyId,
    validateApiKeyCreate,
    validateApiKeyUpdate,
    validateApiKeyRevoke,
    validateApiKeyRotate,
    validatePagination,
    validateDateRange,
    validate,
    customValidators
};

/**
 * ======================================================================
 * VALIDATORS SUMMARY:
 * ======================================================================
 * 
 * Validator              | Used For                | Rules
 * -----------------------|-------------------------|----------------------
 * validateApiKeyId       | Get, update, delete     | UUID validation
 * validateApiKeyCreate   | Create new key          | name, type, permissions, rate limits, IPs, domains
 * validateApiKeyUpdate   | Update existing key     | optional fields
 * validateApiKeyRevoke   | Revoke key              | reason required
 * validateApiKeyRotate   | Rotate key              | reason, grace period
 * validatePagination     | List endpoints          | page, limit, sort, filters
 * validateDateRange      | Logs & stats            | from_date, to_date
 * -----------------------|-------------------------|----------------------
 * TOTAL: 7 Validators with 35+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-API-01] Unique key names per user (service layer)
 * - [BR-API-02] Expiry date validation
 * - [BR-API-03] Rate limit range validation
 * - [BR-API-04] Revoke/rotate reason required
 * - [BR-API-05] All validations logged
 * 
 * ======================================================================
 */