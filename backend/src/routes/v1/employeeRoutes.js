/**
 * ======================================================================
 * FILE: backend/src/routes/v1/employeeRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee Common module routes - All employee-facing endpoints.
 * Total Endpoints: 28 (including root endpoint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all employee common endpoints
 * 
 * BUSINESS RULES COVERED:
 * - [BR-53] Shift change requires 24 hours notice
 * - [BR-54] Attendance check-in must be within 15 minutes of shift start
 * - [BR-55] Leave balance cannot go negative
 * - [BR-56] Leave request requires minimum 2 days advance notice
 * - [BR-57] Documents must be verified before access
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
const shiftController = require('../../controllers/employee/shiftController');
const attendanceController = require('../../controllers/employee/attendanceController');
const leaveController = require('../../controllers/employee/leaveController');
const documentController = require('../../controllers/employee/documentController');
const notificationController = require('../../controllers/employee/notificationController');
const profileController = require('../../controllers/employee/profileController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateShift,
    validateShiftStatus,
    validateAttendance,
    validateAttendanceCheck,
    validateLeave,
    validateLeaveStatus,
    validateDocument,
    validateDocumentStatus,
    validateNotification,
    validateProfileUpdate,
    validatePagination,
    validateDateRange
} = require('../../validators/employeeValidators');

// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// v1.0.0 - Added public root endpoint

/**
 * Public root endpoint for employee common module
 * GET /api/v1/employee
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Employee Common API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/employee/health',
        authentication: 'Bearer token required for all data endpoints',
        available: {
            health: '/api/v1/employee/health'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ============================================
// SHIFT MANAGEMENT ROUTES (5 endpoints)
// ============================================
// ============================================

/**
 * Get my shifts
 * GET /api/v1/employee/shifts
 */
router.get('/shifts',
    authenticate,
    authorize('employee'),
    standard,
    validatePagination,
    auditLogger('EMPLOYEE_VIEW_SHIFTS'),
    shiftController.getMyShifts
);

/**
 * Get current shift
 * GET /api/v1/employee/shifts/current
 */
router.get('/shifts/current',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_CURRENT_SHIFT'),
    shiftController.getCurrentShift
);

/**
 * Get upcoming shifts
 * GET /api/v1/employee/shifts/upcoming
 */
router.get('/shifts/upcoming',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_UPCOMING_SHIFTS'),
    shiftController.getUpcomingShifts
);

/**
 * Get shift history
 * GET /api/v1/employee/shifts/history
 */
router.get('/shifts/history',
    authenticate,
    authorize('employee'),
    standard,
    validatePagination,
    auditLogger('EMPLOYEE_VIEW_SHIFT_HISTORY'),
    shiftController.getShiftHistory
);

/**
 * Get shift calendar
 * GET /api/v1/employee/shifts/calendar
 */
router.get('/shifts/calendar',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_SHIFT_CALENDAR'),
    shiftController.getShiftCalendar
);

/**
 * Request shift change
 * PUT /api/v1/employee/shifts/:id/change
 * 
 * BUSINESS RULE: [BR-53] Shift change requires 24 hours notice
 */
router.put('/shifts/:id/change',
    authenticate,
    authorize('employee'),
    sensitive,
    validateShift,
    auditLogger('EMPLOYEE_REQUEST_SHIFT_CHANGE'),
    shiftController.requestShiftChange
);

// ============================================
// ============================================
// ATTENDANCE ROUTES (6 endpoints)
// ============================================
// ============================================

/**
 * Check in
 * POST /api/v1/employee/attendance/check-in
 * 
 * BUSINESS RULE: [BR-54] Check-in within 15 minutes of shift start
 */
router.post('/attendance/check-in',
    authenticate,
    authorize('employee'),
    sensitive,
    validateAttendanceCheck,
    auditLogger('EMPLOYEE_CHECK_IN'),
    attendanceController.checkIn
);

/**
 * Check out
 * POST /api/v1/employee/attendance/check-out
 */
router.post('/attendance/check-out',
    authenticate,
    authorize('employee'),
    sensitive,
    validateAttendanceCheck,
    auditLogger('EMPLOYEE_CHECK_OUT'),
    attendanceController.checkOut
);

/**
 * Get today's attendance
 * GET /api/v1/employee/attendance/today
 */
router.get('/attendance/today',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_TODAY_ATTENDANCE'),
    attendanceController.getTodayAttendance
);

/**
 * Get attendance history
 * GET /api/v1/employee/attendance/history
 */
router.get('/attendance/history',
    authenticate,
    authorize('employee'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('EMPLOYEE_VIEW_ATTENDANCE_HISTORY'),
    attendanceController.getAttendanceHistory
);

/**
 * Get attendance summary
 * GET /api/v1/employee/attendance/summary
 */
router.get('/attendance/summary',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_ATTENDANCE_SUMMARY'),
    attendanceController.getAttendanceSummary
);

/**
 * Get monthly attendance
 * GET /api/v1/employee/attendance/monthly
 */
router.get('/attendance/monthly',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_MONTHLY_ATTENDANCE'),
    attendanceController.getMonthlyAttendance
);

// ============================================
// ============================================
// LEAVE MANAGEMENT ROUTES (6 endpoints)
// ============================================
// ============================================

/**
 * Get my leaves
 * GET /api/v1/employee/leaves
 */
router.get('/leaves',
    authenticate,
    authorize('employee'),
    standard,
    validatePagination,
    auditLogger('EMPLOYEE_VIEW_LEAVES'),
    leaveController.getMyLeaves
);

/**
 * Get leave balance
 * GET /api/v1/employee/leaves/balance
 * 
 * BUSINESS RULE: [BR-55] Leave balance cannot go negative
 */
router.get('/leaves/balance',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_LEAVE_BALANCE'),
    leaveController.getLeaveBalance
);

/**
 * Get leave history
 * GET /api/v1/employee/leaves/history
 */
router.get('/leaves/history',
    authenticate,
    authorize('employee'),
    standard,
    validatePagination,
    auditLogger('EMPLOYEE_VIEW_LEAVE_HISTORY'),
    leaveController.getLeaveHistory
);

/**
 * Get leave by ID
 * GET /api/v1/employee/leaves/:id
 */
router.get('/leaves/:id',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_LEAVE'),
    leaveController.getLeaveById
);

/**
 * Apply for leave
 * POST /api/v1/employee/leaves
 * 
 * BUSINESS RULE: [BR-56] Leave request requires minimum 2 days advance notice
 */
router.post('/leaves',
    authenticate,
    authorize('employee'),
    sensitive,
    validateLeave,
    auditLogger('EMPLOYEE_APPLY_LEAVE'),
    leaveController.applyLeave
);

/**
 * Cancel leave (if pending)
 * DELETE /api/v1/employee/leaves/:id
 */
router.delete('/leaves/:id',
    authenticate,
    authorize('employee'),
    sensitive,
    auditLogger('EMPLOYEE_CANCEL_LEAVE'),
    leaveController.cancelLeave
);

// ============================================
// ============================================
// DOCUMENT MANAGEMENT ROUTES (4 endpoints)
// ============================================
// ============================================

/**
 * Get my documents
 * GET /api/v1/employee/documents
 * 
 * BUSINESS RULE: [BR-57] Documents must be verified before access
 */
router.get('/documents',
    authenticate,
    authorize('employee'),
    standard,
    validatePagination,
    auditLogger('EMPLOYEE_VIEW_DOCUMENTS'),
    documentController.getMyDocuments
);

/**
 * Get document by ID
 * GET /api/v1/employee/documents/:id
 */
router.get('/documents/:id',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_DOCUMENT'),
    documentController.getDocumentById
);

/**
 * Upload document
 * POST /api/v1/employee/documents
 */
router.post('/documents',
    authenticate,
    authorize('employee'),
    sensitive,
    validateDocument,
    auditLogger('EMPLOYEE_UPLOAD_DOCUMENT'),
    documentController.uploadDocument
);

/**
 * Delete document
 * DELETE /api/v1/employee/documents/:id
 */
router.delete('/documents/:id',
    authenticate,
    authorize('employee'),
    sensitive,
    auditLogger('EMPLOYEE_DELETE_DOCUMENT'),
    documentController.deleteDocument
);

// ============================================
// ============================================
// NOTIFICATION ROUTES (5 endpoints)
// ============================================
// ============================================

/**
 * Get notifications
 * GET /api/v1/employee/notifications
 */
router.get('/notifications',
    authenticate,
    authorize('employee'),
    standard,
    validatePagination,
    auditLogger('EMPLOYEE_VIEW_NOTIFICATIONS'),
    notificationController.getNotifications
);

/**
 * Get unread notifications
 * GET /api/v1/employee/notifications/unread
 */
router.get('/notifications/unread',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_UNREAD_NOTIFICATIONS'),
    notificationController.getUnreadNotifications
);

/**
 * Mark notification as read
 * PUT /api/v1/employee/notifications/:id/read
 */
router.put('/notifications/:id/read',
    authenticate,
    authorize('employee'),
    sensitive,
    validateNotification,
    auditLogger('EMPLOYEE_MARK_NOTIFICATION_READ'),
    notificationController.markAsRead
);

/**
 * Mark all notifications as read
 * PUT /api/v1/employee/notifications/read-all
 */
router.put('/notifications/read-all',
    authenticate,
    authorize('employee'),
    sensitive,
    auditLogger('EMPLOYEE_MARK_ALL_READ'),
    notificationController.markAllAsRead
);

/**
 * Delete notification
 * DELETE /api/v1/employee/notifications/:id
 */
router.delete('/notifications/:id',
    authenticate,
    authorize('employee'),
    sensitive,
    auditLogger('EMPLOYEE_DELETE_NOTIFICATION'),
    notificationController.deleteNotification
);

// ============================================
// ============================================
// PROFILE ROUTES (3 endpoints)
// ============================================
// ============================================

/**
 * Get my profile
 * GET /api/v1/employee/profile
 */
router.get('/profile',
    authenticate,
    authorize('employee'),
    standard,
    auditLogger('EMPLOYEE_VIEW_PROFILE'),
    profileController.getMyProfile
);

/**
 * Update profile
 * PUT /api/v1/employee/profile
 */
router.put('/profile',
    authenticate,
    authorize('employee'),
    sensitive,
    validateProfileUpdate,
    auditLogger('EMPLOYEE_UPDATE_PROFILE'),
    profileController.updateProfile
);

/**
 * Upload profile photo
 * POST /api/v1/employee/profile/photo
 */
router.post('/profile/photo',
    authenticate,
    authorize('employee'),
    sensitive,
    auditLogger('EMPLOYEE_UPLOAD_PHOTO'),
    profileController.uploadProfilePhoto
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.0 - Protected with authentication

/**
 * Health check for employee common module
 * GET /api/v1/employee/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('employee'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Employee Common API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            employeeId: req.user.id,
            endpoints: {
                total: 28,
                root: 1,
                shifts: 5,
                attendance: 6,
                leaves: 6,
                documents: 4,
                notifications: 5,
                profile: 3,
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
 * Shift Management   | 5     | [BR-53]        | 🔒 Protected
 * Attendance         | 6     | [BR-54]        | 🔒 Protected
 * Leave Management   | 6     | [BR-55][BR-56] | 🔒 Protected
 * Document Management| 4     | [BR-57]        | 🔒 Protected
 * Notifications      | 5     | -              | 🔒 Protected
 * Profile            | 3     | -              | 🔒 Protected
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 31    | Complete Employee Common Module
 * 
 * RBAC PERMISSIONS USED:
 * - view_shifts, request_shift_change
 * - check_in, check_out, view_attendance
 * - view_leaves, apply_leave, cancel_leave
 * - view_documents, upload_document, delete_document
 * - view_notifications, mark_read, delete_notification
 * - view_profile, update_profile
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All data endpoints: Require valid authentication
 * 
 * ======================================================================
 */