/**
 * ======================================================================
 * FILE: backend/src/services/nurse/taskService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse task service - Handles business logic for task management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const taskService = {
    /**
     * Get all tasks
     */
    async getAllTasks(nurseId, options = {}) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                priority,
                patient_id,
                from_date,
                to_date,
                assigned_to 
            } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT t.*, 
                       p.first_name as patient_first_name, 
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       e.first_name as assigned_first_name,
                       e.last_name as assigned_last_name,
                       b.room_number, b.bed_number
                FROM tasks t
                LEFT JOIN patients p ON t.patient_id = p.id
                LEFT JOIN employees e ON t.assigned_to = e.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (assigned_to) {
                query += ` AND t.assigned_to = $${paramIndex}`;
                values.push(assigned_to);
                paramIndex++;
            }

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

            if (patient_id) {
                query += ` AND t.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND t.due_time >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND t.due_time <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY 
                        CASE t.priority
                            WHEN 'urgent' THEN 1
                            WHEN 'high' THEN 2
                            WHEN 'medium' THEN 3
                            WHEN 'low' THEN 4
                        END,
                        t.due_time ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
                    COUNT(*) FILTER (WHERE priority = 'high') as high,
                    COUNT(*) FILTER (WHERE priority = 'medium') as medium,
                    COUNT(*) FILTER (WHERE priority = 'low') as low
                FROM tasks
                WHERE assigned_to = $1
            `;
            const summary = await db.query(summaryQuery, [assigned_to || nurseId]);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(summary.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAllTasks', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get tasks by status
     */
    async getTasksByStatus(nurseId, status, options = {}) {
        try {
            const { page = 1, limit = 20, priority } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT t.*, 
                       p.first_name as patient_first_name, 
                       p.last_name as patient_last_name,
                       b.room_number, b.bed_number
                FROM tasks t
                LEFT JOIN patients p ON t.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE t.assigned_to = $1 AND t.status = $2
            `;
            const values = [nurseId, status];
            let paramIndex = 3;

            if (priority) {
                query += ` AND t.priority = $${paramIndex}`;
                values.push(priority);
                paramIndex++;
            }

            query += ` ORDER BY 
                        CASE t.priority
                            WHEN 'urgent' THEN 1
                            WHEN 'high' THEN 2
                            WHEN 'medium' THEN 3
                            WHEN 'low' THEN 4
                        END,
                        t.due_time ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tasks
                WHERE assigned_to = $1 AND status = $2
            `;
            const count = await db.query(countQuery, [nurseId, status]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getTasksByStatus', { error: error.message, nurseId, status });
            throw error;
        }
    },

    /**
     * Get tasks by priority
     */
    async getTasksByPriority(nurseId, priority, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT t.*, 
                       p.first_name as patient_first_name, 
                       p.last_name as patient_last_name,
                       b.room_number, b.bed_number
                FROM tasks t
                LEFT JOIN patients p ON t.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE t.assigned_to = $1 AND t.priority = $2
                ORDER BY t.due_time ASC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [nurseId, priority, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tasks
                WHERE assigned_to = $1 AND priority = $2
            `;
            const count = await db.query(countQuery, [nurseId, priority]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getTasksByPriority', { error: error.message, nurseId, priority });
            throw error;
        }
    },

    /**
     * Get task by ID
     */
    async getTaskById(nurseId, taskId) {
        try {
            const query = `
                SELECT t.*, 
                       p.first_name as patient_first_name, 
                       p.last_name as patient_last_name,
                       p.date_of_birth, p.gender, p.blood_group,
                       p.allergies, p.medical_conditions,
                       b.room_number, b.bed_number,
                       e.first_name as assigned_first_name,
                       e.last_name as assigned_last_name,
                       cr.first_name as created_first_name,
                       cr.last_name as created_last_name
                FROM tasks t
                LEFT JOIN patients p ON t.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                LEFT JOIN employees e ON t.assigned_to = e.id
                LEFT JOIN employees cr ON t.created_by = cr.id
                WHERE t.id = $1
            `;

            const result = await db.query(query, [taskId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getTaskById', { error: error.message, nurseId, taskId });
            throw error;
        }
    },

    /**
     * Update task status
     */
    async updateTaskStatus(nurseId, taskId, status, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check current status
            const checkQuery = `SELECT status FROM tasks WHERE id = $1`;
            const check = await client.query(checkQuery, [taskId]);
            
            if (check.rows.length === 0) {
                throw new Error('Task not found');
            }

            const currentStatus = check.rows[0].status;

            // Validate status transition
            const validTransitions = {
                'pending': ['in_progress', 'cancelled'],
                'in_progress': ['completed', 'paused', 'cancelled'],
                'paused': ['in_progress', 'cancelled'],
                'completed': [],
                'cancelled': []
            };

            if (!validTransitions[currentStatus]?.includes(status)) {
                throw new Error('Invalid status transition');
            }

            // Build update query
            const updates = [];
            const values = [];
            let paramIndex = 1;

            updates.push(`status = $${paramIndex}`);
            values.push(status);
            paramIndex++;

            if (data.notes) {
                updates.push(`notes = $${paramIndex}`);
                values.push(data.notes);
                paramIndex++;
            }

            if (status === 'in_progress' && !data.started_at) {
                updates.push(`started_at = NOW()`);
            } else if (data.started_at) {
                updates.push(`started_at = $${paramIndex}`);
                values.push(data.started_at);
                paramIndex++;
            }

            if (status === 'completed') {
                updates.push(`completed_at = NOW()`);
                if (data.outcome) {
                    updates.push(`outcome = $${paramIndex}`);
                    values.push(data.outcome);
                    paramIndex++;
                }
                if (data.patient_response) {
                    updates.push(`patient_response = $${paramIndex}`);
                    values.push(data.patient_response);
                    paramIndex++;
                }
            }

            if (status === 'paused' && data.paused_at) {
                updates.push(`paused_at = $${paramIndex}`);
                values.push(data.paused_at);
                paramIndex++;
            }

            updates.push(`updated_at = NOW()`);
            values.push(taskId);

            const query = `
                UPDATE tasks 
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await client.query(query, values);

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
    async postponeTask(nurseId, taskId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tasks 
                SET status = 'pending',
                    due_time = $1,
                    postponed_at = $2,
                    postponed_reason = $3,
                    postponed_by = $4,
                    notes = CASE 
                        WHEN notes IS NULL THEN $5
                        ELSE notes || E'\n' || $5
                    END,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const values = [
                data.new_due_time,
                data.postponed_at,
                data.reason,
                nurseId,
                data.notes || `Postponed: ${data.reason}`,
                taskId
            ];

            const result = await client.query(query, values);

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
     * Reassign task
     */
    async reassignTask(nurseId, taskId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if assignee exists and is nurse
            const checkQuery = `
                SELECT id FROM employees 
                WHERE id = $1 AND designation = 'Nurse' AND is_active = true
            `;
            const check = await client.query(checkQuery, [data.assign_to]);
            
            if (check.rows.length === 0) {
                throw new Error('Invalid assignee');
            }

            const query = `
                UPDATE tasks 
                SET assigned_to = $1,
                    reassigned_at = $2,
                    reassigned_by = $3,
                    reassignment_reason = $4,
                    notes = CASE 
                        WHEN notes IS NULL THEN $5
                        ELSE notes || E'\n' || $5
                    END,
                    updated_at = NOW()
                WHERE id = $6
                RETURNING *
            `;

            const values = [
                data.assign_to,
                data.reassigned_at,
                data.reassigned_by,
                data.reason,
                data.notes || `Reassigned: ${data.reason}`,
                taskId
            ];

            const result = await client.query(query, values);

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
     * Get task statistics
     */
    async getTaskStatistics(nurseId, options = {}) {
        try {
            const { period = 'day', from_date, to_date } = options;

            let dateFilter = '';
            if (period === 'day') {
                dateFilter = "AND created_at > NOW() - INTERVAL '1 day'";
            } else if (period === 'week') {
                dateFilter = "AND created_at > NOW() - INTERVAL '7 days'";
            } else if (period === 'month') {
                dateFilter = "AND created_at > NOW() - INTERVAL '30 days'";
            } else if (from_date && to_date) {
                dateFilter = `AND created_at BETWEEN '${from_date}' AND '${to_date}'`;
            }

            const query = `
                SELECT 
                    COUNT(*) as total_tasks,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60)::numeric(10,2) as avg_completion_time,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_tasks,
                    COUNT(*) FILTER (WHERE priority = 'high') as high_tasks,
                    COUNT(*) FILTER (WHERE priority = 'medium') as medium_tasks,
                    COUNT(*) FILTER (WHERE priority = 'low') as low_tasks,
                    COUNT(*) FILTER (WHERE due_time < NOW() AND status != 'completed') as overdue_tasks
                FROM tasks
                WHERE assigned_to = $1
                ${dateFilter}
            `;

            const result = await db.query(query, [nurseId]);

            // Get tasks by patient
            const byPatientQuery = `
                SELECT 
                    p.id, p.first_name, p.last_name,
                    COUNT(*) as task_count
                FROM tasks t
                JOIN patients p ON t.patient_id = p.id
                WHERE t.assigned_to = $1
                    ${dateFilter}
                GROUP BY p.id
                ORDER BY task_count DESC
                LIMIT 5
            `;
            const byPatient = await db.query(byPatientQuery, [nurseId]);

            return {
                ...result.rows[0],
                top_patients: byPatient.rows
            };
        } catch (error) {
            logger.error('Error in getTaskStatistics', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get task completion rate
     */
    async getTaskCompletionRate(nurseId, days = 7) {
        try {
            const query = `
                WITH daily_stats AS (
                    SELECT 
                        date_trunc('day', created_at) as day,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed
                    FROM tasks
                    WHERE assigned_to = $1
                        AND created_at > NOW() - INTERVAL '${days} days'
                    GROUP BY date_trunc('day', created_at)
                    ORDER BY day DESC
                )
                SELECT 
                    day,
                    total,
                    completed,
                    CASE 
                        WHEN total > 0 THEN (completed::float / total * 100)::numeric(5,2)
                        ELSE 0
                    END as completion_rate
                FROM daily_stats
            `;

            const result = await db.query(query, [nurseId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTaskCompletionRate', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get overdue tasks
     */
    async getOverdueTasks(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT t.*, 
                       p.first_name as patient_first_name, 
                       p.last_name as patient_last_name,
                       b.room_number, b.bed_number,
                       EXTRACT(EPOCH FROM (NOW() - t.due_time))/3600 as hours_overdue
                FROM tasks t
                LEFT JOIN patients p ON t.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE t.assigned_to = $1 
                    AND t.due_time < NOW() 
                    AND t.status NOT IN ('completed', 'cancelled')
                ORDER BY t.due_time ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [nurseId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM tasks
                WHERE assigned_to = $1 
                    AND due_time < NOW() 
                    AND status NOT IN ('completed', 'cancelled')
            `;
            const count = await db.query(countQuery, [nurseId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getOverdueTasks', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Bulk complete tasks
     */
    async bulkCompleteTasks(nurseId, taskIds, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const results = {
                success: [],
                failed: []
            };

            for (const taskId of taskIds) {
                try {
                    const query = `
                        UPDATE tasks 
                        SET status = 'completed',
                            completed_at = NOW(),
                            notes = CASE 
                                WHEN notes IS NULL THEN $1
                                ELSE notes || E'\n' || $1
                            END,
                            updated_at = NOW()
                        WHERE id = $2 AND assigned_to = $3
                        RETURNING id
                    `;

                    const result = await client.query(query, [data.notes || 'Bulk completed', taskId, nurseId]);
                    
                    if (result.rows.length > 0) {
                        results.success.push(taskId);
                    } else {
                        results.failed.push({ id: taskId, reason: 'Task not found or not assigned to you' });
                    }
                } catch (err) {
                    results.failed.push({ id: taskId, reason: err.message });
                }
            }

            await db.commitTransaction(client);

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Bulk reassign tasks
     */
    async bulkReassignTasks(nurseId, taskIds, assignTo, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if assignee exists
            const checkQuery = `
                SELECT id FROM employees 
                WHERE id = $1 AND designation = 'Nurse' AND is_active = true
            `;
            const check = await client.query(checkQuery, [assignTo]);
            
            if (check.rows.length === 0) {
                throw new Error('Invalid assignee');
            }

            const results = {
                success: [],
                failed: []
            };

            for (const taskId of taskIds) {
                try {
                    const query = `
                        UPDATE tasks 
                        SET assigned_to = $1,
                            reassigned_at = NOW(),
                            reassigned_by = $2,
                            reassignment_reason = $3,
                            notes = CASE 
                                WHEN notes IS NULL THEN $4
                                ELSE notes || E'\n' || $4
                            END,
                            updated_at = NOW()
                        WHERE id = $5
                        RETURNING id
                    `;

                    const result = await client.query(query, [
                        assignTo,
                        nurseId,
                        data.reason || 'Bulk reassignment',
                        data.notes || `Reassigned to ${assignTo}`,
                        taskId
                    ]);
                    
                    if (result.rows.length > 0) {
                        results.success.push(taskId);
                    } else {
                        results.failed.push({ id: taskId, reason: 'Task not found' });
                    }
                } catch (err) {
                    results.failed.push({ id: taskId, reason: err.message });
                }
            }

            await db.commitTransaction(client);

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Add task comment
     */
    async addTaskComment(nurseId, taskId, commentData) {
        try {
            const query = `
                INSERT INTO task_comments (
                    id, task_id, user_id, comment, created_at
                ) VALUES (gen_random_uuid(), $1, $2, $3, $4)
                RETURNING *
            `;

            const values = [taskId, nurseId, commentData.comment, commentData.created_at];
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in addTaskComment', { error: error.message, nurseId, taskId });
            throw error;
        }
    },

    /**
     * Get task comments
     */
    async getTaskComments(nurseId, taskId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT c.*, e.first_name, e.last_name
                FROM task_comments c
                JOIN employees e ON c.user_id = e.id
                WHERE c.task_id = $1
                ORDER BY c.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [taskId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM task_comments
                WHERE task_id = $1
            `;
            const count = await db.query(countQuery, [taskId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getTaskComments', { error: error.message, nurseId, taskId });
            throw error;
        }
    }
};

module.exports = taskService;