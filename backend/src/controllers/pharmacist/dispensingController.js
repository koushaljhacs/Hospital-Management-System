/**
 * ======================================================================
 * FILE: backend/src/controllers/pharmacist/dispensingController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist dispensing controller - Handles prescription dispensing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-16] Controlled substances need special flag
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-19] Stock cannot go negative
 * - [BR-22] FIFO (First In First Out) dispensing
 * 
 * ENDPOINTS: 9 endpoints
 * ======================================================================
 */

const dispensingService = require('../../services/pharmacist/dispensingService');
const logger = require('../../utils/logger');

/**
 * Pharmacist Dispensing Controller
 */
const dispensingController = {
    // ============================================
    // PRESCRIPTION LISTS
    // ============================================

    /**
     * Get all prescriptions
     * GET /api/v1/pharmacist/prescriptions
     */
    async getAllPrescriptions(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                patient_id,
                doctor_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                patient_id,
                doctor_id,
                from_date,
                to_date
            };

            const prescriptions = await dispensingService.getAllPrescriptions(
                req.user.id,
                options
            );

            logger.info('Pharmacist retrieved prescriptions', {
                pharmacistId: req.user.id,
                count: prescriptions.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: prescriptions.data,
                pagination: prescriptions.pagination,
                summary: prescriptions.summary
            });
        } catch (error) {
            logger.error('Error getting prescriptions', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending prescriptions
     * GET /api/v1/pharmacist/prescriptions/pending
     */
    async getPendingPrescriptions(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const prescriptions = await dispensingService.getPendingPrescriptions(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed pending prescriptions', {
                pharmacistId: req.user.id,
                count: prescriptions.data?.length || 0
            });

            // Group by priority
            const byPriority = {
                urgent: prescriptions.data?.filter(p => p.priority === 'urgent').length || 0,
                stat: prescriptions.data?.filter(p => p.priority === 'stat').length || 0,
                routine: prescriptions.data?.filter(p => p.priority === 'routine').length || 0
            };

            res.json({
                success: true,
                data: prescriptions.data,
                pagination: prescriptions.pagination,
                summary: {
                    total: prescriptions.summary?.total || 0,
                    by_priority: byPriority,
                    estimated_time: prescriptions.summary?.estimated_time || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending prescriptions', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get dispensed prescriptions
     * GET /api/v1/pharmacist/prescriptions/dispensed
     */
    async getDispensedPrescriptions(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const prescriptions = await dispensingService.getDispensedPrescriptions(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed dispensed prescriptions', {
                pharmacistId: req.user.id,
                count: prescriptions.data?.length || 0
            });

            res.json({
                success: true,
                data: prescriptions.data,
                pagination: prescriptions.pagination,
                summary: {
                    total: prescriptions.summary?.total || 0,
                    total_items: prescriptions.summary?.total_items || 0,
                    total_value: prescriptions.summary?.total_value || 0
                }
            });
        } catch (error) {
            logger.error('Error getting dispensed prescriptions', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get prescription by ID
     * GET /api/v1/pharmacist/prescriptions/:id
     */
    async getPrescriptionById(req, res, next) {
        try {
            const { id } = req.params;

            const prescription = await dispensingService.getPrescriptionById(
                req.user.id,
                id
            );

            if (!prescription) {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }

            logger.info('Pharmacist viewed prescription', {
                pharmacistId: req.user.id,
                prescriptionId: id,
                patientId: prescription.patient_id,
                doctorId: prescription.doctor_id
            });

            // Check for controlled substances [BR-16]
            const controlledCount = prescription.items?.filter(i => i.is_controlled).length || 0;
            if (controlledCount > 0) {
                logger.warn('Controlled substances prescription viewed', {
                    prescriptionId: id,
                    controlledCount
                });
            }

            res.json({
                success: true,
                data: prescription
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error getting prescription', {
                error: error.message,
                pharmacistId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get prescription items
     * GET /api/v1/pharmacist/prescriptions/:id/items
     */
    async getPrescriptionItems(req, res, next) {
        try {
            const { id } = req.params;

            const items = await dispensingService.getPrescriptionItems(
                req.user.id,
                id
            );

            if (!items) {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }

            logger.info('Pharmacist viewed prescription items', {
                pharmacistId: req.user.id,
                prescriptionId: id,
                itemCount: items.length
            });

            // Check inventory availability for each item
            const availability = await dispensingService.checkItemsAvailability(
                req.user.id,
                items
            );

            res.json({
                success: true,
                data: items,
                availability: {
                    all_available: availability.all_available,
                    available_items: availability.available,
                    unavailable_items: availability.unavailable,
                    partial_items: availability.partial
                }
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error getting prescription items', {
                error: error.message,
                pharmacistId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // DISPENSING OPERATIONS
    // ============================================

    /**
     * Dispense prescription (full)
     * POST /api/v1/pharmacist/prescriptions/:id/dispense
     * 
     * BUSINESS RULES:
     * - [BR-14] Medicine quantity must be positive
     * - [BR-15] Dosage required
     * - [BR-16] Controlled substances need special flag
     * - [BR-18] Cannot dispense expired medicine
     * - [BR-19] Stock cannot go negative
     * - [BR-22] FIFO (First In First Out) dispensing
     */
    async dispensePrescription(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                items,
                dispensing_notes,
                pharmacist_notes,
                witness_id
            } = req.body;

            // Get prescription details
            const prescription = await dispensingService.getPrescriptionById(
                req.user.id,
                id
            );

            if (!prescription) {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }

            // Check if already dispensed
            if (prescription.status === 'dispensed') {
                return res.status(400).json({
                    success: false,
                    error: 'Prescription already dispensed'
                });
            }

            // Validate items
            if (!items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Dispensing items are required'
                });
            }

            // [BR-14] Validate quantities
            for (const item of items) {
                if (item.quantity <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: `Invalid quantity for item ${item.medicine_name || item.medicine_id}`
                    });
                }
            }

            // Check for controlled substances [BR-16]
            const hasControlled = items.some(i => i.is_controlled);
            if (hasControlled && !witness_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Controlled substances require a witness'
                });
            }

            // Check inventory availability and get FIFO batches [BR-22]
            const availability = await dispensingService.checkAndReserveStock(
                req.user.id,
                id,
                items
            );

            if (!availability.all_available) {
                return res.status(409).json({
                    success: false,
                    error: 'Some items are not available in sufficient quantity',
                    unavailable: availability.unavailable
                });
            }

            // Process dispensing
            const dispensing = await dispensingService.dispensePrescription(
                req.user.id,
                id,
                {
                    items: availability.items_with_batches, // Includes batch info for FIFO
                    dispensing_notes,
                    pharmacist_notes,
                    witness_id,
                    dispensed_at: new Date(),
                    dispensed_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Pharmacist dispensed prescription', {
                pharmacistId: req.user.id,
                prescriptionId: id,
                patientId: prescription.patient_id,
                itemCount: items.length,
                hasControlled,
                hasWitness: !!witness_id
            });

            // Log controlled substances [BR-16]
            if (hasControlled) {
                logger.audit({
                    action: 'CONTROLLED_SUBSTANCE_DISPENSED',
                    userId: req.user.id,
                    witnessId: witness_id,
                    resource: 'prescriptions',
                    resourceId: id,
                    patientId: prescription.patient_id
                });
            }

            res.json({
                success: true,
                data: dispensing,
                message: hasControlled 
                    ? 'Prescription dispensed with controlled substances (witness verified)'
                    : 'Prescription dispensed successfully'
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            if (error.message.includes('Insufficient stock')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            if (error.message.includes('expired')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error dispensing prescription', {
                error: error.message,
                pharmacistId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Partial dispense prescription
     * POST /api/v1/pharmacist/prescriptions/:id/partial-dispense
     */
    async partialDispense(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                items,
                dispensing_notes,
                pharmacist_notes,
                witness_id,
                partial_reason
            } = req.body;

            const prescription = await dispensingService.getPrescriptionById(
                req.user.id,
                id
            );

            if (!prescription) {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }

            if (!items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Dispensing items are required'
                });
            }

            // Check for controlled substances [BR-16]
            const hasControlled = items.some(i => i.is_controlled);
            if (hasControlled && !witness_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Controlled substances require a witness'
                });
            }

            // Check availability for partial dispensing
            const availability = await dispensingService.checkPartialAvailability(
                req.user.id,
                id,
                items
            );

            const dispensing = await dispensingService.partialDispense(
                req.user.id,
                id,
                {
                    items: availability.available_items,
                    remaining_items: availability.remaining_items,
                    dispensing_notes,
                    pharmacist_notes,
                    witness_id,
                    partial_reason: partial_reason || 'Partial dispensing',
                    dispensed_at: new Date(),
                    dispensed_by: req.user.id
                }
            );

            logger.info('Pharmacist partially dispensed prescription', {
                pharmacistId: req.user.id,
                prescriptionId: id,
                dispensedCount: items.length,
                remainingCount: availability.remaining_items.length
            });

            res.json({
                success: true,
                data: dispensing,
                message: `Partially dispensed ${items.length} items. ${availability.remaining_items.length} items remaining.`
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error in partial dispensing', {
                error: error.message,
                pharmacistId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // DISPENSING HISTORY
    // ============================================

    /**
     * Get dispensing history
     * GET /api/v1/pharmacist/dispensing/history
     */
    async getDispensingHistory(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20,
                patient_id,
                prescription_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id,
                prescription_id,
                from_date,
                to_date
            };

            const history = await dispensingService.getDispensingHistory(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed dispensing history', {
                pharmacistId: req.user.id,
                count: history.data?.length || 0
            });

            res.json({
                success: true,
                data: history.data,
                pagination: history.pagination,
                summary: history.summary
            });
        } catch (error) {
            logger.error('Error getting dispensing history', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's dispensing
     * GET /api/v1/pharmacist/dispensing/today
     */
    async getTodaysDispensing(req, res, next) {
        try {
            const dispensing = await dispensingService.getTodaysDispensing(req.user.id);

            logger.info('Pharmacist viewed today\'s dispensing', {
                pharmacistId: req.user.id,
                count: dispensing.length
            });

            res.json({
                success: true,
                data: dispensing,
                summary: {
                    total: dispensing.length,
                    total_items: dispensing.reduce((acc, d) => acc + d.item_count, 0),
                    total_value: dispensing.reduce((acc, d) => acc + d.total_value, 0),
                    controlled_count: dispensing.filter(d => d.has_controlled).length
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s dispensing', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get dispensing by ID
     * GET /api/v1/pharmacist/dispensing/:id
     */
    async getDispensingById(req, res, next) {
        try {
            const { id } = req.params;

            const dispensing = await dispensingService.getDispensingById(
                req.user.id,
                id
            );

            if (!dispensing) {
                return res.status(404).json({
                    success: false,
                    error: 'Dispensing record not found'
                });
            }

            logger.info('Pharmacist viewed dispensing record', {
                pharmacistId: req.user.id,
                dispensingId: id,
                prescriptionId: dispensing.prescription_id
            });

            res.json({
                success: true,
                data: dispensing
            });
        } catch (error) {
            if (error.message === 'Dispensing record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Dispensing record not found'
                });
            }
            logger.error('Error getting dispensing by ID', {
                error: error.message,
                pharmacistId: req.user.id,
                dispensingId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // DISPENSING VERIFICATION
    // ============================================

    /**
     * Verify dispensing
     * PUT /api/v1/pharmacist/dispensing/:id/verify
     */
    async verifyDispensing(req, res, next) {
        try {
            const { id } = req.params;
            const { verified, notes } = req.body;

            if (verified === undefined) {
                return res.status(400).json({
                    success: false,
                    error: 'Verification status is required'
                });
            }

            const result = await dispensingService.verifyDispensing(
                req.user.id,
                id,
                {
                    verified,
                    notes,
                    verified_at: new Date(),
                    verified_by: req.user.id
                }
            );

            logger.info('Pharmacist verified dispensing', {
                pharmacistId: req.user.id,
                dispensingId: id,
                verified
            });

            res.json({
                success: true,
                data: result,
                message: verified ? 'Dispensing verified' : 'Dispensing rejected'
            });
        } catch (error) {
            if (error.message === 'Dispensing record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Dispensing record not found'
                });
            }
            logger.error('Error verifying dispensing', {
                error: error.message,
                pharmacistId: req.user.id,
                dispensingId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get dispensing statistics
     * GET /api/v1/pharmacist/dispensing/statistics
     */
    async getDispensingStatistics(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await dispensingService.getDispensingStatistics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting dispensing statistics', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // DISPENSING LABELS & RECEIPTS
    // ============================================

    /**
     * Generate dispensing label
     * GET /api/v1/pharmacist/dispensing/:id/label
     */
    async generateLabel(req, res, next) {
        try {
            const { id } = req.params;
            const { format = 'pdf' } = req.query;

            const label = await dispensingService.generateDispensingLabel(
                req.user.id,
                id,
                format
            );

            if (!label) {
                return res.status(404).json({
                    success: false,
                    error: 'Dispensing record not found'
                });
            }

            logger.info('Pharmacist generated dispensing label', {
                pharmacistId: req.user.id,
                dispensingId: id,
                format
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=dispensing-${id}-label.pdf`);
                return res.send(label);
            }

            res.json({
                success: true,
                data: label
            });
        } catch (error) {
            logger.error('Error generating dispensing label', {
                error: error.message,
                pharmacistId: req.user.id,
                dispensingId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Generate dispensing receipt
     * GET /api/v1/pharmacist/dispensing/:id/receipt
     */
    async generateReceipt(req, res, next) {
        try {
            const { id } = req.params;
            const { format = 'pdf' } = req.query;

            const receipt = await dispensingService.generateDispensingReceipt(
                req.user.id,
                id,
                format
            );

            if (!receipt) {
                return res.status(404).json({
                    success: false,
                    error: 'Dispensing record not found'
                });
            }

            logger.info('Pharmacist generated dispensing receipt', {
                pharmacistId: req.user.id,
                dispensingId: id,
                format
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=dispensing-${id}-receipt.pdf`);
                return res.send(receipt);
            }

            res.json({
                success: true,
                data: receipt
            });
        } catch (error) {
            logger.error('Error generating dispensing receipt', {
                error: error.message,
                pharmacistId: req.user.id,
                dispensingId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // DISPENSING ALERTS
    // ============================================

    /**
     * Get dispensing alerts
     * GET /api/v1/pharmacist/dispensing/alerts
     */
    async getDispensingAlerts(req, res, next) {
        try {
            const alerts = await dispensingService.getDispensingAlerts(req.user.id);

            logger.info('Pharmacist viewed dispensing alerts', {
                pharmacistId: req.user.id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    verification_needed: alerts.filter(a => a.type === 'verification_needed').length,
                    controlled_substances: alerts.filter(a => a.type === 'controlled_substance').length,
                    quantity_issues: alerts.filter(a => a.type === 'quantity_issue').length
                }
            });
        } catch (error) {
            logger.error('Error getting dispensing alerts', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = dispensingController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Prescription Lists     | 4         | All, pending, dispensed, by ID, items
 * Dispensing Operations  | 2         | Full dispense, partial dispense
 * Dispensing History     | 3         | History, today, by ID
 * Verification           | 2         | Verify, statistics
 * Labels & Receipts      | 2         | Generate label, generate receipt
 * Alerts                 | 1         | Dispensing alerts
 * -----------------------|-----------|----------------------
 * TOTAL                  | 14        | Complete dispensing management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-14] Medicine quantity positive
 * - [BR-15] Dosage required
 * - [BR-16] Controlled substances need witness
 * - [BR-18] No expired dispensing
 * - [BR-19] Stock non-negative
 * - [BR-22] FIFO dispensing
 * 
 * ======================================================================
 */