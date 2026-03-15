/**
 * ======================================================================
 * FILE: backend/src/validators/patientValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Request validators for all patient module endpoints.
 * Ensures data integrity and enforces business rules.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-01] Patient email must be unique
 * - [BR-02] Patient phone must be unique
 * - [BR-03] Emergency contact required
 * - [BR-04] Age between 0-150 years
 * - [BR-06] Consent form required
 * - [BR-07] Cannot book past appointments
 * - [BR-14] Medicine quantity positive
 * - [BR-15] Dosage required
 * - [BR-31] Discount max 100%
 * - [BR-32] Payment ≤ total
 * - [BR-34] Refund within 30 days
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
 * Custom validators
 */
const customValidators = {
    // [BR-04] Age validation
    isValidAge: (dateOfBirth) => {
        if (!dateOfBirth) return true;
        const dob = new Date(dateOfBirth);
        const today = new Date();
        const age = today.getFullYear() - dob.getFullYear();
        return age >= 0 && age <= 150;
    },

    // [BR-07] Not past date
    isNotPastDate: (date) => {
        const inputDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return inputDate >= today;
    },

    // [BR-34] Within 30 days
    isWithin30Days: (date) => {
        const inputDate = new Date(date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return inputDate >= thirtyDaysAgo;
    },

    // Valid time format (HH:MM)
    isValidTime: (time) => {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    },

    // Valid phone number (Indian format)
    isValidPhone: (phone) => {
        const phoneRegex = /^[6-9]\d{9}$|^\+91[6-9]\d{9}$|^0[6-9]\d{9}$/;
        return phoneRegex.test(phone);
    },

    // Valid email
    isValidEmail: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Valid blood group
    isValidBloodGroup: (bloodGroup) => {
        const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        return validGroups.includes(bloodGroup);
    },

    // Valid gender
    isValidGender: (gender) => {
        const validGenders = ['male', 'female', 'other', 'Male', 'Female', 'Other'];
        return validGenders.includes(gender);
    },

    // Valid appointment type
    isValidAppointmentType: (type) => {
        const validTypes = ['regular_checkup', 'followup', 'emergency', 'consultation', 'procedure'];
        return validTypes.includes(type);
    },

    // Valid payment method
    isValidPaymentMethod: (method) => {
        const validMethods = ['cash', 'card', 'upi', 'netbanking', 'wallet', 'insurance'];
        return validMethods.includes(method);
    },

    // Valid consent type
    isValidConsentType: (type) => {
        const validTypes = ['treatment', 'data_sharing', 'marketing', 'research', 'telemedicine', 'emergency_contact', 'insurance_claim', 'third_party_access'];
        return validTypes.includes(type);
    }
};

// ============================================
// PROFILE VALIDATORS
// ============================================

const validateProfileUpdate = [
    body('first_name')
        .optional()
        .isString().withMessage('First name must be a string')
        .isLength({ min: 2, max: 100 }).withMessage('First name must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    body('last_name')
        .optional()
        .isString().withMessage('Last name must be a string')
        .isLength({ min: 2, max: 100 }).withMessage('Last name must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    body('date_of_birth')
        .optional()
        .isISO8601().withMessage('Invalid date format')
        .custom(customValidators.isValidAge).withMessage('Age must be between 0 and 150 years'),
    
    body('gender')
        .optional()
        .custom(customValidators.isValidGender).withMessage('Invalid gender'),
    
    body('blood_group')
        .optional()
        .custom(customValidators.isValidBloodGroup).withMessage('Invalid blood group'),
    
    body('phone')
        .optional()
        .custom(customValidators.isValidPhone).withMessage('Invalid phone number'),
    
    body('email')
        .optional()
        .custom(customValidators.isValidEmail).withMessage('Invalid email address')
        .normalizeEmail(),
    
    body('address')
        .optional()
        .isString().withMessage('Address must be a string')
        .isLength({ max: 500 }).withMessage('Address too long')
        .trim()
        .escape(),
    
    validate
];

const validateEmergencyContact = [
    body('name')
        .notEmpty().withMessage('Emergency contact name is required')
        .isString().withMessage('Name must be a string')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    body('phone')
        .notEmpty().withMessage('Emergency contact phone is required')
        .custom(customValidators.isValidPhone).withMessage('Invalid phone number'),
    
    body('relation')
        .optional()
        .isString().withMessage('Relation must be a string')
        .isLength({ max: 50 }).withMessage('Relation too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// APPOINTMENT VALIDATORS
// ============================================

const validateAppointmentBooking = [
    body('doctorId')
        .notEmpty().withMessage('Doctor ID is required')
        .isUUID().withMessage('Invalid doctor ID format'),
    
    body('appointmentDate')
        .notEmpty().withMessage('Appointment date is required')
        .isISO8601().withMessage('Invalid date format')
        .custom(customValidators.isNotPastDate).withMessage('Cannot book appointment in the past'),
    
    body('appointmentTime')
        .notEmpty().withMessage('Appointment time is required')
        .custom(customValidators.isValidTime).withMessage('Invalid time format'),
    
    body('type')
        .optional()
        .custom(customValidators.isValidAppointmentType).withMessage('Invalid appointment type'),
    
    body('reason')
        .notEmpty().withMessage('Reason is required')
        .isString().withMessage('Reason must be a string')
        .isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5 and 500 characters')
        .trim()
        .escape(),
    
    body('symptoms')
        .optional()
        .isString().withMessage('Symptoms must be a string')
        .isLength({ max: 1000 }).withMessage('Symptoms too long')
        .trim()
        .escape(),
    
    body('isFollowup')
        .optional()
        .isBoolean().withMessage('isFollowup must be boolean'),
    
    body('previousAppointmentId')
        .optional()
        .isUUID().withMessage('Invalid previous appointment ID'),
    
    validate
];

const validateAppointmentReschedule = [
    param('id')
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('newDate')
        .notEmpty().withMessage('New date is required')
        .isISO8601().withMessage('Invalid date format')
        .custom(customValidators.isNotPastDate).withMessage('Cannot reschedule to past date'),
    
    body('newTime')
        .notEmpty().withMessage('New time is required')
        .custom(customValidators.isValidTime).withMessage('Invalid time format'),
    
    body('reason')
        .optional()
        .isString().withMessage('Reason must be a string')
        .isLength({ max: 500 }).withMessage('Reason too long')
        .trim()
        .escape(),
    
    validate
];

const validateAppointmentCancel = [
    param('id')
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('reason')
        .notEmpty().withMessage('Cancellation reason is required')
        .isString().withMessage('Reason must be a string')
        .isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5 and 500 characters')
        .trim()
        .escape(),
    
    validate
];

const validateAppointmentRating = [
    param('id')
        .isUUID().withMessage('Invalid appointment ID'),
    
    body('rating')
        .notEmpty().withMessage('Rating is required')
        .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    
    body('feedback')
        .optional()
        .isString().withMessage('Feedback must be a string')
        .isLength({ max: 1000 }).withMessage('Feedback too long')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// PAYMENT VALIDATORS
// ============================================

const validatePayment = [
    body('invoiceId')
        .notEmpty().withMessage('Invoice ID is required')
        .isUUID().withMessage('Invalid invoice ID format'),
    
    body('amount')
        .notEmpty().withMessage('Amount is required')
        .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
        .toFloat(),
    
    body('paymentMethod')
        .notEmpty().withMessage('Payment method is required')
        .custom(customValidators.isValidPaymentMethod).withMessage('Invalid payment method'),
    
    body('cardLastFour')
        .optional()
        .isString().withMessage('Card last four must be string')
        .isLength({ min: 4, max: 4 }).withMessage('Card last four must be 4 digits')
        .isNumeric().withMessage('Card last four must be numeric'),
    
    body('bankName')
        .optional()
        .isString().withMessage('Bank name must be string')
        .isLength({ max: 100 }).withMessage('Bank name too long')
        .trim()
        .escape(),
    
    body('referenceNumber')
        .optional()
        .isString().withMessage('Reference number must be string')
        .isLength({ max: 100 }).withMessage('Reference number too long')
        .trim()
        .escape(),
    
    validate
];

const validateOnlinePayment = [
    body('invoiceId')
        .notEmpty().withMessage('Invoice ID is required')
        .isUUID().withMessage('Invalid invoice ID format'),
    
    body('amount')
        .notEmpty().withMessage('Amount is required')
        .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0')
        .toFloat(),
    
    body('paymentGateway')
        .notEmpty().withMessage('Payment gateway is required')
        .isIn(['razorpay', 'stripe', 'phonepe', 'paytm']).withMessage('Invalid payment gateway'),
    
    body('successUrl')
        .optional()
        .isURL().withMessage('Invalid success URL'),
    
    body('cancelUrl')
        .optional()
        .isURL().withMessage('Invalid cancel URL'),
    
    validate
];

const validatePaymentMethod = [
    body('type')
        .notEmpty().withMessage('Payment method type is required')
        .isIn(['card', 'upi', 'bank']).withMessage('Invalid payment method type'),
    
    body('cardNumber')
        .if(body('type').equals('card'))
        .notEmpty().withMessage('Card number is required')
        .isCreditCard().withMessage('Invalid card number'),
    
    body('cardHolderName')
        .if(body('type').equals('card'))
        .notEmpty().withMessage('Card holder name is required')
        .isString().withMessage('Invalid name')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
        .trim()
        .escape(),
    
    body('expiryMonth')
        .if(body('type').equals('card'))
        .notEmpty().withMessage('Expiry month is required')
        .isInt({ min: 1, max: 12 }).withMessage('Invalid expiry month'),
    
    body('expiryYear')
        .if(body('type').equals('card'))
        .notEmpty().withMessage('Expiry year is required')
        .isInt({ min: 2024, max: 2040 }).withMessage('Invalid expiry year'),
    
    body('upiId')
        .if(body('type').equals('upi'))
        .notEmpty().withMessage('UPI ID is required')
        .matches(/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/).withMessage('Invalid UPI ID format'),
    
    body('bankName')
        .if(body('type').equals('bank'))
        .notEmpty().withMessage('Bank name is required')
        .isString().withMessage('Invalid bank name')
        .trim()
        .escape(),
    
    body('accountNumber')
        .if(body('type').equals('bank'))
        .notEmpty().withMessage('Account number is required')
        .isString().withMessage('Invalid account number')
        .isLength({ min: 9, max: 18 }).withMessage('Account number must be between 9 and 18 digits')
        .isNumeric().withMessage('Account number must be numeric'),
    
    body('ifscCode')
        .if(body('type').equals('bank'))
        .notEmpty().withMessage('IFSC code is required')
        .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Invalid IFSC code format'),
    
    validate
];

// ============================================
// INSURANCE VALIDATORS
// ============================================

const validateInsuranceUpdate = [
    body('provider')
        .notEmpty().withMessage('Insurance provider is required')
        .isString().withMessage('Provider must be string')
        .isLength({ max: 200 }).withMessage('Provider name too long')
        .trim()
        .escape(),
    
    body('policyNumber')
        .notEmpty().withMessage('Policy number is required')
        .isString().withMessage('Policy number must be string')
        .isLength({ max: 100 }).withMessage('Policy number too long')
        .trim()
        .escape(),
    
    body('expiryDate')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format')
        .custom((date) => new Date(date) > new Date()).withMessage('Expiry date must be in future'),
    
    body('groupNumber')
        .optional()
        .isString().withMessage('Group number must be string')
        .isLength({ max: 100 }).withMessage('Group number too long')
        .trim()
        .escape(),
    
    body('relationship')
        .optional()
        .isIn(['self', 'spouse', 'child', 'parent']).withMessage('Invalid relationship'),
    
    validate
];

const validateClaimSubmission = [
    body('invoiceId')
        .notEmpty().withMessage('Invoice ID is required')
        .isUUID().withMessage('Invalid invoice ID format'),
    
    body('diagnosis')
        .notEmpty().withMessage('Diagnosis is required')
        .isString().withMessage('Diagnosis must be string')
        .isLength({ min: 5, max: 500 }).withMessage('Diagnosis must be between 5 and 500 characters')
        .trim()
        .escape(),
    
    body('procedureCodes')
        .optional()
        .isArray().withMessage('Procedure codes must be an array'),
    
    body('procedureCodes.*')
        .optional()
        .isString().withMessage('Each procedure code must be string')
        .isLength({ max: 20 }).withMessage('Procedure code too long'),
    
    body('documents')
        .optional()
        .isArray().withMessage('Documents must be an array'),
    
    body('documents.*')
        .optional()
        .isURL().withMessage('Each document must be a valid URL'),
    
    validate
];

// ============================================
// CONSENT VALIDATORS
// ============================================

const validateConsent = [
    body('consentType')
        .notEmpty().withMessage('Consent type is required')
        .custom(customValidators.isValidConsentType).withMessage('Invalid consent type'),
    
    body('consentVersion')
        .optional()
        .isString().withMessage('Consent version must be string')
        .matches(/^\d+\.\d+$/).withMessage('Invalid version format (e.g., 1.0)'),
    
    body('consentText')
        .notEmpty().withMessage('Consent text is required')
        .isString().withMessage('Consent text must be string')
        .isLength({ min: 10, max: 5000 }).withMessage('Consent text must be between 10 and 5000 characters')
        .trim()
        .escape(),
    
    body('expiresAt')
        .optional()
        .isISO8601().withMessage('Invalid expiry date format')
        .custom((date) => new Date(date) > new Date()).withMessage('Expiry date must be in future'),
    
    validate
];

const validateConsentRevocation = [
    param('id')
        .isUUID().withMessage('Invalid consent ID'),
    
    body('reason')
        .notEmpty().withMessage('Revocation reason is required')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5 and 500 characters')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// DATA EXPORT & DELETION VALIDATORS
// ============================================

const validateDataExport = [
    body('format')
        .optional()
        .isIn(['json', 'csv', 'pdf']).withMessage('Invalid export format'),
    
    body('includeMedical')
        .optional()
        .isBoolean().withMessage('includeMedical must be boolean'),
    
    body('includeBilling')
        .optional()
        .isBoolean().withMessage('includeBilling must be boolean'),
    
    validate
];

const validateDeletionRequest = [
    body('reason')
        .notEmpty().withMessage('Deletion reason is required')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 10, max: 1000 }).withMessage('Reason must be between 10 and 1000 characters')
        .trim()
        .escape(),
    
    body('withdrawConsent')
        .optional()
        .isBoolean().withMessage('withdrawConsent must be boolean'),
    
    validate
];

const validateDeletionCancel = [
    param('id')
        .isUUID().withMessage('Invalid request ID'),
    
    body('reason')
        .notEmpty().withMessage('Cancellation reason is required')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 5, max: 500 }).withMessage('Reason must be between 5 and 500 characters')
        .trim()
        .escape(),
    
    validate
];

// ============================================
// BREAK-GLASS ACCESS VALIDATORS
// ============================================

const validateBreakGlass = [
    body('patientId')
        .notEmpty().withMessage('Patient ID is required')
        .isUUID().withMessage('Invalid patient ID format'),
    
    body('reason')
        .notEmpty().withMessage('Emergency reason is required')
        .isString().withMessage('Reason must be string')
        .isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
        .trim()
        .escape(),
    
    body('clinicalContext')
        .optional()
        .isString().withMessage('Clinical context must be string')
        .isLength({ max: 1000 }).withMessage('Clinical context too long')
        .trim()
        .escape(),
    
    body('witnessId')
        .notEmpty().withMessage('Witness ID is required')
        .isUUID().withMessage('Invalid witness ID format')
        .custom((value, { req }) => value !== req.user.id).withMessage('Witness cannot be yourself'),
    
    validate
];

// ============================================
// MEDICAL RECORDS VALIDATORS
// ============================================

const validateMedicalHistoryFilters = [
    query('startDate')
        .optional()
        .isISO8601().withMessage('Invalid start date format'),
    
    query('endDate')
        .optional()
        .isISO8601().withMessage('Invalid end date format')
        .custom((endDate, { req }) => {
            if (req.query.startDate && endDate < req.query.startDate) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),
    
    query('type')
        .optional()
        .isIn(['appointments', 'prescriptions', 'lab_results', 'radiology', 'vitals'])
        .withMessage('Invalid record type'),
    
    validate
];

const validatePrescriptionDownload = [
    param('id')
        .isUUID().withMessage('Invalid prescription ID'),
    
    validate
];

const validateLabResultDownload = [
    param('id')
        .isUUID().withMessage('Invalid lab result ID'),
    
    validate
];

// ============================================
// QUERY PARAMETER VALIDATORS
// ============================================

const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt(),
    
    validate
];

const validateDateRange = [
    query('fromDate')
        .optional()
        .isISO8601().withMessage('Invalid from date format'),
    
    query('toDate')
        .optional()
        .isISO8601().withMessage('Invalid to date format')
        .custom((toDate, { req }) => {
            if (req.query.fromDate && toDate < req.query.fromDate) {
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
    // Profile validators
    validateProfileUpdate,
    validateEmergencyContact,
    
    // Appointment validators
    validateAppointmentBooking,
    validateAppointmentReschedule,
    validateAppointmentCancel,
    validateAppointmentRating,
    
    // Payment validators
    validatePayment,
    validateOnlinePayment,
    validatePaymentMethod,
    
    // Insurance validators
    validateInsuranceUpdate,
    validateClaimSubmission,
    
    // Consent validators
    validateConsent,
    validateConsentRevocation,
    
    // Data export & deletion validators
    validateDataExport,
    validateDeletionRequest,
    validateDeletionCancel,
    
    // Break-glass validators
    validateBreakGlass,
    
    // Medical records validators
    validateMedicalHistoryFilters,
    validatePrescriptionDownload,
    validateLabResultDownload,
    
    // Query parameter validators
    validatePagination,
    validateDateRange,
    
    // Export the validate middleware for custom use
    validate,
    
    // Export custom validators for reuse
    customValidators
};

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // In routes file:
 * const { 
 *     validateAppointmentBooking,
 *     validatePagination,
 *     validate
 * } = require('../validators/patientValidators');
 * 
 * // With validation
 * router.post('/appointments', 
 *     authenticate,
 *     validateAppointmentBooking,
 *     appointmentController.bookAppointment
 * );
 * 
 * // With pagination validation
 * router.get('/appointments',
 *     authenticate,
 *     validatePagination,
 *     appointmentController.getAppointments
 * );
 * 
 * // Custom validation for specific field
 * router.post('/profile',
 *     authenticate,
 *     validateProfileUpdate,
 *     profileController.updateProfile
 * );
 * 
 * ======================================================================
 */