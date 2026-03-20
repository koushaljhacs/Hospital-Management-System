/**
 * ======================================================================
 * FILE: backend/src/controllers/receptionist/bedController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist bed controller - Handles bed allocation and management.
 * Total Endpoints: 8
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * 
 * ======================================================================
 */

const bedService = require('../../services/receptionist/bedService');
const logger = require('../../utils/logger');

/**
 * Receptionist Bed Controller
 */
const bedController = {
    // ============================================
    // BED LISTS
    // ============================================

    /**
     * Get all beds
     * GET /api/v1/reception/beds
     */
    async getAllBeds(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 50,
                ward,
                status,
                type,
                floor
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward,
                status,
                type,
                floor: floor ? parseInt(floor) : undefined
            };

            const beds = await bedService.getAllBeds(
                req.user.id,
                options
            );

            logger.info('Receptionist retrieved beds', {
                receptionistId: req.user.id,
                count: beds.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Group by status for summary
            const byStatus = {
                available: beds.data?.filter(b => b.status === 'available').length || 0,
                occupied: beds.data?.filter(b => b.status === 'occupied').length || 0,
                cleaning: beds.data?.filter(b => b.status === 'cleaning').length || 0,
                maintenance: beds.data?.filter(b => b.status === 'maintenance').length || 0,
                out_of_service: beds.data?.filter(b => b.status === 'out_of_service').length || 0
            };

            res.json({
                success: true,
                data: beds.data,
                pagination: beds.pagination,
                summary: {
                    total: beds.summary?.total || 0,
                    by_status: byStatus,
                    occupancy_rate: beds.summary?.total > 0 
                        ? ((byStatus.occupied / beds.summary.total) * 100).toFixed(1) 
                        : 0
                }
            });
        } catch (error) {
            logger.error('Error getting all beds', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get available beds
     * GET /api/v1/reception/beds/available
     * 
     * BUSINESS RULE: [BR-25] Cannot assign occupied bed
     */
    async getAvailableBeds(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 50,
                ward,
                type,
                required_equipment
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward,
                type,
                required_equipment: required_equipment ? required_equipment.split(',') : undefined
            };

            const beds = await bedService.getAvailableBeds(
                req.user.id,
                options
            );

            logger.info('Receptionist viewed available beds', {
                receptionistId: req.user.id,
                count: beds.data?.length || 0
            });

            // Group by type for easier allocation
            const byType = beds.data?.reduce((acc, bed) => {
                if (!acc[bed.type]) {
                    acc[bed.type] = [];
                }
                acc[bed.type].push(bed);
                return acc;
            }, {});

            res.json({
                success: true,
                data: beds.data,
                pagination: beds.pagination,
                summary: {
                    total: beds.summary?.total || 0,
                    by_type: Object.keys(byType || {}).map(type => ({
                        type,
                        count: byType[type].length,
                        beds: byType[type]
                    })),
                    icu_available: beds.data?.filter(b => b.type === 'icu').length || 0,
                    emergency_available: beds.data?.filter(b => b.type === 'emergency').length || 0,
                    isolation_available: beds.data?.filter(b => b.type === 'isolation').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting available beds', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get beds by ward
     * GET /api/v1/reception/beds/ward/:ward
     */
    async getBedsByWard(req, res, next) {
        try {
            const { ward } = req.params;
            const { 
                page = 1, 
                limit = 50,
                status,
                type 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                type
            };

            const beds = await bedService.getBedsByWard(
                req.user.id,
                ward,
                options
            );

            logger.info('Receptionist viewed beds by ward', {
                receptionistId: req.user.id,
                ward,
                count: beds.data?.length || 0
            });

            res.json({
                success: true,
                data: beds.data,
                pagination: beds.pagination,
                summary: beds.summary
            });
        } catch (error) {
            logger.error('Error getting beds by ward', {
                error: error.message,
                receptionistId: req.user.id,
                ward: req.params.ward
            });
            next(error);
        }
    },

    /**
     * Get beds by type
     * GET /api/v1/reception/beds/type/:type
     */
    async getBedsByType(req, res, next) {
        try {
            const { type } = req.params;
            const { 
                page = 1, 
                limit = 50,
                ward,
                status 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward,
                status
            };

            const beds = await bedService.getBedsByType(
                req.user.id,
                type,
                options
            );

            logger.info('Receptionist viewed beds by type', {
                receptionistId: req.user.id,
                type,
                count: beds.data?.length || 0
            });

            res.json({
                success: true,
                data: beds.data,
                pagination: beds.pagination
            });
        } catch (error) {
            logger.error('Error getting beds by type', {
                error: error.message,
                receptionistId: req.user.id,
                type: req.params.type
            });
            next(error);
        }
    },

    /**
     * Get bed by ID
     * GET /api/v1/reception/beds/:id
     */
    async getBedById(req, res, next) {
        try {
            const { id } = req.params;

            const bed = await bedService.getBedById(
                req.user.id,
                id
            );

            if (!bed) {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }

            logger.info('Receptionist viewed bed details', {
                receptionistId: req.user.id,
                bedId: id,
                bedNumber: bed.bed_number,
                ward: bed.ward,
                status: bed.status
            });

            res.json({
                success: true,
                data: bed
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error getting bed by ID', {
                error: error.message,
                receptionistId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BED ALLOCATION
    // ============================================

    /**
     * Allocate bed to patient
     * POST /api/v1/reception/beds/allocate
     * 
     * BUSINESS RULES:
     * - [BR-24] Bed status workflow
     * - [BR-25] Cannot assign occupied bed
     */
    async allocateBed(req, res, next) {
        try {
            const { 
                patient_id, 
                bed_id, 
                expected_discharge,
                notes,
                is_emergency = false
            } = req.body;

            // Validate required fields
            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!bed_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Bed ID is required'
                });
            }

            // Get bed details
            const bed = await bedService.getBedById(req.user.id, bed_id);
            
            if (!bed) {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }

            // [BR-25] Check if bed is available
            if (bed.status !== 'available') {
                return res.status(409).json({
                    success: false,
                    error: `Bed is not available (current status: ${bed.status})`
                });
            }

            // Check if patient exists and is not already assigned
            const patient = await bedService.validatePatientForAllocation(patient_id);

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            if (patient.current_bed_id) {
                return res.status(409).json({
                    success: false,
                    error: 'Patient is already assigned to a bed'
                });
            }

            // Validate expected discharge (max 30 days)
            if (expected_discharge) {
                const dischargeDate = new Date(expected_discharge);
                const maxDate = new Date();
                maxDate.setDate(maxDate.getDate() + 30);
                
                if (dischargeDate > maxDate) {
                    return res.status(400).json({
                        success: false,
                        error: 'Expected discharge cannot exceed 30 days'
                    });
                }
            }

            const allocation = await bedService.allocateBed(
                req.user.id,
                {
                    patient_id,
                    bed_id,
                    expected_discharge,
                    notes,
                    is_emergency,
                    allocated_at: new Date(),
                    allocated_by: req.user.id
                }
            );

            logger.info('Receptionist allocated bed to patient', {
                receptionistId: req.user.id,
                bedId: bed_id,
                patientId: patient_id,
                bedType: bed.type,
                isEmergency: is_emergency
            });

            res.json({
                success: true,
                data: allocation,
                message: 'Bed allocated successfully'
            });
        } catch (error) {
            if (error.message === 'Bed not found' || error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error allocating bed', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Vacate bed
     * PUT /api/v1/reception/beds/:id/vacate
     * 
     * BUSINESS RULE: [BR-24] Status transition
     */
    async vacateBed(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                discharge_notes,
                next_status = 'cleaning' // Default to cleaning [BR-24]
            } = req.body;

            const bed = await bedService.getBedById(req.user.id, id);
            
            if (!bed) {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }

            if (bed.status !== 'occupied') {
                return res.status(400).json({
                    success: false,
                    error: 'Bed is not occupied'
                });
            }

            const vacated = await bedService.vacateBed(
                req.user.id,
                id,
                {
                    discharge_notes,
                    next_status,
                    vacated_at: new Date(),
                    vacated_by: req.user.id
                }
            );

            logger.info('Receptionist vacated bed', {
                receptionistId: req.user.id,
                bedId: id,
                patientId: bed.current_patient_id,
                nextStatus: next_status
            });

            res.json({
                success: true,
                data: vacated,
                message: `Bed vacated and marked for ${next_status}`
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error vacating bed', {
                error: error.message,
                receptionistId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BED OCCUPANCY REPORTS
    // ============================================

    /**
     * Get bed occupancy report
     * GET /api/v1/reception/beds/occupancy
     */
    async getOccupancyReport(req, res, next) {
        try {
            const { 
                ward,
                from_date,
                to_date,
                format = 'json'
            } = req.query;

            const report = await bedService.getOccupancyReport(
                req.user.id,
                { ward, from_date, to_date }
            );

            logger.info('Receptionist generated bed occupancy report', {
                receptionistId: req.user.id,
                ward: ward || 'all'
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=bed-occupancy-${Date.now()}.pdf`);
                return res.send(report);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=bed-occupancy-${Date.now()}.csv`);
                return res.send(report);
            }

            res.json({
                success: true,
                data: report,
                summary: {
                    total_beds: report.summary?.total_beds || 0,
                    occupied: report.summary?.occupied || 0,
                    available: report.summary?.available || 0,
                    occupancy_rate: report.summary?.occupancy_rate || 0,
                    average_stay: report.summary?.average_stay || 0
                }
            });
        } catch (error) {
            logger.error('Error generating occupancy report', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get ward-wise occupancy
     * GET /api/v1/reception/beds/occupancy/ward-wise
     */
    async getWardWiseOccupancy(req, res, next) {
        try {
            const occupancy = await bedService.getWardWiseOccupancy(req.user.id);

            res.json({
                success: true,
                data: occupancy
            });
        } catch (error) {
            logger.error('Error getting ward-wise occupancy', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get bed occupancy trends
     * GET /api/v1/reception/beds/occupancy/trends
     */
    async getOccupancyTrends(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const trends = await bedService.getOccupancyTrends(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting occupancy trends', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BED STATISTICS
    // ============================================

    /**
     * Get bed statistics
     * GET /api/v1/reception/beds/statistics
     */
    async getBedStatistics(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await bedService.getBedStatistics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting bed statistics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get bed turnover rate
     * GET /api/v1/reception/beds/turnover-rate
     */
    async getBedTurnoverRate(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const turnover = await bedService.getBedTurnoverRate(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: turnover,
                summary: {
                    turnover_rate: turnover.rate,
                    average_stay: turnover.avg_stay,
                    admissions: turnover.admissions,
                    discharges: turnover.discharges
                }
            });
        } catch (error) {
            logger.error('Error getting bed turnover rate', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BED MAINTENANCE REQUESTS
    // ============================================

    /**
     * Request bed maintenance
     * POST /api/v1/reception/beds/:id/request-maintenance
     */
    async requestMaintenance(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                reason,
                issue_type,
                priority,
                description
            } = req.body;

            if (!reason || !issue_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Reason and issue type are required'
                });
            }

            const bed = await bedService.getBedById(req.user.id, id);
            
            if (!bed) {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }

            const request = await bedService.requestMaintenance(
                req.user.id,
                id,
                {
                    reason,
                    issue_type,
                    priority: priority || 'medium',
                    description,
                    requested_by: req.user.id,
                    requested_at: new Date()
                }
            );

            logger.info('Receptionist requested bed maintenance', {
                receptionistId: req.user.id,
                bedId: id,
                issueType: issue_type,
                priority
            });

            res.json({
                success: true,
                data: request,
                message: 'Maintenance request submitted'
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error requesting maintenance', {
                error: error.message,
                receptionistId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get maintenance requests
     * GET /api/v1/reception/beds/maintenance-requests
     */
    async getMaintenanceRequests(req, res, next) {
        try {
            const { status, page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status
            };

            const requests = await bedService.getMaintenanceRequests(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: requests.data,
                pagination: requests.pagination
            });
        } catch (error) {
            logger.error('Error getting maintenance requests', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BED HISTORY
    // ============================================

    /**
     * Get bed allocation history
     * GET /api/v1/reception/beds/:id/history
     */
    async getBedHistory(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const history = await bedService.getBedHistory(
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
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error getting bed history', {
                error: error.message,
                receptionistId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient bed history
     * GET /api/v1/reception/beds/patient/:patientId/history
     */
    async getPatientBedHistory(req, res, next) {
        try {
            const { patientId } = req.params;

            const history = await bedService.getPatientBedHistory(
                req.user.id,
                patientId
            );

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            logger.error('Error getting patient bed history', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.patientId
            });
            next(error);
        }
    },

    // ============================================
    // BED AVAILABILITY ALERTS
    // ============================================

    /**
     * Get bed availability alerts
     * GET /api/v1/reception/beds/alerts
     */
    async getBedAlerts(req, res, next) {
        try {
            const alerts = await bedService.getBedAlerts(req.user.id);

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    low_availability: alerts.filter(a => a.type === 'low_availability').length,
                    maintenance_due: alerts.filter(a => a.type === 'maintenance_due').length,
                    cleaning_due: alerts.filter(a => a.type === 'cleaning_due').length
                }
            });
        } catch (error) {
            logger.error('Error getting bed alerts', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Set bed availability notification
     * POST /api/v1/reception/beds/notifications
     */
    async setBedNotification(req, res, next) {
        try {
            const { 
                bed_type,
                ward,
                notification_email,
                notify_when_available 
            } = req.body;

            const notification = await bedService.setBedNotification(
                req.user.id,
                {
                    bed_type,
                    ward,
                    notification_email,
                    notify_when_available,
                    created_at: new Date()
                }
            );

            res.status(201).json({
                success: true,
                data: notification,
                message: 'Notification set successfully'
            });
        } catch (error) {
            logger.error('Error setting bed notification', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = bedController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Bed Lists              | 5         | All, available, by ward, by type, by ID
 * Bed Allocation         | 2         | Allocate, vacate
 * Occupancy Reports      | 3         | Occupancy report, ward-wise, trends
 * Bed Statistics         | 2         | Statistics, turnover rate
 * Maintenance            | 2         | Request maintenance, get requests
 * Bed History            | 2         | Bed history, patient history
 * Alerts & Notifications | 2         | Get alerts, set notification
 * -----------------------|-----------|----------------------
 * TOTAL                  | 18        | Complete bed management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * 
 * ======================================================================
 */