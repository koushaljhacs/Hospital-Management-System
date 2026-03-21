/**
 * ======================================================================
 * FILE: backend/src/services/radiologist/imageService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist image service - Handles business logic for radiology images.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-41] Critical findings flagged in image metadata
 * - [BR-43] Images must be reviewed within 24 hours
 * - [BR-44] Previous studies for comparison
 * - [BR-45] Radiation dose must be documented
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const imageService = {
    /**
     * Get all images
     */
    async getAllImages(radiologistId, options = {}) {
        try {
            const { page = 1, limit = 20, status, patient_id, order_id, image_type, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT i.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       o.order_number,
                       o.priority,
                       o.is_emergency,
                       CASE 
                           WHEN i.reported_at IS NULL AND i.uploaded_at < NOW() - INTERVAL '24 hours' THEN true
                           ELSE false
                       END as is_overdue,
                       EXTRACT(EPOCH FROM (NOW() - i.uploaded_at))/3600 as hours_pending
                FROM radiology_images i
                JOIN radiology_orders o ON i.order_id = o.id
                JOIN patients p ON o.patient_id = p.id
                WHERE i.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status === 'pending') {
                query += ` AND i.reported_at IS NULL`;
            } else if (status === 'reported') {
                query += ` AND i.reported_at IS NOT NULL`;
            }

            if (patient_id) {
                query += ` AND o.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (order_id) {
                query += ` AND i.order_id = $${paramIndex}`;
                values.push(order_id);
                paramIndex++;
            }

            if (image_type) {
                query += ` AND i.image_type = $${paramIndex}`;
                values.push(image_type);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND i.uploaded_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND i.uploaded_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY 
                          CASE o.priority
                              WHEN 'stat' THEN 1
                              WHEN 'urgent' THEN 2
                              ELSE 3
                          END,
                          i.uploaded_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(i.file_size) as total_size_bytes,
                    COUNT(*) FILTER (WHERE i.reported_at IS NULL) as pending_count,
                    COUNT(*) FILTER (WHERE i.reported_at IS NOT NULL) as reported_count
                FROM radiology_images i
                WHERE i.is_deleted = false
                ${patient_id ? 'AND order_id IN (SELECT id FROM radiology_orders WHERE patient_id = $1)' : ''}
            `;
            const countValues = patient_id ? [patient_id] : [];
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0]?.total || 0),
                    total_size_mb: Math.round((count.rows[0]?.total_size_bytes || 0) / (1024 * 1024)),
                    pending: parseInt(count.rows[0]?.pending_count || 0),
                    reported: parseInt(count.rows[0]?.reported_count || 0)
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getAllImages', { error: error.message, radiologistId });
            throw error;
        }
    },

    /**
     * Get pending images
     */
    async getPendingImages(radiologistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT i.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       o.order_number,
                       o.priority,
                       o.is_emergency,
                       EXTRACT(EPOCH FROM (NOW() - i.uploaded_at))/3600 as hours_pending,
                       CASE 
                           WHEN i.uploaded_at < NOW() - INTERVAL '24 hours' THEN true
                           ELSE false
                       END as is_overdue
                FROM radiology_images i
                JOIN radiology_orders o ON i.order_id = o.id
                JOIN patients p ON o.patient_id = p.id
                WHERE i.reported_at IS NULL 
                    AND i.is_deleted = false
                    AND o.is_deleted = false
                ORDER BY 
                    CASE o.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        ELSE 3
                    END,
                    i.uploaded_at ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE uploaded_at < NOW() - INTERVAL '24 hours') as overdue_count
                FROM radiology_images i
                JOIN radiology_orders o ON i.order_id = o.id
                WHERE i.reported_at IS NULL 
                    AND i.is_deleted = false
                    AND o.is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0]?.total || 0),
                    overdue: parseInt(count.rows[0]?.overdue_count || 0)
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getPendingImages', { error: error.message, radiologistId });
            throw error;
        }
    },

    /**
     * Get reported images
     */
    async getReportedImages(radiologistId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT i.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       o.order_number,
                       EXTRACT(EPOCH FROM (i.reported_at - i.uploaded_at))/3600 as review_time_hours
                FROM radiology_images i
                JOIN radiology_orders o ON i.order_id = o.id
                JOIN patients p ON o.patient_id = p.id
                WHERE i.reported_at IS NOT NULL 
                    AND i.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                query += ` AND i.reported_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND i.reported_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY i.reported_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const avgQuery = `
                SELECT AVG(EXTRACT(EPOCH FROM (reported_at - uploaded_at))/3600)::numeric(10,2) as avg_review_time
                FROM radiology_images
                WHERE reported_at IS NOT NULL 
                    AND is_deleted = false
                    ${from_date ? 'AND reported_at >= $1' : ''}
                    ${to_date ? 'AND reported_at <= $2' : ''}
            `;
            const avgValues = [];
            if (from_date) avgValues.push(from_date);
            if (to_date) avgValues.push(to_date);
            const avg = await db.query(avgQuery, avgValues);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM radiology_images
                WHERE reported_at IS NOT NULL AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0]?.total || 0),
                    avg_review_time: parseFloat(avg.rows[0]?.avg_review_time || 0)
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getReportedImages', { error: error.message, radiologistId });
            throw error;
        }
    },

    /**
     * Get image by ID
     */
    async getImageById(radiologistId, imageId) {
        try {
            const query = `
                SELECT i.*, 
                       o.id as order_id,
                       o.order_number,
                       o.priority,
                       o.is_emergency,
                       o.ordered_at,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       d.id as doctor_id,
                       d.first_name as doctor_first_name,
                       d.last_name as doctor_last_name,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', a.id,
                                   'annotation', a.annotation,
                                   'coordinates', a.coordinates,
                                   'color', a.color,
                                   'created_at', a.created_at,
                                   'created_by', CONCAT(u.first_name, ' ', u.last_name)
                               ) ORDER BY a.created_at DESC
                           )
                           FROM radiology_image_annotations a
                           LEFT JOIN users u ON a.created_by = u.id
                           WHERE a.image_id = i.id AND a.is_deleted = false
                       ) as annotations
                FROM radiology_images i
                JOIN radiology_orders o ON i.order_id = o.id
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                WHERE i.id = $1 AND i.is_deleted = false
            `;

            const result = await db.query(query, [imageId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getImageById', { error: error.message, radiologistId, imageId });
            throw error;
        }
    },

    /**
     * Get previous studies for comparison [BR-44]
     */
    async getPreviousStudies(radiologistId, patientId, currentImageId) {
        try {
            const query = `
                SELECT i.id,
                       i.image_type,
                       i.modality,
                       i.body_part,
                       i.uploaded_at,
                       i.reported_at,
                       r.findings,
                       r.impression
                FROM radiology_images i
                JOIN radiology_orders o ON i.order_id = o.id
                LEFT JOIN radiology_reports r ON i.order_id = r.order_id AND r.status = 'final'
                WHERE o.patient_id = $1 
                    AND i.id != $2
                    AND i.is_deleted = false
                ORDER BY i.uploaded_at DESC
                LIMIT 10
            `;

            const result = await db.query(query, [patientId, currentImageId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPreviousStudies', { error: error.message, radiologistId, patientId });
            throw error;
        }
    },

    /**
     * Upload image
     */
    async uploadImage(radiologistId, imageData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if order exists and is valid
            const orderCheck = await client.query(`
                SELECT id, status FROM radiology_orders 
                WHERE id = $1 AND is_deleted = false
            `, [imageData.order_id]);

            if (orderCheck.rows.length === 0) {
                throw new Error('Order not found');
            }

            if (orderCheck.rows[0].status === 'completed') {
                throw new Error('Order already has report');
            }

            // Generate image number
            const imageNumber = `IMG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // Save file to storage
            const storagePath = await this._saveImageFile(imageData);

            const query = `
                INSERT INTO radiology_images (
                    id, image_number, order_id, image_type, modality,
                    body_part, laterality, image_url, storage_path,
                    file_name, file_size, mime_type, is_dicom,
                    radiation_dose, dose_unit, contrast_used, contrast_type,
                    contrast_volume, clinical_history, indication, technique,
                    notes, uploaded_at, uploaded_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
                    $20, $21, $22, $23, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                imageNumber,
                imageData.order_id,
                imageData.image_type,
                imageData.modality,
                imageData.body_part,
                imageData.laterality,
                imageData.file_url || storagePath,
                storagePath,
                imageData.file_name,
                imageData.file_size,
                imageData.mime_type,
                imageData.is_dicom || false,
                imageData.radiation_dose,
                imageData.dose_unit,
                imageData.contrast_used || false,
                imageData.contrast_type,
                imageData.contrast_volume,
                imageData.clinical_history,
                imageData.indication,
                imageData.technique,
                imageData.notes,
                imageData.uploaded_at,
                imageData.uploaded_by
            ];

            const result = await client.query(query, values);

            // Update order status if pending
            if (orderCheck.rows[0].status === 'pending') {
                await client.query(`
                    UPDATE radiology_orders 
                    SET status = 'in_progress',
                        updated_at = NOW()
                    WHERE id = $1
                `, [imageData.order_id]);
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
     * Delete image
     */
    async deleteImage(radiologistId, imageId, deleteData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_images 
                SET is_deleted = true,
                    deleted_at = $1,
                    deleted_by = $2,
                    deletion_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 AND reported_at IS NULL
                RETURNING storage_path
            `;

            const values = [
                deleteData.deleted_at,
                deleteData.deleted_by,
                deleteData.reason,
                imageId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Image not found or already reported');
            }

            await db.commitTransaction(client);

            return { id: imageId, deleted: true };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get image file path
     */
    async getImageFilePath(radiologistId, imageId, format = 'original') {
        try {
            const query = `
                SELECT storage_path, file_name, mime_type
                FROM radiology_images
                WHERE id = $1 AND is_deleted = false
            `;
            const result = await db.query(query, [imageId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0].storage_path;
        } catch (error) {
            logger.error('Error in getImageFilePath', { error: error.message, radiologistId, imageId });
            throw error;
        }
    },

    /**
     * Get DICOM viewer data
     */
    async getDicomViewerData(radiologistId, imageId) {
        try {
            const query = `
                SELECT i.id, i.image_number, i.image_type, i.modality,
                       i.body_part, i.laterality, i.storage_path,
                       i.radiation_dose, i.dose_unit,
                       i.contrast_used, i.contrast_type,
                       i.clinical_history, i.indication,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       r.findings, r.impression
                FROM radiology_images i
                JOIN radiology_orders o ON i.order_id = o.id
                JOIN patients p ON o.patient_id = p.id
                LEFT JOIN radiology_reports r ON o.id = r.order_id AND r.status = 'final'
                WHERE i.id = $1 AND i.is_deleted = false
            `;

            const result = await db.query(query, [imageId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getDicomViewerData', { error: error.message, radiologistId, imageId });
            throw error;
        }
    },

    /**
     * Rotate image
     */
    async rotateImage(radiologistId, imageId, rotateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_images 
                SET rotation = $1,
                    rotation_updated_at = $2,
                    rotation_updated_by = $3,
                    rotation_notes = $4,
                    updated_at = NOW()
                WHERE id = $5 AND is_deleted = false
                RETURNING *
            `;

            const values = [
                rotateData.degrees,
                rotateData.rotated_at,
                rotateData.rotated_by,
                rotateData.annotation,
                imageId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Image not found');
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
     * Annotate image
     */
    async annotateImage(radiologistId, imageId, annotationData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO radiology_image_annotations (
                    id, image_id, annotation, coordinates, color,
                    notes, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
                ) RETURNING *
            `;

            const values = [
                imageId,
                annotationData.annotation,
                annotationData.coordinates ? JSON.stringify(annotationData.coordinates) : null,
                annotationData.color,
                annotationData.notes,
                radiologistId,
                annotationData.annotated_at
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
     * Save image file to storage
     * @private
     */
    async _saveImageFile(imageData) {
        try {
            const uploadDir = path.join(__dirname, '../../../uploads/radiology');
            await fs.mkdir(uploadDir, { recursive: true });

            const fileName = `${Date.now()}_${imageData.file_name}`;
            const filePath = path.join(uploadDir, fileName);

            await fs.writeFile(filePath, imageData.file_buffer);

            return filePath;
        } catch (error) {
            logger.error('Error saving image file', { error: error.message });
            throw error;
        }
    }
};

module.exports = imageService;