/**
 * ======================================================================
 * FILE: backend/src/controllers/dashboard/billingDashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing dashboard controller - Handles billing dashboard data.
 * Total Endpoints: 4
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * ======================================================================
 */

const billingDashboardService = require('../../services/dashboard/billingDashboardService');
const logger = require('../../utils/logger');

const billingDashboardController = {
    /**
     * Get billing main dashboard
     * GET /api/v1/dashboard/billing
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await billingDashboardService.getDashboard(req.user.id);

            logger.info('Billing staff viewed dashboard', {
                staffId: req.user.id,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                data: dashboard,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error getting billing dashboard', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's collections
     * GET /api/v1/dashboard/billing/today
     */
    async getTodayCollections(req, res, next) {
        try {
            const collections = await billingDashboardService.getTodayCollections(req.user.id);

            logger.info('Billing staff viewed today\'s collections', {
                staffId: req.user.id,
                totalAmount: collections.total_amount
            });

            // Calculate payment method breakdown
            const byMethod = {
                cash: collections.cash_amount || 0,
                card: collections.card_amount || 0,
                upi: collections.upi_amount || 0,
                net_banking: collections.net_banking_amount || 0,
                insurance: collections.insurance_amount || 0
            };

            // Calculate hourly breakdown
            const hourlyBreakdown = collections.hourly_breakdown || {};

            res.json({
                success: true,
                data: collections,
                summary: {
                    total_amount: collections.total_amount,
                    total_count: collections.total_count,
                    average_amount: collections.total_count > 0 
                        ? (collections.total_amount / collections.total_count).toFixed(2)
                        : 0,
                    by_payment_method: byMethod,
                    peak_hour: Object.entries(hourlyBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
                    pending_verification: collections.pending_verification || 0
                }
            });
        } catch (error) {
            logger.error('Error getting billing today collections', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending invoices
     * GET /api/v1/dashboard/billing/pending
     */
    async getPendingInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20, days_overdue } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                days_overdue: days_overdue ? parseInt(days_overdue) : undefined
            };

            const invoices = await billingDashboardService.getPendingInvoices(
                req.user.id,
                options
            );

            logger.info('Billing staff viewed pending invoices', {
                staffId: req.user.id,
                count: invoices.data?.length || 0,
                totalAmount: invoices.summary?.total_amount || 0
            });

            // Calculate aging summary
            const agingSummary = {
                current: invoices.data?.filter(i => i.days_overdue <= 0).length || 0,
                days_1_30: invoices.data?.filter(i => i.days_overdue > 0 && i.days_overdue <= 30).length || 0,
                days_31_60: invoices.data?.filter(i => i.days_overdue > 30 && i.days_overdue <= 60).length || 0,
                days_61_90: invoices.data?.filter(i => i.days_overdue > 60 && i.days_overdue <= 90).length || 0,
                days_90_plus: invoices.data?.filter(i => i.days_overdue > 90).length || 0
            };

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                summary: {
                    total: invoices.summary?.total || 0,
                    total_amount: invoices.summary?.total_amount || 0,
                    avg_days_overdue: invoices.summary?.avg_days_overdue || 0,
                    aging_summary: agingSummary,
                    highest_overdue: invoices.data?.[0] || null
                }
            });
        } catch (error) {
            logger.error('Error getting billing pending invoices', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get insurance claims summary
     * GET /api/v1/dashboard/billing/insurance
     */
    async getInsuranceClaimsSummary(req, res, next) {
        try {
            const { from_date, to_date, status } = req.query;

            const options = {
                from_date,
                to_date,
                status
            };

            const summary = await billingDashboardService.getInsuranceClaimsSummary(
                req.user.id,
                options
            );

            logger.info('Billing staff viewed insurance claims summary', {
                staffId: req.user.id,
                totalClaims: summary.total_claims,
                totalAmount: summary.total_amount
            });

            // Calculate approval rate
            const approvalRate = summary.total_claims > 0
                ? ((summary.approved_claims / summary.total_claims) * 100).toFixed(1)
                : 0;

            // Calculate payment rate of approved claims
            const paymentRate = summary.approved_amount > 0
                ? ((summary.paid_amount / summary.approved_amount) * 100).toFixed(1)
                : 0;

            // Group by insurance provider
            const byProvider = summary.by_provider || {};

            res.json({
                success: true,
                data: summary,
                summary: {
                    total_claims: summary.total_claims,
                    total_amount: summary.total_amount,
                    pending_claims: summary.pending_claims,
                    approved_claims: summary.approved_claims,
                    approved_amount: summary.approved_amount,
                    paid_claims: summary.paid_claims,
                    paid_amount: summary.paid_amount,
                    rejected_claims: summary.rejected_claims,
                    rejected_amount: summary.rejected_amount,
                    approval_rate: parseFloat(approvalRate),
                    payment_rate: parseFloat(paymentRate),
                    avg_processing_days: summary.avg_processing_days || 0,
                    by_provider: byProvider
                }
            });
        } catch (error) {
            logger.error('Error getting billing insurance claims summary', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = billingDashboardController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Main Dashboard         | 1         | Complete billing dashboard
 * Collections            | 1         | Today's collections
 * Invoice Management     | 1         | Pending invoices with aging
 * Insurance Claims       | 1         | Insurance claims summary
 * -----------------------|-----------|----------------------
 * TOTAL                  | 4         | Complete billing dashboard management
 * 
 * ======================================================================
 */