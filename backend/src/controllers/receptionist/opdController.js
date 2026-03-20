/**
 * ======================================================================
 * FILE: backend/src/controllers/receptionist/opdController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist OPD controller - Handles OPD registration, token generation, and queue.
 * Total Endpoints: 3
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const opdService = require('../../services/receptionist/opdService');
const logger = require('../../utils/logger');

/**
 * Receptionist OPD Controller
 */
const opdController = {
    // ============================================
    // TOKEN MANAGEMENT
    // ============================================

    /**
     * Generate OPD token
     * GET /api/v1/reception/opd/token
     */
    async generateToken(req, res, next) {
        try {
            const { 
                patient_id,
                doctor_id,
                department_id,
                consultation_type,
                priority = 'normal'
            } = req.query;

            // Validate required fields
            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!doctor_id && !department_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Either doctor ID or department ID is required'
                });
            }

            // Get patient details
            const patient = await opdService.getPatientById(patient_id);
            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            // Generate token number
            const tokenNumber = await opdService.generateTokenNumber(
                doctor_id || department_id
            );

            // Get current queue position
            const queuePosition = await opdService.getQueuePosition(
                doctor_id || department_id
            );

            // Estimate wait time (assuming 15 minutes per patient)
            const estimatedWaitMinutes = queuePosition * 15;

            const token = {
                token_number: tokenNumber,
                patient_name: `${patient.first_name} ${patient.last_name}`,
                patient_id: patient.id,
                doctor_id,
                department_id,
                consultation_type: consultation_type || 'general',
                priority,
                queue_position: queuePosition + 1,
                estimated_wait_minutes: estimatedWaitMinutes,
                generated_at: new Date().toISOString(),
                valid_until: new Date(Date.now() + 30 * 60000).toISOString() // Valid for 30 minutes
            };

            logger.info('Receptionist generated OPD token', {
                receptionistId: req.user.id,
                patientId: patient_id,
                tokenNumber,
                doctorId: doctor_id,
                departmentId: department_id
            });

            res.json({
                success: true,
                data: token,
                message: 'OPD token generated successfully'
            });
        } catch (error) {
            logger.error('Error generating OPD token', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get OPD queue
     * GET /api/v1/reception/opd/queue
     */
    async getOPDQueue(req, res, next) {
        try {
            const { 
                doctor_id,
                department_id,
                status = 'waiting',
                page = 1, 
                limit = 50 
            } = req.query;

            if (!doctor_id && !department_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Either doctor ID or department ID is required'
                });
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                doctor_id,
                department_id
            };

            const queue = await opdService.getOPDQueue(
                req.user.id,
                options
            );

            logger.info('Receptionist viewed OPD queue', {
                receptionistId: req.user.id,
                doctorId: doctor_id,
                departmentId: department_id,
                count: queue.data?.length || 0
            });

            // Calculate estimated wait times
            const now = new Date();
            const queueWithEstimates = queue.data?.map((item, index) => {
                const position = index + 1;
                const waitingSince = item.token_generated_at ? 
                    Math.floor((now - new Date(item.token_generated_at)) / (1000 * 60)) : 0;
                
                return {
                    ...item,
                    queue_position: position,
                    waiting_minutes: waitingSince,
                    estimated_wait_minutes: position * 15, // 15 minutes per patient
                    is_waiting_long: waitingSince > 30 // More than 30 minutes
                };
            });

            res.json({
                success: true,
                data: queueWithEstimates,
                pagination: queue.pagination,
                summary: {
                    total: queue.summary?.total || 0,
                    waiting: queue.summary?.waiting || 0,
                    in_consultation: queue.summary?.in_consultation || 0,
                    completed: queue.summary?.completed || 0,
                    cancelled: queue.summary?.cancelled || 0,
                    average_wait_time: queue.summary?.average_wait_time || 0
                }
            });
        } catch (error) {
            logger.error('Error getting OPD queue', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Register for OPD
     * POST /api/v1/reception/opd/register
     */
    async registerOPD(req, res, next) {
        try {
            const registrationData = {
                patient_id: req.body.patient_id,
                doctor_id: req.body.doctor_id,
                department_id: req.body.department_id,
                consultation_type: req.body.consultation_type || 'general',
                fees: req.body.fees,
                payment_method: req.body.payment_method,
                payment_status: req.body.payment_status || 'pending',
                priority: req.body.priority || 'normal',
                symptoms: req.body.symptoms,
                notes: req.body.notes,
                registered_by: req.user.id,
                registration_date: new Date(),
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!registrationData.patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!registrationData.doctor_id && !registrationData.department_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Either doctor ID or department ID is required'
                });
            }

            // Get patient details
            const patient = await opdService.getPatientById(registrationData.patient_id);
            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            // Check if doctor is available (if doctor_id provided)
            if (registrationData.doctor_id) {
                const isDoctorAvailable = await opdService.checkDoctorAvailability(
                    registrationData.doctor_id
                );
                if (!isDoctorAvailable) {
                    return res.status(409).json({
                        success: false,
                        error: 'Doctor is not available for OPD'
                    });
                }
            }

            // Generate token number
            const tokenNumber = await opdService.generateTokenNumber(
                registrationData.doctor_id || registrationData.department_id
            );

            // Get current queue position
            const queuePosition = await opdService.getQueuePosition(
                registrationData.doctor_id || registrationData.department_id
            );

            const registration = await opdService.registerOPD(
                req.user.id,
                {
                    ...registrationData,
                    token_number: tokenNumber,
                    queue_position: queuePosition + 1
                }
            );

            logger.info('Receptionist registered patient for OPD', {
                receptionistId: req.user.id,
                registrationId: registration.id,
                patientId: registrationData.patient_id,
                patientName: `${patient.first_name} ${patient.last_name}`,
                tokenNumber,
                doctorId: registrationData.doctor_id,
                departmentId: registrationData.department_id
            });

            res.status(201).json({
                success: true,
                data: {
                    ...registration,
                    estimated_wait_minutes: (queuePosition + 1) * 15,
                    token_valid_until: new Date(Date.now() + 30 * 60000)
                },
                message: 'OPD registration successful'
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error registering for OPD', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update OPD registration status
     * PUT /api/v1/reception/opd/:id/status
     */
    async updateOPDStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            if (!status) {
                return res.status(400).json({
                    success: false,
                    error: 'Status is required'
                });
            }

            const validStatuses = ['waiting', 'called', 'in_consultation', 'completed', 'cancelled', 'no_show'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid status'
                });
            }

            const registration = await opdService.updateOPDStatus(
                req.user.id,
                id,
                status,
                { notes }
            );

            logger.info('Receptionist updated OPD status', {
                receptionistId: req.user.id,
                registrationId: id,
                newStatus: status
            });

            res.json({
                success: true,
                data: registration,
                message: `OPD status updated to ${status}`
            });
        } catch (error) {
            if (error.message === 'Registration not found') {
                return res.status(404).json({
                    success: false,
                    error: 'OPD registration not found'
                });
            }
            logger.error('Error updating OPD status', {
                error: error.message,
                receptionistId: req.user.id,
                registrationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get OPD registration by ID
     * GET /api/v1/reception/opd/:id
     */
    async getOPDById(req, res, next) {
        try {
            const { id } = req.params;

            const registration = await opdService.getOPDById(id);

            if (!registration) {
                return res.status(404).json({
                    success: false,
                    error: 'OPD registration not found'
                });
            }

            // Calculate wait time
            if (registration.registration_date && registration.status === 'waiting') {
                const now = new Date();
                registration.wait_time_minutes = Math.floor((now - new Date(registration.registration_date)) / (1000 * 60));
                registration.estimated_remaining = Math.max(0, (registration.queue_position * 15) - registration.wait_time_minutes);
            }

            res.json({
                success: true,
                data: registration
            });
        } catch (error) {
            logger.error('Error getting OPD registration', {
                error: error.message,
                receptionistId: req.user.id,
                registrationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get today's OPD registrations
     * GET /api/v1/reception/opd/today
     */
    async getTodaysOPD(req, res, next) {
        try {
            const { doctor_id, department_id } = req.query;

            const registrations = await opdService.getTodaysOPD(
                req.user.id,
                { doctor_id, department_id }
            );

            // Group by status
            const byStatus = {
                waiting: registrations.filter(r => r.status === 'waiting').length,
                called: registrations.filter(r => r.status === 'called').length,
                in_consultation: registrations.filter(r => r.status === 'in_consultation').length,
                completed: registrations.filter(r => r.status === 'completed').length,
                cancelled: registrations.filter(r => r.status === 'cancelled').length,
                no_show: registrations.filter(r => r.status === 'no_show').length
            };

            res.json({
                success: true,
                data: registrations,
                summary: {
                    total: registrations.length,
                    by_status: byStatus,
                    completed_count: byStatus.completed,
                    pending_count: byStatus.waiting + byStatus.called + byStatus.in_consultation
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s OPD', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get OPD statistics
     * GET /api/v1/reception/opd/statistics
     */
    async getOPDStatistics(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await opdService.getOPDStatistics(
                req.user.id,
                period
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting OPD statistics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get doctor-wise OPD count
     * GET /api/v1/reception/opd/doctor-wise
     */
    async getDoctorWiseOPD(req, res, next) {
        try {
            const { date } = req.query;

            const stats = await opdService.getDoctorWiseOPD(
                req.user.id,
                date
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting doctor-wise OPD', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get department-wise OPD count
     * GET /api/v1/reception/opd/department-wise
     */
    async getDepartmentWiseOPD(req, res, next) {
        try {
            const { date } = req.query;

            const stats = await opdService.getDepartmentWiseOPD(
                req.user.id,
                date
            );

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting department-wise OPD', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Call next patient
     * POST /api/v1/reception/opd/next
     */
    async callNextPatient(req, res, next) {
        try {
            const { doctor_id, department_id } = req.body;

            if (!doctor_id && !department_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Either doctor ID or department ID is required'
                });
            }

            const nextPatient = await opdService.getNextPatient(
                doctor_id,
                department_id
            );

            if (!nextPatient) {
                return res.json({
                    success: true,
                    data: null,
                    message: 'No patients in queue'
                });
            }

            // Mark as called
            const updated = await opdService.updateOPDStatus(
                req.user.id,
                nextPatient.id,
                'called',
                { notes: 'Called for consultation' }
            );

            logger.info('Receptionist called next OPD patient', {
                receptionistId: req.user.id,
                patientId: nextPatient.patient_id,
                tokenNumber: nextPatient.token_number
            });

            res.json({
                success: true,
                data: updated,
                message: 'Next patient called'
            });
        } catch (error) {
            logger.error('Error calling next patient', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Search OPD registrations
     * GET /api/v1/reception/opd/search
     */
    async searchOPD(req, res, next) {
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

            const results = await opdService.searchOPD(
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
            logger.error('Error searching OPD', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export OPD records
     * GET /api/v1/reception/opd/export
     */
    async exportOPD(req, res, next) {
        try {
            const { 
                format = 'csv', 
                from_date, 
                to_date,
                doctor_id,
                department_id 
            } = req.query;

            const data = await opdService.exportOPD(
                req.user.id,
                format,
                { from_date, to_date, doctor_id, department_id }
            );

            logger.info('Receptionist exported OPD records', {
                receptionistId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=opd-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting OPD', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get average consultation time
     * GET /api/v1/reception/opd/average-time
     */
    async getAverageConsultationTime(req, res, next) {
        try {
            const { doctor_id, department_id, days = 30 } = req.query;

            const avgTime = await opdService.getAverageConsultationTime(
                req.user.id,
                { doctor_id, department_id, days: parseInt(days) }
            );

            res.json({
                success: true,
                data: avgTime
            });
        } catch (error) {
            logger.error('Error getting average consultation time', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get peak OPD hours
     * GET /api/v1/reception/opd/peak-hours
     */
    async getPeakOPDHours(req, res, next) {
        try {
            const { days = 30 } = req.query;

            const peakHours = await opdService.getPeakOPDHours(
                req.user.id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: peakHours
            });
        } catch (error) {
            logger.error('Error getting peak OPD hours', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = opdController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Token Management       | 1         | Generate token
 * Registration           | 2         | Register, get by ID
 * Queue Management       | 4         | Get queue, update status, get today's, call next
 * Statistics & Analytics | 5         | Statistics, doctor-wise, department-wise, avg time, peak hours
 * Search & Export        | 2         | Search, export
 * -----------------------|-----------|----------------------
 * TOTAL                  | 14        | Complete OPD management
 * 
 * ======================================================================
 */