/**
 * ======================================================================
 * FILE: backend/src/models/billing/Invoice.js
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
 * Invoice model for database operations.
 * Handles billing invoices, payments, and financial transactions.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: invoices
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - invoice_number: string (unique)
 * - patient_id: UUID (foreign key to patients)
 * - appointment_id: UUID (foreign key to appointments)
 * - issue_date: date
 * - due_date: date
 * - invoice_type: enum (consultation, procedure, surgery, lab, pharmacy, room_charges, package, subscription)
 * - billing_cycle: string
 * - period_start: date
 * - period_end: date
 * - subtotal: decimal
 * - tax_percentage: decimal
 * - tax: decimal
 * - tax_details: jsonb
 * - discount: decimal
 * - discount_type: string
 * - discount_reason: text
 * - total: decimal
 * - rounding_adjustment: decimal
 * - currency: string
 * - exchange_rate: decimal
 * - paid_amount: decimal
 * - balance_amount: decimal (generated)
 * - payment_status: enum (pending, partial, paid, overdue, refunded)
 * - payment_method: enum (cash, card, upi, bank_transfer, cheque, insurance, online, wallet)
 * - payment_date: timestamp
 * - payment_transaction_id: string
 * - payment_gateway: string
 * - payment_notes: text
 * - payment_history: jsonb
 * - insurance_id: UUID
 * - insurance_claim_number: string
 * - insurance_coverage: decimal
 * - insurance_amount: decimal
 * - insurance_approved: boolean
 * - insurance_approved_by: uuid
 * - insurance_approved_at: timestamp
 * - insurance_claim_status: string
 * - insurance_notes: text
 * - items: jsonb
 * - item_count: integer
 * - total_quantity: integer
 * - invoice_pdf_url: text
 * - invoice_html_url: text
 * - receipt_url: text
 * - supporting_documents: jsonb
 * - refund_amount: decimal
 * - refund_date: timestamp
 * - refund_reason: text
 * - refund_approved_by: uuid
 * - refund_approved_at: timestamp
 * - refund_transaction_id: string
 * - refund_history: jsonb
 * - status: enum (draft, submitted, pending_approval, approved, sent, partial, paid, overdue, cancelled, refunded, disputed)
 * - approval_level: integer
 * - submitted_by: uuid
 * - submitted_at: timestamp
 * - approved_by: uuid
 * - approved_at: timestamp
 * - rejected_by: uuid
 * - rejected_at: timestamp
 * - rejection_reason: text
 * - cancelled_by: uuid
 * - cancelled_at: timestamp
 * - cancellation_reason: text
 * - email_sent: boolean
 * - email_sent_at: timestamp
 * - sms_sent: boolean
 * - sms_sent_at: timestamp
 * - whatsapp_sent: boolean
 * - whatsapp_sent_at: timestamp
 * - notes: text
 * - terms_conditions: text
 * - footer_text: text
 * - metadata: jsonb
 * - created_by: uuid
 * - updated_by: uuid
 * - created_at: timestamp
 * - updated_at: timestamp
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

const Invoice = {
    /**
     * Table name
     */
    tableName: 'invoices',

    /**
     * Valid invoice statuses
     */
    validStatuses: [
        'draft', 'submitted', 'pending_approval', 'approved', 'sent',
        'partial', 'paid', 'overdue', 'cancelled', 'refunded', 'disputed'
    ],

    /**
     * Valid payment statuses
     */
    validPaymentStatuses: ['pending', 'partial', 'paid', 'overdue', 'refunded'],

    /**
     * Valid payment methods
     */
    validPaymentMethods: ['cash', 'card', 'upi', 'bank_transfer', 'cheque', 'insurance', 'online', 'wallet'],

    /**
     * Valid invoice types
     */
    validInvoiceTypes: [
        'consultation', 'procedure', 'surgery', 'lab',
        'pharmacy', 'room_charges', 'package', 'subscription'
    ],

    /**
     * Generate invoice number
     * @returns {Promise<string>} Generated invoice number
     */
    async generateInvoiceNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM invoices
                WHERE invoice_number LIKE $1
            `;
            const result = await db.query(query, [`INV-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `INV-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating invoice number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find invoice by ID
     * @param {string} id - Invoice UUID
     * @returns {Promise<Object|null>} Invoice object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    i.id, i.invoice_number, i.patient_id, i.appointment_id,
                    i.issue_date, i.due_date, i.invoice_type,
                    i.billing_cycle, i.period_start, i.period_end,
                    i.subtotal, i.tax_percentage, i.tax, i.tax_details,
                    i.discount, i.discount_type, i.discount_reason,
                    i.total, i.rounding_adjustment,
                    i.currency, i.exchange_rate,
                    i.paid_amount, i.balance_amount, i.payment_status,
                    i.payment_method, i.payment_date, i.payment_transaction_id,
                    i.payment_gateway, i.payment_notes, i.payment_history,
                    i.insurance_id, i.insurance_claim_number,
                    i.insurance_coverage, i.insurance_amount,
                    i.insurance_approved, i.insurance_approved_by,
                    i.insurance_approved_at, i.insurance_claim_status,
                    i.insurance_notes,
                    i.items, i.item_count, i.total_quantity,
                    i.invoice_pdf_url, i.invoice_html_url, i.receipt_url,
                    i.supporting_documents,
                    i.refund_amount, i.refund_date, i.refund_reason,
                    i.refund_approved_by, i.refund_approved_at,
                    i.refund_transaction_id, i.refund_history,
                    i.status, i.approval_level,
                    i.submitted_by, i.submitted_at,
                    i.approved_by, i.approved_at,
                    i.rejected_by, i.rejected_at, i.rejection_reason,
                    i.cancelled_by, i.cancelled_at, i.cancellation_reason,
                    i.email_sent, i.email_sent_at,
                    i.sms_sent, i.sms_sent_at,
                    i.whatsapp_sent, i.whatsapp_sent_at,
                    i.notes, i.terms_conditions, i.footer_text, i.metadata,
                    i.created_at, i.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    ip.name as insurance_name,
                    sub.username as submitted_by_name,
                    app.username as approved_by_name,
                    rej.username as rejected_by_name,
                    can.username as cancelled_by_name,
                    refapp.username as refund_approved_by_name,
                    insapp.username as insurance_approved_by_name
                FROM invoices i
                LEFT JOIN patients p ON i.patient_id = p.id
                LEFT JOIN insurance_providers ip ON i.insurance_id = ip.id
                LEFT JOIN users sub ON i.submitted_by = sub.id
                LEFT JOIN users app ON i.approved_by = app.id
                LEFT JOIN users rej ON i.rejected_by = rej.id
                LEFT JOIN users can ON i.cancelled_by = can.id
                LEFT JOIN users refapp ON i.refund_approved_by = refapp.id
                LEFT JOIN users insapp ON i.insurance_approved_by = insapp.id
                WHERE i.id = $1 AND i.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Invoice found by ID', { invoiceId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding invoice by ID', {
                error: error.message,
                invoiceId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find invoice by invoice number
     * @param {string} invoiceNumber - Invoice number
     * @returns {Promise<Object|null>} Invoice object or null
     */
    async findByNumber(invoiceNumber) {
        try {
            const query = `
                SELECT 
                    id, invoice_number, patient_id, issue_date,
                    total, paid_amount, balance_amount,
                    payment_status, status, due_date
                FROM invoices
                WHERE invoice_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [invoiceNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Invoice found by number', { invoiceNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding invoice by number', {
                error: error.message,
                invoiceNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find invoices by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of invoices
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, payment_status, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }
            if (payment_status) {
                conditions.push(`payment_status = $${paramIndex++}`);
                values.push(payment_status);
            }
            if (from_date) {
                conditions.push(`issue_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`issue_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, invoice_number, issue_date, due_date,
                    total, paid_amount, balance_amount,
                    payment_status, status, invoice_type,
                    created_at
                FROM invoices
                ${whereClause}
                ORDER BY issue_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Invoices found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding invoices by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get overdue invoices
     * @returns {Promise<Array>} List of overdue invoices
     */
    async getOverdue() {
        try {
            const query = `
                SELECT 
                    i.id, i.invoice_number, i.patient_id,
                    i.total, i.paid_amount, i.balance_amount,
                    i.due_date, i.issue_date,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    p.email as patient_email
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                WHERE i.due_date < CURRENT_DATE
                    AND i.payment_status IN ('pending', 'partial')
                    AND i.status NOT IN ('cancelled', 'paid', 'refunded')
                    AND i.is_deleted = false
                ORDER BY i.due_date ASC
            `;

            const result = await db.query(query);

            logger.debug('Overdue invoices retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting overdue invoices', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get invoices by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of invoices
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    i.id, i.invoice_number, i.patient_id,
                    i.issue_date, i.total, i.paid_amount,
                    i.payment_status, i.status,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                WHERE i.issue_date BETWEEN $1 AND $2
                    AND i.is_deleted = false
                ORDER BY i.issue_date DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [startDate, endDate, limit, offset]);

            logger.debug('Invoices found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting invoices by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new invoice
     * @param {Object} invoiceData - Invoice data
     * @returns {Promise<Object>} Created invoice
     */
    async create(invoiceData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (invoiceData.status && !this.validStatuses.includes(invoiceData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }
            if (invoiceData.payment_status && !this.validPaymentStatuses.includes(invoiceData.payment_status)) {
                throw new Error(`Invalid payment status. Must be one of: ${this.validPaymentStatuses.join(', ')}`);
            }
            if (invoiceData.invoice_type && !this.validInvoiceTypes.includes(invoiceData.invoice_type)) {
                throw new Error(`Invalid invoice type. Must be one of: ${this.validInvoiceTypes.join(', ')}`);
            }

            const invoiceNumber = await this.generateInvoiceNumber();

            // Calculate totals from items
            let subtotal = 0;
            let totalQuantity = 0;
            const items = invoiceData.items || [];

            for (const item of items) {
                subtotal += item.quantity * item.unit_price;
                totalQuantity += item.quantity;
            }

            const discount = invoiceData.discount || 0;
            const taxPercentage = invoiceData.tax_percentage || 0;
            const tax = (subtotal - discount) * taxPercentage / 100;
            const roundingAdjustment = invoiceData.rounding_adjustment || 0;
            const total = subtotal - discount + tax + roundingAdjustment;

            const query = `
                INSERT INTO invoices (
                    id, invoice_number, patient_id, appointment_id,
                    issue_date, due_date, invoice_type,
                    billing_cycle, period_start, period_end,
                    subtotal, tax_percentage, tax, tax_details,
                    discount, discount_type, discount_reason,
                    total, rounding_adjustment,
                    currency, exchange_rate,
                    paid_amount, payment_status,
                    items, item_count, total_quantity,
                    invoice_pdf_url, invoice_html_url,
                    supporting_documents,
                    status, approval_level,
                    notes, terms_conditions, footer_text, metadata,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    $10, $11, $12, $13,
                    $14, $15, $16,
                    $17, $18,
                    COALESCE($19, 'INR'), COALESCE($20, 1),
                    0, $21,
                    $22, $23, $24,
                    $25, $26,
                    $27,
                    COALESCE($28, 'draft'), COALESCE($29, 1),
                    $30, $31, $32, $33,
                    $34, NOW(), NOW()
                )
                RETURNING 
                    id, invoice_number, patient_id,
                    issue_date, due_date, total,
                    status, created_at
            `;

            const values = [
                invoiceNumber,
                invoiceData.patient_id,
                invoiceData.appointment_id || null,
                invoiceData.issue_date || new Date().toISOString().split('T')[0],
                invoiceData.due_date,
                invoiceData.invoice_type,
                invoiceData.billing_cycle || null,
                invoiceData.period_start || null,
                invoiceData.period_end || null,
                subtotal,
                taxPercentage,
                tax,
                invoiceData.tax_details || null,
                discount,
                invoiceData.discount_type || null,
                invoiceData.discount_reason || null,
                total,
                roundingAdjustment,
                invoiceData.currency,
                invoiceData.exchange_rate,
                invoiceData.payment_status || 'pending',
                items,
                items.length,
                totalQuantity,
                invoiceData.invoice_pdf_url || null,
                invoiceData.invoice_html_url || null,
                invoiceData.supporting_documents || null,
                invoiceData.status,
                invoiceData.approval_level,
                invoiceData.notes || null,
                invoiceData.terms_conditions || null,
                invoiceData.footer_text || null,
                invoiceData.metadata || null,
                invoiceData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Invoice created successfully', {
                invoiceId: result.rows[0].id,
                invoiceNumber,
                patientId: invoiceData.patient_id,
                total
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating invoice', {
                error: error.message,
                patientId: invoiceData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update invoice
     * @param {string} id - Invoice ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated invoice
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'issue_date', 'due_date', 'invoice_type',
                'billing_cycle', 'period_start', 'period_end',
                'subtotal', 'tax_percentage', 'tax', 'tax_details',
                'discount', 'discount_type', 'discount_reason',
                'total', 'rounding_adjustment',
                'currency', 'exchange_rate',
                'paid_amount', 'payment_status', 'payment_method',
                'payment_date', 'payment_transaction_id', 'payment_gateway',
                'payment_notes', 'payment_history',
                'insurance_id', 'insurance_claim_number',
                'insurance_coverage', 'insurance_amount',
                'insurance_approved', 'insurance_approved_by',
                'insurance_approved_at', 'insurance_claim_status',
                'insurance_notes',
                'items', 'item_count', 'total_quantity',
                'invoice_pdf_url', 'invoice_html_url', 'receipt_url',
                'supporting_documents',
                'refund_amount', 'refund_date', 'refund_reason',
                'refund_approved_by', 'refund_approved_at',
                'refund_transaction_id', 'refund_history',
                'status', 'approval_level',
                'submitted_by', 'submitted_at',
                'approved_by', 'approved_at',
                'rejected_by', 'rejected_at', 'rejection_reason',
                'cancelled_by', 'cancelled_at', 'cancellation_reason',
                'email_sent', 'email_sent_at',
                'sms_sent', 'sms_sent_at',
                'whatsapp_sent', 'whatsapp_sent_at',
                'notes', 'terms_conditions', 'footer_text', 'metadata'
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

            // Update balance amount if paid_amount changed
            if (updates.paid_amount !== undefined) {
                const invoice = await this.findById(id);
                if (invoice) {
                    const newBalance = invoice.total - (updates.paid_amount || 0);
                    setClause.push(`balance_amount = $${paramIndex++}`);
                    values.push(newBalance);
                }
            }

            setClause.push(`updated_at = NOW()`);
            if (updates.updated_by) {
                setClause.push(`updated_by = $${paramIndex++}`);
                values.push(updates.updated_by);
            }
            values.push(id);

            const query = `
                UPDATE invoices 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, invoice_number, status,
                    payment_status, balance_amount,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Invoice not found');
            }

            await db.commitTransaction(client);

            logger.info('Invoice updated', {
                invoiceId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating invoice', {
                error: error.message,
                invoiceId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Record payment on invoice
     * @param {string} id - Invoice ID
     * @param {Object} paymentData - Payment data
     * @returns {Promise<Object>} Updated invoice
     */
    async recordPayment(id, paymentData) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const newPaidAmount = (invoice.paid_amount || 0) + paymentData.amount;
        let paymentStatus = 'partial';
        if (newPaidAmount >= invoice.total) {
            paymentStatus = 'paid';
        }

        const paymentHistory = invoice.payment_history || [];
        paymentHistory.push({
            amount: paymentData.amount,
            method: paymentData.method,
            reference: paymentData.reference,
            date: new Date(),
            recorded_by: paymentData.recorded_by
        });

        const updates = {
            paid_amount: newPaidAmount,
            payment_status: paymentStatus,
            payment_method: paymentData.method,
            payment_date: new Date(),
            payment_transaction_id: paymentData.transaction_id,
            payment_gateway: paymentData.gateway,
            payment_notes: paymentData.notes,
            payment_history: paymentHistory,
            updated_by: paymentData.recorded_by
        };

        if (paymentStatus === 'paid') {
            updates.status = 'paid';
        }

        return this.update(id, updates);
    },

    /**
     * Process refund
     * @param {string} id - Invoice ID
     * @param {Object} refundData - Refund data
     * @returns {Promise<Object>} Updated invoice
     */
    async processRefund(id, refundData) {
        const invoice = await this.findById(id);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        if (refundData.amount > invoice.paid_amount) {
            throw new Error('Refund amount cannot exceed paid amount');
        }

        const refundHistory = invoice.refund_history || [];
        refundHistory.push({
            amount: refundData.amount,
            reason: refundData.reason,
            method: refundData.method,
            date: new Date(),
            processed_by: refundData.processed_by
        });

        const updates = {
            refund_amount: (invoice.refund_amount || 0) + refundData.amount,
            refund_date: new Date(),
            refund_reason: refundData.reason,
            refund_approved_by: refundData.approved_by,
            refund_approved_at: new Date(),
            refund_transaction_id: refundData.transaction_id,
            refund_history: refundHistory,
            updated_by: refundData.processed_by
        };

        // Update payment status if fully refunded
        const newRefundTotal = updates.refund_amount;
        if (newRefundTotal >= invoice.paid_amount) {
            updates.payment_status = 'refunded';
            updates.status = 'refunded';
        }

        return this.update(id, updates);
    },

    /**
     * Submit invoice for approval
     * @param {string} id - Invoice ID
     * @param {string} submittedBy - User who submitted
     * @returns {Promise<Object>} Updated invoice
     */
    async submit(id, submittedBy) {
        return this.update(id, {
            status: 'pending_approval',
            submitted_by: submittedBy,
            submitted_at: new Date(),
            updated_by: submittedBy
        });
    },

    /**
     * Approve invoice
     * @param {string} id - Invoice ID
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated invoice
     */
    async approve(id, approvedBy) {
        return this.update(id, {
            status: 'approved',
            approved_by: approvedBy,
            approved_at: new Date(),
            updated_by: approvedBy
        });
    },

    /**
     * Reject invoice
     * @param {string} id - Invoice ID
     * @param {string} rejectedBy - User who rejected
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated invoice
     */
    async reject(id, rejectedBy, reason) {
        return this.update(id, {
            status: 'cancelled',
            rejected_by: rejectedBy,
            rejected_at: new Date(),
            rejection_reason: reason,
            updated_by: rejectedBy
        });
    },

    /**
     * Cancel invoice
     * @param {string} id - Invoice ID
     * @param {string} cancelledBy - User who cancelled
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Updated invoice
     */
    async cancel(id, cancelledBy, reason) {
        return this.update(id, {
            status: 'cancelled',
            cancelled_by: cancelledBy,
            cancelled_at: new Date(),
            cancellation_reason: reason,
            updated_by: cancelledBy
        });
    },

    /**
     * Mark invoice as sent
     * @param {string} id - Invoice ID
     * @param {string} sentBy - User who sent
     * @returns {Promise<Object>} Updated invoice
     */
    async markAsSent(id, sentBy) {
        return this.update(id, {
            status: 'sent',
            email_sent: true,
            email_sent_at: new Date(),
            updated_by: sentBy
        });
    },

    /**
     * Get invoice statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND issue_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_invoices,
                    SUM(total) as total_amount,
                    SUM(paid_amount) as total_collected,
                    SUM(balance_amount) as total_outstanding,
                    AVG(total)::numeric(10,2) as avg_invoice_value,
                    COUNT(*) FILTER (WHERE payment_status = 'paid') as paid,
                    COUNT(*) FILTER (WHERE payment_status = 'partial') as partial,
                    COUNT(*) FILTER (WHERE payment_status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE payment_status = 'overdue') as overdue,
                    COUNT(*) FILTER (WHERE status = 'draft') as draft,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE invoice_type = 'consultation') as consultation,
                    COUNT(*) FILTER (WHERE invoice_type = 'lab') as lab,
                    COUNT(*) FILTER (WHERE invoice_type = 'pharmacy') as pharmacy,
                    COUNT(DISTINCT patient_id) as unique_patients
                FROM invoices
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Invoice statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting invoice statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get revenue by period
     * @param {string} periodType - day, month, year
     * @param {number} periods - Number of periods to look back
     * @returns {Promise<Array>} Revenue by period
     */
    async getRevenueByPeriod(periodType = 'month', periods = 12) {
        try {
            let interval;
            let format;
            switch (periodType) {
                case 'day':
                    interval = '1 day';
                    format = 'YYYY-MM-DD';
                    break;
                case 'month':
                    interval = '1 month';
                    format = 'YYYY-MM';
                    break;
                case 'year':
                    interval = '1 year';
                    format = 'YYYY';
                    break;
                default:
                    interval = '1 month';
                    format = 'YYYY-MM';
            }

            const query = `
                SELECT 
                    TO_CHAR(issue_date, $1) as period,
                    COUNT(*) as invoice_count,
                    SUM(total) as total_amount,
                    SUM(paid_amount) as collected_amount,
                    SUM(balance_amount) as outstanding_amount
                FROM invoices
                WHERE issue_date > NOW() - ($2 || ' ' || $3)::INTERVAL
                    AND is_deleted = false
                GROUP BY TO_CHAR(issue_date, $1)
                ORDER BY period ASC
            `;

            const result = await db.query(query, [format, periods, periodType]);

            logger.debug('Revenue by period retrieved', {
                periodType,
                periods,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting revenue by period', {
                error: error.message,
                periodType,
                periods
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete invoice
     * @param {string} id - Invoice ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE invoices 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Invoice not found');
            }

            await db.commitTransaction(client);

            logger.info('Invoice soft deleted', {
                invoiceId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting invoice', {
                error: error.message,
                invoiceId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Invoice;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */