/**
 * ======================================================================
 * FILE: backend/src/controllers/radiologist/orderController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist order controller - Handles radiology order management.
 * Total Endpoints: 7
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-20
 * 
 * BUSINESS RULES:
 * - [BR-41] Critical findings require immediate notification
 * - [BR-42] Reports need verification before finalization
 * - [BR-43] Images must be reviewed within 24 hours
 * 
 * ======================================================================
 */

const orderService = require('../../services/radiologist/orderService');
const logger = require('../../utils/logger');

/**
 * Radiologist Order Controller
 */
const orderController = {
    // ============================================
    // ORDER LISTS
    // ============================================

    /**
     * Get all radiology orders
     * GET /api/v1/radiology/orders
     */
    async getAllOrders(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                patient_id,
                from_date,
                to_date,
                priority
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                patient_id,
                from_date,
                to_date,
                priority
            };

            const orders = await orderService.getAllOrders(
                req.user.id,
                options
            );

            logger.info('Radiologist retrieved all orders', {
                radiologistId: req.user.id,
                count: orders.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination,
                summary: orders.summary
            });
        } catch (error) {
            logger.error('Error getting all orders', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending orders
     * GET /api/v1/radiology/orders/pending
     */
    async getPendingOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const orders = await orderService.getOrdersByStatus(
                req.user.id,
                'pending',
                options
            );

            logger.info('Radiologist viewed pending orders', {
                radiologistId: req.user.id,
                count: orders.data?.length || 0
            });

            // [BR-43] Check for orders pending > 24 hours
            const overdueOrders = orders.data?.filter(o => {
                const orderedAt = new Date(o.ordered_at);
                const hoursSinceOrder = (Date.now() - orderedAt) / (1000 * 60 * 60);
                return hoursSinceOrder > 24;
            }).length || 0;

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination,
                summary: {
                    total: orders.summary?.total || 0,
                    overdue: overdueOrders,
                    urgent: orders.data?.filter(o => o.priority === 'urgent').length || 0,
                    stat: orders.data?.filter(o => o.priority === 'stat').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending orders', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed orders
     * GET /api/v1/radiology/orders/completed
     */
    async getCompletedOrders(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const orders = await orderService.getOrdersByStatus(
                req.user.id,
                'completed',
                options
            );

            logger.info('Radiologist viewed completed orders', {
                radiologistId: req.user.id,
                count: orders.data?.length || 0
            });

            // Calculate average turnaround time
            const avgTurnaround = orders.data?.reduce((sum, o) => {
                if (o.completed_at && o.ordered_at) {
                    const turnaround = (new Date(o.completed_at) - new Date(o.ordered_at)) / (1000 * 60 * 60);
                    return sum + turnaround;
                }
                return sum;
            }, 0) / (orders.data?.length || 1);

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination,
                summary: {
                    total: orders.summary?.total || 0,
                    avg_turnaround_hours: avgTurnaround.toFixed(1),
                    with_critical_findings: orders.data?.filter(o => o.critical_finding).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting completed orders', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get urgent orders
     * GET /api/v1/radiology/orders/urgent
     * 
     * BUSINESS RULE: [BR-41] Critical findings require immediate notification
     */
    async getUrgentOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const orders = await orderService.getUrgentOrders(
                req.user.id,
                options
            );

            logger.info('Radiologist viewed urgent orders', {
                radiologistId: req.user.id,
                count: orders.data?.length || 0
            });

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination,
                summary: {
                    total: orders.summary?.total || 0,
                    stat: orders.data?.filter(o => o.priority === 'stat').length || 0,
                    emergency: orders.data?.filter(o => o.is_emergency).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting urgent orders', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get order by ID
     * GET /api/v1/radiology/orders/:id
     */
    async getOrderById(req, res, next) {
        try {
            const { id } = req.params;

            const order = await orderService.getOrderById(
                req.user.id,
                id
            );

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            logger.info('Radiologist viewed order details', {
                radiologistId: req.user.id,
                orderId: id,
                patientId: order.patient_id,
                priority: order.priority
            });

            // [BR-43] Check if order is pending beyond 24 hours
            if (order.status === 'pending') {
                const orderedAt = new Date(order.ordered_at);
                const hoursSinceOrder = (Date.now() - orderedAt) / (1000 * 60 * 60);
                order.is_overdue = hoursSinceOrder > 24;
                order.hours_pending = Math.floor(hoursSinceOrder);
            }

            // Check for existing images
            if (order.images && order.images.length > 0) {
                order.image_count = order.images.length;
                order.has_images = true;
            }

            res.json({
                success: true,
                data: order
            });
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }
            logger.error('Error getting order by ID', {
                error: error.message,
                radiologistId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Start processing order
     * PUT /api/v1/radiology/orders/:id/start
     */
    async startOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const order = await orderService.getOrderById(req.user.id, id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            if (order.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot start order with status: ${order.status}`
                });
            }

            const started = await orderService.startOrder(
                req.user.id,
                id,
                {
                    notes,
                    started_at: new Date(),
                    started_by: req.user.id
                }
            );

            logger.info('Radiologist started processing order', {
                radiologistId: req.user.id,
                orderId: id,
                patientId: order.patient_id
            });

            res.json({
                success: true,
                data: started,
                message: 'Order processing started'
            });
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }
            logger.error('Error starting order', {
                error: error.message,
                radiologistId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Complete order
     * PUT /api/v1/radiology/orders/:id/complete
     */
    async completeOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, findings_summary } = req.body;

            const order = await orderService.getOrderById(req.user.id, id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            if (order.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot complete order with status: ${order.status}`
                });
            }

            // Check if report exists
            const hasReport = await orderService.hasReport(req.user.id, id);
            
            if (!hasReport) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot complete order without report'
                });
            }

            const completed = await orderService.completeOrder(
                req.user.id,
                id,
                {
                    notes,
                    findings_summary,
                    completed_at: new Date(),
                    completed_by: req.user.id
                }
            );

            // Calculate turnaround time
            const orderedAt = new Date(order.ordered_at);
            const completedAt = new Date(completed.completed_at);
            const turnaroundHours = (completedAt - orderedAt) / (1000 * 60 * 60);

            logger.info('Radiologist completed order', {
                radiologistId: req.user.id,
                orderId: id,
                patientId: order.patient_id,
                turnaroundHours: turnaroundHours.toFixed(1)
            });

            res.json({
                success: true,
                data: completed,
                message: 'Order completed successfully',
                turnaround_hours: turnaroundHours.toFixed(1)
            });
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }
            logger.error('Error completing order', {
                error: error.message,
                radiologistId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = orderController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Order Lists            | 4         | All orders, pending, completed, urgent
 * Single Order           | 1         | Get by ID
 * Order Workflow         | 2         | Start order, complete order
 * -----------------------|-----------|----------------------
 * TOTAL                  | 7         | Complete order management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-41] Critical findings flagged in urgent orders
 * - [BR-42] Complete order only after report exists
 * - [BR-43] Overdue detection for pending >24 hours
 * 
 * ======================================================================
 */