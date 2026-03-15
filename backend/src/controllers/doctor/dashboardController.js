/**
 * ======================================================================
 * FILE: backend/src/controllers/doctor/dashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor's dashboard controller providing comprehensive overview.
 * Shows today's schedule, patient stats, pending tasks, and analytics.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ENDPOINTS:
 * GET    /doctor/dashboard                    - Main dashboard
 * GET    /doctor/dashboard/today                - Today's schedule
 * GET    /doctor/dashboard/stats                 - Overall statistics
 * GET    /doctor/dashboard/patients               - Patient statistics
 * GET    /doctor/dashboard/appointments            - Appointment statistics
 * GET    /doctor/dashboard/prescriptions            - Prescription statistics
 * GET    /doctor/dashboard/revenue                   - Revenue statistics
 * GET    /doctor/dashboard/notifications              - Recent notifications
 * GET    /doctor/dashboard/activities                   - Recent activities
 * GET    /doctor/dashboard/performance                    - Performance metrics
 * 
 * ======================================================================
 */

const dashboardService = require('../../services/doctor/dashboardService');
const logger = require('../../utils/logger');

/**
 * Doctor Dashboard Controller
 */
const dashboardController = {
    // ============================================
    // MAIN DASHBOARD
    // ============================================

    /**
     * Get complete doctor dashboard
     * GET /api/v1/doctor/dashboard
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await dashboardService.getDashboard(req.user.id);

            logger.info('Doctor viewed dashboard', {
                doctorId: req.user.id,
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
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // TODAY'S SCHEDULE
    // ============================================

    /**
     * Get today's schedule
     * GET /api/v1/doctor/dashboard/today
     */
    async getTodaySchedule(req, res, next) {
        try {
            const schedule = await dashboardService.getTodaySchedule(req.user.id);

            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);
            
            // Find current/next appointment
            const currentAppointment = schedule.appointments?.find(apt => 
                apt.status === 'in_progress'
            );

            const nextAppointment = schedule.appointments?.find(apt => 
                apt.status === 'scheduled' && apt.time > currentTime
            );

            logger.info('Doctor viewed today\'s schedule', {
                doctorId: req.user.id,
                appointmentCount: schedule.appointments?.length || 0
            });

            res.json({
                success: true,
                data: {
                    ...schedule,
                    summary: {
                        total_appointments: schedule.appointments?.length || 0,
                        completed: schedule.appointments?.filter(a => a.status === 'completed').length || 0,
                        pending: schedule.appointments?.filter(a => a.status === 'scheduled').length || 0,
                        in_progress: schedule.appointments?.filter(a => a.status === 'in_progress').length || 0,
                        cancelled: schedule.appointments?.filter(a => a.status === 'cancelled').length || 0,
                        no_show: schedule.appointments?.filter(a => a.status === 'no_show').length || 0
                    },
                    current_appointment: currentAppointment,
                    next_appointment: nextAppointment,
                    current_time: currentTime
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s schedule', {
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
     * Get overall statistics
     * GET /api/v1/doctor/dashboard/stats
     */
    async getStats(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const stats = await dashboardService.getOverallStats(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get patient statistics
     * GET /api/v1/doctor/dashboard/patients
     */
    async getPatientStats(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const stats = await dashboardService.getPatientStats(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: {
                    total_patients: stats.total,
                    new_patients: stats.new,
                    follow_up_patients: stats.followUp,
                    active_patients: stats.active,
                    demographics: stats.demographics,
                    common_conditions: stats.commonConditions,
                    age_distribution: stats.ageDistribution,
                    gender_distribution: stats.genderDistribution,
                    timeline: stats.timeline
                }
            });
        } catch (error) {
            logger.error('Error getting patient stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get appointment statistics
     * GET /api/v1/doctor/dashboard/appointments
     */
    async getAppointmentStats(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const stats = await dashboardService.getAppointmentStats(
                req.user.id,
                period
            );

            const total = stats.total || 0;
            const completed = stats.completed || 0;
            const cancelled = stats.cancelled || 0;
            const noShow = stats.noShow || 0;

            res.json({
                success: true,
                data: {
                    total_appointments: total,
                    completed,
                    cancelled,
                    no_show: noShow,
                    completion_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
                    cancellation_rate: total > 0 ? (((cancelled + noShow) / total) * 100).toFixed(1) : 0,
                    average_duration: stats.averageDuration,
                    busiest_day: stats.busiestDay,
                    busiest_time: stats.busiestTime,
                    by_status: stats.byStatus,
                    by_type: stats.byType,
                    timeline: stats.timeline
                }
            });
        } catch (error) {
            logger.error('Error getting appointment stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get prescription statistics
     * GET /api/v1/doctor/dashboard/prescriptions
     */
    async getPrescriptionStats(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const stats = await dashboardService.getPrescriptionStats(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: {
                    total_prescriptions: stats.total,
                    active_prescriptions: stats.active,
                    expired_prescriptions: stats.expired,
                    average_per_patient: stats.averagePerPatient,
                    most_prescribed_medicines: stats.topMedicines,
                    by_category: stats.byCategory,
                    refill_requests: stats.refillRequests,
                    timeline: stats.timeline
                }
            });
        } catch (error) {
            logger.error('Error getting prescription stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get revenue statistics
     * GET /api/v1/doctor/dashboard/revenue
     */
    async getRevenueStats(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const stats = await dashboardService.getRevenueStats(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: {
                    total_revenue: stats.total,
                    consultation_fees: stats.consultation,
                    procedure_fees: stats.procedures,
                    average_per_patient: stats.averagePerPatient,
                    average_per_appointment: stats.averagePerAppointment,
                    pending_payments: stats.pending,
                    collected: stats.collected,
                    by_month: stats.byMonth,
                    comparison: stats.comparison
                }
            });
        } catch (error) {
            logger.error('Error getting revenue stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // NOTIFICATIONS & ACTIVITIES
    // ============================================

    /**
     * Get recent notifications
     * GET /api/v1/doctor/dashboard/notifications
     */
    async getNotifications(req, res, next) {
        try {
            const { limit = 10 } = req.query;

            const notifications = await dashboardService.getNotifications(
                req.user.id,
                parseInt(limit)
            );

            const unreadCount = notifications.filter(n => !n.read).length;

            res.json({
                success: true,
                data: {
                    notifications,
                    unread_count: unreadCount,
                    total: notifications.length
                }
            });
        } catch (error) {
            logger.error('Error getting notifications', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get recent activities
     * GET /api/v1/doctor/dashboard/activities
     */
    async getActivities(req, res, next) {
        try {
            const { limit = 20 } = req.query;

            const activities = await dashboardService.getActivities(
                req.user.id,
                parseInt(limit)
            );

            // Group activities by date
            const grouped = activities.reduce((acc, activity) => {
                const date = new Date(activity.timestamp).toLocaleDateString();
                if (!acc[date]) {
                    acc[date] = [];
                }
                acc[date].push(activity);
                return acc;
            }, {});

            res.json({
                success: true,
                data: {
                    activities: grouped,
                    total: activities.length,
                    recent: activities.slice(0, 5)
                }
            });
        } catch (error) {
            logger.error('Error getting activities', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get unread notifications count
     * GET /api/v1/doctor/dashboard/notifications/unread-count
     */
    async getUnreadNotificationsCount(req, res, next) {
        try {
            const count = await dashboardService.getUnreadNotificationsCount(
                req.user.id
            );

            res.json({
                success: true,
                data: { unread_count: count }
            });
        } catch (error) {
            logger.error('Error getting unread notifications count', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Mark notification as read
     * PUT /api/v1/doctor/dashboard/notifications/:id/read
     */
    async markNotificationRead(req, res, next) {
        try {
            const { id } = req.params;

            await dashboardService.markNotificationRead(
                req.user.id,
                id
            );

            res.json({
                success: true,
                message: 'Notification marked as read'
            });
        } catch (error) {
            if (error.message === 'Notification not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }
            logger.error('Error marking notification as read', {
                error: error.message,
                doctorId: req.user.id,
                notificationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Mark all notifications as read
     * PUT /api/v1/doctor/dashboard/notifications/read-all
     */
    async markAllNotificationsRead(req, res, next) {
        try {
            await dashboardService.markAllNotificationsRead(req.user.id);

            res.json({
                success: true,
                message: 'All notifications marked as read'
            });
        } catch (error) {
            logger.error('Error marking all notifications as read', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PERFORMANCE METRICS
    // ============================================

    /**
     * Get performance metrics
     * GET /api/v1/doctor/dashboard/performance
     */
    async getPerformanceMetrics(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const metrics = await dashboardService.getPerformanceMetrics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: {
                    patient_satisfaction: metrics.satisfaction,
                    average_wait_time: metrics.avgWaitTime,
                    average_consultation_time: metrics.avgConsultTime,
                    appointment_fulfillment_rate: metrics.fulfillmentRate,
                    patient_return_rate: metrics.returnRate,
                    diagnosis_accuracy: metrics.accuracy,
                    peer_reviews: metrics.peerReviews,
                    comparisons: metrics.comparisons
                }
            });
        } catch (error) {
            logger.error('Error getting performance metrics', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get patient satisfaction trends
     * GET /api/v1/doctor/dashboard/performance/satisfaction
     */
    async getSatisfactionTrends(req, res, next) {
        try {
            const { months = 6 } = req.query;

            const trends = await dashboardService.getSatisfactionTrends(
                req.user.id,
                parseInt(months)
            );

            res.json({
                success: true,
                data: {
                    current_rating: trends.current,
                    average_rating: trends.average,
                    total_reviews: trends.total,
                    by_month: trends.byMonth,
                    distribution: trends.distribution,
                    recent_feedback: trends.recentFeedback
                }
            });
        } catch (error) {
            logger.error('Error getting satisfaction trends', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // WEEKLY/MONTHLY SUMMARIES
    // ============================================

    /**
     * Get weekly summary
     * GET /api/v1/doctor/dashboard/weekly-summary
     */
    async getWeeklySummary(req, res, next) {
        try {
            const summary = await dashboardService.getWeeklySummary(req.user.id);

            res.json({
                success: true,
                data: {
                    week_start: summary.weekStart,
                    week_end: summary.weekEnd,
                    appointments: summary.appointments,
                    new_patients: summary.newPatients,
                    prescriptions: summary.prescriptions,
                    revenue: summary.revenue,
                    highlights: summary.highlights,
                    next_week_preview: summary.nextWeekPreview
                }
            });
        } catch (error) {
            logger.error('Error getting weekly summary', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get monthly summary
     * GET /api/v1/doctor/dashboard/monthly-summary
     */
    async getMonthlySummary(req, res, next) {
        try {
            const summary = await dashboardService.getMonthlySummary(req.user.id);

            res.json({
                success: true,
                data: {
                    month: summary.month,
                    year: summary.year,
                    appointments: summary.appointments,
                    patients: summary.patients,
                    prescriptions: summary.prescriptions,
                    revenue: summary.revenue,
                    top_diagnosis: summary.topDiagnosis,
                    growth: summary.growth,
                    next_month_goals: summary.goals
                }
            });
        } catch (error) {
            logger.error('Error getting monthly summary', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // QUICK ACTIONS & TASKS
    // ============================================

    /**
     * Get pending tasks
     * GET /api/v1/doctor/dashboard/tasks
     */
    async getPendingTasks(req, res, next) {
        try {
            const tasks = await dashboardService.getPendingTasks(req.user.id);

            res.json({
                success: true,
                data: {
                    total: tasks.length,
                    urgent: tasks.filter(t => t.priority === 'urgent').length,
                    pending_reports: tasks.filter(t => t.type === 'report').length,
                    pending_prescriptions: tasks.filter(t => t.type === 'prescription').length,
                    follow_ups: tasks.filter(t => t.type === 'follow_up').length,
                    tasks: tasks.slice(0, 10) // Return only top 10
                }
            });
        } catch (error) {
            logger.error('Error getting pending tasks', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get upcoming follow-ups
     * GET /api/v1/doctor/dashboard/follow-ups
     */
    async getUpcomingFollowUps(req, res, next) {
        try {
            const { days = 7 } = req.query;

            const followUps = await dashboardService.getUpcomingFollowUps(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: {
                    total: followUps.length,
                    next_7_days: followUps.filter(f => f.daysUntil <= 7).length,
                    overdue: followUps.filter(f => f.daysUntil < 0).length,
                    list: followUps
                }
            });
        } catch (error) {
            logger.error('Error getting upcoming follow-ups', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get critical alerts
     * GET /api/v1/doctor/dashboard/critical-alerts
     */
    async getCriticalAlerts(req, res, next) {
        try {
            const alerts = await dashboardService.getCriticalAlerts(req.user.id);

            res.json({
                success: true,
                data: {
                    total: alerts.length,
                    lab_critical: alerts.filter(a => a.type === 'lab').length,
                    radiology_urgent: alerts.filter(a => a.type === 'radiology').length,
                    patient_emergency: alerts.filter(a => a.type === 'emergency').length,
                    alerts: alerts
                }
            });
        } catch (error) {
            logger.error('Error getting critical alerts', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // EXPORT DASHBOARD DATA
    // ============================================

    /**
     * Export dashboard data as PDF
     * GET /api/v1/doctor/dashboard/export/pdf
     */
    async exportDashboardPDF(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const pdfBuffer = await dashboardService.generateDashboardPDF(
                req.user.id,
                period
            );

            logger.info('Doctor exported dashboard PDF', {
                doctorId: req.user.id,
                period
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=dashboard-${period}-${Date.now()}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            logger.error('Error exporting dashboard PDF', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export dashboard data as CSV
     * GET /api/v1/doctor/dashboard/export/csv
     */
    async exportDashboardCSV(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const csvData = await dashboardService.generateDashboardCSV(
                req.user.id,
                period
            );

            logger.info('Doctor exported dashboard CSV', {
                doctorId: req.user.id,
                period
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=dashboard-${period}-${Date.now()}.csv`);
            res.send(csvData);
        } catch (error) {
            logger.error('Error exporting dashboard CSV', {
                error: error.message,
                doctorId: req.user.id
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
 * Main Dashboard         | 1         | Complete overview
 * Today's Schedule       | 1         | Current day appointments
 * Statistics             | 5         | Patients, appointments, prescriptions, revenue, overall
 * Notifications          | 4         | View, count, mark read
 * Performance Metrics    | 2         | Satisfaction, trends
 * Summaries              | 2         | Weekly, monthly
 * Quick Actions          | 3         | Tasks, follow-ups, alerts
 * Export                 | 2         | PDF, CSV
 * -----------------------|-----------|----------------------
 * TOTAL                  | 20        | Complete dashboard management
 * 
 * ======================================================================
 */