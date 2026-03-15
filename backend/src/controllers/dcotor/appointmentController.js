/**
 * ======================================================================
 * FILE: backend/src/controllers/doctor/appointmentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor's appointment management controller.
 * Allows doctors to view, manage appointments and update schedules.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ENDPOINTS:
 * GET    /doctor/appointments                    - All appointments
 * GET    /doctor/appointments/today                - Today's appointments
 * GET    /doctor/appointments/upcoming              - Upcoming appointments
 * GET    /doctor/appointments/completed              - Completed appointments
 * GET    /doctor/appointments/calendar                - Calendar view
 * GET    /doctor/appointments/:id                       - Get appointment by ID
 * PUT    /doctor/appointments/:id/start                  - Start appointment
 * PUT    /doctor/appointments/:id/complete                - Complete appointment
 * PUT    /doctor/appointments/:id/no-show                 - Mark as no-show
 * PUT    /doctor/appointments/:id/cancel                  - Cancel appointment
 * GET    /doctor/appointments/stats                        - Appointment statistics
 * GET    /doctor/schedule                                   - Get doctor schedule
 * PUT    /doctor/schedule                                    - Update doctor schedule
 * GET    /doctor/availability                                 - Get availability
 * PUT    /doctor/availability                                  - Update availability
 * GET    /doctor/leave                                         - Get leave requests
 * POST   /doctor/leave                                          - Request leave
 * DELETE /doctor/leave/:id                                      - Cancel leave
 * 
 * ======================================================================
 */

const appointmentService = require('../../services/doctor/appointmentService');
const logger = require('../../utils/logger');

/**
 * Doctor Appointment Controller
 */
const appointmentController = {
    // ============================================
    // APPOINTMENT LISTS
    // ============================================

    /**
     * Get all appointments with filters
     * GET /api/v1/doctor/appointments
     */
    async getAppointments(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                from_date,
                to_date,
                patient_id
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                from_date,
                to_date,
                patient_id
            };

            const appointments = await appointmentService.getAppointments(
                req.user.id,
                options
            );

            logger.info('Doctor retrieved appointments', {
                doctorId: req.user.id,
                count: appointments.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: appointments.data,
                pagination: appointments.pagination
            });
        } catch (error) {
            logger.error('Error getting appointments', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's appointments
     * GET /api/v1/doctor/appointments/today
     */
    async getTodayAppointments(req, res, next) {
        try {
            const appointments = await appointmentService.getTodayAppointments(
                req.user.id
            );

            logger.info('Doctor retrieved today\'s appointments', {
                doctorId: req.user.id,
                count: appointments.length
            });

            res.json({
                success: true,
                data: appointments,
                summary: {
                    total: appointments.length,
                    completed: appointments.filter(a => a.status === 'completed').length,
                    pending: appointments.filter(a => a.status === 'scheduled').length,
                    no_show: appointments.filter(a => a.status === 'no_show').length,
                    cancelled: appointments.filter(a => a.status === 'cancelled').length
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s appointments', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get upcoming appointments
     * GET /api/v1/doctor/appointments/upcoming
     */
    async getUpcomingAppointments(req, res, next) {
        try {
            const { days = 7 } = req.query;

            const appointments = await appointmentService.getUpcomingAppointments(
                req.user.id,
                parseInt(days)
            );

            logger.info('Doctor retrieved upcoming appointments', {
                doctorId: req.user.id,
                count: appointments.length,
                days: parseInt(days)
            });

            res.json({
                success: true,
                data: appointments
            });
        } catch (error) {
            logger.error('Error getting upcoming appointments', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed appointments
     * GET /api/v1/doctor/appointments/completed
     */
    async getCompletedAppointments(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const appointments = await appointmentService.getCompletedAppointments(
                req.user.id,
                options
            );

            logger.info('Doctor retrieved completed appointments', {
                doctorId: req.user.id,
                count: appointments.data?.length || 0
            });

            res.json({
                success: true,
                data: appointments.data,
                pagination: appointments.pagination
            });
        } catch (error) {
            logger.error('Error getting completed appointments', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get calendar view
     * GET /api/v1/doctor/appointments/calendar
     */
    async getCalendarView(req, res, next) {
        try {
            const { month, year } = req.query;

            const calendar = await appointmentService.getCalendarView(
                req.user.id,
                { month: parseInt(month), year: parseInt(year) }
            );

            res.json({
                success: true,
                data: calendar
            });
        } catch (error) {
            logger.error('Error getting calendar view', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // SINGLE APPOINTMENT OPERATIONS
    // ============================================

    /**
     * Get appointment by ID
     * GET /api/v1/doctor/appointments/:id
     */
    async getAppointmentById(req, res, next) {
        try {
            const { id } = req.params;

            const appointment = await appointmentService.getAppointmentById(
                req.user.id,
                id
            );

            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            logger.info('Doctor viewed appointment details', {
                doctorId: req.user.id,
                appointmentId: id
            });

            res.json({
                success: true,
                data: appointment
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            logger.error('Error getting appointment by ID', {
                error: error.message,
                doctorId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Start appointment
     * PUT /api/v1/doctor/appointments/:id/start
     */
    async startAppointment(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const appointment = await appointmentService.startAppointment(
                req.user.id,
                id,
                { notes, started_at: new Date() }
            );

            logger.info('Doctor started appointment', {
                doctorId: req.user.id,
                appointmentId: id
            });

            res.json({
                success: true,
                data: appointment,
                message: 'Appointment started successfully'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            if (error.message === 'Cannot start appointment in this status') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error starting appointment', {
                error: error.message,
                doctorId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Complete appointment
     * PUT /api/v1/doctor/appointments/:id/complete
     */
    async completeAppointment(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                diagnosis,
                prescription,
                notes,
                follow_up_required,
                follow_up_date
            } = req.body;

            const appointment = await appointmentService.completeAppointment(
                req.user.id,
                id,
                {
                    diagnosis,
                    prescription,
                    notes,
                    follow_up_required,
                    follow_up_date,
                    completed_at: new Date()
                }
            );

            logger.info('Doctor completed appointment', {
                doctorId: req.user.id,
                appointmentId: id,
                follow_up_required
            });

            res.json({
                success: true,
                data: appointment,
                message: 'Appointment completed successfully'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            if (error.message === 'Cannot complete appointment in this status') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error completing appointment', {
                error: error.message,
                doctorId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Mark as no-show
     * PUT /api/v1/doctor/appointments/:id/no-show
     */
    async markNoShow(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const appointment = await appointmentService.markNoShow(
                req.user.id,
                id,
                { reason }
            );

            logger.info('Doctor marked appointment as no-show', {
                doctorId: req.user.id,
                appointmentId: id,
                reason
            });

            res.json({
                success: true,
                data: appointment,
                message: 'Appointment marked as no-show'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            if (error.message === 'Cannot mark as no-show') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error marking no-show', {
                error: error.message,
                doctorId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Cancel appointment
     * PUT /api/v1/doctor/appointments/:id/cancel
     */
    async cancelAppointment(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Cancellation reason is required'
                });
            }

            const appointment = await appointmentService.cancelAppointment(
                req.user.id,
                id,
                { reason }
            );

            logger.info('Doctor cancelled appointment', {
                doctorId: req.user.id,
                appointmentId: id,
                reason
            });

            res.json({
                success: true,
                data: appointment,
                message: 'Appointment cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            if (error.message === 'Cannot cancel completed appointment') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error cancelling appointment', {
                error: error.message,
                doctorId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // APPOINTMENT STATISTICS
    // ============================================

    /**
     * Get appointment statistics
     * GET /api/v1/doctor/appointments/stats
     */
    async getAppointmentStats(req, res, next) {
        try {
            const { period = 'week' } = req.query;

            const stats = await appointmentService.getAppointmentStats(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting appointment stats', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // SCHEDULE & AVAILABILITY
    // ============================================

    /**
     * Get doctor schedule
     * GET /api/v1/doctor/schedule
     */
    async getSchedule(req, res, next) {
        try {
            const schedule = await appointmentService.getSchedule(req.user.id);

            res.json({
                success: true,
                data: schedule
            });
        } catch (error) {
            logger.error('Error getting schedule', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update doctor schedule
     * PUT /api/v1/doctor/schedule
     */
    async updateSchedule(req, res, next) {
        try {
            const { availability } = req.body;

            if (!availability || !Array.isArray(availability)) {
                return res.status(400).json({
                    success: false,
                    error: 'Availability schedule is required'
                });
            }

            const schedule = await appointmentService.updateSchedule(
                req.user.id,
                availability
            );

            logger.info('Doctor updated schedule', {
                doctorId: req.user.id,
                daysUpdated: availability.length
            });

            res.json({
                success: true,
                data: schedule,
                message: 'Schedule updated successfully'
            });
        } catch (error) {
            logger.error('Error updating schedule', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get availability for specific date range
     * GET /api/v1/doctor/availability
     */
    async getAvailability(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            if (!from_date || !to_date) {
                return res.status(400).json({
                    success: false,
                    error: 'From date and to date are required'
                });
            }

            const availability = await appointmentService.getAvailability(
                req.user.id,
                { from_date, to_date }
            );

            res.json({
                success: true,
                data: availability
            });
        } catch (error) {
            logger.error('Error getting availability', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update availability for specific date
     * PUT /api/v1/doctor/availability
     */
    async updateAvailability(req, res, next) {
        try {
            const { date, slots_available, is_available } = req.body;

            if (!date) {
                return res.status(400).json({
                    success: false,
                    error: 'Date is required'
                });
            }

            const availability = await appointmentService.updateAvailability(
                req.user.id,
                { date, slots_available, is_available }
            );

            logger.info('Doctor updated availability', {
                doctorId: req.user.id,
                date,
                slots_available
            });

            res.json({
                success: true,
                data: availability,
                message: 'Availability updated successfully'
            });
        } catch (error) {
            logger.error('Error updating availability', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // LEAVE MANAGEMENT
    // ============================================

    /**
     * Get leave requests
     * GET /api/v1/doctor/leave
     */
    async getLeaveRequests(req, res, next) {
        try {
            const { status } = req.query;

            const leaves = await appointmentService.getLeaveRequests(
                req.user.id,
                status
            );

            res.json({
                success: true,
                data: leaves
            });
        } catch (error) {
            logger.error('Error getting leave requests', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Request leave
     * POST /api/v1/doctor/leave
     */
    async requestLeave(req, res, next) {
        try {
            const { 
                start_date, 
                end_date, 
                reason, 
                leave_type 
            } = req.body;

            // Validation
            if (!start_date || !end_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Start date and end date are required'
                });
            }

            if (new Date(start_date) < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Leave cannot start in the past'
                });
            }

            if (new Date(end_date) < new Date(start_date)) {
                return res.status(400).json({
                    success: false,
                    error: 'End date must be after start date'
                });
            }

            if (!reason || reason.length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Reason must be at least 5 characters'
                });
            }

            const leave = await appointmentService.requestLeave(
                req.user.id,
                {
                    start_date,
                    end_date,
                    reason,
                    leave_type: leave_type || 'annual'
                }
            );

            logger.info('Doctor requested leave', {
                doctorId: req.user.id,
                leaveId: leave.id,
                start_date,
                end_date,
                leave_type
            });

            res.status(201).json({
                success: true,
                data: leave,
                message: 'Leave request submitted successfully'
            });
        } catch (error) {
            if (error.message.includes('overlapping')) {
                return res.status(409).json({
                    success: false,
                    error: 'Leave request overlaps with existing leave'
                });
            }
            logger.error('Error requesting leave', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Cancel leave request
     * DELETE /api/v1/doctor/leave/:id
     */
    async cancelLeave(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const leave = await appointmentService.cancelLeave(
                req.user.id,
                id,
                reason
            );

            logger.info('Doctor cancelled leave request', {
                doctorId: req.user.id,
                leaveId: id,
                reason
            });

            res.json({
                success: true,
                data: leave,
                message: 'Leave request cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Leave request not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Leave request not found'
                });
            }
            if (error.message === 'Cannot cancel approved leave') {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error cancelling leave', {
                error: error.message,
                doctorId: req.user.id,
                leaveId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // APPOINTMENT NOTES & FEEDBACK
    // ============================================

    /**
     * Add appointment notes
     * POST /api/v1/doctor/appointments/:id/notes
     */
    async addAppointmentNotes(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, type = 'general' } = req.body;

            if (!notes || notes.trim().length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Notes must be at least 5 characters'
                });
            }

            const result = await appointmentService.addAppointmentNotes(
                req.user.id,
                id,
                { notes, type }
            );

            logger.info('Doctor added appointment notes', {
                doctorId: req.user.id,
                appointmentId: id,
                noteType: type
            });

            res.json({
                success: true,
                data: result,
                message: 'Notes added successfully'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            logger.error('Error adding appointment notes', {
                error: error.message,
                doctorId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get appointment feedback
     * GET /api/v1/doctor/appointments/:id/feedback
     */
    async getAppointmentFeedback(req, res, next) {
        try {
            const { id } = req.params;

            const feedback = await appointmentService.getAppointmentFeedback(
                req.user.id,
                id
            );

            res.json({
                success: true,
                data: feedback
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            logger.error('Error getting appointment feedback', {
                error: error.message,
                doctorId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = appointmentController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Appointment Lists      | 5         | All, today, upcoming, completed, calendar
 * Single Operations      | 5         | View, start, complete, no-show, cancel
 * Statistics             | 1         | Appointment stats
 * Schedule & Availability| 4         | Get/update schedule, get/update availability
 * Leave Management       | 3         | Get, request, cancel leave
 * Notes & Feedback       | 2         | Add notes, get feedback
 * -----------------------|-----------|----------------------
 * TOTAL                  | 20        | Complete appointment management
 * 
 * ======================================================================
 */