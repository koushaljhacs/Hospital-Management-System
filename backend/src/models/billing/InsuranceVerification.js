/**
 * ======================================================================
 * FILE: backend/src/models/billing/InsuranceVerification.js
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
 * InsuranceVerification model for database operations.
 * Handles verification of patient insurance eligibility and coverage details.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: insurance_verifications
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients)
 * - insurance_provider_id: UUID (foreign key to insurance_providers)
 * - policy_number: string
 * - verification_status: enum (pending, verified, failed)
 * - coverage_details: jsonb
 * - eligibility_status: string
 * - verification_date: date
 * - expiry_date: date
 * - api_request: jsonb
 * - api_response: jsonb
 * - verified_by: uuid
 * - verified_at: timestamp
 * - notes: text
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

const InsuranceVerification = {
    /**
     * Table name
     */
    tableName: 'insurance_verifications',

    /**
     * Valid verification statuses
     */
    validStatuses: ['pending', 'verified', 'failed'],

    /**
     * Find verification by ID
     * @param {string} id - Verification UUID
     * @returns {Promise<Object|null>} Verification object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    iv.id, iv.patient_id, iv.insurance_provider_id,
                    iv.policy_number, iv.verification_status,
                    iv.coverage_details, iv.eligibility_status,
                    iv.verification_date, iv.expiry_date,
                    iv.api_request, iv.api_response,
                    iv.verified_by, iv.verified_at, iv.notes,
                    iv.created_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    ip.name as insurance_name,
                    u.username as verified_by_name
                FROM insurance_verifications iv
                LEFT JOIN patients p ON iv.patient_id = p.id
                LEFT JOIN insurance_providers ip ON iv.insurance_provider_id = ip.id
                LEFT JOIN users u ON iv.verified_by = u.id
                WHERE iv.id = $1 AND iv.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Insurance verification found by ID', { verificationId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding insurance verification by ID', {
                error: error.message,
                verificationId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find verifications by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of verifications
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, status } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`verification_status = $${paramIndex++}`);
                values.push(status);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, insurance_provider_id, policy_number,
                    verification_status, eligibility_status,
                    verification_date, expiry_date,
                    verified_at, created_at
                FROM insurance_verifications
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Insurance verifications found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding insurance verifications by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get latest verification for patient
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object|null>} Latest verification or null
     */
    async getLatest(patientId) {
        try {
            const query = `
                SELECT 
                    id, insurance_provider_id, policy_number,
                    verification_status, eligibility_status,
                    coverage_details, verification_date, expiry_date
                FROM insurance_verifications
                WHERE patient_id = $1 AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const result = await db.query(query, [patientId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Latest insurance verification retrieved', { patientId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting latest insurance verification', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active verification for patient (not expired)
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object|null>} Active verification or null
     */
    async getActive(patientId) {
        try {
            const query = `
                SELECT 
                    id, insurance_provider_id, policy_number,
                    verification_status, eligibility_status,
                    coverage_details, verification_date, expiry_date
                FROM insurance_verifications
                WHERE patient_id = $1 
                    AND verification_status = 'verified'
                    AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
                    AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const result = await db.query(query, [patientId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Active insurance verification retrieved', { patientId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting active insurance verification', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new insurance verification
     * @param {Object} verificationData - Verification data
     * @returns {Promise<Object>} Created verification
     */
    async create(verificationData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (verificationData.verification_status && !this.validStatuses.includes(verificationData.verification_status)) {
                throw new Error(`Invalid verification status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const query = `
                INSERT INTO insurance_verifications (
                    id, patient_id, insurance_provider_id,
                    policy_number, verification_status,
                    coverage_details, eligibility_status,
                    verification_date, expiry_date,
                    api_request, api_response,
                    verified_by, verified_at, notes,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4,
                    $5, $6,
                    COALESCE($7, CURRENT_DATE), $8,
                    $9, $10,
                    $11, $12, $13,
                    NOW()
                )
                RETURNING 
                    id, patient_id, insurance_provider_id,
                    policy_number, verification_status,
                    eligibility_status, verification_date,
                    expiry_date, created_at
            `;

            const values = [
                verificationData.patient_id,
                verificationData.insurance_provider_id,
                verificationData.policy_number,
                verificationData.verification_status || 'pending',
                verificationData.coverage_details || null,
                verificationData.eligibility_status || null,
                verificationData.verification_date || null,
                verificationData.expiry_date || null,
                verificationData.api_request || null,
                verificationData.api_response || null,
                verificationData.verified_by || null,
                verificationData.verified_at || null,
                verificationData.notes || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Insurance verification created', {
                verificationId: result.rows[0].id,
                patientId: verificationData.patient_id,
                policyNumber: verificationData.policy_number,
                status: result.rows[0].verification_status
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating insurance verification', {
                error: error.message,
                patientId: verificationData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update insurance verification
     * @param {string} id - Verification ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated verification
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'verification_status', 'coverage_details', 'eligibility_status',
                'expiry_date', 'api_request', 'api_response',
                'verified_by', 'verified_at', 'notes'
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
                UPDATE insurance_verifications 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, patient_id, verification_status,
                    eligibility_status, expiry_date,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Insurance verification not found');
            }

            await db.commitTransaction(client);

            logger.info('Insurance verification updated', {
                verificationId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating insurance verification', {
                error: error.message,
                verificationId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Mark verification as verified
     * @param {string} id - Verification ID
     * @param {string} verifiedBy - User who verified
     * @returns {Promise<Object>} Updated verification
     */
    async markVerified(id, verifiedBy) {
        return this.update(id, {
            verification_status: 'verified',
            verified_by: verifiedBy,
            verified_at: new Date(),
            updated_by: verifiedBy
        });
    },

    /**
     * Mark verification as failed
     * @param {string} id - Verification ID
     * @param {string} failedBy - User who marked failed
     * @param {string} reason - Failure reason (stored in notes)
     * @returns {Promise<Object>} Updated verification
     */
    async markFailed(id, failedBy, reason = null) {
        const updates = {
            verification_status: 'failed',
            verified_by: failedBy,
            verified_at: new Date(),
            updated_by: failedBy
        };
        if (reason) {
            updates.notes = reason;
        }
        return this.update(id, updates);
    },

    /**
     * Get verification statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_verifications,
                    COUNT(*) FILTER (WHERE verification_status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE verification_status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE verification_status = 'failed') as failed,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT insurance_provider_id) as unique_providers,
                    AVG(EXTRACT(EPOCH FROM (verified_at - created_at))/3600)::numeric(10,2) as avg_verification_hours
                FROM insurance_verifications
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Insurance verification statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting insurance verification statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get verifications expiring soon
     * @param {number} daysThreshold - Days to look ahead
     * @returns {Promise<Array>} List of expiring verifications
     */
    async getExpiringSoon(daysThreshold = 30) {
        try {
            const query = `
                SELECT 
                    iv.id, iv.patient_id, iv.insurance_provider_id,
                    iv.expiry_date, iv.verification_status,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    ip.name as insurance_name
                FROM insurance_verifications iv
                JOIN patients p ON iv.patient_id = p.id
                LEFT JOIN insurance_providers ip ON iv.insurance_provider_id = ip.id
                WHERE iv.verification_status = 'verified'
                    AND iv.expiry_date IS NOT NULL
                    AND iv.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
                    AND iv.expiry_date > CURRENT_DATE
                    AND iv.is_deleted = false
                ORDER BY iv.expiry_date ASC
            `;

            const result = await db.query(query, [daysThreshold]);

            logger.debug('Insurance verifications expiring soon retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiring verifications', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete insurance verification
     * @param {string} id - Verification ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE insurance_verifications 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Insurance verification not found');
            }

            await db.commitTransaction(client);

            logger.info('Insurance verification soft deleted', {
                verificationId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting insurance verification', {
                error: error.message,
                verificationId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = InsuranceVerification;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */