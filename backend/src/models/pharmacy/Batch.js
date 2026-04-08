/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/Batch.js
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
 * Batch model for database operations.
 * Handles medicine batch tracking for inventory management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: batches
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - inventory_id: UUID (foreign key to inventory)
 * - batch_number: string
 * - manufacturer: string
 * - manufacturing_date: date
 * - expiry_date: date
 * - quantity: integer
 * - quantity_remaining: integer
 * - unit_price: decimal
 * - selling_price: decimal
 * - mrp: decimal
 * - gst_percentage: decimal
 * - location: string
 * - received_date: date
 * - received_quantity: integer
 * - purchase_order_id: UUID
 * - supplier_id: UUID
 * - is_active: boolean
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

const Batch = {
    /**
     * Table name
     */
    tableName: 'batches',

    /**
     * Find batch by ID
     * @param {string} id - Batch UUID
     * @returns {Promise<Object|null>} Batch object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    b.id, b.inventory_id, b.batch_number, b.manufacturer,
                    b.manufacturing_date, b.expiry_date,
                    b.quantity, b.quantity_remaining,
                    b.unit_price, b.selling_price, b.mrp,
                    b.gst_percentage, b.location,
                    b.received_date, b.received_quantity,
                    b.purchase_order_id, b.supplier_id,
                    b.is_active, b.created_at, b.updated_at,
                    i.medicine_name, i.generic_name, i.category,
                    s.name as supplier_name,
                    po.po_number as purchase_order_number
                FROM batches b
                LEFT JOIN inventory i ON b.inventory_id = i.id
                LEFT JOIN suppliers s ON b.supplier_id = s.id
                LEFT JOIN purchase_orders po ON b.purchase_order_id = po.id
                WHERE b.id = $1 AND b.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Batch found by ID', { batchId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding batch by ID', {
                error: error.message,
                batchId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find batches by inventory ID
     * @param {string} inventoryId - Inventory UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of batches
     */
    async findByInventoryId(inventoryId, options = {}) {
        try {
            const { limit = 50, offset = 0, is_active = true } = options;

            const query = `
                SELECT 
                    id, batch_number, manufacturer,
                    manufacturing_date, expiry_date,
                    quantity, quantity_remaining,
                    unit_price, selling_price, mrp,
                    location, received_date,
                    is_active, created_at
                FROM batches
                WHERE inventory_id = $1 
                    AND is_deleted = false
                    ${is_active ? 'AND is_active = true' : ''}
                ORDER BY expiry_date ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [inventoryId, limit, offset]);

            logger.debug('Batches found by inventory ID', {
                inventoryId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding batches by inventory ID', {
                error: error.message,
                inventoryId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find batches by batch number
     * @param {string} batchNumber - Batch number
     * @returns {Promise<Array>} List of batches
     */
    async findByBatchNumber(batchNumber) {
        try {
            const query = `
                SELECT 
                    b.id, b.inventory_id, b.batch_number,
                    b.expiry_date, b.quantity_remaining,
                    b.selling_price, b.location,
                    i.medicine_name, i.generic_name
                FROM batches b
                JOIN inventory i ON b.inventory_id = i.id
                WHERE b.batch_number = $1 AND b.is_deleted = false
                ORDER BY b.expiry_date ASC
            `;

            const result = await db.query(query, [batchNumber]);

            logger.debug('Batches found by batch number', {
                batchNumber,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding batches by batch number', {
                error: error.message,
                batchNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find batches by supplier ID
     * @param {string} supplierId - Supplier UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of batches
     */
    async findBySupplierId(supplierId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    b.id, b.inventory_id, b.batch_number,
                    b.expiry_date, b.quantity_remaining,
                    b.received_date, b.unit_price,
                    i.medicine_name
                FROM batches b
                JOIN inventory i ON b.inventory_id = i.id
                WHERE b.supplier_id = $1 AND b.is_deleted = false
                ORDER BY b.received_date DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [supplierId, limit, offset]);

            logger.debug('Batches found by supplier ID', {
                supplierId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding batches by supplier ID', {
                error: error.message,
                supplierId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expiring batches (within days threshold)
     * @param {number} daysThreshold - Days to look ahead
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of expiring batches
     */
    async getExpiringBatches(daysThreshold = 90, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    b.id, b.inventory_id, b.batch_number,
                    b.expiry_date, b.quantity_remaining,
                    b.unit_price, b.selling_price,
                    i.medicine_name, i.generic_name, i.category,
                    EXTRACT(DAY FROM (b.expiry_date - CURRENT_DATE)) as days_until_expiry
                FROM batches b
                JOIN inventory i ON b.inventory_id = i.id
                WHERE b.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
                    AND b.expiry_date > CURRENT_DATE
                    AND b.quantity_remaining > 0
                    AND b.is_active = true
                    AND b.is_deleted = false
                ORDER BY b.expiry_date ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [daysThreshold, limit, offset]);

            logger.debug('Expiring batches retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiring batches', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expired batches
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of expired batches
     */
    async getExpiredBatches(options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    b.id, b.inventory_id, b.batch_number,
                    b.expiry_date, b.quantity_remaining,
                    b.unit_price, b.selling_price,
                    i.medicine_name, i.generic_name, i.category
                FROM batches b
                JOIN inventory i ON b.inventory_id = i.id
                WHERE b.expiry_date <= CURRENT_DATE
                    AND b.quantity_remaining > 0
                    AND b.is_deleted = false
                ORDER BY b.expiry_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Expired batches retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expired batches', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new batch
     * @param {Object} batchData - Batch data
     * @returns {Promise<Object>} Created batch
     */
    async create(batchData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (batchData.quantity <= 0) {
                throw new Error('Quantity must be positive');
            }

            if (batchData.expiry_date <= batchData.manufacturing_date) {
                throw new Error('Expiry date must be after manufacturing date');
            }

            const query = `
                INSERT INTO batches (
                    id, inventory_id, batch_number, manufacturer,
                    manufacturing_date, expiry_date,
                    quantity, quantity_remaining,
                    unit_price, selling_price, mrp,
                    gst_percentage, location,
                    received_date, received_quantity,
                    purchase_order_id, supplier_id,
                    is_active, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5,
                    $6, $6,
                    $7, $8, $9,
                    COALESCE($10, 0), $11,
                    COALESCE($12, CURRENT_DATE), $13,
                    $14, $15,
                    true, NOW(), NOW()
                )
                RETURNING 
                    id, inventory_id, batch_number,
                    expiry_date, quantity, selling_price,
                    is_active, created_at
            `;

            const values = [
                batchData.inventory_id,
                batchData.batch_number,
                batchData.manufacturer || null,
                batchData.manufacturing_date || null,
                batchData.expiry_date,
                batchData.quantity,
                batchData.unit_price,
                batchData.selling_price,
                batchData.mrp || null,
                batchData.gst_percentage,
                batchData.location || null,
                batchData.received_date || null,
                batchData.received_quantity || batchData.quantity,
                batchData.purchase_order_id || null,
                batchData.supplier_id || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Batch created successfully', {
                batchId: result.rows[0].id,
                inventoryId: batchData.inventory_id,
                batchNumber: batchData.batch_number,
                quantity: batchData.quantity
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating batch', {
                error: error.message,
                inventoryId: batchData.inventory_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update batch
     * @param {string} id - Batch ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated batch
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'batch_number', 'manufacturer', 'manufacturing_date',
                'expiry_date', 'unit_price', 'selling_price', 'mrp',
                'gst_percentage', 'location', 'is_active'
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
                UPDATE batches 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, batch_number, expiry_date,
                    selling_price, is_active, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Batch not found');
            }

            await db.commitTransaction(client);

            logger.info('Batch updated', {
                batchId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating batch', {
                error: error.message,
                batchId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Reduce batch quantity (when dispensed)
     * @param {string} id - Batch ID
     * @param {number} quantity - Quantity to reduce
     * @returns {Promise<Object>} Updated batch
     */
    async reduceQuantity(id, quantity) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const batch = await this.findById(id);
            if (!batch) {
                throw new Error('Batch not found');
            }

            if (batch.quantity_remaining < quantity) {
                throw new Error(`Insufficient quantity. Available: ${batch.quantity_remaining}`);
            }

            if (batch.expiry_date <= new Date()) {
                throw new Error('Cannot dispense from expired batch');
            }

            const newQuantity = batch.quantity_remaining - quantity;

            const query = `
                UPDATE batches 
                SET quantity_remaining = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING 
                    id, batch_number, quantity_remaining,
                    expiry_date
            `;

            const result = await client.query(query, [newQuantity, id]);

            if (result.rows.length === 0) {
                throw new Error('Batch not found');
            }

            await db.commitTransaction(client);

            logger.debug('Batch quantity reduced', {
                batchId: id,
                reducedBy: quantity,
                remaining: newQuantity
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error reducing batch quantity', {
                error: error.message,
                batchId: id,
                quantity
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Increase batch quantity (when returning or restocking)
     * @param {string} id - Batch ID
     * @param {number} quantity - Quantity to increase
     * @returns {Promise<Object>} Updated batch
     */
    async increaseQuantity(id, quantity) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const batch = await this.findById(id);
            if (!batch) {
                throw new Error('Batch not found');
            }

            if (batch.expiry_date <= new Date()) {
                throw new Error('Cannot add to expired batch');
            }

            const newQuantity = batch.quantity_remaining + quantity;

            const query = `
                UPDATE batches 
                SET quantity_remaining = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING 
                    id, batch_number, quantity_remaining,
                    expiry_date
            `;

            const result = await client.query(query, [newQuantity, id]);

            if (result.rows.length === 0) {
                throw new Error('Batch not found');
            }

            await db.commitTransaction(client);

            logger.debug('Batch quantity increased', {
                batchId: id,
                increasedBy: quantity,
                newRemaining: newQuantity
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error increasing batch quantity', {
                error: error.message,
                batchId: id,
                quantity
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get batch statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_batches,
                    SUM(quantity_remaining) as total_quantity_available,
                    COUNT(*) FILTER (WHERE expiry_date <= CURRENT_DATE + INTERVAL '90 days') as expiring_90_days,
                    COUNT(*) FILTER (WHERE expiry_date <= CURRENT_DATE) as expired_batches,
                    COUNT(*) FILTER (WHERE quantity_remaining <= 0) as out_of_stock_batches,
                    COUNT(*) FILTER (WHERE is_active = true) as active_batches,
                    AVG(quantity_remaining)::numeric(10,2) as avg_quantity_per_batch,
                    AVG(selling_price)::numeric(10,2) as avg_selling_price,
                    SUM(quantity_remaining * selling_price) as total_inventory_value
                FROM batches
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Batch statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting batch statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Deactivate expired batches (run via cron)
     * @returns {Promise<number>} Number of batches deactivated
     */
    async deactivateExpiredBatches() {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE batches 
                SET is_active = false,
                    updated_at = NOW()
                WHERE expiry_date <= CURRENT_DATE
                    AND is_active = true
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Expired batches deactivated', {
                    count: result.rowCount
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deactivating expired batches', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Get batches by expiry date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @returns {Promise<Array>} List of batches
     */
    async getByExpiryRange(startDate, endDate) {
        try {
            const query = `
                SELECT 
                    b.id, b.inventory_id, b.batch_number,
                    b.expiry_date, b.quantity_remaining,
                    b.selling_price, b.location,
                    i.medicine_name, i.generic_name
                FROM batches b
                JOIN inventory i ON b.inventory_id = i.id
                WHERE b.expiry_date BETWEEN $1 AND $2
                    AND b.quantity_remaining > 0
                    AND b.is_deleted = false
                ORDER BY b.expiry_date ASC
            `;

            const result = await db.query(query, [startDate, endDate]);

            logger.debug('Batches found by expiry range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting batches by expiry range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete batch
     * @param {string} id - Batch ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE batches 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Batch not found');
            }

            await db.commitTransaction(client);

            logger.info('Batch soft deleted', {
                batchId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting batch', {
                error: error.message,
                batchId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Batch;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */