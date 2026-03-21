/**
 * ======================================================================
 * FILE: backend/src/services/billing/taxDiscountService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing tax & discount service - Handles business logic for tax rates and discounts.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-34] Discount cannot exceed maximum allowed
 * - [BR-35] Tax calculation follows government rules
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const taxDiscountService = {
    // ============================================
    // TAX RATE MANAGEMENT
    // ============================================

    /**
     * Get all tax rates
     */
    async getAllTaxRates(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, type, is_active, include_expired = false } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT t.*,
                       CASE 
                           WHEN t.effective_to IS NOT NULL AND t.effective_to < NOW() THEN 'expired'
                           WHEN t.effective_from > NOW() THEN 'future'
                           WHEN t.is_active = false THEN 'inactive'
                           ELSE 'active'
                       END as status
                FROM tax_rates t
                WHERE t.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (type) {
                query += ` AND t.type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            if (is_active !== undefined) {
                if (is_active) {
                    query += ` AND t.is_active = true AND (t.effective_to IS NULL OR t.effective_to >= NOW()) AND t.effective_from <= NOW()`;
                } else {
                    query += ` AND t.is_active = false`;
                }
            }

            if (!include_expired) {
                query += ` AND (t.effective_to IS NULL OR t.effective_to >= NOW())`;
            }

            query += ` ORDER BY t.type, t.rate DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_active = true AND (effective_to IS NULL OR effective_to >= NOW()) AND effective_from <= NOW()) as active,
                    COUNT(*) FILTER (WHERE type = 'cgst') as cgst_count,
                    COUNT(*) FILTER (WHERE type = 'sgst') as sgst_count,
                    COUNT(*) FILTER (WHERE type = 'igst') as igst_count,
                    COUNT(*) FILTER (WHERE type = 'cess') as cess_count
                FROM tax_rates
                WHERE is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getAllTaxRates', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get tax rate by ID
     */
    async getTaxRateById(staffId, taxRateId) {
        try {
            const query = `
                SELECT t.*
                FROM tax_rates t
                WHERE t.id = $1 AND t.is_deleted = false
            `;

            const result = await db.query(query, [taxRateId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getTaxRateById', { error: error.message, staffId, taxRateId });
            throw error;
        }
    },

    /**
     * Get tax rate by name
     */
    async getTaxRateByName(staffId, name) {
        try {
            const result = await db.query(`
                SELECT t.*
                FROM tax_rates t
                WHERE t.name = $1 AND t.is_deleted = false
            `, [name]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getTaxRateByName', { error: error.message, staffId, name });
            throw error;
        }
    },

    /**
     * Add tax rate
     */
    async addTaxRate(staffId, taxData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO tax_rates (
                    id, name, rate, type, description,
                    effective_from, effective_to, is_active,
                    created_by, ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                taxData.name,
                taxData.rate,
                taxData.type,
                taxData.description,
                taxData.effective_from,
                taxData.effective_to,
                taxData.is_active,
                taxData.created_by,
                taxData.ip_address,
                taxData.user_agent
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
     * Update tax rate
     */
    async updateTaxRate(staffId, taxRateId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['name', 'rate', 'type', 'description', 'effective_from', 'effective_to', 'is_active'];

            for (const [key, value] of Object.entries(updateData)) {
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
            setClause.push(`updated_by = $${paramIndex}`);
            values.push(updateData.updated_by);
            paramIndex++;
            values.push(taxRateId);

            const query = `
                UPDATE tax_rates 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Tax rate not found');
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
     * Delete tax rate
     */
    async deleteTaxRate(staffId, taxRateId, deleteData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tax_rates 
                SET is_deleted = true,
                    deleted_at = $1,
                    deleted_by = $2,
                    deletion_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 AND is_deleted = false
                RETURNING id
            `;

            const values = [
                deleteData.deleted_at,
                deleteData.deleted_by,
                deleteData.reason,
                taxRateId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Tax rate not found');
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
     * Check if tax rate is in use
     */
    async isTaxRateInUse(staffId, taxRateId) {
        try {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM invoices
                WHERE tax_rate_id = $1 AND is_deleted = false
            `, [taxRateId]);

            return parseInt(result.rows[0].count) > 0;
        } catch (error) {
            logger.error('Error in isTaxRateInUse', { error: error.message, staffId, taxRateId });
            throw error;
        }
    },

    // ============================================
    // DISCOUNT MANAGEMENT
    // ============================================

    /**
     * Get all discounts
     */
    async getAllDiscounts(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, type, is_active, applicable_to, include_expired = false } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT d.*,
                       CASE 
                           WHEN d.valid_to IS NOT NULL AND d.valid_to < NOW() THEN 'expired'
                           WHEN d.valid_from > NOW() THEN 'future'
                           WHEN d.is_active = false THEN 'inactive'
                           ELSE 'active'
                       END as status
                FROM discounts d
                WHERE d.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (type) {
                query += ` AND d.type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            if (is_active !== undefined) {
                if (is_active) {
                    query += ` AND d.is_active = true AND (d.valid_to IS NULL OR d.valid_to >= NOW()) AND d.valid_from <= NOW()`;
                } else {
                    query += ` AND d.is_active = false`;
                }
            }

            if (applicable_to) {
                query += ` AND d.applicable_to = $${paramIndex}`;
                values.push(applicable_to);
                paramIndex++;
            }

            if (!include_expired) {
                query += ` AND (d.valid_to IS NULL OR d.valid_to >= NOW())`;
            }

            query += ` ORDER BY d.type, d.value DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_active = true AND (valid_to IS NULL OR valid_to >= NOW()) AND valid_from <= NOW()) as active,
                    COUNT(*) FILTER (WHERE type = 'percentage') as percentage_count,
                    COUNT(*) FILTER (WHERE type = 'fixed') as fixed_count,
                    COUNT(*) FILTER (WHERE applicable_to = 'all') as all_count,
                    COUNT(*) FILTER (WHERE applicable_to = 'services') as services_count,
                    COUNT(*) FILTER (WHERE applicable_to = 'medicines') as medicines_count,
                    COUNT(*) FILTER (WHERE applicable_to = 'consultation') as consultation_count
                FROM discounts
                WHERE is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getAllDiscounts', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get discount by ID
     */
    async getDiscountById(staffId, discountId) {
        try {
            const query = `
                SELECT d.*
                FROM discounts d
                WHERE d.id = $1 AND d.is_deleted = false
            `;

            const result = await db.query(query, [discountId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getDiscountById', { error: error.message, staffId, discountId });
            throw error;
        }
    },

    /**
     * Get discount by name
     */
    async getDiscountByName(staffId, name) {
        try {
            const result = await db.query(`
                SELECT d.*
                FROM discounts d
                WHERE d.name = $1 AND d.is_deleted = false
            `, [name]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getDiscountByName', { error: error.message, staffId, name });
            throw error;
        }
    },

    /**
     * Add discount
     */
    async addDiscount(staffId, discountData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO discounts (
                    id, name, type, value, max_discount, minimum_purchase,
                    applicable_to, valid_from, valid_to, description, is_active,
                    created_by, ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                discountData.name,
                discountData.type,
                discountData.value,
                discountData.max_discount,
                discountData.minimum_purchase,
                discountData.applicable_to,
                discountData.valid_from,
                discountData.valid_to,
                discountData.description,
                discountData.is_active,
                discountData.created_by,
                discountData.ip_address,
                discountData.user_agent
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
     * Update discount
     */
    async updateDiscount(staffId, discountId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['name', 'type', 'value', 'max_discount', 'minimum_purchase', 
                                   'applicable_to', 'valid_from', 'valid_to', 'description', 'is_active'];

            for (const [key, value] of Object.entries(updateData)) {
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
            setClause.push(`updated_by = $${paramIndex}`);
            values.push(updateData.updated_by);
            paramIndex++;
            values.push(discountId);

            const query = `
                UPDATE discounts 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Discount not found');
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
     * Delete discount
     */
    async deleteDiscount(staffId, discountId, deleteData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE discounts 
                SET is_deleted = true,
                    deleted_at = $1,
                    deleted_by = $2,
                    deletion_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 AND is_deleted = false
                RETURNING id
            `;

            const values = [
                deleteData.deleted_at,
                deleteData.deleted_by,
                deleteData.reason,
                discountId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Discount not found');
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
     * Check if discount is in use
     */
    async isDiscountInUse(staffId, discountId) {
        try {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM invoices
                WHERE discount_id = $1 AND is_deleted = false
            `, [discountId]);

            return parseInt(result.rows[0].count) > 0;
        } catch (error) {
            logger.error('Error in isDiscountInUse', { error: error.message, staffId, discountId });
            throw error;
        }
    },

    /**
     * Calculate discount amount [BR-34]
     */
    async calculateDiscount(staffId, discountId, subtotal) {
        try {
            const discount = await this.getDiscountById(staffId, discountId);
            
            if (!discount) {
                return { amount: 0, applied: false, reason: 'Discount not found' };
            }

            // Check if discount is active
            if (!discount.is_active) {
                return { amount: 0, applied: false, reason: 'Discount is inactive' };
            }

            // Check validity period
            const now = new Date();
            if (discount.valid_from && new Date(discount.valid_from) > now) {
                return { amount: 0, applied: false, reason: 'Discount not yet valid' };
            }
            if (discount.valid_to && new Date(discount.valid_to) < now) {
                return { amount: 0, applied: false, reason: 'Discount has expired' };
            }

            // Check minimum purchase
            if (discount.minimum_purchase && subtotal < discount.minimum_purchase) {
                return { 
                    amount: 0, 
                    applied: false, 
                    reason: `Minimum purchase of ${discount.minimum_purchase} required`,
                    required: discount.minimum_purchase,
                    current: subtotal
                };
            }

            // Calculate discount amount
            let discountAmount = 0;
            if (discount.type === 'percentage') {
                discountAmount = subtotal * (discount.value / 100);
                // Apply max discount limit
                if (discount.max_discount && discountAmount > discount.max_discount) {
                    discountAmount = discount.max_discount;
                }
            } else if (discount.type === 'fixed') {
                discountAmount = discount.value;
            }

            return {
                amount: discountAmount,
                applied: true,
                original_value: discount.value,
                type: discount.type,
                max_discount: discount.max_discount
            };
        } catch (error) {
            logger.error('Error in calculateDiscount', { error: error.message, staffId, discountId });
            throw error;
        }
    }
};

module.exports = taxDiscountService;