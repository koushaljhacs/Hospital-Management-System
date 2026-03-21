/**
 * ======================================================================
 * FILE: backend/src/controllers/billing/paymentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing payment controller - Handles payment processing and management.
 * Total Endpoints: 9
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-31] Payment must be verified before invoice marked paid
 * 
 * ======================================================================
 */

const paymentService = require('../../services/billing/paymentService');
const logger = require('../../utils/logger');

const paymentController = {
    // ============================================
    // PAYMENT LISTS
    // ============================================

    /**
     * Get all payments
     * GET /api/v1/billing/payments
     */
    async getAllPayments(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                payment_method,
                invoice_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                payment_method,
                invoice_id,
                from_date,
                to_date
            };

            const payments = await paymentService.getAllPayments(
                req.user.id,
                options
            );

            logger.info('Billing staff retrieved payments', {
                staffId: req.user.id,
                count: payments.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: payments.data,
                pagination: payments.pagination,
                summary: payments.summary
            });
        } catch (error) {
            logger.error('Error getting all payments', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get online payments
     * GET /api/v1/billing/payments/online
     */
    async getOnlinePayments(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const payments = await paymentService.getPaymentsByMethod(
                req.user.id,
                ['card', 'upi', 'net_banking'],
                options
            );

            logger.info('Billing staff viewed online payments', {
                staffId: req.user.id,
                count: payments.data?.length || 0
            });

            res.json({
                success: true,
                data: payments.data,
                pagination: payments.pagination,
                summary: payments.summary
            });
        } catch (error) {
            logger.error('Error getting online payments', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get cash payments
     * GET /api/v1/billing/payments/cash
     */
    async getCashPayments(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const payments = await paymentService.getPaymentsByMethod(
                req.user.id,
                ['cash'],
                options
            );

            logger.info('Billing staff viewed cash payments', {
                staffId: req.user.id,
                count: payments.data?.length || 0
            });

            res.json({
                success: true,
                data: payments.data,
                pagination: payments.pagination,
                summary: payments.summary
            });
        } catch (error) {
            logger.error('Error getting cash payments', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get card payments
     * GET /api/v1/billing/payments/card
     */
    async getCardPayments(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const payments = await paymentService.getPaymentsByMethod(
                req.user.id,
                ['card'],
                options
            );

            logger.info('Billing staff viewed card payments', {
                staffId: req.user.id,
                count: payments.data?.length || 0
            });

            res.json({
                success: true,
                data: payments.data,
                pagination: payments.pagination,
                summary: payments.summary
            });
        } catch (error) {
            logger.error('Error getting card payments', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get UPI payments
     * GET /api/v1/billing/payments/upi
     */
    async getUpiPayments(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const payments = await paymentService.getPaymentsByMethod(
                req.user.id,
                ['upi'],
                options
            );

            logger.info('Billing staff viewed UPI payments', {
                staffId: req.user.id,
                count: payments.data?.length || 0
            });

            res.json({
                success: true,
                data: payments.data,
                pagination: payments.pagination,
                summary: payments.summary
            });
        } catch (error) {
            logger.error('Error getting UPI payments', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get payment by ID
     * GET /api/v1/billing/payments/:id
     */
    async getPaymentById(req, res, next) {
        try {
            const { id } = req.params;

            const payment = await paymentService.getPaymentById(
                req.user.id,
                id
            );

            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            logger.info('Billing staff viewed payment details', {
                staffId: req.user.id,
                paymentId: id,
                invoiceId: payment.invoice_id,
                amount: payment.amount,
                status: payment.status
            });

            // Get related invoice details
            const invoice = await paymentService.getRelatedInvoice(
                req.user.id,
                payment.invoice_id
            );
            payment.invoice = invoice;

            res.json({
                success: true,
                data: payment
            });
        } catch (error) {
            if (error.message === 'Payment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }
            logger.error('Error getting payment by ID', {
                error: error.message,
                staffId: req.user.id,
                paymentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PAYMENT OPERATIONS
    // ============================================

    /**
     * Record payment
     * POST /api/v1/billing/payments
     * 
     * BUSINESS RULE: [BR-31] Payment must be verified before invoice marked paid
     */
    async recordPayment(req, res, next) {
        try {
            const {
                invoice_id,
                amount,
                payment_method,
                payment_date,
                reference_number,
                notes
            } = req.body;

            if (!invoice_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Invoice ID is required'
                });
            }

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount is required'
                });
            }

            if (!payment_method) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment method is required'
                });
            }

            // Check invoice exists and is valid for payment
            const invoice = await paymentService.validateInvoiceForPayment(
                req.user.id,
                invoice_id
            );

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            if (invoice.status !== 'approved' && invoice.status !== 'partial') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot process payment for invoice with status: ${invoice.status}`
                });
            }

            // Check if payment amount exceeds balance
            const balanceDue = invoice.total_amount - (invoice.paid_amount || 0);
            if (amount > balanceDue) {
                return res.status(400).json({
                    success: false,
                    error: `Payment amount exceeds balance due. Balance: ${balanceDue}`
                });
            }

            const payment = await paymentService.recordPayment(
                req.user.id,
                {
                    invoice_id,
                    amount,
                    payment_method,
                    payment_date: payment_date || new Date(),
                    reference_number,
                    notes,
                    recorded_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Billing staff recorded payment', {
                staffId: req.user.id,
                paymentId: payment.id,
                invoiceId: invoice_id,
                amount,
                method: payment_method
            });

            res.status(201).json({
                success: true,
                data: payment,
                message: 'Payment recorded successfully'
            });
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error recording payment', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Process online payment
     * POST /api/v1/billing/payments/online
     */
    async processOnlinePayment(req, res, next) {
        try {
            const {
                invoice_id,
                amount,
                payment_method,
                gateway,
                return_url,
                customer_details
            } = req.body;

            if (!invoice_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Invoice ID is required'
                });
            }

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount is required'
                });
            }

            if (!payment_method) {
                return res.status(400).json({
                    success: false,
                    error: 'Payment method is required'
                });
            }

            // Validate invoice
            const invoice = await paymentService.validateInvoiceForPayment(
                req.user.id,
                invoice_id
            );

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            // Create payment order
            const order = await paymentService.createPaymentOrder(
                req.user.id,
                {
                    invoice_id,
                    amount,
                    payment_method,
                    gateway: gateway || 'razorpay',
                    return_url,
                    customer_details,
                    created_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Billing staff initiated online payment', {
                staffId: req.user.id,
                orderId: order.id,
                invoiceId: invoice_id,
                amount,
                gateway
            });

            res.status(201).json({
                success: true,
                data: order,
                message: 'Payment order created. Redirect to payment gateway.'
            });
        } catch (error) {
            logger.error('Error processing online payment', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Verify payment
     * PUT /api/v1/billing/payments/:id/verify
     * 
     * BUSINESS RULE: [BR-31] Payment must be verified before invoice marked paid
     */
    async verifyPayment(req, res, next) {
        try {
            const { id } = req.params;
            const { verified, notes, transaction_id } = req.body;

            if (verified === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Verification status is required'
                });
            }

            const payment = await paymentService.getPaymentById(req.user.id, id);
            
            if (!payment) {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }

            if (payment.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot verify payment with status: ${payment.status}`
                });
            }

            const verifiedPayment = await paymentService.verifyPayment(
                req.user.id,
                id,
                {
                    verified,
                    notes,
                    transaction_id,
                    verified_at: new Date(),
                    verified_by: req.user.id
                }
            );

            logger.info('Billing staff verified payment', {
                staffId: req.user.id,
                paymentId: id,
                invoiceId: payment.invoice_id,
                verified,
                amount: payment.amount
            });

            res.json({
                success: true,
                data: verifiedPayment,
                message: verified ? 'Payment verified successfully' : 'Payment verification failed'
            });
        } catch (error) {
            if (error.message === 'Payment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Payment not found'
                });
            }
            logger.error('Error verifying payment', {
                error: error.message,
                staffId: req.user.id,
                paymentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get payment summary
     * GET /api/v1/billing/payments/summary
     */
    async getPaymentSummary(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const summary = await paymentService.getPaymentSummary(
                req.user.id,
                { from_date, to_date }
            );

            logger.info('Billing staff viewed payment summary', {
                staffId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            logger.error('Error getting payment summary', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = paymentController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Payment Lists          | 5         | All, online, cash, card, UPI, by ID
 * Payment Operations     | 2         | Record payment, process online
 * Verification           | 1         | Verify payment
 * Summary                | 1         | Payment summary
 * -----------------------|-----------|----------------------
 * TOTAL                  | 9         | Complete payment management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-31] Payment verification before invoice update
 * 
 * ======================================================================
 */