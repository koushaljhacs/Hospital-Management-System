/**
 * ======================================================================
 * FILE: backend/src/controllers/billing/reportController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing report controller - Handles financial reports.
 * Total Endpoints: 8
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const reportService = require('../../services/billing/reportService');
const logger = require('../../utils/logger');

const reportController = {
    // ============================================
    // DAILY REPORTS
    // ============================================

    /**
     * Get daily report
     * GET /api/v1/billing/reports/daily
     */
    async getDailyReport(req, res, next) {
        try {
            const { date } = req.query;

            const report = await reportService.getDailyReport(
                req.user.id,
                { date: date || new Date().toISOString().split('T')[0] }
            );

            logger.info('Billing staff viewed daily report', {
                staffId: req.user.id,
                date: date || 'today'
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting daily report', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get weekly report
     * GET /api/v1/billing/reports/weekly
     */
    async getWeeklyReport(req, res, next) {
        try {
            const { week, year } = req.query;

            const report = await reportService.getWeeklyReport(
                req.user.id,
                {
                    week: week ? parseInt(week) : undefined,
                    year: year ? parseInt(year) : undefined
                }
            );

            logger.info('Billing staff viewed weekly report', {
                staffId: req.user.id,
                week: report.week,
                year: report.year
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting weekly report', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get monthly report
     * GET /api/v1/billing/reports/monthly
     */
    async getMonthlyReport(req, res, next) {
        try {
            const { month, year } = req.query;

            const report = await reportService.getMonthlyReport(
                req.user.id,
                {
                    month: month ? parseInt(month) : undefined,
                    year: year ? parseInt(year) : undefined
                }
            );

            logger.info('Billing staff viewed monthly report', {
                staffId: req.user.id,
                month: report.month,
                year: report.year
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting monthly report', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get yearly report
     * GET /api/v1/billing/reports/yearly
     */
    async getYearlyReport(req, res, next) {
        try {
            const { year } = req.query;

            const report = await reportService.getYearlyReport(
                req.user.id,
                { year: year ? parseInt(year) : undefined }
            );

            logger.info('Billing staff viewed yearly report', {
                staffId: req.user.id,
                year: report.year
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting yearly report', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // FINANCIAL REPORTS
    // ============================================

    /**
     * Get revenue report
     * GET /api/v1/billing/reports/revenue
     */
    async getRevenueReport(req, res, next) {
        try {
            const { from_date, to_date, group_by = 'day' } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const report = await reportService.getRevenueReport(
                req.user.id,
                { from_date, to_date, group_by }
            );

            logger.info('Billing staff viewed revenue report', {
                staffId: req.user.id,
                fromDate: from_date,
                toDate: to_date,
                totalRevenue: report.summary?.total_revenue
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting revenue report', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get outstanding report
     * GET /api/v1/billing/reports/outstanding
     */
    async getOutstandingReport(req, res, next) {
        try {
            const { as_on_date } = req.query;

            const report = await reportService.getOutstandingReport(
                req.user.id,
                { as_on_date: as_on_date || new Date().toISOString().split('T')[0] }
            );

            logger.info('Billing staff viewed outstanding report', {
                staffId: req.user.id,
                asOnDate: as_on_date || 'today',
                totalOutstanding: report.summary?.total_outstanding
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting outstanding report', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get insurance report
     * GET /api/v1/billing/reports/insurance
     */
    async getInsuranceReport(req, res, next) {
        try {
            const { from_date, to_date, insurance_provider_id } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const report = await reportService.getInsuranceReport(
                req.user.id,
                { from_date, to_date, insurance_provider_id }
            );

            logger.info('Billing staff viewed insurance report', {
                staffId: req.user.id,
                fromDate: from_date,
                toDate: to_date,
                providerId: insurance_provider_id
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting insurance report', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get tax report
     * GET /api/v1/billing/reports/tax
     */
    async getTaxReport(req, res, next) {
        try {
            const { from_date, to_date, tax_type } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const report = await reportService.getTaxReport(
                req.user.id,
                { from_date, to_date, tax_type }
            );

            logger.info('Billing staff viewed tax report', {
                staffId: req.user.id,
                fromDate: from_date,
                toDate: to_date,
                taxType: tax_type || 'all',
                totalTax: report.summary?.total_tax
            });

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting tax report', {
                error: error.message,
                staffId: req.user.id
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
 * Period Reports         | 4         | Daily, weekly, monthly, yearly
 * Financial Reports      | 4         | Revenue, outstanding, insurance, tax
 * -----------------------|-----------|----------------------
 * TOTAL                  | 8         | Complete financial reporting
 * 
 * ======================================================================
 */