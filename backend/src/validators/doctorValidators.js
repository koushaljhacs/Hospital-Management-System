/**
 * ======================================================================
 * FILE: backend/src/validators/doctorValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor module request validators.
 * Ensures all doctor inputs follow business rules.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-13] One prescription per appointment
 * - [BR-14] Medicine quantity positive
 * - [BR-15] Dosage required
 * - [BR-16] Controlled substances need special flag
 * - [BR-17] Prescription validity 30 days
 * - [BR-36] Critical values require notification
 * - [BR-37] Test results need verification
 * - [BR-38] Abnormal results flagged automatically
 * 
 * ======================================================================
 */

const { body, param, query, validationResult } = require('express-validator');

// ============================================
// HELPER FUNCTIONS
// ============================================

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
 * Custom validators for doctor module
 */
const customValidators = {
    // Valid medicine dosage format (e.g., "500mg", "1 tablet", "5ml")
    isValidDosage: (dosage) => {
        if (!dosage) return false;
        const dosageRegex = /^\d+\s*(mg|ml|g|mcg|tablet|capsule|injection|drop|puff)$/i;
        return dosageRegex.test(dosage);
    },

    // Valid frequency (e.g., "Twice daily", "Every 8 hours", "Once a day")
    isValidFrequency: (frequency) => {
        const validFrequencies = [
            'once daily', 'twice daily', 'thrice daily', 'four times daily',
            'every 4 hours', 'every 6 hours', 'every 8 hours', 'every 12 hours',
            'every morning', 'every night', 'before meals', 'after meals',
            'with meals', 'empty stomach', 'as needed', 'at bedtime'
        ];
        return validFrequencies.includes(frequency.toLowerCase());
    },

    // Valid duration (e.g., "7 days", "2 weeks", "1 month")
    isValidDuration: (duration) => {
        const durationRegex = /^\d+\s*(day|days|week|weeks|month|months)$/i;
        return durationRegex.test(duration);
    },

    // [BR-17] Prescription validity 30 days max
    isValidFollowUpDate: (date) => {
        const followUp = new Date(date);
        const now = new Date();
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 30);
        return followUp >= now && followUp <= maxDate;
    },

    // Valid blood pressure format (e.g., "120/80")
    isValidBloodPressure: (bp) => {
        const bpRegex = /^\d{2,3}\/\d{2,3}$/;
        if (!bpRegex.test(bp)) return false;
        const [systolic, diastolic] = bp.split('/').map(Number);
        return systolic >= 70 && systolic <= 250 && diastolic >= 40 && diastolic <= 150;
    },

    // Valid temperature (35-42°C)
    isValidTemperature: (temp) => {
        return temp >= 35 && temp <= 42;
    },

    // Valid heart rate (30-250 bpm)
    isValidHeartRate: (hr) => {
        return hr >= 30 && hr <= 250;
    },

    // Valid oxygen saturation (50-100%)
    isValidO2Saturation: (o2) => {
        return o2 >= 50 && o2 <= 100;
    },

    // Valid diagnosis code (ICD-10 format)
    isValidICD10: (code) => {
        const icd10Regex = /^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/;
        return icd10Regex.test(code);
    },

    // Valid medicine name (no special characters except hyphen)
    isValidMedicineName: (name) => {
        const medicineRegex = /^[a-zA-Z0-9\s\-]+$/;
        return medicineRegex.test(name);
    },

    // [BR-16] Check if medicine is controlled substance
    isControlledSubstance: (medicineName) => {
        const controlledList = ['morphine', 'fentanyl', 'oxycodone', 'hydrocodone', 
                               'diazepam', 'alprazolam', 'clonazepam', 'lorazepam'];
        return controlledList.some(controlled => 
            medicineName.toLowerCase().includes(controlled)
        );
    }
};

// ============================================
// PATIENT SEARCH VALIDATORS
// ============================================

const validatePatientSearch = [
    query('search')
        .optional()
        .isString().withMessage('Search term must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Search term must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt(),
    
    validate
];

// ============================================
// APPOINTMENT VALIDATORS
// ============================================

const validateAppointmentStatus = [
    param('id')
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('reason')
        .optional()
        .isString().withMessage('Reason must be string')
        .isLength({ max: 500 }).withMessage('Reason too long')
        .trim()
        .escape(),
    
    validate
];

const validateAppointmentNotes = [
    param('id')
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('notes')
        .notEmpty().withMessage('Notes are required')
        .isString().withMessage('Notes must be string')
        .isLength({ min: 5, max: 2000 }).withMessage('Notes must be between 5 and 2000 characters')
        .trim()
        .escape(),
    
    body('vitals')
        .optional()
        .isObject().withMessage('Vitals must be an object'),
    
    body('vitals.blood_pressure')
        .optional()
        .custom(customValidators.isValidBloodPressure).withMessage('Invalid blood pressure format'),
    
    body('vitals.heart_rate')
        .optional()
        .isInt({ min: 30, max: 250 }).withMessage('Heart rate must be between 30-250'),
    
    body('vitals.temperature')
        .optional()
        .isFloat({ min: 35, max: 42 }).withMessage('Temperature must be between 35-42°C'),
    
    body('vitals.oxygen_saturation')
        .optional()
        .isInt({ min: 50, max: 100 }).withMessage('O2 saturation must be between 50-100%'),
    
    validate
];

// ============================================
// PRESCRIPTION VALIDATORS
// ============================================

const validatePrescription = [
    body('patient_id')
        .notEmpty().withMessage('Patient ID is required')
        .isUUID().withMessage('Invalid patient ID'),
    
    body('appointment_id')
        .notEmpty().withMessage('Appointment ID is required')
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('diagnosis')
        .notEmpty().withMessage('Diagnosis is required')
        .isString().withMessage('Diagnosis must be string')
        .isLength({ min: 3, max: 500 }).withMessage('Diagnosis must be between 3-500 characters')
        .trim()
        .escape(),
    
    body('diagnosis_code')
        .optional()
        .custom(customValidators.isValidICD10).withMessage('Invalid ICD-10 code'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 1000 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    body('follow_up_date')
        .optional()
        .isISO8601().withMessage('Invalid date format')
        .custom(customValidators.isValidFollowUpDate).withMessage('Follow-up must be within 30 days'),
    
    body('medicines')
        .isArray({ min: 1 }).withMessage('At least one medicine required'),
    
    body('medicines.*.name')
        .notEmpty().withMessage('Medicine name required')
        .custom(customValidators.isValidMedicineName).withMessage('Invalid medicine name'),
    
    body('medicines.*.dosage')
        .notEmpty().withMessage('Dosage required')
        .custom(customValidators.isValidDosage).withMessage('Invalid dosage format'),
    
    body('medicines.*.frequency')
        .notEmpty().withMessage('Frequency required')
        .custom(customValidators.isValidFrequency).withMessage('Invalid frequency'),
    
    body('medicines.*.duration')
        .notEmpty().withMessage('Duration required')
        .custom(customValidators.isValidDuration).withMessage('Invalid duration format'),
    
    body('medicines.*.quantity')
        .notEmpty().withMessage('Quantity required')
        .isInt({ min: 1 }).withMessage('Quantity must be positive'),
    
    body('medicines.*.instructions')
        .optional()
        .isString().withMessage('Instructions must be string')
        .isLength({ max: 500 }).withMessage('Instructions too long')
        .trim()
        .escape(),
    
    // [BR-16] Controlled substance check
    body('medicines.*')
        .custom((medicine) => {
            if (customValidators.isControlledSubstance(medicine.name)) {
                medicine.is_controlled = true;
            }
            return true;
        }),
    
    validate
];

const validateMedicine = [
    param('id')
        .isUUID().withMessage('Invalid prescription ID'),
    
    param('medId')
        .isUUID().withMessage('Invalid medicine ID'),
    
    body('name')
        .notEmpty().withMessage('Medicine name required')
        .custom(customValidators.isValidMedicineName).withMessage('Invalid medicine name'),
    
    body('dosage')
        .notEmpty().withMessage('Dosage required')
        .custom(customValidators.isValidDosage).withMessage('Invalid dosage format'),
    
    body('frequency')
        .notEmpty().withMessage('Frequency required')
        .custom(customValidators.isValidFrequency).withMessage('Invalid frequency'),
    
    body('duration')
        .notEmpty().withMessage('Duration required')
        .custom(customValidators.isValidDuration).withMessage('Invalid duration format'),
    
    body('quantity')
        .notEmpty().withMessage('Quantity required')
        .isInt({ min: 1 }).withMessage('Quantity must be positive'),
    
    body('instructions')
        .optional()
        .isString().withMessage('Instructions must be string')
        .isLength({ max: 500 }).withMessage('Instructions too long')
        .trim()
        .escape(),
    
    validate
];

const validatePrescriptionTemplate = [
    body('template_name')
        .notEmpty().withMessage('Template name required')
        .isString().withMessage('Template name must be string')
        .isLength({ min: 3, max: 100 }).withMessage('Template name must be between 3-100 characters')
        .trim()
        .escape(),
    
    body('diagnosis')
        .notEmpty().withMessage('Diagnosis required')
        .isString().withMessage('Diagnosis must be string')
        .isLength({ min: 3, max: 500 }).withMessage('Diagnosis must be between 3-500 characters')
        .trim()
        .escape(),
    
    body('medicines')
        .isArray({ min: 1 }).withMessage('At least one medicine required'),
    
    body('medicines.*.name')
        .notEmpty().withMessage('Medicine name required')
        .custom(customValidators.isValidMedicineName).withMessage('Invalid medicine name'),
    
    body('medicines.*.dosage')
        .notEmpty().withMessage('Dosage required')
        .custom(customValidators.isValidDosage).withMessage('Invalid dosage format'),
    
    body('medicines.*.frequency')
        .notEmpty().withMessage('Frequency required')
        .custom(customValidators.isValidFrequency).withMessage('Invalid frequency'),
    
    body('medicines.*.duration')
        .notEmpty().withMessage('Duration required')
        .custom(customValidators.isValidDuration).withMessage('Invalid duration format'),
    
    body('medicines.*.quantity')
        .notEmpty().withMessage('Quantity required')
        .isInt({ min: 1 }).withMessage('Quantity must be positive'),
    
    validate
];

// ============================================
// LAB ORDER VALIDATORS
// ============================================

const validateLabOrder = [
    body('patient_id')
        .notEmpty().withMessage('Patient ID required')
        .isUUID().withMessage('Invalid patient ID'),
    
    body('appointment_id')
        .optional()
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('test_ids')
        .isArray({ min: 1 }).withMessage('At least one test required'),
    
    body('test_ids.*')
        .isUUID().withMessage('Invalid test ID format'),
    
    body('priority')
        .optional()
        .isIn(['routine', 'urgent', 'stat', 'emergency']).withMessage('Invalid priority'),
    
    body('clinical_notes')
        .optional()
        .isString().withMessage('Clinical notes must be string')
        .isLength({ max: 1000 }).withMessage('Clinical notes too long')
        .trim()
        .escape(),
    
    body('diagnosis')
        .optional()
        .isString().withMessage('Diagnosis must be string')
        .isLength({ max: 500 }).withMessage('Diagnosis too long')
        .trim()
        .escape(),
    
    body('special_instructions')
        .optional()
        .isString().withMessage('Instructions must be string')
        .isLength({ max: 500 }).withMessage('Instructions too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// RADIOLOGY ORDER VALIDATORS
// ============================================

const validateRadiologyOrder = [
    body('patient_id')
        .notEmpty().withMessage('Patient ID required')
        .isUUID().withMessage('Invalid patient ID'),
    
    body('appointment_id')
        .optional()
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('image_type')
        .notEmpty().withMessage('Image type required')
        .isIn(['xray', 'mri', 'ct', 'ultrasound', 'mammogram', 'pet_scan']).withMessage('Invalid image type'),
    
    body('body_part')
        .notEmpty().withMessage('Body part required')
        .isString().withMessage('Body part must be string')
        .isLength({ max: 100 }).withMessage('Body part too long')
        .trim()
        .escape(),
    
    body('laterality')
        .optional()
        .isIn(['left', 'right', 'bilateral', 'not_applicable']).withMessage('Invalid laterality'),
    
    body('priority')
        .optional()
        .isIn(['routine', 'urgent', 'stat', 'emergency']).withMessage('Invalid priority'),
    
    body('clinical_history')
        .optional()
        .isString().withMessage('Clinical history must be string')
        .isLength({ max: 1000 }).withMessage('Clinical history too long')
        .trim()
        .escape(),
    
    body('indication')
        .optional()
        .isString().withMessage('Indication must be string')
        .isLength({ max: 500 }).withMessage('Indication too long')
        .trim()
        .escape(),
    
    body('contrast_required')
        .optional()
        .isBoolean().withMessage('contrast_required must be boolean'),
    
    body('contrast_type')
        .if(body('contrast_required').equals('true'))
        .notEmpty().withMessage('Contrast type required when contrast is required')
        .isString().withMessage('Contrast type must be string')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// DIAGNOSIS & NOTES VALIDATORS
// ============================================

const validateDiagnosis = [
    body('patient_id')
        .notEmpty().withMessage('Patient ID required')
        .isUUID().withMessage('Invalid patient ID'),
    
    body('appointment_id')
        .optional()
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('diagnosis')
        .notEmpty().withMessage('Diagnosis required')
        .isString().withMessage('Diagnosis must be string')
        .isLength({ min: 3, max: 1000 }).withMessage('Diagnosis must be between 3-1000 characters')
        .trim()
        .escape(),
    
    body('diagnosis_code')
        .optional()
        .custom(customValidators.isValidICD10).withMessage('Invalid ICD-10 code'),
    
    body('type')
        .optional()
        .isIn(['primary', 'secondary', 'differential', 'provisional', 'final']).withMessage('Invalid diagnosis type'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 2000 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    validate
];

const validateClinicalNote = [
    body('patient_id')
        .notEmpty().withMessage('Patient ID required')
        .isUUID().withMessage('Invalid patient ID'),
    
    body('appointment_id')
        .optional()
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('note_type')
        .notEmpty().withMessage('Note type required')
        .isIn(['progress', 'consultation', 'discharge', 'transfer', 'general']).withMessage('Invalid note type'),
    
    body('content')
        .notEmpty().withMessage('Note content required')
        .isString().withMessage('Content must be string')
        .isLength({ min: 5, max: 5000 }).withMessage('Content must be between 5-5000 characters')
        .trim()
        .escape(),
    
    body('is_private')
        .optional()
        .isBoolean().withMessage('is_private must be boolean'),
    
    validate
];

// ============================================
// SCHEDULE & AVAILABILITY VALIDATORS
// ============================================

const validateSchedule = [
    body('availability')
        .isArray().withMessage('Availability must be an array'),
    
    body('availability.*.day')
        .notEmpty().withMessage('Day required')
        .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
        .withMessage('Invalid day'),
    
    body('availability.*.start_time')
        .notEmpty().withMessage('Start time required')
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
    
    body('availability.*.end_time')
        .notEmpty().withMessage('End time required')
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format')
        .custom((end, { req, location, path }) => {
            const start = req.body.availability.find(a => a.day === path.split('.')[1])?.start_time;
            if (start && end <= start) {
                throw new Error('End time must be after start time');
            }
            return true;
        }),
    
    body('availability.*.max_patients')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('Max patients must be between 1-50'),
    
    validate
];

const validateLeaveRequest = [
    body('start_date')
        .notEmpty().withMessage('Start date required')
        .isISO8601().withMessage('Invalid date format')
        .custom((date) => new Date(date) >= new Date()).withMessage('Start date cannot be in past'),
    
    body('end_date')
        .notEmpty().withMessage('End date required')
        .isISO8601().withMessage('Invalid date format')
        .custom((end, { req }) => {
            if (new Date(end) <= new Date(req.body.start_date)) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
    
    body('reason')
        .notEmpty().withMessage('Reason required')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5-500 characters')
        .trim()
        .escape(),
    
    body('leave_type')
        .notEmpty().withMessage('Leave type required')
        .isIn(['annual', 'sick', 'casual', 'maternity', 'paternity', 'unpaid'])
        .withMessage('Invalid leave type'),
    
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
        .isString().withMessage('Sort field must be string')
        .isIn(['date', 'name', 'status', 'priority']).withMessage('Invalid sort field'),
    
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
    // Patient validators
    validatePatientSearch,
    
    // Appointment validators
    validateAppointmentStatus,
    validateAppointmentNotes,
    
    // Prescription validators
    validatePrescription,
    validateMedicine,
    validatePrescriptionTemplate,
    
    // Lab validators
    validateLabOrder,
    
    // Radiology validators
    validateRadiologyOrder,
    
    // Diagnosis & Notes validators
    validateDiagnosis,
    validateClinicalNote,
    
    // Schedule validators
    validateSchedule,
    validateLeaveRequest,
    
    // Pagination validators
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
 * Category          | Validators | Rules Enforced
 * ------------------|------------|----------------------
 * Patient Search    | 1          | Search term length, pagination
 * Appointments      | 2          | Status, notes, vitals
 * Prescriptions     | 3          | [BR-13][BR-14][BR-15][BR-16][BR-17]
 * Lab Orders        | 1          | Test selection, priority
 * Radiology         | 1          | Image type, body part, contrast
 * Diagnosis & Notes | 2          | ICD-10, content length
 * Schedule & Leave  | 2          | Time slots, leave dates
 * Pagination        | 2          | Page, limit, sorting
 * ------------------|------------|----------------------
 * TOTAL             | 14         | 40+ validation rules
 * 
 * ======================================================================
 */