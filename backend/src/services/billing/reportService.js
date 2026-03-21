/**
 * ======================================================================
 * FILE: backend/src/services/billing/reportService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing report service - Handles business logic for financial reports.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const reportService = {
    /**
     * Get daily report
     */
    async getDailyReport(staffId, options = {}) {
        try {
            const { date } = options;
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                WITH invoice_stats AS (
                    SELECT 
                        COUNT(*) as total_invoices,
                        SUM(total_amount) as total_amount,
                        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
                        SUM(total_amount) FILTER (WHERE status = 'paid') as paid_amount,
                        COUNT(*) FILTER (WHERE status = 'approved') as pending_count,
                        SUM(total_amount) FILTER (WHERE status = 'approved') as pending_amount,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count
                    FROM invoices
                    WHERE DATE(invoice_date) = $1 AND is_deleted = false
                ),
                payment_stats AS (
                    SELECT 
                        COUNT(*) as total_payments,
                        SUM(amount) as total_amount,
                        COUNT(*) FILTER (WHERE payment_method = 'cash') as cash_count,
                        SUM(amount) FILTER (WHERE payment_method = 'cash') as cash_amount,
                        COUNT(*) FILTER (WHERE payment_method = 'card') as card_count,
                        SUM(amount) FILTER (WHERE payment_method = 'card') as card_amount,
                        COUNT(*) FILTER (WHERE payment_method = 'upi') as upi_count,
                        SUM(amount) FILTER (WHERE payment_method = 'upi') as upi_amount,
                        COUNT(*) FILTER (WHERE payment_method = 'net_banking') as net_banking_count,
                        SUM(amount) FILTER (WHERE payment_method = 'net_banking') as net_banking_amount,
                        COUNT(*) FILTER (WHERE payment_method = 'insurance') as insurance_count,
                        SUM(amount) FILTER (WHERE payment_method = 'insurance') as insurance_amount
                    FROM payments
                    WHERE DATE(payment_date) = $1 AND status = 'completed'
                ),
                refund_stats AS (
                    SELECT 
                        COUNT(*) as total_refunds,
                        SUM(amount) as total_amount
                    FROM refunds
                    WHERE DATE(completed_at) = $1 AND status = 'completed'
                ),
                claim_stats AS (
                    SELECT 
                        COUNT(*) as total_claims,
                        SUM(claim_amount) as total_amount,
                        COUNT(*) FILTER (WHERE status = 'submitted') as submitted_count,
                        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
                        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
                        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count
                    FROM insurance_claims
                    WHERE DATE(created_at) = $1 AND is_deleted = false
                )
                SELECT 
                    (SELECT * FROM invoice_stats) as invoices,
                    (SELECT * FROM payment_stats) as payments,
                    (SELECT * FROM refund_stats) as refunds,
                    (SELECT * FROM claim_stats) as claims
            `;

            const result = await db.query(query, [targetDate]);
            
            const data = result.rows[0];
            const net_collection = (data.payments?.total_amount || 0) - (data.refunds?.total_amount || 0);

            return {
                date: targetDate,
                invoices: data.invoices || {},
                payments: data.payments || {},
                refunds: data.refunds || {},
                insurance_claims: data.claims || {},
                net_collection: net_collection,
                collection_rate: data.invoices?.total_amount > 0 
                    ? ((net_collection / data.invoices.total_amount) * 100).toFixed(2) 
                    : 0
            };
        } catch (error) {
            logger.error('Error in getDailyReport', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get weekly report
     */
    async getWeeklyReport(staffId, options = {}) {
        try {
            const { week, year } = options;
            
            let targetWeek = week;
            let targetYear = year;
            
            if (!targetWeek || !targetYear) {
                const now = new Date();
                targetYear = now.getFullYear();
                targetWeek = this.getWeekNumber(now);
            }

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(invoice_date) as date,
                        COUNT(DISTINCT i.id) as invoice_count,
                        SUM(i.total_amount) as invoice_amount,
                        COUNT(DISTINCT p.id) as payment_count,
                        SUM(p.amount) as payment_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    WHERE EXTRACT(YEAR FROM i.invoice_date) = $1 
                        AND EXTRACT(WEEK FROM i.invoice_date) = $2
                        AND i.is_deleted = false
                    GROUP BY DATE(i.invoice_date)
                    ORDER BY date
                ),
                weekly_summary AS (
                    SELECT 
                        COUNT(DISTINCT i.id) as total_invoices,
                        SUM(i.total_amount) as total_invoice_amount,
                        COUNT(DISTINCT p.id) as total_payments,
                        SUM(p.amount) as total_payment_amount,
                        COUNT(DISTINCT r.id) as total_refunds,
                        SUM(r.amount) as total_refund_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    LEFT JOIN refunds r ON p.id = r.payment_id AND r.status = 'completed'
                    WHERE EXTRACT(YEAR FROM i.invoice_date) = $1 
                        AND EXTRACT(WEEK FROM i.invoice_date) = $2
                        AND i.is_deleted = false
                )
                SELECT 
                    (SELECT json_agg(daily_stats.*) FROM daily_stats) as daily,
                    (SELECT * FROM weekly_summary) as summary
            `;

            const result = await db.query(query, [targetYear, targetWeek]);
            
            const data = result.rows[0];
            const net_collection = (data.summary?.total_payment_amount || 0) - (data.summary?.total_refund_amount || 0);

            return {
                year: targetYear,
                week: targetWeek,
                daily_breakdown: data.daily || [],
                summary: {
                    ...data.summary,
                    net_collection: net_collection,
                    collection_rate: data.summary?.total_invoice_amount > 0 
                        ? ((net_collection / data.summary.total_invoice_amount) * 100).toFixed(2) 
                        : 0
                }
            };
        } catch (error) {
            logger.error('Error in getWeeklyReport', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get monthly report
     */
    async getMonthlyReport(staffId, options = {}) {
        try {
            const { month, year } = options;
            
            let targetMonth = month;
            let targetYear = year;
            
            if (!targetMonth || !targetYear) {
                const now = new Date();
                targetYear = now.getFullYear();
                targetMonth = now.getMonth() + 1;
            }

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(invoice_date) as date,
                        COUNT(DISTINCT i.id) as invoice_count,
                        SUM(i.total_amount) as invoice_amount,
                        COUNT(DISTINCT p.id) as payment_count,
                        SUM(p.amount) as payment_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    WHERE EXTRACT(YEAR FROM i.invoice_date) = $1 
                        AND EXTRACT(MONTH FROM i.invoice_date) = $2
                        AND i.is_deleted = false
                    GROUP BY DATE(i.invoice_date)
                    ORDER BY date
                ),
                monthly_summary AS (
                    SELECT 
                        COUNT(DISTINCT i.id) as total_invoices,
                        SUM(i.total_amount) as total_invoice_amount,
                        COUNT(DISTINCT p.id) as total_payments,
                        SUM(p.amount) as total_payment_amount,
                        COUNT(DISTINCT r.id) as total_refunds,
                        SUM(r.amount) as total_refund_amount,
                        COUNT(DISTINCT c.id) as total_claims,
                        SUM(c.claim_amount) as total_claim_amount,
                        COUNT(DISTINCT CASE WHEN c.status = 'approved' THEN c.id END) as approved_claims,
                        SUM(CASE WHEN c.status = 'approved' THEN c.claim_amount ELSE 0 END) as approved_claim_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    LEFT JOIN refunds r ON p.id = r.payment_id AND r.status = 'completed'
                    LEFT JOIN insurance_claims c ON i.id = c.invoice_id AND c.is_deleted = false
                    WHERE EXTRACT(YEAR FROM i.invoice_date) = $1 
                        AND EXTRACT(MONTH FROM i.invoice_date) = $2
                        AND i.is_deleted = false
                )
                SELECT 
                    (SELECT json_agg(daily_stats.*) FROM daily_stats) as daily,
                    (SELECT * FROM monthly_summary) as summary
            `;

            const result = await db.query(query, [targetYear, targetMonth]);
            
            const data = result.rows[0];
            const net_collection = (data.summary?.total_payment_amount || 0) - (data.summary?.total_refund_amount || 0);

            return {
                year: targetYear,
                month: targetMonth,
                month_name: new Date(targetYear, targetMonth - 1, 1).toLocaleString('default', { month: 'long' }),
                daily_breakdown: data.daily || [],
                summary: {
                    ...data.summary,
                    net_collection: net_collection,
                    collection_rate: data.summary?.total_invoice_amount > 0 
                        ? ((net_collection / data.summary.total_invoice_amount) * 100).toFixed(2) 
                        : 0,
                    insurance_recovery_rate: data.summary?.total_claim_amount > 0 
                        ? ((data.summary.approved_claim_amount / data.summary.total_claim_amount) * 100).toFixed(2) 
                        : 0
                }
            };
        } catch (error) {
            logger.error('Error in getMonthlyReport', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get yearly report
     */
    async getYearlyReport(staffId, options = {}) {
        try {
            const { year } = options;
            
            let targetYear = year;
            if (!targetYear) {
                targetYear = new Date().getFullYear();
            }

            const query = `
                WITH monthly_stats AS (
                    SELECT 
                        EXTRACT(MONTH FROM invoice_date) as month,
                        COUNT(DISTINCT i.id) as invoice_count,
                        SUM(i.total_amount) as invoice_amount,
                        COUNT(DISTINCT p.id) as payment_count,
                        SUM(p.amount) as payment_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    WHERE EXTRACT(YEAR FROM i.invoice_date) = $1
                        AND i.is_deleted = false
                    GROUP BY EXTRACT(MONTH FROM i.invoice_date)
                    ORDER BY month
                ),
                yearly_summary AS (
                    SELECT 
                        COUNT(DISTINCT i.id) as total_invoices,
                        SUM(i.total_amount) as total_invoice_amount,
                        COUNT(DISTINCT p.id) as total_payments,
                        SUM(p.amount) as total_payment_amount,
                        COUNT(DISTINCT r.id) as total_refunds,
                        SUM(r.amount) as total_refund_amount,
                        COUNT(DISTINCT c.id) as total_claims,
                        SUM(c.claim_amount) as total_claim_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    LEFT JOIN refunds r ON p.id = r.payment_id AND r.status = 'completed'
                    LEFT JOIN insurance_claims c ON i.id = c.invoice_id AND c.is_deleted = false
                    WHERE EXTRACT(YEAR FROM i.invoice_date) = $1
                        AND i.is_deleted = false
                )
                SELECT 
                    (SELECT json_agg(monthly_stats.* ORDER BY month) FROM monthly_stats) as monthly,
                    (SELECT * FROM yearly_summary) as summary
            `;

            const result = await db.query(query, [targetYear]);
            
            const data = result.rows[0];
            const net_collection = (data.summary?.total_payment_amount || 0) - (data.summary?.total_refund_amount || 0);

            return {
                year: targetYear,
                monthly_breakdown: data.monthly || [],
                summary: {
                    ...data.summary,
                    net_collection: net_collection,
                    collection_rate: data.summary?.total_invoice_amount > 0 
                        ? ((net_collection / data.summary.total_invoice_amount) * 100).toFixed(2) 
                        : 0,
                    avg_monthly_invoice: data.summary?.total_invoice_amount / 12,
                    avg_monthly_payment: data.summary?.total_payment_amount / 12
                }
            };
        } catch (error) {
            logger.error('Error in getYearlyReport', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get revenue report
     */
    async getRevenueReport(staffId, options = {}) {
        try {
            const { from_date, to_date, group_by = 'day' } = options;

            let groupByClause;
            switch(group_by) {
                case 'day':
                    groupByClause = 'DATE(invoice_date)';
                    break;
                case 'week':
                    groupByClause = 'DATE_TRUNC(\'week\', invoice_date)';
                    break;
                case 'month':
                    groupByClause = 'DATE_TRUNC(\'month\', invoice_date)';
                    break;
                case 'quarter':
                    groupByClause = 'DATE_TRUNC(\'quarter\', invoice_date)';
                    break;
                default:
                    groupByClause = 'DATE(invoice_date)';
            }

            const query = `
                WITH revenue_data AS (
                    SELECT 
                        ${groupByClause} as period,
                        COUNT(DISTINCT i.id) as invoice_count,
                        SUM(i.total_amount) as gross_revenue,
                        SUM(i.discount) as total_discount,
                        SUM(i.tax_amount) as total_tax,
                        COUNT(DISTINCT p.id) as payment_count,
                        SUM(p.amount) as collected_amount,
                        COUNT(DISTINCT r.id) as refund_count,
                        SUM(r.amount) as refund_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    LEFT JOIN refunds r ON p.id = r.payment_id AND r.status = 'completed'
                    WHERE i.invoice_date BETWEEN $1 AND $2
                        AND i.is_deleted = false
                    GROUP BY ${groupByClause}
                    ORDER BY period
                ),
                totals AS (
                    SELECT 
                        SUM(gross_revenue) as total_gross_revenue,
                        SUM(total_discount) as total_discount,
                        SUM(total_tax) as total_tax,
                        SUM(collected_amount) as total_collected,
                        SUM(refund_amount) as total_refund
                    FROM revenue_data
                )
                SELECT 
                    (SELECT json_agg(revenue_data.*) FROM revenue_data) as breakdown,
                    (SELECT * FROM totals) as totals
            `;

            const result = await db.query(query, [from_date, to_date]);
            
            const data = result.rows[0];
            const net_revenue = (data.totals?.total_collected || 0) - (data.totals?.total_refund || 0);

            return {
                period: { from: from_date, to: to_date, group_by },
                breakdown: data.breakdown || [],
                summary: {
                    ...data.totals,
                    net_revenue: net_revenue,
                    collection_efficiency: data.totals?.total_gross_revenue > 0 
                        ? ((net_revenue / data.totals.total_gross_revenue) * 100).toFixed(2) 
                        : 0,
                    tax_rate_effective: data.totals?.total_gross_revenue > 0 
                        ? ((data.totals.total_tax / data.totals.total_gross_revenue) * 100).toFixed(2) 
                        : 0,
                    discount_rate: data.totals?.total_gross_revenue > 0 
                        ? ((data.totals.total_discount / data.totals.total_gross_revenue) * 100).toFixed(2) 
                        : 0
                }
            };
        } catch (error) {
            logger.error('Error in getRevenueReport', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get outstanding report
     */
    async getOutstandingReport(staffId, options = {}) {
        try {
            const { as_on_date } = options;
            const targetDate = as_on_date || new Date().toISOString().split('T')[0];

            const query = `
                WITH outstanding_invoices AS (
                    SELECT 
                        i.id,
                        i.invoice_number,
                        i.invoice_date,
                        i.due_date,
                        i.total_amount,
                        COALESCE(SUM(p.amount), 0) as paid_amount,
                        i.total_amount - COALESCE(SUM(p.amount), 0) as outstanding_amount,
                        EXTRACT(DAY FROM ($1::date - i.due_date)) as days_overdue,
                        p2.id as patient_id,
                        p2.first_name as patient_first_name,
                        p2.last_name as patient_last_name,
                        p2.phone as patient_phone
                    FROM invoices i
                    JOIN patients p2 ON i.patient_id = p2.id
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    WHERE i.status NOT IN ('paid', 'cancelled')
                        AND i.is_deleted = false
                    GROUP BY i.id, p2.id
                    HAVING i.total_amount - COALESCE(SUM(p.amount), 0) > 0
                ),
                aging_summary AS (
                    SELECT 
                        SUM(CASE WHEN days_overdue <= 0 THEN outstanding_amount ELSE 0 END) as current,
                        SUM(CASE WHEN days_overdue BETWEEN 1 AND 30 THEN outstanding_amount ELSE 0 END) as days_1_30,
                        SUM(CASE WHEN days_overdue BETWEEN 31 AND 60 THEN outstanding_amount ELSE 0 END) as days_31_60,
                        SUM(CASE WHEN days_overdue BETWEEN 61 AND 90 THEN outstanding_amount ELSE 0 END) as days_61_90,
                        SUM(CASE WHEN days_overdue > 90 THEN outstanding_amount ELSE 0 END) as days_90_plus,
                        SUM(outstanding_amount) as total_outstanding
                    FROM outstanding_invoices
                )
                SELECT 
                    (SELECT json_agg(outstanding_invoices.*) FROM outstanding_invoices) as invoices,
                    (SELECT * FROM aging_summary) as aging
            `;

            const result = await db.query(query, [targetDate]);
            
            const data = result.rows[0];

            return {
                as_on_date: targetDate,
                invoices: data.invoices || [],
                aging: data.aging || {},
                summary: {
                    total_outstanding: data.aging?.total_outstanding || 0,
                    current: data.aging?.current || 0,
                    overdue: (data.aging?.days_1_30 || 0) + (data.aging?.days_31_60 || 0) + 
                             (data.aging?.days_61_90 || 0) + (data.aging?.days_90_plus || 0),
                    overdue_rate: data.aging?.total_outstanding > 0 
                        ? (((data.aging?.days_1_30 || 0) + (data.aging?.days_31_60 || 0) + 
                            (data.aging?.days_61_90 || 0) + (data.aging?.days_90_plus || 0)) / 
                           data.aging.total_outstanding * 100).toFixed(2)
                        : 0
                }
            };
        } catch (error) {
            logger.error('Error in getOutstandingReport', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get insurance report
     */
    async getInsuranceReport(staffId, options = {}) {
        try {
            const { from_date, to_date, insurance_provider_id } = options;

            let providerFilter = '';
            if (insurance_provider_id) {
                providerFilter = `AND ip.id = '${insurance_provider_id}'`;
            }

            const query = `
                WITH claim_stats AS (
                    SELECT 
                        ip.id as provider_id,
                        ip.name as provider_name,
                        COUNT(c.id) as total_claims,
                        SUM(c.claim_amount) as total_claimed,
                        COUNT(c.id) FILTER (WHERE c.status = 'submitted') as submitted_count,
                        SUM(c.claim_amount) FILTER (WHERE c.status = 'submitted') as submitted_amount,
                        COUNT(c.id) FILTER (WHERE c.status = 'processing') as processing_count,
                        SUM(c.claim_amount) FILTER (WHERE c.status = 'processing') as processing_amount,
                        COUNT(c.id) FILTER (WHERE c.status = 'approved') as approved_count,
                        SUM(c.claim_amount) FILTER (WHERE c.status = 'approved') as approved_amount,
                        COUNT(c.id) FILTER (WHERE c.status = 'paid') as paid_count,
                        SUM(c.paid_amount) FILTER (WHERE c.status = 'paid') as paid_amount,
                        COUNT(c.id) FILTER (WHERE c.status = 'rejected') as rejected_count,
                        SUM(c.claim_amount) FILTER (WHERE c.status = 'rejected') as rejected_amount,
                        AVG(EXTRACT(EPOCH FROM (c.approved_at - c.created_at))/86400)::numeric(10,2) as avg_approval_days
                    FROM insurance_claims c
                    JOIN insurance_providers ip ON c.insurance_provider_id = ip.id
                    WHERE c.created_at BETWEEN $1 AND $2
                        AND c.is_deleted = false
                        ${providerFilter}
                    GROUP BY ip.id
                ),
                totals AS (
                    SELECT 
                        SUM(total_claims) as total_claims,
                        SUM(total_claimed) as total_claimed,
                        SUM(approved_amount) as total_approved,
                        SUM(paid_amount) as total_paid,
                        SUM(rejected_amount) as total_rejected
                    FROM claim_stats
                )
                SELECT 
                    (SELECT json_agg(claim_stats.*) FROM claim_stats) as by_provider,
                    (SELECT * FROM totals) as totals
            `;

            const result = await db.query(query, [from_date, to_date]);
            
            const data = result.rows[0];
            const approval_rate = data.totals?.total_claimed > 0 
                ? ((data.totals.total_approved / data.totals.total_claimed) * 100).toFixed(2) 
                : 0;
            const payment_rate = data.totals?.total_approved > 0 
                ? ((data.totals.total_paid / data.totals.total_approved) * 100).toFixed(2) 
                : 0;

            return {
                period: { from: from_date, to: to_date },
                by_provider: data.by_provider || [],
                summary: {
                    ...data.totals,
                    approval_rate: approval_rate,
                    payment_rate: payment_rate,
                    pending_approval: (data.totals?.total_claimed || 0) - (data.totals?.total_approved || 0) - (data.totals?.total_rejected || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getInsuranceReport', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get tax report
     */
    async getTaxReport(staffId, options = {}) {
        try {
            const { from_date, to_date, tax_type } = options;

            let taxFilter = '';
            if (tax_type) {
                taxFilter = `AND tax_type = '${tax_type}'`;
            }

            const query = `
                WITH tax_breakdown AS (
                    SELECT 
                        DATE(i.invoice_date) as date,
                        i.tax_type,
                        i.tax_rate,
                        SUM(i.tax_amount) as tax_amount,
                        COUNT(i.id) as invoice_count,
                        SUM(i.total_amount) as taxable_value
                    FROM invoices i
                    WHERE i.invoice_date BETWEEN $1 AND $2
                        AND i.tax_amount > 0
                        AND i.is_deleted = false
                        ${taxFilter}
                    GROUP BY DATE(i.invoice_date), i.tax_type, i.tax_rate
                    ORDER BY date
                ),
                tax_summary AS (
                    SELECT 
                        tax_type,
                        tax_rate,
                        SUM(tax_amount) as total_tax,
                        SUM(taxable_value) as total_taxable_value,
                        COUNT(*) as transaction_count
                    FROM tax_breakdown
                    GROUP BY tax_type, tax_rate
                ),
                totals AS (
                    SELECT 
                        SUM(tax_amount) as total_tax_collected,
                        SUM(taxable_value) as total_taxable_value,
                        COUNT(DISTINCT tax_type) as tax_types_used
                    FROM tax_breakdown
                )
                SELECT 
                    (SELECT json_agg(tax_breakdown.*) FROM tax_breakdown) as breakdown,
                    (SELECT json_agg(tax_summary.*) FROM tax_summary ORDER BY tax_type, tax_rate) as by_rate,
                    (SELECT * FROM totals) as totals
            `;

            const result = await db.query(query, [from_date, to_date]);
            
            const data = result.rows[0];
            const effective_tax_rate = data.totals?.total_taxable_value > 0 
                ? ((data.totals.total_tax_collected / data.totals.total_taxable_value) * 100).toFixed(2) 
                : 0;

            return {
                period: { from: from_date, to: to_date },
                breakdown: data.breakdown || [],
                by_tax_rate: data.by_rate || [],
                summary: {
                    ...data.totals,
                    effective_tax_rate: effective_tax_rate,
                    avg_tax_rate: data.by_rate?.reduce((sum, r) => sum + (r.tax_rate * r.total_tax / data.totals.total_tax_collected), 0) || 0
                }
            };
        } catch (error) {
            logger.error('Error in getTaxReport', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get week number for date
     */
    getWeekNumber(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 4 - (d.getDay() || 7));
        const yearStart = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    }
};

module.exports = reportService;