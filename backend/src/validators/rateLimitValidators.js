// backend/src/validators/rateLimitValidators.js
/**
 * ======================================================================
 * FILE: backend/src/validators/rateLimitValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Rate Limit Management module request validators.
 * Total Validators: 7 main validators with 25+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-RL-01] Rate limits per user/role/endpoint/IP
 * - [BR-RL-02] Rules evaluated by priority
 * - [BR-RL-03] Exceeded triggers block/throttle
 * - [BR-RL-04] Exemptions for whitelisted
 * - [BR-RL-05] All events logged
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
 * Custom validators for rate limit module
 */
const customValidators = {
    // Valid rule type
    isValidRuleType: (type) => {
        const validTypes = ['global', 'user', 'role', 'ip', 'api_key', 'endpoint'];
        return validTypes.includes(type);
    },

    // Valid action type
    isValidAction: (action) => {
        const validActions = ['allow', 'block', 'throttle', 'log_only'];
        return validActions.includes(action);
    },

    // Valid HTTP methods
    isValidHttpMethod: (method) => {
        const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
        return validMethods.includes(method);
    },

    // Valid window seconds
    isValidWindowSeconds: (seconds) => {
        return Number.isInteger(seconds) && seconds >= 1 && seconds <= 86400;
    },

    // Valid max requests
    isValidMaxRequests: (requests) => {
        return Number.isInteger(requests) && requests >= 1 && requests <= 100000;
    },

    // Valid burst multiplier
    isValidBurstMultiplier: (multiplier) => {
        return typeof multiplier === 'number' && multiplier >= 1.0 && multiplier <= 10.0;
    },

    // Valid penalty duration
    isValidPenaltyDuration: (duration) => {
        return Number.isInteger(duration) && duration >= 60 && duration <= 86400;
    },

    // Valid penalty multiplier
    isValidPenaltyMultiplier: (multiplier) => {
        return typeof multiplier === 'number' && multiplier >= 1.0 && multiplier <= 5.0;
    },

    // Valid priority
    isValidPriority: (priority) => {
        return Number.isInteger(priority) && priority >= 0 && priority <= 1000;
    },

    // Valid IP or CIDR
    isValidIpOrCidr: (ip) => {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        return ipv4Regex.test(ip) || cidrRegex.test(ip);
    },

    // Valid endpoint pattern (regex)
    isValidEndpointPattern: (pattern) => {
        if (!pattern) return true;
        try {
            new RegExp(pattern);
            return true;
        } catch {
            return false;
        }
    },

    // Valid exemption reason
    isValidExemptionReason: (reason) => {
        const validReasons = ['internal_service', 'development', 'testing', 'partner', 'emergency'];
        return validReasons.includes(reason);
    },

    // Valid date range
    isValidDateRange: (start, end) => {
        if (!start || !end) return true;
        return new Date(end) >= new Date(start);
    }
};

// ============================================
// RULE VALIDATORS
// ============================================

const validateRuleId = [
    param('id')
        .isUUID().withMessage('Invalid rule ID format')
        .notEmpty().withMessage('Rule ID is required'),
    validate
];

const validateRuleCreate = [
    body('rule_name')
        .notEmpty().withMessage('Rule name is required')
        .isString().withMessage('Rule name must be string')
        .isLength({ min: 3, max: 100 }).withMessage('Rule name must be between 3-100 characters')
        .trim()
        .escape(),

    body('rule_description')
        .optional()
        .isString().withMessage('Description must be string')
        .isLength({ max: 500 }).withMessage('Description too long')
        .trim()
        .escape(),

    body('rule_type')
        .notEmpty().withMessage('Rule type is required')
        .custom(customValidators.isValidRuleType).withMessage('Invalid rule type'),

    body('applies_to_users')
        .optional()
        .isArray().withMessage('Users must be array')
        .custom((users) => {
            if (!users) return true;
            return users.every(u => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(u));
        }).withMessage('Invalid user ID format'),

    body('applies_to_roles')
        .optional()
        .isArray().withMessage('Roles must be array')
        .custom((roles) => {
            if (!roles) return true;
            return roles.every(r => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r));
        }).withMessage('Invalid role ID format'),

    body('applies_to_api_keys')
        .optional()
        .isArray().withMessage('API keys must be array')
        .custom((keys) => {
            if (!keys) return true;
            return keys.every(k => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k));
        }).withMessage('Invalid API key ID format'),

    body('applies_to_ips')
        .optional()
        .isArray().withMessage('IPs must be array')
        .custom((ips) => {
            if (!ips) return true;
            return ips.every(ip => customValidators.isValidIpOrCidr(ip));
        }).withMessage('Invalid IP address or CIDR range'),

    body('applies_to_ip_ranges')
        .optional()
        .isArray().withMessage('IP ranges must be array')
        .custom((ranges) => {
            if (!ranges) return true;
            return ranges.every(r => customValidators.isValidIpOrCidr(r));
        }).withMessage('Invalid CIDR range'),

    body('endpoint_pattern')
        .optional()
        .custom(customValidators.isValidEndpointPattern).withMessage('Invalid regex pattern'),

    body('http_methods')
        .optional()
        .isArray().withMessage('HTTP methods must be array')
        .custom((methods) => {
            if (!methods) return true;
            return methods.every(m => customValidators.isValidHttpMethod(m));
        }).withMessage('Invalid HTTP method'),

    body('exclude_endpoints')
        .optional()
        .isArray().withMessage('Exclude endpoints must be array'),

    body('window_seconds')
        .notEmpty().withMessage('Window seconds is required')
        .custom(customValidators.isValidWindowSeconds).withMessage('Window must be 1-86400 seconds'),

    body('max_requests')
        .notEmpty().withMessage('Max requests is required')
        .custom(customValidators.isValidMaxRequests).withMessage('Max requests must be 1-100000'),

    body('burst_multiplier')
        .optional()
        .custom(customValidators.isValidBurstMultiplier).withMessage('Burst multiplier must be 1.0-10.0'),

    body('action')
        .notEmpty().withMessage('Action is required')
        .custom(customValidators.isValidAction).withMessage('Invalid action'),

    body('penalty_duration')
        .optional()
        .custom(customValidators.isValidPenaltyDuration).withMessage('Penalty duration must be 60-86400 seconds'),

    body('penalty_multiplier')
        .optional()
        .custom(customValidators.isValidPenaltyMultiplier).withMessage('Penalty multiplier must be 1.0-5.0'),

    body('priority')
        .optional()
        .custom(customValidators.isValidPriority).withMessage('Priority must be 0-1000'),

    body('is_active')
        .optional()
        .isBoolean().withMessage('Is active must be boolean'),

    body('valid_from')
        .optional()
        .isISO8601().withMessage('Invalid from date format'),

    body('valid_to')
        .optional()
        .isISO8601().withMessage('Invalid to date format')
        .custom((to, { req }) => {
            if (req.body.valid_from && to) {
                return customValidators.isValidDateRange(req.body.valid_from, to);
            }
            return true;
        }).withMessage('Valid to must be after valid from'),

    validate
];

const validateRuleUpdate = [
    param('id')
        .isUUID().withMessage('Invalid rule ID format'),

    body('rule_name')
        .optional()
        .isString().withMessage('Rule name must be string')
        .isLength({ min: 3, max: 100 }).withMessage('Rule name must be between 3-100 characters')
        .trim()
        .escape(),

    body('rule_description')
        .optional()
        .isString().withMessage('Description must be string')
        .isLength({ max: 500 }).withMessage('Description too long')
        .trim()
        .escape(),

    body('applies_to_users')
        .optional()
        .isArray().withMessage('Users must be array'),

    body('applies_to_roles')
        .optional()
        .isArray().withMessage('Roles must be array'),

    body('applies_to_api_keys')
        .optional()
        .isArray().withMessage('API keys must be array'),

    body('applies_to_ips')
        .optional()
        .isArray().withMessage('IPs must be array'),

    body('applies_to_ip_ranges')
        .optional()
        .isArray().withMessage('IP ranges must be array'),

    body('endpoint_pattern')
        .optional()
        .custom(customValidators.isValidEndpointPattern).withMessage('Invalid regex pattern'),

    body('http_methods')
        .optional()
        .isArray().withMessage('HTTP methods must be array'),

    body('exclude_endpoints')
        .optional()
        .isArray().withMessage('Exclude endpoints must be array'),

    body('window_seconds')
        .optional()
        .custom(customValidators.isValidWindowSeconds).withMessage('Window must be 1-86400 seconds'),

    body('max_requests')
        .optional()
        .custom(customValidators.isValidMaxRequests).withMessage('Max requests must be 1-100000'),

    body('burst_multiplier')
        .optional()
        .custom(customValidators.isValidBurstMultiplier).withMessage('Burst multiplier must be 1.0-10.0'),

    body('action')
        .optional()
        .custom(customValidators.isValidAction).withMessage('Invalid action'),

    body('penalty_duration')
        .optional()
        .custom(customValidators.isValidPenaltyDuration).withMessage('Penalty duration must be 60-86400 seconds'),

    body('penalty_multiplier')
        .optional()
        .custom(customValidators.isValidPenaltyMultiplier).withMessage('Penalty multiplier must be 1.0-5.0'),

    body('priority')
        .optional()
        .custom(customValidators.isValidPriority).withMessage('Priority must be 0-1000'),

    body('is_active')
        .optional()
        .isBoolean().withMessage('Is active must be boolean'),

    body('valid_from')
        .optional()
        .isISO8601().withMessage('Invalid from date format'),

    body('valid_to')
        .optional()
        .isISO8601().withMessage('Invalid to date format'),

    validate
];

// ============================================
// EXEMPTION VALIDATORS
// ============================================

const validateExemptionId = [
    param('id')
        .isUUID().withMessage('Invalid exemption ID format'),
    validate
];

const validateExemptionCreate = [
    body('exemption_name')
        .notEmpty().withMessage('Exemption name is required')
        .isString().withMessage('Exemption name must be string')
        .isLength({ min: 3, max: 100 }).withMessage('Exemption name must be between 3-100 characters')
        .trim()
        .escape(),

    body('exemption_description')
        .optional()
        .isString().withMessage('Description must be string')
        .isLength({ max: 500 }).withMessage('Description too long')
        .trim()
        .escape(),

    body('user_id')
        .optional()
        .isUUID().withMessage('Invalid user ID format'),

    body('role_id')
        .optional()
        .isUUID().withMessage('Invalid role ID format'),

    body('api_key_id')
        .optional()
        .isUUID().withMessage('Invalid API key ID format'),

    body('ip_address')
        .optional()
        .custom(customValidators.isValidIpOrCidr).withMessage('Invalid IP address'),

    body('ip_range')
        .optional()
        .custom(customValidators.isValidIpOrCidr).withMessage('Invalid CIDR range'),

    body('applies_to_endpoints')
        .optional()
        .isArray().withMessage('Endpoints must be array'),

    body('applies_to_methods')
        .optional()
        .isArray().withMessage('Methods must be array')
        .custom((methods) => {
            if (!methods) return true;
            return methods.every(m => customValidators.isValidHttpMethod(m));
        }).withMessage('Invalid HTTP method'),

    body('reason')
        .notEmpty().withMessage('Reason is required')
        .custom(customValidators.isValidExemptionReason).withMessage('Invalid exemption reason')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 10, max: 200 }).withMessage('Reason must be between 10-200 characters')
        .trim()
        .escape(),

    body('expires_at')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format')
        .custom((date) => {
            if (date && new Date(date) <= new Date()) {
                throw new Error('Expiry date must be in future');
            }
            return true;
        }),

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
        .isIn(['created_at', 'updated_at', 'priority', 'window_seconds', 'max_requests'])
        .withMessage('Invalid sort field'),

    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),

    query('rule_type')
        .optional()
        .custom(customValidators.isValidRuleType).withMessage('Invalid rule type'),

    query('is_active')
        .optional()
        .isBoolean().withMessage('Is active must be boolean'),

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
    // Rule validators
    validateRuleId,
    validateRuleCreate,
    validateRuleUpdate,
    
    // Exemption validators
    validateExemptionId,
    validateExemptionCreate,
    
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
 * validateRuleId         | Get/Update/Delete rule  | UUID validation
 * validateRuleCreate     | Create new rule         | type, window, requests
 * validateRuleUpdate     | Update existing rule    | optional fields
 * validateExemptionId    | Get/Delete exemption    | UUID validation
 * validateExemptionCreate| Create exemption        | target, reason, expiry
 * validatePagination     | List endpoints          | page, limit, sort
 * validateDateRange      | Stats & breaches        | from_date, to_date
 * -----------------------|-------------------------|----------------------
 * TOTAL: 7 Validators with 25+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-RL-01] Rule type validation
 * - [BR-RL-02] Priority range validation
 * - [BR-RL-03] Action type validation
 * - [BR-RL-04] Exemption reason validation
 * - [BR-RL-05] All fields validated
 * 
 * ======================================================================
 */