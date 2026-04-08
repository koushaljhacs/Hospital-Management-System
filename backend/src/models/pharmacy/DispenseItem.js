/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/DispenseItem.js
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
 * DispenseItem model for database operations.
 * Handles individual items within a dispensing record.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: dispense_items
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - dispense_id: UUID (foreign key to dispensing)
 * - medicine_id: UUID (foreign key to inventory)
 * - medicine_name: string
 * - batch_id: UUID (foreign key to batches)
 * - batch_number: string
 * - quantity: integer
 * - unit_price: decimal
 * - discount_percent: decimal
 * - discount_amount: decimal
 * - tax_percent: decimal
 * - tax_amount: decimal
 * - total_price: decimal
 * - instructions: text
 * - created_at: timestamp
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const DispenseItem = {
    /**
     * Table name
     */
    tableName: 'dispense_items',

    /**
     * Find dispense item by ID
     * @param {string} id - DispenseItem UUID
     * @returns {Promise<Object|null>} DispenseItem object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    di.id, di.dispense_id, di.medicine_id, di.medicine_name,
                    di.batch_id, di.batch_number,
                    di.quantity, di.unit_price,
                    di.discount_percent, di.discount_amount,
                    di.tax_percent, di.tax_amount,
                    di.total_price, di.instructions,
                    di.created_at,
                    d.dispense_number, d.patient_id,
                    i.generic_name, i.category
                FROM dispense_items di
                LEFT JOIN dispensing d ON di.dispense_id = d.id
                LEFT JOIN inventory i ON di.medicine_id = i.id
                WHERE di.id = $1 AND di.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Dispense item found by ID', { itemId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding dispense item by ID', {
                error: error.message,
                itemId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find items by dispense ID
     * @param {string} dispenseId - Dispensing UUID
     * @returns {Promise<Array>} List of dispense items
     */
    async findByDispenseId(dispenseId) {
        try {
            const query = `
                SELECT 
                    id, medicine_id, medicine_name,
                    batch_id, batch_number,
                    quantity, unit_price,
                    discount_percent, discount_amount,
                    tax_percent, tax_amount,
                    total_price, instructions,
                    created_at
                FROM dispense_items
                WHERE dispense_id = $1 AND is_deleted = false
                ORDER BY created_at ASC
            `;

            const result = await db.query(query, [dispenseId]);

            logger.debug('Dispense items found by dispense ID', {
                dispenseId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding dispense items by dispense ID', {
                error: error.message,
                dispenseId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find items by medicine ID
     * @param {string} medicineId - Inventory UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of dispense items
     */
    async findByMedicineId(medicineId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [medicineId];
            let paramIndex = 2;
            const conditions = ['di.is_deleted = false'];

            if (from_date) {
                conditions.push(`di.created_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`di.created_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    di.id, di.dispense_id, di.medicine_name,
                    di.quantity, di.unit_price, di.total_price,
                    di.created_at,
                    d.dispense_number, d.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM dispense_items di
                JOIN dispensing d ON di.dispense_id = d.id
                JOIN patients p ON d.patient_id = p.id
                ${whereClause}
                ORDER BY di.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Dispense items found by medicine ID', {
                medicineId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding dispense items by medicine ID', {
                error: error.message,
                medicineId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find items by batch ID
     * @param {string} batchId - Batch UUID
     * @returns {Promise<Array>} List of dispense items
     */
    async findByBatchId(batchId) {
        try {
            const query = `
                SELECT 
                    di.id, di.dispense_id, di.medicine_name,
                    di.quantity, di.unit_price, di.total_price,
                    di.created_at,
                    d.dispense_number
                FROM dispense_items di
                JOIN dispensing d ON di.dispense_id = d.id
                WHERE di.batch_id = $1 AND di.is_deleted = false
                ORDER BY di.created_at DESC
            `;

            const result = await db.query(query, [batchId]);

            logger.debug('Dispense items found by batch ID', {
                batchId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding dispense items by batch ID', {
                error: error.message,
                batchId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new dispense item
     * @param {Object} itemData - Dispense item data
     * @returns {Promise<Object>} Created dispense item
     */
    async create(itemData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (itemData.quantity <= 0) {
                throw new Error('Quantity must be positive');
            }

            // Calculate amounts
            const subtotal = itemData.quantity * itemData.unit_price;
            const discountAmount = (subtotal * (itemData.discount_percent || 0)) / 100;
            const afterDiscount = subtotal - discountAmount;
            const taxAmount = (afterDiscount * (itemData.tax_percent || 0)) / 100;
            const totalPrice = afterDiscount + taxAmount;

            const query = `
                INSERT INTO dispense_items (
                    id, dispense_id, medicine_id, medicine_name,
                    batch_id, batch_number,
                    quantity, unit_price,
                    discount_percent, discount_amount,
                    tax_percent, tax_amount,
                    total_price, instructions,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5,
                    $6, $7,
                    COALESCE($8, 0), $9,
                    COALESCE($10, 0), $11,
                    $12, $13,
                    NOW()
                )
                RETURNING 
                    id, dispense_id, medicine_name,
                    quantity, unit_price, total_price,
                    created_at
            `;

            const values = [
                itemData.dispense_id,
                itemData.medicine_id || null,
                itemData.medicine_name,
                itemData.batch_id || null,
                itemData.batch_number || null,
                itemData.quantity,
                itemData.unit_price,
                itemData.discount_percent,
                discountAmount,
                itemData.tax_percent,
                taxAmount,
                totalPrice,
                itemData.instructions || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Dispense item created successfully', {
                itemId: result.rows[0].id,
                dispenseId: itemData.dispense_id,
                medicineName: itemData.medicine_name,
                quantity: itemData.quantity,
                totalPrice
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating dispense item', {
                error: error.message,
                dispenseId: itemData.dispense_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update dispense item
     * @param {string} id - Dispense item ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated dispense item
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'quantity', 'unit_price',
                'discount_percent', 'tax_percent',
                'instructions'
            ];

            const item = await this.findById(id);
            if (!item) {
                throw new Error('Dispense item not found');
            }

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Prepare for recalculation
            let newQuantity = item.quantity;
            let newUnitPrice = item.unit_price;
            let newDiscountPercent = item.discount_percent || 0;
            let newTaxPercent = item.tax_percent || 0;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    
                    if (key === 'quantity') newQuantity = value;
                    if (key === 'unit_price') newUnitPrice = value;
                    if (key === 'discount_percent') newDiscountPercent = value;
                    if (key === 'tax_percent') newTaxPercent = value;
                    
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            // Recalculate totals
            const subtotal = newQuantity * newUnitPrice;
            const discountAmount = (subtotal * newDiscountPercent) / 100;
            const afterDiscount = subtotal - discountAmount;
            const taxAmount = (afterDiscount * newTaxPercent) / 100;
            const totalPrice = afterDiscount + taxAmount;

            setClause.push(`discount_amount = $${paramIndex++}`);
            values.push(discountAmount);
            setClause.push(`tax_amount = $${paramIndex++}`);
            values.push(taxAmount);
            setClause.push(`total_price = $${paramIndex++}`);
            values.push(totalPrice);

            values.push(id);

            const query = `
                UPDATE dispense_items 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, dispense_id, medicine_name,
                    quantity, unit_price, total_price,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Dispense item not found');
            }

            await db.commitTransaction(client);

            logger.info('Dispense item updated', {
                itemId: id,
                updates: Object.keys(updates),
                newTotalPrice: totalPrice
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating dispense item', {
                error: error.message,
                itemId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Bulk create dispense items
     * @param {Array} itemsData - Array of dispense item data
     * @returns {Promise<Array>} Created items
     */
    async bulkCreate(itemsData) {
        const client = await db.getClient();
        const created = [];

        try {
            await db.beginTransaction(client);

            for (const data of itemsData) {
                const result = await this.create(data);
                created.push(result);
            }

            await db.commitTransaction(client);

            logger.info('Bulk dispense items created', {
                count: created.length,
                dispenseId: itemsData[0]?.dispense_id
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk creating dispense items', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get dispense item statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_items_dispensed,
                    SUM(quantity) as total_quantity,
                    SUM(total_price) as total_revenue,
                    AVG(quantity)::numeric(10,2) as avg_quantity_per_item,
                    AVG(unit_price)::numeric(10,2) as avg_unit_price,
                    COUNT(DISTINCT medicine_id) as unique_medicines,
                    COUNT(DISTINCT dispense_id) as unique_dispenses,
                    COUNT(DISTINCT batch_id) as unique_batches_used
                FROM dispense_items
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Dispense item statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting dispense item statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get sales summary by medicine
     * @param {number} limit - Number of medicines
     * @param {Object} options - Date range options
     * @returns {Promise<Array>} Sales summary
     */
    async getSalesByMedicine(limit = 20, options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND di.created_at BETWEEN $${values.length + 1} AND $${values.length + 2}`;
                values.push(from_date, to_date);
            }
            values.push(limit);

            const query = `
                SELECT 
                    di.medicine_id,
                    di.medicine_name,
                    COUNT(*) as dispense_count,
                    SUM(di.quantity) as total_quantity_sold,
                    SUM(di.total_price) as total_revenue,
                    AVG(di.unit_price)::numeric(10,2) as avg_selling_price
                FROM dispense_items di
                WHERE di.is_deleted = false
                ${dateCondition}
                GROUP BY di.medicine_id, di.medicine_name
                ORDER BY total_revenue DESC
                LIMIT $${values.length + 1}
            `;

            const result = await db.query(query, values);

            logger.debug('Sales by medicine retrieved', {
                limit,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting sales by medicine', {
                error: error.message,
                limit
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get sales summary by batch
     * @param {Object} options - Date range options
     * @returns {Promise<Array>} Sales by batch
     */
    async getSalesByBatch(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND created_at BETWEEN $${values.length + 1} AND $${values.length + 2}`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    batch_id,
                    batch_number,
                    COUNT(*) as dispense_count,
                    SUM(quantity) as total_quantity_sold,
                    SUM(total_price) as total_revenue
                FROM dispense_items
                WHERE is_deleted = false
                    AND batch_id IS NOT NULL
                ${dateCondition}
                GROUP BY batch_id, batch_number
                ORDER BY total_revenue DESC
            `;

            const result = await db.query(query, values);

            logger.debug('Sales by batch retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting sales by batch', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete dispense item
     * @param {string} id - Dispense item ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE dispense_items 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Dispense item not found');
            }

            await db.commitTransaction(client);

            logger.info('Dispense item soft deleted', {
                itemId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting dispense item', {
                error: error.message,
                itemId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = DispenseItem;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */