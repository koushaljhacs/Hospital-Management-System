/**
 * ======================================================================
 * FILE: backend/src/controllers/receptionist/registrationController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist patient registration controller - Handles patient registration,
 * search, and management.
 * Total Endpoints: 9
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-01] Patient email must be unique
 * - [BR-02] Patient phone must be unique
 * - [BR-03] Emergency contact required
 * - [BR-04] Min age 0, Max age 150
 * 
 * ======================================================================
 */

const registrationService = require('../../services/receptionist/registrationService');
const logger = require('../../utils/logger');
const { customValidators } = require('../../validators/receptionistValidators');

/**
 * Receptionist Registration Controller
 */
const registrationController = {
    // ============================================
    // PATIENT SEARCH & LISTS
    // ============================================

    /**
     * Search patients
     * GET /api/v1/reception/patients
     */
    async searchPatients(req, res, next) {
        try {
            const { 
                search, 
                phone, 
                email,
                page = 1, 
                limit = 20 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                phone,
                email
            };

            // Validate search criteria
            if (!search && !phone && !email) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one search criteria is required (search, phone, or email)'
                });
            }

            const results = await registrationService.searchPatients(
                req.user.id,
                search,
                options
            );

            logger.info('Receptionist searched patients', {
                receptionistId: req.user.id,
                searchTerm: search || phone || email,
                resultCount: results.data?.length || 0
            });

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination,
                summary: {
                    total: results.summary?.total || 0,
                    exact_matches: results.summary?.exact_matches || 0
                }
            });
        } catch (error) {
            logger.error('Error searching patients', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get recent patients
     * GET /api/v1/reception/patients/recent
     */
    async getRecentPatients(req, res, next) {
        try {
            const { limit = 20 } = req.query;

            const patients = await registrationService.getRecentPatients(
                req.user.id,
                parseInt(limit)
            );

            logger.info('Receptionist retrieved recent patients', {
                receptionistId: req.user.id,
                count: patients.length
            });

            res.json({
                success: true,
                data: patients
            });
        } catch (error) {
            logger.error('Error getting recent patients', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get patient by ID
     * GET /api/v1/reception/patients/:id
     */
    async getPatientById(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await registrationService.getPatientById(
                req.user.id,
                id
            );

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            logger.info('Receptionist viewed patient details', {
                receptionistId: req.user.id,
                patientId: id,
                patientName: `${patient.first_name} ${patient.last_name}`
            });

            // [SR-13] Audit PHI access
            logger.audit({
                action: 'RECEPTION_VIEW_PATIENT',
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
            logger.error('Error getting patient by ID', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT REGISTRATION
    // ============================================

    /**
     * Register new patient
     * POST /api/v1/reception/patients
     * 
     * BUSINESS RULES:
     * - [BR-01] Email unique
     * - [BR-02] Phone unique
     * - [BR-03] Emergency contact required
     * - [BR-04] Age between 0-150
     */
    async registerPatient(req, res, next) {
        try {
            const patientData = {
                first_name: req.body.first_name,
                last_name: req.body.last_name,
                date_of_birth: req.body.date_of_birth,
                gender: req.body.gender,
                blood_group: req.body.blood_group,
                marital_status: req.body.marital_status,
                occupation: req.body.occupation,
                nationality: req.body.nationality || 'Indian',
                preferred_language: req.body.preferred_language || 'en',
                phone: req.body.phone,
                alternate_phone: req.body.alternate_phone,
                email: req.body.email,
                address: req.body.address,
                city: req.body.city,
                state: req.body.state,
                postal_code: req.body.postal_code,
                emergency_contact_name: req.body.emergency_contact_name,
                emergency_contact_phone: req.body.emergency_contact_phone,
                emergency_contact_relation: req.body.emergency_contact_relation,
                emergency_contact_address: req.body.emergency_contact_address,
                emergency_contact_email: req.body.emergency_contact_email,
                allergies: req.body.allergies,
                medical_conditions: req.body.medical_conditions,
                insurance_provider: req.body.insurance_provider,
                insurance_policy: req.body.insurance_policy,
                insurance_expiry: req.body.insurance_expiry,
                consent_form_signed: req.body.consent_form_signed || true,
                consent_form_date: req.body.consent_form_date || new Date(),
                registration_date: new Date(),
                referred_by: req.body.referred_by,
                created_by: req.user.id,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // [BR-03] Validate emergency contact
            if (!patientData.emergency_contact_name || !patientData.emergency_contact_phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Emergency contact name and phone are required'
                });
            }

            // [BR-04] Validate age
            if (!customValidators.isValidDateOfBirth(patientData.date_of_birth)) {
                return res.status(400).json({
                    success: false,
                    error: 'Age must be between 0 and 150 years'
                });
            }

            const patient = await registrationService.registerPatient(
                req.user.id,
                patientData
            );

            logger.info('Receptionist registered new patient', {
                receptionistId: req.user.id,
                patientId: patient.id,
                patientName: `${patient.first_name} ${patient.last_name}`,
                phone: patient.phone
            });

            res.status(201).json({
                success: true,
                data: patient,
                message: 'Patient registered successfully'
            });
        } catch (error) {
            if (error.message.includes('already exists')) {
                if (error.message.includes('email')) {
                    return res.status(409).json({
                        success: false,
                        error: 'Email already registered' // [BR-01]
                    });
                }
                if (error.message.includes('phone')) {
                    return res.status(409).json({
                        success: false,
                        error: 'Phone number already registered' // [BR-02]
                    });
                }
            }
            logger.error('Error registering patient', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update patient
     * PUT /api/v1/reception/patients/:id
     */
    async updatePatient(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.user_id;
            delete updates.registration_date;
            delete updates.created_by;
            delete updates.created_at;

            // [BR-04] Validate age if DOB is being updated
            if (updates.date_of_birth) {
                if (!customValidators.isValidDateOfBirth(updates.date_of_birth)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Age must be between 0 and 150 years'
                    });
                }
            }

            const patient = await registrationService.updatePatient(
                req.user.id,
                id,
                updates
            );

            logger.info('Receptionist updated patient', {
                receptionistId: req.user.id,
                patientId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: patient,
                message: 'Patient updated successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: error.message // [BR-01] or [BR-02]
                });
            }
            logger.error('Error updating patient', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Deactivate patient (soft delete)
     * DELETE /api/v1/reception/patients/:id
     */
    async deactivatePatient(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await registrationService.deactivatePatient(
                req.user.id,
                id,
                reason
            );

            logger.info('Receptionist deactivated patient', {
                receptionistId: req.user.id,
                patientId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Patient deactivated successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error deactivating patient', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // EMERGENCY CONTACTS
    // ============================================

    /**
     * Add emergency contact
     * POST /api/v1/reception/patients/:id/emergency-contact
     * 
     * BUSINESS RULE: [BR-03] Emergency contact required
     */
    async addEmergencyContact(req, res, next) {
        try {
            const { id } = req.params;
            const contactData = {
                name: req.body.name,
                phone: req.body.phone,
                relation: req.body.relation,
                address: req.body.address,
                email: req.body.email,
                priority: req.body.priority || 1
            };

            // Validate required fields
            if (!contactData.name || !contactData.phone || !contactData.relation) {
                return res.status(400).json({
                    success: false,
                    error: 'Name, phone, and relation are required'
                });
            }

            const contact = await registrationService.addEmergencyContact(
                req.user.id,
                id,
                contactData
            );

            logger.info('Receptionist added emergency contact', {
                receptionistId: req.user.id,
                patientId: id,
                contactName: contactData.name
            });

            res.status(201).json({
                success: true,
                data: contact,
                message: 'Emergency contact added successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error adding emergency contact', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update emergency contact
     * PUT /api/v1/reception/patients/:id/emergency-contact/:contactId
     */
    async updateEmergencyContact(req, res, next) {
        try {
            const { id, contactId } = req.params;
            const updates = req.body;

            const contact = await registrationService.updateEmergencyContact(
                req.user.id,
                id,
                contactId,
                updates
            );

            logger.info('Receptionist updated emergency contact', {
                receptionistId: req.user.id,
                patientId: id,
                contactId
            });

            res.json({
                success: true,
                data: contact,
                message: 'Emergency contact updated successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found' || error.message === 'Contact not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error updating emergency contact', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id,
                contactId: req.params.contactId
            });
            next(error);
        }
    },

    /**
     * Delete emergency contact
     * DELETE /api/v1/reception/patients/:id/emergency-contact/:contactId
     */
    async deleteEmergencyContact(req, res, next) {
        try {
            const { id, contactId } = req.params;

            await registrationService.deleteEmergencyContact(
                req.user.id,
                id,
                contactId
            );

            logger.info('Receptionist deleted emergency contact', {
                receptionistId: req.user.id,
                patientId: id,
                contactId
            });

            res.json({
                success: true,
                message: 'Emergency contact deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found' || error.message === 'Contact not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            logger.error('Error deleting emergency contact', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id,
                contactId: req.params.contactId
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT DOCUMENTS
    // ============================================

    /**
     * Upload patient document
     * POST /api/v1/reception/patients/:id/documents
     */
    async uploadPatientDocument(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                document_type,
                document_name,
                document_url,
                expiry_date,
                notes 
            } = req.body;

            if (!document_type || !document_name || !document_url) {
                return res.status(400).json({
                    success: false,
                    error: 'Document type, name, and URL are required'
                });
            }

            const document = await registrationService.uploadPatientDocument(
                req.user.id,
                id,
                {
                    document_type,
                    document_name,
                    document_url,
                    expiry_date,
                    notes,
                    uploaded_by: req.user.id,
                    uploaded_at: new Date()
                }
            );

            logger.info('Receptionist uploaded patient document', {
                receptionistId: req.user.id,
                patientId: id,
                documentType: document_type
            });

            res.status(201).json({
                success: true,
                data: document,
                message: 'Document uploaded successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error uploading patient document', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient documents
     * GET /api/v1/reception/patients/:id/documents
     */
    async getPatientDocuments(req, res, next) {
        try {
            const { id } = req.params;

            const documents = await registrationService.getPatientDocuments(
                req.user.id,
                id
            );

            res.json({
                success: true,
                data: documents
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error getting patient documents', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete patient document
     * DELETE /api/v1/reception/patients/:patientId/documents/:documentId
     */
    async deletePatientDocument(req, res, next) {
        try {
            const { patientId, documentId } = req.params;

            await registrationService.deletePatientDocument(
                req.user.id,
                patientId,
                documentId
            );

            logger.info('Receptionist deleted patient document', {
                receptionistId: req.user.id,
                patientId,
                documentId
            });

            res.json({
                success: true,
                message: 'Document deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Document not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }
            logger.error('Error deleting patient document', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.patientId,
                documentId: req.params.documentId
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT NOTES
    // ============================================

    /**
     * Add patient note
     * POST /api/v1/reception/patients/:id/notes
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

            const patientNote = await registrationService.addPatientNote(
                req.user.id,
                id,
                {
                    note,
                    type,
                    created_by: req.user.id,
                    created_at: new Date()
                }
            );

            logger.info('Receptionist added patient note', {
                receptionistId: req.user.id,
                patientId: id,
                noteType: type
            });

            res.status(201).json({
                success: true,
                data: patientNote,
                message: 'Note added successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error adding patient note', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get patient notes
     * GET /api/v1/reception/patients/:id/notes
     */
    async getPatientNotes(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const notes = await registrationService.getPatientNotes(
                req.user.id,
                id,
                options
            );

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
            logger.error('Error getting patient notes', {
                error: error.message,
                receptionistId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // PATIENT STATISTICS
    // ============================================

    /**
     * Get patient statistics
     * GET /api/v1/reception/patients/stats
     */
    async getPatientStats(req, res, next) {
        try {
            const stats = await registrationService.getPatientStats(req.user.id);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting patient statistics', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's registrations
     * GET /api/v1/reception/patients/today
     */
    async getTodaysRegistrations(req, res, next) {
        try {
            const registrations = await registrationService.getTodaysRegistrations(req.user.id);

            res.json({
                success: true,
                data: registrations,
                summary: {
                    total: registrations.length,
                    with_insurance: registrations.filter(r => r.insurance_provider).length,
                    walkins: registrations.filter(r => r.referred_by === 'walkin').length
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s registrations', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Merge duplicate patient records
     * POST /api/v1/reception/patients/merge
     */
    async mergePatients(req, res, next) {
        try {
            const { primary_patient_id, duplicate_patient_ids } = req.body;

            if (!primary_patient_id || !duplicate_patient_ids || !Array.isArray(duplicate_patient_ids) || duplicate_patient_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Primary patient ID and duplicate patient IDs array are required'
                });
            }

            const result = await registrationService.mergePatients(
                req.user.id,
                primary_patient_id,
                duplicate_patient_ids
            );

            logger.info('Receptionist merged patient records', {
                receptionistId: req.user.id,
                primaryId: primary_patient_id,
                duplicateCount: duplicate_patient_ids.length
            });

            res.json({
                success: true,
                data: result,
                message: 'Patient records merged successfully'
            });
        } catch (error) {
            logger.error('Error merging patients', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export patient data
     * GET /api/v1/reception/patients/export
     */
    async exportPatients(req, res, next) {
        try {
            const { format = 'csv', from_date, to_date } = req.query;

            const data = await registrationService.exportPatients(
                req.user.id,
                format,
                { from_date, to_date }
            );

            logger.info('Receptionist exported patient data', {
                receptionistId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=patients-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting patients', {
                error: error.message,
                receptionistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = registrationController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Patient Search & Lists | 3         | Search, recent, by ID
 * Patient Registration   | 3         | Register, update, deactivate
 * Emergency Contacts     | 3         | Add, update, delete
 * Patient Documents      | 3         | Upload, get, delete
 * Patient Notes          | 2         | Add, get notes
 * Patient Statistics     | 2         | Stats, today's registrations
 * Patient Merge & Export | 2         | Merge duplicates, export
 * -----------------------|-----------|----------------------
 * TOTAL                  | 18        | Complete registration management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-01] Email unique
 * - [BR-02] Phone unique
 * - [BR-03] Emergency contact required
 * - [BR-04] Age validation
 * 
 * ======================================================================
 */