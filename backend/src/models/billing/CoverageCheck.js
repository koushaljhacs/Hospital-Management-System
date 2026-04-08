/**
 * ======================================================================
 * FILE: backend/src/models/billing/CoverageCheck.js
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
 * CoverageCheck model for database operations.
 * Handles insurance coverage verification for services and procedures.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: coverage_checks
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients)
 * - insurance_provider_id: UUID (foreign key to insurance_providers)
 * - service_type: enum (consultation, lab, procedure, medicine)
 * - service_code: string
 * - estimated_amount: decimal
 * - coverage_percentage: decimal
 * - covered_amount: decimal
 * - patient_responsibility: decimal
 * - pre_authorization_required: boolean
 * - pre_authorization_days: integer
 * - exclusions: text[]
 * - limitations: jsonb
 * - api_request: jsonb
 * - api_response: jsonb
 * - checked_by: uuid
 * - checked_at: timestamp
 * - valid_until: date
 * - created_at: timestamp
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

const CoverageCheck = {
    /**
     * Table name
     */
    tableName: 'coverage_checks',

    /**
     * Valid service types
     */
    validServiceTypes: ['consultation', 'lab', 'procedure', 'medicine'],

    /**
     * Find coverage check by ID
     * @param {string} id - Coverage check UUID
     * @returns {Promise<Object|null>} Coverage check object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    cc.id, cc.patient_id, cc.insurance_provider_id,
                    cc.service_type, cc.service_code,
                    cc.estimated_amount, cc.coverage_percentage,
                    cc.covered_amount, cc.patient_responsibility,
                    cc.pre_authorization_required, cc.pre_authorization_days,
                    cc.exclusions, cc.limitations,
                    cc.api_request, cc.api_response,
                    cc.checked_by, cc.checked_at, cc.valid_until,
                    cc.created_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    ip.name as insurance_name,
                    u.username as checked_by_name
                FROM coverage_checks cc
                LEFT JOIN patients p ON cc.patient_id = p.id
                LEFT JOIN insurance_providers ip ON cc.insurance_provider_id = ip.id
                LEFT JOIN users u ON cc.checked_by = u.id
                WHERE cc.id = $1 AND cc.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Coverage check found by ID', { coverageId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding coverage check by ID', {
                error: error.message,
                coverageId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find coverage checks by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of coverage checks
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (from_date) {
                conditions.push(`checked_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`checked_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, insurance_provider_id, service_type,
                    service_code, estimated_amount,
                    coverage_percentage, covered_amount,
                    patient_responsibility, pre_authorization_required,
                    checked_at, valid_until
                FROM coverage_checks
                ${whereClause}
                ORDER BY checked_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Coverage checks found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding coverage checks by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active coverage check for patient and service
     * @param {string} patientId - Patient UUID
     * @param {string} serviceType - Service type
     * @param {string} serviceCode - Service code
     * @returns {Promise<Object|null>} Active coverage check or null
     */
    async getActive(patientId, serviceType, serviceCode) {
        try {
            const query = `
                SELECT 
                    id, insurance_provider_id, coverage_percentage,
                    covered_amount, patient_responsibility,
                    pre_authorization_required, pre_authorization_days,
                    exclusions, limitations, valid_until
                FROM coverage_checks
                WHERE patient_id = $1 
                    AND service_type = $2
                    AND service_code = $3
                    AND valid_until >= CURRENT_DATE
                    AND is_deleted = false
                ORDER BY checked_at DESC
                LIMIT 1
            `;

            const result = await db.query(query, [patientId, serviceType, serviceCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Active coverage check found', {
                patientId,
                serviceType,
                serviceCode
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting active coverage check', {
                error: error.message,
                patientId,
                serviceType,
                serviceCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new coverage check
     * @param {Object} checkData - Coverage check data
     * @returns {Promise<Object>} Created coverage check
     */
    async create(checkData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (checkData.service_type && !this.validServiceTypes.includes(checkData.service_type)) {
                throw new Error(`Invalid service type. Must be one of: ${this.validServiceTypes.join(', ')}`);
            }

            // Calculate amounts if not provided
            let coveragePercentage = checkData.coverage_percentage;
            let coveredAmount = checkData.covered_amount;
            let patientResponsibility = checkData.patient_responsibility;

            if (checkData.estimated_amount && coveragePercentage !== undefined && coveredAmount === undefined) {
                coveredAmount = (checkData.estimated_amount * coveragePercentage) / 100;
                patientResponsibility = checkData.estimated_amount - coveredAmount;
            }

            const query = `
                INSERT INTO coverage_checks (
                    id, patient_id, insurance_provider_id,
                    service_type, service_code,
                    estimated_amount, coverage_percentage,
                    covered_amount, patient_responsibility,
                    pre_authorization_required, pre_authorization_days,
                    exclusions, limitations,
                    api_request, api_response,
                    checked_by, checked_at, valid_until,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4,
                    $5, $6,
                    $7, $8,
                    $9, $10,
                    $11, $12,
                    $13, $14,
                    $15, COALESCE($16, NOW()), $17,
                    NOW()
                )
                RETURNING 
                    id, patient_id, insurance_provider_id,
                    service_type, service_code,
                    estimated_amount, coverage_percentage,
                    covered_amount, patient_responsibility,
                    checked_at, valid_until
            `;

            const values = [
                checkData.patient_id,
                checkData.insurance_provider_id,
                checkData.service_type,
                checkData.service_code || null,
                checkData.estimated_amount,
                coveragePercentage,
                coveredAmount,
                patientResponsibility,
                checkData.pre_authorization_required || false,
                checkData.pre_authorization_days || null,
                checkData.exclusions || null,
                checkData.limitations || null,
                checkData.api_request || null,
                checkData.api_response || null,
                checkData.checked_by || null,
                checkData.checked_at || null,
                checkData.valid_until || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Coverage check created', {
                coverageId: result.rows[0].id,
                patientId: checkData.patient_id,
                serviceType: checkData.service_type,
                coveragePercentage
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating coverage check', {
                error: error.message,
                patientId: checkData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update coverage check
     * @param {string} id - Coverage check ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated coverage check
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'coverage_percentage', 'covered_amount', 'patient_responsibility',
                'pre_authorization_required', 'pre_authorization_days',
                'exclusions', 'limitations', 'valid_until'
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
                UPDATE coverage_checks 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, patient_id, service_type,
                    coverage_percentage, valid_until,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Coverage check not found');
            }

            await db.commitTransaction(client);

            logger.info('Coverage check updated', {
                coverageId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating coverage check', {
                error: error.message,
                coverageId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get coverage check statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_checks,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT insurance_provider_id) as unique_providers,
                    COUNT(*) FILTER (WHERE service_type = 'consultation') as consultation_checks,
                    COUNT(*) FILTER (WHERE service_type = 'lab') as lab_checks,
                    COUNT(*) FILTER (WHERE service_type = 'procedure') as procedure_checks,
                    COUNT(*) FILTER (WHERE service_type = 'medicine') as medicine_checks,
                    AVG(coverage_percentage)::numeric(10,2) as avg_coverage,
                    AVG(patient_responsibility)::numeric(10,2) as avg_patient_responsibility
                FROM coverage_checks
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Coverage check statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting coverage check statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete coverage check
     * @param {string} id - Coverage check ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE coverage_checks 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Coverage check not found');
            }

            await db.commitTransaction(client);

            logger.info('Coverage check soft deleted', {
                coverageId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting coverage check', {
                error: error.message,
                coverageId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = CoverageCheck;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */