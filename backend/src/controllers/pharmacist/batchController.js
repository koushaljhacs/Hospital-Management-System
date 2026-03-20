/**
 * ======================================================================
 * FILE: backend/src/controllers/pharmacist/batchController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist batch controller - Handles batch management for medicines.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-21] Alert 30 days before expiry
 * - [BR-23] Batch tracking mandatory
 * 
 * ENDPOINTS: 6 endpoints
 * ======================================================================
 */

const batchService = require('../../services/pharmacist/batchService');
const logger = require('../../utils/logger');

/**
 * Pharmacist Batch Controller
 */
const batchController = {
    // ============================================
    // BATCH LISTS
    // ============================================

    /**
     * Get all batches
     * GET /api/v1/pharmacist/batches
     */
    async getAllBatches(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                medicine_id,
                supplier_id,
                status,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                medicine_id,
                supplier_id,
                status,
                from_date,
                to_date
            };

            const batches = await batchService.getAllBatches(
                req.user.id,
                options
            );

            logger.info('Pharmacist retrieved batches', {
                pharmacistId: req.user.id,
                count: batches.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: batches.data,
                pagination: batches.pagination,
                summary: batches.summary
            });
        } catch (error) {
            logger.error('Error getting batches', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get expiring batches
     * GET /api/v1/pharmacist/batches/expiring
     * 
     * BUSINESS RULE: [BR-21] Alert 30 days before expiry
     */
    async getExpiringBatches(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20,
                days = 30 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                days: parseInt(days)
            };

            const batches = await batchService.getExpiringBatches(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed expiring batches', {
                pharmacistId: req.user.id,
                count: batches.data?.length || 0,
                daysThreshold: parseInt(days)
            });

            // Group by urgency
            const now = new Date();
            const grouped = {
                critical: batches.data?.filter(b => b.days_until_expiry <= 7).length || 0,
                warning: batches.data?.filter(b => b.days_until_expiry > 7 && b.days_until_expiry <= 15).length || 0,
                notice: batches.data?.filter(b => b.days_until_expiry > 15 && b.days_until_expiry <= 30).length || 0
            };

            res.json({
                success: true,
                data: batches.data,
                pagination: batches.pagination,
                summary: {
                    total: batches.summary?.total || 0,
                    by_urgency: grouped,
                    total_quantity: batches.summary?.total_quantity || 0,
                    total_value: batches.summary?.total_value || 0
                }
            });
        } catch (error) {
            logger.error('Error getting expiring batches', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get batch by ID
     * GET /api/v1/pharmacist/batches/:id
     */
    async getBatchById(req, res, next) {
        try {
            const { id } = req.params;

            const batch = await batchService.getBatchById(
                req.user.id,
                id
            );

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }

            logger.info('Pharmacist viewed batch details', {
                pharmacistId: req.user.id,
                batchId: id,
                medicineName: batch.medicine_name,
                batchNumber: batch.batch_number
            });

            // [BR-21] Check if expiring soon
            if (batch.days_until_expiry <= 30) {
                logger.warn('Expiring batch viewed', {
                    batchId: id,
                    daysUntilExpiry: batch.days_until_expiry
                });
            }

            res.json({
                success: true,
                data: batch
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }
            logger.error('Error getting batch', {
                error: error.message,
                pharmacistId: req.user.id,
                batchId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BATCH CRUD OPERATIONS
    // ============================================

    /**
     * Add new batch
     * POST /api/v1/pharmacist/batches
     * 
     * BUSINESS RULE: [BR-23] Batch tracking mandatory
     */
    async addBatch(req, res, next) {
        try {
            const batchData = {
                medicine_id: req.body.medicine_id,
                batch_number: req.body.batch_number,
                manufacturing_date: req.body.manufacturing_date,
                expiry_date: req.body.expiry_date,
                quantity: req.body.quantity,
                unit_price: req.body.unit_price,
                selling_price: req.body.selling_price,
                mrp: req.body.mrp,
                supplier_id: req.body.supplier_id,
                purchase_order_id: req.body.purchase_order_id,
                received_date: req.body.received_date,
                location: req.body.location,
                rack_number: req.body.rack_number,
                notes: req.body.notes,
                created_by: req.user.id,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!batchData.medicine_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Medicine ID is required'
                });
            }

            // [BR-23] Batch number required
            if (!batchData.batch_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Batch number is required'
                });
            }

            if (!batchData.expiry_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Expiry date is required'
                });
            }

            // [BR-21] Validate expiry date
            if (new Date(batchData.expiry_date) <= new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Expiry date must be in future'
                });
            }

            // Validate manufacturing date
            if (batchData.manufacturing_date && new Date(batchData.manufacturing_date) >= new Date(batchData.expiry_date)) {
                return res.status(400).json({
                    success: false,
                    error: 'Manufacturing date must be before expiry date'
                });
            }

            const batch = await batchService.addBatch(
                req.user.id,
                batchData
            );

            logger.info('Pharmacist added new batch', {
                pharmacistId: req.user.id,
                batchId: batch.id,
                medicineId: batch.medicine_id,
                batchNumber: batch.batch_number,
                expiryDate: batch.expiry_date
            });

            res.status(201).json({
                success: true,
                data: batch,
                message: 'Batch added successfully'
            });
        } catch (error) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: 'Batch with this number already exists'
                });
            }
            logger.error('Error adding batch', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update batch
     * PUT /api/v1/pharmacist/batches/:id
     */
    async updateBatch(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.batch_number;
            delete updates.medicine_id;
            delete updates.created_by;
            delete updates.created_at;

            const batch = await batchService.updateBatch(
                req.user.id,
                id,
                updates
            );

            logger.info('Pharmacist updated batch', {
                pharmacistId: req.user.id,
                batchId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: batch,
                message: 'Batch updated successfully'
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }
            logger.error('Error updating batch', {
                error: error.message,
                pharmacistId: req.user.id,
                batchId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete batch
     * DELETE /api/v1/pharmacist/batches/:id
     */
    async deleteBatch(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await batchService.deleteBatch(
                req.user.id,
                id,
                reason
            );

            logger.info('Pharmacist deleted batch', {
                pharmacistId: req.user.id,
                batchId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Batch deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }
            if (error.message === 'Cannot delete batch with stock') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete batch with existing stock'
                });
            }
            logger.error('Error deleting batch', {
                error: error.message,
                pharmacistId: req.user.id,
                batchId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BATCH MOVEMENT & TRACKING
    // ============================================

    /**
     * Get batch movement history
     * GET /api/v1/pharmacist/batches/:id/movements
     */
    async getBatchMovements(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const movements = await batchService.getBatchMovements(
                req.user.id,
                id,
                options
            );

            logger.info('Pharmacist viewed batch movements', {
                pharmacistId: req.user.id,
                batchId: id,
                movementCount: movements.data?.length || 0
            });

            res.json({
                success: true,
                data: movements.data,
                pagination: movements.pagination,
                summary: movements.summary
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }
            logger.error('Error getting batch movements', {
                error: error.message,
                pharmacistId: req.user.id,
                batchId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Transfer batch to different location
     * POST /api/v1/pharmacist/batches/:id/transfer
     */
    async transferBatch(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                to_location,
                to_rack,
                quantity,
                reason 
            } = req.body;

            if (!to_location) {
                return res.status(400).json({
                    success: false,
                    error: 'Destination location is required'
                });
            }

            const transfer = await batchService.transferBatch(
                req.user.id,
                id,
                {
                    to_location,
                    to_rack,
                    quantity: quantity || 'all',
                    reason,
                    transferred_at: new Date(),
                    transferred_by: req.user.id
                }
            );

            logger.info('Pharmacist transferred batch', {
                pharmacistId: req.user.id,
                batchId: id,
                fromLocation: transfer.from_location,
                toLocation: to_location,
                quantity: transfer.quantity
            });

            res.json({
                success: true,
                data: transfer,
                message: 'Batch transferred successfully'
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }
            if (error.message === 'Insufficient quantity') {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient quantity in batch'
                });
            }
            logger.error('Error transferring batch', {
                error: error.message,
                pharmacistId: req.user.id,
                batchId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get batch by batch number
     * GET /api/v1/pharmacist/batches/number/:batchNumber
     */
    async getBatchByNumber(req, res, next) {
        try {
            const { batchNumber } = req.params;

            const batch = await batchService.getBatchByNumber(
                req.user.id,
                batchNumber
            );

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }

            logger.info('Pharmacist searched batch by number', {
                pharmacistId: req.user.id,
                batchNumber,
                batchId: batch.id
            });

            res.json({
                success: true,
                data: batch
            });
        } catch (error) {
            logger.error('Error getting batch by number', {
                error: error.message,
                pharmacistId: req.user.id,
                batchNumber: req.params.batchNumber
            });
            next(error);
        }
    },

    // ============================================
    // BATCH QUALITY CONTROL
    // ============================================

    /**
     * Mark batch for quality check
     * POST /api/v1/pharmacist/batches/:id/quality-check
     */
    async markForQualityCheck(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                check_type,
                notes,
                sample_size 
            } = req.body;

            const result = await batchService.markForQualityCheck(
                req.user.id,
                id,
                {
                    check_type: check_type || 'random',
                    notes,
                    sample_size: sample_size || 5,
                    checked_at: new Date(),
                    checked_by: req.user.id
                }
            );

            logger.info('Pharmacist marked batch for quality check', {
                pharmacistId: req.user.id,
                batchId: id,
                checkType: check_type
            });

            res.json({
                success: true,
                data: result,
                message: 'Batch marked for quality check'
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }
            logger.error('Error marking batch for quality check', {
                error: error.message,
                pharmacistId: req.user.id,
                batchId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update quality check result
     * PUT /api/v1/pharmacist/batches/:id/quality-result
     */
    async updateQualityResult(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                passed,
                notes,
                action_taken 
            } = req.body;

            if (passed === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Quality check result is required'
                });
            }

            const result = await batchService.updateQualityResult(
                req.user.id,
                id,
                {
                    passed,
                    notes,
                    action_taken,
                    updated_at: new Date()
                }
            );

            logger.info('Pharmacist updated quality check result', {
                pharmacistId: req.user.id,
                batchId: id,
                passed
            });

            res.json({
                success: true,
                data: result,
                message: passed ? 'Batch passed quality check' : 'Batch failed quality check'
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }
            logger.error('Error updating quality result', {
                error: error.message,
                pharmacistId: req.user.id,
                batchId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BATCH REPORTS
    // ============================================

    /**
     * Get batch expiry report
     * GET /api/v1/pharmacist/batches/reports/expiry
     */
    async getBatchExpiryReport(req, res, next) {
        try {
            const { months = 6 } = req.query;

            const report = await batchService.getBatchExpiryReport(
                req.user.id,
                parseInt(months)
            );

            logger.info('Pharmacist generated batch expiry report', {
                pharmacistId: req.user.id,
                months: parseInt(months)
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error generating batch expiry report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get batch summary by medicine
     * GET /api/v1/pharmacist/batches/summary/by-medicine
     */
    async getBatchSummaryByMedicine(req, res, next) {
        try {
            const { medicine_id } = req.query;

            const summary = await batchService.getBatchSummaryByMedicine(
                req.user.id,
                medicine_id
            );

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            logger.error('Error getting batch summary', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BATCH ALERTS
    // ============================================

    /**
     * Get batch alerts
     * GET /api/v1/pharmacist/batches/alerts
     */
    async getBatchAlerts(req, res, next) {
        try {
            const alerts = await batchService.getBatchAlerts(req.user.id);

            logger.info('Pharmacist viewed batch alerts', {
                pharmacistId: req.user.id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    expiring_soon: alerts.filter(a => a.type === 'expiring_soon').length,
                    expired: alerts.filter(a => a.type === 'expired').length,
                    quality_issues: alerts.filter(a => a.type === 'quality_issue').length
                }
            });
        } catch (error) {
            logger.error('Error getting batch alerts', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = batchController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Batch Lists            | 3         | All batches, expiring, by ID
 * CRUD Operations        | 3         | Add, update, delete
 * Movement & Tracking    | 3         | Movements, transfer, by number
 * Quality Control        | 2         | Mark quality check, update result
 * Reports                | 2         | Expiry report, summary by medicine
 * Alerts                 | 1         | Batch alerts
 * -----------------------|-----------|----------------------
 * TOTAL                  | 14        | Complete batch management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-21] Expiry alerts
 * - [BR-23] Batch tracking
 * 
 * ======================================================================
 */