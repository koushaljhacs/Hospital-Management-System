/**
 * ======================================================================
 * FILE: backend/src/routes/v1/reportRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Report generation and export routes for all user roles.
 * Handles patient reports, clinical reports, financial reports,
 * operational reports, and data export functionality.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * DEPENDENCIES:
 * - express: Router
 * - reportController: Report generation logic
 * - auth middleware: Authentication & authorization
 * - validators: Request validation
 * 
 * BASE PATH: /api/v1/reports
 * 
 * ENDPOINT CATEGORIES:
 * - Patient Reports (5 endpoints)
 * - Clinical Reports (4 endpoints)
 * - Financial Reports (4 endpoints)
 * - Operational Reports (4 endpoints)
 * - Export APIs (5 endpoints)
 * - Additional Reports (8 endpoints)
 * 
 * AUTHORIZATION:
 * - All routes require authentication
 * - Role-based access control for different report types
 * - Permission checks for sensitive financial data
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-22) - Initial implementation with 30+ report endpoints
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Controllers
const reportController = require('../../controllers/reportController');

// Middlewares
const { authenticate, authorize, hasPermission } = require('../../middlewares/auth');

// Validators
const {
    validateDateRange,
    validateReportType,
    validateExportFormat,
    validatePagination,
    validateUUID,
    handleValidationErrors
} = require('../../validators/reportValidators');

const logger = require('../../utils/logger');

/**
 * ======================================================================
 * RATE LIMITING
 * ======================================================================
 */

// Stricter rate limit for report generation (report queries can be heavy)
const reportLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 reports per minute
    message: {
        success: false,
        error: 'Too many report requests. Please wait before generating more reports.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting to report routes
router.use(reportLimiter);

/**
 * ======================================================================
 * ROOT ROUTE - Reports API Information
 * ======================================================================
 */
router.get('/', authenticate, (req, res) => {
    res.json({
        success: true,
        message: 'Reports module is healthy',
        version: '1.0.0',
        availableReports: {
            patient: ['daily', 'monthly', 'yearly', 'demographics', 'visits'],
            clinical: ['diagnosis', 'prescriptions', 'lab-tests', 'radiology'],
            financial: ['revenue', 'outstanding', 'insurance', 'tax'],
            operational: ['appointments', 'beds', 'inventory', 'equipment'],
            export: ['patients', 'appointments', 'invoices', 'inventory', 'audit-logs']
        },
        timestamp: new Date().toISOString()
    });
});

/**
 * ======================================================================
 * PATIENT REPORTS (5 APIs)
 * ======================================================================
 */

/**
 * Daily patient report
 * GET /api/v1/reports/patients/daily?date=2026-03-22
 */
router.get('/patients/daily',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin', 'doctor', 'receptionist']),
    validateDateRange,
    reportController.getDailyPatientReport
);

/**
 * Monthly patient report
 * GET /api/v1/reports/patients/monthly?year=2026&month=3
 */
router.get('/patients/monthly',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin', 'doctor']),
    reportController.getMonthlyPatientReport
);

/**
 * Yearly patient report
 * GET /api/v1/reports/patients/yearly?year=2026
 */
router.get('/patients/yearly',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    reportController.getYearlyPatientReport
);

/**
 * Patient demographics report
 * GET /api/v1/reports/patients/demographics
 */
router.get('/patients/demographics',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    reportController.getPatientDemographicsReport
);

/**
 * Patient visit frequency report
 * GET /api/v1/reports/patients/visits?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/patients/visits',
    authenticate,
    authorize(['super_admin', 'it_admin', 'doctor']),
    validateDateRange,
    reportController.getPatientVisitReport
);

/**
 * ======================================================================
 * CLINICAL REPORTS (4 APIs)
 * ======================================================================
 */

/**
 * Diagnosis report
 * GET /api/v1/reports/clinical/diagnosis?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/clinical/diagnosis',
    authenticate,
    authorize(['super_admin', 'it_admin', 'doctor']),
    validateDateRange,
    reportController.getDiagnosisReport
);

/**
 * Prescriptions report
 * GET /api/v1/reports/clinical/prescriptions?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/clinical/prescriptions',
    authenticate,
    authorize(['super_admin', 'it_admin', 'doctor', 'pharmacist']),
    validateDateRange,
    reportController.getPrescriptionReport
);

/**
 * Lab tests report
 * GET /api/v1/reports/clinical/lab-tests?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/clinical/lab-tests',
    authenticate,
    authorize(['super_admin', 'it_admin', 'doctor', 'lab_technician']),
    validateDateRange,
    reportController.getLabTestReport
);

/**
 * Radiology report
 * GET /api/v1/reports/clinical/radiology?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/clinical/radiology',
    authenticate,
    authorize(['super_admin', 'it_admin', 'doctor', 'radiologist']),
    validateDateRange,
    reportController.getRadiologyReport
);

/**
 * ======================================================================
 * FINANCIAL REPORTS (4 APIs)
 * ======================================================================
 */

/**
 * Revenue report
 * GET /api/v1/reports/financial/revenue?startDate=2026-01-01&endDate=2026-03-31&groupBy=day
 */
router.get('/financial/revenue',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    validateDateRange,
    reportController.getRevenueReport
);

/**
 * Outstanding payments report
 * GET /api/v1/reports/financial/outstanding
 */
router.get('/financial/outstanding',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    reportController.getOutstandingReport
);

/**
 * Insurance claims report
 * GET /api/v1/reports/financial/insurance?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/financial/insurance',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    validateDateRange,
    reportController.getInsuranceReport
);

/**
 * Tax report
 * GET /api/v1/reports/financial/tax?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/financial/tax',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    validateDateRange,
    reportController.getTaxReport
);

/**
 * ======================================================================
 * OPERATIONAL REPORTS (4 APIs)
 * ======================================================================
 */

/**
 * Appointments report
 * GET /api/v1/reports/operational/appointments?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/operational/appointments',
    authenticate,
    authorize(['super_admin', 'it_admin', 'receptionist']),
    validateDateRange,
    reportController.getAppointmentReport
);

/**
 * Bed occupancy report
 * GET /api/v1/reports/operational/beds?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/operational/beds',
    authenticate,
    authorize(['super_admin', 'it_admin', 'nurse', 'receptionist']),
    validateDateRange,
    reportController.getBedOccupancyReport
);

/**
 * Inventory report
 * GET /api/v1/reports/operational/inventory
 */
router.get('/operational/inventory',
    authenticate,
    authorize(['super_admin', 'it_admin', 'pharmacist']),
    reportController.getInventoryReport
);

/**
 * Equipment report
 * GET /api/v1/reports/operational/equipment
 */
router.get('/operational/equipment',
    authenticate,
    authorize(['super_admin', 'it_admin', 'lab_technician', 'radiologist']),
    reportController.getEquipmentReport
);

/**
 * ======================================================================
 * EXPORT APIS (5 APIs)
 * ======================================================================
 */

/**
 * Export patients data
 * GET /api/v1/reports/export/patients?format=csv&startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/export/patients',
    authenticate,
    hasPermission('report:export'),
    validateExportFormat,
    validateDateRange,
    reportController.exportPatients
);

/**
 * Export appointments data
 * GET /api/v1/reports/export/appointments?format=excel&startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/export/appointments',
    authenticate,
    hasPermission('report:export'),
    validateExportFormat,
    validateDateRange,
    reportController.exportAppointments
);

/**
 * Export invoices data
 * GET /api/v1/reports/export/invoices?format=pdf&startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/export/invoices',
    authenticate,
    hasPermission('report:export'),
    validateExportFormat,
    validateDateRange,
    reportController.exportInvoices
);

/**
 * Export inventory data
 * GET /api/v1/reports/export/inventory?format=csv
 */
router.get('/export/inventory',
    authenticate,
    hasPermission('report:export'),
    validateExportFormat,
    reportController.exportInventory
);

/**
 * Export audit logs
 * GET /api/v1/reports/export/audit-logs?format=csv&startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/export/audit-logs',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateExportFormat,
    validateDateRange,
    reportController.exportAuditLogs
);

/**
 * ======================================================================
 * ADDITIONAL REPORTS (8 APIs)
 * ======================================================================
 */

/**
 * Doctor performance report
 * GET /api/v1/reports/doctors/performance?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/doctors/performance',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateDateRange,
    reportController.getDoctorPerformanceReport
);

/**
 * Department performance report
 * GET /api/v1/reports/departments/performance?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/departments/performance',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateDateRange,
    reportController.getDepartmentPerformanceReport
);

/**
 * Referral report
 * GET /api/v1/reports/referrals?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/referrals',
    authenticate,
    authorize(['super_admin', 'it_admin', 'doctor']),
    validateDateRange,
    reportController.getReferralReport
);

/**
 * Age group report
 * GET /api/v1/reports/patients/age-groups
 */
router.get('/patients/age-groups',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    reportController.getAgeGroupReport
);

/**
 * Payment method report
 * GET /api/v1/reports/financial/payment-methods?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/financial/payment-methods',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    validateDateRange,
    reportController.getPaymentMethodReport
);

/**
 * Cancellation analysis report
 * GET /api/v1/reports/appointments/cancellations?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/appointments/cancellations',
    authenticate,
    authorize(['super_admin', 'it_admin', 'receptionist']),
    validateDateRange,
    reportController.getCancellationReport
);

/**
 * No-show analysis report
 * GET /api/v1/reports/appointments/no-shows?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/appointments/no-shows',
    authenticate,
    authorize(['super_admin', 'it_admin', 'receptionist']),
    validateDateRange,
    reportController.getNoShowReport
);

/**
 * Patient satisfaction report
 * GET /api/v1/reports/patient-satisfaction?startDate=2026-01-01&endDate=2026-03-31
 */
router.get('/patient-satisfaction',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    validateDateRange,
    reportController.getPatientSatisfactionReport
);

/**
 * ======================================================================
 * SUMMARY & STATISTICS (2 APIs)
 * ======================================================================
 */

/**
 * Get report summary (quick stats)
 * GET /api/v1/reports/summary
 */
router.get('/summary',
    authenticate,
    authorize(['super_admin', 'it_admin', 'billing_admin']),
    reportController.getReportSummary
);

/**
 * Get available report types
 * GET /api/v1/reports/types
 */
router.get('/types',
    authenticate,
    (req, res) => {
        res.json({
            success: true,
            data: {
                patient: ['daily', 'monthly', 'yearly', 'demographics', 'visits', 'age-groups'],
                clinical: ['diagnosis', 'prescriptions', 'lab-tests', 'radiology'],
                financial: ['revenue', 'outstanding', 'insurance', 'tax', 'payment-methods'],
                operational: ['appointments', 'beds', 'inventory', 'equipment', 'cancellations', 'no-shows'],
                performance: ['doctors', 'departments'],
                other: ['referrals', 'patient-satisfaction']
            },
            exportFormats: ['csv', 'excel', 'pdf']
        });
    }
);

/**
 * ======================================================================
 * HEALTH CHECK FOR REPORTS MODULE
 * ======================================================================
 */
router.get('/health',
    authenticate,
    authorize(['super_admin', 'it_admin']),
    (req, res) => {
        res.json({
            success: true,
            service: 'reports-api',
            status: 'healthy',
            endpoints: 30,
            timestamp: new Date().toISOString()
        });
    }
);

module.exports = router;

/**
 * ======================================================================
 * USAGE IN MAIN APP:
 * ======================================================================
 * 
 * // In server.js or app.js:
 * const reportRoutes = require('./src/routes/v1/reportRoutes');
 * app.use('/api/v1/reports', reportRoutes);
 * 
 * ======================================================================
 * 
 * TOTAL ENDPOINTS: 30+
 * 
 * | Category | Count |
 * |----------|-------|
 * | Patient Reports | 5 |
 * | Clinical Reports | 4 |
 * | Financial Reports | 4 |
 * | Operational Reports | 4 |
 * | Export APIs | 5 |
 * | Additional Reports | 8 |
 * | Summary & Types | 2 |
 * | Health | 1 |
 * 
 * ======================================================================
 */