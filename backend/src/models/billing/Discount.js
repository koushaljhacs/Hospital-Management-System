/**
 * ======================================================================
 * FILE: backend/src/models/billing/Discount.js
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
 * Discount model for database operations.
 * Handles discount configuration for billing and invoices.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: discounts
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - discount_name: string
 * - discount_code: string (unique)
 * - discount_type: enum (percentage, fixed)
 * - discount_value: decimal
 * - min_invoice_amount: decimal
 * - max_discount_amount: decimal
 * - applies_to: string[]
 * - applicable_roles: uuid[]
 * - applicable_users: uuid[]
 * - is_active: boolean
 * - valid_from: date
 * - valid_to: date
 * - usage_limit: integer
 * - usage_count: integer
 * - description: text
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

const Discount = {
    /**
     * Table name
     */
    tableName: 'discounts',

    /**
     * Valid discount types
     */
    validDiscountTypes: ['percentage', 'fixed'],

    /**
     * Find discount by ID
     * @param {string} id - Discount UUID
     * @returns {Promise<Object|null>} Discount object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    d.id, d.discount_name, d.discount_code, d.discount_type,
                    d.discount_value, d.min_invoice_amount, d.max_discount_amount,
                    d.applies_to, d.applicable_roles, d.applicable_users,
                    d.is_active, d.valid_from, d.valid_to,
                    d.usage_limit, d.usage_count, d.description,
                    d.created_at, d.updated_at,
                    u.username as created_by_name
                FROM discounts d
                LEFT JOIN users u ON d.created_by = u.id
                WHERE d.id = $1 AND d.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Discount found by ID', { discountId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding discount by ID', {
                error: error.message,
                discountId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find discount by code
     * @param {string} discountCode - Discount code
     * @returns {Promise<Object|null>} Discount object or null
     */
    async findByCode(discountCode) {
        try {
            const query = `
                SELECT 
                    id, discount_name, discount_code, discount_type,
                    discount_value, min_invoice_amount, max_discount_amount,
                    is_active, valid_from, valid_to,
                    usage_limit, usage_count
                FROM discounts
                WHERE discount_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [discountCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Discount found by code', { discountCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding discount by code', {
                error: error.message,
                discountCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all discounts with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of discounts
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.discount_type) {
                conditions.push(`discount_type = $${paramIndex++}`);
                values.push(filters.discount_type);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }
            if (filters.valid_on) {
                conditions.push(`valid_from <= $${paramIndex++} AND (valid_to IS NULL OR valid_to >= $${paramIndex++})`);
                values.push(filters.valid_on, filters.valid_on);
            }
            if (filters.search) {
                conditions.push(`(discount_name ILIKE $${paramIndex++} OR discount_code ILIKE $${paramIndex++})`);
                const searchTerm = `%${filters.search}%`;
                values.push(searchTerm, searchTerm);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, discount_name, discount_code, discount_type,
                    discount_value, min_invoice_amount, max_discount_amount,
                    is_active, valid_from, valid_to,
                    usage_limit, usage_count, created_at
                FROM discounts
                ${whereClause}
                ORDER BY discount_value ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all discounts', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all discounts', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active discounts for current date
     * @returns {Promise<Array>} List of active discounts
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, discount_name, discount_code, discount_type,
                    discount_value, min_invoice_amount, max_discount_amount,
                    applies_to, usage_limit, usage_count
                FROM discounts
                WHERE is_active = true
                    AND valid_from <= CURRENT_DATE
                    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
                    AND (usage_limit IS NULL OR usage_count < usage_limit)
                    AND is_deleted = false
                ORDER BY discount_value ASC
            `;

            const result = await db.query(query);

            logger.debug('Active discounts retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active discounts', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Validate discount for user and amount
     * @param {string} discountCode - Discount code
     * @param {number} amount - Invoice amount
     * @param {string} userId - User ID applying discount
     * @param {string} serviceType - Service type (optional)
     * @returns {Promise<Object>} Validation result
     */
    async validate(discountCode, amount, userId, serviceType = null) {
        try {
            const discount = await this.findByCode(discountCode);
            if (!discount) {
                return { valid: false, reason: 'Invalid discount code' };
            }

            if (!discount.is_active) {
                return { valid: false, reason: 'Discount is inactive' };
            }

            const today = new Date().toISOString().split('T')[0];
            if (discount.valid_from && discount.valid_from > today) {
                return { valid: false, reason: 'Discount not yet valid' };
            }
            if (discount.valid_to && discount.valid_to < today) {
                return { valid: false, reason: 'Discount has expired' };
            }

            if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
                return { valid: false, reason: 'Discount usage limit exceeded' };
            }

            if (discount.min_invoice_amount && amount < discount.min_invoice_amount) {
                return { 
                    valid: false, 
                    reason: `Minimum invoice amount of ${discount.min_invoice_amount} required` 
                };
            }

            if (discount.applies_to && discount.applies_to.length > 0 && serviceType) {
                if (!discount.applies_to.includes(serviceType) && !discount.applies_to.includes('all')) {
                    return { valid: false, reason: 'Discount not applicable for this service' };
                }
            }

            if (discount.applicable_users && discount.applicable_users.length > 0) {
                if (!discount.applicable_users.includes(userId)) {
                    return { valid: false, reason: 'Discount not applicable for this user' };
                }
            }

            let discountAmount;
            if (discount.discount_type === 'percentage') {
                discountAmount = (amount * discount.discount_value) / 100;
                if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
                    discountAmount = discount.max_discount_amount;
                }
            } else {
                discountAmount = discount.discount_value;
                if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
                    discountAmount = discount.max_discount_amount;
                }
            }

            return {
                valid: true,
                discount: discount,
                discountAmount: discountAmount,
                finalAmount: amount - discountAmount
            };
        } catch (error) {
            logger.error('Error validating discount', {
                error: error.message,
                discountCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Increment discount usage count
     * @param {string} id - Discount ID
     * @returns {Promise<Object>} Updated discount
     */
    async incrementUsage(id) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE discounts 
                SET usage_count = usage_count + 1,
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING 
                    id, discount_name, discount_code,
                    usage_count, usage_limit
            `;

            const result = await client.query(query, [id]);

            if (result.rows.length === 0) {
                throw new Error('Discount not found');
            }

            await db.commitTransaction(client);

            logger.debug('Discount usage incremented', {
                discountId: id,
                usageCount: result.rows[0].usage_count
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error incrementing discount usage', {
                error: error.message,
                discountId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Create new discount
     * @param {Object} discountData - Discount data
     * @returns {Promise<Object>} Created discount
     */
    async create(discountData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (discountData.discount_type && !this.validDiscountTypes.includes(discountData.discount_type)) {
                throw new Error(`Invalid discount type. Must be one of: ${this.validDiscountTypes.join(', ')}`);
            }

            const existingCode = await this.findByCode(discountData.discount_code);
            if (existingCode) {
                throw new Error('Discount code already exists');
            }

            const query = `
                INSERT INTO discounts (
                    id, discount_name, discount_code, discount_type,
                    discount_value, min_invoice_amount, max_discount_amount,
                    applies_to, applicable_roles, applicable_users,
                    is_active, valid_from, valid_to,
                    usage_limit, usage_count, description,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    COALESCE($10, true), $11, $12,
                    $13, 0, $14,
                    $15, NOW(), NOW()
                )
                RETURNING 
                    id, discount_name, discount_code, discount_type,
                    discount_value, is_active, created_at
            `;

            const values = [
                discountData.discount_name,
                discountData.discount_code,
                discountData.discount_type,
                discountData.discount_value,
                discountData.min_invoice_amount || null,
                discountData.max_discount_amount || null,
                discountData.applies_to || null,
                discountData.applicable_roles || null,
                discountData.applicable_users || null,
                discountData.is_active,
                discountData.valid_from || null,
                discountData.valid_to || null,
                discountData.usage_limit || null,
                discountData.description || null,
                discountData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Discount created', {
                discountId: result.rows[0].id,
                discountName: discountData.discount_name,
                discountCode: discountData.discount_code,
                discountValue: discountData.discount_value
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating discount', {
                error: error.message,
                discountCode: discountData.discount_code
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update discount
     * @param {string} id - Discount ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated discount
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'discount_name', 'discount_type', 'discount_value',
                'min_invoice_amount', 'max_discount_amount',
                'applies_to', 'applicable_roles', 'applicable_users',
                'is_active', 'valid_from', 'valid_to',
                'usage_limit', 'description'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            if (updates.discount_code) {
                const existing = await this.findByCode(updates.discount_code);
                if (existing && existing.id !== id) {
                    throw new Error('Discount code already exists');
                }
                allowedFields.push('discount_code');
            }

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
                UPDATE discounts 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, discount_name, discount_code,
                    discount_value, is_active, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Discount not found');
            }

            await db.commitTransaction(client);

            logger.info('Discount updated', {
                discountId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating discount', {
                error: error.message,
                discountId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get discount statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_discounts,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE discount_type = 'percentage') as percentage_discounts,
                    COUNT(*) FILTER (WHERE discount_type = 'fixed') as fixed_discounts,
                    SUM(usage_count) as total_usage,
                    AVG(discount_value)::numeric(10,2) as avg_discount_value,
                    MIN(discount_value)::numeric(10,2) as min_discount_value,
                    MAX(discount_value)::numeric(10,2) as max_discount_value
                FROM discounts
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Discount statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting discount statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get most used discounts
     * @param {number} limit - Number of discounts
     * @returns {Promise<Array>} List of most used discounts
     */
    async getMostUsed(limit = 10) {
        try {
            const query = `
                SELECT 
                    id, discount_name, discount_code, discount_type,
                    discount_value, usage_count, is_active
                FROM discounts
                WHERE is_deleted = false
                ORDER BY usage_count DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);

            logger.debug('Most used discounts retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting most used discounts', {
                error: error.message,
                limit
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete discount
     * @param {string} id - Discount ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE discounts 
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
                throw new Error('Discount not found');
            }

            await db.commitTransaction(client);

            logger.info('Discount soft deleted', {
                discountId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting discount', {
                error: error.message,
                discountId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Discount;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */