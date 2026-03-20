/**
 * ======================================================================
 * FILE: backend/src/controllers/labTechnician/specimenController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician specimen controller - Handles specimen management.
 * Total Endpoints: 11
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-39] Sample collection to result < 24 hours
 * 
 * ======================================================================
 */

const specimenService = require('../../services/labTechnician/specimenService');
const logger = require('../../utils/logger');

/**
 * Lab Technician Specimen Controller
 */
const specimenController = {
    // ============================================
    // SPECIMEN LISTS
    // ============================================

    /**
     * Get all specimens
     * GET /api/v1/lab/specimens
     */
    async getAllSpecimens(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                specimen_type,
                patient_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                specimen_type,
                patient_id,
                from_date,
                to_date
            };

            const specimens = await specimenService.getAllSpecimens(
                req.user.id,
                options
            );

            logger.info('Lab technician retrieved all specimens', {
                technicianId: req.user.id,
                count: specimens.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: specimens.data,
                pagination: specimens.pagination,
                summary: specimens.summary
            });
        } catch (error) {
            logger.error('Error getting all specimens', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get collected specimens
     * GET /api/v1/lab/specimens/collected
     */
    async getCollectedSpecimens(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const specimens = await specimenService.getSpecimensByStatus(
                req.user.id,
                'collected',
                options
            );

            logger.info('Lab technician viewed collected specimens', {
                technicianId: req.user.id,
                count: specimens.data?.length || 0
            });

            res.json({
                success: true,
                data: specimens.data,
                pagination: specimens.pagination
            });
        } catch (error) {
            logger.error('Error getting collected specimens', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get received specimens
     * GET /api/v1/lab/specimens/received
     */
    async getReceivedSpecimens(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const specimens = await specimenService.getSpecimensByStatus(
                req.user.id,
                'received',
                options
            );

            logger.info('Lab technician viewed received specimens', {
                technicianId: req.user.id,
                count: specimens.data?.length || 0
            });

            res.json({
                success: true,
                data: specimens.data,
                pagination: specimens.pagination
            });
        } catch (error) {
            logger.error('Error getting received specimens', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get processed specimens
     * GET /api/v1/lab/specimens/processed
     */
    async getProcessedSpecimens(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const specimens = await specimenService.getSpecimensByStatus(
                req.user.id,
                'processed',
                options
            );

            logger.info('Lab technician viewed processed specimens', {
                technicianId: req.user.id,
                count: specimens.data?.length || 0
            });

            res.json({
                success: true,
                data: specimens.data,
                pagination: specimens.pagination
            });
        } catch (error) {
            logger.error('Error getting processed specimens', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get rejected specimens
     * GET /api/v1/lab/specimens/rejected
     */
    async getRejectedSpecimens(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const specimens = await specimenService.getSpecimensByStatus(
                req.user.id,
                'rejected',
                options
            );

            logger.info('Lab technician viewed rejected specimens', {
                technicianId: req.user.id,
                count: specimens.data?.length || 0
            });

            res.json({
                success: true,
                data: specimens.data,
                pagination: specimens.pagination,
                summary: {
                    total: specimens.summary?.total || 0,
                    by_reason: specimens.summary?.by_reason || {}
                }
            });
        } catch (error) {
            logger.error('Error getting rejected specimens', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get specimen by ID
     * GET /api/v1/lab/specimens/:id
     */
    async getSpecimenById(req, res, next) {
        try {
            const { id } = req.params;

            const specimen = await specimenService.getSpecimenById(
                req.user.id,
                id
            );

            if (!specimen) {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }

            logger.info('Lab technician viewed specimen details', {
                technicianId: req.user.id,
                specimenId: id,
                patientId: specimen.patient_id,
                type: specimen.specimen_type
            });

            // Check if specimen is expiring soon
            if (specimen.expiry_date) {
                const daysUntilExpiry = Math.ceil((new Date(specimen.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysUntilExpiry <= 7) {
                    logger.warn('Specimen expiring soon', {
                        specimenId: id,
                        daysUntilExpiry
                    });
                }
            }

            res.json({
                success: true,
                data: specimen
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error getting specimen by ID', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // SPECIMEN CRUD OPERATIONS
    // ============================================

    /**
     * Register new specimen
     * POST /api/v1/lab/specimens
     */
    async registerSpecimen(req, res, next) {
        try {
            const specimenData = {
                specimen_code: req.body.specimen_code,
                specimen_type: req.body.specimen_type,
                specimen_name: req.body.specimen_name,
                collection_date: req.body.collection_date || new Date(),
                collected_by: req.body.collected_by || req.user.id,
                collection_site: req.body.collection_site,
                collection_method: req.body.collection_method,
                collection_notes: req.body.collection_notes,
                patient_id: req.body.patient_id,
                test_order_id: req.body.test_order_id,
                volume: req.body.volume,
                volume_unit: req.body.volume_unit,
                container_type: req.body.container_type,
                preservative: req.body.preservative,
                storage_conditions: req.body.storage_conditions,
                status: 'collected',
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!specimenData.specimen_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Specimen type is required'
                });
            }

            if (!specimenData.patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!specimenData.test_order_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Test order ID is required'
                });
            }

            // Generate specimen code if not provided
            if (!specimenData.specimen_code) {
                specimenData.specimen_code = await specimenService.generateSpecimenCode(
                    specimenData.specimen_type
                );
            }

            const specimen = await specimenService.registerSpecimen(
                req.user.id,
                specimenData
            );

            logger.info('Lab technician registered new specimen', {
                technicianId: req.user.id,
                specimenId: specimen.id,
                specimenCode: specimen.specimen_code,
                patientId: specimenData.patient_id,
                type: specimenData.specimen_type
            });

            res.status(201).json({
                success: true,
                data: specimen,
                message: 'Specimen registered successfully'
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: 'Specimen code already exists'
                });
            }
            logger.error('Error registering specimen', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update specimen
     * PUT /api/v1/lab/specimens/:id
     */
    async updateSpecimen(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.specimen_code;
            delete updates.patient_id;
            delete updates.test_order_id;
            delete updates.created_by;

            const specimen = await specimenService.updateSpecimen(
                req.user.id,
                id,
                updates
            );

            logger.info('Lab technician updated specimen', {
                technicianId: req.user.id,
                specimenId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: specimen,
                message: 'Specimen updated successfully'
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error updating specimen', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update specimen condition
     * PUT /api/v1/lab/specimens/:id/condition
     */
    async updateSpecimenCondition(req, res, next) {
        try {
            const { id } = req.params;
            const { condition, notes } = req.body;

            if (!condition) {
                return res.status(400).json({
                    success: false,
                    error: 'Specimen condition is required'
                });
            }

            const specimen = await specimenService.updateSpecimenCondition(
                req.user.id,
                id,
                {
                    condition,
                    notes,
                    updated_by: req.user.id,
                    updated_at: new Date()
                }
            );

            logger.info('Lab technician updated specimen condition', {
                technicianId: req.user.id,
                specimenId: id,
                condition
            });

            res.json({
                success: true,
                data: specimen,
                message: 'Specimen condition updated'
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error updating specimen condition', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Reject specimen
     * PUT /api/v1/lab/specimens/:id/reject
     */
    async rejectSpecimen(req, res, next) {
        try {
            const { id } = req.params;
            const { reason, notes } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Rejection reason is required'
                });
            }

            const specimen = await specimenService.rejectSpecimen(
                req.user.id,
                id,
                {
                    rejection_reason: reason,
                    rejection_notes: notes,
                    rejected_by: req.user.id,
                    rejected_at: new Date()
                }
            );

            logger.info('Lab technician rejected specimen', {
                technicianId: req.user.id,
                specimenId: id,
                reason
            });

            res.json({
                success: true,
                data: specimen,
                message: 'Specimen rejected successfully'
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            if (error.message === 'Cannot reject processed specimen') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot reject specimen that has been processed'
                });
            }
            logger.error('Error rejecting specimen', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Dispose specimen
     * PUT /api/v1/lab/specimens/:id/dispose
     */
    async disposeSpecimen(req, res, next) {
        try {
            const { id } = req.params;
            const { method, notes } = req.body;

            if (!method) {
                return res.status(400).json({
                    success: false,
                    error: 'Disposal method is required'
                });
            }

            const specimen = await specimenService.disposeSpecimen(
                req.user.id,
                id,
                {
                    disposal_method: method,
                    disposal_notes: notes,
                    disposed_by: req.user.id,
                    disposed_at: new Date()
                }
            );

            logger.info('Lab technician disposed specimen', {
                technicianId: req.user.id,
                specimenId: id,
                method
            });

            res.json({
                success: true,
                data: specimen,
                message: 'Specimen disposed successfully'
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error disposing specimen', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // SPECIMEN TRACKING
    // ============================================

    /**
     * Track specimen location
     * GET /api/v1/lab/specimens/tracking
     */
    async trackSpecimens(req, res, next) {
        try {
            const { location, status } = req.query;

            const tracking = await specimenService.trackSpecimens(
                req.user.id,
                { location, status }
            );

            logger.info('Lab technician viewed specimen tracking', {
                technicianId: req.user.id,
                count: tracking.length
            });

            res.json({
                success: true,
                data: tracking,
                summary: {
                    total: tracking.length,
                    by_location: tracking.reduce((acc, s) => {
                        acc[s.storage_location] = (acc[s.storage_location] || 0) + 1;
                        return acc;
                    }, {}),
                    by_status: tracking.reduce((acc, s) => {
                        acc[s.status] = (acc[s.status] || 0) + 1;
                        return acc;
                    }, {})
                }
            });
        } catch (error) {
            logger.error('Error tracking specimens', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get specimen history
     * GET /api/v1/lab/specimens/:id/history
     */
    async getSpecimenHistory(req, res, next) {
        try {
            const { id } = req.params;

            const history = await specimenService.getSpecimenHistory(
                req.user.id,
                id
            );

            if (!history) {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error getting specimen history', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Transfer specimen to different location
     * POST /api/v1/lab/specimens/:id/transfer
     */
    async transferSpecimen(req, res, next) {
        try {
            const { id } = req.params;
            const { to_location, reason, notes } = req.body;

            if (!to_location) {
                return res.status(400).json({
                    success: false,
                    error: 'Destination location is required'
                });
            }

            const transfer = await specimenService.transferSpecimen(
                req.user.id,
                id,
                {
                    to_location,
                    reason,
                    notes,
                    transferred_by: req.user.id,
                    transferred_at: new Date()
                }
            );

            logger.info('Lab technician transferred specimen', {
                technicianId: req.user.id,
                specimenId: id,
                toLocation: to_location
            });

            res.json({
                success: true,
                data: transfer,
                message: 'Specimen transferred successfully'
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error transferring specimen', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BULK OPERATIONS
    // ============================================

    /**
     * Bulk update specimen status
     * POST /api/v1/lab/specimens/bulk-update
     */
    async bulkUpdateSpecimens(req, res, next) {
        try {
            const { updates } = req.body;

            if (!updates || !Array.isArray(updates) || updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Updates array is required'
                });
            }

            const results = await specimenService.bulkUpdateSpecimens(
                req.user.id,
                updates
            );

            logger.info('Lab technician performed bulk specimen update', {
                technicianId: req.user.id,
                requestedCount: updates.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            });

            res.json({
                success: true,
                data: results,
                message: `Updated ${results.success.length} out of ${updates.length} specimens`
            });
        } catch (error) {
            logger.error('Error in bulk specimen update', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get specimen statistics
     * GET /api/v1/lab/specimens/statistics
     */
    async getSpecimenStatistics(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await specimenService.getSpecimenStatistics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting specimen statistics', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get specimen by barcode
     * GET /api/v1/lab/specimens/barcode/:barcode
     */
    async getSpecimenByBarcode(req, res, next) {
        try {
            const { barcode } = req.params;

            const specimen = await specimenService.getSpecimenByBarcode(
                req.user.id,
                barcode
            );

            if (!specimen) {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }

            logger.info('Lab technician scanned specimen barcode', {
                technicianId: req.user.id,
                specimenId: specimen.id,
                barcode
            });

            res.json({
                success: true,
                data: specimen
            });
        } catch (error) {
            logger.error('Error getting specimen by barcode', {
                error: error.message,
                technicianId: req.user.id,
                barcode: req.params.barcode
            });
            next(error);
        }
    },

    // ============================================
    // SPECIMEN LABELS
    // ============================================

    /**
     * Generate specimen label
     * GET /api/v1/lab/specimens/:id/label
     */
    async generateLabel(req, res, next) {
        try {
            const { id } = req.params;

            const labelData = await specimenService.generateSpecimenLabel(
                req.user.id,
                id
            );

            if (!labelData) {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }

            logger.info('Lab technician generated specimen label', {
                technicianId: req.user.id,
                specimenId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=specimen-${id}-label.pdf`);
            res.send(labelData);
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error generating specimen label', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Print multiple specimen labels
     * POST /api/v1/lab/specimens/print-labels
     */
    async printMultipleLabels(req, res, next) {
        try {
            const { specimen_ids } = req.body;

            if (!specimen_ids || !Array.isArray(specimen_ids) || specimen_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Specimen IDs array is required'
                });
            }

            const pdfData = await specimenService.generateMultipleLabels(
                req.user.id,
                specimen_ids
            );

            logger.info('Lab technician printed multiple specimen labels', {
                technicianId: req.user.id,
                count: specimen_ids.length
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=specimen-labels-${Date.now()}.pdf`);
            res.send(pdfData);
        } catch (error) {
            logger.error('Error printing multiple labels', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // SPECIMEN QUALITY
    // ============================================

    /**
     * Record specimen quality check
     * POST /api/v1/lab/specimens/:id/quality-check
     */
    async recordQualityCheck(req, res, next) {
        try {
            const { id } = req.params;
            const { passed, notes } = req.body;

            if (passed === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Quality check result is required'
                });
            }

            const result = await specimenService.recordQualityCheck(
                req.user.id,
                id,
                {
                    passed,
                    notes,
                    checked_by: req.user.id,
                    checked_at: new Date()
                }
            );

            logger.info('Lab technician recorded specimen quality check', {
                technicianId: req.user.id,
                specimenId: id,
                passed
            });

            res.json({
                success: true,
                data: result,
                message: passed ? 'Specimen passed quality check' : 'Specimen failed quality check'
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error recording quality check', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get specimens requiring quality check
     * GET /api/v1/lab/specimens/quality-pending
     */
    async getQualityPendingSpecimens(req, res, next) {
        try {
            const specimens = await specimenService.getQualityPendingSpecimens(req.user.id);

            res.json({
                success: true,
                data: specimens,
                count: specimens.length
            });
        } catch (error) {
            logger.error('Error getting quality pending specimens', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // SPECIMEN NOTES
    // ============================================

    /**
     * Add specimen note
     * POST /api/v1/lab/specimens/:id/notes
     */
    async addSpecimenNote(req, res, next) {
        try {
            const { id } = req.params;
            const { note } = req.body;

            if (!note || note.trim().length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Note must be at least 5 characters'
                });
            }

            const specimenNote = await specimenService.addSpecimenNote(
                req.user.id,
                id,
                {
                    note,
                    created_by: req.user.id,
                    created_at: new Date()
                }
            );

            logger.info('Lab technician added specimen note', {
                technicianId: req.user.id,
                specimenId: id
            });

            res.status(201).json({
                success: true,
                data: specimenNote,
                message: 'Note added successfully'
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error adding specimen note', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get specimen notes
     * GET /api/v1/lab/specimens/:id/notes
     */
    async getSpecimenNotes(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const notes = await specimenService.getSpecimenNotes(
                req.user.id,
                id,
                options
            );

            res.json({
                success: true,
                data: notes.data,
                pagination: notes.pagination
            });
        } catch (error) {
            if (error.message === 'Specimen not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Specimen not found'
                });
            }
            logger.error('Error getting specimen notes', {
                error: error.message,
                technicianId: req.user.id,
                specimenId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = specimenController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Specimen Lists         | 6         | All, collected, received, processed, rejected, by ID
 * CRUD Operations        | 4         | Register, update, condition, reject, dispose
 * Specimen Tracking      | 3         | Track, history, transfer
 * Bulk Operations        | 2         | Bulk update, statistics
 * Labels & Barcode       | 3         | By barcode, single label, multiple labels
 * Quality Control        | 2         | Quality check, pending checks
 * Specimen Notes         | 2         | Add note, get notes
 * -----------------------|-----------|----------------------
 * TOTAL                  | 22        | Complete specimen management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-39] Sample tracking and expiry monitoring
 * 
 * ======================================================================
 */