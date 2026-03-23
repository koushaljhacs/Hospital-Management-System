/**
 * ======================================================================
 * FILE: backend/src/models/clinical/Diagnosis.js
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
 * Diagnosis model for database operations.
 * Handles all diagnosis-related queries for patient medical conditions.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: diagnosis
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients)
 * - doctor_id: UUID (foreign key to employees)
 * - appointment_id: UUID (foreign key to appointments)
 * - icd_code: string
 * - diagnosis_name: string
 * - description: text
 * - type: enum (primary, secondary, complication)
 * - severity: enum (mild, moderate, severe, critical)
 * - status: enum (active, resolved, chronic)
 * - diagnosed_at: timestamp
 * - resolved_at: timestamp
 * - follow_up_date: date
 * - notes: text
 * - created_at: timestamp
 * - updated_at: timestamp
 * - created_by: uuid
 * - updated_by: uuid
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

const Diagnosis = {
    /**
     * Table name
     */
    tableName: 'diagnosis',

    /**
     * Find diagnosis by ID
     * @param {string} id - Diagnosis UUID
     * @returns {Promise<Object|null>} Diagnosis object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    d.id, d.patient_id, d.doctor_id, d.appointment_id,
                    d.icd_code, d.diagnosis_name, d.description,
                    d.type, d.severity, d.status,
                    d.diagnosed_at, d.resolved_at, d.follow_up_date,
                    d.notes, d.created_at, d.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    e.designation as doctor_designation,
                    e.specialization as doctor_specialization
                FROM diagnosis d
                JOIN patients p ON d.patient_id = p.id
                JOIN employees e ON d.doctor_id = e.id
                WHERE d.id = $1 AND d.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Diagnosis found by ID', { diagnosisId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding diagnosis by ID', {
                error: error.message,
                diagnosisId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find diagnoses by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of diagnoses
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['d.is_deleted = false'];

            if (status) {
                conditions.push(`d.status = $${paramIndex++}`);
                values.push(status);
            }
            if (from_date) {
                conditions.push(`d.diagnosed_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`d.diagnosed_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    d.id, d.patient_id, d.doctor_id,
                    d.icd_code, d.diagnosis_name, d.description,
                    d.type, d.severity, d.status,
                    d.diagnosed_at, d.resolved_at, d.follow_up_date,
                    d.created_at,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM diagnosis d
                JOIN employees e ON d.doctor_id = e.id
                ${whereClause}
                ORDER BY d.diagnosed_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Diagnoses found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding diagnoses by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find diagnoses by doctor ID
     * @param {string} doctorId - Doctor UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of diagnoses
     */
    async findByDoctorId(doctorId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [doctorId];
            let paramIndex = 2;
            const conditions = ['d.is_deleted = false'];

            if (from_date) {
                conditions.push(`d.diagnosed_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`d.diagnosed_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    d.id, d.patient_id, d.doctor_id,
                    d.icd_code, d.diagnosis_name, d.description,
                    d.type, d.severity, d.status,
                    d.diagnosed_at, d.resolved_at, d.follow_up_date,
                    d.created_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.date_of_birth as patient_dob
                FROM diagnosis d
                JOIN patients p ON d.patient_id = p.id
                ${whereClause}
                ORDER BY d.diagnosed_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Diagnoses found by doctor ID', {
                doctorId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding diagnoses by doctor ID', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new diagnosis
     * @param {Object} diagnosisData - Diagnosis data
     * @returns {Promise<Object>} Created diagnosis
     */
    async create(diagnosisData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (diagnosisData.resolved_at && new Date(diagnosisData.resolved_at) < new Date(diagnosisData.diagnosed_at)) {
                throw new Error('Resolved date must be after diagnosed date');
            }

            const query = `
                INSERT INTO diagnosis (
                    id, patient_id, doctor_id, appointment_id,
                    icd_code, diagnosis_name, description,
                    type, severity, status,
                    diagnosed_at, resolved_at, follow_up_date,
                    notes, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
                )
                RETURNING 
                    id, patient_id, doctor_id,
                    icd_code, diagnosis_name, type,
                    severity, status, diagnosed_at,
                    resolved_at, follow_up_date, created_at
            `;

            const values = [
                diagnosisData.patient_id,
                diagnosisData.doctor_id,
                diagnosisData.appointment_id || null,
                diagnosisData.icd_code || null,
                diagnosisData.diagnosis_name,
                diagnosisData.description || null,
                diagnosisData.type || 'primary',
                diagnosisData.severity || 'mild',
                diagnosisData.status || 'active',
                diagnosisData.diagnosed_at || new Date(),
                diagnosisData.resolved_at || null,
                diagnosisData.follow_up_date || null,
                diagnosisData.notes || null,
                diagnosisData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Diagnosis created successfully', {
                diagnosisId: result.rows[0].id,
                patientId: diagnosisData.patient_id,
                diagnosisName: diagnosisData.diagnosis_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating diagnosis', {
                error: error.message,
                patientId: diagnosisData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update diagnosis
     * @param {string} id - Diagnosis ID
     * @param {Object} updates - Fields to update
     * @param {string} [updates.updated_by] - User who updated
     * @returns {Promise<Object>} Updated diagnosis
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const diagnosis = await this.findById(id);
            if (!diagnosis) {
                throw new Error('Diagnosis not found');
            }

            if (updates.resolved_at && new Date(updates.resolved_at) < new Date(diagnosis.diagnosed_at)) {
                throw new Error('Resolved date must be after diagnosed date');
            }

            const allowedFields = [
                'icd_code', 'diagnosis_name', 'description',
                'type', 'severity', 'status',
                'resolved_at', 'follow_up_date', 'notes'
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
            if (updates.updated_by) {
                setClause.push(`updated_by = $${paramIndex++}`);
                values.push(updates.updated_by);
            }
            values.push(id);

            const query = `
                UPDATE diagnosis 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, patient_id, doctor_id,
                    icd_code, diagnosis_name, type,
                    severity, status, resolved_at,
                    follow_up_date, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Diagnosis not found');
            }

            await db.commitTransaction(client);

            logger.info('Diagnosis updated successfully', {
                diagnosisId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating diagnosis', {
                error: error.message,
                diagnosisId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Resolve diagnosis
     * @param {string} id - Diagnosis ID
     * @param {string} resolvedBy - User who resolved
     * @returns {Promise<Object>} Updated diagnosis
     */
    async resolve(id, resolvedBy) {
        return this.update(id, {
            status: 'resolved',
            resolved_at: new Date(),
            updated_by: resolvedBy
        });
    },

    /**
     * Get active diagnoses for patient
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Array>} List of active diagnoses
     */
    async getActiveDiagnoses(patientId) {
        return this.findByPatientId(patientId, { status: 'active' });
    },

    /**
     * Get chronic diagnoses for patient
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Array>} List of chronic diagnoses
     */
    async getChronicDiagnoses(patientId) {
        return this.findByPatientId(patientId, { status: 'chronic' });
    },

    /**
     * Get diagnoses by ICD code
     * @param {string} icdCode - ICD code
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of diagnoses
     */
    async findByIcdCode(icdCode, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    d.id, d.patient_id, d.doctor_id,
                    d.icd_code, d.diagnosis_name, d.description,
                    d.type, d.severity, d.status,
                    d.diagnosed_at, d.resolved_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM diagnosis d
                JOIN patients p ON d.patient_id = p.id
                WHERE d.icd_code = $1 AND d.is_deleted = false
                ORDER BY d.diagnosed_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [icdCode, limit, offset]);

            logger.debug('Diagnoses found by ICD code', {
                icdCode,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding diagnoses by ICD code', {
                error: error.message,
                icdCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get diagnosis statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND diagnosed_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_diagnoses,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT doctor_id) as unique_doctors,
                    COUNT(*) FILTER (WHERE status = 'active') as active,
                    COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
                    COUNT(*) FILTER (WHERE status = 'chronic') as chronic,
                    COUNT(*) FILTER (WHERE severity = 'mild') as mild,
                    COUNT(*) FILTER (WHERE severity = 'moderate') as moderate,
                    COUNT(*) FILTER (WHERE severity = 'severe') as severe,
                    COUNT(*) FILTER (WHERE severity = 'critical') as critical,
                    COUNT(*) FILTER (WHERE type = 'primary') as primary,
                    COUNT(*) FILTER (WHERE type = 'secondary') as secondary,
                    COUNT(*) FILTER (WHERE type = 'complication') as complication
                FROM diagnosis
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Diagnosis statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting diagnosis statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get most common diagnoses
     * @param {number} limit - Number of diagnoses
     * @returns {Promise<Array>} List of diagnoses with counts
     */
    async getMostCommon(limit = 10) {
        try {
            const query = `
                SELECT 
                    icd_code,
                    diagnosis_name,
                    COUNT(*) as occurrence_count,
                    COUNT(DISTINCT patient_id) as unique_patients
                FROM diagnosis
                WHERE is_deleted = false
                GROUP BY icd_code, diagnosis_name
                ORDER BY occurrence_count DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);

            logger.debug('Most common diagnoses retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting most common diagnoses', {
                error: error.message,
                limit
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get diagnoses requiring follow-up
     * @param {string} date - Date to check (optional)
     * @returns {Promise<Array>} List of diagnoses
     */
    async getFollowUpDiagnoses(date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                SELECT 
                    d.id, d.patient_id, d.doctor_id,
                    d.diagnosis_name, d.follow_up_date, d.notes,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM diagnosis d
                JOIN patients p ON d.patient_id = p.id
                JOIN employees e ON d.doctor_id = e.id
                WHERE d.follow_up_date = $1
                    AND d.status IN ('active', 'chronic')
                    AND d.is_deleted = false
                ORDER BY d.follow_up_date ASC
            `;

            const result = await db.query(query, [targetDate]);

            logger.debug('Follow-up diagnoses retrieved', {
                date: targetDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting follow-up diagnoses', {
                error: error.message,
                date
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete diagnosis
     * @param {string} id - Diagnosis ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE diagnosis 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Diagnosis not found');
            }

            await db.commitTransaction(client);

            logger.info('Diagnosis soft deleted', {
                diagnosisId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting diagnosis', {
                error: error.message,
                diagnosisId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Diagnosis;

/**
 * ======================================================================
 * CONFIDENTIAL - Author: @koushal
 * This code is proprietary to OctNov.
 * Unauthorized use, copying, or distribution is prohibited.
 * For review purposes only.
 * ======================================================================
 */