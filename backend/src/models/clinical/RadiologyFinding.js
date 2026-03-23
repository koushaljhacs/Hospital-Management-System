/**
 * ======================================================================
 * FILE: backend/src/models/clinical/RadiologyFinding.js
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
 * RadiologyFinding model for database operations.
 * Handles structured findings within radiology reports.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: radiology_findings
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - report_id: UUID (foreign key to radiology_reports)
 * - finding_type: string
 * - location: string
 * - description: text
 * - severity: enum (normal, mild, moderate, severe, critical)
 * - measurement: decimal
 * - measurement_unit: string
 * - image_reference: string
 * - series_number: integer
 * - instance_number: integer
 * - is_key_finding: boolean
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

const RadiologyFinding = {
    /**
     * Table name
     */
    tableName: 'radiology_findings',

    /**
     * Valid severity levels
     */
    validSeverities: ['normal', 'mild', 'moderate', 'severe', 'critical'],

    /**
     * Find finding by ID
     * @param {string} id - Finding UUID
     * @returns {Promise<Object|null>} Finding object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    rf.id, rf.report_id, rf.finding_type,
                    rf.location, rf.description, rf.severity,
                    rf.measurement, rf.measurement_unit,
                    rf.image_reference, rf.series_number,
                    rf.instance_number, rf.is_key_finding,
                    rf.created_at, rf.updated_at,
                    rr.report_number, rr.image_id,
                    ri.image_type, ri.modality
                FROM radiology_findings rf
                JOIN radiology_reports rr ON rf.report_id = rr.id
                JOIN radiology_images ri ON rr.image_id = ri.id
                WHERE rf.id = $1 AND rf.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Radiology finding found by ID', { findingId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding radiology finding by ID', {
                error: error.message,
                findingId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find findings by report ID
     * @param {string} reportId - Report UUID
     * @returns {Promise<Array>} List of findings
     */
    async findByReportId(reportId) {
        try {
            const query = `
                SELECT 
                    rf.id, rf.report_id, rf.finding_type,
                    rf.location, rf.description, rf.severity,
                    rf.measurement, rf.measurement_unit,
                    rf.image_reference, rf.series_number,
                    rf.instance_number, rf.is_key_finding,
                    rf.created_at
                FROM radiology_findings rf
                WHERE rf.report_id = $1 AND rf.is_deleted = false
                ORDER BY rf.series_number ASC, rf.instance_number ASC
            `;

            const result = await db.query(query, [reportId]);

            logger.debug('Radiology findings found by report ID', {
                reportId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology findings by report ID', {
                error: error.message,
                reportId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find key findings by report ID
     * @param {string} reportId - Report UUID
     * @returns {Promise<Array>} List of key findings
     */
    async findKeyFindings(reportId) {
        try {
            const query = `
                SELECT 
                    rf.id, rf.finding_type, rf.location,
                    rf.description, rf.severity,
                    rf.measurement, rf.measurement_unit,
                    rf.image_reference
                FROM radiology_findings rf
                WHERE rf.report_id = $1 
                    AND rf.is_key_finding = true
                    AND rf.is_deleted = false
                ORDER BY rf.severity DESC, rf.finding_type ASC
            `;

            const result = await db.query(query, [reportId]);

            logger.debug('Key radiology findings found', {
                reportId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding key radiology findings', {
                error: error.message,
                reportId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new radiology finding
     * @param {Object} findingData - Finding data
     * @returns {Promise<Object>} Created finding
     */
    async create(findingData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (findingData.severity && !this.validSeverities.includes(findingData.severity)) {
                throw new Error(`Invalid severity. Must be one of: ${this.validSeverities.join(', ')}`);
            }

            const query = `
                INSERT INTO radiology_findings (
                    id, report_id, finding_type, location,
                    description, severity, measurement,
                    measurement_unit, image_reference,
                    series_number, instance_number,
                    is_key_finding,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    COALESCE($5, 'normal'), $6, $7, $8,
                    $9, $10,
                    COALESCE($11, false),
                    $12, NOW(), NOW()
                )
                RETURNING 
                    id, report_id, finding_type, location,
                    description, severity, is_key_finding,
                    created_at
            `;

            const values = [
                findingData.report_id,
                findingData.finding_type,
                findingData.location || null,
                findingData.description,
                findingData.severity,
                findingData.measurement || null,
                findingData.measurement_unit || null,
                findingData.image_reference || null,
                findingData.series_number || null,
                findingData.instance_number || null,
                findingData.is_key_finding,
                findingData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Radiology finding created successfully', {
                findingId: result.rows[0].id,
                reportId: findingData.report_id,
                findingType: findingData.finding_type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating radiology finding', {
                error: error.message,
                reportId: findingData.report_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update radiology finding
     * @param {string} id - Finding ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated finding
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'finding_type', 'location', 'description',
                'severity', 'measurement', 'measurement_unit',
                'image_reference', 'series_number', 'instance_number',
                'is_key_finding'
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
                UPDATE radiology_findings 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, report_id, finding_type, location,
                    description, severity, is_key_finding,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Radiology finding not found');
            }

            await db.commitTransaction(client);

            logger.info('Radiology finding updated', {
                findingId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating radiology finding', {
                error: error.message,
                findingId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get findings by severity
     * @param {string} severity - Severity level
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of findings
     */
    async findBySeverity(severity, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    rf.id, rf.report_id, rf.finding_type,
                    rf.location, rf.description, rf.severity,
                    rr.report_number, ri.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM radiology_findings rf
                JOIN radiology_reports rr ON rf.report_id = rr.id
                JOIN radiology_images ri ON rr.image_id = ri.id
                JOIN patients p ON ri.patient_id = p.id
                WHERE rf.severity = $1 AND rf.is_deleted = false
                ORDER BY rf.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [severity, limit, offset]);

            logger.debug('Radiology findings found by severity', {
                severity,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology findings by severity', {
                error: error.message,
                severity
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get critical findings (severity = critical)
     * @returns {Promise<Array>} List of critical findings
     */
    async getCriticalFindings() {
        return this.findBySeverity('critical');
    },

    /**
     * Bulk create radiology findings
     * @param {Array} findingsData - Array of finding data
     * @returns {Promise<Array>} Created findings
     */
    async bulkCreate(findingsData) {
        const client = await db.getClient();
        const created = [];

        try {
            await db.beginTransaction(client);

            for (const data of findingsData) {
                const result = await this.create(data);
                created.push(result);
            }

            await db.commitTransaction(client);

            logger.info('Bulk radiology findings created', {
                count: created.length,
                reportId: findingsData[0]?.report_id
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk creating radiology findings', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get finding statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_findings,
                    COUNT(DISTINCT report_id) as unique_reports,
                    COUNT(*) FILTER (WHERE severity = 'normal') as normal,
                    COUNT(*) FILTER (WHERE severity = 'mild') as mild,
                    COUNT(*) FILTER (WHERE severity = 'moderate') as moderate,
                    COUNT(*) FILTER (WHERE severity = 'severe') as severe,
                    COUNT(*) FILTER (WHERE severity = 'critical') as critical,
                    COUNT(*) FILTER (WHERE is_key_finding = true) as key_findings,
                    AVG(measurement)::numeric(10,2) as avg_measurement
                FROM radiology_findings
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Radiology finding statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting radiology finding statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete radiology finding
     * @param {string} id - Finding ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_findings 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Radiology finding not found');
            }

            await db.commitTransaction(client);

            logger.info('Radiology finding soft deleted', {
                findingId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting radiology finding', {
                error: error.message,
                findingId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = RadiologyFinding;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */