/**
 * ======================================================================
 * FILE: backend/src/services/pharmacist/dashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist dashboard service - Handles business logic for pharmacy dashboard.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-20] Alert when stock < reorder level
 * - [BR-21] Alert 30 days before expiry
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const dashboardService = {
    /**
     * Get main dashboard
     */
    async getDashboard(pharmacistId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Run all dashboard queries in parallel
            const [
                stats,
                lowStock,
                expiring,
                pendingPrescriptions,
                recentDispensing,
                recentOrders,
                topMedicines,
                alerts
            ] = await Promise.all([
                // Key statistics
                db.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM inventory WHERE is_deleted = false) as total_items,
                        (SELECT SUM(quantity) FROM inventory WHERE is_deleted = false) as total_quantity,
                        (SELECT SUM(quantity * unit_price) FROM inventory WHERE is_deleted = false) as inventory_value,
                        (SELECT COUNT(*) FROM prescriptions WHERE status = 'pending') as pending_prescriptions,
                        (SELECT COUNT(*) FROM suppliers WHERE status = 'active') as active_suppliers,
                        (SELECT COUNT(*) FROM purchase_orders WHERE status = 'pending') as pending_orders
                `),

                // Low stock items [BR-20]
                db.query(`
                    SELECT 
                        COUNT(*) as low_stock_count,
                        SUM(quantity) as low_stock_quantity,
                        SUM((reorder_level - quantity) * unit_price) as estimated_restock_cost
                    FROM inventory
                    WHERE quantity <= reorder_level AND is_deleted = false
                `),

                // Expiring items [BR-21]
                db.query(`
                    SELECT 
                        COUNT(*) as expiring_count,
                        SUM(quantity) as expiring_quantity,
                        SUM(quantity * unit_price) as expiring_value
                    FROM batches b
                    JOIN inventory i ON b.medicine_id = i.id
                    WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                        AND b.quantity > 0
                `),

                // Pending prescriptions with details
                db.query(`
                    SELECT 
                        p.id, p.created_at,
                        CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                        CONCAT(doc.first_name, ' ', doc.last_name) as doctor_name,
                        COUNT(pm.id) as medicine_count
                    FROM prescriptions p
                    JOIN patients pat ON p.patient_id = pat.id
                    JOIN employees doc ON p.doctor_id = doc.id
                    LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
                    WHERE p.status = 'pending'
                    GROUP BY p.id, pat.id, doc.id
                    ORDER BY p.created_at ASC
                    LIMIT 10
                `),

                // Recent dispensing
                db.query(`
                    SELECT 
                        d.id, d.dispensed_at, d.total_value,
                        CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                        p.id as prescription_id
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    JOIN patients pat ON p.patient_id = pat.id
                    ORDER BY d.dispensed_at DESC
                    LIMIT 10
                `),

                // Recent purchase orders
                db.query(`
                    SELECT 
                        po.id, po.po_number, po.order_date,
                        po.expected_delivery, po.total_amount, po.status,
                        s.name as supplier_name
                    FROM purchase_orders po
                    JOIN suppliers s ON po.supplier_id = s.id
                    WHERE po.status IN ('pending', 'approved')
                    ORDER BY po.expected_delivery ASC
                    LIMIT 10
                `),

                // Top medicines this month
                db.query(`
                    SELECT 
                        i.medicine_name,
                        SUM(di.quantity) as total_dispensed,
                        SUM(di.quantity * di.unit_price) as total_value
                    FROM dispensing_items di
                    JOIN batches b ON di.batch_id = b.id
                    JOIN inventory i ON b.medicine_id = i.id
                    JOIN dispensing_records d ON di.dispensing_id = d.id
                    WHERE d.dispensed_at >= $1
                    GROUP BY i.medicine_name
                    ORDER BY total_dispensed DESC
                    LIMIT 5
                `, [thirtyDaysAgo]),

                // All alerts
                this.getAllAlerts(pharmacistId)
            ]);

            return {
                statistics: {
                    total_items: parseInt(stats.rows[0]?.total_items || 0),
                    total_quantity: parseInt(stats.rows[0]?.total_quantity || 0),
                    inventory_value: parseFloat(stats.rows[0]?.inventory_value || 0),
                    pending_prescriptions: parseInt(stats.rows[0]?.pending_prescriptions || 0),
                    active_suppliers: parseInt(stats.rows[0]?.active_suppliers || 0),
                    pending_orders: parseInt(stats.rows[0]?.pending_orders || 0)
                },
                alerts: {
                    low_stock: {
                        count: parseInt(lowStock.rows[0]?.low_stock_count || 0),
                        quantity: parseInt(lowStock.rows[0]?.low_stock_quantity || 0),
                        estimated_restock_cost: parseFloat(lowStock.rows[0]?.estimated_restock_cost || 0)
                    },
                    expiring: {
                        count: parseInt(expiring.rows[0]?.expiring_count || 0),
                        quantity: parseInt(expiring.rows[0]?.expiring_quantity || 0),
                        value: parseFloat(expiring.rows[0]?.expiring_value || 0)
                    },
                    all: alerts
                },
                pending_prescriptions: pendingPrescriptions.rows,
                recent_dispensing: recentDispensing.rows,
                recent_orders: recentOrders.rows,
                top_medicines: topMedicines.rows,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get low stock summary [BR-20]
     */
    async getLowStockSummary(pharmacistId) {
        try {
            const query = `
                WITH low_stock_items AS (
                    SELECT 
                        i.*,
                        (i.reorder_level - i.quantity) as required_quantity,
                        ((i.reorder_level - i.quantity) * i.unit_price) as estimated_cost,
                        CASE 
                            WHEN i.quantity = 0 THEN 'out_of_stock'
                            WHEN i.quantity <= i.minimum_stock THEN 'critical'
                            ELSE 'low'
                        END as severity
                    FROM inventory i
                    WHERE i.quantity <= i.reorder_level AND i.is_deleted = false
                )
                SELECT 
                    COUNT(*) as low_stock_count,
                    SUM(quantity) as total_quantity,
                    SUM(required_quantity) as total_required,
                    SUM(estimated_cost) as estimated_restock_value,
                    COUNT(*) FILTER (WHERE severity = 'critical') as critical_items,
                    COUNT(*) FILTER (WHERE severity = 'out_of_stock') as out_of_stock_count,
                    json_agg(
                        json_build_object(
                            'id', id,
                            'medicine_name', medicine_name,
                            'quantity', quantity,
                            'reorder_level', reorder_level,
                            'required_quantity', required_quantity,
                            'estimated_cost', estimated_cost,
                            'severity', severity,
                            'location', location
                        ) ORDER BY 
                            CASE severity
                                WHEN 'out_of_stock' THEN 1
                                WHEN 'critical' THEN 2
                                ELSE 3
                            END,
                            required_quantity DESC
                    ) as items
                FROM low_stock_items
            `;

            const result = await db.query(query);
            return result.rows[0] || {
                low_stock_count: 0,
                total_quantity: 0,
                total_required: 0,
                estimated_restock_value: 0,
                critical_items: 0,
                out_of_stock_count: 0,
                items: []
            };
        } catch (error) {
            logger.error('Error in getLowStockSummary', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get low stock detail
     */
    async getLowStockDetail(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    i.*,
                    s.name as supplier_name,
                    (i.reorder_level - i.quantity) as required_quantity,
                    ((i.reorder_level - i.quantity) * i.unit_price) as estimated_cost,
                    CASE 
                        WHEN i.quantity = 0 THEN 'out_of_stock'
                        WHEN i.quantity <= i.minimum_stock THEN 'critical'
                        ELSE 'low'
                    END as severity
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.quantity <= i.reorder_level AND i.is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN i.quantity = 0 THEN 1
                        WHEN i.quantity <= i.minimum_stock THEN 2
                        ELSE 3
                    END,
                    (i.reorder_level - i.quantity) DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM inventory
                WHERE quantity <= reorder_level AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getLowStockDetail', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiring summary [BR-21]
     */
    async getExpiringSummary(pharmacistId, days = 30) {
        try {
            const query = `
                WITH expiring_items AS (
                    SELECT 
                        b.id,
                        b.batch_number,
                        b.quantity,
                        b.expiry_date,
                        b.unit_price,
                        (b.quantity * b.unit_price) as total_value,
                        i.medicine_name,
                        i.location,
                        EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                        CASE 
                            WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                            WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                            ELSE 'notice'
                        END as urgency
                    FROM batches b
                    JOIN inventory i ON b.medicine_id = i.id
                    WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
                        AND b.quantity > 0
                )
                SELECT 
                    COUNT(*) as expiring_count,
                    SUM(quantity) as expiring_quantity,
                    SUM(total_value) as total_value_at_risk,
                    COUNT(*) FILTER (WHERE urgency = 'critical') as critical_count,
                    COUNT(*) FILTER (WHERE urgency = 'warning') as warning_count,
                    COUNT(*) FILTER (WHERE urgency = 'notice') as notice_count,
                    json_agg(
                        json_build_object(
                            'id', id,
                            'medicine_name', medicine_name,
                            'batch_number', batch_number,
                            'quantity', quantity,
                            'expiry_date', expiry_date,
                            'days_until_expiry', days_until_expiry,
                            'total_value', total_value,
                            'urgency', urgency,
                            'location', location
                        ) ORDER BY 
                            CASE urgency
                                WHEN 'critical' THEN 1
                                WHEN 'warning' THEN 2
                                ELSE 3
                            END,
                            expiry_date ASC
                    ) as items
                FROM expiring_items
            `;

            const result = await db.query(query);
            return result.rows[0] || {
                expiring_count: 0,
                expiring_quantity: 0,
                total_value_at_risk: 0,
                critical_count: 0,
                warning_count: 0,
                notice_count: 0,
                items: []
            };
        } catch (error) {
            logger.error('Error in getExpiringSummary', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiring detail
     */
    async getExpiringDetail(pharmacistId, options = {}) {
        try {
            const { days = 30, page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    b.*,
                    i.medicine_name,
                    i.location,
                    EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                    (b.quantity * b.unit_price) as total_value,
                    CASE 
                        WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                        WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                        ELSE 'notice'
                    END as urgency
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
                    AND b.quantity > 0
                ORDER BY 
                    CASE 
                        WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 1
                        WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 2
                        ELSE 3
                    END,
                    b.expiry_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM batches b
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
                    AND b.quantity > 0
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getExpiringDetail', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get today's overview
     */
    async getTodaysOverview(pharmacistId) {
        try {
            const today = new Date().toISOString().split('T')[0];

            const [dispensing, orders, returns] = await Promise.all([
                // Today's dispensing
                db.query(`
                    SELECT 
                        COUNT(*) as count,
                        SUM(total_items) as items,
                        SUM(total_value) as value
                    FROM dispensing_records
                    WHERE DATE(dispensed_at) = $1
                `, [today]),

                // Today's received orders
                db.query(`
                    SELECT 
                        COUNT(*) as count,
                        SUM(total_amount) as value
                    FROM purchase_orders
                    WHERE DATE(actual_delivery) = $1
                `, [today]),

                // Today's returns
                db.query(`
                    SELECT 
                        COUNT(*) as count,
                        SUM(quantity) as quantity
                    FROM returns
                    WHERE DATE(returned_at) = $1
                `, [today])
            ]);

            return {
                today_dispensing: {
                    count: parseInt(dispensing.rows[0]?.count || 0),
                    items: parseInt(dispensing.rows[0]?.items || 0),
                    value: parseFloat(dispensing.rows[0]?.value || 0)
                },
                today_orders: {
                    received: parseInt(orders.rows[0]?.count || 0),
                    value: parseFloat(orders.rows[0]?.value || 0)
                },
                today_returns: {
                    count: parseInt(returns.rows[0]?.count || 0),
                    quantity: parseInt(returns.rows[0]?.quantity || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getTodaysOverview', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get today's dispensing
     */
    async getTodaysDispensing(pharmacistId) {
        try {
            const query = `
                SELECT 
                    d.id,
                    d.dispensed_at,
                    d.total_items,
                    d.total_value,
                    CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                    p.id as prescription_id,
                    COUNT(di.id) as item_count,
                    SUM(di.quantity) as total_quantity
                FROM dispensing_records d
                JOIN prescriptions p ON d.prescription_id = p.id
                JOIN patients pat ON p.patient_id = pat.id
                LEFT JOIN dispensing_items di ON d.id = di.dispensing_id
                WHERE DATE(d.dispensed_at) = CURRENT_DATE
                GROUP BY d.id, p.id, pat.id
                ORDER BY d.dispensed_at DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysDispensing', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get today's received orders
     */
    async getTodaysReceivedOrders(pharmacistId) {
        try {
            const query = `
                SELECT 
                    po.id,
                    po.po_number,
                    po.actual_delivery as received_at,
                    po.total_amount,
                    s.name as supplier_name,
                    COUNT(poi.id) as item_count,
                    SUM(poi.quantity) as total_quantity
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
                WHERE DATE(po.actual_delivery) = CURRENT_DATE
                GROUP BY po.id, s.id
                ORDER BY po.actual_delivery DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysReceivedOrders', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get weekly trends
     */
    async getWeeklyTrends(pharmacistId) {
        try {
            const query = `
                WITH weekly_data AS (
                    SELECT 
                        DATE_TRUNC('week', d.dispensed_at) as week,
                        COUNT(d.id) as dispensing_count,
                        SUM(d.total_value) as dispensing_value,
                        COUNT(DISTINCT p.id) as prescription_count
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    WHERE d.dispensed_at > NOW() - INTERVAL '8 weeks'
                    GROUP BY DATE_TRUNC('week', d.dispensed_at)
                    ORDER BY week DESC
                )
                SELECT 
                    week,
                    dispensing_count,
                    dispensing_value,
                    prescription_count,
                    LAG(dispensing_count) OVER (ORDER BY week) as prev_week_count,
                    LAG(dispensing_value) OVER (ORDER BY week) as prev_week_value
                FROM weekly_data
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getWeeklyTrends', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get monthly trends
     */
    async getMonthlyTrends(pharmacistId) {
        try {
            const query = `
                WITH monthly_data AS (
                    SELECT 
                        DATE_TRUNC('month', d.dispensed_at) as month,
                        COUNT(d.id) as dispensing_count,
                        SUM(d.total_value) as dispensing_value,
                        COUNT(DISTINCT p.id) as prescription_count,
                        COUNT(DISTINCT pat.id) as patient_count
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    JOIN patients pat ON p.patient_id = pat.id
                    WHERE d.dispensed_at > NOW() - INTERVAL '12 months'
                    GROUP BY DATE_TRUNC('month', d.dispensed_at)
                    ORDER BY month DESC
                )
                SELECT 
                    month,
                    dispensing_count,
                    dispensing_value,
                    prescription_count,
                    patient_count,
                    LAG(dispensing_count) OVER (ORDER BY month) as prev_month_count,
                    LAG(dispensing_value) OVER (ORDER BY month) as prev_month_value
                FROM monthly_data
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getMonthlyTrends', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get inventory statistics
     */
    async getInventoryStats(pharmacistId) {
        try {
            const query = `
                WITH stats AS (
                    SELECT 
                        COUNT(*) as total_items,
                        SUM(quantity) as total_quantity,
                        SUM(quantity * unit_price) as total_value,
                        AVG(unit_price) as avg_unit_price,
                        COUNT(*) FILTER (WHERE quantity <= reorder_level) as low_stock_count,
                        COUNT(*) FILTER (WHERE quantity = 0) as out_of_stock_count,
                        COUNT(*) FILTER (WHERE quantity >= maximum_stock) as overstock_count,
                        MIN(unit_price) as min_price,
                        MAX(unit_price) as max_price
                    FROM inventory
                    WHERE is_deleted = false
                ),
                category_stats AS (
                    SELECT 
                        category,
                        COUNT(*) as count,
                        SUM(quantity) as quantity,
                        SUM(quantity * unit_price) as value
                    FROM inventory
                    WHERE is_deleted = false
                    GROUP BY category
                    ORDER BY value DESC
                ),
                location_stats AS (
                    SELECT 
                        location,
                        COUNT(*) as count,
                        SUM(quantity) as quantity
                    FROM inventory
                    WHERE is_deleted = false
                    GROUP BY location
                    ORDER BY count DESC
                )
                SELECT 
                    (SELECT * FROM stats) as summary,
                    (SELECT json_agg(category_stats.*) FROM category_stats) as by_category,
                    (SELECT json_agg(location_stats.*) FROM location_stats) as by_location
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getInventoryStats', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get category distribution
     */
    async getCategoryDistribution(pharmacistId) {
        try {
            const query = `
                SELECT 
                    category,
                    COUNT(*) as item_count,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
                FROM inventory
                WHERE is_deleted = false
                GROUP BY category
                ORDER BY total_value DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCategoryDistribution', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get manufacturer distribution
     */
    async getManufacturerDistribution(pharmacistId) {
        try {
            const query = `
                SELECT 
                    manufacturer,
                    COUNT(*) as item_count,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value
                FROM inventory
                WHERE is_deleted = false AND manufacturer IS NOT NULL
                GROUP BY manufacturer
                ORDER BY total_value DESC
                LIMIT 20
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getManufacturerDistribution', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get dispensing statistics
     */
    async getDispensingStats(pharmacistId) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(d.dispensed_at) as date,
                        COUNT(d.id) as dispensing_count,
                        SUM(d.total_items) as item_count,
                        SUM(d.total_value) as total_value,
                        COUNT(DISTINCT p.id) as prescription_count,
                        COUNT(DISTINCT pat.id) as patient_count
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    JOIN patients pat ON p.patient_id = pat.id
                    WHERE d.dispensed_at >= $1
                    GROUP BY DATE(d.dispensed_at)
                )
                SELECT 
                    AVG(dispensing_count) as avg_daily_dispensings,
                    AVG(item_count) as avg_daily_items,
                    AVG(total_value) as avg_daily_value,
                    SUM(dispensing_count) as total_dispensings,
                    SUM(item_count) as total_items,
                    SUM(total_value) as total_value,
                    MAX(dispensing_count) as max_daily_dispensings,
                    MIN(dispensing_count) as min_daily_dispensings,
                    json_agg(
                        json_build_object(
                            'date', date,
                            'dispensing_count', dispensing_count,
                            'total_value', total_value
                        ) ORDER BY date
                    ) as daily_trend
                FROM daily_stats
            `;

            const result = await db.query(query, [thirtyDaysAgo]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getDispensingStats', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get top medicines
     */
    async getTopMedicines(pharmacistId, options = {}) {
        try {
            const { limit = 10, period = 'month' } = options;

            let interval;
            switch(period) {
                case 'week':
                    interval = "INTERVAL '7 days'";
                    break;
                case 'month':
                    interval = "INTERVAL '30 days'";
                    break;
                case 'quarter':
                    interval = "INTERVAL '90 days'";
                    break;
                default:
                    interval = "INTERVAL '30 days'";
            }

            const query = `
                SELECT 
                    i.medicine_name,
                    i.category,
                    COUNT(DISTINCT d.id) as dispensing_count,
                    SUM(di.quantity) as total_quantity,
                    SUM(di.quantity * di.unit_price) as total_value,
                    COUNT(DISTINCT p.patient_id) as unique_patients
                FROM dispensing_items di
                JOIN batches b ON di.batch_id = b.id
                JOIN inventory i ON b.medicine_id = i.id
                JOIN dispensing_records d ON di.dispensing_id = d.id
                JOIN prescriptions p ON d.prescription_id = p.id
                WHERE d.dispensed_at > NOW() - ${interval}
                GROUP BY i.id
                ORDER BY total_quantity DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTopMedicines', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get financial overview
     */
    async getFinancialOverview(pharmacistId) {
        try {
            const currentMonth = new Date();
            currentMonth.setDate(1);
            const lastMonth = new Date(currentMonth);
            lastMonth.setMonth(lastMonth.getMonth() - 1);

            const query = `
                WITH current_month AS (
                    SELECT 
                        COALESCE(SUM(d.total_value), 0) as revenue,
                        COALESCE(SUM(d.total_items), 0) as items_sold,
                        COUNT(d.id) as transactions
                    FROM dispensing_records d
                    WHERE d.dispensed_at >= $1
                ),
                last_month AS (
                    SELECT 
                        COALESCE(SUM(d.total_value), 0) as revenue,
                        COALESCE(SUM(d.total_items), 0) as items_sold,
                        COUNT(d.id) as transactions
                    FROM dispensing_records d
                    WHERE d.dispensed_at >= $2 AND d.dispensed_at < $1
                ),
                purchases AS (
                    SELECT 
                        COALESCE(SUM(po.total_amount), 0) as purchases,
                        COUNT(po.id) as purchase_orders
                    FROM purchase_orders po
                    WHERE po.order_date >= $1 AND po.status = 'received'
                ),
                inventory_value AS (
                    SELECT COALESCE(SUM(quantity * unit_price), 0) as value
                    FROM inventory
                    WHERE is_deleted = false
                )
                SELECT 
                    current_month.revenue as current_revenue,
                    current_month.items_sold as current_items,
                    current_month.transactions as current_transactions,
                    last_month.revenue as last_revenue,
                    last_month.items_sold as last_items,
                    purchases.purchases as monthly_purchases,
                    purchases.purchase_orders as purchase_orders,
                    inventory_value.value as inventory_value,
                    CASE 
                        WHEN last_month.revenue > 0 
                        THEN ((current_month.revenue - last_month.revenue) / last_month.revenue * 100)::numeric(5,2)
                        ELSE 0
                    END as revenue_growth
                FROM current_month, last_month, purchases, inventory_value
            `;

            const result = await db.query(query, [currentMonth, lastMonth]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getFinancialOverview', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get revenue by payment method
     */
    async getRevenueByPaymentMethod(pharmacistId, period = 'month') {
        try {
            let interval;
            switch(period) {
                case 'week':
                    interval = "INTERVAL '7 days'";
                    break;
                case 'month':
                    interval = "INTERVAL '30 days'";
                    break;
                case 'quarter':
                    interval = "INTERVAL '90 days'";
                    break;
                default:
                    interval = "INTERVAL '30 days'";
            }

            const query = `
                SELECT 
                    payment_method,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_amount,
                    ROUND(SUM(amount) * 100.0 / SUM(SUM(amount)) OVER(), 2) as percentage
                FROM payments
                WHERE payment_date > NOW() - ${interval}
                GROUP BY payment_method
                ORDER BY total_amount DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getRevenueByPaymentMethod', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get all alerts
     */
    async getAllAlerts(pharmacistId) {
        try {
            const query = `
                SELECT 
                    'low_stock' as type,
                    i.id,
                    i.medicine_name,
                    i.quantity,
                    i.reorder_level,
                    (i.reorder_level - i.quantity) as required_quantity,
                    CASE 
                        WHEN i.quantity = 0 THEN 'critical'
                        WHEN i.quantity <= i.minimum_stock THEN 'critical'
                        ELSE 'warning'
                    END as severity,
                    'Stock below reorder level' as message,
                    NOW() as created_at
                FROM inventory i
                WHERE i.quantity <= i.reorder_level AND i.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'expiry' as type,
                    b.id,
                    i.medicine_name,
                    b.quantity,
                    EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_left,
                    0 as required_quantity,
                    CASE 
                        WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                        WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                        ELSE 'info'
                    END as severity,
                    'Batch expiring soon' as message,
                    b.created_at
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                    AND b.quantity > 0
                
                UNION ALL
                
                SELECT 
                    'expired' as type,
                    b.id,
                    i.medicine_name,
                    b.quantity,
                    ABS(EXTRACT(DAY FROM (NOW() - b.expiry_date))) as days_expired,
                    0 as required_quantity,
                    'critical' as severity,
                    'Batch expired' as message,
                    b.expiry_date as created_at
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date < NOW() AND b.quantity > 0
                
                UNION ALL
                
                SELECT 
                    'pending_prescription' as type,
                    p.id,
                    CONCAT(pat.first_name, ' ', pat.last_name) as medicine_name,
                    COUNT(pm.id) as quantity,
                    0 as days_left,
                    'info' as severity,
                    'Pending prescription' as message,
                    p.created_at
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
                WHERE p.status = 'pending'
                GROUP BY p.id, pat.id
                
                ORDER BY 
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'warning' THEN 2
                        ELSE 3
                    END,
                    created_at DESC
                LIMIT 50
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getAllAlerts', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get critical alerts
     */
    async getCriticalAlerts(pharmacistId) {
        try {
            const query = `
                SELECT 
                    'low_stock' as type,
                    i.id,
                    i.medicine_name,
                    i.quantity,
                    i.reorder_level,
                    (i.reorder_level - i.quantity) as required_quantity,
                    'critical' as severity,
                    'Critical low stock' as message
                FROM inventory i
                WHERE i.quantity <= i.minimum_stock AND i.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'expiry' as type,
                    b.id,
                    i.medicine_name,
                    b.quantity,
                    EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_left,
                    0 as required_quantity,
                    'critical' as severity,
                    'Critical expiry' as message
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date <= NOW() + INTERVAL '7 days'
                    AND b.quantity > 0
                
                UNION ALL
                
                SELECT 
                    'expired' as type,
                    b.id,
                    i.medicine_name,
                    b.quantity,
                    ABS(EXTRACT(DAY FROM (NOW() - b.expiry_date))) as days_expired,
                    0 as required_quantity,
                    'critical' as severity,
                    'Expired medicine' as message
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date < NOW() AND b.quantity > 0
                
                ORDER BY created_at DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCriticalAlerts', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Acknowledge alert
     */
    async acknowledgeAlert(pharmacistId, alertId, notes) {
        try {
            const query = `
                INSERT INTO acknowledged_alerts (
                    id, alert_id, acknowledged_by, acknowledged_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, $2, NOW(), $3
                ) RETURNING *
            `;

            const result = await db.query(query, [alertId, pharmacistId, notes]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in acknowledgeAlert', { error: error.message, pharmacistId, alertId });
            throw error;
        }
    },

    /**
     * Get quick actions
     */
    async getQuickActions(pharmacistId) {
        try {
            const actions = [
                {
                    id: 'new_purchase_order',
                    name: 'New Purchase Order',
                    description: 'Create a new purchase order',
                    icon: 'shopping-cart',
                    url: '/pharmacist/purchase-orders/new',
                    permission: 'create_purchase_order'
                },
                {
                    id: 'add_inventory',
                    name: 'Add Inventory',
                    description: 'Add new medicine to inventory',
                    icon: 'package-plus',
                    url: '/pharmacist/inventory/new',
                    permission: 'manage_inventory'
                },
                {
                    id: 'process_prescriptions',
                    name: 'Process Prescriptions',
                    description: 'View and process pending prescriptions',
                    icon: 'clipboard-list',
                    url: '/pharmacist/prescriptions/pending',
                    permission: 'dispense_medicines',
                    badge: await this.getPendingPrescriptionCount(pharmacistId)
                },
                {
                    id: 'check_low_stock',
                    name: 'Check Low Stock',
                    description: 'Review low stock items',
                    icon: 'alert-circle',
                    url: '/pharmacist/inventory/low-stock',
                    permission: 'view_inventory',
                    badge: (await this.getLowStockSummary(pharmacistId)).low_stock_count
                },
                {
                    id: 'check_expiry',
                    name: 'Check Expiry',
                    description: 'Review expiring batches',
                    icon: 'calendar-alert',
                    url: '/pharmacist/batches/expiring',
                    permission: 'view_batches',
                    badge: (await this.getExpiringSummary(pharmacistId)).expiring_count
                }
            ];

            return actions;
        } catch (error) {
            logger.error('Error in getQuickActions', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get pending tasks count
     */
    async getPendingTasks(pharmacistId) {
        try {
            const [prescriptions, orders, returns] = await Promise.all([
                db.query(`SELECT COUNT(*) as count FROM prescriptions WHERE status = 'pending'`),
                db.query(`SELECT COUNT(*) as count FROM purchase_orders WHERE status = 'pending'`),
                db.query(`SELECT COUNT(*) as count FROM returns WHERE status = 'pending'`)
            ]);

            return {
                pending_prescriptions: parseInt(prescriptions.rows[0].count),
                pending_orders: parseInt(orders.rows[0].count),
                pending_returns: parseInt(returns.rows[0].count),
                total: parseInt(prescriptions.rows[0].count) + 
                       parseInt(orders.rows[0].count) + 
                       parseInt(returns.rows[0].count)
            };
        } catch (error) {
            logger.error('Error in getPendingTasks', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get pending prescription count
     */
    async getPendingPrescriptionCount(pharmacistId) {
        try {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM prescriptions
                WHERE status = 'pending'
            `);
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error in getPendingPrescriptionCount', { error: error.message, pharmacistId });
            return 0;
        }
    },

    /**
     * Get performance metrics
     */
    async getPerformanceMetrics(pharmacistId) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const query = `
                WITH metrics AS (
                    SELECT 
                        COUNT(DISTINCT d.id) as total_dispensings,
                        AVG(d.total_items) as avg_items_per_dispensing,
                        SUM(d.total_value) as total_value,
                        COUNT(DISTINCT p.id) as total_prescriptions,
                        AVG(EXTRACT(EPOCH FROM (d.dispensed_at - p.created_at))/3600) as avg_processing_hours
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    WHERE d.dispensed_at >= $1
                ),
                accuracy_metrics AS (
                    SELECT 
                        COUNT(*) as total_checked,
                        COUNT(*) FILTER (WHERE verified = true) as verified_count,
                        COUNT(*) FILTER (WHERE verified = false) as rejected_count
                    FROM dispensing_records
                    WHERE dispensed_at >= $1 AND verified IS NOT NULL
                )
                SELECT 
                    m.*,
                    a.total_checked,
                    a.verified_count,
                    a.rejected_count,
                    CASE 
                        WHEN a.total_checked > 0 
                        THEN (a.verified_count::float / a.total_checked * 100)::numeric(5,2)
                        ELSE 0
                    END as accuracy_rate
                FROM metrics m, accuracy_metrics a
            `;

            const result = await db.query(query, [thirtyDaysAgo]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPerformanceMetrics', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get efficiency metrics
     */
    async getEfficiencyMetrics(pharmacistId) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const query = `
                WITH hourly_stats AS (
                    SELECT 
                        EXTRACT(HOUR FROM d.dispensed_at) as hour,
                        COUNT(*) as dispensing_count,
                        AVG(d.total_items) as avg_items
                    FROM dispensing_records d
                    WHERE d.dispensed_at >= $1
                    GROUP BY EXTRACT(HOUR FROM d.dispensed_at)
                ),
                daily_stats AS (
                    SELECT 
                        EXTRACT(DOW FROM d.dispensed_at) as day_of_week,
                        COUNT(*) as dispensing_count
                    FROM dispensing_records d
                    WHERE d.dispensed_at >= $1
                    GROUP BY EXTRACT(DOW FROM d.dispensed_at)
                )
                SELECT 
                    AVG(d.total_items) as avg_items_per_dispensing,
                    AVG(d.total_value) as avg_value_per_dispensing,
                    (SELECT json_agg(hourly_stats.*) FROM hourly_stats) as hourly_distribution,
                    (SELECT json_agg(daily_stats.*) FROM daily_stats) as daily_distribution,
                    COUNT(DISTINCT DATE(d.dispensed_at)) as active_days,
                    COUNT(d.id)::float / COUNT(DISTINCT DATE(d.dispensed_at)) as avg_daily_dispensings
                FROM dispensing_records d
                WHERE d.dispensed_at >= $1
            `;

            const result = await db.query(query, [thirtyDaysAgo]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getEfficiencyMetrics', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get accuracy metrics
     */
    async getAccuracyMetrics(pharmacistId) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const query = `
                WITH verification_stats AS (
                    SELECT 
                        COUNT(*) as total_verified,
                        COUNT(*) FILTER (WHERE verified = true) as passed,
                        COUNT(*) FILTER (WHERE verified = false) as failed,
                        AVG(CASE WHEN verified = true THEN 1 ELSE 0 END) * 100 as accuracy_rate
                    FROM dispensing_records
                    WHERE dispensed_at >= $1 AND verified IS NOT NULL
                ),
                return_stats AS (
                    SELECT 
                        COUNT(*) as total_returns,
                        SUM(quantity) as returned_quantity,
                        COUNT(*) FILTER (WHERE return_type = 'wrong_item') as wrong_item_returns
                    FROM returns
                    WHERE returned_at >= $1
                )
                SELECT 
                    vs.*,
                    rs.total_returns,
                    rs.returned_quantity,
                    rs.wrong_item_returns,
                    CASE 
                        WHEN rs.total_returns > 0 
                        THEN (rs.wrong_item_returns::float / rs.total_returns * 100)::numeric(5,2)
                        ELSE 0
                    END as dispensing_error_rate
                FROM verification_stats vs, return_stats rs
            `;

            const result = await db.query(query, [thirtyDaysAgo]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAccuracyMetrics', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Export dashboard
     */
    async exportDashboard(pharmacistId, format, sections) {
        try {
            const dashboardData = {};

            if (sections.includes('all') || sections.includes('statistics')) {
                dashboardData.statistics = (await this.getDashboard(pharmacistId)).statistics;
            }
            if (sections.includes('alerts') || sections.includes('all')) {
                dashboardData.alerts = await this.getAllAlerts(pharmacistId);
            }
            if (sections.includes('inventory') || sections.includes('all')) {
                dashboardData.inventory_stats = await this.getInventoryStats(pharmacistId);
            }
            if (sections.includes('dispensing') || sections.includes('all')) {
                dashboardData.dispensing_stats = await this.getDispensingStats(pharmacistId);
            }
            if (sections.includes('financial') || sections.includes('all')) {
                dashboardData.financial = await this.getFinancialOverview(pharmacistId);
            }
            if (sections.includes('trends') || sections.includes('all')) {
                dashboardData.trends = {
                    weekly: await this.getWeeklyTrends(pharmacistId),
                    monthly: await this.getMonthlyTrends(pharmacistId)
                };
            }

            // For now, return JSON
            // TODO: Implement actual PDF/CSV generation
            return dashboardData;
        } catch (error) {
            logger.error('Error in exportDashboard', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get recent activities
     */
    async getRecentActivities(pharmacistId, limit = 20) {
        try {
            const query = `
                (
                    SELECT 
                        'dispensing' as type,
                        d.id,
                        CONCAT('Dispensed prescription #', p.id) as description,
                        CONCAT('Patient: ', pat.first_name, ' ', pat.last_name) as details,
                        d.total_value as amount,
                        d.dispensed_at as timestamp,
                        d.dispensed_by as user_id
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    JOIN patients pat ON p.patient_id = pat.id
                )
                UNION ALL
                (
                    SELECT 
                        'purchase_order' as type,
                        po.id,
                        CONCAT('Purchase order #', po.po_number) as description,
                        CONCAT('Supplier: ', s.name) as details,
                        po.total_amount as amount,
                        po.order_date as timestamp,
                        po.created_by as user_id
                    FROM purchase_orders po
                    JOIN suppliers s ON po.supplier_id = s.id
                )
                UNION ALL
                (
                    SELECT 
                        'return' as type,
                        r.id,
                        'Medicine returned' as description,
                        CONCAT('Reason: ', r.return_reason) as details,
                        NULL as amount,
                        r.returned_at as timestamp,
                        r.returned_by as user_id
                    FROM returns r
                )
                ORDER BY timestamp DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getRecentActivities', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get activity feed
     */
    async getActivityFeed(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 50 } = options;
            const offset = (page - 1) * limit;

            const query = `
                (
                    SELECT 
                        'dispensing' as type,
                        d.id,
                        CONCAT('Dispensed prescription') as action,
                        json_build_object(
                            'prescription_id', p.id,
                            'patient_name', CONCAT(pat.first_name, ' ', pat.last_name),
                            'items', d.total_items,
                            'value', d.total_value
                        ) as data,
                        d.dispensed_at as created_at,
                        CONCAT(e.first_name, ' ', e.last_name) as user_name
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    JOIN patients pat ON p.patient_id = pat.id
                    JOIN employees e ON d.dispensed_by = e.id
                )
                UNION ALL
                (
                    SELECT 
                        'purchase_order' as type,
                        po.id,
                        CONCAT('Purchase order ', po.status) as action,
                        json_build_object(
                            'po_number', po.po_number,
                            'supplier', s.name,
                            'amount', po.total_amount
                        ) as data,
                        po.created_at as created_at,
                        CONCAT(e.first_name, ' ', e.last_name) as user_name
                    FROM purchase_orders po
                    JOIN suppliers s ON po.supplier_id = s.id
                    JOIN employees e ON po.created_by = e.id
                )
                UNION ALL
                (
                    SELECT 
                        'inventory' as type,
                        sm.id,
                        CONCAT('Stock ', sm.movement_type) as action,
                        json_build_object(
                            'medicine', i.medicine_name,
                            'quantity', sm.quantity,
                            'reference', sm.reference_number
                        ) as data,
                        sm.created_at as created_at,
                        CONCAT(e.first_name, ' ', e.last_name) as user_name
                    FROM stock_movements sm
                    JOIN inventory i ON sm.inventory_id = i.id
                    JOIN employees e ON sm.created_by = e.id
                )
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT (
                    (SELECT COUNT(*) FROM dispensing_records) +
                    (SELECT COUNT(*) FROM purchase_orders) +
                    (SELECT COUNT(*) FROM stock_movements)
                ) as total
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getActivityFeed', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get stock forecast
     */
    async getStockForecast(pharmacistId, days = 30) {
        try {
            const query = `
                WITH consumption_rate AS (
                    SELECT 
                        i.id,
                        i.medicine_name,
                        i.quantity as current_stock,
                        i.reorder_level,
                        COALESCE((
                            SELECT SUM(sm.quantity) / 30.0
                            FROM stock_movements sm
                            WHERE sm.inventory_id = i.id
                                AND sm.movement_type = 'stock_out'
                                AND sm.created_at > NOW() - INTERVAL '30 days'
                        ), 0) as daily_consumption,
                        COALESCE((
                            SELECT SUM(poi.quantity)
                            FROM purchase_orders po
                            JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
                            WHERE poi.medicine_name = i.medicine_name
                                AND po.status IN ('approved', 'processing')
                                AND po.expected_delivery <= NOW() + INTERVAL '${days} days'
                        ), 0) as incoming_stock
                    FROM inventory i
                    WHERE i.is_deleted = false
                )
                SELECT 
                    id,
                    medicine_name,
                    current_stock,
                    daily_consumption,
                    incoming_stock,
                    CASE 
                        WHEN daily_consumption > 0 
                        THEN ROUND(current_stock / daily_consumption)
                        ELSE 999
                    END as days_remaining,
                    CASE 
                        WHEN daily_consumption > 0 
                        THEN GREATEST(0, reorder_level - (current_stock + incoming_stock - (daily_consumption * ${days})))
                        ELSE 0
                    END as required_reorder,
                    CASE 
                        WHEN current_stock < reorder_level THEN 'reorder_now'
                        WHEN current_stock - (daily_consumption * 7) < reorder_level THEN 'reorder_soon'
                        ELSE 'ok'
                    END as status
                FROM consumption_rate
                ORDER BY days_remaining ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getStockForecast', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get reorder recommendations
     */
    async getReorderRecommendations(pharmacistId) {
        try {
            const query = `
                WITH reorder_needs AS (
                    SELECT 
                        i.id,
                        i.medicine_name,
                        i.quantity as current_stock,
                        i.reorder_level,
                        i.minimum_stock,
                        i.maximum_stock,
                        i.unit_price,
                        s.id as supplier_id,
                        s.name as supplier_name,
                        s.lead_time_days,
                        s.minimum_order,
                        COALESCE((
                            SELECT AVG(sm.quantity)
                            FROM stock_movements sm
                            WHERE sm.inventory_id = i.id
                                AND sm.movement_type = 'stock_out'
                                AND sm.created_at > NOW() - INTERVAL '30 days'
                        ), 0) as avg_daily_consumption,
                        CASE 
                            WHEN i.quantity <= i.minimum_stock THEN 'urgent'
                            WHEN i.quantity <= i.reorder_level THEN 'normal'
                            ELSE 'ok'
                        END as priority,
                        (i.reorder_level - i.quantity) as recommended_quantity
                    FROM inventory i
                    LEFT JOIN suppliers s ON i.supplier_id = s.id
                    WHERE i.quantity <= i.reorder_level AND i.is_deleted = false
                )
                SELECT 
                    *,
                    (recommended_quantity * unit_price) as estimated_cost,
                    CASE 
                        WHEN avg_daily_consumption > 0 
                        THEN CEIL(recommended_quantity / avg_daily_consumption) 
                        ELSE 30
                    END as estimated_days_cover
                FROM reorder_needs
                WHERE priority != 'ok'
                ORDER BY 
                    CASE priority
                        WHEN 'urgent' THEN 1
                        ELSE 2
                    END,
                    recommended_quantity DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getReorderRecommendations', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get custom widget
     */
    async getCustomWidget(pharmacistId, widgetType, filters = {}) {
        try {
            let data;
            switch(widgetType) {
                case 'low_stock':
                    data = await this.getLowStockSummary(pharmacistId);
                    break;
                case 'expiring':
                    data = await this.getExpiringSummary(pharmacistId, filters.days || 30);
                    break;
                case 'top_medicines':
                    data = await this.getTopMedicines(pharmacistId, { 
                        limit: filters.limit || 10,
                        period: filters.period || 'month'
                    });
                    break;
                case 'recent_activities':
                    data = await this.getRecentActivities(pharmacistId, filters.limit || 20);
                    break;
                case 'financial_overview':
                    data = await this.getFinancialOverview(pharmacistId);
                    break;
                case 'dispensing_stats':
                    data = await this.getDispensingStats(pharmacistId);
                    break;
                case 'inventory_stats':
                    data = await this.getInventoryStats(pharmacistId);
                    break;
                default:
                    throw new Error('Invalid widget type');
            }
            return data;
        } catch (error) {
            logger.error('Error in getCustomWidget', { error: error.message, pharmacistId, widgetType });
            throw error;
        }
    },

    /**
     * Save dashboard layout
     */
    async saveDashboardLayout(pharmacistId, layout) {
        try {
            const query = `
                INSERT INTO dashboard_layouts (id, user_id, layout, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
                ON CONFLICT (user_id) 
                DO UPDATE SET layout = $2, updated_at = NOW()
                RETURNING *
            `;

            const result = await db.query(query, [pharmacistId, JSON.stringify(layout)]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in saveDashboardLayout', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get dashboard layout
     */
    async getDashboardLayout(pharmacistId) {
        try {
            const query = `
                SELECT layout FROM dashboard_layouts
                WHERE user_id = $1
            `;

            const result = await db.query(query, [pharmacistId]);
            return result.rows[0]?.layout || null;
        } catch (error) {
            logger.error('Error in getDashboardLayout', { error: error.message, pharmacistId });
            throw error;
        }
    }
};

module.exports = dashboardService;