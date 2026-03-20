/**
 * ======================================================================
 * FILE: backend/src/services/pharmacist/dispensingService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist dispensing service - Handles business logic for prescription dispensing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-16] Controlled substances need special flag
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-19] Stock cannot go negative
 * - [BR-22] FIFO (First In First Out) dispensing
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const dispensingService = {
    /**
     * Get all prescriptions
     */
    async getAllPrescriptions(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, status, patient_id, doctor_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT p.*, 
                       pat.first_name as patient_first_name,
                       pat.last_name as patient_last_name,
                       doc.first_name as doctor_first_name,
                       doc.last_name as doctor_last_name,
                       COUNT(pm.id) as medicine_count,
                       SUM(pm.quantity) as total_quantity
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                JOIN employees doc ON p.doctor_id = doc.id
                LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND p.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND p.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (doctor_id) {
                query += ` AND p.doctor_id = $${paramIndex}`;
                values.push(doctor_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND p.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND p.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` GROUP BY p.id, pat.id, doc.id
                      ORDER BY p.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM prescriptions p
                WHERE 1=1
                ${status ? 'AND p.status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_prescriptions,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'dispensed') as dispensed,
                    COUNT(*) FILTER (WHERE status = 'partial') as partial,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
                FROM prescriptions p
                WHERE 1=1
                ${status ? 'AND p.status = $1' : ''}
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
            logger.error('Error in getAllPrescriptions', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get pending prescriptions
     */
    async getPendingPrescriptions(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT p.*, 
                       pat.first_name as patient_first_name,
                       pat.last_name as patient_last_name,
                       doc.first_name as doctor_first_name,
                       doc.last_name as doctor_last_name,
                       COUNT(pm.id) as medicine_count,
                       SUM(pm.quantity) as total_quantity,
                       CASE 
                           WHEN EXISTS (
                               SELECT 1 FROM prescription_medicines pm2
                               JOIN inventory i ON pm2.medicine_id = i.id
                               WHERE pm2.prescription_id = p.id
                                   AND i.is_narcotic = true
                           ) THEN true ELSE false
                       END as has_controlled
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                JOIN employees doc ON p.doctor_id = doc.id
                LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
                WHERE p.status = 'pending'
                GROUP BY p.id, pat.id, doc.id
                ORDER BY p.created_at ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM prescriptions
                WHERE status = 'pending'
            `;
            const count = await db.query(countQuery);

            // Calculate estimated processing time
            const estimatedTime = result.rows.length * 5; // 5 minutes per prescription

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0].total),
                    estimated_time: estimatedTime
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getPendingPrescriptions', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get dispensed prescriptions
     */
    async getDispensedPrescriptions(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT p.*, 
                       pat.first_name as patient_first_name,
                       pat.last_name as patient_last_name,
                       d.id as dispensing_id,
                       d.dispensed_at,
                       d.dispensed_by,
                       CONCAT(ph.first_name, ' ', ph.last_name) as dispensed_by_name,
                       d.total_items,
                       d.total_value
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                JOIN dispensing_records d ON p.id = d.prescription_id
                LEFT JOIN employees ph ON d.dispensed_by = ph.id
                WHERE p.status = 'dispensed'
            `;
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                query += ` AND d.dispensed_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND d.dispensed_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY d.dispensed_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM prescriptions p
                JOIN dispensing_records d ON p.id = d.prescription_id
                WHERE p.status = 'dispensed'
                ${from_date ? 'AND d.dispensed_at >= $1' : ''}
                ${to_date ? 'AND d.dispensed_at <= $2' : ''}
            `;
            const countValues = [];
            if (from_date) countValues.push(from_date);
            if (to_date) countValues.push(to_date);
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(d.total_items) as total_items,
                    SUM(d.total_value) as total_value
                FROM dispensing_records d
                WHERE 1=1
                ${from_date ? 'AND d.dispensed_at >= $1' : ''}
                ${to_date ? 'AND d.dispensed_at <= $2' : ''}
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
            logger.error('Error in getDispensedPrescriptions', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get prescription by ID
     */
    async getPrescriptionById(pharmacistId, prescriptionId) {
        try {
            const query = `
                SELECT p.*, 
                       pat.id as patient_id,
                       pat.first_name as patient_first_name,
                       pat.last_name as patient_last_name,
                       pat.date_of_birth as patient_dob,
                       pat.gender as patient_gender,
                       pat.blood_group as patient_blood_group,
                       pat.allergies,
                       doc.id as doctor_id,
                       doc.first_name as doctor_first_name,
                       doc.last_name as doctor_last_name,
                       doc.specialization as doctor_specialization,
                       doc.license_number as doctor_license,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', pm.id,
                                   'medicine_id', pm.medicine_id,
                                   'medicine_name', i.medicine_name,
                                   'generic_name', i.generic_name,
                                   'dosage', pm.dosage,
                                   'frequency', pm.frequency,
                                   'duration', pm.duration,
                                   'quantity', pm.quantity,
                                   'instructions', pm.instructions,
                                   'is_controlled', i.is_narcotic,
                                   'requires_prescription', i.requires_prescription,
                                   'available_stock', i.quantity,
                                   'unit_price', i.selling_price
                               )
                           ) as items
                       FROM prescription_medicines pm
                       JOIN inventory i ON pm.medicine_id = i.id
                       WHERE pm.prescription_id = p.id
                   ) as items
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                JOIN employees doc ON p.doctor_id = doc.id
                WHERE p.id = $1
            `;

            const result = await db.query(query, [prescriptionId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getPrescriptionById', { error: error.message, pharmacistId, prescriptionId });
            throw error;
        }
    },

    /**
     * Get prescription items
     */
    async getPrescriptionItems(pharmacistId, prescriptionId) {
        try {
            const query = `
                SELECT pm.*, 
                       i.medicine_name, i.generic_name, i.category,
                       i.manufacturer, i.batch_number, i.expiry_date,
                       i.quantity as available_stock, i.unit_price,
                       i.selling_price, i.is_narcotic,
                       i.requires_prescription,
                       CASE 
                           WHEN i.expiry_date < NOW() THEN 'expired'
                           WHEN i.quantity <= 0 THEN 'out_of_stock'
                           WHEN i.quantity < pm.quantity THEN 'insufficient'
                           ELSE 'available'
                       END as availability_status
                FROM prescription_medicines pm
                JOIN inventory i ON pm.medicine_id = i.id
                WHERE pm.prescription_id = $1
                ORDER BY pm.created_at ASC
            `;

            const result = await db.query(query, [prescriptionId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPrescriptionItems', { error: error.message, pharmacistId, prescriptionId });
            throw error;
        }
    },

    /**
     * Check items availability
     */
    async checkItemsAvailability(pharmacistId, items) {
        try {
            const availability = {
                all_available: true,
                available: [],
                unavailable: [],
                partial: []
            };

            for (const item of items) {
                const query = `
                    SELECT i.*, 
                           SUM(b.quantity) as batch_quantity
                    FROM inventory i
                    LEFT JOIN batches b ON i.id = b.medicine_id
                        AND b.expiry_date > NOW()
                        AND b.quantity > 0
                    WHERE i.id = $1
                    GROUP BY i.id
                `;

                const result = await db.query(query, [item.medicine_id]);
                
                if (result.rows.length === 0) {
                    availability.all_available = false;
                    availability.unavailable.push({
                        ...item,
                        reason: 'Medicine not found'
                    });
                } else {
                    const medicine = result.rows[0];
                    
                    // [BR-18] Check expiry
                    if (medicine.expiry_date && new Date(medicine.expiry_date) < new Date()) {
                        availability.all_available = false;
                        availability.unavailable.push({
                            ...item,
                            reason: 'Medicine expired'
                        });
                    }
                    // Check stock
                    else if (medicine.quantity < item.quantity) {
                        if (medicine.quantity > 0) {
                            availability.partial.push({
                                ...item,
                                available_quantity: medicine.quantity,
                                reason: `Only ${medicine.quantity} units available`
                            });
                        } else {
                            availability.unavailable.push({
                                ...item,
                                reason: 'Out of stock'
                            });
                        }
                        availability.all_available = false;
                    } else {
                        availability.available.push({
                            ...item,
                            available_quantity: medicine.quantity,
                            batches: await this.getFIFOBatches(item.medicine_id, item.quantity)
                        });
                    }
                }
            }

            return availability;
        } catch (error) {
            logger.error('Error in checkItemsAvailability', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get FIFO batches [BR-22]
     */
    async getFIFOBatches(medicineId, requiredQuantity) {
        try {
            const query = `
                SELECT id, batch_number, quantity, expiry_date,
                       unit_price, selling_price
                FROM batches
                WHERE medicine_id = $1 
                    AND quantity > 0 
                    AND expiry_date > NOW()
                ORDER BY expiry_date ASC
            `;

            const result = await db.query(query, [medicineId]);
            
            const batches = [];
            let remainingQuantity = requiredQuantity;

            for (const batch of result.rows) {
                if (remainingQuantity <= 0) break;
                
                const takeQuantity = Math.min(batch.quantity, remainingQuantity);
                batches.push({
                    ...batch,
                    take_quantity: takeQuantity
                });
                remainingQuantity -= takeQuantity;
            }

            return batches;
        } catch (error) {
            logger.error('Error in getFIFOBatches', { error: error.message, medicineId });
            throw error;
        }
    },

    /**
     * Check and reserve stock
     */
    async checkAndReserveStock(pharmacistId, prescriptionId, items) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const availability = {
                all_available: true,
                available: [],
                unavailable: [],
                items_with_batches: []
            };

            for (const item of items) {
                // Get medicine details
                const medicineQuery = `
                    SELECT i.*, 
                           SUM(b.quantity) as total_batch_quantity
                    FROM inventory i
                    LEFT JOIN batches b ON i.id = b.medicine_id
                        AND b.expiry_date > NOW()
                        AND b.quantity > 0
                    WHERE i.id = $1
                    GROUP BY i.id
                `;
                const medicine = await client.query(medicineQuery, [item.medicine_id]);
                
                if (medicine.rows.length === 0) {
                    availability.all_available = false;
                    availability.unavailable.push({
                        ...item,
                        reason: 'Medicine not found'
                    });
                    continue;
                }

                // [BR-18] Check expiry
                if (medicine.rows[0].expiry_date && new Date(medicine.rows[0].expiry_date) < new Date()) {
                    availability.all_available = false;
                    availability.unavailable.push({
                        ...item,
                        reason: 'Medicine expired'
                    });
                    continue;
                }

                // Get FIFO batches [BR-22]
                const batches = await this.getFIFOBatches(item.medicine_id, item.quantity);
                
                const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
                
                if (totalAvailable < item.quantity) {
                    availability.all_available = false;
                    if (totalAvailable > 0) {
                        availability.unavailable.push({
                            ...item,
                            available_quantity: totalAvailable,
                            reason: `Only ${totalAvailable} units available`
                        });
                    } else {
                        availability.unavailable.push({
                            ...item,
                            reason: 'Out of stock'
                        });
                    }
                } else {
                    // Reserve stock from batches
                    const reservedBatches = [];
                    let remainingQty = item.quantity;

                    for (const batch of batches) {
                        if (remainingQty <= 0) break;
                        
                        const takeQty = Math.min(batch.quantity, remainingQty);
                        
                        // Temporarily reduce batch quantity (will be finalized on dispense)
                        await client.query(`
                            UPDATE batches 
                            SET quantity = quantity - $1,
                                updated_at = NOW()
                            WHERE id = $2
                        `, [takeQty, batch.id]);
                        
                        reservedBatches.push({
                            batch_id: batch.id,
                            batch_number: batch.batch_number,
                            quantity: takeQty,
                            unit_price: batch.unit_price
                        });
                        
                        remainingQty -= takeQty;
                    }

                    availability.items_with_batches.push({
                        ...item,
                        batches: reservedBatches
                    });
                }
            }

            if (availability.all_available) {
                await db.commitTransaction(client);
            } else {
                await db.rollbackTransaction(client);
            }

            return availability;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Dispense prescription
     */
    async dispensePrescription(pharmacistId, prescriptionId, dispenseData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Create dispensing record
            const dispensingQuery = `
                INSERT INTO dispensing_records (
                    id, prescription_id, dispensed_at, dispensed_by,
                    total_items, total_value, dispensing_notes,
                    pharmacist_notes, witness_id, ip_address,
                    user_agent, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
                ) RETURNING *
            `;

            const totalValue = dispenseData.items.reduce((sum, item) => {
                const itemTotal = item.batches.reduce((batchSum, batch) => 
                    batchSum + (batch.quantity * batch.unit_price), 0);
                return sum + itemTotal;
            }, 0);

            const dispensingValues = [
                prescriptionId,
                dispenseData.dispensed_at,
                dispenseData.dispensed_by,
                dispenseData.items.length,
                totalValue,
                dispenseData.dispensing_notes,
                dispenseData.pharmacist_notes,
                dispenseData.witness_id,
                dispenseData.ip_address,
                dispenseData.user_agent
            ];

            const dispensing = await client.query(dispensingQuery, dispensingValues);

            // Create dispensing items
            for (const item of dispenseData.items) {
                for (const batch of item.batches) {
                    await client.query(`
                        INSERT INTO dispensing_items (
                            id, dispensing_id, prescription_medicine_id,
                            batch_id, quantity, unit_price, total_price
                        ) VALUES (
                            gen_random_uuid(), $1, $2, $3, $4, $5, $6
                        )
                    `, [
                        dispensing.rows[0].id,
                        item.id,
                        batch.batch_id,
                        batch.quantity,
                        batch.unit_price,
                        batch.quantity * batch.unit_price
                    ]);

                    // Log batch movement
                    await client.query(`
                        INSERT INTO batch_movements (
                            id, batch_id, quantity, movement_type,
                            reference_number, notes, created_by, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, $2, 'dispensed',
                            $3, $4, $5, NOW()
                        )
                    `, [
                        batch.batch_id,
                        batch.quantity,
                        prescriptionId,
                        `Dispensed for prescription ${prescriptionId}`,
                        pharmacistId
                    ]);
                }
            }

            // Update prescription status
            await client.query(`
                UPDATE prescriptions 
                SET status = 'dispensed',
                    dispensed_at = $1,
                    dispensed_by = $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [dispenseData.dispensed_at, dispenseData.dispensed_by, prescriptionId]);

            await db.commitTransaction(client);

            return dispensing.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Partial dispense prescription
     */
    async partialDispense(pharmacistId, prescriptionId, dispenseData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Create partial dispensing record
            const dispensingQuery = `
                INSERT INTO dispensing_records (
                    id, prescription_id, dispensed_at, dispensed_by,
                    total_items, total_value, dispensing_notes,
                    pharmacist_notes, witness_id, is_partial,
                    partial_reason, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, true, $9, NOW()
                ) RETURNING *
            `;

            const dispensingValues = [
                prescriptionId,
                dispenseData.dispensed_at,
                dispenseData.dispensed_by,
                dispenseData.items.length,
                dispenseData.total_value,
                dispenseData.dispensing_notes,
                dispenseData.pharmacist_notes,
                dispenseData.witness_id,
                dispenseData.partial_reason
            ];

            const dispensing = await client.query(dispensingQuery, dispensingValues);

            // Create dispensing items for dispensed items
            for (const item of dispenseData.items) {
                await client.query(`
                    INSERT INTO dispensing_items (
                        id, dispensing_id, prescription_medicine_id,
                        batch_id, quantity, unit_price, total_price
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6
                    )
                `, [
                    dispensing.rows[0].id,
                    item.id,
                    item.batch_id,
                    item.quantity,
                    item.unit_price,
                    item.quantity * item.unit_price
                ]);

                // Update batch quantity
                await client.query(`
                    UPDATE batches 
                    SET quantity = quantity - $1
                    WHERE id = $2
                `, [item.quantity, item.batch_id]);
            }

            // Update prescription status to partial
            await client.query(`
                UPDATE prescriptions 
                SET status = 'partial',
                    updated_at = NOW()
                WHERE id = $1
            `, [prescriptionId]);

            // Create remaining items record
            if (dispenseData.remaining_items && dispenseData.remaining_items.length > 0) {
                await client.query(`
                    INSERT INTO prescription_remaining_items (
                        id, prescription_id, items, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, NOW()
                    )
                `, [prescriptionId, JSON.stringify(dispenseData.remaining_items)]);
            }

            await db.commitTransaction(client);

            return dispensing.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get dispensing history
     */
    async getDispensingHistory(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, patient_id, prescription_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT d.*, 
                       p.id as prescription_id,
                       pat.first_name as patient_first_name,
                       pat.last_name as patient_last_name,
                       CONCAT(ph.first_name, ' ', ph.last_name) as dispensed_by_name,
                       COUNT(di.id) as items_count,
                       SUM(di.quantity) as total_quantity
                FROM dispensing_records d
                JOIN prescriptions p ON d.prescription_id = p.id
                JOIN patients pat ON p.patient_id = pat.id
                LEFT JOIN employees ph ON d.dispensed_by = ph.id
                LEFT JOIN dispensing_items di ON d.id = di.dispensing_id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (patient_id) {
                query += ` AND p.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (prescription_id) {
                query += ` AND d.prescription_id = $${paramIndex}`;
                values.push(prescription_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND d.dispensed_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND d.dispensed_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` GROUP BY d.id, p.id, pat.id, ph.id
                      ORDER BY d.dispensed_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM dispensing_records d
                JOIN prescriptions p ON d.prescription_id = p.id
                WHERE 1=1
                ${patient_id ? 'AND p.patient_id = $1' : ''}
            `;
            const countValues = patient_id ? [patient_id] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_dispensings,
                    SUM(total_items) as total_items,
                    SUM(total_value) as total_value,
                    COUNT(*) FILTER (WHERE is_partial = true) as partial_count
                FROM dispensing_records d
                WHERE 1=1
                ${patient_id ? 'AND EXISTS (SELECT 1 FROM prescriptions p WHERE p.id = d.prescription_id AND p.patient_id = $1)' : ''}
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
            logger.error('Error in getDispensingHistory', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get today's dispensing
     */
    async getTodaysDispensing(pharmacistId) {
        try {
            const query = `
                SELECT d.*, 
                       p.id as prescription_id,
                       pat.first_name as patient_first_name,
                       pat.last_name as patient_last_name,
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

            // Get hourly breakdown
            const hourlyQuery = `
                SELECT 
                    EXTRACT(HOUR FROM dispensed_at) as hour,
                    COUNT(*) as count
                FROM dispensing_records
                WHERE DATE(dispensed_at) = CURRENT_DATE
                GROUP BY EXTRACT(HOUR FROM dispensed_at)
                ORDER BY hour ASC
            `;
            const hourly = await db.query(hourlyQuery);

            return {
                dispensing: result.rows,
                hourly_breakdown: hourly.rows,
                summary: {
                    total: result.rows.length,
                    total_items: result.rows.reduce((acc, d) => acc + parseInt(d.item_count), 0),
                    total_value: result.rows.reduce((acc, d) => acc + parseFloat(d.total_value), 0)
                }
            };
        } catch (error) {
            logger.error('Error in getTodaysDispensing', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get dispensing by ID
     */
    async getDispensingById(pharmacistId, dispensingId) {
        try {
            const query = `
                SELECT d.*, 
                       p.id as prescription_id,
                       p.diagnosis,
                       pat.id as patient_id,
                       pat.first_name as patient_first_name,
                       pat.last_name as patient_last_name,
                       pat.date_of_birth as patient_dob,
                       doc.first_name as doctor_first_name,
                       doc.last_name as doctor_last_name,
                       CONCAT(ph.first_name, ' ', ph.last_name) as dispensed_by_name,
                       w.first_name as witness_first_name,
                       w.last_name as witness_last_name,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', di.id,
                                   'medicine_name', i.medicine_name,
                                   'batch_number', b.batch_number,
                                   'quantity', di.quantity,
                                   'unit_price', di.unit_price,
                                   'total_price', di.total_price
                               )
                           )
                           FROM dispensing_items di
                           JOIN batches b ON di.batch_id = b.id
                           JOIN inventory i ON b.medicine_id = i.id
                           WHERE di.dispensing_id = d.id
                       ) as items
                FROM dispensing_records d
                JOIN prescriptions p ON d.prescription_id = p.id
                JOIN patients pat ON p.patient_id = pat.id
                JOIN employees doc ON p.doctor_id = doc.id
                LEFT JOIN employees ph ON d.dispensed_by = ph.id
                LEFT JOIN employees w ON d.witness_id = w.id
                WHERE d.id = $1
            `;

            const result = await db.query(query, [dispensingId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getDispensingById', { error: error.message, pharmacistId, dispensingId });
            throw error;
        }
    },

    /**
     * Verify dispensing
     */
    async verifyDispensing(pharmacistId, dispensingId, verificationData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE dispensing_records
                SET verified = $1,
                    verified_by = $2,
                    verified_at = $3,
                    verification_notes = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const values = [
                verificationData.verified,
                verificationData.verified_by,
                verificationData.verified_at,
                verificationData.notes,
                dispensingId
            ];

            const result = await client.query(query, values);

            // If verification fails, revert stock
            if (!verificationData.verified) {
                // Get dispensing items
                const itemsQuery = `
                    SELECT * FROM dispensing_items
                    WHERE dispensing_id = $1
                `;
                const items = await client.query(itemsQuery, [dispensingId]);

                // Revert batch quantities
                for (const item of items.rows) {
                    await client.query(`
                        UPDATE batches 
                        SET quantity = quantity + $1
                        WHERE id = $2
                    `, [item.quantity, item.batch_id]);
                }
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
     * Get dispensing statistics
     */
    async getDispensingStatistics(pharmacistId, period = 'day') {
        try {
            let interval;
            switch(period) {
                case 'day':
                    interval = "INTERVAL '1 day'";
                    break;
                case 'week':
                    interval = "INTERVAL '7 days'";
                    break;
                case 'month':
                    interval = "INTERVAL '30 days'";
                    break;
                case 'year':
                    interval = "INTERVAL '1 year'";
                    break;
                default:
                    interval = "INTERVAL '30 days'";
            }

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(dispensed_at) as date,
                        COUNT(*) as prescription_count,
                        SUM(total_items) as item_count,
                        SUM(total_value) as total_value,
                        COUNT(*) FILTER (WHERE is_partial = true) as partial_count
                    FROM dispensing_records
                    WHERE dispensed_at > NOW() - ${interval}
                    GROUP BY DATE(dispensed_at)
                ),
                medicine_stats AS (
                    SELECT 
                        i.medicine_name,
                        COUNT(*) as dispensed_count,
                        SUM(di.quantity) as total_quantity
                    FROM dispensing_items di
                    JOIN batches b ON di.batch_id = b.id
                    JOIN inventory i ON b.medicine_id = i.id
                    JOIN dispensing_records d ON di.dispensing_id = d.id
                    WHERE d.dispensed_at > NOW() - ${interval}
                    GROUP BY i.medicine_name
                    ORDER BY total_quantity DESC
                    LIMIT 10
                )
                SELECT 
                    (SELECT json_agg(daily_stats.*) FROM daily_stats) as daily,
                    (SELECT json_agg(medicine_stats.*) FROM medicine_stats) as top_medicines,
                    (
                        SELECT 
                            json_build_object(
                                'total_prescriptions', SUM(prescription_count),
                                'total_items', SUM(item_count),
                                'total_value', SUM(total_value),
                                'average_per_day', AVG(prescription_count)
                            )
                        FROM daily_stats
                    ) as summary
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getDispensingStatistics', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Generate dispensing label
     */
    async generateDispensingLabel(pharmacistId, dispensingId, format = 'pdf') {
        try {
            const dispensing = await this.getDispensingById(pharmacistId, dispensingId);
            
            if (!dispensing) {
                return null;
            }

            // TODO: Implement actual PDF/HTML label generation
            // For now, return JSON
            return dispensing;
        } catch (error) {
            logger.error('Error in generateDispensingLabel', { error: error.message, pharmacistId, dispensingId });
            throw error;
        }
    },

    /**
     * Generate dispensing receipt
     */
    async generateDispensingReceipt(pharmacistId, dispensingId, format = 'pdf') {
        try {
            const dispensing = await this.getDispensingById(pharmacistId, dispensingId);
            
            if (!dispensing) {
                return null;
            }

            // TODO: Implement actual PDF receipt generation
            // For now, return JSON
            return dispensing;
        } catch (error) {
            logger.error('Error in generateDispensingReceipt', { error: error.message, pharmacistId, dispensingId });
            throw error;
        }
    },

    /**
     * Get dispensing alerts
     */
    async getDispensingAlerts(pharmacistId) {
        try {
            const query = `
                SELECT 
                    'verification_needed' as type,
                    d.id,
                    p.id as prescription_id,
                    pat.first_name || ' ' || pat.last_name as patient_name,
                    d.dispensed_at,
                    'pending_verification' as status
                FROM dispensing_records d
                JOIN prescriptions p ON d.prescription_id = p.id
                JOIN patients pat ON p.patient_id = pat.id
                WHERE d.verified = false 
                    AND d.dispensed_at > NOW() - INTERVAL '24 hours'
                
                UNION ALL
                
                SELECT 
                    'controlled_substance' as type,
                    d.id,
                    p.id as prescription_id,
                    pat.first_name || ' ' || pat.last_name as patient_name,
                    d.dispensed_at,
                    CASE WHEN d.witness_id IS NULL THEN 'missing_witness' ELSE 'witness_present' END as status
                FROM dispensing_records d
                JOIN prescriptions p ON d.prescription_id = p.id
                JOIN patients pat ON p.patient_id = pat.id
                WHERE d.has_controlled = true AND d.witness_id IS NULL
                
                UNION ALL
                
                SELECT 
                    'quantity_issue' as type,
                    d.id,
                    p.id as prescription_id,
                    pat.first_name || ' ' || pat.last_name as patient_name,
                    d.dispensed_at,
                    'check_quantity' as status
                FROM dispensing_records d
                JOIN prescriptions p ON d.prescription_id = p.id
                JOIN patients pat ON p.patient_id = pat.id
                WHERE d.total_items != (
                    SELECT COUNT(*) FROM dispensing_items WHERE dispensing_id = d.id
                )
                
                ORDER BY dispensed_at DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getDispensingAlerts', { error: error.message, pharmacistId });
            throw error;
        }
    }
};

module.exports = dispensingService;