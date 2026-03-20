/**
 * ======================================================================
 * FILE: backend/src/routes/v1/receptionistRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist module routes - All receptionist-facing endpoints.
 * Total Endpoints: 41 (including root endpoint)
 * 
 * VERSION: 1.0.1
 * UPDATED: 2026-03-19
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all receptionist endpoints
 * v1.0.1 - HYBRID APPROACH: Added public root endpoint (no auth)
 *          Health endpoint remains protected with authentication
 *          All other endpoints remain protected
 *          This provides basic module info publicly while keeping sensitive data secure
 *          Fixed authenticate import destructuring
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES COVERED:
 * - [BR-01] Patient email must be unique
 * - [BR-02] Patient phone must be unique
 * - [BR-03] Emergency contact required
 * - [BR-04] Min age 0, Max age 150
 * - [BR-07] Cannot book appointment in past
 * - [BR-08] Max 30 appointments per doctor per day
 * - [BR-09] Appointment duration default 30 minutes
 * - [BR-10] Cancellation allowed up to 2 hours before
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();

// ============================================
// IMPORT MIDDLEWARES
// ============================================
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/rbac');
const { standard, sensitive } = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');

// ============================================
// IMPORT CONTROLLERS
// ============================================
const registrationController = require('../../controllers/receptionist/registrationController');
const appointmentController = require('../../controllers/receptionist/appointmentController');
const bedController = require('../../controllers/receptionist/bedController');
const walkinController = require('../../controllers/receptionist/walkinController');
const opdController = require('../../controllers/receptionist/opdController');
const dashboardController = require('../../controllers/receptionist/dashboardController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validatePatientRegistration,
    validatePatientSearch,
    validateEmergencyContact,
    validateAppointmentBooking,
    validateAppointmentStatus,
    validateBedAllocation,
    validateWalkinRegistration,
    validateOPDRegistration,
    validatePagination,
    validateDateRange
} = require('../../validators/receptionistValidators');

// ============================================
// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// ============================================
// v1.0.1 - Added public root endpoint

/**
 * Public root endpoint for receptionist module
 * GET /api/v1/reception
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Receptionist API',
        version: '1.0.1',
        status: 'operational',
        documentation: '/api/v1/reception/health',
        authentication: 'Bearer token required for all data endpoints',
        // ❌ No internal endpoints listed - security through obscurity
        // Health endpoint is documented but requires auth for details
        available: {
            health: '/api/v1/reception/health'
        }
    });
});

// ============================================
// ============================================
// PATIENT REGISTRATION ROUTES (9 endpoints)
// ============================================
// ============================================

/**
 * Search patients
 * GET /api/v1/reception/patients
 * 
 * BUSINESS RULES: [BR-01], [BR-02] (enforced in service)
 */
router.get('/patients',
    authenticate,
    authorize('receptionist', 'search_patients'),
    standard,
    validatePatientSearch,
    auditLogger('RECEPTION_SEARCH_PATIENTS'),
    registrationController.searchPatients
);

/**
 * Get recent patients
 * GET /api/v1/reception/patients/recent
 */
router.get('/patients/recent',
    authenticate,
    authorize('receptionist', 'view_patients'),
    standard,
    auditLogger('RECEPTION_VIEW_RECENT_PATIENTS'),
    registrationController.getRecentPatients
);

/**
 * Get patient by ID
 * GET /api/v1/reception/patients/:id
 */
router.get('/patients/:id',
    authenticate,
    authorize('receptionist', 'view_patient'),
    standard,
    auditLogger('RECEPTION_VIEW_PATIENT'),
    registrationController.getPatientById
);

/**
 * Register new patient
 * POST /api/v1/reception/patients
 * 
 * BUSINESS RULES: 
 * - [BR-01] Email unique
 * - [BR-02] Phone unique
 * - [BR-03] Emergency contact required
 * - [BR-04] Age between 0-150
 */
router.post('/patients',
    authenticate,
    authorize('receptionist', 'register_patient'),
    sensitive,
    validatePatientRegistration,
    auditLogger('RECEPTION_REGISTER_PATIENT'),
    registrationController.registerPatient
);

/**
 * Update patient
 * PUT /api/v1/reception/patients/:id
 */
router.put('/patients/:id',
    authenticate,
    authorize('receptionist', 'update_patient'),
    sensitive,
    validatePatientRegistration,
    auditLogger('RECEPTION_UPDATE_PATIENT'),
    registrationController.updatePatient
);

/**
 * Deactivate patient (soft delete)
 * DELETE /api/v1/reception/patients/:id
 */
router.delete('/patients/:id',
    authenticate,
    authorize('receptionist', 'deactivate_patient'),
    sensitive,
    auditLogger('RECEPTION_DEACTIVATE_PATIENT'),
    registrationController.deactivatePatient
);

/**
 * Add emergency contact
 * POST /api/v1/reception/patients/:id/emergency-contact
 * 
 * BUSINESS RULE: [BR-03] Emergency contact required
 */
router.post('/patients/:id/emergency-contact',
    authenticate,
    authorize('receptionist', 'update_patient'),
    sensitive,
    validateEmergencyContact,
    auditLogger('RECEPTION_ADD_EMERGENCY_CONTACT'),
    registrationController.addEmergencyContact
);

/**
 * Update emergency contact
 * PUT /api/v1/reception/patients/:id/emergency-contact/:contactId
 */
router.put('/patients/:id/emergency-contact/:contactId',
    authenticate,
    authorize('receptionist', 'update_patient'),
    sensitive,
    validateEmergencyContact,
    auditLogger('RECEPTION_UPDATE_EMERGENCY_CONTACT'),
    registrationController.updateEmergencyContact
);

/**
 * Delete emergency contact
 * DELETE /api/v1/reception/patients/:id/emergency-contact/:contactId
 */
router.delete('/patients/:id/emergency-contact/:contactId',
    authenticate,
    authorize('receptionist', 'update_patient'),
    sensitive,
    auditLogger('RECEPTION_DELETE_EMERGENCY_CONTACT'),
    registrationController.deleteEmergencyContact
);

// ============================================
// ============================================
// APPOINTMENT ROUTES (13 endpoints)
// ============================================
// ============================================

/**
 * Get all appointments
 * GET /api/v1/reception/appointments
 */
router.get('/appointments',
    authenticate,
    authorize('receptionist', 'view_appointments'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('RECEPTION_VIEW_APPOINTMENTS'),
    appointmentController.getAllAppointments
);

/**
 * Get today's appointments
 * GET /api/v1/reception/appointments/today
 */
router.get('/appointments/today',
    authenticate,
    authorize('receptionist', 'view_appointments'),
    standard,
    auditLogger('RECEPTION_VIEW_TODAY_APPOINTMENTS'),
    appointmentController.getTodaysAppointments
);

/**
 * Get upcoming appointments
 * GET /api/v1/reception/appointments/upcoming
 */
router.get('/appointments/upcoming',
    authenticate,
    authorize('receptionist', 'view_appointments'),
    standard,
    auditLogger('RECEPTION_VIEW_UPCOMING_APPOINTMENTS'),
    appointmentController.getUpcomingAppointments
);

/**
 * Get past appointments
 * GET /api/v1/reception/appointments/past
 */
router.get('/appointments/past',
    authenticate,
    authorize('receptionist', 'view_appointments'),
    standard,
    auditLogger('RECEPTION_VIEW_PAST_APPOINTMENTS'),
    appointmentController.getPastAppointments
);

/**
 * Get calendar view
 * GET /api/v1/reception/appointments/calendar
 */
router.get('/appointments/calendar',
    authenticate,
    authorize('receptionist', 'view_appointments'),
    standard,
    auditLogger('RECEPTION_VIEW_CALENDAR'),
    appointmentController.getCalendarView
);

/**
 * Get appointment by ID
 * GET /api/v1/reception/appointments/:id
 */
router.get('/appointments/:id',
    authenticate,
    authorize('receptionist', 'view_appointment'),
    standard,
    auditLogger('RECEPTION_VIEW_APPOINTMENT'),
    appointmentController.getAppointmentById
);

/**
 * Create new appointment
 * POST /api/v1/reception/appointments
 * 
 * BUSINESS RULES:
 * - [BR-07] Cannot book in past
 * - [BR-08] Max 30 per doctor per day
 * - [BR-09] Default duration 30 minutes
 */
router.post('/appointments',
    authenticate,
    authorize('receptionist', 'create_appointment'),
    sensitive,
    validateAppointmentBooking,
    auditLogger('RECEPTION_CREATE_APPOINTMENT'),
    appointmentController.createAppointment
);

/**
 * Update appointment
 * PUT /api/v1/reception/appointments/:id
 */
router.put('/appointments/:id',
    authenticate,
    authorize('receptionist', 'update_appointment'),
    sensitive,
    validateAppointmentBooking,
    auditLogger('RECEPTION_UPDATE_APPOINTMENT'),
    appointmentController.updateAppointment
);

/**
 * Cancel appointment
 * PUT /api/v1/reception/appointments/:id/cancel
 * 
 * BUSINESS RULE: [BR-10] Cancellation up to 2 hours before
 */
router.put('/appointments/:id/cancel',
    authenticate,
    authorize('receptionist', 'cancel_appointment'),
    sensitive,
    validateAppointmentStatus,
    auditLogger('RECEPTION_CANCEL_APPOINTMENT'),
    appointmentController.cancelAppointment
);

/**
 * Check-in patient
 * PUT /api/v1/reception/appointments/:id/check-in
 */
router.put('/appointments/:id/check-in',
    authenticate,
    authorize('receptionist', 'checkin_patient'),
    sensitive,
    auditLogger('RECEPTION_CHECKIN'),
    appointmentController.checkInPatient
);

/**
 * Check-out patient
 * PUT /api/v1/reception/appointments/:id/check-out
 */
router.put('/appointments/:id/check-out',
    authenticate,
    authorize('receptionist', 'checkout_patient'),
    sensitive,
    auditLogger('RECEPTION_CHECKOUT'),
    appointmentController.checkOutPatient
);

/**
 * Get available slots
 * GET /api/v1/reception/appointments/available-slots
 */
router.get('/appointments/available-slots',
    authenticate,
    authorize('receptionist', 'view_appointments'),
    standard,
    auditLogger('RECEPTION_VIEW_AVAILABLE_SLOTS'),
    appointmentController.getAvailableSlots
);

/**
 * Get walk-in slots
 * GET /api/v1/reception/appointments/walk-in
 */
router.get('/appointments/walk-in',
    authenticate,
    authorize('receptionist', 'view_appointments'),
    standard,
    auditLogger('RECEPTION_VIEW_WALKIN_SLOTS'),
    appointmentController.getWalkinSlots
);

// ============================================
// ============================================
// BED MANAGEMENT ROUTES (8 endpoints)
// ============================================
// ============================================

/**
 * Get all beds
 * GET /api/v1/reception/beds
 */
router.get('/beds',
    authenticate,
    authorize('receptionist', 'view_beds'),
    standard,
    auditLogger('RECEPTION_VIEW_BEDS'),
    bedController.getAllBeds
);

/**
 * Get available beds
 * GET /api/v1/reception/beds/available
 * 
 * BUSINESS RULE: [BR-25] Cannot assign occupied bed
 */
router.get('/beds/available',
    authenticate,
    authorize('receptionist', 'view_beds'),
    standard,
    auditLogger('RECEPTION_VIEW_AVAILABLE_BEDS'),
    bedController.getAvailableBeds
);

/**
 * Get beds by ward
 * GET /api/v1/reception/beds/ward/:ward
 */
router.get('/beds/ward/:ward',
    authenticate,
    authorize('receptionist', 'view_beds'),
    standard,
    auditLogger('RECEPTION_VIEW_BEDS_BY_WARD'),
    bedController.getBedsByWard
);

/**
 * Get beds by type
 * GET /api/v1/reception/beds/type/:type
 */
router.get('/beds/type/:type',
    authenticate,
    authorize('receptionist', 'view_beds'),
    standard,
    auditLogger('RECEPTION_VIEW_BEDS_BY_TYPE'),
    bedController.getBedsByType
);

/**
 * Get bed by ID
 * GET /api/v1/reception/beds/:id
 */
router.get('/beds/:id',
    authenticate,
    authorize('receptionist', 'view_beds'),
    standard,
    auditLogger('RECEPTION_VIEW_BED'),
    bedController.getBedById
);

/**
 * Allocate bed to patient
 * POST /api/v1/reception/beds/allocate
 * 
 * BUSINESS RULES:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 */
router.post('/beds/allocate',
    authenticate,
    authorize('receptionist', 'allocate_bed'),
    sensitive,
    validateBedAllocation,
    auditLogger('RECEPTION_ALLOCATE_BED'),
    bedController.allocateBed
);

/**
 * Vacate bed
 * PUT /api/v1/reception/beds/:id/vacate
 * 
 * BUSINESS RULE: [BR-24] Status transition
 */
router.put('/beds/:id/vacate',
    authenticate,
    authorize('receptionist', 'vacate_bed'),
    sensitive,
    auditLogger('RECEPTION_VACATE_BED'),
    bedController.vacateBed
);

/**
 * Get bed occupancy report
 * GET /api/v1/reception/beds/occupancy
 */
router.get('/beds/occupancy',
    authenticate,
    authorize('receptionist', 'view_reports'),
    standard,
    auditLogger('RECEPTION_VIEW_OCCUPANCY'),
    bedController.getOccupancyReport
);

// ============================================
// ============================================
// WALK-IN MANAGEMENT ROUTES (3 endpoints)
// ============================================
// ============================================

/**
 * Register walk-in patient
 * POST /api/v1/reception/walk-in
 */
router.post('/walk-in',
    authenticate,
    authorize('receptionist', 'register_walkin'),
    sensitive,
    validateWalkinRegistration,
    auditLogger('RECEPTION_REGISTER_WALKIN'),
    walkinController.registerWalkin
);

/**
 * Create appointment for walk-in
 * POST /api/v1/reception/walk-in/appointment
 */
router.post('/walk-in/appointment',
    authenticate,
    authorize('receptionist', 'create_appointment'),
    sensitive,
    validateAppointmentBooking,
    auditLogger('RECEPTION_WALKIN_APPOINTMENT'),
    walkinController.createWalkinAppointment
);

/**
 * Get walk-in queue
 * GET /api/v1/reception/walk-in/queue
 */
router.get('/walk-in/queue',
    authenticate,
    authorize('receptionist', 'view_walkin'),
    standard,
    auditLogger('RECEPTION_VIEW_WALKIN_QUEUE'),
    walkinController.getWalkinQueue
);

// ============================================
// ============================================
// OPD REGISTRATION ROUTES (3 endpoints)
// ============================================
// ============================================

/**
 * Generate OPD token
 * GET /api/v1/reception/opd/token
 */
router.get('/opd/token',
    authenticate,
    authorize('receptionist', 'generate_token'),
    standard,
    auditLogger('RECEPTION_GENERATE_TOKEN'),
    opdController.generateToken
);

/**
 * Get OPD queue
 * GET /api/v1/reception/opd/queue
 */
router.get('/opd/queue',
    authenticate,
    authorize('receptionist', 'view_opd'),
    standard,
    auditLogger('RECEPTION_VIEW_OPD_QUEUE'),
    opdController.getOPDQueue
);

/**
 * Register for OPD
 * POST /api/v1/reception/opd/register
 */
router.post('/opd/register',
    authenticate,
    authorize('receptionist', 'register_opd'),
    sensitive,
    validateOPDRegistration,
    auditLogger('RECEPTION_REGISTER_OPD'),
    opdController.registerOPD
);

// ============================================
// ============================================
// DASHBOARD ROUTES (4 endpoints)
// ============================================
// ============================================

/**
 * Get main dashboard
 * GET /api/v1/reception/dashboard
 */
router.get('/dashboard',
    authenticate,
    authorize('receptionist', 'view_dashboard'),
    standard,
    auditLogger('RECEPTION_VIEW_DASHBOARD'),
    dashboardController.getDashboard
);

/**
 * Get today's appointments summary
 * GET /api/v1/reception/dashboard/today
 */
router.get('/dashboard/today',
    authenticate,
    authorize('receptionist', 'view_dashboard'),
    standard,
    auditLogger('RECEPTION_VIEW_TODAY_SUMMARY'),
    dashboardController.getTodaySummary
);

/**
 * Get bed availability summary
 * GET /api/v1/reception/dashboard/beds
 */
router.get('/dashboard/beds',
    authenticate,
    authorize('receptionist', 'view_dashboard'),
    standard,
    auditLogger('RECEPTION_VIEW_BED_SUMMARY'),
    dashboardController.getBedSummary
);

/**
 * Get patient statistics
 * GET /api/v1/reception/dashboard/patients
 */
router.get('/dashboard/patients',
    authenticate,
    authorize('receptionist', 'view_dashboard'),
    standard,
    auditLogger('RECEPTION_VIEW_PATIENT_STATS'),
    dashboardController.getPatientStats
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.1 - Remains protected with authentication

/**
 * Health check for receptionist module
 * GET /api/v1/reception/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('receptionist'),
    (req, res) => {
        res.json({
            success: true,
            message: 'Receptionist module is healthy',
            timestamp: new Date().toISOString(),
            receptionistId: req.user.id,  // Now guaranteed to exist due to authenticate middleware
            endpoints: {
                total: 41,
                root: 1,
                registration: 9,
                appointments: 13,
                beds: 8,
                walkin: 3,
                opd: 3,
                dashboard: 4
            }
        });
    }
);

module.exports = router;

/**
 * ======================================================================
 * ROUTE SUMMARY:
 * ======================================================================
 * 
 * Category           | Count | Business Rules | Authentication
 * -------------------|-------|----------------|----------------
 * Root               | 1     | Base URL info  | 🔓 Public
 * Patient Registration| 9     | [BR-01][BR-02][BR-03][BR-04] | 🔒 Protected
 * Appointments       | 13    | [BR-07][BR-08][BR-09][BR-10] | 🔒 Protected
 * Bed Management     | 8     | [BR-24][BR-25] | 🔒 Protected
 * Walk-in Management | 3     | Guest registration | 🔒 Protected
 * OPD Registration   | 3     | Token & queue  | 🔒 Protected
 * Dashboard          | 4     | Overview       | 🔒 Protected
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 42    | Complete Receptionist Module
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All data endpoints: Require valid authentication
 * 
 * ======================================================================
 */