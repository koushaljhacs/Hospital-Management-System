/**
 * ======================================================================
 * FILE: backend/src/controllers/billing/dashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing dashboard controller - Provides comprehensive billing overview.
 * Total Endpoints: 1
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const dashboardService = require('../../services/billing/dashboardService');
const logger = require('../../utils/logger');

const dashboardController = {
    /**
     * Get billing dashboard
     * GET /api/v1/billing/dashboard
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await dashboardService.getDashboard(req.user.id);

            logger.info('Billing staff viewed dashboard', {
                staffId: req.user.id,
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
                staffId: req.user.id
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
 * Dashboard              | 1         | Complete billing overview
 * -----------------------|-----------|----------------------
 * TOTAL                  | 1         | Dashboard endpoint
 * 
 * ======================================================================
 */