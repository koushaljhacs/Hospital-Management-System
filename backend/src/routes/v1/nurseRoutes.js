/**
 * ======================================================================
 * FILE: backend/src/routes/v1/nurseRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse module routes - All nurse-facing endpoints.
 * Total Endpoints: 50 (as per API blueprint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES COVERED:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * - [BR-26] Cleaning required between patients
 * - [BR-27] Max occupancy time 30 days
 * - [BR-28] ICU beds require special authorization
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();

// ============================================
// IMPORT MIDDLEWARES
// ============================================
const { authenticate, authorize } = require('../../middlewares/auth');
const { standard, sensitive } = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');

// ============================================
// IMPORT CONTROLLERS (will create next)
// ============================================
const patientCareController = require('../../controllers/nurse/patientCareController');
const vitalController = require('../../controllers/nurse/vitalController');
const taskController = require('../../controllers/nurse/taskController');
const medicationController = require('../../controllers/nurse/medicationController');
const bedController = require('../../controllers/nurse/bedController');
const dashboardController = require('../../controllers/nurse/dashboardController');

// ============================================
// IMPORT VALIDATORS (will create next)
// ============================================
const {
    validatePatientSearch,
    validateVitalSigns,
    validateVitalUpdate,
    validateTaskStatus,
    validateTaskAssignment,
    validateMedicationAdmin,
    validateBedStatus,
    validateShiftHandover,
    validatePagination,
    validateDateRange
} = require('../../validators/nurseValidators');

// ============================================
// ============================================
// PATIENT CARE ROUTES (6 endpoints)
// ============================================
// ============================================

/**
 * Get assigned patients (ward-wise)
 * GET /api/v1/nurse/patients
 */
router.get('/patients', 
    authenticate,
    authorize('nurse', 'view_patients'),
    standard,
    validatePagination,
    auditLogger('NURSE_VIEW_PATIENTS'),
    patientCareController.getAssignedPatients
);

/**
 * Search patients
 * GET /api/v1/nurse/patients/search
 */
router.get('/patients/search',
    authenticate,
    authorize('nurse', 'search_patients'),
    standard,
    validatePatientSearch,
    auditLogger('NURSE_SEARCH_PATIENTS'),
    patientCareController.searchPatients
);

/**
 * Get patient by ID
 * GET /api/v1/nurse/patients/:id
 */
router.get('/patients/:id',
    authenticate,
    authorize('nurse', 'view_patient'),
    standard,
    auditLogger('NURSE_VIEW_PATIENT'),
    patientCareController.getPatientById
);

/**
 * Get patient vitals
 * GET /api/v1/nurse/patients/:id/vitals
 */
router.get('/patients/:id/vitals',
    authenticate,
    authorize('nurse', 'view_vitals'),
    standard,
    validatePagination,
    auditLogger('NURSE_VIEW_PATIENT_VITALS'),
    patientCareController.getPatientVitals
);

/**
 * Get patient medications
 * GET /api/v1/nurse/patients/:id/medications
 */
router.get('/patients/:id/medications',
    authenticate,
    authorize('nurse', 'view_medications'),
    standard,
    auditLogger('NURSE_VIEW_PATIENT_MEDICATIONS'),
    patientCareController.getPatientMedications
);

/**
 * Get patient tasks
 * GET /api/v1/nurse/patients/:id/tasks
 */
router.get('/patients/:id/tasks',
    authenticate,
    authorize('nurse', 'view_tasks'),
    standard,
    auditLogger('NURSE_VIEW_PATIENT_TASKS'),
    patientCareController.getPatientTasks
);

// ============================================
// ============================================
// VITAL SIGNS ROUTES (9 endpoints)
// ============================================
// ============================================

/**
 * Get all vitals (paginated)
 * GET /api/v1/nurse/vitals
 */
router.get('/vitals',
    authenticate,
    authorize('nurse', 'view_vitals'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('NURSE_VIEW_ALL_VITALS'),
    vitalController.getAllVitals
);

/**
 * Get recent vitals (ward)
 * GET /api/v1/nurse/vitals/recent
 */
router.get('/vitals/recent',
    authenticate,
    authorize('nurse', 'view_vitals'),
    standard,
    auditLogger('NURSE_VIEW_RECENT_VITALS'),
    vitalController.getRecentVitals
);

/**
 * Get vital by ID
 * GET /api/v1/nurse/vitals/:id
 */
router.get('/vitals/:id',
    authenticate,
    authorize('nurse', 'view_vitals'),
    standard,
    auditLogger('NURSE_VIEW_VITAL'),
    vitalController.getVitalById
);

/**
 * Record vitals (general)
 * POST /api/v1/nurse/vitals
 */
router.post('/vitals',
    authenticate,
    authorize('nurse', 'record_vitals'),
    sensitive,
    validateVitalSigns,
    auditLogger('NURSE_RECORD_VITALS'),
    vitalController.recordVitals
);

/**
 * Record vitals for specific patient
 * POST /api/v1/nurse/patients/:id/vitals
 */
router.post('/patients/:id/vitals',
    authenticate,
    authorize('nurse', 'record_vitals'),
    sensitive,
    validateVitalSigns,
    auditLogger('NURSE_RECORD_PATIENT_VITALS'),
    vitalController.recordPatientVitals
);

/**
 * Update vital record
 * PUT /api/v1/nurse/vitals/:id
 */
router.put('/vitals/:id',
    authenticate,
    authorize('nurse', 'update_vitals'),
    sensitive,
    validateVitalUpdate,
    auditLogger('NURSE_UPDATE_VITAL'),
    vitalController.updateVital
);

/**
 * Delete vital record
 * DELETE /api/v1/nurse/vitals/:id
 */
router.delete('/vitals/:id',
    authenticate,
    authorize('nurse', 'delete_vitals'),
    sensitive,
    auditLogger('NURSE_DELETE_VITAL'),
    vitalController.deleteVital
);

/**
 * Get vitals charts data
 * GET /api/v1/nurse/vitals/charts
 */
router.get('/vitals/charts',
    authenticate,
    authorize('nurse', 'view_vitals'),
    standard,
    validateDateRange,
    auditLogger('NURSE_VIEW_VITAL_CHARTS'),
    vitalController.getVitalsCharts
);

/**
 * Get vitals trends analysis
 * GET /api/v1/nurse/vitals/trends
 */
router.get('/vitals/trends',
    authenticate,
    authorize('nurse', 'view_vitals'),
    standard,
    validateDateRange,
    auditLogger('NURSE_VIEW_VITAL_TRENDS'),
    vitalController.getVitalsTrends
);

// ============================================
// ============================================
// TASKS ROUTES (11 endpoints)
// ============================================
// ============================================

/**
 * Get all tasks
 * GET /api/v1/nurse/tasks
 */
router.get('/tasks',
    authenticate,
    authorize('nurse', 'view_tasks'),
    standard,
    validatePagination,
    auditLogger('NURSE_VIEW_TASKS'),
    taskController.getAllTasks
);

/**
 * Get pending tasks
 * GET /api/v1/nurse/tasks/pending
 */
router.get('/tasks/pending',
    authenticate,
    authorize('nurse', 'view_tasks'),
    standard,
    auditLogger('NURSE_VIEW_PENDING_TASKS'),
    taskController.getPendingTasks
);

/**
 * Get completed tasks
 * GET /api/v1/nurse/tasks/completed
 */
router.get('/tasks/completed',
    authenticate,
    authorize('nurse', 'view_tasks'),
    standard,
    auditLogger('NURSE_VIEW_COMPLETED_TASKS'),
    taskController.getCompletedTasks
);

/**
 * Get tasks by priority
 * GET /api/v1/nurse/tasks/priority
 */
router.get('/tasks/priority',
    authenticate,
    authorize('nurse', 'view_tasks'),
    standard,
    auditLogger('NURSE_VIEW_TASKS_BY_PRIORITY'),
    taskController.getTasksByPriority
);

/**
 * Get task by ID
 * GET /api/v1/nurse/tasks/:id
 */
router.get('/tasks/:id',
    authenticate,
    authorize('nurse', 'view_tasks'),
    standard,
    auditLogger('NURSE_VIEW_TASK'),
    taskController.getTaskById
);

/**
 * Start task
 * PUT /api/v1/nurse/tasks/:id/start
 */
router.put('/tasks/:id/start',
    authenticate,
    authorize('nurse', 'update_task'),
    sensitive,
    validateTaskStatus,
    auditLogger('NURSE_START_TASK'),
    taskController.startTask
);

/**
 * Pause task
 * PUT /api/v1/nurse/tasks/:id/pause
 */
router.put('/tasks/:id/pause',
    authenticate,
    authorize('nurse', 'update_task'),
    sensitive,
    validateTaskStatus,
    auditLogger('NURSE_PAUSE_TASK'),
    taskController.pauseTask
);

/**
 * Complete task
 * PUT /api/v1/nurse/tasks/:id/complete
 */
router.put('/tasks/:id/complete',
    authenticate,
    authorize('nurse', 'update_task'),
    sensitive,
    validateTaskStatus,
    auditLogger('NURSE_COMPLETE_TASK'),
    taskController.completeTask
);

/**
 * Postpone task
 * PUT /api/v1/nurse/tasks/:id/postpone
 */
router.put('/tasks/:id/postpone',
    authenticate,
    authorize('nurse', 'update_task'),
    sensitive,
    validateTaskStatus,
    auditLogger('NURSE_POSTPONE_TASK'),
    taskController.postponeTask
);

/**
 * Reassign task
 * PUT /api/v1/nurse/tasks/:id/reassign
 */
router.put('/tasks/:id/reassign',
    authenticate,
    authorize('nurse', 'assign_task'),
    sensitive,
    validateTaskAssignment,
    auditLogger('NURSE_REASSIGN_TASK'),
    taskController.reassignTask
);

/**
 * Get task statistics
 * GET /api/v1/nurse/tasks/stats
 */
router.get('/tasks/stats',
    authenticate,
    authorize('nurse', 'view_stats'),
    standard,
    auditLogger('NURSE_VIEW_TASK_STATS'),
    taskController.getTaskStats
);

// ============================================
// ============================================
// MEDICATIONS ROUTES (7 endpoints)
// ============================================
// ============================================

/**
 * Get medication schedules
 * GET /api/v1/nurse/medications
 */
router.get('/medications',
    authenticate,
    authorize('nurse', 'view_medications'),
    standard,
    validatePagination,
    auditLogger('NURSE_VIEW_MEDICATIONS'),
    medicationController.getMedications
);

/**
 * Get today's medication schedules
 * GET /api/v1/nurse/medications/today
 */
router.get('/medications/today',
    authenticate,
    authorize('nurse', 'view_medications'),
    standard,
    auditLogger('NURSE_VIEW_TODAY_MEDICATIONS'),
    medicationController.getTodayMedications
);

/**
 * Get due medications
 * GET /api/v1/nurse/medications/due
 */
router.get('/medications/due',
    authenticate,
    authorize('nurse', 'view_medications'),
    standard,
    auditLogger('NURSE_VIEW_DUE_MEDICATIONS'),
    medicationController.getDueMedications
);

/**
 * Get medication schedule by ID
 * GET /api/v1/nurse/medications/:id
 */
router.get('/medications/:id',
    authenticate,
    authorize('nurse', 'view_medications'),
    standard,
    auditLogger('NURSE_VIEW_MEDICATION'),
    medicationController.getMedicationById
);

/**
 * Administer medication
 * PUT /api/v1/nurse/medications/:id/administer
 */
router.put('/medications/:id/administer',
    authenticate,
    authorize('nurse', 'administer_medication'),
    sensitive,
    validateMedicationAdmin,
    auditLogger('NURSE_ADMINISTER_MEDICATION'),
    medicationController.administerMedication
);

/**
 * Skip medication
 * PUT /api/v1/nurse/medications/:id/skip
 */
router.put('/medications/:id/skip',
    authenticate,
    authorize('nurse', 'skip_medication'),
    sensitive,
    auditLogger('NURSE_SKIP_MEDICATION'),
    medicationController.skipMedication
);

/**
 * Get medication administration history
 * GET /api/v1/nurse/medications/history
 */
router.get('/medications/history',
    authenticate,
    authorize('nurse', 'view_medications'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('NURSE_VIEW_MEDICATION_HISTORY'),
    medicationController.getMedicationHistory
);

// ============================================
// ============================================
// BED MANAGEMENT ROUTES (8 endpoints)
// ============================================
// ============================================

/**
 * Get all beds (ward)
 * GET /api/v1/nurse/beds
 * 
 * BUSINESS RULE: [BR-24] Bed status workflow
 */
router.get('/beds',
    authenticate,
    authorize('nurse', 'view_beds'),
    standard,
    auditLogger('NURSE_VIEW_BEDS'),
    bedController.getAllBeds
);

/**
 * Get beds by ward
 * GET /api/v1/nurse/beds/ward/:ward
 */
router.get('/beds/ward/:ward',
    authenticate,
    authorize('nurse', 'view_beds'),
    standard,
    auditLogger('NURSE_VIEW_BEDS_BY_WARD'),
    bedController.getBedsByWard
);

/**
 * Get available beds
 * GET /api/v1/nurse/beds/available
 * 
 * BUSINESS RULE: [BR-25] Cannot assign occupied bed
 */
router.get('/beds/available',
    authenticate,
    authorize('nurse', 'view_beds'),
    standard,
    auditLogger('NURSE_VIEW_AVAILABLE_BEDS'),
    bedController.getAvailableBeds
);

/**
 * Get occupied beds
 * GET /api/v1/nurse/beds/occupied
 */
router.get('/beds/occupied',
    authenticate,
    authorize('nurse', 'view_beds'),
    standard,
    auditLogger('NURSE_VIEW_OCCUPIED_BEDS'),
    bedController.getOccupiedBeds
);

/**
 * Get bed by ID
 * GET /api/v1/nurse/beds/:id
 */
router.get('/beds/:id',
    authenticate,
    authorize('nurse', 'view_beds'),
    standard,
    auditLogger('NURSE_VIEW_BED'),
    bedController.getBedById
);

/**
 * Mark bed as clean
 * PUT /api/v1/nurse/beds/:id/clean
 * 
 * BUSINESS RULE: [BR-26] Cleaning required between patients
 */
router.put('/beds/:id/clean',
    authenticate,
    authorize('nurse', 'update_bed'),
    sensitive,
    validateBedStatus,
    auditLogger('NURSE_MARK_BED_CLEAN'),
    bedController.markBedClean
);

/**
 * Request bed maintenance
 * PUT /api/v1/nurse/beds/:id/maintenance
 */
router.put('/beds/:id/maintenance',
    authenticate,
    authorize('nurse', 'update_bed'),
    sensitive,
    validateBedStatus,
    auditLogger('NURSE_REQUEST_MAINTENANCE'),
    bedController.requestMaintenance
);

/**
 * Get cleaning schedule
 * GET /api/v1/nurse/beds/cleaning/schedule
 */
router.get('/beds/cleaning/schedule',
    authenticate,
    authorize('nurse', 'view_beds'),
    standard,
    auditLogger('NURSE_VIEW_CLEANING_SCHEDULE'),
    bedController.getCleaningSchedule
);

// ============================================
// ============================================
// SHIFT & HANDOVER ROUTES (4 endpoints)
// ============================================
// ============================================

/**
 * Get current shift info
 * GET /api/v1/nurse/shift/current
 */
router.get('/shift/current',
    authenticate,
    authorize('nurse', 'view_shift'),
    standard,
    auditLogger('NURSE_VIEW_CURRENT_SHIFT'),
    dashboardController.getCurrentShift
);

/**
 * Get shift schedule
 * GET /api/v1/nurse/shift/schedule
 */
router.get('/shift/schedule',
    authenticate,
    authorize('nurse', 'view_shift'),
    standard,
    auditLogger('NURSE_VIEW_SHIFT_SCHEDULE'),
    dashboardController.getShiftSchedule
);

/**
 * Submit handover notes
 * POST /api/v1/nurse/shift/handover
 */
router.post('/shift/handover',
    authenticate,
    authorize('nurse', 'submit_handover'),
    sensitive,
    validateShiftHandover,
    auditLogger('NURSE_SUBMIT_HANDOVER'),
    dashboardController.submitHandover
);

/**
 * Get handover notes
 * GET /api/v1/nurse/shift/handover
 */
router.get('/shift/handover',
    authenticate,
    authorize('nurse', 'view_handover'),
    standard,
    auditLogger('NURSE_VIEW_HANDOVER'),
    dashboardController.getHandoverNotes
);

// ============================================
// ============================================
// DASHBOARD ROUTES (5 endpoints)
// ============================================
// ============================================

/**
 * Get main dashboard
 * GET /api/v1/nurse/dashboard
 */
router.get('/dashboard',
    authenticate,
    authorize('nurse', 'view_dashboard'),
    standard,
    auditLogger('NURSE_VIEW_DASHBOARD'),
    dashboardController.getDashboard
);

/**
 * Get patient overview
 * GET /api/v1/nurse/dashboard/patients
 */
router.get('/dashboard/patients',
    authenticate,
    authorize('nurse', 'view_dashboard'),
    standard,
    auditLogger('NURSE_VIEW_DASHBOARD_PATIENTS'),
    dashboardController.getPatientOverview
);

/**
 * Get task overview
 * GET /api/v1/nurse/dashboard/tasks
 */
router.get('/dashboard/tasks',
    authenticate,
    authorize('nurse', 'view_dashboard'),
    standard,
    auditLogger('NURSE_VIEW_DASHBOARD_TASKS'),
    dashboardController.getTaskOverview
);

/**
 * Get vital alerts
 * GET /api/v1/nurse/dashboard/vitals
 * 
 * BUSINESS RULE: [BR-36] Critical values require immediate notification
 */
router.get('/dashboard/vitals',
    authenticate,
    authorize('nurse', 'view_dashboard'),
    standard,
    auditLogger('NURSE_VIEW_VITAL_ALERTS'),
    dashboardController.getVitalAlerts
);

/**
 * Get bed occupancy
 * GET /api/v1/nurse/dashboard/beds
 */
router.get('/dashboard/beds',
    authenticate,
    authorize('nurse', 'view_dashboard'),
    standard,
    auditLogger('NURSE_VIEW_BED_OCCUPANCY'),
    dashboardController.getBedOccupancy
);

// ============================================
// ============================================
// HEALTH CHECK
// ============================================
// ============================================

/**
 * Health check for nurse module
 * GET /api/v1/nurse
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Nurse module is healthy',
        timestamp: new Date().toISOString()
    });
});

/**
 * Health check for nurse module
 * GET /api/v1/nurse/health
 */
router.get('/health',
    authenticate,
    authorize('nurse'),
    (req, res) => {
        res.json({
            success: true,
            message: 'Nurse module is healthy',
            timestamp: new Date().toISOString(),
            nurseId: req.user.id,
            endpoints: {
                total: 50,
                patient_care: 6,
                vitals: 9,
                tasks: 11,
                medications: 7,
                beds: 8,
                shift_handover: 4,
                dashboard: 5
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
 * Category          | Count | Business Rules
 * ------------------|-------|----------------------
 * Patient Care      | 6     | Patient access
 * Vital Signs       | 9     | [BR-36] Critical alerts
 * Tasks             | 11    | Task workflow
 * Medications       | 7     | Med administration
 * Bed Management    | 8     | [BR-24][BR-25][BR-26][BR-27][BR-28]
 * Shift & Handover  | 4     | Shift management
 * Dashboard         | 5     | Overview
 * ------------------|-------|----------------------
 * TOTAL             | 50    | Complete Nurse Module
 * 
 * ======================================================================
 */