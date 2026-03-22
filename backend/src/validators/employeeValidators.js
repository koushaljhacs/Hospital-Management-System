/**
 * ======================================================================
 * FILE: backend/src/validators/employeeValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee Common module request validators.
 * Total Validators: 12 main validators with 35+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-53] Shift change requires 24 hours notice
 * - [BR-54] Attendance check-in within 15 minutes of shift start
 * - [BR-55] Leave balance cannot go negative
 * - [BR-56] Leave request requires minimum 2 days advance notice
 * - [BR-57] Documents must be verified before access
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
 * Custom validators for employee module
 */
const customValidators = {
    // Valid shift type
    isValidShiftType: (type) => {
        const validTypes = ['morning', 'evening', 'night', 'general', 'on_call'];
        return validTypes.includes(type);
    },

    // Valid attendance status
    isValidAttendanceStatus: (status) => {
        const validStatuses = ['present', 'absent', 'late', 'half_day', 'holiday', 'leave'];
        return validStatuses.includes(status);
    },

    // Valid leave type
    isValidLeaveType: (type) => {
        const validTypes = ['annual', 'sick', 'casual', 'emergency', 'maternity', 'paternity', 'unpaid'];
        return validTypes.includes(type);
    },

    // Valid leave status
    isValidLeaveStatus: (status) => {
        const validStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
        return validStatuses.includes(status);
    },

    // Valid document type
    isValidDocumentType: (type) => {
        const validTypes = ['id_proof', 'address_proof', 'qualification', 'experience', 'contract', 'other'];
        return validTypes.includes(type);
    },

    // Valid document status
    isValidDocumentStatus: (status) => {
        const validStatuses = ['pending', 'verified', 'rejected', 'expired'];
        return validStatuses.includes(status);
    },

    // Check shift change notice [BR-53]
    isShiftChangeNoticeValid: (shiftDate) => {
        const shiftDateTime = new Date(shiftDate);
        const now = new Date();
        const hoursNotice = (shiftDateTime - now) / (1000 * 60 * 60);
        return hoursNotice >= 24;
    },

    // Check leave advance notice [BR-56]
    isLeaveNoticeValid: (startDate) => {
        const leaveStartDate = new Date(startDate);
        const now = new Date();
        const daysNotice = (leaveStartDate - now) / (1000 * 60 * 60 * 24);
        return daysNotice >= 2;
    },

    // Valid date range
    isValidDateRange: (fromDate, toDate) => {
        return new Date(toDate) >= new Date(fromDate);
    }
};

// ============================================
// SHIFT VALIDATORS
// ============================================

const validateShift = [
    param('id')
        .isUUID().withMessage('Invalid shift ID format'),
    
    body('requested_shift_type')
        .optional()
        .custom(customValidators.isValidShiftType).withMessage('Invalid shift type'),
    
    body('requested_date')
        .notEmpty().withMessage('Requested date is required')
        .isISO8601().withMessage('Invalid date format')
        .custom(customValidators.isShiftChangeNoticeValid)
        .withMessage('Shift change requires at least 24 hours notice'),
    
    body('reason')
        .optional()
        .isString().withMessage('Reason must be string')
        .isLength({ max: 500 }).withMessage('Reason too long')
        .trim()
        .escape(),
    
    validate
];

const validateShiftStatus = [
    param('id')
        .isUUID().withMessage('Invalid shift ID format'),
    
    body('status')
        .optional()
        .isIn(['approved', 'rejected']).withMessage('Invalid status value'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// ATTENDANCE VALIDATORS
// ============================================

const validateAttendanceCheck = [
    body('location')
        .optional()
        .isObject().withMessage('Location must be an object'),
    
    body('location.latitude')
        .optional()
        .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    
    body('location.longitude')
        .optional()
        .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    
    body('device_info')
        .optional()
        .isString().withMessage('Device info must be string')
        .isLength({ max: 500 }).withMessage('Device info too long')
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

const validateAttendance = [
    body('status')
        .optional()
        .custom(customValidators.isValidAttendanceStatus).withMessage('Invalid attendance status'),
    
    body('date')
        .optional()
        .isISO8601().withMessage('Invalid date format'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// LEAVE VALIDATORS
// ============================================

const validateLeave = [
    body('leave_type')
        .notEmpty().withMessage('Leave type is required')
        .custom(customValidators.isValidLeaveType).withMessage('Invalid leave type'),
    
    body('start_date')
        .notEmpty().withMessage('Start date is required')
        .isISO8601().withMessage('Invalid start date format')
        .custom(customValidators.isLeaveNoticeValid)
        .withMessage('Leave request requires at least 2 days advance notice'),
    
    body('end_date')
        .notEmpty().withMessage('End date is required')
        .isISO8601().withMessage('Invalid end date format')
        .custom((endDate, { req }) => {
            if (new Date(endDate) < new Date(req.body.start_date)) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
    
    body('reason')
        .notEmpty().withMessage('Reason is required')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10-500 characters')
        .trim()
        .escape(),
    
    body('contact_number')
        .optional()
        .isMobilePhone().withMessage('Invalid contact number'),
    
    body('address_during_leave')
        .optional()
        .isString().withMessage('Address must be string')
        .isLength({ max: 500 }).withMessage('Address too long')
        .trim()
        .escape(),
    
    validate
];

const validateLeaveStatus = [
    param('id')
        .isUUID().withMessage('Invalid leave ID format'),
    
    body('status')
        .notEmpty().withMessage('Status is required')
        .custom(customValidators.isValidLeaveStatus).withMessage('Invalid status value'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// DOCUMENT VALIDATORS
// ============================================

const validateDocument = [
    body('document_type')
        .notEmpty().withMessage('Document type is required')
        .custom(customValidators.isValidDocumentType).withMessage('Invalid document type'),
    
    body('document_name')
        .notEmpty().withMessage('Document name is required')
        .isString().withMessage('Document name must be string')
        .isLength({ min: 2, max: 200 }).withMessage('Document name must be between 2-200 characters')
        .trim()
        .escape(),
    
    body('document_url')
        .notEmpty().withMessage('Document URL is required')
        .isURL().withMessage('Invalid URL format'),
    
    body('expiry_date')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

const validateDocumentStatus = [
    param('id')
        .isUUID().withMessage('Invalid document ID format'),
    
    body('status')
        .notEmpty().withMessage('Status is required')
        .custom(customValidators.isValidDocumentStatus).withMessage('Invalid status value'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// NOTIFICATION VALIDATORS
// ============================================

const validateNotification = [
    param('id')
        .isUUID().withMessage('Invalid notification ID format'),
    
    validate
];

// ============================================
// PROFILE VALIDATORS
// ============================================

const validateProfileUpdate = [
    body('phone')
        .optional()
        .isMobilePhone().withMessage('Invalid phone number'),
    
    body('email')
        .optional()
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('address')
        .optional()
        .isString().withMessage('Address must be string')
        .isLength({ max: 500 }).withMessage('Address too long')
        .trim()
        .escape(),
    
    body('emergency_contact_name')
        .optional()
        .isString().withMessage('Emergency contact name must be string')
        .isLength({ max: 100 }).withMessage('Name too long')
        .trim()
        .escape(),
    
    body('emergency_contact_phone')
        .optional()
        .isMobilePhone().withMessage('Invalid emergency contact phone'),
    
    body('emergency_contact_relation')
        .optional()
        .isString().withMessage('Relation must be string')
        .isLength({ max: 50 }).withMessage('Relation too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// PAGINATION & DATE VALIDATORS
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
        .isIn(['created_at', 'date', 'start_date', 'end_date', 'status'])
        .withMessage('Invalid sort field'),
    
    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
    
    validate
];

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
    // Shift validators
    validateShift,
    validateShiftStatus,
    
    // Attendance validators
    validateAttendanceCheck,
    validateAttendance,
    
    // Leave validators
    validateLeave,
    validateLeaveStatus,
    
    // Document validators
    validateDocument,
    validateDocumentStatus,
    
    // Notification validator
    validateNotification,
    
    // Profile validator
    validateProfileUpdate,
    
    // Pagination & filter validators
    validatePagination,
    validateDateRange,
    
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
 * validateShift            | Request shift change        | date, type, reason
 * validateShiftStatus      | Update shift status         | status, notes
 * validateAttendanceCheck  | Check in/out                | location, device
 * validateAttendance       | Update attendance           | status, date
 * validateLeave            | Apply for leave             | type, dates, reason
 * validateLeaveStatus      | Update leave status         | status, notes
 * validateDocument         | Upload document             | type, name, URL
 * validateDocumentStatus   | Update document status      | status, notes
 * validateNotification     | Mark notification read      | ID only
 * validateProfileUpdate    | Update profile              | phone, email, address
 * validatePagination       | Pagination                  | page, limit, sort
 * validateDateRange        | Date filtering              | from_date, to_date
 * -------------------------|-----------------------------|----------------------
 * TOTAL: 12 Validators with 35+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-53] 24-hour shift change notice
 * - [BR-54] Check-in window (service level)
 * - [BR-55] Leave balance validation (service level)
 * - [BR-56] 2-day leave advance notice
 * - [BR-57] Document verification (service level)
 * 
 * ======================================================================
 */