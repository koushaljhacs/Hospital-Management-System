/**
 * ======================================================================
 * FILE: backend/src/models/lab/LabReagent.js
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
 * LabReagent model for database operations.
 * Handles laboratory reagents and consumables inventory management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: lab_reagents
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - reagent_code: string (unique)
 * - reagent_name: string
 * - category: string
 * - manufacturer: string
 * - lot_number: string
 * - batch_number: string
 * - expiry_date: date
 * - manufacturing_date: date
 * - received_date: date
 * - quantity: integer
 * - unit: string
 * - unit_price: decimal
 * - storage_conditions: text
 * - temperature_min: decimal
 * - temperature_max: decimal
 * - location: string
 * - rack_number: string
 * - shelf_number: string
 * - supplier_id: UUID
 * - purchase_order_id: UUID
 * - minimum_stock: integer
 * - reorder_level: integer
 * - status: enum (in_stock, low_stock, out_of_stock, expired, discontinued)
 * - is_active: boolean
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

const LabReagent = {
    /**
     * Table name
     */
    tableName: 'lab_reagents',

    /**
     * Valid status values
     */
    validStatuses: ['in_stock', 'low_stock', 'out_of_stock', 'expired', 'discontinued'],

    /**
     * Generate reagent code
     * @returns {Promise<string>} Generated reagent code
     */
    async generateReagentCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM lab_reagents WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');
            return `RGT-${sequence}`;
        } catch (error) {
            logger.error('Error generating reagent code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find reagent by ID
     * @param {string} id - Reagent UUID
     * @returns {Promise<Object|null>} Reagent object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    lr.id, lr.reagent_code, lr.reagent_name, lr.category,
                    lr.manufacturer, lr.lot_number, lr.batch_number,
                    lr.expiry_date, lr.manufacturing_date, lr.received_date,
                    lr.quantity, lr.unit, lr.unit_price,
                    lr.storage_conditions, lr.temperature_min, lr.temperature_max,
                    lr.location, lr.rack_number, lr.shelf_number,
                    lr.supplier_id, lr.purchase_order_id,
                    lr.minimum_stock, lr.reorder_level,
                    lr.status, lr.is_active, lr.notes,
                    lr.created_at, lr.updated_at,
                    s.name as supplier_name,
                    po.po_number as purchase_order_number,
                    u.username as created_by_name
                FROM lab_reagents lr
                LEFT JOIN suppliers s ON lr.supplier_id = s.id
                LEFT JOIN purchase_orders po ON lr.purchase_order_id = po.id
                LEFT JOIN users u ON lr.created_by = u.id
                WHERE lr.id = $1 AND lr.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab reagent found by ID', { reagentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab reagent by ID', {
                error: error.message,
                reagentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find reagent by code
     * @param {string} reagentCode - Reagent code
     * @returns {Promise<Object|null>} Reagent object or null
     */
    async findByCode(reagentCode) {
        try {
            const query = `
                SELECT id, reagent_code, reagent_name, status, quantity
                FROM lab_reagents
                WHERE reagent_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [reagentCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab reagent found by code', { reagentCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab reagent by code', {
                error: error.message,
                reagentCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find reagent by lot number
     * @param {string} lotNumber - Lot number
     * @returns {Promise<Array>} List of reagents
     */
    async findByLotNumber(lotNumber) {
        try {
            const query = `
                SELECT 
                    id, reagent_code, reagent_name, lot_number,
                    expiry_date, quantity, status
                FROM lab_reagents
                WHERE lot_number = $1 AND is_deleted = false
                ORDER BY expiry_date ASC
            `;

            const result = await db.query(query, [lotNumber]);

            logger.debug('Lab reagents found by lot number', {
                lotNumber,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding lab reagents by lot number', {
                error: error.message,
                lotNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all reagents with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of reagents
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(filters.status);
            }
            if (filters.category) {
                conditions.push(`category = $${paramIndex++}`);
                values.push(filters.category);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }
            if (filters.low_stock !== undefined && filters.low_stock === true) {
                conditions.push(`quantity <= reorder_level AND quantity > 0`);
            }
            if (filters.expiring_soon !== undefined && filters.expiring_soon === true) {
                conditions.push(`expiry_date <= NOW() + INTERVAL '90 days' AND expiry_date > NOW()`);
            }
            if (filters.search) {
                conditions.push(`(reagent_name ILIKE $${paramIndex++} OR reagent_code ILIKE $${paramIndex++} OR lot_number ILIKE $${paramIndex++})`);
                const searchTerm = `%${filters.search}%`;
                values.push(searchTerm, searchTerm, searchTerm);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, reagent_code, reagent_name, category,
                    lot_number, expiry_date, quantity, unit,
                    status, is_active, created_at
                FROM lab_reagents
                ${whereClause}
                ORDER BY reagent_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all lab reagents', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all lab reagents', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get low stock reagents
     * @returns {Promise<Array>} List of low stock reagents
     */
    async getLowStock() {
        try {
            const query = `
                SELECT 
                    id, reagent_code, reagent_name,
                    quantity, minimum_stock, reorder_level,
                    unit, location, expiry_date,
                    supplier_id, s.name as supplier_name
                FROM lab_reagents lr
                LEFT JOIN suppliers s ON lr.supplier_id = s.id
                WHERE lr.quantity <= lr.reorder_level
                    AND lr.quantity > 0
                    AND lr.status != 'discontinued'
                    AND lr.is_deleted = false
                ORDER BY (lr.quantity::float / NULLIF(lr.reorder_level, 0)) ASC
            `;

            const result = await db.query(query);

            logger.debug('Low stock reagents retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting low stock reagents', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expiring reagents
     * @param {number} daysThreshold - Days to look ahead
     * @returns {Promise<Array>} List of expiring reagents
     */
    async getExpiring(daysThreshold = 90) {
        try {
            const query = `
                SELECT 
                    id, reagent_code, reagent_name,
                    lot_number, expiry_date, quantity, unit,
                    storage_conditions, location,
                    EXTRACT(DAY FROM (expiry_date - CURRENT_DATE)) as days_until_expiry
                FROM lab_reagents
                WHERE expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
                    AND expiry_date > CURRENT_DATE
                    AND quantity > 0
                    AND status != 'expired'
                    AND is_deleted = false
                ORDER BY expiry_date ASC
            `;

            const result = await db.query(query, [daysThreshold]);

            logger.debug('Expiring reagents retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiring reagents', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expired reagents
     * @returns {Promise<Array>} List of expired reagents
     */
    async getExpired() {
        try {
            const query = `
                SELECT 
                    id, reagent_code, reagent_name,
                    lot_number, expiry_date, quantity, unit,
                    location
                FROM lab_reagents
                WHERE expiry_date <= CURRENT_DATE
                    AND quantity > 0
                    AND status != 'expired'
                    AND is_deleted = false
                ORDER BY expiry_date ASC
            `;

            const result = await db.query(query);

            logger.debug('Expired reagents retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expired reagents', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new lab reagent
     * @param {Object} reagentData - Reagent data
     * @returns {Promise<Object>} Created reagent
     */
    async create(reagentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (reagentData.status && !this.validStatuses.includes(reagentData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const reagentCode = reagentData.reagent_code || await this.generateReagentCode();

            // Determine status based on quantity and expiry
            let status = reagentData.status;
            if (!status) {
                if (reagentData.expiry_date && new Date(reagentData.expiry_date) <= new Date()) {
                    status = 'expired';
                } else if (reagentData.quantity <= 0) {
                    status = 'out_of_stock';
                } else if (reagentData.quantity <= (reagentData.reorder_level || 0)) {
                    status = 'low_stock';
                } else {
                    status = 'in_stock';
                }
            }

            const query = `
                INSERT INTO lab_reagents (
                    id, reagent_code, reagent_name, category,
                    manufacturer, lot_number, batch_number,
                    expiry_date, manufacturing_date, received_date,
                    quantity, unit, unit_price,
                    storage_conditions, temperature_min, temperature_max,
                    location, rack_number, shelf_number,
                    supplier_id, purchase_order_id,
                    minimum_stock, reorder_level,
                    status, is_active, notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    $10, $11, $12,
                    $13, $14, $15,
                    $16, $17, $18,
                    $19, $20,
                    $21, $22,
                    $23, COALESCE($24, true), $25,
                    $26, NOW(), NOW()
                )
                RETURNING 
                    id, reagent_code, reagent_name,
                    lot_number, expiry_date, quantity,
                    status, created_at
            `;

            const values = [
                reagentCode,
                reagentData.reagent_name,
                reagentData.category || null,
                reagentData.manufacturer || null,
                reagentData.lot_number || null,
                reagentData.batch_number || null,
                reagentData.expiry_date || null,
                reagentData.manufacturing_date || null,
                reagentData.received_date || null,
                reagentData.quantity,
                reagentData.unit || 'ml',
                reagentData.unit_price || null,
                reagentData.storage_conditions || null,
                reagentData.temperature_min || null,
                reagentData.temperature_max || null,
                reagentData.location || null,
                reagentData.rack_number || null,
                reagentData.shelf_number || null,
                reagentData.supplier_id || null,
                reagentData.purchase_order_id || null,
                reagentData.minimum_stock || 0,
                reagentData.reorder_level || 0,
                status,
                reagentData.is_active,
                reagentData.notes || null,
                reagentData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Lab reagent created successfully', {
                reagentId: result.rows[0].id,
                reagentCode,
                reagentName: reagentData.reagent_name,
                quantity: reagentData.quantity,
                status
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating lab reagent', {
                error: error.message,
                reagentName: reagentData.reagent_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update lab reagent
     * @param {string} id - Reagent ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated reagent
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'reagent_name', 'category', 'manufacturer',
                'lot_number', 'batch_number', 'expiry_date',
                'manufacturing_date', 'received_date',
                'quantity', 'unit', 'unit_price',
                'storage_conditions', 'temperature_min', 'temperature_max',
                'location', 'rack_number', 'shelf_number',
                'supplier_id', 'purchase_order_id',
                'minimum_stock', 'reorder_level',
                'status', 'is_active', 'notes'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Auto-update status based on quantity and expiry if not explicitly set
            let autoStatus = false;
            let newStatus = updates.status;
            if (!newStatus && (updates.quantity !== undefined || updates.expiry_date !== undefined || updates.reorder_level !== undefined)) {
                autoStatus = true;
                const current = await this.findById(id);
                const quantity = updates.quantity !== undefined ? updates.quantity : current?.quantity;
                const expiryDate = updates.expiry_date !== undefined ? updates.expiry_date : current?.expiry_date;
                const reorderLevel = updates.reorder_level !== undefined ? updates.reorder_level : current?.reorder_level;
                if (expiryDate && new Date(expiryDate) <= new Date()) {
                    newStatus = 'expired';
                } else if (quantity <= 0) {
                    newStatus = 'out_of_stock';
                } else if (quantity <= (reorderLevel || 0)) {
                    newStatus = 'low_stock';
                } else {
                    newStatus = 'in_stock';
                }
            }

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (autoStatus && newStatus) {
                setClause.push(`status = $${paramIndex++}`);
                values.push(newStatus);
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
                UPDATE lab_reagents 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, reagent_code, reagent_name,
                    quantity, status, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Lab reagent not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab reagent updated', {
                reagentId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating lab reagent', {
                error: error.message,
                reagentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Adjust reagent quantity
     * @param {string} id - Reagent ID
     * @param {number} quantityChange - Change in quantity (positive for addition, negative for removal)
     * @param {string} reason - Reason for adjustment
     * @param {string} adjustedBy - User who adjusted
     * @returns {Promise<Object>} Updated reagent
     */
    async adjustQuantity(id, quantityChange, reason, adjustedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const reagent = await this.findById(id);
            if (!reagent) {
                throw new Error('Lab reagent not found');
            }

            const newQuantity = reagent.quantity + quantityChange;
            if (newQuantity < 0) {
                throw new Error('Insufficient stock');
            }

            // Update status based on new quantity
            let newStatus = reagent.status;
            if (reagent.expiry_date && new Date(reagent.expiry_date) <= new Date()) {
                newStatus = 'expired';
            } else if (newQuantity <= 0) {
                newStatus = 'out_of_stock';
            } else if (newQuantity <= (reagent.reorder_level || 0)) {
                newStatus = 'low_stock';
            } else {
                newStatus = 'in_stock';
            }

            const query = `
                UPDATE lab_reagents 
                SET quantity = $1,
                    status = $2,
                    updated_at = NOW(),
                    updated_by = $3,
                    notes = COALESCE(CONCAT(notes, E'\\n', $4), $4)
                WHERE id = $5 AND is_deleted = false
                RETURNING 
                    id, reagent_code, reagent_name,
                    quantity, status
            `;

            const adjustmentNote = `${reason} (${quantityChange > 0 ? '+' : ''}${quantityChange}) by ${adjustedBy}`;

            const result = await client.query(query, [newQuantity, newStatus, adjustedBy, adjustmentNote, id]);

            if (result.rows.length === 0) {
                throw new Error('Lab reagent not found');
            }

            await db.commitTransaction(client);

            logger.info('Reagent quantity adjusted', {
                reagentId: id,
                quantityChange,
                newQuantity,
                newStatus,
                reason
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error adjusting reagent quantity', {
                error: error.message,
                reagentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Mark reagent as expired
     * @param {string} id - Reagent ID
     * @param {string} markedBy - User who marked
     * @returns {Promise<Object>} Updated reagent
     */
    async markExpired(id, markedBy) {
        return this.update(id, {
            status: 'expired',
            is_active: false,
            updated_by: markedBy,
            notes: `Marked as expired on ${new Date().toISOString()}`
        });
    },

    /**
     * Get reagent statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_reagents,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    COUNT(*) FILTER (WHERE status = 'in_stock') as in_stock,
                    COUNT(*) FILTER (WHERE status = 'low_stock') as low_stock,
                    COUNT(*) FILTER (WHERE status = 'out_of_stock') as out_of_stock,
                    COUNT(*) FILTER (WHERE status = 'expired') as expired,
                    COUNT(*) FILTER (WHERE status = 'discontinued') as discontinued,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(DISTINCT category) as categories_used
                FROM lab_reagents
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Lab reagent statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting lab reagent statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search reagents
     * @param {string} searchTerm - Search term (name, code, lot, manufacturer)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of reagents
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, reagent_code, reagent_name, category,
                    lot_number, expiry_date, quantity, unit,
                    status, is_active
                FROM lab_reagents
                WHERE (reagent_name ILIKE $1 
                    OR reagent_code ILIKE $1
                    OR lot_number ILIKE $1
                    OR manufacturer ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN reagent_name ILIKE $2 THEN 1
                        WHEN reagent_code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    reagent_name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Lab reagent search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching lab reagents', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Update expired reagents status (run via cron)
     * @returns {Promise<number>} Number of reagents updated
     */
    async updateExpiredStatus() {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE lab_reagents 
                SET status = 'expired',
                    is_active = false,
                    updated_at = NOW()
                WHERE expiry_date <= CURRENT_DATE
                    AND status != 'expired'
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Expired reagents status updated', {
                    count: result.rowCount
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating expired reagents status', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Soft delete lab reagent
     * @param {string} id - Reagent ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE lab_reagents 
                SET is_deleted = true,
                    is_active = false,
                    status = 'discontinued',
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Lab reagent not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab reagent soft deleted', {
                reagentId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting lab reagent', {
                error: error.message,
                reagentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = LabReagent;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */