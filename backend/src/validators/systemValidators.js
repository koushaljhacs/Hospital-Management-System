// backend/src/validators/systemValidators.js
/**
 * ======================================================================
 * FILE: backend/src/validators/systemValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * System Management module request validators.
 * Total Validators: 6 main validators
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-SYS-01] Health check response < 500ms
 * - [BR-SYS-02] Version info publicly accessible
 * - [BR-SYS-03] System info restricted
 * - [BR-SYS-04] Health checks bypass rate limits
 * - [BR-SYS-05] All events logged
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
 * Custom validators for system module
 */
const customValidators = {
    // Valid environment
    isValidEnvironment: (env) => {
        const validEnvs = ['development', 'staging', 'production', 'test'];
        return validEnvs.includes(env);
    },

    // Valid log level
    isValidLogLevel: (level) => {
        const validLevels = ['error', 'warn', 'info', 'http', 'debug'];
        return validLevels.includes(level);
    },

    // Valid time range
    isValidTimeRange: (start, end) => {
        if (!start || !end) return true;
        return new Date(end) >= new Date(start);
    },

    // Valid component name
    isValidComponent: (component) => {
        const validComponents = ['database', 'cache', 'api', 'auth', 'webhook', 'all'];
        return validComponents.includes(component);
    },

    // Valid metric name
    isValidMetric: (metric) => {
        const validMetrics = ['cpu', 'memory', 'disk', 'network', 'db_connections', 'all'];
        return validMetrics.includes(metric);
    }
};

// ============================================
// HEALTH CHECK VALIDATORS
// ============================================

const validateHealthCheck = [
    query('component')
        .optional()
        .custom(customValidators.isValidComponent).withMessage('Invalid component name'),
    validate
];

const validateDbHealth = [
    query('timeout')
        .optional()
        .isInt({ min: 1000, max: 30000 }).withMessage('Timeout must be between 1000-30000ms')
        .toInt(),
    validate
];

// ============================================
// VERSION VALIDATOR
// ============================================

const validateVersion = [
    query('format')
        .optional()
        .isIn(['json', 'text']).withMessage('Format must be json or text'),
    validate
];

// ============================================
// SYSTEM INFO VALIDATORS
// ============================================

const validateSystemInfo = [
    query('section')
        .optional()
        .isIn(['all', 'os', 'process', 'database', 'cache', 'network'])
        .withMessage('Invalid section'),
    validate
];

// ============================================
// SYSTEM STATUS VALIDATORS
// ============================================

const validateSystemStatus = [
    query('metrics')
        .optional()
        .custom(customValidators.isValidMetric).withMessage('Invalid metric name'),
    query('since')
        .optional()
        .isISO8601().withMessage('Invalid since date format'),
    query('until')
        .optional()
        .isISO8601().withMessage('Invalid until date format')
        .custom((until, { req }) => {
            if (req.query.since && until) {
                return customValidators.isValidTimeRange(req.query.since, until);
            }
            return true;
        }).withMessage('Until date must be after since date'),
    validate
];

// ============================================
// LOG VALIDATOR
// ============================================

const validateLogs = [
    query('level')
        .optional()
        .custom(customValidators.isValidLogLevel).withMessage('Invalid log level'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1-1000')
        .toInt(),
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from date format'),
    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to date format')
        .custom((to, { req }) => {
            if (req.query.from_date && to) {
                return customValidators.isValidTimeRange(req.query.from_date, to);
            }
            return true;
        }).withMessage('To date must be after from date'),
    validate
];

// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    // Health validators
    validateHealthCheck,
    validateDbHealth,
    
    // Version validator
    validateVersion,
    
    // System info validator
    validateSystemInfo,
    
    // System status validator
    validateSystemStatus,
    
    // Log validator
    validateLogs,
    
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
 * validateHealthCheck    | Health checks           | component filter
 * validateDbHealth       | Database health         | timeout
 * validateVersion        | Version info            | format
 * validateSystemInfo     | System info             | section filter
 * validateSystemStatus   | System status           | metrics, date range
 * validateLogs           | System logs             | level, limit, dates
 * -----------------------|-------------------------|----------------------
 * TOTAL: 6 Validators
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-SYS-01] Health check response time (service layer)
 * - [BR-SYS-02] Version format validation
 * - [BR-SYS-03] System info access (auth layer)
 * - [BR-SYS-04] Health checks bypass (route layer)
 * - [BR-SYS-05] All events logged
 * 
 * ======================================================================
 */
