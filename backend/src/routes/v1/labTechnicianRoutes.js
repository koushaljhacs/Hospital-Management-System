/**
 * ======================================================================
 * FILE: backend/src/routes/v1/labTechnicianRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician module routes - All lab technician-facing endpoints.
 * Total Endpoints: 47 (including root endpoint)
 * 
 * VERSION: 1.0.3
 * CREATED: 2026-03-16
 * UPDATED: 2026-03-19
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * v1.0.1 - Fixed authorize middleware calls (removed extra permission arguments)
 * v1.0.2 - HYBRID APPROACH: Added public root endpoint (no auth)
 *          Health endpoint remains protected with authentication
 *          All other endpoints remain protected
 *          Fixed authenticate import destructuring
 *          Updated health endpoint to use guaranteed user.id
 * v1.0.3 - ENHANCED: Added module name and version to health endpoint
 *          Consistent with other modules for better API discovery
 * 
 * BUSINESS RULES COVERED:
 * - [BR-36] Critical values require immediate notification
 * - [BR-37] Test results need verification
 * - [BR-38] Abnormal results flagged automatically
 * - [BR-39] Sample collection to result < 24 hours
 * - [BR-40] Duplicate test not allowed within 7 days
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
const orderController = require('../../controllers/labTechnician/orderController');
const resultController = require('../../controllers/labTechnician/resultController');
const specimenController = require('../../controllers/labTechnician/specimenController');
const equipmentController = require('../../controllers/labTechnician/equipmentController');
const qcController = require('../../controllers/labTechnician/qcController');
const dashboardController = require('../../controllers/labTechnician/dashboardController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateOrderStatus,
    validateTestResult,
    validateSpecimen,
    validateEquipmentStatus,
    validateQualityControl,
    validatePagination,
    validateDateRange
} = require('../../validators/labTechnicianValidators');

// ============================================
// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// ============================================
// v1.0.2 - Added public root endpoint

/**
 * Public root endpoint for lab technician module
 * GET /api/v1/lab
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Lab Technician API',
        version: '1.0.3',
        status: 'operational',
        documentation: '/api/v1/lab/health',
        authentication: 'Bearer token required for all data endpoints',
        available: {
            health: '/api/v1/lab/health'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ============================================
// TEST ORDERS ROUTES (11 endpoints)
// ============================================
// ============================================

/**
 * Get all test orders
 * GET /api/v1/lab/orders
 */
router.get('/orders',
    authenticate,
    authorize('lab_technician'),
    standard,
    validatePagination,
    auditLogger('LAB_VIEW_ORDERS'),
    orderController.getAllOrders
);

/**
 * Get pending test orders
 * GET /api/v1/lab/orders/pending
 */
router.get('/orders/pending',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_PENDING_ORDERS'),
    orderController.getPendingOrders
);

/**
 * Get in-progress test orders
 * GET /api/v1/lab/orders/in-progress
 */
router.get('/orders/in-progress',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_IN_PROGRESS_ORDERS'),
    orderController.getInProgressOrders
);

/**
 * Get completed test orders
 * GET /api/v1/lab/orders/completed
 */
router.get('/orders/completed',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_COMPLETED_ORDERS'),
    orderController.getCompletedOrders
);

/**
 * Get urgent test orders
 * GET /api/v1/lab/orders/urgent
 * 
 * BUSINESS RULE: [BR-36] Critical values require immediate notification
 */
router.get('/orders/urgent',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_URGENT_ORDERS'),
    orderController.getUrgentOrders
);

/**
 * Get STAT test orders (emergency)
 * GET /api/v1/lab/orders/stat
 */
router.get('/orders/stat',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_STAT_ORDERS'),
    orderController.getStatOrders
);

/**
 * Get test order by ID
 * GET /api/v1/lab/orders/:id
 */
router.get('/orders/:id',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_ORDER'),
    orderController.getOrderById
);

/**
 * Get tests in an order
 * GET /api/v1/lab/orders/:id/tests
 */
router.get('/orders/:id/tests',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_ORDER_TESTS'),
    orderController.getOrderTests
);

/**
 * Collect sample for order
 * PUT /api/v1/lab/orders/:id/collect
 */
router.put('/orders/:id/collect',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateOrderStatus,
    auditLogger('LAB_COLLECT_SAMPLE'),
    orderController.collectSample
);

/**
 * Receive sample in lab
 * PUT /api/v1/lab/orders/:id/receive
 */
router.put('/orders/:id/receive',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateOrderStatus,
    auditLogger('LAB_RECEIVE_SAMPLE'),
    orderController.receiveSample
);

/**
 * Start processing test
 * PUT /api/v1/lab/orders/:id/start
 */
router.put('/orders/:id/start',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateOrderStatus,
    auditLogger('LAB_START_PROCESSING'),
    orderController.startProcessing
);

/**
 * Complete test processing
 * PUT /api/v1/lab/orders/:id/complete
 */
router.put('/orders/:id/complete',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateOrderStatus,
    auditLogger('LAB_COMPLETE_PROCESSING'),
    orderController.completeProcessing
);

// ============================================
// ============================================
// TEST RESULTS ROUTES (11 endpoints)
// ============================================
// ============================================

/**
 * Get all test results
 * GET /api/v1/lab/results
 */
router.get('/results',
    authenticate,
    authorize('lab_technician'),
    standard,
    validatePagination,
    auditLogger('LAB_VIEW_RESULTS'),
    resultController.getAllResults
);

/**
 * Get pending test results
 * GET /api/v1/lab/results/pending
 */
router.get('/results/pending',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_PENDING_RESULTS'),
    resultController.getPendingResults
);

/**
 * Get completed test results
 * GET /api/v1/lab/results/completed
 */
router.get('/results/completed',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_COMPLETED_RESULTS'),
    resultController.getCompletedResults
);

/**
 * Get abnormal test results
 * GET /api/v1/lab/results/abnormal
 * 
 * BUSINESS RULE: [BR-38] Abnormal results flagged automatically
 */
router.get('/results/abnormal',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_ABNORMAL_RESULTS'),
    resultController.getAbnormalResults
);

/**
 * Get critical test results
 * GET /api/v1/lab/results/critical
 * 
 * BUSINESS RULE: [BR-36] Critical values require immediate notification
 */
router.get('/results/critical',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_CRITICAL_RESULTS'),
    resultController.getCriticalResults
);

/**
 * Get test result by ID
 * GET /api/v1/lab/results/:id
 */
router.get('/results/:id',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_RESULT'),
    resultController.getResultById
);

/**
 * Enter test result
 * POST /api/v1/lab/results
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values notification
 * - [BR-38] Abnormal results flagging
 */
router.post('/results',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateTestResult,
    auditLogger('LAB_ENTER_RESULT'),
    resultController.enterResult
);

/**
 * Update test result
 * PUT /api/v1/lab/results/:id
 */
router.put('/results/:id',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateTestResult,
    auditLogger('LAB_UPDATE_RESULT'),
    resultController.updateResult
);

/**
 * Delete test result (if not verified)
 * DELETE /api/v1/lab/results/:id
 */
router.delete('/results/:id',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    auditLogger('LAB_DELETE_RESULT'),
    resultController.deleteResult
);

/**
 * Verify test result
 * PUT /api/v1/lab/results/:id/verify
 * 
 * BUSINESS RULE: [BR-37] Test results need verification
 */
router.put('/results/:id/verify',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    auditLogger('LAB_VERIFY_RESULT'),
    resultController.verifyResult
);

/**
 * Approve test result (supervisor)
 * PUT /api/v1/lab/results/:id/approve
 */
router.put('/results/:id/approve',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    auditLogger('LAB_APPROVE_RESULT'),
    resultController.approveResult
);

/**
 * Generate test report
 * POST /api/v1/lab/results/:id/report
 */
router.post('/results/:id/report',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_GENERATE_REPORT'),
    resultController.generateReport
);

// ============================================
// ============================================
// SPECIMENS ROUTES (11 endpoints)
// ============================================
// ============================================

/**
 * Get all specimens
 * GET /api/v1/lab/specimens
 */
router.get('/specimens',
    authenticate,
    authorize('lab_technician'),
    standard,
    validatePagination,
    auditLogger('LAB_VIEW_SPECIMENS'),
    specimenController.getAllSpecimens
);

/**
 * Get collected specimens
 * GET /api/v1/lab/specimens/collected
 */
router.get('/specimens/collected',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_COLLECTED_SPECIMENS'),
    specimenController.getCollectedSpecimens
);

/**
 * Get received specimens
 * GET /api/v1/lab/specimens/received
 */
router.get('/specimens/received',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_RECEIVED_SPECIMENS'),
    specimenController.getReceivedSpecimens
);

/**
 * Get processed specimens
 * GET /api/v1/lab/specimens/processed
 */
router.get('/specimens/processed',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_PROCESSED_SPECIMENS'),
    specimenController.getProcessedSpecimens
);

/**
 * Get rejected specimens
 * GET /api/v1/lab/specimens/rejected
 */
router.get('/specimens/rejected',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_REJECTED_SPECIMENS'),
    specimenController.getRejectedSpecimens
);

/**
 * Get specimen by ID
 * GET /api/v1/lab/specimens/:id
 */
router.get('/specimens/:id',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_SPECIMEN'),
    specimenController.getSpecimenById
);

/**
 * Register new specimen
 * POST /api/v1/lab/specimens
 */
router.post('/specimens',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateSpecimen,
    auditLogger('LAB_REGISTER_SPECIMEN'),
    specimenController.registerSpecimen
);

/**
 * Update specimen
 * PUT /api/v1/lab/specimens/:id
 */
router.put('/specimens/:id',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateSpecimen,
    auditLogger('LAB_UPDATE_SPECIMEN'),
    specimenController.updateSpecimen
);

/**
 * Update specimen condition
 * PUT /api/v1/lab/specimens/:id/condition
 */
router.put('/specimens/:id/condition',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    auditLogger('LAB_UPDATE_SPECIMEN_CONDITION'),
    specimenController.updateSpecimenCondition
);

/**
 * Reject specimen
 * PUT /api/v1/lab/specimens/:id/reject
 */
router.put('/specimens/:id/reject',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    auditLogger('LAB_REJECT_SPECIMEN'),
    specimenController.rejectSpecimen
);

/**
 * Dispose specimen
 * PUT /api/v1/lab/specimens/:id/dispose
 */
router.put('/specimens/:id/dispose',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    auditLogger('LAB_DISPOSE_SPECIMEN'),
    specimenController.disposeSpecimen
);

/**
 * Track specimen location
 * GET /api/v1/lab/specimens/tracking
 */
router.get('/specimens/tracking',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_TRACK_SPECIMENS'),
    specimenController.trackSpecimens
);

// ============================================
// ============================================
// EQUIPMENT ROUTES (5 endpoints)
// ============================================
// ============================================

/**
 * Get all equipment
 * GET /api/v1/lab/equipment
 */
router.get('/equipment',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_EQUIPMENT'),
    equipmentController.getAllEquipment
);

/**
 * Get operational equipment
 * GET /api/v1/lab/equipment/operational
 */
router.get('/equipment/operational',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_OPERATIONAL_EQUIPMENT'),
    equipmentController.getOperationalEquipment
);

/**
 * Get maintenance equipment
 * GET /api/v1/lab/equipment/maintenance
 */
router.get('/equipment/maintenance',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_MAINTENANCE_EQUIPMENT'),
    equipmentController.getMaintenanceEquipment
);

/**
 * Get calibration due equipment
 * GET /api/v1/lab/equipment/calibration
 */
router.get('/equipment/calibration',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_CALIBRATION_DUE'),
    equipmentController.getCalibrationDueEquipment
);

/**
 * Get equipment by ID
 * GET /api/v1/lab/equipment/:id
 */
router.get('/equipment/:id',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_EQUIPMENT_DETAIL'),
    equipmentController.getEquipmentById
);

/**
 * Log equipment calibration
 * POST /api/v1/lab/equipment/calibration
 */
router.post('/equipment/calibration',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateEquipmentStatus,
    auditLogger('LAB_LOG_CALIBRATION'),
    equipmentController.logCalibration
);

/**
 * Get equipment usage stats
 * GET /api/v1/lab/equipment/usage
 */
router.get('/equipment/usage',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_EQUIPMENT_USAGE'),
    equipmentController.getEquipmentUsage
);

// ============================================
// ============================================
// QUALITY CONTROL ROUTES (4 endpoints)
// ============================================
// ============================================

/**
 * Get quality control records
 * GET /api/v1/lab/qc
 */
router.get('/qc',
    authenticate,
    authorize('lab_technician'),
    standard,
    validatePagination,
    auditLogger('LAB_VIEW_QC'),
    qcController.getAllQCRecords
);

/**
 * Add quality control record
 * POST /api/v1/lab/qc
 */
router.post('/qc',
    authenticate,
    authorize('lab_technician'),
    sensitive,
    validateQualityControl,
    auditLogger('LAB_ADD_QC'),
    qcController.addQCRecord
);

/**
 * Get quality control by ID
 * GET /api/v1/lab/qc/:id
 */
router.get('/qc/:id',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_QC_DETAIL'),
    qcController.getQCRecordById
);

/**
 * Get quality control statistics
 * GET /api/v1/lab/qc/stats
 */
router.get('/qc/stats',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_QC_STATS'),
    qcController.getQCStatistics
);

// ============================================
// ============================================
// DASHBOARD ROUTES (4 endpoints)
// ============================================
// ============================================

/**
 * Get main dashboard
 * GET /api/v1/lab/dashboard
 */
router.get('/dashboard',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_DASHBOARD'),
    dashboardController.getDashboard
);

/**
 * Get pending tests count
 * GET /api/v1/lab/dashboard/pending
 */
router.get('/dashboard/pending',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_PENDING_COUNT'),
    dashboardController.getPendingCount
);

/**
 * Get critical values alerts
 * GET /api/v1/lab/dashboard/critical
 * 
 * BUSINESS RULE: [BR-36] Critical values require immediate notification
 */
router.get('/dashboard/critical',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_CRITICAL_ALERTS'),
    dashboardController.getCriticalAlerts
);

/**
 * Get equipment status summary
 * GET /api/v1/lab/dashboard/equipment
 */
router.get('/dashboard/equipment',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('LAB_VIEW_EQUIPMENT_STATUS'),
    dashboardController.getEquipmentStatus
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.3 - Added module name and version for consistency

/**
 * Health check for lab technician module
 * GET /api/v1/lab/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('lab_technician'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Lab Technician API',
            version: '1.0.3',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            technicianId: req.user.id,
            endpoints: {
                total: 47,
                root: 1,
                orders: 11,
                results: 11,
                specimens: 11,
                equipment: 5,
                qc: 4,
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
 * Test Orders        | 11    | [BR-36][BR-39][BR-40] | 🔒 Protected
 * Test Results       | 11    | [BR-36][BR-37][BR-38] | 🔒 Protected
 * Specimens          | 11    | Sample tracking | 🔒 Protected
 * Equipment          | 5     | Equipment management | 🔒 Protected
 * Quality Control    | 4     | QC records     | 🔒 Protected
 * Dashboard          | 4     | Overview       | 🔒 Protected
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 48    | Complete Lab Technician Module
 * 
 * RBAC PERMISSIONS USED:
 * - view_orders, view_order, collect_sample, receive_sample, process_test
 * - view_results, view_result, enter_result, update_result, delete_result
 * - verify_result, approve_result, generate_report
 * - view_specimens, view_specimen, register_specimen, update_specimen
 * - reject_specimen, dispose_specimen, track_specimen
 * - view_equipment, calibrate_equipment
 * - view_qc, add_qc
 * - view_dashboard
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All data endpoints: Require valid authentication
 * 
 * ======================================================================
 */