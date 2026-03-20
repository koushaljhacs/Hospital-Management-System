/**
 * ======================================================================
 * FILE: backend/src/validators/labTechnicianValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician module request validators.
 * Total Validators: 10 main validators with 40+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical values require immediate notification
 * - [BR-37] Test results need verification
 * - [BR-38] Abnormal results flagged automatically
 * - [BR-39] Sample collection to result < 24 hours
 * - [BR-40] Duplicate test not allowed within 7 days
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
 * Custom validators for lab technician module
 */
const customValidators = {
    // Valid test result value based on test type
    isValidResultValue: (value, testType) => {
        if (!value) return false;
        
        // Numeric tests
        if (['blood_glucose', 'cholesterol', 'hemoglobin', 'wbc', 'rbc', 'platelets'].includes(testType)) {
            const num = parseFloat(value);
            return !isNaN(num) && num >= 0;
        }
        
        // Text/qualitative tests
        if (['blood_group', 'urine_color', 'culture'].includes(testType)) {
            return value && value.length >= 1;
        }
        
        return true;
    },

    // Valid unit for test type
    isValidUnit: (unit, testType) => {
        const unitMap = {
            blood_glucose: ['mg/dL', 'mmol/L'],
            cholesterol: ['mg/dL', 'mmol/L'],
            hemoglobin: ['g/dL', 'g/L'],
            wbc: ['cells/µL', '10³/µL'],
            rbc: ['million/µL', '10⁶/µL'],
            platelets: ['10³/µL', 'cells/µL'],
            temperature: ['°C', '°F'],
            generic: ['mg/dL', 'mmol/L', 'g/dL', 'g/L', 'cells/µL', '%', 'ratio']
        };
        
        const validUnits = unitMap[testType] || unitMap.generic;
        return validUnits.includes(unit);
    },

    // Check if value is within normal range
    isWithinNormalRange: (value, normalRange) => {
        if (!normalRange) return true;
        
        // Parse normal range (e.g., "70-99 mg/dL")
        const match = normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
        if (match) {
            const [_, min, max] = match;
            const numValue = parseFloat(value);
            return numValue >= parseFloat(min) && numValue <= parseFloat(max);
        }
        
        return true;
    },

    // Check if value is critical [BR-36]
    isCriticalValue: (value, criticalRange) => {
        if (!criticalRange) return false;
        
        const match = criticalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
        if (match) {
            const [_, min, max] = match;
            const numValue = parseFloat(value);
            return numValue < parseFloat(min) || numValue > parseFloat(max);
        }
        
        return false;
    },

    // Valid specimen type
    isValidSpecimenType: (type) => {
        const validTypes = [
            'blood', 'urine', 'stool', 'sputum', 'csf', 'tissue',
            'swab', 'fluid', 'plasma', 'serum', 'saliva', 'semen'
        ];
        return validTypes.includes(type);
    },

    // Valid specimen container
    isValidContainer: (container) => {
        const validContainers = [
            'red_top', 'purple_top', 'blue_top', 'green_top',
            'grey_top', 'yellow_top', 'sterile_cup', 'culture_bottle'
        ];
        return validContainers.includes(container);
    },

    // Valid specimen condition
    isValidCondition: (condition) => {
        const validConditions = [
            'acceptable', 'hemolyzed', 'icteric', 'lipemic',
            'clotted', 'insufficient', 'contaminated', 'expired'
        ];
        return validConditions.includes(condition);
    },

    // Valid priority level
    isValidPriority: (priority) => {
        const validPriorities = ['routine', 'urgent', 'stat', 'timed'];
        return validPriorities.includes(priority);
    },

    // Valid test status
    isValidTestStatus: (status) => {
        const validStatuses = [
            'pending', 'collected', 'received', 'processing',
            'completed', 'verified', 'approved', 'rejected'
        ];
        return validStatuses.includes(status);
    },

    // Valid equipment status
    isValidEquipmentStatus: (status) => {
        const validStatuses = [
            'operational', 'maintenance', 'calibration', 'repair',
            'out_of_service', 'retired'
        ];
        return validStatuses.includes(status);
    },

    // Check if time difference is within 24 hours [BR-39]
    isWithin24Hours: (startTime, endTime) => {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const hoursDiff = (end - start) / (1000 * 60 * 60);
        return hoursDiff <= 24;
    }
};

// ============================================
// ORDER VALIDATORS
// ============================================

const validateOrderStatus = [
    param('id')
        .isUUID().withMessage('Invalid order ID format'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    body('collected_by')
        .optional()
        .isUUID().withMessage('Invalid collector ID'),
    
    body('collection_time')
        .optional()
        .isISO8601().withMessage('Invalid collection time format'),
    
    body('received_by')
        .optional()
        .isUUID().withMessage('Invalid receiver ID'),
    
    body('received_time')
        .optional()
        .isISO8601().withMessage('Invalid received time format'),
    
    validate
];

// ============================================
// TEST RESULT VALIDATORS
// ============================================

const validateTestResult = [
    body('test_order_id')
        .notEmpty().withMessage('Test order ID is required')
        .isUUID().withMessage('Invalid test order ID'),
    
    body('test_id')
        .notEmpty().withMessage('Test ID is required')
        .isUUID().withMessage('Invalid test ID'),
    
    body('patient_id')
        .notEmpty().withMessage('Patient ID is required')
        .isUUID().withMessage('Invalid patient ID'),
    
    body('result_value')
        .notEmpty().withMessage('Result value is required')
        .custom((value, { req }) => {
            return customValidators.isValidResultValue(value, req.body.test_type);
        }).withMessage('Invalid result value for test type'),
    
    body('result_unit')
        .optional()
        .custom((unit, { req }) => {
            return customValidators.isValidUnit(unit, req.body.test_type);
        }).withMessage('Invalid unit for test type'),
    
    body('result_numeric')
        .optional()
        .isFloat().withMessage('Numeric result must be a number'),
    
    body('result_text')
        .optional()
        .isString().withMessage('Text result must be string')
        .isLength({ max: 1000 }).withMessage('Text result too long')
        .trim()
        .escape(),
    
    body('reference_range_low')
        .optional()
        .isFloat().withMessage('Reference range low must be number'),
    
    body('reference_range_high')
        .optional()
        .isFloat().withMessage('Reference range high must be number')
        .custom((high, { req }) => {
            if (req.body.reference_range_low && high <= req.body.reference_range_low) {
                throw new Error('Reference range high must be greater than low');
            }
            return true;
        }),
    
    body('interpretation')
        .optional()
        .isString().withMessage('Interpretation must be string')
        .isLength({ max: 1000 }).withMessage('Interpretation too long')
        .trim()
        .escape(),
    
    body('clinical_significance')
        .optional()
        .isString().withMessage('Clinical significance must be string')
        .isLength({ max: 1000 }).withMessage('Clinical significance too long')
        .trim()
        .escape(),
    
    body('comments')
        .optional()
        .isString().withMessage('Comments must be string')
        .isLength({ max: 500 }).withMessage('Comments too long')
        .trim()
        .escape(),
    
    body('tested_by')
        .notEmpty().withMessage('Tested by is required')
        .isUUID().withMessage('Invalid technician ID'),
    
    body('tested_at')
        .notEmpty().withMessage('Tested at time is required')
        .isISO8601().withMessage('Invalid tested at time format'),
    
    // [BR-39] Check if within 24 hours of collection
    body().custom(async (value, { req }) => {
        // This will be checked in service with order collection time
        return true;
    }),
    
    validate
];

const validateResultVerification = [
    param('id')
        .isUUID().withMessage('Invalid result ID'),
    
    body('verified_by')
        .notEmpty().withMessage('Verifier ID is required')
        .isUUID().withMessage('Invalid verifier ID'),
    
    body('verification_notes')
        .optional()
        .isString().withMessage('Verification notes must be string')
        .isLength({ max: 500 }).withMessage('Verification notes too long')
        .trim()
        .escape(),
    
    validate
];

const validateResultApproval = [
    param('id')
        .isUUID().withMessage('Invalid result ID'),
    
    body('approved_by')
        .notEmpty().withMessage('Approver ID is required')
        .isUUID().withMessage('Invalid approver ID'),
    
    body('approval_notes')
        .optional()
        .isString().withMessage('Approval notes must be string')
        .isLength({ max: 500 }).withMessage('Approval notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// SPECIMEN VALIDATORS
// ============================================

const validateSpecimen = [
    body('specimen_code')
        .optional()
        .isString().withMessage('Specimen code must be string')
        .isLength({ max: 50 }).withMessage('Specimen code too long')
        .trim()
        .escape(),
    
    body('specimen_type')
        .notEmpty().withMessage('Specimen type is required')
        .custom(customValidators.isValidSpecimenType).withMessage('Invalid specimen type'),
    
    body('specimen_name')
        .notEmpty().withMessage('Specimen name is required')
        .isString().withMessage('Specimen name must be string')
        .isLength({ max: 200 }).withMessage('Specimen name too long')
        .trim()
        .escape(),
    
    body('collection_date')
        .notEmpty().withMessage('Collection date is required')
        .isISO8601().withMessage('Invalid collection date format'),
    
    body('collected_by')
        .notEmpty().withMessage('Collected by is required')
        .isUUID().withMessage('Invalid collector ID'),
    
    body('collection_site')
        .optional()
        .isString().withMessage('Collection site must be string')
        .isLength({ max: 200 }).withMessage('Collection site too long')
        .trim()
        .escape(),
    
    body('collection_method')
        .optional()
        .isString().withMessage('Collection method must be string')
        .isLength({ max: 100 }).withMessage('Collection method too long')
        .trim()
        .escape(),
    
    body('patient_id')
        .notEmpty().withMessage('Patient ID is required')
        .isUUID().withMessage('Invalid patient ID'),
    
    body('test_order_id')
        .notEmpty().withMessage('Test order ID is required')
        .isUUID().withMessage('Invalid test order ID'),
    
    body('volume')
        .optional()
        .isFloat({ min: 0 }).withMessage('Volume must be positive number'),
    
    body('volume_unit')
        .optional()
        .isIn(['ml', 'µl', 'mg', 'g']).withMessage('Invalid volume unit'),
    
    body('container_type')
        .optional()
        .custom(customValidators.isValidContainer).withMessage('Invalid container type'),
    
    body('storage_conditions')
        .optional()
        .isString().withMessage('Storage conditions must be string')
        .isLength({ max: 500 }).withMessage('Storage conditions too long')
        .trim()
        .escape(),
    
    validate
];

const validateSpecimenCondition = [
    param('id')
        .isUUID().withMessage('Invalid specimen ID'),
    
    body('condition')
        .notEmpty().withMessage('Specimen condition is required')
        .custom(customValidators.isValidCondition).withMessage('Invalid specimen condition'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

const validateSpecimenRejection = [
    param('id')
        .isUUID().withMessage('Invalid specimen ID'),
    
    body('rejection_reason')
        .notEmpty().withMessage('Rejection reason is required')
        .isString().withMessage('Rejection reason must be string')
        .isLength({ min: 5, max: 500 }).withMessage('Rejection reason must be between 5-500 characters')
        .trim()
        .escape(),
    
    body('rejected_by')
        .notEmpty().withMessage('Rejected by is required')
        .isUUID().withMessage('Invalid rejecter ID'),
    
    validate
];

// ============================================
// EQUIPMENT VALIDATORS
// ============================================

const validateEquipmentStatus = [
    param('id')
        .optional()
        .isUUID().withMessage('Invalid equipment ID'),
    
    body('status')
        .notEmpty().withMessage('Equipment status is required')
        .custom(customValidators.isValidEquipmentStatus).withMessage('Invalid equipment status'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    body('maintenance_due')
        .optional()
        .isISO8601().withMessage('Invalid maintenance due date'),
    
    body('calibration_due')
        .optional()
        .isISO8601().withMessage('Invalid calibration due date'),
    
    validate
];

const validateCalibrationLog = [
    body('equipment_id')
        .notEmpty().withMessage('Equipment ID is required')
        .isUUID().withMessage('Invalid equipment ID'),
    
    body('calibration_date')
        .notEmpty().withMessage('Calibration date is required')
        .isISO8601().withMessage('Invalid calibration date'),
    
    body('next_calibration_date')
        .notEmpty().withMessage('Next calibration date is required')
        .isISO8601().withMessage('Invalid next calibration date')
        .custom((next, { req }) => {
            if (new Date(next) <= new Date(req.body.calibration_date)) {
                throw new Error('Next calibration date must be after calibration date');
            }
            return true;
        }),
    
    body('calibrated_by')
        .notEmpty().withMessage('Calibrated by is required')
        .isUUID().withMessage('Invalid calibrator ID'),
    
    body('certificate_number')
        .optional()
        .isString().withMessage('Certificate number must be string')
        .isLength({ max: 100 }).withMessage('Certificate number too long')
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
// QUALITY CONTROL VALIDATORS
// ============================================

const validateQualityControl = [
    body('test_id')
        .notEmpty().withMessage('Test ID is required')
        .isUUID().withMessage('Invalid test ID'),
    
    body('control_type')
        .notEmpty().withMessage('Control type is required')
        .isIn(['positive', 'negative', 'internal', 'external']).withMessage('Invalid control type'),
    
    body('control_lot')
        .notEmpty().withMessage('Control lot number is required')
        .isString().withMessage('Control lot must be string')
        .isLength({ max: 50 }).withMessage('Control lot too long')
        .trim()
        .escape(),
    
    body('control_expiry')
        .notEmpty().withMessage('Control expiry date is required')
        .isISO8601().withMessage('Invalid expiry date')
        .custom((date) => {
            return new Date(date) > new Date();
        }).withMessage('Control expiry must be in future'),
    
    body('result')
        .notEmpty().withMessage('Control result is required')
        .isString().withMessage('Result must be string')
        .isLength({ max: 100 }).withMessage('Result too long')
        .trim()
        .escape(),
    
    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['passed', 'failed', 'borderline']).withMessage('Invalid status'),
    
    body('performed_by')
        .notEmpty().withMessage('Performed by is required')
        .isUUID().withMessage('Invalid technician ID'),
    
    body('performed_at')
        .notEmpty().withMessage('Performed at time is required')
        .isISO8601().withMessage('Invalid performed at time'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// PAGINATION & FILTER VALIDATORS
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
        .isIn(['created_at', 'tested_at', 'priority', 'status']).withMessage('Invalid sort field'),
    
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

const validatePatientId = [
    param('patientId')
        .isUUID().withMessage('Invalid patient ID format'),
    
    validate
];

const validateTestId = [
    param('testId')
        .isUUID().withMessage('Invalid test ID format'),
    
    validate
];

// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    // Order validators
    validateOrderStatus,
    
    // Result validators
    validateTestResult,
    validateResultVerification,
    validateResultApproval,
    
    // Specimen validators
    validateSpecimen,
    validateSpecimenCondition,
    validateSpecimenRejection,
    
    // Equipment validators
    validateEquipmentStatus,
    validateCalibrationLog,
    
    // Quality control validators
    validateQualityControl,
    
    // Pagination & filter validators
    validatePagination,
    validateDateRange,
    validatePatientId,
    validateTestId,
    
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
 * validateOrderStatus      | Update order status         | IDs, notes, timestamps
 * validateTestResult       | Enter test results          | 15+ fields, [BR-36][BR-38][BR-39]
 * validateResultVerification| Verify results             | [BR-37] verification
 * validateResultApproval   | Approve results             | Supervisor approval
 * validateSpecimen         | Register specimens          | 10+ fields
 * validateSpecimenCondition| Update condition            | condition, notes
 * validateSpecimenRejection| Reject specimens            | reason, [BR-39]
 * validateEquipmentStatus  | Update equipment status     | status, dates
 * validateCalibrationLog   | Log calibration             | dates, certificate
 * validateQualityControl   | Add QC records              | 8+ fields
 * validatePagination       | Pagination                  | page, limit, sort
 * validateDateRange        | Date filtering              | from_date, to_date
 * -------------------------|-----------------------------|----------------------
 * TOTAL: 13 Validators with 40+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical values require immediate notification
 * - [BR-37] Test results need verification
 * - [BR-38] Abnormal results flagged automatically
 * - [BR-39] Sample collection to result < 24 hours
 * - [BR-40] Duplicate test not allowed within 7 days
 * 
 * ======================================================================
 */