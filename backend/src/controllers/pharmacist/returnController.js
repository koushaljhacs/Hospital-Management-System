/**
 * ======================================================================
 * FILE: backend/src/controllers/pharmacist/returnController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist return controller - Handles medicine returns and expiry disposal.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-21] Alert 30 days before expiry
 * 
 * ENDPOINTS: 4 endpoints
 * ======================================================================
 */

const returnService = require('../../services/pharmacist/returnService');
const logger = require('../../utils/logger');

/**
 * Pharmacist Return Controller
 */
const returnController = {
    // ============================================
    // RETURN OPERATIONS
    // ============================================

    /**
     * Return medicine
     * POST /api/v1/pharmacist/returns
     */
    async returnMedicine(req, res, next) {
        try {
            const returnData = {
                prescription_id: req.body.prescription_id,
                medicine_id: req.body.medicine_id,
                batch_id: req.body.batch_id,
                quantity: req.body.quantity,
                return_reason: req.body.return_reason,
                return_type: req.body.return_type,
                condition: req.body.condition,
                notes: req.body.notes,
                returned_by: req.user.id,
                returned_at: new Date(),
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!returnData.medicine_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Medicine ID is required'
                });
            }

            if (!returnData.quantity || returnData.quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid quantity is required'
                });
            }

            if (!returnData.return_reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Return reason is required'
                });
            }

            if (!returnData.return_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Return type is required'
                });
            }

            // Validate return type
            const validTypes = ['damaged', 'expired', 'wrong_item', 'patient_return', 'quality_issue'];
            if (!validTypes.includes(returnData.return_type)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid return type'
                });
            }

            const returnRecord = await returnService.returnMedicine(
                req.user.id,
                returnData
            );

            logger.info('Pharmacist processed medicine return', {
                pharmacistId: req.user.id,
                returnId: returnRecord.id,
                medicineId: returnData.medicine_id,
                quantity: returnData.quantity,
                returnType: returnData.return_type
            });

            res.status(201).json({
                success: true,
                data: returnRecord,
                message: 'Return processed successfully'
            });
        } catch (error) {
            if (error.message === 'Medicine not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Medicine not found'
                });
            }
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Batch not found'
                });
            }
            if (error.message.includes('exceeds available')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error processing return', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get returns history
     * GET /api/v1/pharmacist/returns
     */
    async getReturnsHistory(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20,
                return_type,
                medicine_id,
                from_date,
                to_date,
                status
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                return_type,
                medicine_id,
                from_date,
                to_date,
                status
            };

            const returns = await returnService.getReturnsHistory(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed returns history', {
                pharmacistId: req.user.id,
                count: returns.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Calculate summary statistics
            const summary = {
                total: returns.summary?.total || 0,
                total_quantity: returns.data?.reduce((acc, r) => acc + r.quantity, 0) || 0,
                by_type: {
                    damaged: returns.data?.filter(r => r.return_type === 'damaged').length || 0,
                    expired: returns.data?.filter(r => r.return_type === 'expired').length || 0,
                    wrong_item: returns.data?.filter(r => r.return_type === 'wrong_item').length || 0,
                    patient_return: returns.data?.filter(r => r.return_type === 'patient_return').length || 0,
                    quality_issue: returns.data?.filter(r => r.return_type === 'quality_issue').length || 0
                },
                total_value: returns.data?.reduce((acc, r) => {
                    return acc + (r.quantity * (r.unit_price || 0));
                }, 0) || 0
            };

            res.json({
                success: true,
                data: returns.data,
                pagination: returns.pagination,
                summary
            });
        } catch (error) {
            logger.error('Error getting returns history', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get return by ID
     * GET /api/v1/pharmacist/returns/:id
     */
    async getReturnById(req, res, next) {
        try {
            const { id } = req.params;

            const returnRecord = await returnService.getReturnById(
                req.user.id,
                id
            );

            if (!returnRecord) {
                return res.status(404).json({
                    success: false,
                    error: 'Return record not found'
                });
            }

            logger.info('Pharmacist viewed return details', {
                pharmacistId: req.user.id,
                returnId: id,
                medicineName: returnRecord.medicine_name,
                returnType: returnRecord.return_type
            });

            res.json({
                success: true,
                data: returnRecord
            });
        } catch (error) {
            if (error.message === 'Return record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Return record not found'
                });
            }
            logger.error('Error getting return by ID', {
                error: error.message,
                pharmacistId: req.user.id,
                returnId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update return status
     * PUT /api/v1/pharmacist/returns/:id/status
     */
    async updateReturnStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }

            const validStatuses = ['pending', 'approved', 'rejected', 'processed', 'completed'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status'
                });
            }

            const returnRecord = await returnService.updateReturnStatus(
                req.user.id,
                id,
                status,
                { notes, updated_by: req.user.id }
            );

            logger.info('Pharmacist updated return status', {
                pharmacistId: req.user.id,
                returnId: id,
                newStatus: status
            });

            res.json({
                success: true,
                data: returnRecord,
                message: `Return status updated to ${status}`
            });
        } catch (error) {
            if (error.message === 'Return record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Return record not found'
                });
            }
            logger.error('Error updating return status', {
                error: error.message,
                pharmacistId: req.user.id,
                returnId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EXPIRY MANAGEMENT
    // ============================================

    /**
     * Dispose expired medicines
     * POST /api/v1/pharmacist/expiry/dispose
     * 
     * BUSINESS RULE: [BR-18] Cannot dispense expired medicine
     */
    async disposeExpired(req, res, next) {
        try {
            const { 
                items,
                disposal_method,
                disposal_date,
                witness_id,
                notes 
            } = req.body;

            if (!items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Items to dispose are required'
                });
            }

            // Validate disposal method
            const validMethods = ['incineration', 'chemical_treatment', 'landfill', 'return_to_supplier'];
            if (disposal_method && !validMethods.includes(disposal_method)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid disposal method'
                });
            }

            const disposal = await returnService.disposeExpired(
                req.user.id,
                {
                    items,
                    disposal_method: disposal_method || 'incineration',
                    disposal_date: disposal_date || new Date(),
                    witness_id,
                    notes,
                    disposed_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Pharmacist disposed expired medicines', {
                pharmacistId: req.user.id,
                disposalId: disposal.id,
                itemCount: items.length,
                totalQuantity: disposal.total_quantity,
                method: disposal_method
            });

            // Log controlled substances disposal if any
            if (disposal.has_controlled) {
                logger.audit({
                    action: 'CONTROLLED_SUBSTANCE_DISPOSAL',
                    userId: req.user.id,
                    witnessId: witness_id,
                    disposalId: disposal.id,
                    quantity: disposal.controlled_quantity
                });
            }

            res.status(201).json({
                success: true,
                data: disposal,
                message: `Successfully disposed ${disposal.total_quantity} units of expired medicines`
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error disposing expired medicines', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get expiry report
     * GET /api/v1/pharmacist/expiry/report
     * 
     * BUSINESS RULE: [BR-21] Alert 30 days before expiry
     */
    async getExpiryReport(req, res, next) {
        try {
            const { 
                days = 90,
                category,
                manufacturer,
                location
            } = req.query;

            const options = {
                days: parseInt(days),
                category,
                manufacturer,
                location
            };

            const report = await returnService.getExpiryReport(
                req.user.id,
                options
            );

            logger.info('Pharmacist generated expiry report', {
                pharmacistId: req.user.id,
                days: parseInt(days),
                expiringCount: report.expiring_soon?.length || 0,
                expiredCount: report.expired?.length || 0
            });

            res.json({
                success: true,
                data: report,
                summary: {
                    total_items: report.total_items,
                    expiring_soon: report.expiring_soon_count,
                    expired: report.expired_count,
                    total_value: report.total_value,
                    potential_loss: report.potential_loss
                }
            });
        } catch (error) {
            logger.error('Error generating expiry report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get expiry alerts
     * GET /api/v1/pharmacist/expiry/alerts
     */
    async getExpiryAlerts(req, res, next) {
        try {
            const alerts = await returnService.getExpiryAlerts(req.user.id);

            logger.info('Pharmacist viewed expiry alerts', {
                pharmacistId: req.user.id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    critical: alerts.filter(a => a.severity === 'critical').length,
                    warning: alerts.filter(a => a.severity === 'warning').length,
                    info: alerts.filter(a => a.severity === 'info').length
                }
            });
        } catch (error) {
            logger.error('Error getting expiry alerts', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Acknowledge expiry alert
     * PUT /api/v1/pharmacist/expiry/alerts/:id/acknowledge
     */
    async acknowledgeExpiryAlert(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, action_taken } = req.body;

            const alert = await returnService.acknowledgeExpiryAlert(
                req.user.id,
                id,
                {
                    notes,
                    action_taken,
                    acknowledged_at: new Date(),
                    acknowledged_by: req.user.id
                }
            );

            logger.info('Pharmacist acknowledged expiry alert', {
                pharmacistId: req.user.id,
                alertId: id
            });

            res.json({
                success: true,
                data: alert,
                message: 'Expiry alert acknowledged'
            });
        } catch (error) {
            if (error.message === 'Alert not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found'
                });
            }
            logger.error('Error acknowledging expiry alert', {
                error: error.message,
                pharmacistId: req.user.id,
                alertId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // RETURN REPORTS
    // ============================================

    /**
     * Get return statistics
     * GET /api/v1/pharmacist/returns/statistics
     */
    async getReturnStatistics(req, res, next) {
        try {
            const { period = 'month', from_date, to_date } = req.query;

            const stats = await returnService.getReturnStatistics(
                req.user.id,
                { period, from_date, to_date }
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting return statistics', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get returns by reason
     * GET /api/v1/pharmacist/returns/by-reason
     */
    async getReturnsByReason(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const data = await returnService.getReturnsByReason(
                req.user.id,
                { from_date, to_date }
            );

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error getting returns by reason', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export returns report
     * GET /api/v1/pharmacist/returns/export
     */
    async exportReturnsReport(req, res, next) {
        try {
            const { 
                format = 'csv', 
                from_date, 
                to_date,
                return_type 
            } = req.query;

            const data = await returnService.exportReturnsReport(
                req.user.id,
                format,
                { from_date, to_date, return_type }
            );

            logger.info('Pharmacist exported returns report', {
                pharmacistId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=returns-${Date.now()}.csv`);
                return res.send(data);
            }

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=returns-${Date.now()}.pdf`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting returns report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // SUPPLIER RETURNS
    // ============================================

    /**
     * Return to supplier
     * POST /api/v1/pharmacist/returns/to-supplier
     */
    async returnToSupplier(req, res, next) {
        try {
            const {
                supplier_id,
                items,
                return_reason,
                shipping_method,
                tracking_number,
                notes
            } = req.body;

            if (!supplier_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Supplier ID is required'
                });
            }

            if (!items || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Items to return are required'
                });
            }

            const supplierReturn = await returnService.returnToSupplier(
                req.user.id,
                {
                    supplier_id,
                    items,
                    return_reason: return_reason || 'Return to supplier',
                    shipping_method,
                    tracking_number,
                    notes,
                    returned_by: req.user.id,
                    returned_at: new Date()
                }
            );

            logger.info('Pharmacist processed supplier return', {
                pharmacistId: req.user.id,
                returnId: supplierReturn.id,
                supplierId: supplier_id,
                itemCount: items.length
            });

            res.status(201).json({
                success: true,
                data: supplierReturn,
                message: 'Return to supplier processed successfully'
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error processing supplier return', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get supplier returns
     * GET /api/v1/pharmacist/returns/supplier-returns
     */
    async getSupplierReturns(req, res, next) {
        try {
            const { page = 1, limit = 20, supplier_id, status } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                supplier_id,
                status
            };

            const returns = await returnService.getSupplierReturns(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: returns.data,
                pagination: returns.pagination
            });
        } catch (error) {
            logger.error('Error getting supplier returns', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update supplier return status
     * PUT /api/v1/pharmacist/returns/supplier-returns/:id/status
     */
    async updateSupplierReturnStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }

            const supplierReturn = await returnService.updateSupplierReturnStatus(
                req.user.id,
                id,
                status,
                { notes }
            );

            res.json({
                success: true,
                data: supplierReturn,
                message: `Supplier return status updated to ${status}`
            });
        } catch (error) {
            if (error.message === 'Return not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Return not found'
                });
            }
            logger.error('Error updating supplier return status', {
                error: error.message,
                pharmacistId: req.user.id,
                returnId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // CREDIT NOTES
    // ============================================

    /**
     * Generate credit note for return
     * POST /api/v1/pharmacist/returns/:id/credit-note
     */
    async generateCreditNote(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const creditNote = await returnService.generateCreditNote(
                req.user.id,
                id,
                { notes }
            );

            logger.info('Pharmacist generated credit note', {
                pharmacistId: req.user.id,
                returnId: id,
                creditNoteId: creditNote.id,
                amount: creditNote.amount
            });

            res.status(201).json({
                success: true,
                data: creditNote,
                message: 'Credit note generated successfully'
            });
        } catch (error) {
            if (error.message === 'Return not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Return not found'
                });
            }
            if (error.message === 'Credit note already exists') {
                return res.status(409).json({
                    success: false,
                    error: 'Credit note already exists for this return'
                });
            }
            logger.error('Error generating credit note', {
                error: error.message,
                pharmacistId: req.user.id,
                returnId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get credit notes
     * GET /api/v1/pharmacist/returns/credit-notes
     */
    async getCreditNotes(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const creditNotes = await returnService.getCreditNotes(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: creditNotes.data,
                pagination: creditNotes.pagination,
                summary: {
                    total: creditNotes.summary?.total || 0,
                    total_amount: creditNotes.summary?.total_amount || 0,
                    utilized: creditNotes.summary?.utilized || 0,
                    balance: (creditNotes.summary?.total_amount || 0) - (creditNotes.summary?.utilized || 0)
                }
            });
        } catch (error) {
            logger.error('Error getting credit notes', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = returnController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Return Operations      | 4         | Create return, get history, get by ID, update status
 * Expiry Management      | 4         | Dispose expired, expiry report, alerts, acknowledge
 * Return Reports         | 3         | Statistics, by reason, export
 * Supplier Returns       | 3         | Return to supplier, get, update status
 * Credit Notes           | 2         | Generate credit note, get credit notes
 * -----------------------|-----------|----------------------
 * TOTAL                  | 16        | Complete returns & expiry management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-21] Expiry alerts
 * 
 * ======================================================================
 */