/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/PurchaseOrder.js
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
 * PurchaseOrder model for database operations.
 * Handles procurement of medicines and supplies from suppliers.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: purchase_orders
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - po_number: string (unique)
 * - supplier_id: UUID (foreign key to suppliers)
 * - order_date: date
 * - expected_delivery: date
 * - actual_delivery: date
 * - delivery_status: enum (pending, shipped, in_transit, delivered, delayed, partial)
 * - subtotal: decimal
 * - discount: decimal
 * - discount_type: string
 * - tax_amount: decimal
 * - tax_details: jsonb
 * - shipping_cost: decimal
 * - other_charges: decimal
 * - total_amount: decimal
 * - currency: string
 * - exchange_rate: decimal
 * - payment_terms: string
 * - payment_due_date: date
 * - payment_status: enum (pending, partial, paid, overdue)
 * - advance_paid: decimal
 * - balance_amount: decimal (generated)
 * - payment_history: jsonb
 * - items: jsonb
 * - item_count: integer
 * - total_quantity: integer
 * - shipping_address: text
 * - shipping_method: string
 * - tracking_number: string
 * - carrier: string
 * - shipping_notes: text
 * - po_document_url: text
 * - invoice_received_url: text
 * - delivery_challan_url: text
 * - other_documents: jsonb
 * - status: enum (draft, submitted, pending_approval, approved, rejected, ordered, partially_received, received, cancelled, completed)
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
 * - received_by: uuid
 * - received_at: timestamp
 * - received_notes: text
 * - quality_check_passed: boolean
 * - quality_check_notes: text
 * - inspected_by: uuid
 * - inspected_at: timestamp
 * - notes: text
 * - internal_notes: text
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

const PurchaseOrder = {
    /**
     * Table name
     */
    tableName: 'purchase_orders',

    /**
     * Valid delivery statuses
     */
    validDeliveryStatuses: ['pending', 'shipped', 'in_transit', 'delivered', 'delayed', 'partial'],

    /**
     * Valid payment statuses
     */
    validPaymentStatuses: ['pending', 'partial', 'paid', 'overdue'],

    /**
     * Valid order statuses
     */
    validStatuses: [
        'draft', 'submitted', 'pending_approval', 'approved', 'rejected',
        'ordered', 'partially_received', 'received', 'cancelled', 'completed'
    ],

    /**
     * Generate PO number
     * @returns {Promise<string>} Generated PO number
     */
    async generatePONumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM purchase_orders
                WHERE po_number LIKE $1
            `;
            const result = await db.query(query, [`PO-${year}${month}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `PO-${year}${month}-${sequence}`;
        } catch (error) {
            logger.error('Error generating PO number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find purchase order by ID
     * @param {string} id - Purchase order UUID
     * @returns {Promise<Object|null>} Purchase order object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    po.id, po.po_number, po.supplier_id,
                    po.order_date, po.expected_delivery, po.actual_delivery,
                    po.delivery_status,
                    po.subtotal, po.discount, po.discount_type,
                    po.tax_amount, po.tax_details,
                    po.shipping_cost, po.other_charges, po.total_amount,
                    po.currency, po.exchange_rate,
                    po.payment_terms, po.payment_due_date, po.payment_status,
                    po.advance_paid, po.balance_amount, po.payment_history,
                    po.items, po.item_count, po.total_quantity,
                    po.shipping_address, po.shipping_method,
                    po.tracking_number, po.carrier, po.shipping_notes,
                    po.po_document_url, po.invoice_received_url,
                    po.delivery_challan_url, po.other_documents,
                    po.status, po.approval_level,
                    po.submitted_by, po.submitted_at,
                    po.approved_by, po.approved_at,
                    po.rejected_by, po.rejected_at, po.rejection_reason,
                    po.cancelled_by, po.cancelled_at, po.cancellation_reason,
                    po.received_by, po.received_at, po.received_notes,
                    po.quality_check_passed, po.quality_check_notes,
                    po.inspected_by, po.inspected_at,
                    po.notes, po.internal_notes, po.metadata,
                    po.created_at, po.updated_at,
                    s.name as supplier_name, s.code as supplier_code,
                    sub.username as submitted_by_name,
                    app.username as approved_by_name,
                    rej.username as rejected_by_name,
                    can.username as cancelled_by_name,
                    rec.username as received_by_name,
                    insp.username as inspected_by_name
                FROM purchase_orders po
                LEFT JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN users sub ON po.submitted_by = sub.id
                LEFT JOIN users app ON po.approved_by = app.id
                LEFT JOIN users rej ON po.rejected_by = rej.id
                LEFT JOIN users can ON po.cancelled_by = can.id
                LEFT JOIN users rec ON po.received_by = rec.id
                LEFT JOIN users insp ON po.inspected_by = insp.id
                WHERE po.id = $1 AND po.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Purchase order found by ID', { poId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding purchase order by ID', {
                error: error.message,
                poId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find purchase order by PO number
     * @param {string} poNumber - PO number
     * @returns {Promise<Object|null>} Purchase order object or null
     */
    async findByPONumber(poNumber) {
        try {
            const query = `
                SELECT 
                    id, po_number, supplier_id, order_date,
                    expected_delivery, status, payment_status,
                    total_amount, created_at
                FROM purchase_orders
                WHERE po_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [poNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Purchase order found by PO number', { poNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding purchase order by PO number', {
                error: error.message,
                poNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find purchase orders by supplier ID
     * @param {string} supplierId - Supplier UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of purchase orders
     */
    async findBySupplierId(supplierId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, from_date, to_date } = options;
            const values = [supplierId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }
            if (from_date) {
                conditions.push(`order_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`order_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, po_number, order_date, expected_delivery,
                    total_amount, status, payment_status,
                    delivery_status, created_at
                FROM purchase_orders
                ${whereClause}
                ORDER BY order_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Purchase orders found by supplier ID', {
                supplierId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding purchase orders by supplier ID', {
                error: error.message,
                supplierId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get purchase orders by status
     * @param {string} status - Order status
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of purchase orders
     */
    async findByStatus(status, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    po.id, po.po_number, po.supplier_id,
                    po.order_date, po.expected_delivery,
                    po.total_amount, po.status, po.payment_status,
                    s.name as supplier_name
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.id
                WHERE po.status = $1 AND po.is_deleted = false
                ORDER BY po.order_date ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            logger.debug('Purchase orders found by status', {
                status,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding purchase orders by status', {
                error: error.message,
                status
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending approval orders
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of pending approval orders
     */
    async getPendingApproval(options = {}) {
        return this.findByStatus('pending_approval', options);
    },

    /**
     * Get overdue payments
     * @returns {Promise<Array>} List of overdue orders
     */
    async getOverduePayments() {
        try {
            const query = `
                SELECT 
                    po.id, po.po_number, po.supplier_id,
                    po.total_amount, po.paid_amount, po.balance_amount,
                    po.payment_due_date, po.payment_status,
                    s.name as supplier_name, s.phone as supplier_phone
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.id
                WHERE po.payment_status = 'overdue'
                    AND po.is_deleted = false
                ORDER BY po.payment_due_date ASC
            `;

            const result = await db.query(query);

            logger.debug('Overdue payments retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting overdue payments', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new purchase order
     * @param {Object} poData - Purchase order data
     * @returns {Promise<Object>} Created purchase order
     */
    async create(poData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const poNumber = await this.generatePONumber();

            // Calculate totals from items
            let subtotal = 0;
            let totalQuantity = 0;
            const items = poData.items || [];

            for (const item of items) {
                subtotal += item.quantity * item.unit_price;
                totalQuantity += item.quantity;
            }

            const discount = poData.discount || 0;
            const taxAmount = poData.tax_amount || 0;
            const shippingCost = poData.shipping_cost || 0;
            const otherCharges = poData.other_charges || 0;
            const totalAmount = subtotal - discount + taxAmount + shippingCost + otherCharges;

            const query = `
                INSERT INTO purchase_orders (
                    id, po_number, supplier_id,
                    order_date, expected_delivery,
                    subtotal, discount, discount_type,
                    tax_amount, tax_details,
                    shipping_cost, other_charges, total_amount,
                    currency, exchange_rate,
                    payment_terms, payment_due_date,
                    items, item_count, total_quantity,
                    shipping_address, shipping_method,
                    shipping_notes,
                    po_document_url,
                    status, approval_level,
                    notes, internal_notes, metadata,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    COALESCE($3, CURRENT_DATE), $4,
                    $5, $6, $7,
                    $8, $9,
                    $10, $11, $12,
                    COALESCE($13, 'INR'), COALESCE($14, 1),
                    $15, $16,
                    $17, $18, $19,
                    $20, $21,
                    $22,
                    $23,
                    COALESCE($24, 'draft'), COALESCE($25, 1),
                    $26, $27, $28,
                    $29, NOW(), NOW()
                )
                RETURNING 
                    id, po_number, supplier_id,
                    order_date, expected_delivery,
                    total_amount, status, created_at
            `;

            const values = [
                poNumber,
                poData.supplier_id,
                poData.order_date || null,
                poData.expected_delivery,
                subtotal,
                discount,
                poData.discount_type || null,
                taxAmount,
                poData.tax_details || null,
                shippingCost,
                otherCharges,
                totalAmount,
                poData.currency,
                poData.exchange_rate,
                poData.payment_terms || null,
                poData.payment_due_date || null,
                items,
                items.length,
                totalQuantity,
                poData.shipping_address || null,
                poData.shipping_method || null,
                poData.shipping_notes || null,
                poData.po_document_url || null,
                poData.status,
                poData.approval_level,
                poData.notes || null,
                poData.internal_notes || null,
                poData.metadata || null,
                poData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Purchase order created successfully', {
                poId: result.rows[0].id,
                poNumber,
                supplierId: poData.supplier_id,
                totalAmount
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating purchase order', {
                error: error.message,
                supplierId: poData.supplier_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update purchase order
     * @param {string} id - Purchase order ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated purchase order
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'expected_delivery', 'actual_delivery', 'delivery_status',
                'discount', 'discount_type', 'tax_amount', 'tax_details',
                'shipping_cost', 'other_charges', 'total_amount',
                'payment_terms', 'payment_due_date', 'payment_status',
                'advance_paid', 'payment_history',
                'items', 'item_count', 'total_quantity',
                'shipping_address', 'shipping_method',
                'tracking_number', 'carrier', 'shipping_notes',
                'po_document_url', 'invoice_received_url',
                'delivery_challan_url', 'other_documents',
                'status', 'approval_level',
                'submitted_by', 'submitted_at',
                'approved_by', 'approved_at',
                'rejected_by', 'rejected_at', 'rejection_reason',
                'cancelled_by', 'cancelled_at', 'cancellation_reason',
                'received_by', 'received_at', 'received_notes',
                'quality_check_passed', 'quality_check_notes',
                'inspected_by', 'inspected_at',
                'notes', 'internal_notes', 'metadata'
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
                UPDATE purchase_orders 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, po_number, status,
                    payment_status, delivery_status,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            await db.commitTransaction(client);

            logger.info('Purchase order updated', {
                poId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating purchase order', {
                error: error.message,
                poId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Submit purchase order for approval
     * @param {string} id - Purchase order ID
     * @param {string} submittedBy - User who submitted
     * @returns {Promise<Object>} Updated purchase order
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
     * Approve purchase order
     * @param {string} id - Purchase order ID
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated purchase order
     */
    async approve(id, approvedBy) {
        const order = await this.findById(id);
        if (!order) {
            throw new Error('Purchase order not found');
        }

        const newStatus = order.approval_level === 1 ? 'approved' : 'pending_approval';
        const approvalLevel = order.approval_level ? order.approval_level - 1 : 0;

        return this.update(id, {
            status: newStatus,
            approval_level: approvalLevel,
            approved_by: approvedBy,
            approved_at: new Date(),
            updated_by: approvedBy
        });
    },

    /**
     * Reject purchase order
     * @param {string} id - Purchase order ID
     * @param {string} rejectedBy - User who rejected
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated purchase order
     */
    async reject(id, rejectedBy, reason) {
        return this.update(id, {
            status: 'rejected',
            rejected_by: rejectedBy,
            rejected_at: new Date(),
            rejection_reason: reason,
            updated_by: rejectedBy
        });
    },

    /**
     * Cancel purchase order
     * @param {string} id - Purchase order ID
     * @param {string} cancelledBy - User who cancelled
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Updated purchase order
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
     * Mark order as ordered (sent to supplier)
     * @param {string} id - Purchase order ID
     * @param {string} orderedBy - User who marked as ordered
     * @returns {Promise<Object>} Updated purchase order
     */
    async markAsOrdered(id, orderedBy) {
        return this.update(id, {
            status: 'ordered',
            updated_by: orderedBy
        });
    },

    /**
     * Record partial receipt of goods
     * @param {string} id - Purchase order ID
     * @param {Object} receiptData - Receipt data
     * @returns {Promise<Object>} Updated purchase order
     */
    async recordPartialReceipt(id, receiptData) {
        return this.update(id, {
            status: 'partially_received',
            delivery_status: 'partial',
            received_by: receiptData.received_by,
            received_at: new Date(),
            received_notes: receiptData.notes,
            updated_by: receiptData.received_by
        });
    },

    /**
     * Record full receipt of goods
     * @param {string} id - Purchase order ID
     * @param {Object} receiptData - Receipt data
     * @returns {Promise<Object>} Updated purchase order
     */
    async recordFullReceipt(id, receiptData) {
        return this.update(id, {
            status: 'received',
            delivery_status: 'delivered',
            actual_delivery: new Date(),
            received_by: receiptData.received_by,
            received_at: new Date(),
            received_notes: receiptData.notes,
            updated_by: receiptData.received_by
        });
    },

    /**
     * Complete purchase order (after quality check and invoicing)
     * @param {string} id - Purchase order ID
     * @param {string} completedBy - User who completed
     * @returns {Promise<Object>} Updated purchase order
     */
    async complete(id, completedBy) {
        return this.update(id, {
            status: 'completed',
            updated_by: completedBy
        });
    },

    /**
     * Record payment for purchase order
     * @param {string} id - Purchase order ID
     * @param {Object} paymentData - Payment data
     * @returns {Promise<Object>} Updated purchase order
     */
    async recordPayment(id, paymentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const order = await this.findById(id);
            if (!order) {
                throw new Error('Purchase order not found');
            }

            const newAdvancePaid = (order.advance_paid || 0) + paymentData.amount;
            let paymentStatus = 'partial';
            if (newAdvancePaid >= order.total_amount) {
                paymentStatus = 'paid';
            }

            const paymentHistory = order.payment_history || [];
            paymentHistory.push({
                amount: paymentData.amount,
                method: paymentData.method,
                reference: paymentData.reference,
                date: new Date(),
                recorded_by: paymentData.recorded_by
            });

            const query = `
                UPDATE purchase_orders 
                SET advance_paid = $1,
                    payment_status = $2,
                    payment_history = $3,
                    updated_at = NOW(),
                    updated_by = $4
                WHERE id = $5 AND is_deleted = false
                RETURNING 
                    id, po_number, advance_paid,
                    balance_amount, payment_status
            `;

            const result = await client.query(query, [
                newAdvancePaid,
                paymentStatus,
                paymentHistory,
                paymentData.recorded_by,
                id
            ]);

            if (result.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            await db.commitTransaction(client);

            logger.info('Payment recorded for purchase order', {
                poId: id,
                amount: paymentData.amount,
                newAdvancePaid,
                paymentStatus
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error recording payment', {
                error: error.message,
                poId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get purchase order statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND order_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(total_amount) as total_value,
                    AVG(total_amount)::numeric(10,2) as avg_order_value,
                    COUNT(*) FILTER (WHERE status = 'draft') as draft,
                    COUNT(*) FILTER (WHERE status = 'pending_approval') as pending_approval,
                    COUNT(*) FILTER (WHERE status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE status = 'ordered') as ordered,
                    COUNT(*) FILTER (WHERE status = 'received') as received,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE payment_status = 'paid') as paid,
                    COUNT(*) FILTER (WHERE payment_status = 'overdue') as overdue,
                    COUNT(DISTINCT supplier_id) as unique_suppliers,
                    SUM(total_quantity) as total_items_ordered,
                    AVG(EXTRACT(DAY FROM (actual_delivery - order_date)))::numeric(10,2) as avg_delivery_days
                FROM purchase_orders
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Purchase order statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting purchase order statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete purchase order
     * @param {string} id - Purchase order ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE purchase_orders 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            await db.commitTransaction(client);

            logger.info('Purchase order soft deleted', {
                poId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting purchase order', {
                error: error.message,
                poId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = PurchaseOrder;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */