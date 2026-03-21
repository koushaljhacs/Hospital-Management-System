/**
 * ======================================================================
 * FILE: backend/src/routes/v1/radiologistRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist module routes - All radiologist-facing endpoints.
 * Total Endpoints: 30 (including root endpoint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-20
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all radiologist endpoints
 * 
 * BUSINESS RULES COVERED:
 * - [BR-41] Critical findings require immediate notification
 * - [BR-42] Reports need verification before finalization
 * - [BR-43] Images must be reviewed within 24 hours
 * - [BR-44] Comparison with previous studies required
 * - [BR-45] Radiation dose must be documented
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
const orderController = require('../../controllers/radiologist/orderController');
const imageController = require('../../controllers/radiologist/imageController');
const reportController = require('../../controllers/radiologist/reportController');
const equipmentController = require('../../controllers/radiologist/equipmentController');
const dashboardController = require('../../controllers/radiologist/dashboardController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateOrderStatus,
    validateImageUpload,
    validateImageAnnotation,
    validateReport,
    validateReportStatus,
    validateEquipmentStatus,
    validatePagination,
    validateDateRange
} = require('../../validators/radiologistValidators');

// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// v1.0.0 - Added public root endpoint

/**
 * Public root endpoint for radiologist module
 * GET /api/v1/radiology
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Radiologist API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/radiology/health',
        authentication: 'Bearer token required for all data endpoints',
        available: {
            health: '/api/v1/radiology/health'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ============================================
// RADIOLOGY ORDERS ROUTES (7 endpoints)
// ============================================
// ============================================

/**
 * Get all radiology orders
 * GET /api/v1/radiology/orders
 */
router.get('/orders',
    authenticate,
    authorize('radiologist'),
    standard,
    validatePagination,
    auditLogger('RADIOLOGY_VIEW_ORDERS'),
    orderController.getAllOrders
);

/**
 * Get pending radiology orders
 * GET /api/v1/radiology/orders/pending
 */
router.get('/orders/pending',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_PENDING_ORDERS'),
    orderController.getPendingOrders
);

/**
 * Get completed radiology orders
 * GET /api/v1/radiology/orders/completed
 */
router.get('/orders/completed',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_COMPLETED_ORDERS'),
    orderController.getCompletedOrders
);

/**
 * Get urgent radiology orders
 * GET /api/v1/radiology/orders/urgent
 * 
 * BUSINESS RULE: [BR-41] Critical findings require immediate notification
 */
router.get('/orders/urgent',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_URGENT_ORDERS'),
    orderController.getUrgentOrders
);

/**
 * Get radiology order by ID
 * GET /api/v1/radiology/orders/:id
 */
router.get('/orders/:id',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_ORDER'),
    orderController.getOrderById
);

/**
 * Start processing radiology order
 * PUT /api/v1/radiology/orders/:id/start
 */
router.put('/orders/:id/start',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateOrderStatus,
    auditLogger('RADIOLOGY_START_ORDER'),
    orderController.startOrder
);

/**
 * Complete radiology order
 * PUT /api/v1/radiology/orders/:id/complete
 */
router.put('/orders/:id/complete',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateOrderStatus,
    auditLogger('RADIOLOGY_COMPLETE_ORDER'),
    orderController.completeOrder
);

// ============================================
// ============================================
// IMAGE MANAGEMENT ROUTES (10 endpoints)
// ============================================
// ============================================

/**
 * Get all radiology images
 * GET /api/v1/radiology/images
 */
router.get('/images',
    authenticate,
    authorize('radiologist'),
    standard,
    validatePagination,
    auditLogger('RADIOLOGY_VIEW_IMAGES'),
    imageController.getAllImages
);

/**
 * Get pending images
 * GET /api/v1/radiology/images/pending
 * 
 * BUSINESS RULE: [BR-43] Images must be reviewed within 24 hours
 */
router.get('/images/pending',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_PENDING_IMAGES'),
    imageController.getPendingImages
);

/**
 * Get reported images
 * GET /api/v1/radiology/images/reported
 */
router.get('/images/reported',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_REPORTED_IMAGES'),
    imageController.getReportedImages
);

/**
 * Get image by ID
 * GET /api/v1/radiology/images/:id
 */
router.get('/images/:id',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_IMAGE'),
    imageController.getImageById
);

/**
 * Upload image
 * POST /api/v1/radiology/images/upload
 */
router.post('/images/upload',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateImageUpload,
    auditLogger('RADIOLOGY_UPLOAD_IMAGE'),
    imageController.uploadImage
);

/**
 * Delete image
 * DELETE /api/v1/radiology/images/:id
 */
router.delete('/images/:id',
    authenticate,
    authorize('radiologist'),
    sensitive,
    auditLogger('RADIOLOGY_DELETE_IMAGE'),
    imageController.deleteImage
);

/**
 * Download image
 * GET /api/v1/radiology/images/:id/download
 */
router.get('/images/:id/download',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_DOWNLOAD_IMAGE'),
    imageController.downloadImage
);

/**
 * View image (DICOM viewer)
 * GET /api/v1/radiology/images/:id/view
 */
router.get('/images/:id/view',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_DICOM'),
    imageController.viewImage
);

/**
 * Rotate image
 * PUT /api/v1/radiology/images/:id/rotate
 */
router.put('/images/:id/rotate',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateImageAnnotation,
    auditLogger('RADIOLOGY_ROTATE_IMAGE'),
    imageController.rotateImage
);

/**
 * Annotate image
 * PUT /api/v1/radiology/images/:id/annotate
 */
router.put('/images/:id/annotate',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateImageAnnotation,
    auditLogger('RADIOLOGY_ANNOTATE_IMAGE'),
    imageController.annotateImage
);

// ============================================
// ============================================
// REPORTING ROUTES (9 endpoints)
// ============================================
// ============================================

/**
 * Get all radiology reports
 * GET /api/v1/radiology/reports
 */
router.get('/reports',
    authenticate,
    authorize('radiologist'),
    standard,
    validatePagination,
    auditLogger('RADIOLOGY_VIEW_REPORTS'),
    reportController.getAllReports
);

/**
 * Get pending reports
 * GET /api/v1/radiology/reports/pending
 */
router.get('/reports/pending',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_PENDING_REPORTS'),
    reportController.getPendingReports
);

/**
 * Get completed reports
 * GET /api/v1/radiology/reports/completed
 */
router.get('/reports/completed',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_COMPLETED_REPORTS'),
    reportController.getCompletedReports
);

/**
 * Get report by ID
 * GET /api/v1/radiology/reports/:id
 */
router.get('/reports/:id',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_REPORT'),
    reportController.getReportById
);

/**
 * Create report
 * POST /api/v1/radiology/reports
 * 
 * BUSINESS RULE: [BR-44] Comparison with previous studies required
 */
router.post('/reports',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateReport,
    auditLogger('RADIOLOGY_CREATE_REPORT'),
    reportController.createReport
);

/**
 * Update report
 * PUT /api/v1/radiology/reports/:id
 */
router.put('/reports/:id',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateReport,
    auditLogger('RADIOLOGY_UPDATE_REPORT'),
    reportController.updateReport
);

/**
 * Delete report (if draft)
 * DELETE /api/v1/radiology/reports/:id
 */
router.delete('/reports/:id',
    authenticate,
    authorize('radiologist'),
    sensitive,
    auditLogger('RADIOLOGY_DELETE_REPORT'),
    reportController.deleteReport
);

/**
 * Submit report for review
 * PUT /api/v1/radiology/reports/:id/submit
 */
router.put('/reports/:id/submit',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateReportStatus,
    auditLogger('RADIOLOGY_SUBMIT_REPORT'),
    reportController.submitReport
);

/**
 * Verify report
 * PUT /api/v1/radiology/reports/:id/verify
 * 
 * BUSINESS RULE: [BR-42] Reports need verification before finalization
 */
router.put('/reports/:id/verify',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateReportStatus,
    auditLogger('RADIOLOGY_VERIFY_REPORT'),
    reportController.verifyReport
);

/**
 * Download report as PDF
 * GET /api/v1/radiology/reports/:id/pdf
 */
router.get('/reports/:id/pdf',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_DOWNLOAD_PDF'),
    reportController.downloadPdf
);

// ============================================
// ============================================
// EQUIPMENT ROUTES (2 endpoints)
// ============================================
// ============================================

/**
 * Get all radiology equipment
 * GET /api/v1/radiology/equipment
 */
router.get('/equipment',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_EQUIPMENT'),
    equipmentController.getAllEquipment
);

/**
 * Update equipment status
 * PUT /api/v1/radiology/equipment/:id/status
 */
router.put('/equipment/:id/status',
    authenticate,
    authorize('radiologist'),
    sensitive,
    validateEquipmentStatus,
    auditLogger('RADIOLOGY_UPDATE_EQUIPMENT_STATUS'),
    equipmentController.updateEquipmentStatus
);

// ============================================
// ============================================
// DASHBOARD ROUTES (1 endpoint)
// ============================================
// ============================================

/**
 * Get radiologist dashboard
 * GET /api/v1/radiology/dashboard
 */
router.get('/dashboard',
    authenticate,
    authorize('radiologist'),
    standard,
    auditLogger('RADIOLOGY_VIEW_DASHBOARD'),
    dashboardController.getDashboard
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.0 - Protected with authentication

/**
 * Health check for radiologist module
 * GET /api/v1/radiology/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('radiologist'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Radiologist API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            radiologistId: req.user.id,
            endpoints: {
                total: 30,
                root: 1,
                orders: 7,
                images: 10,
                reports: 9,
                equipment: 2,
                dashboard: 1,
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
 * Radiology Orders   | 7     | [BR-41]        | 🔒 Protected
 * Image Management   | 10    | [BR-43]        | 🔒 Protected
 * Reporting          | 9     | [BR-42][BR-44] | 🔒 Protected
 * Equipment          | 2     | Equipment mgmt | 🔒 Protected
 * Dashboard          | 1     | Overview       | 🔒 Protected
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 31    | Complete Radiologist Module
 * 
 * RBAC PERMISSIONS USED:
 * - view_orders, view_order, start_order, complete_order
 * - view_images, view_image, upload_image, delete_image
 * - download_image, view_dicom, rotate_image, annotate_image
 * - view_reports, view_report, create_report, update_report
 * - delete_report, submit_report, verify_report, download_pdf
 * - view_equipment, update_equipment_status
 * - view_dashboard
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All data endpoints: Require valid authentication
 * 
 * ======================================================================
 */