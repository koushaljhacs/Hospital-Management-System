/**
 * ======================================================================
 * FILE: backend/src/controllers/dashboard/doctorDashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor dashboard controller - Handles doctor dashboard data.
 * Total Endpoints: 7
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * ======================================================================
 */

const doctorDashboardService = require('../../services/dashboard/doctorDashboardService');
const logger = require('../../utils/logger');

const doctorDashboardController = {
    /**
     * Get doctor main dashboard
     * GET /api/v1/dashboard/doctor
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await doctorDashboardService.getDashboard(req.user.id);

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
            logger.error('Error getting doctor dashboard', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's schedule
     * GET /api/v1/dashboard/doctor/today
     */
    async getTodaySchedule(req, res, next) {
        try {
            const schedule = await doctorDashboardService.getTodaySchedule(req.user.id);

            logger.info('Doctor viewed today\'s schedule', {
                doctorId: req.user.id,
                appointmentCount: schedule.appointments?.length || 0
            });

            // Calculate time distribution
            const timeDistribution = {
                morning: schedule.appointments?.filter(a => a.appointment_time < '12:00').length || 0,
                afternoon: schedule.appointments?.filter(a => a.appointment_time >= '12:00' && a.appointment_time < '17:00').length || 0,
                evening: schedule.appointments?.filter(a => a.appointment_time >= '17:00').length || 0
            };

            res.json({
                success: true,
                data: schedule,
                summary: {
                    total: schedule.appointments?.length || 0,
                    completed: schedule.appointments?.filter(a => a.status === 'completed').length || 0,
                    pending: schedule.appointments?.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length || 0,
                    in_progress: schedule.appointments?.filter(a => a.status === 'in_progress').length || 0,
                    cancelled: schedule.appointments?.filter(a => a.status === 'cancelled').length || 0,
                    time_distribution: timeDistribution
                }
            });
        } catch (error) {
            logger.error('Error getting doctor today schedule', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get patient statistics
     * GET /api/v1/dashboard/doctor/patients
     */
    async getPatientStats(req, res, next) {
        try {
            const stats = await doctorDashboardService.getPatientStats(req.user.id);

            logger.info('Doctor viewed patient statistics', {
                doctorId: req.user.id,
                totalPatients: stats.total_patients
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting doctor patient stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get appointment statistics
     * GET /api/v1/dashboard/doctor/appointments
     */
    async getAppointmentStats(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const options = {
                from_date,
                to_date
            };

            const stats = await doctorDashboardService.getAppointmentStats(
                req.user.id,
                options
            );

            logger.info('Doctor viewed appointment statistics', {
                doctorId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting doctor appointment stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get prescription statistics
     * GET /api/v1/dashboard/doctor/prescriptions
     */
    async getPrescriptionStats(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const options = {
                from_date,
                to_date
            };

            const stats = await doctorDashboardService.getPrescriptionStats(
                req.user.id,
                options
            );

            logger.info('Doctor viewed prescription statistics', {
                doctorId: req.user.id,
                totalPrescriptions: stats.total_prescriptions
            });

            // Get top prescribed medicines
            const topMedicines = stats.top_medicines?.slice(0, 10) || [];

            res.json({
                success: true,
                data: stats,
                top_medicines: topMedicines
            });
        } catch (error) {
            logger.error('Error getting doctor prescription stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get lab results summary
     * GET /api/v1/dashboard/doctor/lab-results
     */
    async getLabResultsSummary(req, res, next) {
        try {
            const summary = await doctorDashboardService.getLabResultsSummary(req.user.id);

            logger.info('Doctor viewed lab results summary', {
                doctorId: req.user.id,
                pendingResults: summary.pending_count
            });

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            logger.error('Error getting doctor lab results summary', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get performance metrics
     * GET /api/v1/dashboard/doctor/performance
     */
    async getPerformanceMetrics(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const options = {
                from_date,
                to_date
            };

            const metrics = await doctorDashboardService.getPerformanceMetrics(
                req.user.id,
                options
            );

            logger.info('Doctor viewed performance metrics', {
                doctorId: req.user.id,
                consultationCount: metrics.total_consultations
            });

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            logger.error('Error getting doctor performance metrics', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = doctorDashboardController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Main Dashboard         | 1         | Complete doctor dashboard
 * Schedule               | 1         | Today's schedule
 * Statistics             | 4         | Patients, appointments, prescriptions, lab results
 * Performance            | 1         | Performance metrics
 * -----------------------|-----------|----------------------
 * TOTAL                  | 7         | Complete doctor dashboard management
 * 
 * ======================================================================
 */