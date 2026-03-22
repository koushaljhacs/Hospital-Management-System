/**
 * ======================================================================
 * FILE: backend/src/controllers/employee/leaveController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee leave controller - Handles leave management.
 * Total Endpoints: 6
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-55] Leave balance cannot go negative
 * - [BR-56] Leave request requires minimum 2 days advance notice
 * 
 * ======================================================================
 */

const leaveService = require('../../services/employee/leaveService');
const logger = require('../../utils/logger');

const leaveController = {
    // ============================================
    // LEAVE LISTS
    // ============================================

    /**
     * Get my leaves
     * GET /api/v1/employee/leaves
     */
    async getMyLeaves(req, res, next) {
        try {
            const { page = 1, limit = 20, status, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                from_date,
                to_date
            };

            const leaves = await leaveService.getEmployeeLeaves(
                req.user.id,
                options
            );

            logger.info('Employee viewed leaves', {
                employeeId: req.user.id,
                count: leaves.data?.length || 0
            });

            res.json({
                success: true,
                data: leaves.data,
                pagination: leaves.pagination,
                summary: leaves.summary
            });
        } catch (error) {
            logger.error('Error getting employee leaves', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get leave balance
     * GET /api/v1/employee/leaves/balance
     * 
     * BUSINESS RULE: [BR-55] Leave balance cannot go negative
     */
    async getLeaveBalance(req, res, next) {
        try {
            const balance = await leaveService.getLeaveBalance(req.user.id);

            logger.info('Employee viewed leave balance', {
                employeeId: req.user.id,
                annual: balance.annual,
                sick: balance.sick,
                casual: balance.casual
            });

            // [BR-55] Check if any balance is negative (should never happen)
            const hasNegative = Object.values(balance).some(v => v < 0);
            if (hasNegative) {
                logger.error('Negative leave balance detected', {
                    employeeId: req.user.id,
                    balance
                });
            }

            res.json({
                success: true,
                data: balance,
                total_balance: balance.annual + balance.sick + balance.casual
            });
        } catch (error) {
            logger.error('Error getting leave balance', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get leave history
     * GET /api/v1/employee/leaves/history
     */
    async getLeaveHistory(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const history = await leaveService.getLeaveHistory(
                req.user.id,
                options
            );

            logger.info('Employee viewed leave history', {
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
            logger.error('Error getting leave history', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get leave by ID
     * GET /api/v1/employee/leaves/:id
     */
    async getLeaveById(req, res, next) {
        try {
            const { id } = req.params;

            const leave = await leaveService.getLeaveById(
                req.user.id,
                id
            );

            if (!leave) {
                return res.status(404).json({
                    success: false,
                    error: 'Leave request not found'
                });
            }

            if (leave.employee_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            logger.info('Employee viewed leave details', {
                employeeId: req.user.id,
                leaveId: id,
                status: leave.status
            });

            res.json({
                success: true,
                data: leave
            });
        } catch (error) {
            if (error.message === 'Leave request not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Leave request not found'
                });
            }
            logger.error('Error getting leave by ID', {
                error: error.message,
                employeeId: req.user.id,
                leaveId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // LEAVE OPERATIONS
    // ============================================

    /**
     * Apply for leave
     * POST /api/v1/employee/leaves
     * 
     * BUSINESS RULES:
     * - [BR-55] Leave balance cannot go negative
     * - [BR-56] Leave request requires minimum 2 days advance notice
     */
    async applyLeave(req, res, next) {
        try {
            const {
                leave_type,
                start_date,
                end_date,
                reason,
                contact_number,
                address_during_leave
            } = req.body;

            // Validate required fields
            if (!leave_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Leave type is required'
                });
            }

            if (!start_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Start date is required'
                });
            }

            if (!end_date) {
                return res.status(400).json({
                    success: false,
                    error: 'End date is required'
                });
            }

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Reason is required'
                });
            }

            // Calculate leave days
            const start = new Date(start_date);
            const end = new Date(end_date);
            const leaveDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            // [BR-56] Check advance notice
            const now = new Date();
            const daysNotice = (start - now) / (1000 * 60 * 60 * 24);
            
            if (daysNotice < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Leave request requires at least 2 days advance notice',
                    days_notice_available: Math.floor(daysNotice),
                    days_required: 2
                });
            }

            // [BR-55] Check leave balance
            const balance = await leaveService.getLeaveBalance(req.user.id);
            let availableBalance = 0;
            
            switch(leave_type) {
                case 'annual':
                    availableBalance = balance.annual;
                    break;
                case 'sick':
                    availableBalance = balance.sick;
                    break;
                case 'casual':
                    availableBalance = balance.casual;
                    break;
                default:
                    availableBalance = 999; // Unpaid leave has no limit
            }

            if (leave_type !== 'unpaid' && leaveDays > availableBalance) {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient leave balance',
                    requested_days: leaveDays,
                    available_balance: availableBalance,
                    leave_type
                });
            }

            const leave = await leaveService.applyLeave(
                req.user.id,
                {
                    leave_type,
                    start_date,
                    end_date,
                    leave_days: leaveDays,
                    reason,
                    contact_number,
                    address_during_leave,
                    applied_at: new Date(),
                    applied_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Employee applied for leave', {
                employeeId: req.user.id,
                leaveId: leave.id,
                leaveType: leave_type,
                leaveDays,
                balanceAfter: balance[leave_type] - leaveDays
            });

            res.status(201).json({
                success: true,
                data: leave,
                message: 'Leave request submitted successfully'
            });
        } catch (error) {
            if (error.message.includes('insufficient balance')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error applying for leave', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Cancel leave (if pending)
     * DELETE /api/v1/employee/leaves/:id
     */
    async cancelLeave(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const leave = await leaveService.getLeaveById(req.user.id, id);
            
            if (!leave) {
                return res.status(404).json({
                    success: false,
                    error: 'Leave request not found'
                });
            }

            if (leave.employee_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only cancel your own leave requests'
                });
            }

            if (leave.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot cancel leave with status: ${leave.status}`
                });
            }

            const cancelled = await leaveService.cancelLeave(
                req.user.id,
                id,
                {
                    reason,
                    cancelled_at: new Date(),
                    cancelled_by: req.user.id
                }
            );

            logger.info('Employee cancelled leave request', {
                employeeId: req.user.id,
                leaveId: id,
                leaveType: leave.leave_type,
                leaveDays: leave.leave_days
            });

            res.json({
                success: true,
                data: cancelled,
                message: 'Leave request cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Leave request not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Leave request not found'
                });
            }
            logger.error('Error cancelling leave', {
                error: error.message,
                employeeId: req.user.id,
                leaveId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = leaveController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Leave Lists            | 3         | My leaves, balance, history, by ID
 * Leave Operations       | 2         | Apply, cancel
 * -----------------------|-----------|----------------------
 * TOTAL                  | 5         | Complete leave management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-55] Leave balance validation before approval
 * - [BR-56] 2-day advance notice requirement
 * 
 * ======================================================================
 */