/**
 * ======================================================================
 * FILE: backend/src/controllers/nurse/taskController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse task management controller - Handles all nursing tasks,
 * assignments, and task workflows.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ENDPOINTS:
 * GET    /nurse/tasks                         - All tasks
 * GET    /nurse/tasks/pending                   - Pending tasks
 * GET    /nurse/tasks/completed                   - Completed tasks
 * GET    /nurse/tasks/priority                     - By priority
 * GET    /nurse/tasks/:id                           - Get task
 * PUT    /nurse/tasks/:id/start                      - Start task
 * PUT    /nurse/tasks/:id/pause                        - Pause task
 * PUT    /nurse/tasks/:id/complete                      - Complete task
 * PUT    /nurse/tasks/:id/postpone                        - Postpone task
 * PUT    /nurse/tasks/:id/reassign                         - Reassign task
 * GET    /nurse/tasks/stats                                  - Task statistics
 * 
 * ======================================================================
 */

const taskService = require('../../services/nurse/taskService');
const logger = require('../../utils/logger');

/**
 * Nurse Task Controller
 */
const taskController = {
    // ============================================
    // TASK LISTS
    // ============================================

    /**
     * Get all tasks
     * GET /api/v1/nurse/tasks
     */
    async getAllTasks(req, res, next) {
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
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                priority,
                patient_id,
                from_date,
                to_date,
                assigned_to: assigned_to || req.user.id // Default to current nurse
            };

            const tasks = await taskService.getAllTasks(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved all tasks', {
                nurseId: req.user.id,
                count: tasks.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: tasks.summary
            });
        } catch (error) {
            logger.error('Error getting all tasks', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending tasks
     * GET /api/v1/nurse/tasks/pending
     */
    async getPendingTasks(req, res, next) {
        try {
            const { page = 1, limit = 20, priority } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                priority
            };

            const tasks = await taskService.getTasksByStatus(
                req.user.id,
                'pending',
                options
            );

            logger.info('Nurse retrieved pending tasks', {
                nurseId: req.user.id,
                count: tasks.data?.length || 0
            });

            // Group by priority for better view
            const byPriority = {
                urgent: tasks.data?.filter(t => t.priority === 'urgent').length || 0,
                high: tasks.data?.filter(t => t.priority === 'high').length || 0,
                medium: tasks.data?.filter(t => t.priority === 'medium').length || 0,
                low: tasks.data?.filter(t => t.priority === 'low').length || 0
            };

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    by_priority: byPriority,
                    overdue: tasks.data?.filter(t => new Date(t.due_time) < new Date()).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending tasks', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed tasks
     * GET /api/v1/nurse/tasks/completed
     */
    async getCompletedTasks(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const tasks = await taskService.getTasksByStatus(
                req.user.id,
                'completed',
                options
            );

            logger.info('Nurse retrieved completed tasks', {
                nurseId: req.user.id,
                count: tasks.data?.length || 0
            });

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    completed_today: tasks.data?.filter(t => {
                        const today = new Date().toDateString();
                        return new Date(t.completed_at).toDateString() === today;
                    }).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting completed tasks', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get tasks by priority
     * GET /api/v1/nurse/tasks/priority
     */
    async getTasksByPriority(req, res, next) {
        try {
            const { priority, page = 1, limit = 20 } = req.query;

            if (!priority || !['urgent', 'high', 'medium', 'low'].includes(priority)) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid priority (urgent/high/medium/low) is required'
                });
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const tasks = await taskService.getTasksByPriority(
                req.user.id,
                priority,
                options
            );

            logger.info('Nurse retrieved tasks by priority', {
                nurseId: req.user.id,
                priority,
                count: tasks.data?.length || 0
            });

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination
            });
        } catch (error) {
            logger.error('Error getting tasks by priority', {
                error: error.message,
                nurseId: req.user.id,
                priority: req.query.priority
            });
            next(error);
        }
    },

    /**
     * Get task by ID
     * GET /api/v1/nurse/tasks/:id
     */
    async getTaskById(req, res, next) {
        try {
            const { id } = req.params;

            const task = await taskService.getTaskById(
                req.user.id,
                id
            );

            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }

            logger.info('Nurse viewed task details', {
                nurseId: req.user.id,
                taskId: id,
                patientId: task.patient_id
            });

            res.json({
                success: true,
                data: task
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            logger.error('Error getting task by ID', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // TASK STATUS UPDATES
    // ============================================

    /**
     * Start task
     * PUT /api/v1/nurse/tasks/:id/start
     */
    async startTask(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const task = await taskService.updateTaskStatus(
                req.user.id,
                id,
                'in_progress',
                { 
                    notes,
                    started_at: new Date()
                }
            );

            logger.info('Nurse started task', {
                nurseId: req.user.id,
                taskId: id,
                patientId: task.patient_id
            });

            res.json({
                success: true,
                data: task,
                message: 'Task started successfully'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            if (error.message === 'Invalid status transition') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot start task in current status'
                });
            }
            logger.error('Error starting task', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Pause task
     * PUT /api/v1/nurse/tasks/:id/pause
     */
    async pauseTask(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, reason } = req.body;

            const task = await taskService.updateTaskStatus(
                req.user.id,
                id,
                'paused',
                { 
                    notes: notes || reason,
                    paused_at: new Date()
                }
            );

            logger.info('Nurse paused task', {
                nurseId: req.user.id,
                taskId: id,
                patientId: task.patient_id,
                reason
            });

            res.json({
                success: true,
                data: task,
                message: 'Task paused successfully'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            if (error.message === 'Invalid status transition') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot pause task in current status'
                });
            }
            logger.error('Error pausing task', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Complete task
     * PUT /api/v1/nurse/tasks/:id/complete
     */
    async completeTask(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                notes, 
                outcome,
                patient_response,
                complications 
            } = req.body;

            const task = await taskService.updateTaskStatus(
                req.user.id,
                id,
                'completed',
                { 
                    notes,
                    outcome,
                    patient_response,
                    complications,
                    completed_at: new Date()
                }
            );

            logger.info('Nurse completed task', {
                nurseId: req.user.id,
                taskId: id,
                patientId: task.patient_id,
                outcome
            });

            res.json({
                success: true,
                data: task,
                message: 'Task completed successfully'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            if (error.message === 'Invalid status transition') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot complete task in current status'
                });
            }
            logger.error('Error completing task', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Postpone task
     * PUT /api/v1/nurse/tasks/:id/postpone
     */
    async postponeTask(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                reason, 
                new_due_time,
                notes 
            } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Postpone reason is required'
                });
            }

            if (!new_due_time) {
                return res.status(400).json({
                    success: false,
                    error: 'New due time is required'
                });
            }

            const task = await taskService.postponeTask(
                req.user.id,
                id,
                {
                    reason,
                    new_due_time,
                    notes,
                    postponed_at: new Date()
                }
            );

            logger.info('Nurse postponed task', {
                nurseId: req.user.id,
                taskId: id,
                patientId: task.patient_id,
                reason,
                new_due_time
            });

            res.json({
                success: true,
                data: task,
                message: 'Task postponed successfully'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            if (error.message === 'Cannot postpone completed task') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot postpone completed task'
                });
            }
            logger.error('Error postponing task', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Reassign task
     * PUT /api/v1/nurse/tasks/:id/reassign
     */
    async reassignTask(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                assign_to, 
                reason,
                notes 
            } = req.body;

            if (!assign_to) {
                return res.status(400).json({
                    success: false,
                    error: 'Assignee ID is required'
                });
            }

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Reassignment reason is required'
                });
            }

            const task = await taskService.reassignTask(
                req.user.id,
                id,
                {
                    assign_to,
                    reason,
                    notes,
                    reassigned_at: new Date(),
                    reassigned_by: req.user.id
                }
            );

            logger.info('Nurse reassigned task', {
                nurseId: req.user.id,
                taskId: id,
                fromUser: req.user.id,
                toUser: assign_to,
                reason
            });

            res.json({
                success: true,
                data: task,
                message: 'Task reassigned successfully'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            if (error.message === 'Cannot reassign completed task') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot reassign completed task'
                });
            }
            if (error.message === 'Invalid assignee') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid assignee'
                });
            }
            logger.error('Error reassigning task', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // TASK STATISTICS
    // ============================================

    /**
     * Get task statistics
     * GET /api/v1/nurse/tasks/stats
     */
    async getTaskStats(req, res, next) {
        try {
            const { period = 'day', from_date, to_date } = req.query;

            const stats = await taskService.getTaskStatistics(
                req.user.id,
                {
                    period,
                    from_date,
                    to_date
                }
            );

            logger.info('Nurse viewed task statistics', {
                nurseId: req.user.id,
                period
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting task statistics', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get task completion rate
     * GET /api/v1/nurse/tasks/completion-rate
     */
    async getTaskCompletionRate(req, res, next) {
        try {
            const { days = 7 } = req.query;

            const rate = await taskService.getTaskCompletionRate(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: rate
            });
        } catch (error) {
            logger.error('Error getting task completion rate', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get overdue tasks
     * GET /api/v1/nurse/tasks/overdue
     */
    async getOverdueTasks(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const tasks = await taskService.getOverdueTasks(
                req.user.id,
                options
            );

            logger.info('Nurse viewed overdue tasks', {
                nurseId: req.user.id,
                count: tasks.data?.length || 0
            });

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    critical: tasks.data?.filter(t => t.priority === 'urgent').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting overdue tasks', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BULK TASK OPERATIONS
    // ============================================

    /**
     * Bulk complete tasks
     * POST /api/v1/nurse/tasks/bulk-complete
     */
    async bulkCompleteTasks(req, res, next) {
        try {
            const { task_ids, notes } = req.body;

            if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Task IDs array is required'
                });
            }

            const results = await taskService.bulkCompleteTasks(
                req.user.id,
                task_ids,
                { notes }
            );

            logger.info('Nurse bulk completed tasks', {
                nurseId: req.user.id,
                requestedCount: task_ids.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            });

            res.json({
                success: true,
                data: results,
                message: `Completed ${results.success.length} out of ${task_ids.length} tasks`
            });
        } catch (error) {
            logger.error('Error bulk completing tasks', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Bulk reassign tasks
     * POST /api/v1/nurse/tasks/bulk-reassign
     */
    async bulkReassignTasks(req, res, next) {
        try {
            const { task_ids, assign_to, reason } = req.body;

            if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Task IDs array is required'
                });
            }

            if (!assign_to) {
                return res.status(400).json({
                    success: false,
                    error: 'Assignee ID is required'
                });
            }

            const results = await taskService.bulkReassignTasks(
                req.user.id,
                task_ids,
                assign_to,
                { reason }
            );

            logger.info('Nurse bulk reassigned tasks', {
                nurseId: req.user.id,
                requestedCount: task_ids.length,
                successCount: results.success.length,
                failedCount: results.failed.length,
                assignTo: assign_to
            });

            res.json({
                success: true,
                data: results,
                message: `Reassigned ${results.success.length} out of ${task_ids.length} tasks`
            });
        } catch (error) {
            logger.error('Error bulk reassigning tasks', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // TASK COMMENTS & NOTES
    // ============================================

    /**
     * Add task comment
     * POST /api/v1/nurse/tasks/:id/comments
     */
    async addTaskComment(req, res, next) {
        try {
            const { id } = req.params;
            const { comment } = req.body;

            if (!comment || comment.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Comment must be at least 2 characters'
                });
            }

            const taskComment = await taskService.addTaskComment(
                req.user.id,
                id,
                {
                    comment,
                    created_at: new Date()
                }
            );

            logger.info('Nurse added task comment', {
                nurseId: req.user.id,
                taskId: id,
                commentId: taskComment.id
            });

            res.status(201).json({
                success: true,
                data: taskComment,
                message: 'Comment added successfully'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            logger.error('Error adding task comment', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get task comments
     * GET /api/v1/nurse/tasks/:id/comments
     */
    async getTaskComments(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const comments = await taskService.getTaskComments(
                req.user.id,
                id,
                options
            );

            res.json({
                success: true,
                data: comments.data,
                pagination: comments.pagination
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            logger.error('Error getting task comments', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = taskController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Task Lists             | 5         | All, pending, completed, priority, by ID
 * Task Status Updates    | 5         | Start, pause, complete, postpone, reassign
 * Task Statistics        | 3         | Stats, completion rate, overdue
 * Bulk Operations        | 2         | Bulk complete, bulk reassign
 * Task Comments          | 2         | Add comment, get comments
 * -----------------------|-----------|----------------------
 * TOTAL                  | 17        | Complete task management
 * 
 * ======================================================================
 */