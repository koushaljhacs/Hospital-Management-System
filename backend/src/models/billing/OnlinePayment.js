/**
 * ======================================================================
 * FILE: backend/src/models/billing/OnlinePayment.js
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
 * OnlinePayment model for database operations.
 * Handles online payment transactions via payment gateways.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: online_payments
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - invoice_id: UUID (foreign key to invoices)
 * - patient_id: UUID (foreign key to patients)
 * - payment_gateway: string
 * - gateway_transaction_id: string (unique)
 * - order_id: string
 * - amount: decimal
 * - currency: string
 * - payment_method: string
 * - payment_status: enum (initiated, pending, success, failed)
 * - gateway_response: jsonb
 * - error_message: text
 * - initiated_at: timestamp
 * - completed_at: timestamp
 * - refund_id: string
 * - metadata: jsonb
 * - created_at: timestamp
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

const OnlinePayment = {
    /**
     * Table name
     */
    tableName: 'online_payments',

    /**
     * Valid payment statuses
     */
    validPaymentStatuses: ['initiated', 'pending', 'success', 'failed'],

    /**
     * Valid payment gateways
     */
    validGateways: ['razorpay', 'stripe', 'phonepe', 'paytm'],

    /**
     * Find payment by ID
     * @param {string} id - Payment UUID
     * @returns {Promise<Object|null>} Payment object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    op.id, op.invoice_id, op.patient_id,
                    op.payment_gateway, op.gateway_transaction_id,
                    op.order_id, op.amount, op.currency,
                    op.payment_method, op.payment_status,
                    op.gateway_response, op.error_message,
                    op.initiated_at, op.completed_at,
                    op.refund_id, op.metadata,
                    op.created_at,
                    i.invoice_number, i.total as invoice_total,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM online_payments op
                LEFT JOIN invoices i ON op.invoice_id = i.id
                LEFT JOIN patients p ON op.patient_id = p.id
                WHERE op.id = $1 AND op.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Online payment found by ID', { paymentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding online payment by ID', {
                error: error.message,
                paymentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find payment by gateway transaction ID
     * @param {string} gatewayTransactionId - Gateway transaction ID
     * @returns {Promise<Object|null>} Payment object or null
     */
    async findByGatewayTransactionId(gatewayTransactionId) {
        try {
            const query = `
                SELECT 
                    id, invoice_id, patient_id, payment_gateway,
                    gateway_transaction_id, amount, payment_status,
                    initiated_at, completed_at, refund_id
                FROM online_payments
                WHERE gateway_transaction_id = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [gatewayTransactionId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Online payment found by gateway transaction ID', {
                gatewayTransactionId
            });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding online payment by gateway transaction ID', {
                error: error.message,
                gatewayTransactionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find payment by order ID
     * @param {string} orderId - Order ID
     * @returns {Promise<Object|null>} Payment object or null
     */
    async findByOrderId(orderId) {
        try {
            const query = `
                SELECT 
                    id, invoice_id, patient_id, payment_gateway,
                    order_id, amount, payment_status,
                    initiated_at, completed_at
                FROM online_payments
                WHERE order_id = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [orderId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Online payment found by order ID', { orderId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding online payment by order ID', {
                error: error.message,
                orderId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find payments by invoice ID
     * @param {string} invoiceId - Invoice UUID
     * @returns {Promise<Array>} List of payments
     */
    async findByInvoiceId(invoiceId) {
        try {
            const query = `
                SELECT 
                    id, gateway_transaction_id, payment_gateway,
                    amount, payment_status, initiated_at,
                    completed_at, refund_id
                FROM online_payments
                WHERE invoice_id = $1 AND is_deleted = false
                ORDER BY created_at DESC
            `;

            const result = await db.query(query, [invoiceId]);

            logger.debug('Online payments found by invoice ID', {
                invoiceId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding online payments by invoice ID', {
                error: error.message,
                invoiceId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find payments by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of payments
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, payment_status, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (payment_status) {
                conditions.push(`payment_status = $${paramIndex++}`);
                values.push(payment_status);
            }
            if (from_date) {
                conditions.push(`initiated_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`initiated_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, gateway_transaction_id, payment_gateway,
                    amount, payment_status, initiated_at,
                    completed_at, refund_id
                FROM online_payments
                ${whereClause}
                ORDER BY initiated_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Online payments found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding online payments by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending payments (for webhook verification)
     * @returns {Promise<Array>} List of pending payments
     */
    async getPendingPayments() {
        try {
            const query = `
                SELECT 
                    id, invoice_id, gateway_transaction_id,
                    payment_gateway, order_id, amount,
                    initiated_at, gateway_response
                FROM online_payments
                WHERE payment_status IN ('initiated', 'pending')
                    AND is_deleted = false
                ORDER BY initiated_at ASC
            `;

            const result = await db.query(query);

            logger.debug('Pending online payments retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending online payments', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new online payment record
     * @param {Object} paymentData - Payment data
     * @returns {Promise<Object>} Created payment
     */
    async create(paymentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (paymentData.payment_gateway && !this.validGateways.includes(paymentData.payment_gateway)) {
                throw new Error(`Invalid payment gateway. Must be one of: ${this.validGateways.join(', ')}`);
            }
            if (paymentData.payment_status && !this.validPaymentStatuses.includes(paymentData.payment_status)) {
                throw new Error(`Invalid payment status. Must be one of: ${this.validPaymentStatuses.join(', ')}`);
            }

            // Check if transaction ID already exists
            if (paymentData.gateway_transaction_id) {
                const existing = await this.findByGatewayTransactionId(paymentData.gateway_transaction_id);
                if (existing) {
                    throw new Error('Gateway transaction ID already exists');
                }
            }

            const query = `
                INSERT INTO online_payments (
                    id, invoice_id, patient_id,
                    payment_gateway, gateway_transaction_id, order_id,
                    amount, currency, payment_method, payment_status,
                    gateway_response, error_message,
                    initiated_at, completed_at, metadata,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    $6, COALESCE($7, 'INR'), $8, $9,
                    $10, $11,
                    COALESCE($12, NOW()), $13, $14,
                    NOW()
                )
                RETURNING 
                    id, invoice_id, gateway_transaction_id,
                    amount, payment_status, initiated_at,
                    created_at
            `;

            const values = [
                paymentData.invoice_id || null,
                paymentData.patient_id,
                paymentData.payment_gateway,
                paymentData.gateway_transaction_id || null,
                paymentData.order_id || null,
                paymentData.amount,
                paymentData.currency,
                paymentData.payment_method || null,
                paymentData.payment_status || 'initiated',
                paymentData.gateway_response || null,
                paymentData.error_message || null,
                paymentData.initiated_at || null,
                paymentData.completed_at || null,
                paymentData.metadata || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Online payment record created', {
                paymentId: result.rows[0].id,
                invoiceId: paymentData.invoice_id,
                amount: paymentData.amount,
                status: paymentData.payment_status
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating online payment record', {
                error: error.message,
                invoiceId: paymentData.invoice_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update payment status
     * @param {string} id - Payment ID
     * @param {string} status - New status
     * @param {Object} responseData - Gateway response data
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated payment
     */
    async updateStatus(id, status, responseData = null, updatedBy = null) {
        if (!this.validPaymentStatuses.includes(status)) {
            throw new Error(`Invalid payment status. Must be one of: ${this.validPaymentStatuses.join(', ')}`);
        }

        const updates = {
            payment_status: status,
            gateway_response: responseData,
            updated_by: updatedBy
        };

        if (status === 'success') {
            updates.completed_at = new Date();
        }

        return this.update(id, updates);
    },

    /**
     * Mark payment as successful (after webhook/callback)
     * @param {string} id - Payment ID
     * @param {Object} gatewayResponse - Gateway response
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated payment
     */
    async markSuccess(id, gatewayResponse, updatedBy = null) {
        return this.updateStatus(id, 'success', gatewayResponse, updatedBy);
    },

    /**
     * Mark payment as failed
     * @param {string} id - Payment ID
     * @param {string} errorMessage - Error message
     * @param {Object} gatewayResponse - Gateway response
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated payment
     */
    async markFailed(id, errorMessage, gatewayResponse = null, updatedBy = null) {
        const updates = {
            payment_status: 'failed',
            error_message: errorMessage,
            gateway_response: gatewayResponse,
            updated_by: updatedBy
        };
        return this.update(id, updates);
    },

    /**
     * Update payment record
     * @param {string} id - Payment ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated payment
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'payment_status', 'gateway_response', 'error_message',
                'completed_at', 'refund_id', 'metadata'
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

            values.push(id);

            const query = `
                UPDATE online_payments 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, invoice_id, gateway_transaction_id,
                    payment_status, completed_at, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Online payment not found');
            }

            await db.commitTransaction(client);

            logger.info('Online payment updated', {
                paymentId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating online payment', {
                error: error.message,
                paymentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Record refund for payment
     * @param {string} id - Payment ID
     * @param {string} refundId - Refund ID from gateway
     * @param {string} updatedBy - User who recorded refund
     * @returns {Promise<Object>} Updated payment
     */
    async recordRefund(id, refundId, updatedBy = null) {
        return this.update(id, {
            refund_id: refundId,
            updated_by: updatedBy
        });
    },

    /**
     * Get payment statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND initiated_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END) as total_success_amount,
                    SUM(CASE WHEN payment_status = 'success' THEN 1 ELSE 0 END) as success_count,
                    SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
                    SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    ROUND((SUM(CASE WHEN payment_status = 'success' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as success_rate,
                    COUNT(DISTINCT payment_gateway) as gateways_used,
                    COUNT(DISTINCT invoice_id) as unique_invoices,
                    AVG(amount)::numeric(10,2) as avg_transaction_amount
                FROM online_payments
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Online payment statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting online payment statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get payments by gateway
     * @param {string} gateway - Payment gateway name
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of payments
     */
    async getByGateway(gateway, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [gateway];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (from_date) {
                conditions.push(`initiated_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`initiated_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, invoice_id, gateway_transaction_id,
                    amount, payment_status, initiated_at,
                    completed_at
                FROM online_payments
                ${whereClause}
                ORDER BY initiated_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Online payments found by gateway', {
                gateway,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting online payments by gateway', {
                error: error.message,
                gateway
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete online payment
     * @param {string} id - Payment ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE online_payments 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Online payment not found');
            }

            await db.commitTransaction(client);

            logger.info('Online payment soft deleted', {
                paymentId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting online payment', {
                error: error.message,
                paymentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = OnlinePayment;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */