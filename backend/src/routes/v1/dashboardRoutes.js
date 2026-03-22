/**
 * ======================================================================
 * FILE: backend/src/routes/v1/dashboardRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Dashboard module routes - All role-based dashboard endpoints.
 * Total Endpoints: 36 (including root endpoint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all dashboard endpoints
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
const { standard } = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');

// ============================================
// IMPORT CONTROLLERS
// ============================================
const adminDashboardController = require('../../controllers/dashboard/adminDashboardController');
const doctorDashboardController = require('../../controllers/dashboard/doctorDashboardController');
const nurseDashboardController = require('../../controllers/dashboard/nurseDashboardController');
const receptionDashboardController = require('../../controllers/dashboard/receptionDashboardController');
const pharmacistDashboardController = require('../../controllers/dashboard/pharmacistDashboardController');
const labDashboardController = require('../../controllers/dashboard/labDashboardController');
const billingDashboardController = require('../../controllers/dashboard/billingDashboardController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateDateRange,
    validatePagination
} = require('../../validators/dashboardValidators');

// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// v1.0.0 - Added public root endpoint

/**
 * Public root endpoint for dashboard module
 * GET /api/v1/dashboard
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Dashboard API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/dashboard/health',
        authentication: 'Bearer token required for all dashboard endpoints',
        available: {
            health: '/api/v1/dashboard/health'
        },
        role_based_dashboards: {
            admin: '/api/v1/dashboard/admin',
            doctor: '/api/v1/dashboard/doctor',
            nurse: '/api/v1/dashboard/nurse',
            reception: '/api/v1/dashboard/reception',
            pharmacy: '/api/v1/dashboard/pharmacy',
            lab: '/api/v1/dashboard/lab',
            billing: '/api/v1/dashboard/billing'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ============================================
// ADMIN DASHBOARD ROUTES (10 endpoints)
// ============================================
// ============================================

/**
 * Get admin main dashboard
 * GET /api/v1/dashboard/admin
 */
router.get('/admin',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    standard,
    auditLogger('DASHBOARD_ADMIN_VIEW'),
    adminDashboardController.getDashboard
);

/**
 * Get admin key statistics
 * GET /api/v1/dashboard/admin/stats
 */
router.get('/admin/stats',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    standard,
    auditLogger('DASHBOARD_ADMIN_STATS'),
    adminDashboardController.getKeyStats
);

/**
 * Get user statistics
 * GET /api/v1/dashboard/admin/users
 */
router.get('/admin/users',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    standard,
    auditLogger('DASHBOARD_ADMIN_USER_STATS'),
    adminDashboardController.getUserStats
);

/**
 * Get revenue statistics
 * GET /api/v1/dashboard/admin/revenue
 */
router.get('/admin/revenue',
    authenticate,
    authorize(['super_admin', 'billing_admin']),
    standard,
    validateDateRange,
    auditLogger('DASHBOARD_ADMIN_REVENUE'),
    adminDashboardController.getRevenueStats
);

/**
 * Get appointment statistics
 * GET /api/v1/dashboard/admin/appointments
 */
router.get('/admin/appointments',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    standard,
    validateDateRange,
    auditLogger('DASHBOARD_ADMIN_APPOINTMENTS'),
    adminDashboardController.getAppointmentStats
);

/**
 * Get patient statistics
 * GET /api/v1/dashboard/admin/patients
 */
router.get('/admin/patients',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    standard,
    validateDateRange,
    auditLogger('DASHBOARD_ADMIN_PATIENTS'),
    adminDashboardController.getPatientStats
);

/**
 * Get bed occupancy statistics
 * GET /api/v1/dashboard/admin/beds
 */
router.get('/admin/beds',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    standard,
    auditLogger('DASHBOARD_ADMIN_BEDS'),
    adminDashboardController.getBedStats
);

/**
 * Get inventory statistics
 * GET /api/v1/dashboard/admin/inventory
 */
router.get('/admin/inventory',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    standard,
    auditLogger('DASHBOARD_ADMIN_INVENTORY'),
    adminDashboardController.getInventoryStats
);

/**
 * Get performance metrics
 * GET /api/v1/dashboard/admin/performance
 */
router.get('/admin/performance',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    standard,
    validateDateRange,
    auditLogger('DASHBOARD_ADMIN_PERFORMANCE'),
    adminDashboardController.getPerformanceMetrics
);

/**
 * Get system alerts
 * GET /api/v1/dashboard/admin/alerts
 */
router.get('/admin/alerts',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    standard,
    auditLogger('DASHBOARD_ADMIN_ALERTS'),
    adminDashboardController.getSystemAlerts
);

// ============================================
// ============================================
// DOCTOR DASHBOARD ROUTES (7 endpoints)
// ============================================
// ============================================

/**
 * Get doctor main dashboard
 * GET /api/v1/dashboard/doctor
 */
router.get('/doctor',
    authenticate,
    authorize('doctor'),
    standard,
    auditLogger('DASHBOARD_DOCTOR_VIEW'),
    doctorDashboardController.getDashboard
);

/**
 * Get today's schedule
 * GET /api/v1/dashboard/doctor/today
 */
router.get('/doctor/today',
    authenticate,
    authorize('doctor'),
    standard,
    auditLogger('DASHBOARD_DOCTOR_TODAY'),
    doctorDashboardController.getTodaySchedule
);

/**
 * Get patient statistics
 * GET /api/v1/dashboard/doctor/patients
 */
router.get('/doctor/patients',
    authenticate,
    authorize('doctor'),
    standard,
    auditLogger('DASHBOARD_DOCTOR_PATIENTS'),
    doctorDashboardController.getPatientStats
);

/**
 * Get appointment statistics
 * GET /api/v1/dashboard/doctor/appointments
 */
router.get('/doctor/appointments',
    authenticate,
    authorize('doctor'),
    standard,
    validateDateRange,
    auditLogger('DASHBOARD_DOCTOR_APPOINTMENTS'),
    doctorDashboardController.getAppointmentStats
);

/**
 * Get prescription statistics
 * GET /api/v1/dashboard/doctor/prescriptions
 */
router.get('/doctor/prescriptions',
    authenticate,
    authorize('doctor'),
    standard,
    validateDateRange,
    auditLogger('DASHBOARD_DOCTOR_PRESCRIPTIONS'),
    doctorDashboardController.getPrescriptionStats
);

/**
 * Get lab results summary
 * GET /api/v1/dashboard/doctor/lab-results
 */
router.get('/doctor/lab-results',
    authenticate,
    authorize('doctor'),
    standard,
    auditLogger('DASHBOARD_DOCTOR_LAB'),
    doctorDashboardController.getLabResultsSummary
);

/**
 * Get performance metrics
 * GET /api/v1/dashboard/doctor/performance
 */
router.get('/doctor/performance',
    authenticate,
    authorize('doctor'),
    standard,
    validateDateRange,
    auditLogger('DASHBOARD_DOCTOR_PERFORMANCE'),
    doctorDashboardController.getPerformanceMetrics
);

// ============================================
// ============================================
// NURSE DASHBOARD ROUTES (6 endpoints)
// ============================================
// ============================================

/**
 * Get nurse main dashboard
 * GET /api/v1/dashboard/nurse
 */
router.get('/nurse',
    authenticate,
    authorize('nurse'),
    standard,
    auditLogger('DASHBOARD_NURSE_VIEW'),
    nurseDashboardController.getDashboard
);

/**
 * Get assigned patients
 * GET /api/v1/dashboard/nurse/patients
 */
router.get('/nurse/patients',
    authenticate,
    authorize('nurse'),
    standard,
    auditLogger('DASHBOARD_NURSE_PATIENTS'),
    nurseDashboardController.getAssignedPatients
);

/**
 * Get pending tasks
 * GET /api/v1/dashboard/nurse/tasks
 */
router.get('/nurse/tasks',
    authenticate,
    authorize('nurse'),
    standard,
    auditLogger('DASHBOARD_NURSE_TASKS'),
    nurseDashboardController.getPendingTasks
);

/**
 * Get recent vitals
 * GET /api/v1/dashboard/nurse/vitals
 */
router.get('/nurse/vitals',
    authenticate,
    authorize('nurse'),
    standard,
    auditLogger('DASHBOARD_NURSE_VITALS'),
    nurseDashboardController.getRecentVitals
);

/**
 * Get medication schedules
 * GET /api/v1/dashboard/nurse/medications
 */
router.get('/nurse/medications',
    authenticate,
    authorize('nurse'),
    standard,
    auditLogger('DASHBOARD_NURSE_MEDICATIONS'),
    nurseDashboardController.getMedicationSchedules
);

/**
 * Get bed occupancy
 * GET /api/v1/dashboard/nurse/beds
 */
router.get('/nurse/beds',
    authenticate,
    authorize('nurse'),
    standard,
    auditLogger('DASHBOARD_NURSE_BEDS'),
    nurseDashboardController.getBedOccupancy
);

// ============================================
// ============================================
// RECEPTION DASHBOARD ROUTES (5 endpoints)
// ============================================
// ============================================

/**
 * Get reception main dashboard
 * GET /api/v1/dashboard/reception
 */
router.get('/reception',
    authenticate,
    authorize('receptionist'),
    standard,
    auditLogger('DASHBOARD_RECEPTION_VIEW'),
    receptionDashboardController.getDashboard
);

/**
 * Get today's appointments
 * GET /api/v1/dashboard/reception/appointments
 */
router.get('/reception/appointments',
    authenticate,
    authorize('receptionist'),
    standard,
    auditLogger('DASHBOARD_RECEPTION_APPOINTMENTS'),
    receptionDashboardController.getTodayAppointments
);

/**
 * Get bed availability
 * GET /api/v1/dashboard/reception/beds
 */
router.get('/reception/beds',
    authenticate,
    authorize('receptionist'),
    standard,
    auditLogger('DASHBOARD_RECEPTION_BEDS'),
    receptionDashboardController.getBedAvailability
);

/**
 * Get new patients
 * GET /api/v1/dashboard/reception/patients
 */
router.get('/reception/patients',
    authenticate,
    authorize('receptionist'),
    standard,
    auditLogger('DASHBOARD_RECEPTION_PATIENTS'),
    receptionDashboardController.getNewPatients
);

/**
 * Get walk-in statistics
 * GET /api/v1/dashboard/reception/walk-in
 */
router.get('/reception/walk-in',
    authenticate,
    authorize('receptionist'),
    standard,
    auditLogger('DASHBOARD_RECEPTION_WALKIN'),
    receptionDashboardController.getWalkinStats
);

// ============================================
// ============================================
// PHARMACIST DASHBOARD ROUTES (5 endpoints)
// ============================================
// ============================================

/**
 * Get pharmacist main dashboard
 * GET /api/v1/dashboard/pharmacy
 */
router.get('/pharmacy',
    authenticate,
    authorize('pharmacist'),
    standard,
    auditLogger('DASHBOARD_PHARMACY_VIEW'),
    pharmacistDashboardController.getDashboard
);

/**
 * Get low stock items
 * GET /api/v1/dashboard/pharmacy/low-stock
 */
router.get('/pharmacy/low-stock',
    authenticate,
    authorize('pharmacist'),
    standard,
    auditLogger('DASHBOARD_PHARMACY_LOW_STOCK'),
    pharmacistDashboardController.getLowStockItems
);

/**
 * Get expiring items
 * GET /api/v1/dashboard/pharmacy/expiring
 */
router.get('/pharmacy/expiring',
    authenticate,
    authorize('pharmacist'),
    standard,
    auditLogger('DASHBOARD_PHARMACY_EXPIRING'),
    pharmacistDashboardController.getExpiringItems
);

/**
 * Get pending prescriptions
 * GET /api/v1/dashboard/pharmacy/prescriptions
 */
router.get('/pharmacy/prescriptions',
    authenticate,
    authorize('pharmacist'),
    standard,
    auditLogger('DASHBOARD_PHARMACY_PRESCRIPTIONS'),
    pharmacistDashboardController.getPendingPrescriptions
);

/**
 * Get today's dispensing
 * GET /api/v1/dashboard/pharmacy/dispensing
 */
router.get('/pharmacy/dispensing',
    authenticate,
    authorize('pharmacist'),
    standard,
    auditLogger('DASHBOARD_PHARMACY_DISPENSING'),
    pharmacistDashboardController.getTodayDispensing
);

// ============================================
// ============================================
// LAB DASHBOARD ROUTES (4 endpoints)
// ============================================
// ============================================

/**
 * Get lab main dashboard
 * GET /api/v1/dashboard/lab
 */
router.get('/lab',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('DASHBOARD_LAB_VIEW'),
    labDashboardController.getDashboard
);

/**
 * Get pending tests
 * GET /api/v1/dashboard/lab/pending
 */
router.get('/lab/pending',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('DASHBOARD_LAB_PENDING'),
    labDashboardController.getPendingTests
);

/**
 * Get critical values
 * GET /api/v1/dashboard/lab/critical
 */
router.get('/lab/critical',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('DASHBOARD_LAB_CRITICAL'),
    labDashboardController.getCriticalValues
);

/**
 * Get equipment status
 * GET /api/v1/dashboard/lab/equipment
 */
router.get('/lab/equipment',
    authenticate,
    authorize('lab_technician'),
    standard,
    auditLogger('DASHBOARD_LAB_EQUIPMENT'),
    labDashboardController.getEquipmentStatus
);

// ============================================
// ============================================
// BILLING DASHBOARD ROUTES (4 endpoints)
// ============================================
// ============================================

/**
 * Get billing main dashboard
 * GET /api/v1/dashboard/billing
 */
router.get('/billing',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('DASHBOARD_BILLING_VIEW'),
    billingDashboardController.getDashboard
);

/**
 * Get today's collections
 * GET /api/v1/dashboard/billing/today
 */
router.get('/billing/today',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('DASHBOARD_BILLING_TODAY'),
    billingDashboardController.getTodayCollections
);

/**
 * Get pending invoices
 * GET /api/v1/dashboard/billing/pending
 */
router.get('/billing/pending',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('DASHBOARD_BILLING_PENDING'),
    billingDashboardController.getPendingInvoices
);

/**
 * Get insurance claims summary
 * GET /api/v1/dashboard/billing/insurance
 */
router.get('/billing/insurance',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('DASHBOARD_BILLING_INSURANCE'),
    billingDashboardController.getInsuranceClaimsSummary
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.0 - Protected with authentication

/**
 * Health check for dashboard module
 * GET /api/v1/dashboard/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('employee'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Dashboard API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            userId: req.user.id,
            endpoints: {
                total: 36,
                root: 1,
                admin: 10,
                doctor: 7,
                nurse: 6,
                reception: 5,
                pharmacy: 5,
                lab: 4,
                billing: 4,
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
 * Admin Dashboard    | 10    | -              | 🔒 Admin Roles
 * Doctor Dashboard   | 7     | -              | 🔒 Doctor Role
 * Nurse Dashboard    | 6     | -              | 🔒 Nurse Role
 * Reception Dashboard| 5     | -              | 🔒 Receptionist Role
 * Pharmacy Dashboard | 5     | -              | 🔒 Pharmacist Role
 * Lab Dashboard      | 4     | -              | 🔒 Lab Role
 * Billing Dashboard  | 4     | -              | 🔒 Billing Role
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 43    | Complete Dashboard Module
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All dashboard endpoints: Require valid authentication with role-based access
 * 
 * ======================================================================
 */