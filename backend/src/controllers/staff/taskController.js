/**
 * ======================================================================
 * FILE: backend/src/controllers/staff/taskController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Ground Staff task controller - Handles task management.
 * Total Endpoints: 11
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-46] Tasks must be acknowledged within 30 minutes
 * 
 * ======================================================================
 */

const taskService = require('../../services/staff/taskService');
const logger = require('../../utils/logger');

const taskController = {
    // ============================================
    // TASK LISTS
    // ============================================

    /**
     * Get all tasks
     * GET /api/v1/staff/tasks
     */
    async getAllTasks(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                priority,
                assigned_to,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                priority,
                assigned_to,
                from_date,
                to_date
            };

            const tasks = await taskService.getAllTasks(
                req.user.id,
                options
            );

            logger.info('Ground staff retrieved tasks', {
                staffId: req.user.id,
                count: tasks.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Calculate summary
            const summary = {
                total: tasks.summary?.total || 0,
                pending: tasks.summary?.pending || 0,
                in_progress: tasks.summary?.in_progress || 0,
                completed: tasks.summary?.completed || 0,
                overdue: tasks.data?.filter(t => {
                    if (t.status === 'pending' && t.created_at) {
                        const created = new Date(t.created_at);
                        const minutesSince = (Date.now() - created) / (1000 * 60);
                        return minutesSince > 30;
                    }
                    return false;
                }).length || 0
            };

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary
            });
        } catch (error) {
            logger.error('Error getting all tasks', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending tasks
     * GET /api/v1/staff/tasks/pending
     */
    async getPendingTasks(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const tasks = await taskService.getTasksByStatus(
                req.user.id,
                'pending',
                options
            );

            logger.info('Ground staff viewed pending tasks', {
                staffId: req.user.id,
                count: tasks.data?.length || 0
            });

            // [BR-46] Check for tasks pending > 30 minutes
            const now = new Date();
            const overdueTasks = tasks.data?.filter(t => {
                const created = new Date(t.created_at);
                const minutesSince = (now - created) / (1000 * 60);
                return minutesSince > 30;
            }).length || 0;

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    overdue: overdueTasks,
                    high_priority: tasks.data?.filter(t => t.priority === 'high').length || 0,
                    urgent: tasks.data?.filter(t => t.priority === 'urgent').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending tasks', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed tasks
     * GET /api/v1/staff/tasks/completed
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

            logger.info('Ground staff viewed completed tasks', {
                staffId: req.user.id,
                count: tasks.data?.length || 0
            });

            // Calculate average completion time
            const avgCompletionTime = tasks.data?.reduce((sum, t) => {
                if (t.completed_at && t.created_at) {
                    const minutes = (new Date(t.completed_at) - new Date(t.created_at)) / (1000 * 60);
                    return sum + minutes;
                }
                return sum;
            }, 0) / (tasks.data?.length || 1);

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    avg_completion_time_minutes: Math.round(avgCompletionTime),
                    on_time: tasks.data?.filter(t => {
                        if (t.completed_at && t.created_at) {
                            const minutes = (new Date(t.completed_at) - new Date(t.created_at)) / (1000 * 60);
                            return minutes <= 30;
                        }
                        return false;
                    }).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting completed tasks', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's tasks
     * GET /api/v1/staff/tasks/today
     */
    async getTodayTasks(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const tasks = await taskService.getTodayTasks(
                req.user.id,
                options
            );

            logger.info('Ground staff viewed today\'s tasks', {
                staffId: req.user.id,
                count: tasks.data?.length || 0
            });

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    by_priority: {
                        urgent: tasks.data?.filter(t => t.priority === 'urgent').length || 0,
                        high: tasks.data?.filter(t => t.priority === 'high').length || 0,
                        medium: tasks.data?.filter(t => t.priority === 'medium').length || 0,
                        low: tasks.data?.filter(t => t.priority === 'low').length || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s tasks', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get tasks by priority
     * GET /api/v1/staff/tasks/priority
     */
    async getTasksByPriority(req, res, next) {
        try {
            const { priority, page = 1, limit = 20 } = req.query;

            if (!priority) {
                return res.status(400).json({
                    success: false,
                    error: 'Priority is required'
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

            logger.info('Ground staff viewed tasks by priority', {
                staffId: req.user.id,
                priority,
                count: tasks.data?.length || 0
            });

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    pending: tasks.data?.filter(t => t.status === 'pending').length || 0,
                    in_progress: tasks.data?.filter(t => t.status === 'in_progress').length || 0,
                    completed: tasks.data?.filter(t => t.status === 'completed').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting tasks by priority', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get task by ID
     * GET /api/v1/staff/tasks/:id
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

            logger.info('Ground staff viewed task details', {
                staffId: req.user.id,
                taskId: id,
                status: task.status,
                priority: task.priority
            });

            // [BR-46] Check if task is overdue
            if (task.status === 'pending') {
                const created = new Date(task.created_at);
                const minutesSince = (Date.now() - created) / (1000 * 60);
                task.is_overdue = minutesSince > 30;
                task.minutes_pending = Math.floor(minutesSince);
            }

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
                staffId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // TASK OPERATIONS
    // ============================================

    /**
     * Accept task
     * PUT /api/v1/staff/tasks/:id/accept
     * 
     * BUSINESS RULE: [BR-46] Tasks must be acknowledged within 30 minutes
     */
    async acceptTask(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const task = await taskService.getTaskById(req.user.id, id);
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }

            // [BR-46] Check if task is still within acknowledgment window
            const created = new Date(task.created_at);
            const minutesSince = (Date.now() - created) / (1000 * 60);
            
            if (minutesSince > 30) {
                return res.status(409).json({
                    success: false,
                    error: 'Task acknowledgment window has expired (30 minutes)',
                    minutes_overdue: Math.floor(minutesSince - 30)
                });
            }

            if (task.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot accept task with status: ${task.status}`
                });
            }

            const accepted = await taskService.acceptTask(
                req.user.id,
                id,
                {
                    notes,
                    accepted_at: new Date(),
                    accepted_by: req.user.id
                }
            );

            logger.info('Ground staff accepted task', {
                staffId: req.user.id,
                taskId: id,
                minutesSinceCreation: Math.floor(minutesSince)
            });

            res.json({
                success: true,
                data: accepted,
                message: 'Task accepted successfully'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            logger.error('Error accepting task', {
                error: error.message,
                staffId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Reject task
     * PUT /api/v1/staff/tasks/:id/reject
     */
    async rejectTask(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Rejection reason is required'
                });
            }

            const task = await taskService.getTaskById(req.user.id, id);
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }

            if (task.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot reject task with status: ${task.status}`
                });
            }

            const rejected = await taskService.rejectTask(
                req.user.id,
                id,
                {
                    reason,
                    rejected_at: new Date(),
                    rejected_by: req.user.id
                }
            );

            logger.info('Ground staff rejected task', {
                staffId: req.user.id,
                taskId: id,
                reason
            });

            res.json({
                success: true,
                data: rejected,
                message: 'Task rejected'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            logger.error('Error rejecting task', {
                error: error.message,
                staffId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Start task
     * PUT /api/v1/staff/tasks/:id/start
     */
    async startTask(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const task = await taskService.getTaskById(req.user.id, id);
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }

            if (task.status !== 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot start task with status: ${task.status}`
                });
            }

            const started = await taskService.startTask(
                req.user.id,
                id,
                {
                    notes,
                    started_at: new Date(),
                    started_by: req.user.id
                }
            );

            logger.info('Ground staff started task', {
                staffId: req.user.id,
                taskId: id
            });

            res.json({
                success: true,
                data: started,
                message: 'Task started'
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            logger.error('Error starting task', {
                error: error.message,
                staffId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Complete task
     * PUT /api/v1/staff/tasks/:id/complete
     */
    async completeTask(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, completion_notes } = req.body;

            const task = await taskService.getTaskById(req.user.id, id);
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }

            if (task.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot complete task with status: ${task.status}`
                });
            }

            const completed = await taskService.completeTask(
                req.user.id,
                id,
                {
                    notes,
                    completion_notes,
                    completed_at: new Date(),
                    completed_by: req.user.id
                }
            );

            // Calculate completion time
            const startedAt = new Date(task.started_at);
            const completedAt = new Date(completed.completed_at);
            const completionMinutes = (completedAt - startedAt) / (1000 * 60);

            logger.info('Ground staff completed task', {
                staffId: req.user.id,
                taskId: id,
                completionTimeMinutes: Math.floor(completionMinutes)
            });

            res.json({
                success: true,
                data: completed,
                message: 'Task completed',
                completion_time_minutes: Math.floor(completionMinutes)
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            logger.error('Error completing task', {
                error: error.message,
                staffId: req.user.id,
                taskId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Postpone task
     * PUT /api/v1/staff/tasks/:id/postpone
     */
    async postponeTask(req, res, next) {
        try {
            const { id } = req.params;
            const { reason, postpone_until } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Postpone reason is required'
                });
            }

            const task = await taskService.getTaskById(req.user.id, id);
            
            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }

            if (task.status !== 'accepted' && task.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot postpone task with status: ${task.status}`
                });
            }

            const postponed = await taskService.postponeTask(
                req.user.id,
                id,
                {
                    reason,
                    postpone_until: postpone_until || new Date(Date.now() + 60 * 60 * 1000),
                    postponed_at: new Date(),
                    postponed_by: req.user.id
                }
            );

            logger.info('Ground staff postponed task', {
                staffId: req.user.id,
                taskId: id,
                reason
            });

            res.json({
                success: true,
                data: postponed,
                message: `Task postponed until ${new Date(postponed.postpone_until).toLocaleString()}`
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Task not found'
                });
            }
            logger.error('Error postponing task', {
                error: error.message,
                staffId: req.user.id,
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
 * Task Lists             | 5         | All, pending, completed, today, by priority
 * Single Task            | 1         | Get by ID
 * Task Operations        | 5         | Accept, reject, start, complete, postpone
 * -----------------------|-----------|----------------------
 * TOTAL                  | 11        | Complete task management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-46] 30-minute acknowledgment window
 * 
 * ======================================================================
 */