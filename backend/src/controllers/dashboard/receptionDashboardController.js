/**
 * ======================================================================
 * FILE: backend/src/controllers/dashboard/receptionDashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Reception dashboard controller - Handles reception dashboard data.
 * Total Endpoints: 5
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * ======================================================================
 */

const receptionDashboardService = require('../../services/dashboard/receptionDashboardService');
const logger = require('../../utils/logger');

const receptionDashboardController = {
    /**
     * Get reception main dashboard
     * GET /api/v1/dashboard/reception
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await receptionDashboardService.getDashboard(req.user.id);

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
            logger.error('Error getting reception dashboard', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's appointments
     * GET /api/v1/dashboard/reception/appointments
     */
    async getTodayAppointments(req, res, next) {
        try {
            const { status } = req.query;

            const appointments = await receptionDashboardService.getTodayAppointments(
                req.user.id,
                { status }
            );

            logger.info('Receptionist viewed today\'s appointments', {
                receptionistId: req.user.id,
                count: appointments.length
            });

            // Calculate summary
            const byStatus = {
                scheduled: appointments.filter(a => a.status === 'scheduled').length,
                confirmed: appointments.filter(a => a.status === 'confirmed').length,
                in_progress: appointments.filter(a => a.status === 'in_progress').length,
                completed: appointments.filter(a => a.status === 'completed').length,
                cancelled: appointments.filter(a => a.status === 'cancelled').length,
                no_show: appointments.filter(a => a.status === 'no_show').length
            };

            const checkedIn = appointments.filter(a => a.check_in_time).length;
            const waiting = appointments.filter(a => 
                (a.status === 'confirmed' || a.status === 'scheduled') && !a.check_in_time
            ).length;

            res.json({
                success: true,
                data: appointments,
                summary: {
                    total: appointments.length,
                    by_status: byStatus,
                    checked_in: checkedIn,
                    waiting: waiting,
                    upcoming: appointments.filter(a => a.status === 'scheduled' && new Date(a.appointment_time) > new Date()).length
                }
            });
        } catch (error) {
            logger.error('Error getting reception today appointments', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get bed availability
     * GET /api/v1/dashboard/reception/beds
     */
    async getBedAvailability(req, res, next) {
        try {
            const availability = await receptionDashboardService.getBedAvailability(req.user.id);

            logger.info('Receptionist viewed bed availability', {
                receptionistId: req.user.id,
                availableBeds: availability.available
            });

            res.json({
                success: true,
                data: availability,
                summary: {
                    total: availability.total,
                    available: availability.available,
                    occupied: availability.occupied,
                    cleaning: availability.cleaning,
                    maintenance: availability.maintenance,
                    occupancy_rate: availability.total > 0 
                        ? ((availability.occupied / availability.total) * 100).toFixed(1)
                        : 0,
                    by_ward: availability.by_ward,
                    by_type: availability.by_type
                }
            });
        } catch (error) {
            logger.error('Error getting reception bed availability', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get new patients
     * GET /api/v1/dashboard/reception/patients
     */
    async getNewPatients(req, res, next) {
        try {
            const { days = 7, page = 1, limit = 20 } = req.query;

            const options = {
                days: parseInt(days),
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const patients = await receptionDashboardService.getNewPatients(
                req.user.id,
                options
            );

            logger.info('Receptionist viewed new patients', {
                receptionistId: req.user.id,
                count: patients.data?.length || 0,
                days: parseInt(days)
            });

            // Calculate demographics
            const demographics = {
                male: patients.data?.filter(p => p.gender === 'male').length || 0,
                female: patients.data?.filter(p => p.gender === 'female').length || 0,
                other: patients.data?.filter(p => !['male', 'female'].includes(p.gender)).length || 0,
                with_insurance: patients.data?.filter(p => p.insurance_provider).length || 0,
                walkins: patients.data?.filter(p => p.referred_by === 'walkin').length || 0
            };

            res.json({
                success: true,
                data: patients.data,
                pagination: patients.pagination,
                summary: {
                    total: patients.summary?.total || 0,
                    today: patients.summary?.today || 0,
                    yesterday: patients.summary?.yesterday || 0,
                    demographics: demographics
                }
            });
        } catch (error) {
            logger.error('Error getting reception new patients', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get walk-in statistics
     * GET /api/v1/dashboard/reception/walk-in
     */
    async getWalkinStats(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await receptionDashboardService.getWalkinStats(
                req.user.id,
                { period }
            );

            logger.info('Receptionist viewed walk-in statistics', {
                receptionistId: req.user.id,
                period,
                totalWalkins: stats.total
            });

            res.json({
                success: true,
                data: stats,
                summary: {
                    total: stats.total,
                    waiting: stats.waiting,
                    in_progress: stats.in_progress,
                    completed: stats.completed,
                    avg_wait_time_minutes: stats.avg_wait_time,
                    peak_hours: stats.peak_hours,
                    by_department: stats.by_department
                }
            });
        } catch (error) {
            logger.error('Error getting reception walk-in statistics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = receptionDashboardController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Main Dashboard         | 1         | Complete reception dashboard
 * Appointments           | 1         | Today's appointments
 * Bed Management         | 1         | Bed availability
 * Patient Management     | 1         | New patients
 * Walk-in Management     | 1         | Walk-in statistics
 * -----------------------|-----------|----------------------
 * TOTAL                  | 5         | Complete reception dashboard management
 * 
 * ======================================================================
 */