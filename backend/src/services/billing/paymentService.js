/**
 * ======================================================================
 * FILE: backend/src/services/billing/paymentService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing payment service - Handles business logic for payment processing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-31] Payment must be verified before invoice marked paid
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const paymentService = {
    /**
     * Get all payments
     */
    async getAllPayments(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, status, payment_method, invoice_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT p.*, 
                       i.invoice_number,
                       i.total_amount as invoice_total,
                       CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name,
                       CONCAT(v.first_name, ' ', v.last_name) as verified_by_name
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN patients pat ON i.patient_id = pat.id
                LEFT JOIN users u ON p.recorded_by = u.id
                LEFT JOIN users v ON p.verified_by = v.id
                WHERE p.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND p.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (payment_method) {
                query += ` AND p.payment_method = $${paramIndex}`;
                values.push(payment_method);
                paramIndex++;
            }

            if (invoice_id) {
                query += ` AND p.invoice_id = $${paramIndex}`;
                values.push(invoice_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND p.payment_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND p.payment_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY p.payment_date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(amount) as total_amount,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
                    SUM(amount) FILTER (WHERE status = 'completed') as completed_amount
                FROM payments
                WHERE is_deleted = false
                ${status ? 'AND status = $1' : ''}
                ${payment_method ? 'AND payment_method = $2' : ''}
            `;
            const countValues = [];
            if (status) countValues.push(status);
            if (payment_method) countValues.push(payment_method);
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
            logger.error('Error in getAllPayments', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get payments by method
     */
    async getPaymentsByMethod(staffId, methods, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            const methodArray = Array.isArray(methods) ? methods : [methods];

            let query = `
                SELECT p.*, 
                       i.invoice_number,
                       CONCAT(pat.first_name, ' ', pat.last_name) as patient_name
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN patients pat ON i.patient_id = pat.id
                WHERE p.payment_method = ANY($1::text[]) 
                    AND p.status = 'completed'
                    AND p.is_deleted = false
            `;
            const values = [methodArray];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND p.payment_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND p.payment_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY p.payment_date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(amount) as total_amount
                FROM payments
                WHERE payment_method = ANY($1::text[]) 
                    AND status = 'completed'
                    AND is_deleted = false
            `;
            const count = await db.query(countQuery, [methodArray]);

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
            logger.error('Error in getPaymentsByMethod', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get payment by ID
     */
    async getPaymentById(staffId, paymentId) {
        try {
            const query = `
                SELECT p.*, 
                       i.invoice_number,
                       i.total_amount as invoice_total,
                       i.status as invoice_status,
                       CONCAT(pat.first_name, ' ', pat.last_name) as patient_name,
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name,
                       CONCAT(v.first_name, ' ', v.last_name) as verified_by_name
                FROM payments p
                JOIN invoices i ON p.invoice_id = i.id
                JOIN patients pat ON i.patient_id = pat.id
                LEFT JOIN users u ON p.recorded_by = u.id
                LEFT JOIN users v ON p.verified_by = v.id
                WHERE p.id = $1 AND p.is_deleted = false
            `;

            const result = await db.query(query, [paymentId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getPaymentById', { error: error.message, staffId, paymentId });
            throw error;
        }
    },

    /**
     * Validate invoice for payment [BR-31]
     */
    async validateInvoiceForPayment(staffId, invoiceId) {
        try {
            const result = await db.query(`
                SELECT i.*, 
                       COALESCE(SUM(p.amount), 0) as paid_amount
                FROM invoices i
                LEFT JOIN payments p ON i.id = p.invoice_id 
                    AND p.status = 'completed' 
                    AND p.is_deleted = false
                WHERE i.id = $1 AND i.is_deleted = false
                GROUP BY i.id
            `, [invoiceId]);

            if (result.rows.length === 0) {
                return null;
            }

            const invoice = result.rows[0];
            invoice.balance_due = invoice.total_amount - (invoice.paid_amount || 0);

            return invoice;
        } catch (error) {
            logger.error('Error in validateInvoiceForPayment', { error: error.message, staffId, invoiceId });
            throw error;
        }
    },

    /**
     * Get related invoice
     */
    async getRelatedInvoice(staffId, invoiceId) {
        try {
            const result = await db.query(`
                SELECT i.id, i.invoice_number, i.total_amount, i.status,
                       COALESCE(SUM(p.amount), 0) as paid_amount
                FROM invoices i
                LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                WHERE i.id = $1 AND i.is_deleted = false
                GROUP BY i.id
            `, [invoiceId]);

            if (result.rows.length === 0) {
                return null;
            }

            const invoice = result.rows[0];
            invoice.balance_due = invoice.total_amount - (invoice.paid_amount || 0);
            return invoice;
        } catch (error) {
            logger.error('Error in getRelatedInvoice', { error: error.message, staffId, invoiceId });
            throw error;
        }
    },

    /**
     * Record payment
     */
    async recordPayment(staffId, paymentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate payment number
            const paymentNumber = await this.generatePaymentNumber();

            const query = `
                INSERT INTO payments (
                    id, payment_number, invoice_id, amount, payment_date,
                    payment_method, reference_number, notes, status,
                    recorded_by, ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'pending',
                    $8, $9, $10, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                paymentNumber,
                paymentData.invoice_id,
                paymentData.amount,
                paymentData.payment_date,
                paymentData.payment_method,
                paymentData.reference_number,
                paymentData.notes,
                paymentData.recorded_by,
                paymentData.ip_address,
                paymentData.user_agent
            ];

            const result = await client.query(query, values);
            const payment = result.rows[0];

            // Log payment activity
            await client.query(`
                INSERT INTO payment_activity_logs (
                    id, payment_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'recorded', $2, $3, $4
                )
            `, [payment.id, paymentData.recorded_by, paymentData.payment_date, paymentData.notes]);

            await db.commitTransaction(client);

            return payment;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Generate payment number
     */
    async generatePaymentNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM payments
                WHERE payment_number LIKE $1
            `, [`PAY-${year}${month}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `PAY-${year}${month}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generatePaymentNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Create payment order for online payment
     */
    async createPaymentOrder(staffId, orderData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate order ID
            const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const query = `
                INSERT INTO payment_orders (
                    id, order_id, invoice_id, amount, payment_method,
                    gateway, return_url, customer_details, status,
                    created_by, ip_address, user_agent, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'created',
                    $8, $9, $10, NOW()
                ) RETURNING *
            `;

            const values = [
                orderId,
                orderData.invoice_id,
                orderData.amount,
                orderData.payment_method,
                orderData.gateway,
                orderData.return_url,
                JSON.stringify(orderData.customer_details || {}),
                orderData.created_by,
                orderData.ip_address,
                orderData.user_agent
            ];

            const result = await client.query(query, values);

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
     * Verify payment [BR-31]
     */
    async verifyPayment(staffId, paymentId, verifyData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE payments 
                SET status = $1,
                    verified_by = $2,
                    verified_at = $3,
                    verification_notes = $4,
                    transaction_id = COALESCE($5, transaction_id),
                    updated_at = NOW()
                WHERE id = $6 AND status = 'pending'
                RETURNING *
            `;

            const status = verifyData.verified ? 'completed' : 'failed';

            const values = [
                status,
                verifyData.verified_by,
                verifyData.verified_at,
                verifyData.notes,
                verifyData.transaction_id,
                paymentId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Payment not found or already verified');
            }

            const payment = result.rows[0];

            // If payment is successful, update invoice status [BR-31]
            if (verifyData.verified) {
                // Get current paid amount for invoice
                const paidAmount = await client.query(`
                    SELECT COALESCE(SUM(amount), 0) as total_paid
                    FROM payments
                    WHERE invoice_id = $1 AND status = 'completed'
                `, [payment.invoice_id]);

                const invoiceResult = await client.query(`
                    SELECT total_amount FROM invoices WHERE id = $1
                `, [payment.invoice_id]);

                const invoiceTotal = invoiceResult.rows[0].total_amount;
                const totalPaid = parseFloat(paidAmount.rows[0].total_paid);

                // Determine new invoice status
                let invoiceStatus = 'approved';
                if (totalPaid >= invoiceTotal) {
                    invoiceStatus = 'paid';
                } else if (totalPaid > 0) {
                    invoiceStatus = 'partial';
                }

                await client.query(`
                    UPDATE invoices 
                    SET status = $1,
                        paid_amount = $2,
                        updated_at = NOW()
                    WHERE id = $3
                `, [invoiceStatus, totalPaid, payment.invoice_id]);
            }

            // Log verification activity
            await client.query(`
                INSERT INTO payment_activity_logs (
                    id, payment_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'verified', $2, $3, $4
                )
            `, [paymentId, verifyData.verified_by, verifyData.verified_at, verifyData.notes]);

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
     * Get payment summary
     */
    async getPaymentSummary(staffId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND payment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND payment_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    COUNT(*) as total_payments,
                    SUM(amount) as total_amount,
                    AVG(amount)::numeric(10,2) as average_amount,
                    COUNT(*) FILTER (WHERE payment_method = 'cash') as cash_count,
                    SUM(amount) FILTER (WHERE payment_method = 'cash') as cash_amount,
                    COUNT(*) FILTER (WHERE payment_method = 'card') as card_count,
                    SUM(amount) FILTER (WHERE payment_method = 'card') as card_amount,
                    COUNT(*) FILTER (WHERE payment_method = 'upi') as upi_count,
                    SUM(amount) FILTER (WHERE payment_method = 'upi') as upi_amount,
                    COUNT(*) FILTER (WHERE payment_method = 'net_banking') as net_banking_count,
                    SUM(amount) FILTER (WHERE payment_method = 'net_banking') as net_banking_amount,
                    COUNT(*) FILTER (WHERE payment_method = 'insurance') as insurance_count,
                    SUM(amount) FILTER (WHERE payment_method = 'insurance') as insurance_amount,
                    DATE_TRUNC('day', payment_date) as payment_day,
                    COUNT(*) as daily_count,
                    SUM(amount) as daily_amount
                FROM payments
                WHERE status = 'completed' 
                    AND is_deleted = false
                    ${dateFilter}
                GROUP BY DATE_TRUNC('day', payment_date)
                ORDER BY payment_day DESC
                LIMIT 30
            `;

            const result = await db.query(query);

            // Calculate totals
            const totals = {
                total_payments: 0,
                total_amount: 0,
                average_amount: 0,
                by_method: {
                    cash: { count: 0, amount: 0 },
                    card: { count: 0, amount: 0 },
                    upi: { count: 0, amount: 0 },
                    net_banking: { count: 0, amount: 0 },
                    insurance: { count: 0, amount: 0 }
                },
                daily_breakdown: []
            };

            for (const row of result.rows) {
                totals.total_payments += parseInt(row.total_payments);
                totals.total_amount += parseFloat(row.total_amount);
                totals.by_method.cash.count += parseInt(row.cash_count || 0);
                totals.by_method.cash.amount += parseFloat(row.cash_amount || 0);
                totals.by_method.card.count += parseInt(row.card_count || 0);
                totals.by_method.card.amount += parseFloat(row.card_amount || 0);
                totals.by_method.upi.count += parseInt(row.upi_count || 0);
                totals.by_method.upi.amount += parseFloat(row.upi_amount || 0);
                totals.by_method.net_banking.count += parseInt(row.net_banking_count || 0);
                totals.by_method.net_banking.amount += parseFloat(row.net_banking_amount || 0);
                totals.by_method.insurance.count += parseInt(row.insurance_count || 0);
                totals.by_method.insurance.amount += parseFloat(row.insurance_amount || 0);
                
                totals.daily_breakdown.push({
                    date: row.payment_day,
                    count: parseInt(row.daily_count),
                    amount: parseFloat(row.daily_amount)
                });
            }

            if (totals.total_payments > 0) {
                totals.average_amount = totals.total_amount / totals.total_payments;
            }

            return {
                totals,
                daily_breakdown: totals.daily_breakdown,
                by_method: totals.by_method,
                period: { from_date: from_date || 'last_30_days', to_date: to_date || 'today' }
            };
        } catch (error) {
            logger.error('Error in getPaymentSummary', { error: error.message, staffId });
            throw error;
        }
    }
};

module.exports = paymentService;