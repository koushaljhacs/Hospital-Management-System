/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/Inventory.js
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
 * Inventory model for database operations.
 * Handles medicine inventory management including stock levels,
 * batch tracking, expiry management, and pricing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: inventory
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - medicine_name: string
 * - generic_name: string
 * - category: enum (tablet, capsule, syrup, injection, ointment, cream, drops, inhaler, suppository, vaccine, surgical, consumable, equipment, other)
 * - manufacturer: string
 * - brand_name: string
 * - supplier_id: UUID
 * - supplier_sku: string
 * - batch_number: string
 * - batch_id: string
 * - expiry_date: date
 * - manufacturing_date: date
 * - received_date: date
 * - quantity: integer
 * - reserved_quantity: integer
 * - available_quantity: integer (generated)
 * - reorder_level: integer
 * - minimum_stock: integer
 * - maximum_stock: integer
 * - safety_stock: integer
 * - unit_price: decimal
 * - selling_price: decimal
 * - mrp: decimal
 * - gst_percentage: decimal
 * - discount_percentage: decimal
 * - discount_allowed: boolean
 * - location: string
 * - zone: string
 * - rack_number: string
 * - shelf_number: string
 * - bin_number: string
 * - is_active: boolean
 * - requires_prescription: boolean
 * - is_narcotic: boolean
 * - is_refrigerated: boolean
 * - is_hazardous: boolean
 * - storage_conditions: text
 * - temperature_min: decimal
 * - temperature_max: decimal
 * - humidity_min: decimal
 * - humidity_max: decimal
 * - light_sensitive: boolean
 * - created_at: timestamp
 * - updated_at: timestamp
 * - last_checked: timestamp
 * - checked_by: uuid
 * - last_ordered: timestamp
 * - last_sold: timestamp
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * - notes: text
 * - metadata: jsonb
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const Inventory = {
    /**
     * Table name
     */
    tableName: 'inventory',

    /**
     * Valid categories
     */
    validCategories: [
        'tablet', 'capsule', 'syrup', 'injection', 'ointment',
        'cream', 'drops', 'inhaler', 'suppository', 'vaccine',
        'surgical', 'consumable', 'equipment', 'other'
    ],

    /**
     * Find inventory item by ID
     * @param {string} id - Inventory UUID
     * @returns {Promise<Object|null>} Inventory object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    i.id, i.medicine_name, i.generic_name, i.category,
                    i.manufacturer, i.brand_name, i.supplier_id,
                    i.supplier_sku, i.batch_number, i.batch_id,
                    i.expiry_date, i.manufacturing_date, i.received_date,
                    i.quantity, i.reserved_quantity, i.available_quantity,
                    i.reorder_level, i.minimum_stock, i.maximum_stock, i.safety_stock,
                    i.unit_price, i.selling_price, i.mrp,
                    i.gst_percentage, i.discount_percentage, i.discount_allowed,
                    i.location, i.zone, i.rack_number, i.shelf_number, i.bin_number,
                    i.is_active, i.requires_prescription, i.is_narcotic,
                    i.is_refrigerated, i.is_hazardous, i.storage_conditions,
                    i.temperature_min, i.temperature_max,
                    i.humidity_min, i.humidity_max, i.light_sensitive,
                    i.created_at, i.updated_at, i.last_checked,
                    i.checked_by, i.last_ordered, i.last_sold,
                    i.notes, i.metadata,
                    s.name as supplier_name,
                    u.username as checked_by_name
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                LEFT JOIN users u ON i.checked_by = u.id
                WHERE i.id = $1 AND i.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Inventory item found by ID', { inventoryId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding inventory item by ID', {
                error: error.message,
                inventoryId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find inventory items by medicine name (search)
     * @param {string} searchTerm - Search term
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of inventory items
     */
    async searchByName(searchTerm, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    i.id, i.medicine_name, i.generic_name, i.category,
                    i.manufacturer, i.batch_number, i.expiry_date,
                    i.quantity, i.available_quantity, i.reorder_level,
                    i.selling_price, i.mrp, i.is_active,
                    i.location, i.rack_number
                FROM inventory i
                WHERE (i.medicine_name ILIKE $1 
                    OR i.generic_name ILIKE $1
                    OR i.batch_number ILIKE $1)
                    AND i.is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN i.medicine_name ILIKE $2 THEN 1
                        WHEN i.generic_name ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    i.medicine_name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Inventory search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching inventory', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find inventory items by category
     * @param {string} category - Category
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of inventory items
     */
    async findByCategory(category, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    i.id, i.medicine_name, i.generic_name, i.category,
                    i.manufacturer, i.batch_number, i.expiry_date,
                    i.quantity, i.available_quantity, i.reorder_level,
                    i.selling_price, i.mrp, i.is_active
                FROM inventory i
                WHERE i.category = $1 AND i.is_deleted = false
                ORDER BY i.medicine_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [category, limit, offset]);

            logger.debug('Inventory items found by category', {
                category,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding inventory by category', {
                error: error.message,
                category
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get low stock items (quantity <= reorder level)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of low stock items
     */
    async getLowStockItems(options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    i.id, i.medicine_name, i.generic_name, i.category,
                    i.manufacturer, i.batch_number, i.expiry_date,
                    i.quantity, i.available_quantity,
                    i.reorder_level, i.minimum_stock,
                    i.selling_price, i.unit_price,
                    i.location, i.rack_number,
                    s.name as supplier_name
                FROM inventory i
                LEFT JOIN suppliers s ON i.supplier_id = s.id
                WHERE i.quantity <= i.reorder_level
                    AND i.is_active = true
                    AND i.is_deleted = false
                ORDER BY (i.quantity::float / NULLIF(i.reorder_level, 0)) ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Low stock items retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting low stock items', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expiring items (expiry date within days threshold)
     * @param {number} daysThreshold - Days to look ahead
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of expiring items
     */
    async getExpiringItems(daysThreshold = 90, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    i.id, i.medicine_name, i.generic_name, i.category,
                    i.manufacturer, i.batch_number, i.expiry_date,
                    i.quantity, i.available_quantity,
                    i.unit_price, i.selling_price,
                    i.location,
                    EXTRACT(DAY FROM (i.expiry_date - CURRENT_DATE)) as days_until_expiry
                FROM inventory i
                WHERE i.expiry_date IS NOT NULL
                    AND i.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
                    AND i.expiry_date > CURRENT_DATE
                    AND i.quantity > 0
                    AND i.is_active = true
                    AND i.is_deleted = false
                ORDER BY i.expiry_date ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [daysThreshold, limit, offset]);

            logger.debug('Expiring items retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiring items', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expired items
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of expired items
     */
    async getExpiredItems(options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    i.id, i.medicine_name, i.generic_name, i.category,
                    i.manufacturer, i.batch_number, i.expiry_date,
                    i.quantity, i.available_quantity,
                    i.unit_price, i.selling_price,
                    i.location
                FROM inventory i
                WHERE i.expiry_date IS NOT NULL
                    AND i.expiry_date <= CURRENT_DATE
                    AND i.quantity > 0
                    AND i.is_deleted = false
                ORDER BY i.expiry_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Expired items retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expired items', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new inventory item
     * @param {Object} itemData - Inventory item data
     * @returns {Promise<Object>} Created inventory item
     */
    async create(itemData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (itemData.category && !this.validCategories.includes(itemData.category)) {
                throw new Error(`Invalid category. Must be one of: ${this.validCategories.join(', ')}`);
            }

            if (itemData.quantity < 0) {
                throw new Error('Quantity cannot be negative');
            }

            const query = `
                INSERT INTO inventory (
                    id, medicine_name, generic_name, category,
                    manufacturer, brand_name, supplier_id, supplier_sku,
                    batch_number, batch_id, expiry_date, manufacturing_date,
                    received_date, quantity, reserved_quantity,
                    reorder_level, minimum_stock, maximum_stock, safety_stock,
                    unit_price, selling_price, mrp,
                    gst_percentage, discount_percentage, discount_allowed,
                    location, zone, rack_number, shelf_number, bin_number,
                    is_active, requires_prescription, is_narcotic,
                    is_refrigerated, is_hazardous, storage_conditions,
                    temperature_min, temperature_max,
                    humidity_min, humidity_max, light_sensitive,
                    notes, metadata,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6, $7,
                    $8, $9, $10, $11,
                    COALESCE($12, CURRENT_DATE), $13, 0,
                    $14, $15, $16, COALESCE($17, 0),
                    $18, $19, $20,
                    COALESCE($21, 0), COALESCE($22, 0), COALESCE($23, true),
                    $24, $25, $26, $27, $28,
                    COALESCE($29, true), COALESCE($30, false), COALESCE($31, false),
                    COALESCE($32, false), COALESCE($33, false), $34,
                    $35, $36, $37, $38, COALESCE($39, false),
                    $40, $41,
                    NOW(), NOW()
                )
                RETURNING 
                    id, medicine_name, generic_name, category,
                    batch_number, expiry_date, quantity,
                    selling_price, is_active, created_at
            `;

            const values = [
                itemData.medicine_name,
                itemData.generic_name || null,
                itemData.category,
                itemData.manufacturer || null,
                itemData.brand_name || null,
                itemData.supplier_id || null,
                itemData.supplier_sku || null,
                itemData.batch_number,
                itemData.batch_id || null,
                itemData.expiry_date,
                itemData.manufacturing_date || null,
                itemData.received_date || null,
                itemData.quantity,
                itemData.reorder_level,
                itemData.minimum_stock,
                itemData.maximum_stock,
                itemData.safety_stock,
                itemData.unit_price,
                itemData.selling_price,
                itemData.mrp || null,
                itemData.gst_percentage,
                itemData.discount_percentage,
                itemData.discount_allowed,
                itemData.location,
                itemData.zone || null,
                itemData.rack_number || null,
                itemData.shelf_number || null,
                itemData.bin_number || null,
                itemData.is_active,
                itemData.requires_prescription,
                itemData.is_narcotic,
                itemData.is_refrigerated,
                itemData.is_hazardous,
                itemData.storage_conditions || null,
                itemData.temperature_min || null,
                itemData.temperature_max || null,
                itemData.humidity_min || null,
                itemData.humidity_max || null,
                itemData.light_sensitive,
                itemData.notes || null,
                itemData.metadata || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Inventory item created successfully', {
                inventoryId: result.rows[0].id,
                medicineName: itemData.medicine_name,
                batchNumber: itemData.batch_number,
                quantity: itemData.quantity
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating inventory item', {
                error: error.message,
                medicineName: itemData.medicine_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update inventory item
     * @param {string} id - Inventory ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated inventory item
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'medicine_name', 'generic_name', 'category',
                'manufacturer', 'brand_name', 'supplier_id', 'supplier_sku',
                'batch_number', 'batch_id', 'expiry_date', 'manufacturing_date',
                'received_date', 'reorder_level', 'minimum_stock',
                'maximum_stock', 'safety_stock',
                'unit_price', 'selling_price', 'mrp',
                'gst_percentage', 'discount_percentage', 'discount_allowed',
                'location', 'zone', 'rack_number', 'shelf_number', 'bin_number',
                'is_active', 'requires_prescription', 'is_narcotic',
                'is_refrigerated', 'is_hazardous', 'storage_conditions',
                'temperature_min', 'temperature_max',
                'humidity_min', 'humidity_max', 'light_sensitive',
                'notes', 'metadata'
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
                UPDATE inventory 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, medicine_name, batch_number, quantity,
                    selling_price, is_active, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Inventory item not found');
            }

            await db.commitTransaction(client);

            logger.info('Inventory item updated', {
                inventoryId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating inventory item', {
                error: error.message,
                inventoryId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Adjust stock quantity (add or remove)
     * @param {string} id - Inventory ID
     * @param {number} quantityChange - Change in quantity (positive for addition, negative for removal)
     * @param {string} reason - Reason for adjustment
     * @param {string} adjustedBy - User who adjusted
     * @returns {Promise<Object>} Updated inventory item
     */
    async adjustStock(id, quantityChange, reason, adjustedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const item = await this.findById(id);
            if (!item) {
                throw new Error('Inventory item not found');
            }

            const newQuantity = item.quantity + quantityChange;
            if (newQuantity < 0) {
                throw new Error('Insufficient stock');
            }

            const query = `
                UPDATE inventory 
                SET quantity = $1,
                    updated_at = NOW(),
                    updated_by = $2
                WHERE id = $3 AND is_deleted = false
                RETURNING 
                    id, medicine_name, quantity,
                    available_quantity
            `;

            const result = await client.query(query, [newQuantity, adjustedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Inventory item not found');
            }

            await db.commitTransaction(client);

            logger.info('Stock adjusted', {
                inventoryId: id,
                medicineName: item.medicine_name,
                quantityChange,
                newQuantity,
                reason,
                adjustedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error adjusting stock', {
                error: error.message,
                inventoryId: id,
                quantityChange
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Reserve stock (for pending orders)
     * @param {string} id - Inventory ID
     * @param {number} quantity - Quantity to reserve
     * @returns {Promise<Object>} Updated inventory item
     */
    async reserveStock(id, quantity) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const item = await this.findById(id);
            if (!item) {
                throw new Error('Inventory item not found');
            }

            const availableQuantity = item.quantity - item.reserved_quantity;
            if (availableQuantity < quantity) {
                throw new Error(`Insufficient available stock. Available: ${availableQuantity}`);
            }

            const query = `
                UPDATE inventory 
                SET reserved_quantity = reserved_quantity + $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING 
                    id, medicine_name, quantity,
                    reserved_quantity, available_quantity
            `;

            const result = await client.query(query, [quantity, id]);

            await db.commitTransaction(client);

            logger.debug('Stock reserved', {
                inventoryId: id,
                medicineName: item.medicine_name,
                reservedQuantity: quantity
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error reserving stock', {
                error: error.message,
                inventoryId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Release reserved stock (order cancelled)
     * @param {string} id - Inventory ID
     * @param {number} quantity - Quantity to release
     * @returns {Promise<Object>} Updated inventory item
     */
    async releaseReservedStock(id, quantity) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const item = await this.findById(id);
            if (!item) {
                throw new Error('Inventory item not found');
            }

            const query = `
                UPDATE inventory 
                SET reserved_quantity = GREATEST(reserved_quantity - $1, 0),
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING 
                    id, medicine_name, quantity,
                    reserved_quantity, available_quantity
            `;

            const result = await client.query(query, [quantity, id]);

            await db.commitTransaction(client);

            logger.debug('Reserved stock released', {
                inventoryId: id,
                medicineName: item.medicine_name,
                releasedQuantity: quantity
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error releasing reserved stock', {
                error: error.message,
                inventoryId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Record stock count (physical inventory)
     * @param {string} id - Inventory ID
     * @param {number} countedQuantity - Physical count
     * @param {string} countedBy - User who counted
     * @returns {Promise<Object>} Updated inventory item
     */
    async recordStockCount(id, countedQuantity, countedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const item = await this.findById(id);
            if (!item) {
                throw new Error('Inventory item not found');
            }

            const variance = countedQuantity - item.quantity;

            const query = `
                UPDATE inventory 
                SET quantity = $1,
                    last_checked = NOW(),
                    checked_by = $2,
                    updated_at = NOW(),
                    notes = COALESCE(CONCAT(notes, E'\\nStock count: ', $3, ' (variance: ', $4, ')'), $5)
                WHERE id = $6 AND is_deleted = false
                RETURNING 
                    id, medicine_name, quantity,
                    last_checked, checked_by
            `;

            const varianceText = variance !== 0 ? `variance: ${variance}` : 'no variance';
            const notes = `Physical count on ${new Date().toISOString()}: ${countedQuantity} (${varianceText})`;

            const result = await client.query(query, [countedQuantity, countedBy, countedQuantity, variance, notes, id]);

            if (result.rows.length === 0) {
                throw new Error('Inventory item not found');
            }

            await db.commitTransaction(client);

            logger.info('Stock count recorded', {
                inventoryId: id,
                medicineName: item.medicine_name,
                previousQuantity: item.quantity,
                countedQuantity,
                variance,
                countedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error recording stock count', {
                error: error.message,
                inventoryId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get inventory statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_items,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    SUM(quantity * selling_price) as total_selling_value,
                    COUNT(*) FILTER (WHERE quantity <= reorder_level) as low_stock_count,
                    COUNT(*) FILTER (WHERE expiry_date <= CURRENT_DATE + INTERVAL '90 days') as expiring_90_days,
                    COUNT(*) FILTER (WHERE expiry_date <= CURRENT_DATE) as expired_count,
                    COUNT(*) FILTER (WHERE is_active = true) as active_items,
                    COUNT(DISTINCT category) as categories_used,
                    AVG(quantity)::numeric(10,2) as avg_quantity_per_item,
                    AVG(selling_price)::numeric(10,2) as avg_selling_price
                FROM inventory
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Inventory statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting inventory statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get inventory valuation by category
     * @returns {Promise<Array>} Valuation by category
     */
    async getValuationByCategory() {
        try {
            const query = `
                SELECT 
                    category,
                    COUNT(*) as item_count,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    SUM(quantity * selling_price) as total_selling_value
                FROM inventory
                WHERE is_deleted = false AND quantity > 0
                GROUP BY category
                ORDER BY total_value DESC
            `;

            const result = await db.query(query);

            logger.debug('Inventory valuation by category retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting inventory valuation by category', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete inventory item
     * @param {string} id - Inventory ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE inventory 
                SET is_deleted = true,
                    is_active = false,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Inventory item not found');
            }

            await db.commitTransaction(client);

            logger.info('Inventory item soft deleted', {
                inventoryId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting inventory item', {
                error: error.message,
                inventoryId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Inventory;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */