/**
 * ======================================================================
 * FILE: backend/src/models/lab/LabTestRange.js
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
 * LabTestRange model for database operations.
 * Handles age and gender specific reference ranges for lab tests.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: lab_test_ranges
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - test_id: UUID (foreign key to lab_tests)
 * - gender: enum (male, female, other, all)
 * - age_min_months: integer
 * - age_max_months: integer
 * - age_group_name: string
 * - normal_range_low: decimal
 * - normal_range_high: decimal
 * - critical_low_value: decimal
 * - critical_high_value: decimal
 * - panic_low_value: decimal
 * - panic_high_value: decimal
 * - unit: string
 * - unit_description: text
 * - interpretation_guidelines: text
 * - clinical_significance: text
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

const LabTestRange = {
    /**
     * Table name
     */
    tableName: 'lab_test_ranges',

    /**
     * Valid genders
     */
    validGenders: ['male', 'female', 'other', 'all'],

    /**
     * Find range by ID
     * @param {string} id - Range UUID
     * @returns {Promise<Object|null>} Range object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ltr.id, ltr.test_id, ltr.gender,
                    ltr.age_min_months, ltr.age_max_months, ltr.age_group_name,
                    ltr.normal_range_low, ltr.normal_range_high,
                    ltr.critical_low_value, ltr.critical_high_value,
                    ltr.panic_low_value, ltr.panic_high_value,
                    ltr.unit, ltr.unit_description,
                    ltr.interpretation_guidelines, ltr.clinical_significance,
                    ltr.is_active, ltr.created_at, ltr.updated_at,
                    lt.test_name, lt.test_code, lt.category
                FROM lab_test_ranges ltr
                JOIN lab_tests lt ON ltr.test_id = lt.id
                WHERE ltr.id = $1 AND ltr.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab test range found by ID', { rangeId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab test range by ID', {
                error: error.message,
                rangeId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find ranges by test ID
     * @param {string} testId - Lab test UUID
     * @returns {Promise<Array>} List of ranges
     */
    async findByTestId(testId) {
        try {
            const query = `
                SELECT 
                    id, test_id, gender,
                    age_min_months, age_max_months, age_group_name,
                    normal_range_low, normal_range_high,
                    critical_low_value, critical_high_value,
                    panic_low_value, panic_high_value,
                    unit, unit_description,
                    interpretation_guidelines, clinical_significance,
                    is_active
                FROM lab_test_ranges
                WHERE test_id = $1 AND is_deleted = false
                ORDER BY 
                    CASE gender
                        WHEN 'all' THEN 0
                        WHEN 'male' THEN 1
                        WHEN 'female' THEN 2
                        ELSE 3
                    END,
                    age_min_months ASC
            `;

            const result = await db.query(query, [testId]);

            logger.debug('Lab test ranges found by test ID', {
                testId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding lab test ranges by test ID', {
                error: error.message,
                testId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get applicable range for patient
     * @param {string} testId - Lab test UUID
     * @param {string} gender - Patient gender
     * @param {number} ageMonths - Patient age in months
     * @returns {Promise<Object|null>} Applicable range or null
     */
    async getApplicableRange(testId, gender, ageMonths) {
        try {
            const query = `
                SELECT 
                    id, test_id, gender,
                    age_min_months, age_max_months, age_group_name,
                    normal_range_low, normal_range_high,
                    critical_low_value, critical_high_value,
                    panic_low_value, panic_high_value,
                    unit, unit_description,
                    interpretation_guidelines, clinical_significance
                FROM lab_test_ranges
                WHERE test_id = $1
                    AND (gender = $2 OR gender = 'all')
                    AND (age_min_months IS NULL OR age_min_months <= $3)
                    AND (age_max_months IS NULL OR age_max_months >= $3)
                    AND is_active = true
                    AND is_deleted = false
                ORDER BY 
                    CASE WHEN gender = $2 THEN 0 ELSE 1 END,
                    age_min_months DESC
                LIMIT 1
            `;

            const result = await db.query(query, [testId, gender, ageMonths]);

            if (result.rows.length === 0) {
                // Fallback to default range (no age/gender restrictions)
                const fallbackQuery = `
                    SELECT 
                        id, test_id, gender,
                        normal_range_low, normal_range_high,
                        critical_low_value, critical_high_value,
                        panic_low_value, panic_high_value,
                        unit, unit_description,
                        interpretation_guidelines, clinical_significance
                    FROM lab_test_ranges
                    WHERE test_id = $1
                        AND gender = 'all'
                        AND age_min_months IS NULL
                        AND age_max_months IS NULL
                        AND is_active = true
                        AND is_deleted = false
                    LIMIT 1
                `;
                const fallbackResult = await db.query(fallbackQuery, [testId]);
                return fallbackResult.rows[0] || null;
            }

            logger.debug('Applicable range found', {
                testId,
                gender,
                ageMonths,
                rangeId: result.rows[0].id
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting applicable range', {
                error: error.message,
                testId,
                gender,
                ageMonths
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new lab test range
     * @param {Object} rangeData - Range data
     * @returns {Promise<Object>} Created range
     */
    async create(rangeData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (rangeData.gender && !this.validGenders.includes(rangeData.gender)) {
                throw new Error(`Invalid gender. Must be one of: ${this.validGenders.join(', ')}`);
            }

            // Validate age range
            if (rangeData.age_min_months !== null && rangeData.age_max_months !== null &&
                rangeData.age_min_months > rangeData.age_max_months) {
                throw new Error('Age min cannot be greater than age max');
            }

            const query = `
                INSERT INTO lab_test_ranges (
                    id, test_id, gender,
                    age_min_months, age_max_months, age_group_name,
                    normal_range_low, normal_range_high,
                    critical_low_value, critical_high_value,
                    panic_low_value, panic_high_value,
                    unit, unit_description,
                    interpretation_guidelines, clinical_significance,
                    is_active,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    $6, $7,
                    $8, $9,
                    $10, $11,
                    $12, $13,
                    $14, $15,
                    COALESCE($16, true),
                    $17, NOW(), NOW()
                )
                RETURNING 
                    id, test_id, gender,
                    age_min_months, age_max_months, age_group_name,
                    normal_range_low, normal_range_high,
                    is_active, created_at
            `;

            const values = [
                rangeData.test_id,
                rangeData.gender || 'all',
                rangeData.age_min_months !== undefined ? rangeData.age_min_months : null,
                rangeData.age_max_months !== undefined ? rangeData.age_max_months : null,
                rangeData.age_group_name || null,
                rangeData.normal_range_low !== undefined ? rangeData.normal_range_low : null,
                rangeData.normal_range_high !== undefined ? rangeData.normal_range_high : null,
                rangeData.critical_low_value !== undefined ? rangeData.critical_low_value : null,
                rangeData.critical_high_value !== undefined ? rangeData.critical_high_value : null,
                rangeData.panic_low_value !== undefined ? rangeData.panic_low_value : null,
                rangeData.panic_high_value !== undefined ? rangeData.panic_high_value : null,
                rangeData.unit || null,
                rangeData.unit_description || null,
                rangeData.interpretation_guidelines || null,
                rangeData.clinical_significance || null,
                rangeData.is_active,
                rangeData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Lab test range created successfully', {
                rangeId: result.rows[0].id,
                testId: rangeData.test_id,
                gender: rangeData.gender,
                ageGroup: rangeData.age_group_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating lab test range', {
                error: error.message,
                testId: rangeData.test_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update lab test range
     * @param {string} id - Range ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated range
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'gender', 'age_min_months', 'age_max_months', 'age_group_name',
                'normal_range_low', 'normal_range_high',
                'critical_low_value', 'critical_high_value',
                'panic_low_value', 'panic_high_value',
                'unit', 'unit_description',
                'interpretation_guidelines', 'clinical_significance',
                'is_active'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Validate age range if both are being updated
            let ageMin = updates.age_min_months;
            let ageMax = updates.age_max_months;
            if (ageMin !== undefined && ageMax !== undefined && ageMin > ageMax) {
                throw new Error('Age min cannot be greater than age max');
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
                UPDATE lab_test_ranges 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, test_id, gender,
                    age_min_months, age_max_months,
                    normal_range_low, normal_range_high,
                    is_active, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Lab test range not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab test range updated', {
                rangeId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating lab test range', {
                error: error.message,
                rangeId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete all ranges for a test
     * @param {string} testId - Lab test UUID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<number>} Number of ranges deleted
     */
    async deleteByTestId(testId, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE lab_test_ranges 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE test_id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, testId]);

            await db.commitTransaction(client);

            logger.info('All ranges deleted for test', {
                testId,
                count: result.rowCount,
                deletedBy
            });

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting ranges by test ID', {
                error: error.message,
                testId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get range statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_ranges,
                    COUNT(DISTINCT test_id) as unique_tests,
                    COUNT(*) FILTER (WHERE gender != 'all') as gender_specific,
                    COUNT(*) FILTER (WHERE age_min_months IS NOT NULL OR age_max_months IS NOT NULL) as age_specific,
                    COUNT(*) FILTER (WHERE is_active = true) as active
                FROM lab_test_ranges
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Lab test range statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting lab test range statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete lab test range
     * @param {string} id - Range ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE lab_test_ranges 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Lab test range not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab test range soft deleted', {
                rangeId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting lab test range', {
                error: error.message,
                rangeId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = LabTestRange;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */