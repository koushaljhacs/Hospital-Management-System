/**
 * ======================================================================
 * FILE: backend/src/controllers/pharmacist/reportController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist report controller - Handles all pharmacy reports.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ENDPOINTS: 6 endpoints
 * ======================================================================
 */

const reportService = require('../../services/pharmacist/reportService');
const logger = require('../../utils/logger');

/**
 * Pharmacist Report Controller
 */
const reportController = {
    // ============================================
    // INVENTORY REPORTS
    // ============================================

    /**
     * Get inventory report
     * GET /api/v1/pharmacist/reports/inventory
     */
    async getInventoryReport(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                category,
                manufacturer,
                location,
                format = 'json'
            } = req.query;

            const options = {
                from_date,
                to_date,
                category,
                manufacturer,
                location
            };

            const report = await reportService.getInventoryReport(
                req.user.id,
                options
            );

            logger.info('Pharmacist generated inventory report', {
                pharmacistId: req.user.id,
                filters: Object.keys(options).filter(k => options[k]),
                format
            });

            if (format === 'csv') {
                const csvData = await reportService.exportToCSV(report, 'inventory');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=inventory-report-${Date.now()}.csv`);
                return res.send(csvData);
            }

            if (format === 'pdf') {
                const pdfData = await reportService.exportToPDF(report, 'inventory');
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=inventory-report-${Date.now()}.pdf`);
                return res.send(pdfData);
            }

            res.json({
                success: true,
                data: report,
                summary: {
                    total_items: report.summary?.total_items || 0,
                    total_value: report.summary?.total_value || 0,
                    total_quantity: report.summary?.total_quantity || 0,
                    low_stock_count: report.summary?.low_stock_count || 0,
                    out_of_stock_count: report.summary?.out_of_stock_count || 0,
                    by_category: report.summary?.by_category || {},
                    by_location: report.summary?.by_location || {}
                }
            });
        } catch (error) {
            logger.error('Error generating inventory report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get inventory valuation report
     * GET /api/v1/pharmacist/reports/inventory/valuation
     */
    async getInventoryValuationReport(req, res, next) {
        try {
            const { as_on_date } = req.query;

            const report = await reportService.getInventoryValuationReport(
                req.user.id,
                { as_on_date: as_on_date || new Date() }
            );

            logger.info('Pharmacist generated inventory valuation report', {
                pharmacistId: req.user.id,
                asOnDate: as_on_date || new Date()
            });

            res.json({
                success: true,
                data: report,
                summary: {
                    total_value: report.total_value,
                    by_category: report.by_category,
                    by_location: report.by_location,
                    moving_average: report.moving_average,
                    potential_profit: report.potential_profit
                }
            });
        } catch (error) {
            logger.error('Error generating inventory valuation report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get inventory movement report
     * GET /api/v1/pharmacist/reports/inventory/movement
     */
    async getInventoryMovementReport(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                medicine_id,
                movement_type
            } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const options = {
                from_date,
                to_date,
                medicine_id,
                movement_type
            };

            const report = await reportService.getInventoryMovementReport(
                req.user.id,
                options
            );

            logger.info('Pharmacist generated inventory movement report', {
                pharmacistId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            res.json({
                success: true,
                data: report,
                summary: {
                    total_in: report.summary?.total_in || 0,
                    total_out: report.summary?.total_out || 0,
                    net_change: report.summary?.net_change || 0,
                    by_type: report.summary?.by_type || {}
                }
            });
        } catch (error) {
            logger.error('Error generating inventory movement report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // CONSUMPTION REPORTS
    // ============================================

    /**
     * Get consumption report
     * GET /api/v1/pharmacist/reports/consumption
     */
    async getConsumptionReport(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                group_by = 'day',
                category,
                manufacturer,
                format = 'json'
            } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const options = {
                from_date,
                to_date,
                group_by,
                category,
                manufacturer
            };

            const report = await reportService.getConsumptionReport(
                req.user.id,
                options
            );

            logger.info('Pharmacist generated consumption report', {
                pharmacistId: req.user.id,
                fromDate: from_date,
                toDate: to_date,
                groupBy: group_by
            });

            if (format === 'csv') {
                const csvData = await reportService.exportToCSV(report, 'consumption');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=consumption-report-${Date.now()}.csv`);
                return res.send(csvData);
            }

            res.json({
                success: true,
                data: report,
                summary: {
                    total_consumption: report.summary?.total_consumption || 0,
                    total_value: report.summary?.total_value || 0,
                    top_medicines: report.summary?.top_medicines || [],
                    by_category: report.summary?.by_category || {},
                    daily_average: report.summary?.daily_average || 0
                }
            });
        } catch (error) {
            logger.error('Error generating consumption report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get medicine-wise consumption
     * GET /api/v1/pharmacist/reports/consumption/by-medicine
     */
    async getMedicineConsumptionReport(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                medicine_id,
                limit = 20
            } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const options = {
                from_date,
                to_date,
                medicine_id,
                limit: parseInt(limit)
            };

            const report = await reportService.getMedicineConsumptionReport(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error generating medicine consumption report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get department-wise consumption
     * GET /api/v1/pharmacist/reports/consumption/by-department
     */
    async getDepartmentConsumptionReport(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const report = await reportService.getDepartmentConsumptionReport(
                req.user.id,
                { from_date, to_date }
            );

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error generating department consumption report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // DISPENSING REPORTS
    // ============================================

    /**
     * Get dispensing report
     * GET /api/v1/pharmacist/reports/dispensing
     */
    async getDispensingReport(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                group_by = 'day',
                doctor_id,
                patient_id,
                format = 'json'
            } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const options = {
                from_date,
                to_date,
                group_by,
                doctor_id,
                patient_id
            };

            const report = await reportService.getDispensingReport(
                req.user.id,
                options
            );

            logger.info('Pharmacist generated dispensing report', {
                pharmacistId: req.user.id,
                fromDate: from_date,
                toDate: to_date,
                groupBy: group_by
            });

            if (format === 'csv') {
                const csvData = await reportService.exportToCSV(report, 'dispensing');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=dispensing-report-${Date.now()}.csv`);
                return res.send(csvData);
            }

            res.json({
                success: true,
                data: report,
                summary: {
                    total_prescriptions: report.summary?.total_prescriptions || 0,
                    total_items: report.summary?.total_items || 0,
                    total_value: report.summary?.total_value || 0,
                    by_doctor: report.summary?.by_doctor || {},
                    by_patient: report.summary?.by_patient || {},
                    by_medicine: report.summary?.by_medicine || {}
                }
            });
        } catch (error) {
            logger.error('Error generating dispensing report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get doctor prescribing patterns
     * GET /api/v1/pharmacist/reports/dispensing/by-doctor
     */
    async getDoctorPrescribingReport(req, res, next) {
        try {
            const { from_date, to_date, doctor_id } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const report = await reportService.getDoctorPrescribingReport(
                req.user.id,
                { from_date, to_date, doctor_id }
            );

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error generating doctor prescribing report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // EXPIRY REPORTS
    // ============================================

    /**
     * Get expiry report
     * GET /api/v1/pharmacist/reports/expiry
     */
    async getExpiryReport(req, res, next) {
        try {
            const { 
                days = 90,
                category,
                manufacturer,
                location,
                format = 'json'
            } = req.query;

            const options = {
                days: parseInt(days),
                category,
                manufacturer,
                location
            };

            const report = await reportService.getExpiryReport(
                req.user.id,
                options
            );

            logger.info('Pharmacist generated expiry report', {
                pharmacistId: req.user.id,
                days: parseInt(days)
            });

            if (format === 'csv') {
                const csvData = await reportService.exportToCSV(report, 'expiry');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=expiry-report-${Date.now()}.csv`);
                return res.send(csvData);
            }

            res.json({
                success: true,
                data: report,
                summary: {
                    total_items: report.summary?.total_items || 0,
                    expiring_soon: report.summary?.expiring_soon || 0,
                    expired: report.summary?.expired || 0,
                    total_value: report.summary?.total_value || 0,
                    potential_loss: report.summary?.potential_loss || 0,
                    by_month: report.summary?.by_month || {}
                }
            });
        } catch (error) {
            logger.error('Error generating expiry report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get expiry forecast
     * GET /api/v1/pharmacist/reports/expiry/forecast
     */
    async getExpiryForecast(req, res, next) {
        try {
            const { months = 6 } = req.query;

            const forecast = await reportService.getExpiryForecast(
                req.user.id,
                parseInt(months)
            );

            res.json({
                success: true,
                data: forecast,
                summary: {
                    total_value_at_risk: forecast.total_value_at_risk,
                    by_month: forecast.by_month,
                    recommendations: forecast.recommendations
                }
            });
        } catch (error) {
            logger.error('Error generating expiry forecast', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PURCHASE ORDER REPORTS
    // ============================================

    /**
     * Get purchase orders report
     * GET /api/v1/pharmacist/reports/purchase-orders
     */
    async getPurchaseOrdersReport(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                supplier_id,
                status,
                format = 'json'
            } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const options = {
                from_date,
                to_date,
                supplier_id,
                status
            };

            const report = await reportService.getPurchaseOrdersReport(
                req.user.id,
                options
            );

            logger.info('Pharmacist generated purchase orders report', {
                pharmacistId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            if (format === 'csv') {
                const csvData = await reportService.exportToCSV(report, 'purchase-orders');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=purchase-orders-report-${Date.now()}.csv`);
                return res.send(csvData);
            }

            res.json({
                success: true,
                data: report,
                summary: {
                    total_orders: report.summary?.total_orders || 0,
                    total_value: report.summary?.total_value || 0,
                    by_supplier: report.summary?.by_supplier || {},
                    by_status: report.summary?.by_status || {},
                    average_lead_time: report.summary?.average_lead_time || 0
                }
            });
        } catch (error) {
            logger.error('Error generating purchase orders report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get supplier performance report
     * GET /api/v1/pharmacist/reports/supplier-performance
     */
    async getSupplierPerformanceReport(req, res, next) {
        try {
            const { 
                from_date, 
                to_date,
                supplier_id,
                format = 'json'
            } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const options = {
                from_date,
                to_date,
                supplier_id
            };

            const report = await reportService.getSupplierPerformanceReport(
                req.user.id,
                options
            );

            logger.info('Pharmacist generated supplier performance report', {
                pharmacistId: req.user.id,
                fromDate: from_date,
                toDate: to_date
            });

            if (format === 'csv') {
                const csvData = await reportService.exportToCSV(report, 'supplier-performance');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=supplier-performance-${Date.now()}.csv`);
                return res.send(csvData);
            }

            res.json({
                success: true,
                data: report,
                summary: {
                    total_suppliers: report.summary?.total_suppliers || 0,
                    average_delivery_time: report.summary?.average_delivery_time || 0,
                    on_time_delivery_rate: report.summary?.on_time_delivery_rate || 0,
                    quality_rating: report.summary?.quality_rating || 0,
                    top_suppliers: report.summary?.top_suppliers || []
                }
            });
        } catch (error) {
            logger.error('Error generating supplier performance report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // FINANCIAL REPORTS
    // ============================================

    /**
     * Get financial summary report
     * GET /api/v1/pharmacist/reports/financial/summary
     */
    async getFinancialSummaryReport(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const report = await reportService.getFinancialSummaryReport(
                req.user.id,
                { from_date, to_date }
            );

            res.json({
                success: true,
                data: report,
                summary: {
                    total_sales: report.total_sales,
                    total_purchases: report.total_purchases,
                    gross_profit: report.gross_profit,
                    gross_margin: report.gross_margin,
                    inventory_value: report.inventory_value,
                    outstanding_payments: report.outstanding_payments
                }
            });
        } catch (error) {
            logger.error('Error generating financial summary report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get profit & loss report
     * GET /api/v1/pharmacist/reports/financial/profit-loss
     */
    async getProfitLossReport(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const report = await reportService.getProfitLossReport(
                req.user.id,
                { from_date, to_date }
            );

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error generating profit loss report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // DASHBOARD REPORTS
    // ============================================

    /**
     * Get pharmacy dashboard data
     * GET /api/v1/pharmacist/reports/dashboard
     */
    async getPharmacyDashboard(req, res, next) {
        try {
            const dashboard = await reportService.getPharmacyDashboard(req.user.id);

            res.json({
                success: true,
                data: dashboard
            });
        } catch (error) {
            logger.error('Error getting pharmacy dashboard', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get key metrics
     * GET /api/v1/pharmacist/reports/key-metrics
     */
    async getKeyMetrics(req, res, next) {
        try {
            const metrics = await reportService.getKeyMetrics(req.user.id);

            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            logger.error('Error getting key metrics', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get trend analysis
     * GET /api/v1/pharmacist/reports/trends
     */
    async getTrendAnalysis(req, res, next) {
        try {
            const { months = 6, metric = 'consumption' } = req.query;

            const trends = await reportService.getTrendAnalysis(
                req.user.id,
                {
                    months: parseInt(months),
                    metric
                }
            );

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting trend analysis', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // CUSTOM REPORTS
    // ============================================

    /**
     * Generate custom report
     * POST /api/v1/pharmacist/reports/custom
     */
    async generateCustomReport(req, res, next) {
        try {
            const {
                report_type,
                fields,
                filters,
                group_by,
                sort_by,
                format = 'json'
            } = req.body;

            if (!report_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Report type is required'
                });
            }

            if (!fields || fields.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one field is required'
                });
            }

            const report = await reportService.generateCustomReport(
                req.user.id,
                {
                    report_type,
                    fields,
                    filters,
                    group_by,
                    sort_by
                }
            );

            logger.info('Pharmacist generated custom report', {
                pharmacistId: req.user.id,
                reportType: report_type
            });

            if (format === 'csv') {
                const csvData = await reportService.exportToCSV(report.data, 'custom');
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=custom-report-${Date.now()}.csv`);
                return res.send(csvData);
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error generating custom report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Schedule report
     * POST /api/v1/pharmacist/reports/schedule
     */
    async scheduleReport(req, res, next) {
        try {
            const {
                report_type,
                frequency,
                recipients,
                format,
                filters
            } = req.body;

            if (!report_type || !frequency || !recipients) {
                return res.status(400).json({
                    success: false,
                    error: 'Report type, frequency, and recipients are required'
                });
            }

            const schedule = await reportService.scheduleReport(
                req.user.id,
                {
                    report_type,
                    frequency,
                    recipients,
                    format: format || 'pdf',
                    filters,
                    created_by: req.user.id
                }
            );

            logger.info('Pharmacist scheduled report', {
                pharmacistId: req.user.id,
                scheduleId: schedule.id,
                reportType: report_type,
                frequency
            });

            res.status(201).json({
                success: true,
                data: schedule,
                message: `Report scheduled ${frequency}`
            });
        } catch (error) {
            logger.error('Error scheduling report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get scheduled reports
     * GET /api/v1/pharmacist/reports/scheduled
     */
    async getScheduledReports(req, res, next) {
        try {
            const schedules = await reportService.getScheduledReports(req.user.id);

            res.json({
                success: true,
                data: schedules
            });
        } catch (error) {
            logger.error('Error getting scheduled reports', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Delete scheduled report
     * DELETE /api/v1/pharmacist/reports/scheduled/:id
     */
    async deleteScheduledReport(req, res, next) {
        try {
            const { id } = req.params;

            await reportService.deleteScheduledReport(req.user.id, id);

            res.json({
                success: true,
                message: 'Scheduled report deleted'
            });
        } catch (error) {
            if (error.message === 'Schedule not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Schedule not found'
                });
            }
            logger.error('Error deleting scheduled report', {
                error: error.message,
                pharmacistId: req.user.id,
                scheduleId: req.params.id
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
 * Inventory Reports      | 3         | Inventory, valuation, movement
 * Consumption Reports    | 3         | Consumption, medicine-wise, department-wise
 * Dispensing Reports     | 2         | Dispensing, doctor prescribing
 * Expiry Reports         | 2         | Expiry, forecast
 * Purchase Order Reports | 2         | Purchase orders, supplier performance
 * Financial Reports      | 2         | Financial summary, profit & loss
 * Dashboard Reports      | 3         | Dashboard, key metrics, trends
 * Custom Reports         | 4         | Custom report, schedule, get, delete
 * -----------------------|-----------|----------------------
 * TOTAL                  | 21        | Complete reporting suite
 * 
 * ======================================================================
 */