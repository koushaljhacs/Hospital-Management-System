/**
 * ======================================================================
 * FILE: backend/src/controllers/doctor/patientController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor's patient management controller.
 * Allows doctors to view assigned patients, search, and access medical history.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ENDPOINTS:
 * GET    /doctor/patients                    - Get assigned patients
 * GET    /doctor/patients/search              - Search patients
 * GET    /doctor/patients/recent               - Get recent patients
 * GET    /doctor/patients/:id                   - Get patient by ID
 * GET    /doctor/patients/:id/history            - Get full patient history
 * GET    /doctor/patients/:id/vitals              - Get patient vitals
 * GET    /doctor/patients/:id/lab-results         - Get patient lab results
 * GET    /doctor/patients/:id/radiology           - Get patient radiology
 * GET    /doctor/patients/:id/prescriptions       - Get patient prescriptions
 * POST   /doctor/patients/:id/assign              - Assign patient to self
 * 
 * ======================================================================
 */

const patientService = require('../../services/patient/patientService');
const logger = require('../../utils/logger');

/**
 * Doctor Patient Controller
 */
const patientController = {
    // ============================================
    // PATIENT LISTS
    // ============================================

    /**
     * Get assigned patients
     * GET /api/v1/doctor/patients
     */
    async getAssignedPatients(req, res, next) {
        try {
            const { page = 1, limit = 20, search, status } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                search,
                status
            };

            const patients = await patientService.getAssignedPatients(req.user.id, options);

            logger.info('Doctor retrieved assigned patients', {
                doctorId: req.user.id,
                count: patients.data?.length || 0
            });

            res.json({
                success: true,
                data: patients.data,
                pagination: patients.pagination
            });
        } catch (error) {
            logger.error('Error getting assigned patients', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Search patients
     * GET /api/v1/doctor/patients/search
     */
    async searchPatients(req, res, next) {
        try {
            const { search, page = 1, limit = 20 } = req.query;

            if (!search || search.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Search term must be at least 2 characters'
                });
            }

            const results = await patientService.searchPatients(
                req.user.id,
                search,
                {
                    page: parseInt(page),
                    limit: parseInt(limit)
                }
            );

            logger.info('Doctor searched patients', {
                doctorId: req.user.id,
                searchTerm: search,
                resultCount: results.data?.length || 0
            });

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination
            });
        } catch (error) {
            logger.error('Error searching patients', {
                error: error.message,
                doctorId: req.user.id,
                search: req.query.search
            });
            next(error);
        }
    },

    /**
     * Get recent patients
     * GET /api/v1/doctor/patients/recent
     */
    async getRecentPatients(req, res, next) {
        try {
            const { limit = 10 } = req.query;

            const patients = await patientService.getRecentPatients(
                req.user.id,
                parseInt(limit)
            );

            logger.info('Doctor retrieved recent patients', {
                doctorId: req.user.id,
                count: patients.length
            });

            res.json({
                success: true,
                data: patients
            });
        } catch (error) {
            logger.error('Error getting recent patients', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // SINGLE PATIENT VIEWS
    // ============================================

    /**
     * Get patient by ID
     * GET /api/v1/doctor/patients/:id
     */
    async getPatientById(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientById(req.user.id, id);

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Doctor viewed patient details', {
                doctorId: req.user.id,
                patientId: id
            });

            res.json({
                success: true,
                data: patient
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            logger.error('Error getting patient by ID', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get full patient history
     * GET /api/v1/doctor/patients/:id/history
     */
    async getPatientHistory(req, res, next) {
        try {
            const { id } = req.params;
            const { from, to } = req.query;

            const history = await patientService.getPatientHistory(
                req.user.id,
                id,
                { from, to }
            );

            logger.info('Doctor viewed patient history', {
                doctorId: req.user.id,
                patientId: id
            });

            res.json({
                success: true,
                data: history
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            logger.error('Error getting patient history', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient vitals
     * GET /api/v1/doctor/patients/:id/vitals
     */
    async getPatientVitals(req, res, next) {
        try {
            const { id } = req.params;
            const { limit = 20 } = req.query;

            const vitals = await patientService.getPatientVitals(
                req.user.id,
                id,
                parseInt(limit)
            );

            logger.info('Doctor viewed patient vitals', {
                doctorId: req.user.id,
                patientId: id,
                count: vitals.length
            });

            res.json({
                success: true,
                data: vitals
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            logger.error('Error getting patient vitals', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient lab results
     * GET /api/v1/doctor/patients/:id/lab-results
     */
    async getPatientLabResults(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20, status } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status
            };

            const results = await patientService.getPatientLabResults(
                req.user.id,
                id,
                options
            );

            logger.info('Doctor viewed patient lab results', {
                doctorId: req.user.id,
                patientId: id,
                count: results.data?.length || 0
            });

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            logger.error('Error getting patient lab results', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient radiology images
     * GET /api/v1/doctor/patients/:id/radiology
     */
    async getPatientRadiology(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const images = await patientService.getPatientRadiology(
                req.user.id,
                id,
                options
            );

            logger.info('Doctor viewed patient radiology', {
                doctorId: req.user.id,
                patientId: id,
                count: images.data?.length || 0
            });

            res.json({
                success: true,
                data: images.data,
                pagination: images.pagination
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            logger.error('Error getting patient radiology', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient prescriptions
     * GET /api/v1/doctor/patients/:id/prescriptions
     */
    async getPatientPrescriptions(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20, active } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                active: active === 'true'
            };

            const prescriptions = await patientService.getPatientPrescriptions(
                req.user.id,
                id,
                options
            );

            logger.info('Doctor viewed patient prescriptions', {
                doctorId: req.user.id,
                patientId: id,
                count: prescriptions.data?.length || 0
            });

            res.json({
                success: true,
                data: prescriptions.data,
                pagination: prescriptions.pagination
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            logger.error('Error getting patient prescriptions', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT ASSIGNMENT
    // ============================================

    /**
     * Assign patient to self
     * POST /api/v1/doctor/patients/:id/assign
     */
    async assignPatientToSelf(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const result = await patientService.assignPatientToSelf(
                req.user.id,
                id,
                reason
            );

            logger.info('Doctor assigned patient to self', {
                doctorId: req.user.id,
                patientId: id,
                reason
            });

            res.json({
                success: true,
                data: result,
                message: 'Patient assigned successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Patient already assigned') {
                return res.status(409).json({
                    success: false,
                    error: 'Patient is already assigned to another doctor'
                });
            }
            logger.error('Error assigning patient', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT SUMMARY & DASHBOARD
    // ============================================

    /**
     * Get patient summary (quick overview)
     * GET /api/v1/doctor/patients/:id/summary
     */
    async getPatientSummary(req, res, next) {
        try {
            const { id } = req.params;

            const summary = await patientService.getPatientSummary(
                req.user.id,
                id
            );

            res.json({
                success: true,
                data: summary
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            next(error);
        }
    },

    /**
     * Get patient upcoming appointments
     * GET /api/v1/doctor/patients/:id/upcoming-appointments
     */
    async getPatientUpcomingAppointments(req, res, next) {
        try {
            const { id } = req.params;
            const { limit = 5 } = req.query;

            const appointments = await patientService.getPatientUpcomingAppointments(
                req.user.id,
                id,
                parseInt(limit)
            );

            res.json({
                success: true,
                data: appointments
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            next(error);
        }
    },

    /**
     * Get patient conditions and allergies
     * GET /api/v1/doctor/patients/:id/conditions
     */
    async getPatientConditions(req, res, next) {
        try {
            const { id } = req.params;

            const conditions = await patientService.getPatientConditions(
                req.user.id,
                id
            );

            res.json({
                success: true,
                data: conditions
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            next(error);
        }
    },

    /**
     * Download patient report
     * GET /api/v1/doctor/patients/:id/report
     */
    async downloadPatientReport(req, res, next) {
        try {
            const { id } = req.params;
            const { format = 'pdf' } = req.query;

            const report = await patientService.generatePatientReport(
                req.user.id,
                id,
                format
            );

            logger.info('Doctor downloaded patient report', {
                doctorId: req.user.id,
                patientId: id,
                format
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=patient-${id}-report.pdf`);
                return res.send(report);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=patient-${id}-report.csv`);
                return res.send(report);
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            next(error);
        }
    },

    /**
     * Add patient note
     * POST /api/v1/doctor/patients/:id/notes
     */
    async addPatientNote(req, res, next) {
        try {
            const { id } = req.params;
            const { note, type = 'general' } = req.body;

            if (!note || note.trim().length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Note must be at least 5 characters'
                });
            }

            const result = await patientService.addPatientNote(
                req.user.id,
                id,
                {
                    note,
                    type,
                    created_at: new Date()
                }
            );

            logger.info('Doctor added patient note', {
                doctorId: req.user.id,
                patientId: id,
                noteType: type
            });

            res.json({
                success: true,
                data: result,
                message: 'Note added successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message === 'Access denied') {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have access to this patient'
                });
            }
            next(error);
        }
    }
};

module.exports = patientController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category            | Endpoints | Description
 * --------------------|-----------|----------------------
 * Patient Lists       | 3         | Assigned, search, recent
 * Single Patient      | 5         | Details, history, vitals, lab, radiology, prescriptions
 * Patient Assignment  | 1         | Assign to self
 * Patient Summary     | 4         | Summary, appointments, conditions, report
 * Patient Notes       | 1         | Add notes
 * --------------------|-----------|----------------------
 * TOTAL               | 14        | Complete patient management for doctors
 * 
 * ======================================================================
 */