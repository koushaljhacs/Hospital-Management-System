/**
 * ======================================================================
 * FILE: backend/src/controllers/radiologist/imageController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist image controller - Handles radiology image management.
 * Total Endpoints: 10
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-20
 * 
 * BUSINESS RULES:
 * - [BR-41] Critical findings require immediate notification
 * - [BR-43] Images must be reviewed within 24 hours
 * - [BR-45] Radiation dose must be documented
 * 
 * ======================================================================
 */

const imageService = require('../../services/radiologist/imageService');
const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Radiologist Image Controller
 */
const imageController = {
    // ============================================
    // IMAGE LISTS
    // ============================================

    /**
     * Get all radiology images
     * GET /api/v1/radiology/images
     */
    async getAllImages(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                patient_id,
                order_id,
                image_type,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                patient_id,
                order_id,
                image_type,
                from_date,
                to_date
            };

            const images = await imageService.getAllImages(
                req.user.id,
                options
            );

            logger.info('Radiologist retrieved all images', {
                radiologistId: req.user.id,
                count: images.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Group by modality for summary
            const byModality = {};
            images.data?.forEach(img => {
                const modality = img.modality || 'unknown';
                if (!byModality[modality]) {
                    byModality[modality] = 0;
                }
                byModality[modality]++;
            });

            res.json({
                success: true,
                data: images.data,
                pagination: images.pagination,
                summary: {
                    total: images.summary?.total || 0,
                    total_size_mb: images.summary?.total_size_mb || 0,
                    by_modality: byModality,
                    pending_review: images.data?.filter(i => i.report_status === 'pending').length || 0,
                    reported: images.data?.filter(i => i.report_status === 'reported').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting all images', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending images (need review)
     * GET /api/v1/radiology/images/pending
     * 
     * BUSINESS RULE: [BR-43] Images must be reviewed within 24 hours
     */
    async getPendingImages(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const images = await imageService.getPendingImages(
                req.user.id,
                options
            );

            logger.info('Radiologist viewed pending images', {
                radiologistId: req.user.id,
                count: images.data?.length || 0
            });

            // [BR-43] Check for images pending > 24 hours
            const now = new Date();
            const overdueImages = images.data?.filter(img => {
                const uploadedAt = new Date(img.uploaded_at);
                const hoursSinceUpload = (now - uploadedAt) / (1000 * 60 * 60);
                return hoursSinceUpload > 24;
            }).length || 0;

            res.json({
                success: true,
                data: images.data,
                pagination: images.pagination,
                summary: {
                    total: images.summary?.total || 0,
                    overdue: overdueImages,
                    critical_findings: images.data?.filter(i => i.critical_finding).length || 0,
                    urgent_priority: images.data?.filter(i => i.priority === 'urgent').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending images', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get reported images
     * GET /api/v1/radiology/images/reported
     */
    async getReportedImages(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const images = await imageService.getReportedImages(
                req.user.id,
                options
            );

            logger.info('Radiologist viewed reported images', {
                radiologistId: req.user.id,
                count: images.data?.length || 0
            });

            res.json({
                success: true,
                data: images.data,
                pagination: images.pagination,
                summary: {
                    total: images.summary?.total || 0,
                    avg_review_time_hours: images.summary?.avg_review_time || 0,
                    with_critical_findings: images.data?.filter(i => i.critical_finding).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting reported images', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get image by ID
     * GET /api/v1/radiology/images/:id
     */
    async getImageById(req, res, next) {
        try {
            const { id } = req.params;

            const image = await imageService.getImageById(
                req.user.id,
                id
            );

            if (!image) {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }

            logger.info('Radiologist viewed image details', {
                radiologistId: req.user.id,
                imageId: id,
                patientId: image.patient_id,
                imageType: image.image_type
            });

            // [BR-43] Check if image is pending beyond 24 hours
            if (!image.reported_at && image.uploaded_at) {
                const uploadedAt = new Date(image.uploaded_at);
                const hoursSinceUpload = (Date.now() - uploadedAt) / (1000 * 60 * 60);
                image.is_overdue = hoursSinceUpload > 24;
                image.hours_pending = Math.floor(hoursSinceUpload);
            }

            // Get previous studies for comparison [BR-44]
            if (image.patient_id) {
                const previousStudies = await imageService.getPreviousStudies(
                    req.user.id,
                    image.patient_id,
                    image.id
                );
                image.previous_studies = previousStudies;
                image.has_previous_studies = previousStudies.length > 0;
            }

            res.json({
                success: true,
                data: image
            });
        } catch (error) {
            if (error.message === 'Image not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }
            logger.error('Error getting image by ID', {
                error: error.message,
                radiologistId: req.user.id,
                imageId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Upload image
     * POST /api/v1/radiology/images/upload
     * 
     * BUSINESS RULE: [BR-45] Radiation dose must be documented
     */
    async uploadImage(req, res, next) {
        try {
            const {
                order_id,
                image_type,
                modality,
                body_part,
                laterality,
                radiation_dose,
                dose_unit,
                contrast_used,
                contrast_type,
                contrast_volume,
                clinical_history,
                indication,
                technique,
                notes
            } = req.body;

            // Validate required fields
            if (!order_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Order ID is required'
                });
            }

            if (!image_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Image type is required'
                });
            }

            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'Image file is required'
                });
            }

            // [BR-45] Validate radiation dose documentation
            if (radiation_dose && !dose_unit) {
                return res.status(400).json({
                    success: false,
                    error: 'Dose unit is required when radiation dose is provided'
                });
            }

            // Process uploaded file
            const fileBuffer = req.file.buffer;
            const fileName = req.file.originalname;
            const fileSize = req.file.size;
            const mimeType = req.file.mimetype;

            // Determine if DICOM
            const isDicom = mimeType === 'application/dicom' || fileName.endsWith('.dcm');

            const image = await imageService.uploadImage(
                req.user.id,
                {
                    order_id,
                    image_type,
                    modality,
                    body_part,
                    laterality,
                    radiation_dose,
                    dose_unit,
                    contrast_used: contrast_used === 'true',
                    contrast_type,
                    contrast_volume,
                    clinical_history,
                    indication,
                    technique,
                    notes,
                    file_buffer: fileBuffer,
                    file_name: fileName,
                    file_size: fileSize,
                    mime_type: mimeType,
                    is_dicom: isDicom,
                    uploaded_at: new Date(),
                    uploaded_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Radiologist uploaded image', {
                radiologistId: req.user.id,
                imageId: image.id,
                orderId: order_id,
                imageType: image_type,
                fileSize: fileSize,
                isDicom
            });

            res.status(201).json({
                success: true,
                data: image,
                message: 'Image uploaded successfully'
            });
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }
            if (error.message === 'Order already has report') {
                return res.status(409).json({
                    success: false,
                    error: 'Cannot upload image after report is created'
                });
            }
            logger.error('Error uploading image', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Delete image
     * DELETE /api/v1/radiology/images/:id
     */
    async deleteImage(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const image = await imageService.getImageById(req.user.id, id);
            
            if (!image) {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }

            // Check if image is already reported
            if (image.reported_at) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete image that is already reported'
                });
            }

            const deleted = await imageService.deleteImage(
                req.user.id,
                id,
                {
                    reason,
                    deleted_at: new Date(),
                    deleted_by: req.user.id
                }
            );

            // Delete physical file from storage
            if (image.storage_path) {
                try {
                    await fs.unlink(image.storage_path);
                } catch (err) {
                    logger.warn('Failed to delete physical image file', {
                        path: image.storage_path,
                        error: err.message
                    });
                }
            }

            logger.info('Radiologist deleted image', {
                radiologistId: req.user.id,
                imageId: id,
                reason
            });

            res.json({
                success: true,
                data: deleted,
                message: 'Image deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Image not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }
            logger.error('Error deleting image', {
                error: error.message,
                radiologistId: req.user.id,
                imageId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Download image
     * GET /api/v1/radiology/images/:id/download
     */
    async downloadImage(req, res, next) {
        try {
            const { id } = req.params;
            const { format = 'original' } = req.query;

            const image = await imageService.getImageById(req.user.id, id);
            
            if (!image) {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }

            // Get image file path
            const filePath = await imageService.getImageFilePath(req.user.id, id, format);
            
            if (!filePath) {
                return res.status(404).json({
                    success: false,
                    error: 'Image file not found'
                });
            }

            // Set appropriate headers
            const fileName = `radiology_${id}_${image.image_type}.${format === 'original' ? 'dcm' : 'jpg'}`;
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Type', image.mime_type || 'application/octet-stream');

            // Stream file to response
            const fileStream = require('fs').createReadStream(filePath);
            fileStream.pipe(res);

            logger.info('Radiologist downloaded image', {
                radiologistId: req.user.id,
                imageId: id,
                format
            });

            fileStream.on('error', (err) => {
                logger.error('Error streaming image', {
                    error: err.message,
                    imageId: id
                });
                next(err);
            });
        } catch (error) {
            if (error.message === 'Image not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }
            logger.error('Error downloading image', {
                error: error.message,
                radiologistId: req.user.id,
                imageId: req.params.id
            });
            next(error);
        }
    },

    /**
     * View image (DICOM viewer)
     * GET /api/v1/radiology/images/:id/view
     */
    async viewImage(req, res, next) {
        try {
            const { id } = req.params;

            const image = await imageService.getImageById(req.user.id, id);
            
            if (!image) {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }

            // Get DICOM metadata for viewer
            const viewerData = await imageService.getDicomViewerData(
                req.user.id,
                id
            );

            logger.info('Radiologist viewed image in DICOM viewer', {
                radiologistId: req.user.id,
                imageId: id,
                isDicom: image.is_dicom
            });

            res.json({
                success: true,
                data: viewerData,
                image_info: {
                    id: image.id,
                    image_type: image.image_type,
                    modality: image.modality,
                    body_part: image.body_part,
                    uploaded_at: image.uploaded_at,
                    has_report: !!image.reported_at
                }
            });
        } catch (error) {
            if (error.message === 'Image not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }
            logger.error('Error viewing image', {
                error: error.message,
                radiologistId: req.user.id,
                imageId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Rotate image
     * PUT /api/v1/radiology/images/:id/rotate
     */
    async rotateImage(req, res, next) {
        try {
            const { id } = req.params;
            const { degrees, annotation } = req.body;

            if (!degrees) {
                return res.status(400).json({
                    success: false,
                    error: 'Rotation degrees are required'
                });
            }

            const validDegrees = [0, 90, 180, 270];
            if (!validDegrees.includes(parseInt(degrees))) {
                return res.status(400).json({
                    success: false,
                    error: 'Rotation must be 0, 90, 180, or 270 degrees'
                });
            }

            const rotated = await imageService.rotateImage(
                req.user.id,
                id,
                {
                    degrees: parseInt(degrees),
                    annotation,
                    rotated_at: new Date(),
                    rotated_by: req.user.id
                }
            );

            logger.info('Radiologist rotated image', {
                radiologistId: req.user.id,
                imageId: id,
                degrees
            });

            res.json({
                success: true,
                data: rotated,
                message: `Image rotated ${degrees} degrees`
            });
        } catch (error) {
            if (error.message === 'Image not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }
            logger.error('Error rotating image', {
                error: error.message,
                radiologistId: req.user.id,
                imageId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Annotate image
     * PUT /api/v1/radiology/images/:id/annotate
     */
    async annotateImage(req, res, next) {
        try {
            const { id } = req.params;
            const { annotation, coordinates, color, notes } = req.body;

            if (!annotation) {
                return res.status(400).json({
                    success: false,
                    error: 'Annotation text is required'
                });
            }

            const annotated = await imageService.annotateImage(
                req.user.id,
                id,
                {
                    annotation,
                    coordinates,
                    color: color || '#FF0000',
                    notes,
                    annotated_at: new Date(),
                    annotated_by: req.user.id
                }
            );

            logger.info('Radiologist annotated image', {
                radiologistId: req.user.id,
                imageId: id,
                annotationLength: annotation.length
            });

            res.json({
                success: true,
                data: annotated,
                message: 'Image annotated successfully'
            });
        } catch (error) {
            if (error.message === 'Image not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }
            logger.error('Error annotating image', {
                error: error.message,
                radiologistId: req.user.id,
                imageId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = imageController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Image Lists            | 3         | All images, pending, reported
 * Single Image           | 1         | Get by ID
 * Upload Operations      | 1         | Upload image
 * Delete Operations      | 1         | Delete image
 * Download/View          | 2         | Download, view (DICOM)
 * Image Processing       | 2         | Rotate, annotate
 * -----------------------|-----------|----------------------
 * TOTAL                  | 10        | Complete image management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-41] Critical findings flagged in image metadata
 * - [BR-43] Overdue detection for pending >24 hours
 * - [BR-44] Previous studies included for comparison
 * - [BR-45] Radiation dose validation
 * 
 * ======================================================================
 */