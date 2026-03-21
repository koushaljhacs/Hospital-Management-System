/**
 * ======================================================================
 * FILE: backend/src/services/staff/transportService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Ground Staff transport service - Handles business logic for transport requests.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-47] Transport requests require driver assignment
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const transportService = {
    /**
     * Get all transport requests
     */
    async getAllRequests(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, status, request_type, priority, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT tr.*, 
                       CONCAT(d.first_name, ' ', d.last_name) as driver_name,
                       CONCAT(req.first_name, ' ', req.last_name) as requested_by_name,
                       CONCAT(acc.first_name, ' ', acc.last_name) as accepted_by_name,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name
                FROM transport_requests tr
                LEFT JOIN employees d ON tr.driver_id = d.id
                LEFT JOIN users req ON tr.requested_by = req.id
                LEFT JOIN users acc ON tr.accepted_by = acc.id
                LEFT JOIN patients p ON tr.patient_id = p.id
                WHERE tr.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND tr.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (request_type) {
                query += ` AND tr.request_type = $${paramIndex}`;
                values.push(request_type);
                paramIndex++;
            }

            if (priority) {
                query += ` AND tr.priority = $${paramIndex}`;
                values.push(priority);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND tr.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND tr.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY 
                          CASE tr.priority
                              WHEN 'urgent' THEN 1
                              WHEN 'high' THEN 2
                              WHEN 'medium' THEN 3
                              ELSE 4
                          END,
                          tr.created_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE request_type = 'patient_transfer') as patient_transfer,
                    COUNT(*) FILTER (WHERE request_type = 'sample_transport') as sample_transport,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent
                FROM transport_requests
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
            logger.error('Error in getAllRequests', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get requests by status
     */
    async getRequestsByStatus(staffId, status, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT tr.*, 
                       CONCAT(d.first_name, ' ', d.last_name) as driver_name,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name
                FROM transport_requests tr
                LEFT JOIN employees d ON tr.driver_id = d.id
                LEFT JOIN patients p ON tr.patient_id = p.id
                WHERE tr.status = $1 AND tr.is_deleted = false
            `;
            const values = [status];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND tr.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND tr.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY tr.created_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM transport_requests
                WHERE status = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [status]);

            return {
                data: result.rows,
                summary: { total: parseInt(count.rows[0]?.total || 0) },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getRequestsByStatus', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get request by ID
     */
    async getRequestById(staffId, requestId) {
        try {
            const query = `
                SELECT tr.*, 
                       CONCAT(d.first_name, ' ', d.last_name) as driver_name,
                       CONCAT(req.first_name, ' ', req.last_name) as requested_by_name,
                       CONCAT(acc.first_name, ' ', acc.last_name) as accepted_by_name,
                       CONCAT(start.first_name, ' ', start.last_name) as started_by_name,
                       CONCAT(comp.first_name, ' ', comp.last_name) as completed_by_name,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone
                FROM transport_requests tr
                LEFT JOIN employees d ON tr.driver_id = d.id
                LEFT JOIN users req ON tr.requested_by = req.id
                LEFT JOIN users acc ON tr.accepted_by = acc.id
                LEFT JOIN users start ON tr.started_by = start.id
                LEFT JOIN users comp ON tr.completed_by = comp.id
                LEFT JOIN patients p ON tr.patient_id = p.id
                WHERE tr.id = $1 AND tr.is_deleted = false
            `;

            const result = await db.query(query, [requestId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getRequestById', { error: error.message, staffId, requestId });
            throw error;
        }
    },

    /**
     * Accept transport request [BR-47]
     */
    async acceptRequest(staffId, requestId, acceptData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // [BR-47] Validate driver assignment
            if (!acceptData.driver_id) {
                throw new Error('Driver assignment is required');
            }

            // Check if driver is available
            const driverCheck = await client.query(`
                SELECT status, is_active FROM employees 
                WHERE id = $1 AND designation = 'driver'
            `, [acceptData.driver_id]);

            if (driverCheck.rows.length === 0) {
                throw new Error('Driver not found');
            }

            if (driverCheck.rows[0].status !== 'active') {
                throw new Error('Driver is not available');
            }

            const query = `
                UPDATE transport_requests 
                SET status = 'accepted',
                    driver_id = $1,
                    vehicle_number = $2,
                    accepted_at = $3,
                    accepted_by = $4,
                    acceptance_notes = $5,
                    updated_at = NOW()
                WHERE id = $6 AND status = 'pending'
                RETURNING *
            `;

            const values = [
                acceptData.driver_id,
                acceptData.vehicle_number,
                acceptData.accepted_at,
                acceptData.accepted_by,
                acceptData.notes,
                requestId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found or cannot be accepted');
            }

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
     * Start transport
     */
    async startTransport(staffId, requestId, startData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE transport_requests 
                SET status = 'in_progress',
                    started_at = $1,
                    started_by = $2,
                    start_notes = $3,
                    start_location = $4,
                    updated_at = NOW()
                WHERE id = $5 AND status = 'accepted'
                RETURNING *
            `;

            const values = [
                startData.started_at,
                startData.started_by,
                startData.notes,
                startData.start_location,
                requestId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found or cannot be started');
            }

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
     * Complete transport
     */
    async completeTransport(staffId, requestId, completeData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE transport_requests 
                SET status = 'completed',
                    completed_at = $1,
                    completed_by = $2,
                    completion_notes = $3,
                    end_location = $4,
                    delivery_signature = $5,
                    updated_at = NOW()
                WHERE id = $6 AND status = 'in_progress'
                RETURNING *
            `;

            const values = [
                completeData.completed_at,
                completeData.completed_by,
                completeData.notes,
                completeData.end_location,
                completeData.delivery_signature,
                requestId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Transport request not found or cannot be completed');
            }

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
     * Get transport history
     */
    async getTransportHistory(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date, driver_id, request_type } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT tr.*, 
                       CONCAT(d.first_name, ' ', d.last_name) as driver_name,
                       CONCAT(req.first_name, ' ', req.last_name) as requested_by_name,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       EXTRACT(EPOCH FROM (tr.completed_at - tr.accepted_at))/60 as completion_time_minutes
                FROM transport_requests tr
                LEFT JOIN employees d ON tr.driver_id = d.id
                LEFT JOIN users req ON tr.requested_by = req.id
                LEFT JOIN patients p ON tr.patient_id = p.id
                WHERE tr.status = 'completed' AND tr.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                query += ` AND tr.completed_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND tr.completed_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            if (driver_id) {
                query += ` AND tr.driver_id = $${paramIndex}`;
                values.push(driver_id);
                paramIndex++;
            }

            if (request_type) {
                query += ` AND tr.request_type = $${paramIndex}`;
                values.push(request_type);
                paramIndex++;
            }

            query += ` ORDER BY tr.completed_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    AVG(EXTRACT(EPOCH FROM (completed_at - accepted_at))/60)::numeric(10,2) as avg_completion_time,
                    COUNT(*) FILTER (WHERE completed_at <= scheduled_time) as on_time_count
                FROM transport_requests
                WHERE status = 'completed' AND is_deleted = false
                ${from_date ? 'AND completed_at >= $1' : ''}
                ${to_date ? 'AND completed_at <= $2' : ''}
            `;
            const countValues = [];
            if (from_date) countValues.push(from_date);
            if (to_date) countValues.push(to_date);
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
            logger.error('Error in getTransportHistory', { error: error.message, staffId });
            throw error;
        }
    }
};

module.exports = transportService;