/**
 * ======================================================================
 * FILE: backend/src/models/clinical/Medicine.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * ⚠️ CONFIDENTIAL & PROPRIETARY ⚠️
 * This file contains sensitive clinical and inventory data handling code.
 * NOT FOR PRODUCTION USE WITHOUT AUTHORIZATION.
 * Author: @koushal
 * Review Purpose Only - Faculty/Company Internal Review.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * DESCRIPTION:
 * Medicine model for database operations.
 * Handles all medicine-related queries for prescriptions and inventory.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: medicines
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - prescription_id: UUID (foreign key to prescriptions)
 * - medicine_name: string
 * - generic_name: string
 * - dosage: string
 * - frequency: string
 * - duration: string
 * - quantity: integer
 * - units: string
 * - route: string
 * - timing: jsonb
 * - with_food: boolean
 * - before_food: boolean
 * - after_food: boolean
 * - instructions: text
 * - side_effects: text
 * - refills_allowed: integer
 * - refills_used: integer
 * - refill_expiry: date
 * - substitute_allowed: boolean
 * - substitute_medicine_id: uuid
 * - substitution_reason: text
 * - status: enum (active, discontinued, substituted, cancelled)
 * - created_at: timestamp
 * - updated_at: timestamp
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const Medicine = {
    /**
     * Table name
     */
    tableName: 'medicines',

    /**
     * Find medicine by ID
     * @param {string} id - Medicine UUID
     * @returns {Promise<Object|null>} Medicine object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    m.id, m.prescription_id, m.medicine_name, m.generic_name,
                    m.dosage, m.frequency, m.duration, m.quantity,
                    m.units, m.route, m.timing,
                    m.with_food, m.before_food, m.after_food,
                    m.instructions, m.side_effects,
                    m.refills_allowed, m.refills_used, m.refill_expiry,
                    m.substitute_allowed, m.substitute_medicine_id,
                    m.substitution_reason, m.status,
                    m.created_at, m.updated_at,
                    sub.medicine_name as substitute_name,
                    sub.generic_name as substitute_generic
                FROM medicines m
                LEFT JOIN medicines sub ON m.substitute_medicine_id = sub.id
                WHERE m.id = $1 AND m.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Medicine found by ID', { medicineId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding medicine by ID', {
                error: error.message,
                medicineId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find medicines by prescription ID
     * @param {string} prescriptionId - Prescription UUID
     * @returns {Promise<Array>} List of medicines
     */
    async findByPrescriptionId(prescriptionId) {
        try {
            const query = `
                SELECT 
                    m.id, m.prescription_id, m.medicine_name, m.generic_name,
                    m.dosage, m.frequency, m.duration, m.quantity,
                    m.units, m.route, m.timing,
                    m.with_food, m.before_food, m.after_food,
                    m.instructions, m.side_effects,
                    m.refills_allowed, m.refills_used, m.refill_expiry,
                    m.substitute_allowed, m.status,
                    m.created_at,
                    sub.medicine_name as substitute_name
                FROM medicines m
                LEFT JOIN medicines sub ON m.substitute_medicine_id = sub.id
                WHERE m.prescription_id = $1 AND m.is_deleted = false
                ORDER BY m.created_at ASC
            `;

            const result = await db.query(query, [prescriptionId]);

            logger.debug('Medicines found by prescription ID', {
                prescriptionId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding medicines by prescription ID', {
                error: error.message,
                prescriptionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new medicine
     * @param {Object} medicineData - Medicine data
     * @returns {Promise<Object>} Created medicine
     */
    async create(medicineData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (medicineData.quantity <= 0) {
                throw new Error('Quantity must be positive');
            }

            const query = `
                INSERT INTO medicines (
                    id, prescription_id, medicine_name, generic_name,
                    dosage, frequency, duration, quantity,
                    units, route, timing,
                    with_food, before_food, after_food,
                    instructions, side_effects,
                    refills_allowed, refills_used, refill_expiry,
                    substitute_allowed, substitute_medicine_id,
                    substitution_reason, status,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
                    COALESCE($8, 'tablets'), COALESCE($9, 'oral'), $10,
                    COALESCE($11, false), COALESCE($12, false), COALESCE($13, false),
                    $14, $15,
                    COALESCE($16, 0), COALESCE($17, 0), $18,
                    COALESCE($19, true), $20,
                    $21, COALESCE($22, 'active'),
                    NOW(), NOW()
                )
                RETURNING 
                    id, prescription_id, medicine_name, dosage,
                    frequency, duration, quantity, units,
                    status, created_at
            `;

            const values = [
                medicineData.prescription_id,
                medicineData.medicine_name,
                medicineData.generic_name || null,
                medicineData.dosage,
                medicineData.frequency,
                medicineData.duration,
                medicineData.quantity,
                medicineData.units,
                medicineData.route,
                medicineData.timing || null,
                medicineData.with_food,
                medicineData.before_food,
                medicineData.after_food,
                medicineData.instructions || null,
                medicineData.side_effects || null,
                medicineData.refills_allowed,
                medicineData.refills_used,
                medicineData.refill_expiry || null,
                medicineData.substitute_allowed,
                medicineData.substitute_medicine_id || null,
                medicineData.substitution_reason || null,
                medicineData.status
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Medicine created successfully', {
                medicineId: result.rows[0].id,
                prescriptionId: medicineData.prescription_id,
                medicineName: medicineData.medicine_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating medicine', {
                error: error.message,
                prescriptionId: medicineData.prescription_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update medicine
     * @param {string} id - Medicine ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated medicine
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'medicine_name', 'generic_name', 'dosage', 'frequency',
                'duration', 'quantity', 'units', 'route', 'timing',
                'with_food', 'before_food', 'after_food',
                'instructions', 'side_effects',
                'refills_allowed', 'refills_used', 'refill_expiry',
                'substitute_allowed', 'substitute_medicine_id',
                'substitution_reason', 'status'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(id);

            const query = `
                UPDATE medicines 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, prescription_id, medicine_name, dosage,
                    frequency, quantity, status, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Medicine not found');
            }

            await db.commitTransaction(client);

            logger.info('Medicine updated successfully', {
                medicineId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating medicine', {
                error: error.message,
                medicineId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update refill count
     * @param {string} id - Medicine ID
     * @returns {Promise<Object>} Updated medicine
     */
    async useRefill(id) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const medicine = await this.findById(id);
            if (!medicine) {
                throw new Error('Medicine not found');
            }

            if (medicine.refills_used >= medicine.refills_allowed) {
                throw new Error('No refills remaining');
            }

            if (medicine.refill_expiry && new Date(medicine.refill_expiry) < new Date()) {
                throw new Error('Refill has expired');
            }

            const query = `
                UPDATE medicines 
                SET refills_used = refills_used + 1,
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING 
                    id, medicine_name, refills_used, refills_allowed
            `;

            const result = await client.query(query, [id]);

            await db.commitTransaction(client);

            logger.info('Refill used for medicine', {
                medicineId: id,
                refillsUsed: result.rows[0].refills_used,
                refillsRemaining: result.rows[0].refills_allowed - result.rows[0].refills_used
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error using refill', {
                error: error.message,
                medicineId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Substitute medicine
     * @param {string} id - Original medicine ID
     * @param {string} substituteId - Substitute medicine ID
     * @param {string} reason - Substitution reason
     * @returns {Promise<Object>} Updated medicine
     */
    async substitute(id, substituteId, reason) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const medicine = await this.findById(id);
            if (!medicine) {
                throw new Error('Medicine not found');
            }

            if (!medicine.substitute_allowed) {
                throw new Error('Substitution not allowed for this medicine');
            }

            const substitute = await this.findById(substituteId);
            if (!substitute) {
                throw new Error('Substitute medicine not found');
            }

            const query = `
                UPDATE medicines 
                SET substitute_medicine_id = $1,
                    substitution_reason = $2,
                    status = 'substituted',
                    updated_at = NOW()
                WHERE id = $3 AND is_deleted = false
                RETURNING 
                    id, medicine_name, substitute_medicine_id,
                    substitution_reason, status
            `;

            const result = await client.query(query, [substituteId, reason, id]);

            await db.commitTransaction(client);

            logger.info('Medicine substituted', {
                medicineId: id,
                substituteId,
                reason
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error substituting medicine', {
                error: error.message,
                medicineId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get medicines expiring soon for refills
     * @param {number} days - Days threshold
     * @returns {Promise<Array>} List of medicines
     */
    async getRefillsExpiringSoon(days = 30) {
        try {
            const query = `
                SELECT 
                    m.id, m.prescription_id, m.medicine_name,
                    m.refills_used, m.refills_allowed,
                    m.refill_expiry,
                    p.patient_id,
                    pat.first_name as patient_first_name,
                    pat.last_name as patient_last_name,
                    pat.phone as patient_phone
                FROM medicines m
                JOIN prescriptions p ON m.prescription_id = p.id
                JOIN patients pat ON p.patient_id = pat.id
                WHERE m.refill_expiry IS NOT NULL
                    AND m.refill_expiry <= NOW() + ($1 || ' days')::INTERVAL
                    AND m.refill_expiry > NOW()
                    AND m.refills_used < m.refills_allowed
                    AND m.status = 'active'
                    AND m.is_deleted = false
                ORDER BY m.refill_expiry ASC
            `;

            const result = await db.query(query, [days]);

            logger.debug('Refills expiring soon retrieved', {
                count: result.rows.length,
                days
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting refills expiring soon', {
                error: error.message,
                days
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get medicine statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_medicines,
                    COUNT(DISTINCT prescription_id) as unique_prescriptions,
                    COUNT(DISTINCT medicine_name) as unique_medicines,
                    SUM(quantity) as total_quantity_prescribed,
                    AVG(quantity)::numeric(10,2) as avg_quantity,
                    COUNT(*) FILTER (WHERE refills_allowed > 0) as has_refills,
                    COUNT(*) FILTER (WHERE status = 'active') as active,
                    COUNT(*) FILTER (WHERE status = 'discontinued') as discontinued,
                    COUNT(*) FILTER (WHERE status = 'substituted') as substituted
                FROM medicines
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Medicine statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting medicine statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get most prescribed medicines
     * @param {number} limit - Number of medicines
     * @returns {Promise<Array>} List of medicines with counts
     */
    async getMostPrescribed(limit = 10) {
        try {
            const query = `
                SELECT 
                    medicine_name,
                    generic_name,
                    COUNT(*) as prescription_count,
                    SUM(quantity) as total_quantity
                FROM medicines
                WHERE is_deleted = false
                GROUP BY medicine_name, generic_name
                ORDER BY prescription_count DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);

            logger.debug('Most prescribed medicines retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting most prescribed medicines', {
                error: error.message,
                limit
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete medicine
     * @param {string} id - Medicine ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE medicines 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Medicine not found');
            }

            await db.commitTransaction(client);

            logger.info('Medicine soft deleted', {
                medicineId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting medicine', {
                error: error.message,
                medicineId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Medicine;

/**
 * ======================================================================
 * CONFIDENTIAL - Author: @koushal
 * This code is proprietary to OctNov.
 * Unauthorized use, copying, or distribution is prohibited.
 * For review purposes only.
 * ======================================================================
 */