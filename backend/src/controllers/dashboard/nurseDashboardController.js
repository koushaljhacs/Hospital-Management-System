/**
 * ======================================================================
 * FILE: backend/src/controllers/dashboard/nurseDashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse dashboard controller - Handles nurse dashboard data.
 * Total Endpoints: 6
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * ======================================================================
 */

const nurseDashboardService = require('../../services/dashboard/nurseDashboardService');
const logger = require('../../utils/logger');

const nurseDashboardController = {
    /**
     * Get nurse main dashboard
     * GET /api/v1/dashboard/nurse
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await nurseDashboardService.getDashboard(req.user.id);

            logger.info('Nurse viewed dashboard', {
                nurseId: req.user.id,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                data: dashboard,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error getting nurse dashboard', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get assigned patients
     * GET /api/v1/dashboard/nurse/patients
     */
    async getAssignedPatients(req, res, next) {
        try {
            const { page = 1, limit = 20, status } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status
            };

            const patients = await nurseDashboardService.getAssignedPatients(
                req.user.id,
                options
            );

            logger.info('Nurse viewed assigned patients', {
                nurseId: req.user.id,
                count: patients.data?.length || 0
            });

            // Group by ward
            const byWard = patients.data?.reduce((acc, p) => {
                const ward = p.ward || 'Unassigned';
                if (!acc[ward]) {
                    acc[ward] = 0;
                }
                acc[ward]++;
                return acc;
            }, {});

            res.json({
                success: true,
                data: patients.data,
                pagination: patients.pagination,
                summary: {
                    total: patients.summary?.total || 0,
                    critical: patients.data?.filter(p => p.critical_status).length || 0,
                    by_ward: byWard
                }
            });
        } catch (error) {
            logger.error('Error getting nurse assigned patients', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending tasks
     * GET /api/v1/dashboard/nurse/tasks
     */
    async getPendingTasks(req, res, next) {
        try {
            const { page = 1, limit = 20, priority } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                priority
            };

            const tasks = await nurseDashboardService.getPendingTasks(
                req.user.id,
                options
            );

            logger.info('Nurse viewed pending tasks', {
                nurseId: req.user.id,
                count: tasks.data?.length || 0
            });

            // Calculate urgency distribution
            const byPriority = {
                urgent: tasks.data?.filter(t => t.priority === 'urgent').length || 0,
                high: tasks.data?.filter(t => t.priority === 'high').length || 0,
                medium: tasks.data?.filter(t => t.priority === 'medium').length || 0,
                low: tasks.data?.filter(t => t.priority === 'low').length || 0
            };

            // Check overdue tasks (created > 30 mins ago)
            const overdueTasks = tasks.data?.filter(t => {
                if (t.created_at && t.status === 'pending') {
                    const created = new Date(t.created_at);
                    const minutesSince = (Date.now() - created) / (1000 * 60);
                    return minutesSince > 30;
                }
                return false;
            }).length || 0;

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    by_priority: byPriority,
                    overdue: overdueTasks,
                    estimated_time_minutes: tasks.data?.length * 15
                }
            });
        } catch (error) {
            logger.error('Error getting nurse pending tasks', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get recent vitals
     * GET /api/v1/dashboard/nurse/vitals
     */
    async getRecentVitals(req, res, next) {
        try {
            const { page = 1, limit = 20, patient_id } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id
            };

            const vitals = await nurseDashboardService.getRecentVitals(
                req.user.id,
                options
            );

            logger.info('Nurse viewed recent vitals', {
                nurseId: req.user.id,
                count: vitals.data?.length || 0
            });

            // Identify abnormal vitals
            const abnormalVitals = vitals.data?.filter(v => {
                return (v.blood_pressure_systolic > 140 || v.blood_pressure_systolic < 90) ||
                       (v.heart_rate > 100 || v.heart_rate < 60) ||
                       (v.temperature > 100.4 || v.temperature < 97.7) ||
                       (v.respiratory_rate > 20 || v.respiratory_rate < 12) ||
                       (v.oxygen_saturation < 95);
            }).length || 0;

            res.json({
                success: true,
                data: vitals.data,
                pagination: vitals.pagination,
                summary: {
                    total: vitals.summary?.total || 0,
                    abnormal: abnormalVitals,
                    critical: vitals.data?.filter(v => v.critical_flag).length || 0,
                    last_recorded: vitals.data?.[0]?.recorded_at || null
                }
            });
        } catch (error) {
            logger.error('Error getting nurse recent vitals', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get medication schedules
     * GET /api/v1/dashboard/nurse/medications
     */
    async getMedicationSchedules(req, res, next) {
        try {
            const { page = 1, limit = 20, time = 'all' } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                time
            };

            const medications = await nurseDashboardService.getMedicationSchedules(
                req.user.id,
                options
            );

            logger.info('Nurse viewed medication schedules', {
                nurseId: req.user.id,
                count: medications.data?.length || 0
            });

            // Group by time of day
            const byTimeSlot = {
                morning: medications.data?.filter(m => m.scheduled_time < '12:00').length || 0,
                afternoon: medications.data?.filter(m => m.scheduled_time >= '12:00' && m.scheduled_time < '17:00').length || 0,
                evening: medications.data?.filter(m => m.scheduled_time >= '17:00').length || 0
            };

            res.json({
                success: true,
                data: medications.data,
                pagination: medications.pagination,
                summary: {
                    total: medications.summary?.total || 0,
                    due_now: medications.data?.filter(m => {
                        const now = new Date();
                        const scheduled = new Date(m.scheduled_time);
                        const diffMinutes = (now - scheduled) / (1000 * 60);
                        return Math.abs(diffMinutes) <= 30;
                    }).length || 0,
                    by_time_slot: byTimeSlot
                }
            });
        } catch (error) {
            logger.error('Error getting nurse medication schedules', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get bed occupancy
     * GET /api/v1/dashboard/nurse/beds
     */
    async getBedOccupancy(req, res, next) {
        try {
            const occupancy = await nurseDashboardService.getBedOccupancy(req.user.id);

            logger.info('Nurse viewed bed occupancy', {
                nurseId: req.user.id,
                totalBeds: occupancy.total_beds
            });

            res.json({
                success: true,
                data: occupancy,
                summary: {
                    total_beds: occupancy.total_beds,
                    occupied: occupancy.occupied,
                    available: occupancy.available,
                    cleaning: occupancy.cleaning,
                    maintenance: occupancy.maintenance,
                    occupancy_rate: occupancy.total_beds > 0 
                        ? ((occupancy.occupied / occupancy.total_beds) * 100).toFixed(1)
                        : 0,
                    by_ward: occupancy.by_ward
                }
            });
        } catch (error) {
            logger.error('Error getting nurse bed occupancy', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = nurseDashboardController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Main Dashboard         | 1         | Complete nurse dashboard
 * Patient Management     | 1         | Assigned patients
 * Task Management        | 1         | Pending tasks
 * Vital Signs            | 1         | Recent vitals
 * Medication             | 1         | Medication schedules
 * Bed Management         | 1         | Bed occupancy
 * -----------------------|-----------|----------------------
 * TOTAL                  | 6         | Complete nurse dashboard management
 * 
 * ======================================================================
 */