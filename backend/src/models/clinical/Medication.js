/**
 * ======================================================================
 * FILE: backend/src/models/clinical/Medication.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * AUTHOR: @koushal
 * 
 * RESTRICTIONS:
 * This code is proprietary to OctNov.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * DESCRIPTION:
 * Medication model for database operations (MAR - Medication Administration Record).
 * Handles all inpatient medication administration tracking.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: medications
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients)
 * - prescription_id: UUID (foreign key to prescriptions)
 * - medicine_id: UUID (foreign key to inventory)
 * - medicine_name: string
 * - dosage: string
 * - route: enum (oral, IV, IM, subcutaneous, topical)
 * - scheduled_time: timestamp
 * - scheduled_dose: string
 * - status: enum (pending, administered, skipped, rescheduled)
 * - administered_by: uuid
 * - administered_at: timestamp
 * - administered_dose: string
 * - notes: text
 * - reactions: jsonb
 * - skip_reason: text
 * - rescheduled_to: timestamp
 * - created_at: timestamp
 * - updated_at: timestamp
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const Medication = {
    /**
     * Table name
     */
    tableName: 'medications',

    /**
     * Valid routes for medication administration
     */
    validRoutes: ['oral', 'IV', 'IM', 'subcutaneous', 'topical'],

    /**
     * Valid status values
     */
    validStatuses: ['pending', 'administered', 'skipped', 'rescheduled'],

    /**
     * Find medication by ID
     * @param {string} id - Medication UUID
     * @returns {Promise<Object|null>} Medication object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    m.id, m.patient_id, m.prescription_id, m.medicine_id,
                    m.medicine_name, m.dosage, m.route,
                    m.scheduled_time, m.scheduled_dose,
                    m.status, m.administered_by, m.administered_at,
                    m.administered_dose, m.notes, m.reactions,
                    m.skip_reason, m.rescheduled_to,
                    m.created_at, m.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.bed_id, p.room_number,
                    u.username as administered_by_name
                FROM medications m
                JOIN patients p ON m.patient_id = p.id
                LEFT JOIN users u ON m.administered_by = u.id
                WHERE m.id = $1 AND m.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Medication found by ID', { medicationId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding medication by ID', {
                error: error.message,
                medicationId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find medications by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of medications
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['m.is_deleted = false'];

            if (status) {
                conditions.push(`m.status = $${paramIndex++}`);
                values.push(status);
            }
            if (from_date) {
                conditions.push(`m.scheduled_time >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`m.scheduled_time <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    m.id, m.patient_id, m.prescription_id,
                    m.medicine_name, m.dosage, m.route,
                    m.scheduled_time, m.scheduled_dose,
                    m.status, m.administered_at,
                    m.administered_dose, m.notes,
                    m.skip_reason, m.rescheduled_to,
                    m.created_at
                FROM medications m
                ${whereClause}
                ORDER BY m.scheduled_time ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Medications found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding medications by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find medications by prescription ID
     * @param {string} prescriptionId - Prescription UUID
     * @returns {Promise<Array>} List of medications
     */
    async findByPrescriptionId(prescriptionId) {
        try {
            const query = `
                SELECT 
                    m.id, m.patient_id, m.prescription_id,
                    m.medicine_name, m.dosage, m.route,
                    m.scheduled_time, m.scheduled_dose,
                    m.status, m.administered_at,
                    m.administered_dose, m.notes,
                    m.refills_used, m.refills_allowed,
                    m.created_at
                FROM medications m
                WHERE m.prescription_id = $1 AND m.is_deleted = false
                ORDER BY m.scheduled_time ASC
            `;

            const result = await db.query(query, [prescriptionId]);

            logger.debug('Medications found by prescription ID', {
                prescriptionId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding medications by prescription ID', {
                error: error.message,
                prescriptionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get due medications for a time window
     * @param {string} startTime - Start time
     * @param {string} endTime - End time
     * @returns {Promise<Array>} List of due medications
     */
    async getDueMedications(startTime, endTime) {
        try {
            const query = `
                SELECT 
                    m.id, m.patient_id, m.prescription_id,
                    m.medicine_name, m.dosage, m.route,
                    m.scheduled_time, m.scheduled_dose,
                    m.status,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.bed_id, p.room_number,
                    p.ward
                FROM medications m
                JOIN patients p ON m.patient_id = p.id
                WHERE m.scheduled_time BETWEEN $1 AND $2
                    AND m.status = 'pending'
                    AND m.is_deleted = false
                ORDER BY m.scheduled_time ASC
            `;

            const result = await db.query(query, [startTime, endTime]);

            logger.debug('Due medications retrieved', {
                startTime,
                endTime,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting due medications', {
                error: error.message,
                startTime,
                endTime
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get today's pending medications
     * @returns {Promise<Array>} List of pending medications
     */
    async getTodayPending() {
        const today = new Date().toISOString().split('T')[0];
        const startOfDay = `${today} 00:00:00`;
        const endOfDay = `${today} 23:59:59`;

        return this.getDueMedications(startOfDay, endOfDay);
    },

    /**
     * Create new medication schedule
     * @param {Object} medicationData - Medication data
     * @returns {Promise<Object>} Created medication
     */
    async create(medicationData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (!this.validRoutes.includes(medicationData.route)) {
                throw new Error(`Invalid route. Must be one of: ${this.validRoutes.join(', ')}`);
            }

            const query = `
                INSERT INTO medications (
                    id, patient_id, prescription_id, medicine_id,
                    medicine_name, dosage, route,
                    scheduled_time, scheduled_dose,
                    status, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6,
                    $7, $8, 'pending', NOW(), NOW()
                )
                RETURNING 
                    id, patient_id, prescription_id,
                    medicine_name, dosage, route,
                    scheduled_time, scheduled_dose,
                    status, created_at
            `;

            const values = [
                medicationData.patient_id,
                medicationData.prescription_id || null,
                medicationData.medicine_id || null,
                medicationData.medicine_name,
                medicationData.dosage,
                medicationData.route,
                medicationData.scheduled_time,
                medicationData.scheduled_dose
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Medication schedule created successfully', {
                medicationId: result.rows[0].id,
                patientId: medicationData.patient_id,
                medicineName: medicationData.medicine_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating medication schedule', {
                error: error.message,
                patientId: medicationData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Administer medication
     * @param {string} id - Medication ID
     * @param {Object} administrationData - Administration data
     * @returns {Promise<Object>} Updated medication
     */
    async administer(id, administrationData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const medication = await this.findById(id);
            if (!medication) {
                throw new Error('Medication not found');
            }

            if (medication.status !== 'pending') {
                throw new Error(`Cannot administer medication with status: ${medication.status}`);
            }

            if (new Date(medication.scheduled_time) > new Date()) {
                throw new Error('Cannot administer medication before scheduled time');
            }

            const query = `
                UPDATE medications 
                SET status = 'administered',
                    administered_by = $1,
                    administered_at = NOW(),
                    administered_dose = $2,
                    notes = COALESCE(CONCAT(notes, E'\\n', $3), $3),
                    reactions = $4,
                    updated_at = NOW()
                WHERE id = $5 AND is_deleted = false
                RETURNING 
                    id, patient_id, medicine_name, status,
                    administered_by, administered_at,
                    administered_dose, reactions
            `;

            const values = [
                administrationData.administered_by,
                administrationData.administered_dose,
                administrationData.notes || null,
                administrationData.reactions || null,
                id
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Medication not found or already administered');
            }

            await db.commitTransaction(client);

            logger.info('Medication administered', {
                medicationId: id,
                patientId: medication.patient_id,
                medicineName: medication.medicine_name,
                administeredBy: administrationData.administered_by
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error administering medication', {
                error: error.message,
                medicationId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Skip medication
     * @param {string} id - Medication ID
     * @param {Object} skipData - Skip data
     * @returns {Promise<Object>} Updated medication
     */
    async skip(id, skipData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const medication = await this.findById(id);
            if (!medication) {
                throw new Error('Medication not found');
            }

            if (medication.status !== 'pending') {
                throw new Error(`Cannot skip medication with status: ${medication.status}`);
            }

            const query = `
                UPDATE medications 
                SET status = 'skipped',
                    skip_reason = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING 
                    id, patient_id, medicine_name, status,
                    skip_reason, updated_at
            `;

            const result = await client.query(query, [skipData.reason, id]);

            if (result.rows.length === 0) {
                throw new Error('Medication not found');
            }

            await db.commitTransaction(client);

            logger.info('Medication skipped', {
                medicationId: id,
                patientId: medication.patient_id,
                medicineName: medication.medicine_name,
                reason: skipData.reason
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error skipping medication', {
                error: error.message,
                medicationId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Reschedule medication
     * @param {string} id - Medication ID
     * @param {Object} rescheduleData - Reschedule data
     * @returns {Promise<Object>} Updated medication
     */
    async reschedule(id, rescheduleData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const medication = await this.findById(id);
            if (!medication) {
                throw new Error('Medication not found');
            }

            if (medication.status !== 'pending') {
                throw new Error(`Cannot reschedule medication with status: ${medication.status}`);
            }

            if (new Date(rescheduleData.rescheduled_to) <= new Date(medication.scheduled_time)) {
                throw new Error('Rescheduled time must be after original scheduled time');
            }

            const query = `
                UPDATE medications 
                SET status = 'rescheduled',
                    rescheduled_to = $1,
                    notes = COALESCE(CONCAT(notes, E'\\nRescheduled: ', $2), $2),
                    updated_at = NOW()
                WHERE id = $3 AND is_deleted = false
                RETURNING 
                    id, patient_id, medicine_name, status,
                    rescheduled_to, updated_at
            `;

            const result = await client.query(query, [
                rescheduleData.rescheduled_to,
                rescheduleData.reason || 'Rescheduled',
                id
            ]);

            if (result.rows.length === 0) {
                throw new Error('Medication not found');
            }

            await db.commitTransaction(client);

            logger.info('Medication rescheduled', {
                medicationId: id,
                patientId: medication.patient_id,
                medicineName: medication.medicine_name,
                originalTime: medication.scheduled_time,
                newTime: rescheduleData.rescheduled_to
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error rescheduling medication', {
                error: error.message,
                medicationId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get medication administration history
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of administered medications
     */
    async getAdministrationHistory(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['m.status = \'administered\'', 'm.is_deleted = false'];

            if (from_date) {
                conditions.push(`m.administered_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`m.administered_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    m.id, m.medicine_name, m.dosage, m.route,
                    m.scheduled_time, m.administered_at,
                    m.administered_dose, m.notes, m.reactions,
                    u.username as administered_by_name
                FROM medications m
                LEFT JOIN users u ON m.administered_by = u.id
                ${whereClause}
                ORDER BY m.administered_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Medication administration history retrieved', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting medication administration history', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get medication statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND scheduled_time BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_scheduled,
                    COUNT(*) FILTER (WHERE status = 'administered') as administered,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
                    COUNT(*) FILTER (WHERE status = 'rescheduled') as rescheduled,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    ROUND((COUNT(*) FILTER (WHERE status = 'administered')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as adherence_rate,
                    AVG(EXTRACT(EPOCH FROM (administered_at - scheduled_time))/60)::numeric(10,2) as avg_admin_delay_minutes
                FROM medications
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Medication statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting medication statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Bulk create medication schedules
     * @param {Array} medicationsData - Array of medication data
     * @returns {Promise<Array>} Created medications
     */
    async bulkCreate(medicationsData) {
        const client = await db.getClient();
        const created = [];

        try {
            await db.beginTransaction(client);

            for (const data of medicationsData) {
                const result = await this.create(data);
                created.push(result);
            }

            await db.commitTransaction(client);

            logger.info('Bulk medication schedules created', {
                count: created.length
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk creating medication schedules', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Medication;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */