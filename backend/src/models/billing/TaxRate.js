/**
 * ======================================================================
 * FILE: backend/src/models/billing/TaxRate.js
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
 * TaxRate model for database operations.
 * Handles tax rate configuration for billing and invoices.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: tax_rates
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - tax_name: string
 * - tax_code: string (unique)
 * - percentage: decimal
 * - tax_type: enum (gst, cgst, sgst, igst, vat)
 * - applies_to: string[]
 * - is_active: boolean
 * - effective_from: date
 * - effective_to: date
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

const TaxRate = {
    /**
     * Table name
     */
    tableName: 'tax_rates',

    /**
     * Valid tax types
     */
    validTaxTypes: ['gst', 'cgst', 'sgst', 'igst', 'vat'],

    /**
     * Find tax rate by ID
     * @param {string} id - Tax rate UUID
     * @returns {Promise<Object|null>} Tax rate object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    tr.id, tr.tax_name, tr.tax_code, tr.percentage,
                    tr.tax_type, tr.applies_to, tr.is_active,
                    tr.effective_from, tr.effective_to, tr.description,
                    tr.created_at, tr.updated_at,
                    u.username as created_by_name
                FROM tax_rates tr
                LEFT JOIN users u ON tr.created_by = u.id
                WHERE tr.id = $1 AND tr.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Tax rate found by ID', { taxId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding tax rate by ID', {
                error: error.message,
                taxId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find tax rate by code
     * @param {string} taxCode - Tax code
     * @returns {Promise<Object|null>} Tax rate object or null
     */
    async findByCode(taxCode) {
        try {
            const query = `
                SELECT id, tax_name, tax_code, percentage, tax_type, is_active
                FROM tax_rates
                WHERE tax_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [taxCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Tax rate found by code', { taxCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding tax rate by code', {
                error: error.message,
                taxCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all tax rates with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of tax rates
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.tax_type) {
                conditions.push(`tax_type = $${paramIndex++}`);
                values.push(filters.tax_type);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }
            if (filters.effective_date) {
                conditions.push(`effective_from <= $${paramIndex++} AND (effective_to IS NULL OR effective_to >= $${paramIndex++})`);
                values.push(filters.effective_date, filters.effective_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, tax_name, tax_code, percentage,
                    tax_type, applies_to, is_active,
                    effective_from, effective_to,
                    created_at
                FROM tax_rates
                ${whereClause}
                ORDER BY percentage ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all tax rates', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all tax rates', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active tax rates for current date
     * @returns {Promise<Array>} List of active tax rates
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, tax_name, tax_code, percentage,
                    tax_type, applies_to
                FROM tax_rates
                WHERE is_active = true
                    AND effective_from <= CURRENT_DATE
                    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                    AND is_deleted = false
                ORDER BY percentage ASC
            `;

            const result = await db.query(query);

            logger.debug('Active tax rates retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active tax rates', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get applicable tax rate for a service type
     * @param {string} serviceType - Service type (consultation, lab, pharmacy, etc.)
     * @returns {Promise<Array>} List of applicable tax rates
     */
    async getApplicableForService(serviceType) {
        try {
            const query = `
                SELECT 
                    id, tax_name, tax_code, percentage,
                    tax_type
                FROM tax_rates
                WHERE is_active = true
                    AND effective_from <= CURRENT_DATE
                    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                    AND (applies_to IS NULL OR applies_to = '{}' OR $1 = ANY(applies_to) OR 'all' = ANY(applies_to))
                    AND is_deleted = false
                ORDER BY percentage ASC
            `;

            const result = await db.query(query, [serviceType]);

            logger.debug('Applicable tax rates retrieved', {
                serviceType,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting applicable tax rates', {
                error: error.message,
                serviceType
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get GST breakdown (CGST + SGST or IGST)
     * @param {number} amount - Amount to calculate tax on
     * @param {boolean} isInterstate - Whether transaction is interstate
     * @returns {Promise<Object>} GST breakdown
     */
    async getGSTBreakdown(amount, isInterstate = false) {
        try {
            let query;
            if (isInterstate) {
                query = `
                    SELECT 
                        SUM(CASE WHEN tax_type = 'igst' THEN percentage ELSE 0 END) as igst_percentage
                    FROM tax_rates
                    WHERE is_active = true
                        AND effective_from <= CURRENT_DATE
                        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                        AND (applies_to IS NULL OR 'all' = ANY(applies_to))
                        AND tax_type IN ('igst')
                        AND is_deleted = false
                `;
            } else {
                query = `
                    SELECT 
                        SUM(CASE WHEN tax_type = 'cgst' THEN percentage ELSE 0 END) as cgst_percentage,
                        SUM(CASE WHEN tax_type = 'sgst' THEN percentage ELSE 0 END) as sgst_percentage
                    FROM tax_rates
                    WHERE is_active = true
                        AND effective_from <= CURRENT_DATE
                        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                        AND (applies_to IS NULL OR 'all' = ANY(applies_to))
                        AND tax_type IN ('cgst', 'sgst')
                        AND is_deleted = false
                `;
            }

            const result = await db.query(query);

            if (result.rows.length === 0) {
                return { cgst: 0, sgst: 0, igst: 0, total: 0 };
            }

            const row = result.rows[0];
            let cgst = 0, sgst = 0, igst = 0;

            if (isInterstate) {
                igst = parseFloat(row.igst_percentage) || 0;
            } else {
                cgst = parseFloat(row.cgst_percentage) || 0;
                sgst = parseFloat(row.sgst_percentage) || 0;
            }

            const totalPercentage = isInterstate ? igst : (cgst + sgst);
            const totalTax = (amount * totalPercentage) / 100;

            return {
                cgst: (cgst * amount) / 100,
                sgst: (sgst * amount) / 100,
                igst: (igst * amount) / 100,
                total: totalTax,
                cgst_percentage: cgst,
                sgst_percentage: sgst,
                igst_percentage: igst,
                total_percentage: totalPercentage
            };
        } catch (error) {
            logger.error('Error calculating GST breakdown', {
                error: error.message,
                amount,
                isInterstate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new tax rate
     * @param {Object} taxData - Tax rate data
     * @returns {Promise<Object>} Created tax rate
     */
    async create(taxData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (taxData.tax_type && !this.validTaxTypes.includes(taxData.tax_type)) {
                throw new Error(`Invalid tax type. Must be one of: ${this.validTaxTypes.join(', ')}`);
            }

            const existingCode = await this.findByCode(taxData.tax_code);
            if (existingCode) {
                throw new Error('Tax code already exists');
            }

            const query = `
                INSERT INTO tax_rates (
                    id, tax_name, tax_code, percentage,
                    tax_type, applies_to, is_active,
                    effective_from, effective_to, description,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, COALESCE($6, true),
                    COALESCE($7, CURRENT_DATE), $8, $9,
                    $10, NOW(), NOW()
                )
                RETURNING 
                    id, tax_name, tax_code, percentage,
                    tax_type, is_active, created_at
            `;

            const values = [
                taxData.tax_name,
                taxData.tax_code,
                taxData.percentage,
                taxData.tax_type,
                taxData.applies_to || null,
                taxData.is_active,
                taxData.effective_from || null,
                taxData.effective_to || null,
                taxData.description || null,
                taxData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Tax rate created', {
                taxId: result.rows[0].id,
                taxName: taxData.tax_name,
                taxCode: taxData.tax_code,
                percentage: taxData.percentage
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating tax rate', {
                error: error.message,
                taxCode: taxData.tax_code
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update tax rate
     * @param {string} id - Tax rate ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated tax rate
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'tax_name', 'percentage', 'tax_type', 'applies_to',
                'is_active', 'effective_from', 'effective_to', 'description'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            if (updates.tax_code) {
                const existing = await this.findByCode(updates.tax_code);
                if (existing && existing.id !== id) {
                    throw new Error('Tax code already exists');
                }
                allowedFields.push('tax_code');
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
                UPDATE tax_rates 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, tax_name, tax_code, percentage,
                    tax_type, is_active, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Tax rate not found');
            }

            await db.commitTransaction(client);

            logger.info('Tax rate updated', {
                taxId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating tax rate', {
                error: error.message,
                taxId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get tax rate statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_tax_rates,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE tax_type = 'gst') as gst,
                    COUNT(*) FILTER (WHERE tax_type = 'cgst') as cgst,
                    COUNT(*) FILTER (WHERE tax_type = 'sgst') as sgst,
                    COUNT(*) FILTER (WHERE tax_type = 'igst') as igst,
                    COUNT(*) FILTER (WHERE tax_type = 'vat') as vat,
                    AVG(percentage)::numeric(10,2) as avg_percentage,
                    MIN(percentage)::numeric(10,2) as min_percentage,
                    MAX(percentage)::numeric(10,2) as max_percentage
                FROM tax_rates
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Tax rate statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting tax rate statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete tax rate
     * @param {string} id - Tax rate ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE tax_rates 
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
                throw new Error('Tax rate not found');
            }

            await db.commitTransaction(client);

            logger.info('Tax rate soft deleted', {
                taxId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting tax rate', {
                error: error.message,
                taxId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = TaxRate;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */