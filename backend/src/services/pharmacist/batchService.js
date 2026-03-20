/**
 * ======================================================================
 * FILE: backend/src/services/pharmacist/batchService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist batch service - Handles business logic for batch management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-21] Alert 30 days before expiry
 * - [BR-23] Batch tracking mandatory
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const batchService = {
    /**
     * Get all batches
     */
    async getAllBatches(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, medicine_id, supplier_id, status, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*, 
                       i.medicine_name, i.category, i.manufacturer,
                       s.name as supplier_name,
                       CASE 
                           WHEN b.expiry_date < NOW() THEN 'expired'
                           WHEN b.expiry_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
                           ELSE 'valid'
                       END as batch_status,
                       EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                       (b.quantity * b.unit_price) as total_value
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                LEFT JOIN suppliers s ON b.supplier_id = s.id
                WHERE b.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (medicine_id) {
                query += ` AND b.medicine_id = $${paramIndex}`;
                values.push(medicine_id);
                paramIndex++;
            }

            if (supplier_id) {
                query += ` AND b.supplier_id = $${paramIndex}`;
                values.push(supplier_id);
                paramIndex++;
            }

            if (status) {
                if (status === 'expired') {
                    query += ` AND b.expiry_date < NOW()`;
                } else if (status === 'expiring_soon') {
                    query += ` AND b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'`;
                } else if (status === 'valid') {
                    query += ` AND b.expiry_date > NOW() + INTERVAL '30 days'`;
                }
            }

            if (from_date) {
                query += ` AND b.received_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND b.received_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY b.expiry_date ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM batches b
                WHERE b.is_deleted = false
                ${medicine_id ? 'AND b.medicine_id = $1' : ''}
            `;
            const countValues = medicine_id ? [medicine_id] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_batches,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    COUNT(*) FILTER (WHERE expiry_date < NOW()) as expired_count,
                    COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_count
                FROM batches b
                WHERE b.is_deleted = false
                ${medicine_id ? 'AND b.medicine_id = $1' : ''}
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
            logger.error('Error in getAllBatches', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiring batches [BR-21]
     */
    async getExpiringBatches(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, days = 30 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT b.*, 
                       i.medicine_name, i.category, i.manufacturer,
                       s.name as supplier_name,
                       EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                       (b.quantity * b.unit_price) as total_value,
                       CASE 
                           WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                           WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                           ELSE 'notice'
                       END as urgency
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                LEFT JOIN suppliers s ON b.supplier_id = s.id
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
                    AND b.is_deleted = false
                ORDER BY b.expiry_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value
                FROM batches b
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
                    AND b.is_deleted = false
            `;
            const count = await db.query(countQuery);

            // [BR-21] Create expiry alerts
            await this.checkAndCreateBatchExpiryAlerts(pharmacistId, result.rows);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getExpiringBatches', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get batch by ID
     */
    async getBatchById(pharmacistId, batchId) {
        try {
            const query = `
                SELECT b.*, 
                       i.medicine_name, i.category, i.manufacturer,
                       i.storage_conditions, i.requires_prescription,
                       i.is_narcotic,
                       s.name as supplier_name,
                       s.phone as supplier_phone,
                       s.email as supplier_email,
                       po.po_number,
                       po.order_date as po_date,
                       EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', sm.id,
                                   'quantity', sm.quantity,
                                   'movement_type', sm.movement_type,
                                   'reference', sm.reference_number,
                                   'created_at', sm.created_at,
                                   'created_by', CONCAT(e.first_name, ' ', e.last_name)
                               ) ORDER BY sm.created_at DESC
                           )
                           FROM stock_movements sm
                           LEFT JOIN employees e ON sm.created_by = e.id
                           WHERE sm.batch_id = b.id
                           LIMIT 20
                       ) as movements
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                LEFT JOIN suppliers s ON b.supplier_id = s.id
                LEFT JOIN purchase_orders po ON b.purchase_order_id = po.id
                WHERE b.id = $1 AND b.is_deleted = false
            `;

            const result = await db.query(query, [batchId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getBatchById', { error: error.message, pharmacistId, batchId });
            throw error;
        }
    },

    /**
     * Add new batch [BR-23]
     */
    async addBatch(pharmacistId, batchData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if batch number already exists [BR-23]
            const checkQuery = `
                SELECT id FROM batches 
                WHERE batch_number = $1 AND is_deleted = false
            `;
            const check = await client.query(checkQuery, [batchData.batch_number]);
            
            if (check.rows.length > 0) {
                throw new Error('Batch number already exists');
            }

            const query = `
                INSERT INTO batches (
                    id, medicine_id, batch_number, manufacturing_date,
                    expiry_date, quantity, unit_price, selling_price,
                    mrp, supplier_id, purchase_order_id, received_date,
                    location, rack_number, notes, created_by, created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                batchData.medicine_id,
                batchData.batch_number,
                batchData.manufacturing_date,
                batchData.expiry_date,
                batchData.quantity,
                batchData.unit_price,
                batchData.selling_price || batchData.unit_price * 1.2,
                batchData.mrp || batchData.unit_price * 1.5,
                batchData.supplier_id || null,
                batchData.purchase_order_id || null,
                batchData.received_date || new Date(),
                batchData.location || null,
                batchData.rack_number || null,
                batchData.notes || null,
                pharmacistId
            ];

            const result = await client.query(query, values);

            // Update inventory with batch info
            await client.query(`
                UPDATE inventory 
                SET batch_number = $1,
                    quantity = quantity + $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [batchData.batch_number, batchData.quantity, batchData.medicine_id]);

            // Log batch creation
            await client.query(`
                INSERT INTO batch_movements (
                    id, batch_id, quantity, movement_type,
                    reference_number, notes, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'received',
                    'BATCH-' || $1, 'New batch received', $3, NOW()
                )
            `, [result.rows[0].id, batchData.quantity, pharmacistId]);

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
     * Update batch
     */
    async updateBatch(pharmacistId, batchId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'manufacturing_date', 'expiry_date', 'quantity',
                'unit_price', 'selling_price', 'mrp',
                'location', 'rack_number', 'notes'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(batchId);

            const query = `
                UPDATE batches 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Batch not found');
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
     * Delete batch
     */
    async deleteBatch(pharmacistId, batchId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if batch has stock
            const checkQuery = `SELECT quantity, medicine_id FROM batches WHERE id = $1`;
            const check = await client.query(checkQuery, [batchId]);
            
            if (check.rows.length === 0) {
                throw new Error('Batch not found');
            }

            if (check.rows[0].quantity > 0) {
                throw new Error('Cannot delete batch with existing stock');
            }

            const query = `
                UPDATE batches 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    deletion_reason = $2
                WHERE id = $3
                RETURNING id
            `;

            const result = await client.query(query, [pharmacistId, reason, batchId]);

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
     * Get batch movements
     */
    async getBatchMovements(pharmacistId, batchId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT bm.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as created_by_name
                FROM batch_movements bm
                LEFT JOIN employees e ON bm.created_by = e.id
                WHERE bm.batch_id = $1
                ORDER BY bm.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [batchId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM batch_movements
                WHERE batch_id = $1
            `;
            const count = await db.query(countQuery, [batchId]);

            // Get summary
            const summaryQuery = `
                SELECT 
                    SUM(CASE WHEN movement_type = 'received' THEN quantity ELSE 0 END) as total_received,
                    SUM(CASE WHEN movement_type = 'dispensed' THEN quantity ELSE 0 END) as total_dispensed,
                    SUM(CASE WHEN movement_type = 'returned' THEN quantity ELSE 0 END) as total_returned,
                    SUM(CASE WHEN movement_type = 'damaged' THEN quantity ELSE 0 END) as total_damaged,
                    COUNT(*) as total_movements
                FROM batch_movements
                WHERE batch_id = $1
            `;
            const summary = await db.query(summaryQuery, [batchId]);

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
            logger.error('Error in getBatchMovements', { error: error.message, pharmacistId, batchId });
            throw error;
        }
    },

    /**
     * Transfer batch to different location
     */
    async transferBatch(pharmacistId, batchId, transferData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get current batch info
            const batchQuery = `SELECT * FROM batches WHERE id = $1`;
            const batch = await client.query(batchQuery, [batchId]);
            
            if (batch.rows.length === 0) {
                throw new Error('Batch not found');
            }

            const quantity = transferData.quantity === 'all' 
                ? batch.rows[0].quantity 
                : transferData.quantity;

            if (quantity > batch.rows[0].quantity) {
                throw new Error('Insufficient quantity');
            }

            // Update batch quantity
            await client.query(`
                UPDATE batches 
                SET quantity = quantity - $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [quantity, batchId]);

            // Create new batch at new location if transferring all
            let newBatchId = null;
            if (transferData.quantity === 'all') {
                const newBatchQuery = `
                    INSERT INTO batches (
                        id, medicine_id, batch_number, manufacturing_date,
                        expiry_date, quantity, unit_price, selling_price,
                        mrp, supplier_id, purchase_order_id, received_date,
                        location, rack_number, notes, created_by, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
                        $9, $10, $11, $12, $13, $14, $15, NOW()
                    ) RETURNING id
                `;
                const newBatch = await client.query(newBatchQuery, [
                    batch.rows[0].medicine_id,
                    batch.rows[0].batch_number + '-T',
                    batch.rows[0].manufacturing_date,
                    batch.rows[0].expiry_date,
                    quantity,
                    batch.rows[0].unit_price,
                    batch.rows[0].selling_price,
                    batch.rows[0].mrp,
                    batch.rows[0].supplier_id,
                    batch.rows[0].purchase_order_id,
                    batch.rows[0].received_date,
                    transferData.to_location,
                    transferData.to_rack,
                    transferData.reason || 'Batch transferred',
                    pharmacistId
                ]);
                newBatchId = newBatch.rows[0].id;
            } else {
                // Update existing batch location
                await client.query(`
                    UPDATE batches 
                    SET location = $1,
                        rack_number = $2,
                        updated_at = NOW()
                    WHERE id = $3
                `, [transferData.to_location, transferData.to_rack, batchId]);
            }

            // Log movement
            await client.query(`
                INSERT INTO batch_movements (
                    id, batch_id, quantity, movement_type,
                    from_location, to_location, reference_number,
                    notes, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'transferred',
                    $3, $4, 'TRANSFER-' || $1, $5, $6, NOW()
                )
            `, [
                batchId,
                quantity,
                batch.rows[0].location,
                transferData.to_location,
                transferData.reason || 'Batch transferred',
                pharmacistId
            ]);

            await db.commitTransaction(client);

            return {
                batch_id: batchId,
                new_batch_id: newBatchId,
                quantity: quantity,
                from_location: batch.rows[0].location,
                to_location: transferData.to_location
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get batch by batch number
     */
    async getBatchByNumber(pharmacistId, batchNumber) {
        try {
            const query = `
                SELECT b.*, 
                       i.medicine_name, i.category,
                       s.name as supplier_name
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                LEFT JOIN suppliers s ON b.supplier_id = s.id
                WHERE b.batch_number = $1 AND b.is_deleted = false
            `;

            const result = await db.query(query, [batchNumber]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getBatchByNumber', { error: error.message, pharmacistId, batchNumber });
            throw error;
        }
    },

    /**
     * Mark batch for quality check
     */
    async markForQualityCheck(pharmacistId, batchId, checkData) {
        try {
            const query = `
                INSERT INTO quality_checks (
                    id, batch_id, check_type, sample_size,
                    notes, checked_by, checked_at, status,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', NOW()
                ) RETURNING *
            `;

            const values = [
                batchId,
                checkData.check_type,
                checkData.sample_size,
                checkData.notes,
                checkData.checked_by,
                checkData.checked_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in markForQualityCheck', { error: error.message, pharmacistId, batchId });
            throw error;
        }
    },

    /**
     * Update quality check result
     */
    async updateQualityResult(pharmacistId, batchId, resultData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE quality_checks
                SET status = $1,
                    passed = $2,
                    result_notes = $3,
                    action_taken = $4,
                    completed_at = $5,
                    updated_at = NOW()
                WHERE batch_id = $6 AND status = 'pending'
                RETURNING *
            `;

            const values = [
                resultData.passed ? 'passed' : 'failed',
                resultData.passed,
                resultData.notes,
                resultData.action_taken,
                resultData.updated_at,
                batchId
            ];

            const result = await client.query(query, values);

            // If quality check failed, mark batch for quarantine
            if (!resultData.passed) {
                await client.query(`
                    UPDATE batches 
                    SET status = 'quarantine',
                        updated_at = NOW()
                    WHERE id = $1
                `, [batchId]);
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
     * Get batch expiry report
     */
    async getBatchExpiryReport(pharmacistId, months = 6) {
        try {
            const query = `
                SELECT 
                    DATE_TRUNC('month', expiry_date) as expiry_month,
                    COUNT(*) as batch_count,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    json_agg(
                        json_build_object(
                            'id', id,
                            'batch_number', batch_number,
                            'medicine_name', i.medicine_name,
                            'quantity', quantity,
                            'expiry_date', expiry_date
                        )
                    ) as batches
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${months} months'
                    AND b.is_deleted = false
                GROUP BY DATE_TRUNC('month', expiry_date)
                ORDER BY expiry_month ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getBatchExpiryReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get batch summary by medicine
     */
    async getBatchSummaryByMedicine(pharmacistId, medicineId) {
        try {
            const query = `
                SELECT 
                    i.medicine_name,
                    COUNT(*) as total_batches,
                    SUM(b.quantity) as total_quantity,
                    AVG(b.unit_price) as avg_unit_price,
                    MIN(b.expiry_date) as earliest_expiry,
                    MAX(b.expiry_date) as latest_expiry,
                    COUNT(*) FILTER (WHERE b.expiry_date < NOW()) as expired_batches,
                    COUNT(*) FILTER (WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_batches,
                    json_agg(
                        json_build_object(
                            'id', b.id,
                            'batch_number', b.batch_number,
                            'quantity', b.quantity,
                            'expiry_date', b.expiry_date,
                            'location', b.location
                        ) ORDER BY b.expiry_date
                    ) as batches
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.medicine_id = $1 AND b.is_deleted = false
                GROUP BY i.medicine_name
            `;

            const result = await db.query(query, [medicineId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getBatchSummaryByMedicine', { error: error.message, pharmacistId, medicineId });
            throw error;
        }
    },

    /**
     * Get batch alerts
     */
    async getBatchAlerts(pharmacistId) {
        try {
            const query = `
                SELECT 
                    'expiring_soon' as type,
                    b.id,
                    b.batch_number,
                    i.medicine_name,
                    b.quantity,
                    EXTRACT(DAY FROM (b.expiry_date - NOW())) as days_until_expiry,
                    CASE 
                        WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                        WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                        ELSE 'info'
                    END as severity
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                    AND b.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'expired' as type,
                    b.id,
                    b.batch_number,
                    i.medicine_name,
                    b.quantity,
                    ABS(EXTRACT(DAY FROM (NOW() - b.expiry_date))) as days_expired,
                    'critical' as severity
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date < NOW() AND b.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'quality_issue' as type,
                    b.id,
                    b.batch_number,
                    i.medicine_name,
                    b.quantity,
                    0 as days,
                    'warning' as severity
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.status = 'quarantine' AND b.is_deleted = false
                
                ORDER BY severity DESC, days_until_expiry ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getBatchAlerts', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Check and create batch expiry alerts [BR-21]
     */
    async checkAndCreateBatchExpiryAlerts(pharmacistId, batches) {
        try {
            for (const batch of batches) {
                const daysUntil = batch.days_until_expiry;
                
                if (daysUntil <= 7) {
                    await db.query(`
                        INSERT INTO batch_alerts (
                            id, batch_id, alert_type, severity,
                            message, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, 'expiry', 'critical',
                            $2, NOW()
                        ) ON CONFLICT (batch_id, alert_type) DO NOTHING
                    `, [
                        batch.id,
                        `CRITICAL: Batch ${batch.batch_number} (${batch.medicine_name}) expires in ${daysUntil} days`
                    ]);
                } else if (daysUntil <= 15) {
                    await db.query(`
                        INSERT INTO batch_alerts (
                            id, batch_id, alert_type, severity,
                            message, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, 'expiry', 'warning',
                            $2, NOW()
                        ) ON CONFLICT (batch_id, alert_type) DO NOTHING
                    `, [
                        batch.id,
                        `WARNING: Batch ${batch.batch_number} (${batch.medicine_name}) expires in ${daysUntil} days`
                    ]);
                } else {
                    await db.query(`
                        INSERT INTO batch_alerts (
                            id, batch_id, alert_type, severity,
                            message, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, 'expiry', 'info',
                            $2, NOW()
                        ) ON CONFLICT (batch_id, alert_type) DO NOTHING
                    `, [
                        batch.id,
                        `INFO: Batch ${batch.batch_number} (${batch.medicine_name}) expires in ${daysUntil} days`
                    ]);
                }
            }
        } catch (error) {
            logger.error('Error in checkAndCreateBatchExpiryAlerts', { error: error.message, pharmacistId });
        }
    }
};

module.exports = batchService;