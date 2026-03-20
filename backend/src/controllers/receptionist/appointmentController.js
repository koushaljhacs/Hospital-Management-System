/**
 * ======================================================================
 * FILE: backend/src/controllers/receptionist/appointmentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist appointment controller - Handles appointment booking and management.
 * Total Endpoints: 13
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-07] Cannot book appointment in past
 * - [BR-08] Max 30 appointments per doctor per day
 * - [BR-09] Appointment duration default 30 minutes
 * - [BR-10] Cancellation allowed up to 2 hours before
 * 
 * ======================================================================
 */

const appointmentService = require('../../services/receptionist/appointmentService');
const logger = require('../../utils/logger');

/**
 * Receptionist Appointment Controller
 */
const appointmentController = {
    // ============================================
    // APPOINTMENT LISTS
    // ============================================

    /**
     * Get all appointments
     * GET /api/v1/reception/appointments
     */
    async getAllAppointments(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                doctor_id,
                patient_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                doctor_id,
                patient_id,
                from_date,
                to_date
            };

            const appointments = await appointmentService.getAllAppointments(
                req.user.id,
                options
            );

            logger.info('Receptionist retrieved all appointments', {
                receptionistId: req.user.id,
                count: appointments.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: appointments.data,
                pagination: appointments.pagination,
                summary: appointments.summary
            });
        } catch (error) {
            logger.error('Error getting all appointments', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's appointments
     * GET /api/v1/reception/appointments/today
     */
    async getTodaysAppointments(req, res, next) {
        try {
            const appointments = await appointmentService.getTodaysAppointments(req.user.id);

            logger.info('Receptionist viewed today\'s appointments', {
                receptionistId: req.user.id,
                count: appointments.length
            });

            // Group by status
            const byStatus = {
                scheduled: appointments.filter(a => a.status === 'scheduled').length,
                confirmed: appointments.filter(a => a.status === 'confirmed').length,
                in_progress: appointments.filter(a => a.status === 'in_progress').length,
                completed: appointments.filter(a => a.status === 'completed').length,
                cancelled: appointments.filter(a => a.status === 'cancelled').length,
                no_show: appointments.filter(a => a.status === 'no_show').length
            };

            res.json({
                success: true,
                data: appointments,
                summary: {
                    total: appointments.length,
                    by_status: byStatus,
                    checked_in: appointments.filter(a => a.check_in_time).length,
                    waiting: appointments.filter(a => a.status === 'confirmed' && !a.check_in_time).length
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s appointments', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get upcoming appointments
     * GET /api/v1/reception/appointments/upcoming
     */
    async getUpcomingAppointments(req, res, next) {
        try {
            const { days = 7 } = req.query;

            const appointments = await appointmentService.getUpcomingAppointments(
                req.user.id,
                parseInt(days)
            );

            logger.info('Receptionist viewed upcoming appointments', {
                receptionistId: req.user.id,
                count: appointments.length,
                days: parseInt(days)
            });

            // Group by date
            const byDate = appointments.reduce((acc, apt) => {
                const date = apt.appointment_date;
                if (!acc[date]) {
                    acc[date] = [];
                }
                acc[date].push(apt);
                return acc;
            }, {});

            res.json({
                success: true,
                data: appointments,
                summary: {
                    total: appointments.length,
                    by_date: Object.keys(byDate).map(date => ({
                        date,
                        count: byDate[date].length
                    }))
                }
            });
        } catch (error) {
            logger.error('Error getting upcoming appointments', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get past appointments
     * GET /api/v1/reception/appointments/past
     */
    async getPastAppointments(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const appointments = await appointmentService.getPastAppointments(
                req.user.id,
                options
            );

            logger.info('Receptionist viewed past appointments', {
                receptionistId: req.user.id,
                count: appointments.data?.length || 0
            });

            res.json({
                success: true,
                data: appointments.data,
                pagination: appointments.pagination
            });
        } catch (error) {
            logger.error('Error getting past appointments', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get calendar view
     * GET /api/v1/reception/appointments/calendar
     */
    async getCalendarView(req, res, next) {
        try {
            const { month, year, doctor_id } = req.query;

            const calendar = await appointmentService.getCalendarView(
                req.user.id,
                { month: parseInt(month), year: parseInt(year), doctor_id }
            );

            res.json({
                success: true,
                data: calendar
            });
        } catch (error) {
            logger.error('Error getting calendar view', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get appointment by ID
     * GET /api/v1/reception/appointments/:id
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

            logger.info('Receptionist viewed appointment details', {
                receptionistId: req.user.id,
                appointmentId: id,
                patientId: appointment.patient_id,
                doctorId: appointment.doctor_id
            });

            // Check if cancellation window is still available [BR-10]
            if (appointment.status === 'scheduled') {
                const appointmentTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
                const now = new Date();
                const hoursDiff = (appointmentTime - now) / (1000 * 60 * 60);
                appointment.can_cancel = hoursDiff > 2;
            }

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
                receptionistId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // APPOINTMENT CRUD OPERATIONS
    // ============================================

    /**
     * Create new appointment
     * POST /api/v1/reception/appointments
     * 
     * BUSINESS RULES:
     * - [BR-07] Cannot book in past
     * - [BR-08] Max 30 per doctor per day
     * - [BR-09] Default duration 30 minutes
     */
    async createAppointment(req, res, next) {
        try {
            const appointmentData = {
                patient_id: req.body.patient_id,
                doctor_id: req.body.doctor_id,
                appointment_date: req.body.appointment_date,
                appointment_time: req.body.appointment_time,
                type: req.body.type,
                reason: req.body.reason,
                duration_minutes: req.body.duration_minutes || 30,
                is_emergency: req.body.is_emergency || false,
                notes: req.body.notes,
                created_by: req.user.id,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!appointmentData.patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!appointmentData.doctor_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Doctor ID is required'
                });
            }

            if (!appointmentData.appointment_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Appointment date is required'
                });
            }

            if (!appointmentData.appointment_time) {
                return res.status(400).json({
                    success: false,
                    error: 'Appointment time is required'
                });
            }

            // [BR-07] Check if date is in past
            const appointmentDateTime = new Date(`${appointmentData.appointment_date}T${appointmentData.appointment_time}`);
            if (appointmentDateTime < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot book appointment in the past'
                });
            }

            // [BR-08] Check doctor's daily limit
            const doctorStats = await appointmentService.getDoctorDailyStats(
                appointmentData.doctor_id,
                appointmentData.appointment_date
            );

            if (doctorStats.appointments_count >= 30) {
                return res.status(409).json({
                    success: false,
                    error: 'Doctor has reached maximum appointments for this day'
                });
            }

            // Check if slot is available
            const isSlotAvailable = await appointmentService.checkSlotAvailability(
                appointmentData.doctor_id,
                appointmentData.appointment_date,
                appointmentData.appointment_time
            );

            if (!isSlotAvailable) {
                return res.status(409).json({
                    success: false,
                    error: 'This time slot is already booked'
                });
            }

            const appointment = await appointmentService.createAppointment(
                req.user.id,
                appointmentData
            );

            logger.info('Receptionist created new appointment', {
                receptionistId: req.user.id,
                appointmentId: appointment.id,
                patientId: appointmentData.patient_id,
                doctorId: appointmentData.doctor_id,
                date: appointmentData.appointment_date
            });

            res.status(201).json({
                success: true,
                data: appointment,
                message: 'Appointment created successfully'
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error creating appointment', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update appointment
     * PUT /api/v1/reception/appointments/:id
     */
    async updateAppointment(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.created_by;
            delete updates.created_at;

            // Check if appointment can be updated
            const appointment = await appointmentService.getAppointmentById(req.user.id, id);
            
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot update appointment with status: ${appointment.status}`
                });
            }

            // If date/time is being changed, check availability
            if (updates.appointment_date || updates.appointment_time) {
                const newDate = updates.appointment_date || appointment.appointment_date;
                const newTime = updates.appointment_time || appointment.appointment_time;
                const doctorId = updates.doctor_id || appointment.doctor_id;

                // [BR-07] Check if new date is in past
                const newDateTime = new Date(`${newDate}T${newTime}`);
                if (newDateTime < new Date()) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot reschedule to past date'
                    });
                }

                // Check slot availability (excluding current appointment)
                const isSlotAvailable = await appointmentService.checkSlotAvailability(
                    doctorId,
                    newDate,
                    newTime,
                    id
                );

                if (!isSlotAvailable) {
                    return res.status(409).json({
                        success: false,
                        error: 'This time slot is already booked'
                    });
                }
            }

            const updatedAppointment = await appointmentService.updateAppointment(
                req.user.id,
                id,
                updates
            );

            logger.info('Receptionist updated appointment', {
                receptionistId: req.user.id,
                appointmentId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: updatedAppointment,
                message: 'Appointment updated successfully'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            logger.error('Error updating appointment', {
                error: error.message,
                receptionistId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Cancel appointment
     * PUT /api/v1/reception/appointments/:id/cancel
     * 
     * BUSINESS RULE: [BR-10] Cancellation allowed up to 2 hours before
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

            const appointment = await appointmentService.getAppointmentById(req.user.id, id);
            
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            // [BR-10] Check if within cancellation window
            if (appointment.status === 'scheduled') {
                const appointmentTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
                const now = new Date();
                const hoursDiff = (appointmentTime - now) / (1000 * 60 * 60);
                
                if (hoursDiff < 2) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot cancel appointment within 2 hours of scheduled time'
                    });
                }
            }

            const cancelled = await appointmentService.cancelAppointment(
                req.user.id,
                id,
                {
                    reason,
                    cancelled_by: req.user.id,
                    cancelled_at: new Date()
                }
            );

            logger.info('Receptionist cancelled appointment', {
                receptionistId: req.user.id,
                appointmentId: id,
                reason
            });

            res.json({
                success: true,
                data: cancelled,
                message: 'Appointment cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            logger.error('Error cancelling appointment', {
                error: error.message,
                receptionistId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Check-in patient
     * PUT /api/v1/reception/appointments/:id/check-in
     */
    async checkInPatient(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const appointment = await appointmentService.getAppointmentById(req.user.id, id);
            
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            if (!['scheduled', 'confirmed'].includes(appointment.status)) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot check-in appointment with status: ${appointment.status}`
                });
            }

            const checkedIn = await appointmentService.checkInPatient(
                req.user.id,
                id,
                {
                    check_in_time: new Date(),
                    check_in_notes: notes,
                    status: 'in_progress'
                }
            );

            logger.info('Receptionist checked-in patient', {
                receptionistId: req.user.id,
                appointmentId: id,
                patientId: appointment.patient_id
            });

            res.json({
                success: true,
                data: checkedIn,
                message: 'Patient checked-in successfully'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            logger.error('Error checking-in patient', {
                error: error.message,
                receptionistId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Check-out patient
     * PUT /api/v1/reception/appointments/:id/check-out
     */
    async checkOutPatient(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const appointment = await appointmentService.getAppointmentById(req.user.id, id);
            
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            if (appointment.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot check-out appointment with status: ${appointment.status}`
                });
            }

            const checkedOut = await appointmentService.checkOutPatient(
                req.user.id,
                id,
                {
                    check_out_time: new Date(),
                    check_out_notes: notes,
                    status: 'completed'
                }
            );

            logger.info('Receptionist checked-out patient', {
                receptionistId: req.user.id,
                appointmentId: id,
                patientId: appointment.patient_id
            });

            res.json({
                success: true,
                data: checkedOut,
                message: 'Patient checked-out successfully'
            });
        } catch (error) {
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            logger.error('Error checking-out patient', {
                error: error.message,
                receptionistId: req.user.id,
                appointmentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // AVAILABILITY & SLOTS
    // ============================================

    /**
     * Get available slots
     * GET /api/v1/reception/appointments/available-slots
     */
    async getAvailableSlots(req, res, next) {
        try {
            const { doctor_id, date } = req.query;

            if (!doctor_id || !date) {
                return res.status(400).json({
                    success: false,
                    error: 'Doctor ID and date are required'
                });
            }

            const slots = await appointmentService.getAvailableSlots(
                doctor_id,
                date
            );

            logger.info('Receptionist checked available slots', {
                receptionistId: req.user.id,
                doctorId: doctor_id,
                date,
                availableSlots: slots.length
            });

            res.json({
                success: true,
                data: slots,
                summary: {
                    total_slots: slots.length,
                    morning: slots.filter(s => s.time < '12:00').length,
                    afternoon: slots.filter(s => s.time >= '12:00' && s.time < '17:00').length,
                    evening: slots.filter(s => s.time >= '17:00').length
                }
            });
        } catch (error) {
            logger.error('Error getting available slots', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get walk-in slots
     * GET /api/v1/reception/appointments/walk-in
     */
    async getWalkinSlots(req, res, next) {
        try {
            const { date, department_id } = req.query;

            if (!date) {
                return res.status(400).json({
                    success: false,
                    error: 'Date is required'
                });
            }

            const slots = await appointmentService.getWalkinSlots(
                date,
                department_id
            );

            res.json({
                success: true,
                data: slots
            });
        } catch (error) {
            logger.error('Error getting walk-in slots', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // APPOINTMENT STATISTICS
    // ============================================

    /**
     * Get appointment statistics
     * GET /api/v1/reception/appointments/stats
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
            logger.error('Error getting appointment statistics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get doctor schedule
     * GET /api/v1/reception/appointments/doctor-schedule/:doctorId
     */
    async getDoctorSchedule(req, res, next) {
        try {
            const { doctorId } = req.params;
            const { date } = req.query;

            if (!date) {
                return res.status(400).json({
                    success: false,
                    error: 'Date is required'
                });
            }

            const schedule = await appointmentService.getDoctorSchedule(
                doctorId,
                date
            );

            res.json({
                success: true,
                data: schedule
            });
        } catch (error) {
            logger.error('Error getting doctor schedule', {
                error: error.message,
                receptionistId: req.user.id,
                doctorId: req.params.doctorId
            });
            next(error);
        }
    },

    // ============================================
    // BULK OPERATIONS
    // ============================================

    /**
     * Bulk create appointments
     * POST /api/v1/reception/appointments/bulk
     */
    async bulkCreateAppointments(req, res, next) {
        try {
            const { appointments } = req.body;

            if (!appointments || !Array.isArray(appointments) || appointments.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Appointments array is required'
                });
            }

            const results = await appointmentService.bulkCreateAppointments(
                req.user.id,
                appointments
            );

            logger.info('Receptionist created bulk appointments', {
                receptionistId: req.user.id,
                requestedCount: appointments.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            });

            res.status(201).json({
                success: true,
                data: results,
                message: `Created ${results.success.length} out of ${appointments.length} appointments`
            });
        } catch (error) {
            logger.error('Error in bulk appointment creation', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export appointments
     * GET /api/v1/reception/appointments/export
     */
    async exportAppointments(req, res, next) {
        try {
            const { format = 'csv', from_date, to_date, status } = req.query;

            const data = await appointmentService.exportAppointments(
                req.user.id,
                format,
                { from_date, to_date, status }
            );

            logger.info('Receptionist exported appointments', {
                receptionistId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=appointments-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting appointments', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // APPOINTMENT REMINDERS
    // ============================================

    /**
     * Send appointment reminders
     * POST /api/v1/reception/appointments/reminders
     */
    async sendReminders(req, res, next) {
        try {
            const { hours_before = 24 } = req.body;

            const result = await appointmentService.sendAppointmentReminders(
                req.user.id,
                parseInt(hours_before)
            );

            logger.info('Receptionist sent appointment reminders', {
                receptionistId: req.user.id,
                remindersSent: result.sent,
                hoursBefore: hours_before
            });

            res.json({
                success: true,
                data: result,
                message: `Sent ${result.sent} reminders`
            });
        } catch (error) {
            logger.error('Error sending reminders', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get appointments requiring reminder
     * GET /api/v1/reception/appointments/reminders/pending
     */
    async getPendingReminders(req, res, next) {
        try {
            const appointments = await appointmentService.getAppointmentsRequiringReminder();

            res.json({
                success: true,
                data: appointments,
                count: appointments.length
            });
        } catch (error) {
            logger.error('Error getting pending reminders', {
                error: error.message,
                receptionistId: req.user.id
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
 * Appointment Lists      | 6         | All, today, upcoming, past, calendar, by ID
 * CRUD Operations        | 4         | Create, update, cancel, check-in, check-out
 * Availability & Slots   | 2         | Available slots, walk-in slots
 * Statistics & Schedule  | 2         | Stats, doctor schedule
 * Bulk Operations        | 2         | Bulk create, export
 * Reminders              | 2         | Send reminders, pending reminders
 * -----------------------|-----------|----------------------
 * TOTAL                  | 18        | Complete appointment management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-07] No past appointments
 * - [BR-08] Doctor daily limit
 * - [BR-09] Default duration
 * - [BR-10] Cancellation window
 * 
 * ======================================================================
 */