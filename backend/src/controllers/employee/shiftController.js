/**
 * ======================================================================
 * FILE: backend/src/controllers/employee/shiftController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee shift controller - Handles shift management.
 * Total Endpoints: 5
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-53] Shift change requires 24 hours notice
 * 
 * ======================================================================
 */

const shiftService = require('../../services/employee/shiftService');
const logger = require('../../utils/logger');

const shiftController = {
    // ============================================
    // SHIFT LISTS
    // ============================================

    /**
     * Get my shifts
     * GET /api/v1/employee/shifts
     */
    async getMyShifts(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const shifts = await shiftService.getEmployeeShifts(
                req.user.id,
                options
            );

            logger.info('Employee viewed shifts', {
                employeeId: req.user.id,
                count: shifts.data?.length || 0
            });

            res.json({
                success: true,
                data: shifts.data,
                pagination: shifts.pagination,
                summary: shifts.summary
            });
        } catch (error) {
            logger.error('Error getting employee shifts', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get current shift
     * GET /api/v1/employee/shifts/current
     */
    async getCurrentShift(req, res, next) {
        try {
            const shift = await shiftService.getCurrentShift(req.user.id);

            logger.info('Employee viewed current shift', {
                employeeId: req.user.id,
                hasShift: !!shift
            });

            res.json({
                success: true,
                data: shift || null,
                message: shift ? 'Current shift found' : 'No active shift'
            });
        } catch (error) {
            logger.error('Error getting current shift', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get upcoming shifts
     * GET /api/v1/employee/shifts/upcoming
     */
    async getUpcomingShifts(req, res, next) {
        try {
            const { days = 7, page = 1, limit = 20 } = req.query;

            const options = {
                days: parseInt(days),
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const shifts = await shiftService.getUpcomingShifts(
                req.user.id,
                options
            );

            logger.info('Employee viewed upcoming shifts', {
                employeeId: req.user.id,
                days: parseInt(days),
                count: shifts.data?.length || 0
            });

            res.json({
                success: true,
                data: shifts.data,
                pagination: shifts.pagination,
                summary: shifts.summary
            });
        } catch (error) {
            logger.error('Error getting upcoming shifts', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get shift history
     * GET /api/v1/employee/shifts/history
     */
    async getShiftHistory(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const history = await shiftService.getShiftHistory(
                req.user.id,
                options
            );

            logger.info('Employee viewed shift history', {
                employeeId: req.user.id,
                count: history.data?.length || 0
            });

            res.json({
                success: true,
                data: history.data,
                pagination: history.pagination,
                summary: history.summary
            });
        } catch (error) {
            logger.error('Error getting shift history', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get shift calendar
     * GET /api/v1/employee/shifts/calendar
     */
    async getShiftCalendar(req, res, next) {
        try {
            const { month, year } = req.query;

            let targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
            let targetYear = year ? parseInt(year) : new Date().getFullYear();

            const calendar = await shiftService.getShiftCalendar(
                req.user.id,
                { month: targetMonth, year: targetYear }
            );

            logger.info('Employee viewed shift calendar', {
                employeeId: req.user.id,
                month: targetMonth,
                year: targetYear
            });

            res.json({
                success: true,
                data: calendar
            });
        } catch (error) {
            logger.error('Error getting shift calendar', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // SHIFT OPERATIONS
    // ============================================

    /**
     * Request shift change
     * PUT /api/v1/employee/shifts/:id/change
     * 
     * BUSINESS RULE: [BR-53] Shift change requires 24 hours notice
     */
    async requestShiftChange(req, res, next) {
        try {
            const { id } = req.params;
            const { requested_shift_type, requested_date, reason } = req.body;

            if (!requested_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Requested date is required'
                });
            }

            // [BR-53] Check notice period
            const requestedDateTime = new Date(requested_date);
            const now = new Date();
            const hoursNotice = (requestedDateTime - now) / (1000 * 60 * 60);

            if (hoursNotice < 24) {
                return res.status(400).json({
                    success: false,
                    error: 'Shift change requires at least 24 hours notice',
                    hours_notice_available: Math.floor(hoursNotice),
                    hours_required: 24
                });
            }

            const shift = await shiftService.getShiftById(req.user.id, id);
            
            if (!shift) {
                return res.status(404).json({
                    success: false,
                    error: 'Shift not found'
                });
            }

            if (shift.employee_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only request changes for your own shifts'
                });
            }

            if (shift.status === 'completed') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot change completed shift'
                });
            }

            const changeRequest = await shiftService.requestShiftChange(
                req.user.id,
                id,
                {
                    requested_shift_type,
                    requested_date,
                    reason,
                    requested_at: new Date(),
                    requested_by: req.user.id
                }
            );

            logger.info('Employee requested shift change', {
                employeeId: req.user.id,
                shiftId: id,
                requestedDate: requested_date,
                requestedType: requested_shift_type
            });

            res.json({
                success: true,
                data: changeRequest,
                message: 'Shift change request submitted'
            });
        } catch (error) {
            if (error.message === 'Shift not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Shift not found'
                });
            }
            logger.error('Error requesting shift change', {
                error: error.message,
                employeeId: req.user.id,
                shiftId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = shiftController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Shift Lists            | 4         | My shifts, current, upcoming, history, calendar
 * Shift Operations       | 1         | Request shift change
 * -----------------------|-----------|----------------------
 * TOTAL                  | 5         | Complete shift management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-53] 24-hour notice period for shift changes
 * 
 * ======================================================================
 */