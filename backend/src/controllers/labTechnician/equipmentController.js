/**
 * ======================================================================
 * FILE: backend/src/controllers/labTechnician/equipmentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician equipment controller - Handles lab equipment management.
 * Total Endpoints: 5
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const equipmentService = require('../../services/labTechnician/equipmentService');
const logger = require('../../utils/logger');

/**
 * Lab Technician Equipment Controller
 */
const equipmentController = {
    // ============================================
    // EQUIPMENT LISTS
    // ============================================

    /**
     * Get all equipment
     * GET /api/v1/lab/equipment
     */
    async getAllEquipment(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                category,
                department,
                search
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                category,
                department,
                search
            };

            const equipment = await equipmentService.getAllEquipment(
                req.user.id,
                options
            );

            logger.info('Lab technician retrieved all equipment', {
                technicianId: req.user.id,
                count: equipment.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: equipment.data,
                pagination: equipment.pagination,
                summary: equipment.summary
            });
        } catch (error) {
            logger.error('Error getting all equipment', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get operational equipment
     * GET /api/v1/lab/equipment/operational
     */
    async getOperationalEquipment(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const equipment = await equipmentService.getEquipmentByStatus(
                req.user.id,
                'operational',
                options
            );

            logger.info('Lab technician viewed operational equipment', {
                technicianId: req.user.id,
                count: equipment.data?.length || 0
            });

            res.json({
                success: true,
                data: equipment.data,
                pagination: equipment.pagination
            });
        } catch (error) {
            logger.error('Error getting operational equipment', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get maintenance equipment
     * GET /api/v1/lab/equipment/maintenance
     */
    async getMaintenanceEquipment(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const equipment = await equipmentService.getEquipmentByStatus(
                req.user.id,
                'maintenance',
                options
            );

            logger.info('Lab technician viewed maintenance equipment', {
                technicianId: req.user.id,
                count: equipment.data?.length || 0
            });

            res.json({
                success: true,
                data: equipment.data,
                pagination: equipment.pagination,
                summary: {
                    total: equipment.summary?.total || 0,
                    scheduled: equipment.data?.filter(e => e.maintenance_scheduled).length || 0,
                    emergency: equipment.data?.filter(e => e.maintenance_emergency).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting maintenance equipment', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get calibration due equipment
     * GET /api/v1/lab/equipment/calibration
     */
    async getCalibrationDueEquipment(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const equipment = await equipmentService.getCalibrationDueEquipment(
                req.user.id,
                parseInt(days)
            );

            logger.info('Lab technician viewed calibration due equipment', {
                technicianId: req.user.id,
                count: equipment.length,
                daysThreshold: parseInt(days)
            });

            // Group by urgency
            const now = new Date();
            const grouped = {
                overdue: equipment.filter(e => new Date(e.next_calibration_date) < now).length,
                due_soon: equipment.filter(e => {
                    const daysUntil = Math.ceil((new Date(e.next_calibration_date) - now) / (1000 * 60 * 60 * 24));
                    return daysUntil <= 7 && daysUntil >= 0;
                }).length,
                upcoming: equipment.filter(e => {
                    const daysUntil = Math.ceil((new Date(e.next_calibration_date) - now) / (1000 * 60 * 60 * 24));
                    return daysUntil > 7 && daysUntil <= 30;
                }).length
            };

            res.json({
                success: true,
                data: equipment,
                summary: {
                    total: equipment.length,
                    by_urgency: grouped
                }
            });
        } catch (error) {
            logger.error('Error getting calibration due equipment', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get equipment by ID
     * GET /api/v1/lab/equipment/:id
     */
    async getEquipmentById(req, res, next) {
        try {
            const { id } = req.params;

            const equipment = await equipmentService.getEquipmentById(
                req.user.id,
                id
            );

            if (!equipment) {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }

            logger.info('Lab technician viewed equipment details', {
                technicianId: req.user.id,
                equipmentId: id,
                equipmentName: equipment.name,
                status: equipment.status
            });

            // Check if calibration is due soon
            if (equipment.next_calibration_date) {
                const daysUntilCalibration = Math.ceil((new Date(equipment.next_calibration_date) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysUntilCalibration <= 7) {
                    logger.warn('Equipment calibration due soon', {
                        equipmentId: id,
                        daysUntilCalibration
                    });
                }
            }

            res.json({
                success: true,
                data: equipment
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error getting equipment by ID', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EQUIPMENT OPERATIONS
    // ============================================

    /**
     * Update equipment status
     * PUT /api/v1/lab/equipment/:id/status
     */
    async updateEquipmentStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, reason, estimated_repair_date } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Equipment status is required'
                });
            }

            const equipment = await equipmentService.updateEquipmentStatus(
                req.user.id,
                id,
                status,
                {
                    reason,
                    estimated_repair_date,
                    updated_by: req.user.id,
                    updated_at: new Date()
                }
            );

            logger.info('Lab technician updated equipment status', {
                technicianId: req.user.id,
                equipmentId: id,
                newStatus: status,
                reason
            });

            res.json({
                success: true,
                data: equipment,
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
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Log equipment calibration
     * POST /api/v1/lab/equipment/calibration
     */
    async logCalibration(req, res, next) {
        try {
            const calibrationData = {
                equipment_id: req.body.equipment_id,
                calibration_date: req.body.calibration_date || new Date(),
                next_calibration_date: req.body.next_calibration_date,
                calibrated_by: req.user.id,
                certificate_number: req.body.certificate_number,
                notes: req.body.notes,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!calibrationData.equipment_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Equipment ID is required'
                });
            }

            if (!calibrationData.next_calibration_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Next calibration date is required'
                });
            }

            const calibration = await equipmentService.logCalibration(
                req.user.id,
                calibrationData
            );

            logger.info('Lab technician logged equipment calibration', {
                technicianId: req.user.id,
                equipmentId: calibrationData.equipment_id,
                calibrationId: calibration.id,
                nextCalibration: calibrationData.next_calibration_date
            });

            res.status(201).json({
                success: true,
                data: calibration,
                message: 'Calibration logged successfully'
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error logging calibration', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Schedule equipment maintenance
     * POST /api/v1/lab/equipment/:id/schedule-maintenance
     */
    async scheduleMaintenance(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                maintenance_date,
                maintenance_type,
                description,
                technician,
                estimated_duration 
            } = req.body;

            if (!maintenance_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Maintenance date is required'
                });
            }

            if (!maintenance_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Maintenance type is required'
                });
            }

            const maintenance = await equipmentService.scheduleMaintenance(
                req.user.id,
                id,
                {
                    maintenance_date,
                    maintenance_type,
                    description,
                    technician,
                    estimated_duration,
                    scheduled_by: req.user.id,
                    scheduled_at: new Date()
                }
            );

            logger.info('Lab technician scheduled equipment maintenance', {
                technicianId: req.user.id,
                equipmentId: id,
                maintenanceType: maintenance_type,
                maintenanceDate: maintenance_date
            });

            res.status(201).json({
                success: true,
                data: maintenance,
                message: 'Maintenance scheduled successfully'
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error scheduling maintenance', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Complete equipment maintenance
     * PUT /api/v1/lab/equipment/:id/complete-maintenance
     */
    async completeMaintenance(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                maintenance_id,
                completion_notes,
                next_maintenance_date,
                status_after = 'operational'
            } = req.body;

            if (!maintenance_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Maintenance ID is required'
                });
            }

            const result = await equipmentService.completeMaintenance(
                req.user.id,
                id,
                {
                    maintenance_id,
                    completion_notes,
                    next_maintenance_date,
                    status_after,
                    completed_by: req.user.id,
                    completed_at: new Date()
                }
            );

            logger.info('Lab technician completed equipment maintenance', {
                technicianId: req.user.id,
                equipmentId: id,
                maintenanceId: maintenance_id
            });

            res.json({
                success: true,
                data: result,
                message: 'Maintenance completed successfully'
            });
        } catch (error) {
            if (error.message === 'Equipment not found' || error.message === 'Maintenance record not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error completing maintenance', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EQUIPMENT USAGE
    // ============================================

    /**
     * Get equipment usage stats
     * GET /api/v1/lab/equipment/usage
     */
    async getEquipmentUsage(req, res, next) {
        try {
            const { from_date, to_date, equipment_id } = req.query;

            const usage = await equipmentService.getEquipmentUsage(
                req.user.id,
                { from_date, to_date, equipment_id }
            );

            logger.info('Lab technician viewed equipment usage stats', {
                technicianId: req.user.id,
                equipmentCount: usage.length
            });

            res.json({
                success: true,
                data: usage,
                summary: {
                    total_usage_hours: usage.reduce((acc, e) => acc + (e.total_usage_hours || 0), 0),
                    total_usage_count: usage.reduce((acc, e) => acc + (e.total_usage_count || 0), 0),
                    most_used: usage.sort((a, b) => b.total_usage_count - a.total_usage_count)[0]
                }
            });
        } catch (error) {
            logger.error('Error getting equipment usage', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Log equipment usage
     * POST /api/v1/lab/equipment/:id/log-usage
     */
    async logEquipmentUsage(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                usage_type,
                duration_minutes,
                test_id,
                notes 
            } = req.body;

            if (!usage_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Usage type is required'
                });
            }

            const usage = await equipmentService.logEquipmentUsage(
                req.user.id,
                id,
                {
                    usage_type,
                    duration_minutes,
                    test_id,
                    notes,
                    used_by: req.user.id,
                    used_at: new Date()
                }
            );

            logger.info('Lab technician logged equipment usage', {
                technicianId: req.user.id,
                equipmentId: id,
                usageType: usage_type,
                duration: duration_minutes
            });

            res.status(201).json({
                success: true,
                data: usage,
                message: 'Usage logged successfully'
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error logging equipment usage', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EQUIPMENT MAINTENANCE HISTORY
    // ============================================

    /**
     * Get maintenance history
     * GET /api/v1/lab/equipment/:id/maintenance-history
     */
    async getMaintenanceHistory(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const history = await equipmentService.getMaintenanceHistory(
                req.user.id,
                id,
                options
            );

            res.json({
                success: true,
                data: history.data,
                pagination: history.pagination
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error getting maintenance history', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get calibration history
     * GET /api/v1/lab/equipment/:id/calibration-history
     */
    async getCalibrationHistory(req, res, next) {
        try {
            const { id } = req.params;

            const history = await equipmentService.getCalibrationHistory(
                req.user.id,
                id
            );

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error getting calibration history', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EQUIPMENT REPORTS
    // ============================================

    /**
     * Generate equipment report
     * GET /api/v1/lab/equipment/report
     */
    async generateEquipmentReport(req, res, next) {
        try {
            const { format = 'pdf', status, category } = req.query;

            const report = await equipmentService.generateEquipmentReport(
                req.user.id,
                format,
                { status, category }
            );

            logger.info('Lab technician generated equipment report', {
                technicianId: req.user.id,
                format
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=equipment-report-${Date.now()}.pdf`);
                return res.send(report);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=equipment-report-${Date.now()}.csv`);
                return res.send(report);
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error generating equipment report', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export equipment list
     * GET /api/v1/lab/equipment/export
     */
    async exportEquipment(req, res, next) {
        try {
            const { format = 'csv', status } = req.query;

            const data = await equipmentService.exportEquipment(
                req.user.id,
                format,
                { status }
            );

            logger.info('Lab technician exported equipment list', {
                technicianId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=equipment-list-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting equipment', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // EQUIPMENT ALERTS
    // ============================================

    /**
     * Get equipment alerts
     * GET /api/v1/lab/equipment/alerts
     */
    async getEquipmentAlerts(req, res, next) {
        try {
            const alerts = await equipmentService.getEquipmentAlerts(req.user.id);

            logger.info('Lab technician viewed equipment alerts', {
                technicianId: req.user.id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    calibration_due: alerts.filter(a => a.type === 'calibration_due').length,
                    maintenance_due: alerts.filter(a => a.type === 'maintenance_due').length,
                    out_of_service: alerts.filter(a => a.type === 'out_of_service').length,
                    critical: alerts.filter(a => a.severity === 'critical').length
                }
            });
        } catch (error) {
            logger.error('Error getting equipment alerts', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Acknowledge equipment alert
     * PUT /api/v1/lab/equipment/alerts/:id/acknowledge
     */
    async acknowledgeEquipmentAlert(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const alert = await equipmentService.acknowledgeEquipmentAlert(
                req.user.id,
                id,
                {
                    notes,
                    acknowledged_by: req.user.id,
                    acknowledged_at: new Date()
                }
            );

            logger.info('Lab technician acknowledged equipment alert', {
                technicianId: req.user.id,
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
            logger.error('Error acknowledging equipment alert', {
                error: error.message,
                technicianId: req.user.id,
                alertId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EQUIPMENT DOCUMENTS
    // ============================================

    /**
     * Upload equipment document
     * POST /api/v1/lab/equipment/:id/documents
     */
    async uploadEquipmentDocument(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                document_type,
                document_name,
                document_url,
                expiry_date,
                notes 
            } = req.body;

            if (!document_type || !document_name || !document_url) {
                return res.status(400).json({
                    success: false,
                    error: 'Document type, name, and URL are required'
                });
            }

            const document = await equipmentService.uploadEquipmentDocument(
                req.user.id,
                id,
                {
                    document_type,
                    document_name,
                    document_url,
                    expiry_date,
                    notes,
                    uploaded_by: req.user.id,
                    uploaded_at: new Date()
                }
            );

            logger.info('Lab technician uploaded equipment document', {
                technicianId: req.user.id,
                equipmentId: id,
                documentType: document_type
            });

            res.status(201).json({
                success: true,
                data: document,
                message: 'Document uploaded successfully'
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error uploading equipment document', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get equipment documents
     * GET /api/v1/lab/equipment/:id/documents
     */
    async getEquipmentDocuments(req, res, next) {
        try {
            const { id } = req.params;

            const documents = await equipmentService.getEquipmentDocuments(
                req.user.id,
                id
            );

            res.json({
                success: true,
                data: documents
            });
        } catch (error) {
            if (error.message === 'Equipment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found'
                });
            }
            logger.error('Error getting equipment documents', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete equipment document
     * DELETE /api/v1/lab/equipment/:equipmentId/documents/:documentId
     */
    async deleteEquipmentDocument(req, res, next) {
        try {
            const { equipmentId, documentId } = req.params;

            await equipmentService.deleteEquipmentDocument(
                req.user.id,
                equipmentId,
                documentId
            );

            logger.info('Lab technician deleted equipment document', {
                technicianId: req.user.id,
                equipmentId,
                documentId
            });

            res.json({
                success: true,
                message: 'Document deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Document not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }
            logger.error('Error deleting equipment document', {
                error: error.message,
                technicianId: req.user.id,
                equipmentId: req.params.equipmentId,
                documentId: req.params.documentId
            });
            next(error);
        }
    }
};

module.exports = equipmentController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Equipment Lists        | 4         | All, operational, maintenance, calibration due, by ID
 * Equipment Operations   | 4         | Update status, log calibration, schedule maintenance, complete maintenance
 * Equipment Usage        | 2         | Get usage stats, log usage
 * Maintenance History    | 2         | Maintenance history, calibration history
 * Reports                | 2         | Generate report, export
 * Alerts                 | 2         | Get alerts, acknowledge
 * Documents              | 3         | Upload, get, delete
 * -----------------------|-----------|----------------------
 * TOTAL                  | 19        | Complete equipment management
 * 
 * ======================================================================
 */