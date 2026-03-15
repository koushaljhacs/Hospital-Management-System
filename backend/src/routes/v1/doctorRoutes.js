/**
 * ======================================================================
 * FILE: backend/src/routes/v1/doctorRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor module routes - All doctor-facing endpoints.
 * Total Endpoints: 75 (as per API blueprint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();

// Import middlewares
const { authenticate, authorize } = require('../../middlewares/auth');
const { createRateLimiter } = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');

// Import controllers (will create next)
const patientController = require('../../controllers/doctor/patientController');
const appointmentController = require('../../controllers/doctor/appointmentController');
const prescriptionController = require('../../controllers/doctor/prescriptionController');
const labController = require('../../controllers/doctor/labController');
const radiologyController = require('../../controllers/doctor/radiologyController');
const dashboardController = require('../../controllers/doctor/dashboardController');

// Import validators (will create next)
const {
    validatePatientSearch,
    validateAppointmentStatus,
    validatePrescription,
    validateLabOrder,
    validateRadiologyOrder,
    validatePagination
} = require('../../validators/doctorValidators');

// ============================================
// RATE LIMITING
// ============================================
const standardLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 100 });
const sensitiveLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

// ============================================
// DOCTOR PATIENT ROUTES
// ============================================
router.get('/patients', 
    authenticate, 
    authorize('doctor', 'view_patients'),
    standardLimiter,
    validatePagination,
    auditLogger('DOCTOR_VIEW_PATIENTS'),
    patientController.getAssignedPatients
);

router.get('/patients/search', 
    authenticate, 
    authorize('doctor', 'search_patients'),
    standardLimiter,
    validatePatientSearch,
    auditLogger('DOCTOR_SEARCH_PATIENTS'),
    patientController.searchPatients
);

router.get('/patients/recent', 
    authenticate, 
    authorize('doctor', 'view_patients'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_RECENT_PATIENTS'),
    patientController.getRecentPatients
);

router.get('/patients/:id', 
    authenticate, 
    authorize('doctor', 'view_patient'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_PATIENT'),
    patientController.getPatientById
);

router.get('/patients/:id/history', 
    authenticate, 
    authorize('doctor', 'view_medical_history'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_PATIENT_HISTORY'),
    patientController.getPatientHistory
);

router.get('/patients/:id/vitals', 
    authenticate, 
    authorize('doctor', 'view_vitals'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_VITALS'),
    patientController.getPatientVitals
);

router.get('/patients/:id/lab-results', 
    authenticate, 
    authorize('doctor', 'view_lab_results'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_LAB_RESULTS'),
    patientController.getPatientLabResults
);

router.get('/patients/:id/radiology', 
    authenticate, 
    authorize('doctor', 'view_radiology'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_RADIOLOGY'),
    patientController.getPatientRadiology
);

router.get('/patients/:id/prescriptions', 
    authenticate, 
    authorize('doctor', 'view_prescriptions'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_PRESCRIPTIONS'),
    patientController.getPatientPrescriptions
);

router.post('/patients/:id/assign', 
    authenticate, 
    authorize('doctor', 'assign_patient'),
    sensitiveLimiter,
    auditLogger('DOCTOR_ASSIGN_PATIENT'),
    patientController.assignPatientToSelf
);

// ============================================
// DOCTOR APPOINTMENT ROUTES
// ============================================
router.get('/appointments', 
    authenticate, 
    authorize('doctor', 'view_appointments'),
    standardLimiter,
    validatePagination,
    auditLogger('DOCTOR_VIEW_APPOINTMENTS'),
    appointmentController.getAppointments
);

router.get('/appointments/today', 
    authenticate, 
    authorize('doctor', 'view_appointments'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_TODAY_APPOINTMENTS'),
    appointmentController.getTodayAppointments
);

router.get('/appointments/upcoming', 
    authenticate, 
    authorize('doctor', 'view_appointments'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_UPCOMING_APPOINTMENTS'),
    appointmentController.getUpcomingAppointments
);

router.get('/appointments/completed', 
    authenticate, 
    authorize('doctor', 'view_appointments'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_COMPLETED_APPOINTMENTS'),
    appointmentController.getCompletedAppointments
);

router.get('/appointments/calendar', 
    authenticate, 
    authorize('doctor', 'view_appointments'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_CALENDAR'),
    appointmentController.getCalendarView
);

router.get('/appointments/:id', 
    authenticate, 
    authorize('doctor', 'view_appointment'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_APPOINTMENT'),
    appointmentController.getAppointmentById
);

router.put('/appointments/:id/start', 
    authenticate, 
    authorize('doctor', 'update_appointment'),
    sensitiveLimiter,
    auditLogger('DOCTOR_START_APPOINTMENT'),
    appointmentController.startAppointment
);

router.put('/appointments/:id/complete', 
    authenticate, 
    authorize('doctor', 'update_appointment'),
    sensitiveLimiter,
    auditLogger('DOCTOR_COMPLETE_APPOINTMENT'),
    appointmentController.completeAppointment
);

router.put('/appointments/:id/no-show', 
    authenticate, 
    authorize('doctor', 'update_appointment'),
    sensitiveLimiter,
    auditLogger('DOCTOR_MARK_NO_SHOW'),
    appointmentController.markNoShow
);

router.put('/appointments/:id/cancel', 
    authenticate, 
    authorize('doctor', 'update_appointment'),
    sensitiveLimiter,
    auditLogger('DOCTOR_CANCEL_APPOINTMENT'),
    appointmentController.cancelAppointment
);

router.get('/appointments/stats', 
    authenticate, 
    authorize('doctor', 'view_stats'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_APPOINTMENT_STATS'),
    appointmentController.getAppointmentStats
);

// ============================================
// DOCTOR PRESCRIPTION ROUTES
// ============================================
router.get('/prescriptions', 
    authenticate, 
    authorize('doctor', 'view_prescriptions'),
    standardLimiter,
    validatePagination,
    auditLogger('DOCTOR_VIEW_PRESCRIPTIONS'),
    prescriptionController.getPrescriptions
);

router.get('/prescriptions/active', 
    authenticate, 
    authorize('doctor', 'view_prescriptions'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_ACTIVE_PRESCRIPTIONS'),
    prescriptionController.getActivePrescriptions
);

router.get('/prescriptions/:id', 
    authenticate, 
    authorize('doctor', 'view_prescription'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_PRESCRIPTION'),
    prescriptionController.getPrescriptionById
);

router.post('/prescriptions', 
    authenticate, 
    authorize('doctor', 'create_prescription'),
    sensitiveLimiter,
    validatePrescription,
    auditLogger('DOCTOR_CREATE_PRESCRIPTION'),
    prescriptionController.createPrescription
);

router.put('/prescriptions/:id', 
    authenticate, 
    authorize('doctor', 'update_prescription'),
    sensitiveLimiter,
    validatePrescription,
    auditLogger('DOCTOR_UPDATE_PRESCRIPTION'),
    prescriptionController.updatePrescription
);

router.delete('/prescriptions/:id', 
    authenticate, 
    authorize('doctor', 'delete_prescription'),
    sensitiveLimiter,
    auditLogger('DOCTOR_DELETE_PRESCRIPTION'),
    prescriptionController.deletePrescription
);

router.post('/prescriptions/:id/medicines', 
    authenticate, 
    authorize('doctor', 'update_prescription'),
    sensitiveLimiter,
    auditLogger('DOCTOR_ADD_MEDICINE'),
    prescriptionController.addMedicine
);

router.put('/prescriptions/:id/medicines/:medId', 
    authenticate, 
    authorize('doctor', 'update_prescription'),
    sensitiveLimiter,
    auditLogger('DOCTOR_UPDATE_MEDICINE'),
    prescriptionController.updateMedicine
);

router.delete('/prescriptions/:id/medicines/:medId', 
    authenticate, 
    authorize('doctor', 'update_prescription'),
    sensitiveLimiter,
    auditLogger('DOCTOR_REMOVE_MEDICINE'),
    prescriptionController.removeMedicine
);

router.get('/prescriptions/templates', 
    authenticate, 
    authorize('doctor', 'view_templates'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_TEMPLATES'),
    prescriptionController.getTemplates
);

router.post('/prescriptions/templates', 
    authenticate, 
    authorize('doctor', 'create_template'),
    sensitiveLimiter,
    auditLogger('DOCTOR_CREATE_TEMPLATE'),
    prescriptionController.createTemplate
);

router.put('/prescriptions/templates/:id', 
    authenticate, 
    authorize('doctor', 'update_template'),
    sensitiveLimiter,
    auditLogger('DOCTOR_UPDATE_TEMPLATE'),
    prescriptionController.updateTemplate
);

router.delete('/prescriptions/templates/:id', 
    authenticate, 
    authorize('doctor', 'delete_template'),
    sensitiveLimiter,
    auditLogger('DOCTOR_DELETE_TEMPLATE'),
    prescriptionController.deleteTemplate
);

// ============================================
// DOCTOR LAB ORDER ROUTES
// ============================================
router.get('/lab-orders', 
    authenticate, 
    authorize('doctor', 'view_lab_orders'),
    standardLimiter,
    validatePagination,
    auditLogger('DOCTOR_VIEW_LAB_ORDERS'),
    labController.getLabOrders
);

router.get('/lab-orders/pending', 
    authenticate, 
    authorize('doctor', 'view_lab_orders'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_PENDING_LAB_ORDERS'),
    labController.getPendingLabOrders
);

router.get('/lab-orders/completed', 
    authenticate, 
    authorize('doctor', 'view_lab_orders'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_COMPLETED_LAB_ORDERS'),
    labController.getCompletedLabOrders
);

router.get('/lab-orders/:id', 
    authenticate, 
    authorize('doctor', 'view_lab_order'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_LAB_ORDER'),
    labController.getLabOrderById
);

router.post('/lab-orders', 
    authenticate, 
    authorize('doctor', 'create_lab_order'),
    sensitiveLimiter,
    validateLabOrder,
    auditLogger('DOCTOR_CREATE_LAB_ORDER'),
    labController.createLabOrder
);

router.put('/lab-orders/:id', 
    authenticate, 
    authorize('doctor', 'update_lab_order'),
    sensitiveLimiter,
    auditLogger('DOCTOR_UPDATE_LAB_ORDER'),
    labController.updateLabOrder
);

router.delete('/lab-orders/:id', 
    authenticate, 
    authorize('doctor', 'delete_lab_order'),
    sensitiveLimiter,
    auditLogger('DOCTOR_DELETE_LAB_ORDER'),
    labController.deleteLabOrder
);

router.get('/lab-orders/:id/results', 
    authenticate, 
    authorize('doctor', 'view_lab_results'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_LAB_RESULTS'),
    labController.getLabResults
);

router.get('/lab-tests', 
    authenticate, 
    authorize('doctor', 'view_lab_tests'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_LAB_TESTS'),
    labController.getAvailableLabTests
);

// ============================================
// DOCTOR RADIOLOGY ORDER ROUTES
// ============================================
router.get('/radiology-orders', 
    authenticate, 
    authorize('doctor', 'view_radiology_orders'),
    standardLimiter,
    validatePagination,
    auditLogger('DOCTOR_VIEW_RADIOLOGY_ORDERS'),
    radiologyController.getRadiologyOrders
);

router.get('/radiology-orders/pending', 
    authenticate, 
    authorize('doctor', 'view_radiology_orders'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_PENDING_RADIOLOGY'),
    radiologyController.getPendingRadiologyOrders
);

router.get('/radiology-orders/completed', 
    authenticate, 
    authorize('doctor', 'view_radiology_orders'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_COMPLETED_RADIOLOGY'),
    radiologyController.getCompletedRadiologyOrders
);

router.get('/radiology-orders/:id', 
    authenticate, 
    authorize('doctor', 'view_radiology_order'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_RADIOLOGY_ORDER'),
    radiologyController.getRadiologyOrderById
);

router.post('/radiology-orders', 
    authenticate, 
    authorize('doctor', 'create_radiology_order'),
    sensitiveLimiter,
    validateRadiologyOrder,
    auditLogger('DOCTOR_CREATE_RADIOLOGY_ORDER'),
    radiologyController.createRadiologyOrder
);

router.put('/radiology-orders/:id', 
    authenticate, 
    authorize('doctor', 'update_radiology_order'),
    sensitiveLimiter,
    auditLogger('DOCTOR_UPDATE_RADIOLOGY_ORDER'),
    radiologyController.updateRadiologyOrder
);

router.delete('/radiology-orders/:id', 
    authenticate, 
    authorize('doctor', 'delete_radiology_order'),
    sensitiveLimiter,
    auditLogger('DOCTOR_DELETE_RADIOLOGY_ORDER'),
    radiologyController.deleteRadiologyOrder
);

router.get('/radiology-orders/:id/images', 
    authenticate, 
    authorize('doctor', 'view_radiology_images'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_RADIOLOGY_IMAGES'),
    radiologyController.getRadiologyImages
);

// ============================================
// DOCTOR DIAGNOSIS & NOTES ROUTES
// ============================================
router.get('/diagnosis', 
    authenticate, 
    authorize('doctor', 'view_diagnosis'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_DIAGNOSIS'),
    prescriptionController.getDiagnosis
);

router.get('/diagnosis/:id', 
    authenticate, 
    authorize('doctor', 'view_diagnosis'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_DIAGNOSIS'),
    prescriptionController.getDiagnosisById
);

router.post('/diagnosis', 
    authenticate, 
    authorize('doctor', 'create_diagnosis'),
    sensitiveLimiter,
    auditLogger('DOCTOR_CREATE_DIAGNOSIS'),
    prescriptionController.createDiagnosis
);

router.put('/diagnosis/:id', 
    authenticate, 
    authorize('doctor', 'update_diagnosis'),
    sensitiveLimiter,
    auditLogger('DOCTOR_UPDATE_DIAGNOSIS'),
    prescriptionController.updateDiagnosis
);

router.delete('/diagnosis/:id', 
    authenticate, 
    authorize('doctor', 'delete_diagnosis'),
    sensitiveLimiter,
    auditLogger('DOCTOR_DELETE_DIAGNOSIS'),
    prescriptionController.deleteDiagnosis
);

router.get('/clinical-notes', 
    authenticate, 
    authorize('doctor', 'view_notes'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_NOTES'),
    prescriptionController.getClinicalNotes
);

router.post('/clinical-notes', 
    authenticate, 
    authorize('doctor', 'create_notes'),
    sensitiveLimiter,
    auditLogger('DOCTOR_CREATE_NOTE'),
    prescriptionController.createClinicalNote
);

router.put('/clinical-notes/:id', 
    authenticate, 
    authorize('doctor', 'update_notes'),
    sensitiveLimiter,
    auditLogger('DOCTOR_UPDATE_NOTE'),
    prescriptionController.updateClinicalNote
);

router.delete('/clinical-notes/:id', 
    authenticate, 
    authorize('doctor', 'delete_notes'),
    sensitiveLimiter,
    auditLogger('DOCTOR_DELETE_NOTE'),
    prescriptionController.deleteClinicalNote
);

// ============================================
// DOCTOR SCHEDULE & AVAILABILITY ROUTES
// ============================================
router.get('/schedule', 
    authenticate, 
    authorize('doctor', 'view_schedule'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_SCHEDULE'),
    appointmentController.getSchedule
);

router.put('/schedule', 
    authenticate, 
    authorize('doctor', 'update_schedule'),
    sensitiveLimiter,
    auditLogger('DOCTOR_UPDATE_SCHEDULE'),
    appointmentController.updateSchedule
);

router.get('/availability', 
    authenticate, 
    authorize('doctor', 'view_availability'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_AVAILABILITY'),
    appointmentController.getAvailability
);

router.put('/availability', 
    authenticate, 
    authorize('doctor', 'update_availability'),
    sensitiveLimiter,
    auditLogger('DOCTOR_UPDATE_AVAILABILITY'),
    appointmentController.updateAvailability
);

router.get('/leave', 
    authenticate, 
    authorize('doctor', 'view_leave'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_LEAVE'),
    appointmentController.getLeaveRequests
);

router.post('/leave', 
    authenticate, 
    authorize('doctor', 'request_leave'),
    sensitiveLimiter,
    auditLogger('DOCTOR_REQUEST_LEAVE'),
    appointmentController.requestLeave
);

router.delete('/leave/:id', 
    authenticate, 
    authorize('doctor', 'cancel_leave'),
    sensitiveLimiter,
    auditLogger('DOCTOR_CANCEL_LEAVE'),
    appointmentController.cancelLeave
);

// ============================================
// DOCTOR DASHBOARD ROUTES
// ============================================
router.get('/dashboard', 
    authenticate, 
    authorize('doctor', 'view_dashboard'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_DASHBOARD'),
    dashboardController.getDashboard
);

router.get('/dashboard/today', 
    authenticate, 
    authorize('doctor', 'view_dashboard'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_TODAY_SCHEDULE'),
    dashboardController.getTodaySchedule
);

router.get('/dashboard/stats', 
    authenticate, 
    authorize('doctor', 'view_stats'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_STATS'),
    dashboardController.getStats
);

router.get('/dashboard/patients', 
    authenticate, 
    authorize('doctor', 'view_stats'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_PATIENT_STATS'),
    dashboardController.getPatientStats
);

router.get('/dashboard/appointments', 
    authenticate, 
    authorize('doctor', 'view_stats'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_APPOINTMENT_STATS'),
    dashboardController.getAppointmentStats
);

router.get('/dashboard/prescriptions', 
    authenticate, 
    authorize('doctor', 'view_stats'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_PRESCRIPTION_STATS'),
    dashboardController.getPrescriptionStats
);

router.get('/dashboard/revenue', 
    authenticate, 
    authorize('doctor', 'view_stats'),
    standardLimiter,
    auditLogger('DOCTOR_VIEW_REVENUE'),
    dashboardController.getRevenueStats
);

// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', 
    authenticate, 
    authorize('doctor'),
    (req, res) => {
        res.json({
            success: true,
            message: 'Doctor module is healthy',
            timestamp: new Date().toISOString(),
            endpoints: {
                total: 75,
                patients: 10,
                appointments: 11,
                prescriptions: 13,
                lab: 9,
                radiology: 7,
                diagnosis: 8,
                schedule: 7,
                dashboard: 7
            }
        });
    }
);

module.exports = router;