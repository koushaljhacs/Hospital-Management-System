/**
 * ======================================================================
 * FILE: backend/src/models/clinical/RadiologyImage.js
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
 * RadiologyImage model for database operations.
 * Handles all radiology imaging records for X-ray, MRI, CT, Ultrasound, etc.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: radiology_images
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - image_number: string (unique)
 * - accession_number: string (unique)
 * - patient_id: UUID (foreign key to patients)
 * - appointment_id: UUID (foreign key to appointments)
 * - doctor_id: UUID (foreign key to employees)
 * - image_type: enum (xray, mri, ct_scan, ultrasound, mammogram, fluoroscopy, angiography, pet_scan, bone_scan, nuclear_medicine, other)
 * - image_url: text
 * - thumbnail_url: text
 * - dicom_url: text
 * - image_metadata: jsonb
 * - image_size_bytes: integer
 * - image_dimensions: string
 * - image_format: string
 * - study_id: string
 * - study_description: text
 * - series_id: string
 * - series_number: integer
 * - instance_number: integer
 * - modality: string
 * - body_part: string
 * - laterality: string
 * - clinical_history: text
 * - indication: text
 * - technique: text
 * - comparison: text
 * - findings: text
 * - impression: text
 * - report_text: text
 * - report_status: enum (pending, preliminary, final, amended, cancelled, verified)
 * - report_url: text
 * - radiologist_id: UUID
 * - technician_id: UUID
 * - priority: enum (routine, urgent, stat, timed)
 * - is_emergency: boolean
 * - is_stat: boolean
 * - performed_at: timestamp
 * - uploaded_at: timestamp
 * - reported_at: timestamp
 * - is_critical: boolean
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

const RadiologyImage = {
    /**
     * Table name
     */
    tableName: 'radiology_images',

    /**
     * Valid image types
     */
    validImageTypes: [
        'xray', 'mri', 'ct_scan', 'ultrasound', 'mammogram',
        'fluoroscopy', 'angiography', 'pet_scan', 'bone_scan',
        'nuclear_medicine', 'other'
    ],

    /**
     * Valid report statuses
     */
    validReportStatuses: ['pending', 'preliminary', 'final', 'amended', 'cancelled', 'verified'],

    /**
     * Valid priorities
     */
    validPriorities: ['routine', 'urgent', 'stat', 'timed'],

    /**
     * Generate image number
     * @returns {Promise<string>} Generated image number
     */
    async generateImageNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM radiology_images
                WHERE image_number LIKE $1
            `;
            const result = await db.query(query, [`RAD-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `RAD-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating image number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find radiology image by ID
     * @param {string} id - Radiology image UUID
     * @returns {Promise<Object|null>} Radiology image object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ri.id, ri.image_number, ri.accession_number,
                    ri.patient_id, ri.appointment_id, ri.doctor_id,
                    ri.image_type, ri.image_url, ri.thumbnail_url,
                    ri.dicom_url, ri.image_metadata,
                    ri.image_size_bytes, ri.image_dimensions, ri.image_format,
                    ri.study_id, ri.study_description,
                    ri.series_id, ri.series_number, ri.instance_number,
                    ri.modality, ri.body_part, ri.laterality,
                    ri.clinical_history, ri.indication, ri.technique,
                    ri.comparison, ri.findings, ri.impression,
                    ri.report_text, ri.report_status, ri.report_url,
                    ri.radiologist_id, ri.technician_id,
                    ri.priority, ri.is_emergency, ri.is_stat,
                    ri.performed_at, ri.uploaded_at, ri.reported_at,
                    ri.is_critical, ri.created_at, ri.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    rad.first_name as radiologist_first_name,
                    rad.last_name as radiologist_last_name,
                    tech.first_name as technician_first_name,
                    tech.last_name as technician_last_name
                FROM radiology_images ri
                JOIN patients p ON ri.patient_id = p.id
                LEFT JOIN employees e ON ri.doctor_id = e.id
                LEFT JOIN employees rad ON ri.radiologist_id = rad.id
                LEFT JOIN employees tech ON ri.technician_id = tech.id
                WHERE ri.id = $1 AND ri.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Radiology image found by ID', { imageId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding radiology image by ID', {
                error: error.message,
                imageId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find radiology images by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of radiology images
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, image_type, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['ri.is_deleted = false'];

            if (image_type) {
                conditions.push(`ri.image_type = $${paramIndex++}`);
                values.push(image_type);
            }
            if (from_date) {
                conditions.push(`ri.performed_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`ri.performed_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    ri.id, ri.image_number, ri.accession_number,
                    ri.image_type, ri.image_url, ri.thumbnail_url,
                    ri.study_id, ri.study_description,
                    ri.modality, ri.body_part,
                    ri.report_status, ri.priority,
                    ri.performed_at, ri.uploaded_at, ri.reported_at,
                    ri.is_critical,
                    rad.first_name as radiologist_first_name,
                    rad.last_name as radiologist_last_name
                FROM radiology_images ri
                LEFT JOIN employees rad ON ri.radiologist_id = rad.id
                ${whereClause}
                ORDER BY ri.performed_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Radiology images found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology images by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find radiology images by study ID
     * @param {string} studyId - Study ID
     * @returns {Promise<Array>} List of radiology images
     */
    async findByStudyId(studyId) {
        try {
            const query = `
                SELECT 
                    ri.id, ri.image_number, ri.accession_number,
                    ri.image_type, ri.image_url, ri.thumbnail_url,
                    ri.series_id, ri.series_number, ri.instance_number,
                    ri.modality, ri.body_part, ri.laterality,
                    ri.report_status, ri.report_text,
                    ri.performed_at, ri.uploaded_at
                FROM radiology_images ri
                WHERE ri.study_id = $1 AND ri.is_deleted = false
                ORDER BY ri.series_number ASC, ri.instance_number ASC
            `;

            const result = await db.query(query, [studyId]);

            logger.debug('Radiology images found by study ID', {
                studyId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology images by study ID', {
                error: error.message,
                studyId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find radiology images by series ID
     * @param {string} seriesId - Series ID
     * @returns {Promise<Array>} List of radiology images
     */
    async findBySeriesId(seriesId) {
        try {
            const query = `
                SELECT 
                    ri.id, ri.image_number, ri.accession_number,
                    ri.image_type, ri.image_url, ri.thumbnail_url,
                    ri.instance_number, ri.image_metadata,
                    ri.performed_at
                FROM radiology_images ri
                WHERE ri.series_id = $1 AND ri.is_deleted = false
                ORDER BY ri.instance_number ASC
            `;

            const result = await db.query(query, [seriesId]);

            logger.debug('Radiology images found by series ID', {
                seriesId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology images by series ID', {
                error: error.message,
                seriesId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending reports (images without final report)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of pending images
     */
    async getPendingReports(options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    ri.id, ri.image_number, ri.accession_number,
                    ri.image_type, ri.patient_id, ri.doctor_id,
                    ri.modality, ri.body_part,
                    ri.priority, ri.is_emergency, ri.is_stat,
                    ri.performed_at, ri.uploaded_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM radiology_images ri
                JOIN patients p ON ri.patient_id = p.id
                LEFT JOIN employees e ON ri.doctor_id = e.id
                WHERE ri.report_status IN ('pending', 'preliminary')
                    AND ri.is_deleted = false
                ORDER BY 
                    CASE ri.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'timed' THEN 3
                        WHEN 'routine' THEN 4
                    END,
                    ri.performed_at ASC
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
     * Get critical findings (requires immediate attention)
     * @returns {Promise<Array>} List of critical findings
     */
    async getCriticalFindings() {
        try {
            const query = `
                SELECT 
                    ri.id, ri.image_number, ri.accession_number,
                    ri.image_type, ri.patient_id,
                    ri.findings, ri.impression,
                    ri.is_critical, ri.reported_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    rad.first_name as radiologist_first_name,
                    rad.last_name as radiologist_last_name
                FROM radiology_images ri
                JOIN patients p ON ri.patient_id = p.id
                LEFT JOIN employees rad ON ri.radiologist_id = rad.id
                WHERE ri.is_critical = true 
                    AND ri.report_status IN ('final', 'verified')
                    AND ri.is_deleted = false
                ORDER BY ri.reported_at DESC
            `;

            const result = await db.query(query);

            logger.debug('Critical findings retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting critical findings', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new radiology image record
     * @param {Object} imageData - Radiology image data
     * @returns {Promise<Object>} Created radiology image
     */
    async create(imageData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (!this.validImageTypes.includes(imageData.image_type)) {
                throw new Error(`Invalid image type. Must be one of: ${this.validImageTypes.join(', ')}`);
            }

            const imageNumber = await this.generateImageNumber();

            const query = `
                INSERT INTO radiology_images (
                    id, image_number, accession_number,
                    patient_id, appointment_id, doctor_id,
                    image_type, image_url, thumbnail_url,
                    dicom_url, image_metadata,
                    image_size_bytes, image_dimensions, image_format,
                    study_id, study_description,
                    series_id, series_number, instance_number,
                    modality, body_part, laterality,
                    clinical_history, indication,
                    priority, is_emergency, is_stat,
                    performed_at, uploaded_at,
                    technician_id,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    $6, $7, $8,
                    $9, $10,
                    $11, $12, $13,
                    $14, $15,
                    $16, $17, $18,
                    $19, $20, $21,
                    $22, $23,
                    COALESCE($24, 'routine'), COALESCE($25, false), COALESCE($26, false),
                    $27, NOW(),
                    $28,
                    $29, NOW(), NOW()
                )
                RETURNING 
                    id, image_number, accession_number,
                    patient_id, image_type, image_url,
                    study_id, series_id, modality,
                    priority, performed_at, created_at
            `;

            const values = [
                imageNumber,
                imageData.accession_number || null,
                imageData.patient_id,
                imageData.appointment_id || null,
                imageData.doctor_id || null,
                imageData.image_type,
                imageData.image_url,
                imageData.thumbnail_url || null,
                imageData.dicom_url || null,
                imageData.image_metadata || null,
                imageData.image_size_bytes || null,
                imageData.image_dimensions || null,
                imageData.image_format || null,
                imageData.study_id || null,
                imageData.study_description || null,
                imageData.series_id || null,
                imageData.series_number || null,
                imageData.instance_number || null,
                imageData.modality || null,
                imageData.body_part || null,
                imageData.laterality || null,
                imageData.clinical_history || null,
                imageData.indication || null,
                imageData.priority,
                imageData.is_emergency,
                imageData.is_stat,
                imageData.performed_at,
                imageData.technician_id || null,
                imageData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Radiology image record created successfully', {
                imageId: result.rows[0].id,
                imageNumber: result.rows[0].image_number,
                patientId: imageData.patient_id,
                imageType: imageData.image_type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating radiology image record', {
                error: error.message,
                patientId: imageData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update radiology image record
     * @param {string} id - Radiology image ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated radiology image
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'accession_number', 'image_url', 'thumbnail_url',
                'dicom_url', 'image_metadata', 'image_size_bytes',
                'image_dimensions', 'image_format', 'study_id',
                'study_description', 'series_id', 'series_number',
                'instance_number', 'modality', 'body_part', 'laterality',
                'clinical_history', 'indication', 'technique',
                'comparison', 'findings', 'impression', 'report_text',
                'report_status', 'report_url', 'radiologist_id',
                'priority', 'is_emergency', 'is_stat', 'performed_at',
                'reported_at', 'is_critical'
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
                UPDATE radiology_images 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, image_number, report_status,
                    report_text, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Radiology image not found');
            }

            await db.commitTransaction(client);

            logger.info('Radiology image record updated', {
                imageId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating radiology image', {
                error: error.message,
                imageId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Submit report for radiology image
     * @param {string} id - Radiology image ID
     * @param {Object} reportData - Report data
     * @returns {Promise<Object>} Updated radiology image
     */
    async submitReport(id, reportData) {
        const updates = {
            findings: reportData.findings,
            impression: reportData.impression,
            report_text: reportData.report_text,
            report_status: 'final',
            reported_at: new Date(),
            radiologist_id: reportData.radiologist_id,
            updated_by: reportData.radiologist_id
        };

        if (reportData.is_critical) {
            updates.is_critical = true;
        }

        return this.update(id, updates);
    },

    /**
     * Verify report
     * @param {string} id - Radiology image ID
     * @param {string} verifiedBy - User who verified
     * @returns {Promise<Object>} Updated radiology image
     */
    async verifyReport(id, verifiedBy) {
        return this.update(id, {
            report_status: 'verified',
            updated_by: verifiedBy
        });
    },

    /**
     * Get radiology image statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND performed_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_images,
                    COUNT(*) FILTER (WHERE image_type = 'xray') as xray,
                    COUNT(*) FILTER (WHERE image_type = 'mri') as mri,
                    COUNT(*) FILTER (WHERE image_type = 'ct_scan') as ct_scan,
                    COUNT(*) FILTER (WHERE image_type = 'ultrasound') as ultrasound,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT doctor_id) as referring_doctors,
                    COUNT(DISTINCT radiologist_id) as radiologists,
                    COUNT(*) FILTER (WHERE report_status = 'pending') as pending_reports,
                    COUNT(*) FILTER (WHERE report_status = 'preliminary') as preliminary,
                    COUNT(*) FILTER (WHERE report_status = 'final') as final,
                    COUNT(*) FILTER (WHERE report_status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE is_critical = true) as critical_findings,
                    COUNT(*) FILTER (WHERE priority = 'stat') as stat,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
                    AVG(EXTRACT(EPOCH FROM (reported_at - performed_at))/3600)::numeric(10,2) as avg_report_time_hours
                FROM radiology_images
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Radiology image statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting radiology image statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete radiology image
     * @param {string} id - Radiology image ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_images 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Radiology image not found');
            }

            await db.commitTransaction(client);

            logger.info('Radiology image soft deleted', {
                imageId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting radiology image', {
                error: error.message,
                imageId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = RadiologyImage;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */