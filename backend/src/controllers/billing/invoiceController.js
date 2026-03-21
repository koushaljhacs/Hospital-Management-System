/**
 * ======================================================================
 * FILE: backend/src/controllers/billing/invoiceController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing invoice controller - Handles invoice management.
 * Total Endpoints: 17
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-30] Invoice must have unique invoice number
 * - [BR-31] Payment must be verified before invoice marked paid
 * - [BR-34] Discount cannot exceed maximum allowed
 * - [BR-35] Tax calculation follows government rules
 * 
 * ======================================================================
 */

const invoiceService = require('../../services/billing/invoiceService');
const logger = require('../../utils/logger');

const invoiceController = {
    // ============================================
    // INVOICE LISTS
    // ============================================

    /**
     * Get all invoices
     * GET /api/v1/billing/invoices
     */
    async getAllInvoices(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                patient_id,
                from_date,
                to_date,
                min_amount,
                max_amount
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                patient_id,
                from_date,
                to_date,
                min_amount: min_amount ? parseFloat(min_amount) : undefined,
                max_amount: max_amount ? parseFloat(max_amount) : undefined
            };

            const invoices = await invoiceService.getAllInvoices(
                req.user.id,
                options
            );

            logger.info('Billing staff retrieved invoices', {
                staffId: req.user.id,
                count: invoices.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Calculate summary statistics
            const summary = {
                total: invoices.summary?.total || 0,
                total_amount: invoices.summary?.total_amount || 0,
                paid_amount: invoices.summary?.paid_amount || 0,
                pending_amount: invoices.summary?.pending_amount || 0,
                overdue_amount: invoices.summary?.overdue_amount || 0,
                by_status: {
                    draft: invoices.data?.filter(i => i.status === 'draft').length || 0,
                    submitted: invoices.data?.filter(i => i.status === 'submitted').length || 0,
                    approved: invoices.data?.filter(i => i.status === 'approved').length || 0,
                    paid: invoices.data?.filter(i => i.status === 'paid').length || 0,
                    cancelled: invoices.data?.filter(i => i.status === 'cancelled').length || 0,
                    rejected: invoices.data?.filter(i => i.status === 'rejected').length || 0
                }
            };

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                summary
            });
        } catch (error) {
            logger.error('Error getting all invoices', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get draft invoices
     * GET /api/v1/billing/invoices/draft
     */
    async getDraftInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const invoices = await invoiceService.getInvoicesByStatus(
                req.user.id,
                'draft',
                options
            );

            logger.info('Billing staff viewed draft invoices', {
                staffId: req.user.id,
                count: invoices.data?.length || 0
            });

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                summary: {
                    total: invoices.summary?.total || 0,
                    total_amount: invoices.data?.reduce((sum, i) => sum + parseFloat(i.total_amount), 0) || 0
                }
            });
        } catch (error) {
            logger.error('Error getting draft invoices', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending invoices
     * GET /api/v1/billing/invoices/pending
     */
    async getPendingInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const invoices = await invoiceService.getInvoicesByStatus(
                req.user.id,
                ['submitted', 'approved'],
                options
            );

            logger.info('Billing staff viewed pending invoices', {
                staffId: req.user.id,
                count: invoices.data?.length || 0
            });

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                summary: {
                    total: invoices.summary?.total || 0,
                    total_amount: invoices.data?.reduce((sum, i) => sum + parseFloat(i.total_amount), 0) || 0,
                    awaiting_approval: invoices.data?.filter(i => i.status === 'submitted').length || 0,
                    approved: invoices.data?.filter(i => i.status === 'approved').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending invoices', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get paid invoices
     * GET /api/v1/billing/invoices/paid
     */
    async getPaidInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const invoices = await invoiceService.getInvoicesByStatus(
                req.user.id,
                'paid',
                options
            );

            logger.info('Billing staff viewed paid invoices', {
                staffId: req.user.id,
                count: invoices.data?.length || 0
            });

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                summary: {
                    total: invoices.summary?.total || 0,
                    total_amount: invoices.data?.reduce((sum, i) => sum + parseFloat(i.total_amount), 0) || 0,
                    total_paid: invoices.data?.reduce((sum, i) => sum + parseFloat(i.paid_amount), 0) || 0
                }
            });
        } catch (error) {
            logger.error('Error getting paid invoices', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get overdue invoices
     * GET /api/v1/billing/invoices/overdue
     */
    async getOverdueInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const invoices = await invoiceService.getOverdueInvoices(
                req.user.id,
                options
            );

            logger.info('Billing staff viewed overdue invoices', {
                staffId: req.user.id,
                count: invoices.data?.length || 0,
                totalOverdue: invoices.summary?.total_overdue || 0
            });

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                summary: {
                    total: invoices.summary?.total || 0,
                    total_amount: invoices.summary?.total_amount || 0,
                    overdue_days_avg: invoices.summary?.avg_overdue_days || 0
                }
            });
        } catch (error) {
            logger.error('Error getting overdue invoices', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get cancelled invoices
     * GET /api/v1/billing/invoices/cancelled
     */
    async getCancelledInvoices(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const invoices = await invoiceService.getInvoicesByStatus(
                req.user.id,
                'cancelled',
                options
            );

            logger.info('Billing staff viewed cancelled invoices', {
                staffId: req.user.id,
                count: invoices.data?.length || 0
            });

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                summary: {
                    total: invoices.summary?.total || 0,
                    total_amount: invoices.data?.reduce((sum, i) => sum + parseFloat(i.total_amount), 0) || 0
                }
            });
        } catch (error) {
            logger.error('Error getting cancelled invoices', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get invoices by patient
     * GET /api/v1/billing/invoices/patient/:patient_id
     */
    async getInvoicesByPatient(req, res, next) {
        try {
            const { patient_id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const invoices = await invoiceService.getInvoicesByPatient(
                req.user.id,
                patient_id,
                options
            );

            logger.info('Billing staff viewed patient invoices', {
                staffId: req.user.id,
                patientId: patient_id,
                count: invoices.data?.length || 0
            });

            // Calculate patient summary
            const patientSummary = {
                total_invoices: invoices.summary?.total || 0,
                total_amount: invoices.summary?.total_amount || 0,
                paid_amount: invoices.summary?.paid_amount || 0,
                pending_amount: invoices.summary?.pending_amount || 0,
                last_invoice_date: invoices.data?.[0]?.invoice_date || null
            };

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                patient_summary: patientSummary
            });
        } catch (error) {
            logger.error('Error getting invoices by patient', {
                error: error.message,
                staffId: req.user.id,
                patientId: req.params.patient_id
            });
            next(error);
        }
    },

    /**
     * Get invoices by date range
     * GET /api/v1/billing/invoices/date-range
     */
    async getInvoicesByDateRange(req, res, next) {
        try {
            const { from_date, to_date, page = 1, limit = 20 } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const invoices = await invoiceService.getInvoicesByDateRange(
                req.user.id,
                options
            );

            logger.info('Billing staff viewed invoices by date range', {
                staffId: req.user.id,
                fromDate: from_date,
                toDate: to_date,
                count: invoices.data?.length || 0
            });

            res.json({
                success: true,
                data: invoices.data,
                pagination: invoices.pagination,
                summary: invoices.summary
            });
        } catch (error) {
            logger.error('Error getting invoices by date range', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get invoice by ID
     * GET /api/v1/billing/invoices/:id
     */
    async getInvoiceById(req, res, next) {
        try {
            const { id } = req.params;

            const invoice = await invoiceService.getInvoiceById(
                req.user.id,
                id
            );

            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            logger.info('Billing staff viewed invoice details', {
                staffId: req.user.id,
                invoiceId: id,
                patientId: invoice.patient_id,
                amount: invoice.total_amount,
                status: invoice.status
            });

            // Check if invoice is overdue
            if (invoice.status !== 'paid' && invoice.due_date) {
                const dueDate = new Date(invoice.due_date);
                const today = new Date();
                invoice.is_overdue = dueDate < today;
                invoice.days_overdue = invoice.is_overdue ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)) : 0;
            }

            // Get payment history
            const paymentHistory = await invoiceService.getPaymentHistory(
                req.user.id,
                id
            );
            invoice.payment_history = paymentHistory;

            res.json({
                success: true,
                data: invoice
            });
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error getting invoice by ID', {
                error: error.message,
                staffId: req.user.id,
                invoiceId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // INVOICE CRUD OPERATIONS
    // ============================================

    /**
     * Create invoice
     * POST /api/v1/billing/invoices
     * 
     * BUSINESS RULE: [BR-30] Invoice must have unique invoice number
     */
    async createInvoice(req, res, next) {
        try {
            const {
                patient_id,
                items,
                discount,
                discount_percentage,
                tax_rate,
                due_date,
                notes,
                reference_type,
                reference_id
            } = req.body;

            // Validate required fields
            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one item is required'
                });
            }

            // Calculate subtotal
            const subtotal = items.reduce((sum, item) => {
                return sum + (item.quantity * item.unit_price);
            }, 0);

            // Calculate discount
            let discountAmount = discount || 0;
            if (discount_percentage) {
                discountAmount = subtotal * (discount_percentage / 100);
                // [BR-34] Discount cannot exceed maximum allowed
                if (discountAmount > subtotal) {
                    return res.status(400).json({
                        success: false,
                        error: 'Discount cannot exceed subtotal'
                    });
                }
            }

            const afterDiscount = subtotal - discountAmount;

            // Calculate tax [BR-35]
            let taxAmount = 0;
            if (tax_rate) {
                taxAmount = afterDiscount * (tax_rate / 100);
            }

            const totalAmount = afterDiscount + taxAmount;

            const invoice = await invoiceService.createInvoice(
                req.user.id,
                {
                    patient_id,
                    items,
                    subtotal,
                    discount: discountAmount,
                    discount_percentage: discount_percentage || 0,
                    tax_rate: tax_rate || 0,
                    tax_amount: taxAmount,
                    total_amount: totalAmount,
                    due_date,
                    notes,
                    reference_type,
                    reference_id,
                    created_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Billing staff created invoice', {
                staffId: req.user.id,
                invoiceId: invoice.id,
                invoiceNumber: invoice.invoice_number,
                patientId: patient_id,
                amount: totalAmount
            });

            res.status(201).json({
                success: true,
                data: invoice,
                message: 'Invoice created successfully'
            });
        } catch (error) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: 'Invoice number already exists'
                });
            }
            logger.error('Error creating invoice', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update invoice
     * PUT /api/v1/billing/invoices/:id
     */
    async updateInvoice(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const invoice = await invoiceService.getInvoiceById(req.user.id, id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            // Only draft invoices can be updated
            if (invoice.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot update invoice with status: ${invoice.status}`
                });
            }

            const updated = await invoiceService.updateInvoice(
                req.user.id,
                id,
                {
                    ...updates,
                    updated_at: new Date(),
                    updated_by: req.user.id
                }
            );

            logger.info('Billing staff updated invoice', {
                staffId: req.user.id,
                invoiceId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: updated,
                message: 'Invoice updated successfully'
            });
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error updating invoice', {
                error: error.message,
                staffId: req.user.id,
                invoiceId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete invoice (if draft)
     * DELETE /api/v1/billing/invoices/:id
     */
    async deleteInvoice(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const invoice = await invoiceService.getInvoiceById(req.user.id, id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            if (invoice.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot delete invoice with status: ${invoice.status}`
                });
            }

            const deleted = await invoiceService.deleteInvoice(
                req.user.id,
                id,
                {
                    reason,
                    deleted_at: new Date(),
                    deleted_by: req.user.id
                }
            );

            logger.info('Billing staff deleted invoice', {
                staffId: req.user.id,
                invoiceId: id,
                reason
            });

            res.json({
                success: true,
                data: deleted,
                message: 'Invoice deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error deleting invoice', {
                error: error.message,
                staffId: req.user.id,
                invoiceId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // INVOICE WORKFLOW
    // ============================================

    /**
     * Submit invoice for approval
     * PUT /api/v1/billing/invoices/:id/submit
     */
    async submitInvoice(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const invoice = await invoiceService.getInvoiceById(req.user.id, id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            if (invoice.status !== 'draft') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot submit invoice with status: ${invoice.status}`
                });
            }

            const submitted = await invoiceService.submitInvoice(
                req.user.id,
                id,
                {
                    notes,
                    submitted_at: new Date(),
                    submitted_by: req.user.id
                }
            );

            logger.info('Billing staff submitted invoice for approval', {
                staffId: req.user.id,
                invoiceId: id,
                amount: invoice.total_amount
            });

            res.json({
                success: true,
                data: submitted,
                message: 'Invoice submitted for approval'
            });
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error submitting invoice', {
                error: error.message,
                staffId: req.user.id,
                invoiceId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Approve invoice
     * PUT /api/v1/billing/invoices/:id/approve
     */
    async approveInvoice(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const invoice = await invoiceService.getInvoiceById(req.user.id, id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            if (invoice.status !== 'submitted') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot approve invoice with status: ${invoice.status}`
                });
            }

            const approved = await invoiceService.approveInvoice(
                req.user.id,
                id,
                {
                    notes,
                    approved_at: new Date(),
                    approved_by: req.user.id
                }
            );

            logger.info('Billing admin approved invoice', {
                staffId: req.user.id,
                invoiceId: id,
                amount: invoice.total_amount
            });

            res.json({
                success: true,
                data: approved,
                message: 'Invoice approved'
            });
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error approving invoice', {
                error: error.message,
                staffId: req.user.id,
                invoiceId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Cancel invoice
     * PUT /api/v1/billing/invoices/:id/cancel
     */
    async cancelInvoice(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Cancellation reason is required'
                });
            }

            const invoice = await invoiceService.getInvoiceById(req.user.id, id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            if (invoice.status === 'paid') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot cancel paid invoice. Please process refund instead.'
                });
            }

            if (invoice.status === 'cancelled') {
                return res.status(400).json({
                    success: false,
                    error: 'Invoice is already cancelled'
                });
            }

            const cancelled = await invoiceService.cancelInvoice(
                req.user.id,
                id,
                {
                    reason,
                    cancelled_at: new Date(),
                    cancelled_by: req.user.id
                }
            );

            logger.info('Billing staff cancelled invoice', {
                staffId: req.user.id,
                invoiceId: id,
                reason
            });

            res.json({
                success: true,
                data: cancelled,
                message: 'Invoice cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error cancelling invoice', {
                error: error.message,
                staffId: req.user.id,
                invoiceId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Download invoice PDF
     * GET /api/v1/billing/invoices/:id/pdf
     */
    async downloadInvoicePdf(req, res, next) {
        try {
            const { id } = req.params;

            const invoice = await invoiceService.getInvoiceById(req.user.id, id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            const pdfBuffer = await invoiceService.generateInvoicePdf(
                req.user.id,
                id
            );

            const fileName = `invoice_${invoice.invoice_number}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            logger.info('Billing staff downloaded invoice PDF', {
                staffId: req.user.id,
                invoiceId: id,
                invoiceNumber: invoice.invoice_number
            });

            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error downloading invoice PDF', {
                error: error.message,
                staffId: req.user.id,
                invoiceId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get invoice breakdown
     * GET /api/v1/billing/invoices/:id/breakdown
     */
    async getInvoiceBreakdown(req, res, next) {
        try {
            const { id } = req.params;

            const breakdown = await invoiceService.getInvoiceBreakdown(
                req.user.id,
                id
            );

            if (!breakdown) {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }

            logger.info('Billing staff viewed invoice breakdown', {
                staffId: req.user.id,
                invoiceId: id
            });

            res.json({
                success: true,
                data: breakdown
            });
        } catch (error) {
            if (error.message === 'Invoice not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Invoice not found'
                });
            }
            logger.error('Error getting invoice breakdown', {
                error: error.message,
                staffId: req.user.id,
                invoiceId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = invoiceController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Invoice Lists          | 7         | All, draft, pending, paid, overdue, cancelled, by patient, by date
 * Single Invoice         | 1         | Get by ID
 * CRUD Operations        | 3         | Create, update, delete
 * Invoice Workflow       | 3         | Submit, approve, cancel
 * PDF & Breakdown        | 2         | Download PDF, get breakdown
 * -----------------------|-----------|----------------------
 * TOTAL                  | 16        | Complete invoice management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-30] Unique invoice number (service level)
 * - [BR-31] Payment verification (service level)
 * - [BR-34] Discount validation
 * - [BR-35] Tax calculation
 * 
 * ======================================================================
 */