/**
 * ======================================================================
 * FILE: backend/src/routes/v1/staffRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Ground Staff module routes - All ground staff-facing endpoints.
 * Total Endpoints: 22 (including root endpoint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all ground staff endpoints
 * 
 * BUSINESS RULES COVERED:
 * - [BR-46] Tasks must be acknowledged within 30 minutes
 * - [BR-47] Transport requests require driver assignment
 * - [BR-48] Samples must be delivered within 2 hours of collection
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
const taskController = require('../../controllers/staff/taskController');
const transportController = require('../../controllers/staff/transportController');
const sampleController = require('../../controllers/staff/sampleController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateTaskStatus,
    validateTaskAssignment,
    validateTransportRequest,
    validateTransportStatus,
    validateSample,
    validateSampleStatus,
    validatePagination
} = require('../../validators/staffValidators');

// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// v1.0.0 - Added public root endpoint

/**
 * Public root endpoint for ground staff module
 * GET /api/v1/staff
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Ground Staff API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/staff/health',
        authentication: 'Bearer token required for all data endpoints',
        available: {
            health: '/api/v1/staff/health'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ============================================
// TASK MANAGEMENT ROUTES (11 endpoints)
// ============================================
// ============================================

/**
 * Get all tasks
 * GET /api/v1/staff/tasks
 */
router.get('/tasks',
    authenticate,
    authorize('ground_staff'),
    standard,
    validatePagination,
    auditLogger('STAFF_VIEW_TASKS'),
    taskController.getAllTasks
);

/**
 * Get pending tasks
 * GET /api/v1/staff/tasks/pending
 */
router.get('/tasks/pending',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_PENDING_TASKS'),
    taskController.getPendingTasks
);

/**
 * Get completed tasks
 * GET /api/v1/staff/tasks/completed
 */
router.get('/tasks/completed',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_COMPLETED_TASKS'),
    taskController.getCompletedTasks
);

/**
 * Get today's tasks
 * GET /api/v1/staff/tasks/today
 */
router.get('/tasks/today',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_TODAY_TASKS'),
    taskController.getTodayTasks
);

/**
 * Get tasks by priority
 * GET /api/v1/staff/tasks/priority
 */
router.get('/tasks/priority',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_TASKS_BY_PRIORITY'),
    taskController.getTasksByPriority
);

/**
 * Get task by ID
 * GET /api/v1/staff/tasks/:id
 */
router.get('/tasks/:id',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_TASK'),
    taskController.getTaskById
);

/**
 * Accept task
 * PUT /api/v1/staff/tasks/:id/accept
 * 
 * BUSINESS RULE: [BR-46] Tasks must be acknowledged within 30 minutes
 */
router.put('/tasks/:id/accept',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateTaskStatus,
    auditLogger('STAFF_ACCEPT_TASK'),
    taskController.acceptTask
);

/**
 * Reject task
 * PUT /api/v1/staff/tasks/:id/reject
 */
router.put('/tasks/:id/reject',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateTaskStatus,
    auditLogger('STAFF_REJECT_TASK'),
    taskController.rejectTask
);

/**
 * Start task
 * PUT /api/v1/staff/tasks/:id/start
 */
router.put('/tasks/:id/start',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateTaskStatus,
    auditLogger('STAFF_START_TASK'),
    taskController.startTask
);

/**
 * Complete task
 * PUT /api/v1/staff/tasks/:id/complete
 */
router.put('/tasks/:id/complete',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateTaskStatus,
    auditLogger('STAFF_COMPLETE_TASK'),
    taskController.completeTask
);

/**
 * Postpone task
 * PUT /api/v1/staff/tasks/:id/postpone
 */
router.put('/tasks/:id/postpone',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateTaskStatus,
    auditLogger('STAFF_POSTPONE_TASK'),
    taskController.postponeTask
);

// ============================================
// ============================================
// TRANSPORT REQUESTS ROUTES (7 endpoints)
// ============================================
// ============================================

/**
 * Get all transport requests
 * GET /api/v1/staff/transport
 */
router.get('/transport',
    authenticate,
    authorize('ground_staff'),
    standard,
    validatePagination,
    auditLogger('STAFF_VIEW_TRANSPORT'),
    transportController.getAllRequests
);

/**
 * Get pending transport requests
 * GET /api/v1/staff/transport/pending
 */
router.get('/transport/pending',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_PENDING_TRANSPORT'),
    transportController.getPendingRequests
);

/**
 * Get completed transport requests
 * GET /api/v1/staff/transport/completed
 */
router.get('/transport/completed',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_COMPLETED_TRANSPORT'),
    transportController.getCompletedRequests
);

/**
 * Get transport request by ID
 * GET /api/v1/staff/transport/:id
 */
router.get('/transport/:id',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_TRANSPORT_REQUEST'),
    transportController.getRequestById
);

/**
 * Accept transport request
 * PUT /api/v1/staff/transport/:id/accept
 * 
 * BUSINESS RULE: [BR-47] Transport requests require driver assignment
 */
router.put('/transport/:id/accept',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateTransportStatus,
    auditLogger('STAFF_ACCEPT_TRANSPORT'),
    transportController.acceptRequest
);

/**
 * Start transport
 * PUT /api/v1/staff/transport/:id/start
 */
router.put('/transport/:id/start',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateTransportStatus,
    auditLogger('STAFF_START_TRANSPORT'),
    transportController.startTransport
);

/**
 * Complete transport
 * PUT /api/v1/staff/transport/:id/complete
 */
router.put('/transport/:id/complete',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateTransportStatus,
    auditLogger('STAFF_COMPLETE_TRANSPORT'),
    transportController.completeTransport
);

/**
 * Get transport history
 * GET /api/v1/staff/transport/history
 */
router.get('/transport/history',
    authenticate,
    authorize('ground_staff'),
    standard,
    validatePagination,
    auditLogger('STAFF_VIEW_TRANSPORT_HISTORY'),
    transportController.getTransportHistory
);

// ============================================
// ============================================
// SAMPLE COLLECTION ROUTES (7 endpoints)
// ============================================
// ============================================

/**
 * Get all samples
 * GET /api/v1/staff/samples
 */
router.get('/samples',
    authenticate,
    authorize('ground_staff'),
    standard,
    validatePagination,
    auditLogger('STAFF_VIEW_SAMPLES'),
    sampleController.getAllSamples
);

/**
 * Get pending samples
 * GET /api/v1/staff/samples/pending
 */
router.get('/samples/pending',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_PENDING_SAMPLES'),
    sampleController.getPendingSamples
);

/**
 * Get collected samples
 * GET /api/v1/staff/samples/collected
 */
router.get('/samples/collected',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_COLLECTED_SAMPLES'),
    sampleController.getCollectedSamples
);

/**
 * Get delivered samples
 * GET /api/v1/staff/samples/delivered
 */
router.get('/samples/delivered',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_DELIVERED_SAMPLES'),
    sampleController.getDeliveredSamples
);

/**
 * Get sample by ID
 * GET /api/v1/staff/samples/:id
 */
router.get('/samples/:id',
    authenticate,
    authorize('ground_staff'),
    standard,
    auditLogger('STAFF_VIEW_SAMPLE'),
    sampleController.getSampleById
);

/**
 * Collect sample
 * PUT /api/v1/staff/samples/:id/collect
 * 
 * BUSINESS RULE: [BR-48] Samples must be delivered within 2 hours of collection
 */
router.put('/samples/:id/collect',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateSampleStatus,
    auditLogger('STAFF_COLLECT_SAMPLE'),
    sampleController.collectSample
);

/**
 * Deliver sample
 * PUT /api/v1/staff/samples/:id/deliver
 */
router.put('/samples/:id/deliver',
    authenticate,
    authorize('ground_staff'),
    sensitive,
    validateSampleStatus,
    auditLogger('STAFF_DELIVER_SAMPLE'),
    sampleController.deliverSample
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.0 - Protected with authentication

/**
 * Health check for ground staff module
 * GET /api/v1/staff/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('ground_staff'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Ground Staff API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            staffId: req.user.id,
            endpoints: {
                total: 22,
                root: 1,
                tasks: 11,
                transport: 7,
                samples: 7,
                health: 1
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
 * Task Management    | 11    | [BR-46]        | 🔒 Protected
 * Transport Requests | 7     | [BR-47]        | 🔒 Protected
 * Sample Collection  | 7     | [BR-48]        | 🔒 Protected
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 27    | Complete Ground Staff Module
 * 
 * RBAC PERMISSIONS USED:
 * - view_tasks, accept_task, reject_task, start_task, complete_task, postpone_task
 * - view_transport, accept_transport, start_transport, complete_transport
 * - view_samples, collect_sample, deliver_sample
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All data endpoints: Require valid authentication
 * 
 * ======================================================================
 */