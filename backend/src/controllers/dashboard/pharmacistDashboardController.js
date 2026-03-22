/**
 * ======================================================================
 * FILE: backend/src/controllers/dashboard/pharmacistDashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist dashboard controller - Handles pharmacy dashboard data.
 * Total Endpoints: 5
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-20] Low stock alerts
 * - [BR-21] Expiry alerts (30 days)
 * 
 * ======================================================================
 */

const pharmacistDashboardService = require('../../services/dashboard/pharmacistDashboardService');
const logger = require('../../utils/logger');

const pharmacistDashboardController = {
    /**
     * Get pharmacist main dashboard
     * GET /api/v1/dashboard/pharmacy
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await pharmacistDashboardService.getDashboard(req.user.id);

            logger.info('Pharmacist viewed dashboard', {
                pharmacistId: req.user.id,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                data: dashboard,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error getting pharmacist dashboard', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get low stock items
     * GET /api/v1/dashboard/pharmacy/low-stock
     * 
     * BUSINESS RULE: [BR-20] Alert when stock < reorder level
     */
    async getLowStockItems(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const items = await pharmacistDashboardService.getLowStockItems(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed low stock items', {
                pharmacistId: req.user.id,
                count: items.data?.length || 0
            });

            // Calculate critical items (out of stock or below minimum)
            const criticalCount = items.data?.filter(i => i.quantity === 0 || i.quantity <= i.minimum_stock).length || 0;
            const lowCount = items.data?.filter(i => i.quantity > 0 && i.quantity <= i.reorder_level).length || 0;

            res.json({
                success: true,
                data: items.data,
                pagination: items.pagination,
                summary: {
                    total: items.summary?.total || 0,
                    critical: criticalCount,
                    low: lowCount,
                    total_required: items.summary?.total_required || 0,
                    estimated_restock_cost: items.summary?.estimated_cost || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pharmacist low stock items', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get expiring items
     * GET /api/v1/dashboard/pharmacy/expiring
     * 
     * BUSINESS RULE: [BR-21] Alert 30 days before expiry
     */
    async getExpiringItems(req, res, next) {
        try {
            const { days = 30, page = 1, limit = 20 } = req.query;

            const options = {
                days: parseInt(days),
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const items = await pharmacistDashboardService.getExpiringItems(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed expiring items', {
                pharmacistId: req.user.id,
                count: items.data?.length || 0,
                daysThreshold: parseInt(days)
            });

            // Group by urgency
            const byUrgency = {
                critical: items.data?.filter(i => i.days_until_expiry <= 7).length || 0,
                warning: items.data?.filter(i => i.days_until_expiry > 7 && i.days_until_expiry <= 15).length || 0,
                notice: items.data?.filter(i => i.days_until_expiry > 15 && i.days_until_expiry <= 30).length || 0
            };

            res.json({
                success: true,
                data: items.data,
                pagination: items.pagination,
                summary: {
                    total: items.summary?.total || 0,
                    by_urgency: byUrgency,
                    total_value: items.summary?.total_value || 0,
                    earliest_expiry: items.data?.[0]?.expiry_date || null
                }
            });
        } catch (error) {
            logger.error('Error getting pharmacist expiring items', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending prescriptions
     * GET /api/v1/dashboard/pharmacy/prescriptions
     */
    async getPendingPrescriptions(req, res, next) {
        try {
            const { page = 1, limit = 20, priority } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                priority
            };

            const prescriptions = await pharmacistDashboardService.getPendingPrescriptions(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed pending prescriptions', {
                pharmacistId: req.user.id,
                count: prescriptions.data?.length || 0
            });

            // Calculate estimated time
            const estimatedTime = prescriptions.data?.length * 5; // 5 minutes per prescription

            // Group by priority
            const byPriority = {
                stat: prescriptions.data?.filter(p => p.priority === 'stat').length || 0,
                urgent: prescriptions.data?.filter(p => p.priority === 'urgent').length || 0,
                routine: prescriptions.data?.filter(p => p.priority === 'routine').length || 0
            };

            res.json({
                success: true,
                data: prescriptions.data,
                pagination: prescriptions.pagination,
                summary: {
                    total: prescriptions.summary?.total || 0,
                    by_priority: byPriority,
                    estimated_time_minutes: estimatedTime,
                    controlled_substances: prescriptions.data?.filter(p => p.has_controlled).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pharmacist pending prescriptions', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's dispensing
     * GET /api/v1/dashboard/pharmacy/dispensing
     */
    async getTodayDispensing(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const dispensing = await pharmacistDashboardService.getTodayDispensing(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed today\'s dispensing', {
                pharmacistId: req.user.id,
                count: dispensing.data?.length || 0
            });

            // Calculate hourly breakdown
            const hourlyBreakdown = {};
            dispensing.data?.forEach(d => {
                if (d.dispensed_at) {
                    const hour = new Date(d.dispensed_at).getHours();
                    hourlyBreakdown[hour] = (hourlyBreakdown[hour] || 0) + 1;
                }
            });

            res.json({
                success: true,
                data: dispensing.data,
                pagination: dispensing.pagination,
                summary: {
                    total: dispensing.summary?.total || 0,
                    total_items: dispensing.summary?.total_items || 0,
                    total_value: dispensing.summary?.total_value || 0,
                    hourly_breakdown: hourlyBreakdown,
                    peak_hour: Object.entries(hourlyBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || null
                }
            });
        } catch (error) {
            logger.error('Error getting pharmacist today dispensing', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = pharmacistDashboardController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Main Dashboard         | 1         | Complete pharmacy dashboard
 * Inventory Alerts       | 2         | Low stock, expiring items
 * Prescription Management| 1         | Pending prescriptions
 * Dispensing             | 1         | Today's dispensing
 * -----------------------|-----------|----------------------
 * TOTAL                  | 5         | Complete pharmacy dashboard management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-20] Low stock alerts
 * - [BR-21] Expiry alerts (30 days)
 * 
 * ======================================================================
 */