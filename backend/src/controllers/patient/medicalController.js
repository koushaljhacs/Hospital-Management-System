/**
 * ======================================================================
 * FILE: backend/src/controllers/patient/medicalController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient medical records controller handling all health-related data.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ENDPOINTS:
 * GET    /patient/medical-records              - All medical records
 * GET    /patient/medical-records/summary          - Health summary
 * GET    /patient/medical-records/timeline          - Timeline view
 * GET    /patient/prescriptions                        - All prescriptions
 * GET    /patient/prescriptions/active                    - Active prescriptions
 * GET    /patient/prescriptions/history                      - Prescription history
 * GET    /patient/prescriptions/:id                             - Get prescription
 * GET    /patient/prescriptions/:id/pdf                            - Download PDF
 * GET    /patient/lab-results                                       - All lab results
 * GET    /patient/lab-results/pending                                - Pending results
 * GET    /patient/lab-results/completed                                - Completed results
 * GET    /patient/lab-results/:id                                         - Get result
 * GET    /patient/lab-results/:id/pdf                                      - Download PDF
 * GET    /patient/radiology-images                                         - All images
 * GET    /patient/radiology-images/:id                                      - Get image
 * GET    /patient/radiology-images/:id/download                               - Download image
 * GET    /patient/vitals                                                     - Vital history
 * GET    /patient/vitals/latest                                               - Latest vitals
 * GET    /patient/vitals/trends                                                 - Vital trends
 * GET    /patient/diagnosis                                                       - Diagnosis history
 * GET    /patient/visits                                                           - Visit history
 * GET    /patient/visits/:id                                                         - Get visit
 * 
 * ======================================================================
 */

const medicalService = require('../../services/patient/medicalService');
const patientService = require('../../services/patient/patientService');
const logger = require('../../utils/logger');

/**
 * Patient Medical Controller
 */
const medicalController = {
    // ============================================
    // MEDICAL RECORDS
    // ============================================

    /**
     * Get complete medical history
     * GET /api/v1/patient/medical-records
     */
    async getMedicalRecords(req, res, next) {
        try {
            const { startDate, endDate, type } = req.query;
            
            const filters = {
                startDate,
                endDate,
                type
            };

            const records = await patientService.getMedicalHistory(req.user.id, filters);

            logger.info('Medical records retrieved', { 
                userId: req.user.id,
                filters: Object.keys(filters).filter(k => filters[k])
            });

            res.json({
                success: true,
                data: records
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
     * Get health summary
     * GET /api/v1/patient/medical-records/summary
     */
    async getHealthSummary(req, res, next) {
        try {
            const records = await patientService.getMedicalHistory(req.user.id);
            
            const summary = {
                blood_group: records.blood_group,
                allergies: records.allergies,
                medical_conditions: records.medical_conditions,
                stats: records.summary,
                recent_vitals: records.medical_history?.vitals?.[0] || null,
                recent_lab_results: records.medical_history?.lab_results?.slice(0, 5) || [],
                recent_prescriptions: records.medical_history?.prescriptions?.slice(0, 5) || []
            };

            logger.info('Health summary retrieved', { 
                userId: req.user.id
            });

            res.json({
                success: true,
                data: summary
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
     * Get medical timeline
     * GET /api/v1/patient/medical-records/timeline
     */
    async getMedicalTimeline(req, res, next) {
        try {
            const { months = 6 } = req.query;
            const records = await patientService.getMedicalHistory(req.user.id);
            
            // Combine all events into a single timeline
            const timeline = [];
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - parseInt(months));

            // Add appointments
            records.medical_history?.appointments?.forEach(apt => {
                const date = new Date(apt.appointment_date);
                if (date >= sixMonthsAgo) {
                    timeline.push({
                        id: apt.id,
                        type: 'appointment',
                        date: apt.appointment_date,
                        time: apt.appointment_time,
                        title: `Appointment with Dr. ${apt.doctor_first_name} ${apt.doctor_last_name}`,
                        description: apt.reason,
                        status: apt.status,
                        icon: 'calendar'
                    });
                }
            });

            // Add prescriptions
            records.medical_history?.prescriptions?.forEach(pres => {
                const date = new Date(pres.created_at);
                if (date >= sixMonthsAgo) {
                    timeline.push({
                        id: pres.id,
                        type: 'prescription',
                        date: pres.created_at,
                        title: 'Prescription issued',
                        description: `${pres.medicines?.length || 0} medicines prescribed`,
                        doctor: `Dr. ${pres.doctor_first_name} ${pres.doctor_last_name}`,
                        icon: 'prescription'
                    });
                }
            });

            // Add lab results
            records.medical_history?.lab_results?.forEach(lab => {
                const date = new Date(lab.tested_at);
                if (date >= sixMonthsAgo) {
                    timeline.push({
                        id: lab.id,
                        type: 'lab_result',
                        date: lab.tested_at,
                        title: `${lab.test_name}`,
                        description: lab.is_critical ? 'Critical result' : 'Normal result',
                        status: lab.is_critical ? 'critical' : 'normal',
                        icon: 'lab'
                    });
                }
            });

            // Add radiology
            records.medical_history?.radiology?.forEach(rad => {
                const date = new Date(rad.uploaded_at);
                if (date >= sixMonthsAgo) {
                    timeline.push({
                        id: rad.id,
                        type: 'radiology',
                        date: rad.uploaded_at,
                        title: `${rad.image_type || 'Radiology'} image`,
                        description: rad.report_summary || 'Image uploaded',
                        icon: 'xray'
                    });
                }
            });

            // Add vitals
            records.medical_history?.vitals?.forEach(vital => {
                const date = new Date(vital.recorded_at);
                if (date >= sixMonthsAgo) {
                    timeline.push({
                        id: vital.id,
                        type: 'vitals',
                        date: vital.recorded_at,
                        title: 'Vital signs recorded',
                        description: `BP: ${vital.blood_pressure}, HR: ${vital.heart_rate}`,
                        icon: 'heart'
                    });
                }
            });

            // Sort by date (newest first)
            timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

            res.json({
                success: true,
                data: {
                    timeline,
                    summary: {
                        total_events: timeline.length,
                        appointments: timeline.filter(t => t.type === 'appointment').length,
                        prescriptions: timeline.filter(t => t.type === 'prescription').length,
                        lab_results: timeline.filter(t => t.type === 'lab_result').length,
                        radiology: timeline.filter(t => t.type === 'radiology').length,
                        vitals: timeline.filter(t => t.type === 'vitals').length
                    }
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
    // PRESCRIPTIONS
    // ============================================

    /**
     * Get all prescriptions
     * GET /api/v1/patient/prescriptions
     */
    async getPrescriptions(req, res, next) {
        try {
            const { active } = req.query;
            
            const prescriptions = await patientService.getPrescriptions(
                req.user.id, 
                { active: active === 'true' }
            );

            logger.info('Prescriptions retrieved', { 
                userId: req.user.id,
                count: prescriptions.length,
                active: active === 'true'
            });

            res.json({
                success: true,
                data: prescriptions
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
     * Get active prescriptions
     * GET /api/v1/patient/prescriptions/active
     */
    async getActivePrescriptions(req, res, next) {
        try {
            const prescriptions = await patientService.getPrescriptions(
                req.user.id, 
                { active: true }
            );

            res.json({
                success: true,
                data: prescriptions
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
     * Get prescription history
     * GET /api/v1/patient/prescriptions/history
     */
    async getPrescriptionHistory(req, res, next) {
        try {
            const prescriptions = await patientService.getPrescriptions(
                req.user.id, 
                { active: false }
            );

            res.json({
                success: true,
                data: prescriptions
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
     * Get prescription by ID
     * GET /api/v1/patient/prescriptions/:id
     */
    async getPrescriptionById(req, res, next) {
        try {
            const { id } = req.params;
            
            // Get patient first to verify ownership
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const result = await medicalService.getPrescriptionById(id, patient.id);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }

            logger.info('Prescription retrieved by ID', { 
                userId: req.user.id,
                prescriptionId: id
            });

            res.json({
                success: true,
                data: result
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
     * Download prescription PDF
     * GET /api/v1/patient/prescriptions/:id/pdf
     */
    async downloadPrescriptionPDF(req, res, next) {
        try {
            const { id } = req.params;
            
            // Get patient first to verify ownership
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const pdfBuffer = await medicalService.generatePrescriptionPDF(id, patient.id);

            if (!pdfBuffer) {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }

            logger.info('Prescription PDF downloaded', { 
                userId: req.user.id,
                prescriptionId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=prescription-${id}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            next(error);
        }
    },

    // ============================================
    // LAB RESULTS
    // ============================================

    /**
     * Get all lab results
     * GET /api/v1/patient/lab-results
     */
    async getLabResults(req, res, next) {
        try {
            const { critical } = req.query;
            
            const results = await patientService.getLabResults(
                req.user.id, 
                { critical: critical === 'true' }
            );

            logger.info('Lab results retrieved', { 
                userId: req.user.id,
                count: results.length,
                critical: critical === 'true'
            });

            res.json({
                success: true,
                data: results
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
     * Get pending lab results
     * GET /api/v1/patient/lab-results/pending
     */
    async getPendingLabResults(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const results = await medicalService.getPendingLabResults(patient.id);

            res.json({
                success: true,
                data: results
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
     * Get completed lab results
     * GET /api/v1/patient/lab-results/completed
     */
    async getCompletedLabResults(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const results = await medicalService.getCompletedLabResults(patient.id);

            res.json({
                success: true,
                data: results
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
     * Get lab result by ID
     * GET /api/v1/patient/lab-results/:id
     */
    async getLabResultById(req, res, next) {
        try {
            const { id } = req.params;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const result = await medicalService.getLabResultById(id, patient.id);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Lab result not found'
                });
            }

            logger.info('Lab result retrieved by ID', { 
                userId: req.user.id,
                resultId: id
            });

            res.json({
                success: true,
                data: result
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
     * Download lab result PDF
     * GET /api/v1/patient/lab-results/:id/pdf
     */
    async downloadLabResultPDF(req, res, next) {
        try {
            const { id } = req.params;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const pdfBuffer = await medicalService.generateLabResultPDF(id, patient.id);

            if (!pdfBuffer) {
                return res.status(404).json({
                    success: false,
                    error: 'Lab result not found'
                });
            }

            logger.info('Lab result PDF downloaded', { 
                userId: req.user.id,
                resultId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=lab-result-${id}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message === 'Lab result not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Lab result not found'
                });
            }
            next(error);
        }
    },

    // ============================================
    // RADIOLOGY IMAGES
    // ============================================

    /**
     * Get all radiology images
     * GET /api/v1/patient/radiology-images
     */
    async getRadiologyImages(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const images = await medicalService.getRadiologyImages(patient.id);

            logger.info('Radiology images retrieved', { 
                userId: req.user.id,
                count: images.length
            });

            res.json({
                success: true,
                data: images
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
     * Get radiology image by ID
     * GET /api/v1/patient/radiology-images/:id
     */
    async getRadiologyImageById(req, res, next) {
        try {
            const { id } = req.params;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const image = await medicalService.getRadiologyImageById(id, patient.id);

            if (!image) {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology image not found'
                });
            }

            res.json({
                success: true,
                data: image
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
     * Download radiology image
     * GET /api/v1/patient/radiology-images/:id/download
     */
    async downloadRadiologyImage(req, res, next) {
        try {
            const { id } = req.params;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const imageData = await medicalService.getRadiologyImageFile(id, patient.id);

            if (!imageData) {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology image not found'
                });
            }

            logger.info('Radiology image downloaded', { 
                userId: req.user.id,
                imageId: id
            });

            res.setHeader('Content-Type', imageData.mimeType || 'image/jpeg');
            res.setHeader('Content-Disposition', `attachment; filename=${imageData.filename}`);
            res.send(imageData.buffer);
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message === 'Radiology image not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Radiology image not found'
                });
            }
            next(error);
        }
    },

    // ============================================
    // VITAL SIGNS
    // ============================================

    /**
     * Get vital signs history
     * GET /api/v1/patient/vitals
     */
    async getVitals(req, res, next) {
        try {
            const { limit = 50 } = req.query;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const vitals = await medicalService.getVitals(patient.id, { limit: parseInt(limit) });

            logger.info('Vital signs retrieved', { 
                userId: req.user.id,
                count: vitals.length
            });

            res.json({
                success: true,
                data: vitals
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
     * Get latest vital signs
     * GET /api/v1/patient/vitals/latest
     */
    async getLatestVitals(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const vitals = await medicalService.getVitals(patient.id, { limit: 1 });

            res.json({
                success: true,
                data: vitals[0] || null
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
     * Get vital trends
     * GET /api/v1/patient/vitals/trends
     */
    async getVitalTrends(req, res, next) {
        try {
            const { days = 30 } = req.query;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const trends = await medicalService.getVitalTrends(patient.id, { days: parseInt(days) });

            res.json({
                success: true,
                data: trends
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
    // DIAGNOSIS
    // ============================================

    /**
     * Get diagnosis history
     * GET /api/v1/patient/diagnosis
     */
    async getDiagnosis(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const diagnosis = await medicalService.getDiagnosis(patient.id);

            logger.info('Diagnosis history retrieved', { 
                userId: req.user.id,
                count: diagnosis.length
            });

            res.json({
                success: true,
                data: diagnosis
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
    // VISITS
    // ============================================

    /**
     * Get visit history
     * GET /api/v1/patient/visits
     */
    async getVisits(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const visits = await medicalService.getVisits(patient.id, {
                page: parseInt(page),
                limit: parseInt(limit)
            });

            logger.info('Visit history retrieved', { 
                userId: req.user.id,
                count: visits.data?.length || 0
            });

            res.json({
                success: true,
                data: visits.data || visits,
                pagination: visits.pagination
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
     * Get visit by ID
     * GET /api/v1/patient/visits/:id
     */
    async getVisitById(req, res, next) {
        try {
            const { id } = req.params;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const visit = await medicalService.getVisitById(id, patient.id);

            if (!visit) {
                return res.status(404).json({
                    success: false,
                    error: 'Visit not found'
                });
            }

            res.json({
                success: true,
                data: visit
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
    // EXPORT FUNCTIONS
    // ============================================

    /**
     * Export medical records
     * GET /api/v1/patient/medical-records/export
     */
    async exportMedicalRecords(req, res, next) {
        try {
            const { format = 'json' } = req.query;
            
            const patient = await patientService.getPatientProfile(req.user.id);
            const records = await patientService.getMedicalHistory(req.user.id);

            logger.info('Medical records exported', { 
                userId: req.user.id,
                format
            });

            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename=medical-records-${patient.id}.json`);
                return res.send(JSON.stringify(records, null, 2));
            }

            if (format === 'csv') {
                // Convert to CSV
                const csv = await medicalService.convertToCSV(records);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=medical-records-${patient.id}.csv`);
                return res.send(csv);
            }

            if (format === 'pdf') {
                const pdfBuffer = await medicalService.generateMedicalReportPDF(records);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=medical-report-${patient.id}.pdf`);
                return res.send(pdfBuffer);
            }

            res.json({
                success: true,
                data: records
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

module.exports = medicalController;

/**
 * ======================================================================
 * USAGE IN ROUTES:
 * ======================================================================
 * 
 * const medicalController = require('./controllers/patient/medicalController');
 * const authenticate = require('../middlewares/auth');
 * 
 * // Medical Records
 * router.get('/medical-records', authenticate, medicalController.getMedicalRecords);
 * router.get('/medical-records/summary', authenticate, medicalController.getHealthSummary);
 * router.get('/medical-records/timeline', authenticate, medicalController.getMedicalTimeline);
 * router.get('/medical-records/export', authenticate, medicalController.exportMedicalRecords);
 * 
 * // Prescriptions
 * router.get('/prescriptions', authenticate, medicalController.getPrescriptions);
 * router.get('/prescriptions/active', authenticate, medicalController.getActivePrescriptions);
 * router.get('/prescriptions/history', authenticate, medicalController.getPrescriptionHistory);
 * router.get('/prescriptions/:id', authenticate, medicalController.getPrescriptionById);
 * router.get('/prescriptions/:id/pdf', authenticate, medicalController.downloadPrescriptionPDF);
 * 
 * // Lab Results
 * router.get('/lab-results', authenticate, medicalController.getLabResults);
 * router.get('/lab-results/pending', authenticate, medicalController.getPendingLabResults);
 * router.get('/lab-results/completed', authenticate, medicalController.getCompletedLabResults);
 * router.get('/lab-results/:id', authenticate, medicalController.getLabResultById);
 * router.get('/lab-results/:id/pdf', authenticate, medicalController.downloadLabResultPDF);
 * 
 * // Radiology
 * router.get('/radiology-images', authenticate, medicalController.getRadiologyImages);
 * router.get('/radiology-images/:id', authenticate, medicalController.getRadiologyImageById);
 * router.get('/radiology-images/:id/download', authenticate, medicalController.downloadRadiologyImage);
 * 
 * // Vitals
 * router.get('/vitals', authenticate, medicalController.getVitals);
 * router.get('/vitals/latest', authenticate, medicalController.getLatestVitals);
 * router.get('/vitals/trends', authenticate, medicalController.getVitalTrends);
 * 
 * // Diagnosis & Visits
 * router.get('/diagnosis', authenticate, medicalController.getDiagnosis);
 * router.get('/visits', authenticate, medicalController.getVisits);
 * router.get('/visits/:id', authenticate, medicalController.getVisitById);
 * 
 * ======================================================================
 */