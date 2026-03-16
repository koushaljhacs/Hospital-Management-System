/**
 * ======================================================================
 * FILE: backend/src/controllers/nurse/patientCareController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse patient care controller - Handles assigned patients,
 * patient searches, and patient information viewing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ENDPOINTS:
 * GET    /nurse/patients                    - Get assigned patients (ward-wise)
 * GET    /nurse/patients/search             - Search patients
 * GET    /nurse/patients/:id                 - Get patient details
 * GET    /nurse/patients/:id/vitals          - Get patient vitals
 * GET    /nurse/patients/:id/medications     - Get patient medications
 * GET    /nurse/patients/:id/tasks           - Get patient tasks
 * 
 * ======================================================================
 */

const patientCareService = require('../../services/nurse/patientCareService');
const logger = require('../../utils/logger');

/**
 * Nurse Patient Care Controller
 */
const patientCareController = {
    // ============================================
    // PATIENT LISTS
    // ============================================

    /**
     * Get assigned patients (ward-wise)
     * GET /api/v1/nurse/patients
     */
    async getAssignedPatients(req, res, next) {
        try {
            const { page = 1, limit = 20, ward, status } = req.query;

            // Get nurse's assigned ward from user data
            const nurseWard = req.user.ward; // This will come from JWT/user data

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward: ward || nurseWard, // If specific ward requested, use that
                status
            };

            const patients = await patientCareService.getAssignedPatients(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved assigned patients', {
                nurseId: req.user.id,
                ward: options.ward,
                count: patients.data?.length || 0
            });

            res.json({
                success: true,
                data: patients.data,
                pagination: patients.pagination,
                summary: patients.summary
            });
        } catch (error) {
            logger.error('Error getting assigned patients', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Search patients
     * GET /api/v1/nurse/patients/search
     */
    async searchPatients(req, res, next) {
        try {
            const { 
                search, 
                page = 1, 
                limit = 20,
                ward,
                bed,
                status 
            } = req.query;

            if (!search || search.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Search term must be at least 2 characters'
                });
            }

            const nurseWard = req.user.ward;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward: ward || nurseWard,
                bed,
                status
            };

            const results = await patientCareService.searchPatients(
                req.user.id,
                search,
                options
            );

            logger.info('Nurse searched patients', {
                nurseId: req.user.id,
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
                nurseId: req.user.id,
                search: req.query.search
            });
            next(error);
        }
    },

    // ============================================
    // SINGLE PATIENT VIEWS
    // ============================================

    /**
     * Get patient by ID
     * GET /api/v1/nurse/patients/:id
     */
    async getPatientById(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientCareService.getPatientById(
                req.user.id,
                id
            );

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Nurse viewed patient details', {
                nurseId: req.user.id,
                patientId: id
            });

            // [SR-13] Audit PHI access
            logger.audit({
                action: 'NURSE_VIEW_PATIENT',
                userId: req.user.id,
                resource: 'patients',
                resourceId: id
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
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient vitals
     * GET /api/v1/nurse/patients/:id/vitals
     */
    async getPatientVitals(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                page = 1, 
                limit = 20,
                from_date,
                to_date,
                type 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date,
                type
            };

            const vitals = await patientCareService.getPatientVitals(
                req.user.id,
                id,
                options
            );

            if (!vitals) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Nurse viewed patient vitals', {
                nurseId: req.user.id,
                patientId: id,
                count: vitals.data?.length || 0
            });

            // Check for critical values [BR-36]
            const criticalCount = vitals.data?.filter(v => v.is_critical).length || 0;
            if (criticalCount > 0) {
                logger.warn('Critical vitals viewed', {
                    nurseId: req.user.id,
                    patientId: id,
                    criticalCount
                });
            }

            res.json({
                success: true,
                data: vitals.data,
                pagination: vitals.pagination,
                summary: {
                    latest: vitals.latest,
                    critical_count: criticalCount,
                    trends: vitals.trends
                }
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
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient medications
     * GET /api/v1/nurse/patients/:id/medications
     */
    async getPatientMedications(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                page = 1, 
                limit = 20,
                status,
                from_date,
                to_date 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                from_date,
                to_date
            };

            const medications = await patientCareService.getPatientMedications(
                req.user.id,
                id,
                options
            );

            if (!medications) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Nurse viewed patient medications', {
                nurseId: req.user.id,
                patientId: id,
                count: medications.data?.length || 0
            });

            // Get due medications count
            const dueNow = medications.data?.filter(m => 
                m.status === 'scheduled' && 
                new Date(m.scheduled_time) <= new Date()
            ).length || 0;

            res.json({
                success: true,
                data: medications.data,
                pagination: medications.pagination,
                summary: {
                    total: medications.summary?.total || 0,
                    scheduled: medications.summary?.scheduled || 0,
                    administered: medications.summary?.administered || 0,
                    missed: medications.summary?.missed || 0,
                    due_now: dueNow,
                    next_due: medications.next_due
                }
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
            logger.error('Error getting patient medications', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient tasks
     * GET /api/v1/nurse/patients/:id/tasks
     */
    async getPatientTasks(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                page = 1, 
                limit = 20,
                status,
                priority,
                from_date,
                to_date 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                priority,
                from_date,
                to_date
            };

            const tasks = await patientCareService.getPatientTasks(
                req.user.id,
                id,
                options
            );

            if (!tasks) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Nurse viewed patient tasks', {
                nurseId: req.user.id,
                patientId: id,
                count: tasks.data?.length || 0
            });

            // Group tasks by priority
            const byPriority = {
                urgent: tasks.data?.filter(t => t.priority === 'urgent').length || 0,
                high: tasks.data?.filter(t => t.priority === 'high').length || 0,
                medium: tasks.data?.filter(t => t.priority === 'medium').length || 0,
                low: tasks.data?.filter(t => t.priority === 'low').length || 0
            };

            res.json({
                success: true,
                data: tasks.data,
                pagination: tasks.pagination,
                summary: {
                    total: tasks.summary?.total || 0,
                    pending: tasks.summary?.pending || 0,
                    in_progress: tasks.summary?.in_progress || 0,
                    completed: tasks.summary?.completed || 0,
                    by_priority: byPriority
                }
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
            logger.error('Error getting patient tasks', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT SUMMARY & QUICK INFO
    // ============================================

    /**
     * Get patient summary (quick overview for nurse)
     * GET /api/v1/nurse/patients/:id/summary
     */
    async getPatientSummary(req, res, next) {
        try {
            const { id } = req.params;

            const summary = await patientCareService.getPatientSummary(
                req.user.id,
                id
            );

            if (!summary) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Nurse viewed patient summary', {
                nurseId: req.user.id,
                patientId: id
            });

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
            logger.error('Error getting patient summary', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient allergies and alerts
     * GET /api/v1/nurse/patients/:id/alerts
     */
    async getPatientAlerts(req, res, next) {
        try {
            const { id } = req.params;

            const alerts = await patientCareService.getPatientAlerts(
                req.user.id,
                id
            );

            if (!alerts) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Nurse viewed patient alerts', {
                nurseId: req.user.id,
                patientId: id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts
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
            logger.error('Error getting patient alerts', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patients by room/bed
     * GET /api/v1/nurse/patients/by-room/:room
     */
    async getPatientsByRoom(req, res, next) {
        try {
            const { room } = req.params;

            const patients = await patientCareService.getPatientsByRoom(
                req.user.id,
                room
            );

            logger.info('Nurse viewed patients by room', {
                nurseId: req.user.id,
                room,
                count: patients.length
            });

            res.json({
                success: true,
                data: patients
            });
        } catch (error) {
            logger.error('Error getting patients by room', {
                error: error.message,
                nurseId: req.user.id,
                room: req.params.room
            });
            next(error);
        }
    },

    /**
     * Get ward census (all patients in ward with bed numbers)
     * GET /api/v1/nurse/patients/ward-census
     */
    async getWardCensus(req, res, next) {
        try {
            const nurseWard = req.user.ward;

            const census = await patientCareService.getWardCensus(
                req.user.id,
                nurseWard
            );

            logger.info('Nurse viewed ward census', {
                nurseId: req.user.id,
                ward: nurseWard,
                totalPatients: census.total,
                occupiedBeds: census.occupied_beds
            });

            res.json({
                success: true,
                data: census
            });
        } catch (error) {
            logger.error('Error getting ward census', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT NOTES & OBSERVATIONS
    // ============================================

    /**
     * Add patient observation note
     * POST /api/v1/nurse/patients/:id/notes
     */
    async addPatientNote(req, res, next) {
        try {
            const { id } = req.params;
            const { note, type = 'observation' } = req.body;

            if (!note || note.trim().length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Note must be at least 5 characters'
                });
            }

            const result = await patientCareService.addPatientNote(
                req.user.id,
                id,
                {
                    note,
                    type,
                    created_at: new Date()
                }
            );

            logger.info('Nurse added patient note', {
                nurseId: req.user.id,
                patientId: id,
                noteType: type
            });

            res.status(201).json({
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
            logger.error('Error adding patient note', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient observation notes
     * GET /api/v1/nurse/patients/:id/notes
     */
    async getPatientNotes(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const notes = await patientCareService.getPatientNotes(
                req.user.id,
                id,
                options
            );

            if (!notes) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Nurse viewed patient notes', {
                nurseId: req.user.id,
                patientId: id,
                count: notes.data?.length || 0
            });

            res.json({
                success: true,
                data: notes.data,
                pagination: notes.pagination
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
            logger.error('Error getting patient notes', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT TRANSFERS
    // ============================================

    /**
     * Transfer patient to another ward/room
     * POST /api/v1/nurse/patients/:id/transfer
     */
    async transferPatient(req, res, next) {
        try {
            const { id } = req.params;
            const { target_ward, target_room, target_bed, reason } = req.body;

            if (!target_ward || !target_room || !target_bed) {
                return res.status(400).json({
                    success: false,
                    error: 'Target ward, room, and bed are required'
                });
            }

            const transfer = await patientCareService.transferPatient(
                req.user.id,
                id,
                {
                    target_ward,
                    target_room,
                    target_bed,
                    reason
                }
            );

            logger.info('Nurse transferred patient', {
                nurseId: req.user.id,
                patientId: id,
                fromWard: transfer.from_ward,
                toWard: target_ward
            });

            res.json({
                success: true,
                data: transfer,
                message: 'Patient transferred successfully'
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
            if (error.message.includes('Bed not available')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error transferring patient', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Discharge patient
     * POST /api/v1/nurse/patients/:id/discharge
     */
    async dischargePatient(req, res, next) {
        try {
            const { id } = req.params;
            const { discharge_notes, discharged_by } = req.body;

            if (!discharge_notes) {
                return res.status(400).json({
                    success: false,
                    error: 'Discharge notes are required'
                });
            }

            const discharge = await patientCareService.dischargePatient(
                req.user.id,
                id,
                {
                    discharge_notes,
                    discharged_by: discharged_by || req.user.id,
                    discharge_date: new Date()
                }
            );

            logger.info('Nurse discharged patient', {
                nurseId: req.user.id,
                patientId: id
            });

            res.json({
                success: true,
                data: discharge,
                message: 'Patient discharged successfully'
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
            logger.error('Error discharging patient', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = patientCareController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Patient Lists          | 2         | Assigned patients, search
 * Single Patient Views   | 6         | Details, vitals, medications, tasks, summary, alerts
 * Room/Ward Views        | 2         | By room, ward census
 * Patient Notes          | 2         | Add notes, view notes
 * Patient Transfers      | 2         | Transfer, discharge
 * -----------------------|-----------|----------------------
 * TOTAL                  | 14        | Complete patient care management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical vitals detection
 * - [BR-16] Controlled substance tracking
 * - [BR-24] to [BR-28] Bed management rules
 * - [SR-13] PHI access logging
 * 
 * ======================================================================
 */