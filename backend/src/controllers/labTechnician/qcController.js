/**
 * ======================================================================
 * FILE: backend/src/controllers/labTechnician/qcController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician quality control controller - Handles QC records and statistics.
 * Total Endpoints: 4
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const qcService = require('../../services/labTechnician/qcService');
const logger = require('../../utils/logger');

/**
 * Lab Technician Quality Control Controller
 */
const qcController = {
    // ============================================
    // QC RECORDS
    // ============================================

    /**
     * Get all quality control records
     * GET /api/v1/lab/qc
     */
    async getAllQCRecords(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                test_id,
                performed_by,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                test_id,
                performed_by,
                from_date,
                to_date
            };

            const records = await qcService.getAllQCRecords(
                req.user.id,
                options
            );

            logger.info('Lab technician retrieved QC records', {
                technicianId: req.user.id,
                count: records.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: records.data,
                pagination: records.pagination,
                summary: records.summary
            });
        } catch (error) {
            logger.error('Error getting QC records', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Add quality control record
     * POST /api/v1/lab/qc
     */
    async addQCRecord(req, res, next) {
        try {
            const qcData = {
                test_id: req.body.test_id,
                control_type: req.body.control_type,
                control_lot: req.body.control_lot,
                control_expiry: req.body.control_expiry,
                result: req.body.result,
                status: req.body.status,
                performed_by: req.user.id,
                performed_at: req.body.performed_at || new Date(),
                notes: req.body.notes,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!qcData.test_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Test ID is required'
                });
            }

            if (!qcData.control_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Control type is required'
                });
            }

            if (!qcData.control_lot) {
                return res.status(400).json({
                    success: false,
                    error: 'Control lot number is required'
                });
            }

            if (!qcData.control_expiry) {
                return res.status(400).json({
                    success: false,
                    error: 'Control expiry date is required'
                });
            }

            // Check if control is expired
            if (new Date(qcData.control_expiry) < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Control material has expired'
                });
            }

            if (!qcData.result) {
                return res.status(400).json({
                    success: false,
                    error: 'Control result is required'
                });
            }

            if (!qcData.status) {
                return res.status(400).json({
                    success: false,
                    error: 'QC status is required'
                });
            }

            const record = await qcService.addQCRecord(
                req.user.id,
                qcData
            );

            logger.info('Lab technician added QC record', {
                technicianId: req.user.id,
                recordId: record.id,
                testId: qcData.test_id,
                controlType: qcData.control_type,
                status: qcData.status
            });

            // Log failed QC
            if (qcData.status === 'failed') {
                logger.warn('QC record failed', {
                    recordId: record.id,
                    testId: qcData.test_id,
                    result: qcData.result
                });
            }

            res.status(201).json({
                success: true,
                data: record,
                message: qcData.status === 'passed' 
                    ? 'QC record added successfully' 
                    : 'QC record added - action may be required'
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error adding QC record', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get quality control record by ID
     * GET /api/v1/lab/qc/:id
     */
    async getQCRecordById(req, res, next) {
        try {
            const { id } = req.params;

            const record = await qcService.getQCRecordById(
                req.user.id,
                id
            );

            if (!record) {
                return res.status(404).json({
                    success: false,
                    error: 'QC record not found'
                });
            }

            logger.info('Lab technician viewed QC record details', {
                technicianId: req.user.id,
                recordId: id,
                testId: record.test_id,
                status: record.status
            });

            res.json({
                success: true,
                data: record
            });
        } catch (error) {
            if (error.message === 'QC record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'QC record not found'
                });
            }
            logger.error('Error getting QC record by ID', {
                error: error.message,
                technicianId: req.user.id,
                recordId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update QC record
     * PUT /api/v1/lab/qc/:id
     */
    async updateQCRecord(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.test_id;
            delete updates.performed_by;
            delete updates.performed_at;

            const record = await qcService.updateQCRecord(
                req.user.id,
                id,
                updates
            );

            logger.info('Lab technician updated QC record', {
                technicianId: req.user.id,
                recordId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: record,
                message: 'QC record updated successfully'
            });
        } catch (error) {
            if (error.message === 'QC record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'QC record not found'
                });
            }
            logger.error('Error updating QC record', {
                error: error.message,
                technicianId: req.user.id,
                recordId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete QC record
     * DELETE /api/v1/lab/qc/:id
     */
    async deleteQCRecord(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await qcService.deleteQCRecord(
                req.user.id,
                id,
                reason
            );

            logger.info('Lab technician deleted QC record', {
                technicianId: req.user.id,
                recordId: id,
                reason
            });

            res.json({
                success: true,
                message: 'QC record deleted successfully'
            });
        } catch (error) {
            if (error.message === 'QC record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'QC record not found'
                });
            }
            logger.error('Error deleting QC record', {
                error: error.message,
                technicianId: req.user.id,
                recordId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // QC STATISTICS
    // ============================================

    /**
     * Get quality control statistics
     * GET /api/v1/lab/qc/stats
     */
    async getQCStatistics(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                test_id,
                period = 'month' 
            } = req.query;

            const options = {
                from_date,
                to_date,
                test_id,
                period
            };

            const stats = await qcService.getQCStatistics(
                req.user.id,
                options
            );

            logger.info('Lab technician viewed QC statistics', {
                technicianId: req.user.id,
                period,
                testId: test_id
            });

            res.json({
                success: true,
                data: stats,
                summary: {
                    total_records: stats.total_records,
                    pass_rate: stats.pass_rate,
                    fail_rate: stats.fail_rate,
                    by_test: stats.by_test,
                    trend: stats.trend
                }
            });
        } catch (error) {
            logger.error('Error getting QC statistics', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get QC pass rate by test
     * GET /api/v1/lab/qc/pass-rate
     */
    async getQCPassRate(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const passRate = await qcService.getQCPassRate(
                req.user.id,
                { from_date, to_date }
            );

            res.json({
                success: true,
                data: passRate
            });
        } catch (error) {
            logger.error('Error getting QC pass rate', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get failed QC records
     * GET /api/v1/lab/qc/failed
     */
    async getFailedQCRecords(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const records = await qcService.getFailedQCRecords(
                req.user.id,
                options
            );

            logger.info('Lab technician viewed failed QC records', {
                technicianId: req.user.id,
                count: records.data?.length || 0
            });

            res.json({
                success: true,
                data: records.data,
                pagination: records.pagination,
                summary: {
                    total: records.summary?.total || 0,
                    by_test: records.summary?.by_test || {}
                }
            });
        } catch (error) {
            logger.error('Error getting failed QC records', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // QC CHARTS & TRENDS
    // ============================================

    /**
     * Get QC control charts
     * GET /api/v1/lab/qc/control-charts
     */
    async getControlCharts(req, res, next) {
        try {
            const { test_id, days = 30 } = req.query;

            if (!test_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Test ID is required'
                });
            }

            const charts = await qcService.getControlCharts(
                req.user.id,
                test_id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: charts
            });
        } catch (error) {
            logger.error('Error getting control charts', {
                error: error.message,
                technicianId: req.user.id,
                testId: req.query.test_id
            });
            next(error);
        }
    },

    /**
     * Get QC trend analysis
     * GET /api/v1/lab/qc/trends
     */
    async getQCTrends(req, res, next) {
        try {
            const { test_id, months = 6 } = req.query;

            const trends = await qcService.getQCTrends(
                req.user.id,
                { test_id, months: parseInt(months) }
            );

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting QC trends', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // QC LOT TRACKING
    // ============================================

    /**
     * Get QC lots
     * GET /api/v1/lab/qc/lots
     */
    async getQCLots(req, res, next) {
        try {
            const { status, test_id } = req.query;

            const lots = await qcService.getQCLots(
                req.user.id,
                { status, test_id }
            );

            res.json({
                success: true,
                data: lots,
                summary: {
                    total: lots.length,
                    active: lots.filter(l => l.status === 'active').length,
                    expired: lots.filter(l => l.status === 'expired').length,
                    expiring_soon: lots.filter(l => {
                        const daysUntilExpiry = Math.ceil((new Date(l.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                    }).length
                }
            });
        } catch (error) {
            logger.error('Error getting QC lots', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Add QC lot
     * POST /api/v1/lab/qc/lots
     */
    async addQCLot(req, res, next) {
        try {
            const lotData = {
                lot_number: req.body.lot_number,
                test_id: req.body.test_id,
                manufacturer: req.body.manufacturer,
                manufacturing_date: req.body.manufacturing_date,
                expiry_date: req.body.expiry_date,
                storage_conditions: req.body.storage_conditions,
                certificate_url: req.body.certificate_url,
                notes: req.body.notes
            };

            // Validate required fields
            if (!lotData.lot_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Lot number is required'
                });
            }

            if (!lotData.test_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Test ID is required'
                });
            }

            if (!lotData.expiry_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Expiry date is required'
                });
            }

            // Check if lot already exists
            const existingLot = await qcService.getQCLotByNumber(lotData.lot_number);
            if (existingLot) {
                return res.status(409).json({
                    success: false,
                    error: 'Lot number already exists'
                });
            }

            const lot = await qcService.addQCLot(
                req.user.id,
                lotData
            );

            logger.info('Lab technician added QC lot', {
                technicianId: req.user.id,
                lotId: lot.id,
                lotNumber: lotData.lot_number,
                testId: lotData.test_id
            });

            res.status(201).json({
                success: true,
                data: lot,
                message: 'QC lot added successfully'
            });
        } catch (error) {
            logger.error('Error adding QC lot', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // QC ALERTS
    // ============================================

    /**
     * Get QC alerts
     * GET /api/v1/lab/qc/alerts
     */
    async getQCAlerts(req, res, next) {
        try {
            const alerts = await qcService.getQCAlerts(req.user.id);

            logger.info('Lab technician viewed QC alerts', {
                technicianId: req.user.id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    failed_qc: alerts.filter(a => a.type === 'failed_qc').length,
                    lot_expiring: alerts.filter(a => a.type === 'lot_expiring').length,
                    lot_expired: alerts.filter(a => a.type === 'lot_expired').length,
                    critical: alerts.filter(a => a.severity === 'critical').length
                }
            });
        } catch (error) {
            logger.error('Error getting QC alerts', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Acknowledge QC alert
     * PUT /api/v1/lab/qc/alerts/:id/acknowledge
     */
    async acknowledgeQCAlert(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, action_taken } = req.body;

            const alert = await qcService.acknowledgeQCAlert(
                req.user.id,
                id,
                {
                    notes,
                    action_taken,
                    acknowledged_by: req.user.id,
                    acknowledged_at: new Date()
                }
            );

            logger.info('Lab technician acknowledged QC alert', {
                technicianId: req.user.id,
                alertId: id,
                actionTaken: action_taken
            });

            res.json({
                success: true,
                data: alert,
                message: 'QC alert acknowledged'
            });
        } catch (error) {
            if (error.message === 'Alert not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found'
                });
            }
            logger.error('Error acknowledging QC alert', {
                error: error.message,
                technicianId: req.user.id,
                alertId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // QC REPORTS
    // ============================================

    /**
     * Generate QC report
     * GET /api/v1/lab/qc/report
     */
    async generateQCReport(req, res, next) {
        try {
            const { 
                format = 'pdf', 
                from_date, 
                to_date,
                test_id,
                include_charts = true 
            } = req.query;

            const report = await qcService.generateQCReport(
                req.user.id,
                {
                    format,
                    from_date,
                    to_date,
                    test_id,
                    include_charts: include_charts === 'true'
                }
            );

            logger.info('Lab technician generated QC report', {
                technicianId: req.user.id,
                format,
                testId: test_id
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=qc-report-${Date.now()}.pdf`);
                return res.send(report);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=qc-report-${Date.now()}.csv`);
                return res.send(report);
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error generating QC report', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export QC records
     * GET /api/v1/lab/qc/export
     */
    async exportQCRecords(req, res, next) {
        try {
            const { format = 'csv', from_date, to_date, test_id } = req.query;

            const data = await qcService.exportQCRecords(
                req.user.id,
                format,
                { from_date, to_date, test_id }
            );

            logger.info('Lab technician exported QC records', {
                technicianId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=qc-records-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting QC records', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // QC NOTES
    // ============================================

    /**
     * Add QC note
     * POST /api/v1/lab/qc/:id/notes
     */
    async addQCNote(req, res, next) {
        try {
            const { id } = req.params;
            const { note } = req.body;

            if (!note || note.trim().length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Note must be at least 5 characters'
                });
            }

            const qcNote = await qcService.addQCNote(
                req.user.id,
                id,
                {
                    note,
                    created_by: req.user.id,
                    created_at: new Date()
                }
            );

            logger.info('Lab technician added QC note', {
                technicianId: req.user.id,
                recordId: id
            });

            res.status(201).json({
                success: true,
                data: qcNote,
                message: 'Note added successfully'
            });
        } catch (error) {
            if (error.message === 'QC record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'QC record not found'
                });
            }
            logger.error('Error adding QC note', {
                error: error.message,
                technicianId: req.user.id,
                recordId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get QC notes
     * GET /api/v1/lab/qc/:id/notes
     */
    async getQCNotes(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const notes = await qcService.getQCNotes(
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
            if (error.message === 'QC record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'QC record not found'
                });
            }
            logger.error('Error getting QC notes', {
                error: error.message,
                technicianId: req.user.id,
                recordId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // QC VALIDATION
    // ============================================

    /**
     * Validate QC result against range
     * POST /api/v1/lab/qc/validate
     */
    async validateQCResult(req, res, next) {
        try {
            const { test_id, result, lot_number } = req.body;

            if (!test_id || !result) {
                return res.status(400).json({
                    success: false,
                    error: 'Test ID and result are required'
                });
            }

            const validation = await qcService.validateQCResult(
                req.user.id,
                { test_id, result, lot_number }
            );

            res.json({
                success: true,
                data: validation
            });
        } catch (error) {
            logger.error('Error validating QC result', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = qcController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * QC Records             | 4         | Get all, add, get by ID, update, delete
 * QC Statistics          | 3         | Statistics, pass rate, failed records
 * QC Charts & Trends     | 2         | Control charts, trends
 * QC Lot Tracking        | 2         | Get lots, add lot
 * QC Alerts              | 2         | Get alerts, acknowledge
 * QC Reports             | 2         | Generate report, export
 * QC Notes               | 2         | Add note, get notes
 * QC Validation          | 1         | Validate result
 * -----------------------|-----------|----------------------
 * TOTAL                  | 18        | Complete QC management
 * 
 * ======================================================================
 */