/**
 * ======================================================================
 * FILE: backend/src/models/billing/ClaimTracking.js
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
 * ClaimTracking model for database operations.
 * Tracks status updates for insurance claims throughout the claim lifecycle.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: claim_tracking
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - claim_id: UUID (foreign key to insurance_claims)
 * - status: enum (submitted, under_review, additional_info_required, approved, rejected, paid)
 * - status_date: timestamp
 * - status_description: text
 * - updated_by: uuid
 * - attachment_urls: text[]
 * - notes: text
 * - metadata: jsonb
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

const ClaimTracking = {
    /**
     * Table name
     */
    tableName: 'claim_tracking',

    /**
     * Valid status values
     */
    validStatuses: ['submitted', 'under_review', 'additional_info_required', 'approved', 'rejected', 'paid'],

    /**
     * Find tracking record by ID
     * @param {string} id - Tracking record UUID
     * @returns {Promise<Object|null>} Tracking record object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ct.id, ct.claim_id, ct.status, ct.status_date,
                    ct.status_description, ct.updated_by,
                    ct.attachment_urls, ct.notes, ct.metadata,
                    ct.created_at,
                    ic.claim_number, ic.patient_id,
                    u.username as updated_by_name,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM claim_tracking ct
                JOIN insurance_claims ic ON ct.claim_id = ic.id
                LEFT JOIN users u ON ct.updated_by = u.id
                LEFT JOIN patients p ON ic.patient_id = p.id
                WHERE ct.id = $1 AND ct.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Claim tracking record found by ID', { trackingId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding claim tracking record by ID', {
                error: error.message,
                trackingId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find tracking records by claim ID
     * @param {string} claimId - Claim UUID
     * @returns {Promise<Array>} List of tracking records
     */
    async findByClaimId(claimId) {
        try {
            const query = `
                SELECT 
                    id, claim_id, status, status_date,
                    status_description, updated_by,
                    attachment_urls, notes, metadata,
                    created_at,
                    u.username as updated_by_name
                FROM claim_tracking ct
                LEFT JOIN users u ON ct.updated_by = u.id
                WHERE ct.claim_id = $1 AND ct.is_deleted = false
                ORDER BY ct.status_date DESC
            `;

            const result = await db.query(query, [claimId]);

            logger.debug('Claim tracking records found by claim ID', {
                claimId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding claim tracking records by claim ID', {
                error: error.message,
                claimId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get latest tracking record for a claim
     * @param {string} claimId - Claim UUID
     * @returns {Promise<Object|null>} Latest tracking record or null
     */
    async getLatest(claimId) {
        try {
            const query = `
                SELECT 
                    id, claim_id, status, status_date,
                    status_description, updated_by,
                    attachment_urls, notes, metadata,
                    created_at
                FROM claim_tracking
                WHERE claim_id = $1 AND is_deleted = false
                ORDER BY status_date DESC
                LIMIT 1
            `;

            const result = await db.query(query, [claimId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Latest claim tracking record retrieved', { claimId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting latest claim tracking record', {
                error: error.message,
                claimId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new claim tracking record
     * @param {Object} trackingData - Tracking data
     * @returns {Promise<Object>} Created tracking record
     */
    async create(trackingData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (trackingData.status && !this.validStatuses.includes(trackingData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const query = `
                INSERT INTO claim_tracking (
                    id, claim_id, status, status_date,
                    status_description, updated_by,
                    attachment_urls, notes, metadata,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, COALESCE($3, NOW()),
                    $4, $5,
                    $6, $7, $8,
                    NOW()
                )
                RETURNING 
                    id, claim_id, status, status_date,
                    status_description, created_at
            `;

            const values = [
                trackingData.claim_id,
                trackingData.status,
                trackingData.status_date || null,
                trackingData.status_description || null,
                trackingData.updated_by || null,
                trackingData.attachment_urls || null,
                trackingData.notes || null,
                trackingData.metadata || null
            ];

            const result = await client.query(query, values);

            // Also update the claim's status and decision_date if applicable
            if (trackingData.status === 'approved' || trackingData.status === 'rejected') {
                const claimUpdateQuery = `
                    UPDATE insurance_claims 
                    SET claim_status = $1,
                        decision_date = CURRENT_DATE,
                        updated_at = NOW()
                    WHERE id = $2 AND is_deleted = false
                `;
                await client.query(claimUpdateQuery, [trackingData.status, trackingData.claim_id]);
            } else if (trackingData.status === 'paid') {
                const claimUpdateQuery = `
                    UPDATE insurance_claims 
                    SET claim_status = 'approved',
                        updated_at = NOW()
                    WHERE id = $1 AND is_deleted = false
                `;
                await client.query(claimUpdateQuery, [trackingData.claim_id]);
            } else {
                const claimUpdateQuery = `
                    UPDATE insurance_claims 
                    SET claim_status = $1,
                        updated_at = NOW()
                    WHERE id = $2 AND is_deleted = false
                `;
                await client.query(claimUpdateQuery, [trackingData.status, trackingData.claim_id]);
            }

            await db.commitTransaction(client);

            logger.info('Claim tracking record created', {
                trackingId: result.rows[0].id,
                claimId: trackingData.claim_id,
                status: trackingData.status
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating claim tracking record', {
                error: error.message,
                claimId: trackingData.claim_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update claim tracking record (typically not needed, but included for completeness)
     * @param {string} id - Tracking record ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated tracking record
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'status_description', 'attachment_urls', 'notes', 'metadata'
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

            values.push(id);

            const query = `
                UPDATE claim_tracking 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, claim_id, status, status_date,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Claim tracking record not found');
            }

            await db.commitTransaction(client);

            logger.info('Claim tracking record updated', {
                trackingId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating claim tracking record', {
                error: error.message,
                trackingId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get claim tracking statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_tracking_records,
                    COUNT(DISTINCT claim_id) as unique_claims,
                    COUNT(*) FILTER (WHERE status = 'submitted') as submitted,
                    COUNT(*) FILTER (WHERE status = 'under_review') as under_review,
                    COUNT(*) FILTER (WHERE status = 'additional_info_required') as info_required,
                    COUNT(*) FILTER (WHERE status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE status = 'paid') as paid,
                    AVG(EXTRACT(EPOCH FROM (status_date - created_at))/86400)::numeric(10,2) as avg_days_in_status
                FROM claim_tracking
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Claim tracking statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting claim tracking statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get tracking timeline for a claim (ordered by date)
     * @param {string} claimId - Claim UUID
     * @returns {Promise<Array>} Timeline of tracking records
     */
    async getTimeline(claimId) {
        try {
            const query = `
                SELECT 
                    id, status, status_date,
                    status_description, notes,
                    u.username as updated_by_name,
                    created_at
                FROM claim_tracking ct
                LEFT JOIN users u ON ct.updated_by = u.id
                WHERE ct.claim_id = $1 AND ct.is_deleted = false
                ORDER BY ct.status_date ASC
            `;

            const result = await db.query(query, [claimId]);

            logger.debug('Claim timeline retrieved', {
                claimId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting claim timeline', {
                error: error.message,
                claimId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete claim tracking record
     * @param {string} id - Tracking record ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE claim_tracking 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Claim tracking record not found');
            }

            await db.commitTransaction(client);

            logger.info('Claim tracking record soft deleted', {
                trackingId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting claim tracking record', {
                error: error.message,
                trackingId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = ClaimTracking;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */