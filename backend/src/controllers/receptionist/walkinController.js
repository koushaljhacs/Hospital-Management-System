/**
 * ======================================================================
 * FILE: backend/src/controllers/receptionist/walkinController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist walk-in controller - Handles walk-in patient registration and queue.
 * Total Endpoints: 3
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const walkinService = require('../../services/receptionist/walkinService');
const logger = require('../../utils/logger');

/**
 * Receptionist Walk-in Controller
 */
const walkinController = {
    // ============================================
    // WALK-IN REGISTRATION
    // ============================================

    /**
     * Register walk-in patient
     * POST /api/v1/reception/walk-in
     */
    async registerWalkin(req, res, next) {
        try {
            const walkinData = {
                name: req.body.name,
                phone: req.body.phone,
                email: req.body.email,
                purpose: req.body.purpose,
                preferred_doctor: req.body.preferred_doctor,
                preferred_department: req.body.preferred_department,
                notes: req.body.notes,
                registered_by: req.user.id,
                registered_at: new Date(),
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!walkinData.name) {
                return res.status(400).json({
                    success: false,
                    error: 'Name is required'
                });
            }

            if (!walkinData.phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
            }

            if (!walkinData.purpose) {
                return res.status(400).json({
                    success: false,
                    error: 'Purpose of visit is required'
                });
            }

            // Check if phone already exists in patients
            const existingPatient = await walkinService.findPatientByPhone(walkinData.phone);
            
            let patientId = null;
            if (existingPatient) {
                patientId = existingPatient.id;
                logger.info('Existing patient found for walk-in', {
                    patientId,
                    phone: walkinData.phone
                });
            }

            const walkin = await walkinService.registerWalkin(
                req.user.id,
                walkinData,
                patientId
            );

            logger.info('Receptionist registered walk-in patient', {
                receptionistId: req.user.id,
                walkinId: walkin.id,
                patientName: walkinData.name,
                phone: walkinData.phone,
                isExistingPatient: !!patientId
            });

            res.status(201).json({
                success: true,
                data: walkin,
                message: patientId 
                    ? 'Walk-in registered for existing patient' 
                    : 'New walk-in patient registered'
            });
        } catch (error) {
            logger.error('Error registering walk-in', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Create appointment for walk-in
     * POST /api/v1/reception/walk-in/appointment
     */
    async createWalkinAppointment(req, res, next) {
        try {
            const {
                walkin_id,
                patient_id,
                doctor_id,
                appointment_date,
                appointment_time,
                type,
                reason,
                duration_minutes,
                is_emergency,
                notes
            } = req.body;

            // Validate required fields
            if (!walkin_id && !patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Either walk-in ID or patient ID is required'
                });
            }

            if (!doctor_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Doctor ID is required'
                });
            }

            if (!appointment_date) {
                return res.status(400).json({
                    success: false,
                    error: 'Appointment date is required'
                });
            }

            if (!appointment_time) {
                return res.status(400).json({
                    success: false,
                    error: 'Appointment time is required'
                });
            }

            // Check if date is in past
            const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
            if (appointmentDateTime < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot book appointment in the past'
                });
            }

            // If walkin_id provided, verify it exists
            if (walkin_id) {
                const walkin = await walkinService.getWalkinById(walkin_id);
                if (!walkin) {
                    return res.status(404).json({
                        success: false,
                        error: 'Walk-in record not found'
                    });
                }

                // If walkin has associated patient, use that patient_id
                if (walkin.patient_id && !patient_id) {
                    req.body.patient_id = walkin.patient_id;
                }
            }

            // If still no patient_id, create temporary patient from walkin data
            if (!req.body.patient_id && walkin_id) {
                const walkin = await walkinService.getWalkinById(walkin_id);
                const newPatient = await walkinService.createPatientFromWalkin(walkin, req.user.id);
                req.body.patient_id = newPatient.id;
                
                logger.info('Created patient from walk-in data', {
                    walkinId: walkin_id,
                    patientId: newPatient.id
                });
            }

            if (!req.body.patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            // Check doctor's availability
            const isDoctorAvailable = await walkinService.checkDoctorAvailability(
                doctor_id,
                appointment_date,
                appointment_time
            );

            if (!isDoctorAvailable) {
                return res.status(409).json({
                    success: false,
                    error: 'Doctor is not available at this time'
                });
            }

            // Check slot availability
            const isSlotAvailable = await walkinService.checkSlotAvailability(
                doctor_id,
                appointment_date,
                appointment_time
            );

            if (!isSlotAvailable) {
                return res.status(409).json({
                    success: false,
                    error: 'This time slot is already booked'
                });
            }

            const appointment = await walkinService.createWalkinAppointment(
                req.user.id,
                {
                    walkin_id,
                    patient_id: req.body.patient_id,
                    doctor_id,
                    appointment_date,
                    appointment_time,
                    type: type || 'regular_checkup',
                    reason: reason || 'Walk-in consultation',
                    duration_minutes: duration_minutes || 30,
                    is_emergency: is_emergency || false,
                    notes,
                    created_by: req.user.id
                }
            );

            logger.info('Receptionist created appointment for walk-in', {
                receptionistId: req.user.id,
                appointmentId: appointment.id,
                walkinId: walkin_id,
                patientId: req.body.patient_id,
                doctorId: doctor_id
            });

            // Mark walk-in as processed
            if (walkin_id) {
                await walkinService.markWalkinProcessed(walkin_id, appointment.id);
            }

            res.status(201).json({
                success: true,
                data: appointment,
                message: 'Walk-in appointment created successfully'
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error creating walk-in appointment', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get walk-in queue
     * GET /api/v1/reception/walk-in/queue
     */
    async getWalkinQueue(req, res, next) {
        try {
            const { 
                status = 'waiting', 
                department,
                page = 1, 
                limit = 20 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                department
            };

            const queue = await walkinService.getWalkinQueue(
                req.user.id,
                options
            );

            logger.info('Receptionist viewed walk-in queue', {
                receptionistId: req.user.id,
                count: queue.data?.length || 0,
                status
            });

            // Calculate wait times
            const now = new Date();
            const queueWithWaitTime = queue.data?.map(w => ({
                ...w,
                wait_time_minutes: w.registered_at ? 
                    Math.floor((now - new Date(w.registered_at)) / (1000 * 60)) : 0,
                estimated_wait: w.estimated_wait_time || 15 // Default 15 minutes
            }));

            res.json({
                success: true,
                data: queueWithWaitTime,
                pagination: queue.pagination,
                summary: {
                    total: queue.summary?.total || 0,
                    waiting: queue.summary?.waiting || 0,
                    in_progress: queue.summary?.in_progress || 0,
                    completed: queue.summary?.completed || 0,
                    avg_wait_time: queue.summary?.avg_wait_time || 0
                }
            });
        } catch (error) {
            logger.error('Error getting walk-in queue', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get walk-in by ID
     * GET /api/v1/reception/walk-in/:id
     */
    async getWalkinById(req, res, next) {
        try {
            const { id } = req.params;

            const walkin = await walkinService.getWalkinById(id);

            if (!walkin) {
                return res.status(404).json({
                    success: false,
                    error: 'Walk-in record not found'
                });
            }

            // Calculate wait time
            if (walkin.registered_at && walkin.status === 'waiting') {
                const now = new Date();
                walkin.wait_time_minutes = Math.floor((now - new Date(walkin.registered_at)) / (1000 * 60));
            }

            logger.info('Receptionist viewed walk-in details', {
                receptionistId: req.user.id,
                walkinId: id,
                patientName: walkin.name
            });

            res.json({
                success: true,
                data: walkin
            });
        } catch (error) {
            logger.error('Error getting walk-in by ID', {
                error: error.message,
                receptionistId: req.user.id,
                walkinId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update walk-in status
     * PUT /api/v1/reception/walk-in/:id/status
     */
    async updateWalkinStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }

            const validStatuses = ['waiting', 'called', 'in_progress', 'completed', 'cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status'
                });
            }

            const walkin = await walkinService.updateWalkinStatus(
                req.user.id,
                id,
                status,
                { notes }
            );

            logger.info('Receptionist updated walk-in status', {
                receptionistId: req.user.id,
                walkinId: id,
                newStatus: status
            });

            res.json({
                success: true,
                data: walkin,
                message: `Walk-in status updated to ${status}`
            });
        } catch (error) {
            if (error.message === 'Walk-in record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Walk-in record not found'
                });
            }
            logger.error('Error updating walk-in status', {
                error: error.message,
                receptionistId: req.user.id,
                walkinId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Call next walk-in
     * POST /api/v1/reception/walk-in/next
     */
    async callNextWalkin(req, res, next) {
        try {
            const { department, doctor_id } = req.body;

            const nextWalkin = await walkinService.getNextWalkin({
                department,
                doctor_id
            });

            if (!nextWalkin) {
                return res.json({
                    success: true,
                    data: null,
                    message: 'No walk-in patients in queue'
                });
            }

            // Mark as called
            const updated = await walkinService.updateWalkinStatus(
                req.user.id,
                nextWalkin.id,
                'called',
                { notes: 'Called for consultation' }
            );

            logger.info('Receptionist called next walk-in', {
                receptionistId: req.user.id,
                walkinId: nextWalkin.id,
                patientName: nextWalkin.name
            });

            res.json({
                success: true,
                data: updated,
                message: 'Next walk-in patient called'
            });
        } catch (error) {
            logger.error('Error calling next walk-in', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get walk-in statistics
     * GET /api/v1/reception/walk-in/statistics
     */
    async getWalkinStatistics(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await walkinService.getWalkinStatistics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting walk-in statistics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get walk-in trends
     * GET /api/v1/reception/walk-in/trends
     */
    async getWalkinTrends(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const trends = await walkinService.getWalkinTrends(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: trends
            });
        } catch (error) {
            logger.error('Error getting walk-in trends', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Search walk-in records
     * GET /api/v1/reception/walk-in/search
     */
    async searchWalkins(req, res, next) {
        try {
            const { 
                q,
                from_date,
                to_date,
                status,
                page = 1,
                limit = 20
            } = req.query;

            if (!q && !from_date && !to_date && !status) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one search criteria is required'
                });
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date,
                status
            };

            const results = await walkinService.searchWalkins(
                req.user.id,
                q,
                options
            );

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination
            });
        } catch (error) {
            logger.error('Error searching walk-ins', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export walk-in records
     * GET /api/v1/reception/walk-in/export
     */
    async exportWalkins(req, res, next) {
        try {
            const { 
                format = 'csv', 
                from_date, 
                to_date,
                status 
            } = req.query;

            const data = await walkinService.exportWalkins(
                req.user.id,
                format,
                { from_date, to_date, status }
            );

            logger.info('Receptionist exported walk-in records', {
                receptionistId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=walkins-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting walk-ins', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get average wait time
     * GET /api/v1/reception/walk-in/average-wait-time
     */
    async getAverageWaitTime(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const avgWaitTime = await walkinService.getAverageWaitTime(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: avgWaitTime
            });
        } catch (error) {
            logger.error('Error getting average wait time', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get peak walk-in hours
     * GET /api/v1/reception/walk-in/peak-hours
     */
    async getPeakHours(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const peakHours = await walkinService.getPeakHours(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: peakHours
            });
        } catch (error) {
            logger.error('Error getting peak hours', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = walkinController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Registration           | 1         | Register walk-in
 * Appointment Creation   | 1         | Create appointment from walk-in
 * Queue Management       | 3         | Get queue, get by ID, update status, call next
 * Statistics & Trends    | 3         | Statistics, trends, average wait time, peak hours
 * Search & Export        | 2         | Search, export
 * -----------------------|-----------|----------------------
 * TOTAL                  | 10        | Complete walk-in management
 * 
 * ======================================================================
 */