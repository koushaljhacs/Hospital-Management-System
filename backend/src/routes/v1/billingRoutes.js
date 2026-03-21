/**
 * ======================================================================
 * FILE: backend/src/routes/v1/billingRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing module routes - All billing staff-facing endpoints.
 * Total Endpoints: 58 (including root endpoint)
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all billing endpoints
 * 
 * BUSINESS RULES COVERED:
 * - [BR-30] Invoice must have unique invoice number
 * - [BR-31] Payment must be verified before invoice marked paid
 * - [BR-32] Refund only for paid invoices
 * - [BR-33] Insurance claim requires pre-authorization
 * - [BR-34] Discount cannot exceed maximum allowed
 * - [BR-35] Tax calculation follows government rules
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
const invoiceController = require('../../controllers/billing/invoiceController');
const paymentController = require('../../controllers/billing/paymentController');
const refundController = require('../../controllers/billing/refundController');
const insuranceClaimController = require('../../controllers/billing/insuranceClaimController');
const taxDiscountController = require('../../controllers/billing/taxDiscountController');
const reportController = require('../../controllers/billing/reportController');
const dashboardController = require('../../controllers/billing/dashboardController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateInvoiceCreate,
    validateInvoiceUpdate,
    validateInvoiceStatus,
    validatePayment,
    validateOnlinePayment,
    validateRefund,
    validateClaimCreate,
    validateClaimUpdate,
    validateTaxRate,
    validateDiscount,
    validatePagination,
    validateDateRange
} = require('../../validators/billingValidators');

// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// v1.0.0 - Added public root endpoint

/**
 * Public root endpoint for billing module
 * GET /api/v1/billing
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Billing API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/billing/health',
        authentication: 'Bearer token required for all data endpoints',
        available: {
            health: '/api/v1/billing/health'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// ============================================
// INVOICE MANAGEMENT ROUTES (17 endpoints)
// ============================================
// ============================================

/**
 * Get all invoices
 * GET /api/v1/billing/invoices
 */
router.get('/invoices',
    authenticate,
    authorize('billing_staff'),
    standard,
    validatePagination,
    auditLogger('BILLING_VIEW_INVOICES'),
    invoiceController.getAllInvoices
);

/**
 * Get draft invoices
 * GET /api/v1/billing/invoices/draft
 */
router.get('/invoices/draft',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_DRAFT_INVOICES'),
    invoiceController.getDraftInvoices
);

/**
 * Get pending invoices
 * GET /api/v1/billing/invoices/pending
 */
router.get('/invoices/pending',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_PENDING_INVOICES'),
    invoiceController.getPendingInvoices
);

/**
 * Get paid invoices
 * GET /api/v1/billing/invoices/paid
 */
router.get('/invoices/paid',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_PAID_INVOICES'),
    invoiceController.getPaidInvoices
);

/**
 * Get overdue invoices
 * GET /api/v1/billing/invoices/overdue
 */
router.get('/invoices/overdue',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_OVERDUE_INVOICES'),
    invoiceController.getOverdueInvoices
);

/**
 * Get cancelled invoices
 * GET /api/v1/billing/invoices/cancelled
 */
router.get('/invoices/cancelled',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_CANCELLED_INVOICES'),
    invoiceController.getCancelledInvoices
);

/**
 * Get invoices by patient
 * GET /api/v1/billing/invoices/patient/:patient_id
 */
router.get('/invoices/patient/:patient_id',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_PATIENT_INVOICES'),
    invoiceController.getInvoicesByPatient
);

/**
 * Get invoices by date range
 * GET /api/v1/billing/invoices/date-range
 */
router.get('/invoices/date-range',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_INVOICES_BY_DATE'),
    invoiceController.getInvoicesByDateRange
);

/**
 * Get invoice by ID
 * GET /api/v1/billing/invoices/:id
 */
router.get('/invoices/:id',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_INVOICE'),
    invoiceController.getInvoiceById
);

/**
 * Create invoice
 * POST /api/v1/billing/invoices
 * 
 * BUSINESS RULE: [BR-30] Invoice must have unique invoice number
 */
router.post('/invoices',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    validateInvoiceCreate,
    auditLogger('BILLING_CREATE_INVOICE'),
    invoiceController.createInvoice
);

/**
 * Update invoice
 * PUT /api/v1/billing/invoices/:id
 */
router.put('/invoices/:id',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    validateInvoiceUpdate,
    auditLogger('BILLING_UPDATE_INVOICE'),
    invoiceController.updateInvoice
);

/**
 * Delete invoice (if draft)
 * DELETE /api/v1/billing/invoices/:id
 */
router.delete('/invoices/:id',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    auditLogger('BILLING_DELETE_INVOICE'),
    invoiceController.deleteInvoice
);

/**
 * Submit invoice for approval
 * PUT /api/v1/billing/invoices/:id/submit
 */
router.put('/invoices/:id/submit',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    validateInvoiceStatus,
    auditLogger('BILLING_SUBMIT_INVOICE'),
    invoiceController.submitInvoice
);

/**
 * Approve invoice
 * PUT /api/v1/billing/invoices/:id/approve
 */
router.put('/invoices/:id/approve',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    validateInvoiceStatus,
    auditLogger('BILLING_APPROVE_INVOICE'),
    invoiceController.approveInvoice
);

/**
 * Cancel invoice
 * PUT /api/v1/billing/invoices/:id/cancel
 */
router.put('/invoices/:id/cancel',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    validateInvoiceStatus,
    auditLogger('BILLING_CANCEL_INVOICE'),
    invoiceController.cancelInvoice
);

/**
 * Download invoice PDF
 * GET /api/v1/billing/invoices/:id/pdf
 */
router.get('/invoices/:id/pdf',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_DOWNLOAD_INVOICE_PDF'),
    invoiceController.downloadInvoicePdf
);

/**
 * Get invoice breakdown
 * GET /api/v1/billing/invoices/:id/breakdown
 */
router.get('/invoices/:id/breakdown',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_INVOICE_BREAKDOWN'),
    invoiceController.getInvoiceBreakdown
);

// ============================================
// ============================================
// PAYMENT ROUTES (9 endpoints)
// ============================================
// ============================================

/**
 * Get all payments
 * GET /api/v1/billing/payments
 */
router.get('/payments',
    authenticate,
    authorize('billing_staff'),
    standard,
    validatePagination,
    auditLogger('BILLING_VIEW_PAYMENTS'),
    paymentController.getAllPayments
);

/**
 * Get online payments
 * GET /api/v1/billing/payments/online
 */
router.get('/payments/online',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_ONLINE_PAYMENTS'),
    paymentController.getOnlinePayments
);

/**
 * Get cash payments
 * GET /api/v1/billing/payments/cash
 */
router.get('/payments/cash',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_CASH_PAYMENTS'),
    paymentController.getCashPayments
);

/**
 * Get card payments
 * GET /api/v1/billing/payments/card
 */
router.get('/payments/card',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_CARD_PAYMENTS'),
    paymentController.getCardPayments
);

/**
 * Get UPI payments
 * GET /api/v1/billing/payments/upi
 */
router.get('/payments/upi',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_UPI_PAYMENTS'),
    paymentController.getUpiPayments
);

/**
 * Get payment by ID
 * GET /api/v1/billing/payments/:id
 */
router.get('/payments/:id',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_PAYMENT'),
    paymentController.getPaymentById
);

/**
 * Record payment
 * POST /api/v1/billing/payments
 * 
 * BUSINESS RULE: [BR-31] Payment must be verified before invoice marked paid
 */
router.post('/payments',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    validatePayment,
    auditLogger('BILLING_RECORD_PAYMENT'),
    paymentController.recordPayment
);

/**
 * Process online payment
 * POST /api/v1/billing/payments/online
 */
router.post('/payments/online',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    validateOnlinePayment,
    auditLogger('BILLING_PROCESS_ONLINE_PAYMENT'),
    paymentController.processOnlinePayment
);

/**
 * Verify payment
 * PUT /api/v1/billing/payments/:id/verify
 */
router.put('/payments/:id/verify',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    auditLogger('BILLING_VERIFY_PAYMENT'),
    paymentController.verifyPayment
);

/**
 * Get payment summary
 * GET /api/v1/billing/payments/summary
 */
router.get('/payments/summary',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_PAYMENT_SUMMARY'),
    paymentController.getPaymentSummary
);

// ============================================
// ============================================
// REFUND ROUTES (5 endpoints)
// ============================================
// ============================================

/**
 * Get all refunds
 * GET /api/v1/billing/refunds
 */
router.get('/refunds',
    authenticate,
    authorize('billing_staff'),
    standard,
    validatePagination,
    auditLogger('BILLING_VIEW_REFUNDS'),
    refundController.getAllRefunds
);

/**
 * Get pending refunds
 * GET /api/v1/billing/refunds/pending
 */
router.get('/refunds/pending',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_PENDING_REFUNDS'),
    refundController.getPendingRefunds
);

/**
 * Get completed refunds
 * GET /api/v1/billing/refunds/completed
 */
router.get('/refunds/completed',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_COMPLETED_REFUNDS'),
    refundController.getCompletedRefunds
);

/**
 * Get refund by ID
 * GET /api/v1/billing/refunds/:id
 */
router.get('/refunds/:id',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_REFUND'),
    refundController.getRefundById
);

/**
 * Process refund
 * POST /api/v1/billing/refunds
 * 
 * BUSINESS RULE: [BR-32] Refund only for paid invoices
 */
router.post('/refunds',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    validateRefund,
    auditLogger('BILLING_PROCESS_REFUND'),
    refundController.processRefund
);

/**
 * Approve refund
 * PUT /api/v1/billing/refunds/:id/approve
 */
router.put('/refunds/:id/approve',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    auditLogger('BILLING_APPROVE_REFUND'),
    refundController.approveRefund
);

/**
 * Complete refund
 * PUT /api/v1/billing/refunds/:id/complete
 */
router.put('/refunds/:id/complete',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    auditLogger('BILLING_COMPLETE_REFUND'),
    refundController.completeRefund
);

// ============================================
// ============================================
// INSURANCE CLAIM ROUTES (7 endpoints)
// ============================================
// ============================================

/**
 * Get all insurance claims
 * GET /api/v1/billing/insurance-claims
 */
router.get('/insurance-claims',
    authenticate,
    authorize('billing_staff'),
    standard,
    validatePagination,
    auditLogger('BILLING_VIEW_CLAIMS'),
    insuranceClaimController.getAllClaims
);

/**
 * Get draft claims
 * GET /api/v1/billing/insurance-claims/draft
 */
router.get('/insurance-claims/draft',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_DRAFT_CLAIMS'),
    insuranceClaimController.getDraftClaims
);

/**
 * Get submitted claims
 * GET /api/v1/billing/insurance-claims/submitted
 */
router.get('/insurance-claims/submitted',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_SUBMITTED_CLAIMS'),
    insuranceClaimController.getSubmittedClaims
);

/**
 * Get approved claims
 * GET /api/v1/billing/insurance-claims/approved
 */
router.get('/insurance-claims/approved',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_APPROVED_CLAIMS'),
    insuranceClaimController.getApprovedClaims
);

/**
 * Get rejected claims
 * GET /api/v1/billing/insurance-claims/rejected
 */
router.get('/insurance-claims/rejected',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_REJECTED_CLAIMS'),
    insuranceClaimController.getRejectedClaims
);

/**
 * Get claim by ID
 * GET /api/v1/billing/insurance-claims/:id
 */
router.get('/insurance-claims/:id',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_CLAIM'),
    insuranceClaimController.getClaimById
);

/**
 * Create insurance claim
 * POST /api/v1/billing/insurance-claims
 * 
 * BUSINESS RULE: [BR-33] Insurance claim requires pre-authorization
 */
router.post('/insurance-claims',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    validateClaimCreate,
    auditLogger('BILLING_CREATE_CLAIM'),
    insuranceClaimController.createClaim
);

/**
 * Update insurance claim
 * PUT /api/v1/billing/insurance-claims/:id
 */
router.put('/insurance-claims/:id',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    validateClaimUpdate,
    auditLogger('BILLING_UPDATE_CLAIM'),
    insuranceClaimController.updateClaim
);

/**
 * Submit insurance claim
 * PUT /api/v1/billing/insurance-claims/:id/submit
 */
router.put('/insurance-claims/:id/submit',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    auditLogger('BILLING_SUBMIT_CLAIM'),
    insuranceClaimController.submitClaim
);

/**
 * Track claim status
 * PUT /api/v1/billing/insurance-claims/:id/track
 */
router.put('/insurance-claims/:id/track',
    authenticate,
    authorize('billing_staff'),
    sensitive,
    auditLogger('BILLING_TRACK_CLAIM'),
    insuranceClaimController.trackClaim
);

// ============================================
// ============================================
// TAX & DISCOUNT ROUTES (8 endpoints)
// ============================================
// ============================================

/**
 * Get all tax rates
 * GET /api/v1/billing/tax-rates
 * 
 * BUSINESS RULE: [BR-35] Tax calculation follows government rules
 */
router.get('/tax-rates',
    authenticate,
    authorize('billing_admin'),
    standard,
    auditLogger('BILLING_VIEW_TAX_RATES'),
    taxDiscountController.getAllTaxRates
);

/**
 * Add tax rate
 * POST /api/v1/billing/tax-rates
 */
router.post('/tax-rates',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    validateTaxRate,
    auditLogger('BILLING_ADD_TAX_RATE'),
    taxDiscountController.addTaxRate
);

/**
 * Update tax rate
 * PUT /api/v1/billing/tax-rates/:id
 */
router.put('/tax-rates/:id',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    validateTaxRate,
    auditLogger('BILLING_UPDATE_TAX_RATE'),
    taxDiscountController.updateTaxRate
);

/**
 * Delete tax rate
 * DELETE /api/v1/billing/tax-rates/:id
 */
router.delete('/tax-rates/:id',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    auditLogger('BILLING_DELETE_TAX_RATE'),
    taxDiscountController.deleteTaxRate
);

/**
 * Get all discounts
 * GET /api/v1/billing/discounts
 * 
 * BUSINESS RULE: [BR-34] Discount cannot exceed maximum allowed
 */
router.get('/discounts',
    authenticate,
    authorize('billing_admin'),
    standard,
    auditLogger('BILLING_VIEW_DISCOUNTS'),
    taxDiscountController.getAllDiscounts
);

/**
 * Add discount
 * POST /api/v1/billing/discounts
 */
router.post('/discounts',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    validateDiscount,
    auditLogger('BILLING_ADD_DISCOUNT'),
    taxDiscountController.addDiscount
);

/**
 * Update discount
 * PUT /api/v1/billing/discounts/:id
 */
router.put('/discounts/:id',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    validateDiscount,
    auditLogger('BILLING_UPDATE_DISCOUNT'),
    taxDiscountController.updateDiscount
);

/**
 * Delete discount
 * DELETE /api/v1/billing/discounts/:id
 */
router.delete('/discounts/:id',
    authenticate,
    authorize('billing_admin'),
    sensitive,
    auditLogger('BILLING_DELETE_DISCOUNT'),
    taxDiscountController.deleteDiscount
);

// ============================================
// ============================================
// FINANCIAL REPORTS ROUTES (8 endpoints)
// ============================================
// ============================================

/**
 * Get daily report
 * GET /api/v1/billing/reports/daily
 */
router.get('/reports/daily',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_DAILY_REPORT'),
    reportController.getDailyReport
);

/**
 * Get weekly report
 * GET /api/v1/billing/reports/weekly
 */
router.get('/reports/weekly',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_WEEKLY_REPORT'),
    reportController.getWeeklyReport
);

/**
 * Get monthly report
 * GET /api/v1/billing/reports/monthly
 */
router.get('/reports/monthly',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_MONTHLY_REPORT'),
    reportController.getMonthlyReport
);

/**
 * Get yearly report
 * GET /api/v1/billing/reports/yearly
 */
router.get('/reports/yearly',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_YEARLY_REPORT'),
    reportController.getYearlyReport
);

/**
 * Get revenue report
 * GET /api/v1/billing/reports/revenue
 */
router.get('/reports/revenue',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_REVENUE_REPORT'),
    reportController.getRevenueReport
);

/**
 * Get outstanding report
 * GET /api/v1/billing/reports/outstanding
 */
router.get('/reports/outstanding',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_OUTSTANDING_REPORT'),
    reportController.getOutstandingReport
);

/**
 * Get insurance report
 * GET /api/v1/billing/reports/insurance
 */
router.get('/reports/insurance',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_INSURANCE_REPORT'),
    reportController.getInsuranceReport
);

/**
 * Get tax report
 * GET /api/v1/billing/reports/tax
 */
router.get('/reports/tax',
    authenticate,
    authorize('billing_staff'),
    standard,
    validateDateRange,
    auditLogger('BILLING_VIEW_TAX_REPORT'),
    reportController.getTaxReport
);

// ============================================
// ============================================
// DASHBOARD ROUTES (1 endpoint)
// ============================================
// ============================================

/**
 * Get billing dashboard
 * GET /api/v1/billing/dashboard
 */
router.get('/dashboard',
    authenticate,
    authorize('billing_staff'),
    standard,
    auditLogger('BILLING_VIEW_DASHBOARD'),
    dashboardController.getDashboard
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.0 - Protected with authentication

/**
 * Health check for billing module
 * GET /api/v1/billing/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('billing_staff'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Billing API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            staffId: req.user.id,
            endpoints: {
                total: 58,
                root: 1,
                invoices: 17,
                payments: 9,
                refunds: 5,
                insurance_claims: 7,
                tax_discount: 8,
                reports: 8,
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
 * Invoice Management | 17    | [BR-30]        | 🔒 Protected
 * Payment Management | 9     | [BR-31]        | 🔒 Protected
 * Refund Management  | 5     | [BR-32]        | 🔒 Protected
 * Insurance Claims   | 7     | [BR-33]        | 🔒 Protected
 * Tax & Discount     | 8     | [BR-34][BR-35] | 🔒 Protected
 * Financial Reports  | 8     | Analytics      | 🔒 Protected
 * Dashboard          | 1     | Overview       | 🔒 Protected
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 57    | Complete Billing Module
 * 
 * RBAC PERMISSIONS USED:
 * - billing_staff: Most billing operations
 * - billing_admin: Approvals, tax/discount configuration
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All data endpoints: Require valid authentication
 * 
 * ======================================================================
 */