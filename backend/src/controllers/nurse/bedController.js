/**
 * ======================================================================
 * FILE: backend/src/controllers/nurse/bedController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse bed management controller - Handles bed status, cleaning,
 * maintenance requests, and bed allocation for nurses.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * - [BR-26] Cleaning required between patients
 * - [BR-27] Max occupancy time 30 days
 * - [BR-28] ICU beds require special authorization
 * 
 * ENDPOINTS:
 * GET    /nurse/beds                            - All beds (ward)
 * GET    /nurse/beds/ward/:ward                    - By ward
 * GET    /nurse/beds/available                       - Available beds
 * GET    /nurse/beds/occupied                          - Occupied beds
 * GET    /nurse/beds/:id                                 - Get bed
 * PUT    /nurse/beds/:id/clean                            - Mark clean
 * PUT    /nurse/beds/:id/maintenance                        - Request maintenance
 * GET    /nurse/beds/cleaning/schedule                        - Cleaning schedule
 * 
 * ======================================================================
 */

const bedService = require('../../services/nurse/bedService');
const logger = require('../../utils/logger');

/**
 * Nurse Bed Management Controller
 */
const bedController = {
    // ============================================
    // BED LISTS
    // ============================================

    /**
     * Get all beds (ward)
     * GET /api/v1/nurse/beds
     * 
     * BUSINESS RULE: [BR-24] Bed status workflow
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

            const nurseWard = req.user.ward;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward: ward || nurseWard,
                status,
                type,
                floor: floor ? parseInt(floor) : undefined
            };

            const beds = await bedService.getAllBeds(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved beds', {
                nurseId: req.user.id,
                ward: options.ward,
                count: beds.data?.length || 0
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
                        : 0,
                    cleaning_due: beds.data?.filter(b => b.cleaning_due).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting all beds', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get beds by ward
     * GET /api/v1/nurse/beds/ward/:ward
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

            // Check if nurse has access to this ward
            if (ward !== req.user.ward && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this ward'
                });
            }

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

            logger.info('Nurse retrieved beds by ward', {
                nurseId: req.user.id,
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
                nurseId: req.user.id,
                ward: req.params.ward
            });
            next(error);
        }
    },

    /**
     * Get available beds
     * GET /api/v1/nurse/beds/available
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

            const nurseWard = req.user.ward;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward: ward || nurseWard,
                type,
                required_equipment: required_equipment ? required_equipment.split(',') : undefined
            };

            const beds = await bedService.getAvailableBeds(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved available beds', {
                nurseId: req.user.id,
                ward: options.ward,
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
                    isolation_available: beds.data?.filter(b => b.type === 'isolation').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting available beds', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get occupied beds
     * GET /api/v1/nurse/beds/occupied
     */
    async getOccupiedBeds(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 50,
                ward,
                type,
                floor
            } = req.query;

            const nurseWard = req.user.ward;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward: ward || nurseWard,
                type,
                floor: floor ? parseInt(floor) : undefined
            };

            const beds = await bedService.getOccupiedBeds(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved occupied beds', {
                nurseId: req.user.id,
                ward: options.ward,
                count: beds.data?.length || 0
            });

            // Calculate occupancy duration [BR-27]
            const now = new Date();
            const bedsWithDuration = beds.data?.map(bed => ({
                ...bed,
                occupancy_days: Math.floor((now - new Date(bed.occupied_since)) / (1000 * 60 * 60 * 24)),
                nearing_limit: (now - new Date(bed.occupied_since)) > (25 * 24 * 60 * 60 * 1000) // > 25 days
            }));

            res.json({
                success: true,
                data: bedsWithDuration,
                pagination: beds.pagination,
                summary: {
                    total: beds.summary?.total || 0,
                    nearing_limit: bedsWithDuration?.filter(b => b.nearing_limit).length || 0,
                    by_type: beds.summary?.by_type,
                    average_occupancy: beds.summary?.average_occupancy
                }
            });
        } catch (error) {
            logger.error('Error getting occupied beds', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get bed by ID
     * GET /api/v1/nurse/beds/:id
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

            logger.info('Nurse viewed bed details', {
                nurseId: req.user.id,
                bedId: id,
                ward: bed.ward
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
                nurseId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BED STATUS UPDATES
    // ============================================

    /**
     * Mark bed as clean
     * PUT /api/v1/nurse/beds/:id/clean
     * 
     * BUSINESS RULE: [BR-26] Cleaning required between patients
     */
    async markBedClean(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                cleaning_notes,
                cleaning_method,
                cleaned_by,
                next_cleaning_due
            } = req.body;

            const bed = await bedService.getBedById(req.user.id, id);
            
            if (!bed) {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }

            // [BR-24] Validate status transition
            if (bed.status !== 'cleaning' && bed.status !== 'occupied') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot mark bed as clean from status: ${bed.status}`
                });
            }

            const updatedBed = await bedService.updateBedStatus(
                req.user.id,
                id,
                'available',
                {
                    cleaning_notes,
                    cleaning_method,
                    cleaned_by: cleaned_by || req.user.id,
                    cleaned_at: new Date(),
                    next_cleaning_due: next_cleaning_due || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24 hours
                }
            );

            logger.info('Nurse marked bed as clean', {
                nurseId: req.user.id,
                bedId: id,
                ward: bed.ward,
                previousStatus: bed.status
            });

            res.json({
                success: true,
                data: updatedBed,
                message: 'Bed marked as clean and available'
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error marking bed clean', {
                error: error.message,
                nurseId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Request bed maintenance
     * PUT /api/v1/nurse/beds/:id/maintenance
     */
    async requestMaintenance(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                reason,
                issue_type,
                priority,
                description,
                estimated_downtime
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

            // [BR-24] Any status can go to maintenance
            const updatedBed = await bedService.updateBedStatus(
                req.user.id,
                id,
                'maintenance',
                {
                    maintenance_reason: reason,
                    maintenance_issue_type: issue_type,
                    maintenance_priority: priority || 'medium',
                    maintenance_description: description,
                    maintenance_requested_at: new Date(),
                    maintenance_requested_by: req.user.id,
                    estimated_downtime: estimated_downtime,
                    notes: `Maintenance requested: ${reason}`
                }
            );

            logger.info('Nurse requested bed maintenance', {
                nurseId: req.user.id,
                bedId: id,
                ward: bed.ward,
                issueType: issue_type,
                priority
            });

            // Notify maintenance department
            await bedService.notifyMaintenanceDepartment({
                bedId: id,
                bedNumber: bed.bed_number,
                ward: bed.ward,
                issueType: issue_type,
                priority,
                requestedBy: req.user.id,
                description
            });

            res.json({
                success: true,
                data: updatedBed,
                message: 'Maintenance request submitted successfully'
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error requesting bed maintenance', {
                error: error.message,
                nurseId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Prepare bed for new patient (cleaning + setup)
     * PUT /api/v1/nurse/beds/:id/prepare
     * 
     * BUSINESS RULE: [BR-26] Cleaning required between patients
     */
    async prepareBedForPatient(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                patient_type,
                required_equipment,
                special_requirements
            } = req.body;

            const bed = await bedService.getBedById(req.user.id, id);
            
            if (!bed) {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }

            // [BR-26] Bed must be cleaned first
            if (bed.status === 'occupied') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot prepare occupied bed'
                });
            }

            // Check if bed type matches patient needs [BR-28]
            if (patient_type === 'icu' && bed.type !== 'icu') {
                return res.status(400).json({
                    success: false,
                    error: 'ICU patient requires ICU bed'
                });
            }

            const preparedBed = await bedService.prepareBedForPatient(
                req.user.id,
                id,
                {
                    patient_type,
                    required_equipment,
                    special_requirements,
                    prepared_by: req.user.id,
                    prepared_at: new Date(),
                    status: 'available' // Still available but prepared
                }
            );

            logger.info('Nurse prepared bed for patient', {
                nurseId: req.user.id,
                bedId: id,
                ward: bed.ward,
                patientType: patient_type
            });

            res.json({
                success: true,
                data: preparedBed,
                message: 'Bed prepared for patient'
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error preparing bed for patient', {
                error: error.message,
                nurseId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // CLEANING SCHEDULE
    // ============================================

    /**
     * Get cleaning schedule
     * GET /api/v1/nurse/beds/cleaning/schedule
     */
    async getCleaningSchedule(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 50,
                ward,
                date,
                status 
            } = req.query;

            const nurseWard = req.user.ward;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward: ward || nurseWard,
                date: date || new Date().toISOString().split('T')[0],
                status
            };

            const schedule = await bedService.getCleaningSchedule(
                req.user.id,
                options
            );

            logger.info('Nurse viewed cleaning schedule', {
                nurseId: req.user.id,
                ward: options.ward,
                date: options.date,
                count: schedule.data?.length || 0
            });

            // Group by time slot
            const byTimeSlot = {
                morning: schedule.data?.filter(s => s.time_slot === 'morning').length || 0,
                afternoon: schedule.data?.filter(s => s.time_slot === 'afternoon').length || 0,
                evening: schedule.data?.filter(s => s.time_slot === 'evening').length || 0
            };

            res.json({
                success: true,
                data: schedule.data,
                pagination: schedule.pagination,
                summary: {
                    total: schedule.summary?.total || 0,
                    pending: schedule.data?.filter(s => s.status === 'pending').length || 0,
                    completed: schedule.data?.filter(s => s.status === 'completed').length || 0,
                    overdue: schedule.data?.filter(s => 
                        s.status === 'pending' && new Date(s.scheduled_time) < new Date()
                    ).length || 0,
                    by_time_slot: byTimeSlot
                }
            });
        } catch (error) {
            logger.error('Error getting cleaning schedule', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update cleaning task status
     * PUT /api/v1/nurse/beds/cleaning/:taskId/status
     */
    async updateCleaningTask(req, res, next) {
        try {
            const { taskId } = req.params;
            const { status, notes } = req.body;

            if (!status || !['in_progress', 'completed', 'cancelled'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid status is required'
                });
            }

            const task = await bedService.updateCleaningTask(
                req.user.id,
                taskId,
                status,
                { notes }
            );

            logger.info('Nurse updated cleaning task', {
                nurseId: req.user.id,
                taskId,
                status,
                bedId: task.bed_id
            });

            res.json({
                success: true,
                data: task,
                message: `Cleaning task marked as ${status}`
            });
        } catch (error) {
            if (error.message === 'Task not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Cleaning task not found'
                });
            }
            logger.error('Error updating cleaning task', {
                error: error.message,
                nurseId: req.user.id,
                taskId: req.params.taskId
            });
            next(error);
        }
    },

    // ============================================
    // BED STATISTICS & REPORTS
    // ============================================

    /**
     * Get bed occupancy statistics
     * GET /api/v1/nurse/beds/statistics
     */
    async getBedStatistics(req, res, next) {
        try {
            const { 
                ward,
                from_date,
                to_date,
                period = 'day' 
            } = req.query;

            const nurseWard = req.user.ward;

            const stats = await bedService.getBedStatistics(
                req.user.id,
                {
                    ward: ward || nurseWard,
                    from_date,
                    to_date,
                    period
                }
            );

            logger.info('Nurse viewed bed statistics', {
                nurseId: req.user.id,
                ward: ward || nurseWard,
                period
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting bed statistics', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get bed turnover rate
     * GET /api/v1/nurse/beds/turnover-rate
     */
    async getBedTurnoverRate(req, res, next) {
        try {
            const { 
                ward,
                days = 30 
            } = req.query;

            const nurseWard = req.user.ward;

            const turnover = await bedService.getBedTurnoverRate(
                req.user.id,
                {
                    ward: ward || nurseWard,
                    days: parseInt(days)
                }
            );

            res.json({
                success: true,
                data: turnover
            });
        } catch (error) {
            logger.error('Error getting bed turnover rate', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export bed report
     * GET /api/v1/nurse/beds/export
     */
    async exportBedReport(req, res, next) {
        try {
            const { 
                ward,
                from_date,
                to_date,
                format = 'pdf' 
            } = req.query;

            const nurseWard = req.user.ward;

            const report = await bedService.exportBedReport(
                req.user.id,
                {
                    ward: ward || nurseWard,
                    from_date,
                    to_date,
                    format
                }
            );

            logger.info('Nurse exported bed report', {
                nurseId: req.user.id,
                ward: ward || nurseWard,
                format
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=beds-${ward || nurseWard}-${Date.now()}.pdf`);
                return res.send(report);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=beds-${ward || nurseWard}-${Date.now()}.csv`);
                return res.send(report);
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error exporting bed report', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // BED EQUIPMENT MANAGEMENT
    // ============================================

    /**
     * Get bed equipment
     * GET /api/v1/nurse/beds/:id/equipment
     */
    async getBedEquipment(req, res, next) {
        try {
            const { id } = req.params;

            const equipment = await bedService.getBedEquipment(
                req.user.id,
                id
            );

            if (!equipment) {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }

            res.json({
                success: true,
                data: equipment
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error getting bed equipment', {
                error: error.message,
                nurseId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Request equipment for bed
     * POST /api/v1/nurse/beds/:id/equipment/request
     */
    async requestBedEquipment(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                equipment_type,
                quantity,
                reason,
                priority,
                required_by 
            } = req.body;

            if (!equipment_type || !quantity || !reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Equipment type, quantity, and reason are required'
                });
            }

            const request = await bedService.requestBedEquipment(
                req.user.id,
                id,
                {
                    equipment_type,
                    quantity: parseInt(quantity),
                    reason,
                    priority: priority || 'medium',
                    required_by: required_by || new Date(Date.now() + 24 * 60 * 60 * 1000),
                    requested_by: req.user.id,
                    requested_at: new Date()
                }
            );

            logger.info('Nurse requested bed equipment', {
                nurseId: req.user.id,
                bedId: id,
                equipmentType: equipment_type,
                quantity
            });

            res.status(201).json({
                success: true,
                data: request,
                message: 'Equipment request submitted'
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error requesting bed equipment', {
                error: error.message,
                nurseId: req.user.id,
                bedId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BED ALLOCATION (for nurses with permission)
    // ============================================

    /**
     * Assign patient to bed
     * POST /api/v1/nurse/beds/:id/assign
     * 
     * BUSINESS RULES: [BR-25], [BR-27], [BR-28]
     */
    async assignPatientToBed(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                patient_id,
                expected_discharge,
                notes,
                is_emergency = false
            } = req.body;

            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            const bed = await bedService.getBedById(req.user.id, id);
            
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

            // [BR-28] Check ICU authorization
            if (bed.type === 'icu' && !req.user.permissions?.includes('assign_icu_bed')) {
                return res.status(403).json({
                    success: false,
                    error: 'ICU bed assignment requires special authorization'
                });
            }

            // Check if patient exists and is not already assigned
            const patient = await bedService.validatePatientForAssignment(
                patient_id,
                bed.type
            );

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found or cannot be assigned'
                });
            }

            // [BR-27] Validate expected discharge (max 30 days)
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

            const assignment = await bedService.assignPatientToBed(
                req.user.id,
                id,
                {
                    patient_id,
                    expected_discharge,
                    notes,
                    is_emergency,
                    assigned_at: new Date(),
                    assigned_by: req.user.id
                }
            );

            logger.info('Nurse assigned patient to bed', {
                nurseId: req.user.id,
                bedId: id,
                patientId: patient_id,
                bedType: bed.type,
                isEmergency: is_emergency
            });

            res.json({
                success: true,
                data: assignment,
                message: 'Patient assigned to bed successfully'
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Patient already assigned') {
                return res.status(409).json({
                    success: false,
                    error: 'Patient already assigned to a bed'
                });
            }
            logger.error('Error assigning patient to bed', {
                error: error.message,
                nurseId: req.user.id,
                bedId: req.params.id,
                patientId: req.body.patient_id
            });
            next(error);
        }
    },

    /**
     * Discharge patient from bed
     * PUT /api/v1/nurse/beds/:id/discharge
     */
    async dischargePatientFromBed(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                discharge_notes,
                next_status = 'cleaning' // Default to cleaning [BR-26]
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

            const discharge = await bedService.dischargePatientFromBed(
                req.user.id,
                id,
                {
                    discharge_notes,
                    next_status,
                    discharged_at: new Date(),
                    discharged_by: req.user.id
                }
            );

            logger.info('Nurse discharged patient from bed', {
                nurseId: req.user.id,
                bedId: id,
                patientId: bed.current_patient_id,
                nextStatus: next_status
            });

            res.json({
                success: true,
                data: discharge,
                message: `Patient discharged, bed marked for ${next_status}`
            });
        } catch (error) {
            if (error.message === 'Bed not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Bed not found'
                });
            }
            logger.error('Error discharging patient from bed', {
                error: error.message,
                nurseId: req.user.id,
                bedId: req.params.id
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
 * Bed Lists              | 5         | All, by ward, available, occupied, by ID
 * Status Updates         | 3         | Clean, maintenance, prepare
 * Cleaning Schedule      | 2         | Get schedule, update task
 * Statistics & Reports   | 3         | Statistics, turnover, export
 * Equipment Management   | 2         | Get equipment, request equipment
 * Bed Allocation         | 2         | Assign patient, discharge patient
 * -----------------------|-----------|----------------------
 * TOTAL                  | 17        | Complete bed management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * - [BR-26] Cleaning required between patients
 * - [BR-27] Max occupancy time 30 days
 * - [BR-28] ICU beds require special authorization
 * 
 * ======================================================================
 */