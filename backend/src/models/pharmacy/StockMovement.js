/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/StockMovement.js
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
 * StockMovement model for database operations.
 * Tracks all inventory stock changes (purchase, sale, return, adjustment).
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: stock_movements
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - inventory_id: UUID (foreign key to inventory)
 * - batch_id: UUID (foreign key to batches)
 * - movement_type: enum (purchase, sale, return, adjustment, expiry_write_off, damage_write_off)
 * - quantity: integer
 * - previous_quantity: integer
 * - new_quantity: integer
 * - reference_type: string
 * - reference_id: UUID
 * - unit_price: decimal
 * - total_value: decimal
 * - reason: text
 * - performed_by: uuid
 * - performed_at: timestamp
 * - notes: text
 * - created_at: timestamp
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const StockMovement = {
    /**
     * Table name
     */
    tableName: 'stock_movements',

    /**
     * Valid movement types
     */
    validMovementTypes: [
        'purchase', 'sale', 'return', 'adjustment',
        'expiry_write_off', 'damage_write_off'
    ],

    /**
     * Record stock movement
     * @param {Object} movementData - Stock movement data
     * @returns {Promise<Object>} Created movement record
     */
    async record(movementData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (!this.validMovementTypes.includes(movementData.movement_type)) {
                throw new Error(`Invalid movement type. Must be one of: ${this.validMovementTypes.join(', ')}`);
            }

            if (movementData.quantity === 0) {
                throw new Error('Quantity must be non-zero');
            }

            const query = `
                INSERT INTO stock_movements (
                    id, inventory_id, batch_id, movement_type,
                    quantity, previous_quantity, new_quantity,
                    reference_type, reference_id,
                    unit_price, total_value,
                    reason, performed_by, performed_at,
                    notes, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8,
                    $9, $10,
                    $11, $12, COALESCE($13, NOW()),
                    $14, NOW()
                )
                RETURNING 
                    id, inventory_id, movement_type,
                    quantity, previous_quantity, new_quantity,
                    reference_type, reference_id,
                    total_value, performed_at
            `;

            const values = [
                movementData.inventory_id,
                movementData.batch_id || null,
                movementData.movement_type,
                movementData.quantity,
                movementData.previous_quantity,
                movementData.new_quantity,
                movementData.reference_type || null,
                movementData.reference_id || null,
                movementData.unit_price || null,
                movementData.total_value || null,
                movementData.reason || null,
                movementData.performed_by || null,
                movementData.performed_at || null,
                movementData.notes || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Stock movement recorded', {
                movementId: result.rows[0].id,
                inventoryId: movementData.inventory_id,
                movementType: movementData.movement_type,
                quantity: movementData.quantity,
                newQuantity: movementData.new_quantity
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error recording stock movement', {
                error: error.message,
                inventoryId: movementData.inventory_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Find movements by inventory ID
     * @param {string} inventoryId - Inventory UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of movements
     */
    async findByInventoryId(inventoryId, options = {}) {
        try {
            const { limit = 50, offset = 0, movement_type, from_date, to_date } = options;
            const values = [inventoryId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (movement_type) {
                conditions.push(`movement_type = $${paramIndex++}`);
                values.push(movement_type);
            }
            if (from_date) {
                conditions.push(`performed_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`performed_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, movement_type, quantity,
                    previous_quantity, new_quantity,
                    reference_type, reference_id,
                    unit_price, total_value,
                    reason, performed_by, performed_at,
                    notes,
                    u.username as performed_by_name
                FROM stock_movements sm
                LEFT JOIN users u ON sm.performed_by = u.id
                ${whereClause}
                ORDER BY performed_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Stock movements found by inventory ID', {
                inventoryId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding stock movements by inventory ID', {
                error: error.message,
                inventoryId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find movements by batch ID
     * @param {string} batchId - Batch UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of movements
     */
    async findByBatchId(batchId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, movement_type, quantity,
                    previous_quantity, new_quantity,
                    reference_type, reference_id,
                    reason, performed_at,
                    u.username as performed_by_name
                FROM stock_movements sm
                LEFT JOIN users u ON sm.performed_by = u.id
                WHERE sm.batch_id = $1 AND sm.is_deleted = false
                ORDER BY sm.performed_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [batchId, limit, offset]);

            logger.debug('Stock movements found by batch ID', {
                batchId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding stock movements by batch ID', {
                error: error.message,
                batchId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get movements by reference (e.g., purchase order, dispensing)
     * @param {string} referenceType - Reference type
     * @param {string} referenceId - Reference ID
     * @returns {Promise<Array>} List of movements
     */
    async findByReference(referenceType, referenceId) {
        try {
            const query = `
                SELECT 
                    id, inventory_id, batch_id, movement_type,
                    quantity, previous_quantity, new_quantity,
                    unit_price, total_value,
                    reason, performed_at,
                    i.medicine_name
                FROM stock_movements sm
                JOIN inventory i ON sm.inventory_id = i.id
                WHERE sm.reference_type = $1 
                    AND sm.reference_id = $2
                    AND sm.is_deleted = false
                ORDER BY sm.performed_at ASC
            `;

            const result = await db.query(query, [referenceType, referenceId]);

            logger.debug('Stock movements found by reference', {
                referenceType,
                referenceId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding stock movements by reference', {
                error: error.message,
                referenceType,
                referenceId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get movement statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND performed_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_movements,
                    SUM(CASE WHEN movement_type = 'purchase' AND quantity > 0 THEN quantity ELSE 0 END) as total_purchased,
                    SUM(CASE WHEN movement_type = 'purchase' AND quantity > 0 THEN total_value ELSE 0 END) as total_purchase_value,
                    SUM(CASE WHEN movement_type = 'sale' AND quantity < 0 THEN -quantity ELSE 0 END) as total_sold,
                    SUM(CASE WHEN movement_type = 'sale' AND quantity < 0 THEN -total_value ELSE 0 END) as total_sale_value,
                    SUM(CASE WHEN movement_type = 'return' THEN quantity ELSE 0 END) as total_returned,
                    SUM(CASE WHEN movement_type = 'expiry_write_off' THEN -quantity ELSE 0 END) as expired_quantity,
                    SUM(CASE WHEN movement_type = 'damage_write_off' THEN -quantity ELSE 0 END) as damaged_quantity,
                    COUNT(DISTINCT inventory_id) as unique_items_affected,
                    COUNT(DISTINCT batch_id) as unique_batches_affected
                FROM stock_movements
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Stock movement statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting stock movement statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get movement summary by type
     * @param {Object} options - Date range options
     * @returns {Promise<Array>} Summary by movement type
     */
    async getSummaryByType(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND performed_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    movement_type,
                    COUNT(*) as movement_count,
                    SUM(quantity) as net_quantity,
                    SUM(total_value) as total_value,
                    MIN(performed_at) as first_occurrence,
                    MAX(performed_at) as last_occurrence
                FROM stock_movements
                WHERE is_deleted = false
                ${dateCondition}
                GROUP BY movement_type
                ORDER BY movement_type
            `;

            const result = await db.query(query, values);

            logger.debug('Stock movement summary by type retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting stock movement summary by type', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get daily movement summary
     * @param {number} days - Number of days
     * @returns {Promise<Array>} Daily summary
     */
    async getDailySummary(days = 30) {
        try {
            const query = `
                SELECT 
                    DATE(performed_at) as date,
                    COUNT(*) as movement_count,
                    SUM(CASE WHEN movement_type = 'purchase' THEN quantity ELSE 0 END) as purchased,
                    SUM(CASE WHEN movement_type = 'sale' THEN -quantity ELSE 0 END) as sold,
                    SUM(CASE WHEN movement_type = 'return' THEN quantity ELSE 0 END) as returned,
                    SUM(CASE WHEN movement_type IN ('expiry_write_off', 'damage_write_off') THEN -quantity ELSE 0 END) as written_off
                FROM stock_movements
                WHERE performed_at > NOW() - ($1 || ' days')::INTERVAL
                    AND is_deleted = false
                GROUP BY DATE(performed_at)
                ORDER BY date DESC
            `;

            const result = await db.query(query, [days]);

            logger.debug('Daily stock movement summary retrieved', {
                days,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting daily stock movement summary', {
                error: error.message,
                days
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Clean up old stock movement records (archive)
     * @param {number} daysToKeep - Days to keep records
     * @returns {Promise<number>} Number of records archived
     */
    async cleanup(daysToKeep = 365) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            // Archive old records to stock_movements_archive table
            const archiveQuery = `
                INSERT INTO stock_movements_archive
                SELECT * FROM stock_movements
                WHERE performed_at < NOW() - ($1 || ' days')::INTERVAL
                    AND is_deleted = false
                ON CONFLICT (id) DO NOTHING
            `;
            await client.query(archiveQuery, [daysToKeep]);

            const deleteQuery = `
                UPDATE stock_movements 
                SET is_deleted = true,
                    deleted_at = NOW()
                WHERE performed_at < NOW() - ($1 || ' days')::INTERVAL
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(deleteQuery, [daysToKeep]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Old stock movements archived', {
                    count: result.rowCount,
                    daysToKeep
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cleaning up stock movements', {
                error: error.message,
                daysToKeep
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    }
};

module.exports = StockMovement;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */