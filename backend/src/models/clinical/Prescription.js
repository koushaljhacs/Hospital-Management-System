/**
 * ======================================================================
 * FILE: backend/src/models/clinical/Prescription.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * ⚠️ CONFIDENTIAL & PROPRIETARY ⚠️
 * This file contains sensitive clinical data handling code.
 * NOT FOR PRODUCTION USE WITHOUT AUTHORIZATION.
 * Author: @koushal
 * Review Purpose Only - Faculty/Company Internal Review.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * DESCRIPTION:
 * Prescription model for database operations.
 * Handles all prescription-related queries for medication management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: prescriptions
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - appointment_id: UUID (foreign key to appointments)
 * - doctor_id: UUID (foreign key to employees)
 * - patient_id: UUID (foreign key to patients)
 * - diagnosis: text
 * - notes: text
 * - follow_up_date: date
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

const Prescription = {
    /**
     * Table name
     */
    tableName: 'prescriptions',

    /**
     * Find prescription by ID
     * @param {string} id - Prescription UUID
     * @returns {Promise<Object|null>} Prescription object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    p.id, p.appointment_id, p.doctor_id, p.patient_id,
                    p.diagnosis, p.notes, p.follow_up_date,
                    p.created_at, p.updated_at,
                    pat.first_name as patient_first_name,
                    pat.last_name as patient_last_name,
                    pat.phone as patient_phone,
                    doc.first_name as doctor_first_name,
                    doc.last_name as doctor_last_name,
                    doc.designation as doctor_designation,
                    app.appointment_date, app.appointment_time,
                    app.status as appointment_status
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                JOIN employees doc ON p.doctor_id = doc.id
                LEFT JOIN appointments app ON p.appointment_id = app.id
                WHERE p.id = $1 AND p.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Prescription found by ID', { prescriptionId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding prescription by ID', {
                error: error.message,
                prescriptionId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find prescriptions by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of prescriptions
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['p.is_deleted = false'];

            if (from_date) {
                conditions.push(`p.created_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`p.created_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    p.id, p.appointment_id, p.doctor_id, p.patient_id,
                    p.diagnosis, p.notes, p.follow_up_date,
                    p.created_at,
                    doc.first_name as doctor_first_name,
                    doc.last_name as doctor_last_name,
                    doc.designation as doctor_designation,
                    doc.specialization as doctor_specialization,
                    app.appointment_date, app.appointment_time
                FROM prescriptions p
                JOIN employees doc ON p.doctor_id = doc.id
                LEFT JOIN appointments app ON p.appointment_id = app.id
                ${whereClause}
                ORDER BY p.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Prescriptions found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding prescriptions by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find prescriptions by doctor ID
     * @param {string} doctorId - Doctor UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of prescriptions
     */
    async findByDoctorId(doctorId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [doctorId];
            let paramIndex = 2;
            const conditions = ['p.is_deleted = false'];

            if (from_date) {
                conditions.push(`p.created_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`p.created_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    p.id, p.appointment_id, p.patient_id,
                    p.diagnosis, p.notes, p.follow_up_date,
                    p.created_at,
                    pat.first_name as patient_first_name,
                    pat.last_name as patient_last_name,
                    pat.phone as patient_phone,
                    app.appointment_date, app.appointment_time
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                LEFT JOIN appointments app ON p.appointment_id = app.id
                ${whereClause}
                ORDER BY p.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Prescriptions found by doctor ID', {
                doctorId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding prescriptions by doctor ID', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find prescriptions by appointment ID
     * @param {string} appointmentId - Appointment UUID
     * @returns {Promise<Object|null>} Prescription or null
     */
    async findByAppointmentId(appointmentId) {
        try {
            const query = `
                SELECT 
                    p.id, p.appointment_id, p.doctor_id, p.patient_id,
                    p.diagnosis, p.notes, p.follow_up_date,
                    p.created_at,
                    doc.first_name as doctor_first_name,
                    doc.last_name as doctor_last_name,
                    pat.first_name as patient_first_name,
                    pat.last_name as patient_last_name
                FROM prescriptions p
                JOIN employees doc ON p.doctor_id = doc.id
                JOIN patients pat ON p.patient_id = pat.id
                WHERE p.appointment_id = $1 AND p.is_deleted = false
                LIMIT 1
            `;

            const result = await db.query(query, [appointmentId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Prescription found by appointment ID', { appointmentId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding prescription by appointment ID', {
                error: error.message,
                appointmentId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new prescription
     * @param {Object} prescriptionData - Prescription data
     * @returns {Promise<Object>} Created prescription
     */
    async create(prescriptionData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existing = await this.findByAppointmentId(prescriptionData.appointment_id);
            if (existing) {
                throw new Error('Prescription already exists for this appointment');
            }

            const query = `
                INSERT INTO prescriptions (
                    id, appointment_id, doctor_id, patient_id,
                    diagnosis, notes, follow_up_date,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()
                )
                RETURNING 
                    id, appointment_id, doctor_id, patient_id,
                    diagnosis, notes, follow_up_date, created_at
            `;

            const values = [
                prescriptionData.appointment_id,
                prescriptionData.doctor_id,
                prescriptionData.patient_id,
                prescriptionData.diagnosis,
                prescriptionData.notes || null,
                prescriptionData.follow_up_date || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Prescription created successfully', {
                prescriptionId: result.rows[0].id,
                patientId: prescriptionData.patient_id,
                doctorId: prescriptionData.doctor_id,
                appointmentId: prescriptionData.appointment_id
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating prescription', {
                error: error.message,
                patientId: prescriptionData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update prescription
     * @param {string} id - Prescription ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated prescription
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = ['diagnosis', 'notes', 'follow_up_date'];

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
                UPDATE prescriptions 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, appointment_id, doctor_id, patient_id,
                    diagnosis, notes, follow_up_date, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Prescription not found');
            }

            await db.commitTransaction(client);

            logger.info('Prescription updated successfully', {
                prescriptionId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating prescription', {
                error: error.message,
                prescriptionId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get prescriptions requiring follow-up
     * @param {string} date - Date to check (optional)
     * @returns {Promise<Array>} List of prescriptions
     */
    async getFollowUpPrescriptions(date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                SELECT 
                    p.id, p.patient_id, p.doctor_id,
                    p.diagnosis, p.follow_up_date, p.notes,
                    pat.first_name as patient_first_name,
                    pat.last_name as patient_last_name,
                    pat.phone as patient_phone,
                    doc.first_name as doctor_first_name,
                    doc.last_name as doctor_last_name
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                JOIN employees doc ON p.doctor_id = doc.id
                WHERE p.follow_up_date = $1
                    AND p.is_deleted = false
                ORDER BY p.created_at DESC
            `;

            const result = await db.query(query, [targetDate]);

            logger.debug('Follow-up prescriptions retrieved', {
                date: targetDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting follow-up prescriptions', {
                error: error.message,
                date
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get prescription statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND created_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_prescriptions,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT doctor_id) as unique_doctors,
                    COUNT(*) FILTER (WHERE follow_up_date IS NOT NULL) as has_followup,
                    COUNT(*) FILTER (WHERE follow_up_date <= CURRENT_DATE) as followup_due,
                    AVG(LENGTH(diagnosis)) as avg_diagnosis_length
                FROM prescriptions
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Prescription statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting prescription statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get recent prescriptions for dashboard
     * @param {number} limit - Number of prescriptions
     * @returns {Promise<Array>} List of recent prescriptions
     */
    async getRecent(limit = 10) {
        try {
            const query = `
                SELECT 
                    p.id, p.patient_id, p.doctor_id,
                    p.diagnosis, p.created_at,
                    pat.first_name as patient_first_name,
                    pat.last_name as patient_last_name,
                    doc.first_name as doctor_first_name,
                    doc.last_name as doctor_last_name
                FROM prescriptions p
                JOIN patients pat ON p.patient_id = pat.id
                JOIN employees doc ON p.doctor_id = doc.id
                WHERE p.is_deleted = false
                ORDER BY p.created_at DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);

            logger.debug('Recent prescriptions retrieved', { count: result.rows.length });

            return result.rows;
        } catch (error) {
            logger.error('Error getting recent prescriptions', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete prescription
     * @param {string} id - Prescription ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE prescriptions 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Prescription not found');
            }

            await db.commitTransaction(client);

            logger.info('Prescription soft deleted', {
                prescriptionId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting prescription', {
                error: error.message,
                prescriptionId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Prescription;

/**
 * ======================================================================
 * CONFIDENTIAL - Author: @koushal
 * This code is proprietary to OctNov.
 * Unauthorized use, copying, or distribution is prohibited.
 * For review purposes only.
 * ======================================================================
 */