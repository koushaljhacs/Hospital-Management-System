/**
 * ======================================================================
 * FILE: backend/src/services/pharmacist/reportService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist report service - Handles business logic for pharmacy reports.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const reportService = {
    /**
     * Get inventory report
     */
    async getInventoryReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, category, manufacturer, location } = options;

            let query = `
                WITH inventory_data AS (
                    SELECT 
                        i.id,
                        i.medicine_name,
                        i.generic_name,
                        i.category,
                        i.manufacturer,
                        i.location,
                        i.quantity,
                        i.unit_price,
                        i.selling_price,
                        (i.quantity * i.unit_price) as total_cost,
                        (i.quantity * i.selling_price) as total_value,
                        i.reorder_level,
                        i.minimum_stock,
                        i.maximum_stock,
                        CASE 
                            WHEN i.quantity <= i.minimum_stock THEN 'critical'
                            WHEN i.quantity <= i.reorder_level THEN 'low'
                            WHEN i.quantity >= i.maximum_stock THEN 'overstock'
                            ELSE 'normal'
                        END as stock_status,
                        s.name as supplier_name,
                        COUNT(b.id) as batch_count,
                        SUM(b.quantity) as total_batch_quantity,
                        MIN(b.expiry_date) as earliest_expiry,
                        MAX(b.expiry_date) as latest_expiry
                    FROM inventory i
                    LEFT JOIN suppliers s ON i.supplier_id = s.id
                    LEFT JOIN batches b ON i.id = b.medicine_id
                    WHERE i.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (category) {
                query += ` AND i.category = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            if (manufacturer) {
                query += ` AND i.manufacturer ILIKE $${paramIndex}`;
                values.push(`%${manufacturer}%`);
                paramIndex++;
            }

            if (location) {
                query += ` AND i.location = $${paramIndex}`;
                values.push(location);
                paramIndex++;
            }

            query += ` GROUP BY i.id, s.id
                      ORDER BY i.category, i.medicine_name`;

            const result = await db.query(query, values);

            // Calculate summary statistics
            const summary = {
                total_items: result.rows.length,
                total_quantity: result.rows.reduce((sum, r) => sum + r.quantity, 0),
                total_cost: result.rows.reduce((sum, r) => sum + parseFloat(r.total_cost || 0), 0),
                total_value: result.rows.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0),
                low_stock_count: result.rows.filter(r => r.stock_status === 'low').length,
                critical_stock_count: result.rows.filter(r => r.stock_status === 'critical').length,
                out_of_stock_count: result.rows.filter(r => r.quantity === 0).length,
                by_category: {},
                by_location: {}
            };

            // Group by category
            result.rows.forEach(r => {
                if (!summary.by_category[r.category]) {
                    summary.by_category[r.category] = {
                        count: 0,
                        quantity: 0,
                        value: 0
                    };
                }
                summary.by_category[r.category].count++;
                summary.by_category[r.category].quantity += r.quantity;
                summary.by_category[r.category].value += parseFloat(r.total_value || 0);
            });

            // Group by location
            result.rows.forEach(r => {
                if (!summary.by_location[r.location]) {
                    summary.by_location[r.location] = {
                        count: 0,
                        quantity: 0,
                        value: 0
                    };
                }
                summary.by_location[r.location].count++;
                summary.by_location[r.location].quantity += r.quantity;
                summary.by_location[r.location].value += parseFloat(r.total_value || 0);
            });

            return {
                data: result.rows,
                summary
            };
        } catch (error) {
            logger.error('Error in getInventoryReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get inventory valuation report
     */
    async getInventoryValuationReport(pharmacistId, options = {}) {
        try {
            const { as_on_date = new Date() } = options;

            const query = `
                WITH valuation AS (
                    SELECT 
                        i.category,
                        COUNT(i.id) as item_count,
                        SUM(i.quantity) as total_quantity,
                        SUM(i.quantity * i.unit_price) as cost_value,
                        SUM(i.quantity * i.selling_price) as selling_value,
                        SUM(i.quantity * (i.selling_price - i.unit_price)) as potential_profit,
                        AVG(i.unit_price) as avg_cost,
                        AVG(i.selling_price) as avg_price
                    FROM inventory i
                    WHERE i.is_deleted = false
                    GROUP BY i.category
                ),
                total_valuation AS (
                    SELECT 
                        SUM(cost_value) as total_cost,
                        SUM(selling_value) as total_selling,
                        SUM(potential_profit) as total_profit
                    FROM valuation
                )
                SELECT 
                    (SELECT json_agg(valuation.*) FROM valuation) as by_category,
                    (SELECT * FROM total_valuation) as totals,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'name', i.medicine_name,
                                'quantity', i.quantity,
                                'cost_value', i.quantity * i.unit_price,
                                'selling_value', i.quantity * i.selling_price,
                                'profit', i.quantity * (i.selling_price - i.unit_price),
                                'margin', ((i.selling_price - i.unit_price) / i.unit_price * 100)::numeric(5,2)
                            ) ORDER BY (i.quantity * i.selling_price) DESC
                        )
                        FROM inventory i
                        WHERE i.is_deleted = false
                        LIMIT 20
                    ) as top_items
            `;

            const result = await db.query(query);
            
            const data = result.rows[0];
            
            // Calculate moving averages
            data.moving_average = {
                cost: data.totals?.total_cost / (data.by_category?.length || 1),
                selling: data.totals?.total_selling / (data.by_category?.length || 1),
                margin: ((data.totals?.total_selling - data.totals?.total_cost) / data.totals?.total_cost * 100) || 0
            };

            return data;
        } catch (error) {
            logger.error('Error in getInventoryValuationReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get inventory movement report
     */
    async getInventoryMovementReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, medicine_id, movement_type } = options;

            let query = `
                WITH movements AS (
                    SELECT 
                        DATE(sm.created_at) as date,
                        sm.movement_type,
                        sm.quantity,
                        sm.reference_number,
                        i.medicine_name,
                        i.category,
                        CONCAT(e.first_name, ' ', e.last_name) as performed_by
                    FROM stock_movements sm
                    JOIN inventory i ON sm.inventory_id = i.id
                    LEFT JOIN employees e ON sm.created_by = e.id
                    WHERE sm.created_at BETWEEN $1 AND $2
            `;
            const values = [from_date, to_date];
            let paramIndex = 3;

            if (medicine_id) {
                query += ` AND i.id = $${paramIndex}`;
                values.push(medicine_id);
                paramIndex++;
            }

            if (movement_type) {
                query += ` AND sm.movement_type = $${paramIndex}`;
                values.push(movement_type);
                paramIndex++;
            }

            query += ` ORDER BY sm.created_at DESC`;

            const result = await db.query(query, values);

            // Calculate summary statistics
            const summary = {
                total_movements: result.rows.length,
                total_in: result.rows.filter(r => r.movement_type === 'stock_in')
                    .reduce((sum, r) => sum + r.quantity, 0),
                total_out: result.rows.filter(r => r.movement_type === 'stock_out')
                    .reduce((sum, r) => sum + r.quantity, 0),
                by_type: {},
                by_date: {}
            };

            // Group by movement type
            result.rows.forEach(r => {
                if (!summary.by_type[r.movement_type]) {
                    summary.by_type[r.movement_type] = {
                        count: 0,
                        quantity: 0
                    };
                }
                summary.by_type[r.movement_type].count++;
                summary.by_type[r.movement_type].quantity += r.quantity;
            });

            // Group by date
            result.rows.forEach(r => {
                const dateStr = r.date.toISOString().split('T')[0];
                if (!summary.by_date[dateStr]) {
                    summary.by_date[dateStr] = {
                        in: 0,
                        out: 0,
                        net: 0
                    };
                }
                if (r.movement_type === 'stock_in') {
                    summary.by_date[dateStr].in += r.quantity;
                } else {
                    summary.by_date[dateStr].out += r.quantity;
                }
                summary.by_date[dateStr].net = summary.by_date[dateStr].in - summary.by_date[dateStr].out;
            });

            summary.net_change = summary.total_in - summary.total_out;

            return {
                data: result.rows,
                summary
            };
        } catch (error) {
            logger.error('Error in getInventoryMovementReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get consumption report
     */
    async getConsumptionReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, group_by = 'day', category, manufacturer } = options;

            let groupByClause;
            switch(group_by) {
                case 'day':
                    groupByClause = 'DATE(sm.created_at)';
                    break;
                case 'week':
                    groupByClause = 'DATE_TRUNC(\'week\', sm.created_at)';
                    break;
                case 'month':
                    groupByClause = 'DATE_TRUNC(\'month\', sm.created_at)';
                    break;
                case 'quarter':
                    groupByClause = 'DATE_TRUNC(\'quarter\', sm.created_at)';
                    break;
                default:
                    groupByClause = 'DATE(sm.created_at)';
            }

            let query = `
                WITH consumption AS (
                    SELECT 
                        ${groupByClause} as period,
                        i.category,
                        i.medicine_name,
                        SUM(sm.quantity) as total_consumed,
                        COUNT(DISTINCT sm.reference_number) as transaction_count,
                        SUM(sm.quantity * i.unit_price) as total_cost
                    FROM stock_movements sm
                    JOIN inventory i ON sm.inventory_id = i.id
                    WHERE sm.movement_type = 'stock_out'
                        AND sm.created_at BETWEEN $1 AND $2
            `;
            const values = [from_date, to_date];
            let paramIndex = 3;

            if (category) {
                query += ` AND i.category = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            if (manufacturer) {
                query += ` AND i.manufacturer ILIKE $${paramIndex}`;
                values.push(`%${manufacturer}%`);
                paramIndex++;
            }

            query += ` GROUP BY period, i.category, i.medicine_name
                      ORDER BY period DESC, total_consumed DESC`;

            const result = await db.query(query, values);

            // Calculate summary statistics
            const summary = {
                total_consumption: result.rows.reduce((sum, r) => sum + r.total_consumed, 0),
                total_cost: result.rows.reduce((sum, r) => sum + parseFloat(r.total_cost || 0), 0),
                unique_medicines: new Set(result.rows.map(r => r.medicine_name)).size,
                by_period: {},
                by_category: {},
                top_medicines: []
            };

            // Group by period
            result.rows.forEach(r => {
                const periodStr = r.period.toISOString().split('T')[0];
                if (!summary.by_period[periodStr]) {
                    summary.by_period[periodStr] = {
                        consumption: 0,
                        cost: 0
                    };
                }
                summary.by_period[periodStr].consumption += r.total_consumed;
                summary.by_period[periodStr].cost += parseFloat(r.total_cost || 0);
            });

            // Group by category
            result.rows.forEach(r => {
                if (!summary.by_category[r.category]) {
                    summary.by_category[r.category] = {
                        consumption: 0,
                        cost: 0
                    };
                }
                summary.by_category[r.category].consumption += r.total_consumed;
                summary.by_category[r.category].cost += parseFloat(r.total_cost || 0);
            });

            // Get top medicines
            const medicineMap = new Map();
            result.rows.forEach(r => {
                if (!medicineMap.has(r.medicine_name)) {
                    medicineMap.set(r.medicine_name, {
                        medicine_name: r.medicine_name,
                        category: r.category,
                        consumption: 0,
                        cost: 0
                    });
                }
                const med = medicineMap.get(r.medicine_name);
                med.consumption += r.total_consumed;
                med.cost += parseFloat(r.total_cost || 0);
            });

            summary.top_medicines = Array.from(medicineMap.values())
                .sort((a, b) => b.consumption - a.consumption)
                .slice(0, 10);

            summary.daily_average = summary.total_consumption / 
                (Math.ceil((new Date(to_date) - new Date(from_date)) / (1000 * 60 * 60 * 24)));

            return {
                data: result.rows,
                summary
            };
        } catch (error) {
            logger.error('Error in getConsumptionReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get medicine consumption report
     */
    async getMedicineConsumptionReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, medicine_id, limit = 20 } = options;

            let query = `
                SELECT 
                    i.id,
                    i.medicine_name,
                    i.category,
                    i.manufacturer,
                    COUNT(sm.id) as transaction_count,
                    SUM(sm.quantity) as total_consumed,
                    SUM(sm.quantity * i.unit_price) as total_cost,
                    AVG(sm.quantity) as avg_quantity_per_transaction,
                    MIN(sm.created_at) as first_consumption,
                    MAX(sm.created_at) as last_consumption
                FROM inventory i
                LEFT JOIN stock_movements sm ON i.id = sm.inventory_id
                    AND sm.movement_type = 'stock_out'
                    AND sm.created_at BETWEEN $1 AND $2
                WHERE i.is_deleted = false
            `;
            const values = [from_date, to_date];
            let paramIndex = 3;

            if (medicine_id) {
                query += ` AND i.id = $${paramIndex}`;
                values.push(medicine_id);
                paramIndex++;
            }

            query += ` GROUP BY i.id
                      ORDER BY total_consumed DESC
                      LIMIT $${paramIndex}`;
            values.push(limit);

            const result = await db.query(query, values);

            // Calculate trends
            for (const med of result.rows) {
                if (med.first_consumption && med.last_consumption) {
                    const daysDiff = Math.ceil((med.last_consumption - med.first_consumption) / (1000 * 60 * 60 * 24)) || 1;
                    med.daily_average = med.total_consumed / daysDiff;
                }
            }

            return result.rows;
        } catch (error) {
            logger.error('Error in getMedicineConsumptionReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get department consumption report
     */
    async getDepartmentConsumptionReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date } = options;

            const query = `
                SELECT 
                    d.id,
                    d.name as department_name,
                    COUNT(DISTINCT p.id) as patient_count,
                    COUNT(DISTINCT pr.id) as prescription_count,
                    COUNT(sm.id) as transaction_count,
                    SUM(sm.quantity) as total_consumed,
                    SUM(sm.quantity * i.unit_price) as total_cost,
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'medicine_name', i.medicine_name,
                            'quantity', SUM(sm.quantity) OVER (PARTITION BY i.id),
                            'cost', SUM(sm.quantity * i.unit_price) OVER (PARTITION BY i.id)
                        )
                    ) FILTER (WHERE sm.id IS NOT NULL) as top_medicines
                FROM departments d
                LEFT JOIN employees e ON d.id = e.department_id
                LEFT JOIN prescriptions pr ON e.id = pr.doctor_id
                    AND pr.created_at BETWEEN $1 AND $2
                LEFT JOIN patients p ON pr.patient_id = p.id
                LEFT JOIN prescription_medicines pm ON pr.id = pm.prescription_id
                LEFT JOIN inventory i ON pm.medicine_id = i.id
                LEFT JOIN stock_movements sm ON i.id = sm.inventory_id
                    AND sm.movement_type = 'stock_out'
                    AND sm.created_at BETWEEN $1 AND $2
                GROUP BY d.id
                ORDER BY total_consumed DESC
            `;

            const result = await db.query(query, [from_date, to_date]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getDepartmentConsumptionReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get dispensing report
     */
    async getDispensingReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, group_by = 'day', doctor_id, patient_id } = options;

            let groupByClause;
            switch(group_by) {
                case 'day':
                    groupByClause = 'DATE(d.dispensed_at)';
                    break;
                case 'week':
                    groupByClause = 'DATE_TRUNC(\'week\', d.dispensed_at)';
                    break;
                case 'month':
                    groupByClause = 'DATE_TRUNC(\'month\', d.dispensed_at)';
                    break;
                default:
                    groupByClause = 'DATE(d.dispensed_at)';
            }

            let query = `
                WITH dispensing_data AS (
                    SELECT 
                        ${groupByClause} as period,
                        d.id as dispensing_id,
                        d.total_items,
                        d.total_value,
                        d.is_partial,
                        p.id as prescription_id,
                        pat.id as patient_id,
                        CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                        doc.id as doctor_id,
                        CONCAT(doc.first_name, ' ', doc.last_name) as doctor_name,
                        COUNT(di.id) as item_count,
                        SUM(di.quantity) as total_quantity
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    JOIN patients pat ON p.patient_id = pat.id
                    JOIN employees doc ON p.doctor_id = doc.id
                    LEFT JOIN dispensing_items di ON d.id = di.dispensing_id
                    WHERE d.dispensed_at BETWEEN $1 AND $2
            `;
            const values = [from_date, to_date];
            let paramIndex = 3;

            if (doctor_id) {
                query += ` AND doc.id = $${paramIndex}`;
                values.push(doctor_id);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND pat.id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            query += ` GROUP BY period, d.id, p.id, pat.id, doc.id`;

            const result = await db.query(query, values);

            // Calculate summary statistics
            const summary = {
                total_dispensings: result.rows.length,
                total_prescriptions: new Set(result.rows.map(r => r.prescription_id)).size,
                total_patients: new Set(result.rows.map(r => r.patient_id)).size,
                total_doctors: new Set(result.rows.map(r => r.doctor_id)).size,
                total_items: result.rows.reduce((sum, r) => sum + r.total_items, 0),
                total_quantity: result.rows.reduce((sum, r) => sum + (r.total_quantity || 0), 0),
                total_value: result.rows.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0),
                partial_count: result.rows.filter(r => r.is_partial).length,
                by_doctor: {},
                by_patient: {},
                by_period: {}
            };

            // Group by doctor
            result.rows.forEach(r => {
                if (!summary.by_doctor[r.doctor_id]) {
                    summary.by_doctor[r.doctor_id] = {
                        doctor_name: r.doctor_name,
                        count: 0,
                        items: 0,
                        value: 0
                    };
                }
                summary.by_doctor[r.doctor_id].count++;
                summary.by_doctor[r.doctor_id].items += r.total_items;
                summary.by_doctor[r.doctor_id].value += parseFloat(r.total_value || 0);
            });

            // Group by patient
            result.rows.forEach(r => {
                if (!summary.by_patient[r.patient_id]) {
                    summary.by_patient[r.patient_id] = {
                        patient_name: r.patient_name,
                        count: 0,
                        items: 0,
                        value: 0
                    };
                }
                summary.by_patient[r.patient_id].count++;
                summary.by_patient[r.patient_id].items += r.total_items;
                summary.by_patient[r.patient_id].value += parseFloat(r.total_value || 0);
            });

            // Group by period
            result.rows.forEach(r => {
                const periodStr = r.period.toISOString().split('T')[0];
                if (!summary.by_period[periodStr]) {
                    summary.by_period[periodStr] = {
                        count: 0,
                        items: 0,
                        value: 0
                    };
                }
                summary.by_period[periodStr].count++;
                summary.by_period[periodStr].items += r.total_items;
                summary.by_period[periodStr].value += parseFloat(r.total_value || 0);
            });

            return {
                data: result.rows,
                summary
            };
        } catch (error) {
            logger.error('Error in getDispensingReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get doctor prescribing report
     */
    async getDoctorPrescribingReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, doctor_id } = options;

            let query = `
                WITH doctor_stats AS (
                    SELECT 
                        doc.id,
                        CONCAT(doc.first_name, ' ', doc.last_name) as doctor_name,
                        doc.specialization,
                        COUNT(DISTINCT p.id) as prescription_count,
                        COUNT(DISTINCT pat.id) as unique_patients,
                        COUNT(DISTINCT pr.id) as medicine_count,
                        SUM(pr.quantity) as total_quantity,
                        SUM(pr.quantity * i.unit_price) as total_cost,
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'medicine_name', i.medicine_name,
                                'prescribed_count', COUNT(pr.id) OVER (PARTITION BY i.id),
                                'total_quantity', SUM(pr.quantity) OVER (PARTITION BY i.id),
                                'total_cost', SUM(pr.quantity * i.unit_price) OVER (PARTITION BY i.id)
                            )
                        ) FILTER (WHERE i.id IS NOT NULL) as medicines
                    FROM employees doc
                    LEFT JOIN prescriptions p ON doc.id = p.doctor_id
                        AND p.created_at BETWEEN $1 AND $2
                    LEFT JOIN patients pat ON p.patient_id = pat.id
                    LEFT JOIN prescription_medicines pr ON p.id = pr.prescription_id
                    LEFT JOIN inventory i ON pr.medicine_id = i.id
                    WHERE doc.designation = 'Doctor'
            `;
            const values = [from_date, to_date];
            let paramIndex = 3;

            if (doctor_id) {
                query += ` AND doc.id = $${paramIndex}`;
                values.push(doctor_id);
                paramIndex++;
            }

            query += ` GROUP BY doc.id`;

            const result = await db.query(query, values);

            // Calculate averages
            for (const doctor of result.rows) {
                doctor.avg_prescriptions_per_patient = doctor.unique_patients > 0
                    ? (doctor.prescription_count / doctor.unique_patients).toFixed(2)
                    : 0;
                doctor.avg_medicines_per_prescription = doctor.prescription_count > 0
                    ? (doctor.medicine_count / doctor.prescription_count).toFixed(2)
                    : 0;
            }

            return result.rows;
        } catch (error) {
            logger.error('Error in getDoctorPrescribingReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiry report
     */
    async getExpiryReport(pharmacistId, options = {}) {
        try {
            const { days = 90, category, manufacturer, location } = options;

            let query = `
                WITH expiry_data AS (
                    SELECT 
                        b.id,
                        b.batch_number,
                        b.expiry_date,
                        b.quantity,
                        b.unit_price,
                        (b.quantity * b.unit_price) as total_value,
                        i.medicine_name,
                        i.category,
                        i.manufacturer,
                        i.location,
                        EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                        CASE 
                            WHEN b.expiry_date < NOW() THEN 'expired'
                            WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                            WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                            WHEN b.expiry_date <= NOW() + INTERVAL '30 days' THEN 'notice'
                            ELSE 'good'
                        END as status,
                        CASE 
                            WHEN b.expiry_date < NOW() THEN 'Dispose immediately'
                            WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'Urgent disposal'
                            WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'Plan disposal'
                            WHEN b.expiry_date <= NOW() + INTERVAL '30 days' THEN 'Review'
                            ELSE 'OK'
                        END as recommendation
                    FROM batches b
                    JOIN inventory i ON b.medicine_id = i.id
                    WHERE b.expiry_date <= NOW() + INTERVAL '${days} days'
                        AND b.quantity > 0
            `;
            const values = [];
            let paramIndex = 1;

            if (category) {
                query += ` AND i.category = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            if (manufacturer) {
                query += ` AND i.manufacturer ILIKE $${paramIndex}`;
                values.push(`%${manufacturer}%`);
                paramIndex++;
            }

            if (location) {
                query += ` AND i.location = $${paramIndex}`;
                values.push(location);
                paramIndex++;
            }

            query += ` ORDER BY b.expiry_date ASC`;

            const result = await db.query(query, values);

            // Calculate summary statistics
            const summary = {
                total_batches: result.rows.length,
                total_quantity: result.rows.reduce((sum, r) => sum + r.quantity, 0),
                total_value: result.rows.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0),
                expired: {
                    count: result.rows.filter(r => r.status === 'expired').length,
                    quantity: result.rows.filter(r => r.status === 'expired').reduce((sum, r) => sum + r.quantity, 0),
                    value: result.rows.filter(r => r.status === 'expired').reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0)
                },
                critical: {
                    count: result.rows.filter(r => r.status === 'critical').length,
                    quantity: result.rows.filter(r => r.status === 'critical').reduce((sum, r) => sum + r.quantity, 0),
                    value: result.rows.filter(r => r.status === 'critical').reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0)
                },
                warning: {
                    count: result.rows.filter(r => r.status === 'warning').length,
                    quantity: result.rows.filter(r => r.status === 'warning').reduce((sum, r) => sum + r.quantity, 0),
                    value: result.rows.filter(r => r.status === 'warning').reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0)
                },
                by_category: {},
                by_location: {}
            };

            // Group by category
            result.rows.forEach(r => {
                if (!summary.by_category[r.category]) {
                    summary.by_category[r.category] = {
                        count: 0,
                        quantity: 0,
                        value: 0
                    };
                }
                summary.by_category[r.category].count++;
                summary.by_category[r.category].quantity += r.quantity;
                summary.by_category[r.category].value += parseFloat(r.total_value || 0);
            });

            // Group by location
            result.rows.forEach(r => {
                if (!summary.by_location[r.location]) {
                    summary.by_location[r.location] = {
                        count: 0,
                        quantity: 0,
                        value: 0
                    };
                }
                summary.by_location[r.location].count++;
                summary.by_location[r.location].quantity += r.quantity;
                summary.by_location[r.location].value += parseFloat(r.total_value || 0);
            });

            return {
                data: result.rows,
                summary
            };
        } catch (error) {
            logger.error('Error in getExpiryReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiry forecast
     */
    async getExpiryForecast(pharmacistId, months = 6) {
        try {
            const query = `
                WITH monthly_forecast AS (
                    SELECT 
                        DATE_TRUNC('month', expiry_date) as expiry_month,
                        COUNT(*) as batch_count,
                        SUM(quantity) as total_quantity,
                        SUM(quantity * unit_price) as total_value,
                        json_agg(
                            json_build_object(
                                'batch_number', batch_number,
                                'medicine_name', i.medicine_name,
                                'quantity', quantity,
                                'expiry_date', expiry_date
                            )
                        ) as batches
                    FROM batches b
                    JOIN inventory i ON b.medicine_id = i.id
                    WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${months} months'
                        AND quantity > 0
                    GROUP BY DATE_TRUNC('month', expiry_date)
                    ORDER BY expiry_month ASC
                )
                SELECT 
                    json_agg(monthly_forecast.*) as monthly,
                    SUM(total_value) as total_value_at_risk,
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'month', expiry_month,
                            'value', total_value,
                            'recommendation', CASE 
                                WHEN expiry_month <= NOW() + INTERVAL '1 month' THEN 'Immediate action needed'
                                WHEN expiry_month <= NOW() + INTERVAL '3 months' THEN 'Plan disposal'
                                ELSE 'Monitor'
                            END
                        )
                    ) as recommendations
                FROM monthly_forecast
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getExpiryForecast', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get purchase orders report
     */
    async getPurchaseOrdersReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, supplier_id, status } = options;

            let query = `
                WITH po_data AS (
                    SELECT 
                        po.id,
                        po.po_number,
                        po.order_date,
                        po.expected_delivery,
                        po.actual_delivery,
                        po.status,
                        po.total_amount,
                        po.paid_amount,
                        po.payment_status,
                        s.id as supplier_id,
                        s.name as supplier_name,
                        COUNT(poi.id) as item_count,
                        SUM(poi.quantity) as total_quantity,
                        CASE 
                            WHEN po.actual_delivery IS NOT NULL 
                                THEN EXTRACT(DAY FROM (po.actual_delivery - po.expected_delivery))
                            ELSE NULL
                        END as delivery_delay
                    FROM purchase_orders po
                    JOIN suppliers s ON po.supplier_id = s.id
                    LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
                    WHERE po.order_date BETWEEN $1 AND $2
            `;
            const values = [from_date, to_date];
            let paramIndex = 3;

            if (supplier_id) {
                query += ` AND po.supplier_id = $${paramIndex}`;
                values.push(supplier_id);
                paramIndex++;
            }

            if (status) {
                query += ` AND po.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` GROUP BY po.id, s.id`;

            const result = await db.query(query, values);

            // Calculate summary statistics
            const summary = {
                total_orders: result.rows.length,
                total_value: result.rows.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0),
                total_paid: result.rows.reduce((sum, r) => sum + parseFloat(r.paid_amount || 0), 0),
                by_status: {},
                by_supplier: {},
                delivery_performance: {
                    on_time: 0,
                    delayed: 0,
                    avg_delay: 0
                }
            };

            // Group by status
            result.rows.forEach(r => {
                if (!summary.by_status[r.status]) {
                    summary.by_status[r.status] = {
                        count: 0,
                        value: 0
                    };
                }
                summary.by_status[r.status].count++;
                summary.by_status[r.status].value += parseFloat(r.total_amount || 0);

                // Delivery performance
                if (r.actual_delivery) {
                    if (r.delivery_delay <= 0) {
                        summary.delivery_performance.on_time++;
                    } else {
                        summary.delivery_performance.delayed++;
                        summary.delivery_performance.avg_delay += r.delivery_delay;
                    }
                }
            });

            // Group by supplier
            result.rows.forEach(r => {
                if (!summary.by_supplier[r.supplier_id]) {
                    summary.by_supplier[r.supplier_id] = {
                        supplier_name: r.supplier_name,
                        count: 0,
                        value: 0
                    };
                }
                summary.by_supplier[r.supplier_id].count++;
                summary.by_supplier[r.supplier_id].value += parseFloat(r.total_amount || 0);
            });

            if (summary.delivery_performance.delayed > 0) {
                summary.delivery_performance.avg_delay /= summary.delivery_performance.delayed;
            }

            summary.delivery_performance.on_time_rate = 
                ((summary.delivery_performance.on_time / result.rows.length) * 100).toFixed(2);

            return {
                data: result.rows,
                summary
            };
        } catch (error) {
            logger.error('Error in getPurchaseOrdersReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get supplier performance report
     */
    async getSupplierPerformanceReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date, supplier_id } = options;

            let query = `
                WITH supplier_stats AS (
                    SELECT 
                        s.id,
                        s.name,
                        s.contact_person,
                        s.phone,
                        s.email,
                        COUNT(po.id) as total_orders,
                        SUM(po.total_amount) as total_spent,
                        AVG(EXTRACT(DAY FROM (po.actual_delivery - po.expected_delivery))) as avg_delay_days,
                        COUNT(*) FILTER (WHERE po.actual_delivery <= po.expected_delivery) as on_time_orders,
                        AVG(sp.quality_rating) as avg_quality,
                        AVG(sp.price_competitiveness) as avg_price,
                        AVG(sp.delivery_time_avg) as avg_delivery_rating,
                        MIN(po.order_date) as first_order,
                        MAX(po.order_date) as last_order
                    FROM suppliers s
                    LEFT JOIN purchase_orders po ON s.id = po.supplier_id
                        AND po.order_date BETWEEN $1 AND $2
                    LEFT JOIN supplier_performance sp ON s.id = sp.supplier_id
                    WHERE s.is_deleted = false
            `;
            const values = [from_date, to_date];
            let paramIndex = 3;

            if (supplier_id) {
                query += ` AND s.id = $${paramIndex}`;
                values.push(supplier_id);
                paramIndex++;
            }

            query += ` GROUP BY s.id`;

            const result = await db.query(query, values);

            // Calculate performance metrics
            for (const supplier of result.rows) {
                supplier.on_time_delivery_rate = supplier.total_orders > 0
                    ? ((supplier.on_time_orders / supplier.total_orders) * 100).toFixed(2)
                    : 0;
                
                supplier.avg_ratings = {
                    quality: parseFloat(supplier.avg_quality || 0).toFixed(2),
                    price: parseFloat(supplier.avg_price || 0).toFixed(2),
                    delivery: parseFloat(supplier.avg_delivery_rating || 0).toFixed(2),
                    overall: (
                        (parseFloat(supplier.avg_quality || 0) +
                         parseFloat(supplier.avg_price || 0) +
                         parseFloat(supplier.avg_delivery_rating || 0)) / 3
                    ).toFixed(2)
                };

                supplier.performance_score = (
                    (supplier.on_time_delivery_rate * 0.4) +
                    (supplier.avg_ratings.quality * 0.3) +
                    (supplier.avg_ratings.price * 0.15) +
                    (supplier.avg_ratings.delivery * 0.15)
                ).toFixed(2);
            }

            // Sort by performance score
            result.rows.sort((a, b) => b.performance_score - a.performance_score);

            return result.rows;
        } catch (error) {
            logger.error('Error in getSupplierPerformanceReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get financial summary report
     */
    async getFinancialSummaryReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date } = options;

            const query = `
                WITH financial_data AS (
                    SELECT 
                        COALESCE(SUM(d.total_value), 0) as total_sales,
                        COALESCE(SUM(d.total_value * 0.7), 0) as cost_of_goods_sold,
                        COALESCE(SUM(d.total_value * 0.3), 0) as gross_profit,
                        COUNT(DISTINCT d.id) as total_transactions,
                        COUNT(DISTINCT p.id) as total_prescriptions,
                        COUNT(DISTINCT pat.id) as unique_patients
                    FROM dispensing_records d
                    JOIN prescriptions p ON d.prescription_id = p.id
                    JOIN patients pat ON p.patient_id = pat.id
                    WHERE d.dispensed_at BETWEEN $1 AND $2
                ),
                purchase_data AS (
                    SELECT 
                        COALESCE(SUM(po.total_amount), 0) as total_purchases,
                        COUNT(po.id) as purchase_orders
                    FROM purchase_orders po
                    WHERE po.order_date BETWEEN $1 AND $2
                        AND po.status = 'received'
                ),
                inventory_data AS (
                    SELECT 
                        COALESCE(SUM(i.quantity * i.unit_price), 0) as inventory_value,
                        COALESCE(SUM(i.quantity * i.selling_price), 0) as inventory_selling_value,
                        COUNT(i.id) as inventory_items
                    FROM inventory i
                    WHERE i.is_deleted = false
                )
                SELECT 
                    (SELECT * FROM financial_data) as sales,
                    (SELECT * FROM purchase_data) as purchases,
                    (SELECT * FROM inventory_data) as inventory,
                    (
                        SELECT (SELECT total_sales FROM financial_data) - 
                               (SELECT total_purchases FROM purchase_data)
                    ) as net_cash_flow,
                    (
                        SELECT ((SELECT total_sales FROM financial_data) - 
                                (SELECT total_purchases FROM purchase_data)) /
                               NULLIF((SELECT total_sales FROM financial_data), 0) * 100
                    ) as profit_margin
            `;

            const result = await db.query(query, [from_date, to_date]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getFinancialSummaryReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get profit & loss report
     */
    async getProfitLossReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date } = options;

            const query = `
                WITH revenue AS (
                    SELECT 
                        DATE_TRUNC('month', d.dispensed_at) as month,
                        SUM(d.total_value) as revenue,
                        COUNT(d.id) as transactions
                    FROM dispensing_records d
                    WHERE d.dispensed_at BETWEEN $1 AND $2
                    GROUP BY DATE_TRUNC('month', d.dispensed_at)
                ),
                expenses AS (
                    SELECT 
                        DATE_TRUNC('month', po.order_date) as month,
                        SUM(po.total_amount) as expenses,
                        COUNT(po.id) as orders
                    FROM purchase_orders po
                    WHERE po.order_date BETWEEN $1 AND $2
                        AND po.status = 'received'
                    GROUP BY DATE_TRUNC('month', po.order_date)
                ),
                returns AS (
                    SELECT 
                        DATE_TRUNC('month', r.returned_at) as month,
                        SUM(r.quantity * i.unit_price) as returns_value,
                        COUNT(r.id) as returns_count
                    FROM returns r
                    JOIN inventory i ON r.medicine_id = i.id
                    WHERE r.returned_at BETWEEN $1 AND $2
                    GROUP BY DATE_TRUNC('month', r.returned_at)
                )
                SELECT 
                    COALESCE(r.month, e.month, rt.month) as month,
                    COALESCE(r.revenue, 0) as revenue,
                    COALESCE(e.expenses, 0) as expenses,
                    COALESCE(rt.returns_value, 0) as returns,
                    COALESCE(r.revenue, 0) - COALESCE(e.expenses, 0) - COALESCE(rt.returns_value, 0) as profit,
                    CASE 
                        WHEN COALESCE(r.revenue, 0) > 0 
                        THEN ((COALESCE(r.revenue, 0) - COALESCE(e.expenses, 0) - COALESCE(rt.returns_value, 0)) / 
                              COALESCE(r.revenue, 0) * 100)::numeric(5,2)
                        ELSE 0
                    END as profit_margin
                FROM revenue r
                FULL OUTER JOIN expenses e ON r.month = e.month
                FULL OUTER JOIN returns rt ON COALESCE(r.month, e.month) = rt.month
                ORDER BY month DESC
            `;

            const result = await db.query(query, [from_date, to_date]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getProfitLossReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get pharmacy dashboard
     */
    async getPharmacyDashboard(pharmacistId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

            const queries = await Promise.all([
                // Today's statistics
                db.query(`
                    SELECT 
                        COUNT(*) as dispensing_count,
                        SUM(total_items) as total_items,
                        SUM(total_value) as total_value
                    FROM dispensing_records
                    WHERE DATE(dispensed_at) = $1
                `, [today]),

                // Low stock count [BR-20]
                db.query(`
                    SELECT COUNT(*) as low_stock_count
                    FROM inventory
                    WHERE quantity <= reorder_level AND is_deleted = false
                `),

                // Expiring soon count [BR-21]
                db.query(`
                    SELECT COUNT(*) as expiring_count
                    FROM batches
                    WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                        AND quantity > 0
                `),

                // Pending prescriptions
                db.query(`
                    SELECT COUNT(*) as pending_prescriptions
                    FROM prescriptions
                    WHERE status = 'pending'
                `),

                // Monthly statistics
                db.query(`
                    SELECT 
                        COUNT(*) as monthly_dispensings,
                        SUM(total_value) as monthly_revenue
                    FROM dispensing_records
                    WHERE dispensed_at >= $1
                `, [firstDayOfMonth]),

                // Top 5 medicines
                db.query(`
                    SELECT 
                        i.medicine_name,
                        SUM(di.quantity) as total_dispensed,
                        SUM(di.quantity * di.unit_price) as total_value
                    FROM dispensing_items di
                    JOIN batches b ON di.batch_id = b.id
                    JOIN inventory i ON b.medicine_id = i.id
                    JOIN dispensing_records d ON di.dispensing_id = d.id
                    WHERE d.dispensed_at >= NOW() - INTERVAL '30 days'
                    GROUP BY i.medicine_name
                    ORDER BY total_dispensed DESC
                    LIMIT 5
                `)
            ]);

            return {
                today: {
                    dispensing_count: parseInt(queries[0].rows[0]?.dispensing_count || 0),
                    total_items: parseInt(queries[0].rows[0]?.total_items || 0),
                    total_value: parseFloat(queries[0].rows[0]?.total_value || 0)
                },
                alerts: {
                    low_stock: parseInt(queries[1].rows[0]?.low_stock_count || 0),
                    expiring: parseInt(queries[2].rows[0]?.expiring_count || 0),
                    pending_prescriptions: parseInt(queries[3].rows[0]?.pending_prescriptions || 0)
                },
                monthly: {
                    dispensing_count: parseInt(queries[4].rows[0]?.monthly_dispensings || 0),
                    revenue: parseFloat(queries[4].rows[0]?.monthly_revenue || 0)
                },
                top_medicines: queries[5].rows,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getPharmacyDashboard', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get key metrics
     */
    async getKeyMetrics(pharmacistId) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const query = `
                WITH metrics AS (
                    SELECT 
                        (SELECT COUNT(*) FROM inventory WHERE is_deleted = false) as total_items,
                        (SELECT SUM(quantity) FROM inventory WHERE is_deleted = false) as total_quantity,
                        (SELECT SUM(quantity * unit_price) FROM inventory WHERE is_deleted = false) as inventory_value,
                        (SELECT COUNT(*) FROM prescriptions WHERE status = 'pending') as pending_prescriptions,
                        (SELECT COUNT(*) FROM dispensing_records WHERE dispensed_at >= $1) as monthly_dispensings,
                        (SELECT SUM(total_value) FROM dispensing_records WHERE dispensed_at >= $1) as monthly_revenue,
                        (SELECT COUNT(*) FROM batches WHERE expiry_date < NOW() AND quantity > 0) as expired_batches,
                        (SELECT COUNT(*) FROM batches WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_batches,
                        (SELECT COUNT(*) FROM suppliers WHERE status = 'active') as active_suppliers,
                        (SELECT COUNT(*) FROM purchase_orders WHERE status = 'pending') as pending_orders
                )
                SELECT * FROM metrics
            `;

            const result = await db.query(query, [thirtyDaysAgo]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getKeyMetrics', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get trend analysis
     */
    async getTrendAnalysis(pharmacistId, options = {}) {
        try {
            const { months = 6, metric = 'consumption' } = options;

            let query;
            if (metric === 'consumption') {
                query = `
                    SELECT 
                        DATE_TRUNC('month', sm.created_at) as month,
                        SUM(sm.quantity) as total_consumption,
                        SUM(sm.quantity * i.unit_price) as total_cost,
                        COUNT(DISTINCT sm.inventory_id) as unique_items
                    FROM stock_movements sm
                    JOIN inventory i ON sm.inventory_id = i.id
                    WHERE sm.movement_type = 'stock_out'
                        AND sm.created_at > NOW() - INTERVAL '${months} months'
                    GROUP BY DATE_TRUNC('month', sm.created_at)
                    ORDER BY month ASC
                `;
            } else if (metric === 'revenue') {
                query = `
                    SELECT 
                        DATE_TRUNC('month', d.dispensed_at) as month,
                        COUNT(d.id) as transaction_count,
                        SUM(d.total_value) as total_revenue,
                        AVG(d.total_value) as avg_transaction_value
                    FROM dispensing_records d
                    WHERE d.dispensed_at > NOW() - INTERVAL '${months} months'
                    GROUP BY DATE_TRUNC('month', d.dispensed_at)
                    ORDER BY month ASC
                `;
            }

            const result = await db.query(query);
            
            // Calculate growth rates
            const trends = result.rows.map((row, index) => {
                if (index === 0) {
                    return { ...row, growth_rate: 0 };
                }
                const prevValue = metric === 'consumption' 
                    ? result.rows[index - 1].total_consumption
                    : result.rows[index - 1].total_revenue;
                const currentValue = metric === 'consumption'
                    ? row.total_consumption
                    : row.total_revenue;
                const growthRate = prevValue > 0 
                    ? ((currentValue - prevValue) / prevValue * 100).toFixed(2)
                    : 0;
                return { ...row, growth_rate: parseFloat(growthRate) };
            });

            return trends;
        } catch (error) {
            logger.error('Error in getTrendAnalysis', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Generate custom report
     */
    async generateCustomReport(pharmacistId, reportConfig) {
        try {
            const { report_type, fields, filters, group_by, sort_by } = reportConfig;

            // Build SELECT clause
            const selectFields = fields.map(f => {
                if (f.includes(' as ')) return f;
                return f;
            }).join(', ');

            // Build WHERE clause
            let whereClause = 'WHERE 1=1';
            const values = [];
            let paramIndex = 1;

            if (filters) {
                for (const [field, value] of Object.entries(filters)) {
                    if (value) {
                        whereClause += ` AND ${field} = $${paramIndex}`;
                        values.push(value);
                        paramIndex++;
                    }
                }
            }

            // Build GROUP BY clause
            let groupByClause = '';
            if (group_by) {
                groupByClause = ` GROUP BY ${group_by}`;
            }

            // Build ORDER BY clause
            let orderByClause = '';
            if (sort_by) {
                const [field, direction] = sort_by.split(':');
                orderByClause = ` ORDER BY ${field} ${direction || 'ASC'}`;
            }

            // Determine table
            let table;
            switch(report_type) {
                case 'inventory':
                    table = 'inventory i';
                    break;
                case 'dispensing':
                    table = 'dispensing_records d';
                    break;
                case 'purchases':
                    table = 'purchase_orders po';
                    break;
                case 'returns':
                    table = 'returns r';
                    break;
                default:
                    throw new Error('Invalid report type');
            }

            const query = `
                SELECT ${selectFields}
                FROM ${table}
                ${whereClause}
                ${groupByClause}
                ${orderByClause}
            `;

            const result = await db.query(query, values);
            
            return {
                config: reportConfig,
                data: result.rows,
                row_count: result.rows.length,
                generated_at: new Date()
            };
        } catch (error) {
            logger.error('Error in generateCustomReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Schedule report
     */
    async scheduleReport(pharmacistId, scheduleData) {
        try {
            const query = `
                INSERT INTO scheduled_reports (
                    id, pharmacist_id, report_type, frequency,
                    recipients, format, filters, next_run_at,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6,
                    $7, $8, NOW(), NOW()
                ) RETURNING *
            `;

            // Calculate next run date
            let nextRunAt;
            const now = new Date();
            switch(scheduleData.frequency) {
                case 'daily':
                    nextRunAt = new Date(now.setDate(now.getDate() + 1));
                    break;
                case 'weekly':
                    nextRunAt = new Date(now.setDate(now.getDate() + 7));
                    break;
                case 'monthly':
                    nextRunAt = new Date(now.setMonth(now.getMonth() + 1));
                    break;
                default:
                    nextRunAt = new Date(now.setDate(now.getDate() + 1));
            }

            const values = [
                pharmacistId,
                scheduleData.report_type,
                scheduleData.frequency,
                scheduleData.recipients,
                scheduleData.format || 'pdf',
                JSON.stringify(scheduleData.filters || {}),
                nextRunAt,
                scheduleData.created_by
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in scheduleReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get scheduled reports
     */
    async getScheduledReports(pharmacistId) {
        try {
            const query = `
                SELECT * FROM scheduled_reports
                WHERE pharmacist_id = $1
                ORDER BY next_run_at ASC
            `;

            const result = await db.query(query, [pharmacistId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getScheduledReports', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Delete scheduled report
     */
    async deleteScheduledReport(pharmacistId, scheduleId) {
        try {
            const query = `
                DELETE FROM scheduled_reports
                WHERE id = $1 AND pharmacist_id = $2
                RETURNING id
            `;

            const result = await db.query(query, [scheduleId, pharmacistId]);

            if (result.rows.length === 0) {
                throw new Error('Schedule not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in deleteScheduledReport', { error: error.message, pharmacistId, scheduleId });
            throw error;
        }
    },

    /**
     * Export to CSV
     */
    async exportToCSV(data, reportType) {
        try {
            if (!data || data.length === 0) {
                return '';
            }

            // Get headers
            const headers = Object.keys(data[0]);
            
            // Create CSV rows
            const csvRows = [];
            csvRows.push(headers.join(','));
            
            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header] || '';
                    return `"${String(value).replace(/"/g, '""')}"`;
                });
                csvRows.push(values.join(','));
            }

            return csvRows.join('\n');
        } catch (error) {
            logger.error('Error in exportToCSV', { error: error.message });
            throw error;
        }
    },

    /**
     * Export to PDF
     */
    async exportToPDF(data, reportType) {
        try {
            // TODO: Implement PDF generation
            // For now, return JSON
            return JSON.stringify(data, null, 2);
        } catch (error) {
            logger.error('Error in exportToPDF', { error: error.message });
            throw error;
        }
    }
};

module.exports = reportService;