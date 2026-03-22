/**
 * ======================================================================
 * FILE: backend/src/services/dashboard/pharmacistDashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist dashboard service - Handles business logic for pharmacy dashboard.
 * Provides real-time inventory monitoring, prescription tracking, and expiry alerts.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-16] Controlled substances need special flag
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-19] Stock cannot go negative
 * - [BR-20] Alert when stock < reorder level
 * - [BR-21] Alert 30 days before expiry
 * - [BR-22] FIFO (First In First Out) dispensing
 * - [BR-23] Batch tracking mandatory
 * 
 * ENDPOINTS SUPPORTED:
 * - GET /api/v1/dashboard/pharmacy - Main dashboard
 * - GET /api/v1/dashboard/pharmacy/low-stock - Low stock items
 * - GET /api/v1/dashboard/pharmacy/expiring - Expiring items
 * - GET /api/v1/dashboard/pharmacy/prescriptions - Pending prescriptions
 * - GET /api/v1/dashboard/pharmacy/dispensing - Today's dispensing
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const pharmacistDashboardService = {
    /**
     * Get pharmacist main dashboard
     * GET /api/v1/dashboard/pharmacy
     */
    async getDashboard(pharmacistId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [
                lowStockItems,
                expiringItems,
                pendingPrescriptions,
                todayDispensing,
                inventoryStats,
                salesStats,
                topMedicines
            ] = await Promise.all([
                this.getLowStockItems(pharmacistId, { page: 1, limit: 10 }),
                this.getExpiringItems(pharmacistId, { days: 30, page: 1, limit: 10 }),
                this.getPendingPrescriptions(pharmacistId, { page: 1, limit: 10 }),
                this.getTodayDispensing(pharmacistId, { page: 1, limit: 20 }),
                this.getInventoryStats(pharmacistId),
                this.getSalesStats(pharmacistId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getTopMedicines(pharmacistId, { limit: 10, period: 'month' })
            ]);

            return {
                low_stock_items: lowStockItems,
                expiring_items: expiringItems,
                pending_prescriptions: pendingPrescriptions,
                today_dispensing: todayDispensing,
                inventory_stats: inventoryStats,
                sales_stats: salesStats,
                top_medicines: topMedicines,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get low stock items
     * GET /api/v1/dashboard/pharmacy/low-stock
     * 
     * BUSINESS RULE: [BR-20] Alert when stock < reorder level
     */
    async getLowStockItems(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, category = 'all' } = options;
            const offset = (page - 1) * limit;

            let categoryFilter = '';
            if (category !== 'all') {
                categoryFilter = `AND i.category = '${category}'`;
            }

            const query = `
                WITH low_stock AS (
                    SELECT 
                        i.id,
                        i.medicine_name,
                        i.generic_name,
                        i.category,
                        i.manufacturer,
                        i.quantity,
                        i.reorder_level,
                        i.minimum_stock,
                        i.maximum_stock,
                        i.unit_price,
                        i.selling_price,
                        i.location,
                        i.rack_number,
                        i.is_narcotic,
                        i.requires_prescription,
                        (SELECT COUNT(*) FROM batches WHERE medicine_id = i.id AND expiry_date > NOW()) as active_batches,
                        CASE 
                            WHEN i.quantity = 0 THEN 'out_of_stock'
                            WHEN i.quantity <= i.minimum_stock THEN 'critical'
                            WHEN i.quantity <= i.reorder_level THEN 'warning'
                            ELSE 'normal'
                        END as severity,
                        (i.reorder_level - i.quantity) as quantity_to_order,
                        (i.reorder_level - i.quantity) * i.unit_price as estimated_cost
                    FROM inventory i
                    WHERE i.quantity <= i.reorder_level
                        AND i.is_deleted = false
                        ${categoryFilter}
                    ORDER BY 
                        CASE 
                            WHEN i.quantity = 0 THEN 1
                            WHEN i.quantity <= i.minimum_stock THEN 2
                            ELSE 3
                        END,
                        (i.quantity / NULLIF(i.reorder_level, 0)) ASC
                    LIMIT $1 OFFSET $2
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
                        COUNT(*) FILTER (WHERE severity = 'out_of_stock') as out_of_stock_count,
                        COUNT(*) FILTER (WHERE severity = 'warning') as warning_count,
                        SUM(quantity_to_order) as total_quantity_to_order,
                        SUM(estimated_cost) as total_estimated_cost
                    FROM low_stock
                )
                SELECT 
                    (SELECT json_agg(low_stock.*) FROM low_stock) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    critical_count: 0,
                    out_of_stock_count: 0,
                    warning_count: 0,
                    total_quantity_to_order: 0,
                    total_estimated_cost: 0
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getLowStockItems', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiring items
     * GET /api/v1/dashboard/pharmacy/expiring
     * 
     * BUSINESS RULE: [BR-21] Alert 30 days before expiry
     */
    async getExpiringItems(pharmacistId, options = {}) {
        try {
            const { days = 30, page = 1, limit = 20, category = 'all' } = options;
            const offset = (page - 1) * limit;

            let categoryFilter = '';
            if (category !== 'all') {
                categoryFilter = `AND i.category = '${category}'`;
            }

            const query = `
                WITH expiring_batches AS (
                    SELECT 
                        b.id as batch_id,
                        b.batch_number,
                        b.expiry_date,
                        b.quantity,
                        b.unit_price,
                        b.selling_price,
                        i.id as medicine_id,
                        i.medicine_name,
                        i.generic_name,
                        i.category,
                        i.manufacturer,
                        i.location,
                        i.rack_number,
                        EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                        CASE 
                            WHEN b.expiry_date <= NOW() THEN 'expired'
                            WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                            WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                            ELSE 'notice'
                        END as severity,
                        b.quantity * b.unit_price as batch_value,
                        b.quantity * b.selling_price as potential_loss
                    FROM batches b
                    JOIN inventory i ON b.medicine_id = i.id
                    WHERE b.expiry_date <= NOW() + INTERVAL '${days} days'
                        AND b.quantity > 0
                        AND b.is_deleted = false
                        ${categoryFilter}
                    ORDER BY 
                        CASE 
                            WHEN b.expiry_date <= NOW() THEN 1
                            WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 2
                            WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 3
                            ELSE 4
                        END,
                        b.expiry_date ASC
                    LIMIT $1 OFFSET $2
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE severity = 'expired') as expired_count,
                        COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
                        COUNT(*) FILTER (WHERE severity = 'warning') as warning_count,
                        SUM(quantity) as total_quantity,
                        SUM(batch_value) as total_value,
                        SUM(potential_loss) as total_potential_loss,
                        MIN(days_until_expiry) as min_days_until_expiry
                    FROM expiring_batches
                )
                SELECT 
                    (SELECT json_agg(expiring_batches.*) FROM expiring_batches) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    expired_count: 0,
                    critical_count: 0,
                    warning_count: 0,
                    total_quantity: 0,
                    total_value: 0,
                    total_potential_loss: 0,
                    min_days_until_expiry: null
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getExpiringItems', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get pending prescriptions
     * GET /api/v1/dashboard/pharmacy/prescriptions
     */
    async getPendingPrescriptions(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, priority = 'all' } = options;
            const offset = (page - 1) * limit;

            let priorityFilter = '';
            if (priority !== 'all') {
                priorityFilter = `AND p.priority = '${priority}'`;
            }

            const query = `
                WITH pending_prescriptions AS (
                    SELECT 
                        p.id,
                        p.prescription_number,
                        p.prescription_date,
                        p.priority,
                        p.diagnosis,
                        p.notes,
                        pat.id as patient_id,
                        pat.first_name as patient_first_name,
                        pat.last_name as patient_last_name,
                        pat.date_of_birth as patient_dob,
                        pat.phone as patient_phone,
                        doc.id as doctor_id,
                        doc.first_name as doctor_first_name,
                        doc.last_name as doctor_last_name,
                        doc.specialization as doctor_specialization,
                        (
                            SELECT COUNT(*) 
                            FROM prescription_medicines pm 
                            WHERE pm.prescription_id = p.id
                        ) as medicine_count,
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'medicine_id', pm.medicine_id,
                                    'medicine_name', i.medicine_name,
                                    'dosage', pm.dosage,
                                    'quantity', pm.quantity,
                                    'frequency', pm.frequency,
                                    'duration', pm.duration,
                                    'is_controlled', i.is_narcotic,
                                    'stock_available', COALESCE(
                                        (SELECT SUM(quantity) FROM batches 
                                         WHERE medicine_id = i.id AND expiry_date > NOW()), 0
                                    )
                                )
                            )
                            FROM prescription_medicines pm
                            JOIN inventory i ON pm.medicine_id = i.id
                            WHERE pm.prescription_id = p.id
                        ) as medicines,
                        EXTRACT(EPOCH FROM (NOW() - p.prescription_date))/3600 as hours_pending
                    FROM prescriptions p
                    JOIN patients pat ON p.patient_id = pat.id
                    JOIN employees doc ON p.doctor_id = doc.id
                    WHERE p.status IN ('pending', 'active')
                        AND p.is_deleted = false
                        ${priorityFilter}
                    ORDER BY 
                        CASE p.priority
                            WHEN 'stat' THEN 1
                            WHEN 'urgent' THEN 2
                            ELSE 3
                        END,
                        p.prescription_date ASC
                    LIMIT $1 OFFSET $2
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE priority = 'stat') as stat_count,
                        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
                        COUNT(*) FILTER (WHERE priority = 'routine') as routine_count,
                        AVG(medicine_count) as avg_medicines,
                        SUM(medicine_count) as total_medicines
                    FROM pending_prescriptions
                )
                SELECT 
                    (SELECT json_agg(pending_prescriptions.*) FROM pending_prescriptions) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    stat_count: 0,
                    urgent_count: 0,
                    routine_count: 0,
                    avg_medicines: 0,
                    total_medicines: 0
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getPendingPrescriptions', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get today's dispensing
     * GET /api/v1/dashboard/pharmacy/dispensing
     */
    async getTodayDispensing(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                WITH today_dispensing AS (
                    SELECT 
                        d.id,
                        d.dispense_number,
                        d.dispense_date,
                        d.prescription_id,
                        d.total_items,
                        d.total_quantity,
                        d.subtotal,
                        d.discount,
                        d.tax_amount,
                        d.total_amount,
                        d.payment_method,
                        d.payment_status,
                        d.is_partial,
                        p.id as patient_id,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        p.phone as patient_phone,
                        pr.prescription_number,
                        pr.priority,
                        (
                            SELECT json_agg(
                                json_build_object(
                                    'medicine_name', di.medicine_name,
                                    'quantity', di.quantity,
                                    'unit_price', di.unit_price,
                                    'total_price', di.total_price,
                                    'batch_number', di.batch_number
                                )
                            )
                            FROM dispense_items di
                            WHERE di.dispense_id = d.id
                        ) as items
                    FROM dispensing d
                    JOIN prescriptions pr ON d.prescription_id = pr.id
                    JOIN patients p ON d.patient_id = p.id
                    WHERE DATE(d.dispense_date) = CURRENT_DATE
                        AND d.is_deleted = false
                    ORDER BY d.dispense_date DESC
                    LIMIT $1 OFFSET $2
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        SUM(total_items) as total_items,
                        SUM(total_quantity) as total_quantity,
                        SUM(total_amount) as total_value,
                        COUNT(*) FILTER (WHERE payment_method = 'cash') as cash_count,
                        COUNT(*) FILTER (WHERE payment_method = 'card') as card_count,
                        COUNT(*) FILTER (WHERE payment_method = 'upi') as upi_count,
                        COUNT(*) FILTER (WHERE payment_method = 'insurance') as insurance_count,
                        AVG(total_amount) as avg_value
                    FROM today_dispensing
                ),
                hourly_breakdown AS (
                    SELECT 
                        EXTRACT(HOUR FROM dispense_date) as hour,
                        COUNT(*) as count,
                        SUM(total_amount) as amount
                    FROM dispensing
                    WHERE DATE(dispense_date) = CURRENT_DATE
                        AND is_deleted = false
                    GROUP BY EXTRACT(HOUR FROM dispense_date)
                    ORDER BY hour
                )
                SELECT 
                    (SELECT json_agg(today_dispensing.*) FROM today_dispensing) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary,
                    (SELECT json_agg(hourly_breakdown.*) FROM hourly_breakdown) as hourly_breakdown
            `;

            const result = await db.query(query, [limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    total_items: 0,
                    total_quantity: 0,
                    total_value: 0,
                    cash_count: 0,
                    card_count: 0,
                    upi_count: 0,
                    insurance_count: 0,
                    avg_value: 0
                },
                hourly_breakdown: result.rows[0]?.hourly_breakdown || [],
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getTodayDispensing', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get inventory statistics
     * GET /api/v1/dashboard/pharmacy/inventory-stats
     */
    async getInventoryStats(pharmacistId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_items,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    COUNT(*) FILTER (WHERE quantity <= reorder_level) as low_stock_count,
                    COUNT(*) FILTER (WHERE quantity = 0) as out_of_stock_count,
                    COUNT(DISTINCT category) as categories_count,
                    COUNT(DISTINCT manufacturer) as manufacturers_count,
                    AVG(unit_price) as avg_unit_price,
                    AVG(selling_price) as avg_selling_price,
                    AVG(quantity) as avg_quantity_per_item,
                    SUM(quantity * (selling_price - unit_price)) as estimated_profit
                FROM inventory
                WHERE is_deleted = false
            `;

            const result = await db.query(query);
            const data = result.rows[0];

            // Get category distribution
            const categoryQuery = `
                SELECT 
                    category,
                    COUNT(*) as count,
                    SUM(quantity) as quantity,
                    SUM(quantity * unit_price) as value
                FROM inventory
                WHERE is_deleted = false
                GROUP BY category
                ORDER BY value DESC
            `;

            const categoryResult = await db.query(categoryQuery);

            return {
                summary: {
                    total_items: parseInt(data.total_items) || 0,
                    total_quantity: parseInt(data.total_quantity) || 0,
                    total_value: parseFloat(data.total_value) || 0,
                    low_stock_count: parseInt(data.low_stock_count) || 0,
                    out_of_stock_count: parseInt(data.out_of_stock_count) || 0,
                    categories_count: parseInt(data.categories_count) || 0,
                    manufacturers_count: parseInt(data.manufacturers_count) || 0,
                    avg_unit_price: parseFloat(data.avg_unit_price) || 0,
                    avg_selling_price: parseFloat(data.avg_selling_price) || 0,
                    avg_quantity_per_item: parseFloat(data.avg_quantity_per_item) || 0,
                    estimated_profit: parseFloat(data.estimated_profit) || 0
                },
                by_category: categoryResult.rows.map(row => ({
                    category: row.category,
                    count: parseInt(row.count),
                    quantity: parseInt(row.quantity),
                    value: parseFloat(row.value)
                }))
            };
        } catch (error) {
            logger.error('Error in getInventoryStats', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get sales statistics
     * GET /api/v1/dashboard/pharmacy/sales-stats
     */
    async getSalesStats(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, group_by = 'day' } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND d.dispense_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND d.dispense_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH sales_data AS (
                    SELECT 
                        DATE_TRUNC('${group_by}', d.dispense_date) as period,
                        COUNT(*) as transaction_count,
                        SUM(d.total_items) as total_items,
                        SUM(d.total_quantity) as total_quantity,
                        SUM(d.subtotal) as subtotal,
                        SUM(d.discount) as total_discount,
                        SUM(d.tax_amount) as total_tax,
                        SUM(d.total_amount) as total_amount,
                        AVG(d.total_amount) as avg_transaction_value
                    FROM dispensing d
                    WHERE d.is_deleted = false
                        ${dateFilter}
                    GROUP BY DATE_TRUNC('${group_by}', d.dispense_date)
                    ORDER BY period DESC
                ),
                totals AS (
                    SELECT 
                        SUM(transaction_count) as total_transactions,
                        SUM(total_items) as total_items,
                        SUM(total_quantity) as total_quantity,
                        SUM(subtotal) as total_subtotal,
                        SUM(total_discount) as total_discount,
                        SUM(total_tax) as total_tax,
                        SUM(total_amount) as total_revenue,
                        AVG(avg_transaction_value) as avg_transaction_value
                    FROM sales_data
                )
                SELECT 
                    (SELECT json_agg(sales_data.*) FROM sales_data) as breakdown,
                    (SELECT row_to_json(totals.*) FROM totals) as totals
            `;

            const result = await db.query(query);
            const data = result.rows[0];
            const totals = data?.totals || {};

            return {
                breakdown: data?.breakdown || [],
                totals: {
                    total_transactions: parseInt(totals.total_transactions) || 0,
                    total_items: parseInt(totals.total_items) || 0,
                    total_quantity: parseInt(totals.total_quantity) || 0,
                    total_subtotal: parseFloat(totals.total_subtotal) || 0,
                    total_discount: parseFloat(totals.total_discount) || 0,
                    total_tax: parseFloat(totals.total_tax) || 0,
                    total_revenue: parseFloat(totals.total_revenue) || 0,
                    avg_transaction_value: parseFloat(totals.avg_transaction_value) || 0
                }
            };
        } catch (error) {
            logger.error('Error in getSalesStats', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get top medicines by dispensing volume
     * GET /api/v1/dashboard/pharmacy/top-medicines
     */
    async getTopMedicines(pharmacistId, options = {}) {
        try {
            const { limit = 10, period = 'month' } = options;

            let dateFilter = '';
            if (period === 'day') {
                dateFilter = `AND d.dispense_date > NOW() - INTERVAL '1 day'`;
            } else if (period === 'week') {
                dateFilter = `AND d.dispense_date > NOW() - INTERVAL '7 days'`;
            } else if (period === 'month') {
                dateFilter = `AND d.dispense_date > NOW() - INTERVAL '30 days'`;
            } else if (period === 'year') {
                dateFilter = `AND d.dispense_date > NOW() - INTERVAL '365 days'`;
            }

            const query = `
                SELECT 
                    i.id as medicine_id,
                    i.medicine_name,
                    i.generic_name,
                    i.category,
                    i.manufacturer,
                    COUNT(DISTINCT di.id) as dispense_count,
                    SUM(di.quantity) as total_quantity,
                    SUM(di.total_price) as total_revenue,
                    AVG(di.unit_price) as avg_unit_price,
                    COUNT(DISTINCT d.prescription_id) as prescription_count,
                    COUNT(DISTINCT d.patient_id) as unique_patients
                FROM dispense_items di
                JOIN dispensing d ON di.dispense_id = d.id
                JOIN inventory i ON di.medicine_id = i.id
                WHERE d.is_deleted = false
                    ${dateFilter}
                GROUP BY i.id, i.medicine_name, i.generic_name, i.category, i.manufacturer
                ORDER BY total_quantity DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);
            
            return result.rows.map(row => ({
                medicine_id: row.medicine_id,
                medicine_name: row.medicine_name,
                generic_name: row.generic_name,
                category: row.category,
                manufacturer: row.manufacturer,
                dispense_count: parseInt(row.dispense_count),
                total_quantity: parseInt(row.total_quantity),
                total_revenue: parseFloat(row.total_revenue),
                avg_unit_price: parseFloat(row.avg_unit_price),
                prescription_count: parseInt(row.prescription_count),
                unique_patients: parseInt(row.unique_patients)
            }));
        } catch (error) {
            logger.error('Error in getTopMedicines', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get supplier performance
     * GET /api/v1/dashboard/pharmacy/supplier-performance
     */
    async getSupplierPerformance(pharmacistId, options = {}) {
        try {
            const { limit = 10 } = options;

            const query = `
                SELECT 
                    s.id as supplier_id,
                    s.name as supplier_name,
                    COUNT(DISTINCT po.id) as order_count,
                    SUM(po.total_amount) as total_purchase_value,
                    AVG(po.total_amount) as avg_order_value,
                    AVG(po.delivery_time_days) as avg_delivery_time,
                    COUNT(*) FILTER (WHERE po.status = 'received') as received_orders,
                    COUNT(*) FILTER (WHERE po.status = 'delayed') as delayed_orders,
                    ROUND(COUNT(*) FILTER (WHERE po.status = 'received')::float / NULLIF(COUNT(*), 0) * 100, 2) as on_time_rate,
                    COUNT(DISTINCT po.id) FILTER (WHERE po.quality_check_passed = true) as quality_passed,
                    ROUND(COUNT(DISTINCT po.id) FILTER (WHERE po.quality_check_passed = true)::float / NULLIF(COUNT(DISTINCT po.id), 0) * 100, 2) as quality_rate
                FROM suppliers s
                LEFT JOIN purchase_orders po ON s.id = po.supplier_id
                WHERE s.is_deleted = false
                GROUP BY s.id, s.name
                HAVING COUNT(DISTINCT po.id) > 0
                ORDER BY total_purchase_value DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);
            
            return result.rows.map(row => ({
                supplier_id: row.supplier_id,
                supplier_name: row.supplier_name,
                order_count: parseInt(row.order_count),
                total_purchase_value: parseFloat(row.total_purchase_value),
                avg_order_value: parseFloat(row.avg_order_value),
                avg_delivery_time: parseFloat(row.avg_delivery_time),
                received_orders: parseInt(row.received_orders),
                delayed_orders: parseInt(row.delayed_orders),
                on_time_rate: parseFloat(row.on_time_rate),
                quality_rate: parseFloat(row.quality_rate)
            }));
        } catch (error) {
            logger.error('Error in getSupplierPerformance', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get batch utilization
     * GET /api/v1/dashboard/pharmacy/batch-utilization
     * 
     * BUSINESS RULE: [BR-22] FIFO dispensing
     */
    async getBatchUtilization(pharmacistId, options = {}) {
        try {
            const { medicine_id, limit = 20 } = options;

            let medicineFilter = '';
            if (medicine_id) {
                medicineFilter = `AND b.medicine_id = '${medicine_id}'`;
            }

            const query = `
                SELECT 
                    b.id as batch_id,
                    b.batch_number,
                    i.medicine_name,
                    b.expiry_date,
                    b.quantity as initial_quantity,
                    b.quantity_remaining as current_quantity,
                    b.quantity - b.quantity_remaining as dispensed_quantity,
                    ROUND((b.quantity - b.quantity_remaining)::float / b.quantity * 100, 2) as utilization_rate,
                    EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                    CASE 
                        WHEN b.expiry_date <= NOW() THEN 'expired'
                        WHEN b.expiry_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
                        ELSE 'good'
                    END as status
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.is_deleted = false
                    AND b.quantity_remaining > 0
                    ${medicineFilter}
                ORDER BY 
                    CASE 
                        WHEN b.expiry_date <= NOW() THEN 1
                        WHEN b.expiry_date <= NOW() + INTERVAL '30 days' THEN 2
                        ELSE 3
                    END,
                    b.expiry_date ASC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);
            
            return result.rows.map(row => ({
                batch_id: row.batch_id,
                batch_number: row.batch_number,
                medicine_name: row.medicine_name,
                expiry_date: row.expiry_date,
                initial_quantity: parseInt(row.initial_quantity),
                current_quantity: parseInt(row.current_quantity),
                dispensed_quantity: parseInt(row.dispensed_quantity),
                utilization_rate: parseFloat(row.utilization_rate),
                days_until_expiry: parseInt(row.days_until_expiry),
                status: row.status
            }));
        } catch (error) {
            logger.error('Error in getBatchUtilization', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiry forecast
     * GET /api/v1/dashboard/pharmacy/expiry-forecast
     * 
     * BUSINESS RULE: [BR-21] Alert 30 days before expiry
     */
    async getExpiryForecast(pharmacistId, options = {}) {
        try {
            const { months = 6 } = options;

            const query = `
                WITH monthly_expiry AS (
                    SELECT 
                        DATE_TRUNC('month', expiry_date) as expiry_month,
                        COUNT(*) as batch_count,
                        SUM(quantity_remaining) as quantity,
                        SUM(quantity_remaining * unit_price) as total_value
                    FROM batches b
                    JOIN inventory i ON b.medicine_id = i.id
                    WHERE b.expiry_date > NOW()
                        AND b.expiry_date <= NOW() + INTERVAL '${months} months'
                        AND b.is_deleted = false
                    GROUP BY DATE_TRUNC('month', expiry_date)
                    ORDER BY expiry_month
                ),
                total_forecast AS (
                    SELECT 
                        SUM(quantity) as total_quantity_at_risk,
                        SUM(total_value) as total_value_at_risk
                    FROM monthly_expiry
                )
                SELECT 
                    (SELECT json_agg(monthly_expiry.*) FROM monthly_expiry) as by_month,
                    (SELECT row_to_json(total_forecast.*) FROM total_forecast) as totals
            `;

            const result = await db.query(query);
            const data = result.rows[0];

            return {
                by_month: data?.by_month || [],
                totals: data?.totals || {
                    total_quantity_at_risk: 0,
                    total_value_at_risk: 0
                }
            };
        } catch (error) {
            logger.error('Error in getExpiryForecast', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get reorder recommendations
     * GET /api/v1/dashboard/pharmacy/reorder-recommendations
     * 
     * BUSINESS RULE: [BR-20] Low stock alerts
     */
    async getReorderRecommendations(pharmacistId, options = {}) {
        try {
            const { limit = 20 } = options;

            const query = `
                WITH reorder_items AS (
                    SELECT 
                        i.id,
                        i.medicine_name,
                        i.generic_name,
                        i.category,
                        i.manufacturer,
                        i.quantity,
                        i.reorder_level,
                        i.minimum_stock,
                        i.maximum_stock,
                        i.unit_price,
                        i.selling_price,
                        (SELECT COALESCE(SUM(quantity), 0) FROM batches 
                         WHERE medicine_id = i.id AND expiry_date > NOW()) as available_quantity,
                        (i.reorder_level - i.quantity) as suggested_quantity,
                        (i.reorder_level - i.quantity) * i.unit_price as estimated_cost,
                        ROUND((i.quantity / NULLIF(i.reorder_level, 0) * 100), 2) as stock_percentage
                    FROM inventory i
                    WHERE i.quantity <= i.reorder_level
                        AND i.is_deleted = false
                    ORDER BY 
                        (i.quantity / NULLIF(i.reorder_level, 0)) ASC,
                        i.reorder_level DESC
                    LIMIT $1
                )
                SELECT 
                    json_agg(reorder_items.*) as data,
                    (SELECT SUM(estimated_cost) FROM reorder_items) as total_estimated_cost
                FROM reorder_items
            `;

            const result = await db.query(query, [limit]);
            
            return {
                data: result.rows[0]?.data || [],
                total_estimated_cost: parseFloat(result.rows[0]?.total_estimated_cost) || 0
            };
        } catch (error) {
            logger.error('Error in getReorderRecommendations', { error: error.message, pharmacistId });
            throw error;
        }
    }
};

module.exports = pharmacistDashboardService;