/**
 * ======================================================================
 * FILE: backend/src/services/billing/invoiceService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing invoice service - Handles business logic for invoice management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-30] Invoice must have unique invoice number
 * - [BR-34] Discount cannot exceed maximum allowed
 * - [BR-35] Tax calculation follows government rules
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const PDFDocument = require('pdfkit');

const invoiceService = {
    /**
     * Get all invoices
     */
    async getAllInvoices(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, status, patient_id, from_date, to_date, min_amount, max_amount } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT i.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       p.email as patient_email,
                       COUNT(pay.id) as payment_count,
                       SUM(pay.amount) as total_paid,
                       CASE 
                           WHEN i.due_date < NOW() AND i.status NOT IN ('paid', 'cancelled') THEN true
                           ELSE false
                       END as is_overdue,
                       EXTRACT(DAY FROM (NOW() - i.due_date)) as overdue_days
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                LEFT JOIN payments pay ON i.id = pay.invoice_id AND pay.status = 'completed'
                WHERE i.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND i.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND i.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND i.invoice_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND i.invoice_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            if (min_amount) {
                query += ` AND i.total_amount >= $${paramIndex}`;
                values.push(min_amount);
                paramIndex++;
            }

            if (max_amount) {
                query += ` AND i.total_amount <= $${paramIndex}`;
                values.push(max_amount);
                paramIndex++;
            }

            query += ` GROUP BY i.id, p.id
                      ORDER BY i.invoice_date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(total_amount) as total_amount,
                    SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
                    SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END) as pending_amount,
                    SUM(CASE WHEN due_date < NOW() AND status NOT IN ('paid', 'cancelled') THEN total_amount ELSE 0 END) as overdue_amount
                FROM invoices
                WHERE is_deleted = false
                ${status ? 'AND status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getAllInvoices', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get invoices by status
     */
    async getInvoicesByStatus(staffId, statuses, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            const statusArray = Array.isArray(statuses) ? statuses : [statuses];

            let query = `
                SELECT i.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       SUM(pay.amount) as total_paid
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                LEFT JOIN payments pay ON i.id = pay.invoice_id AND pay.status = 'completed'
                WHERE i.status = ANY($1::text[]) AND i.is_deleted = false
            `;
            const values = [statusArray];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND i.invoice_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND i.invoice_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` GROUP BY i.id, p.id
                      ORDER BY i.invoice_date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM invoices
                WHERE status = ANY($1::text[]) AND is_deleted = false
            `;
            const count = await db.query(countQuery, [statusArray]);

            return {
                data: result.rows,
                summary: { total: parseInt(count.rows[0]?.total || 0) },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getInvoicesByStatus', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get overdue invoices
     */
    async getOverdueInvoices(staffId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       p.email as patient_email,
                       EXTRACT(DAY FROM (NOW() - i.due_date)) as days_overdue
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                WHERE i.due_date < NOW() 
                    AND i.status NOT IN ('paid', 'cancelled')
                    AND i.is_deleted = false
                ORDER BY i.due_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(total_amount) as total_amount,
                    AVG(EXTRACT(DAY FROM (NOW() - due_date)))::numeric(10,2) as avg_overdue_days
                FROM invoices
                WHERE due_date < NOW() 
                    AND status NOT IN ('paid', 'cancelled')
                    AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getOverdueInvoices', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get invoices by patient
     */
    async getInvoicesByPatient(staffId, patientId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, 
                       SUM(pay.amount) as total_paid
                FROM invoices i
                LEFT JOIN payments pay ON i.id = pay.invoice_id AND pay.status = 'completed'
                WHERE i.patient_id = $1 AND i.is_deleted = false
                GROUP BY i.id
                ORDER BY i.invoice_date DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [patientId, limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(total_amount) as total_amount,
                    SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
                    SUM(CASE WHEN status NOT IN ('paid', 'cancelled') THEN total_amount ELSE 0 END) as pending_amount
                FROM invoices
                WHERE patient_id = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [patientId]);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getInvoicesByPatient', { error: error.message, staffId, patientId });
            throw error;
        }
    },

    /**
     * Get invoices by date range
     */
    async getInvoicesByDateRange(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                WHERE i.invoice_date BETWEEN $1 AND $2
                    AND i.is_deleted = false
                ORDER BY i.invoice_date DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [from_date, to_date, limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(total_amount) as total_amount,
                    SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
                    COUNT(*) FILTER (WHERE status = 'paid') as paid_count
                FROM invoices
                WHERE invoice_date BETWEEN $1 AND $2 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [from_date, to_date]);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getInvoicesByDateRange', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get invoice by ID
     */
    async getInvoiceById(staffId, invoiceId) {
        try {
            const query = `
                SELECT i.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       p.email as patient_email,
                       p.address as patient_address,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', ii.id,
                                   'description', ii.description,
                                   'quantity', ii.quantity,
                                   'unit_price', ii.unit_price,
                                   'total', ii.quantity * ii.unit_price
                               )
                           )
                           FROM invoice_items ii
                           WHERE ii.invoice_id = i.id AND ii.is_deleted = false
                       ) as items
                FROM invoices i
                JOIN patients p ON i.patient_id = p.id
                WHERE i.id = $1 AND i.is_deleted = false
            `;

            const result = await db.query(query, [invoiceId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getInvoiceById', { error: error.message, staffId, invoiceId });
            throw error;
        }
    },

    /**
     * Get payment history for invoice
     */
    async getPaymentHistory(staffId, invoiceId) {
        try {
            const query = `
                SELECT p.*,
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name
                FROM payments p
                LEFT JOIN users u ON p.recorded_by = u.id
                WHERE p.invoice_id = $1
                ORDER BY p.payment_date DESC
            `;

            const result = await db.query(query, [invoiceId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPaymentHistory', { error: error.message, staffId, invoiceId });
            throw error;
        }
    },

    /**
     * Generate invoice number [BR-30]
     */
    async generateInvoiceNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM invoices
                WHERE invoice_number LIKE $1
            `, [`INV-${year}${month}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `INV-${year}${month}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateInvoiceNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Create invoice
     */
    async createInvoice(staffId, invoiceData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate unique invoice number [BR-30]
            const invoiceNumber = await this.generateInvoiceNumber();

            const query = `
                INSERT INTO invoices (
                    id, invoice_number, patient_id, invoice_date, due_date,
                    subtotal, discount, discount_percentage, tax_rate, tax_amount,
                    total_amount, notes, reference_type, reference_id, status,
                    created_by, ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, 'draft', $14, $15, $16, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                invoiceNumber,
                invoiceData.patient_id,
                invoiceData.invoice_date || new Date(),
                invoiceData.due_date,
                invoiceData.subtotal,
                invoiceData.discount,
                invoiceData.discount_percentage,
                invoiceData.tax_rate,
                invoiceData.tax_amount,
                invoiceData.total_amount,
                invoiceData.notes,
                invoiceData.reference_type,
                invoiceData.reference_id,
                invoiceData.created_by,
                invoiceData.ip_address,
                invoiceData.user_agent
            ];

            const result = await client.query(query, values);
            const invoice = result.rows[0];

            // Insert invoice items
            for (const item of invoiceData.items) {
                await client.query(`
                    INSERT INTO invoice_items (
                        id, invoice_id, description, quantity, unit_price, notes, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
                    )
                `, [
                    invoice.id,
                    item.description,
                    item.quantity,
                    item.unit_price,
                    item.notes
                ]);
            }

            await db.commitTransaction(client);

            return invoice;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update invoice
     */
    async updateInvoice(staffId, invoiceId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'due_date', 'notes', 'discount', 'discount_percentage',
                'tax_rate', 'tax_amount', 'total_amount', 'subtotal'
            ];

            for (const [key, value] of Object.entries(updateData)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(invoiceId);

            const query = `
                UPDATE invoices 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND status = 'draft' AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Invoice not found or cannot be updated');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete invoice
     */
    async deleteInvoice(staffId, invoiceId, deleteData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE invoices 
                SET is_deleted = true,
                    deleted_at = $1,
                    deleted_by = $2,
                    deletion_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'draft'
                RETURNING id
            `;

            const values = [
                deleteData.deleted_at,
                deleteData.deleted_by,
                deleteData.reason,
                invoiceId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Invoice not found or cannot be deleted');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Submit invoice for approval
     */
    async submitInvoice(staffId, invoiceId, submitData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE invoices 
                SET status = 'submitted',
                    submitted_at = $1,
                    submitted_by = $2,
                    submission_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'draft'
                RETURNING *
            `;

            const values = [
                submitData.submitted_at,
                submitData.submitted_by,
                submitData.notes,
                invoiceId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Invoice not found or cannot be submitted');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Approve invoice
     */
    async approveInvoice(staffId, invoiceId, approveData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE invoices 
                SET status = 'approved',
                    approved_at = $1,
                    approved_by = $2,
                    approval_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'submitted'
                RETURNING *
            `;

            const values = [
                approveData.approved_at,
                approveData.approved_by,
                approveData.notes,
                invoiceId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Invoice not found or cannot be approved');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Cancel invoice
     */
    async cancelInvoice(staffId, invoiceId, cancelData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE invoices 
                SET status = 'cancelled',
                    cancelled_at = $1,
                    cancelled_by = $2,
                    cancellation_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 
                    AND status NOT IN ('paid', 'cancelled')
                RETURNING *
            `;

            const values = [
                cancelData.cancelled_at,
                cancelData.cancelled_by,
                cancelData.reason,
                invoiceId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Invoice not found or cannot be cancelled');
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Generate invoice PDF
     */
    async generateInvoicePdf(staffId, invoiceId) {
        try {
            const invoice = await this.getInvoiceById(staffId, invoiceId);
            
            if (!invoice) {
                throw new Error('Invoice not found');
            }

            // Create PDF document
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => {});

            // Header
            doc.fontSize(20).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
            doc.moveDown();

            doc.fontSize(10).font('Helvetica');
            doc.text(`Invoice Number: ${invoice.invoice_number}`, { align: 'right' });
            doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, { align: 'right' });
            doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, { align: 'right' });
            doc.moveDown();

            // Hospital Details
            doc.fontSize(12).font('Helvetica-Bold').text('HOSPITAL NAME', { align: 'center' });
            doc.fontSize(8).font('Helvetica');
            doc.text('123 Healthcare Avenue, Medical District', { align: 'center' });
            doc.text('City, State - 123456 | Phone: +91-123-4567890', { align: 'center' });
            doc.text('GST: 12ABCDE3456F1Z5 | PAN: ABCDE1234F', { align: 'center' });
            doc.moveDown();

            // Patient Details
            doc.fontSize(10).font('Helvetica-Bold').text('BILL TO:');
            doc.fontSize(10).font('Helvetica');
            doc.text(`${invoice.patient_first_name} ${invoice.patient_last_name}`);
            doc.text(`Phone: ${invoice.patient_phone}`);
            if (invoice.patient_email) doc.text(`Email: ${invoice.patient_email}`);
            if (invoice.patient_address) doc.text(`Address: ${invoice.patient_address}`);
            doc.moveDown();

            // Items Table
            const tableTop = doc.y;
            let y = tableTop;

            // Table Headers
            doc.fontSize(9).font('Helvetica-Bold');
            doc.text('S.No', 50, y);
            doc.text('Description', 100, y);
            doc.text('Quantity', 350, y);
            doc.text('Unit Price', 420, y);
            doc.text('Amount', 480, y);
            y += 15;

            doc.fontSize(9).font('Helvetica');
            let serialNo = 1;
            let subtotal = 0;

            for (const item of invoice.items || []) {
                const amount = item.quantity * item.unit_price;
                subtotal += amount;

                doc.text(serialNo.toString(), 50, y);
                doc.text(item.description.substring(0, 40), 100, y);
                doc.text(item.quantity.toString(), 350, y);
                doc.text(`₹ ${item.unit_price.toFixed(2)}`, 420, y);
                doc.text(`₹ ${amount.toFixed(2)}`, 480, y);
                y += 20;
                serialNo++;
            }

            y += 10;

            // Totals
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text(`Subtotal:`, 380, y);
            doc.fontSize(10).font('Helvetica');
            doc.text(`₹ ${subtotal.toFixed(2)}`, 480, y);
            y += 20;

            if (invoice.discount > 0) {
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text(`Discount:`, 380, y);
                doc.fontSize(10).font('Helvetica');
                doc.text(`- ₹ ${invoice.discount.toFixed(2)}`, 480, y);
                y += 20;
            }

            if (invoice.tax_amount > 0) {
                doc.fontSize(10).font('Helvetica-Bold');
                doc.text(`Tax (${invoice.tax_rate}%):`, 380, y);
                doc.fontSize(10).font('Helvetica');
                doc.text(`₹ ${invoice.tax_amount.toFixed(2)}`, 480, y);
                y += 20;
            }

            doc.fontSize(12).font('Helvetica-Bold');
            doc.text(`Total Amount:`, 380, y);
            doc.fontSize(12).font('Helvetica');
            doc.text(`₹ ${invoice.total_amount.toFixed(2)}`, 480, y);
            y += 30;

            // Payment Status
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text(`Payment Status: ${invoice.status.toUpperCase()}`, 50, y);
            doc.fontSize(10).font('Helvetica');
            doc.text(`Amount Paid: ₹ ${(invoice.total_paid || 0).toFixed(2)}`, 50, y + 15);
            doc.text(`Balance Due: ₹ ${(invoice.total_amount - (invoice.total_paid || 0)).toFixed(2)}`, 50, y + 30);
            y += 60;

            // Footer
            doc.fontSize(8).font('Helvetica-Oblique');
            doc.text('This is a computer generated invoice and does not require a signature.', 
                     { align: 'center' });
            doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

            doc.end();

            return Buffer.concat(chunks);
        } catch (error) {
            logger.error('Error in generateInvoicePdf', { error: error.message, staffId, invoiceId });
            throw error;
        }
    },

    /**
     * Get invoice breakdown
     */
    async getInvoiceBreakdown(staffId, invoiceId) {
        try {
            const breakdown = await db.query(`
                SELECT 
                    i.id,
                    i.invoice_number,
                    i.subtotal,
                    i.discount,
                    i.discount_percentage,
                    i.tax_rate,
                    i.tax_amount,
                    i.total_amount,
                    i.status,
                    json_agg(
                        json_build_object(
                            'description', ii.description,
                            'quantity', ii.quantity,
                            'unit_price', ii.unit_price,
                            'total', ii.quantity * ii.unit_price
                        )
                    ) as items
                FROM invoices i
                LEFT JOIN invoice_items ii ON i.id = ii.invoice_id AND ii.is_deleted = false
                WHERE i.id = $1 AND i.is_deleted = false
                GROUP BY i.id
            `, [invoiceId]);

            if (breakdown.rows.length === 0) {
                return null;
            }

            return breakdown.rows[0];
        } catch (error) {
            logger.error('Error in getInvoiceBreakdown', { error: error.message, staffId, invoiceId });
            throw error;
        }
    }
};

module.exports = invoiceService;