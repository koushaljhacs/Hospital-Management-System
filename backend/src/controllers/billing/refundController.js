/**
 * ======================================================================
 * FILE: backend/src/controllers/billing/refundController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing refund controller - Handles refund processing and management.
 * Total Endpoints: 5
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-32] Refund only for paid invoices
 * 
 * ======================================================================
 */

const refundService = require('../../services/billing/refundService');
const logger = require('../../utils/logger');

const refundController = {
    // ============================================
    // REFUND LISTS
    // ============================================

    /**
     * Get all refunds
     * GET /api/v1/billing/refunds
     */
    async getAllRefunds(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                payment_id,
                invoice_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                payment_id,
                invoice_id,
                from_date,
                to_date
            };

            const refunds = await refundService.getAllRefunds(
                req.user.id,
                options
            );

            logger.info('Billing staff retrieved refunds', {
                staffId: req.user.id,
                count: refunds.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Calculate summary
            const summary = {
                total: refunds.summary?.total || 0,
                total_amount: refunds.summary?.total_amount || 0,
                pending_amount: refunds.data?.filter(r => r.status === 'pending')
                    .reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0,
                approved_amount: refunds.data?.filter(r => r.status === 'approved')
                    .reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0,
                completed_amount: refunds.data?.filter(r => r.status === 'completed')
                    .reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0,
                by_reason: {}
            };

            // Group by reason
            refunds.data?.forEach(r => {
                const reason = r.reason;
                if (!summary.by_reason[reason]) {
                    summary.by_reason[reason] = {
                        count: 0,
                        amount: 0
                    };
                }
                summary.by_reason[reason].count++;
                summary.by_reason[reason].amount += parseFloat(r.amount);
            });

            res.json({
                success: true,
                data: refunds.data,
                pagination: refunds.pagination,
                summary
            });
        } catch (error) {
            logger.error('Error getting all refunds', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending refunds
     * GET /api/v1/billing/refunds/pending
     */
    async getPendingRefunds(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const refunds = await refundService.getRefundsByStatus(
                req.user.id,
                'pending',
                options
            );

            logger.info('Billing staff viewed pending refunds', {
                staffId: req.user.id,
                count: refunds.data?.length || 0,
                totalAmount: refunds.summary?.total_amount || 0
            });

            res.json({
                success: true,
                data: refunds.data,
                pagination: refunds.pagination,
                summary: {
                    total: refunds.summary?.total || 0,
                    total_amount: refunds.summary?.total_amount || 0,
                    avg_amount: refunds.summary?.avg_amount || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending refunds', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed refunds
     * GET /api/v1/billing/refunds/completed
     */
    async getCompletedRefunds(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const refunds = await refundService.getRefundsByStatus(
                req.user.id,
                'completed',
                options
            );

            logger.info('Billing staff viewed completed refunds', {
                staffId: req.user.id,
                count: refunds.data?.length || 0,
                totalAmount: refunds.summary?.total_amount || 0
            });

            res.json({
                success: true,
                data: refunds.data,
                pagination: refunds.pagination,
                summary: {
                    total: refunds.summary?.total || 0,
                    total_amount: refunds.summary?.total_amount || 0,
                    avg_processing_time_days: refunds.summary?.avg_processing_days || 0
                }
            });
        } catch (error) {
            logger.error('Error getting completed refunds', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get refund by ID
     * GET /api/v1/billing/refunds/:id
     */
    async getRefundById(req, res, next) {
        try {
            const { id } = req.params;

            const refund = await refundService.getRefundById(
                req.user.id,
                id
            );

            if (!refund) {
                return res.status(404).json({
                    success: false,
                    error: 'Refund not found'
                });
            }

            logger.info('Billing staff viewed refund details', {
                staffId: req.user.id,
                refundId: id,
                paymentId: refund.payment_id,
                invoiceId: refund.invoice_id,
                amount: refund.amount,
                status: refund.status
            });

            // Get related payment and invoice details
            const payment = await refundService.getRelatedPayment(
                req.user.id,
                refund.payment_id
            );
            refund.payment = payment;

            const invoice = await refundService.getRelatedInvoice(
                req.user.id,
                refund.invoice_id
            );
            refund.invoice = invoice;

            res.json({
                success: true,
                data: refund
            });
        } catch (error) {
            if (error.message === 'Refund not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Refund not found'
                });
            }
            logger.error('Error getting refund by ID', {
                error: error.message,
                staffId: req.user.id,
                refundId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // REFUND OPERATIONS
    // ============================================

    /**
     * Process refund
     * POST /api/v1/billing/refunds
     * 
     * BUSINESS RULE: [BR-32] Refund only for paid invoices
     */
    async processRefund(req, res, next) {
        try {
            const {
                payment_id,
                invoice_id,
                amount,
                reason,
                notes,
                refund_method
            } = req.body;

            if (!payment_id && !invoice_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Either payment ID or invoice ID is required'
                });
            }

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount is required'
                });
            }

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Refund reason is required'
                });
            }

            // If invoice_id provided, find the payment
            let targetPaymentId = payment_id;
            if (invoice_id && !payment_id) {
                const payment = await refundService.getLatestPaymentForInvoice(
                    req.user.id,
                    invoice_id
                );
                if (!payment) {
                    return res.status(404).json({
                        success: false,
                        error: 'No payment found for this invoice'
                    });
                }
                targetPaymentId = payment.id;
            }

            // Validate payment exists and is eligible for refund
            const payment = await refundService.validatePaymentForRefund(
                req.user.id,
                targetPaymentId
            );

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            // [BR-32] Check if payment is from paid invoice
            if (payment.status !== 'completed') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot refund payment with status: ${payment.status}`
                });
            }

            // Check if refund amount exceeds payment amount
            if (amount > payment.amount) {
                return res.status(400).json({
                    success: false,
                    error: `Refund amount exceeds payment amount. Payment amount: ${payment.amount}`
                });
            }

            // Check if already refunded
            const existingRefund = await refundService.checkExistingRefund(
                req.user.id,
                targetPaymentId
            );

            if (existingRefund && existingRefund.status !== 'rejected') {
                return res.status(409).json({
                    success: false,
                    error: 'Refund already processed for this payment',
                    existing_refund: existingRefund
                });
            }

            const refund = await refundService.processRefund(
                req.user.id,
                {
                    payment_id: targetPaymentId,
                    invoice_id: payment.invoice_id,
                    amount,
                    reason,
                    notes,
                    refund_method: refund_method || payment.payment_method,
                    requested_by: req.user.id,
                    requested_at: new Date(),
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Billing staff processed refund request', {
                staffId: req.user.id,
                refundId: refund.id,
                paymentId: targetPaymentId,
                invoiceId: payment.invoice_id,
                amount,
                reason
            });

            res.status(201).json({
                success: true,
                data: refund,
                message: 'Refund request submitted successfully'
            });
        } catch (error) {
            if (error.message === 'Payment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }
            logger.error('Error processing refund', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Approve refund
     * PUT /api/v1/billing/refunds/:id/approve
     */
    async approveRefund(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const refund = await refundService.getRefundById(req.user.id, id);
            
            if (!refund) {
                return res.status(404).json({
                    success: false,
                    error: 'Refund not found'
                });
            }

            if (refund.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot approve refund with status: ${refund.status}`
                });
            }

            const approved = await refundService.approveRefund(
                req.user.id,
                id,
                {
                    notes,
                    approved_at: new Date(),
                    approved_by: req.user.id
                }
            );

            logger.info('Billing admin approved refund', {
                staffId: req.user.id,
                refundId: id,
                paymentId: refund.payment_id,
                amount: refund.amount
            });

            res.json({
                success: true,
                data: approved,
                message: 'Refund approved'
            });
        } catch (error) {
            if (error.message === 'Refund not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Refund not found'
                });
            }
            logger.error('Error approving refund', {
                error: error.message,
                staffId: req.user.id,
                refundId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Complete refund
     * PUT /api/v1/billing/refunds/:id/complete
     */
    async completeRefund(req, res, next) {
        try {
            const { id } = req.params;
            const { transaction_id, notes } = req.body;

            const refund = await refundService.getRefundById(req.user.id, id);
            
            if (!refund) {
                return res.status(404).json({
                    success: false,
                    error: 'Refund not found'
                });
            }

            if (refund.status !== 'approved') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot complete refund with status: ${refund.status}`
                });
            }

            const completed = await refundService.completeRefund(
                req.user.id,
                id,
                {
                    transaction_id,
                    notes,
                    completed_at: new Date(),
                    completed_by: req.user.id
                }
            );

            logger.info('Billing admin completed refund', {
                staffId: req.user.id,
                refundId: id,
                paymentId: refund.payment_id,
                amount: refund.amount,
                transactionId: transaction_id
            });

            res.json({
                success: true,
                data: completed,
                message: 'Refund completed successfully'
            });
        } catch (error) {
            if (error.message === 'Refund not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Refund not found'
                });
            }
            logger.error('Error completing refund', {
                error: error.message,
                staffId: req.user.id,
                refundId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = refundController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Refund Lists           | 3         | All, pending, completed, by ID
 * Refund Operations      | 3         | Process, approve, complete
 * -----------------------|-----------|----------------------
 * TOTAL                  | 6         | Complete refund management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-32] Refund only for paid invoices
 * 
 * ======================================================================
 */