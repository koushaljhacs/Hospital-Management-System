/**
 * ======================================================================
 * FILE: backend/src/models/lab/LabPanel.js
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
 * LabPanel model for database operations.
 * Handles groups of lab tests that are commonly ordered together.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: lab_panels
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - panel_code: string (unique)
 * - panel_name: string
 * - description: text
 * - category: string
 * - test_ids: uuid[]
 * - tests: jsonb (denormalized test details)
 * - total_tests: integer
 * - price: decimal
 * - discounted_price: decimal
 * - insurance_coverage: boolean
 * - cgst_percentage: decimal
 * - sgst_percentage: decimal
 * - igst_percentage: decimal
 * - total_tax_percentage: decimal (generated)
 * - price_with_tax: decimal (generated)
 * - turnaround_time_hours: integer
 * - fasting_required: boolean
 * - special_instructions: text
 * - is_active: boolean
 * - is_available: boolean
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

const LabPanel = {
    /**
     * Table name
     */
    tableName: 'lab_panels',

    /**
     * Generate panel code
     * @returns {Promise<string>} Generated panel code
     */
    async generatePanelCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM lab_panels WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');
            return `PNL-${sequence}`;
        } catch (error) {
            logger.error('Error generating panel code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find panel by ID
     * @param {string} id - Panel UUID
     * @returns {Promise<Object|null>} Panel object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    lp.id, lp.panel_code, lp.panel_name, lp.description,
                    lp.category, lp.test_ids, lp.tests, lp.total_tests,
                    lp.price, lp.discounted_price, lp.insurance_coverage,
                    lp.cgst_percentage, lp.sgst_percentage, lp.igst_percentage,
                    lp.total_tax_percentage, lp.price_with_tax,
                    lp.turnaround_time_hours, lp.fasting_required,
                    lp.special_instructions,
                    lp.is_active, lp.is_available,
                    lp.created_at, lp.updated_at,
                    u.username as created_by_name
                FROM lab_panels lp
                LEFT JOIN users u ON lp.created_by = u.id
                WHERE lp.id = $1 AND lp.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab panel found by ID', { panelId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab panel by ID', {
                error: error.message,
                panelId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find panel by code
     * @param {string} panelCode - Panel code
     * @returns {Promise<Object|null>} Panel object or null
     */
    async findByCode(panelCode) {
        try {
            const query = `
                SELECT id, panel_code, panel_name, price, is_active
                FROM lab_panels
                WHERE panel_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [panelCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab panel found by code', { panelCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab panel by code', {
                error: error.message,
                panelCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all panels with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of panels
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.category) {
                conditions.push(`category = $${paramIndex++}`);
                values.push(filters.category);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }
            if (filters.is_available !== undefined) {
                conditions.push(`is_available = $${paramIndex++}`);
                values.push(filters.is_available);
            }
            if (filters.search) {
                conditions.push(`(panel_name ILIKE $${paramIndex++} OR panel_code ILIKE $${paramIndex++})`);
                const searchTerm = `%${filters.search}%`;
                values.push(searchTerm, searchTerm);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, panel_code, panel_name, category,
                    total_tests, price, discounted_price, price_with_tax,
                    turnaround_time_hours, fasting_required,
                    is_active, is_available, created_at
                FROM lab_panels
                ${whereClause}
                ORDER BY panel_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all lab panels', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all lab panels', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active panels (for ordering)
     * @returns {Promise<Array>} List of active panels
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, panel_code, panel_name, category,
                    total_tests, price, discounted_price, price_with_tax,
                    turnaround_time_hours, fasting_required
                FROM lab_panels
                WHERE is_active = true AND is_available = true AND is_deleted = false
                ORDER BY panel_name ASC
            `;

            const result = await db.query(query);

            logger.debug('Active lab panels retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active lab panels', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new lab panel
     * @param {Object} panelData - Panel data
     * @returns {Promise<Object>} Created panel
     */
    async create(panelData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const panelCode = panelData.panel_code || await this.generatePanelCode();

            // Calculate totals from tests
            const tests = panelData.tests || [];
            const totalTests = tests.length;
            let totalPrice = 0;
            let totalDiscountedPrice = 0;

            for (const test of tests) {
                totalPrice += test.price || 0;
                totalDiscountedPrice += test.discounted_price || test.price || 0;
            }

            const price = panelData.price || totalPrice;
            const discountedPrice = panelData.discounted_price || totalDiscountedPrice;

            const cgst = panelData.cgst_percentage || 0;
            const sgst = panelData.sgst_percentage || 0;
            const igst = panelData.igst_percentage || 0;
            const totalTaxPercent = cgst + sgst + igst;
            const priceWithTax = discountedPrice * (1 + totalTaxPercent / 100);

            const query = `
                INSERT INTO lab_panels (
                    id, panel_code, panel_name, description,
                    category, test_ids, tests, total_tests,
                    price, discounted_price, insurance_coverage,
                    cgst_percentage, sgst_percentage, igst_percentage,
                    total_tax_percentage, price_with_tax,
                    turnaround_time_hours, fasting_required,
                    special_instructions,
                    is_active, is_available,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6, $7,
                    $8, $9, $10,
                    $11, $12, $13,
                    $14, $15,
                    $16, $17,
                    $18,
                    COALESCE($19, true), COALESCE($20, true),
                    $21, NOW(), NOW()
                )
                RETURNING 
                    id, panel_code, panel_name, category,
                    total_tests, price, discounted_price, price_with_tax,
                    is_active, created_at
            `;

            const values = [
                panelCode,
                panelData.panel_name,
                panelData.description || null,
                panelData.category || null,
                panelData.test_ids || null,
                tests,
                totalTests,
                price,
                discountedPrice,
                panelData.insurance_coverage !== undefined ? panelData.insurance_coverage : true,
                cgst,
                sgst,
                igst,
                totalTaxPercent,
                priceWithTax,
                panelData.turnaround_time_hours || null,
                panelData.fasting_required || false,
                panelData.special_instructions || null,
                panelData.is_active,
                panelData.is_available,
                panelData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Lab panel created successfully', {
                panelId: result.rows[0].id,
                panelCode,
                panelName: panelData.panel_name,
                totalTests
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating lab panel', {
                error: error.message,
                panelName: panelData.panel_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update lab panel
     * @param {string} id - Panel ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated panel
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'panel_name', 'description', 'category',
                'test_ids', 'tests', 'total_tests',
                'price', 'discounted_price', 'insurance_coverage',
                'cgst_percentage', 'sgst_percentage', 'igst_percentage',
                'total_tax_percentage', 'price_with_tax',
                'turnaround_time_hours', 'fasting_required',
                'special_instructions',
                'is_active', 'is_available'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Recalculate totals if tests or prices change
            let recalculated = false;
            let newTotalTests = updates.total_tests;
            let newPrice = updates.price;
            let newDiscountedPrice = updates.discounted_price;
            let newTotalTaxPercent = updates.total_tax_percentage;
            let newPriceWithTax = updates.price_with_tax;

            if (updates.tests) {
                newTotalTests = updates.tests.length;
                recalculated = true;
                let totalPrice = 0;
                let totalDiscountedPrice = 0;
                for (const test of updates.tests) {
                    totalPrice += test.price || 0;
                    totalDiscountedPrice += test.discounted_price || test.price || 0;
                }
                if (!updates.price) newPrice = totalPrice;
                if (!updates.discounted_price) newDiscountedPrice = totalDiscountedPrice;
            }

            if (updates.cgst_percentage !== undefined || updates.sgst_percentage !== undefined || updates.igst_percentage !== undefined) {
                const panel = await this.findById(id);
                const cgst = updates.cgst_percentage !== undefined ? updates.cgst_percentage : (panel?.cgst_percentage || 0);
                const sgst = updates.sgst_percentage !== undefined ? updates.sgst_percentage : (panel?.sgst_percentage || 0);
                const igst = updates.igst_percentage !== undefined ? updates.igst_percentage : (panel?.igst_percentage || 0);
                newTotalTaxPercent = cgst + sgst + igst;
                recalculated = true;
            }

            if (recalculated && (newDiscountedPrice !== undefined || updates.discounted_price !== undefined)) {
                const finalPrice = newDiscountedPrice !== undefined ? newDiscountedPrice : updates.discounted_price;
                newPriceWithTax = finalPrice * (1 + (newTotalTaxPercent || 0) / 100);
            }

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (recalculated) {
                if (newTotalTests !== undefined && !updates.total_tests) {
                    setClause.push(`total_tests = $${paramIndex++}`);
                    values.push(newTotalTests);
                }
                if (newPrice !== undefined && !updates.price) {
                    setClause.push(`price = $${paramIndex++}`);
                    values.push(newPrice);
                }
                if (newDiscountedPrice !== undefined && !updates.discounted_price) {
                    setClause.push(`discounted_price = $${paramIndex++}`);
                    values.push(newDiscountedPrice);
                }
                if (newTotalTaxPercent !== undefined && !updates.total_tax_percentage) {
                    setClause.push(`total_tax_percentage = $${paramIndex++}`);
                    values.push(newTotalTaxPercent);
                }
                if (newPriceWithTax !== undefined && !updates.price_with_tax) {
                    setClause.push(`price_with_tax = $${paramIndex++}`);
                    values.push(newPriceWithTax);
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
                UPDATE lab_panels 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, panel_code, panel_name,
                    total_tests, price, price_with_tax,
                    is_active, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Lab panel not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab panel updated', {
                panelId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating lab panel', {
                error: error.message,
                panelId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get panel with all test details
     * @param {string} id - Panel ID
     * @returns {Promise<Object|null>} Panel with test details
     */
    async getWithTests(id) {
        try {
            const panel = await this.findById(id);
            if (!panel) {
                return null;
            }

            // If test_ids are stored, fetch full test details
            if (panel.test_ids && panel.test_ids.length > 0) {
                const testQuery = `
                    SELECT id, test_code, test_name, short_name,
                           category, price, discounted_price, price_with_tax,
                           turnaround_time_hours, fasting_required,
                           sample_type, unit
                    FROM lab_tests
                    WHERE id = ANY($1::uuid[]) AND is_deleted = false
                `;
                const testResult = await db.query(testQuery, [panel.test_ids]);
                panel.test_details = testResult.rows;
            }

            logger.debug('Lab panel with tests retrieved', {
                panelId: id,
                testCount: panel.test_details?.length || 0
            });

            return panel;
        } catch (error) {
            logger.error('Error getting lab panel with tests', {
                error: error.message,
                panelId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get panel statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_panels,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE is_available = true) as available,
                    AVG(total_tests)::numeric(10,2) as avg_tests_per_panel,
                    SUM(total_tests) as total_tests_in_panels,
                    AVG(price)::numeric(10,2) as avg_price,
                    MIN(price)::numeric(10,2) as min_price,
                    MAX(price)::numeric(10,2) as max_price,
                    COUNT(DISTINCT category) as categories_used
                FROM lab_panels
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Lab panel statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting lab panel statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search lab panels
     * @param {string} searchTerm - Search term (name, code, category)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of panels
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, panel_code, panel_name, category,
                    total_tests, price, discounted_price, price_with_tax,
                    is_active
                FROM lab_panels
                WHERE (panel_name ILIKE $1 
                    OR panel_code ILIKE $1
                    OR category ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN panel_name ILIKE $2 THEN 1
                        WHEN panel_code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    panel_name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Lab panel search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching lab panels', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete lab panel
     * @param {string} id - Panel ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE lab_panels 
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
                throw new Error('Lab panel not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab panel soft deleted', {
                panelId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting lab panel', {
                error: error.message,
                panelId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = LabPanel;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */