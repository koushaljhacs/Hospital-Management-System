/**
 * ======================================================================
 * FILE: backend/src/controllers/nurse/dashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse dashboard controller - Provides comprehensive overview of
 * ward activities, patient status, tasks, and alerts.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ENDPOINTS:
 * GET    /nurse/dashboard                         - Main dashboard
 * GET    /nurse/dashboard/patients                  - Patient overview
 * GET    /nurse/dashboard/tasks                       - Task overview
 * GET    /nurse/dashboard/vitals                        - Vital alerts
 * GET    /nurse/dashboard/beds                            - Bed occupancy
 * GET    /nurse/shift/current                              - Current shift info
 * GET    /nurse/shift/schedule                               - Shift schedule
 * POST   /nurse/shift/handover                                 - Submit handover
 * GET    /nurse/shift/handover                                  - Get handover notes
 * 
 * ======================================================================
 */

const dashboardService = require('../../services/nurse/dashboardService');
const logger = require('../../utils/logger');

/**
 * Nurse Dashboard Controller
 */
const dashboardController = {
    // ============================================
    // MAIN DASHBOARD
    // ============================================

    /**
     * Get main dashboard
     * GET /api/v1/nurse/dashboard
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await dashboardService.getDashboard(req.user.id);

            logger.info('Nurse viewed dashboard', {
                nurseId: req.user.id,
                ward: req.user.ward,
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
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT OVERVIEW
    // ============================================

    /**
     * Get patient overview
     * GET /api/v1/nurse/dashboard/patients
     */
    async getPatientOverview(req, res, next) {
        try {
            const overview = await dashboardService.getPatientOverview(req.user.id);

            logger.info('Nurse viewed patient overview', {
                nurseId: req.user.id,
                ward: req.user.ward,
                totalPatients: overview.total
            });

            res.json({
                success: true,
                data: overview
            });
        } catch (error) {
            logger.error('Error getting patient overview', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // TASK OVERVIEW
    // ============================================

    /**
     * Get task overview
     * GET /api/v1/nurse/dashboard/tasks
     */
    async getTaskOverview(req, res, next) {
        try {
            const overview = await dashboardService.getTaskOverview(req.user.id);

            logger.info('Nurse viewed task overview', {
                nurseId: req.user.id,
                pendingTasks: overview.pending,
                urgentTasks: overview.urgent
            });

            res.json({
                success: true,
                data: overview
            });
        } catch (error) {
            logger.error('Error getting task overview', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // VITAL ALERTS
    // ============================================

    /**
     * Get vital alerts
     * GET /api/v1/nurse/dashboard/vitals
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getVitalAlerts(req, res, next) {
        try {
            const alerts = await dashboardService.getVitalAlerts(req.user.id);

            logger.info('Nurse viewed vital alerts', {
                nurseId: req.user.id,
                alertCount: alerts.length,
                criticalCount: alerts.filter(a => a.severity === 'critical').length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    critical: alerts.filter(a => a.severity === 'critical').length,
                    warning: alerts.filter(a => a.severity === 'warning').length,
                    resolved: alerts.filter(a => a.status === 'resolved').length
                }
            });
        } catch (error) {
            logger.error('Error getting vital alerts', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BED OCCUPANCY
    // ============================================

    /**
     * Get bed occupancy
     * GET /api/v1/nurse/dashboard/beds
     */
    async getBedOccupancy(req, res, next) {
        try {
            const occupancy = await dashboardService.getBedOccupancy(req.user.id);

            logger.info('Nurse viewed bed occupancy', {
                nurseId: req.user.id,
                ward: req.user.ward,
                totalBeds: occupancy.total,
                occupiedBeds: occupancy.occupied
            });

            res.json({
                success: true,
                data: occupancy
            });
        } catch (error) {
            logger.error('Error getting bed occupancy', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // SHIFT MANAGEMENT
    // ============================================

    /**
     * Get current shift info
     * GET /api/v1/nurse/shift/current
     */
    async getCurrentShift(req, res, next) {
        try {
            const shift = await dashboardService.getCurrentShift(req.user.id);

            logger.info('Nurse viewed current shift', {
                nurseId: req.user.id,
                shiftId: shift?.id,
                shiftType: shift?.type
            });

            res.json({
                success: true,
                data: shift
            });
        } catch (error) {
            logger.error('Error getting current shift', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get shift schedule
     * GET /api/v1/nurse/shift/schedule
     */
    async getShiftSchedule(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                days = 7 
            } = req.query;

            const schedule = await dashboardService.getShiftSchedule(
                req.user.id,
                {
                    from_date,
                    to_date,
                    days: parseInt(days)
                }
            );

            logger.info('Nurse viewed shift schedule', {
                nurseId: req.user.id,
                shiftCount: schedule.length
            });

            res.json({
                success: true,
                data: schedule
            });
        } catch (error) {
            logger.error('Error getting shift schedule', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Submit handover notes
     * POST /api/v1/nurse/shift/handover
     */
    async submitHandover(req, res, next) {
        try {
            const { 
                handover_notes,
                patient_updates,
                task_updates,
                pending_issues,
                next_shift_notes
            } = req.body;

            if (!handover_notes) {
                return res.status(400).json({
                    success: false,
                    error: 'Handover notes are required'
                });
            }

            const handover = await dashboardService.submitHandover(
                req.user.id,
                {
                    handover_notes,
                    patient_updates,
                    task_updates,
                    pending_issues,
                    next_shift_notes,
                    submitted_at: new Date(),
                    shift_id: req.body.shift_id
                }
            );

            logger.info('Nurse submitted handover', {
                nurseId: req.user.id,
                handoverId: handover.id,
                shiftId: handover.shift_id
            });

            res.status(201).json({
                success: true,
                data: handover,
                message: 'Handover notes submitted successfully'
            });
        } catch (error) {
            logger.error('Error submitting handover', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get handover notes
     * GET /api/v1/nurse/shift/handover
     */
    async getHandoverNotes(req, res, next) {
        try {
            const { 
                shift_id,
                from_date,
                to_date,
                page = 1,
                limit = 10
            } = req.query;

            const options = {
                shift_id,
                from_date,
                to_date,
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const handovers = await dashboardService.getHandoverNotes(
                req.user.id,
                options
            );

            logger.info('Nurse viewed handover notes', {
                nurseId: req.user.id,
                count: handovers.data?.length || 0
            });

            res.json({
                success: true,
                data: handovers.data,
                pagination: handovers.pagination
            });
        } catch (error) {
            logger.error('Error getting handover notes', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // ADDITIONAL DASHBOARD WIDGETS
    // ============================================

    /**
     * Get medication reminders
     * GET /api/v1/nurse/dashboard/medication-reminders
     */
    async getMedicationReminders(req, res, next) {
        try {
            const reminders = await dashboardService.getMedicationReminders(req.user.id);

            logger.info('Nurse viewed medication reminders', {
                nurseId: req.user.id,
                reminderCount: reminders.length
            });

            res.json({
                success: true,
                data: reminders,
                summary: {
                    total: reminders.length,
                    due_now: reminders.filter(r => r.status === 'due_now').length,
                    upcoming: reminders.filter(r => r.status === 'upcoming').length,
                    overdue: reminders.filter(r => r.status === 'overdue').length
                }
            });
        } catch (error) {
            logger.error('Error getting medication reminders', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get ward activity feed
     * GET /api/v1/nurse/dashboard/activity-feed
     */
    async getActivityFeed(req, res, next) {
        try {
            const { limit = 20 } = req.query;

            const activities = await dashboardService.getActivityFeed(
                req.user.id,
                parseInt(limit)
            );

            logger.info('Nurse viewed activity feed', {
                nurseId: req.user.id,
                activityCount: activities.length
            });

            res.json({
                success: true,
                data: activities
            });
        } catch (error) {
            logger.error('Error getting activity feed', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get critical alerts summary
     * GET /api/v1/nurse/dashboard/critical-alerts
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getCriticalAlertsSummary(req, res, next) {
        try {
            const alerts = await dashboardService.getCriticalAlertsSummary(req.user.id);

            logger.info('Nurse viewed critical alerts summary', {
                nurseId: req.user.id,
                criticalCount: alerts.critical,
                warningCount: alerts.warning
            });

            res.json({
                success: true,
                data: alerts
            });
        } catch (error) {
            logger.error('Error getting critical alerts summary', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get workload distribution
     * GET /api/v1/nurse/dashboard/workload
     */
    async getWorkloadDistribution(req, res, next) {
        try {
            const workload = await dashboardService.getWorkloadDistribution(req.user.id);

            logger.info('Nurse viewed workload distribution', {
                nurseId: req.user.id,
                totalTasks: workload.total_tasks,
                assignedNurses: workload.nurses?.length
            });

            res.json({
                success: true,
                data: workload
            });
        } catch (error) {
            logger.error('Error getting workload distribution', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT SPECIFIC DASHBOARD
    // ============================================

    /**
     * Get single patient dashboard
     * GET /api/v1/nurse/dashboard/patient/:patientId
     */
    async getPatientDashboard(req, res, next) {
        try {
            const { patientId } = req.params;

            const dashboard = await dashboardService.getPatientDashboard(
                req.user.id,
                patientId
            );

            if (!dashboard) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Nurse viewed patient dashboard', {
                nurseId: req.user.id,
                patientId
            });

            res.json({
                success: true,
                data: dashboard
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            logger.error('Error getting patient dashboard', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.patientId
            });
            next(error);
        }
    },

    /**
     * Get patient quick view (summary card)
     * GET /api/v1/nurse/dashboard/patient/:patientId/quick-view
     */
    async getPatientQuickView(req, res, next) {
        try {
            const { patientId } = req.params;

            const quickView = await dashboardService.getPatientQuickView(
                req.user.id,
                patientId
            );

            if (!quickView) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            res.json({
                success: true,
                data: quickView
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            logger.error('Error getting patient quick view', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.patientId
            });
            next(error);
        }
    },

    // ============================================
    // EXPORT DASHBOARD
    // ============================================

    /**
     * Export dashboard report
     * GET /api/v1/nurse/dashboard/export
     */
    async exportDashboardReport(req, res, next) {
        try {
            const { 
                format = 'pdf',
                sections = ['patients', 'tasks', 'vitals', 'beds']
            } = req.query;

            const sectionArray = sections.split(',');

            const report = await dashboardService.exportDashboardReport(
                req.user.id,
                {
                    format,
                    sections: sectionArray
                }
            );

            logger.info('Nurse exported dashboard report', {
                nurseId: req.user.id,
                format,
                sections: sectionArray
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=nurse-dashboard-${Date.now()}.pdf`);
                return res.send(report);
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error exporting dashboard report', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // NOTIFICATIONS
    // ============================================

    /**
     * Get nurse notifications
     * GET /api/v1/nurse/notifications
     */
    async getNotifications(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20,
                unread_only = false 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                unread_only: unread_only === 'true'
            };

            const notifications = await dashboardService.getNotifications(
                req.user.id,
                options
            );

            logger.info('Nurse viewed notifications', {
                nurseId: req.user.id,
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
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Mark notification as read
     * PUT /api/v1/nurse/notifications/:id/read
     */
    async markNotificationRead(req, res, next) {
        try {
            const { id } = req.params;

            const notification = await dashboardService.markNotificationRead(
                req.user.id,
                id
            );

            logger.info('Nurse marked notification as read', {
                nurseId: req.user.id,
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
                nurseId: req.user.id,
                notificationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Mark all notifications as read
     * PUT /api/v1/nurse/notifications/read-all
     */
    async markAllNotificationsRead(req, res, next) {
        try {
            const count = await dashboardService.markAllNotificationsRead(req.user.id);

            logger.info('Nurse marked all notifications as read', {
                nurseId: req.user.id,
                count
            });

            res.json({
                success: true,
                message: `${count} notifications marked as read`
            });
        } catch (error) {
            logger.error('Error marking all notifications read', {
                error: error.message,
                nurseId: req.user.id
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
 * Overview Widgets       | 4         | Patients, tasks, vitals, beds
 * Shift Management       | 4         | Current shift, schedule, handover
 * Additional Widgets     | 3         | Med reminders, activity, workload
 * Patient Dashboard      | 2         | Patient dashboard, quick view
 * Export                 | 1         | Export report
 * Notifications          | 3         | Get, mark read, mark all read
 * -----------------------|-----------|----------------------
 * TOTAL                  | 18        | Complete nurse dashboard
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical values alerting
 * 
 * ======================================================================
 */