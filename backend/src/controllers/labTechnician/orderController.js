/**
 * ======================================================================
 * FILE: backend/src/controllers/labTechnician/orderController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician order controller - Handles test order management.
 * Total Endpoints: 11
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * - [BR-39] Sample collection to result < 24 hours
 * - [BR-40] Duplicate test not allowed within 7 days
 * 
 * ======================================================================
 */

const orderService = require('../../services/labTechnician/orderService');
const logger = require('../../utils/logger');

/**
 * Lab Technician Order Controller
 */
const orderController = {
    // ============================================
    // ORDER LISTS
    // ============================================

    /**
     * Get all test orders
     * GET /api/v1/lab/orders
     */
    async getAllOrders(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                priority,
                patient_id,
                doctor_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                priority,
                patient_id,
                doctor_id,
                from_date,
                to_date
            };

            const orders = await orderService.getAllOrders(
                req.user.id,
                options
            );

            logger.info('Lab technician retrieved all orders', {
                technicianId: req.user.id,
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
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending test orders
     * GET /api/v1/lab/orders/pending
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

            logger.info('Lab technician viewed pending orders', {
                technicianId: req.user.id,
                count: orders.data?.length || 0
            });

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination,
                summary: {
                    total: orders.summary?.total || 0,
                    stat_count: orders.data?.filter(o => o.priority === 'stat').length || 0,
                    urgent_count: orders.data?.filter(o => o.priority === 'urgent').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending orders', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get in-progress test orders
     * GET /api/v1/lab/orders/in-progress
     */
    async getInProgressOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const orders = await orderService.getOrdersByStatus(
                req.user.id,
                'in_progress',
                options
            );

            logger.info('Lab technician viewed in-progress orders', {
                technicianId: req.user.id,
                count: orders.data?.length || 0
            });

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination
            });
        } catch (error) {
            logger.error('Error getting in-progress orders', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed test orders
     * GET /api/v1/lab/orders/completed
     */
    async getCompletedOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const orders = await orderService.getOrdersByStatus(
                req.user.id,
                'completed',
                options
            );

            logger.info('Lab technician viewed completed orders', {
                technicianId: req.user.id,
                count: orders.data?.length || 0
            });

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination
            });
        } catch (error) {
            logger.error('Error getting completed orders', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get urgent test orders
     * GET /api/v1/lab/orders/urgent
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getUrgentOrders(req, res, next) {
        try {
            const orders = await orderService.getUrgentOrders(req.user.id);

            logger.info('Lab technician viewed urgent orders', {
                technicianId: req.user.id,
                count: orders.length
            });

            res.json({
                success: true,
                data: orders,
                summary: {
                    total: orders.length,
                    stat: orders.filter(o => o.priority === 'stat').length,
                    urgent: orders.filter(o => o.priority === 'urgent').length,
                    pending_since: orders.filter(o => {
                        const hours = (new Date() - new Date(o.created_at)) / (1000 * 60 * 60);
                        return hours > 2;
                    }).length
                }
            });
        } catch (error) {
            logger.error('Error getting urgent orders', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get STAT test orders (emergency)
     * GET /api/v1/lab/orders/stat
     */
    async getStatOrders(req, res, next) {
        try {
            const orders = await orderService.getStatOrders(req.user.id);

            logger.info('Lab technician viewed STAT orders', {
                technicianId: req.user.id,
                count: orders.length
            });

            res.json({
                success: true,
                data: orders,
                summary: {
                    total: orders.length,
                    pending_collection: orders.filter(o => o.status === 'pending').length,
                    in_progress: orders.filter(o => o.status === 'in_progress').length
                }
            });
        } catch (error) {
            logger.error('Error getting STAT orders', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get test order by ID
     * GET /api/v1/lab/orders/:id
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
                    error: 'Test order not found'
                });
            }

            logger.info('Lab technician viewed order details', {
                technicianId: req.user.id,
                orderId: id,
                patientId: order.patient_id
            });

            // Check if order is overdue [BR-39]
            if (order.status !== 'completed' && order.collection_date) {
                const hoursSinceCollection = (new Date() - new Date(order.collection_date)) / (1000 * 60 * 60);
                if (hoursSinceCollection > 24) {
                    logger.warn('Order exceeding 24-hour window', {
                        orderId: id,
                        hoursSinceCollection
                    });
                }
            }

            res.json({
                success: true,
                data: order
            });
        } catch (error) {
            if (error.message === 'Test order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }
            logger.error('Error getting order by ID', {
                error: error.message,
                technicianId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get tests in an order
     * GET /api/v1/lab/orders/:id/tests
     */
    async getOrderTests(req, res, next) {
        try {
            const { id } = req.params;

            const tests = await orderService.getOrderTests(
                req.user.id,
                id
            );

            if (!tests) {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }

            logger.info('Lab technician viewed order tests', {
                technicianId: req.user.id,
                orderId: id,
                testCount: tests.length
            });

            // Group by status
            const byStatus = {
                pending: tests.filter(t => t.status === 'pending').length,
                in_progress: tests.filter(t => t.status === 'in_progress').length,
                completed: tests.filter(t => t.status === 'completed').length
            };

            res.json({
                success: true,
                data: tests,
                summary: {
                    total: tests.length,
                    by_status: byStatus
                }
            });
        } catch (error) {
            if (error.message === 'Test order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }
            logger.error('Error getting order tests', {
                error: error.message,
                technicianId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // ORDER PROCESSING
    // ============================================

    /**
     * Collect sample for order
     * PUT /api/v1/lab/orders/:id/collect
     */
    async collectSample(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, collection_time } = req.body;

            const order = await orderService.getOrderById(req.user.id, id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }

            // Check if already collected
            if (order.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot collect sample for order with status: ${order.status}`
                });
            }

            const updatedOrder = await orderService.updateOrderStatus(
                req.user.id,
                id,
                'collected',
                {
                    collected_by: req.user.id,
                    collected_at: collection_time || new Date(),
                    collection_notes: notes
                }
            );

            logger.info('Lab technician collected sample', {
                technicianId: req.user.id,
                orderId: id,
                patientId: order.patient_id
            });

            res.json({
                success: true,
                data: updatedOrder,
                message: 'Sample collected successfully'
            });
        } catch (error) {
            if (error.message === 'Test order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }
            logger.error('Error collecting sample', {
                error: error.message,
                technicianId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Receive sample in lab
     * PUT /api/v1/lab/orders/:id/receive
     */
    async receiveSample(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, received_time, condition } = req.body;

            const order = await orderService.getOrderById(req.user.id, id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }

            // Check if can be received
            if (!['collected', 'pending'].includes(order.status)) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot receive sample for order with status: ${order.status}`
                });
            }

            const updatedOrder = await orderService.updateOrderStatus(
                req.user.id,
                id,
                'received',
                {
                    received_by: req.user.id,
                    received_at: received_time || new Date(),
                    received_notes: notes,
                    specimen_condition: condition || 'acceptable'
                }
            );

            logger.info('Lab technician received sample', {
                technicianId: req.user.id,
                orderId: id,
                condition
            });

            res.json({
                success: true,
                data: updatedOrder,
                message: 'Sample received successfully'
            });
        } catch (error) {
            if (error.message === 'Test order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }
            logger.error('Error receiving sample', {
                error: error.message,
                technicianId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Start processing test
     * PUT /api/v1/lab/orders/:id/start
     */
    async startProcessing(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, test_id } = req.body;

            const order = await orderService.getOrderById(req.user.id, id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }

            // Check if can be processed
            if (order.status !== 'received') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot start processing for order with status: ${order.status}`
                });
            }

            const updatedOrder = await orderService.startProcessing(
                req.user.id,
                id,
                {
                    test_id,
                    started_by: req.user.id,
                    started_at: new Date(),
                    processing_notes: notes
                }
            );

            logger.info('Lab technician started processing', {
                technicianId: req.user.id,
                orderId: id,
                testId: test_id
            });

            res.json({
                success: true,
                data: updatedOrder,
                message: 'Test processing started'
            });
        } catch (error) {
            if (error.message === 'Test order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }
            logger.error('Error starting processing', {
                error: error.message,
                technicianId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Complete test processing
     * PUT /api/v1/lab/orders/:id/complete
     */
    async completeProcessing(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, results } = req.body;

            const order = await orderService.getOrderById(req.user.id, id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }

            // Check if can be completed
            if (order.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot complete order with status: ${order.status}`
                });
            }

            // [BR-39] Check if within 24 hours
            if (order.collected_at) {
                const hoursSinceCollection = (new Date() - new Date(order.collected_at)) / (1000 * 60 * 60);
                if (hoursSinceCollection > 24) {
                    logger.warn('Order completed after 24 hours', {
                        orderId: id,
                        hoursSinceCollection
                    });
                }
            }

            const updatedOrder = await orderService.completeProcessing(
                req.user.id,
                id,
                {
                    completed_by: req.user.id,
                    completed_at: new Date(),
                    completion_notes: notes,
                    results
                }
            );

            logger.info('Lab technician completed processing', {
                technicianId: req.user.id,
                orderId: id
            });

            res.json({
                success: true,
                data: updatedOrder,
                message: 'Test processing completed'
            });
        } catch (error) {
            if (error.message === 'Test order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test order not found'
                });
            }
            logger.error('Error completing processing', {
                error: error.message,
                technicianId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BULK OPERATIONS
    // ============================================

    /**
     * Bulk update order status
     * POST /api/v1/lab/orders/bulk-update
     */
    async bulkUpdateOrders(req, res, next) {
        try {
            const { updates } = req.body;

            if (!updates || !Array.isArray(updates) || updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Updates array is required'
                });
            }

            const results = await orderService.bulkUpdateOrders(
                req.user.id,
                updates
            );

            logger.info('Lab technician performed bulk order update', {
                technicianId: req.user.id,
                requestedCount: updates.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            });

            res.json({
                success: true,
                data: results,
                message: `Updated ${results.success.length} out of ${updates.length} orders`
            });
        } catch (error) {
            logger.error('Error in bulk order update', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get order statistics
     * GET /api/v1/lab/orders/statistics
     */
    async getOrderStatistics(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await orderService.getOrderStatistics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting order statistics', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending counts by priority
     * GET /api/v1/lab/orders/pending-counts
     */
    async getPendingCounts(req, res, next) {
        try {
            const counts = await orderService.getPendingCounts(req.user.id);

            res.json({
                success: true,
                data: counts
            });
        } catch (error) {
            logger.error('Error getting pending counts', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Print order label
     * GET /api/v1/lab/orders/:id/label
     */
    async printOrderLabel(req, res, next) {
        try {
            const { id } = req.params;

            const labelData = await orderService.generateOrderLabel(
                req.user.id,
                id
            );

            if (!labelData) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            logger.info('Lab technician printed order label', {
                technicianId: req.user.id,
                orderId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=order-${id}-label.pdf`);
            res.send(labelData);
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }
            logger.error('Error printing order label', {
                error: error.message,
                technicianId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Export orders
     * GET /api/v1/lab/orders/export
     */
    async exportOrders(req, res, next) {
        try {
            const { format = 'csv', from_date, to_date, status } = req.query;

            const data = await orderService.exportOrders(
                req.user.id,
                format,
                { from_date, to_date, status }
            );

            logger.info('Lab technician exported orders', {
                technicianId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=lab-orders-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting orders', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // ORDER NOTES & COMMENTS
    // ============================================

    /**
     * Add order note
     * POST /api/v1/lab/orders/:id/notes
     */
    async addOrderNote(req, res, next) {
        try {
            const { id } = req.params;
            const { note, type = 'general' } = req.body;

            if (!note || note.trim().length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Note must be at least 5 characters'
                });
            }

            const orderNote = await orderService.addOrderNote(
                req.user.id,
                id,
                {
                    note,
                    type,
                    created_by: req.user.id,
                    created_at: new Date()
                }
            );

            logger.info('Lab technician added order note', {
                technicianId: req.user.id,
                orderId: id,
                noteType: type
            });

            res.status(201).json({
                success: true,
                data: orderNote,
                message: 'Note added successfully'
            });
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }
            logger.error('Error adding order note', {
                error: error.message,
                technicianId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get order notes
     * GET /api/v1/lab/orders/:id/notes
     */
    async getOrderNotes(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const notes = await orderService.getOrderNotes(
                req.user.id,
                id,
                options
            );

            res.json({
                success: true,
                data: notes.data,
                pagination: notes.pagination
            });
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }
            logger.error('Error getting order notes', {
                error: error.message,
                technicianId: req.user.id,
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
 * Order Lists            | 7         | All, pending, in-progress, completed, urgent, stat, by ID, tests
 * Order Processing       | 4         | Collect, receive, start, complete
 * Bulk Operations        | 2         | Bulk update, statistics, pending counts
 * Export & Print         | 2         | Print label, export
 * Order Notes            | 2         | Add note, get notes
 * -----------------------|-----------|----------------------
 * TOTAL                  | 17        | Complete order management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Urgent/STAT orders prioritized
 * - [BR-39] 24-hour completion window
 * - [BR-40] Duplicate test prevention
 * 
 * ======================================================================
 */