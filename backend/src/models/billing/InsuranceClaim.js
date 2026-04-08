/**
 * ======================================================================
 * FILE: backend/src/models/billing/InsuranceClaim.js
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
 * InsuranceClaim model for database operations.
 * Handles insurance claim submissions, tracking, and processing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: insurance_claims
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - claim_number: string (unique)
 * - patient_id: UUID (foreign key to patients)
 * - insurance_provider_id: UUID (foreign key to insurance_providers)
 * - invoice_id: UUID (foreign key to invoices)
 * - claim_amount: decimal
 * - approved_amount: decimal
 * - claim_status: enum (draft, submitted, processing, approved, rejected)
 * - submission_date: date
 * - decision_date: date
 * - documents: jsonb
 * - api_request: jsonb
 * - api_response: jsonb
 * - rejection_reason: text
 * - submitted_by: uuid
 * - submitted_at: timestamp
 * - processed_by: uuid
 * - processed_at: timestamp
 * - notes: text
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

const InsuranceClaim = {
    /**
     * Table name
     */
    tableName: 'insurance_claims',

    /**
     * Valid claim statuses
     */
    validStatuses: ['draft', 'submitted', 'processing', 'approved', 'rejected'],

    /**
     * Generate claim number
     * @returns {Promise<string>} Generated claim number
     */
    async generateClaimNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM insurance_claims
                WHERE claim_number LIKE $1
            `;
            const result = await db.query(query, [`CLM-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `CLM-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating claim number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find claim by ID
     * @param {string} id - Claim UUID
     * @returns {Promise<Object|null>} Claim object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ic.id, ic.claim_number, ic.patient_id,
                    ic.insurance_provider_id, ic.invoice_id,
                    ic.claim_amount, ic.approved_amount,
                    ic.claim_status, ic.submission_date, ic.decision_date,
                    ic.documents, ic.api_request, ic.api_response,
                    ic.rejection_reason,
                    ic.submitted_by, ic.submitted_at,
                    ic.processed_by, ic.processed_at,
                    ic.notes, ic.created_at, ic.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    ip.name as insurance_name,
                    i.invoice_number,
                    sub.username as submitted_by_name,
                    proc.username as processed_by_name
                FROM insurance_claims ic
                LEFT JOIN patients p ON ic.patient_id = p.id
                LEFT JOIN insurance_providers ip ON ic.insurance_provider_id = ip.id
                LEFT JOIN invoices i ON ic.invoice_id = i.id
                LEFT JOIN users sub ON ic.submitted_by = sub.id
                LEFT JOIN users proc ON ic.processed_by = proc.id
                WHERE ic.id = $1 AND ic.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Insurance claim found by ID', { claimId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding insurance claim by ID', {
                error: error.message,
                claimId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find claim by claim number
     * @param {string} claimNumber - Claim number
     * @returns {Promise<Object|null>} Claim object or null
     */
    async findByNumber(claimNumber) {
        try {
            const query = `
                SELECT 
                    id, claim_number, patient_id, insurance_provider_id,
                    claim_amount, claim_status, submission_date
                FROM insurance_claims
                WHERE claim_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [claimNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Insurance claim found by number', { claimNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding insurance claim by number', {
                error: error.message,
                claimNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find claims by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of claims
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, claim_status, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (claim_status) {
                conditions.push(`claim_status = $${paramIndex++}`);
                values.push(claim_status);
            }
            if (from_date) {
                conditions.push(`submission_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`submission_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, claim_number, insurance_provider_id,
                    claim_amount, approved_amount, claim_status,
                    submission_date, decision_date
                FROM insurance_claims
                ${whereClause}
                ORDER BY submission_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Insurance claims found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding insurance claims by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find claims by insurance provider ID
     * @param {string} providerId - Insurance provider UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of claims
     */
    async findByProviderId(providerId, options = {}) {
        try {
            const { limit = 50, offset = 0, claim_status, from_date, to_date } = options;
            const values = [providerId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (claim_status) {
                conditions.push(`claim_status = $${paramIndex++}`);
                values.push(claim_status);
            }
            if (from_date) {
                conditions.push(`submission_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`submission_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, claim_number, patient_id,
                    claim_amount, approved_amount, claim_status,
                    submission_date, decision_date,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM insurance_claims ic
                JOIN patients p ON ic.patient_id = p.id
                ${whereClause}
                ORDER BY submission_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Insurance claims found by provider ID', {
                providerId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding insurance claims by provider ID', {
                error: error.message,
                providerId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get claims by status
     * @param {string} status - Claim status
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of claims
     */
    async findByStatus(status, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    ic.id, ic.claim_number, ic.patient_id,
                    ic.insurance_provider_id, ic.claim_amount,
                    ic.submission_date, ic.claim_status,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    ip.name as insurance_name
                FROM insurance_claims ic
                JOIN patients p ON ic.patient_id = p.id
                LEFT JOIN insurance_providers ip ON ic.insurance_provider_id = ip.id
                WHERE ic.claim_status = $1 AND ic.is_deleted = false
                ORDER BY ic.submission_date ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            logger.debug('Insurance claims found by status', {
                status,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding insurance claims by status', {
                error: error.message,
                status
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new insurance claim
     * @param {Object} claimData - Claim data
     * @returns {Promise<Object>} Created claim
     */
    async create(claimData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (claimData.claim_status && !this.validStatuses.includes(claimData.claim_status)) {
                throw new Error(`Invalid claim status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const claimNumber = await this.generateClaimNumber();

            const query = `
                INSERT INTO insurance_claims (
                    id, claim_number, patient_id, insurance_provider_id,
                    invoice_id, claim_amount, approved_amount,
                    claim_status, submission_date, decision_date,
                    documents, api_request, api_response,
                    rejection_reason, notes,
                    submitted_by, submitted_at,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    $10, $11, $12,
                    $13, $14,
                    $15, $16,
                    $17, NOW(), NOW()
                )
                RETURNING 
                    id, claim_number, patient_id,
                    claim_amount, claim_status, submission_date,
                    created_at
            `;

            const values = [
                claimNumber,
                claimData.patient_id,
                claimData.insurance_provider_id,
                claimData.invoice_id || null,
                claimData.claim_amount,
                claimData.approved_amount || null,
                claimData.claim_status || 'draft',
                claimData.submission_date || new Date().toISOString().split('T')[0],
                claimData.decision_date || null,
                claimData.documents || null,
                claimData.api_request || null,
                claimData.api_response || null,
                claimData.rejection_reason || null,
                claimData.notes || null,
                claimData.submitted_by || null,
                claimData.submitted_at || null,
                claimData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Insurance claim created', {
                claimId: result.rows[0].id,
                claimNumber,
                patientId: claimData.patient_id,
                amount: claimData.claim_amount
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating insurance claim', {
                error: error.message,
                patientId: claimData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update insurance claim
     * @param {string} id - Claim ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated claim
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'claim_amount', 'approved_amount', 'claim_status',
                'decision_date', 'documents', 'api_request',
                'api_response', 'rejection_reason', 'notes',
                'processed_by', 'processed_at'
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
                UPDATE insurance_claims 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, claim_number, claim_status,
                    approved_amount, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Insurance claim not found');
            }

            await db.commitTransaction(client);

            logger.info('Insurance claim updated', {
                claimId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating insurance claim', {
                error: error.message,
                claimId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Submit claim for processing
     * @param {string} id - Claim ID
     * @param {string} submittedBy - User who submitted
     * @returns {Promise<Object>} Updated claim
     */
    async submit(id, submittedBy) {
        return this.update(id, {
            claim_status: 'submitted',
            submitted_by: submittedBy,
            submitted_at: new Date(),
            updated_by: submittedBy
        });
    },

    /**
     * Process claim (mark as processing)
     * @param {string} id - Claim ID
     * @param {string} processedBy - User who processed
     * @returns {Promise<Object>} Updated claim
     */
    async process(id, processedBy) {
        return this.update(id, {
            claim_status: 'processing',
            processed_by: processedBy,
            processed_at: new Date(),
            updated_by: processedBy
        });
    },

    /**
     * Approve claim
     * @param {string} id - Claim ID
     * @param {number} approvedAmount - Approved amount
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated claim
     */
    async approve(id, approvedAmount, approvedBy) {
        return this.update(id, {
            claim_status: 'approved',
            approved_amount: approvedAmount,
            decision_date: new Date().toISOString().split('T')[0],
            updated_by: approvedBy
        });
    },

    /**
     * Reject claim
     * @param {string} id - Claim ID
     * @param {string} reason - Rejection reason
     * @param {string} rejectedBy - User who rejected
     * @returns {Promise<Object>} Updated claim
     */
    async reject(id, reason, rejectedBy) {
        return this.update(id, {
            claim_status: 'rejected',
            rejection_reason: reason,
            decision_date: new Date().toISOString().split('T')[0],
            updated_by: rejectedBy
        });
    },

    /**
     * Get claim statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND submission_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_claims,
                    SUM(claim_amount) as total_claimed,
                    SUM(approved_amount) as total_approved,
                    AVG(claim_amount)::numeric(10,2) as avg_claim_amount,
                    COUNT(*) FILTER (WHERE claim_status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE claim_status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE claim_status = 'processing') as processing,
                    COUNT(*) FILTER (WHERE claim_status = 'submitted') as submitted,
                    COUNT(*) FILTER (WHERE claim_status = 'draft') as draft,
                    ROUND((SUM(approved_amount)::numeric / NULLIF(SUM(claim_amount), 0) * 100), 2) as approval_rate,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT insurance_provider_id) as unique_providers
                FROM insurance_claims
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Insurance claim statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting insurance claim statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get claims by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of claims
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    id, claim_number, patient_id,
                    claim_amount, approved_amount, claim_status,
                    submission_date, decision_date
                FROM insurance_claims
                WHERE submission_date BETWEEN $1 AND $2
                    AND is_deleted = false
                ORDER BY submission_date DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [startDate, endDate, limit, offset]);

            logger.debug('Insurance claims found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting insurance claims by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete insurance claim
     * @param {string} id - Claim ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE insurance_claims 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Insurance claim not found');
            }

            await db.commitTransaction(client);

            logger.info('Insurance claim soft deleted', {
                claimId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting insurance claim', {
                error: error.message,
                claimId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = InsuranceClaim;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */