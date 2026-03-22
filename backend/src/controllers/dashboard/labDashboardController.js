/**
 * ======================================================================
 * FILE: backend/src/controllers/dashboard/labDashboardController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab dashboard controller - Handles laboratory dashboard data.
 * Total Endpoints: 4
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * - [BR-39] Sample collection to result < 24 hours
 * 
 * ======================================================================
 */

const labDashboardService = require('../../services/dashboard/labDashboardService');
const logger = require('../../utils/logger');

const labDashboardController = {
    /**
     * Get lab main dashboard
     * GET /api/v1/dashboard/lab
     */
    async getDashboard(req, res, next) {
        try {
            const dashboard = await labDashboardService.getDashboard(req.user.id);

            logger.info('Lab technician viewed dashboard', {
                technicianId: req.user.id,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                data: dashboard,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Error getting lab dashboard', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending tests
     * GET /api/v1/dashboard/lab/pending
     */
    async getPendingTests(req, res, next) {
        try {
            const { page = 1, limit = 20, priority = 'all' } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                priority
            };

            const tests = await labDashboardService.getPendingTests(
                req.user.id,
                options
            );

            logger.info('Lab technician viewed pending tests', {
                technicianId: req.user.id,
                count: tests.data?.length || 0
            });

            // Calculate overdue tests [BR-39] (pending > 24 hours)
            const now = new Date();
            const overdueTests = tests.data?.filter(t => {
                if (t.ordered_at) {
                    const orderedAt = new Date(t.ordered_at);
                    const hoursSince = (now - orderedAt) / (1000 * 60 * 60);
                    return hoursSince > 24;
                }
                return false;
            }).length || 0;

            // Group by test type
            const byTestType = tests.data?.reduce((acc, t) => {
                const type = t.test_type || 'Other';
                if (!acc[type]) {
                    acc[type] = 0;
                }
                acc[type]++;
                return acc;
            }, {});

            // Group by priority
            const byPriority = {
                stat: tests.data?.filter(t => t.priority === 'stat').length || 0,
                urgent: tests.data?.filter(t => t.priority === 'urgent').length || 0,
                routine: tests.data?.filter(t => t.priority === 'routine').length || 0
            };

            res.json({
                success: true,
                data: tests.data,
                pagination: tests.pagination,
                summary: {
                    total: tests.summary?.total || 0,
                    overdue: overdueTests,
                    by_priority: byPriority,
                    by_test_type: byTestType,
                    estimated_processing_time: tests.data?.length * 30 // 30 minutes per test
                }
            });
        } catch (error) {
            logger.error('Error getting lab pending tests', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get critical values
     * GET /api/v1/dashboard/lab/critical
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getCriticalValues(req, res, next) {
        try {
            const { page = 1, limit = 20, acknowledged = false } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                acknowledged: acknowledged === 'true'
            };

            const criticalValues = await labDashboardService.getCriticalValues(
                req.user.id,
                options
            );

            logger.info('Lab technician viewed critical values', {
                technicianId: req.user.id,
                count: criticalValues.data?.length || 0,
                unacknowledgedCount: criticalValues.data?.filter(v => !v.acknowledged).length || 0
            });

            // [BR-36] Check for unacknowledged critical values
            const unacknowledged = criticalValues.data?.filter(v => !v.acknowledged).length || 0;

            // Group by department
            const byDepartment = criticalValues.data?.reduce((acc, v) => {
                const dept = v.department || 'Unknown';
                if (!acc[dept]) {
                    acc[dept] = 0;
                }
                acc[dept]++;
                return acc;
            }, {});

            res.json({
                success: true,
                data: criticalValues.data,
                pagination: criticalValues.pagination,
                summary: {
                    total: criticalValues.summary?.total || 0,
                    unacknowledged: unacknowledged,
                    by_department: byDepartment,
                    most_common_test: criticalValues.data?.[0]?.test_name || null,
                    requires_immediate_action: unacknowledged > 0
                }
            });
        } catch (error) {
            logger.error('Error getting lab critical values', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get equipment status
     * GET /api/v1/dashboard/lab/equipment
     */
    async getEquipmentStatus(req, res, next) {
        try {
            const equipment = await labDashboardService.getEquipmentStatus(req.user.id);

            logger.info('Lab technician viewed equipment status', {
                technicianId: req.user.id,
                totalEquipment: equipment.total
            });

            // Calculate calibration due equipment
            const calibrationDue = equipment.data?.filter(e => {
                if (e.next_calibration) {
                    const daysUntil = (new Date(e.next_calibration) - new Date()) / (1000 * 60 * 60 * 24);
                    return daysUntil <= 30 && daysUntil > 0;
                }
                return false;
            }).length || 0;

            // Equipment needing immediate attention
            const immediateAttention = equipment.data?.filter(e => 
                e.status === 'maintenance' || 
                e.status === 'out_of_service' ||
                (e.next_calibration && new Date(e.next_calibration) < new Date())
            ).length || 0;

            res.json({
                success: true,
                data: equipment.data,
                pagination: equipment.pagination,
                summary: {
                    total: equipment.total,
                    operational: equipment.operational,
                    maintenance: equipment.maintenance,
                    calibration_due: calibrationDue,
                    out_of_service: equipment.out_of_service,
                    immediate_attention: immediateAttention,
                    by_type: equipment.by_type
                }
            });
        } catch (error) {
            logger.error('Error getting lab equipment status', {
                error: error.message,
                technicianId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = labDashboardController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Main Dashboard         | 1         | Complete lab dashboard
 * Test Management        | 1         | Pending tests
 * Critical Values        | 1         | Critical test results [BR-36]
 * Equipment Management   | 1         | Equipment status
 * -----------------------|-----------|----------------------
 * TOTAL                  | 4         | Complete lab dashboard management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical values tracking
 * - [BR-39] Overdue test detection (>24 hours)
 * 
 * ======================================================================
 */