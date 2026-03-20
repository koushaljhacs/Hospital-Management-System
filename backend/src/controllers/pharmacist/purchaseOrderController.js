/**
 * ======================================================================
 * FILE: backend/src/controllers/pharmacist/purchaseOrderController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist purchase order controller - Handles purchase order management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ENDPOINTS: 10 endpoints
 * ======================================================================
 */

const purchaseOrderService = require('../../services/pharmacist/purchaseOrderService');
const logger = require('../../utils/logger');

/**
 * Pharmacist Purchase Order Controller
 */
const purchaseOrderController = {
    // ============================================
    // PURCHASE ORDER LISTS
    // ============================================

    /**
     * Get all purchase orders
     * GET /api/v1/pharmacist/purchase-orders
     */
    async getAllPurchaseOrders(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                supplier_id,
                from_date,
                to_date,
                search
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                supplier_id,
                from_date,
                to_date,
                search
            };

            const purchaseOrders = await purchaseOrderService.getAllPurchaseOrders(
                req.user.id,
                options
            );

            logger.info('Pharmacist retrieved purchase orders', {
                pharmacistId: req.user.id,
                count: purchaseOrders.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: purchaseOrders.data,
                pagination: purchaseOrders.pagination,
                summary: purchaseOrders.summary
            });
        } catch (error) {
            logger.error('Error getting purchase orders', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending purchase orders
     * GET /api/v1/pharmacist/purchase-orders/pending
     */
    async getPendingPurchaseOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const purchaseOrders = await purchaseOrderService.getPurchaseOrdersByStatus(
                req.user.id,
                'pending',
                options
            );

            logger.info('Pharmacist viewed pending purchase orders', {
                pharmacistId: req.user.id,
                count: purchaseOrders.data?.length || 0,
                totalValue: purchaseOrders.summary?.total_value || 0
            });

            res.json({
                success: true,
                data: purchaseOrders.data,
                pagination: purchaseOrders.pagination,
                summary: {
                    total: purchaseOrders.summary?.total || 0,
                    total_value: purchaseOrders.summary?.total_value || 0,
                    expected_delivery_soon: purchaseOrders.data?.filter(po => {
                        const daysUntilDelivery = Math.ceil((new Date(po.expected_delivery) - new Date()) / (1000 * 60 * 60 * 24));
                        return daysUntilDelivery <= 3 && daysUntilDelivery >= 0;
                    }).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending purchase orders', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get approved purchase orders
     * GET /api/v1/pharmacist/purchase-orders/approved
     */
    async getApprovedPurchaseOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const purchaseOrders = await purchaseOrderService.getPurchaseOrdersByStatus(
                req.user.id,
                'approved',
                options
            );

            logger.info('Pharmacist viewed approved purchase orders', {
                pharmacistId: req.user.id,
                count: purchaseOrders.data?.length || 0
            });

            res.json({
                success: true,
                data: purchaseOrders.data,
                pagination: purchaseOrders.pagination,
                summary: purchaseOrders.summary
            });
        } catch (error) {
            logger.error('Error getting approved purchase orders', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get received purchase orders
     * GET /api/v1/pharmacist/purchase-orders/received
     */
    async getReceivedPurchaseOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const purchaseOrders = await purchaseOrderService.getPurchaseOrdersByStatus(
                req.user.id,
                'received',
                options
            );

            logger.info('Pharmacist viewed received purchase orders', {
                pharmacistId: req.user.id,
                count: purchaseOrders.data?.length || 0
            });

            res.json({
                success: true,
                data: purchaseOrders.data,
                pagination: purchaseOrders.pagination,
                summary: purchaseOrders.summary
            });
        } catch (error) {
            logger.error('Error getting received purchase orders', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get purchase order by ID
     * GET /api/v1/pharmacist/purchase-orders/:id
     */
    async getPurchaseOrderById(req, res, next) {
        try {
            const { id } = req.params;

            const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(
                req.user.id,
                id
            );

            if (!purchaseOrder) {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }

            logger.info('Pharmacist viewed purchase order', {
                pharmacistId: req.user.id,
                purchaseOrderId: id,
                poNumber: purchaseOrder.po_number,
                supplierName: purchaseOrder.supplier_name
            });

            res.json({
                success: true,
                data: purchaseOrder
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            logger.error('Error getting purchase order', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PURCHASE ORDER CRUD OPERATIONS
    // ============================================

    /**
     * Create purchase order
     * POST /api/v1/pharmacist/purchase-orders
     */
    async createPurchaseOrder(req, res, next) {
        try {
            const poData = {
                supplier_id: req.body.supplier_id,
                order_date: req.body.order_date || new Date(),
                expected_delivery: req.body.expected_delivery,
                items: req.body.items,
                subtotal: req.body.subtotal,
                discount: req.body.discount || 0,
                discount_type: req.body.discount_type,
                tax_amount: req.body.tax_amount || 0,
                tax_details: req.body.tax_details,
                shipping_cost: req.body.shipping_cost || 0,
                other_charges: req.body.other_charges || 0,
                total_amount: req.body.total_amount,
                currency: req.body.currency || 'INR',
                payment_terms: req.body.payment_terms,
                payment_due_date: req.body.payment_due_date,
                shipping_address: req.body.shipping_address,
                shipping_method: req.body.shipping_method,
                notes: req.body.notes,
                internal_notes: req.body.internal_notes,
                created_by: req.user.id,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!poData.supplier_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Supplier ID is required'
                });
            }

            if (!poData.expected_delivery) {
                return res.status(400).json({
                    success: false,
                    error: 'Expected delivery date is required'
                });
            }

            if (!poData.items || poData.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one item is required'
                });
            }

            // Validate items
            for (const item of poData.items) {
                if (!item.medicine_name) {
                    return res.status(400).json({
                        success: false,
                        error: 'Medicine name is required for all items'
                    });
                }
                if (!item.quantity || item.quantity <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Valid quantity is required for all items'
                    });
                }
                if (!item.unit_price || item.unit_price < 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Valid unit price is required for all items'
                    });
                }
            }

            const purchaseOrder = await purchaseOrderService.createPurchaseOrder(
                req.user.id,
                poData
            );

            logger.info('Pharmacist created purchase order', {
                pharmacistId: req.user.id,
                purchaseOrderId: purchaseOrder.id,
                poNumber: purchaseOrder.po_number,
                supplierId: poData.supplier_id,
                itemCount: poData.items.length,
                totalAmount: poData.total_amount
            });

            res.status(201).json({
                success: true,
                data: purchaseOrder,
                message: 'Purchase order created successfully'
            });
        } catch (error) {
            if (error.message.includes('Supplier not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error creating purchase order', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update purchase order
     * PUT /api/v1/pharmacist/purchase-orders/:id
     */
    async updatePurchaseOrder(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.po_number;
            delete updates.created_by;
            delete updates.created_at;

            const purchaseOrder = await purchaseOrderService.updatePurchaseOrder(
                req.user.id,
                id,
                updates
            );

            logger.info('Pharmacist updated purchase order', {
                pharmacistId: req.user.id,
                purchaseOrderId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: purchaseOrder,
                message: 'Purchase order updated successfully'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            if (error.message === 'Cannot update processed order') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update order that has been submitted or approved'
                });
            }
            logger.error('Error updating purchase order', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete purchase order
     * DELETE /api/v1/pharmacist/purchase-orders/:id
     */
    async deletePurchaseOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await purchaseOrderService.deletePurchaseOrder(
                req.user.id,
                id,
                reason
            );

            logger.info('Pharmacist deleted purchase order', {
                pharmacistId: req.user.id,
                purchaseOrderId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Purchase order deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            if (error.message === 'Cannot delete processed order') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete order that has been submitted or approved'
                });
            }
            logger.error('Error deleting purchase order', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PURCHASE ORDER WORKFLOW
    // ============================================

    /**
     * Submit purchase order for approval
     * PUT /api/v1/pharmacist/purchase-orders/:id/submit
     */
    async submitPurchaseOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const purchaseOrder = await purchaseOrderService.submitPurchaseOrder(
                req.user.id,
                id,
                { notes }
            );

            logger.info('Pharmacist submitted purchase order for approval', {
                pharmacistId: req.user.id,
                purchaseOrderId: id,
                poNumber: purchaseOrder.po_number
            });

            res.json({
                success: true,
                data: purchaseOrder,
                message: 'Purchase order submitted for approval'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            if (error.message === 'Invalid status transition') {
                return res.status(400).json({
                    success: false,
                    error: 'Purchase order cannot be submitted in current status'
                });
            }
            logger.error('Error submitting purchase order', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Receive purchase order
     * PUT /api/v1/pharmacist/purchase-orders/:id/receive
     */
    async receivePurchaseOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                received_items,
                received_date,
                received_notes,
                quality_check_passed,
                quality_check_notes
            } = req.body;

            if (!received_items || received_items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Received items are required'
                });
            }

            const purchaseOrder = await purchaseOrderService.receivePurchaseOrder(
                req.user.id,
                id,
                {
                    received_items,
                    received_date: received_date || new Date(),
                    received_notes,
                    quality_check_passed,
                    quality_check_notes,
                    received_by: req.user.id
                }
            );

            logger.info('Pharmacist received purchase order', {
                pharmacistId: req.user.id,
                purchaseOrderId: id,
                poNumber: purchaseOrder.po_number,
                itemsReceived: received_items.length
            });

            res.json({
                success: true,
                data: purchaseOrder,
                message: 'Purchase order received successfully'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            if (error.message.includes('Invalid status')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error receiving purchase order', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Approve purchase order (admin only)
     * PUT /api/v1/pharmacist/purchase-orders/:id/approve
     */
    async approvePurchaseOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            // This endpoint would typically be in admin module
            // But keeping for completeness
            const purchaseOrder = await purchaseOrderService.approvePurchaseOrder(
                req.user.id,
                id,
                { notes }
            );

            logger.info('Purchase order approved', {
                userId: req.user.id,
                purchaseOrderId: id,
                poNumber: purchaseOrder.po_number
            });

            res.json({
                success: true,
                data: purchaseOrder,
                message: 'Purchase order approved'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            if (error.message === 'Insufficient permissions') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to approve purchase orders'
                });
            }
            logger.error('Error approving purchase order', {
                error: error.message,
                userId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Reject purchase order
     * PUT /api/v1/pharmacist/purchase-orders/:id/reject
     */
    async rejectPurchaseOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Rejection reason is required'
                });
            }

            const purchaseOrder = await purchaseOrderService.rejectPurchaseOrder(
                req.user.id,
                id,
                reason
            );

            logger.info('Purchase order rejected', {
                userId: req.user.id,
                purchaseOrderId: id,
                reason
            });

            res.json({
                success: true,
                data: purchaseOrder,
                message: 'Purchase order rejected'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            if (error.message === 'Invalid status transition') {
                return res.status(400).json({
                    success: false,
                    error: 'Purchase order cannot be rejected in current status'
                });
            }
            logger.error('Error rejecting purchase order', {
                error: error.message,
                userId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Cancel purchase order
     * PUT /api/v1/pharmacist/purchase-orders/:id/cancel
     */
    async cancelPurchaseOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Cancellation reason is required'
                });
            }

            const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(
                req.user.id,
                id,
                reason
            );

            logger.info('Purchase order cancelled', {
                pharmacistId: req.user.id,
                purchaseOrderId: id,
                reason
            });

            res.json({
                success: true,
                data: purchaseOrder,
                message: 'Purchase order cancelled'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            if (error.message === 'Cannot cancel received order') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot cancel received order'
                });
            }
            logger.error('Error cancelling purchase order', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PURCHASE ORDER ITEMS
    // ============================================

    /**
     * Get purchase order items
     * GET /api/v1/pharmacist/purchase-orders/:id/items
     */
    async getPurchaseOrderItems(req, res, next) {
        try {
            const { id } = req.params;

            const items = await purchaseOrderService.getPurchaseOrderItems(
                req.user.id,
                id
            );

            if (!items) {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }

            logger.info('Pharmacist viewed purchase order items', {
                pharmacistId: req.user.id,
                purchaseOrderId: id,
                itemCount: items.length
            });

            res.json({
                success: true,
                data: items,
                summary: {
                    total_items: items.length,
                    total_quantity: items.reduce((acc, i) => acc + i.quantity, 0),
                    total_value: items.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0)
                }
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            logger.error('Error getting purchase order items', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update purchase order item
     * PUT /api/v1/pharmacist/purchase-orders/:orderId/items/:itemId
     */
    async updatePurchaseOrderItem(req, res, next) {
        try {
            const { orderId, itemId } = req.params;
            const updates = req.body;

            const item = await purchaseOrderService.updatePurchaseOrderItem(
                req.user.id,
                orderId,
                itemId,
                updates
            );

            logger.info('Pharmacist updated purchase order item', {
                pharmacistId: req.user.id,
                purchaseOrderId: orderId,
                itemId
            });

            res.json({
                success: true,
                data: item,
                message: 'Item updated successfully'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found' || error.message === 'Item not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            if (error.message === 'Cannot update processed order') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update items after order submission'
                });
            }
            logger.error('Error updating purchase order item', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.orderId,
                itemId: req.params.itemId
            });
            next(error);
        }
    },

    /**
     * Delete purchase order item
     * DELETE /api/v1/pharmacist/purchase-orders/:orderId/items/:itemId
     */
    async deletePurchaseOrderItem(req, res, next) {
        try {
            const { orderId, itemId } = req.params;

            await purchaseOrderService.deletePurchaseOrderItem(
                req.user.id,
                orderId,
                itemId
            );

            logger.info('Pharmacist deleted purchase order item', {
                pharmacistId: req.user.id,
                purchaseOrderId: orderId,
                itemId
            });

            res.json({
                success: true,
                message: 'Item deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found' || error.message === 'Item not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            if (error.message === 'Cannot delete from processed order') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete items after order submission'
                });
            }
            logger.error('Error deleting purchase order item', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.orderId,
                itemId: req.params.itemId
            });
            next(error);
        }
    },

    // ============================================
    // PURCHASE ORDER PAYMENTS
    // ============================================

    /**
     * Get purchase order payments
     * GET /api/v1/pharmacist/purchase-orders/:id/payments
     */
    async getPurchaseOrderPayments(req, res, next) {
        try {
            const { id } = req.params;

            const payments = await purchaseOrderService.getPurchaseOrderPayments(
                req.user.id,
                id
            );

            res.json({
                success: true,
                data: payments
            });
        } catch (error) {
            logger.error('Error getting purchase order payments', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Record payment for purchase order
     * POST /api/v1/pharmacist/purchase-orders/:id/payments
     */
    async recordPurchaseOrderPayment(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                amount,
                payment_date,
                payment_method,
                reference_number,
                notes 
            } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount is required'
                });
            }

            const payment = await purchaseOrderService.recordPurchaseOrderPayment(
                req.user.id,
                id,
                {
                    amount,
                    payment_date: payment_date || new Date(),
                    payment_method,
                    reference_number,
                    notes,
                    recorded_by: req.user.id
                }
            );

            logger.info('Pharmacist recorded purchase order payment', {
                pharmacistId: req.user.id,
                purchaseOrderId: id,
                amount,
                method: payment_method
            });

            res.status(201).json({
                success: true,
                data: payment,
                message: 'Payment recorded successfully'
            });
        } catch (error) {
            if (error.message === 'Purchase order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Purchase order not found'
                });
            }
            if (error.message === 'Payment exceeds balance') {
                return res.status(400).json({
                    success: false,
                    error: 'Payment amount exceeds remaining balance'
                });
            }
            logger.error('Error recording purchase order payment', {
                error: error.message,
                pharmacistId: req.user.id,
                purchaseOrderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PURCHASE ORDER REPORTS
    // ============================================

    /**
     * Get purchase order statistics
     * GET /api/v1/pharmacist/purchase-orders/statistics
     */
    async getPurchaseOrderStatistics(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const stats = await purchaseOrderService.getPurchaseOrderStatistics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting purchase order statistics', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export purchase orders
     * GET /api/v1/pharmacist/purchase-orders/export
     */
    async exportPurchaseOrders(req, res, next) {
        try {
            const { format = 'csv', from_date, to_date, status } = req.query;

            const data = await purchaseOrderService.exportPurchaseOrders(
                req.user.id,
                format,
                { from_date, to_date, status }
            );

            logger.info('Pharmacist exported purchase orders', {
                pharmacistId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=purchase-orders-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting purchase orders', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = purchaseOrderController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * PO Lists               | 5         | All, pending, approved, received, by ID
 * CRUD Operations        | 3         | Create, update, delete
 * Workflow               | 5         | Submit, receive, approve, reject, cancel
 * PO Items               | 3         | Get items, update item, delete item
 * Payments               | 2         | Get payments, record payment
 * Reports                | 2         | Statistics, export
 * -----------------------|-----------|----------------------
 * TOTAL                  | 20        | Complete purchase order management
 * 
 * ======================================================================
 */