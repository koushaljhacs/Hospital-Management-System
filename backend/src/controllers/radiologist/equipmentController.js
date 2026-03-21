/**
 * ======================================================================
 * FILE: backend/src/controllers/radiologist/equipmentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist equipment controller - Handles radiology equipment management.
 * Total Endpoints: 2
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const equipmentService = require('../../services/radiologist/equipmentService');
const logger = require('../../utils/logger');

const equipmentController = {
    /**
     * Get all radiology equipment
     * GET /api/v1/radiology/equipment
     */
    async getAllEquipment(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                type,
                location,
                manufacturer
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                type,
                location,
                manufacturer
            };

            const equipment = await equipmentService.getAllEquipment(
                req.user.id,
                options
            );

            logger.info('Radiologist retrieved equipment', {
                radiologistId: req.user.id,
                count: equipment.data?.length || 0
            });

            // Group by status for summary
            const byStatus = {
                operational: equipment.data?.filter(e => e.status === 'operational').length || 0,
                maintenance: equipment.data?.filter(e => e.status === 'maintenance').length || 0,
                calibration_due: equipment.data?.filter(e => e.status === 'calibration_due').length || 0,
                out_of_service: equipment.data?.filter(e => e.status === 'out_of_service').length || 0
            };

            // Equipment needing calibration in next 30 days
            const calibrationNeeded = equipment.data?.filter(e => {
                if (e.next_calibration) {
                    const daysUntil = (new Date(e.next_calibration) - new Date()) / (1000 * 60 * 60 * 24);
                    return daysUntil <= 30 && daysUntil > 0;
                }
                return false;
            }).length || 0;

            res.json({
                success: true,
                data: equipment.data,
                pagination: equipment.pagination,
                summary: {
                    total: equipment.summary?.total || 0,
                    by_status: byStatus,
                    calibration_needed: calibrationNeeded
                }
            });
        } catch (error) {
            logger.error('Error getting equipment', {
                error: error.message,
                radiologistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update equipment status
     * PUT /api/v1/radiology/equipment/:id/status
     */
    async updateEquipmentStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }

            const validStatuses = ['operational', 'maintenance', 'calibration_due', 'out_of_service', 'retired'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status value'
                });
            }

            const equipment = await equipmentService.getEquipmentById(req.user.id, id);
            
            if (!equipment) {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }

            const updated = await equipmentService.updateEquipmentStatus(
                req.user.id,
                id,
                {
                    status,
                    notes,
                    updated_at: new Date(),
                    updated_by: req.user.id
                }
            );

            logger.info('Radiologist updated equipment status', {
                radiologistId: req.user.id,
                equipmentId: id,
                oldStatus: equipment.status,
                newStatus: status
            });

            res.json({
                success: true,
                data: updated,
                message: `Equipment status updated to ${status}`
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error updating equipment status', {
                error: error.message,
                radiologistId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = equipmentController;