/**
 * ======================================================================
 * FILE: backend/src/models/DeletionRequest.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Deletion request model for GDPR compliance (Right to be Forgotten).
 * Manages user/patient requests for data deletion.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * TABLE: deletion_requests
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - requestor_type: string (patient/user)
 * - requestor_id: UUID (foreign key to patients.id or users.id)
 * - request_reason: text
 * - request_status: string (pending/approved/rejected/processing/completed)
 * - request_date: timestamp
 * - reviewed_by: UUID (foreign key to users.id)
 * - reviewed_date: timestamp
 * - review_notes: text
 * - completion_date: timestamp
 * - deletion_details: jsonb
 * - consent_withdrawn: boolean
 * - data_exported: boolean
 * - export_file_url: text
 * - created_at: timestamp
 * - updated_at: timestamp
 * 
 * STATUS FLOW:
 * pending → approved → processing → completed
 *    ↓          ↓
 * rejected    rejected
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Valid request statuses
 */
const REQUEST_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

/**
 * Valid requestor types
 */
const REQUESTOR_TYPES = {
    PATIENT: 'patient',
    USER: 'user'
};

/**
 * DeletionRequest model with database operations
 */
const DeletionRequest = {
    /**
     * Table name
     */
    tableName: 'deletion_requests',

    /**
     * Find request by ID
     * @param {string} id - Request UUID
     * @returns {Promise<Object>} Deletion request
     */
    async findById(id) {
        try {
            const query = `
                SELECT dr.*,
                       CASE 
                           WHEN dr.requestor_type = 'patient' THEN p.first_name || ' ' || p.last_name
                           WHEN dr.requestor_type = 'user' THEN u.username
                       END as requestor_name,
                       u_review.username as reviewer_name
                FROM deletion_requests dr
                LEFT JOIN patients p ON dr.requestor_type = 'patient' AND dr.requestor_id = p.id
                LEFT JOIN users u ON dr.requestor_type = 'user' AND dr.requestor_id = u.id
                LEFT JOIN users u_review ON dr.reviewed_by = u_review.id
                WHERE dr.id = $1
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('Deletion request found by ID', { requestId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding deletion request by ID', { 
                error: error.message,
                requestId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all requests for a requestor
     * @param {string} requestorId - Requestor UUID
     * @param {string} requestorType - Type (patient/user)
     * @returns {Promise<Array>} List of requests
     */
    async getByRequestor(requestorId, requestorType) {
        try {
            const query = `
                SELECT * FROM deletion_requests
                WHERE requestor_id = $1 AND requestor_type = $2
                ORDER BY created_at DESC
            `;
            
            const result = await db.query(query, [requestorId, requestorType]);
            
            logger.debug('Deletion requests retrieved for requestor', { 
                requestorId,
                requestorType,
                count: result.rows.length 
            });
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting deletion requests by requestor', { 
                error: error.message,
                requestorId 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending requests
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of pending requests
     */
    async getPending(options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT dr.*,
                       CASE 
                           WHEN dr.requestor_type = 'patient' THEN p.first_name || ' ' || p.last_name
                           WHEN dr.requestor_type = 'user' THEN u.username
                       END as requestor_name,
                       p.email as patient_email,
                       u.email as user_email
                FROM deletion_requests dr
                LEFT JOIN patients p ON dr.requestor_type = 'patient' AND dr.requestor_id = p.id
                LEFT JOIN users u ON dr.requestor_type = 'user' AND dr.requestor_id = u.id
                WHERE dr.request_status = 'pending'
                ORDER BY dr.request_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting pending deletion requests', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new deletion request
     * @param {Object} requestData - Request data
     * @returns {Promise<Object>} Created request
     */
    async create(requestData) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Check if there's already a pending request
            const existing = await client.query(`
                SELECT id FROM deletion_requests
                WHERE requestor_id = $1 
                    AND requestor_type = $2 
                    AND request_status IN ('pending', 'processing')
            `, [requestData.requestor_id, requestData.requestor_type]);

            if (existing.rows.length > 0) {
                throw new Error('A pending deletion request already exists');
            }

            const query = `
                INSERT INTO deletion_requests (
                    requestor_type, requestor_id, request_reason,
                    request_status, request_date, consent_withdrawn,
                    data_exported, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, NOW(), NOW())
                RETURNING *
            `;

            const values = [
                requestData.requestor_type,
                requestData.requestor_id,
                requestData.request_reason || null,
                REQUEST_STATUS.PENDING,
                requestData.consent_withdrawn || false,
                requestData.data_exported || false
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Deletion request created', { 
                requestId: result.rows[0].id,
                requestorId: requestData.requestor_id,
                requestorType: requestData.requestor_type
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating deletion request', { 
                error: error.message,
                requestorId: requestData.requestor_id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Approve deletion request
     * @param {string} id - Request ID
     * @param {string} reviewerId - User ID approving
     * @param {string} notes - Review notes
     * @returns {Promise<Object>} Updated request
     */
    async approve(id, reviewerId, notes = null) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            // Check if request exists and is pending
            const check = await client.query(`
                SELECT * FROM deletion_requests
                WHERE id = $1 AND request_status = 'pending'
            `, [id]);

            if (check.rows.length === 0) {
                throw new Error('Pending deletion request not found');
            }

            const query = `
                UPDATE deletion_requests 
                SET request_status = $1,
                    reviewed_by = $2,
                    reviewed_date = NOW(),
                    review_notes = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                REQUEST_STATUS.APPROVED,
                reviewerId,
                notes,
                id
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Deletion request approved', { 
                requestId: id,
                reviewerId,
                requestorId: result.rows[0].requestor_id
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error approving deletion request', { 
                error: error.message,
                requestId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Reject deletion request
     * @param {string} id - Request ID
     * @param {string} reviewerId - User ID rejecting
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated request
     */
    async reject(id, reviewerId, reason) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            if (!reason) {
                throw new Error('Rejection reason is required');
            }

            const query = `
                UPDATE deletion_requests 
                SET request_status = $1,
                    reviewed_by = $2,
                    reviewed_date = NOW(),
                    review_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND request_status = 'pending'
                RETURNING *
            `;

            const values = [
                REQUEST_STATUS.REJECTED,
                reviewerId,
                reason,
                id
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Pending deletion request not found');
            }

            await db.commitTransaction(client);

            logger.info('Deletion request rejected', { 
                requestId: id,
                reviewerId,
                reason
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error rejecting deletion request', { 
                error: error.message,
                requestId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Start processing deletion
     * @param {string} id - Request ID
     * @returns {Promise<Object>} Updated request
     */
    async startProcessing(id) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE deletion_requests 
                SET request_status = $1,
                    updated_at = NOW()
                WHERE id = $2 AND request_status = 'approved'
                RETURNING *
            `;

            const values = [
                REQUEST_STATUS.PROCESSING,
                id
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Approved deletion request not found');
            }

            await db.commitTransaction(client);

            logger.info('Deletion request processing started', { 
                requestId: id 
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error starting deletion processing', { 
                error: error.message,
                requestId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Complete deletion request
     * @param {string} id - Request ID
     * @param {Object} details - Deletion details
     * @returns {Promise<Object>} Updated request
     */
    async complete(id, details = {}) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE deletion_requests 
                SET request_status = $1,
                    completion_date = NOW(),
                    deletion_details = $2,
                    updated_at = NOW()
                WHERE id = $3 AND request_status = 'processing'
                RETURNING *
            `;

            const values = [
                REQUEST_STATUS.COMPLETED,
                JSON.stringify(details),
                id
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Processing deletion request not found');
            }

            await db.commitTransaction(client);

            logger.info('Deletion request completed', { 
                requestId: id,
                details
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error completing deletion request', { 
                error: error.message,
                requestId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Cancel deletion request
     * @param {string} id - Request ID
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Updated request
     */
    async cancel(id, reason) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE deletion_requests 
                SET request_status = $1,
                    review_notes = $2,
                    updated_at = NOW()
                WHERE id = $3 AND request_status IN ('pending', 'approved')
                RETURNING *
            `;

            const values = [
                REQUEST_STATUS.CANCELLED,
                reason,
                id
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Active deletion request not found');
            }

            await db.commitTransaction(client);

            logger.info('Deletion request cancelled', { 
                requestId: id,
                reason
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cancelling deletion request', { 
                error: error.message,
                requestId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update export information
     * @param {string} id - Request ID
     * @param {string} exportUrl - URL of exported data
     * @returns {Promise<Object>} Updated request
     */
    async updateExportInfo(id, exportUrl) {
        try {
            const query = `
                UPDATE deletion_requests 
                SET data_exported = true,
                    export_file_url = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `;

            const result = await db.query(query, [exportUrl, id]);

            if (result.rows.length === 0) {
                throw new Error('Deletion request not found');
            }

            logger.info('Export info updated for deletion request', { 
                requestId: id,
                exportUrl
            });
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating export info', { 
                error: error.message,
                requestId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get request statistics
     * @returns {Promise<Object>} Statistics
     */
    async getStats() {
        try {
            const result = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE request_status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE request_status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE request_status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE request_status = 'processing') as processing,
                    COUNT(*) FILTER (WHERE request_status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE request_status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE requestor_type = 'patient') as patient_requests,
                    COUNT(*) FILTER (WHERE requestor_type = 'user') as user_requests,
                    AVG(EXTRACT(EPOCH FROM (completion_date - request_date))/86400)::numeric(10,2) as avg_days_to_complete,
                    MAX(created_at) as latest_request
                FROM deletion_requests
            `);

            // Get monthly trend
            const monthly = await db.query(`
                SELECT 
                    DATE_TRUNC('month', request_date) as month,
                    COUNT(*) as count
                FROM deletion_requests
                WHERE request_date > NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', request_date)
                ORDER BY month DESC
            `);

            return {
                overview: result.rows[0],
                monthly_trend: monthly.rows
            };
        } catch (error) {
            logger.error('Error getting deletion request statistics', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get requests by status
     * @param {string} status - Request status
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of requests
     */
    async getByStatus(status, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT dr.*,
                       CASE 
                           WHEN dr.requestor_type = 'patient' THEN p.first_name || ' ' || p.last_name
                           WHEN dr.requestor_type = 'user' THEN u.username
                       END as requestor_name,
                       p.email as patient_email,
                       u.email as user_email
                FROM deletion_requests dr
                LEFT JOIN patients p ON dr.requestor_type = 'patient' AND dr.requestor_id = p.id
                LEFT JOIN users u ON dr.requestor_type = 'user' AND dr.requestor_id = u.id
                WHERE dr.request_status = $1
                ORDER BY dr.request_date DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting deletion requests by status', { 
                error: error.message,
                status 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search deletion requests
     * @param {string} searchTerm - Search term
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of requests
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT dr.*,
                       CASE 
                           WHEN dr.requestor_type = 'patient' THEN p.first_name || ' ' || p.last_name
                           WHEN dr.requestor_type = 'user' THEN u.username
                       END as requestor_name,
                       p.email as patient_email,
                       u.email as user_email
                FROM deletion_requests dr
                LEFT JOIN patients p ON dr.requestor_type = 'patient' AND dr.requestor_id = p.id
                LEFT JOIN users u ON dr.requestor_type = 'user' AND dr.requestor_id = u.id
                WHERE 
                    p.first_name ILIKE $1 OR
                    p.last_name ILIKE $1 OR
                    u.username ILIKE $1 OR
                    p.email ILIKE $1 OR
                    u.email ILIKE $1 OR
                    dr.request_reason ILIKE $1 OR
                    dr.review_notes ILIKE $1
                ORDER BY dr.request_date DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [`%${searchTerm}%`, limit, offset]);
            
            return result.rows;
        } catch (error) {
            logger.error('Error searching deletion requests', { 
                error: error.message,
                searchTerm 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expired pending requests
     * @param {number} days - Days threshold
     * @returns {Promise<Array>} List of expired requests
     */
    async getExpiredPending(days = 30) {
        try {
            const query = `
                SELECT * FROM deletion_requests
                WHERE request_status = 'pending'
                    AND request_date < NOW() - $1::interval
                ORDER BY request_date ASC
            `;

            const result = await db.query(query, [`${days} days`]);
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting expired pending requests', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Constants
     */
    STATUS: REQUEST_STATUS,
    TYPES: REQUESTOR_TYPES
};

module.exports = DeletionRequest;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Patient requests data deletion
 * const request = await DeletionRequest.create({
 *     requestor_type: 'patient',
 *     requestor_id: patientId,
 *     request_reason: 'No longer using the service',
 *     consent_withdrawn: true
 * });
 * 
 * // Admin reviews request
 * await DeletionRequest.approve(requestId, adminUserId, 'Request approved');
 * 
 * // Start processing
 * await DeletionRequest.startProcessing(requestId);
 * 
 * // Complete deletion
 * await DeletionRequest.complete(requestId, {
 *     tables_affected: ['patients', 'appointments'],
 *     records_deleted: 150
 * });
 * 
 * // Get pending requests
 * const pending = await DeletionRequest.getPending({ limit: 10 });
 * 
 * // Get statistics
 * const stats = await DeletionRequest.getStats();
 * 
 * // Search requests
 * const results = await DeletionRequest.search('koushal@example.com');
 * 
 * ======================================================================
 */