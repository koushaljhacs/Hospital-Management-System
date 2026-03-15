/**
 * ======================================================================
 * FILE: backend/src/controllers/patient/appointmentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient appointment controller handling all appointment-related operations.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ENDPOINTS:
 * GET    /patient/appointments              - All appointments
 * GET    /patient/appointments/upcoming        - Upcoming appointments
 * GET    /patient/appointments/past             - Past appointments
 * GET    /patient/appointments/today              - Today's appointments
 * GET    /patient/appointments/:id                   - Get appointment by ID
 * POST   /patient/appointments                         - Book new appointment
 * PUT    /patient/appointments/:id/cancel                - Cancel appointment
 * PUT    /patient/appointments/:id/reschedule              - Reschedule appointment
 * GET    /patient/appointments/:id/history                   - Appointment history
 * GET    /patient/appointments/available-slots                 - Check available slots
 * 
 * ======================================================================
 */

const appointmentService = require('../../services/patient/appointmentService');
const patientService = require('../../services/patient/patientService');
const logger = require('../../utils/logger');

/**
 * Patient Appointment Controller
 */
const appointmentController = {
    // ============================================
    // GET APPOINTMENTS (LIST)
    // ============================================

    /**
     * Get all appointments with filters
     * GET /api/v1/patient/appointments
     */
    async getAppointments(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                fromDate,
                toDate,
                doctorId,
                type 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                fromDate,
                toDate,
                doctorId,
                type
            };

            const appointments = await patientService.getAppointments(req.user.id, options);

            logger.info('Appointments retrieved', { 
                userId: req.user.id,
                count: appointments.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: appointments.data || appointments,
                pagination: appointments.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get upcoming appointments
     * GET /api/v1/patient/appointments/upcoming
     */
    async getUpcomingAppointments(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const appointments = await patientService.getAppointments(req.user.id, {
                page: parseInt(page),
                limit: parseInt(limit),
                upcoming: true,
                status: 'scheduled'
            });

            res.json({
                success: true,
                data: appointments.data || appointments,
                pagination: appointments.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get past appointments
     * GET /api/v1/patient/appointments/past
     */
    async getPastAppointments(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const appointments = await patientService.getAppointments(req.user.id, {
                page: parseInt(page),
                limit: parseInt(limit),
                past: true,
                status: ['completed', 'cancelled', 'no_show']
            });

            res.json({
                success: true,
                data: appointments.data || appointments,
                pagination: appointments.pagination
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get today's appointments
     * GET /api/v1/patient/appointments/today
     */
    async getTodayAppointments(req, res, next) {
        try {
            const today = new Date().toISOString().split('T')[0];

            const appointments = await patientService.getAppointments(req.user.id, {
                fromDate: today,
                toDate: today
            });

            res.json({
                success: true,
                data: appointments.data || appointments,
                summary: {
                    total: appointments.data?.length || 0,
                    scheduled: appointments.data?.filter(a => a.status === 'scheduled').length || 0,
                    completed: appointments.data?.filter(a => a.status === 'completed').length || 0,
                    cancelled: appointments.data?.filter(a => a.status === 'cancelled').length || 0
                }
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    // ============================================
    // SINGLE APPOINTMENT OPERATIONS
    // ============================================

    /**
     * Get appointment by ID
     * GET /api/v1/patient/appointments/:id
     */
    async getAppointmentById(req, res, next) {
        try {
            const { id } = req.params;

            // First verify patient ownership
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const appointment = await appointmentService.getAppointmentById(id, patient.id);

            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            logger.info('Appointment retrieved by ID', {
                userId: req.user.id,
                appointmentId: id
            });

            res.json({
                success: true,
                data: appointment
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Book new appointment
     * POST /api/v1/patient/appointments
     */
    async bookAppointment(req, res, next) {
        try {
            const appointmentData = {
                doctor_id: req.body.doctorId,
                appointment_date: req.body.appointmentDate,
                appointment_time: req.body.appointmentTime,
                type: req.body.type || 'regular_checkup',
                reason: req.body.reason,
                symptoms: req.body.symptoms,
                is_followup: req.body.isFollowup || false,
                previous_appointment_id: req.body.previousAppointmentId,
                notes: req.body.notes,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            };

            // Validate required fields
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

            // Check if date is in the past
            const appointmentDate = new Date(`${appointmentData.appointment_date}T${appointmentData.appointment_time}`);
            if (appointmentDate < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot book appointment in the past'
                });
            }

            const appointment = await appointmentService.bookAppointment(
                req.user.id, 
                appointmentData
            );

            logger.info('Appointment booked successfully', {
                userId: req.user.id,
                appointmentId: appointment.id,
                doctorId: appointmentData.doctor_id,
                date: appointmentData.appointment_date
            });

            res.status(201).json({
                success: true,
                data: appointment,
                message: 'Appointment booked successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message.includes('fully booked')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            if (error.message.includes('not available')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    /**
     * Cancel appointment
     * PUT /api/v1/patient/appointments/:id/cancel
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

            const patient = await patientService.getPatientProfile(req.user.id);
            
            // Check if appointment can be cancelled (e.g., not within 2 hours)
            const appointment = await appointmentService.getAppointmentById(id, patient.id);
            
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            // Check if appointment is already cancelled or completed
            if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot cancel appointment with status: ${appointment.status}`
                });
            }

            // Check if within cancellation window (e.g., 2 hours before)
            const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
            const now = new Date();
            const hoursDiff = (appointmentDateTime - now) / (1000 * 60 * 60);

            if (hoursDiff < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot cancel appointment within 2 hours of scheduled time. Please contact the hospital.'
                });
            }

            const cancelled = await appointmentService.cancelAppointment(
                req.user.id, 
                id,
                reason,
                {
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            );

            logger.info('Appointment cancelled', {
                userId: req.user.id,
                appointmentId: id,
                reason
            });

            res.json({
                success: true,
                data: cancelled,
                message: 'Appointment cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message === 'Appointment not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }
            next(error);
        }
    },

    /**
     * Reschedule appointment
     * PUT /api/v1/patient/appointments/:id/reschedule
     */
    async rescheduleAppointment(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                newDate, 
                newTime, 
                reason 
            } = req.body;

            // Validate required fields
            if (!newDate || !newTime) {
                return res.status(400).json({
                    success: false,
                    error: 'New date and time are required'
                });
            }

            // Check if new date is in the past
            const newDateTime = new Date(`${newDate}T${newTime}`);
            if (newDateTime < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot reschedule to past date'
                });
            }

            const patient = await patientService.getPatientProfile(req.user.id);
            
            // Check if appointment exists and belongs to patient
            const appointment = await appointmentService.getAppointmentById(id, patient.id);
            
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            // Check if appointment can be rescheduled
            if (['cancelled', 'completed', 'no_show'].includes(appointment.status)) {
                return res.status(400).json({
                    success: false,
                    error: `Cannot reschedule appointment with status: ${appointment.status}`
                });
            }

            const rescheduled = await appointmentService.rescheduleAppointment(
                req.user.id,
                id,
                {
                    new_date: newDate,
                    new_time: newTime,
                    reason: reason || 'Patient requested reschedule'
                },
                {
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            );

            logger.info('Appointment rescheduled', {
                userId: req.user.id,
                appointmentId: id,
                newDate,
                newTime
            });

            res.json({
                success: true,
                data: rescheduled,
                message: 'Appointment rescheduled successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message.includes('fully booked')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            if (error.message.includes('not available')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    // ============================================
    // APPOINTMENT HISTORY & METADATA
    // ============================================

    /**
     * Get appointment history (timeline of status changes)
     * GET /api/v1/patient/appointments/:id/history
     */
    async getAppointmentHistory(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const history = await appointmentService.getAppointmentHistory(id, patient.id);

            if (!history) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    // ============================================
    // AVAILABILITY & UTILITY
    // ============================================

    /**
     * Check available slots for a doctor
     * GET /api/v1/patient/appointments/available-slots
     */
    async getAvailableSlots(req, res, next) {
        try {
            const { 
                doctorId, 
                date,
                days = 7 
            } = req.query;

            if (!doctorId) {
                return res.status(400).json({
                    success: false,
                    error: 'Doctor ID is required'
                });
            }

            if (!date) {
                return res.status(400).json({
                    success: false,
                    error: 'Date is required'
                });
            }

            const slots = await appointmentService.getAvailableSlots(
                doctorId,
                date,
                parseInt(days)
            );

            res.json({
                success: true,
                data: slots
            });
        } catch (error) {
            next(error);
        }
    },

    /**
     * Get appointment statistics
     * GET /api/v1/patient/appointments/stats
     */
    async getAppointmentStats(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const stats = await appointmentService.getAppointmentStats(patient.id);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Get appointment reminders
     * GET /api/v1/patient/appointments/reminders
     */
    async getAppointmentReminders(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const reminders = await appointmentService.getUpcomingReminders(patient.id);

            res.json({
                success: true,
                data: reminders
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    },

    /**
     * Rate appointment (after completion)
     * POST /api/v1/patient/appointments/:id/rate
     */
    async rateAppointment(req, res, next) {
        try {
            const { id } = req.params;
            const { rating, feedback } = req.body;

            if (!rating || rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Rating must be between 1 and 5'
                });
            }

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const appointment = await appointmentService.getAppointmentById(id, patient.id);
            
            if (!appointment) {
                return res.status(404).json({
                    success: false,
                    error: 'Appointment not found'
                });
            }

            if (appointment.status !== 'completed') {
                return res.status(400).json({
                    success: false,
                    error: 'Can only rate completed appointments'
                });
            }

            if (appointment.rating_given) {
                return res.status(400).json({
                    success: false,
                    error: 'Appointment already rated'
                });
            }

            const rated = await appointmentService.rateAppointment(
                id,
                { rating, feedback },
                {
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                }
            );

            logger.info('Appointment rated', {
                userId: req.user.id,
                appointmentId: id,
                rating
            });

            res.json({
                success: true,
                data: rated,
                message: 'Thank you for your feedback!'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            next(error);
        }
    }
};

module.exports = appointmentController;

/**
 * ======================================================================
 * USAGE IN ROUTES:
 * ======================================================================
 * 
 * const appointmentController = require('./controllers/patient/appointmentController');
 * const authenticate = require('../middlewares/auth');
 * const validate = require('../middlewares/validator');
 * const { validateAppointmentBooking, validateAppointmentReschedule } = require('../validators/patientValidators');
 * 
 * // List endpoints
 * router.get('/appointments', authenticate, appointmentController.getAppointments);
 * router.get('/appointments/upcoming', authenticate, appointmentController.getUpcomingAppointments);
 * router.get('/appointments/past', authenticate, appointmentController.getPastAppointments);
 * router.get('/appointments/today', authenticate, appointmentController.getTodayAppointments);
 * router.get('/appointments/stats', authenticate, appointmentController.getAppointmentStats);
 * router.get('/appointments/reminders', authenticate, appointmentController.getAppointmentReminders);
 * 
 * // Single appointment operations
 * router.get('/appointments/:id', authenticate, appointmentController.getAppointmentById);
 * router.post('/appointments', authenticate, validate(validateAppointmentBooking), appointmentController.bookAppointment);
 * router.put('/appointments/:id/cancel', authenticate, appointmentController.cancelAppointment);
 * router.put('/appointments/:id/reschedule', authenticate, validate(validateAppointmentReschedule), appointmentController.rescheduleAppointment);
 * router.get('/appointments/:id/history', authenticate, appointmentController.getAppointmentHistory);
 * router.post('/appointments/:id/rate', authenticate, appointmentController.rateAppointment);
 * 
 * // Availability
 * router.get('/appointments/available-slots', authenticate, appointmentController.getAvailableSlots);
 * 
 * ======================================================================
 */