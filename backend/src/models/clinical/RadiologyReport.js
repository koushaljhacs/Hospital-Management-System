/**
 * ======================================================================
 * FILE: backend/src/models/clinical/RadiologyReport.js
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
 * RadiologyReport model for database operations.
 * Handles radiology interpretation reports linked to images.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: radiology_reports
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - report_number: string (unique)
 * - image_id: UUID (foreign key to radiology_images)
 * - radiologist_id: UUID (foreign key to employees)
 * - report_date: timestamp
 * - clinical_history: text
 * - technique: text
 * - comparison: text
 * - findings: text
 * - impression: text
 * - conclusion: text
 * - is_critical: boolean
 * - is_abnormal: boolean
 * - status: enum (draft, preliminary, final, amended)
 * - version: integer
 * - parent_report_id: UUID
 * - template_used: string
 * - dictation_time: integer
 * - transcription_time: integer
 * - reviewed_by: UUID
 * - reviewed_at: timestamp
 * - verified_by: UUID
 * - verified_at: timestamp
 * - report_pdf_url: text
 * - report_html_url: text
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

const RadiologyReport = {
    /**
     * Table name
     */
    tableName: 'radiology_reports',

    /**
     * Valid report statuses
     */
    validStatuses: ['draft', 'preliminary', 'final', 'amended'],

    /**
     * Generate report number
     * @returns {Promise<string>} Generated report number
     */
    async generateReportNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM radiology_reports
                WHERE report_number LIKE $1
            `;
            const result = await db.query(query, [`REP-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `REP-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating report number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find report by ID
     * @param {string} id - Report UUID
     * @returns {Promise<Object|null>} Report object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    rr.id, rr.report_number, rr.image_id,
                    rr.radiologist_id, rr.report_date,
                    rr.clinical_history, rr.technique, rr.comparison,
                    rr.findings, rr.impression, rr.conclusion,
                    rr.is_critical, rr.is_abnormal,
                    rr.status, rr.version, rr.parent_report_id,
                    rr.template_used, rr.dictation_time, rr.transcription_time,
                    rr.reviewed_by, rr.reviewed_at,
                    rr.verified_by, rr.verified_at,
                    rr.report_pdf_url, rr.report_html_url,
                    rr.created_at, rr.updated_at,
                    ri.image_number, ri.image_type, ri.modality,
                    ri.body_part, ri.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    rad.first_name as radiologist_first_name,
                    rad.last_name as radiologist_last_name,
                    rev.username as reviewed_by_name,
                    ver.username as verified_by_name
                FROM radiology_reports rr
                JOIN radiology_images ri ON rr.image_id = ri.id
                JOIN patients p ON ri.patient_id = p.id
                LEFT JOIN employees rad ON rr.radiologist_id = rad.id
                LEFT JOIN users rev ON rr.reviewed_by = rev.id
                LEFT JOIN users ver ON rr.verified_by = ver.id
                WHERE rr.id = $1 AND rr.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Radiology report found by ID', { reportId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding radiology report by ID', {
                error: error.message,
                reportId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find report by report number
     * @param {string} reportNumber - Report number
     * @returns {Promise<Object|null>} Report object or null
     */
    async findByNumber(reportNumber) {
        try {
            const query = `
                SELECT 
                    rr.id, rr.report_number, rr.image_id,
                    rr.status, rr.version, rr.report_date,
                    rr.created_at
                FROM radiology_reports rr
                WHERE rr.report_number = $1 AND rr.is_deleted = false
            `;

            const result = await db.query(query, [reportNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Radiology report found by number', { reportNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding radiology report by number', {
                error: error.message,
                reportNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find report by image ID
     * @param {string} imageId - Radiology image UUID
     * @returns {Promise<Object|null>} Report object or null
     */
    async findByImageId(imageId) {
        try {
            const query = `
                SELECT 
                    rr.id, rr.report_number, rr.image_id,
                    rr.radiologist_id, rr.report_date,
                    rr.clinical_history, rr.technique, rr.comparison,
                    rr.findings, rr.impression, rr.conclusion,
                    rr.is_critical, rr.is_abnormal,
                    rr.status, rr.version, rr.parent_report_id,
                    rr.report_pdf_url, rr.report_html_url,
                    rr.created_at, rr.updated_at,
                    rad.first_name as radiologist_first_name,
                    rad.last_name as radiologist_last_name
                FROM radiology_reports rr
                LEFT JOIN employees rad ON rr.radiologist_id = rad.id
                WHERE rr.image_id = $1 AND rr.is_deleted = false
                ORDER BY rr.version DESC
                LIMIT 1
            `;

            const result = await db.query(query, [imageId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Radiology report found by image ID', { imageId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding radiology report by image ID', {
                error: error.message,
                imageId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find reports by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of reports
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['rr.is_deleted = false'];

            if (from_date) {
                conditions.push(`rr.report_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`rr.report_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    rr.id, rr.report_number, rr.image_id,
                    rr.radiologist_id, rr.report_date,
                    rr.findings, rr.impression, rr.conclusion,
                    rr.is_critical, rr.is_abnormal,
                    rr.status, rr.version,
                    ri.image_type, ri.modality, ri.body_part,
                    rad.first_name as radiologist_first_name,
                    rad.last_name as radiologist_last_name
                FROM radiology_reports rr
                JOIN radiology_images ri ON rr.image_id = ri.id
                LEFT JOIN employees rad ON rr.radiologist_id = rad.id
                ${whereClause}
                ORDER BY rr.report_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Radiology reports found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology reports by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find reports by radiologist ID
     * @param {string} radiologistId - Radiologist UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of reports
     */
    async findByRadiologistId(radiologistId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, from_date, to_date } = options;
            const values = [radiologistId];
            let paramIndex = 2;
            const conditions = ['rr.is_deleted = false'];

            if (status) {
                conditions.push(`rr.status = $${paramIndex++}`);
                values.push(status);
            }
            if (from_date) {
                conditions.push(`rr.report_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`rr.report_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    rr.id, rr.report_number, rr.image_id,
                    rr.report_date, rr.findings, rr.impression,
                    rr.status, rr.version,
                    ri.image_type, ri.modality, ri.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM radiology_reports rr
                JOIN radiology_images ri ON rr.image_id = ri.id
                JOIN patients p ON ri.patient_id = p.id
                ${whereClause}
                ORDER BY rr.report_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Radiology reports found by radiologist ID', {
                radiologistId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology reports by radiologist ID', {
                error: error.message,
                radiologistId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new radiology report
     * @param {Object} reportData - Report data
     * @returns {Promise<Object>} Created report
     */
    async create(reportData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existingReport = await this.findByImageId(reportData.image_id);
            if (existingReport) {
                throw new Error('Report already exists for this image');
            }

            const reportNumber = await this.generateReportNumber();

            const query = `
                INSERT INTO radiology_reports (
                    id, report_number, image_id, radiologist_id,
                    report_date, clinical_history, technique,
                    comparison, findings, impression, conclusion,
                    is_critical, is_abnormal,
                    status, version, template_used,
                    dictation_time, transcription_time,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    COALESCE($4, NOW()), $5, $6, $7,
                    $8, $9, $10,
                    COALESCE($11, false), COALESCE($12, false),
                    COALESCE($13, 'draft'), 1, $14,
                    $15, $16,
                    $17, NOW(), NOW()
                )
                RETURNING 
                    id, report_number, image_id, radiologist_id,
                    report_date, status, version, created_at
            `;

            const values = [
                reportNumber,
                reportData.image_id,
                reportData.radiologist_id,
                reportData.report_date || null,
                reportData.clinical_history || null,
                reportData.technique || null,
                reportData.comparison || null,
                reportData.findings || null,
                reportData.impression || null,
                reportData.conclusion || null,
                reportData.is_critical,
                reportData.is_abnormal,
                reportData.status,
                reportData.template_used || null,
                reportData.dictation_time || null,
                reportData.transcription_time || null,
                reportData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Radiology report created successfully', {
                reportId: result.rows[0].id,
                reportNumber: result.rows[0].report_number,
                imageId: reportData.image_id,
                radiologistId: reportData.radiologist_id
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating radiology report', {
                error: error.message,
                imageId: reportData.image_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update radiology report
     * @param {string} id - Report ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated report
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const report = await this.findById(id);
            if (!report) {
                throw new Error('Report not found');
            }

            const allowedFields = [
                'clinical_history', 'technique', 'comparison',
                'findings', 'impression', 'conclusion',
                'is_critical', 'is_abnormal', 'status',
                'template_used', 'dictation_time', 'transcription_time',
                'report_pdf_url', 'report_html_url',
                'reviewed_by', 'reviewed_at',
                'verified_by', 'verified_at'
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
                UPDATE radiology_reports 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, report_number, status,
                    findings, impression, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Report not found');
            }

            await db.commitTransaction(client);

            logger.info('Radiology report updated', {
                reportId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating radiology report', {
                error: error.message,
                reportId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Submit report (change status to preliminary or final)
     * @param {string} id - Report ID
     * @param {string} status - New status (preliminary/final)
     * @param {string} submittedBy - User who submitted
     * @returns {Promise<Object>} Updated report
     */
    async submit(id, status, submittedBy) {
        if (!['preliminary', 'final'].includes(status)) {
            throw new Error('Invalid status. Must be preliminary or final');
        }

        return this.update(id, {
            status: status,
            updated_by: submittedBy
        });
    },

    /**
     * Review report
     * @param {string} id - Report ID
     * @param {string} reviewerId - User who reviewed
     * @param {string} notes - Review notes (optional)
     * @returns {Promise<Object>} Updated report
     */
    async review(id, reviewerId, notes = null) {
        return this.update(id, {
            reviewed_by: reviewerId,
            reviewed_at: new Date(),
            notes: notes,
            updated_by: reviewerId
        });
    },

    /**
     * Verify report
     * @param {string} id - Report ID
     * @param {string} verifierId - User who verified
     * @returns {Promise<Object>} Updated report
     */
    async verify(id, verifierId) {
        return this.update(id, {
            status: 'verified',
            verified_by: verifierId,
            verified_at: new Date(),
            updated_by: verifierId
        });
    },

    /**
     * Amend report (create new version)
     * @param {string} id - Report ID to amend
     * @param {Object} amendments - Amendment data
     * @param {string} amendedBy - User who amended
     * @returns {Promise<Object>} New amended report
     */
    async amend(id, amendments, amendedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const originalReport = await this.findById(id);
            if (!originalReport) {
                throw new Error('Original report not found');
            }

            const newReportNumber = await this.generateReportNumber();

            const query = `
                INSERT INTO radiology_reports (
                    id, report_number, image_id, radiologist_id,
                    report_date, clinical_history, technique,
                    comparison, findings, impression, conclusion,
                    is_critical, is_abnormal,
                    status, version, parent_report_id,
                    template_used, dictation_time, transcription_time,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    NOW(), COALESCE($4, $5), COALESCE($6, $7),
                    COALESCE($8, $9), COALESCE($10, $11),
                    COALESCE($12, $13), COALESCE($14, $15),
                    COALESCE($16, $17), COALESCE($18, $19),
                    'amended', $20, $21,
                    $22, $23, $24,
                    $25, NOW(), NOW()
                )
                RETURNING 
                    id, report_number, status, version,
                    parent_report_id, created_at
            `;

            const values = [
                newReportNumber,
                originalReport.image_id,
                originalReport.radiologist_id,
                amendments.clinical_history,
                originalReport.clinical_history,
                amendments.technique,
                originalReport.technique,
                amendments.comparison,
                originalReport.comparison,
                amendments.findings,
                originalReport.findings,
                amendments.impression,
                originalReport.impression,
                amendments.conclusion,
                originalReport.conclusion,
                amendments.is_critical,
                originalReport.is_critical,
                amendments.is_abnormal,
                originalReport.is_abnormal,
                originalReport.version + 1,
                originalReport.id,
                originalReport.template_used,
                originalReport.dictation_time,
                originalReport.transcription_time,
                amendedBy
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Radiology report amended', {
                originalReportId: id,
                newReportId: result.rows[0].id,
                newVersion: originalReport.version + 1,
                amendedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error amending radiology report', {
                error: error.message,
                reportId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get report statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND report_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_reports,
                    COUNT(DISTINCT radiologist_id) as radiologists,
                    COUNT(DISTINCT image_id) as unique_images,
                    COUNT(*) FILTER (WHERE status = 'draft') as draft,
                    COUNT(*) FILTER (WHERE status = 'preliminary') as preliminary,
                    COUNT(*) FILTER (WHERE status = 'final') as final,
                    COUNT(*) FILTER (WHERE status = 'amended') as amended,
                    COUNT(*) FILTER (WHERE status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE is_critical = true) as critical,
                    COUNT(*) FILTER (WHERE is_abnormal = true) as abnormal,
                    AVG(version)::numeric(10,2) as avg_versions,
                    AVG(dictation_time)::numeric(10,2) as avg_dictation_time,
                    AVG(transcription_time)::numeric(10,2) as avg_transcription_time,
                    AVG(EXTRACT(EPOCH FROM (verified_at - report_date))/3600)::numeric(10,2) as avg_verification_hours
                FROM radiology_reports
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Radiology report statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting radiology report statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending reports (draft or preliminary)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of pending reports
     */
    async getPendingReports(options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    rr.id, rr.report_number, rr.image_id,
                    rr.radiologist_id, rr.report_date,
                    rr.status, rr.version,
                    ri.image_type, ri.modality, ri.patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    rad.first_name as radiologist_first_name,
                    rad.last_name as radiologist_last_name
                FROM radiology_reports rr
                JOIN radiology_images ri ON rr.image_id = ri.id
                JOIN patients p ON ri.patient_id = p.id
                LEFT JOIN employees rad ON rr.radiologist_id = rad.id
                WHERE rr.status IN ('draft', 'preliminary')
                    AND rr.is_deleted = false
                ORDER BY rr.report_date ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Pending reports retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending reports', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete radiology report
     * @param {string} id - Report ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_reports 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Radiology report not found');
            }

            await db.commitTransaction(client);

            logger.info('Radiology report soft deleted', {
                reportId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting radiology report', {
                error: error.message,
                reportId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = RadiologyReport;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */