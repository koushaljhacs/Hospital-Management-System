/**
 * ======================================================================
 * FILE: backend/src/controllers/radiologist/reportController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist report controller - Handles radiology report management.
 * Total Endpoints: 9
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-20
 * 
 * BUSINESS RULES:
 * - [BR-41] Critical findings require immediate notification
 * - [BR-42] Reports need verification before finalization
 * - [BR-44] Comparison with previous studies required
 * 
 * ======================================================================
 */

const reportService = require('../../services/radiologist/reportService');
const notificationService = require('../../services/radiologist/notificationService');
const logger = require('../../utils/logger');

/**
 * Radiologist Report Controller
 */
const reportController = {
    // ============================================
    // REPORT LISTS
    // ============================================

    /**
     * Get all radiology reports
     * GET /api/v1/radiology/reports
     */
    async getAllReports(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                patient_id,
                order_id,
                radiologist_id,
                from_date,
                to_date,
                critical_finding
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                patient_id,
                order_id,
                radiologist_id,
                from_date,
                to_date,
                critical_finding: critical_finding === 'true'
            };

            const reports = await reportService.getAllReports(
                req.user.id,
                options
            );

            logger.info('Radiologist retrieved all reports', {
                radiologistId: req.user.id,
                count: reports.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: reports.data,
                pagination: reports.pagination,
                summary: {
                    total: reports.summary?.total || 0,
                    pending: reports.summary?.pending || 0,
                    preliminary: reports.summary?.preliminary || 0,
                    final: reports.summary?.final || 0,
                    verified: reports.summary?.verified || 0,
                    critical_findings: reports.data?.filter(r => r.critical_finding).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting all reports', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending reports
     * GET /api/v1/radiology/reports/pending
     */
    async getPendingReports(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const reports = await reportService.getReportsByStatus(
                req.user.id,
                ['pending', 'preliminary'],
                options
            );

            logger.info('Radiologist viewed pending reports', {
                radiologistId: req.user.id,
                count: reports.data?.length || 0
            });

            // Group by urgency
            const byPriority = {
                stat: reports.data?.filter(r => r.priority === 'stat').length || 0,
                urgent: reports.data?.filter(r => r.priority === 'urgent').length || 0,
                routine: reports.data?.filter(r => r.priority === 'routine').length || 0
            };

            // [BR-41] Critical findings count
            const criticalCount = reports.data?.filter(r => r.critical_finding).length || 0;

            res.json({
                success: true,
                data: reports.data,
                pagination: reports.pagination,
                summary: {
                    total: reports.summary?.total || 0,
                    by_priority: byPriority,
                    critical_findings: criticalCount,
                    estimated_time: reports.data?.length * 15 // 15 minutes per report
                }
            });
        } catch (error) {
            logger.error('Error getting pending reports', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed reports
     * GET /api/v1/radiology/reports/completed
     */
    async getCompletedReports(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const reports = await reportService.getReportsByStatus(
                req.user.id,
                ['final', 'verified', 'amended'],
                options
            );

            logger.info('Radiologist viewed completed reports', {
                radiologistId: req.user.id,
                count: reports.data?.length || 0
            });

            // Calculate average reporting time
            const avgReportTime = reports.data?.reduce((sum, r) => {
                if (r.completed_at && r.ordered_at) {
                    const time = (new Date(r.completed_at) - new Date(r.ordered_at)) / (1000 * 60);
                    return sum + time;
                }
                return sum;
            }, 0) / (reports.data?.length || 1);

            res.json({
                success: true,
                data: reports.data,
                pagination: reports.pagination,
                summary: {
                    total: reports.summary?.total || 0,
                    avg_report_time_minutes: Math.round(avgReportTime),
                    with_critical: reports.data?.filter(r => r.critical_finding).length || 0,
                    by_status: {
                        final: reports.data?.filter(r => r.status === 'final').length || 0,
                        verified: reports.data?.filter(r => r.status === 'verified').length || 0,
                        amended: reports.data?.filter(r => r.status === 'amended').length || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting completed reports', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get report by ID
     * GET /api/v1/radiology/reports/:id
     */
    async getReportById(req, res, next) {
        try {
            const { id } = req.params;

            const report = await reportService.getReportById(
                req.user.id,
                id
            );

            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            logger.info('Radiologist viewed report details', {
                radiologistId: req.user.id,
                reportId: id,
                patientId: report.patient_id,
                status: report.status
            });

            // [BR-44] Get previous studies for comparison
            if (report.patient_id) {
                const previousReports = await reportService.getPreviousReports(
                    req.user.id,
                    report.patient_id,
                    report.id
                );
                report.previous_reports = previousReports;
                report.has_previous = previousReports.length > 0;
            }

            // Add version history
            const versionHistory = await reportService.getVersionHistory(
                req.user.id,
                id
            );
            report.version_history = versionHistory;

            // Check if report is verified
            if (report.status === 'verified') {
                report.verified_by_name = report.verifier_name;
                report.verified_at_formatted = new Date(report.verified_at).toLocaleString();
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
            logger.error('Error getting report by ID', {
                error: error.message,
                radiologistId: req.user.id,
                reportId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // REPORT CRUD OPERATIONS
    // ============================================

    /**
     * Create report
     * POST /api/v1/radiology/reports
     * 
     * BUSINESS RULE: [BR-44] Comparison with previous studies required
     */
    async createReport(req, res, next) {
        try {
            const {
                order_id,
                image_id,
                findings,
                impression,
                technique,
                comparison,
                recommendations,
                critical_finding,
                critical_finding_communicated_to,
                critical_finding_notes,
                is_preliminary
            } = req.body;

            // Validate required fields
            if (!order_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Order ID is required'
                });
            }

            // Check if order exists and is valid
            const order = await reportService.getOrderDetails(req.user.id, order_id);
            
            if (!order) {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }

            if (order.status === 'completed') {
                return res.status(409).json({
                    success: false,
                    error: 'Cannot create report for completed order'
                });
            }

            // [BR-44] Validate comparison field if previous studies exist
            const hasPreviousStudies = await reportService.hasPreviousStudies(
                req.user.id,
                order.patient_id
            );

            if (hasPreviousStudies && !comparison) {
                return res.status(400).json({
                    success: false,
                    error: 'Comparison with previous studies is required when available'
                });
            }

            // [BR-41] Validate critical finding communication
            if (critical_finding && !critical_finding_communicated_to) {
                return res.status(400).json({
                    success: false,
                    error: 'Critical finding requires communication details'
                });
            }

            const report = await reportService.createReport(
                req.user.id,
                {
                    order_id,
                    image_id,
                    findings,
                    impression,
                    technique,
                    comparison,
                    recommendations,
                    critical_finding: critical_finding || false,
                    critical_finding_communicated_to,
                    critical_finding_notes,
                    status: is_preliminary ? 'preliminary' : 'pending',
                    created_at: new Date(),
                    created_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Radiologist created report', {
                radiologistId: req.user.id,
                reportId: report.id,
                orderId: order_id,
                patientId: order.patient_id,
                status: report.status,
                critical_finding: critical_finding || false
            });

            // [BR-41] Send notification for critical findings
            if (critical_finding) {
                await notificationService.sendCriticalFindingNotification({
                    reportId: report.id,
                    patientId: order.patient_id,
                    doctorId: order.doctor_id,
                    communicated_to: critical_finding_communicated_to,
                    findings: findings,
                    impression: impression
                });

                logger.info('Critical finding notification sent', {
                    reportId: report.id,
                    communicatedTo: critical_finding_communicated_to
                });
            }

            res.status(201).json({
                success: true,
                data: report,
                message: is_preliminary ? 'Preliminary report created' : 'Report created successfully'
            });
        } catch (error) {
            if (error.message === 'Order not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Order not found'
                });
            }
            if (error.message === 'Report already exists for this order') {
                return res.status(409).json({
                    success: false,
                    error: 'Report already exists for this order'
                });
            }
            logger.error('Error creating report', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update report
     * PUT /api/v1/radiology/reports/:id
     */
    async updateReport(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const report = await reportService.getReportById(req.user.id, id);
            
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            // Cannot update verified reports
            if (report.status === 'verified') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update verified report'
                });
            }

            // If updating to final, validate
            if (updates.status === 'final' && report.status !== 'final') {
                if (!updates.findings && !report.findings) {
                    return res.status(400).json({
                        success: false,
                        error: 'Findings are required for final report'
                    });
                }
                if (!updates.impression && !report.impression) {
                    return res.status(400).json({
                        success: false,
                        error: 'Impression is required for final report'
                    });
                }
            }

            // [BR-41] If adding critical finding, validate communication
            if (updates.critical_finding && !report.critical_finding) {
                if (!updates.critical_finding_communicated_to) {
                    return res.status(400).json({
                        success: false,
                        error: 'Critical finding requires communication details'
                    });
                }

                // Send notification
                await notificationService.sendCriticalFindingNotification({
                    reportId: id,
                    patientId: report.patient_id,
                    doctorId: report.doctor_id,
                    communicated_to: updates.critical_finding_communicated_to,
                    findings: updates.findings || report.findings,
                    impression: updates.impression || report.impression
                });
            }

            const updated = await reportService.updateReport(
                req.user.id,
                id,
                {
                    ...updates,
                    updated_at: new Date(),
                    updated_by: req.user.id
                }
            );

            logger.info('Radiologist updated report', {
                radiologistId: req.user.id,
                reportId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: updated,
                message: 'Report updated successfully'
            });
        } catch (error) {
            if (error.message === 'Report not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }
            logger.error('Error updating report', {
                error: error.message,
                radiologistId: req.user.id,
                reportId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete report (if draft)
     * DELETE /api/v1/radiology/reports/:id
     */
    async deleteReport(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const report = await reportService.getReportById(req.user.id, id);
            
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            // Only allow deletion of draft or preliminary reports
            if (!['pending', 'preliminary'].includes(report.status)) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot delete report with status: ${report.status}`
                });
            }

            const deleted = await reportService.deleteReport(
                req.user.id,
                id,
                {
                    reason,
                    deleted_at: new Date(),
                    deleted_by: req.user.id
                }
            );

            logger.info('Radiologist deleted report', {
                radiologistId: req.user.id,
                reportId: id,
                reason
            });

            res.json({
                success: true,
                data: deleted,
                message: 'Report deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Report not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }
            logger.error('Error deleting report', {
                error: error.message,
                radiologistId: req.user.id,
                reportId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // REPORT WORKFLOW
    // ============================================

    /**
     * Submit report for review
     * PUT /api/v1/radiology/reports/:id/submit
     */
    async submitReport(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const report = await reportService.getReportById(req.user.id, id);
            
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            // Validate report is complete
            if (!report.findings || !report.impression) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot submit incomplete report. Findings and impression are required.'
                });
            }

            const submitted = await reportService.submitReport(
                req.user.id,
                id,
                {
                    notes,
                    submitted_at: new Date(),
                    submitted_by: req.user.id
                }
            );

            logger.info('Radiologist submitted report for review', {
                radiologistId: req.user.id,
                reportId: id,
                patientId: report.patient_id
            });

            res.json({
                success: true,
                data: submitted,
                message: 'Report submitted for review'
            });
        } catch (error) {
            if (error.message === 'Report not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }
            logger.error('Error submitting report', {
                error: error.message,
                radiologistId: req.user.id,
                reportId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Verify report (final approval)
     * PUT /api/v1/radiology/reports/:id/verify
     * 
     * BUSINESS RULE: [BR-42] Reports need verification before finalization
     */
    async verifyReport(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, is_verified } = req.body;

            const report = await reportService.getReportById(req.user.id, id);
            
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            // Cannot self-verify
            if (report.created_by === req.user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot verify your own report. Another radiologist must verify.'
                });
            }

            if (report.status !== 'preliminary' && report.status !== 'final') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot verify report with status: ${report.status}`
                });
            }

            const verified = await reportService.verifyReport(
                req.user.id,
                id,
                {
                    is_verified,
                    notes,
                    verified_at: new Date(),
                    verified_by: req.user.id
                }
            );

            logger.info('Radiologist verified report', {
                radiologistId: req.user.id,
                reportId: id,
                isVerified: is_verified,
                patientId: report.patient_id,
                originalAuthor: report.created_by
            });

            res.json({
                success: true,
                data: verified,
                message: is_verified ? 'Report verified and finalized' : 'Report rejected for revision'
            });
        } catch (error) {
            if (error.message === 'Report not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }
            logger.error('Error verifying report', {
                error: error.message,
                radiologistId: req.user.id,
                reportId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Download report as PDF
     * GET /api/v1/radiology/reports/:id/pdf
     */
    async downloadPdf(req, res, next) {
        try {
            const { id } = req.params;
            const { format = 'pdf' } = req.query;

            const report = await reportService.getReportById(req.user.id, id);
            
            if (!report) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            // Generate PDF
            const pdfBuffer = await reportService.generatePdfReport(
                req.user.id,
                id,
                format
            );

            // Set headers
            const fileName = `radiology_report_${report.report_number || id}_${new Date().toISOString().split('T')[0]}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', pdfBuffer.length);

            logger.info('Radiologist downloaded report PDF', {
                radiologistId: req.user.id,
                reportId: id,
                patientId: report.patient_id
            });

            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Report not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }
            logger.error('Error downloading report PDF', {
                error: error.message,
                radiologistId: req.user.id,
                reportId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = reportController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Report Lists           | 3         | All reports, pending, completed
 * Single Report          | 1         | Get by ID
 * CRUD Operations        | 3         | Create, update, delete
 * Report Workflow        | 2         | Submit, verify
 * PDF Generation         | 1         | Download PDF
 * -----------------------|-----------|----------------------
 * TOTAL                  | 10        | Complete report management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-41] Critical findings require communication & notification
 * - [BR-42] Reports need verification (cannot self-verify)
 * - [BR-44] Comparison with previous studies validation
 * 
 * ======================================================================
 */