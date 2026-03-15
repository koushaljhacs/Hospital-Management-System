/**
 * ======================================================================
 * FILE: backend/src/controllers/doctor/radiologyController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor's radiology order management controller.
 * Allows doctors to order radiology scans and view images/reports.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-41] Images must be uploaded within 24 hours
 * - [BR-42] Report must be completed within 48 hours
 * - [BR-43] Urgent findings require immediate call
 * 
 * ENDPOINTS:
 * GET    /doctor/radiology-orders                    - All radiology orders
 * GET    /doctor/radiology-orders/pending              - Pending orders
 * GET    /doctor/radiology-orders/completed             - Completed orders
 * GET    /doctor/radiology-orders/urgent                 - Urgent orders
 * GET    /doctor/radiology-orders/:id                      - Get order by ID
 * POST   /doctor/radiology-orders                            - Create radiology order
 * PUT    /doctor/radiology-orders/:id                         - Update order
 * DELETE /doctor/radiology-orders/:id                          - Delete order
 * GET    /doctor/radiology-orders/:id/images                    - Get images
 * GET    /doctor/radiology-orders/:id/report                     - Get report
 * GET    /doctor/radiology-orders/:id/images/:imageId/download   - Download image
 * GET    /doctor/radiology-types                                   - Available scan types
 * GET    /doctor/body-parts                                         - Body parts list
 * POST   /doctor/radiology-orders/:id/cancel                        - Cancel order
 * GET    /doctor/radiology-orders/stats                              - Order statistics
 * 
 * ======================================================================
 */

const radiologyService = require('../../services/doctor/radiologyService');
const logger = require('../../utils/logger');

/**
 * Doctor Radiology Controller
 */
const radiologyController = {
    // ============================================
    // RADIOLOGY ORDER LISTS
    // ============================================

    /**
     * Get all radiology orders
     * GET /api/v1/doctor/radiology-orders
     */
    async getRadiologyOrders(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                patient_id,
                status,
                from_date,
                to_date,
                image_type,
                priority
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id,
                status,
                from_date,
                to_date,
                image_type,
                priority
            };

            const orders = await radiologyService.getRadiologyOrders(
                req.user.id,
                options
            );

            logger.info('Doctor retrieved radiology orders', {
                doctorId: req.user.id,
                count: orders.data?.length || 0
            });

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination
            });
        } catch (error) {
            logger.error('Error getting radiology orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending radiology orders
     * GET /api/v1/doctor/radiology-orders/pending
     */
    async getPendingRadiologyOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const orders = await radiologyService.getPendingRadiologyOrders(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination
            });
        } catch (error) {
            logger.error('Error getting pending radiology orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed radiology orders
     * GET /api/v1/doctor/radiology-orders/completed
     */
    async getCompletedRadiologyOrders(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const orders = await radiologyService.getCompletedRadiologyOrders(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: orders.data,
                pagination: orders.pagination
            });
        } catch (error) {
            logger.error('Error getting completed radiology orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get urgent radiology orders
     * GET /api/v1/doctor/radiology-orders/urgent
     * 
     * BUSINESS RULE: [BR-43] Urgent findings require immediate attention
     */
    async getUrgentRadiologyOrders(req, res, next) {
        try {
            const orders = await radiologyService.getUrgentRadiologyOrders(
                req.user.id
            );

            res.json({
                success: true,
                data: orders,
                count: orders.length
            });
        } catch (error) {
            logger.error('Error getting urgent radiology orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get radiology order by ID
     * GET /api/v1/doctor/radiology-orders/:id
     */
    async getRadiologyOrderById(req, res, next) {
        try {
            const { id } = req.params;

            const order = await radiologyService.getRadiologyOrderById(
                req.user.id,
                id
            );

            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology order not found'
                });
            }

            logger.info('Doctor viewed radiology order', {
                doctorId: req.user.id,
                orderId: id
            });

            res.json({
                success: true,
                data: order
            });
        } catch (error) {
            if (error.message === 'Radiology order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology order not found'
                });
            }
            logger.error('Error getting radiology order by ID', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // CREATE/UPDATE RADIOLOGY ORDERS
    // ============================================

    /**
     * Create new radiology order
     * POST /api/v1/doctor/radiology-orders
     */
    async createRadiologyOrder(req, res, next) {
        try {
            const {
                patient_id,
                appointment_id,
                image_type,
                body_part,
                laterality,
                priority,
                clinical_history,
                indication,
                contrast_required,
                contrast_type,
                special_instructions,
                is_urgent,
                is_stat
            } = req.body;

            // Validate required fields
            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!image_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Image type is required'
                });
            }

            if (!body_part) {
                return res.status(400).json({
                    success: false,
                    error: 'Body part is required'
                });
            }

            if (!clinical_history) {
                return res.status(400).json({
                    success: false,
                    error: 'Clinical history is required'
                });
            }

            // Validate contrast requirements
            if (contrast_required && !contrast_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Contrast type is required when contrast is needed'
                });
            }

            const order = await radiologyService.createRadiologyOrder(
                req.user.id,
                {
                    patient_id,
                    appointment_id,
                    image_type,
                    body_part,
                    laterality: laterality || 'not_applicable',
                    priority: priority || 'routine',
                    clinical_history,
                    indication,
                    contrast_required: contrast_required || false,
                    contrast_type,
                    special_instructions,
                    is_urgent: is_urgent || false,
                    is_stat: is_stat || false,
                    ordered_at: new Date()
                }
            );

            logger.info('Doctor created radiology order', {
                doctorId: req.user.id,
                orderId: order.id,
                patientId: patient_id,
                imageType: image_type,
                bodyPart: body_part,
                priority: priority
            });

            // [BR-43] Notify radiology dept if urgent
            if (is_urgent || is_stat) {
                await radiologyService.notifyRadiologyOfUrgentOrder(order.id);
            }

            res.status(201).json({
                success: true,
                data: order,
                message: 'Radiology order created successfully'
            });
        } catch (error) {
            logger.error('Error creating radiology order', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.body.patient_id
            });
            next(error);
        }
    },

    /**
     * Update radiology order
     * PUT /api/v1/doctor/radiology-orders/:id
     */
    async updateRadiologyOrder(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Check if order can be updated
            const order = await radiologyService.getRadiologyOrderById(req.user.id, id);
            
            if (order && order.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update order that is already processed'
                });
            }

            const updated = await radiologyService.updateRadiologyOrder(
                req.user.id,
                id,
                updates
            );

            logger.info('Doctor updated radiology order', {
                doctorId: req.user.id,
                orderId: id
            });

            res.json({
                success: true,
                data: updated,
                message: 'Radiology order updated successfully'
            });
        } catch (error) {
            if (error.message === 'Radiology order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology order not found'
                });
            }
            logger.error('Error updating radiology order', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete radiology order (only if pending)
     * DELETE /api/v1/doctor/radiology-orders/:id
     */
    async deleteRadiologyOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await radiologyService.deleteRadiologyOrder(
                req.user.id,
                id,
                reason
            );

            logger.info('Doctor deleted radiology order', {
                doctorId: req.user.id,
                orderId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Radiology order deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Radiology order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology order not found'
                });
            }
            if (error.message === 'Cannot delete processed order') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error deleting radiology order', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Cancel radiology order
     * POST /api/v1/doctor/radiology-orders/:id/cancel
     */
    async cancelRadiologyOrder(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Cancellation reason is required'
                });
            }

            const order = await radiologyService.cancelRadiologyOrder(
                req.user.id,
                id,
                reason
            );

            logger.info('Doctor cancelled radiology order', {
                doctorId: req.user.id,
                orderId: id,
                reason
            });

            res.json({
                success: true,
                data: order,
                message: 'Radiology order cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Radiology order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology order not found'
                });
            }
            if (error.message === 'Cannot cancel completed order') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error cancelling radiology order', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // RADIOLOGY IMAGES & REPORTS
    // ============================================

    /**
     * Get images for an order
     * GET /api/v1/doctor/radiology-orders/:id/images
     * 
     * BUSINESS RULE: [BR-41] Images uploaded within 24 hours
     */
    async getRadiologyImages(req, res, next) {
        try {
            const { id } = req.params;

            const images = await radiologyService.getRadiologyImages(
                req.user.id,
                id
            );

            if (!images) {
                return res.status(404).json({
                    success: false,
                    error: 'Images not found'
                });
            }

            logger.info('Doctor viewed radiology images', {
                doctorId: req.user.id,
                orderId: id,
                imageCount: images.length
            });

            // Check upload timing [BR-41]
            const lateUploads = images.filter(img => {
                const uploadTime = new Date(img.uploaded_at);
                const orderTime = new Date(img.ordered_at);
                const hoursDiff = (uploadTime - orderTime) / (1000 * 60 * 60);
                return hoursDiff > 24;
            });

            if (lateUploads.length > 0) {
                logger.warn('Images uploaded after 24 hours', {
                    orderId: id,
                    lateCount: lateUploads.length
                });
            }

            res.json({
                success: true,
                data: images,
                summary: {
                    total: images.length,
                    with_report: images.filter(i => i.report_status === 'completed').length,
                    pending_report: images.filter(i => i.report_status === 'pending').length,
                    late_uploads: lateUploads.length
                }
            });
        } catch (error) {
            if (error.message === 'Images not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Images not found'
                });
            }
            logger.error('Error getting radiology images', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get radiology report
     * GET /api/v1/doctor/radiology-orders/:id/report
     * 
     * BUSINESS RULE: [BR-42] Report completed within 48 hours
     */
    async getRadiologyReport(req, res, next) {
        try {
            const { id } = req.params;

            const report = await radiologyService.getRadiologyReport(
                req.user.id,
                id
            );

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            logger.info('Doctor viewed radiology report', {
                doctorId: req.user.id,
                orderId: id,
                reportId: report.id
            });

            // Check report timing [BR-42]
            if (report.completed_at) {
                const uploadTime = new Date(report.uploaded_at);
                const reportTime = new Date(report.completed_at);
                const hoursDiff = (reportTime - uploadTime) / (1000 * 60 * 60);
                
                if (hoursDiff > 48) {
                    logger.warn('Report completed after 48 hours', {
                        orderId: id,
                        hoursLate: hoursDiff - 48
                    });
                }
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            if (error.message === 'Report not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }
            logger.error('Error getting radiology report', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Download specific image
     * GET /api/v1/doctor/radiology-orders/:id/images/:imageId/download
     */
    async downloadRadiologyImage(req, res, next) {
        try {
            const { id, imageId } = req.params;

            const imageData = await radiologyService.downloadRadiologyImage(
                req.user.id,
                id,
                imageId
            );

            if (!imageData) {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }

            logger.info('Doctor downloaded radiology image', {
                doctorId: req.user.id,
                orderId: id,
                imageId: imageId
            });

            res.setHeader('Content-Type', imageData.mimeType || 'image/jpeg');
            res.setHeader('Content-Disposition', `attachment; filename=${imageData.filename}`);
            res.send(imageData.buffer);
        } catch (error) {
            if (error.message === 'Image not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Image not found'
                });
            }
            logger.error('Error downloading radiology image', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id,
                imageId: req.params.imageId
            });
            next(error);
        }
    },

    /**
     * Download complete report as PDF
     * GET /api/v1/doctor/radiology-orders/:id/report/pdf
     */
    async downloadRadiologyReportPDF(req, res, next) {
        try {
            const { id } = req.params;

            const pdfBuffer = await radiologyService.generateRadiologyReportPDF(
                req.user.id,
                id
            );

            if (!pdfBuffer) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            logger.info('Doctor downloaded radiology report PDF', {
                doctorId: req.user.id,
                orderId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=radiology-report-${id}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Report not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }
            logger.error('Error downloading radiology report PDF', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // REFERENCE DATA
    // ============================================

    /**
     * Get available radiology types
     * GET /api/v1/doctor/radiology-types
     */
    async getRadiologyTypes(req, res, next) {
        try {
            const types = [
                { id: 'xray', name: 'X-Ray', description: 'Plain radiography' },
                { id: 'mri', name: 'MRI', description: 'Magnetic Resonance Imaging' },
                { id: 'ct', name: 'CT Scan', description: 'Computed Tomography' },
                { id: 'ultrasound', name: 'Ultrasound', description: 'Sonography' },
                { id: 'mammogram', name: 'Mammogram', description: 'Breast imaging' },
                { id: 'pet_scan', name: 'PET Scan', description: 'Positron Emission Tomography' },
                { id: 'fluoroscopy', name: 'Fluoroscopy', description: 'Real-time X-ray' },
                { id: 'angiography', name: 'Angiography', description: 'Blood vessel imaging' }
            ];

            res.json({
                success: true,
                data: types
            });
        } catch (error) {
            logger.error('Error getting radiology types', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get body parts list
     * GET /api/v1/doctor/body-parts
     */
    async getBodyParts(req, res, next) {
        try {
            const bodyParts = [
                // Head & Neck
                { id: 'head', name: 'Head', category: 'head_neck' },
                { id: 'brain', name: 'Brain', category: 'head_neck' },
                { id: 'skull', name: 'Skull', category: 'head_neck' },
                { id: 'face', name: 'Face', category: 'head_neck' },
                { id: 'sinuses', name: 'Sinuses', category: 'head_neck' },
                { id: 'neck', name: 'Neck', category: 'head_neck' },
                { id: 'spine_cervical', name: 'Cervical Spine', category: 'spine' },
                
                // Chest
                { id: 'chest', name: 'Chest', category: 'chest' },
                { id: 'lungs', name: 'Lungs', category: 'chest' },
                { id: 'heart', name: 'Heart', category: 'chest' },
                { id: 'ribs', name: 'Ribs', category: 'chest' },
                { id: 'breast', name: 'Breast', category: 'chest' },
                
                // Abdomen
                { id: 'abdomen', name: 'Abdomen', category: 'abdomen' },
                { id: 'liver', name: 'Liver', category: 'abdomen' },
                { id: 'kidneys', name: 'Kidneys', category: 'abdomen' },
                { id: 'pancreas', name: 'Pancreas', category: 'abdomen' },
                { id: 'spleen', name: 'Spleen', category: 'abdomen' },
                { id: 'gallbladder', name: 'Gallbladder', category: 'abdomen' },
                
                // Pelvis
                { id: 'pelvis', name: 'Pelvis', category: 'pelvis' },
                { id: 'hip', name: 'Hip', category: 'pelvis' },
                { id: 'bladder', name: 'Bladder', category: 'pelvis' },
                { id: 'uterus', name: 'Uterus', category: 'pelvis' },
                { id: 'prostate', name: 'Prostate', category: 'pelvis' },
                
                // Spine
                { id: 'spine_thoracic', name: 'Thoracic Spine', category: 'spine' },
                { id: 'spine_lumbar', name: 'Lumbar Spine', category: 'spine' },
                { id: 'spine_sacral', name: 'Sacral Spine', category: 'spine' },
                { id: 'spine_coccyx', name: 'Coccyx', category: 'spine' },
                
                // Upper Extremities
                { id: 'shoulder', name: 'Shoulder', category: 'upper_extremity' },
                { id: 'arm', name: 'Arm', category: 'upper_extremity' },
                { id: 'elbow', name: 'Elbow', category: 'upper_extremity' },
                { id: 'forearm', name: 'Forearm', category: 'upper_extremity' },
                { id: 'wrist', name: 'Wrist', category: 'upper_extremity' },
                { id: 'hand', name: 'Hand', category: 'upper_extremity' },
                { id: 'fingers', name: 'Fingers', category: 'upper_extremity' },
                
                // Lower Extremities
                { id: 'hip', name: 'Hip', category: 'lower_extremity' },
                { id: 'thigh', name: 'Thigh', category: 'lower_extremity' },
                { id: 'knee', name: 'Knee', category: 'lower_extremity' },
                { id: 'leg', name: 'Leg', category: 'lower_extremity' },
                { id: 'ankle', name: 'Ankle', category: 'lower_extremity' },
                { id: 'foot', name: 'Foot', category: 'lower_extremity' },
                { id: 'toes', name: 'Toes', category: 'lower_extremity' }
            ];

            // Filter by category if provided
            let filteredParts = bodyParts;
            if (req.query.category) {
                filteredParts = bodyParts.filter(p => p.category === req.query.category);
            }

            res.json({
                success: true,
                data: filteredParts,
                categories: [...new Set(bodyParts.map(p => p.category))]
            });
        } catch (error) {
            logger.error('Error getting body parts', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get contrast types
     * GET /api/v1/doctor/contrast-types
     */
    async getContrastTypes(req, res, next) {
        try {
            const contrastTypes = [
                { id: 'iodinated', name: 'Iodinated Contrast', common: true },
                { id: 'gadolinium', name: 'Gadolinium (MRI)', common: true },
                { id: 'barium', name: 'Barium Sulfate', common: true },
                { id: 'air', name: 'Air Contrast', common: false },
                { id: 'saline', name: 'Saline', common: false }
            ];

            res.json({
                success: true,
                data: contrastTypes
            });
        } catch (error) {
            logger.error('Error getting contrast types', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // STATISTICS
    // ============================================

    /**
     * Get radiology order statistics
     * GET /api/v1/doctor/radiology-orders/stats
     */
    async getRadiologyStats(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const stats = await radiologyService.getRadiologyStats(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting radiology stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending reports count
     * GET /api/v1/doctor/radiology-orders/pending-reports
     */
    async getPendingReportsCount(req, res, next) {
        try {
            const count = await radiologyService.getPendingReportsCount(
                req.user.id
            );

            res.json({
                success: true,
                data: { pending_count: count }
            });
        } catch (error) {
            logger.error('Error getting pending reports count', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get radiology usage trends
     * GET /api/v1/doctor/radiology-orders/trends
     */
    async getRadiologyTrends(req, res, next) {
        try {
            const { months = 6 } = req.query;

            const trends = await radiologyService.getRadiologyTrends(
                req.user.id,
                parseInt(months)
            );

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting radiology trends', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BULK OPERATIONS
    // ============================================

    /**
     * Create multiple radiology orders
     * POST /api/v1/doctor/radiology-orders/bulk
     */
    async createBulkRadiologyOrders(req, res, next) {
        try {
            const { orders } = req.body;

            if (!orders || !Array.isArray(orders) || orders.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one order is required'
                });
            }

            const results = await radiologyService.createBulkRadiologyOrders(
                req.user.id,
                orders
            );

            logger.info('Doctor created bulk radiology orders', {
                doctorId: req.user.id,
                requestedCount: orders.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            });

            res.status(201).json({
                success: true,
                data: results,
                message: `Created ${results.success.length} out of ${orders.length} orders`
            });
        } catch (error) {
            logger.error('Error creating bulk radiology orders', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // URGENT FINDINGS [BR-43]
    // ============================================

    /**
     * Mark urgent finding as acknowledged
     * PUT /api/v1/doctor/radiology-orders/:id/urgent/acknowledge
     * 
     * BUSINESS RULE: [BR-43] Urgent findings require immediate call
     */
    async acknowledgeUrgentFinding(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const result = await radiologyService.acknowledgeUrgentFinding(
                req.user.id,
                id,
                notes
            );

            logger.info('Doctor acknowledged urgent finding', {
                doctorId: req.user.id,
                orderId: id
            });

            res.json({
                success: true,
                data: result,
                message: 'Urgent finding acknowledged'
            });
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology order not found'
                });
            }
            logger.error('Error acknowledging urgent finding', {
                error: error.message,
                doctorId: req.user.id,
                orderId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = radiologyController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Business Rules
 * -----------------------|-----------|----------------------
 * Order Lists            | 4         | Filter by status, priority
 * CRUD Operations        | 4         | Create, update, delete, cancel
 * Images & Reports       | 4         | [BR-41][BR-42] View/download
 * Reference Data         | 3         | Scan types, body parts, contrast
 * Statistics             | 3         | Usage analytics, trends
 * Bulk Operations        | 1         | Multiple orders
 * Urgent Findings        | 1         | [BR-43] Acknowledge
 * -----------------------|-----------|----------------------
 * TOTAL                  | 20        | Complete radiology management
 * 
 * ======================================================================
 */