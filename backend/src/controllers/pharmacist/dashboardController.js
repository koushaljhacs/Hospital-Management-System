/**
 * ======================================================================
 * FILE: backend/src/controllers/pharmacist/dashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist dashboard controller - Provides comprehensive pharmacy overview.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ENDPOINTS: 3 endpoints
 * ======================================================================
 */

const dashboardService = require('../../services/pharmacist/dashboardService');
const logger = require('../../utils/logger');

/**
 * Pharmacist Dashboard Controller
 */
const dashboardController = {
    // ============================================
    // MAIN DASHBOARD
    // ============================================

    /**
     * Get main dashboard
     * GET /api/v1/pharmacist/dashboard
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await dashboardService.getDashboard(req.user.id);

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
            logger.error('Error getting dashboard', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // LOW STOCK SUMMARY
    // ============================================

    /**
     * Get low stock summary
     * GET /api/v1/pharmacist/dashboard/low-stock
     * 
     * BUSINESS RULE: [BR-20] Alert when stock < reorder level
     */
    async getLowStockSummary(req, res, next) {
        try {
            const summary = await dashboardService.getLowStockSummary(req.user.id);

            logger.info('Pharmacist viewed low stock summary', {
                pharmacistId: req.user.id,
                lowStockCount: summary.low_stock_count,
                outOfStockCount: summary.out_of_stock_count
            });

            res.json({
                success: true,
                data: summary,
                summary: {
                    total_low_stock: summary.low_stock_count,
                    total_out_of_stock: summary.out_of_stock_count,
                    critical_items: summary.critical_items,
                    estimated_restock_value: summary.estimated_restock_value
                }
            });
        } catch (error) {
            logger.error('Error getting low stock summary', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get low stock items detail
     * GET /api/v1/pharmacist/dashboard/low-stock/detail
     */
    async getLowStockDetail(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const items = await dashboardService.getLowStockDetail(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: items.data,
                pagination: items.pagination
            });
        } catch (error) {
            logger.error('Error getting low stock detail', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // EXPIRING SUMMARY
    // ============================================

    /**
     * Get expiring summary
     * GET /api/v1/pharmacist/dashboard/expiring
     * 
     * BUSINESS RULE: [BR-21] Alert 30 days before expiry
     */
    async getExpiringSummary(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const summary = await dashboardService.getExpiringSummary(
                req.user.id,
                parseInt(days)
            );

            logger.info('Pharmacist viewed expiring summary', {
                pharmacistId: req.user.id,
                daysThreshold: parseInt(days),
                expiringCount: summary.expiring_count,
                expiredCount: summary.expired_count
            });

            res.json({
                success: true,
                data: summary,
                summary: {
                    total_expiring: summary.expiring_count,
                    total_expired: summary.expired_count,
                    by_urgency: summary.by_urgency,
                    total_value_at_risk: summary.total_value_at_risk
                }
            });
        } catch (error) {
            logger.error('Error getting expiring summary', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get expiring items detail
     * GET /api/v1/pharmacist/dashboard/expiring/detail
     */
    async getExpiringDetail(req, res, next) {
        try {
            const { days = 30, page = 1, limit = 20 } = req.query;

            const options = {
                days: parseInt(days),
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const items = await dashboardService.getExpiringDetail(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: items.data,
                pagination: items.pagination
            });
        } catch (error) {
            logger.error('Error getting expiring detail', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // TODAY'S OVERVIEW
    // ============================================

    /**
     * Get today's overview
     * GET /api/v1/pharmacist/dashboard/today
     */
    async getTodaysOverview(req, res, next) {
        try {
            const overview = await dashboardService.getTodaysOverview(req.user.id);

            logger.info('Pharmacist viewed today\'s overview', {
                pharmacistId: req.user.id,
                dispensingCount: overview.today_dispensing?.count || 0,
                ordersReceived: overview.today_orders?.received || 0
            });

            res.json({
                success: true,
                data: overview
            });
        } catch (error) {
            logger.error('Error getting today\'s overview', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's dispensing
     * GET /api/v1/pharmacist/dashboard/today/dispensing
     */
    async getTodaysDispensing(req, res, next) {
        try {
            const dispensing = await dashboardService.getTodaysDispensing(req.user.id);

            res.json({
                success: true,
                data: dispensing,
                summary: {
                    total: dispensing.length,
                    total_items: dispensing.reduce((acc, d) => acc + d.item_count, 0),
                    total_value: dispensing.reduce((acc, d) => acc + d.total_value, 0)
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s dispensing', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's received orders
     * GET /api/v1/pharmacist/dashboard/today/received-orders
     */
    async getTodaysReceivedOrders(req, res, next) {
        try {
            const orders = await dashboardService.getTodaysReceivedOrders(req.user.id);

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            logger.error('Error getting today\'s received orders', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // WEEKLY TRENDS
    // ============================================

    /**
     * Get weekly trends
     * GET /api/v1/pharmacist/dashboard/trends/weekly
     */
    async getWeeklyTrends(req, res, next) {
        try {
            const trends = await dashboardService.getWeeklyTrends(req.user.id);

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting weekly trends', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get monthly trends
     * GET /api/v1/pharmacist/dashboard/trends/monthly
     */
    async getMonthlyTrends(req, res, next) {
        try {
            const trends = await dashboardService.getMonthlyTrends(req.user.id);

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting monthly trends', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // INVENTORY STATISTICS
    // ============================================

    /**
     * Get inventory statistics
     * GET /api/v1/pharmacist/dashboard/inventory-stats
     */
    async getInventoryStats(req, res, next) {
        try {
            const stats = await dashboardService.getInventoryStats(req.user.id);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting inventory stats', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get category distribution
     * GET /api/v1/pharmacist/dashboard/category-distribution
     */
    async getCategoryDistribution(req, res, next) {
        try {
            const distribution = await dashboardService.getCategoryDistribution(req.user.id);

            res.json({
                success: true,
                data: distribution
            });
        } catch (error) {
            logger.error('Error getting category distribution', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get manufacturer distribution
     * GET /api/v1/pharmacist/dashboard/manufacturer-distribution
     */
    async getManufacturerDistribution(req, res, next) {
        try {
            const distribution = await dashboardService.getManufacturerDistribution(req.user.id);

            res.json({
                success: true,
                data: distribution
            });
        } catch (error) {
            logger.error('Error getting manufacturer distribution', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // DISPENSING STATISTICS
    // ============================================

    /**
     * Get dispensing statistics
     * GET /api/v1/pharmacist/dashboard/dispensing-stats
     */
    async getDispensingStats(req, res, next) {
        try {
            const stats = await dashboardService.getDispensingStats(req.user.id);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting dispensing stats', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get top prescribed medicines
     * GET /api/v1/pharmacist/dashboard/top-medicines
     */
    async getTopMedicines(req, res, next) {
        try {
            const { limit = 10, period = 'month' } = req.query;

            const topMedicines = await dashboardService.getTopMedicines(
                req.user.id,
                {
                    limit: parseInt(limit),
                    period
                }
            );

            res.json({
                success: true,
                data: topMedicines
            });
        } catch (error) {
            logger.error('Error getting top medicines', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // FINANCIAL OVERVIEW
    // ============================================

    /**
     * Get financial overview
     * GET /api/v1/pharmacist/dashboard/financial
     */
    async getFinancialOverview(req, res, next) {
        try {
            const overview = await dashboardService.getFinancialOverview(req.user.id);

            res.json({
                success: true,
                data: overview
            });
        } catch (error) {
            logger.error('Error getting financial overview', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get revenue by payment method
     * GET /api/v1/pharmacist/dashboard/revenue-by-payment
     */
    async getRevenueByPaymentMethod(req, res, next) {
        try {
            const { period = 'month' } = req.query;

            const revenue = await dashboardService.getRevenueByPaymentMethod(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: revenue
            });
        } catch (error) {
            logger.error('Error getting revenue by payment method', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // ALERTS & NOTIFICATIONS
    // ============================================

    /**
     * Get all alerts
     * GET /api/v1/pharmacist/dashboard/alerts
     */
    async getAllAlerts(req, res, next) {
        try {
            const alerts = await dashboardService.getAllAlerts(req.user.id);

            logger.info('Pharmacist viewed all alerts', {
                pharmacistId: req.user.id,
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
            logger.error('Error getting all alerts', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get critical alerts
     * GET /api/v1/pharmacist/dashboard/alerts/critical
     */
    async getCriticalAlerts(req, res, next) {
        try {
            const alerts = await dashboardService.getCriticalAlerts(req.user.id);

            res.json({
                success: true,
                data: alerts
            });
        } catch (error) {
            logger.error('Error getting critical alerts', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Acknowledge alert
     * PUT /api/v1/pharmacist/dashboard/alerts/:id/acknowledge
     */
    async acknowledgeAlert(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const alert = await dashboardService.acknowledgeAlert(
                req.user.id,
                id,
                notes
            );

            logger.info('Pharmacist acknowledged alert', {
                pharmacistId: req.user.id,
                alertId: id
            });

            res.json({
                success: true,
                data: alert,
                message: 'Alert acknowledged'
            });
        } catch (error) {
            if (error.message === 'Alert not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found'
                });
            }
            logger.error('Error acknowledging alert', {
                error: error.message,
                pharmacistId: req.user.id,
                alertId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // QUICK ACTIONS
    // ============================================

    /**
     * Get quick actions
     * GET /api/v1/pharmacist/dashboard/quick-actions
     */
    async getQuickActions(req, res, next) {
        try {
            const actions = await dashboardService.getQuickActions(req.user.id);

            res.json({
                success: true,
                data: actions
            });
        } catch (error) {
            logger.error('Error getting quick actions', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending tasks count
     * GET /api/v1/pharmacist/dashboard/pending-tasks
     */
    async getPendingTasks(req, res, next) {
        try {
            const tasks = await dashboardService.getPendingTasks(req.user.id);

            res.json({
                success: true,
                data: tasks
            });
        } catch (error) {
            logger.error('Error getting pending tasks', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PERFORMANCE METRICS
    // ============================================

    /**
     * Get performance metrics
     * GET /api/v1/pharmacist/dashboard/performance
     */
    async getPerformanceMetrics(req, res, next) {
        try {
            const metrics = await dashboardService.getPerformanceMetrics(req.user.id);

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            logger.error('Error getting performance metrics', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get efficiency metrics
     * GET /api/v1/pharmacist/dashboard/efficiency
     */
    async getEfficiencyMetrics(req, res, next) {
        try {
            const metrics = await dashboardService.getEfficiencyMetrics(req.user.id);

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            logger.error('Error getting efficiency metrics', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get accuracy metrics
     * GET /api/v1/pharmacist/dashboard/accuracy
     */
    async getAccuracyMetrics(req, res, next) {
        try {
            const metrics = await dashboardService.getAccuracyMetrics(req.user.id);

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            logger.error('Error getting accuracy metrics', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // EXPORT DASHBOARD
    // ============================================

    /**
     * Export dashboard data
     * GET /api/v1/pharmacist/dashboard/export
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

            logger.info('Pharmacist exported dashboard', {
                pharmacistId: req.user.id,
                format,
                sections: sectionsArray
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=pharmacy-dashboard-${Date.now()}.pdf`);
                return res.send(data);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=pharmacy-dashboard-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting dashboard', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // RECENT ACTIVITIES
    // ============================================

    /**
     * Get recent activities
     * GET /api/v1/pharmacist/dashboard/recent-activities
     */
    async getRecentActivities(req, res, next) {
        try {
            const { limit = 20 } = req.query;

            const activities = await dashboardService.getRecentActivities(
                req.user.id,
                parseInt(limit)
            );

            res.json({
                success: true,
                data: activities
            });
        } catch (error) {
            logger.error('Error getting recent activities', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get activity feed
     * GET /api/v1/pharmacist/dashboard/activity-feed
     */
    async getActivityFeed(req, res, next) {
        try {
            const { page = 1, limit = 50 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const feed = await dashboardService.getActivityFeed(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: feed.data,
                pagination: feed.pagination
            });
        } catch (error) {
            logger.error('Error getting activity feed', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // STOCK FORECAST
    // ============================================

    /**
     * Get stock forecast
     * GET /api/v1/pharmacist/dashboard/stock-forecast
     */
    async getStockForecast(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const forecast = await dashboardService.getStockForecast(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: forecast
            });
        } catch (error) {
            logger.error('Error getting stock forecast', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get reorder recommendations
     * GET /api/v1/pharmacist/dashboard/reorder-recommendations
     */
    async getReorderRecommendations(req, res, next) {
        try {
            const recommendations = await dashboardService.getReorderRecommendations(req.user.id);

            res.json({
                success: true,
                data: recommendations,
                summary: {
                    total_items: recommendations.length,
                    estimated_cost: recommendations.reduce((acc, r) => acc + (r.estimated_cost || 0), 0),
                    urgent_items: recommendations.filter(r => r.priority === 'urgent').length
                }
            });
        } catch (error) {
            logger.error('Error getting reorder recommendations', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // CUSTOM WIDGETS
    // ============================================

    /**
     * Get custom widget data
     * POST /api/v1/pharmacist/dashboard/widget
     */
    async getCustomWidget(req, res, next) {
        try {
            const { widget_type, filters } = req.body;

            if (!widget_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Widget type is required'
                });
            }

            const widgetData = await dashboardService.getCustomWidget(
                req.user.id,
                widget_type,
                filters
            );

            res.json({
                success: true,
                data: widgetData
            });
        } catch (error) {
            logger.error('Error getting custom widget', {
                error: error.message,
                pharmacistId: req.user.id,
                widgetType: req.body.widget_type
            });
            next(error);
        }
    },

    /**
     * Save dashboard layout
     * POST /api/v1/pharmacist/dashboard/layout
     */
    async saveDashboardLayout(req, res, next) {
        try {
            const { layout } = req.body;

            if (!layout) {
                return res.status(400).json({
                    success: false,
                    error: 'Layout is required'
                });
            }

            const savedLayout = await dashboardService.saveDashboardLayout(
                req.user.id,
                layout
            );

            logger.info('Pharmacist saved dashboard layout', {
                pharmacistId: req.user.id
            });

            res.json({
                success: true,
                data: savedLayout,
                message: 'Dashboard layout saved'
            });
        } catch (error) {
            logger.error('Error saving dashboard layout', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get dashboard layout
     * GET /api/v1/pharmacist/dashboard/layout
     */
    async getDashboardLayout(req, res, next) {
        try {
            const layout = await dashboardService.getDashboardLayout(req.user.id);

            res.json({
                success: true,
                data: layout || { widgets: [] }
            });
        } catch (error) {
            logger.error('Error getting dashboard layout', {
                error: error.message,
                pharmacistId: req.user.id
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
 * Low Stock              | 2         | Summary, detail
 * Expiring               | 2         | Summary, detail
 * Today's Overview       | 3         | Overview, dispensing, received orders
 * Trends                 | 2         | Weekly, monthly
 * Inventory Statistics   | 3         | Stats, category, manufacturer
 * Dispensing Statistics  | 2         | Stats, top medicines
 * Financial Overview     | 2         | Overview, revenue by payment
 * Alerts                 | 3         | All alerts, critical, acknowledge
 * Quick Actions          | 2         | Quick actions, pending tasks
 * Performance Metrics    | 3         | Performance, efficiency, accuracy
 * Export                 | 1         | Export dashboard
 * Recent Activities      | 2         | Recent activities, activity feed
 * Stock Forecast         | 2         | Forecast, reorder recommendations
 * Custom Widgets         | 3         | Custom widget, save layout, get layout
 * -----------------------|-----------|----------------------
 * TOTAL                  | 33        | Complete dashboard management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-20] Low stock alerts
 * - [BR-21] Expiry alerts
 * 
 * ======================================================================
 */