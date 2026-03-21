/**
 * ======================================================================
 * FILE: backend/src/validators/staffValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Ground Staff module request validators.
 * Total Validators: 8 main validators with 25+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-46] Tasks must be acknowledged within 30 minutes
 * - [BR-47] Transport requests require driver assignment
 * - [BR-48] Samples must be delivered within 2 hours of collection
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
 * Custom validators for staff module
 */
const customValidators = {
    // Valid task priority
    isValidPriority: (priority) => {
        const validPriorities = ['high', 'medium', 'low', 'urgent'];
        return validPriorities.includes(priority);
    },

    // Valid task status transition
    isValidTaskStatusTransition: (fromStatus, toStatus) => {
        const validTransitions = {
            'pending': ['accepted', 'rejected'],
            'accepted': ['in_progress', 'postponed'],
            'in_progress': ['completed', 'postponed'],
            'postponed': ['accepted'],
            'rejected': [],
            'completed': []
        };
        return validTransitions[fromStatus]?.includes(toStatus) || false;
    },

    // Valid transport type
    isValidTransportType: (type) => {
        const validTypes = ['patient_transfer', 'sample_transport', 'medicine_delivery', 'equipment_transport', 'other'];
        return validTypes.includes(type);
    },

    // Valid transport status
    isValidTransportStatus: (status) => {
        const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
        return validStatuses.includes(status);
    },

    // Valid sample type
    isValidSampleType: (type) => {
        const validTypes = ['blood', 'urine', 'stool', 'tissue', 'swab', 'other'];
        return validTypes.includes(type);
    },

    // Valid sample status
    isValidSampleStatus: (status) => {
        const validStatuses = ['pending', 'collected', 'in_transit', 'delivered', 'rejected'];
        return validStatuses.includes(status);
    },

    // Check if task is overdue
    isTaskOverdue: (createdAt) => {
        const created = new Date(createdAt);
        const now = new Date();
        const minutesSinceCreation = (now - created) / (1000 * 60);
        return minutesSinceCreation > 30;
    }
};

// ============================================
// TASK VALIDATORS
// ============================================

const validateTaskStatus = [
    param('id')
        .isUUID().withMessage('Invalid task ID format'),
    
    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['accepted', 'rejected', 'in_progress', 'completed', 'postponed'])
        .withMessage('Invalid status value'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

const validateTaskAssignment = [
    param('id')
        .isUUID().withMessage('Invalid task ID format'),
    
    body('staff_id')
        .optional()
        .isUUID().withMessage('Invalid staff ID format'),
    
    body('assigned_by')
        .optional()
        .isUUID().withMessage('Invalid assigner ID format'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// TRANSPORT VALIDATORS
// ============================================

const validateTransportRequest = [
    body('request_type')
        .notEmpty().withMessage('Request type is required')
        .custom(customValidators.isValidTransportType).withMessage('Invalid transport type'),
    
    body('from_location')
        .notEmpty().withMessage('From location is required')
        .isString().withMessage('From location must be string')
        .isLength({ max: 200 }).withMessage('From location too long')
        .trim()
        .escape(),
    
    body('to_location')
        .notEmpty().withMessage('To location is required')
        .isString().withMessage('To location must be string')
        .isLength({ max: 200 }).withMessage('To location too long')
        .trim()
        .escape(),
    
    body('patient_id')
        .optional()
        .isUUID().withMessage('Invalid patient ID format'),
    
    body('priority')
        .optional()
        .custom(customValidators.isValidPriority).withMessage('Invalid priority'),
    
    body('scheduled_time')
        .optional()
        .isISO8601().withMessage('Invalid scheduled time format'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

const validateTransportStatus = [
    param('id')
        .isUUID().withMessage('Invalid transport request ID format'),
    
    body('status')
        .notEmpty().withMessage('Status is required')
        .custom(customValidators.isValidTransportStatus).withMessage('Invalid status value'),
    
    body('driver_id')
        .optional()
        .isUUID().withMessage('Invalid driver ID format')
        .custom((value, { req }) => {
            if (req.body.status === 'accepted' && !value) {
                throw new Error('Driver ID is required when accepting transport request');
            }
            return true;
        }),
    
    body('vehicle_number')
        .optional()
        .isString().withMessage('Vehicle number must be string')
        .isLength({ max: 50 }).withMessage('Vehicle number too long')
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
// SAMPLE VALIDATORS
// ============================================

const validateSample = [
    body('sample_type')
        .notEmpty().withMessage('Sample type is required')
        .custom(customValidators.isValidSampleType).withMessage('Invalid sample type'),
    
    body('patient_id')
        .notEmpty().withMessage('Patient ID is required')
        .isUUID().withMessage('Invalid patient ID format'),
    
    body('lab_order_id')
        .optional()
        .isUUID().withMessage('Invalid lab order ID format'),
    
    body('collection_location')
        .optional()
        .isString().withMessage('Collection location must be string')
        .isLength({ max: 200 }).withMessage('Collection location too long')
        .trim()
        .escape(),
    
    body('delivery_location')
        .optional()
        .isString().withMessage('Delivery location must be string')
        .isLength({ max: 200 }).withMessage('Delivery location too long')
        .trim()
        .escape(),
    
    body('priority')
        .optional()
        .custom(customValidators.isValidPriority).withMessage('Invalid priority'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

const validateSampleStatus = [
    param('id')
        .isUUID().withMessage('Invalid sample ID format'),
    
    body('status')
        .notEmpty().withMessage('Status is required')
        .custom(customValidators.isValidSampleStatus).withMessage('Invalid status value'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    body('collected_at')
        .optional()
        .isISO8601().withMessage('Invalid collection time format'),
    
    body('delivered_at')
        .optional()
        .isISO8601().withMessage('Invalid delivery time format'),
    
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
        .isIn(['created_at', 'priority', 'status', 'scheduled_time'])
        .withMessage('Invalid sort field'),
    
    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    
    validate
];

// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    // Task validators
    validateTaskStatus,
    validateTaskAssignment,
    
    // Transport validators
    validateTransportRequest,
    validateTransportStatus,
    
    // Sample validators
    validateSample,
    validateSampleStatus,
    
    // Pagination validator
    validatePagination,
    
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
 * validateTaskStatus       | Update task status          | status, notes
 * validateTaskAssignment   | Assign/reassign task        | staff_id, notes
 * validateTransportRequest | Create transport request    | type, locations, priority
 * validateTransportStatus  | Update transport status     | status, driver_id
 * validateSample           | Register sample             | type, patient, priority
 * validateSampleStatus     | Update sample status        | status, notes
 * validatePagination       | Pagination                  | page, limit, sort
 * -------------------------|-----------------------------|----------------------
 * TOTAL: 7 Validators with 25+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-46] Task acknowledgment window (service level)
 * - [BR-47] Driver assignment for transport (validator level)
 * - [BR-48] Sample delivery window (service level)
 * 
 * ======================================================================
 */