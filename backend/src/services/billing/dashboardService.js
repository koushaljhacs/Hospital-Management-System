/**
 * ======================================================================
 * FILE: backend/src/services/billing/dashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing dashboard service - Handles business logic for billing dashboard.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const dashboardService = {
    /**
     * Get main dashboard data
     */
    async getDashboard(staffId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Run all dashboard queries in parallel
            const [
                todayStats,
                monthStats,
                pendingStats,
                overdueStats,
                recentInvoices,
                recentPayments,
                topPatients,
                alerts,
                revenueTrend,
                agingSummary
            ] = await Promise.all([
                // Today's statistics
                db.query(`
                    SELECT 
                        COUNT(DISTINCT i.id) as invoices,
                        COALESCE(SUM(i.total_amount), 0) as invoice_amount,
                        COUNT(DISTINCT p.id) as payments,
                        COALESCE(SUM(p.amount), 0) as payment_amount,
                        COUNT(DISTINCT r.id) as refunds,
                        COALESCE(SUM(r.amount), 0) as refund_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id 
                        AND DATE(p.payment_date) = CURRENT_DATE 
                        AND p.status = 'completed'
                    LEFT JOIN refunds r ON p.id = r.payment_id 
                        AND DATE(r.completed_at) = CURRENT_DATE 
                        AND r.status = 'completed'
                    WHERE DATE(i.invoice_date) = CURRENT_DATE 
                        AND i.is_deleted = false
                `),

                // Month to date statistics
                db.query(`
                    SELECT 
                        COUNT(DISTINCT i.id) as invoices,
                        COALESCE(SUM(i.total_amount), 0) as invoice_amount,
                        COUNT(DISTINCT p.id) as payments,
                        COALESCE(SUM(p.amount), 0) as payment_amount,
                        COUNT(DISTINCT r.id) as refunds,
                        COALESCE(SUM(r.amount), 0) as refund_amount
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id 
                        AND p.payment_date >= $1 
                        AND p.status = 'completed'
                    LEFT JOIN refunds r ON p.id = r.payment_id 
                        AND r.completed_at >= $1 
                        AND r.status = 'completed'
                    WHERE i.invoice_date >= $1 
                        AND i.is_deleted = false
                `, [firstDayOfMonth]),

                // Pending invoices
                db.query(`
                    SELECT 
                        COUNT(*) as pending_count,
                        COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as pending_amount
                    FROM invoices i
                    LEFT JOIN (
                        SELECT invoice_id, SUM(amount) as paid_amount
                        FROM payments
                        WHERE status = 'completed'
                        GROUP BY invoice_id
                    ) p ON i.id = p.invoice_id
                    WHERE i.status NOT IN ('paid', 'cancelled')
                        AND i.is_deleted = false
                `),

                // Overdue invoices
                db.query(`
                    SELECT 
                        COUNT(*) as overdue_count,
                        COALESCE(SUM(total_amount - COALESCE(paid_amount, 0)), 0) as overdue_amount,
                        AVG(EXTRACT(DAY FROM (NOW() - i.due_date)))::numeric(10,2) as avg_days_overdue
                    FROM invoices i
                    LEFT JOIN (
                        SELECT invoice_id, SUM(amount) as paid_amount
                        FROM payments
                        WHERE status = 'completed'
                        GROUP BY invoice_id
                    ) p ON i.id = p.invoice_id
                    WHERE i.due_date < NOW()
                        AND i.status NOT IN ('paid', 'cancelled')
                        AND i.is_deleted = false
                `),

                // Recent invoices
                db.query(`
                    SELECT 
                        i.id,
                        i.invoice_number,
                        i.invoice_date,
                        i.total_amount,
                        i.status,
                        CONCAT(p.first_name, ' ', p.last_name) as patient_name
                    FROM invoices i
                    JOIN patients p ON i.patient_id = p.id
                    WHERE i.is_deleted = false
                    ORDER BY i.created_at DESC
                    LIMIT 10
                `),

                // Recent payments
                db.query(`
                    SELECT 
                        p.id,
                        p.payment_number,
                        p.amount,
                        p.payment_method,
                        p.payment_date,
                        i.invoice_number,
                        CONCAT(pat.first_name, ' ', pat.last_name) as patient_name
                    FROM payments p
                    JOIN invoices i ON p.invoice_id = i.id
                    JOIN patients pat ON i.patient_id = pat.id
                    WHERE p.status = 'completed'
                    ORDER BY p.payment_date DESC
                    LIMIT 10
                `),

                // Top patients by invoice amount
                db.query(`
                    SELECT 
                        p.id as patient_id,
                        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                        COUNT(i.id) as invoice_count,
                        SUM(i.total_amount) as total_amount,
                        SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as paid_amount
                    FROM patients p
                    JOIN invoices i ON p.id = i.patient_id
                    WHERE i.created_at > NOW() - INTERVAL '30 days'
                        AND i.is_deleted = false
                    GROUP BY p.id
                    ORDER BY total_amount DESC
                    LIMIT 10
                `),

                // Critical alerts
                db.query(`
                    SELECT 
                        'low_collection' as type,
                        'Collection rate below 70%' as title,
                        CONCAT('Current collection rate is ', 
                            ROUND((COALESCE(SUM(p.amount), 0) / NULLIF(SUM(i.total_amount), 0) * 100), 1), 
                            '%') as message,
                        'warning' as severity,
                        NOW() as created_at
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    WHERE i.created_at > NOW() - INTERVAL '30 days'
                    HAVING (COALESCE(SUM(p.amount), 0) / NULLIF(SUM(i.total_amount), 0) * 100) < 70
                    
                    UNION ALL
                    
                    SELECT 
                        'high_overdue' as type,
                        'High overdue amount' as title,
                        CONCAT('Overdue amount: ', 
                            ROUND(COALESCE(SUM(i.total_amount - COALESCE(p.paid_amount, 0)), 0), 2)) as message,
                        CASE 
                            WHEN COALESCE(SUM(i.total_amount - COALESCE(p.paid_amount, 0)), 0) > 100000 THEN 'critical'
                            ELSE 'warning'
                        END as severity,
                        NOW() as created_at
                    FROM invoices i
                    LEFT JOIN (
                        SELECT invoice_id, SUM(amount) as paid_amount
                        FROM payments
                        WHERE status = 'completed'
                        GROUP BY invoice_id
                    ) p ON i.id = p.invoice_id
                    WHERE i.due_date < NOW()
                        AND i.status NOT IN ('paid', 'cancelled')
                    HAVING COALESCE(SUM(i.total_amount - COALESCE(p.paid_amount, 0)), 0) > 50000
                    
                    UNION ALL
                    
                    SELECT 
                        'pending_claims' as type,
                        'Pending insurance claims' as title,
                        CONCAT(COUNT(*), ' claims pending approval worth ', 
                            ROUND(SUM(claim_amount), 2)) as message,
                        'info' as severity,
                        NOW() as created_at
                    FROM insurance_claims
                    WHERE status IN ('submitted', 'processing')
                        AND is_deleted = false
                    HAVING COUNT(*) > 10
                    
                    LIMIT 10
                `),

                // Revenue trend (last 7 days)
                db.query(`
                    SELECT 
                        DATE(payment_date) as date,
                        COALESCE(SUM(amount), 0) as revenue,
                        COUNT(*) as transaction_count
                    FROM payments
                    WHERE payment_date > NOW() - INTERVAL '7 days'
                        AND status = 'completed'
                    GROUP BY DATE(payment_date)
                    ORDER BY date ASC
                `),

                // Aging summary
                db.query(`
                    WITH aging AS (
                        SELECT 
                            CASE 
                                WHEN i.due_date >= NOW() THEN 'current'
                                WHEN i.due_date >= NOW() - INTERVAL '30 days' THEN '1-30 days'
                                WHEN i.due_date >= NOW() - INTERVAL '60 days' THEN '31-60 days'
                                WHEN i.due_date >= NOW() - INTERVAL '90 days' THEN '61-90 days'
                                ELSE '90+ days'
                            END as aging_bucket,
                            i.total_amount - COALESCE(p.paid_amount, 0) as outstanding
                        FROM invoices i
                        LEFT JOIN (
                            SELECT invoice_id, SUM(amount) as paid_amount
                            FROM payments
                            WHERE status = 'completed'
                            GROUP BY invoice_id
                        ) p ON i.id = p.invoice_id
                        WHERE i.status NOT IN ('paid', 'cancelled')
                            AND i.is_deleted = false
                            AND i.total_amount - COALESCE(p.paid_amount, 0) > 0
                    )
                    SELECT 
                        aging_bucket,
                        COUNT(*) as invoice_count,
                        COALESCE(SUM(outstanding), 0) as amount,
                        ROUND(COALESCE(SUM(outstanding), 0) / NULLIF(SUM(SUM(outstanding)) OVER(), 0) * 100, 2) as percentage
                    FROM aging
                    GROUP BY aging_bucket
                    ORDER BY 
                        CASE aging_bucket
                            WHEN 'current' THEN 1
                            WHEN '1-30 days' THEN 2
                            WHEN '31-60 days' THEN 3
                            WHEN '61-90 days' THEN 4
                            WHEN '90+ days' THEN 5
                        END
                `)
            ]);

            // Calculate net collection
            const todayNet = (todayStats.rows[0]?.payment_amount || 0) - (todayStats.rows[0]?.refund_amount || 0);
            const monthNet = (monthStats.rows[0]?.payment_amount || 0) - (monthStats.rows[0]?.refund_amount || 0);

            // Calculate collection rate
            const collectionRate = monthStats.rows[0]?.invoice_amount > 0
                ? ((monthNet / monthStats.rows[0].invoice_amount) * 100).toFixed(1)
                : 0;

            return {
                statistics: {
                    today: {
                        invoices: parseInt(todayStats.rows[0]?.invoices || 0),
                        invoice_amount: parseFloat(todayStats.rows[0]?.invoice_amount || 0),
                        payments: parseInt(todayStats.rows[0]?.payments || 0),
                        payment_amount: parseFloat(todayStats.rows[0]?.payment_amount || 0),
                        net_collection: todayNet,
                        refunds: parseInt(todayStats.rows[0]?.refunds || 0),
                        refund_amount: parseFloat(todayStats.rows[0]?.refund_amount || 0)
                    },
                    month_to_date: {
                        invoices: parseInt(monthStats.rows[0]?.invoices || 0),
                        invoice_amount: parseFloat(monthStats.rows[0]?.invoice_amount || 0),
                        payments: parseInt(monthStats.rows[0]?.payments || 0),
                        payment_amount: parseFloat(monthStats.rows[0]?.payment_amount || 0),
                        net_collection: monthNet,
                        refunds: parseInt(monthStats.rows[0]?.refunds || 0),
                        refund_amount: parseFloat(monthStats.rows[0]?.refund_amount || 0),
                        collection_rate: parseFloat(collectionRate)
                    },
                    pending: {
                        count: parseInt(pendingStats.rows[0]?.pending_count || 0),
                        amount: parseFloat(pendingStats.rows[0]?.pending_amount || 0)
                    },
                    overdue: {
                        count: parseInt(overdueStats.rows[0]?.overdue_count || 0),
                        amount: parseFloat(overdueStats.rows[0]?.overdue_amount || 0),
                        avg_days: parseFloat(overdueStats.rows[0]?.avg_days_overdue || 0)
                    }
                },
                recent_activity: {
                    invoices: recentInvoices.rows,
                    payments: recentPayments.rows
                },
                top_patients: topPatients.rows,
                alerts: alerts.rows,
                trends: {
                    revenue: revenueTrend.rows,
                    aging_summary: agingSummary.rows
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, staffId });
            throw error;
        }
    }
};

module.exports = dashboardService;