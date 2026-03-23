/**
 * ======================================================================
 * FILE: backend/src/models/clinical/TransportRequest.js
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
 * TransportRequest model for database operations.
 * Handles all transport requests for patients, samples, equipment, and documents.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: transport_requests
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - request_number: string (unique)
 * - request_type: enum (patient, sample, equipment, document)
 * - requested_by: uuid
 * - requested_at: timestamp
 * - department_id: uuid
 * - priority: enum (low, medium, high, urgent)
 * - is_emergency: boolean
 * - patient_id: uuid
 * - from_location: string
 * - to_location: string
 * - item_type: string
 * - item_id: uuid
 * - quantity: integer
 * - assigned_to: uuid
 * - assigned_at: timestamp
 * - accepted_at: timestamp
 * - started_at: timestamp
 * - completed_at: timestamp
 * - status: enum (pending, accepted, in-progress, completed, cancelled)
 * - special_instructions: text
 * - completion_notes: text
 * - cancellation_reason: text
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

const TransportRequest = {
    /**
     * Table name
     */
    tableName: 'transport_requests',

    /**
     * Valid request types
     */
    validRequestTypes: ['patient', 'sample', 'equipment', 'document'],

    /**
     * Valid priorities
     */
    validPriorities: ['low', 'medium', 'high', 'urgent'],

    /**
     * Valid statuses
     */
    validStatuses: ['pending', 'accepted', 'in-progress', 'completed', 'cancelled'],

    /**
     * Generate request number
     * @returns {Promise<string>} Generated request number
     */
    async generateRequestNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM transport_requests
                WHERE request_number LIKE $1
            `;
            const result = await db.query(query, [`TR-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `TR-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating request number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find transport request by ID
     * @param {string} id - Transport request UUID
     * @returns {Promise<Object|null>} Transport request object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    tr.id, tr.request_number, tr.request_type,
                    tr.requested_by, tr.requested_at, tr.department_id,
                    tr.priority, tr.is_emergency,
                    tr.patient_id, tr.from_location, tr.to_location,
                    tr.item_type, tr.item_id, tr.quantity,
                    tr.assigned_to, tr.assigned_at,
                    tr.accepted_at, tr.started_at, tr.completed_at,
                    tr.status, tr.special_instructions,
                    tr.completion_notes, tr.cancellation_reason,
                    tr.created_at, tr.updated_at,
                    req.username as requested_by_name,
                    d.name as department_name,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    ass.username as assigned_to_name,
                    u.username as created_by_name
                FROM transport_requests tr
                LEFT JOIN users req ON tr.requested_by = req.id
                LEFT JOIN departments d ON tr.department_id = d.id
                LEFT JOIN patients p ON tr.patient_id = p.id
                LEFT JOIN users ass ON tr.assigned_to = ass.id
                LEFT JOIN users u ON tr.created_by = u.id
                WHERE tr.id = $1 AND tr.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Transport request found by ID', { requestId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding transport request by ID', {
                error: error.message,
                requestId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find transport request by number
     * @param {string} requestNumber - Request number
     * @returns {Promise<Object|null>} Transport request object or null
     */
    async findByNumber(requestNumber) {
        try {
            const query = `
                SELECT 
                    tr.id, tr.request_number, tr.request_type,
                    tr.requested_by, tr.requested_at,
                    tr.priority, tr.is_emergency,
                    tr.from_location, tr.to_location,
                    tr.assigned_to, tr.status,
                    tr.created_at
                FROM transport_requests tr
                WHERE tr.request_number = $1 AND tr.is_deleted = false
            `;

            const result = await db.query(query, [requestNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Transport request found by number', { requestNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding transport request by number', {
                error: error.message,
                requestNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find transport requests by status
     * @param {string} status - Request status
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of transport requests
     */
    async findByStatus(status, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    tr.id, tr.request_number, tr.request_type,
                    tr.requested_by, tr.requested_at,
                    tr.priority, tr.is_emergency,
                    tr.from_location, tr.to_location,
                    tr.assigned_to, tr.status,
                    tr.created_at,
                    req.username as requested_by_name
                FROM transport_requests tr
                LEFT JOIN users req ON tr.requested_by = req.id
                WHERE tr.status = $1 AND tr.is_deleted = false
                ORDER BY 
                    CASE tr.priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    tr.requested_at ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            logger.debug('Transport requests found by status', {
                status,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding transport requests by status', {
                error: error.message,
                status
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find pending transport requests
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of pending requests
     */
    async getPending(options = {}) {
        return this.findByStatus('pending', options);
    },

    /**
     * Find active transport requests (accepted or in-progress)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of active requests
     */
    async getActive(options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    tr.id, tr.request_number, tr.request_type,
                    tr.requested_by, tr.requested_at,
                    tr.priority, tr.is_emergency,
                    tr.from_location, tr.to_location,
                    tr.assigned_to, tr.status,
                    tr.assigned_at, tr.accepted_at,
                    tr.started_at, tr.created_at,
                    req.username as requested_by_name,
                    ass.username as assigned_to_name
                FROM transport_requests tr
                LEFT JOIN users req ON tr.requested_by = req.id
                LEFT JOIN users ass ON tr.assigned_to = ass.id
                WHERE tr.status IN ('accepted', 'in-progress')
                    AND tr.is_deleted = false
                ORDER BY 
                    CASE tr.priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    tr.requested_at ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Active transport requests retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active transport requests', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new transport request
     * @param {Object} requestData - Transport request data
     * @returns {Promise<Object>} Created transport request
     */
    async create(requestData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (!this.validRequestTypes.includes(requestData.request_type)) {
                throw new Error(`Invalid request type. Must be one of: ${this.validRequestTypes.join(', ')}`);
            }

            if (requestData.priority && !this.validPriorities.includes(requestData.priority)) {
                throw new Error(`Invalid priority. Must be one of: ${this.validPriorities.join(', ')}`);
            }

            const requestNumber = await this.generateRequestNumber();

            const query = `
                INSERT INTO transport_requests (
                    id, request_number, request_type,
                    requested_by, requested_at, department_id,
                    priority, is_emergency,
                    patient_id, from_location, to_location,
                    item_type, item_id, quantity,
                    status, special_instructions,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, COALESCE($4, NOW()), $5,
                    COALESCE($6, 'medium'), COALESCE($7, false),
                    $8, $9, $10,
                    $11, $12, $13,
                    'pending', $14,
                    $15, NOW(), NOW()
                )
                RETURNING 
                    id, request_number, request_type,
                    requested_by, requested_at, priority,
                    is_emergency, from_location, to_location,
                    status, created_at
            `;

            const values = [
                requestNumber,
                requestData.request_type,
                requestData.requested_by,
                requestData.requested_at || null,
                requestData.department_id || null,
                requestData.priority,
                requestData.is_emergency,
                requestData.patient_id || null,
                requestData.from_location,
                requestData.to_location,
                requestData.item_type || null,
                requestData.item_id || null,
                requestData.quantity || null,
                requestData.special_instructions || null,
                requestData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Transport request created successfully', {
                requestId: result.rows[0].id,
                requestNumber: result.rows[0].request_number,
                requestType: requestData.request_type,
                requestedBy: requestData.requested_by
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating transport request', {
                error: error.message,
                requestedBy: requestData.requested_by
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Assign transport request to staff
     * @param {string} id - Transport request ID
     * @param {string} assignedTo - Staff user ID
     * @param {string} assignedBy - User who assigned
     * @returns {Promise<Object>} Updated transport request
     */
    async assign(id, assignedTo, assignedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const request = await this.findById(id);
            if (!request) {
                throw new Error('Transport request not found');
            }

            if (request.status !== 'pending') {
                throw new Error(`Cannot assign request with status: ${request.status}`);
            }

            const query = `
                UPDATE transport_requests 
                SET assigned_to = $1,
                    assigned_at = NOW(),
                    status = 'accepted',
                    updated_at = NOW(),
                    updated_by = $2
                WHERE id = $3 AND is_deleted = false
                RETURNING 
                    id, request_number, assigned_to,
                    assigned_at, status
            `;

            const result = await client.query(query, [assignedTo, assignedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found');
            }

            await db.commitTransaction(client);

            logger.info('Transport request assigned', {
                requestId: id,
                assignedTo,
                assignedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error assigning transport request', {
                error: error.message,
                requestId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Accept transport request (staff accepts assignment)
     * @param {string} id - Transport request ID
     * @param {string} acceptedBy - Staff user ID
     * @returns {Promise<Object>} Updated transport request
     */
    async accept(id, acceptedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const request = await this.findById(id);
            if (!request) {
                throw new Error('Transport request not found');
            }

            if (request.status !== 'accepted') {
                throw new Error(`Cannot accept request with status: ${request.status}`);
            }

            if (request.assigned_to !== acceptedBy) {
                throw new Error('Only assigned staff can accept this request');
            }

            const query = `
                UPDATE transport_requests 
                SET accepted_at = NOW(),
                    status = 'in-progress',
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING 
                    id, request_number, accepted_at,
                    status
            `;

            const result = await client.query(query, [id]);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found');
            }

            await db.commitTransaction(client);

            logger.info('Transport request accepted', {
                requestId: id,
                acceptedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error accepting transport request', {
                error: error.message,
                requestId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Start transport request
     * @param {string} id - Transport request ID
     * @param {string} startedBy - Staff user ID
     * @returns {Promise<Object>} Updated transport request
     */
    async start(id, startedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const request = await this.findById(id);
            if (!request) {
                throw new Error('Transport request not found');
            }

            if (request.status !== 'in-progress') {
                throw new Error(`Cannot start request with status: ${request.status}`);
            }

            const query = `
                UPDATE transport_requests 
                SET started_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING 
                    id, request_number, started_at,
                    status
            `;

            const result = await client.query(query, [id]);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found');
            }

            await db.commitTransaction(client);

            logger.info('Transport request started', {
                requestId: id,
                startedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error starting transport request', {
                error: error.message,
                requestId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Complete transport request
     * @param {string} id - Transport request ID
     * @param {string} completedBy - Staff user ID
     * @param {string} completionNotes - Notes about completion
     * @returns {Promise<Object>} Updated transport request
     */
    async complete(id, completedBy, completionNotes = null) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const request = await this.findById(id);
            if (!request) {
                throw new Error('Transport request not found');
            }

            if (request.status !== 'in-progress' && request.status !== 'accepted') {
                throw new Error(`Cannot complete request with status: ${request.status}`);
            }

            if (!request.started_at && request.status === 'accepted') {
                await this.start(id, completedBy);
            }

            const query = `
                UPDATE transport_requests 
                SET completed_at = NOW(),
                    status = 'completed',
                    completion_notes = COALESCE($1, completion_notes),
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING 
                    id, request_number, completed_at,
                    status, completion_notes
            `;

            const result = await client.query(query, [completionNotes, id]);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found');
            }

            await db.commitTransaction(client);

            logger.info('Transport request completed', {
                requestId: id,
                completedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error completing transport request', {
                error: error.message,
                requestId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Cancel transport request
     * @param {string} id - Transport request ID
     * @param {string} cancelledBy - User who cancelled
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Updated transport request
     */
    async cancel(id, cancelledBy, reason) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const request = await this.findById(id);
            if (!request) {
                throw new Error('Transport request not found');
            }

            if (request.status === 'completed') {
                throw new Error('Cannot cancel completed request');
            }

            if (!reason) {
                throw new Error('Cancellation reason is required');
            }

            const query = `
                UPDATE transport_requests 
                SET status = 'cancelled',
                    cancellation_reason = $1,
                    updated_at = NOW(),
                    updated_by = $2
                WHERE id = $3 AND is_deleted = false
                RETURNING 
                    id, request_number, status,
                    cancellation_reason
            `;

            const result = await client.query(query, [reason, cancelledBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found');
            }

            await db.commitTransaction(client);

            logger.info('Transport request cancelled', {
                requestId: id,
                cancelledBy,
                reason
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cancelling transport request', {
                error: error.message,
                requestId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get transport request statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND requested_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(*) FILTER (WHERE request_type = 'patient') as patient_transports,
                    COUNT(*) FILTER (WHERE request_type = 'sample') as sample_transports,
                    COUNT(*) FILTER (WHERE request_type = 'equipment') as equipment_transports,
                    COUNT(*) FILTER (WHERE request_type = 'document') as document_transports,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
                    COUNT(*) FILTER (WHERE priority = 'high') as high,
                    COUNT(*) FILTER (WHERE priority = 'medium') as medium,
                    COUNT(*) FILTER (WHERE priority = 'low') as low,
                    COUNT(*) FILTER (WHERE is_emergency = true) as emergency,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
                    COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    AVG(EXTRACT(EPOCH FROM (completed_at - requested_at))/60)::numeric(10,2) as avg_completion_time_minutes
                FROM transport_requests
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Transport request statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting transport request statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete transport request
     * @param {string} id - Transport request ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE transport_requests 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found');
            }

            await db.commitTransaction(client);

            logger.info('Transport request soft deleted', {
                requestId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting transport request', {
                error: error.message,
                requestId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = TransportRequest;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */