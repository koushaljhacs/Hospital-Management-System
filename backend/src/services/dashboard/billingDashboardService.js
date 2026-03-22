/**
 * ======================================================================
 * FILE: backend/src/services/dashboard/billingDashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing dashboard service - Handles business logic for billing dashboard.
 * Provides real-time financial insights, payment tracking, and insurance claims overview.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-31] Payment verification tracking
 * - [BR-32] Refund monitoring
 * - [BR-33] Insurance claim status tracking
 * - [BR-34] Discount usage analytics
 * - [BR-35] Tax collection summary
 * 
 * ENDPOINTS SUPPORTED:
 * - GET /api/v1/dashboard/billing - Main dashboard
 * - GET /api/v1/dashboard/billing/today - Today's collections
 * - GET /api/v1/dashboard/billing/pending - Pending invoices
 * - GET /api/v1/dashboard/billing/insurance - Insurance claims summary
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const billingDashboardService = {
    /**
     * Get billing main dashboard
     * GET /api/v1/dashboard/billing
     */
    async getDashboard(staffId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [
                todayCollections,
                pendingInvoices,
                insuranceClaimsSummary,
                revenueStats,
                paymentMethodStats,
                agingSummary
            ] = await Promise.all([
                this.getTodayCollections(staffId),
                this.getPendingInvoices(staffId, { page: 1, limit: 5 }),
                this.getInsuranceClaimsSummary(staffId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getRevenueStats(staffId, { from_date: firstDayOfMonth, to_date: today }),
                this.getPaymentMethodStats(staffId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getAgingSummary(staffId)
            ]);

            return {
                today_collections: todayCollections,
                pending_invoices: pendingInvoices,
                insurance_claims: insuranceClaimsSummary,
                revenue_stats: revenueStats,
                payment_method_stats: paymentMethodStats,
                aging_summary: agingSummary,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get today's collections
     * GET /api/v1/dashboard/billing/today
     */
    async getTodayCollections(staffId) {
        try {
            const query = `
                WITH today_payments AS (
                    SELECT 
                        p.*,
                        i.invoice_number,
                        i.patient_id,
                        pat.first_name as patient_first_name,
                        pat.last_name as patient_last_name
                    FROM payments p
                    JOIN invoices i ON p.invoice_id = i.id
                    JOIN patients pat ON i.patient_id = pat.id
                    WHERE DATE(p.payment_date) = CURRENT_DATE
                        AND p.status = 'completed'
                    ORDER BY p.payment_date DESC
                ),
                hourly_breakdown AS (
                    SELECT 
                        EXTRACT(HOUR FROM payment_date) as hour,
                        COUNT(*) as payment_count,
                        SUM(amount) as total_amount
                    FROM payments
                    WHERE DATE(payment_date) = CURRENT_DATE
                        AND status = 'completed'
                    GROUP BY EXTRACT(HOUR FROM payment_date)
                    ORDER BY hour
                )
                SELECT 
                    (SELECT COALESCE(SUM(amount), 0) FROM today_payments) as total_amount,
                    (SELECT COUNT(*) FROM today_payments) as total_count,
                    (SELECT COALESCE(AVG(amount), 0) FROM today_payments) as average_amount,
                    (SELECT json_agg(today_payments.*) FROM today_payments) as recent_payments,
                    (SELECT json_agg(hourly_breakdown.*) FROM hourly_breakdown) as hourly_breakdown,
                    (SELECT COALESCE(SUM(amount), 0) FROM payments 
                     WHERE DATE(payment_date) = CURRENT_DATE - 1 AND status = 'completed') as yesterday_amount,
                    (SELECT COUNT(*) FROM payments 
                     WHERE DATE(payment_date) = CURRENT_DATE - 1 AND status = 'completed') as yesterday_count
            `;

            const result = await db.query(query);
            const data = result.rows[0];
            
            // Calculate growth vs yesterday
            const yesterdayTotal = parseFloat(data.yesterday_amount) || 0;
            const todayTotal = parseFloat(data.total_amount) || 0;
            const growthPercent = yesterdayTotal > 0 
                ? ((todayTotal - yesterdayTotal) / yesterdayTotal * 100).toFixed(1)
                : (todayTotal > 0 ? 100 : 0);

            return {
                total_amount: parseFloat(data.total_amount) || 0,
                total_count: parseInt(data.total_count) || 0,
                average_amount: parseFloat(data.average_amount) || 0,
                recent_payments: data.recent_payments || [],
                hourly_breakdown: data.hourly_breakdown || [],
                yesterday_comparison: {
                    amount: yesterdayTotal,
                    count: parseInt(data.yesterday_count) || 0,
                    growth_percent: parseFloat(growthPercent)
                }
            };
        } catch (error) {
            logger.error('Error in getTodayCollections', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get pending invoices
     * GET /api/v1/dashboard/billing/pending
     */
    async getPendingInvoices(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, days_overdue } = options;
            const offset = (page - 1) * limit;

            let overdueFilter = '';
            if (days_overdue) {
                overdueFilter = `AND EXTRACT(DAY FROM (CURRENT_DATE - i.due_date)) >= ${days_overdue}`;
            }

            const query = `
                WITH pending_invoices AS (
                    SELECT 
                        i.id,
                        i.invoice_number,
                        i.issue_date,
                        i.due_date,
                        i.total_amount,
                        COALESCE(p.paid_amount, 0) as paid_amount,
                        (i.total_amount - COALESCE(p.paid_amount, 0)) as balance_due,
                        i.status,
                        EXTRACT(DAY FROM (CURRENT_DATE - i.due_date)) as days_overdue,
                        pat.id as patient_id,
                        pat.first_name as patient_first_name,
                        pat.last_name as patient_last_name,
                        pat.phone as patient_phone,
                        pat.email as patient_email
                    FROM invoices i
                    JOIN patients pat ON i.patient_id = pat.id
                    LEFT JOIN (
                        SELECT invoice_id, SUM(amount) as paid_amount
                        FROM payments
                        WHERE status = 'completed'
                        GROUP BY invoice_id
                    ) p ON i.id = p.invoice_id
                    WHERE i.status NOT IN ('paid', 'cancelled')
                        AND i.is_deleted = false
                        ${overdueFilter}
                    ORDER BY i.due_date ASC
                    LIMIT $1 OFFSET $2
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COALESCE(SUM(total_amount), 0) as total_amount,
                        COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as total_due,
                        COUNT(*) FILTER (WHERE days_overdue > 0) as overdue_count,
                        COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)) FILTER (WHERE days_overdue > 0), 0) as overdue_amount,
                        AVG(days_overdue) FILTER (WHERE days_overdue > 0) as avg_overdue_days
                    FROM pending_invoices
                )
                SELECT 
                    (SELECT json_agg(pending_invoices.*) FROM pending_invoices) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    total_amount: 0,
                    total_due: 0,
                    overdue_count: 0,
                    overdue_amount: 0,
                    avg_overdue_days: 0
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getPendingInvoices', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get insurance claims summary
     * GET /api/v1/dashboard/billing/insurance
     */
    async getInsuranceClaimsSummary(staffId, options = {}) {
        try {
            const { from_date, to_date, status } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND ic.submission_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND ic.submission_date > NOW() - INTERVAL '30 days'`;
            }

            let statusFilter = '';
            if (status) {
                statusFilter = `AND ic.status = '${status}'`;
            }

            const query = `
                WITH claim_stats AS (
                    SELECT 
                        ic.status,
                        COUNT(*) as claim_count,
                        COALESCE(SUM(ic.claim_amount), 0) as claim_amount,
                        COALESCE(SUM(ic.approved_amount), 0) as approved_amount,
                        COALESCE(SUM(ic.paid_amount), 0) as paid_amount,
                        AVG(EXTRACT(DAY FROM (ic.decision_date - ic.submission_date))) as avg_processing_days
                    FROM insurance_claims ic
                    WHERE ic.is_deleted = false
                        ${dateFilter}
                        ${statusFilter}
                    GROUP BY ic.status
                ),
                by_provider AS (
                    SELECT 
                        ip.name as provider_name,
                        COUNT(*) as claim_count,
                        COALESCE(SUM(ic.claim_amount), 0) as total_amount,
                        COALESCE(SUM(ic.approved_amount), 0) as approved_amount,
                        COALESCE(SUM(ic.paid_amount), 0) as paid_amount
                    FROM insurance_claims ic
                    JOIN insurance_providers ip ON ic.insurance_provider_id = ip.id
                    WHERE ic.is_deleted = false
                        ${dateFilter}
                    GROUP BY ip.name
                    ORDER BY claim_count DESC
                    LIMIT 5
                ),
                totals AS (
                    SELECT 
                        COUNT(*) as total_claims,
                        COALESCE(SUM(claim_amount), 0) as total_amount,
                        COALESCE(SUM(approved_amount), 0) as total_approved,
                        COALESCE(SUM(paid_amount), 0) as total_paid,
                        COUNT(*) FILTER (WHERE status = 'pending') as pending_claims,
                        COUNT(*) FILTER (WHERE status = 'approved') as approved_claims,
                        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_claims,
                        COUNT(*) FILTER (WHERE status = 'paid') as paid_claims
                    FROM insurance_claims
                    WHERE is_deleted = false
                        ${dateFilter}
                )
                SELECT 
                    (SELECT json_agg(claim_stats.*) FROM claim_stats) as by_status,
                    (SELECT json_agg(by_provider.*) FROM by_provider) as by_provider,
                    (SELECT row_to_json(totals.*) FROM totals) as totals
            `;

            const result = await db.query(query);
            const data = result.rows[0];
            
            // Calculate approval rate
            const totals = data?.totals || {};
            const approvalRate = totals.total_claims > 0 
                ? ((totals.approved_claims + totals.paid_claims) / totals.total_claims * 100).toFixed(1)
                : 0;
            
            // Calculate payment rate of approved claims
            const paymentRate = totals.total_approved > 0
                ? (totals.total_paid / totals.total_approved * 100).toFixed(1)
                : 0;

            return {
                by_status: data?.by_status || [],
                by_provider: data?.by_provider || [],
                totals: {
                    total_claims: parseInt(totals.total_claims) || 0,
                    total_amount: parseFloat(totals.total_amount) || 0,
                    total_approved: parseFloat(totals.total_approved) || 0,
                    total_paid: parseFloat(totals.total_paid) || 0,
                    pending_claims: parseInt(totals.pending_claims) || 0,
                    approved_claims: parseInt(totals.approved_claims) || 0,
                    rejected_claims: parseInt(totals.rejected_claims) || 0,
                    paid_claims: parseInt(totals.paid_claims) || 0,
                    approval_rate: parseFloat(approvalRate),
                    payment_rate: parseFloat(paymentRate)
                }
            };
        } catch (error) {
            logger.error('Error in getInsuranceClaimsSummary', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get revenue statistics
     * GET /api/v1/dashboard/billing/revenue-stats
     */
    async getRevenueStats(staffId, options = {}) {
        try {
            const { from_date, to_date, group_by = 'day' } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND i.issue_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND i.issue_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH revenue_data AS (
                    SELECT 
                        DATE_TRUNC('${group_by}', i.issue_date) as period,
                        COUNT(DISTINCT i.id) as invoice_count,
                        SUM(i.total_amount) as gross_revenue,
                        SUM(i.discount) as total_discount,
                        SUM(i.tax_amount) as total_tax,
                        SUM(i.total_amount - i.discount) as net_revenue,
                        COUNT(DISTINCT p.id) as payment_count,
                        SUM(p.amount) as collected_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    WHERE i.is_deleted = false
                        ${dateFilter}
                    GROUP BY DATE_TRUNC('${group_by}', i.issue_date)
                    ORDER BY period DESC
                ),
                totals AS (
                    SELECT 
                        SUM(gross_revenue) as total_gross_revenue,
                        SUM(total_discount) as total_discount,
                        SUM(total_tax) as total_tax,
                        SUM(net_revenue) as total_net_revenue,
                        SUM(collected_amount) as total_collected,
                        COUNT(*) as period_count
                    FROM revenue_data
                )
                SELECT 
                    (SELECT json_agg(revenue_data.*) FROM revenue_data) as breakdown,
                    (SELECT row_to_json(totals.*) FROM totals) as totals
            `;

            const result = await db.query(query);
            const data = result.rows[0];
            
            const totals = data?.totals || {};
            const collectionRate = totals.total_net_revenue > 0
                ? (totals.total_collected / totals.total_net_revenue * 100).toFixed(1)
                : 0;

            return {
                breakdown: data?.breakdown || [],
                totals: {
                    gross_revenue: parseFloat(totals.total_gross_revenue) || 0,
                    discount: parseFloat(totals.total_discount) || 0,
                    tax: parseFloat(totals.total_tax) || 0,
                    net_revenue: parseFloat(totals.total_net_revenue) || 0,
                    collected: parseFloat(totals.total_collected) || 0,
                    outstanding: (parseFloat(totals.total_net_revenue) || 0) - (parseFloat(totals.total_collected) || 0),
                    collection_rate: parseFloat(collectionRate)
                }
            };
        } catch (error) {
            logger.error('Error in getRevenueStats', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get payment method statistics
     * GET /api/v1/dashboard/billing/payment-method-stats
     */
    async getPaymentMethodStats(staffId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND payment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND payment_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    payment_method,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_amount,
                    AVG(amount) as average_amount,
                    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER() as percentage
                FROM payments
                WHERE status = 'completed'
                    AND is_deleted = false
                    ${dateFilter}
                GROUP BY payment_method
                ORDER BY total_amount DESC
            `;

            const result = await db.query(query);
            
            const data = result.rows.map(row => ({
                method: row.payment_method,
                transaction_count: parseInt(row.transaction_count),
                total_amount: parseFloat(row.total_amount),
                average_amount: parseFloat(row.average_amount),
                percentage: parseFloat(row.percentage).toFixed(1)
            }));

            return {
                breakdown: data,
                total_transactions: data.reduce((sum, d) => sum + d.transaction_count, 0),
                total_amount: data.reduce((sum, d) => sum + d.total_amount, 0)
            };
        } catch (error) {
            logger.error('Error in getPaymentMethodStats', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get aging summary (AR aging)
     * GET /api/v1/dashboard/billing/aging-summary
     */
    async getAgingSummary(staffId) {
        try {
            const query = `
                WITH aging_calculation AS (
                    SELECT 
                        i.id,
                        i.invoice_number,
                        i.total_amount,
                        COALESCE(p.paid_amount, 0) as paid_amount,
                        (i.total_amount - COALESCE(p.paid_amount, 0)) as balance_due,
                        i.due_date,
                        CASE 
                            WHEN i.due_date >= CURRENT_DATE THEN 'current'
                            WHEN i.due_date >= CURRENT_DATE - INTERVAL '30 days' THEN '1-30_days'
                            WHEN i.due_date >= CURRENT_DATE - INTERVAL '60 days' THEN '31-60_days'
                            WHEN i.due_date >= CURRENT_DATE - INTERVAL '90 days' THEN '61-90_days'
                            ELSE '90+_days'
                        END as aging_bucket
                    FROM invoices i
                    LEFT JOIN (
                        SELECT invoice_id, SUM(amount) as paid_amount
                        FROM payments
                        WHERE status = 'completed'
                        GROUP BY invoice_id
                    ) p ON i.id = p.invoice_id
                    WHERE i.status NOT IN ('paid', 'cancelled')
                        AND i.is_deleted = false
                )
                SELECT 
                    aging_bucket,
                    COUNT(*) as invoice_count,
                    SUM(balance_due) as total_due
                FROM aging_calculation
                GROUP BY aging_bucket
                ORDER BY 
                    CASE aging_bucket
                        WHEN 'current' THEN 1
                        WHEN '1-30_days' THEN 2
                        WHEN '31-60_days' THEN 3
                        WHEN '61-90_days' THEN 4
                        WHEN '90+_days' THEN 5
                    END
            `;

            const result = await db.query(query);
            const agingBuckets = result.rows;
            
            const totalDue = agingBuckets.reduce((sum, b) => sum + parseFloat(b.total_due), 0);
            
            return {
                buckets: agingBuckets.map(b => ({
                    bucket: b.aging_bucket,
                    invoice_count: parseInt(b.invoice_count),
                    total_due: parseFloat(b.total_due),
                    percentage: totalDue > 0 ? (parseFloat(b.total_due) / totalDue * 100).toFixed(1) : 0
                })),
                total_due: totalDue
            };
        } catch (error) {
            logger.error('Error in getAgingSummary', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get discount usage analytics
     * GET /api/v1/dashboard/billing/discount-analytics
     */
    async getDiscountAnalytics(staffId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND i.issue_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND i.issue_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    d.discount_name,
                    d.discount_type,
                    COUNT(i.id) as usage_count,
                    SUM(i.discount) as total_discount_amount,
                    AVG(i.discount) as avg_discount_amount,
                    SUM(i.total_amount) as total_invoice_amount
                FROM invoices i
                JOIN discounts d ON i.discount_id = d.id
                WHERE i.discount > 0
                    AND i.is_deleted = false
                    ${dateFilter}
                GROUP BY d.id, d.discount_name, d.discount_type
                ORDER BY usage_count DESC
                LIMIT 10
            `;

            const result = await db.query(query);
            
            return result.rows.map(row => ({
                discount_name: row.discount_name,
                discount_type: row.discount_type,
                usage_count: parseInt(row.usage_count),
                total_discount_amount: parseFloat(row.total_discount_amount),
                avg_discount_amount: parseFloat(row.avg_discount_amount),
                total_invoice_amount: parseFloat(row.total_invoice_amount),
                discount_rate: parseFloat(row.total_discount_amount) / parseFloat(row.total_invoice_amount) * 100
            }));
        } catch (error) {
            logger.error('Error in getDiscountAnalytics', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get tax collection summary
     * GET /api/v1/dashboard/billing/tax-summary
     */
    async getTaxSummary(staffId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND i.issue_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND i.issue_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    t.tax_name,
                    t.tax_type,
                    t.rate,
                    COUNT(i.id) as invoice_count,
                    SUM(i.tax_amount) as total_tax_collected
                FROM invoices i
                JOIN tax_rates t ON i.tax_rate_id = t.id
                WHERE i.is_deleted = false
                    ${dateFilter}
                GROUP BY t.id, t.tax_name, t.tax_type, t.rate
                ORDER BY total_tax_collected DESC
            `;

            const result = await db.query(query);
            
            const totalTax = result.rows.reduce((sum, r) => sum + parseFloat(r.total_tax_collected), 0);
            
            return {
                breakdown: result.rows.map(row => ({
                    tax_name: row.tax_name,
                    tax_type: row.tax_type,
                    rate: parseFloat(row.rate),
                    invoice_count: parseInt(row.invoice_count),
                    total_tax_collected: parseFloat(row.total_tax_collected),
                    percentage: totalTax > 0 ? (parseFloat(row.total_tax_collected) / totalTax * 100).toFixed(1) : 0
                })),
                total_tax_collected: totalTax
            };
        } catch (error) {
            logger.error('Error in getTaxSummary', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get refund statistics
     * GET /api/v1/dashboard/billing/refund-stats
     */
    async getRefundStats(staffId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND refund_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND refund_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    COUNT(*) as total_refunds,
                    SUM(refund_amount) as total_refund_amount,
                    AVG(refund_amount) as avg_refund_amount,
                    COUNT(*) FILTER (WHERE refund_reason = 'patient_request') as patient_request_count,
                    COUNT(*) FILTER (WHERE refund_reason = 'service_cancelled') as service_cancelled_count,
                    COUNT(*) FILTER (WHERE refund_reason = 'duplicate_payment') as duplicate_payment_count,
                    COUNT(*) FILTER (WHERE refund_reason = 'wrong_amount') as wrong_amount_count
                FROM refunds
                WHERE is_deleted = false
                    ${dateFilter}
            `;

            const result = await db.query(query);
            const data = result.rows[0];
            
            return {
                total_refunds: parseInt(data.total_refunds) || 0,
                total_amount: parseFloat(data.total_refund_amount) || 0,
                average_amount: parseFloat(data.avg_refund_amount) || 0,
                by_reason: {
                    patient_request: parseInt(data.patient_request_count) || 0,
                    service_cancelled: parseInt(data.service_cancelled_count) || 0,
                    duplicate_payment: parseInt(data.duplicate_payment_count) || 0,
                    wrong_amount: parseInt(data.wrong_amount_count) || 0
                }
            };
        } catch (error) {
            logger.error('Error in getRefundStats', { error: error.message, staffId });
            throw error;
        }
    }
};

module.exports = billingDashboardService;