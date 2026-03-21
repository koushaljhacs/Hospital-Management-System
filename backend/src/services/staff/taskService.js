/**
 * ======================================================================
 * FILE: backend/src/services/staff/taskService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Ground Staff task service - Handles business logic for task management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-46] Tasks must be acknowledged within 30 minutes
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const taskService = {
    /**
     * Get all tasks
     */
    async getAllTasks(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, status, priority, assigned_to, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT t.*, 
                       CONCAT(assigned.first_name, ' ', assigned.last_name) as assigned_to_name,
                       CONCAT(created.first_name, ' ', created.last_name) as created_by_name,
                       CASE 
                           WHEN t.status = 'pending' AND t.created_at < NOW() - INTERVAL '30 minutes' THEN true
                           ELSE false
                       END as is_overdue
                FROM tasks t
                LEFT JOIN employees assigned ON t.assigned_to = assigned.id
                LEFT JOIN users created ON t.created_by = created.id
                WHERE t.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND t.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (priority) {
                query += ` AND t.priority = $${paramIndex}`;
                values.push(priority);
                paramIndex++;
            }

            if (assigned_to) {
                query += ` AND t.assigned_to = $${paramIndex}`;
                values.push(assigned_to);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND t.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND t.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY 
                          CASE t.priority
                              WHEN 'urgent' THEN 1
                              WHEN 'high' THEN 2
                              WHEN 'medium' THEN 3
                              ELSE 4
                          END,
                          t.created_at ASC
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
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
                    COUNT(*) FILTER (WHERE priority = 'high') as high
                FROM tasks
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
            logger.error('Error in getAllTasks', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get tasks by status
     */
    async getTasksByStatus(staffId, status, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT t.*, 
                       CONCAT(assigned.first_name, ' ', assigned.last_name) as assigned_to_name,
                       CASE 
                           WHEN t.status = 'pending' AND t.created_at < NOW() - INTERVAL '30 minutes' THEN true
                           ELSE false
                       END as is_overdue
                FROM tasks t
                LEFT JOIN employees assigned ON t.assigned_to = assigned.id
                WHERE t.status = $1 AND t.is_deleted = false
            `;
            const values = [status];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND t.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND t.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY t.created_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tasks
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
            logger.error('Error in getTasksByStatus', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get today's tasks
     */
    async getTodayTasks(staffId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT t.*, 
                       CONCAT(assigned.first_name, ' ', assigned.last_name) as assigned_to_name
                FROM tasks t
                LEFT JOIN employees assigned ON t.assigned_to = assigned.id
                WHERE DATE(t.created_at) = CURRENT_DATE 
                    AND t.is_deleted = false
                ORDER BY 
                    CASE t.priority
                        WHEN 'urgent' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        ELSE 4
                    END,
                    t.created_at ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tasks
                WHERE DATE(created_at) = CURRENT_DATE AND is_deleted = false
            `;
            const count = await db.query(countQuery);

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
            logger.error('Error in getTodayTasks', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get tasks by priority
     */
    async getTasksByPriority(staffId, priority, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT t.*, 
                       CONCAT(assigned.first_name, ' ', assigned.last_name) as assigned_to_name
                FROM tasks t
                LEFT JOIN employees assigned ON t.assigned_to = assigned.id
                WHERE t.priority = $1 AND t.is_deleted = false
                ORDER BY t.created_at ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [priority, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tasks
                WHERE priority = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [priority]);

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
            logger.error('Error in getTasksByPriority', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get task by ID
     */
    async getTaskById(staffId, taskId) {
        try {
            const query = `
                SELECT t.*, 
                       CONCAT(assigned.first_name, ' ', assigned.last_name) as assigned_to_name,
                       CONCAT(created.first_name, ' ', created.last_name) as created_by_name,
                       CONCAT(accepted.first_name, ' ', accepted.last_name) as accepted_by_name,
                       CONCAT(started.first_name, ' ', started.last_name) as started_by_name,
                       CONCAT(completed.first_name, ' ', completed.last_name) as completed_by_name
                FROM tasks t
                LEFT JOIN employees assigned ON t.assigned_to = assigned.id
                LEFT JOIN users created ON t.created_by = created.id
                LEFT JOIN users accepted ON t.accepted_by = accepted.id
                LEFT JOIN users started ON t.started_by = started.id
                LEFT JOIN users completed ON t.completed_by = completed.id
                WHERE t.id = $1 AND t.is_deleted = false
            `;

            const result = await db.query(query, [taskId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getTaskById', { error: error.message, staffId, taskId });
            throw error;
        }
    },

    /**
     * Accept task [BR-46]
     */
    async acceptTask(staffId, taskId, acceptData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if task is still within acknowledgment window [BR-46]
            const taskCheck = await client.query(`
                SELECT created_at FROM tasks 
                WHERE id = $1 AND status = 'pending'
            `, [taskId]);

            if (taskCheck.rows.length > 0) {
                const created = new Date(taskCheck.rows[0].created_at);
                const minutesSince = (Date.now() - created) / (1000 * 60);
                
                if (minutesSince > 30) {
                    throw new Error('Task acknowledgment window has expired (30 minutes)');
                }
            }

            const query = `
                UPDATE tasks 
                SET status = 'accepted',
                    accepted_at = $1,
                    accepted_by = $2,
                    acceptance_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'pending'
                RETURNING *
            `;

            const values = [
                acceptData.accepted_at,
                acceptData.accepted_by,
                acceptData.notes,
                taskId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Task not found or cannot be accepted');
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
     * Reject task
     */
    async rejectTask(staffId, taskId, rejectData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tasks 
                SET status = 'rejected',
                    rejected_at = $1,
                    rejected_by = $2,
                    rejection_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'pending'
                RETURNING *
            `;

            const values = [
                rejectData.rejected_at,
                rejectData.rejected_by,
                rejectData.reason,
                taskId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Task not found or cannot be rejected');
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
     * Start task
     */
    async startTask(staffId, taskId, startData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tasks 
                SET status = 'in_progress',
                    started_at = $1,
                    started_by = $2,
                    start_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'accepted'
                RETURNING *
            `;

            const values = [
                startData.started_at,
                startData.started_by,
                startData.notes,
                taskId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Task not found or cannot be started');
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
     * Complete task
     */
    async completeTask(staffId, taskId, completeData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tasks 
                SET status = 'completed',
                    completed_at = $1,
                    completed_by = $2,
                    completion_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'in_progress'
                RETURNING *
            `;

            const values = [
                completeData.completed_at,
                completeData.completed_by,
                completeData.completion_notes,
                taskId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Task not found or cannot be completed');
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
     * Postpone task
     */
    async postponeTask(staffId, taskId, postponeData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tasks 
                SET status = 'postponed',
                    postponed_until = $1,
                    postponed_at = $2,
                    postponed_by = $3,
                    postponement_reason = $4,
                    updated_at = NOW()
                WHERE id = $5 AND status IN ('accepted', 'in_progress')
                RETURNING *
            `;

            const values = [
                postponeData.postpone_until,
                postponeData.postponed_at,
                postponeData.postponed_by,
                postponeData.reason,
                taskId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Task not found or cannot be postponed');
            }

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

module.exports = taskService;