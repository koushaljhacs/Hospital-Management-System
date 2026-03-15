/**
 * ======================================================================
 * FILE: backend/src/controllers/doctor/prescriptionController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor's prescription management controller.
 * Allows doctors to create, update, delete prescriptions and manage templates.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-13] One prescription per appointment
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-16] Controlled substances need special flag
 * - [BR-17] Prescription validity 30 days
 * 
 * ENDPOINTS:
 * GET    /doctor/prescriptions                    - All prescriptions
 * GET    /doctor/prescriptions/active              - Active prescriptions
 * GET    /doctor/prescriptions/:id                   - Get prescription by ID
 * POST   /doctor/prescriptions                        - Create prescription
 * PUT    /doctor/prescriptions/:id                     - Update prescription
 * DELETE /doctor/prescriptions/:id                      - Delete prescription
 * POST   /doctor/prescriptions/:id/medicines            - Add medicine
 * PUT    /doctor/prescriptions/:id/medicines/:medId     - Update medicine
 * DELETE /doctor/prescriptions/:id/medicines/:medId     - Remove medicine
 * GET    /doctor/prescriptions/templates                - Get templates
 * POST   /doctor/prescriptions/templates                 - Create template
 * PUT    /doctor/prescriptions/templates/:id              - Update template
 * DELETE /doctor/prescriptions/templates/:id               - Delete template
 * GET    /doctor/diagnosis                                 - Get diagnosis
 * GET    /doctor/diagnosis/:id                              - Get diagnosis by ID
 * POST   /doctor/diagnosis                                   - Create diagnosis
 * PUT    /doctor/diagnosis/:id                                - Update diagnosis
 * DELETE /doctor/diagnosis/:id                                 - Delete diagnosis
 * GET    /doctor/clinical-notes                                - Get clinical notes
 * POST   /doctor/clinical-notes                                 - Create clinical note
 * PUT    /doctor/clinical-notes/:id                              - Update clinical note
 * DELETE /doctor/clinical-notes/:id                               - Delete clinical note
 * 
 * ======================================================================
 */

const prescriptionService = require('../../services/doctor/prescriptionService');
const logger = require('../../utils/logger');

/**
 * Doctor Prescription Controller
 */
const prescriptionController = {
    // ============================================
    // PRESCRIPTION LISTS
    // ============================================

    /**
     * Get all prescriptions
     * GET /api/v1/doctor/prescriptions
     */
    async getPrescriptions(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                patient_id,
                from_date,
                to_date,
                status
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id,
                from_date,
                to_date,
                status
            };

            const prescriptions = await prescriptionService.getPrescriptions(
                req.user.id,
                options
            );

            logger.info('Doctor retrieved prescriptions', {
                doctorId: req.user.id,
                count: prescriptions.data?.length || 0
            });

            res.json({
                success: true,
                data: prescriptions.data,
                pagination: prescriptions.pagination
            });
        } catch (error) {
            logger.error('Error getting prescriptions', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get active prescriptions
     * GET /api/v1/doctor/prescriptions/active
     */
    async getActivePrescriptions(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const prescriptions = await prescriptionService.getActivePrescriptions(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: prescriptions.data,
                pagination: prescriptions.pagination
            });
        } catch (error) {
            logger.error('Error getting active prescriptions', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get prescription by ID
     * GET /api/v1/doctor/prescriptions/:id
     */
    async getPrescriptionById(req, res, next) {
        try {
            const { id } = req.params;

            const prescription = await prescriptionService.getPrescriptionById(
                req.user.id,
                id
            );

            if (!prescription) {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }

            logger.info('Doctor viewed prescription', {
                doctorId: req.user.id,
                prescriptionId: id
            });

            res.json({
                success: true,
                data: prescription
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error getting prescription by ID', {
                error: error.message,
                doctorId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PRESCRIPTION CRUD
    // ============================================

    /**
     * Create new prescription
     * POST /api/v1/doctor/prescriptions
     * 
     * BUSINESS RULES:
     * - [BR-13] One prescription per appointment
     * - [BR-14] Medicine quantity positive
     * - [BR-15] Dosage required
     * - [BR-16] Controlled substances flag
     * - [BR-17] Follow-up within 30 days
     */
    async createPrescription(req, res, next) {
        try {
            const {
                patient_id,
                appointment_id,
                diagnosis,
                diagnosis_code,
                notes,
                follow_up_date,
                medicines
            } = req.body;

            // Validate required fields
            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!appointment_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Appointment ID is required'
                });
            }

            if (!diagnosis || diagnosis.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Diagnosis must be at least 3 characters'
                });
            }

            if (!medicines || medicines.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one medicine is required'
                });
            }

            // [BR-14] & [BR-15] validation
            for (const medicine of medicines) {
                if (!medicine.name || medicine.name.trim().length < 2) {
                    return res.status(400).json({
                        success: false,
                        error: 'Medicine name is required and must be at least 2 characters'
                    });
                }
                if (!medicine.dosage) {
                    return res.status(400).json({
                        success: false,
                        error: `Dosage is required for ${medicine.name}`
                    });
                }
                if (!medicine.frequency) {
                    return res.status(400).json({
                        success: false,
                        error: `Frequency is required for ${medicine.name}`
                    });
                }
                if (!medicine.duration) {
                    return res.status(400).json({
                        success: false,
                        error: `Duration is required for ${medicine.name}`
                    });
                }
                if (!medicine.quantity || medicine.quantity <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: `Quantity must be positive for ${medicine.name}`
                    });
                }
            }

            const prescription = await prescriptionService.createPrescription(
                req.user.id,
                {
                    patient_id,
                    appointment_id,
                    diagnosis,
                    diagnosis_code,
                    notes,
                    follow_up_date,
                    medicines
                }
            );

            logger.info('Doctor created prescription', {
                doctorId: req.user.id,
                prescriptionId: prescription.id,
                patientId: patient_id,
                medicinesCount: medicines.length
            });

            res.status(201).json({
                success: true,
                data: prescription,
                message: 'Prescription created successfully'
            });
        } catch (error) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: 'A prescription already exists for this appointment'
                });
            }
            logger.error('Error creating prescription', {
                error: error.message,
                doctorId: req.user.id,
                patientId: req.body.patient_id
            });
            next(error);
        }
    },

    /**
     * Update prescription
     * PUT /api/v1/doctor/prescriptions/:id
     */
    async updatePrescription(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const prescription = await prescriptionService.updatePrescription(
                req.user.id,
                id,
                updates
            );

            logger.info('Doctor updated prescription', {
                doctorId: req.user.id,
                prescriptionId: id
            });

            res.json({
                success: true,
                data: prescription,
                message: 'Prescription updated successfully'
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error updating prescription', {
                error: error.message,
                doctorId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete prescription (soft delete)
     * DELETE /api/v1/doctor/prescriptions/:id
     */
    async deletePrescription(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await prescriptionService.deletePrescription(
                req.user.id,
                id,
                reason
            );

            logger.info('Doctor deleted prescription', {
                doctorId: req.user.id,
                prescriptionId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Prescription deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error deleting prescription', {
                error: error.message,
                doctorId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // MEDICINE MANAGEMENT
    // ============================================

    /**
     * Add medicine to prescription
     * POST /api/v1/doctor/prescriptions/:id/medicines
     */
    async addMedicine(req, res, next) {
        try {
            const { id } = req.params;
            const medicineData = req.body;

            // Validate medicine data
            if (!medicineData.name) {
                return res.status(400).json({
                    success: false,
                    error: 'Medicine name is required'
                });
            }
            if (!medicineData.dosage) {
                return res.status(400).json({
                    success: false,
                    error: 'Dosage is required'
                });
            }
            if (!medicineData.frequency) {
                return res.status(400).json({
                    success: false,
                    error: 'Frequency is required'
                });
            }
            if (!medicineData.duration) {
                return res.status(400).json({
                    success: false,
                    error: 'Duration is required'
                });
            }
            if (!medicineData.quantity || medicineData.quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Quantity must be positive'
                });
            }

            const medicine = await prescriptionService.addMedicine(
                req.user.id,
                id,
                medicineData
            );

            logger.info('Doctor added medicine to prescription', {
                doctorId: req.user.id,
                prescriptionId: id,
                medicineName: medicineData.name
            });

            res.status(201).json({
                success: true,
                data: medicine,
                message: 'Medicine added successfully'
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error adding medicine', {
                error: error.message,
                doctorId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update medicine in prescription
     * PUT /api/v1/doctor/prescriptions/:id/medicines/:medId
     */
    async updateMedicine(req, res, next) {
        try {
            const { id, medId } = req.params;
            const updates = req.body;

            const medicine = await prescriptionService.updateMedicine(
                req.user.id,
                id,
                medId,
                updates
            );

            logger.info('Doctor updated medicine', {
                doctorId: req.user.id,
                prescriptionId: id,
                medicineId: medId
            });

            res.json({
                success: true,
                data: medicine,
                message: 'Medicine updated successfully'
            });
        } catch (error) {
            if (error.message === 'Medicine not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Medicine not found'
                });
            }
            logger.error('Error updating medicine', {
                error: error.message,
                doctorId: req.user.id,
                prescriptionId: req.params.id,
                medicineId: req.params.medId
            });
            next(error);
        }
    },

    /**
     * Remove medicine from prescription
     * DELETE /api/v1/doctor/prescriptions/:id/medicines/:medId
     */
    async removeMedicine(req, res, next) {
        try {
            const { id, medId } = req.params;

            await prescriptionService.removeMedicine(
                req.user.id,
                id,
                medId
            );

            logger.info('Doctor removed medicine from prescription', {
                doctorId: req.user.id,
                prescriptionId: id,
                medicineId: medId
            });

            res.json({
                success: true,
                message: 'Medicine removed successfully'
            });
        } catch (error) {
            if (error.message === 'Medicine not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Medicine not found'
                });
            }
            logger.error('Error removing medicine', {
                error: error.message,
                doctorId: req.user.id,
                prescriptionId: req.params.id,
                medicineId: req.params.medId
            });
            next(error);
        }
    },

    // ============================================
    // PRESCRIPTION TEMPLATES
    // ============================================

    /**
     * Get prescription templates
     * GET /api/v1/doctor/prescriptions/templates
     */
    async getTemplates(req, res, next) {
        try {
            const templates = await prescriptionService.getTemplates(
                req.user.id
            );

            res.json({
                success: true,
                data: templates
            });
        } catch (error) {
            logger.error('Error getting templates', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Create prescription template
     * POST /api/v1/doctor/prescriptions/templates
     */
    async createTemplate(req, res, next) {
        try {
            const {
                template_name,
                diagnosis,
                diagnosis_code,
                medicines,
                notes
            } = req.body;

            if (!template_name || template_name.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Template name must be at least 3 characters'
                });
            }

            if (!diagnosis || diagnosis.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Diagnosis must be at least 3 characters'
                });
            }

            if (!medicines || medicines.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one medicine is required'
                });
            }

            const template = await prescriptionService.createTemplate(
                req.user.id,
                {
                    template_name,
                    diagnosis,
                    diagnosis_code,
                    medicines,
                    notes
                }
            );

            logger.info('Doctor created prescription template', {
                doctorId: req.user.id,
                templateId: template.id,
                templateName: template_name
            });

            res.status(201).json({
                success: true,
                data: template,
                message: 'Template created successfully'
            });
        } catch (error) {
            logger.error('Error creating template', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update prescription template
     * PUT /api/v1/doctor/prescriptions/templates/:id
     */
    async updateTemplate(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const template = await prescriptionService.updateTemplate(
                req.user.id,
                id,
                updates
            );

            logger.info('Doctor updated prescription template', {
                doctorId: req.user.id,
                templateId: id
            });

            res.json({
                success: true,
                data: template,
                message: 'Template updated successfully'
            });
        } catch (error) {
            if (error.message === 'Template not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Template not found'
                });
            }
            logger.error('Error updating template', {
                error: error.message,
                doctorId: req.user.id,
                templateId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete prescription template
     * DELETE /api/v1/doctor/prescriptions/templates/:id
     */
    async deleteTemplate(req, res, next) {
        try {
            const { id } = req.params;

            await prescriptionService.deleteTemplate(
                req.user.id,
                id
            );

            logger.info('Doctor deleted prescription template', {
                doctorId: req.user.id,
                templateId: id
            });

            res.json({
                success: true,
                message: 'Template deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Template not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Template not found'
                });
            }
            logger.error('Error deleting template', {
                error: error.message,
                doctorId: req.user.id,
                templateId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // DIAGNOSIS MANAGEMENT
    // ============================================

    /**
     * Get diagnosis
     * GET /api/v1/doctor/diagnosis
     */
    async getDiagnosis(req, res, next) {
        try {
            const { page = 1, limit = 20, patient_id } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id
            };

            const diagnosis = await prescriptionService.getDiagnosis(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: diagnosis.data,
                pagination: diagnosis.pagination
            });
        } catch (error) {
            logger.error('Error getting diagnosis', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get diagnosis by ID
     * GET /api/v1/doctor/diagnosis/:id
     */
    async getDiagnosisById(req, res, next) {
        try {
            const { id } = req.params;

            const diagnosis = await prescriptionService.getDiagnosisById(
                req.user.id,
                id
            );

            if (!diagnosis) {
                return res.status(404).json({
                    success: false,
                    error: 'Diagnosis not found'
                });
            }

            res.json({
                success: true,
                data: diagnosis
            });
        } catch (error) {
            logger.error('Error getting diagnosis by ID', {
                error: error.message,
                doctorId: req.user.id,
                diagnosisId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Create diagnosis
     * POST /api/v1/doctor/diagnosis
     */
    async createDiagnosis(req, res, next) {
        try {
            const {
                patient_id,
                appointment_id,
                diagnosis,
                diagnosis_code,
                type,
                notes
            } = req.body;

            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!diagnosis || diagnosis.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    error: 'Diagnosis must be at least 3 characters'
                });
            }

            const newDiagnosis = await prescriptionService.createDiagnosis(
                req.user.id,
                {
                    patient_id,
                    appointment_id,
                    diagnosis,
                    diagnosis_code,
                    type,
                    notes
                }
            );

            logger.info('Doctor created diagnosis', {
                doctorId: req.user.id,
                diagnosisId: newDiagnosis.id,
                patientId: patient_id
            });

            res.status(201).json({
                success: true,
                data: newDiagnosis,
                message: 'Diagnosis created successfully'
            });
        } catch (error) {
            logger.error('Error creating diagnosis', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update diagnosis
     * PUT /api/v1/doctor/diagnosis/:id
     */
    async updateDiagnosis(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const diagnosis = await prescriptionService.updateDiagnosis(
                req.user.id,
                id,
                updates
            );

            logger.info('Doctor updated diagnosis', {
                doctorId: req.user.id,
                diagnosisId: id
            });

            res.json({
                success: true,
                data: diagnosis,
                message: 'Diagnosis updated successfully'
            });
        } catch (error) {
            if (error.message === 'Diagnosis not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Diagnosis not found'
                });
            }
            logger.error('Error updating diagnosis', {
                error: error.message,
                doctorId: req.user.id,
                diagnosisId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete diagnosis
     * DELETE /api/v1/doctor/diagnosis/:id
     */
    async deleteDiagnosis(req, res, next) {
        try {
            const { id } = req.params;

            await prescriptionService.deleteDiagnosis(
                req.user.id,
                id
            );

            logger.info('Doctor deleted diagnosis', {
                doctorId: req.user.id,
                diagnosisId: id
            });

            res.json({
                success: true,
                message: 'Diagnosis deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Diagnosis not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Diagnosis not found'
                });
            }
            logger.error('Error deleting diagnosis', {
                error: error.message,
                doctorId: req.user.id,
                diagnosisId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // CLINICAL NOTES
    // ============================================

    /**
     * Get clinical notes
     * GET /api/v1/doctor/clinical-notes
     */
    async getClinicalNotes(req, res, next) {
        try {
            const { page = 1, limit = 20, patient_id } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id
            };

            const notes = await prescriptionService.getClinicalNotes(
                req.user.id,
                options
            );

            res.json({
                success: true,
                data: notes.data,
                pagination: notes.pagination
            });
        } catch (error) {
            logger.error('Error getting clinical notes', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Create clinical note
     * POST /api/v1/doctor/clinical-notes
     */
    async createClinicalNote(req, res, next) {
        try {
            const {
                patient_id,
                appointment_id,
                note_type,
                content,
                is_private
            } = req.body;

            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!content || content.trim().length < 5) {
                return res.status(400).json({
                    success: false,
                    error: 'Note content must be at least 5 characters'
                });
            }

            const note = await prescriptionService.createClinicalNote(
                req.user.id,
                {
                    patient_id,
                    appointment_id,
                    note_type: note_type || 'general',
                    content,
                    is_private: is_private || false
                }
            );

            logger.info('Doctor created clinical note', {
                doctorId: req.user.id,
                noteId: note.id,
                patientId: patient_id,
                noteType: note_type
            });

            res.status(201).json({
                success: true,
                data: note,
                message: 'Clinical note created successfully'
            });
        } catch (error) {
            logger.error('Error creating clinical note', {
                error: error.message,
                doctorId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update clinical note
     * PUT /api/v1/doctor/clinical-notes/:id
     */
    async updateClinicalNote(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const note = await prescriptionService.updateClinicalNote(
                req.user.id,
                id,
                updates
            );

            logger.info('Doctor updated clinical note', {
                doctorId: req.user.id,
                noteId: id
            });

            res.json({
                success: true,
                data: note,
                message: 'Clinical note updated successfully'
            });
        } catch (error) {
            if (error.message === 'Note not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Clinical note not found'
                });
            }
            logger.error('Error updating clinical note', {
                error: error.message,
                doctorId: req.user.id,
                noteId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete clinical note
     * DELETE /api/v1/doctor/clinical-notes/:id
     */
    async deleteClinicalNote(req, res, next) {
        try {
            const { id } = req.params;

            await prescriptionService.deleteClinicalNote(
                req.user.id,
                id
            );

            logger.info('Doctor deleted clinical note', {
                doctorId: req.user.id,
                noteId: id
            });

            res.json({
                success: true,
                message: 'Clinical note deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Note not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Clinical note not found'
                });
            }
            logger.error('Error deleting clinical note', {
                error: error.message,
                doctorId: req.user.id,
                noteId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PRESCRIPTION PRINT/EXPORT
    // ============================================

    /**
     * Print prescription
     * GET /api/v1/doctor/prescriptions/:id/print
     */
    async printPrescription(req, res, next) {
        try {
            const { id } = req.params;

            const pdfBuffer = await prescriptionService.generatePrescriptionPDF(
                req.user.id,
                id
            );

            if (!pdfBuffer) {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }

            logger.info('Doctor printed prescription', {
                doctorId: req.user.id,
                prescriptionId: id
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=prescription-${id}.pdf`);
            res.send(pdfBuffer);
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error printing prescription', {
                error: error.message,
                doctorId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Share prescription via email
     * POST /api/v1/doctor/prescriptions/:id/share
     */
    async sharePrescription(req, res, next) {
        try {
            const { id } = req.params;
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email address is required'
                });
            }

            const result = await prescriptionService.sharePrescription(
                req.user.id,
                id,
                email
            );

            logger.info('Doctor shared prescription', {
                doctorId: req.user.id,
                prescriptionId: id,
                email
            });

            res.json({
                success: true,
                data: result,
                message: `Prescription shared with ${email}`
            });
        } catch (error) {
            if (error.message === 'Prescription not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Prescription not found'
                });
            }
            logger.error('Error sharing prescription', {
                error: error.message,
                doctorId: req.user.id,
                prescriptionId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = prescriptionController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Business Rules
 * -----------------------|-----------|----------------------
 * Prescription Lists     | 3         | View prescriptions
 * Prescription CRUD      | 3         | [BR-13][BR-14][BR-15][BR-16][BR-17]
 * Medicine Management    | 3         | [BR-14][BR-15]
 * Templates              | 4         | Reusable templates
 * Diagnosis              | 5         | ICD-10 codes
 * Clinical Notes         | 4         | Patient notes
 * Print/Share            | 2         | Export functionality
 * -----------------------|-----------|----------------------
 * TOTAL                  | 24        | Complete prescription management
 * 
 * ======================================================================
 */