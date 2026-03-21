/**
 * ======================================================================
 * FILE: backend/src/services/billing/refundService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing refund service - Handles business logic for refund processing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-32] Refund only for paid invoices
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const refundService = {
    /**
     * Get all refunds
     */
    async getAllRefunds(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, status, payment_id, invoice_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT r.*, 
                       p.id as payment_id,
                       p.payment_number,
                       p.amount as payment_amount,
                       p.payment_method,
                       i.invoice_number,
                       i.total_amount as invoice_total,
                       CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                       CONCAT(u1.first_name, ' ', u1.last_name) as requested_by_name,
                       CONCAT(u2.first_name, ' ', u2.last_name) as approved_by_name,
                       CONCAT(u3.first_name, ' ', u3.last_name) as completed_by_name
                FROM refunds r
                JOIN payments p ON r.payment_id = p.id
                JOIN invoices i ON r.invoice_id = i.id
                JOIN patients pat ON i.patient_id = pat.id
                LEFT JOIN users u1 ON r.requested_by = u1.id
                LEFT JOIN users u2 ON r.approved_by = u2.id
                LEFT JOIN users u3 ON r.completed_by = u3.id
                WHERE r.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND r.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (payment_id) {
                query += ` AND r.payment_id = $${paramIndex}`;
                values.push(payment_id);
                paramIndex++;
            }

            if (invoice_id) {
                query += ` AND r.invoice_id = $${paramIndex}`;
                values.push(invoice_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND r.requested_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND r.requested_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY r.requested_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(amount) as total_amount,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                    SUM(amount) FILTER (WHERE status = 'pending') as pending_amount,
                    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
                    SUM(amount) FILTER (WHERE status = 'approved') as approved_amount,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
                    SUM(amount) FILTER (WHERE status = 'completed') as completed_amount,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count
                FROM refunds
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
            logger.error('Error in getAllRefunds', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get refunds by status
     */
    async getRefundsByStatus(staffId, status, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT r.*, 
                       p.id as payment_id,
                       p.payment_number,
                       p.amount as payment_amount,
                       i.invoice_number,
                       CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                       CONCAT(u.first_name, ' ', u.last_name) as requested_by_name
                FROM refunds r
                JOIN payments p ON r.payment_id = p.id
                JOIN invoices i ON r.invoice_id = i.id
                JOIN patients pat ON i.patient_id = pat.id
                LEFT JOIN users u ON r.requested_by = u.id
                WHERE r.status = $1 AND r.is_deleted = false
            `;
            const values = [status];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND r.requested_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND r.requested_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY r.requested_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(amount) as total_amount,
                    AVG(amount)::numeric(10,2) as avg_amount
                FROM refunds
                WHERE status = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [status]);

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
            logger.error('Error in getRefundsByStatus', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get refund by ID
     */
    async getRefundById(staffId, refundId) {
        try {
            const query = `
                SELECT r.*, 
                       p.id as payment_id,
                       p.payment_number,
                       p.amount as payment_amount,
                       p.payment_method,
                       p.payment_date,
                       i.id as invoice_id,
                       i.invoice_number,
                       i.total_amount as invoice_total,
                       i.status as invoice_status,
                       CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                       CONCAT(u1.first_name, ' ', u1.last_name) as requested_by_name,
                       CONCAT(u2.first_name, ' ', u2.last_name) as approved_by_name,
                       CONCAT(u3.first_name, ' ', u3.last_name) as completed_by_name
                FROM refunds r
                JOIN payments p ON r.payment_id = p.id
                JOIN invoices i ON r.invoice_id = i.id
                JOIN patients pat ON i.patient_id = pat.id
                LEFT JOIN users u1 ON r.requested_by = u1.id
                LEFT JOIN users u2 ON r.approved_by = u2.id
                LEFT JOIN users u3 ON r.completed_by = u3.id
                WHERE r.id = $1 AND r.is_deleted = false
            `;

            const result = await db.query(query, [refundId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getRefundById', { error: error.message, staffId, refundId });
            throw error;
        }
    },

    /**
     * Get latest payment for invoice
     */
    async getLatestPaymentForInvoice(staffId, invoiceId) {
        try {
            const result = await db.query(`
                SELECT p.*
                FROM payments p
                WHERE p.invoice_id = $1 
                    AND p.status = 'completed'
                    AND p.is_deleted = false
                ORDER BY p.payment_date DESC
                LIMIT 1
            `, [invoiceId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getLatestPaymentForInvoice', { error: error.message, staffId, invoiceId });
            throw error;
        }
    },

    /**
     * Validate payment for refund [BR-32]
     */
    async validatePaymentForRefund(staffId, paymentId) {
        try {
            const result = await db.query(`
                SELECT p.*, 
                       i.status as invoice_status,
                       i.total_amount as invoice_total,
                       COALESCE(SUM(r.amount), 0) as refunded_amount
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                LEFT JOIN refunds r ON p.id = r.payment_id 
                    AND r.status IN ('approved', 'completed')
                    AND r.is_deleted = false
                WHERE p.id = $1 AND p.is_deleted = false
                GROUP BY p.id, i.id
            `, [paymentId]);

            if (result.rows.length === 0) {
                return null;
            }

            const payment = result.rows[0];
            payment.available_for_refund = payment.amount - (payment.refunded_amount || 0);

            // [BR-32] Check if payment is from paid invoice
            if (payment.invoice_status !== 'paid' && payment.invoice_status !== 'partial') {
                throw new Error(`Refund only available for paid invoices. Current status: ${payment.invoice_status}`);
            }

            return payment;
        } catch (error) {
            logger.error('Error in validatePaymentForRefund', { error: error.message, staffId, paymentId });
            throw error;
        }
    },

    /**
     * Check existing refund
     */
    async checkExistingRefund(staffId, paymentId) {
        try {
            const result = await db.query(`
                SELECT r.*
                FROM refunds r
                WHERE r.payment_id = $1 
                    AND r.status != 'rejected'
                    AND r.is_deleted = false
                ORDER BY r.requested_at DESC
                LIMIT 1
            `, [paymentId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in checkExistingRefund', { error: error.message, staffId, paymentId });
            throw error;
        }
    },

    /**
     * Get related payment
     */
    async getRelatedPayment(staffId, paymentId) {
        try {
            const result = await db.query(`
                SELECT p.*, i.invoice_number
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                WHERE p.id = $1
            `, [paymentId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getRelatedPayment', { error: error.message, staffId, paymentId });
            throw error;
        }
    },

    /**
     * Get related invoice
     */
    async getRelatedInvoice(staffId, invoiceId) {
        try {
            const result = await db.query(`
                SELECT i.*, 
                       CONCAT(pat.first_name, ' ', pat.last_name) as patient_name
                FROM invoices i
                JOIN patients pat ON i.patient_id = pat.id
                WHERE i.id = $1
            `, [invoiceId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getRelatedInvoice', { error: error.message, staffId, invoiceId });
            throw error;
        }
    },

    /**
     * Process refund
     */
    async processRefund(staffId, refundData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate refund number
            const refundNumber = await this.generateRefundNumber();

            const query = `
                INSERT INTO refunds (
                    id, refund_number, payment_id, invoice_id, amount,
                    reason, refund_method, notes, status, requested_by,
                    requested_at, ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'pending',
                    $8, $9, $10, $11, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                refundNumber,
                refundData.payment_id,
                refundData.invoice_id,
                refundData.amount,
                refundData.reason,
                refundData.refund_method,
                refundData.notes,
                refundData.requested_by,
                refundData.requested_at,
                refundData.ip_address,
                refundData.user_agent
            ];

            const result = await client.query(query, values);

            // Log refund activity
            await client.query(`
                INSERT INTO refund_activity_logs (
                    id, refund_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'requested', $2, $3, $4
                )
            `, [result.rows[0].id, refundData.requested_by, refundData.requested_at, refundData.notes]);

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
     * Generate refund number
     */
    async generateRefundNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM refunds
                WHERE refund_number LIKE $1
            `, [`REF-${year}${month}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `REF-${year}${month}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateRefundNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Approve refund
     */
    async approveRefund(staffId, refundId, approveData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE refunds 
                SET status = 'approved',
                    approved_by = $1,
                    approved_at = $2,
                    approval_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'pending'
                RETURNING *
            `;

            const values = [
                approveData.approved_by,
                approveData.approved_at,
                approveData.notes,
                refundId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Refund not found or cannot be approved');
            }

            // Log approval activity
            await client.query(`
                INSERT INTO refund_activity_logs (
                    id, refund_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'approved', $2, $3, $4
                )
            `, [refundId, approveData.approved_by, approveData.approved_at, approveData.notes]);

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
     * Complete refund
     */
    async completeRefund(staffId, refundId, completeData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE refunds 
                SET status = 'completed',
                    completed_by = $1,
                    completed_at = $2,
                    completion_notes = $3,
                    transaction_id = $4,
                    updated_at = NOW()
                WHERE id = $5 AND status = 'approved'
                RETURNING *
            `;

            const values = [
                completeData.completed_by,
                completeData.completed_at,
                completeData.notes,
                completeData.transaction_id,
                refundId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Refund not found or cannot be completed');
            }

            const refund = result.rows[0];

            // Update payment status to refunded
            await client.query(`
                UPDATE payments 
                SET status = 'refunded',
                    refunded_amount = COALESCE(refunded_amount, 0) + $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [refund.amount, refund.payment_id]);

            // Update invoice status
            const invoiceResult = await client.query(`
                SELECT i.total_amount, 
                       COALESCE(SUM(p.amount), 0) as paid_amount,
                       COALESCE(SUM(r.amount), 0) as refunded_amount
                FROM invoices i
                LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                LEFT JOIN refunds r ON i.id = r.invoice_id AND r.status = 'completed'
                WHERE i.id = $1
                GROUP BY i.id
            `, [refund.invoice_id]);

            if (invoiceResult.rows.length > 0) {
                const invoice = invoiceResult.rows[0];
                const netPaid = invoice.paid_amount - invoice.refunded_amount;

                let newStatus = invoice.status;
                if (netPaid <= 0) {
                    newStatus = 'cancelled';
                } else if (netPaid >= invoice.total_amount) {
                    newStatus = 'paid';
                } else {
                    newStatus = 'partial';
                }

                await client.query(`
                    UPDATE invoices 
                    SET status = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `, [newStatus, refund.invoice_id]);
            }

            // Log completion activity
            await client.query(`
                INSERT INTO refund_activity_logs (
                    id, refund_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'completed', $2, $3, $4
                )
            `, [refundId, completeData.completed_by, completeData.completed_at, completeData.notes]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = refundService;