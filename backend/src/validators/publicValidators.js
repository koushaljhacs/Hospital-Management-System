/**
 * ======================================================================
 * FILE: backend/src/validators/publicValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Public module request validators - No authentication required.
 * Total Validators: 5 main validators with multiple rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const { body, query, param, validationResult } = require('express-validator');

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
 * Custom validators
 */
const customValidators = {
    isValidDate: (date) => {
        const parsedDate = new Date(date);
        return parsedDate instanceof Date && !isNaN(parsedDate);
    },
    isFutureDate: (date) => {
        const inputDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return inputDate >= today;
    },
    isValidTime: (time) => {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    },
    isValidPhone: (phone) => {
        const phoneRegex = /^[6-9]\d{9}$|^\+91[6-9]\d{9}$|^0[6-9]\d{9}$/;
        return phoneRegex.test(phone);
    },
    isValidEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
};

// ============================================
// DOCTOR VALIDATORS
// ============================================

const validateDoctorSearch = [
    query('specialization')
        .optional()
        .isString().withMessage('Specialization must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Specialization must be between 2-100 characters')
        .trim()
        .escape(),
    
    query('name')
        .optional()
        .isString().withMessage('Name must be string')
        .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
        .trim()
        .escape(),
    
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
        .toInt(),
    
    validate
];

const validateDoctorId = [
    param('id')
        .isUUID().withMessage('Invalid doctor ID format'),
    
    validate
];

// ============================================
// APPOINTMENT VALIDATORS
// ============================================

const validateAppointmentCheck = [
    body('doctor_id')
        .optional()
        .isUUID().withMessage('Invalid doctor ID format'),
    
    body('date')
        .notEmpty().withMessage('Date is required')
        .custom(customValidators.isValidDate).withMessage('Invalid date format')
        .custom(customValidators.isFutureDate).withMessage('Date cannot be in the past'),
    
    body('specialization')
        .optional()
        .isString().withMessage('Specialization must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Specialization must be between 2-100 characters')
        .trim()
        .escape(),
    
    validate
];

const validateSlotCheck = [
    query('doctor_id')
        .notEmpty().withMessage('Doctor ID is required')
        .isUUID().withMessage('Invalid doctor ID format'),
    
    query('date')
        .notEmpty().withMessage('Date is required')
        .custom(customValidators.isValidDate).withMessage('Invalid date format')
        .custom(customValidators.isFutureDate).withMessage('Date cannot be in the past'),
    
    validate
];

const validateGuestAppointment = [
    body('doctor_id')
        .notEmpty().withMessage('Doctor ID is required')
        .isUUID().withMessage('Invalid doctor ID format'),
    
    body('appointment_date')
        .notEmpty().withMessage('Appointment date is required')
        .custom(customValidators.isValidDate).withMessage('Invalid date format')
        .custom(customValidators.isFutureDate).withMessage('Cannot book appointment in the past'),
    
    body('appointment_time')
        .notEmpty().withMessage('Appointment time is required')
        .custom(customValidators.isValidTime).withMessage('Invalid time format (HH:MM)'),
    
    body('patient_name')
        .notEmpty().withMessage('Patient name is required')
        .isString().withMessage('Name must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters')
        .trim()
        .escape(),
    
    body('patient_email')
        .optional()
        .custom(customValidators.isValidEmail).withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('patient_phone')
        .notEmpty().withMessage('Phone number is required')
        .custom(customValidators.isValidPhone).withMessage('Invalid phone number'),
    
    body('reason')
        .optional()
        .isString().withMessage('Reason must be string')
        .isLength({ max: 500 }).withMessage('Reason too long')
        .trim()
        .escape(),
    
    body('type')
        .optional()
        .isIn(['regular_checkup', 'followup', 'consultation']).withMessage('Invalid appointment type'),
    
    validate
];

// ============================================
// DEPARTMENT VALIDATORS
// ============================================

const validateDepartmentId = [
    param('id')
        .isUUID().withMessage('Invalid department ID format'),
    
    validate
];

// ============================================
// SERVICE VALIDATORS
// ============================================

const validateServiceId = [
    param('id')
        .isUUID().withMessage('Invalid service ID format'),
    
    validate
];

const validateServicePricing = [
    query('service_id')
        .optional()
        .isUUID().withMessage('Invalid service ID format'),
    
    query('department_id')
        .optional()
        .isUUID().withMessage('Invalid department ID format'),
    
    validate
];

// ============================================
// INSURANCE VALIDATORS
// ============================================

const validateProviderId = [
    param('id')
        .isUUID().withMessage('Invalid provider ID format'),
    
    validate
];

// ============================================
// CONTENT VALIDATORS
// ============================================

const validateContactForm = [
    body('name')
        .notEmpty().withMessage('Name is required')
        .isString().withMessage('Name must be string')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters')
        .trim()
        .escape(),
    
    body('email')
        .notEmpty().withMessage('Email is required')
        .custom(customValidators.isValidEmail).withMessage('Invalid email format')
        .normalizeEmail(),
    
    body('phone')
        .optional()
        .custom(customValidators.isValidPhone).withMessage('Invalid phone number'),
    
    body('message')
        .notEmpty().withMessage('Message is required')
        .isString().withMessage('Message must be string')
        .isLength({ min: 10, max: 1000 }).withMessage('Message must be between 10-1000 characters')
        .trim()
        .escape(),
    
    body('department')
        .optional()
        .isString().withMessage('Department must be string')
        .isIn(['general', 'billing', 'appointment', 'technical', 'feedback']).withMessage('Invalid department')
        .trim()
        .escape(),
    
    validate
];

const validateFaqQuery = [
    query('category')
        .optional()
        .isString().withMessage('Category must be string')
        .isLength({ max: 50 }).withMessage('Category too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// PAGINATION VALIDATOR (Reusable)
// ============================================

const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1-50')
        .toInt(),
    
    validate
];

// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    // Main validators
    validateDoctorSearch,
    validateDoctorId,
    validateAppointmentCheck,
    validateSlotCheck,
    validateGuestAppointment,
    validateDepartmentId,
    validateServiceId,
    validateServicePricing,
    validateProviderId,
    validateContactForm,
    validateFaqQuery,
    validatePagination,
    
    // Reusable validate function
    validate,
    
    // Export custom validators for reuse
    customValidators
};

/**
 * ======================================================================
 * VALIDATORS SUMMARY:
 * ======================================================================
 * 
 * Validator                | Used For                        | Rules
 * -------------------------|---------------------------------|----------------------
 * validateDoctorSearch     | GET /doctors                    | specialization, name, pagination
 * validateDoctorId         | GET /doctors/:id                | UUID validation
 * validateAppointmentCheck | POST /check-availability        | doctor_id, date, specialization
 * validateSlotCheck        | GET /slots                      | doctor_id, date
 * validateGuestAppointment | POST /booking                   | doctor, date, time, name, phone
 * validateDepartmentId     | GET /departments/:id            | UUID validation
 * validateServiceId        | GET /services/:id               | UUID validation
 * validateServicePricing   | GET /services/pricing           | service_id, department_id
 * validateProviderId       | GET /insurance/providers/:id    | UUID validation
 * validateContactForm      | POST /contact-form              | name, email, phone, message
 * validateFaqQuery         | GET /faq                        | category
 * validatePagination       | Reusable                        | page, limit
 * -------------------------|---------------------------------|----------------------
 * TOTAL: 12 Validators with 30+ validation rules
 * 
 * ======================================================================
 */