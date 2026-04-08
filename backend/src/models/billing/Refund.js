/**
 * ======================================================================
 * FILE: backend/src/models/billing/Refund.js
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
 * Refund model for database operations.
 * Handles refund processing for payments and invoices.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: refunds
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - refund_number: string (unique)
 * - payment_id: UUID (foreign key to online_payments)
 * - invoice_id: UUID (foreign key to invoices)
 * - refund_amount: decimal
 * - refund_reason: text
 * - refund_status: enum (initiated, processing, completed, failed)
 * - gateway_refund_id: string
 * - initiated_by: uuid
 * - approved_by: uuid
 * - initiated_at: timestamp
 * - processed_at: timestamp
 * - completed_at: timestamp
 * - gateway_response: jsonb
 * - error_message: text
 * - notes: text
 * - created_at: timestamp
 * - updated_at: timestamp
 * - created_by: uuid
 * - updated_by: uuid
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

const Refund = {
    /**
     * Table name
     */
    tableName: 'refunds',

    /**
     * Valid refund statuses
     */
    validStatuses: ['initiated', 'processing', 'completed', 'failed'],

    /**
     * Generate refund number
     * @returns {Promise<string>} Generated refund number
     */
    async generateRefundNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM refunds
                WHERE refund_number LIKE $1
            `;
            const result = await db.query(query, [`REF-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `REF-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating refund number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find refund by ID
     * @param {string} id - Refund UUID
     * @returns {Promise<Object|null>} Refund object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    r.id, r.refund_number, r.payment_id, r.invoice_id,
                    r.refund_amount, r.refund_reason, r.refund_status,
                    r.gateway_refund_id,
                    r.initiated_by, r.approved_by,
                    r.initiated_at, r.processed_at, r.completed_at,
                    r.gateway_response, r.error_message, r.notes,
                    r.created_at, r.updated_at,
                    i.invoice_number,
                    op.gateway_transaction_id, op.payment_gateway,
                    init.username as initiated_by_name,
                    app.username as approved_by_name
                FROM refunds r
                LEFT JOIN invoices i ON r.invoice_id = i.id
                LEFT JOIN online_payments op ON r.payment_id = op.id
                LEFT JOIN users init ON r.initiated_by = init.id
                LEFT JOIN users app ON r.approved_by = app.id
                WHERE r.id = $1 AND r.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Refund found by ID', { refundId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding refund by ID', {
                error: error.message,
                refundId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find refund by number
     * @param {string} refundNumber - Refund number
     * @returns {Promise<Object|null>} Refund object or null
     */
    async findByNumber(refundNumber) {
        try {
            const query = `
                SELECT 
                    id, refund_number, invoice_id, refund_amount,
                    refund_status, initiated_at, completed_at
                FROM refunds
                WHERE refund_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [refundNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Refund found by number', { refundNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding refund by number', {
                error: error.message,
                refundNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find refunds by payment ID
     * @param {string} paymentId - Payment UUID
     * @returns {Promise<Array>} List of refunds
     */
    async findByPaymentId(paymentId) {
        try {
            const query = `
                SELECT 
                    id, refund_number, refund_amount, refund_status,
                    gateway_refund_id, initiated_at, completed_at,
                    notes
                FROM refunds
                WHERE payment_id = $1 AND is_deleted = false
                ORDER BY created_at DESC
            `;

            const result = await db.query(query, [paymentId]);

            logger.debug('Refunds found by payment ID', {
                paymentId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding refunds by payment ID', {
                error: error.message,
                paymentId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find refunds by invoice ID
     * @param {string} invoiceId - Invoice UUID
     * @returns {Promise<Array>} List of refunds
     */
    async findByInvoiceId(invoiceId) {
        try {
            const query = `
                SELECT 
                    id, refund_number, refund_amount, refund_status,
                    gateway_refund_id, initiated_at, completed_at,
                    notes
                FROM refunds
                WHERE invoice_id = $1 AND is_deleted = false
                ORDER BY created_at DESC
            `;

            const result = await db.query(query, [invoiceId]);

            logger.debug('Refunds found by invoice ID', {
                invoiceId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding refunds by invoice ID', {
                error: error.message,
                invoiceId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending refunds
     * @returns {Promise<Array>} List of pending refunds
     */
    async getPendingRefunds() {
        try {
            const query = `
                SELECT 
                    r.id, r.refund_number, r.invoice_id,
                    r.refund_amount, r.refund_status,
                    r.initiated_at, r.initiated_by,
                    i.invoice_number, i.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM refunds r
                LEFT JOIN invoices i ON r.invoice_id = i.id
                LEFT JOIN patients p ON i.patient_id = p.id
                WHERE r.refund_status IN ('initiated', 'processing')
                    AND r.is_deleted = false
                ORDER BY r.initiated_at ASC
            `;

            const result = await db.query(query);

            logger.debug('Pending refunds retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending refunds', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new refund request
     * @param {Object} refundData - Refund data
     * @returns {Promise<Object>} Created refund
     */
    async create(refundData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (refundData.refund_status && !this.validStatuses.includes(refundData.refund_status)) {
                throw new Error(`Invalid refund status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const refundNumber = await this.generateRefundNumber();

            const query = `
                INSERT INTO refunds (
                    id, refund_number, payment_id, invoice_id,
                    refund_amount, refund_reason, refund_status,
                    gateway_refund_id,
                    initiated_by, approved_by,
                    initiated_at, processed_at, completed_at,
                    gateway_response, error_message, notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7,
                    $8, $9,
                    COALESCE($10, NOW()), $11, $12,
                    $13, $14, $15,
                    $16, NOW(), NOW()
                )
                RETURNING 
                    id, refund_number, payment_id, invoice_id,
                    refund_amount, refund_status, initiated_at,
                    created_at
            `;

            const values = [
                refundNumber,
                refundData.payment_id || null,
                refundData.invoice_id,
                refundData.refund_amount,
                refundData.refund_reason,
                refundData.refund_status || 'initiated',
                refundData.gateway_refund_id || null,
                refundData.initiated_by || null,
                refundData.approved_by || null,
                refundData.initiated_at || null,
                refundData.processed_at || null,
                refundData.completed_at || null,
                refundData.gateway_response || null,
                refundData.error_message || null,
                refundData.notes || null,
                refundData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Refund request created', {
                refundId: result.rows[0].id,
                refundNumber,
                invoiceId: refundData.invoice_id,
                amount: refundData.refund_amount
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating refund request', {
                error: error.message,
                invoiceId: refundData.invoice_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update refund
     * @param {string} id - Refund ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated refund
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'refund_status', 'gateway_refund_id', 'processed_by',
                'processed_at', 'completed_at', 'gateway_response',
                'error_message', 'notes', 'approved_by'
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

            setClause.push(`updated_at = NOW()`);
            if (updates.updated_by) {
                setClause.push(`updated_by = $${paramIndex++}`);
                values.push(updates.updated_by);
            }
            values.push(id);

            const query = `
                UPDATE refunds 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, refund_number, refund_status,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Refund not found');
            }

            await db.commitTransaction(client);

            logger.info('Refund updated', {
                refundId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating refund', {
                error: error.message,
                refundId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Approve refund
     * @param {string} id - Refund ID
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated refund
     */
    async approve(id, approvedBy) {
        return this.update(id, {
            refund_status: 'processing',
            approved_by: approvedBy,
            updated_by: approvedBy
        });
    },

    /**
     * Process refund (send to gateway)
     * @param {string} id - Refund ID
     * @param {string} processedBy - User who processed
     * @param {string} gatewayRefundId - Gateway refund ID
     * @returns {Promise<Object>} Updated refund
     */
    async process(id, processedBy, gatewayRefundId = null) {
        const updates = {
            refund_status: 'processing',
            processed_by: processedBy,
            processed_at: new Date(),
            updated_by: processedBy
        };
        if (gatewayRefundId) {
            updates.gateway_refund_id = gatewayRefundId;
        }
        return this.update(id, updates);
    },

    /**
     * Complete refund (success)
     * @param {string} id - Refund ID
     * @param {Object} gatewayResponse - Gateway response
     * @param {string} completedBy - User who completed
     * @returns {Promise<Object>} Updated refund
     */
    async complete(id, gatewayResponse, completedBy) {
        return this.update(id, {
            refund_status: 'completed',
            completed_at: new Date(),
            gateway_response: gatewayResponse,
            updated_by: completedBy
        });
    },

    /**
     * Fail refund
     * @param {string} id - Refund ID
     * @param {string} errorMessage - Error message
     * @param {Object} gatewayResponse - Gateway response
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated refund
     */
    async fail(id, errorMessage, gatewayResponse = null, updatedBy = null) {
        return this.update(id, {
            refund_status: 'failed',
            error_message: errorMessage,
            gateway_response: gatewayResponse,
            updated_by: updatedBy
        });
    },

    /**
     * Get refund statistics
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
                    COUNT(*) as total_refunds,
                    SUM(refund_amount) as total_refund_amount,
                    AVG(refund_amount)::numeric(10,2) as avg_refund_amount,
                    COUNT(*) FILTER (WHERE refund_status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE refund_status = 'failed') as failed,
                    COUNT(*) FILTER (WHERE refund_status = 'processing') as processing,
                    COUNT(*) FILTER (WHERE refund_status = 'initiated') as initiated,
                    COUNT(DISTINCT invoice_id) as unique_invoices,
                    COUNT(DISTINCT payment_id) as unique_payments
                FROM refunds
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Refund statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting refund statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get refunds by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of refunds
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    r.id, r.refund_number, r.invoice_id,
                    r.refund_amount, r.refund_status,
                    r.initiated_at, r.completed_at,
                    i.invoice_number,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM refunds r
                LEFT JOIN invoices i ON r.invoice_id = i.id
                LEFT JOIN patients p ON i.patient_id = p.id
                WHERE r.initiated_at BETWEEN $1 AND $2
                    AND r.is_deleted = false
                ORDER BY r.initiated_at DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [startDate, endDate, limit, offset]);

            logger.debug('Refunds found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting refunds by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete refund
     * @param {string} id - Refund ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE refunds 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Refund not found');
            }

            await db.commitTransaction(client);

            logger.info('Refund soft deleted', {
                refundId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting refund', {
                error: error.message,
                refundId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Refund;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */