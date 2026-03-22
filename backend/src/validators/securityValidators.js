/**
 * ======================================================================
 * FILE: backend/src/validators/securityValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Security Guard module request validators.
 * Total Validators: 7 main validators with 20+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-49] All entries must be logged with ID verification
 * - [BR-50] Visitors must be registered before entry
 * - [BR-51] Exit must be recorded for all entries
 * - [BR-52] Active visitors cannot exceed capacity
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
 * Custom validators for security module
 */
const customValidators = {
    // Valid entry type
    isValidEntryType: (type) => {
        const validTypes = ['employee', 'patient', 'visitor', 'vendor', 'emergency', 'staff'];
        return validTypes.includes(type);
    },

    // Valid ID type
    isValidIdType: (type) => {
        const validTypes = ['aadhar', 'pan', 'driving_license', 'passport', 'employee_id', 'hospital_id', 'other'];
        return validTypes.includes(type);
    },

    // Valid visitor type
    isValidVisitorType: (type) => {
        const validTypes = ['patient_relative', 'business', 'delivery', 'interview', 'official', 'other'];
        return validTypes.includes(type);
    },

    // Valid ID card format
    isValidIdCardNumber: (number) => {
        const idCardRegex = /^[A-Z0-9]{6,20}$/;
        return idCardRegex.test(number);
    },

    // Check capacity [BR-52]
    isWithinCapacity: async (visitorCount, maxCapacity = 100) => {
        return visitorCount < maxCapacity;
    },

    // Valid purpose
    isValidPurpose: (purpose) => {
        const validPurposes = ['visit', 'meeting', 'delivery', 'emergency', 'consultation', 'other'];
        return validPurposes.includes(purpose);
    }
};

// ============================================
// ENTRY VALIDATORS
// ============================================

const validateEntry = [
    body('person_name')
        .notEmpty().withMessage('Person name is required')
        .isString().withMessage('Person name must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters')
        .trim()
        .escape(),
    
    body('entry_type')
        .notEmpty().withMessage('Entry type is required')
        .custom(customValidators.isValidEntryType).withMessage('Invalid entry type'),
    
    body('id_type')
        .notEmpty().withMessage('ID type is required')
        .custom(customValidators.isValidIdType).withMessage('Invalid ID type'),
    
    body('id_number')
        .notEmpty().withMessage('ID number is required')
        .isString().withMessage('ID number must be string')
        .isLength({ min: 2, max: 50 }).withMessage('ID number must be between 2-50 characters')
        .trim()
        .escape(),
    
    body('purpose')
        .optional()
        .custom(customValidators.isValidPurpose).withMessage('Invalid purpose'),
    
    body('department_to_visit')
        .optional()
        .isString().withMessage('Department must be string')
        .isLength({ max: 100 }).withMessage('Department name too long')
        .trim()
        .escape(),
    
    body('person_to_meet')
        .optional()
        .isString().withMessage('Person to meet must be string')
        .isLength({ max: 100 }).withMessage('Person name too long')
        .trim()
        .escape(),
    
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

const validateEntryStatus = [
    param('id')
        .isUUID().withMessage('Invalid entry ID format'),
    
    body('exit_time')
        .optional()
        .isISO8601().withMessage('Invalid exit time format')
        .custom((exitTime) => {
            if (new Date(exitTime) > new Date()) {
                throw new Error('Exit time cannot be in the future');
            }
            return true;
        }),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// EXIT VALIDATORS
// ============================================

const validateExit = [
    body('entry_id')
        .notEmpty().withMessage('Entry ID is required')
        .isUUID().withMessage('Invalid entry ID format'),
    
    body('exit_time')
        .optional()
        .isISO8601().withMessage('Invalid exit time format'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// VISITOR VALIDATORS
// ============================================

const validateVisitor = [
    body('name')
        .notEmpty().withMessage('Visitor name is required')
        .isString().withMessage('Name must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters')
        .trim()
        .escape(),
    
    body('phone')
        .notEmpty().withMessage('Phone number is required')
        .isMobilePhone().withMessage('Invalid phone number'),
    
    body('visitor_type')
        .notEmpty().withMessage('Visitor type is required')
        .custom(customValidators.isValidVisitorType).withMessage('Invalid visitor type'),
    
    body('id_card_number')
        .optional()
        .custom(customValidators.isValidIdCardNumber).withMessage('Invalid ID card number format')
        .trim()
        .toUpperCase(),
    
    body('id_card_type')
        .optional()
        .custom(customValidators.isValidIdType).withMessage('Invalid ID type'),
    
    body('purpose')
        .optional()
        .custom(customValidators.isValidPurpose).withMessage('Invalid purpose'),
    
    body('person_to_meet')
        .optional()
        .isString().withMessage('Person to meet must be string')
        .isLength({ max: 100 }).withMessage('Person name too long')
        .trim()
        .escape(),
    
    body('department')
        .optional()
        .isString().withMessage('Department must be string')
        .isLength({ max: 100 }).withMessage('Department name too long')
        .trim()
        .escape(),
    
    body('expected_duration')
        .optional()
        .isInt({ min: 1, max: 480 }).withMessage('Expected duration must be between 1-480 minutes'),
    
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

const validateVisitorStatus = [
    param('id')
        .isUUID().withMessage('Invalid visitor ID format'),
    
    body('check_out_time')
        .optional()
        .isISO8601().withMessage('Invalid check-out time format'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
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
        .isIn(['entry_time', 'exit_time', 'name', 'created_at'])
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
    // Entry validators
    validateEntry,
    validateEntryStatus,
    
    // Exit validators
    validateExit,
    
    // Visitor validators
    validateVisitor,
    validateVisitorStatus,
    
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
 * validateEntry            | Record entry                | person, ID, purpose
 * validateEntryStatus      | Mark entry exit             | exit_time, notes
 * validateExit             | Record exit                 | entry_id, exit_time
 * validateVisitor          | Register visitor            | name, phone, type
 * validateVisitorStatus    | Checkout visitor            | check_out_time
 * validatePagination       | Pagination                  | page, limit, sort
 * -------------------------|-----------------------------|----------------------
 * TOTAL: 6 Validators with 20+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-49] ID verification required
 * - [BR-50] Visitor registration validation
 * - [BR-51] Exit time validation
 * - [BR-52] Capacity check (service level)
 * 
 * ======================================================================
 */