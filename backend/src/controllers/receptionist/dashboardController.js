/**
 * ======================================================================
 * FILE: backend/src/controllers/receptionist/dashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist dashboard controller - Provides comprehensive reception overview.
 * Total Endpoints: 4
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const dashboardService = require('../../services/receptionist/dashboardService');
const logger = require('../../utils/logger');

/**
 * Receptionist Dashboard Controller
 */
const dashboardController = {
    // ============================================
    // MAIN DASHBOARD
    // ============================================

    /**
     * Get main dashboard
     * GET /api/v1/reception/dashboard
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await dashboardService.getDashboard(req.user.id);

            logger.info('Receptionist viewed dashboard', {
                receptionistId: req.user.id,
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
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // TODAY'S SUMMARY
    // ============================================

    /**
     * Get today's appointments summary
     * GET /api/v1/reception/dashboard/today
     */
    async getTodaySummary(req, res, next) {
        try {
            const summary = await dashboardService.getTodaySummary(req.user.id);

            logger.info('Receptionist viewed today\'s summary', {
                receptionistId: req.user.id,
                totalAppointments: summary.appointments?.total || 0,
                newRegistrations: summary.registrations?.new || 0
            });

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            logger.error('Error getting today\'s summary', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get detailed today's appointments
     * GET /api/v1/reception/dashboard/today/appointments
     */
    async getTodaysAppointmentsDetail(req, res, next) {
        try {
            const appointments = await dashboardService.getTodaysAppointmentsDetail(req.user.id);

            res.json({
                success: true,
                data: appointments,
                summary: {
                    total: appointments.length,
                    by_hour: this._groupByHour(appointments),
                    by_doctor: this._groupByDoctor(appointments)
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s appointments detail', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's registrations detail
     * GET /api/v1/reception/dashboard/today/registrations
     */
    async getTodaysRegistrationsDetail(req, res, next) {
        try {
            const registrations = await dashboardService.getTodaysRegistrationsDetail(req.user.id);

            res.json({
                success: true,
                data: registrations,
                summary: {
                    total: registrations.length,
                    with_insurance: registrations.filter(r => r.insurance_provider).length,
                    walkins: registrations.filter(r => r.referred_by === 'walkin').length
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s registrations detail', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's OPD summary
     * GET /api/v1/reception/dashboard/today/opd
     */
    async getTodaysOPDSummary(req, res, next) {
        try {
            const opd = await dashboardService.getTodaysOPDSummary(req.user.id);

            res.json({
                success: true,
                data: opd
            });
        } catch (error) {
            logger.error('Error getting today\'s OPD summary', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's walk-ins summary
     * GET /api/v1/reception/dashboard/today/walkins
     */
    async getTodaysWalkinsSummary(req, res, next) {
        try {
            const walkins = await dashboardService.getTodaysWalkinsSummary(req.user.id);

            res.json({
                success: true,
                data: walkins,
                summary: {
                    total: walkins.length,
                    waiting: walkins.filter(w => w.status === 'waiting').length,
                    completed: walkins.filter(w => w.status === 'completed').length,
                    average_wait_time: this._calculateAverageWaitTime(walkins)
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s walk-ins summary', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BED AVAILABILITY SUMMARY
    // ============================================

    /**
     * Get bed availability summary
     * GET /api/v1/reception/dashboard/beds
     */
    async getBedSummary(req, res, next) {
        try {
            const beds = await dashboardService.getBedSummary(req.user.id);

            logger.info('Receptionist viewed bed summary', {
                receptionistId: req.user.id,
                totalBeds: beds.total,
                availableBeds: beds.available
            });

            res.json({
                success: true,
                data: beds,
                summary: {
                    total: beds.total,
                    available: beds.available,
                    occupied: beds.occupied,
                    cleaning: beds.cleaning,
                    maintenance: beds.maintenance,
                    occupancy_rate: beds.total > 0 ? ((beds.occupied / beds.total) * 100).toFixed(1) : 0,
                    by_ward: beds.by_ward,
                    by_type: beds.by_type
                }
            });
        } catch (error) {
            logger.error('Error getting bed summary', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get detailed bed availability by ward
     * GET /api/v1/reception/dashboard/beds/ward-wise
     */
    async getBedAvailabilityByWard(req, res, next) {
        try {
            const beds = await dashboardService.getBedAvailabilityByWard(req.user.id);

            res.json({
                success: true,
                data: beds
            });
        } catch (error) {
            logger.error('Error getting bed availability by ward', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get bed availability by type
     * GET /api/v1/reception/dashboard/beds/type-wise
     */
    async getBedAvailabilityByType(req, res, next) {
        try {
            const beds = await dashboardService.getBedAvailabilityByType(req.user.id);

            res.json({
                success: true,
                data: beds
            });
        } catch (error) {
            logger.error('Error getting bed availability by type', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get beds needing cleaning
     * GET /api/v1/reception/dashboard/beds/cleaning-needed
     */
    async getBedsNeedingCleaning(req, res, next) {
        try {
            const beds = await dashboardService.getBedsNeedingCleaning(req.user.id);

            res.json({
                success: true,
                data: beds,
                count: beds.length
            });
        } catch (error) {
            logger.error('Error getting beds needing cleaning', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT STATISTICS
    // ============================================

    /**
     * Get patient statistics
     * GET /api/v1/reception/dashboard/patients
     */
    async getPatientStats(req, res, next) {
        try {
            const stats = await dashboardService.getPatientStats(req.user.id);

            logger.info('Receptionist viewed patient statistics', {
                receptionistId: req.user.id,
                totalPatients: stats.total_patients,
                newToday: stats.new_today
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting patient statistics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get patient demographics
     * GET /api/v1/reception/dashboard/patients/demographics
     */
    async getPatientDemographics(req, res, next) {
        try {
            const demographics = await dashboardService.getPatientDemographics(req.user.id);

            res.json({
                success: true,
                data: demographics
            });
        } catch (error) {
            logger.error('Error getting patient demographics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get patient registration trends
     * GET /api/v1/reception/dashboard/patients/trends
     */
    async getPatientTrends(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const trends = await dashboardService.getPatientTrends(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting patient trends', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // APPOINTMENT STATISTICS
    // ============================================

    /**
     * Get appointment statistics
     * GET /api/v1/reception/dashboard/appointments
     */
    async getAppointmentStats(req, res, next) {
        try {
            const stats = await dashboardService.getAppointmentStats(req.user.id);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting appointment statistics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get appointment trends
     * GET /api/v1/reception/dashboard/appointments/trends
     */
    async getAppointmentTrends(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const trends = await dashboardService.getAppointmentTrends(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting appointment trends', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get doctor workload
     * GET /api/v1/reception/dashboard/appointments/doctor-workload
     */
    async getDoctorWorkload(req, res, next) {
        try {
            const { date } = req.query;

            const workload = await dashboardService.getDoctorWorkload(
                req.user.id,
                date
            );

            res.json({
                success: true,
                data: workload
            });
        } catch (error) {
            logger.error('Error getting doctor workload', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // QUEUE STATUS
    // ============================================

    /**
     * Get current queue status
     * GET /api/v1/reception/dashboard/queue
     */
    async getQueueStatus(req, res, next) {
        try {
            const queue = await dashboardService.getQueueStatus(req.user.id);

            res.json({
                success: true,
                data: queue
            });
        } catch (error) {
            logger.error('Error getting queue status', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get department-wise queue
     * GET /api/v1/reception/dashboard/queue/by-department
     */
    async getQueueByDepartment(req, res, next) {
        try {
            const queue = await dashboardService.getQueueByDepartment(req.user.id);

            res.json({
                success: true,
                data: queue
            });
        } catch (error) {
            logger.error('Error getting queue by department', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get estimated wait times
     * GET /api/v1/reception/dashboard/queue/wait-times
     */
    async getEstimatedWaitTimes(req, res, next) {
        try {
            const waitTimes = await dashboardService.getEstimatedWaitTimes(req.user.id);

            res.json({
                success: true,
                data: waitTimes
            });
        } catch (error) {
            logger.error('Error getting estimated wait times', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PERFORMANCE METRICS
    // ============================================

    /**
     * Get reception performance metrics
     * GET /api/v1/reception/dashboard/performance
     */
    async getPerformanceMetrics(req, res, next) {
        try {
            const { period = 'day' } = req.query;

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
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get registration efficiency
     * GET /api/v1/reception/dashboard/performance/registration
     */
    async getRegistrationEfficiency(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const efficiency = await dashboardService.getRegistrationEfficiency(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: efficiency
            });
        } catch (error) {
            logger.error('Error getting registration efficiency', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get check-in/out efficiency
     * GET /api/v1/reception/dashboard/performance/checkin
     */
    async getCheckinEfficiency(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const efficiency = await dashboardService.getCheckinEfficiency(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: efficiency
            });
        } catch (error) {
            logger.error('Error getting check-in efficiency', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // NOTIFICATIONS & ALERTS
    // ============================================

    /**
     * Get reception notifications
     * GET /api/v1/reception/dashboard/notifications
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

            logger.info('Receptionist viewed notifications', {
                receptionistId: req.user.id,
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
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Mark notification as read
     * PUT /api/v1/reception/dashboard/notifications/:id/read
     */
    async markNotificationRead(req, res, next) {
        try {
            const { id } = req.params;

            const notification = await dashboardService.markNotificationRead(
                req.user.id,
                id
            );

            logger.info('Receptionist marked notification as read', {
                receptionistId: req.user.id,
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
                receptionistId: req.user.id,
                notificationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Mark all notifications as read
     * PUT /api/v1/reception/dashboard/notifications/read-all
     */
    async markAllNotificationsRead(req, res, next) {
        try {
            const count = await dashboardService.markAllNotificationsRead(req.user.id);

            logger.info('Receptionist marked all notifications as read', {
                receptionistId: req.user.id,
                count
            });

            res.json({
                success: true,
                message: `${count} notifications marked as read`
            });
        } catch (error) {
            logger.error('Error marking all notifications read', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get critical alerts
     * GET /api/v1/reception/dashboard/alerts
     */
    async getCriticalAlerts(req, res, next) {
        try {
            const alerts = await dashboardService.getCriticalAlerts(req.user.id);

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    bed_availability: alerts.filter(a => a.type === 'bed_availability').length,
                    appointment_conflicts: alerts.filter(a => a.type === 'appointment_conflict').length,
                    patient_waiting: alerts.filter(a => a.type === 'patient_waiting').length
                }
            });
        } catch (error) {
            logger.error('Error getting critical alerts', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // EXPORT DASHBOARD
    // ============================================

    /**
     * Export dashboard data
     * GET /api/v1/reception/dashboard/export
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

            logger.info('Receptionist exported dashboard', {
                receptionistId: req.user.id,
                format,
                sections: sectionsArray
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=reception-dashboard-${Date.now()}.pdf`);
                return res.send(data);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=reception-dashboard-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting dashboard', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // HELPER METHODS
    // ============================================

    /**
     * Group appointments by hour
     * @private
     */
    _groupByHour(appointments) {
        const groups = {};
        for (let i = 8; i <= 20; i++) {
            groups[`${i}:00`] = 0;
        }

        appointments.forEach(apt => {
            if (apt.appointment_time) {
                const hour = apt.appointment_time.split(':')[0];
                groups[`${hour}:00`] = (groups[`${hour}:00`] || 0) + 1;
            }
        });

        return groups;
    },

    /**
     * Group appointments by doctor
     * @private
     */
    _groupByDoctor(appointments) {
        const groups = {};
        appointments.forEach(apt => {
            const doctorName = apt.doctor_name || 'Unknown';
            if (!groups[doctorName]) {
                groups[doctorName] = {
                    doctor_name: doctorName,
                    specialization: apt.doctor_specialization,
                    count: 0
                };
            }
            groups[doctorName].count++;
        });
        return Object.values(groups);
    },

    /**
     * Calculate average wait time for walk-ins
     * @private
     */
    _calculateAverageWaitTime(walkins) {
        const completedWalkins = walkins.filter(w => 
            w.status === 'completed' && w.registered_at && w.completed_at
        );

        if (completedWalkins.length === 0) return 0;

        const totalWaitTime = completedWalkins.reduce((sum, w) => {
            const waitTime = (new Date(w.completed_at) - new Date(w.registered_at)) / (1000 * 60);
            return sum + waitTime;
        }, 0);

        return Math.round(totalWaitTime / completedWalkins.length);
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
 * Today's Summary        | 5         | Appointments, registrations, OPD, walkins, details
 * Bed Availability       | 4         | Summary, by ward, by type, cleaning needed
 * Patient Statistics     | 3         | Stats, demographics, trends
 * Appointment Statistics | 3         | Stats, trends, doctor workload
 * Queue Status           | 3         | Queue, by department, wait times
 * Performance Metrics    | 3         | Overall, registration, check-in
 * Notifications & Alerts | 4         | Notifications, mark read, mark all, alerts
 * Export                 | 1         | Export dashboard
 * -----------------------|-----------|----------------------
 * TOTAL                  | 27        | Complete dashboard management
 * 
 * ======================================================================
 */