/**
 * ======================================================================
 * FILE: backend/src/controllers/radiologist/dashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist dashboard controller - Provides comprehensive radiology overview.
 * Total Endpoints: 1
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const dashboardService = require('../../services/radiologist/dashboardService');
const logger = require('../../utils/logger');

const dashboardController = {
    /**
     * Get radiologist dashboard
     * GET /api/v1/radiology/dashboard
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await dashboardService.getDashboard(req.user.id);

            logger.info('Radiologist viewed dashboard', {
                radiologistId: req.user.id,
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
                radiologistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = dashboardController;