/**
 * ======================================================================
 * FILE: backend/src/services/pharmacist/returnService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist return service - Handles business logic for returns and expiry.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-21] Alert 30 days before expiry
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const returnService = {
    /**
     * Return medicine
     */
    async returnMedicine(pharmacistId, returnData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get medicine details
            const medicineQuery = `
                SELECT i.*, b.quantity as batch_quantity, b.id as batch_id
                FROM inventory i
                LEFT JOIN batches b ON i.id = b.medicine_id AND b.id = $2
                WHERE i.id = $1
            `;
            const medicine = await client.query(medicineQuery, [
                returnData.medicine_id,
                returnData.batch_id
            ]);

            if (medicine.rows.length === 0) {
                throw new Error('Medicine not found');
            }

            // Check if batch exists and has sufficient quantity
            if (returnData.batch_id) {
                if (medicine.rows[0].batch_quantity < returnData.quantity) {
                    throw new Error(`Return quantity exceeds available quantity in batch`);
                }
            }

            // Create return record
            const returnQuery = `
                INSERT INTO returns (
                    id, prescription_id, medicine_id, batch_id,
                    quantity, return_reason, return_type, condition,
                    notes, returned_by, returned_at, status,
                    ip_address, user_agent, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, 'pending', $11, $12, NOW()
                ) RETURNING *
            `;

            const returnValues = [
                returnData.prescription_id || null,
                returnData.medicine_id,
                returnData.batch_id || null,
                returnData.quantity,
                returnData.return_reason,
                returnData.return_type,
                returnData.condition || null,
                returnData.notes || null,
                returnData.returned_by,
                returnData.returned_at,
                returnData.ip_address,
                returnData.user_agent
            ];

            const returnResult = await client.query(returnQuery, returnValues);

            // Update batch quantity if returning to stock
            if (returnData.return_type === 'patient_return' && returnData.batch_id) {
                await client.query(`
                    UPDATE batches 
                    SET quantity = quantity + $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [returnData.quantity, returnData.batch_id]);

                // Update inventory total
                await client.query(`
                    UPDATE inventory 
                    SET quantity = quantity + $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [returnData.quantity, returnData.medicine_id]);
            }

            // If damaged or expired, move to quarantine
            if (['damaged', 'expired', 'quality_issue'].includes(returnData.return_type)) {
                await client.query(`
                    INSERT INTO quarantine (
                        id, return_id, medicine_id, batch_id,
                        quantity, reason, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
                    )
                `, [
                    returnResult.rows[0].id,
                    returnData.medicine_id,
                    returnData.batch_id || null,
                    returnData.quantity,
                    returnData.return_reason
                ]);
            }

            await db.commitTransaction(client);

            return returnResult.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get returns history
     */
    async getReturnsHistory(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, return_type, medicine_id, from_date, to_date, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT r.*, 
                       i.medicine_name, i.category,
                       b.batch_number,
                       CONCAT(e.first_name, ' ', e.last_name) as returned_by_name,
                       p.id as prescription_id
                FROM returns r
                JOIN inventory i ON r.medicine_id = i.id
                LEFT JOIN batches b ON r.batch_id = b.id
                LEFT JOIN employees e ON r.returned_by = e.id
                LEFT JOIN prescriptions p ON r.prescription_id = p.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (return_type) {
                query += ` AND r.return_type = $${paramIndex}`;
                values.push(return_type);
                paramIndex++;
            }

            if (medicine_id) {
                query += ` AND r.medicine_id = $${paramIndex}`;
                values.push(medicine_id);
                paramIndex++;
            }

            if (status) {
                query += ` AND r.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND r.returned_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND r.returned_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY r.returned_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM returns r
                WHERE 1=1
                ${return_type ? 'AND return_type = $1' : ''}
            `;
            const countValues = return_type ? [return_type] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_returns,
                    SUM(quantity) as total_quantity,
                    COUNT(*) FILTER (WHERE return_type = 'damaged') as damaged_count,
                    COUNT(*) FILTER (WHERE return_type = 'expired') as expired_count,
                    COUNT(*) FILTER (WHERE return_type = 'patient_return') as patient_return_count,
                    COUNT(*) FILTER (WHERE return_type = 'quality_issue') as quality_issue_count,
                    COUNT(*) FILTER (WHERE return_type = 'wrong_item') as wrong_item_count
                FROM returns r
                WHERE 1=1
                ${return_type ? 'AND return_type = $1' : ''}
            `;
            const summary = await db.query(summaryQuery, countValues);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getReturnsHistory', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get return by ID
     */
    async getReturnById(pharmacistId, returnId) {
        try {
            const query = `
                SELECT r.*, 
                       i.medicine_name, i.generic_name, i.category,
                       i.manufacturer, i.unit_price,
                       b.batch_number, b.expiry_date,
                       CONCAT(e.first_name, ' ', e.last_name) as returned_by_name,
                       p.id as prescription_id,
                       p.diagnosis,
                       q.status as quarantine_status,
                       q.disposed_at,
                       q.disposal_method
                FROM returns r
                JOIN inventory i ON r.medicine_id = i.id
                LEFT JOIN batches b ON r.batch_id = b.id
                LEFT JOIN employees e ON r.returned_by = e.id
                LEFT JOIN prescriptions p ON r.prescription_id = p.id
                LEFT JOIN quarantine q ON r.id = q.return_id
                WHERE r.id = $1
            `;

            const result = await db.query(query, [returnId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getReturnById', { error: error.message, pharmacistId, returnId });
            throw error;
        }
    },

    /**
     * Update return status
     */
    async updateReturnStatus(pharmacistId, returnId, status, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE returns 
                SET status = $1,
                    processed_by = $2,
                    processed_at = NOW(),
                    processing_notes = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                status,
                data.updated_by,
                data.notes,
                returnId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Return record not found');
            }

            // If approved and return type is patient_return, ensure stock is updated
            if (status === 'approved' && result.rows[0].return_type === 'patient_return') {
                // Stock already updated in returnMedicine
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Dispose expired medicines
     */
    async disposeExpired(pharmacistId, disposalData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            let totalQuantity = 0;
            let totalValue = 0;
            let hasControlled = false;
            let controlledQuantity = 0;

            const disposalId = `DSP-${Date.now()}`;

            for (const item of disposalData.items) {
                // Get batch details
                const batchQuery = `
                    SELECT b.*, i.medicine_name, i.is_narcotic,
                           i.unit_price
                    FROM batches b
                    JOIN inventory i ON b.medicine_id = i.id
                    WHERE b.id = $1
                `;
                const batch = await client.query(batchQuery, [item.batch_id]);

                if (batch.rows.length === 0) {
                    throw new Error(`Batch ${item.batch_id} not found`);
                }

                const quantity = item.quantity || batch.rows[0].quantity;
                totalQuantity += quantity;
                totalValue += quantity * batch.rows[0].unit_price;

                if (batch.rows[0].is_narcotic) {
                    hasControlled = true;
                    controlledQuantity += quantity;
                }

                // Create disposal record
                await client.query(`
                    INSERT INTO disposal_records (
                        id, batch_id, quantity, disposal_method,
                        disposal_date, witness_id, notes,
                        disposed_by, disposal_id, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
                    )
                `, [
                    item.batch_id,
                    quantity,
                    disposalData.disposal_method,
                    disposalData.disposal_date,
                    disposalData.witness_id,
                    disposalData.notes,
                    pharmacistId,
                    disposalId
                ]);

                // Remove from batch
                await client.query(`
                    UPDATE batches 
                    SET quantity = quantity - $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [quantity, item.batch_id]);

                // Update inventory
                await client.query(`
                    UPDATE inventory 
                    SET quantity = quantity - $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [quantity, batch.rows[0].medicine_id]);
            }

            await db.commitTransaction(client);

            return {
                id: disposalId,
                total_quantity: totalQuantity,
                total_value: totalValue,
                has_controlled: hasControlled,
                controlled_quantity: controlledQuantity
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
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
                        i.id,
                        i.medicine_name,
                        i.category,
                        i.manufacturer,
                        i.location,
                        b.batch_number,
                        b.quantity,
                        b.expiry_date,
                        b.unit_price,
                        (b.quantity * b.unit_price) as total_value,
                        EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                        CASE 
                            WHEN b.expiry_date < NOW() THEN 'expired'
                            WHEN b.expiry_date <= NOW() + INTERVAL '30 days' THEN 'critical'
                            WHEN b.expiry_date <= NOW() + INTERVAL '60 days' THEN 'warning'
                            WHEN b.expiry_date <= NOW() + INTERVAL '90 days' THEN 'notice'
                            ELSE 'good'
                        END as status
                    FROM batches b
                    JOIN inventory i ON b.medicine_id = i.id
                    WHERE b.expiry_date <= NOW() + INTERVAL '${days} days'
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

            // Group by status
            const grouped = {
                expired: result.rows.filter(r => r.status === 'expired'),
                critical: result.rows.filter(r => r.status === 'critical'),
                warning: result.rows.filter(r => r.status === 'warning'),
                notice: result.rows.filter(r => r.status === 'notice'),
                good: result.rows.filter(r => r.status === 'good')
            };

            // Calculate summary
            const summary = {
                total_items: result.rows.length,
                total_quantity: result.rows.reduce((sum, r) => sum + r.quantity, 0),
                total_value: result.rows.reduce((sum, r) => sum + parseFloat(r.total_value), 0),
                expired_count: grouped.expired.length,
                expired_value: grouped.expired.reduce((sum, r) => sum + parseFloat(r.total_value), 0),
                expiring_soon_count: grouped.critical.length + grouped.warning.length,
                expiring_soon_value: [...grouped.critical, ...grouped.warning].reduce((sum, r) => sum + parseFloat(r.total_value), 0),
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
                summary.by_category[r.category].value += parseFloat(r.total_value);
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
                summary.by_location[r.location].value += parseFloat(r.total_value);
            });

            return {
                data: grouped,
                summary
            };
        } catch (error) {
            logger.error('Error in getExpiryReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiry alerts [BR-21]
     */
    async getExpiryAlerts(pharmacistId) {
        try {
            const query = `
                SELECT 
                    'expiry' as type,
                    b.id,
                    b.batch_number,
                    i.medicine_name,
                    b.quantity,
                    b.expiry_date,
                    EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                    CASE 
                        WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                        WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                        ELSE 'info'
                    END as severity,
                    CASE 
                        WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'dispose_immediately'
                        WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'plan_disposal'
                        ELSE 'review'
                    END as recommended_action
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                    AND b.quantity > 0
                
                UNION ALL
                
                SELECT 
                    'expired' as type,
                    b.id,
                    b.batch_number,
                    i.medicine_name,
                    b.quantity,
                    b.expiry_date,
                    ABS(EXTRACT(DAY FROM (NOW() - b.expiry_date))) as days_expired,
                    'critical' as severity,
                    'dispose_immediately' as recommended_action
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date < NOW() AND b.quantity > 0
                
                ORDER BY severity DESC, days_until_expiry ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getExpiryAlerts', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Acknowledge expiry alert
     */
    async acknowledgeExpiryAlert(pharmacistId, alertId, data) {
        try {
            const query = `
                UPDATE expiry_alerts
                SET acknowledged = true,
                    acknowledged_by = $1,
                    acknowledged_at = $2,
                    acknowledgment_notes = $3,
                    action_taken = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const values = [
                pharmacistId,
                data.acknowledged_at,
                data.notes,
                data.action_taken,
                alertId
            ];

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Alert not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in acknowledgeExpiryAlert', { error: error.message, pharmacistId, alertId });
            throw error;
        }
    },

    /**
     * Get return statistics
     */
    async getReturnStatistics(pharmacistId, options = {}) {
        try {
            const { period = 'month', from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND returned_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else if (period === 'month') {
                dateFilter = "AND returned_at > NOW() - INTERVAL '30 days'";
            } else if (period === 'quarter') {
                dateFilter = "AND returned_at > NOW() - INTERVAL '90 days'";
            } else if (period === 'year') {
                dateFilter = "AND returned_at > NOW() - INTERVAL '1 year'";
            }

            const query = `
                WITH daily_returns AS (
                    SELECT 
                        DATE(returned_at) as date,
                        COUNT(*) as return_count,
                        SUM(quantity) as total_quantity,
                        COUNT(*) FILTER (WHERE return_type = 'damaged') as damaged_count,
                        COUNT(*) FILTER (WHERE return_type = 'expired') as expired_count,
                        COUNT(*) FILTER (WHERE return_type = 'patient_return') as patient_return_count,
                        COUNT(*) FILTER (WHERE return_type = 'quality_issue') as quality_count
                    FROM returns
                    WHERE 1=1
                        ${dateFilter}
                    GROUP BY DATE(returned_at)
                ),
                reason_stats AS (
                    SELECT 
                        return_type,
                        COUNT(*) as count,
                        SUM(quantity) as total_quantity
                    FROM returns
                    WHERE 1=1
                        ${dateFilter}
                    GROUP BY return_type
                )
                SELECT 
                    (SELECT json_agg(daily_returns.*) FROM daily_returns) as daily,
                    (SELECT json_agg(reason_stats.*) FROM reason_stats) as by_reason,
                    (
                        SELECT 
                            json_build_object(
                                'total_returns', COUNT(*),
                                'total_quantity', SUM(quantity),
                                'avg_daily_returns', AVG(daily_returns.return_count),
                                'most_common_reason', (
                                    SELECT return_type FROM reason_stats 
                                    ORDER BY count DESC LIMIT 1
                                )
                            )
                        FROM returns
                        WHERE 1=1
                            ${dateFilter}
                    ) as summary
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getReturnStatistics', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get returns by reason
     */
    async getReturnsByReason(pharmacistId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND r.returned_at BETWEEN '${from_date}' AND '${to_date}'`;
            }

            const query = `
                SELECT 
                    r.return_type,
                    COUNT(*) as return_count,
                    SUM(r.quantity) as total_quantity,
                    json_agg(
                        json_build_object(
                            'id', r.id,
                            'medicine_name', i.medicine_name,
                            'quantity', r.quantity,
                            'returned_at', r.returned_at,
                            'status', r.status
                        ) ORDER BY r.returned_at DESC
                    ) as returns
                FROM returns r
                JOIN inventory i ON r.medicine_id = i.id
                WHERE 1=1
                    ${dateFilter}
                GROUP BY r.return_type
                ORDER BY return_count DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getReturnsByReason', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Export returns report
     */
    async exportReturnsReport(pharmacistId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    r.id,
                    r.return_type,
                    r.return_reason,
                    r.quantity,
                    r.returned_at,
                    r.status,
                    i.medicine_name,
                    i.category,
                    b.batch_number,
                    b.expiry_date,
                    CONCAT(e.first_name, ' ', e.last_name) as returned_by,
                    p.id as prescription_number
                FROM returns r
                JOIN inventory i ON r.medicine_id = i.id
                LEFT JOIN batches b ON r.batch_id = b.id
                LEFT JOIN employees e ON r.returned_by = e.id
                LEFT JOIN prescriptions p ON r.prescription_id = p.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND r.returned_at >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND r.returned_at <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            if (filters.return_type) {
                query += ` AND r.return_type = $${paramIndex}`;
                values.push(filters.return_type);
                paramIndex++;
            }

            query += ` ORDER BY r.returned_at DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportReturnsReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Return to supplier
     */
    async returnToSupplier(pharmacistId, returnData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Create supplier return record
            const returnQuery = `
                INSERT INTO supplier_returns (
                    id, supplier_id, return_reason, shipping_method,
                    tracking_number, notes, returned_by, returned_at,
                    status, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
                    'pending', NOW()
                ) RETURNING *
            `;

            const returnValues = [
                returnData.supplier_id,
                returnData.return_reason,
                returnData.shipping_method || null,
                returnData.tracking_number || null,
                returnData.notes || null,
                returnData.returned_by,
                returnData.returned_at
            ];

            const supplierReturn = await client.query(returnQuery, returnValues);

            // Add return items
            for (const item of returnData.items) {
                await client.query(`
                    INSERT INTO supplier_return_items (
                        id, supplier_return_id, batch_id, quantity,
                        return_reason, unit_price, total_price
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6
                    )
                `, [
                    supplierReturn.rows[0].id,
                    item.batch_id,
                    item.quantity,
                    item.return_reason || returnData.return_reason,
                    item.unit_price,
                    item.quantity * item.unit_price
                ]);

                // Remove from batch
                await client.query(`
                    UPDATE batches 
                    SET quantity = quantity - $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [item.quantity, item.batch_id]);
            }

            await db.commitTransaction(client);

            return supplierReturn.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get supplier returns
     */
    async getSupplierReturns(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, supplier_id, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT sr.*, 
                       s.name as supplier_name,
                       COUNT(sri.id) as item_count,
                       SUM(sri.quantity) as total_quantity,
                       SUM(sri.total_price) as total_value
                FROM supplier_returns sr
                JOIN suppliers s ON sr.supplier_id = s.id
                LEFT JOIN supplier_return_items sri ON sr.id = sri.supplier_return_id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (supplier_id) {
                query += ` AND sr.supplier_id = $${paramIndex}`;
                values.push(supplier_id);
                paramIndex++;
            }

            if (status) {
                query += ` AND sr.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` GROUP BY sr.id, s.id
                      ORDER BY sr.returned_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM supplier_returns
                WHERE 1=1
                ${supplier_id ? 'AND supplier_id = $1' : ''}
                ${status ? 'AND status = $2' : ''}
            `;
            const countValues = [];
            if (supplier_id) countValues.push(supplier_id);
            if (status) countValues.push(status);
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getSupplierReturns', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Update supplier return status
     */
    async updateSupplierReturnStatus(pharmacistId, returnId, status, data) {
        try {
            const query = `
                UPDATE supplier_returns
                SET status = $1,
                    processed_notes = $2,
                    processed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $3
                RETURNING *
            `;

            const values = [status, data.notes, returnId];

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Return not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in updateSupplierReturnStatus', { error: error.message, pharmacistId, returnId });
            throw error;
        }
    },

    /**
     * Generate credit note
     */
    async generateCreditNote(pharmacistId, returnId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get return details
            const returnQuery = `
                SELECT r.*, 
                       SUM(sri.total_price) as total_amount
                FROM supplier_returns r
                LEFT JOIN supplier_return_items sri ON r.id = sri.supplier_return_id
                WHERE r.id = $1
                GROUP BY r.id
            `;
            const returnData = await client.query(returnQuery, [returnId]);

            if (returnData.rows.length === 0) {
                throw new Error('Return not found');
            }

            // Check if credit note already exists
            const checkQuery = `
                SELECT id FROM credit_notes
                WHERE supplier_return_id = $1
            `;
            const check = await client.query(checkQuery, [returnId]);

            if (check.rows.length > 0) {
                throw new Error('Credit note already exists for this return');
            }

            // Generate credit note number
            const cnNumber = `CN-${Date.now()}`;

            const query = `
                INSERT INTO credit_notes (
                    id, credit_note_number, supplier_return_id,
                    supplier_id, amount, reason, notes,
                    issued_by, issued_at, status, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), 'issued', NOW()
                ) RETURNING *
            `;

            const values = [
                cnNumber,
                returnId,
                returnData.rows[0].supplier_id,
                returnData.rows[0].total_amount,
                returnData.rows[0].return_reason,
                data.notes || null,
                pharmacistId
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get credit notes
     */
    async getCreditNotes(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT cn.*, 
                       s.name as supplier_name,
                       sr.return_reason,
                       SUM(cn.amount) OVER() as total_amount_all
                FROM credit_notes cn
                JOIN supplier_returns sr ON cn.supplier_return_id = sr.id
                JOIN suppliers s ON cn.supplier_id = s.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                query += ` AND cn.issued_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND cn.issued_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY cn.issued_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total,
                       SUM(amount) as total_amount
                FROM credit_notes
                WHERE 1=1
                ${from_date ? 'AND issued_at >= $1' : ''}
                ${to_date ? 'AND issued_at <= $2' : ''}
            `;
            const countValues = [];
            if (from_date) countValues.push(from_date);
            if (to_date) countValues.push(to_date);
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0].total),
                    total_amount: parseFloat(count.rows[0].total_amount) || 0
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getCreditNotes', { error: error.message, pharmacistId });
            throw error;
        }
    }
};

module.exports = returnService;