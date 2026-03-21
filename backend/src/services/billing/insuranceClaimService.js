/**
 * ======================================================================
 * FILE: backend/src/services/billing/insuranceClaimService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing insurance claim service - Handles business logic for insurance claims.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-33] Insurance claim requires pre-authorization
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const insuranceClaimService = {
    /**
     * Get all insurance claims
     */
    async getAllClaims(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, status, patient_id, insurance_provider_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT c.*, 
                       i.invoice_number,
                       i.total_amount as invoice_total,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       ip.name as provider_name,
                       ip.code as provider_code,
                       CONCAT(u1.first_name, ' ', u1.last_name) as created_by_name,
                       CONCAT(u2.first_name, ' ', u2.last_name) as updated_by_name
                FROM insurance_claims c
                JOIN invoices i ON c.invoice_id = i.id
                JOIN patients p ON c.patient_id = p.id
                JOIN insurance_providers ip ON c.insurance_provider_id = ip.id
                LEFT JOIN users u1 ON c.created_by = u1.id
                LEFT JOIN users u2 ON c.updated_by = u2.id
                WHERE c.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND c.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND c.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (insurance_provider_id) {
                query += ` AND c.insurance_provider_id = $${paramIndex}`;
                values.push(insurance_provider_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND c.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND c.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY c.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(claim_amount) as total_amount,
                    SUM(CASE WHEN status = 'approved' THEN claim_amount ELSE 0 END) as approved_amount,
                    SUM(CASE WHEN status = 'paid' THEN paid_amount ELSE 0 END) as paid_amount,
                    SUM(CASE WHEN status = 'submitted' THEN claim_amount ELSE 0 END) as pending_amount,
                    SUM(CASE WHEN status = 'rejected' THEN claim_amount ELSE 0 END) as rejected_amount
                FROM insurance_claims
                WHERE is_deleted = false
                ${status ? 'AND status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getAllClaims', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get claims by status
     */
    async getClaimsByStatus(staffId, statuses, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            const statusArray = Array.isArray(statuses) ? statuses : [statuses];

            let query = `
                SELECT c.*, 
                       i.invoice_number,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       ip.name as provider_name
                FROM insurance_claims c
                JOIN invoices i ON c.invoice_id = i.id
                JOIN patients p ON c.patient_id = p.id
                JOIN insurance_providers ip ON c.insurance_provider_id = ip.id
                WHERE c.status = ANY($1::text[]) AND c.is_deleted = false
            `;
            const values = [statusArray];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND c.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND c.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY c.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(claim_amount) as total_amount,
                    AVG(EXTRACT(EPOCH FROM (CASE 
                        WHEN status = 'approved' THEN approved_at - created_at
                        WHEN status = 'rejected' THEN rejected_at - created_at
                        ELSE NULL
                    END))/86400)::numeric(10,2) as avg_processing_days
                FROM insurance_claims
                WHERE status = ANY($1::text[]) AND is_deleted = false
            `;
            const count = await db.query(countQuery, [statusArray]);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getClaimsByStatus', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get claim by ID
     */
    async getClaimById(staffId, claimId) {
        try {
            const query = `
                SELECT c.*, 
                       i.invoice_number,
                       i.total_amount as invoice_total,
                       i.invoice_date,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.phone as patient_phone,
                       p.email as patient_email,
                       ip.id as provider_id,
                       ip.name as provider_name,
                       ip.code as provider_code,
                       ip.address as provider_address,
                       ip.phone as provider_phone,
                       ip.email as provider_email,
                       CONCAT(u1.first_name, ' ', u1.last_name) as created_by_name,
                       CONCAT(u2.first_name, ' ', u2.last_name) as updated_by_name,
                       CONCAT(u3.first_name, ' ', u3.last_name) as submitted_by_name
                FROM insurance_claims c
                JOIN invoices i ON c.invoice_id = i.id
                JOIN patients p ON c.patient_id = p.id
                JOIN insurance_providers ip ON c.insurance_provider_id = ip.id
                LEFT JOIN users u1 ON c.created_by = u1.id
                LEFT JOIN users u2 ON c.updated_by = u2.id
                LEFT JOIN users u3 ON c.submitted_by = u3.id
                WHERE c.id = $1 AND c.is_deleted = false
            `;

            const result = await db.query(query, [claimId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getClaimById', { error: error.message, staffId, claimId });
            throw error;
        }
    },

    /**
     * Get claim history
     */
    async getClaimHistory(staffId, claimId) {
        try {
            const query = `
                SELECT ch.*,
                       CONCAT(u.first_name, ' ', u.last_name) as performed_by_name
                FROM claim_history ch
                LEFT JOIN users u ON ch.performed_by = u.id
                WHERE ch.claim_id = $1
                ORDER BY ch.performed_at DESC
            `;

            const result = await db.query(query, [claimId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getClaimHistory', { error: error.message, staffId, claimId });
            throw error;
        }
    },

    /**
     * Get insurance provider
     */
    async getInsuranceProvider(staffId, providerId) {
        try {
            const result = await db.query(`
                SELECT ip.*
                FROM insurance_providers ip
                WHERE ip.id = $1 AND ip.is_deleted = false
            `, [providerId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getInsuranceProvider', { error: error.message, staffId, providerId });
            throw error;
        }
    },

    /**
     * Validate patient insurance
     */
    async validatePatientInsurance(staffId, patientId, providerId) {
        try {
            const result = await db.query(`
                SELECT pi.*, ip.name as provider_name, ip.requires_pre_authorization
                FROM patient_insurance pi
                JOIN insurance_providers ip ON pi.insurance_provider_id = ip.id
                WHERE pi.patient_id = $1 
                    AND pi.insurance_provider_id = $2
                    AND pi.is_active = true
                    AND (pi.valid_until IS NULL OR pi.valid_until > NOW())
            `, [patientId, providerId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in validatePatientInsurance', { error: error.message, staffId, patientId, providerId });
            throw error;
        }
    },

    /**
     * Validate coverage limit
     */
    async validateCoverageLimit(staffId, patientId, providerId, claimAmount) {
        try {
            const result = await db.query(`
                SELECT pi.*,
                       ip.coverage_limit,
                       ip.coverage_limit_per_visit,
                       COALESCE(SUM(c.claim_amount), 0) as total_claimed
                FROM patient_insurance pi
                JOIN insurance_providers ip ON pi.insurance_provider_id = ip.id
                LEFT JOIN insurance_claims c ON pi.patient_id = c.patient_id 
                    AND c.insurance_provider_id = ip.id
                    AND c.status IN ('submitted', 'processing', 'approved', 'paid')
                    AND c.is_deleted = false
                WHERE pi.patient_id = $1 
                    AND pi.insurance_provider_id = $2
                    AND pi.is_active = true
                GROUP BY pi.id, ip.id
            `, [patientId, providerId]);

            if (result.rows.length === 0) {
                return { is_covered: false, reason: 'No active insurance found' };
            }

            const insurance = result.rows[0];
            const remainingLimit = (insurance.coverage_limit || 999999) - insurance.total_claimed;
            const remainingPerVisit = (insurance.coverage_limit_per_visit || 999999) - claimAmount;

            if (claimAmount > remainingLimit) {
                return {
                    is_covered: false,
                    reason: 'Claim amount exceeds annual coverage limit',
                    max_coverage: insurance.coverage_limit,
                    remaining_limit: remainingLimit
                };
            }

            if (claimAmount > remainingPerVisit) {
                return {
                    is_covered: false,
                    reason: 'Claim amount exceeds per-visit coverage limit',
                    max_coverage_per_visit: insurance.coverage_limit_per_visit,
                    remaining_per_visit: remainingPerVisit
                };
            }

            return {
                is_covered: true,
                coverage_limit: insurance.coverage_limit,
                coverage_limit_per_visit: insurance.coverage_limit_per_visit,
                remaining_limit: remainingLimit,
                remaining_per_visit: remainingPerVisit
            };
        } catch (error) {
            logger.error('Error in validateCoverageLimit', { error: error.message, staffId, patientId, providerId });
            throw error;
        }
    },

    /**
     * Get related invoice
     */
    async getRelatedInvoice(staffId, invoiceId) {
        try {
            const result = await db.query(`
                SELECT i.*, 
                       CONCAT(pat.first_name, ' ', pat.last_name) as patient_name
                FROM invoices i
                JOIN patients pat ON i.patient_id = pat.id
                WHERE i.id = $1
            `, [invoiceId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getRelatedInvoice', { error: error.message, staffId, invoiceId });
            throw error;
        }
    },

    /**
     * Create insurance claim
     */
    async createClaim(staffId, claimData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate claim number
            const claimNumber = await this.generateClaimNumber();

            const query = `
                INSERT INTO insurance_claims (
                    id, claim_number, patient_id, invoice_id, insurance_provider_id,
                    policy_number, claim_amount, pre_authorization_number, notes,
                    documents, status, created_by, ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft',
                    $10, $11, $12, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                claimNumber,
                claimData.patient_id,
                claimData.invoice_id,
                claimData.insurance_provider_id,
                claimData.policy_number,
                claimData.claim_amount,
                claimData.pre_authorization_number,
                claimData.notes,
                claimData.documents ? JSON.stringify(claimData.documents) : null,
                claimData.created_by,
                claimData.ip_address,
                claimData.user_agent
            ];

            const result = await client.query(query, values);

            // Log claim creation
            await client.query(`
                INSERT INTO claim_history (
                    id, claim_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'created', $2, $3, $4
                )
            `, [result.rows[0].id, claimData.created_by, new Date(), claimData.notes]);

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
     * Generate claim number
     */
    async generateClaimNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM insurance_claims
                WHERE claim_number LIKE $1
            `, [`CLM-${year}${month}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `CLM-${year}${month}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateClaimNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Update claim
     */
    async updateClaim(staffId, claimId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['claim_amount', 'notes', 'documents'];

            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    if (key === 'documents') {
                        setClause.push(`${key} = $${paramIndex}::jsonb`);
                    } else {
                        setClause.push(`${key} = $${paramIndex}`);
                    }
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            setClause.push(`updated_by = $${paramIndex}`);
            values.push(updateData.updated_by);
            paramIndex++;
            values.push(claimId);

            const query = `
                UPDATE insurance_claims 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND status = 'draft'
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Claim not found or cannot be updated');
            }

            // Log update
            await client.query(`
                INSERT INTO claim_history (
                    id, claim_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'updated', $2, $3, $4
                )
            `, [claimId, updateData.updated_by, new Date(), updateData.notes]);

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
     * Submit claim
     */
    async submitClaim(staffId, claimId, submitData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE insurance_claims 
                SET status = 'submitted',
                    submitted_by = $1,
                    submitted_at = $2,
                    submission_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'draft'
                RETURNING *
            `;

            const values = [
                submitData.submitted_by,
                submitData.submitted_at,
                submitData.notes,
                claimId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Claim not found or cannot be submitted');
            }

            // Log submission
            await client.query(`
                INSERT INTO claim_history (
                    id, claim_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'submitted', $2, $3, $4
                )
            `, [claimId, submitData.submitted_by, submitData.submitted_at, submitData.notes]);

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
     * Track claim (update status)
     */
    async trackClaim(staffId, claimId, trackData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            let statusUpdate = '';
            let values = [];

            switch (trackData.status) {
                case 'processing':
                    statusUpdate = `status = 'processing'`;
                    values = [claimId];
                    break;
                case 'approved':
                    statusUpdate = `status = 'approved', approved_by = $1, approved_at = $2, approval_notes = $3`;
                    values = [trackData.updated_by, trackData.updated_at, trackData.notes, claimId];
                    break;
                case 'rejected':
                    statusUpdate = `status = 'rejected', rejected_by = $1, rejected_at = $2, rejection_reason = $3, rejection_notes = $4`;
                    values = [trackData.updated_by, trackData.updated_at, trackData.notes, trackData.notes, claimId];
                    break;
                case 'paid':
                    statusUpdate = `status = 'paid', paid_amount = $1, paid_at = $2, paid_by = $3, payment_notes = $4`;
                    values = [trackData.amount_approved || 0, trackData.updated_at, trackData.updated_by, trackData.notes, claimId];
                    break;
                default:
                    throw new Error('Invalid status transition');
            }

            const query = `
                UPDATE insurance_claims 
                SET ${statusUpdate},
                    updated_at = NOW()
                WHERE id = $${values.length} AND status != 'paid'
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Claim not found or cannot be updated');
            }

            // Log status change
            await client.query(`
                INSERT INTO claim_history (
                    id, claim_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5
                )
            `, [claimId, trackData.status, trackData.updated_by, trackData.updated_at, trackData.notes]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = insuranceClaimService;