/**
 * ======================================================================
 * FILE: backend/src/models/lab/TestResult.js
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
 * TestResult model for database operations.
 * Handles laboratory test results for patients.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: test_results
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - test_order_id: UUID (foreign key to test_orders)
 * - patient_id: UUID (foreign key to patients)
 * - test_id: UUID (foreign key to lab_tests)
 * - result_value: string
 * - result_numeric: decimal
 * - result_text: text
 * - result_unit: string
 * - result_range_low: decimal
 * - result_range_high: decimal
 * - result_range_text: text
 * - is_abnormal: boolean
 * - is_critical: boolean
 * - is_panic: boolean
 * - is_repeat_needed: boolean
 * - interpretation: text
 * - clinical_significance: text
 * - comments: text
 * - alert_sent: boolean
 * - alert_sent_at: timestamp
 * - alert_sent_to: uuid[]
 * - acknowledged_by: uuid
 * - acknowledged_at: timestamp
 * - qc_passed: boolean
 * - qc_notes: text
 * - retest_count: integer
 * - retest_reason: text
 * - specimen_id: UUID
 * - specimen_collected_at: timestamp
 * - specimen_received_at: timestamp
 * - specimen_condition: string
 * - specimen_notes: text
 * - report_url: text
 * - image_urls: text[]
 * - attachment_urls: jsonb
 * - tested_by: uuid
 * - tested_at: timestamp
 * - verified_by: uuid
 * - verified_at: timestamp
 * - approved_by: uuid
 * - approved_at: timestamp
 * - corrected_by: uuid
 * - corrected_at: timestamp
 * - correction_reason: text
 * - version: integer
 * - created_at: timestamp
 * - updated_at: timestamp
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

const TestResult = {
    /**
     * Table name
     */
    tableName: 'test_results',

    /**
     * Find test result by ID
     * @param {string} id - Test result UUID
     * @returns {Promise<Object|null>} Test result object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    tr.id, tr.test_order_id, tr.patient_id, tr.test_id,
                    tr.result_value, tr.result_numeric, tr.result_text,
                    tr.result_unit, tr.result_range_low, tr.result_range_high,
                    tr.result_range_text,
                    tr.is_abnormal, tr.is_critical, tr.is_panic,
                    tr.is_repeat_needed, tr.interpretation,
                    tr.clinical_significance, tr.comments,
                    tr.alert_sent, tr.alert_sent_at, tr.alert_sent_to,
                    tr.acknowledged_by, tr.acknowledged_at,
                    tr.qc_passed, tr.qc_notes,
                    tr.retest_count, tr.retest_reason,
                    tr.specimen_id, tr.specimen_collected_at,
                    tr.specimen_received_at, tr.specimen_condition,
                    tr.specimen_notes,
                    tr.report_url, tr.image_urls, tr.attachment_urls,
                    tr.tested_by, tr.tested_at,
                    tr.verified_by, tr.verified_at,
                    tr.approved_by, tr.approved_at,
                    tr.corrected_by, tr.corrected_at,
                    tr.correction_reason, tr.version,
                    tr.created_at, tr.updated_at,
                    to.order_number,
                    lt.test_name, lt.test_code, lt.category,
                    lt.unit as test_unit,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    tu.username as tested_by_name,
                    vu.username as verified_by_name,
                    au.username as approved_by_name,
                    cu.username as corrected_by_name,
                    acku.username as acknowledged_by_name
                FROM test_results tr
                LEFT JOIN test_orders to ON tr.test_order_id = to.id
                LEFT JOIN lab_tests lt ON tr.test_id = lt.id
                LEFT JOIN patients p ON tr.patient_id = p.id
                LEFT JOIN users tu ON tr.tested_by = tu.id
                LEFT JOIN users vu ON tr.verified_by = vu.id
                LEFT JOIN users au ON tr.approved_by = au.id
                LEFT JOIN users cu ON tr.corrected_by = cu.id
                LEFT JOIN users acku ON tr.acknowledged_by = acku.id
                WHERE tr.id = $1 AND tr.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Test result found by ID', { resultId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding test result by ID', {
                error: error.message,
                resultId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find test results by test order ID
     * @param {string} testOrderId - Test order UUID
     * @returns {Promise<Array>} List of test results
     */
    async findByTestOrderId(testOrderId) {
        try {
            const query = `
                SELECT 
                    tr.id, tr.test_id, tr.result_value,
                    tr.result_numeric, tr.result_text,
                    tr.result_unit, tr.result_range_low,
                    tr.result_range_high, tr.result_range_text,
                    tr.is_abnormal, tr.is_critical, tr.is_panic,
                    tr.interpretation, tr.comments,
                    tr.qc_passed, tr.retest_count,
                    tr.tested_at, tr.verified_at, tr.approved_at,
                    tr.version,
                    lt.test_name, lt.test_code, lt.category,
                    lt.unit as test_unit
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                WHERE tr.test_order_id = $1 AND tr.is_deleted = false
                ORDER BY lt.test_name ASC
            `;

            const result = await db.query(query, [testOrderId]);

            logger.debug('Test results found by test order ID', {
                testOrderId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding test results by test order ID', {
                error: error.message,
                testOrderId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find test results by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of test results
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, is_abnormal, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['tr.is_deleted = false'];

            if (is_abnormal !== undefined) {
                conditions.push(`tr.is_abnormal = $${paramIndex++}`);
                values.push(is_abnormal);
            }
            if (from_date) {
                conditions.push(`tr.tested_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`tr.tested_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    tr.id, tr.test_id, tr.result_value,
                    tr.result_numeric, tr.result_text,
                    tr.is_abnormal, tr.is_critical, tr.is_panic,
                    tr.interpretation, tr.tested_at,
                    lt.test_name, lt.test_code, lt.category,
                    to.order_number
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                JOIN test_orders to ON tr.test_order_id = to.id
                ${whereClause}
                ORDER BY tr.tested_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Test results found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding test results by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get critical results (requires immediate attention)
     * @returns {Promise<Array>} List of critical results
     */
    async getCriticalResults() {
        try {
            const query = `
                SELECT 
                    tr.id, tr.test_order_id, tr.patient_id,
                    tr.test_id, tr.result_value, tr.result_numeric,
                    tr.is_critical, tr.is_panic,
                    tr.alert_sent, tr.acknowledged_by,
                    lt.test_name, lt.test_code,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    to.doctor_id,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                JOIN test_orders to ON tr.test_order_id = to.id
                LEFT JOIN employees e ON to.doctor_id = e.id
                WHERE (tr.is_critical = true OR tr.is_panic = true)
                    AND tr.alert_sent = false
                    AND tr.is_deleted = false
                ORDER BY tr.tested_at DESC
            `;

            const result = await db.query(query);

            logger.debug('Critical test results retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting critical test results', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get abnormal results
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of abnormal results
     */
    async getAbnormalResults(options = {}) {
        try {
            const { limit = 100, offset = 0, from_date, to_date } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_abnormal = true', 'is_deleted = false'];

            if (from_date) {
                conditions.push(`tested_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`tested_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    tr.id, tr.patient_id, tr.test_id,
                    tr.result_value, tr.result_numeric,
                    tr.is_critical, tr.is_panic,
                    tr.interpretation, tr.tested_at,
                    lt.test_name, lt.test_code,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                ${whereClause}
                ORDER BY tr.tested_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Abnormal test results retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting abnormal test results', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new test result
     * @param {Object} resultData - Test result data
     * @returns {Promise<Object>} Created test result
     */
    async create(resultData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            // Determine if result is abnormal based on reference range
            let isAbnormal = false;
            if (resultData.result_numeric !== undefined && 
                resultData.result_range_low !== undefined && 
                resultData.result_range_high !== undefined) {
                isAbnormal = resultData.result_numeric < resultData.result_range_low ||
                             resultData.result_numeric > resultData.result_range_high;
            }

            const query = `
                INSERT INTO test_results (
                    id, test_order_id, patient_id, test_id,
                    result_value, result_numeric, result_text,
                    result_unit, result_range_low, result_range_high,
                    result_range_text,
                    is_abnormal, is_critical, is_panic, is_repeat_needed,
                    interpretation, clinical_significance, comments,
                    qc_passed, retest_count, retest_reason,
                    specimen_id, specimen_collected_at, specimen_received_at,
                    specimen_condition, specimen_notes,
                    report_url, image_urls, attachment_urls,
                    tested_by, tested_at, version,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    $10,
                    $11, $12, $13, $14,
                    $15, $16, $17,
                    COALESCE($18, true), COALESCE($19, 0), $20,
                    $21, $22, $23,
                    $24, $25,
                    $26, $27, $28,
                    $29, $30, 1,
                    NOW(), NOW()
                )
                RETURNING 
                    id, test_order_id, test_id,
                    result_value, result_numeric,
                    is_abnormal, is_critical, version,
                    created_at
            `;

            const values = [
                resultData.test_order_id,
                resultData.patient_id,
                resultData.test_id,
                resultData.result_value || null,
                resultData.result_numeric || null,
                resultData.result_text || null,
                resultData.result_unit || null,
                resultData.result_range_low || null,
                resultData.result_range_high || null,
                resultData.result_range_text || null,
                isAbnormal,
                resultData.is_critical || false,
                resultData.is_panic || false,
                resultData.is_repeat_needed || false,
                resultData.interpretation || null,
                resultData.clinical_significance || null,
                resultData.comments || null,
                resultData.qc_passed,
                resultData.retest_count,
                resultData.retest_reason || null,
                resultData.specimen_id || null,
                resultData.specimen_collected_at || null,
                resultData.specimen_received_at || null,
                resultData.specimen_condition || null,
                resultData.specimen_notes || null,
                resultData.report_url || null,
                resultData.image_urls || null,
                resultData.attachment_urls || null,
                resultData.tested_by,
                resultData.tested_at || new Date()
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Test result created successfully', {
                resultId: result.rows[0].id,
                testOrderId: resultData.test_order_id,
                testId: resultData.test_id,
                isAbnormal,
                isCritical: resultData.is_critical
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating test result', {
                error: error.message,
                testOrderId: resultData.test_order_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update test result
     * @param {string} id - Test result ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated test result
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'result_value', 'result_numeric', 'result_text',
                'result_unit', 'result_range_low', 'result_range_high',
                'result_range_text', 'is_abnormal', 'is_critical',
                'is_panic', 'is_repeat_needed', 'interpretation',
                'clinical_significance', 'comments',
                'qc_passed', 'qc_notes', 'retest_count', 'retest_reason',
                'specimen_condition', 'specimen_notes',
                'report_url', 'image_urls', 'attachment_urls',
                'verified_by', 'verified_at',
                'approved_by', 'approved_at',
                'corrected_by', 'corrected_at', 'correction_reason',
                'version'
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
                UPDATE test_results 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, test_order_id, test_id,
                    result_value, result_numeric,
                    is_abnormal, is_critical, version,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Test result not found');
            }

            await db.commitTransaction(client);

            logger.info('Test result updated', {
                resultId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating test result', {
                error: error.message,
                resultId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Verify test result
     * @param {string} id - Test result ID
     * @param {string} verifiedBy - User who verified
     * @returns {Promise<Object>} Updated test result
     */
    async verify(id, verifiedBy) {
        return this.update(id, {
            verified_by: verifiedBy,
            verified_at: new Date(),
            updated_by: verifiedBy
        });
    },

    /**
     * Approve test result
     * @param {string} id - Test result ID
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated test result
     */
    async approve(id, approvedBy) {
        return this.update(id, {
            approved_by: approvedBy,
            approved_at: new Date(),
            updated_by: approvedBy
        });
    },

    /**
     * Correct test result (increment version)
     * @param {string} id - Test result ID
     * @param {Object} corrections - Correction data
     * @param {string} correctedBy - User who corrected
     * @returns {Promise<Object>} Updated test result
     */
    async correct(id, corrections, correctedBy) {
        const current = await this.findById(id);
        if (!current) {
            throw new Error('Test result not found');
        }

        return this.update(id, {
            ...corrections,
            corrected_by: correctedBy,
            corrected_at: new Date(),
            correction_reason: corrections.correction_reason,
            version: current.version + 1,
            updated_by: correctedBy
        });
    },

    /**
     * Mark alert as sent for critical result
     * @param {string} id - Test result ID
     * @param {Array} sentTo - Users notified
     * @returns {Promise<Object>} Updated test result
     */
    async markAlertSent(id, sentTo) {
        return this.update(id, {
            alert_sent: true,
            alert_sent_at: new Date(),
            alert_sent_to: sentTo,
            updated_by: sentTo[0]
        });
    },

    /**
     * Acknowledge critical result
     * @param {string} id - Test result ID
     * @param {string} acknowledgedBy - User who acknowledged
     * @returns {Promise<Object>} Updated test result
     */
    async acknowledge(id, acknowledgedBy) {
        return this.update(id, {
            acknowledged_by: acknowledgedBy,
            acknowledged_at: new Date(),
            updated_by: acknowledgedBy
        });
    },

    /**
     * Get test result statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND tested_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_results,
                    COUNT(*) FILTER (WHERE is_abnormal = true) as abnormal,
                    COUNT(*) FILTER (WHERE is_critical = true) as critical,
                    COUNT(*) FILTER (WHERE is_panic = true) as panic,
                    COUNT(*) FILTER (WHERE qc_passed = true) as qc_passed,
                    COUNT(*) FILTER (WHERE verified_by IS NOT NULL) as verified,
                    COUNT(*) FILTER (WHERE approved_by IS NOT NULL) as approved,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT test_id) as unique_tests,
                    AVG(version)::numeric(10,2) as avg_versions
                FROM test_results
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Test result statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting test result statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete test result
     * @param {string} id - Test result ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE test_results 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Test result not found');
            }

            await db.commitTransaction(client);

            logger.info('Test result soft deleted', {
                resultId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting test result', {
                error: error.message,
                resultId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = TestResult;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */