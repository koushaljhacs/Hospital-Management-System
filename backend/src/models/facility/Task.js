/**
 * ======================================================================
 * FILE: backend/src/models/facility/Task.js
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
 * Task model for database operations.
 * Handles task management for staff including assignments, priorities,
 * dependencies, and progress tracking.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: tasks
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - task_number: string (unique)
 * - task_type: enum (patient_transport, sample_collection, equipment_maintenance, cleaning, medication_delivery, document_delivery, patient_care, lab_test, radiology, pharmacy, billing, administrative, emergency, follow_up, other)
 * - assigned_to: uuid
 * - assigned_by: uuid
 * - assigned_at: timestamp
 * - department_id: UUID
 * - shift_id: UUID
 * - patient_id: UUID
 * - appointment_id: UUID
 * - bed_id: UUID
 * - equipment_id: UUID
 * - test_order_id: UUID
 * - prescription_id: UUID
 * - title: string
 * - description: text
 * - instructions: text
 * - location: string
 * - priority: enum (low, medium, high, urgent, critical)
 * - urgency_level: integer
 * - is_emergency: boolean
 * - estimated_duration: integer
 * - status: enum (pending, assigned, accepted, in_progress, paused, completed, verified, cancelled, failed)
 * - due_time: timestamp
 * - started_at: timestamp
 * - completed_at: timestamp
 * - cancelled_at: timestamp
 * - cancellation_reason: text
 * - cancelled_by: uuid
 * - parent_task_id: UUID
 * - dependent_task_ids: uuid[]
 * - blocking_tasks: uuid[]
 * - progress_percentage: integer
 * - time_spent: integer
 * - reminder_sent: boolean
 * - reminder_sent_at: timestamp
 * - escalation_level: integer
 * - escalated_to: uuid
 * - escalated_at: timestamp
 * - escalation_reason: text
 * - quality_check_required: boolean
 * - quality_check_by: uuid
 * - quality_check_at: timestamp
 * - quality_check_passed: boolean
 * - quality_check_notes: text
 * - feedback_from_patient: text
 * - feedback_from_supervisor: text
 * - feedback_rating: integer
 * - attachments: jsonb
 * - images: text[]
 * - documents: jsonb
 * - notes: text
 * - internal_notes: text
 * - metadata: jsonb
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

const Task = {
    /**
     * Table name
     */
    tableName: 'tasks',

    /**
     * Valid task types
     */
    validTaskTypes: [
        'patient_transport', 'sample_collection', 'equipment_maintenance',
        'cleaning', 'medication_delivery', 'document_delivery', 'patient_care',
        'lab_test', 'radiology', 'pharmacy', 'billing', 'administrative',
        'emergency', 'follow_up', 'other'
    ],

    /**
     * Valid priorities
     */
    validPriorities: ['low', 'medium', 'high', 'urgent', 'critical'],

    /**
     * Valid statuses
     */
    validStatuses: ['pending', 'assigned', 'accepted', 'in_progress', 'paused', 'completed', 'verified', 'cancelled', 'failed'],

    /**
     * Generate task number
     * @returns {Promise<string>} Generated task number
     */
    async generateTaskNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM tasks
                WHERE task_number LIKE $1
            `;
            const result = await db.query(query, [`TSK-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `TSK-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating task number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find task by ID
     * @param {string} id - Task UUID
     * @returns {Promise<Object|null>} Task object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    t.id, t.task_number, t.task_type,
                    t.assigned_to, t.assigned_by, t.assigned_at,
                    t.department_id, t.shift_id,
                    t.patient_id, t.appointment_id, t.bed_id,
                    t.equipment_id, t.test_order_id, t.prescription_id,
                    t.title, t.description, t.instructions, t.location,
                    t.priority, t.urgency_level, t.is_emergency,
                    t.estimated_duration, t.status,
                    t.due_time, t.started_at, t.completed_at,
                    t.cancelled_at, t.cancellation_reason, t.cancelled_by,
                    t.parent_task_id, t.dependent_task_ids, t.blocking_tasks,
                    t.progress_percentage, t.time_spent,
                    t.reminder_sent, t.reminder_sent_at,
                    t.escalation_level, t.escalated_to, t.escalated_at,
                    t.escalation_reason,
                    t.quality_check_required, t.quality_check_by,
                    t.quality_check_at, t.quality_check_passed,
                    t.quality_check_notes,
                    t.feedback_from_patient, t.feedback_from_supervisor,
                    t.feedback_rating,
                    t.attachments, t.images, t.documents,
                    t.notes, t.internal_notes, t.metadata,
                    t.created_at, t.updated_at,
                    assigned_user.username as assigned_to_name,
                    assigned_by_user.username as assigned_by_name,
                    dept.name as department_name,
                    shift.shift_type as shift_name,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    escalated_user.username as escalated_to_name,
                    qc_user.username as quality_check_by_name
                FROM tasks t
                LEFT JOIN users assigned_user ON t.assigned_to = assigned_user.id
                LEFT JOIN users assigned_by_user ON t.assigned_by = assigned_by_user.id
                LEFT JOIN departments dept ON t.department_id = dept.id
                LEFT JOIN shifts shift ON t.shift_id = shift.id
                LEFT JOIN patients p ON t.patient_id = p.id
                LEFT JOIN users escalated_user ON t.escalated_to = escalated_user.id
                LEFT JOIN users qc_user ON t.quality_check_by = qc_user.id
                WHERE t.id = $1 AND t.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Task found by ID', { taskId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding task by ID', {
                error: error.message,
                taskId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find task by number
     * @param {string} taskNumber - Task number
     * @returns {Promise<Object|null>} Task object or null
     */
    async findByNumber(taskNumber) {
        try {
            const query = `
                SELECT id, task_number, title, priority, status, due_time
                FROM tasks
                WHERE task_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [taskNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Task found by number', { taskNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding task by number', {
                error: error.message,
                taskNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find tasks by assigned user
     * @param {string} userId - User UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of tasks
     */
    async findByAssignedTo(userId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, priority } = options;
            const values = [userId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }
            if (priority) {
                conditions.push(`priority = $${paramIndex++}`);
                values.push(priority);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, task_number, task_type, title,
                    priority, status, due_time,
                    estimated_duration, progress_percentage,
                    patient_id, created_at
                FROM tasks
                ${whereClause}
                ORDER BY 
                    CASE priority
                        WHEN 'critical' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'high' THEN 3
                        WHEN 'medium' THEN 4
                        WHEN 'low' THEN 5
                    END,
                    due_time ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Tasks found by assigned user', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding tasks by assigned user', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get tasks by status
     * @param {string} status - Task status
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of tasks
     */
    async findByStatus(status, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, task_number, task_type, title,
                    assigned_to, priority, due_time,
                    estimated_duration, progress_percentage,
                    u.username as assigned_to_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.status = $1 AND t.is_deleted = false
                ORDER BY 
                    CASE priority
                        WHEN 'critical' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'high' THEN 3
                        WHEN 'medium' THEN 4
                        WHEN 'low' THEN 5
                    END,
                    due_time ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            logger.debug('Tasks found by status', {
                status,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding tasks by status', {
                error: error.message,
                status
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending tasks (status = pending or assigned)
     * @returns {Promise<Array>} List of pending tasks
     */
    async getPendingTasks() {
        return this.findByStatus('pending');
    },

    /**
     * Get overdue tasks
     * @returns {Promise<Array>} List of overdue tasks
     */
    async getOverdueTasks() {
        try {
            const query = `
                SELECT 
                    id, task_number, title, assigned_to,
                    priority, due_time, status,
                    u.username as assigned_to_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.due_time < NOW()
                    AND t.status NOT IN ('completed', 'verified', 'cancelled')
                    AND t.is_deleted = false
                ORDER BY t.due_time ASC
            `;

            const result = await db.query(query);

            logger.debug('Overdue tasks retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting overdue tasks', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new task
     * @param {Object} taskData - Task data
     * @returns {Promise<Object>} Created task
     */
    async create(taskData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (taskData.task_type && !this.validTaskTypes.includes(taskData.task_type)) {
                throw new Error(`Invalid task type. Must be one of: ${this.validTaskTypes.join(', ')}`);
            }
            if (taskData.priority && !this.validPriorities.includes(taskData.priority)) {
                throw new Error(`Invalid priority. Must be one of: ${this.validPriorities.join(', ')}`);
            }
            if (taskData.status && !this.validStatuses.includes(taskData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const taskNumber = await this.generateTaskNumber();

            const query = `
                INSERT INTO tasks (
                    id, task_number, task_type,
                    assigned_to, assigned_by, assigned_at,
                    department_id, shift_id,
                    patient_id, appointment_id, bed_id,
                    equipment_id, test_order_id, prescription_id,
                    title, description, instructions, location,
                    priority, urgency_level, is_emergency,
                    estimated_duration, status,
                    due_time,
                    parent_task_id, dependent_task_ids, blocking_tasks,
                    quality_check_required,
                    notes, internal_notes, metadata,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, COALESCE($5, NOW()),
                    $6, $7,
                    $8, $9, $10,
                    $11, $12, $13,
                    $14, $15, $16, $17,
                    $18, $19, $20,
                    $21, $22,
                    $23,
                    $24, $25, $26,
                    $27,
                    $28, $29, $30,
                    $31, NOW(), NOW()
                )
                RETURNING 
                    id, task_number, task_type,
                    title, priority, status, due_time,
                    created_at
            `;

            const values = [
                taskNumber,
                taskData.task_type,
                taskData.assigned_to,
                taskData.assigned_by || null,
                taskData.assigned_at || null,
                taskData.department_id || null,
                taskData.shift_id || null,
                taskData.patient_id || null,
                taskData.appointment_id || null,
                taskData.bed_id || null,
                taskData.equipment_id || null,
                taskData.test_order_id || null,
                taskData.prescription_id || null,
                taskData.title,
                taskData.description,
                taskData.instructions || null,
                taskData.location || null,
                taskData.priority,
                taskData.urgency_level || 1,
                taskData.is_emergency || false,
                taskData.estimated_duration || null,
                taskData.status || 'pending',
                taskData.due_time,
                taskData.parent_task_id || null,
                taskData.dependent_task_ids || null,
                taskData.blocking_tasks || null,
                taskData.quality_check_required || false,
                taskData.notes || null,
                taskData.internal_notes || null,
                taskData.metadata || null,
                taskData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Task created successfully', {
                taskId: result.rows[0].id,
                taskNumber,
                title: taskData.title,
                assignedTo: taskData.assigned_to
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating task', {
                error: error.message,
                title: taskData.title
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update task
     * @param {string} id - Task ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated task
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'task_type', 'assigned_to', 'department_id', 'shift_id',
                'patient_id', 'appointment_id', 'bed_id',
                'equipment_id', 'test_order_id', 'prescription_id',
                'title', 'description', 'instructions', 'location',
                'priority', 'urgency_level', 'is_emergency',
                'estimated_duration', 'status',
                'due_time', 'started_at', 'completed_at',
                'cancelled_at', 'cancellation_reason', 'cancelled_by',
                'parent_task_id', 'dependent_task_ids', 'blocking_tasks',
                'progress_percentage', 'time_spent',
                'reminder_sent', 'reminder_sent_at',
                'escalation_level', 'escalated_to', 'escalated_at',
                'escalation_reason',
                'quality_check_required', 'quality_check_by',
                'quality_check_at', 'quality_check_passed',
                'quality_check_notes',
                'feedback_from_patient', 'feedback_from_supervisor',
                'feedback_rating',
                'attachments', 'images', 'documents',
                'notes', 'internal_notes', 'metadata'
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
                UPDATE tasks 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, task_number, title, status,
                    progress_percentage, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Task not found');
            }

            await db.commitTransaction(client);

            logger.info('Task updated', {
                taskId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating task', {
                error: error.message,
                taskId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Assign task to user
     * @param {string} id - Task ID
     * @param {string} assignedTo - User ID
     * @param {string} assignedBy - User who assigned
     * @returns {Promise<Object>} Updated task
     */
    async assign(id, assignedTo, assignedBy) {
        return this.update(id, {
            assigned_to: assignedTo,
            assigned_by: assignedBy,
            assigned_at: new Date(),
            status: 'assigned',
            updated_by: assignedBy
        });
    },

    /**
     * Accept task
     * @param {string} id - Task ID
     * @param {string} acceptedBy - User who accepted
     * @returns {Promise<Object>} Updated task
     */
    async accept(id, acceptedBy) {
        return this.update(id, {
            status: 'accepted',
            updated_by: acceptedBy
        });
    },

    /**
     * Start task
     * @param {string} id - Task ID
     * @param {string} startedBy - User who started
     * @returns {Promise<Object>} Updated task
     */
    async start(id, startedBy) {
        return this.update(id, {
            status: 'in_progress',
            started_at: new Date(),
            updated_by: startedBy
        });
    },

    /**
     * Pause task
     * @param {string} id - Task ID
     * @param {string} pausedBy - User who paused
     * @returns {Promise<Object>} Updated task
     */
    async pause(id, pausedBy) {
        const task = await this.findById(id);
        if (!task) {
            throw new Error('Task not found');
        }
        const timeSpent = (task.time_spent || 0) + (task.started_at ? Math.floor((Date.now() - new Date(task.started_at)) / 1000 / 60) : 0);
        return this.update(id, {
            status: 'paused',
            time_spent: timeSpent,
            updated_by: pausedBy
        });
    },

    /**
     * Resume task
     * @param {string} id - Task ID
     * @param {string} resumedBy - User who resumed
     * @returns {Promise<Object>} Updated task
     */
    async resume(id, resumedBy) {
        return this.update(id, {
            status: 'in_progress',
            started_at: new Date(),
            updated_by: resumedBy
        });
    },

    /**
     * Complete task
     * @param {string} id - Task ID
     * @param {string} completedBy - User who completed
     * @returns {Promise<Object>} Updated task
     */
    async complete(id, completedBy) {
        const task = await this.findById(id);
        if (!task) {
            throw new Error('Task not found');
        }
        const timeSpent = (task.time_spent || 0) + (task.started_at ? Math.floor((Date.now() - new Date(task.started_at)) / 1000 / 60) : 0);
        const updates = {
            status: task.quality_check_required ? 'completed' : 'verified',
            completed_at: new Date(),
            time_spent: timeSpent,
            progress_percentage: 100,
            updated_by: completedBy
        };
        if (!task.quality_check_required) {
            updates.quality_check_passed = true;
            updates.quality_check_at = new Date();
            updates.quality_check_by = completedBy;
        }
        return this.update(id, updates);
    },

    /**
     * Verify task (quality check)
     * @param {string} id - Task ID
     * @param {string} verifiedBy - User who verified
     * @param {boolean} passed - Whether quality check passed
     * @param {string} notes - Quality check notes
     * @returns {Promise<Object>} Updated task
     */
    async verify(id, verifiedBy, passed, notes = null) {
        return this.update(id, {
            status: 'verified',
            quality_check_passed: passed,
            quality_check_by: verifiedBy,
            quality_check_at: new Date(),
            quality_check_notes: notes,
            updated_by: verifiedBy
        });
    },

    /**
     * Cancel task
     * @param {string} id - Task ID
     * @param {string} cancelledBy - User who cancelled
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Updated task
     */
    async cancel(id, cancelledBy, reason) {
        return this.update(id, {
            status: 'cancelled',
            cancelled_at: new Date(),
            cancellation_reason: reason,
            cancelled_by: cancelledBy,
            updated_by: cancelledBy
        });
    },

    /**
     * Update task progress
     * @param {string} id - Task ID
     * @param {number} progressPercentage - Progress percentage (0-100)
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated task
     */
    async updateProgress(id, progressPercentage, updatedBy) {
        if (progressPercentage < 0 || progressPercentage > 100) {
            throw new Error('Progress percentage must be between 0 and 100');
        }
        return this.update(id, {
            progress_percentage: progressPercentage,
            updated_by: updatedBy
        });
    },

    /**
     * Escalate task
     * @param {string} id - Task ID
     * @param {string} escalatedTo - User ID to escalate to
     * @param {string} reason - Escalation reason
     * @param {string} escalatedBy - User who escalated
     * @returns {Promise<Object>} Updated task
     */
    async escalate(id, escalatedTo, reason, escalatedBy) {
        const task = await this.findById(id);
        if (!task) {
            throw new Error('Task not found');
        }
        return this.update(id, {
            escalation_level: (task.escalation_level || 0) + 1,
            escalated_to: escalatedTo,
            escalated_at: new Date(),
            escalation_reason: reason,
            updated_by: escalatedBy
        });
    },

    /**
     * Add feedback to task
     * @param {string} id - Task ID
     * @param {Object} feedbackData - Feedback data
     * @returns {Promise<Object>} Updated task
     */
    async addFeedback(id, feedbackData) {
        const updates = {};
        if (feedbackData.from_patient) {
            updates.feedback_from_patient = feedbackData.from_patient;
        }
        if (feedbackData.from_supervisor) {
            updates.feedback_from_supervisor = feedbackData.from_supervisor;
        }
        if (feedbackData.rating !== undefined) {
            updates.feedback_rating = feedbackData.rating;
        }
        updates.updated_by = feedbackData.provided_by;
        return this.update(id, updates);
    },

    /**
     * Get task statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND created_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_tasks,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'assigned') as assigned,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE priority = 'critical') as critical,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
                    COUNT(*) FILTER (WHERE priority = 'high') as high,
                    COUNT(*) FILTER (WHERE is_emergency = true) as emergency,
                    COUNT(DISTINCT assigned_to) as unique_assignees,
                    AVG(progress_percentage)::numeric(10,2) as avg_progress,
                    AVG(time_spent)::numeric(10,2) as avg_time_spent_minutes
                FROM tasks
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Task statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting task statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get tasks by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of tasks
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    id, task_number, title, assigned_to,
                    priority, status, due_time, created_at,
                    u.username as assigned_to_name
                FROM tasks t
                LEFT JOIN users u ON t.assigned_to = u.id
                WHERE t.due_time BETWEEN $1 AND $2
                    AND t.is_deleted = false
                ORDER BY t.due_time ASC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [startDate, endDate, limit, offset]);

            logger.debug('Tasks found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting tasks by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete task
     * @param {string} id - Task ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tasks 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Task not found');
            }

            await db.commitTransaction(client);

            logger.info('Task soft deleted', {
                taskId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting task', {
                error: error.message,
                taskId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Task;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */