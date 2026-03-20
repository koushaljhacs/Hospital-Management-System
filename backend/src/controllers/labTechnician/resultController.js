/**
 * ======================================================================
 * FILE: backend/src/controllers/labTechnician/resultController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician result controller - Handles test result management.
 * Total Endpoints: 11
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * - [BR-37] Test results need verification
 * - [BR-38] Abnormal results flagged automatically
 * - [BR-39] Sample collection to result < 24 hours
 * 
 * ======================================================================
 */

const resultService = require('../../services/labTechnician/resultService');
const logger = require('../../utils/logger');

/**
 * Lab Technician Result Controller
 */
const resultController = {
    // ============================================
    // RESULT LISTS
    // ============================================

    /**
     * Get all test results
     * GET /api/v1/lab/results
     */
    async getAllResults(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                patient_id,
                test_id,
                from_date,
                to_date,
                abnormal_only = false,
                critical_only = false
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                patient_id,
                test_id,
                from_date,
                to_date,
                abnormal_only: abnormal_only === 'true',
                critical_only: critical_only === 'true'
            };

            const results = await resultService.getAllResults(
                req.user.id,
                options
            );

            logger.info('Lab technician retrieved all results', {
                technicianId: req.user.id,
                count: results.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination,
                summary: results.summary
            });
        } catch (error) {
            logger.error('Error getting all results', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending test results
     * GET /api/v1/lab/results/pending
     */
    async getPendingResults(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const results = await resultService.getResultsByStatus(
                req.user.id,
                'pending',
                options
            );

            logger.info('Lab technician viewed pending results', {
                technicianId: req.user.id,
                count: results.data?.length || 0
            });

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination,
                summary: {
                    total: results.summary?.total || 0,
                    awaiting_verification: results.data?.filter(r => r.verified_by).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending results', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed test results
     * GET /api/v1/lab/results/completed
     */
    async getCompletedResults(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const results = await resultService.getResultsByStatus(
                req.user.id,
                'completed',
                options
            );

            logger.info('Lab technician viewed completed results', {
                technicianId: req.user.id,
                count: results.data?.length || 0
            });

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination
            });
        } catch (error) {
            logger.error('Error getting completed results', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get abnormal test results
     * GET /api/v1/lab/results/abnormal
     * 
     * BUSINESS RULE: [BR-38] Abnormal results flagged automatically
     */
    async getAbnormalResults(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const results = await resultService.getAbnormalResults(
                req.user.id,
                options
            );

            logger.info('Lab technician viewed abnormal results', {
                technicianId: req.user.id,
                count: results.data?.length || 0
            });

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination,
                summary: {
                    total: results.summary?.total || 0,
                    critical: results.data?.filter(r => r.is_critical).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting abnormal results', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get critical test results
     * GET /api/v1/lab/results/critical
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getCriticalResults(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const results = await resultService.getCriticalResults(
                req.user.id,
                options
            );

            logger.info('Lab technician viewed critical results', {
                technicianId: req.user.id,
                count: results.data?.length || 0
            });

            // Group by severity
            const bySeverity = {
                panic: results.data?.filter(r => r.is_panic).length || 0,
                critical: results.data?.filter(r => r.is_critical && !r.is_panic).length || 0,
                warning: results.data?.filter(r => !r.is_critical && r.is_abnormal).length || 0
            };

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination,
                summary: {
                    total: results.summary?.total || 0,
                    by_severity: bySeverity,
                    unacknowledged: results.data?.filter(r => !r.acknowledged).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting critical results', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get test result by ID
     * GET /api/v1/lab/results/:id
     */
    async getResultById(req, res, next) {
        try {
            const { id } = req.params;

            const result = await resultService.getResultById(
                req.user.id,
                id
            );

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Test result not found'
                });
            }

            logger.info('Lab technician viewed result details', {
                technicianId: req.user.id,
                resultId: id,
                patientId: result.patient_id,
                isCritical: result.is_critical
            });

            // [BR-36] Log critical result view
            if (result.is_critical) {
                logger.warn('Critical result viewed', {
                    resultId: id,
                    patientId: result.patient_id,
                    value: result.result_value
                });
            }

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            if (error.message === 'Test result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test result not found'
                });
            }
            logger.error('Error getting result by ID', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // RESULT ENTRY & MANAGEMENT
    // ============================================

    /**
     * Enter test result
     * POST /api/v1/lab/results
     * 
     * BUSINESS RULES:
     * - [BR-36] Critical values notification
     * - [BR-38] Abnormal results flagging
     * - [BR-39] Within 24 hours of collection
     */
    async enterResult(req, res, next) {
        try {
            const resultData = {
                test_order_id: req.body.test_order_id,
                test_id: req.body.test_id,
                patient_id: req.body.patient_id,
                result_value: req.body.result_value,
                result_numeric: req.body.result_numeric,
                result_text: req.body.result_text,
                result_unit: req.body.result_unit,
                reference_range_low: req.body.reference_range_low,
                reference_range_high: req.body.reference_range_high,
                interpretation: req.body.interpretation,
                clinical_significance: req.body.clinical_significance,
                comments: req.body.comments,
                tested_by: req.user.id,
                tested_at: req.body.tested_at || new Date(),
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!resultData.test_order_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Test order ID is required'
                });
            }

            if (!resultData.test_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Test ID is required'
                });
            }

            if (!resultData.patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!resultData.result_value) {
                return res.status(400).json({
                    success: false,
                    error: 'Result value is required'
                });
            }

            // Check for duplicate within 7 days [BR-40]
            const duplicateCheck = await resultService.checkDuplicateTest(
                resultData.patient_id,
                resultData.test_id,
                resultData.tested_at
            );

            if (duplicateCheck.hasDuplicate) {
                return res.status(409).json({
                    success: false,
                    error: 'Duplicate test not allowed within 7 days',
                    previous_result: duplicateCheck.previousResult
                });
            }

            const result = await resultService.enterResult(
                req.user.id,
                resultData
            );

            logger.info('Lab technician entered test result', {
                technicianId: req.user.id,
                resultId: result.id,
                testOrderId: resultData.test_order_id,
                patientId: resultData.patient_id,
                isAbnormal: result.is_abnormal,
                isCritical: result.is_critical
            });

            // [BR-36] Send notification for critical values
            if (result.is_critical) {
                await resultService.sendCriticalAlert(result.id);
                
                logger.warn('Critical value alert sent', {
                    resultId: result.id,
                    patientId: resultData.patient_id,
                    value: result.result_value
                });
            }

            res.status(201).json({
                success: true,
                data: result,
                message: result.is_critical 
                    ? 'Test result entered with critical value - alert sent' 
                    : 'Test result entered successfully'
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
                    error: error.message
                });
            }
            logger.error('Error entering test result', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update test result
     * PUT /api/v1/lab/results/:id
     */
    async updateResult(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.test_order_id;
            delete updates.test_id;
            delete updates.patient_id;
            delete updates.tested_by;
            delete updates.verified_by;
            delete updates.approved_by;

            const result = await resultService.updateResult(
                req.user.id,
                id,
                updates
            );

            logger.info('Lab technician updated test result', {
                technicianId: req.user.id,
                resultId: id,
                updates: Object.keys(updates)
            });

            // Re-check critical status after update
            if (result.is_critical) {
                await resultService.sendCriticalAlert(result.id);
            }

            res.json({
                success: true,
                data: result,
                message: 'Test result updated successfully'
            });
        } catch (error) {
            if (error.message === 'Test result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test result not found'
                });
            }
            if (error.message === 'Cannot update verified result') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update verified test result'
                });
            }
            logger.error('Error updating test result', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete test result (if not verified)
     * DELETE /api/v1/lab/results/:id
     */
    async deleteResult(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await resultService.deleteResult(
                req.user.id,
                id,
                reason
            );

            logger.info('Lab technician deleted test result', {
                technicianId: req.user.id,
                resultId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Test result deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Test result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test result not found'
                });
            }
            if (error.message === 'Cannot delete verified result') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete verified test result'
                });
            }
            logger.error('Error deleting test result', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // RESULT VERIFICATION & APPROVAL
    // ============================================

    /**
     * Verify test result
     * PUT /api/v1/lab/results/:id/verify
     * 
     * BUSINESS RULE: [BR-37] Test results need verification
     */
    async verifyResult(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const result = await resultService.verifyResult(
                req.user.id,
                id,
                {
                    verified_by: req.user.id,
                    verified_at: new Date(),
                    verification_notes: notes
                }
            );

            logger.info('Lab technician verified test result', {
                technicianId: req.user.id,
                resultId: id
            });

            res.json({
                success: true,
                data: result,
                message: 'Test result verified successfully'
            });
        } catch (error) {
            if (error.message === 'Test result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test result not found'
                });
            }
            if (error.message === 'Result already verified') {
                return res.status(400).json({
                    success: false,
                    error: 'Test result already verified'
                });
            }
            logger.error('Error verifying test result', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Approve test result (supervisor)
     * PUT /api/v1/lab/results/:id/approve
     */
    async approveResult(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const result = await resultService.approveResult(
                req.user.id,
                id,
                {
                    approved_by: req.user.id,
                    approved_at: new Date(),
                    approval_notes: notes
                }
            );

            logger.info('Lab technician approved test result', {
                technicianId: req.user.id,
                resultId: id
            });

            res.json({
                success: true,
                data: result,
                message: 'Test result approved successfully'
            });
        } catch (error) {
            if (error.message === 'Test result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test result not found'
                });
            }
            if (error.message === 'Result not verified') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot approve unverified result'
                });
            }
            logger.error('Error approving test result', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // REPORT GENERATION
    // ============================================

    /**
     * Generate test report
     * POST /api/v1/lab/results/:id/report
     */
    async generateReport(req, res, next) {
        try {
            const { id } = req.params;
            const { format = 'pdf' } = req.query;

            const report = await resultService.generateReport(
                req.user.id,
                id,
                format
            );

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Test result not found'
                });
            }

            logger.info('Lab technician generated test report', {
                technicianId: req.user.id,
                resultId: id,
                format
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=test-result-${id}.pdf`);
                return res.send(report);
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            if (error.message === 'Test result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Test result not found'
                });
            }
            logger.error('Error generating report', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BULK OPERATIONS
    // ============================================

    /**
     * Bulk verify results
     * POST /api/v1/lab/results/bulk-verify
     */
    async bulkVerifyResults(req, res, next) {
        try {
            const { result_ids, notes } = req.body;

            if (!result_ids || !Array.isArray(result_ids) || result_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Result IDs array is required'
                });
            }

            const results = await resultService.bulkVerifyResults(
                req.user.id,
                result_ids,
                { notes }
            );

            logger.info('Lab technician bulk verified results', {
                technicianId: req.user.id,
                requestedCount: result_ids.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            });

            res.json({
                success: true,
                data: results,
                message: `Verified ${results.success.length} out of ${result_ids.length} results`
            });
        } catch (error) {
            logger.error('Error bulk verifying results', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get result statistics
     * GET /api/v1/lab/results/statistics
     */
    async getResultStatistics(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await resultService.getResultStatistics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting result statistics', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get turnaround time stats
     * GET /api/v1/lab/results/turnaround-time
     * 
     * BUSINESS RULE: [BR-39] Sample collection to result < 24 hours
     */
    async getTurnaroundTime(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const stats = await resultService.getTurnaroundTime(
                req.user.id,
                { from_date, to_date }
            );

            res.json({
                success: true,
                data: stats,
                summary: {
                    within_24h: stats.within_24h_percentage,
                    average_hours: stats.avg_hours,
                    exceeding: stats.exceeding_24h_count
                }
            });
        } catch (error) {
            logger.error('Error getting turnaround time', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // CRITICAL VALUE MANAGEMENT
    // ============================================

    /**
     * Get critical value alerts
     * GET /api/v1/lab/results/critical-alerts
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getCriticalAlerts(req, res, next) {
        try {
            const alerts = await resultService.getCriticalAlerts(req.user.id);

            logger.info('Lab technician viewed critical alerts', {
                technicianId: req.user.id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    unacknowledged: alerts.filter(a => !a.acknowledged).length,
                    panic: alerts.filter(a => a.is_panic).length
                }
            });
        } catch (error) {
            logger.error('Error getting critical alerts', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Acknowledge critical alert
     * PUT /api/v1/lab/results/alerts/:id/acknowledge
     */
    async acknowledgeCriticalAlert(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const alert = await resultService.acknowledgeCriticalAlert(
                req.user.id,
                id,
                {
                    acknowledged_by: req.user.id,
                    acknowledged_at: new Date(),
                    acknowledgment_notes: notes
                }
            );

            logger.info('Lab technician acknowledged critical alert', {
                technicianId: req.user.id,
                alertId: id
            });

            res.json({
                success: true,
                data: alert,
                message: 'Critical alert acknowledged'
            });
        } catch (error) {
            if (error.message === 'Alert not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found'
                });
            }
            logger.error('Error acknowledging critical alert', {
                error: error.message,
                technicianId: req.user.id,
                alertId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Notify doctor of critical result
     * POST /api/v1/lab/results/:id/notify-doctor
     */
    async notifyDoctor(req, res, next) {
        try {
            const { id } = req.params;
            const { notification_method = 'both' } = req.body;

            const notification = await resultService.notifyDoctor(
                req.user.id,
                id,
                notification_method
            );

            logger.info('Lab technician notified doctor of critical result', {
                technicianId: req.user.id,
                resultId: id,
                doctorId: notification.doctor_id,
                method: notification_method
            });

            res.json({
                success: true,
                data: notification,
                message: `Doctor notified via ${notification_method}`
            });
        } catch (error) {
            if (error.message === 'Result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Result not found'
                });
            }
            if (error.message === 'Result not critical') {
                return res.status(400).json({
                    success: false,
                    error: 'Only critical results require doctor notification'
                });
            }
            logger.error('Error notifying doctor', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EXPORT & PRINT
    // ============================================

    /**
     * Export results
     * GET /api/v1/lab/results/export
     */
    async exportResults(req, res, next) {
        try {
            const { format = 'csv', from_date, to_date, patient_id } = req.query;

            const data = await resultService.exportResults(
                req.user.id,
                format,
                { from_date, to_date, patient_id }
            );

            logger.info('Lab technician exported results', {
                technicianId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=lab-results-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting results', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Print result
     * GET /api/v1/lab/results/:id/print
     */
    async printResult(req, res, next) {
        try {
            const { id } = req.params;

            const pdfData = await resultService.generatePrintableResult(
                req.user.id,
                id
            );

            if (!pdfData) {
                return res.status(404).json({
                    success: false,
                    error: 'Result not found'
                });
            }

            logger.info('Lab technician printed result', {
                technicianId: req.user.id,
                resultId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=result-${id}.pdf`);
            res.send(pdfData);
        } catch (error) {
            if (error.message === 'Result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Result not found'
                });
            }
            logger.error('Error printing result', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // RESULT NOTES
    // ============================================

    /**
     * Add result note
     * POST /api/v1/lab/results/:id/notes
     */
    async addResultNote(req, res, next) {
        try {
            const { id } = req.params;
            const { note } = req.body;

            if (!note || note.trim().length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Note must be at least 5 characters'
                });
            }

            const resultNote = await resultService.addResultNote(
                req.user.id,
                id,
                {
                    note,
                    created_by: req.user.id,
                    created_at: new Date()
                }
            );

            logger.info('Lab technician added result note', {
                technicianId: req.user.id,
                resultId: id
            });

            res.status(201).json({
                success: true,
                data: resultNote,
                message: 'Note added successfully'
            });
        } catch (error) {
            if (error.message === 'Result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Result not found'
                });
            }
            logger.error('Error adding result note', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get result notes
     * GET /api/v1/lab/results/:id/notes
     */
    async getResultNotes(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const notes = await resultService.getResultNotes(
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
            if (error.message === 'Result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Result not found'
                });
            }
            logger.error('Error getting result notes', {
                error: error.message,
                technicianId: req.user.id,
                resultId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = resultController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Result Lists           | 6         | All, pending, completed, abnormal, critical, by ID
 * Result Entry           | 3         | Enter, update, delete
 * Verification & Approval| 2         | Verify, approve
 * Report Generation      | 1         | Generate report
 * Bulk Operations        | 2         | Bulk verify, statistics, turnaround time
 * Critical Management    | 3         | Get alerts, acknowledge, notify doctor
 * Export & Print         | 2         | Export, print
 * Result Notes           | 2         | Add note, get notes
 * -----------------------|-----------|----------------------
 * TOTAL                  | 21        | Complete result management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical value alerts and notification
 * - [BR-37] Verification required
 * - [BR-38] Abnormal flagging
 * - [BR-39] 24-hour turnaround monitoring
 * 
 * ======================================================================
 */