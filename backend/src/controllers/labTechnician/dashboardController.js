/**
 * ======================================================================
 * FILE: backend/src/controllers/labTechnician/dashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician dashboard controller - Provides comprehensive lab overview.
 * Total Endpoints: 3
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * 
 * ======================================================================
 */

const dashboardService = require('../../services/labTechnician/dashboardService');
const logger = require('../../utils/logger');

/**
 * Lab Technician Dashboard Controller
 */
const dashboardController = {
    // ============================================
    // MAIN DASHBOARD
    // ============================================

    /**
     * Get main dashboard
     * GET /api/v1/lab/dashboard
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await dashboardService.getDashboard(req.user.id);

            logger.info('Lab technician viewed dashboard', {
                technicianId: req.user.id,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                data: dashboard,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error getting dashboard', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PENDING TESTS
    // ============================================

    /**
     * Get pending tests count
     * GET /api/v1/lab/dashboard/pending
     */
    async getPendingCount(req, res, next) {
        try {
            const pending = await dashboardService.getPendingCount(req.user.id);

            logger.info('Lab technician viewed pending counts', {
                technicianId: req.user.id,
                totalPending: pending.total
            });

            res.json({
                success: true,
                data: pending,
                summary: {
                    total: pending.total,
                    by_priority: pending.by_priority,
                    by_type: pending.by_type
                }
            });
        } catch (error) {
            logger.error('Error getting pending count', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending tests by priority
     * GET /api/v1/lab/dashboard/pending/by-priority
     */
    async getPendingByPriority(req, res, next) {
        try {
            const pending = await dashboardService.getPendingByPriority(req.user.id);

            res.json({
                success: true,
                data: pending
            });
        } catch (error) {
            logger.error('Error getting pending by priority', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending tests by type
     * GET /api/v1/lab/dashboard/pending/by-type
     */
    async getPendingByType(req, res, next) {
        try {
            const pending = await dashboardService.getPendingByType(req.user.id);

            res.json({
                success: true,
                data: pending
            });
        } catch (error) {
            logger.error('Error getting pending by type', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // CRITICAL ALERTS
    // ============================================

    /**
     * Get critical values alerts
     * GET /api/v1/lab/dashboard/critical
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getCriticalAlerts(req, res, next) {
        try {
            const alerts = await dashboardService.getCriticalAlerts(req.user.id);

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
                    by_severity: {
                        panic: alerts.filter(a => a.is_panic).length,
                        critical: alerts.filter(a => a.is_critical && !a.is_panic).length,
                        abnormal: alerts.filter(a => a.is_abnormal && !a.is_critical).length
                    }
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
     * Get critical alerts history
     * GET /api/v1/lab/dashboard/critical/history
     */
    async getCriticalAlertsHistory(req, res, next) {
        try {
            const { days = 7 } = req.query;

            const history = await dashboardService.getCriticalAlertsHistory(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            logger.error('Error getting critical alerts history', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // EQUIPMENT STATUS
    // ============================================

    /**
     * Get equipment status summary
     * GET /api/v1/lab/dashboard/equipment
     */
    async getEquipmentStatus(req, res, next) {
        try {
            const status = await dashboardService.getEquipmentStatus(req.user.id);

            logger.info('Lab technician viewed equipment status', {
                technicianId: req.user.id,
                totalEquipment: status.total
            });

            res.json({
                success: true,
                data: status,
                summary: {
                    total: status.total,
                    operational: status.operational,
                    maintenance: status.maintenance,
                    calibration_due: status.calibration_due,
                    out_of_service: status.out_of_service
                }
            });
        } catch (error) {
            logger.error('Error getting equipment status', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get equipment needing attention
     * GET /api/v1/lab/dashboard/equipment/attention
     */
    async getEquipmentNeedingAttention(req, res, next) {
        try {
            const equipment = await dashboardService.getEquipmentNeedingAttention(req.user.id);

            res.json({
                success: true,
                data: equipment,
                count: equipment.length
            });
        } catch (error) {
            logger.error('Error getting equipment needing attention', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // TODAY'S ACTIVITIES
    // ============================================

    /**
     * Get today's activities
     * GET /api/v1/lab/dashboard/today
     */
    async getTodaysActivities(req, res, next) {
        try {
            const activities = await dashboardService.getTodaysActivities(req.user.id);

            logger.info('Lab technician viewed today\'s activities', {
                technicianId: req.user.id,
                testsCompleted: activities.tests_completed,
                specimensReceived: activities.specimens_received
            });

            res.json({
                success: true,
                data: activities
            });
        } catch (error) {
            logger.error('Error getting today\'s activities', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's test counts
     * GET /api/v1/lab/dashboard/today/tests
     */
    async getTodaysTestCounts(req, res, next) {
        try {
            const counts = await dashboardService.getTodaysTestCounts(req.user.id);

            res.json({
                success: true,
                data: counts
            });
        } catch (error) {
            logger.error('Error getting today\'s test counts', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PERFORMANCE METRICS
    // ============================================

    /**
     * Get performance metrics
     * GET /api/v1/lab/dashboard/performance
     */
    async getPerformanceMetrics(req, res, next) {
        try {
            const { period = 'week' } = req.query;

            const metrics = await dashboardService.getPerformanceMetrics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            logger.error('Error getting performance metrics', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get turnaround time metrics
     * GET /api/v1/lab/dashboard/performance/turnaround
     * 
     * BUSINESS RULE: [BR-39] Sample collection to result < 24 hours
     */
    async getTurnaroundMetrics(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const metrics = await dashboardService.getTurnaroundMetrics(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: metrics,
                summary: {
                    average_hours: metrics.avg_hours,
                    within_24h: metrics.within_24h_percentage,
                    exceeding: metrics.exceeding_count
                }
            });
        } catch (error) {
            logger.error('Error getting turnaround metrics', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get accuracy metrics
     * GET /api/v1/lab/dashboard/performance/accuracy
     */
    async getAccuracyMetrics(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const metrics = await dashboardService.getAccuracyMetrics(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            logger.error('Error getting accuracy metrics', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // WORKLOAD ANALYSIS
    // ============================================

    /**
     * Get workload analysis
     * GET /api/v1/lab/dashboard/workload
     */
    async getWorkloadAnalysis(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const workload = await dashboardService.getWorkloadAnalysis(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: workload
            });
        } catch (error) {
            logger.error('Error getting workload analysis', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get peak hours analysis
     * GET /api/v1/lab/dashboard/workload/peak-hours
     */
    async getPeakHours(req, res, next) {
        try {
            const peakHours = await dashboardService.getPeakHours(req.user.id);

            res.json({
                success: true,
                data: peakHours
            });
        } catch (error) {
            logger.error('Error getting peak hours', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // QUALITY METRICS
    // ============================================

    /**
     * Get quality metrics
     * GET /api/v1/lab/dashboard/quality
     */
    async getQualityMetrics(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const metrics = await dashboardService.getQualityMetrics(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: metrics,
                summary: {
                    qc_pass_rate: metrics.qc_pass_rate,
                    rejection_rate: metrics.rejection_rate,
                    retest_rate: metrics.retest_rate
                }
            });
        } catch (error) {
            logger.error('Error getting quality metrics', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get rejection analysis
     * GET /api/v1/lab/dashboard/quality/rejections
     */
    async getRejectionAnalysis(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const analysis = await dashboardService.getRejectionAnalysis(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: analysis
            });
        } catch (error) {
            logger.error('Error getting rejection analysis', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // UTILIZATION STATISTICS
    // ============================================

    /**
     * Get equipment utilization
     * GET /api/v1/lab/dashboard/utilization/equipment
     */
    async getEquipmentUtilization(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const utilization = await dashboardService.getEquipmentUtilization(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: utilization
            });
        } catch (error) {
            logger.error('Error getting equipment utilization', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get technician utilization
     * GET /api/v1/lab/dashboard/utilization/technicians
     */
    async getTechnicianUtilization(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const utilization = await dashboardService.getTechnicianUtilization(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: utilization
            });
        } catch (error) {
            logger.error('Error getting technician utilization', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // TRENDS
    // ============================================

    /**
     * Get test volume trends
     * GET /api/v1/lab/dashboard/trends/test-volume
     */
    async getTestVolumeTrends(req, res, next) {
        try {
            const { months = 6 } = req.query;

            const trends = await dashboardService.getTestVolumeTrends(
                req.user.id,
                parseInt(months)
            );

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting test volume trends', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get test type distribution
     * GET /api/v1/lab/dashboard/trends/test-distribution
     */
    async getTestDistribution(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const distribution = await dashboardService.getTestDistribution(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: distribution
            });
        } catch (error) {
            logger.error('Error getting test distribution', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // NOTIFICATIONS
    // ============================================

    /**
     * Get lab notifications
     * GET /api/v1/lab/dashboard/notifications
     */
    async getNotifications(req, res, next) {
        try {
            const { page = 1, limit = 20, unread_only = false } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                unread_only: unread_only === 'true'
            };

            const notifications = await dashboardService.getNotifications(
                req.user.id,
                options
            );

            logger.info('Lab technician viewed notifications', {
                technicianId: req.user.id,
                count: notifications.data?.length || 0,
                unreadCount: notifications.unread_count
            });

            res.json({
                success: true,
                data: notifications.data,
                pagination: notifications.pagination,
                unread_count: notifications.unread_count
            });
        } catch (error) {
            logger.error('Error getting notifications', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Mark notification as read
     * PUT /api/v1/lab/dashboard/notifications/:id/read
     */
    async markNotificationRead(req, res, next) {
        try {
            const { id } = req.params;

            const notification = await dashboardService.markNotificationRead(
                req.user.id,
                id
            );

            logger.info('Lab technician marked notification as read', {
                technicianId: req.user.id,
                notificationId: id
            });

            res.json({
                success: true,
                data: notification,
                message: 'Notification marked as read'
            });
        } catch (error) {
            if (error.message === 'Notification not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }
            logger.error('Error marking notification read', {
                error: error.message,
                technicianId: req.user.id,
                notificationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Mark all notifications as read
     * PUT /api/v1/lab/dashboard/notifications/read-all
     */
    async markAllNotificationsRead(req, res, next) {
        try {
            const count = await dashboardService.markAllNotificationsRead(req.user.id);

            logger.info('Lab technician marked all notifications as read', {
                technicianId: req.user.id,
                count
            });

            res.json({
                success: true,
                message: `${count} notifications marked as read`
            });
        } catch (error) {
            logger.error('Error marking all notifications read', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // QUICK STATS
    // ============================================

    /**
     * Get quick stats
     * GET /api/v1/lab/dashboard/quick-stats
     */
    async getQuickStats(req, res, next) {
        try {
            const stats = await dashboardService.getQuickStats(req.user.id);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting quick stats', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get stats by department
     * GET /api/v1/lab/dashboard/stats/by-department
     */
    async getStatsByDepartment(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const stats = await dashboardService.getStatsByDepartment(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting stats by department', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get stats by test category
     * GET /api/v1/lab/dashboard/stats/by-category
     */
    async getStatsByCategory(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const stats = await dashboardService.getStatsByCategory(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting stats by category', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // EXPORT DASHBOARD
    // ============================================

    /**
     * Export dashboard data
     * GET /api/v1/lab/dashboard/export
     */
    async exportDashboard(req, res, next) {
        try {
            const { format = 'pdf', sections } = req.query;

            const sectionsArray = sections ? sections.split(',') : ['all'];

            const data = await dashboardService.exportDashboard(
                req.user.id,
                format,
                sectionsArray
            );

            logger.info('Lab technician exported dashboard', {
                technicianId: req.user.id,
                format,
                sections: sectionsArray
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=lab-dashboard-${Date.now()}.pdf`);
                return res.send(data);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=lab-dashboard-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting dashboard', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = dashboardController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Main Dashboard         | 1         | Complete dashboard
 * Pending Tests          | 3         | Pending counts, by priority, by type
 * Critical Alerts        | 2         | Current alerts, history
 * Equipment Status       | 2         | Status summary, attention needed
 * Today's Activities     | 2         | Activities, test counts
 * Performance Metrics    | 3         | Overall, turnaround, accuracy
 * Workload Analysis      | 2         | Workload, peak hours
 * Quality Metrics        | 2         | Quality, rejection analysis
 * Utilization            | 2         | Equipment, technician
 * Trends                 | 2         | Test volume, test distribution
 * Notifications          | 3         | Get, mark read, mark all read
 * Quick Stats            | 3         | Quick stats, by department, by category
 * Export                 | 1         | Export dashboard
 * -----------------------|-----------|----------------------
 * TOTAL                  | 28        | Complete lab dashboard
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical value alerts
 * - [BR-39] Turnaround time monitoring
 * 
 * ======================================================================
 */