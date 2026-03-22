/**
 * ======================================================================
 * FILE: backend/src/controllers/dashboard/adminDashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Admin dashboard controller - Handles admin dashboard data.
 * Total Endpoints: 10
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * ======================================================================
 */

const adminDashboardService = require('../../services/dashboard/adminDashboardService');
const logger = require('../../utils/logger');

const adminDashboardController = {
    /**
     * Get admin main dashboard
     * GET /api/v1/dashboard/admin
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await adminDashboardService.getDashboard(req.user.id);

            logger.info('Admin viewed dashboard', {
                adminId: req.user.id,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                data: dashboard,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error getting admin dashboard', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get admin key statistics
     * GET /api/v1/dashboard/admin/stats
     */
    async getKeyStats(req, res, next) {
        try {
            const stats = await adminDashboardService.getKeyStats(req.user.id);

            logger.info('Admin viewed key statistics', {
                adminId: req.user.id
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting admin key stats', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get user statistics
     * GET /api/v1/dashboard/admin/users
     */
    async getUserStats(req, res, next) {
        try {
            const stats = await adminDashboardService.getUserStats(req.user.id);

            logger.info('Admin viewed user statistics', {
                adminId: req.user.id
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting admin user stats', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get revenue statistics
     * GET /api/v1/dashboard/admin/revenue
     */
    async getRevenueStats(req, res, next) {
        try {
            const { from_date, to_date, period = 'month' } = req.query;

            const options = {
                from_date,
                to_date,
                period
            };

            const stats = await adminDashboardService.getRevenueStats(
                req.user.id,
                options
            );

            logger.info('Admin viewed revenue statistics', {
                adminId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting admin revenue stats', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get appointment statistics
     * GET /api/v1/dashboard/admin/appointments
     */
    async getAppointmentStats(req, res, next) {
        try {
            const { from_date, to_date, group_by = 'day' } = req.query;

            const options = {
                from_date,
                to_date,
                group_by
            };

            const stats = await adminDashboardService.getAppointmentStats(
                req.user.id,
                options
            );

            logger.info('Admin viewed appointment statistics', {
                adminId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting admin appointment stats', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get patient statistics
     * GET /api/v1/dashboard/admin/patients
     */
    async getPatientStats(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const options = {
                from_date,
                to_date
            };

            const stats = await adminDashboardService.getPatientStats(
                req.user.id,
                options
            );

            logger.info('Admin viewed patient statistics', {
                adminId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting admin patient stats', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get bed occupancy statistics
     * GET /api/v1/dashboard/admin/beds
     */
    async getBedStats(req, res, next) {
        try {
            const stats = await adminDashboardService.getBedStats(req.user.id);

            logger.info('Admin viewed bed statistics', {
                adminId: req.user.id
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting admin bed stats', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get inventory statistics
     * GET /api/v1/dashboard/admin/inventory
     */
    async getInventoryStats(req, res, next) {
        try {
            const stats = await adminDashboardService.getInventoryStats(req.user.id);

            logger.info('Admin viewed inventory statistics', {
                adminId: req.user.id
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting admin inventory stats', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get performance metrics
     * GET /api/v1/dashboard/admin/performance
     */
    async getPerformanceMetrics(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const options = {
                from_date,
                to_date
            };

            const metrics = await adminDashboardService.getPerformanceMetrics(
                req.user.id,
                options
            );

            logger.info('Admin viewed performance metrics', {
                adminId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            logger.error('Error getting admin performance metrics', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get system alerts
     * GET /api/v1/dashboard/admin/alerts
     */
    async getSystemAlerts(req, res, next) {
        try {
            const alerts = await adminDashboardService.getSystemAlerts(req.user.id);

            logger.info('Admin viewed system alerts', {
                adminId: req.user.id,
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
            logger.error('Error getting admin system alerts', {
                error: error.message,
                adminId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = adminDashboardController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Main Dashboard         | 1         | Complete admin dashboard
 * Statistics             | 8         | Key stats, users, revenue, appointments, patients, beds, inventory, performance
 * Alerts                 | 1         | System alerts
 * -----------------------|-----------|----------------------
 * TOTAL                  | 10        | Complete admin dashboard management
 * 
 * ======================================================================
 */