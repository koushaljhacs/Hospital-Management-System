/**
 * ======================================================================
 * FILE: backend/src/services/pharmacist/inventoryService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist inventory service - Handles business logic for inventory management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-19] Stock cannot go negative
 * - [BR-20] Alert when stock < reorder level
 * - [BR-21] Alert 30 days before expiry
 * - [BR-23] Batch tracking mandatory
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const inventoryService = {
    /**
     * Get all inventory items
     */
    async getAllInventory(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, category, manufacturer, location, status, search } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT i.*, 
                       s.name as supplier_name,
                       CASE 
                           WHEN i.quantity <= i.minimum_stock THEN 'critical'
                           WHEN i.quantity <= i.reorder_level THEN 'low'
                           WHEN i.quantity >= i.maximum_stock THEN 'overstock'
                           ELSE 'normal'
                       END as stock_status,
                       CASE 
                           WHEN i.expiry_date <= NOW() THEN 'expired'
                           WHEN i.expiry_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
                           ELSE 'valid'
                       END as expiry_status,
                       EXTRACT(DAY FROM (i.expiry_date - NOW())) as days_until_expiry
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (category) {
                query += ` AND i.category = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            if (manufacturer) {
                query += ` AND i.manufacturer ILIKE $${paramIndex}`;
                values.push(`%${manufacturer}%`);
                paramIndex++;
            }

            if (location) {
                query += ` AND i.location = $${paramIndex}`;
                values.push(location);
                paramIndex++;
            }

            if (status) {
                if (status === 'low_stock') {
                    query += ` AND i.quantity <= i.reorder_level`;
                } else if (status === 'out_of_stock') {
                    query += ` AND i.quantity = 0`;
                } else if (status === 'expired') {
                    query += ` AND i.expiry_date < NOW()`;
                } else if (status === 'expiring_soon') {
                    query += ` AND i.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'`;
                }
            }

            if (search) {
                query += ` AND (i.medicine_name ILIKE $${paramIndex} OR i.generic_name ILIKE $${paramIndex})`;
                values.push(`%${search}%`);
                paramIndex++;
            }

            query += ` ORDER BY i.medicine_name ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_items,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    COUNT(*) FILTER (WHERE quantity <= reorder_level) as low_stock_count,
                    COUNT(*) FILTER (WHERE quantity = 0) as out_of_stock_count,
                    COUNT(*) FILTER (WHERE expiry_date < NOW()) as expired_count,
                    COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_count
                FROM inventory
                WHERE is_deleted = false
            `;
            const summary = await db.query(summaryQuery);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(summary.rows[0].total_items)
                }
            };
        } catch (error) {
            logger.error('Error in getAllInventory', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Search inventory
     */
    async searchInventory(pharmacistId, searchTerm, options = {}) {
        try {
            const { page = 1, limit = 20, category, manufacturer } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT i.*, s.name as supplier_name
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.is_deleted = false
                    AND (i.medicine_name ILIKE $1 OR i.generic_name ILIKE $1 OR i.batch_number ILIKE $1)
            `;
            const values = [`%${searchTerm}%`];
            let paramIndex = 2;

            if (category) {
                query += ` AND i.category = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            if (manufacturer) {
                query += ` AND i.manufacturer ILIKE $${paramIndex}`;
                values.push(`%${manufacturer}%`);
                paramIndex++;
            }

            query += ` ORDER BY i.medicine_name ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM inventory
                WHERE is_deleted = false
                    AND (medicine_name ILIKE $1 OR generic_name ILIKE $1 OR batch_number ILIKE $1)
            `;
            const count = await db.query(countQuery, [`%${searchTerm}%`]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in searchInventory', { error: error.message, pharmacistId, searchTerm });
            throw error;
        }
    },

    /**
     * Get inventory by category
     */
    async getInventoryByCategory(pharmacistId, category, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, s.name as supplier_name
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.category = $1 AND i.is_deleted = false
                ORDER BY i.medicine_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [category, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM inventory
                WHERE category = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [category]);

            // Get category summary
            const summaryQuery = `
                SELECT 
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    COUNT(*) as item_count
                FROM inventory
                WHERE category = $1 AND is_deleted = false
            `;
            const summary = await db.query(summaryQuery, [category]);

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
            logger.error('Error in getInventoryByCategory', { error: error.message, pharmacistId, category });
            throw error;
        }
    },

    /**
     * Get inventory by manufacturer
     */
    async getInventoryByManufacturer(pharmacistId, manufacturer, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, s.name as supplier_name
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.manufacturer ILIKE $1 AND i.is_deleted = false
                ORDER BY i.medicine_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [`%${manufacturer}%`, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM inventory
                WHERE manufacturer ILIKE $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [`%${manufacturer}%`]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getInventoryByManufacturer', { error: error.message, pharmacistId, manufacturer });
            throw error;
        }
    },

    /**
     * Get low stock items [BR-20]
     */
    async getLowStockItems(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, s.name as supplier_name,
                       (i.reorder_level - i.quantity) as required_quantity,
                       ((i.reorder_level - i.quantity) * i.unit_price) as estimated_cost
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.quantity <= i.reorder_level 
                    AND i.is_deleted = false
                ORDER BY (i.quantity::float / i.reorder_level) ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(i.reorder_level - i.quantity) as total_required,
                    SUM((i.reorder_level - i.quantity) * i.unit_price) as total_cost
                FROM inventory i
                WHERE i.quantity <= i.reorder_level AND i.is_deleted = false
            `;
            const count = await db.query(countQuery);

            // [BR-20] Trigger alerts (handled by separate process)
            await this.checkAndCreateLowStockAlerts(pharmacistId, result.rows);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getLowStockItems', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get out of stock items
     */
    async getOutOfStockItems(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, s.name as supplier_name
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.quantity = 0 AND i.is_deleted = false
                ORDER BY i.medicine_name ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(unit_price * reorder_level) as estimated_restock_value
                FROM inventory
                WHERE quantity = 0 AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getOutOfStockItems', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expiring items [BR-21]
     */
    async getExpiringItems(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20, days = 30 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, s.name as supplier_name,
                       EXTRACT(DAY FROM (expiry_date - NOW())) as days_until_expiry,
                       (quantity * unit_price) as total_value
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
                    AND i.is_deleted = false
                ORDER BY i.expiry_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(quantity * unit_price) as total_value
                FROM inventory
                WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
                    AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            // [BR-21] Trigger expiry alerts
            await this.checkAndCreateExpiryAlerts(pharmacistId, result.rows);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getExpiringItems', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get expired items [BR-18]
     */
    async getExpiredItems(pharmacistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, s.name as supplier_name,
                       EXTRACT(DAY FROM (NOW() - expiry_date)) as days_expired,
                       (quantity * unit_price) as total_value
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.expiry_date < NOW() AND i.is_deleted = false
                ORDER BY i.expiry_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    COUNT(DISTINCT batch_number) as batches_affected
                FROM inventory
                WHERE expiry_date < NOW() AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getExpiredItems', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get inventory item by ID
     */
    async getInventoryItemById(pharmacistId, itemId) {
        try {
            const query = `
                SELECT i.*, 
                       s.name as supplier_name,
                       s.phone as supplier_phone,
                       s.email as supplier_email,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', id,
                                   'quantity', quantity,
                                   'movement_type', movement_type,
                                   'reference', reference_number,
                                   'created_at', created_at
                               ) ORDER BY created_at DESC
                           )
                           FROM stock_movements
                           WHERE inventory_id = i.id
                           LIMIT 10
                       ) as recent_movements
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.id = $1 AND i.is_deleted = false
            `;

            const result = await db.query(query, [itemId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const item = result.rows[0];
            
            // Calculate days until expiry
            if (item.expiry_date) {
                const daysUntilExpiry = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                item.days_until_expiry = daysUntilExpiry;
                item.expiry_status = daysUntilExpiry < 0 ? 'expired' :
                                    daysUntilExpiry <= 30 ? 'expiring_soon' : 'valid';
            }

            return item;
        } catch (error) {
            logger.error('Error in getInventoryItemById', { error: error.message, pharmacistId, itemId });
            throw error;
        }
    },

    /**
     * Add new inventory item
     */
    async addInventoryItem(pharmacistId, itemData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if batch number already exists [BR-23]
            const checkQuery = `
                SELECT id FROM inventory 
                WHERE batch_number = $1 AND is_deleted = false
            `;
            const check = await client.query(checkQuery, [itemData.batch_number]);
            
            if (check.rows.length > 0) {
                throw new Error('Batch number already exists');
            }

            const query = `
                INSERT INTO inventory (
                    id, medicine_name, generic_name, category, manufacturer,
                    brand_name, supplier_id, supplier_sku, batch_number,
                    manufacturing_date, expiry_date, quantity, reorder_level,
                    minimum_stock, maximum_stock, safety_stock, unit_price,
                    selling_price, mrp, gst_percentage, discount_allowed,
                    location, zone, rack_number, shelf_number, bin_number,
                    requires_prescription, is_narcotic, is_refrigerated,
                    is_hazardous, storage_conditions, temperature_min,
                    temperature_max, notes, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
                    $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
                    NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                itemData.medicine_name,
                itemData.generic_name || null,
                itemData.category,
                itemData.manufacturer,
                itemData.brand_name || null,
                itemData.supplier_id || null,
                itemData.supplier_sku || null,
                itemData.batch_number,
                itemData.manufacturing_date || null,
                itemData.expiry_date,
                itemData.quantity || 0,
                itemData.reorder_level || 10,
                itemData.minimum_stock || 5,
                itemData.maximum_stock || 100,
                itemData.safety_stock || 2,
                itemData.unit_price,
                itemData.selling_price,
                itemData.mrp || itemData.selling_price,
                itemData.gst_percentage || 0,
                itemData.discount_allowed !== false,
                itemData.location,
                itemData.zone || null,
                itemData.rack_number || null,
                itemData.shelf_number || null,
                itemData.bin_number || null,
                itemData.requires_prescription || false,
                itemData.is_narcotic || false,
                itemData.is_refrigerated || false,
                itemData.is_hazardous || false,
                itemData.storage_conditions || null,
                itemData.temperature_min || null,
                itemData.temperature_max || null,
                itemData.notes || null,
                pharmacistId
            ];

            const result = await client.query(query, values);

            // Log initial stock movement
            await client.query(`
                INSERT INTO stock_movements (
                    id, inventory_id, quantity, movement_type,
                    reference_number, notes, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'initial_stock',
                    'INIT-' || $1, 'Initial stock addition', $3, NOW()
                )
            `, [result.rows[0].id, itemData.quantity || 0, pharmacistId]);

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
     * Update inventory item
     */
    async updateInventoryItem(pharmacistId, itemId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'medicine_name', 'generic_name', 'category', 'manufacturer',
                'brand_name', 'supplier_id', 'supplier_sku',
                'reorder_level', 'minimum_stock', 'maximum_stock', 'safety_stock',
                'unit_price', 'selling_price', 'mrp', 'gst_percentage',
                'discount_allowed', 'location', 'zone', 'rack_number',
                'shelf_number', 'bin_number', 'requires_prescription',
                'is_narcotic', 'is_refrigerated', 'is_hazardous',
                'storage_conditions', 'temperature_min', 'temperature_max', 'notes'
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
            values.push(itemId);

            const query = `
                UPDATE inventory 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Inventory item not found');
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
     * Delete inventory item (soft delete)
     */
    async deleteInventoryItem(pharmacistId, itemId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if item has stock
            const checkQuery = `SELECT quantity FROM inventory WHERE id = $1`;
            const check = await client.query(checkQuery, [itemId]);
            
            if (check.rows.length === 0) {
                throw new Error('Inventory item not found');
            }

            if (check.rows[0].quantity > 0) {
                throw new Error('Cannot delete item with existing stock');
            }

            const query = `
                UPDATE inventory 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    deletion_reason = $2
                WHERE id = $3
                RETURNING id
            `;

            const result = await client.query(query, [pharmacistId, reason, itemId]);

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
     * Add stock to inventory
     */
    async addStock(pharmacistId, itemId, stockData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get current quantity
            const currentQuery = `SELECT quantity FROM inventory WHERE id = $1`;
            const current = await client.query(currentQuery, [itemId]);
            
            if (current.rows.length === 0) {
                throw new Error('Inventory item not found');
            }

            const newQuantity = current.rows[0].quantity + stockData.quantity;

            // Update inventory
            const updateQuery = `
                UPDATE inventory 
                SET quantity = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `;
            const update = await client.query(updateQuery, [newQuantity, itemId]);

            // Log stock movement
            await client.query(`
                INSERT INTO stock_movements (
                    id, inventory_id, quantity, movement_type,
                    batch_number, reference_number, notes,
                    created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'stock_in',
                    $3, $4, $5, $6, NOW()
                )
            `, [
                itemId,
                stockData.quantity,
                stockData.batch_number,
                stockData.reference_number,
                stockData.reason || 'Stock addition',
                pharmacistId
            ]);

            await db.commitTransaction(client);

            return {
                ...update.rows[0],
                added_quantity: stockData.quantity,
                previous_quantity: current.rows[0].quantity,
                new_quantity: newQuantity
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Remove stock from inventory [BR-19]
     */
    async removeStock(pharmacistId, itemId, stockData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get current quantity
            const currentQuery = `SELECT quantity FROM inventory WHERE id = $1`;
            const current = await client.query(currentQuery, [itemId]);
            
            if (current.rows.length === 0) {
                throw new Error('Inventory item not found');
            }

            const currentQuantity = current.rows[0].quantity;

            // [BR-19] Check if sufficient stock
            if (currentQuantity < stockData.quantity) {
                throw new Error('Insufficient stock');
            }

            const newQuantity = currentQuantity - stockData.quantity;

            // Update inventory
            const updateQuery = `
                UPDATE inventory 
                SET quantity = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `;
            const update = await client.query(updateQuery, [newQuantity, itemId]);

            // Log stock movement
            await client.query(`
                INSERT INTO stock_movements (
                    id, inventory_id, quantity, movement_type,
                    reference_number, notes, prescription_id,
                    patient_id, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'stock_out',
                    $3, $4, $5, $6, $7, NOW()
                )
            `, [
                itemId,
                stockData.quantity,
                stockData.reference_number,
                stockData.reason || 'Stock removal',
                stockData.prescription_id || null,
                stockData.patient_id || null,
                pharmacistId
            ]);

            await db.commitTransaction(client);

            return {
                ...update.rows[0],
                removed_quantity: stockData.quantity,
                previous_quantity: currentQuantity,
                new_quantity: newQuantity
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get stock history
     */
    async getStockHistory(pharmacistId, itemId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT sm.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as created_by_name
                FROM stock_movements sm
                LEFT JOIN employees e ON sm.created_by = e.id
                WHERE sm.inventory_id = $1
            `;
            const values = [itemId];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND sm.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND sm.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY sm.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM stock_movements
                WHERE inventory_id = $1
            `;
            const count = await db.query(countQuery, [itemId]);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    SUM(CASE WHEN movement_type = 'stock_in' THEN quantity ELSE 0 END) as total_in,
                    SUM(CASE WHEN movement_type = 'stock_out' THEN quantity ELSE 0 END) as total_out,
                    COUNT(*) as total_movements
                FROM stock_movements
                WHERE inventory_id = $1
            `;
            const summary = await db.query(summaryQuery, [itemId]);

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
            logger.error('Error in getStockHistory', { error: error.message, pharmacistId, itemId });
            throw error;
        }
    },

    /**
     * Bulk update stock
     */
    async bulkUpdateStock(pharmacistId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const results = {
                success: [],
                failed: []
            };

            for (const update of updates) {
                try {
                    if (update.type === 'add') {
                        const result = await this.addStock(pharmacistId, update.item_id, {
                            quantity: update.quantity,
                            batch_number: update.batch_number,
                            reason: update.reason,
                            reference_number: update.reference_number
                        });
                        results.success.push({
                            item_id: update.item_id,
                            type: 'add',
                            new_quantity: result.new_quantity
                        });
                    } else if (update.type === 'remove') {
                        const result = await this.removeStock(pharmacistId, update.item_id, {
                            quantity: update.quantity,
                            reason: update.reason,
                            reference_number: update.reference_number,
                            prescription_id: update.prescription_id,
                            patient_id: update.patient_id
                        });
                        results.success.push({
                            item_id: update.item_id,
                            type: 'remove',
                            new_quantity: result.new_quantity
                        });
                    }
                } catch (err) {
                    results.failed.push({
                        item_id: update.item_id,
                        type: update.type,
                        error: err.message
                    });
                }
            }

            await db.commitTransaction(client);

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Export inventory
     */
    async exportInventory(pharmacistId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    i.medicine_name, i.generic_name, i.category,
                    i.manufacturer, i.batch_number,
                    i.quantity, i.unit_price, i.selling_price,
                    i.expiry_date,
                    CASE 
                        WHEN i.expiry_date < NOW() THEN 'Expired'
                        WHEN i.expiry_date <= NOW() + INTERVAL '30 days' THEN 'Expiring Soon'
                        ELSE 'Valid'
                    END as expiry_status,
                    i.location, i.rack_number,
                    s.name as supplier_name
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.category) {
                query += ` AND i.category = $${paramIndex}`;
                values.push(filters.category);
                paramIndex++;
            }

            if (filters.manufacturer) {
                query += ` AND i.manufacturer ILIKE $${paramIndex}`;
                values.push(`%${filters.manufacturer}%`);
                paramIndex++;
            }

            query += ` ORDER BY i.medicine_name ASC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportInventory', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Get inventory alerts
     */
    async getInventoryAlerts(pharmacistId) {
        try {
            const query = `
                SELECT 
                    'low_stock' as type,
                    i.id,
                    i.medicine_name,
                    i.quantity,
                    i.reorder_level,
                    (i.reorder_level - i.quantity) as required_quantity,
                    'critical' as severity
                FROM inventory i
                WHERE i.quantity <= i.minimum_stock AND i.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'expiring' as type,
                    i.id,
                    i.medicine_name,
                    i.quantity,
                    EXTRACT(DAY FROM (i.expiry_date - NOW())) as reorder_level,
                    CASE 
                        WHEN i.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                        WHEN i.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                        ELSE 'info'
                    END as severity
                FROM inventory i
                WHERE i.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                    AND i.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'expired' as type,
                    i.id,
                    i.medicine_name,
                    i.quantity,
                    ABS(EXTRACT(DAY FROM (NOW() - i.expiry_date))) as days_expired,
                    'critical' as severity
                FROM inventory i
                WHERE i.expiry_date < NOW() AND i.is_deleted = false
                
                ORDER BY severity DESC, reorder_level ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getInventoryAlerts', { error: error.message, pharmacistId });
            throw error;
        }
    },

    /**
     * Acknowledge alert
     */
    async acknowledgeAlert(pharmacistId, alertId, notes) {
        try {
            const query = `
                UPDATE inventory_alerts
                SET acknowledged = true,
                    acknowledged_by = $1,
                    acknowledged_at = NOW(),
                    acknowledgment_notes = $2
                WHERE id = $3
                RETURNING *
            `;

            const result = await db.query(query, [pharmacistId, notes, alertId]);
            
            if (result.rows.length === 0) {
                throw new Error('Alert not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in acknowledgeAlert', { error: error.message, pharmacistId, alertId });
            throw error;
        }
    },

    /**
     * Check and create low stock alerts [BR-20]
     */
    async checkAndCreateLowStockAlerts(pharmacistId, items) {
        try {
            for (const item of items) {
                if (item.quantity <= item.minimum_stock) {
                    await db.query(`
                        INSERT INTO inventory_alerts (
                            id, inventory_id, alert_type, severity,
                            message, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, 'low_stock', 'critical',
                            $2, NOW()
                        ) ON CONFLICT DO NOTHING
                    `, [
                        item.id,
                        `Critical low stock: ${item.medicine_name} has only ${item.quantity} units left`
                    ]);
                } else if (item.quantity <= item.reorder_level) {
                    await db.query(`
                        INSERT INTO inventory_alerts (
                            id, inventory_id, alert_type, severity,
                            message, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, 'low_stock', 'warning',
                            $2, NOW()
                        ) ON CONFLICT DO NOTHING
                    `, [
                        item.id,
                        `Low stock: ${item.medicine_name} has ${item.quantity} units (reorder at ${item.reorder_level})`
                    ]);
                }
            }
        } catch (error) {
            logger.error('Error in checkAndCreateLowStockAlerts', { error: error.message, pharmacistId });
        }
    },

    /**
     * Check and create expiry alerts [BR-21]
     */
    async checkAndCreateExpiryAlerts(pharmacistId, items) {
        try {
            for (const item of items) {
                const daysUntil = item.days_until_expiry;
                
                if (daysUntil <= 7) {
                    await db.query(`
                        INSERT INTO inventory_alerts (
                            id, inventory_id, alert_type, severity,
                            message, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, 'expiry', 'critical',
                            $2, NOW()
                        ) ON CONFLICT DO NOTHING
                    `, [
                        item.id,
                        `Critical: ${item.medicine_name} (Batch: ${item.batch_number}) expires in ${daysUntil} days`
                    ]);
                } else if (daysUntil <= 15) {
                    await db.query(`
                        INSERT INTO inventory_alerts (
                            id, inventory_id, alert_type, severity,
                            message, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, 'expiry', 'warning',
                            $2, NOW()
                        ) ON CONFLICT DO NOTHING
                    `, [
                        item.id,
                        `Warning: ${item.medicine_name} (Batch: ${item.batch_number}) expires in ${daysUntil} days`
                    ]);
                } else {
                    await db.query(`
                        INSERT INTO inventory_alerts (
                            id, inventory_id, alert_type, severity,
                            message, created_at
                        ) VALUES (
                            gen_random_uuid(), $1, 'expiry', 'info',
                            $2, NOW()
                        ) ON CONFLICT DO NOTHING
                    `, [
                        item.id,
                        `${item.medicine_name} (Batch: ${item.batch_number}) expires in ${daysUntil} days`
                    ]);
                }
            }
        } catch (error) {
            logger.error('Error in checkAndCreateExpiryAlerts', { error: error.message, pharmacistId });
        }
    }
};

module.exports = inventoryService;