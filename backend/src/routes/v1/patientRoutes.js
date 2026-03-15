/**
 * ======================================================================
 * FILE: backend/src/routes/v1/patientRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient module routes - All patient-facing endpoints.
 * Total Endpoints: 98 (as per API blueprint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * MIDDLEWARE STACK:
 * 1. authenticate - JWT verification
 * 2. rateLimiter - Per-endpoint rate limiting
 * 3. validator - Request validation
 * 4. controller - Business logic
 * 5. auditLogger - PHI access logging
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();

// ============================================
// IMPORT MIDDLEWARES
// ============================================
const authenticate = require('../../middlewares/auth');
const rateLimiter = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');
const { validate } = require('../../validators/patientValidators');

// ============================================
// IMPORT CONTROLLERS
// ============================================
const profileController = require('../../controllers/patient/profileController');
const medicalController = require('../../controllers/patient/medicalController');
const appointmentController = require('../../controllers/patient/appointmentController');
const billingController = require('../../controllers/patient/billingController');
const consentController = require('../../controllers/patient/consentController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
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
    
    // Query parameter validators
    validatePagination,
    validateDateRange
} = require('../../validators/patientValidators');

// ============================================
// RATE LIMITING CONFIGURATION
// ============================================
const standardLimiter = rateLimiter({ windowMs: 60 * 1000, max: 60 }); // 60 requests per minute
const sensitiveLimiter = rateLimiter({ windowMs: 60 * 1000, max: 10 }); // 10 requests per minute (for sensitive ops)
const exportLimiter = rateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }); // 5 requests per hour (for exports)

// ============================================
// ============================================
// PROFILE ROUTES (12 endpoints)
// ============================================
// ============================================

/**
 * Profile Management
 * Base: /api/v1/patient/profile
 */
router.get('/profile', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PROFILE'),
    profileController.getProfile
);

router.put('/profile', 
    authenticate, 
    standardLimiter,
    validateProfileUpdate,
    auditLogger('UPDATE_PROFILE'),
    profileController.updateProfile
);

router.patch('/profile', 
    authenticate, 
    standardLimiter,
    validateProfileUpdate,
    auditLogger('PARTIAL_UPDATE_PROFILE'),
    profileController.partialUpdateProfile
);

/**
 * Profile Photo
 */
router.get('/profile/photo', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PROFILE_PHOTO'),
    profileController.getProfilePhoto
);

router.post('/profile/photo', 
    authenticate, 
    standardLimiter,
    auditLogger('UPLOAD_PROFILE_PHOTO'),
    profileController.uploadProfilePhoto
);

router.delete('/profile/photo', 
    authenticate, 
    standardLimiter,
    auditLogger('DELETE_PROFILE_PHOTO'),
    profileController.deleteProfilePhoto
);

/**
 * Emergency Contacts
 */
router.get('/emergency-contacts', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_EMERGENCY_CONTACTS'),
    profileController.getEmergencyContacts
);

router.post('/emergency-contacts', 
    authenticate, 
    standardLimiter,
    validateEmergencyContact,
    auditLogger('ADD_EMERGENCY_CONTACT'),
    profileController.addEmergencyContact
);

router.put('/emergency-contacts/:id', 
    authenticate, 
    standardLimiter,
    validateEmergencyContact,
    auditLogger('UPDATE_EMERGENCY_CONTACT'),
    profileController.updateEmergencyContact
);

router.delete('/emergency-contacts/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('DELETE_EMERGENCY_CONTACT'),
    profileController.deleteEmergencyContact
);

// ============================================
// ============================================
// MEDICAL RECORDS ROUTES (25 endpoints)
// ============================================
// ============================================

/**
 * Medical Records Overview
 * Base: /api/v1/patient/medical-records
 */
router.get('/medical-records', 
    authenticate, 
    standardLimiter,
    validateMedicalHistoryFilters,
    auditLogger('VIEW_MEDICAL_RECORDS'),
    medicalController.getMedicalRecords
);

router.get('/medical-records/summary', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_HEALTH_SUMMARY'),
    medicalController.getHealthSummary
);

router.get('/medical-records/timeline', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_MEDICAL_TIMELINE'),
    medicalController.getMedicalTimeline
);

router.get('/medical-records/export', 
    authenticate, 
    exportLimiter,
    validateDataExport,
    auditLogger('EXPORT_MEDICAL_RECORDS'),
    medicalController.exportMedicalRecords
);

/**
 * Prescriptions
 */
router.get('/prescriptions', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PRESCRIPTIONS'),
    medicalController.getPrescriptions
);

router.get('/prescriptions/active', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_ACTIVE_PRESCRIPTIONS'),
    medicalController.getActivePrescriptions
);

router.get('/prescriptions/history', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PRESCRIPTION_HISTORY'),
    medicalController.getPrescriptionHistory
);

router.get('/prescriptions/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PRESCRIPTION'),
    medicalController.getPrescriptionById
);

router.get('/prescriptions/:id/pdf', 
    authenticate, 
    standardLimiter,
    auditLogger('DOWNLOAD_PRESCRIPTION_PDF'),
    medicalController.downloadPrescriptionPDF
);

/**
 * Lab Results
 */
router.get('/lab-results', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_LAB_RESULTS'),
    medicalController.getLabResults
);

router.get('/lab-results/pending', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PENDING_LAB_RESULTS'),
    medicalController.getPendingLabResults
);

router.get('/lab-results/completed', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_COMPLETED_LAB_RESULTS'),
    medicalController.getCompletedLabResults
);

router.get('/lab-results/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_LAB_RESULT'),
    medicalController.getLabResultById
);

router.get('/lab-results/:id/pdf', 
    authenticate, 
    standardLimiter,
    auditLogger('DOWNLOAD_LAB_RESULT_PDF'),
    medicalController.downloadLabResultPDF
);

/**
 * Radiology Images
 */
router.get('/radiology-images', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_RADIOLOGY_IMAGES'),
    medicalController.getRadiologyImages
);

router.get('/radiology-images/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_RADIOLOGY_IMAGE'),
    medicalController.getRadiologyImageById
);

router.get('/radiology-images/:id/download', 
    authenticate, 
    standardLimiter,
    auditLogger('DOWNLOAD_RADIOLOGY_IMAGE'),
    medicalController.downloadRadiologyImage
);

/**
 * Vital Signs
 */
router.get('/vitals', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_VITALS'),
    medicalController.getVitals
);

router.get('/vitals/latest', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_LATEST_VITALS'),
    medicalController.getLatestVitals
);

router.get('/vitals/trends', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_VITAL_TRENDS'),
    medicalController.getVitalTrends
);

/**
 * Diagnosis
 */
router.get('/diagnosis', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_DIAGNOSIS'),
    medicalController.getDiagnosis
);

/**
 * Visit History
 */
router.get('/visits', 
    authenticate, 
    standardLimiter,
    validatePagination,
    auditLogger('VIEW_VISITS'),
    medicalController.getVisits
);

router.get('/visits/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_VISIT'),
    medicalController.getVisitById
);

// ============================================
// ============================================
// APPOINTMENT ROUTES (13 endpoints)
// ============================================
// ============================================

/**
 * Appointment Lists
 * Base: /api/v1/patient/appointments
 */
router.get('/appointments', 
    authenticate, 
    standardLimiter,
    validatePagination,
    validateDateRange,
    auditLogger('VIEW_APPOINTMENTS'),
    appointmentController.getAppointments
);

router.get('/appointments/upcoming', 
    authenticate, 
    standardLimiter,
    validatePagination,
    auditLogger('VIEW_UPCOMING_APPOINTMENTS'),
    appointmentController.getUpcomingAppointments
);

router.get('/appointments/past', 
    authenticate, 
    standardLimiter,
    validatePagination,
    auditLogger('VIEW_PAST_APPOINTMENTS'),
    appointmentController.getPastAppointments
);

router.get('/appointments/today', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_TODAY_APPOINTMENTS'),
    appointmentController.getTodayAppointments
);

router.get('/appointments/stats', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_APPOINTMENT_STATS'),
    appointmentController.getAppointmentStats
);

router.get('/appointments/reminders', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_APPOINTMENT_REMINDERS'),
    appointmentController.getAppointmentReminders
);

/**
 * Single Appointment Operations
 */
router.get('/appointments/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_APPOINTMENT'),
    appointmentController.getAppointmentById
);

router.post('/appointments', 
    authenticate, 
    sensitiveLimiter,
    validateAppointmentBooking,
    auditLogger('BOOK_APPOINTMENT'),
    appointmentController.bookAppointment
);

router.put('/appointments/:id/cancel', 
    authenticate, 
    sensitiveLimiter,
    validateAppointmentCancel,
    auditLogger('CANCEL_APPOINTMENT'),
    appointmentController.cancelAppointment
);

router.put('/appointments/:id/reschedule', 
    authenticate, 
    sensitiveLimiter,
    validateAppointmentReschedule,
    auditLogger('RESCHEDULE_APPOINTMENT'),
    appointmentController.rescheduleAppointment
);

router.get('/appointments/:id/history', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_APPOINTMENT_HISTORY'),
    appointmentController.getAppointmentHistory
);

router.post('/appointments/:id/rate', 
    authenticate, 
    standardLimiter,
    validateAppointmentRating,
    auditLogger('RATE_APPOINTMENT'),
    appointmentController.rateAppointment
);

/**
 * Availability
 */
router.get('/appointments/available-slots', 
    authenticate, 
    standardLimiter,
    auditLogger('CHECK_AVAILABLE_SLOTS'),
    appointmentController.getAvailableSlots
);

// ============================================
// ============================================
// BILLING ROUTES (27 endpoints)
// ============================================
// ============================================

/**
 * Invoice Management
 * Base: /api/v1/patient/invoices
 */
router.get('/invoices', 
    authenticate, 
    standardLimiter,
    validatePagination,
    validateDateRange,
    auditLogger('VIEW_INVOICES'),
    billingController.getInvoices
);

router.get('/invoices/pending', 
    authenticate, 
    standardLimiter,
    validatePagination,
    auditLogger('VIEW_PENDING_INVOICES'),
    billingController.getPendingInvoices
);

router.get('/invoices/paid', 
    authenticate, 
    standardLimiter,
    validatePagination,
    auditLogger('VIEW_PAID_INVOICES'),
    billingController.getPaidInvoices
);

router.get('/invoices/overdue', 
    authenticate, 
    standardLimiter,
    validatePagination,
    auditLogger('VIEW_OVERDUE_INVOICES'),
    billingController.getOverdueInvoices
);

router.get('/invoices/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_INVOICE'),
    billingController.getInvoiceById
);

router.get('/invoices/:id/pdf', 
    authenticate, 
    standardLimiter,
    auditLogger('DOWNLOAD_INVOICE_PDF'),
    billingController.downloadInvoicePDF
);

router.get('/invoices/:id/breakdown', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_INVOICE_BREAKDOWN'),
    billingController.getInvoiceBreakdown
);

/**
 * Payment Management
 * Base: /api/v1/patient/payments
 */
router.get('/payments', 
    authenticate, 
    standardLimiter,
    validatePagination,
    validateDateRange,
    auditLogger('VIEW_PAYMENTS'),
    billingController.getPayments
);

router.get('/payments/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PAYMENT'),
    billingController.getPaymentById
);

router.post('/payments', 
    authenticate, 
    sensitiveLimiter,
    validatePayment,
    auditLogger('MAKE_PAYMENT'),
    billingController.makePayment
);

router.post('/payments/online', 
    authenticate, 
    sensitiveLimiter,
    validateOnlinePayment,
    auditLogger('PROCESS_ONLINE_PAYMENT'),
    billingController.processOnlinePayment
);

router.post('/payments/online/verify', 
    authenticate, 
    standardLimiter,
    auditLogger('VERIFY_ONLINE_PAYMENT'),
    billingController.verifyOnlinePayment
);

/**
 * Payment Methods
 */
router.get('/payments/methods', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PAYMENT_METHODS'),
    billingController.getPaymentMethods
);

router.post('/payments/methods', 
    authenticate, 
    sensitiveLimiter,
    validatePaymentMethod,
    auditLogger('ADD_PAYMENT_METHOD'),
    billingController.addPaymentMethod
);

router.delete('/payments/methods/:id', 
    authenticate, 
    sensitiveLimiter,
    auditLogger('DELETE_PAYMENT_METHOD'),
    billingController.deletePaymentMethod
);

router.put('/payments/methods/:id/default', 
    authenticate, 
    sensitiveLimiter,
    auditLogger('SET_DEFAULT_PAYMENT_METHOD'),
    billingController.setDefaultPaymentMethod
);

/**
 * Insurance Management
 * Base: /api/v1/patient/insurance
 */
router.get('/insurance', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_INSURANCE'),
    billingController.getInsuranceDetails
);

router.put('/insurance', 
    authenticate, 
    sensitiveLimiter,
    validateInsuranceUpdate,
    auditLogger('UPDATE_INSURANCE'),
    billingController.updateInsurance
);

router.get('/insurance/claims', 
    authenticate, 
    standardLimiter,
    validatePagination,
    auditLogger('VIEW_INSURANCE_CLAIMS'),
    billingController.getInsuranceClaims
);

router.get('/insurance/claims/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_INSURANCE_CLAIM'),
    billingController.getInsuranceClaimById
);

router.post('/insurance/claims', 
    authenticate, 
    sensitiveLimiter,
    validateClaimSubmission,
    auditLogger('SUBMIT_INSURANCE_CLAIM'),
    billingController.submitInsuranceClaim
);

router.get('/insurance/coverage', 
    authenticate, 
    standardLimiter,
    auditLogger('CHECK_INSURANCE_COVERAGE'),
    billingController.checkCoverage
);

router.get('/insurance/verification', 
    authenticate, 
    standardLimiter,
    auditLogger('GET_INSURANCE_VERIFICATION'),
    billingController.getInsuranceVerification
);

/**
 * Billing Summary & Receipts
 */
router.get('/billing/summary', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_BILLING_SUMMARY'),
    billingController.getBillingSummary
);

router.get('/billing/receipts', 
    authenticate, 
    standardLimiter,
    validatePagination,
    auditLogger('VIEW_PAYMENT_RECEIPTS'),
    billingController.getPaymentReceipts
);

router.get('/billing/receipts/:id/pdf', 
    authenticate, 
    standardLimiter,
    auditLogger('DOWNLOAD_PAYMENT_RECEIPT'),
    billingController.downloadPaymentReceipt
);

// ============================================
// ============================================
// CONSENT ROUTES (21 endpoints)
// ============================================
// ============================================

/**
 * Consent Management
 * Base: /api/v1/patient/consents
 */
router.get('/consents', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_CONSENTS'),
    consentController.getConsents
);

router.get('/consents/types', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_CONSENT_TYPES'),
    consentController.getConsentTypes
);

router.get('/consents/dashboard', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_CONSENT_DASHBOARD'),
    consentController.getConsentDashboard
);

router.get('/consents/stats', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_CONSENT_STATS'),
    consentController.getConsentStats
);

router.get('/consents/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_CONSENT'),
    consentController.getConsentById
);

router.post('/consents', 
    authenticate, 
    sensitiveLimiter,
    validateConsent,
    auditLogger('GRANT_CONSENT'),
    consentController.giveConsent
);

router.put('/consents/:id', 
    authenticate, 
    sensitiveLimiter,
    validateConsent,
    auditLogger('UPDATE_CONSENT'),
    consentController.updateConsent
);

router.delete('/consents/:id', 
    authenticate, 
    sensitiveLimiter,
    validateConsentRevocation,
    auditLogger('REVOKE_CONSENT'),
    consentController.revokeConsent
);

router.get('/consents/history', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_CONSENT_HISTORY'),
    consentController.getConsentHistory
);

/**
 * PHI Access Logs
 */
router.get('/consents/phi-access', 
    authenticate, 
    standardLimiter,
    validatePagination,
    validateDateRange,
    auditLogger('VIEW_PHI_ACCESS_LOGS'),
    consentController.getPHIAccessLogs
);

router.get('/consents/phi-access/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PHI_ACCESS_DETAIL'),
    consentController.getPHIAccessDetail
);

/**
 * Break-Glass Access
 */
router.post('/consents/break-glass', 
    authenticate, 
    sensitiveLimiter,
    validateBreakGlass,
    auditLogger('REQUEST_BREAK_GLASS'),
    consentController.requestBreakGlassAccess
);

router.get('/consents/break-glass/active', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_ACTIVE_BREAK_GLASS'),
    consentController.getActiveBreakGlassSessions
);

/**
 * Data Export
 * Base: /api/v1/patient/data-export
 */
router.post('/data-export', 
    authenticate, 
    exportLimiter,
    validateDataExport,
    auditLogger('REQUEST_DATA_EXPORT'),
    consentController.requestDataExport
);

router.get('/data-export/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_EXPORT_STATUS'),
    consentController.getExportStatus
);

router.get('/data-export/:id/download', 
    authenticate, 
    standardLimiter,
    auditLogger('DOWNLOAD_EXPORTED_DATA'),
    consentController.downloadExportedData
);

/**
 * Deletion Requests (GDPR)
 * Base: /api/v1/patient/deletion-request
 */
router.post('/deletion-request', 
    authenticate, 
    sensitiveLimiter,
    validateDeletionRequest,
    auditLogger('REQUEST_DATA_DELETION'),
    consentController.requestDeletion
);

router.get('/deletion-request/:id', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_DELETION_STATUS'),
    consentController.getDeletionStatus
);

router.put('/deletion-request/:id/cancel', 
    authenticate, 
    sensitiveLimiter,
    validateDeletionCancel,
    auditLogger('CANCEL_DELETION_REQUEST'),
    consentController.cancelDeletionRequest
);

// ============================================
// ============================================
// DASHBOARD & UTILITY ROUTES
// ============================================
// ============================================

/**
 * Patient Dashboard
 * Consolidated view of all patient data
 */
router.get('/dashboard', 
    authenticate, 
    standardLimiter,
    auditLogger('VIEW_PATIENT_DASHBOARD'),
    async (req, res, next) => {
        try {
            const patientService = require('../../services/patient/patientService');
            const dashboard = await patientService.getDashboard(req.user.id);
            res.json({
                success: true,
                data: dashboard
            });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * Health Check for Patient Module
 */
router.get('/health', 
    authenticate, 
    standardLimiter,
    (req, res) => {
        res.json({
            success: true,
            message: 'Patient module is healthy',
            timestamp: new Date().toISOString(),
            userId: req.user.id,
            endpoints: {
                total: 98,
                profile: 12,
                medical: 25,
                appointments: 13,
                billing: 27,
                consent: 21
            }
        });
    }
);

// ============================================
// ============================================
// EXPORT ROUTER
// ============================================
// ============================================

module.exports = router;

/**
 * ======================================================================
 * ROUTE SUMMARY:
 * ======================================================================
 * 
 * Category        | Count | Base Path
 * ----------------|-------|-------------------
 * Profile         | 12    | /profile, /emergency-contacts
 * Medical Records | 25    | /medical-records, /prescriptions, /lab-results, /radiology-images, /vitals, /diagnosis, /visits
 * Appointments    | 13    | /appointments
 * Billing         | 27    | /invoices, /payments, /insurance, /billing
 * Consent         | 21    | /consents, /data-export, /deletion-request
 * Dashboard       | 1     | /dashboard
 * Health          | 1     | /health
 * ----------------|-------|-------------------
 * TOTAL           | 98    | Complete Patient Module
 * 
 * ======================================================================
 * 
 * MIDDLEWARE APPLIED TO ALL ROUTES:
 * - authenticate: JWT verification
 * - rateLimiter: Per-endpoint rate limiting
 * - auditLogger: PHI access logging
 * - validator: Request validation (where applicable)
 * 
 * ======================================================================
 */