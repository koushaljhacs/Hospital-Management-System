/**
 * ======================================================================
 * FILE: backend/src/controllers/employee/attendanceController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee attendance controller - Handles attendance management.
 * Total Endpoints: 6
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-54] Attendance check-in must be within 15 minutes of shift start
 * 
 * ======================================================================
 */

const attendanceService = require('../../services/employee/attendanceService');
const logger = require('../../utils/logger');

const attendanceController = {
    // ============================================
    // ATTENDANCE OPERATIONS
    // ============================================

    /**
     * Check in
     * POST /api/v1/employee/attendance/check-in
     * 
     * BUSINESS RULE: [BR-54] Check-in within 15 minutes of shift start
     */
    async checkIn(req, res, next) {
        try {
            const { location, device_info, notes } = req.body;

            // Get current shift
            const currentShift = await attendanceService.getCurrentShift(req.user.id);
            
            if (!currentShift) {
                return res.status(400).json({
                    success: false,
                    error: 'No active shift found for check-in'
                });
            }

            // Check if already checked in
            const existingAttendance = await attendanceService.getTodayAttendance(req.user.id);
            
            if (existingAttendance && existingAttendance.check_in_time) {
                return res.status(409).json({
                    success: false,
                    error: 'Already checked in today',
                    check_in_time: existingAttendance.check_in_time
                });
            }

            // [BR-54] Check if within grace period
            const shiftStart = new Date(currentShift.start_time);
            const now = new Date();
            const minutesLate = (now - shiftStart) / (1000 * 60);
            const gracePeriod = 15; // minutes

            let status = 'present';
            if (minutesLate > gracePeriod) {
                status = 'late';
                logger.warn('Employee checked in late', {
                    employeeId: req.user.id,
                    shiftId: currentShift.id,
                    minutesLate: Math.floor(minutesLate),
                    gracePeriod
                });
            }

            const attendance = await attendanceService.checkIn(
                req.user.id,
                {
                    shift_id: currentShift.id,
                    check_in_time: now,
                    check_in_location: location,
                    check_in_device: device_info,
                    status,
                    notes,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Employee checked in', {
                employeeId: req.user.id,
                shiftId: currentShift.id,
                status,
                minutesLate: minutesLate > 0 ? Math.floor(minutesLate) : 0
            });

            res.json({
                success: true,
                data: attendance,
                message: status === 'present' ? 'Checked in successfully' : 'Checked in late',
                status,
                minutes_late: minutesLate > 0 ? Math.floor(minutesLate) : 0
            });
        } catch (error) {
            logger.error('Error checking in', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Check out
     * POST /api/v1/employee/attendance/check-out
     */
    async checkOut(req, res, next) {
        try {
            const { location, device_info, notes } = req.body;

            const todayAttendance = await attendanceService.getTodayAttendance(req.user.id);
            
            if (!todayAttendance) {
                return res.status(400).json({
                    success: false,
                    error: 'No check-in record found for today'
                });
            }

            if (todayAttendance.check_out_time) {
                return res.status(409).json({
                    success: false,
                    error: 'Already checked out today',
                    check_out_time: todayAttendance.check_out_time
                });
            }

            const attendance = await attendanceService.checkOut(
                req.user.id,
                todayAttendance.id,
                {
                    check_out_time: new Date(),
                    check_out_location: location,
                    check_out_device: device_info,
                    notes,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            // Calculate total hours worked
            const checkIn = new Date(attendance.check_in_time);
            const checkOut = new Date(attendance.check_out_time);
            const hoursWorked = (checkOut - checkIn) / (1000 * 60 * 60);

            logger.info('Employee checked out', {
                employeeId: req.user.id,
                attendanceId: attendance.id,
                hoursWorked: hoursWorked.toFixed(2)
            });

            res.json({
                success: true,
                data: attendance,
                message: 'Checked out successfully',
                hours_worked: hoursWorked.toFixed(2)
            });
        } catch (error) {
            logger.error('Error checking out', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // ATTENDANCE LISTS
    // ============================================

    /**
     * Get today's attendance
     * GET /api/v1/employee/attendance/today
     */
    async getTodayAttendance(req, res, next) {
        try {
            const attendance = await attendanceService.getTodayAttendance(req.user.id);

            logger.info('Employee viewed today\'s attendance', {
                employeeId: req.user.id,
                hasAttendance: !!attendance
            });

            // Calculate duration if checked in
            if (attendance && attendance.check_in_time) {
                const checkIn = new Date(attendance.check_in_time);
                const now = new Date();
                attendance.duration_minutes = Math.floor((now - checkIn) / (1000 * 60));
                attendance.duration_hours = (attendance.duration_minutes / 60).toFixed(1);
            }

            res.json({
                success: true,
                data: attendance || null,
                message: attendance ? 'Attendance record found' : 'No attendance record for today'
            });
        } catch (error) {
            logger.error('Error getting today\'s attendance', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get attendance history
     * GET /api/v1/employee/attendance/history
     */
    async getAttendanceHistory(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const history = await attendanceService.getAttendanceHistory(
                req.user.id,
                options
            );

            logger.info('Employee viewed attendance history', {
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
            logger.error('Error getting attendance history', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get attendance summary
     * GET /api/v1/employee/attendance/summary
     */
    async getAttendanceSummary(req, res, next) {
        try {
            const { year, month } = req.query;

            let targetYear = year ? parseInt(year) : new Date().getFullYear();
            let targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;

            const summary = await attendanceService.getAttendanceSummary(
                req.user.id,
                { year: targetYear, month: targetMonth }
            );

            logger.info('Employee viewed attendance summary', {
                employeeId: req.user.id,
                year: targetYear,
                month: targetMonth
            });

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            logger.error('Error getting attendance summary', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get monthly attendance
     * GET /api/v1/employee/attendance/monthly
     */
    async getMonthlyAttendance(req, res, next) {
        try {
            const { year, month } = req.query;

            let targetYear = year ? parseInt(year) : new Date().getFullYear();
            let targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;

            const monthly = await attendanceService.getMonthlyAttendance(
                req.user.id,
                { year: targetYear, month: targetMonth }
            );

            logger.info('Employee viewed monthly attendance', {
                employeeId: req.user.id,
                year: targetYear,
                month: targetMonth,
                days: monthly.length
            });

            // Calculate monthly summary
            const summary = {
                total_days: monthly.length,
                present: monthly.filter(a => a.status === 'present').length,
                absent: monthly.filter(a => a.status === 'absent').length,
                late: monthly.filter(a => a.status === 'late').length,
                half_day: monthly.filter(a => a.status === 'half_day').length,
                leave: monthly.filter(a => a.status === 'leave').length,
                holiday: monthly.filter(a => a.status === 'holiday').length,
                attendance_percentage: monthly.length > 0 
                    ? ((monthly.filter(a => ['present', 'late'].includes(a.status)).length / monthly.length) * 100).toFixed(1)
                    : 0
            };

            res.json({
                success: true,
                data: monthly,
                summary
            });
        } catch (error) {
            logger.error('Error getting monthly attendance', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = attendanceController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Attendance Operations  | 2         | Check in, check out
 * Attendance Lists       | 4         | Today, history, summary, monthly
 * -----------------------|-----------|----------------------
 * TOTAL                  | 6         | Complete attendance management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-54] 15-minute grace period for check-in
 * 
 * ======================================================================
 */