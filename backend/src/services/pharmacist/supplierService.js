/**
 * ======================================================================
 * FILE: backend/src/services/pharmacist/supplierService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist supplier service - Handles business logic for supplier management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const supplierService = {
    /**
     * Get all suppliers
     */
    async getAllSuppliers(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, status, search, category } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT s.*, 
                       COUNT(DISTINCT sp.id) as product_count,
                       COUNT(DISTINCT po.id) as order_count,
                       SUM(po.total_amount) as total_purchases,
                       AVG(sp.quality_rating) as avg_quality_rating
                FROM suppliers s
                LEFT JOIN supplier_products sp ON s.id = sp.supplier_id
                LEFT JOIN purchase_orders po ON s.id = po.supplier_id
                WHERE s.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND s.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (search) {
                query += ` AND (s.name ILIKE $${paramIndex} OR s.contact_person ILIKE $${paramIndex} OR s.email ILIKE $${paramIndex})`;
                values.push(`%${search}%`);
                paramIndex++;
            }

            if (category) {
                query += ` AND s.business_type = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            query += ` GROUP BY s.id
                      ORDER BY s.name ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM suppliers
                WHERE is_deleted = false
                ${status ? 'AND status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_suppliers,
                    COUNT(*) FILTER (WHERE status = 'active') as active_count,
                    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
                    COUNT(*) FILTER (WHERE status = 'blacklisted') as blacklisted_count,
                    AVG(quality_rating) as avg_rating
                FROM suppliers
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
            logger.error('Error in getAllSuppliers', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get active suppliers
     */
    async getActiveSuppliers(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT s.*, 
                       COUNT(sp.id) as product_count,
                       MAX(po.order_date) as last_order_date
                FROM suppliers s
                LEFT JOIN supplier_products sp ON s.id = sp.supplier_id
                LEFT JOIN purchase_orders po ON s.id = po.supplier_id
                WHERE s.status = 'active' AND s.is_deleted = false
                GROUP BY s.id
                ORDER BY s.name ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM suppliers
                WHERE status = 'active' AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getActiveSuppliers', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get supplier by ID
     */
    async getSupplierById(pharmacistId, supplierId) {
        try {
            const query = `
                SELECT s.*, 
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', sp.id,
                                   'medicine_id', sp.medicine_id,
                                   'medicine_name', i.medicine_name,
                                   'supplier_sku', sp.supplier_sku,
                                   'unit_price', sp.unit_price,
                                   'minimum_order', sp.minimum_order_quantity,
                                   'lead_time', sp.lead_time_days
                               )
                           )
                           FROM supplier_products sp
                           JOIN inventory i ON sp.medicine_id = i.id
                           WHERE sp.supplier_id = s.id
                       ) as products,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', po.id,
                                   'po_number', po.po_number,
                                   'order_date', po.order_date,
                                   'total_amount', po.total_amount,
                                   'status', po.status
                               ) ORDER BY po.order_date DESC
                           )
                           FROM purchase_orders po
                           WHERE po.supplier_id = s.id
                           LIMIT 10
                       ) as recent_orders,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', d.id,
                                   'document_type', d.document_type,
                                   'document_name', d.document_name,
                                   'expiry_date', d.expiry_date
                               )
                           )
                           FROM supplier_documents d
                           WHERE d.supplier_id = s.id
                       ) as documents
                FROM suppliers s
                WHERE s.id = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [supplierId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            // Calculate performance metrics
            const supplier = result.rows[0];
            
            // Get order performance
            const perfQuery = `
                SELECT 
                    AVG(EXTRACT(EPOCH FROM (actual_delivery - expected_delivery))/86400) as avg_delay_days,
                    COUNT(*) FILTER (WHERE actual_delivery <= expected_delivery) as on_time_count,
                    COUNT(*) as total_orders,
                    SUM(total_amount) as total_spent
                FROM purchase_orders
                WHERE supplier_id = $1 AND status = 'received'
            `;
            const perf = await db.query(perfQuery, [supplierId]);
            
            supplier.performance = perf.rows[0];
            supplier.on_time_delivery_rate = perf.rows[0].total_orders > 0 
                ? (perf.rows[0].on_time_count / perf.rows[0].total_orders * 100).toFixed(2)
                : 0;

            return supplier;
        } catch (error) {
            logger.error('Error in getSupplierById', { error: error.message, pharmacistId, supplierId });
            throw error;
        }
    },

    /**
     * Generate supplier code
     */
    async generateSupplierCode(supplierName) {
        try {
            // Generate code from name (first 3 letters + number)
            const prefix = supplierName
                .replace(/[^a-zA-Z]/g, '')
                .substring(0, 3)
                .toUpperCase();

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM suppliers
                WHERE code LIKE $1
            `, [`${prefix}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `${prefix}${count.toString().padStart(3, '0')}`;
        } catch (error) {
            logger.error('Error in generateSupplierCode', { error: error.message });
            throw error;
        }
    },

    /**
     * Add new supplier
     */
    async addSupplier(pharmacistId, supplierData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if GST already exists
            if (supplierData.gst_number) {
                const checkGst = await client.query(`
                    SELECT id FROM suppliers 
                    WHERE gst_number = $1 AND is_deleted = false
                `, [supplierData.gst_number]);
                
                if (checkGst.rows.length > 0) {
                    throw new Error('Supplier with this GST number already exists');
                }
            }

            const query = `
                INSERT INTO suppliers (
                    id, name, code, contact_person, phone,
                    alternate_phone, email, website, address,
                    city, state, country, postal_code, gst_number,
                    pan_number, license_number, business_type,
                    payment_terms, credit_limit, credit_days,
                    minimum_order, bank_name, bank_account_number,
                    bank_ifsc_code, bank_swift_code, bank_branch,
                    status, notes, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                    $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
                    $28, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                supplierData.name,
                supplierData.code,
                supplierData.contact_person || null,
                supplierData.phone,
                supplierData.alternate_phone || null,
                supplierData.email || null,
                supplierData.website || null,
                supplierData.address || null,
                supplierData.city || null,
                supplierData.state || null,
                supplierData.country || 'India',
                supplierData.postal_code || null,
                supplierData.gst_number || null,
                supplierData.pan_number || null,
                supplierData.license_number || null,
                supplierData.business_type || null,
                supplierData.payment_terms || 'net30',
                supplierData.credit_limit || 0,
                supplierData.credit_days || 30,
                supplierData.minimum_order || 0,
                supplierData.bank_name || null,
                supplierData.bank_account_number || null,
                supplierData.bank_ifsc_code || null,
                supplierData.bank_swift_code || null,
                supplierData.bank_branch || null,
                supplierData.status || 'active',
                supplierData.notes || null,
                pharmacistId
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
     * Update supplier
     */
    async updateSupplier(pharmacistId, supplierId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if GST is being updated and already exists
            if (updates.gst_number) {
                const checkGst = await client.query(`
                    SELECT id FROM suppliers 
                    WHERE gst_number = $1 AND id != $2 AND is_deleted = false
                `, [updates.gst_number, supplierId]);
                
                if (checkGst.rows.length > 0) {
                    throw new Error('Supplier with this GST number already exists');
                }
            }

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'name', 'contact_person', 'phone', 'alternate_phone',
                'email', 'website', 'address', 'city', 'state',
                'country', 'postal_code', 'gst_number', 'pan_number',
                'license_number', 'business_type', 'payment_terms',
                'credit_limit', 'credit_days', 'minimum_order',
                'bank_name', 'bank_account_number', 'bank_ifsc_code',
                'bank_swift_code', 'bank_branch', 'status', 'notes'
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
            values.push(supplierId);

            const query = `
                UPDATE suppliers 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Supplier not found');
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
     * Delete supplier (soft delete)
     */
    async deleteSupplier(pharmacistId, supplierId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if supplier has active orders
            const checkQuery = `
                SELECT id FROM purchase_orders 
                WHERE supplier_id = $1 AND status IN ('pending', 'approved', 'processing')
            `;
            const check = await client.query(checkQuery, [supplierId]);
            
            if (check.rows.length > 0) {
                throw new Error('Cannot delete supplier with active orders');
            }

            const query = `
                UPDATE suppliers 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    deletion_reason = $2
                WHERE id = $3
                RETURNING id
            `;

            const result = await client.query(query, [pharmacistId, reason, supplierId]);

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
     * Get supplier products
     */
    async getSupplierProducts(pharmacistId, supplierId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT sp.*, 
                       i.medicine_name, i.generic_name, i.category,
                       i.manufacturer, i.batch_number
                FROM supplier_products sp
                JOIN inventory i ON sp.medicine_id = i.id
                WHERE sp.supplier_id = $1
                ORDER BY i.medicine_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [supplierId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM supplier_products
                WHERE supplier_id = $1
            `;
            const count = await db.query(countQuery, [supplierId]);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_products,
                    MIN(sp.unit_price) as min_price,
                    MAX(sp.unit_price) as max_price,
                    AVG(sp.unit_price) as avg_price
                FROM supplier_products sp
                WHERE sp.supplier_id = $1
            `;
            const summary = await db.query(summaryQuery, [supplierId]);

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
            logger.error('Error in getSupplierProducts', { error: error.message, pharmacistId, supplierId });
            throw error;
        }
    },

    /**
     * Add supplier product
     */
    async addSupplierProduct(pharmacistId, supplierId, productData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if product already exists for this supplier
            const checkQuery = `
                SELECT id FROM supplier_products
                WHERE supplier_id = $1 AND medicine_id = $2
            `;
            const check = await client.query(checkQuery, [supplierId, productData.medicine_id]);
            
            if (check.rows.length > 0) {
                throw new Error('Product already exists in supplier catalog');
            }

            const query = `
                INSERT INTO supplier_products (
                    id, supplier_id, medicine_id, supplier_sku,
                    unit_price, minimum_order_quantity, lead_time_days,
                    notes, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                supplierId,
                productData.medicine_id,
                productData.supplier_sku || null,
                productData.unit_price,
                productData.minimum_order_quantity,
                productData.lead_time_days,
                productData.notes || null,
                productData.added_by
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
     * Update supplier product
     */
    async updateSupplierProduct(pharmacistId, supplierId, productId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'supplier_sku', 'unit_price', 'minimum_order_quantity',
                'lead_time_days', 'notes'
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
            values.push(productId);
            values.push(supplierId);

            const query = `
                UPDATE supplier_products 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND supplier_id = $${paramIndex + 1}
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Product not found');
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
     * Remove supplier product
     */
    async removeSupplierProduct(pharmacistId, supplierId, productId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                DELETE FROM supplier_products
                WHERE id = $1 AND supplier_id = $2
                RETURNING id
            `;

            const result = await client.query(query, [productId, supplierId]);

            if (result.rows.length === 0) {
                throw new Error('Product not found');
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
     * Get supplier performance
     */
    async getSupplierPerformance(pharmacistId, supplierId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND po.order_date BETWEEN '${from_date}' AND '${to_date}'`;
            }

            const query = `
                WITH order_stats AS (
                    SELECT 
                        COUNT(*) as total_orders,
                        COUNT(*) FILTER (WHERE po.status = 'received') as received_orders,
                        COUNT(*) FILTER (WHERE po.actual_delivery <= po.expected_delivery) as on_time_orders,
                        SUM(po.total_amount) as total_spent,
                        AVG(EXTRACT(EPOCH FROM (po.actual_delivery - po.expected_delivery))/86400) as avg_delay_days,
                        AVG(sp.quality_rating) as avg_quality_rating,
                        AVG(sp.price_competitiveness) as avg_price_rating,
                        AVG(sp.delivery_time_avg) as avg_delivery_rating
                    FROM purchase_orders po
                    LEFT JOIN supplier_performance sp ON po.supplier_id = sp.supplier_id
                    WHERE po.supplier_id = $1
                        ${dateFilter}
                ),
                monthly_trend AS (
                    SELECT 
                        DATE_TRUNC('month', po.order_date) as month,
                        COUNT(*) as order_count,
                        SUM(po.total_amount) as order_value,
                        AVG(EXTRACT(EPOCH FROM (po.actual_delivery - po.expected_delivery))/86400) as avg_delay
                    FROM purchase_orders po
                    WHERE po.supplier_id = $1
                        AND po.order_date > NOW() - INTERVAL '12 months'
                    GROUP BY DATE_TRUNC('month', po.order_date)
                    ORDER BY month DESC
                )
                SELECT 
                    (SELECT * FROM order_stats) as summary,
                    (SELECT json_agg(monthly_trend.*) FROM monthly_trend) as monthly_trend
            `;

            const result = await db.query(query, [supplierId]);

            const performance = result.rows[0];
            if (performance.summary) {
                const summary = performance.summary;
                performance.summary.on_time_delivery_rate = summary.total_orders > 0
                    ? ((summary.on_time_orders / summary.total_orders) * 100).toFixed(2)
                    : 0;
                performance.summary.avg_ratings = {
                    quality: summary.avg_quality_rating || 0,
                    price: summary.avg_price_rating || 0,
                    delivery: summary.avg_delivery_rating || 0,
                    overall: ((summary.avg_quality_rating || 0) + 
                             (summary.avg_price_rating || 0) + 
                             (summary.avg_delivery_rating || 0)) / 3
                };
            }

            return performance;
        } catch (error) {
            logger.error('Error in getSupplierPerformance', { error: error.message, pharmacistId, supplierId });
            throw error;
        }
    },

    /**
     * Update supplier rating
     */
    async updateSupplierRating(pharmacistId, supplierId, ratingData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO supplier_performance (
                    id, supplier_id, quality_rating, price_rating,
                    delivery_rating, comments, rated_by, rated_at,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
                ) RETURNING *
            `;

            const values = [
                supplierId,
                ratingData.quality_rating,
                ratingData.price_rating,
                ratingData.delivery_rating,
                ratingData.comments,
                ratingData.rated_by,
                ratingData.rated_at
            ];

            const result = await client.query(query, values);

            // Update supplier's average ratings
            await client.query(`
                UPDATE suppliers 
                SET quality_rating = (
                    SELECT AVG(quality_rating) 
                    FROM supplier_performance 
                    WHERE supplier_id = $1
                ),
                updated_at = NOW()
                WHERE id = $1
            `, [supplierId]);

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
     * Get supplier payments
     */
    async getSupplierPayments(pharmacistId, supplierId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT p.*, 
                       po.po_number,
                       po.total_amount as po_amount
                FROM payments p
                JOIN purchase_orders po ON p.purchase_order_id = po.id
                WHERE po.supplier_id = $1
                ORDER BY p.payment_date DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [supplierId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM payments p
                JOIN purchase_orders po ON p.purchase_order_id = po.id
                WHERE po.supplier_id = $1
            `;
            const count = await db.query(countQuery, [supplierId]);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_payments,
                    SUM(p.amount) as total_paid,
                    AVG(p.amount) as avg_payment
                FROM payments p
                JOIN purchase_orders po ON p.purchase_order_id = po.id
                WHERE po.supplier_id = $1
            `;
            const summary = await db.query(summaryQuery, [supplierId]);

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
            logger.error('Error in getSupplierPayments', { error: error.message, pharmacistId, supplierId });
            throw error;
        }
    },

    /**
     * Record payment to supplier
     */
    async recordPayment(pharmacistId, supplierId, paymentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO payments (
                    id, purchase_order_id, amount, payment_date,
                    payment_method, reference_number, notes,
                    recorded_by, ip_address, user_agent, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
                ) RETURNING *
            `;

            const values = [
                paymentData.purchase_order_ids ? paymentData.purchase_order_ids[0] : null,
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

            // Update purchase order payment status
            if (paymentData.purchase_order_ids) {
                for (const poId of paymentData.purchase_order_ids) {
                    await client.query(`
                        UPDATE purchase_orders 
                        SET paid_amount = paid_amount + $1,
                            payment_status = CASE 
                                WHEN paid_amount + $1 >= total_amount THEN 'paid'
                                ELSE 'partial'
                            END,
                            updated_at = NOW()
                        WHERE id = $2
                    `, [paymentData.amount, poId]);
                }
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
     * Get supplier documents
     */
    async getSupplierDocuments(pharmacistId, supplierId) {
        try {
            const query = `
                SELECT * FROM supplier_documents
                WHERE supplier_id = $1
                ORDER BY created_at DESC
            `;

            const result = await db.query(query, [supplierId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getSupplierDocuments', { error: error.message, pharmacistId, supplierId });
            throw error;
        }
    },

    /**
     * Upload supplier document
     */
    async uploadSupplierDocument(pharmacistId, supplierId, documentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO supplier_documents (
                    id, supplier_id, document_type, document_name,
                    document_url, expiry_date, notes, uploaded_by,
                    uploaded_at, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
                ) RETURNING *
            `;

            const values = [
                supplierId,
                documentData.document_type,
                documentData.document_name,
                documentData.document_url,
                documentData.expiry_date || null,
                documentData.notes || null,
                documentData.uploaded_by,
                documentData.uploaded_at
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
     * Delete supplier document
     */
    async deleteSupplierDocument(pharmacistId, supplierId, documentId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                DELETE FROM supplier_documents
                WHERE id = $1 AND supplier_id = $2
                RETURNING id
            `;

            const result = await client.query(query, [documentId, supplierId]);

            if (result.rows.length === 0) {
                throw new Error('Document not found');
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
     * Get supplier report
     */
    async getSupplierReport(pharmacistId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND po.order_date BETWEEN '${from_date}' AND '${to_date}'`;
            }

            const query = `
                WITH supplier_stats AS (
                    SELECT 
                        s.id,
                        s.name,
                        s.status,
                        COUNT(DISTINCT po.id) as order_count,
                        SUM(po.total_amount) as total_purchases,
                        AVG(EXTRACT(EPOCH FROM (po.actual_delivery - po.expected_delivery))/86400) as avg_delay,
                        COUNT(*) FILTER (WHERE po.actual_delivery <= po.expected_delivery) as on_time_orders,
                        AVG(sp.quality_rating) as avg_quality,
                        AVG(sp.price_competitiveness) as avg_price,
                        AVG(sp.delivery_time_avg) as avg_delivery
                    FROM suppliers s
                    LEFT JOIN purchase_orders po ON s.id = po.supplier_id
                        ${dateFilter}
                    LEFT JOIN supplier_performance sp ON s.id = sp.supplier_id
                    WHERE s.is_deleted = false
                    GROUP BY s.id
                )
                SELECT 
                    COUNT(*) as total_suppliers,
                    SUM(order_count) as total_orders,
                    SUM(total_purchases) as total_purchases,
                    AVG(avg_delay) as avg_delay_days,
                    AVG(on_time_orders::float / NULLIF(order_count, 0)) * 100 as avg_on_time_rate,
                    AVG(avg_quality) as avg_quality_rating,
                    json_agg(
                        json_build_object(
                            'id', id,
                            'name', name,
                            'status', status,
                            'order_count', order_count,
                            'total_purchases', total_purchases,
                            'on_time_rate', CASE 
                                WHEN order_count > 0 
                                THEN (on_time_orders::float / order_count * 100)::numeric(5,2)
                                ELSE 0
                            END,
                            'avg_quality', avg_quality
                        ) ORDER BY total_purchases DESC
                    ) as supplier_details
                FROM supplier_stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getSupplierReport', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Export suppliers
     */
    async exportSuppliers(pharmacistId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    s.name, s.code, s.contact_person, s.phone,
                    s.email, s.gst_number, s.pan_number, s.status,
                    s.payment_terms, s.credit_limit, s.credit_days,
                    COUNT(DISTINCT po.id) as order_count,
                    SUM(po.total_amount) as total_purchases,
                    AVG(sp.quality_rating) as avg_rating
                FROM suppliers s
                LEFT JOIN purchase_orders po ON s.id = po.supplier_id
                LEFT JOIN supplier_performance sp ON s.id = sp.supplier_id
                WHERE s.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.status) {
                query += ` AND s.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            query += ` GROUP BY s.id
                      ORDER BY s.name ASC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportSuppliers', { error: error.message, pharmacistId });
            throw error;
        }
    }
};

module.exports = supplierService;