/**
 * ======================================================================
 * FILE: backend/src/controllers/doctor/labController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor's lab order management controller.
 * Allows doctors to order lab tests and view results.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical values require immediate notification
 * - [BR-37] Test results need verification
 * - [BR-38] Abnormal results flagged automatically
 * - [BR-39] Sample collection to result < 24 hours
 * - [BR-40] Duplicate test not allowed within 7 days
 * 
 * ENDPOINTS:
 * GET    /doctor/lab-orders                    - All lab orders
 * GET    /doctor/lab-orders/pending              - Pending lab orders
 * GET    /doctor/lab-orders/completed             - Completed lab orders
 * GET    /doctor/lab-orders/urgent                 - Urgent lab orders
 * GET    /doctor/lab-orders/stat                    - STAT lab orders
 * GET    /doctor/lab-orders/:id                       - Get lab order by ID
 * POST   /doctor/lab-orders                             - Create lab order
 * PUT    /doctor/lab-orders/:id                          - Update lab order
 * DELETE /doctor/lab-orders/:id                           - Delete lab order
 * GET    /doctor/lab-orders/:id/results                    - Get lab results
 * GET    /doctor/lab-tests                                  - Available lab tests
 * GET    /doctor/lab-tests/:id                                - Get test details
 * GET    /doctor/lab-tests/categories                          - Test categories
 * POST   /doctor/lab-orders/:id/cancel                          - Cancel lab order
 * GET    /doctor/lab-orders/stats                                - Lab order statistics
 * 
 * ======================================================================
 */

const labService = require('../../services/doctor/labService');
const logger = require('../../utils/logger');

/**
 * Doctor Lab Controller
 */
const labController = {
    // ============================================
    // LAB ORDER LISTS
    // ============================================

    /**
     * Get all lab orders
     * GET /api/v1/doctor/lab-orders
     */
    async getLabOrders(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                patient_id,
                status,
                from_date,
                to_date,
                priority
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id,
                status,
                from_date,
                to_date,
                priority
            };

            const orders = await labService.getLabOrders(
                req.user.id,
                options
            );

            logger.info('Doctor retrieved lab orders', {
                doctorId: req.user.id,
                count: orders.data?.length || 0
            });

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination
            });
        } catch (error) {
            logger.error('Error getting lab orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending lab orders
     * GET /api/v1/doctor/lab-orders/pending
     */
    async getPendingLabOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const orders = await labService.getPendingLabOrders(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination
            });
        } catch (error) {
            logger.error('Error getting pending lab orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed lab orders
     * GET /api/v1/doctor/lab-orders/completed
     */
    async getCompletedLabOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const orders = await labService.getCompletedLabOrders(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination
            });
        } catch (error) {
            logger.error('Error getting completed lab orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get urgent lab orders
     * GET /api/v1/doctor/lab-orders/urgent
     */
    async getUrgentLabOrders(req, res, next) {
        try {
            const orders = await labService.getUrgentLabOrders(req.user.id);

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            logger.error('Error getting urgent lab orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get STAT lab orders (emergency)
     * GET /api/v1/doctor/lab-orders/stat
     */
    async getSTATLabOrders(req, res, next) {
        try {
            const orders = await labService.getSTATLabOrders(req.user.id);

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            logger.error('Error getting STAT lab orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get lab order by ID
     * GET /api/v1/doctor/lab-orders/:id
     */
    async getLabOrderById(req, res, next) {
        try {
            const { id } = req.params;

            const order = await labService.getLabOrderById(
                req.user.id,
                id
            );

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Lab order not found'
                });
            }

            logger.info('Doctor viewed lab order', {
                doctorId: req.user.id,
                orderId: id
            });

            res.json({
                success: true,
                data: order
            });
        } catch (error) {
            if (error.message === 'Lab order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Lab order not found'
                });
            }
            logger.error('Error getting lab order by ID', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // CREATE/UPDATE LAB ORDERS
    // ============================================

    /**
     * Create new lab order
     * POST /api/v1/doctor/lab-orders
     * 
     * BUSINESS RULES:
     * - [BR-40] Duplicate test not allowed within 7 days
     */
    async createLabOrder(req, res, next) {
        try {
            const {
                patient_id,
                appointment_id,
                test_ids,
                priority,
                clinical_notes,
                diagnosis,
                special_instructions,
                is_urgent,
                is_stat
            } = req.body;

            // Validate required fields
            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!test_ids || test_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one test is required'
                });
            }

            // Check for duplicate tests [BR-40]
            const duplicateCheck = await labService.checkDuplicateTests(
                req.user.id,
                patient_id,
                test_ids
            );

            if (duplicateCheck.hasDuplicates) {
                return res.status(409).json({
                    success: false,
                    error: 'Some tests were already ordered in the last 7 days',
                    duplicates: duplicateCheck.duplicateTests
                });
            }

            const order = await labService.createLabOrder(
                req.user.id,
                {
                    patient_id,
                    appointment_id,
                    test_ids,
                    priority: priority || 'routine',
                    clinical_notes,
                    diagnosis,
                    special_instructions,
                    is_urgent: is_urgent || false,
                    is_stat: is_stat || false,
                    ordered_at: new Date()
                }
            );

            logger.info('Doctor created lab order', {
                doctorId: req.user.id,
                orderId: order.id,
                patientId: patient_id,
                testCount: test_ids.length,
                priority: priority
            });

            // [BR-36] Critical value notification if urgent/stat
            if (is_urgent || is_stat) {
                await labService.notifyLabOfUrgentOrder(order.id);
            }

            res.status(201).json({
                success: true,
                data: order,
                message: 'Lab order created successfully'
            });
        } catch (error) {
            logger.error('Error creating lab order', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.body.patient_id
            });
            next(error);
        }
    },

    /**
     * Update lab order
     * PUT /api/v1/doctor/lab-orders/:id
     */
    async updateLabOrder(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Can't update if already processed
            const order = await labService.getLabOrderById(req.user.id, id);
            
            if (order && order.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update order that is already processed'
                });
            }

            const updated = await labService.updateLabOrder(
                req.user.id,
                id,
                updates
            );

            logger.info('Doctor updated lab order', {
                doctorId: req.user.id,
                orderId: id
            });

            res.json({
                success: true,
                data: updated,
                message: 'Lab order updated successfully'
            });
        } catch (error) {
            if (error.message === 'Lab order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Lab order not found'
                });
            }
            logger.error('Error updating lab order', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete lab order (only if pending)
     * DELETE /api/v1/doctor/lab-orders/:id
     */
    async deleteLabOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await labService.deleteLabOrder(
                req.user.id,
                id,
                reason
            );

            logger.info('Doctor deleted lab order', {
                doctorId: req.user.id,
                orderId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Lab order deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Lab order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Lab order not found'
                });
            }
            if (error.message === 'Cannot delete processed order') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error deleting lab order', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Cancel lab order
     * POST /api/v1/doctor/lab-orders/:id/cancel
     */
    async cancelLabOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Cancellation reason is required'
                });
            }

            const order = await labService.cancelLabOrder(
                req.user.id,
                id,
                reason
            );

            logger.info('Doctor cancelled lab order', {
                doctorId: req.user.id,
                orderId: id,
                reason
            });

            res.json({
                success: true,
                data: order,
                message: 'Lab order cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Lab order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Lab order not found'
                });
            }
            if (error.message === 'Cannot cancel completed order') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error cancelling lab order', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // LAB RESULTS
    // ============================================

    /**
     * Get lab results for an order
     * GET /api/v1/doctor/lab-orders/:id/results
     * 
     * BUSINESS RULES:
     * - [BR-36] Critical values highlighted
     * - [BR-37] Verified results only
     * - [BR-38] Abnormal results flagged
     */
    async getLabResults(req, res, next) {
        try {
            const { id } = req.params;

            const results = await labService.getLabResults(
                req.user.id,
                id
            );

            if (!results) {
                return res.status(404).json({
                    success: false,
                    error: 'Lab results not found'
                });
            }

            logger.info('Doctor viewed lab results', {
                doctorId: req.user.id,
                orderId: id,
                resultCount: results.results?.length || 0
            });

            // [BR-36] Check for critical values
            const criticalResults = results.results?.filter(r => r.is_critical) || [];
            if (criticalResults.length > 0) {
                logger.warn('Critical lab values viewed', {
                    doctorId: req.user.id,
                    orderId: id,
                    criticalCount: criticalResults.length
                });
            }

            res.json({
                success: true,
                data: results,
                summary: {
                    total: results.results?.length || 0,
                    critical: criticalResults.length,
                    abnormal: results.results?.filter(r => r.is_abnormal).length || 0,
                    pending: results.results?.filter(r => r.status === 'pending').length || 0
                }
            });
        } catch (error) {
            if (error.message === 'Results not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Lab results not found'
                });
            }
            logger.error('Error getting lab results', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Download lab results as PDF
     * GET /api/v1/doctor/lab-orders/:id/results/pdf
     */
    async downloadLabResultsPDF(req, res, next) {
        try {
            const { id } = req.params;

            const pdfBuffer = await labService.generateLabResultsPDF(
                req.user.id,
                id
            );

            if (!pdfBuffer) {
                return res.status(404).json({
                    success: false,
                    error: 'Lab results not found'
                });
            }

            logger.info('Doctor downloaded lab results PDF', {
                doctorId: req.user.id,
                orderId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=lab-results-${id}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Results not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Lab results not found'
                });
            }
            logger.error('Error downloading lab results PDF', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // LAB TESTS CATALOG
    // ============================================

    /**
     * Get available lab tests
     * GET /api/v1/doctor/lab-tests
     */
    async getAvailableLabTests(req, res, next) {
        try {
            const { category, search } = req.query;

            const tests = await labService.getAvailableLabTests({
                category,
                search
            });

            res.json({
                success: true,
                data: tests,
                summary: {
                    total: tests.length,
                    categories: [...new Set(tests.map(t => t.category))]
                }
            });
        } catch (error) {
            logger.error('Error getting lab tests', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get lab test by ID
     * GET /api/v1/doctor/lab-tests/:id
     */
    async getLabTestById(req, res, next) {
        try {
            const { id } = req.params;

            const test = await labService.getLabTestById(id);

            if (!test) {
                return res.status(404).json({
                    success: false,
                    error: 'Lab test not found'
                });
            }

            res.json({
                success: true,
                data: test
            });
        } catch (error) {
            logger.error('Error getting lab test by ID', {
                error: error.message,
                doctorId: req.user.id,
                testId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get lab test categories
     * GET /api/v1/doctor/lab-tests/categories
     */
    async getLabTestCategories(req, res, next) {
        try {
            const categories = await labService.getLabTestCategories();

            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            logger.error('Error getting lab test categories', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Search lab tests
     * GET /api/v1/doctor/lab-tests/search
     */
    async searchLabTests(req, res, next) {
        try {
            const { q } = req.query;

            if (!q || q.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Search term must be at least 2 characters'
                });
            }

            const results = await labService.searchLabTests(q);

            res.json({
                success: true,
                data: results,
                count: results.length
            });
        } catch (error) {
            logger.error('Error searching lab tests', {
                error: error.message,
                doctorId: req.user.id,
                searchTerm: req.query.q
            });
            next(error);
        }
    },

    // ============================================
    // LAB ORDER STATISTICS
    // ============================================

    /**
     * Get lab order statistics
     * GET /api/v1/doctor/lab-orders/stats
     */
    async getLabOrderStats(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const stats = await labService.getLabOrderStats(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting lab order stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending results count
     * GET /api/v1/doctor/lab-orders/pending-count
     */
    async getPendingResultsCount(req, res, next) {
        try {
            const count = await labService.getPendingResultsCount(
                req.user.id
            );

            res.json({
                success: true,
                data: { pending_count: count }
            });
        } catch (error) {
            logger.error('Error getting pending results count', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BULK OPERATIONS
    // ============================================

    /**
     * Create multiple lab orders at once
     * POST /api/v1/doctor/lab-orders/bulk
     */
    async createBulkLabOrders(req, res, next) {
        try {
            const { orders } = req.body;

            if (!orders || !Array.isArray(orders) || orders.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one order is required'
                });
            }

            const results = await labService.createBulkLabOrders(
                req.user.id,
                orders
            );

            logger.info('Doctor created bulk lab orders', {
                doctorId: req.user.id,
                requestedCount: orders.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            });

            res.status(201).json({
                success: true,
                data: results,
                message: `Created ${results.success.length} out of ${orders.length} orders`
            });
        } catch (error) {
            logger.error('Error creating bulk lab orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Reorder previous lab tests
     * POST /api/v1/doctor/lab-orders/reorder/:id
     */
    async reorderLabTests(req, res, next) {
        try {
            const { id } = req.params;
            const { modifications } = req.body;

            const newOrder = await labService.reorderLabTests(
                req.user.id,
                id,
                modifications
            );

            logger.info('Doctor reordered lab tests', {
                doctorId: req.user.id,
                originalOrderId: id,
                newOrderId: newOrder.id
            });

            res.status(201).json({
                success: true,
                data: newOrder,
                message: 'Lab tests reordered successfully'
            });
        } catch (error) {
            if (error.message === 'Original order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Original lab order not found'
                });
            }
            logger.error('Error reordering lab tests', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // NOTIFICATIONS & ALERTS
    // ============================================

    /**
     * Get critical results alerts
     * GET /api/v1/doctor/lab-orders/critical-alerts
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getCriticalAlerts(req, res, next) {
        try {
            const alerts = await labService.getCriticalAlerts(req.user.id);

            res.json({
                success: true,
                data: alerts,
                count: alerts.length
            });
        } catch (error) {
            logger.error('Error getting critical alerts', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Mark critical alert as acknowledged
     * PUT /api/v1/doctor/lab-orders/alerts/:id/acknowledge
     */
    async acknowledgeCriticalAlert(req, res, next) {
        try {
            const { id } = req.params;

            const alert = await labService.acknowledgeCriticalAlert(
                req.user.id,
                id
            );

            logger.info('Doctor acknowledged critical alert', {
                doctorId: req.user.id,
                alertId: id
            });

            res.json({
                success: true,
                data: alert,
                message: 'Alert acknowledged'
            });
        } catch (error) {
            if (error.message === 'Alert not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found'
                });
            }
            logger.error('Error acknowledging critical alert', {
                error: error.message,
                doctorId: req.user.id,
                alertId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = labController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Business Rules
 * -----------------------|-----------|----------------------
 * Lab Order Lists        | 6         | Filter by status, priority
 * CRUD Operations        | 4         | Create, update, delete, cancel
 * Lab Results            | 2         | [BR-36][BR-37][BR-38][BR-39]
 * Lab Tests Catalog      | 4         | Test information
 * Statistics             | 2         | Usage analytics
 * Bulk Operations        | 2         | Multiple orders
 * Notifications          | 2         | [BR-36] Critical alerts
 * -----------------------|-----------|----------------------
 * TOTAL                  | 22        | Complete lab management
 * 
 * ======================================================================
 */