/**
 * ======================================================================
 * FILE: backend/src/validators/nurseValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse module request validators.
 * Total Validators: 12 main validators with 40+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * - [BR-26] Cleaning required between patients
 * - [BR-27] Max occupancy time 30 days
 * - [BR-28] ICU beds require special authorization
 * - [BR-36] Critical values require immediate notification
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
 * Custom validators for nurse module
 */
const customValidators = {
    // Valid blood pressure (e.g., 120/80)
    isValidBloodPressure: (bp) => {
        if (!bp) return false;
        const bpRegex = /^\d{2,3}\/\d{2,3}$/;
        if (!bpRegex.test(bp)) return false;
        const [systolic, diastolic] = bp.split('/').map(Number);
        return systolic >= 70 && systolic <= 250 && diastolic >= 40 && diastolic <= 150;
    },

    // Valid heart rate (30-250 bpm)
    isValidHeartRate: (hr) => {
        const rate = parseInt(hr);
        return rate >= 30 && rate <= 250;
    },

    // Valid temperature (35-42°C)
    isValidTemperature: (temp) => {
        const t = parseFloat(temp);
        return t >= 35 && t <= 42;
    },

    // Valid respiratory rate (8-40 breaths/min)
    isValidRespiratoryRate: (rr) => {
        const rate = parseInt(rr);
        return rate >= 8 && rate <= 40;
    },

    // Valid oxygen saturation (50-100%)
    isValidO2Saturation: (o2) => {
        const sat = parseInt(o2);
        return sat >= 50 && sat <= 100;
    },

    // Valid blood glucose (20-600 mg/dL)
    isValidBloodGlucose: (bg) => {
        const glucose = parseInt(bg);
        return glucose >= 20 && glucose <= 600;
    },

    // Valid pain scale (0-10)
    isValidPainScale: (pain) => {
        const scale = parseInt(pain);
        return scale >= 0 && scale <= 10;
    },

    // Valid height in cm (30-250 cm)
    isValidHeight: (height) => {
        const h = parseFloat(height);
        return h >= 30 && h <= 250;
    },

    // Valid weight in kg (1-300 kg)
    isValidWeight: (weight) => {
        const w = parseFloat(weight);
        return w >= 1 && w <= 300;
    },

    // Valid BMI (10-60)
    isValidBMI: (bmi) => {
        const b = parseFloat(bmi);
        return b >= 10 && b <= 60;
    },

    // Check if value is critical [BR-36]
    isCriticalValue: (value, type) => {
        const criticalRanges = {
            systolic: { low: 90, high: 180 },
            diastolic: { low: 60, high: 110 },
            heartRate: { low: 40, high: 140 },
            temperature: { low: 36, high: 39 },
            o2Saturation: { low: 90, high: 100 },
            respiratoryRate: { low: 10, high: 30 }
        };

        const range = criticalRanges[type];
        if (!range) return false;
        
        return value < range.low || value > range.high;
    },

    // Valid task priority
    isValidPriority: (priority) => {
        const validPriorities = ['low', 'medium', 'high', 'urgent', 'emergency'];
        return validPriorities.includes(priority);
    },

    // Valid bed status [BR-24]
    isValidBedStatus: (status) => {
        const validStatuses = ['available', 'occupied', 'cleaning', 'maintenance', 'out_of_service'];
        return validStatuses.includes(status);
    },

    // Valid bed type [BR-28]
    isValidBedType: (type) => {
        const validTypes = ['general', 'icu', 'nicu', 'picu', 'emergency', 'isolation', 'private'];
        return validTypes.includes(type);
    },

    // Valid medication route
    isValidMedicationRoute: (route) => {
        const validRoutes = ['oral', 'iv', 'im', 'subcutaneous', 'topical', 'inhalation', 'rectal'];
        return validRoutes.includes(route);
    },

    // Valid medication frequency
    isValidMedicationFrequency: (freq) => {
        const validFrequencies = [
            'once', 'twice', 'thrice', 'four_times',
            'every_4_hours', 'every_6_hours', 'every_8_hours', 'every_12_hours',
            'before_meals', 'after_meals', 'with_meals', 'empty_stomach',
            'as_needed', 'at_bedtime'
        ];
        return validFrequencies.includes(freq);
    }
};

// ============================================
// PATIENT CARE VALIDATORS
// ============================================

const validatePatientSearch = [
    query('search')
        .optional()
        .isString().withMessage('Search term must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Search term must be between 2-100 characters')
        .trim()
        .escape(),
    
    query('ward')
        .optional()
        .isString().withMessage('Ward must be string')
        .isLength({ max: 50 }).withMessage('Ward name too long')
        .trim()
        .escape(),
    
    query('bed')
        .optional()
        .isString().withMessage('Bed number must be string')
        .trim()
        .escape(),
    
    query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('Page must be positive integer')
            .toInt(),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100')
            .toInt(),
    
    validate
];

// ============================================
// VITAL SIGNS VALIDATORS
// ============================================

const validateVitalSigns = [
    body('patient_id')
        .notEmpty().withMessage('Patient ID is required')
        .isUUID().withMessage('Invalid patient ID format'),
    
    body('blood_pressure')
        .optional()
        .custom(customValidators.isValidBloodPressure).withMessage('Invalid blood pressure format (e.g., 120/80)'),
    
    body('heart_rate')
        .optional()
        .isInt().withMessage('Heart rate must be integer')
        .custom(customValidators.isValidHeartRate).withMessage('Heart rate must be between 30-250 bpm'),
    
    body('temperature')
        .optional()
        .isFloat().withMessage('Temperature must be number')
        .custom(customValidators.isValidTemperature).withMessage('Temperature must be between 35-42°C'),
    
    body('respiratory_rate')
        .optional()
        .isInt().withMessage('Respiratory rate must be integer')
        .custom(customValidators.isValidRespiratoryRate).withMessage('Respiratory rate must be between 8-40 breaths/min'),
    
    body('oxygen_saturation')
        .optional()
        .isInt({ min: 50, max: 100 }).withMessage('O2 saturation must be between 50-100%'),
    
    body('blood_glucose')
        .optional()
        .isInt().withMessage('Blood glucose must be integer')
        .custom(customValidators.isValidBloodGlucose).withMessage('Blood glucose must be between 20-600 mg/dL'),
    
    body('pain_scale')
        .optional()
        .isInt().withMessage('Pain scale must be integer')
        .custom(customValidators.isValidPainScale).withMessage('Pain scale must be between 0-10'),
    
    body('height')
        .optional()
        .isFloat().withMessage('Height must be number')
        .custom(customValidators.isValidHeight).withMessage('Height must be between 30-250 cm'),
    
    body('weight')
        .optional()
        .isFloat().withMessage('Weight must be number')
        .custom(customValidators.isValidWeight).withMessage('Weight must be between 1-300 kg'),
    
    body('bmi')
        .optional()
        .isFloat().withMessage('BMI must be number')
        .custom(customValidators.isValidBMI).withMessage('BMI must be between 10-60'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    // Auto-calculate BMI if height and weight provided
    body().custom((value, { req }) => {
        if (req.body.height && req.body.weight && !req.body.bmi) {
            const heightInM = req.body.height / 100;
            req.body.bmi = (req.body.weight / (heightInM * heightInM)).toFixed(1);
        }
        return true;
    }),
    
    // [BR-36] Check for critical values
    body().custom((value, { req }) => {
        const criticalAlerts = [];
        
        if (req.body.blood_pressure) {
            const [sys, dia] = req.body.blood_pressure.split('/').map(Number);
            if (customValidators.isCriticalValue(sys, 'systolic')) {
                criticalAlerts.push('critical_blood_pressure');
            }
        }
        
        if (req.body.heart_rate && customValidators.isCriticalValue(req.body.heart_rate, 'heartRate')) {
            criticalAlerts.push('critical_heart_rate');
        }
        
        if (req.body.temperature && customValidators.isCriticalValue(req.body.temperature, 'temperature')) {
            criticalAlerts.push('critical_temperature');
        }
        
        if (req.body.oxygen_saturation && customValidators.isCriticalValue(req.body.oxygen_saturation, 'o2Saturation')) {
            criticalAlerts.push('critical_o2_saturation');
        }
        
        req.body.critical_alerts = criticalAlerts;
        return true;
    }),
    
    validate
];

const validateVitalUpdate = [
    param('id')
        .isUUID().withMessage('Invalid vital record ID'),
    
    body('blood_pressure')
        .optional()
        .custom(customValidators.isValidBloodPressure).withMessage('Invalid blood pressure format'),
    
    body('heart_rate')
        .optional()
        .isInt().withMessage('Heart rate must be integer')
        .custom(customValidators.isValidHeartRate).withMessage('Heart rate must be between 30-250 bpm'),
    
    body('temperature')
        .optional()
        .isFloat().withMessage('Temperature must be number')
        .custom(customValidators.isValidTemperature).withMessage('Temperature must be between 35-42°C'),
    
    validate
];

// ============================================
// TASK VALIDATORS
// ============================================

const validateTaskStatus = [
    param('id')
        .isUUID().withMessage('Invalid task ID'),
    
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
        .isUUID().withMessage('Invalid task ID'),
    
    body('assign_to')
        .notEmpty().withMessage('Assignee ID is required')
        .isUUID().withMessage('Invalid assignee ID format'),
    
    body('reason')
        .optional()
        .isString().withMessage('Reason must be string')
        .isLength({ max: 500 }).withMessage('Reason too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// MEDICATION VALIDATORS
// ============================================

const validateMedicationAdmin = [
    param('id')
        .isUUID().withMessage('Invalid medication schedule ID'),
    
    body('administered_at')
        .optional()
        .isISO8601().withMessage('Invalid datetime format'),
    
    body('route')
        .optional()
        .custom(customValidators.isValidMedicationRoute).withMessage('Invalid administration route'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    body('witness_id')
        .optional()
        .isUUID().withMessage('Invalid witness ID format')
        .custom((value, { req }) => {
            if (value === req.user.id) {
                throw new Error('Witness cannot be yourself');
            }
            return true;
        }),
    
    // For controlled substances, witness is required [BR-16]
    body().custom(async (value, { req }) => {
        // This will be checked in service with medicine details
        return true;
    }),
    
    validate
];

// ============================================
// BED MANAGEMENT VALIDATORS
// ============================================

const validateBedStatus = [
    param('id')
        .isUUID().withMessage('Invalid bed ID'),
    
    body('status')
        .optional()
        .custom(customValidators.isValidBedStatus).withMessage('Invalid bed status'),
    
    body('notes')
        .optional()
        .isString().withMessage('Notes must be string')
        .isLength({ max: 500 }).withMessage('Notes too long')
        .trim()
        .escape(),
    
    // [BR-24] Validate status transition
    body().custom((value, { req }) => {
        // This will be checked in service with current bed status
        return true;
    }),
    
    validate
];

const validateBedAssignment = [
    param('id')
        .isUUID().withMessage('Invalid bed ID'),
    
    body('patient_id')
        .notEmpty().withMessage('Patient ID is required')
        .isUUID().withMessage('Invalid patient ID format'),
    
    body('expected_discharge')
        .optional()
        .isISO8601().withMessage('Invalid discharge date format')
        .custom((date) => {
            const dischargeDate = new Date(date);
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 30); // [BR-27] Max 30 days
            return dischargeDate <= maxDate;
        }).withMessage('Expected discharge cannot exceed 30 days'),
    
    // [BR-25] Cannot assign occupied bed (checked in service)
    // [BR-26] Cleaning required (checked in service)
    // [BR-28] ICU authorization (checked in service with role)
    
    validate
];

// ============================================
// SHIFT & HANDOVER VALIDATORS
// ============================================

const validateShiftHandover = [
    body('handover_notes')
        .notEmpty().withMessage('Handover notes are required')
        .isString().withMessage('Handover notes must be string')
        .isLength({ min: 10, max: 2000 }).withMessage('Handover notes must be between 10-2000 characters')
        .trim()
        .escape(),
    
    body('patient_updates')
        .optional()
        .isArray().withMessage('Patient updates must be an array'),
    
    body('patient_updates.*.patient_id')
        .if(body('patient_updates').exists())
        .isUUID().withMessage('Invalid patient ID'),
    
    body('patient_updates.*.status')
        .if(body('patient_updates').exists())
        .isString().withMessage('Patient status must be string')
        .trim()
        .escape(),
    
    body('task_updates')
        .optional()
        .isArray().withMessage('Task updates must be an array'),
    
    body('pending_issues')
        .optional()
        .isString().withMessage('Pending issues must be string')
        .isLength({ max: 1000 }).withMessage('Pending issues too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// PAGINATION & DATE VALIDATORS (Reusable)
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
        .isIn(['created_at', 'updated_at', 'priority', 'status']).withMessage('Invalid sort field'),
    
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

const validateWard = [
    param('ward')
        .notEmpty().withMessage('Ward is required')
        .isString().withMessage('Ward must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Ward name must be between 2-100 characters')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    // Patient care validators
    validatePatientSearch,
    
    // Vital signs validators
    validateVitalSigns,
    validateVitalUpdate,
    
    // Task validators
    validateTaskStatus,
    validateTaskAssignment,
    
    // Medication validators
    validateMedicationAdmin,
    
    // Bed management validators
    validateBedStatus,
    validateBedAssignment,
    
    // Shift & handover validators
    validateShiftHandover,
    
    // Reusable validators
    validatePagination,
    validateDateRange,
    validateWard,
    
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
 * validatePatientSearch    | Patient search              | search term, ward, bed
 * validateVitalSigns       | Recording vitals            | 10+ vital parameters, [BR-36]
 * validateVitalUpdate      | Updating vitals             | vital parameters
 * validateTaskStatus       | Task status changes         | task ID, notes
 * validateTaskAssignment   | Reassigning tasks           | assignee, reason
 * validateMedicationAdmin  | Administering medication    | route, witness, [BR-16]
 * validateBedStatus        | Bed status updates          | status, [BR-24]
 * validateBedAssignment    | Assigning beds              | patient, discharge, [BR-25][BR-26][BR-27][BR-28]
 * validateShiftHandover    | Shift handover              | notes, updates
 * validatePagination       | Pagination                  | page, limit, sort
 * validateDateRange        | Date filtering              | from_date, to_date
 * validateWard             | Ward parameter              | ward name
 * -------------------------|-----------------------------|----------------------
 * TOTAL: 12 Validators with 40+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-16] Controlled substances need witness
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * - [BR-26] Cleaning required between patients
 * - [BR-27] Max occupancy time 30 days
 * - [BR-28] ICU beds require special authorization
 * - [BR-36] Critical values require immediate notification
 * 
 * ======================================================================
 */