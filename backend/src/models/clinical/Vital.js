/**
 * ======================================================================
 * FILE: backend/src/models/clinical/Vital.js
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
 * Vital model for database operations.
 * Handles all patient vital signs tracking for clinical monitoring.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: vitals
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients)
 * - nurse_id: UUID (foreign key to employees)
 * - visit_id: UUID (foreign key to visits)
 * - recorded_at: timestamp
 * - bp_systolic: integer
 * - bp_diastolic: integer
 * - heart_rate: integer
 * - temperature: decimal
 * - weight: decimal
 * - height: decimal
 * - respiratory_rate: integer
 * - oxygen_saturation: integer
 * - blood_glucose: decimal
 * - pain_score: integer
 * - notes: text
 * - is_abnormal: boolean
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

const Vital = {
    /**
     * Table name
     */
    tableName: 'vitals',

    /**
     * Normal ranges for vitals
     */
    normalRanges: {
        bp_systolic: { min: 90, max: 120 },
        bp_diastolic: { min: 60, max: 80 },
        heart_rate: { min: 60, max: 100 },
        temperature: { min: 36.1, max: 37.2 },
        respiratory_rate: { min: 12, max: 20 },
        oxygen_saturation: { min: 95, max: 100 },
        blood_glucose: { min: 70, max: 100 },
        pain_score: { min: 0, max: 10 }
    },

    /**
     * Critical ranges for vitals (alerts)
     */
    criticalRanges: {
        bp_systolic: { min: 70, max: 180 },
        bp_diastolic: { min: 40, max: 110 },
        heart_rate: { min: 40, max: 140 },
        temperature: { min: 35, max: 39 },
        respiratory_rate: { min: 8, max: 30 },
        oxygen_saturation: { min: 90, max: 100 },
        blood_glucose: { min: 50, max: 250 },
        pain_score: { min: 0, max: 10 }
    },

    /**
     * Check if vital is abnormal
     * @param {Object} vitalData - Vital data to check
     * @returns {boolean} True if abnormal
     */
    isAbnormal(vitalData) {
        const abnormal = [];

        if (vitalData.bp_systolic) {
            const range = this.normalRanges.bp_systolic;
            if (vitalData.bp_systolic < range.min || vitalData.bp_systolic > range.max) {
                abnormal.push('bp_systolic');
            }
        }
        if (vitalData.bp_diastolic) {
            const range = this.normalRanges.bp_diastolic;
            if (vitalData.bp_diastolic < range.min || vitalData.bp_diastolic > range.max) {
                abnormal.push('bp_diastolic');
            }
        }
        if (vitalData.heart_rate) {
            const range = this.normalRanges.heart_rate;
            if (vitalData.heart_rate < range.min || vitalData.heart_rate > range.max) {
                abnormal.push('heart_rate');
            }
        }
        if (vitalData.temperature) {
            const range = this.normalRanges.temperature;
            if (vitalData.temperature < range.min || vitalData.temperature > range.max) {
                abnormal.push('temperature');
            }
        }
        if (vitalData.respiratory_rate) {
            const range = this.normalRanges.respiratory_rate;
            if (vitalData.respiratory_rate < range.min || vitalData.respiratory_rate > range.max) {
                abnormal.push('respiratory_rate');
            }
        }
        if (vitalData.oxygen_saturation) {
            const range = this.normalRanges.oxygen_saturation;
            if (vitalData.oxygen_saturation < range.min) {
                abnormal.push('oxygen_saturation');
            }
        }
        if (vitalData.blood_glucose) {
            const range = this.normalRanges.blood_glucose;
            if (vitalData.blood_glucose < range.min || vitalData.blood_glucose > range.max) {
                abnormal.push('blood_glucose');
            }
        }

        return abnormal.length > 0;
    },

    /**
     * Check if vital is critical (requires alert)
     * @param {Object} vitalData - Vital data to check
     * @returns {boolean} True if critical
     */
    isCritical(vitalData) {
        const critical = [];

        if (vitalData.bp_systolic) {
            const range = this.criticalRanges.bp_systolic;
            if (vitalData.bp_systolic < range.min || vitalData.bp_systolic > range.max) {
                critical.push('bp_systolic');
            }
        }
        if (vitalData.bp_diastolic) {
            const range = this.criticalRanges.bp_diastolic;
            if (vitalData.bp_diastolic < range.min || vitalData.bp_diastolic > range.max) {
                critical.push('bp_diastolic');
            }
        }
        if (vitalData.heart_rate) {
            const range = this.criticalRanges.heart_rate;
            if (vitalData.heart_rate < range.min || vitalData.heart_rate > range.max) {
                critical.push('heart_rate');
            }
        }
        if (vitalData.temperature) {
            const range = this.criticalRanges.temperature;
            if (vitalData.temperature < range.min || vitalData.temperature > range.max) {
                critical.push('temperature');
            }
        }
        if (vitalData.respiratory_rate) {
            const range = this.criticalRanges.respiratory_rate;
            if (vitalData.respiratory_rate < range.min || vitalData.respiratory_rate > range.max) {
                critical.push('respiratory_rate');
            }
        }
        if (vitalData.oxygen_saturation) {
            const range = this.criticalRanges.oxygen_saturation;
            if (vitalData.oxygen_saturation < range.min) {
                critical.push('oxygen_saturation');
            }
        }
        if (vitalData.blood_glucose) {
            const range = this.criticalRanges.blood_glucose;
            if (vitalData.blood_glucose < range.min || vitalData.blood_glucose > range.max) {
                critical.push('blood_glucose');
            }
        }

        return critical.length > 0;
    },

    /**
     * Find vital by ID
     * @param {string} id - Vital UUID
     * @returns {Promise<Object|null>} Vital object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    v.id, v.patient_id, v.nurse_id, v.visit_id,
                    v.recorded_at,
                    v.bp_systolic, v.bp_diastolic, v.heart_rate,
                    v.temperature, v.weight, v.height,
                    v.respiratory_rate, v.oxygen_saturation,
                    v.blood_glucose, v.pain_score, v.notes,
                    v.is_abnormal, v.created_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    n.first_name as nurse_first_name,
                    n.last_name as nurse_last_name
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                JOIN employees n ON v.nurse_id = n.id
                WHERE v.id = $1 AND v.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Vital found by ID', { vitalId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding vital by ID', {
                error: error.message,
                vitalId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find vitals by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of vitals
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['v.is_deleted = false'];

            if (from_date) {
                conditions.push(`v.recorded_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`v.recorded_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    v.id, v.patient_id, v.nurse_id, v.visit_id,
                    v.recorded_at,
                    v.bp_systolic, v.bp_diastolic, v.heart_rate,
                    v.temperature, v.weight, v.height,
                    v.respiratory_rate, v.oxygen_saturation,
                    v.blood_glucose, v.pain_score, v.notes,
                    v.is_abnormal, v.created_at,
                    n.first_name as nurse_first_name,
                    n.last_name as nurse_last_name
                FROM vitals v
                JOIN employees n ON v.nurse_id = n.id
                ${whereClause}
                ORDER BY v.recorded_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Vitals found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding vitals by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find latest vitals for patient
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object|null>} Latest vital or null
     */
    async getLatest(patientId) {
        try {
            const query = `
                SELECT 
                    v.id, v.patient_id, v.nurse_id, v.visit_id,
                    v.recorded_at,
                    v.bp_systolic, v.bp_diastolic, v.heart_rate,
                    v.temperature, v.weight, v.height,
                    v.respiratory_rate, v.oxygen_saturation,
                    v.blood_glucose, v.pain_score, v.notes,
                    v.is_abnormal,
                    n.first_name as nurse_first_name,
                    n.last_name as nurse_last_name
                FROM vitals v
                JOIN employees n ON v.nurse_id = n.id
                WHERE v.patient_id = $1 AND v.is_deleted = false
                ORDER BY v.recorded_at DESC
                LIMIT 1
            `;

            const result = await db.query(query, [patientId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Latest vital retrieved', { patientId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting latest vital', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new vital record
     * @param {Object} vitalData - Vital data
     * @returns {Promise<Object>} Created vital
     */
    async create(vitalData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const isAbnormal = this.isAbnormal(vitalData);

            const query = `
                INSERT INTO vitals (
                    id, patient_id, nurse_id, visit_id,
                    recorded_at,
                    bp_systolic, bp_diastolic, heart_rate,
                    temperature, weight, height,
                    respiratory_rate, oxygen_saturation,
                    blood_glucose, pain_score, notes,
                    is_abnormal,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    COALESCE($4, NOW()),
                    $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17, NOW(), NOW()
                )
                RETURNING 
                    id, patient_id, nurse_id, visit_id,
                    recorded_at, bp_systolic, bp_diastolic,
                    heart_rate, temperature, weight, height,
                    respiratory_rate, oxygen_saturation,
                    blood_glucose, pain_score, is_abnormal,
                    created_at
            `;

            const values = [
                vitalData.patient_id,
                vitalData.nurse_id,
                vitalData.visit_id || null,
                vitalData.recorded_at || null,
                vitalData.bp_systolic || null,
                vitalData.bp_diastolic || null,
                vitalData.heart_rate || null,
                vitalData.temperature || null,
                vitalData.weight || null,
                vitalData.height || null,
                vitalData.respiratory_rate || null,
                vitalData.oxygen_saturation || null,
                vitalData.blood_glucose || null,
                vitalData.pain_score || null,
                vitalData.notes || null,
                isAbnormal,
                vitalData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Vital record created successfully', {
                vitalId: result.rows[0].id,
                patientId: vitalData.patient_id,
                isAbnormal
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating vital record', {
                error: error.message,
                patientId: vitalData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update vital record
     * @param {string} id - Vital ID
     * @param {Object} updates - Fields to update
     * @param {string} [updates.updated_by] - User who updated
     * @returns {Promise<Object>} Updated vital
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'bp_systolic', 'bp_diastolic', 'heart_rate',
                'temperature', 'weight', 'height',
                'respiratory_rate', 'oxygen_saturation',
                'blood_glucose', 'pain_score', 'notes'
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

            const vital = await this.findById(id);
            const isAbnormal = this.isAbnormal({ ...vital, ...updates });
            setClause.push(`is_abnormal = $${paramIndex++}`);
            values.push(isAbnormal);

            setClause.push(`updated_at = NOW()`);
            if (updates.updated_by) {
                setClause.push(`updated_by = $${paramIndex++}`);
                values.push(updates.updated_by);
            }
            values.push(id);

            const query = `
                UPDATE vitals 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, patient_id, nurse_id, visit_id,
                    recorded_at, bp_systolic, bp_diastolic,
                    heart_rate, temperature, is_abnormal,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Vital record not found');
            }

            await db.commitTransaction(client);

            logger.info('Vital record updated successfully', {
                vitalId: id,
                updates: Object.keys(updates),
                isAbnormal
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating vital record', {
                error: error.message,
                vitalId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get vital trends for patient
     * @param {string} patientId - Patient UUID
     * @param {string} vitalType - Type of vital (bp, heart_rate, etc.)
     * @param {number} days - Number of days to look back
     * @returns {Promise<Array>} Trend data
     */
    async getTrends(patientId, vitalType, days = 30) {
        try {
            const fieldMap = {
                'bp_systolic': 'bp_systolic',
                'bp_diastolic': 'bp_diastolic',
                'heart_rate': 'heart_rate',
                'temperature': 'temperature',
                'weight': 'weight',
                'respiratory_rate': 'respiratory_rate',
                'oxygen_saturation': 'oxygen_saturation',
                'blood_glucose': 'blood_glucose',
                'pain_score': 'pain_score'
            };

            const field = fieldMap[vitalType];
            if (!field) {
                throw new Error('Invalid vital type');
            }

            const query = `
                SELECT 
                    DATE(recorded_at) as date,
                    ${field} as value,
                    COUNT(*) as readings_count
                FROM vitals
                WHERE patient_id = $1 
                    AND ${field} IS NOT NULL
                    AND recorded_at > NOW() - ($2 || ' days')::INTERVAL
                    AND is_deleted = false
                GROUP BY DATE(recorded_at), ${field}
                ORDER BY date ASC
            `;

            const result = await db.query(query, [patientId, days]);

            logger.debug('Vital trends retrieved', {
                patientId,
                vitalType,
                days,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting vital trends', {
                error: error.message,
                patientId,
                vitalType
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get abnormal vitals (requires attention)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of abnormal vitals
     */
    async getAbnormalVitals(options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    v.id, v.patient_id, v.nurse_id,
                    v.recorded_at,
                    v.bp_systolic, v.bp_diastolic, v.heart_rate,
                    v.temperature, v.respiratory_rate,
                    v.oxygen_saturation, v.blood_glucose,
                    v.pain_score, v.notes,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                WHERE v.is_abnormal = true 
                    AND v.is_deleted = false
                ORDER BY v.recorded_at DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Abnormal vitals retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting abnormal vitals', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get vital statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND recorded_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_readings,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT nurse_id) as unique_nurses,
                    COUNT(*) FILTER (WHERE is_abnormal = true) as abnormal_readings,
                    AVG(bp_systolic)::numeric(10,2) as avg_bp_systolic,
                    AVG(bp_diastolic)::numeric(10,2) as avg_bp_diastolic,
                    AVG(heart_rate)::numeric(10,2) as avg_heart_rate,
                    AVG(temperature)::numeric(10,2) as avg_temperature,
                    AVG(oxygen_saturation)::numeric(10,2) as avg_oxygen_saturation
                FROM vitals
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Vital statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting vital statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Calculate BMI from latest vitals
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object|null>} BMI data or null
     */
    async calculateBMI(patientId) {
        try {
            const latest = await this.getLatest(patientId);
            if (!latest || !latest.weight || !latest.height) {
                return null;
            }

            const heightInMeters = latest.height / 100;
            const bmi = latest.weight / (heightInMeters * heightInMeters);

            let category = '';
            if (bmi < 18.5) category = 'Underweight';
            else if (bmi < 25) category = 'Normal';
            else if (bmi < 30) category = 'Overweight';
            else category = 'Obese';

            logger.debug('BMI calculated', {
                patientId,
                bmi: bmi.toFixed(1),
                category
            });

            return {
                patient_id: patientId,
                weight: latest.weight,
                height: latest.height,
                bmi: bmi.toFixed(1),
                category,
                recorded_at: latest.recorded_at
            };
        } catch (error) {
            logger.error('Error calculating BMI', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete vital record
     * @param {string} id - Vital ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE vitals 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Vital record not found');
            }

            await db.commitTransaction(client);

            logger.info('Vital record soft deleted', {
                vitalId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting vital record', {
                error: error.message,
                vitalId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Vital;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */