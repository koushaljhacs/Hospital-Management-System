/**
 * ======================================================================
 * FILE: backend/src/services/pharmacist/purchaseOrderService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist purchase order service - Handles business logic for purchase orders.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const purchaseOrderService = {
    /**
     * Get all purchase orders
     */
    async getAllPurchaseOrders(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, status, supplier_id, from_date, to_date, search } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT po.*, 
                       s.name as supplier_name,
                       s.phone as supplier_phone,
                       s.email as supplier_email,
                       COUNT(poi.id) as item_count,
                       SUM(poi.quantity) as total_quantity
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
                WHERE po.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND po.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (supplier_id) {
                query += ` AND po.supplier_id = $${paramIndex}`;
                values.push(supplier_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND po.order_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND po.order_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            if (search) {
                query += ` AND (po.po_number ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`;
                values.push(`%${search}%`);
                paramIndex++;
            }

            query += ` GROUP BY po.id, s.id
                      ORDER BY po.order_date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM purchase_orders po
                WHERE po.is_deleted = false
                ${status ? 'AND po.status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(total_amount) as total_value,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                    COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
                    COUNT(*) FILTER (WHERE status = 'received') as received_count,
                    SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as pending_value,
                    SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END) as approved_value,
                    SUM(CASE WHEN status = 'received' THEN total_amount ELSE 0 END) as received_value
                FROM purchase_orders
                WHERE is_deleted = false
            `;
            const summary = await db.query(summaryQuery);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAllPurchaseOrders', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get purchase orders by status
     */
    async getPurchaseOrdersByStatus(pharmacistId, status, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT po.*, 
                       s.name as supplier_name,
                       s.phone as supplier_phone,
                       COUNT(poi.id) as item_count,
                       SUM(poi.quantity) as total_quantity,
                       CASE 
                           WHEN po.expected_delivery < NOW() AND po.status != 'received' THEN true
                           ELSE false
                       END as is_overdue
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
                WHERE po.status = $1 AND po.is_deleted = false
                GROUP BY po.id, s.id
                ORDER BY 
                    CASE 
                        WHEN po.expected_delivery < NOW() THEN 0
                        ELSE 1
                    END,
                    po.expected_delivery ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM purchase_orders
                WHERE status = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [status]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getPurchaseOrdersByStatus', { error: error.message, pharmacistId, status });
            throw error;
        }
    },

    /**
     * Get purchase order by ID
     */
    async getPurchaseOrderById(pharmacistId, orderId) {
        try {
            const query = `
                SELECT po.*, 
                       s.name as supplier_name,
                       s.contact_person,
                       s.phone as supplier_phone,
                       s.email as supplier_email,
                       s.address as supplier_address,
                       s.gst_number as supplier_gst,
                       s.payment_terms,
                       s.credit_days,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', poi.id,
                                   'medicine_name', poi.medicine_name,
                                   'quantity', poi.quantity,
                                   'unit_price', poi.unit_price,
                                   'total_price', poi.quantity * poi.unit_price,
                                   'gst_percentage', poi.gst_percentage,
                                   'received_quantity', poi.received_quantity,
                                   'notes', poi.notes
                               )
                           )
                           FROM purchase_order_items poi
                           WHERE poi.purchase_order_id = po.id
                       ) as items,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', p.id,
                                   'amount', p.amount,
                                   'payment_date', p.payment_date,
                                   'payment_method', p.payment_method,
                                   'reference_number', p.reference_number
                               ) ORDER BY p.payment_date DESC
                           )
                           FROM payments p
                           WHERE p.purchase_order_id = po.id
                       ) as payments
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.id
                WHERE po.id = $1 AND po.is_deleted = false
            `;

            const result = await db.query(query, [orderId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const po = result.rows[0];
            
            // Calculate payment status
            const totalPaid = po.payments ? po.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
            po.total_paid = totalPaid;
            po.balance_due = po.total_amount - totalPaid;
            po.payment_status = totalPaid >= po.total_amount ? 'paid' :
                               totalPaid > 0 ? 'partial' : 'pending';

            return po;
        } catch (error) {
            logger.error('Error in getPurchaseOrderById', { error: error.message, pharmacistId, orderId });
            throw error;
        }
    },

    /**
     * Generate PO number
     */
    async generatePONumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM purchase_orders
                WHERE po_number LIKE $1
            `, [`PO-${year}${month}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `PO-${year}${month}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generatePONumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Create purchase order
     */
    async createPurchaseOrder(pharmacistId, poData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate PO number
            const poNumber = await this.generatePONumber();

            // Calculate totals
            let subtotal = 0;
            let totalTax = 0;
            
            for (const item of poData.items) {
                const itemTotal = item.quantity * item.unit_price;
                subtotal += itemTotal;
                if (item.gst_percentage) {
                    totalTax += itemTotal * (item.gst_percentage / 100);
                }
            }

            const totalAmount = subtotal - (poData.discount || 0) + totalTax + 
                               (poData.shipping_cost || 0) + (poData.other_charges || 0);

            const query = `
                INSERT INTO purchase_orders (
                    id, po_number, supplier_id, order_date,
                    expected_delivery, status, subtotal, discount,
                    discount_type, tax_amount, tax_details, shipping_cost,
                    other_charges, total_amount, currency, exchange_rate,
                    payment_terms, payment_due_date, shipping_address,
                    shipping_method, notes, internal_notes, created_by,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, 'draft', $5, $6, $7,
                    $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                    $19, $20, $21, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                poNumber,
                poData.supplier_id,
                poData.order_date,
                poData.expected_delivery,
                subtotal,
                poData.discount || 0,
                poData.discount_type || null,
                totalTax,
                poData.tax_details ? JSON.stringify(poData.tax_details) : null,
                poData.shipping_cost || 0,
                poData.other_charges || 0,
                totalAmount,
                poData.currency || 'INR',
                poData.exchange_rate || 1,
                poData.payment_terms || null,
                poData.payment_due_date || null,
                poData.shipping_address || null,
                poData.shipping_method || null,
                poData.notes || null,
                poData.internal_notes || null,
                pharmacistId
            ];

            const result = await client.query(query, values);
            const purchaseOrder = result.rows[0];

            // Insert items
            for (const item of poData.items) {
                await client.query(`
                    INSERT INTO purchase_order_items (
                        id, purchase_order_id, medicine_name, quantity,
                        unit_price, gst_percentage, notes, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
                    )
                `, [
                    purchaseOrder.id,
                    item.medicine_name,
                    item.quantity,
                    item.unit_price,
                    item.gst_percentage || 0,
                    item.notes || null
                ]);
            }

            await db.commitTransaction(client);

            return purchaseOrder;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update purchase order
     */
    async updatePurchaseOrder(pharmacistId, orderId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if order can be updated
            const checkQuery = `SELECT status FROM purchase_orders WHERE id = $1`;
            const check = await client.query(checkQuery, [orderId]);
            
            if (check.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            if (check.rows[0].status !== 'draft') {
                throw new Error('Cannot update order that has been submitted or approved');
            }

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'expected_delivery', 'shipping_address', 'shipping_method',
                'notes', 'internal_notes'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(orderId);

            const query = `
                UPDATE purchase_orders 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

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
     * Delete purchase order
     */
    async deletePurchaseOrder(pharmacistId, orderId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if order can be deleted
            const checkQuery = `SELECT status FROM purchase_orders WHERE id = $1`;
            const check = await client.query(checkQuery, [orderId]);
            
            if (check.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            if (check.rows[0].status !== 'draft') {
                throw new Error('Cannot delete order that has been submitted or approved');
            }

            const query = `
                UPDATE purchase_orders 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    deletion_reason = $2
                WHERE id = $3
                RETURNING id
            `;

            const result = await client.query(query, [pharmacistId, reason, orderId]);

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
     * Submit purchase order for approval
     */
    async submitPurchaseOrder(pharmacistId, orderId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE purchase_orders 
                SET status = 'pending',
                    submitted_by = $1,
                    submitted_at = NOW(),
                    submission_notes = $2,
                    updated_at = NOW()
                WHERE id = $3 AND status = 'draft'
                RETURNING *
            `;

            const result = await client.query(query, [pharmacistId, data.notes, orderId]);

            if (result.rows.length === 0) {
                throw new Error('Purchase order not found or cannot be submitted');
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
     * Approve purchase order (admin)
     */
    async approvePurchaseOrder(pharmacistId, orderId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if user has permission
            // This would typically check admin role
            const query = `
                UPDATE purchase_orders 
                SET status = 'approved',
                    approved_by = $1,
                    approved_at = NOW(),
                    approval_notes = $2,
                    updated_at = NOW()
                WHERE id = $3 AND status = 'pending'
                RETURNING *
            `;

            const result = await client.query(query, [pharmacistId, data.notes, orderId]);

            if (result.rows.length === 0) {
                throw new Error('Purchase order not found or cannot be approved');
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
     * Reject purchase order
     */
    async rejectPurchaseOrder(pharmacistId, orderId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE purchase_orders 
                SET status = 'rejected',
                    rejected_by = $1,
                    rejected_at = NOW(),
                    rejection_reason = $2,
                    updated_at = NOW()
                WHERE id = $3 AND status = 'pending'
                RETURNING *
            `;

            const result = await client.query(query, [pharmacistId, reason, orderId]);

            if (result.rows.length === 0) {
                throw new Error('Purchase order not found or cannot be rejected');
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
     * Cancel purchase order
     */
    async cancelPurchaseOrder(pharmacistId, orderId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE purchase_orders 
                SET status = 'cancelled',
                    cancelled_by = $1,
                    cancelled_at = NOW(),
                    cancellation_reason = $2,
                    updated_at = NOW()
                WHERE id = $3 AND status NOT IN ('received', 'cancelled')
                RETURNING *
            `;

            const result = await client.query(query, [pharmacistId, reason, orderId]);

            if (result.rows.length === 0) {
                throw new Error('Purchase order not found or cannot be cancelled');
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
     * Receive purchase order
     */
    async receivePurchaseOrder(pharmacistId, orderId, receiveData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get order details
            const orderQuery = `
                SELECT po.*, 
                       json_agg(poi.*) as items
                FROM purchase_orders po
                LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
                WHERE po.id = $1
                GROUP BY po.id
            `;
            const order = await client.query(orderQuery, [orderId]);
            
            if (order.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            // Update received quantities
            for (const receivedItem of receiveData.received_items) {
                await client.query(`
                    UPDATE purchase_order_items 
                    SET received_quantity = received_quantity + $1,
                        updated_at = NOW()
                    WHERE id = $2 AND purchase_order_id = $3
                `, [receivedItem.quantity, receivedItem.item_id, orderId]);

                // Get medicine details from item
                const itemQuery = `
                    SELECT * FROM purchase_order_items 
                    WHERE id = $1
                `;
                const item = await client.query(itemQuery, [receivedItem.item_id]);

                // Create batch entry
                await client.query(`
                    INSERT INTO batches (
                        id, medicine_id, batch_number, manufacturing_date,
                        expiry_date, quantity, unit_price, selling_price,
                        mrp, supplier_id, purchase_order_id, received_date,
                        location, notes, created_by, created_at
                    ) VALUES (
                        gen_random_uuid(), 
                        (SELECT id FROM inventory WHERE medicine_name = $1 LIMIT 1),
                        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
                    )
                `, [
                    item.rows[0].medicine_name,
                    receivedItem.batch_number || `BATCH-${Date.now()}`,
                    receivedItem.manufacturing_date || null,
                    receivedItem.expiry_date,
                    receivedItem.quantity,
                    item.rows[0].unit_price,
                    item.rows[0].unit_price * 1.2, // Default selling price
                    item.rows[0].unit_price * 1.5, // Default MRP
                    order.rows[0].supplier_id,
                    orderId,
                    receiveData.received_date,
                    receivedItem.location || 'Main Store',
                    receivedItem.notes || null,
                    pharmacistId
                ]);
            }

            // Update order status
            const allItemsReceived = order.rows[0].items.every(item => 
                item.received_quantity >= item.quantity
            );

            const updateQuery = `
                UPDATE purchase_orders 
                SET status = $1,
                    actual_delivery = $2,
                    received_by = $3,
                    received_at = $4,
                    received_notes = $5,
                    quality_check_passed = $6,
                    quality_check_notes = $7,
                    inspected_by = $8,
                    inspected_at = $9,
                    updated_at = NOW()
                WHERE id = $10
                RETURNING *
            `;

            const updateValues = [
                allItemsReceived ? 'received' : 'partial',
                receiveData.received_date,
                pharmacistId,
                receiveData.received_date,
                receiveData.received_notes,
                receiveData.quality_check_passed || null,
                receiveData.quality_check_notes || null,
                receiveData.quality_check_passed ? pharmacistId : null,
                receiveData.quality_check_passed ? receiveData.received_date : null,
                orderId
            ];

            const result = await client.query(updateQuery, updateValues);

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
     * Get purchase order items
     */
    async getPurchaseOrderItems(pharmacistId, orderId) {
        try {
            const query = `
                SELECT poi.*, 
                       i.id as inventory_id,
                       i.medicine_name,
                       i.batch_number as current_batch,
                       i.quantity as current_stock
                FROM purchase_order_items poi
                LEFT JOIN inventory i ON poi.medicine_name = i.medicine_name
                WHERE poi.purchase_order_id = $1
                ORDER BY poi.created_at ASC
            `;

            const result = await db.query(query, [orderId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPurchaseOrderItems', { error: error.message, pharmacistId, orderId });
            throw error;
        }
    },

    /**
     * Update purchase order item
     */
    async updatePurchaseOrderItem(pharmacistId, orderId, itemId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if order can be updated
            const checkQuery = `SELECT status FROM purchase_orders WHERE id = $1`;
            const check = await client.query(checkQuery, [orderId]);
            
            if (check.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            if (check.rows[0].status !== 'draft') {
                throw new Error('Cannot update items after order submission');
            }

            // Build update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['quantity', 'unit_price', 'gst_percentage', 'notes'];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(itemId);
            values.push(orderId);

            const query = `
                UPDATE purchase_order_items 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND purchase_order_id = $${paramIndex + 1}
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Item not found');
            }

            // Recalculate order totals
            await this.recalculateOrderTotals(client, orderId);

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
     * Delete purchase order item
     */
    async deletePurchaseOrderItem(pharmacistId, orderId, itemId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if order can be updated
            const checkQuery = `SELECT status FROM purchase_orders WHERE id = $1`;
            const check = await client.query(checkQuery, [orderId]);
            
            if (check.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            if (check.rows[0].status !== 'draft') {
                throw new Error('Cannot delete items after order submission');
            }

            const query = `
                DELETE FROM purchase_order_items
                WHERE id = $1 AND purchase_order_id = $2
                RETURNING id
            `;

            const result = await client.query(query, [itemId, orderId]);

            if (result.rows.length === 0) {
                throw new Error('Item not found');
            }

            // Recalculate order totals
            await this.recalculateOrderTotals(client, orderId);

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
     * Recalculate order totals
     */
    async recalculateOrderTotals(client, orderId) {
        const itemsQuery = `
            SELECT 
                SUM(quantity * unit_price) as subtotal,
                SUM(quantity * unit_price * (gst_percentage / 100)) as total_tax
            FROM purchase_order_items
            WHERE purchase_order_id = $1
        `;
        const items = await client.query(itemsQuery, [orderId]);

        const subtotal = items.rows[0].subtotal || 0;
        const totalTax = items.rows[0].total_tax || 0;

        await client.query(`
            UPDATE purchase_orders 
            SET subtotal = $1,
                tax_amount = $2,
                total_amount = $1 - discount + $2 + shipping_cost + other_charges,
                updated_at = NOW()
            WHERE id = $3
        `, [subtotal, totalTax, orderId]);
    },

    /**
     * Get purchase order payments
     */
    async getPurchaseOrderPayments(pharmacistId, orderId) {
        try {
            const query = `
                SELECT p.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as recorded_by_name
                FROM payments p
                LEFT JOIN employees e ON p.recorded_by = e.id
                WHERE p.purchase_order_id = $1
                ORDER BY p.payment_date DESC
            `;

            const result = await db.query(query, [orderId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPurchaseOrderPayments', { error: error.message, pharmacistId, orderId });
            throw error;
        }
    },

    /**
     * Record purchase order payment
     */
    async recordPurchaseOrderPayment(pharmacistId, orderId, paymentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get order details
            const orderQuery = `SELECT total_amount, paid_amount FROM purchase_orders WHERE id = $1`;
            const order = await client.query(orderQuery, [orderId]);
            
            if (order.rows.length === 0) {
                throw new Error('Purchase order not found');
            }

            const newPaidAmount = (order.rows[0].paid_amount || 0) + paymentData.amount;
            
            if (newPaidAmount > order.rows[0].total_amount) {
                throw new Error('Payment exceeds balance');
            }

            const paymentQuery = `
                INSERT INTO payments (
                    id, purchase_order_id, amount, payment_date,
                    payment_method, reference_number, notes,
                    recorded_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
                ) RETURNING *
            `;

            const paymentValues = [
                orderId,
                paymentData.amount,
                paymentData.payment_date,
                paymentData.payment_method,
                paymentData.reference_number,
                paymentData.notes,
                paymentData.recorded_by
            ];

            const payment = await client.query(paymentQuery, paymentValues);

            // Update order payment status
            await client.query(`
                UPDATE purchase_orders 
                SET paid_amount = paid_amount + $1,
                    payment_status = CASE 
                        WHEN paid_amount + $1 >= total_amount THEN 'paid'
                        ELSE 'partial'
                    END,
                    updated_at = NOW()
                WHERE id = $2
            `, [paymentData.amount, orderId]);

            await db.commitTransaction(client);

            return payment.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get purchase order statistics
     */
    async getPurchaseOrderStatistics(pharmacistId, period = 'month') {
        try {
            let interval;
            switch(period) {
                case 'day':
                    interval = "INTERVAL '1 day'";
                    break;
                case 'week':
                    interval = "INTERVAL '7 days'";
                    break;
                case 'month':
                    interval = "INTERVAL '30 days'";
                    break;
                case 'year':
                    interval = "INTERVAL '1 year'";
                    break;
                default:
                    interval = "INTERVAL '30 days'";
            }

            const query = `
                WITH order_stats AS (
                    SELECT 
                        DATE_TRUNC('month', order_date) as month,
                        COUNT(*) as order_count,
                        SUM(total_amount) as total_value,
                        AVG(total_amount) as avg_order_value,
                        COUNT(*) FILTER (WHERE status = 'received') as received_count,
                        AVG(EXTRACT(EPOCH FROM (actual_delivery - expected_delivery))/86400) as avg_delay_days
                    FROM purchase_orders
                    WHERE order_date > NOW() - ${interval}
                    GROUP BY DATE_TRUNC('month', order_date)
                ),
                supplier_stats AS (
                    SELECT 
                        s.name as supplier_name,
                        COUNT(po.id) as order_count,
                        SUM(po.total_amount) as total_value,
                        AVG(EXTRACT(EPOCH FROM (po.actual_delivery - po.expected_delivery))/86400) as avg_delay
                    FROM suppliers s
                    JOIN purchase_orders po ON s.id = po.supplier_id
                    WHERE po.order_date > NOW() - ${interval}
                    GROUP BY s.id
                    ORDER BY total_value DESC
                    LIMIT 5
                )
                SELECT 
                    (SELECT json_agg(order_stats.*) FROM order_stats) as monthly_stats,
                    (SELECT json_agg(supplier_stats.*) FROM supplier_stats) as top_suppliers,
                    (
                        SELECT 
                            json_build_object(
                                'total_orders', COUNT(*),
                                'total_value', SUM(total_amount),
                                'avg_order_value', AVG(total_amount),
                                'pending_orders', COUNT(*) FILTER (WHERE status = 'pending'),
                                'approved_orders', COUNT(*) FILTER (WHERE status = 'approved'),
                                'received_orders', COUNT(*) FILTER (WHERE status = 'received'),
                                'avg_lead_time', AVG(EXTRACT(EPOCH FROM (actual_delivery - order_date))/86400)
                            )
                        FROM purchase_orders
                        WHERE order_date > NOW() - ${interval}
                    ) as summary
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPurchaseOrderStatistics', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Export purchase orders
     */
    async exportPurchaseOrders(pharmacistId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    po.po_number, po.order_date, po.expected_delivery,
                    po.actual_delivery, po.status, po.total_amount,
                    s.name as supplier_name, s.gst_number,
                    COUNT(poi.id) as item_count,
                    SUM(poi.quantity) as total_quantity
                FROM purchase_orders po
                JOIN suppliers s ON po.supplier_id = s.id
                LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
                WHERE po.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND po.order_date >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND po.order_date <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            if (filters.status) {
                query += ` AND po.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            query += ` GROUP BY po.id, s.id
                      ORDER BY po.order_date DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportPurchaseOrders', { error: error.message, pharmacistId });
            throw error;
        }
    }
};

module.exports = purchaseOrderService;