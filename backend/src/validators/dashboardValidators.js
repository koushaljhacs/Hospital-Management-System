/**
 * ======================================================================
 * FILE: backend/src/validators/dashboardValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Dashboard module request validators.
 * Total Validators: 3 main validators with 10+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
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
 * Custom validators for dashboard module
 */
const customValidators = {
    // Valid period for dashboard data
    isValidPeriod: (period) => {
        const validPeriods = ['day', 'week', 'month', 'quarter', 'year', 'all'];
        return validPeriods.includes(period);
    },

    // Valid date range
    isValidDateRange: (fromDate, toDate) => {
        if (fromDate && toDate) {
            return new Date(toDate) >= new Date(fromDate);
        }
        return true;
    },

    // Valid metric type
    isValidMetricType: (metric) => {
        const validMetrics = ['revenue', 'patients', 'appointments', 'prescriptions', 'lab_tests'];
        return validMetrics.includes(metric);
    }
};

// ============================================
// DATE RANGE VALIDATORS
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
            if (req.query.from_date && (new Date(to) - new Date(req.query.from_date)) > 365 * 24 * 60 * 60 * 1000) {
                throw new Error('Date range cannot exceed 1 year');
            }
            return true;
        }),
    
    query('period')
        .optional()
        .custom(customValidators.isValidPeriod).withMessage('Invalid period value'),
    
    validate
];

// ============================================
// PAGINATION VALIDATORS
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
        .isIn(['date', 'count', 'value', 'created_at'])
        .withMessage('Invalid sort field'),
    
    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    
    validate
];

// ============================================
// DASHBOARD FILTER VALIDATORS
// ============================================

const validateDashboardFilters = [
    query('department_id')
        .optional()
        .isUUID().withMessage('Invalid department ID format'),
    
    query('doctor_id')
        .optional()
        .isUUID().withMessage('Invalid doctor ID format'),
    
    query('patient_id')
        .optional()
        .isUUID().withMessage('Invalid patient ID format'),
    
    query('ward')
        .optional()
        .isString().withMessage('Ward must be string')
        .isLength({ max: 100 }).withMessage('Ward name too long')
        .trim()
        .escape(),
    
    query('category')
        .optional()
        .isString().withMessage('Category must be string')
        .isLength({ max: 100 }).withMessage('Category name too long')
        .trim()
        .escape(),
    
    query('metric')
        .optional()
        .custom(customValidators.isValidMetricType).withMessage('Invalid metric type'),
    
    query('group_by')
        .optional()
        .isIn(['day', 'week', 'month', 'quarter', 'year']).withMessage('Invalid group_by value'),
    
    validate
];

// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    // Date range validators
    validateDateRange,
    
    // Pagination validators
    validatePagination,
    
    // Dashboard filter validators
    validateDashboardFilters,
    
    // Export validate middleware
    validate,
    
    // Export custom validators for reuse
    customValidators
};

/**
 * ======================================================================
 * VALIDATORS SUMMARY:
 * ======================================================================
 * 
 * Validator                | Used For                    | Rules
 * -------------------------|-----------------------------|----------------------
 * validateDateRange        | Date range filtering        | from_date, to_date, period
 * validatePagination       | Pagination                  | page, limit, sort
 * validateDashboardFilters | Dashboard filters           | department, doctor, ward, metric
 * -------------------------|-----------------------------|----------------------
 * TOTAL: 3 Validators with 10+ validation rules
 * 
 * ======================================================================
 */