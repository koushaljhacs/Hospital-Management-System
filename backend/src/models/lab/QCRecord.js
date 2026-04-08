/**
 * ======================================================================
 * FILE: backend/src/models/lab/QCRecord.js
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
 * QCRecord model for database operations.
 * Handles laboratory quality control records for test validation.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: qc_records
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - qc_number: string (unique)
 * - test_id: UUID (foreign key to lab_tests)
 * - test_name: string
 * - qc_type: enum (internal, external, proficiency)
 * - qc_date: date
 * - performed_by: uuid
 * - control_lot: string
 * - control_expiry: date
 * - instrument_id: UUID
 * - results: jsonb
 * - expected_ranges: jsonb
 * - is_passed: boolean
 * - deviation_notes: text
 * - reviewed_by: uuid
 * - reviewed_at: timestamp
 * - approved_by: uuid
 * - approved_at: timestamp
 * - corrective_action: text
 * - preventive_action: text
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

const QCRecord = {
    /**
     * Table name
     */
    tableName: 'qc_records',

    /**
     * Valid QC types
     */
    validQCTypes: ['internal', 'external', 'proficiency'],

    /**
     * Generate QC number
     * @returns {Promise<string>} Generated QC number
     */
    async generateQCNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM qc_records
                WHERE qc_number LIKE $1
            `;
            const result = await db.query(query, [`QC-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `QC-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating QC number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find QC record by ID
     * @param {string} id - QC record UUID
     * @returns {Promise<Object|null>} QC record object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    qr.id, qr.qc_number, qr.test_id, qr.test_name,
                    qr.qc_type, qr.qc_date, qr.performed_by,
                    qr.control_lot, qr.control_expiry, qr.instrument_id,
                    qr.results, qr.expected_ranges, qr.is_passed,
                    qr.deviation_notes,
                    qr.reviewed_by, qr.reviewed_at,
                    qr.approved_by, qr.approved_at,
                    qr.corrective_action, qr.preventive_action,
                    qr.created_at, qr.updated_at,
                    u.username as performed_by_name,
                    ru.username as reviewed_by_name,
                    au.username as approved_by_name,
                    lt.test_code, lt.category
                FROM qc_records qr
                LEFT JOIN users u ON qr.performed_by = u.id
                LEFT JOIN users ru ON qr.reviewed_by = ru.id
                LEFT JOIN users au ON qr.approved_by = au.id
                LEFT JOIN lab_tests lt ON qr.test_id = lt.id
                WHERE qr.id = $1 AND qr.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('QC record found by ID', { qcId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding QC record by ID', {
                error: error.message,
                qcId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find QC records by test ID
     * @param {string} testId - Lab test UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of QC records
     */
    async findByTestId(testId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [testId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (from_date) {
                conditions.push(`qc_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`qc_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, qc_number, qc_type, qc_date,
                    control_lot, is_passed,
                    performed_by, reviewed_by, approved_by,
                    u.username as performed_by_name
                FROM qc_records qr
                LEFT JOIN users u ON qr.performed_by = u.id
                ${whereClause}
                ORDER BY qc_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('QC records found by test ID', {
                testId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding QC records by test ID', {
                error: error.message,
                testId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get QC records by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @returns {Promise<Array>} List of QC records
     */
    async getByDateRange(startDate, endDate) {
        try {
            const query = `
                SELECT 
                    id, qc_number, test_name, qc_type,
                    qc_date, is_passed, control_lot,
                    performed_by, u.username as performed_by_name
                FROM qc_records qr
                LEFT JOIN users u ON qr.performed_by = u.id
                WHERE qc_date BETWEEN $1 AND $2
                    AND is_deleted = false
                ORDER BY qc_date DESC
            `;

            const result = await db.query(query, [startDate, endDate]);

            logger.debug('QC records found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding QC records by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get failed QC records
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of failed QC records
     */
    async getFailedRecords(options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_passed = false', 'is_deleted = false'];

            if (from_date) {
                conditions.push(`qc_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`qc_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, qc_number, test_name, qc_type,
                    qc_date, control_lot, deviation_notes,
                    corrective_action, preventive_action,
                    performed_by, u.username as performed_by_name
                FROM qc_records qr
                LEFT JOIN users u ON qr.performed_by = u.id
                ${whereClause}
                ORDER BY qc_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Failed QC records retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting failed QC records', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new QC record
     * @param {Object} qcData - QC record data
     * @returns {Promise<Object>} Created QC record
     */
    async create(qcData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (qcData.qc_type && !this.validQCTypes.includes(qcData.qc_type)) {
                throw new Error(`Invalid QC type. Must be one of: ${this.validQCTypes.join(', ')}`);
            }

            const qcNumber = await this.generateQCNumber();

            const query = `
                INSERT INTO qc_records (
                    id, qc_number, test_id, test_name,
                    qc_type, qc_date, performed_by,
                    control_lot, control_expiry, instrument_id,
                    results, expected_ranges, is_passed,
                    deviation_notes,
                    corrective_action, preventive_action,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    $10, $11, $12,
                    $13,
                    $14, $15,
                    $16, NOW(), NOW()
                )
                RETURNING 
                    id, qc_number, test_id, test_name,
                    qc_type, qc_date, is_passed,
                    created_at
            `;

            const values = [
                qcNumber,
                qcData.test_id || null,
                qcData.test_name,
                qcData.qc_type,
                qcData.qc_date,
                qcData.performed_by,
                qcData.control_lot || null,
                qcData.control_expiry || null,
                qcData.instrument_id || null,
                qcData.results || null,
                qcData.expected_ranges || null,
                qcData.is_passed,
                qcData.deviation_notes || null,
                qcData.corrective_action || null,
                qcData.preventive_action || null,
                qcData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('QC record created successfully', {
                qcId: result.rows[0].id,
                qcNumber,
                testName: qcData.test_name,
                isPassed: qcData.is_passed
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating QC record', {
                error: error.message,
                testName: qcData.test_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update QC record
     * @param {string} id - QC record ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated QC record
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'control_lot', 'control_expiry', 'instrument_id',
                'results', 'expected_ranges', 'is_passed',
                'deviation_notes', 'reviewed_by', 'reviewed_at',
                'approved_by', 'approved_at',
                'corrective_action', 'preventive_action'
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
                UPDATE qc_records 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, qc_number, is_passed,
                    reviewed_by, approved_by, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('QC record not found');
            }

            await db.commitTransaction(client);

            logger.info('QC record updated', {
                qcId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating QC record', {
                error: error.message,
                qcId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Review QC record
     * @param {string} id - QC record ID
     * @param {string} reviewedBy - User who reviewed
     * @param {string} notes - Review notes
     * @returns {Promise<Object>} Updated QC record
     */
    async review(id, reviewedBy, notes = null) {
        return this.update(id, {
            reviewed_by: reviewedBy,
            reviewed_at: new Date(),
            deviation_notes: notes ? `Review notes: ${notes}` : null,
            updated_by: reviewedBy
        });
    },

    /**
     * Approve QC record
     * @param {string} id - QC record ID
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated QC record
     */
    async approve(id, approvedBy) {
        return this.update(id, {
            approved_by: approvedBy,
            approved_at: new Date(),
            updated_by: approvedBy
        });
    },

    /**
     * Get QC statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND qc_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_qc_records,
                    COUNT(*) FILTER (WHERE is_passed = true) as passed,
                    COUNT(*) FILTER (WHERE is_passed = false) as failed,
                    COUNT(*) FILTER (WHERE qc_type = 'internal') as internal,
                    COUNT(*) FILTER (WHERE qc_type = 'external') as external,
                    COUNT(*) FILTER (WHERE qc_type = 'proficiency') as proficiency,
                    COUNT(DISTINCT test_id) as unique_tests,
                    COUNT(DISTINCT performed_by) as unique_technicians,
                    ROUND((COUNT(*) FILTER (WHERE is_passed = true)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as pass_rate
                FROM qc_records
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('QC statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting QC statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get QC trends for a test
     * @param {string} testId - Lab test UUID
     * @param {number} months - Number of months to analyze
     * @returns {Promise<Array>} QC trend data
     */
    async getTrends(testId, months = 6) {
        try {
            const query = `
                SELECT 
                    DATE_TRUNC('month', qc_date) as month,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_passed = true) as passed,
                    COUNT(*) FILTER (WHERE is_passed = false) as failed,
                    ROUND((COUNT(*) FILTER (WHERE is_passed = true)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as pass_rate
                FROM qc_records
                WHERE test_id = $1
                    AND qc_date > NOW() - ($2 || ' months')::INTERVAL
                    AND is_deleted = false
                GROUP BY DATE_TRUNC('month', qc_date)
                ORDER BY month ASC
            `;

            const result = await db.query(query, [testId, months]);

            logger.debug('QC trends retrieved', {
                testId,
                months,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting QC trends', {
                error: error.message,
                testId,
                months
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete QC record
     * @param {string} id - QC record ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE qc_records 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('QC record not found');
            }

            await db.commitTransaction(client);

            logger.info('QC record soft deleted', {
                qcId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting QC record', {
                error: error.message,
                qcId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = QCRecord;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */
