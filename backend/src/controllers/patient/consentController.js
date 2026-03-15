/**
 * ======================================================================
 * FILE: backend/src/controllers/patient/consentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient consent controller handling GDPR/HIPAA compliance.
 * Manages data consent, deletion requests, and data export.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * SECURITY REQUIREMENTS COVERED:
 * - [SR-17] Right to deletion (GDPR)
 * - [SR-18] Consent management
 * - [SR-13] Audit all PHI access
 * 
 * BUSINESS RULES COVERED:
 * - [BR-06] Consent form required for treatment
 * - [BR-44] Break-glass access requires witness
 * - [BR-45] Break-glass access auto-expires in 1 hour
 * 
 * INTEGRATION REQUIREMENTS COVERED:
 * - [IR-02] Send critical alerts
 * - [IR-07] Send reports via email
 * - [IR-19] File archival
 * 
 * ENDPOINTS:
 * GET    /patient/consents                    - All consents
 * POST   /patient/consents                     - Give consent
 * GET    /patient/consents/:id                  - Get consent by ID
 * PUT    /patient/consents/:id                   - Update consent
 * DELETE /patient/consents/:id                    - Revoke consent
 * GET    /patient/consents/history                  - Consent history
 * POST   /patient/data-export                         - Request data export
 * GET    /patient/data-export/:id                        - Get export status
 * POST   /patient/deletion-request                         - Request deletion
 * GET    /patient/deletion-request/:id                       - Get deletion status
 * PUT    /patient/deletion-request/:id/cancel                   - Cancel deletion request
 * GET    /patient/consents/phi-access                               - View PHI access logs
 * POST   /patient/consents/break-glass                                - Emergency break-glass access
 * 
 * ======================================================================
 */

const consentService = require('../../services/patient/consentService');
const patientService = require('../../services/patient/patientService');
const logger = require('../../utils/logger');

/**
 * Patient Consent Controller
 */
const consentController = {
    // ============================================
    // CONSENT MANAGEMENT
    // ============================================

    /**
     * Get all consents for patient
     * GET /api/v1/patient/consents
     * 
     * SECURITY: [SR-18] Consent management
     */
    async getConsents(req, res, next) {
        try {
            const consents = await consentService.getConsents(req.user.id);

            logger.info('Consents retrieved', { 
                userId: req.user.id,
                count: consents.length
            });

            // [SR-13] Audit PHI access
            logger.audit({
                action: 'VIEW_CONSENTS',
                userId: req.user.id,
                resource: 'consent_records',
                details: { count: consents.length }
            });

            res.json({
                success: true,
                data: consents
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
     * Get consent by ID
     * GET /api/v1/patient/consents/:id
     * 
     * SECURITY: [SR-18] Consent management
     */
    async getConsentById(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            const consent = await consentService.getConsentById(id, patient.id);

            if (!consent) {
                return res.status(404).json({
                    success: false,
                    error: 'Consent not found'
                });
            }

            // [SR-13] Audit PHI access
            logger.audit({
                action: 'VIEW_CONSENT',
                userId: req.user.id,
                resource: 'consent_records',
                resourceId: id
            });

            res.json({
                success: true,
                data: consent
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
     * Give new consent
     * POST /api/v1/patient/consents
     * 
     * SECURITY: [SR-18] Consent management
     * BUSINESS RULE: [BR-06] Consent form required
     */
    async giveConsent(req, res, next) {
        try {
            const { consentType, consentVersion, consentText, expiresAt } = req.body;

            // Validate required fields
            if (!consentType) {
                return res.status(400).json({
                    success: false,
                    error: 'Consent type is required'
                });
            }

            // [BR-06] Consent form required
            if (!consentText) {
                return res.status(400).json({
                    success: false,
                    error: 'Consent text is required'
                });
            }

            const metadata = {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                consentVersion: consentVersion || '1.0',
                consentText,
                expiresAt
            };

            const consent = await consentService.giveConsent(
                req.user.id,
                consentType,
                metadata
            );

            logger.info('Consent granted', {
                userId: req.user.id,
                consentType,
                consentId: consent.id
            });

            // [SR-13] Audit consent grant
            logger.audit({
                action: 'GRANT_CONSENT',
                userId: req.user.id,
                resource: 'consent_records',
                resourceId: consent.id,
                details: { consentType }
            });

            res.status(201).json({
                success: true,
                data: consent,
                message: 'Consent granted successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message.includes('Invalid consent type')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    /**
     * Update consent
     * PUT /api/v1/patient/consents/:id
     * 
     * SECURITY: [SR-18] Consent management
     */
    async updateConsent(req, res, next) {
        try {
            const { id } = req.params;
            const { consentVersion, consentText, expiresAt } = req.body;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const updates = {
                consent_version: consentVersion,
                consent_text: consentText,
                expires_at: expiresAt,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            };

            const updated = await consentService.updateConsent(id, patient.id, updates);

            logger.info('Consent updated', {
                userId: req.user.id,
                consentId: id
            });

            // [SR-13] Audit consent update
            logger.audit({
                action: 'UPDATE_CONSENT',
                userId: req.user.id,
                resource: 'consent_records',
                resourceId: id
            });

            res.json({
                success: true,
                data: updated,
                message: 'Consent updated successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found' || error.message === 'Consent not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    /**
     * Revoke consent
     * DELETE /api/v1/patient/consents/:id
     * 
     * SECURITY: [SR-18] Consent management
     */
    async revokeConsent(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Revocation reason is required'
                });
            }

            const metadata = {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            };

            const revoked = await consentService.revokeConsentById(
                req.user.id,
                id,
                reason,
                metadata
            );

            logger.info('Consent revoked', {
                userId: req.user.id,
                consentId: id,
                reason
            });

            // [SR-13] Audit consent revocation
            logger.audit({
                action: 'REVOKE_CONSENT',
                userId: req.user.id,
                resource: 'consent_records',
                resourceId: id,
                details: { reason }
            });

            res.json({
                success: true,
                data: revoked,
                message: 'Consent revoked successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found' || error.message === 'Consent not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    /**
     * Get consent history
     * GET /api/v1/patient/consents/history
     * 
     * SECURITY: [SR-18] Consent management
     */
    async getConsentHistory(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const history = await consentService.getConsentHistory(patient.id);

            // [SR-13] Audit consent history access
            logger.audit({
                action: 'VIEW_CONSENT_HISTORY',
                userId: req.user.id,
                resource: 'consent_records'
            });

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
    // DATA EXPORT (GDPR)
    // ============================================

    /**
     * Request data export
     * POST /api/v1/patient/data-export
     * 
     * SECURITY: [SR-17] Right to deletion (GDPR)
     */
    async requestDataExport(req, res, next) {
        try {
            const { format = 'json', includeMedical = true, includeBilling = true } = req.body;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const exportRequest = await consentService.requestDataExport({
                patient_id: patient.id,
                requested_by: req.user.id,
                format,
                include_medical: includeMedical,
                include_billing: includeBilling,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            logger.info('Data export requested', {
                userId: req.user.id,
                exportId: exportRequest.id,
                format
            });

            // [SR-13] Audit export request
            logger.audit({
                action: 'REQUEST_DATA_EXPORT',
                userId: req.user.id,
                resource: 'patient_data',
                details: { format, exportId: exportRequest.id }
            });

            res.status(202).json({
                success: true,
                data: {
                    exportId: exportRequest.id,
                    status: exportRequest.status,
                    estimatedCompletion: exportRequest.estimated_completion,
                    message: 'Data export request accepted. You will be notified when ready.'
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

    /**
     * Get export status
     * GET /api/v1/patient/data-export/:id
     * 
     * SECURITY: [SR-17] Right to deletion (GDPR)
     */
    async getExportStatus(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const exportStatus = await consentService.getExportStatus(id, patient.id);

            if (!exportStatus) {
                return res.status(404).json({
                    success: false,
                    error: 'Export request not found'
                });
            }

            res.json({
                success: true,
                data: exportStatus
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
     * Download exported data
     * GET /api/v1/patient/data-export/:id/download
     * 
     * SECURITY: [SR-17] Right to deletion (GDPR)
     * [IR-19] File archival
     */
    async downloadExportedData(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const exportData = await consentService.downloadExportedData(id, patient.id);

            if (!exportData) {
                return res.status(404).json({
                    success: false,
                    error: 'Export data not found or not ready'
                });
            }

            logger.info('Exported data downloaded', {
                userId: req.user.id,
                exportId: id
            });

            // [SR-13] Audit data download
            logger.audit({
                action: 'DOWNLOAD_EXPORTED_DATA',
                userId: req.user.id,
                resource: 'patient_data',
                resourceId: id
            });

            res.setHeader('Content-Type', exportData.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename=${exportData.filename}`);
            res.send(exportData.buffer);
        } catch (error) {
            if (error.message === 'Patient profile not found' || error.message === 'Export data not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    // ============================================
    // DELETION REQUESTS (GDPR - Right to be Forgotten)
    // ============================================

    /**
     * Request data deletion
     * POST /api/v1/patient/deletion-request
     * 
     * SECURITY: [SR-17] Right to deletion (GDPR)
     */
    async requestDeletion(req, res, next) {
        try {
            const { reason, withdrawConsent = true } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Deletion reason is required'
                });
            }

            const request = await consentService.requestDataDeletion(
                req.user.id,
                reason,
                withdrawConsent
            );

            logger.warn('Data deletion requested', {
                userId: req.user.id,
                requestId: request.id,
                reason
            });

            // [SR-13] Audit deletion request
            logger.audit({
                action: 'REQUEST_DATA_DELETION',
                userId: req.user.id,
                resource: 'patient_data',
                resourceId: request.id,
                details: { reason }
            });

            // [IR-02] Send critical alert to admins
            await consentService.notifyAdminsOfDeletionRequest(request.id);

            res.status(202).json({
                success: true,
                data: {
                    requestId: request.id,
                    status: request.request_status,
                    requestDate: request.request_date,
                    estimatedCompletion: request.request_status === 'approved' ? 
                        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
                    message: 'Deletion request submitted. You will be notified once processed.'
                }
            });
        } catch (error) {
            if (error.message === 'Patient profile not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient profile not found'
                });
            }
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    /**
     * Get deletion request status
     * GET /api/v1/patient/deletion-request/:id
     * 
     * SECURITY: [SR-17] Right to deletion (GDPR)
     */
    async getDeletionStatus(req, res, next) {
        try {
            const { id } = req.params;

            const status = await consentService.getDeletionRequestStatus(req.user.id, id);

            if (!status) {
                return res.status(404).json({
                    success: false,
                    error: 'Deletion request not found'
                });
            }

            res.json({
                success: true,
                data: status
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
     * Cancel deletion request
     * PUT /api/v1/patient/deletion-request/:id/cancel
     * 
     * SECURITY: [SR-17] Right to deletion (GDPR)
     */
    async cancelDeletionRequest(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Cancellation reason is required'
                });
            }

            const cancelled = await consentService.cancelDeletionRequest(
                req.user.id,
                id,
                reason
            );

            logger.info('Deletion request cancelled', {
                userId: req.user.id,
                requestId: id,
                reason
            });

            // [SR-13] Audit cancellation
            logger.audit({
                action: 'CANCEL_DELETION_REQUEST',
                userId: req.user.id,
                resource: 'deletion_requests',
                resourceId: id,
                details: { reason }
            });

            res.json({
                success: true,
                data: cancelled,
                message: 'Deletion request cancelled successfully'
            });
        } catch (error) {
            if (error.message === 'Patient profile not found' || error.message === 'Deletion request not found') {
                return res.status(404).json({
                    success: false,
                    error: error.message
                });
            }
            if (error.message.includes('Cannot cancel')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    // ============================================
    // PHI ACCESS LOGS
    // ============================================

    /**
     * View PHI access logs
     * GET /api/v1/patient/consents/phi-access
     * 
     * SECURITY: [SR-13] Audit all PHI access
     */
    async getPHIAccessLogs(req, res, next) {
        try {
            const { page = 1, limit = 20, fromDate, toDate } = req.query;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const logs = await consentService.getPHIAccessLogs(patient.id, {
                page: parseInt(page),
                limit: parseInt(limit),
                fromDate,
                toDate
            });

            logger.info('PHI access logs viewed', {
                userId: req.user.id,
                count: logs.data?.length || 0
            });

            res.json({
                success: true,
                data: logs.data || logs,
                pagination: logs.pagination
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
     * Get detailed PHI access record
     * GET /api/v1/patient/consents/phi-access/:id
     * 
     * SECURITY: [SR-13] Audit all PHI access
     */
    async getPHIAccessDetail(req, res, next) {
        try {
            const { id } = req.params;

            const patient = await patientService.getPatientProfile(req.user.id);
            
            const detail = await consentService.getPHIAccessDetail(id, patient.id);

            if (!detail) {
                return res.status(404).json({
                    success: false,
                    error: 'Access log not found'
                });
            }

            res.json({
                success: true,
                data: detail
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
    // BREAK-GLASS ACCESS (Emergency)
    // ============================================

    /**
     * Request emergency break-glass access
     * POST /api/v1/patient/consents/break-glass
     * 
     * SECURITY: [SR-18] Consent management
     * BUSINESS RULES: [BR-44] Witness required, [BR-45] Auto-expires in 1 hour
     */
    async requestBreakGlassAccess(req, res, next) {
        try {
            const { patientId, reason, clinicalContext, witnessId } = req.body;

            // Validate required fields
            if (!patientId) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Emergency reason is required'
                });
            }

            // [BR-44] Break-glass access requires witness
            if (!witnessId) {
                return res.status(400).json({
                    success: false,
                    error: 'Break-glass access requires a witness'
                });
            }

            const access = await consentService.requestBreakGlassAccess({
                doctor_id: req.user.id,
                patient_id: patientId,
                reason,
                clinical_context: clinicalContext,
                witness_id: witnessId,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            logger.warn('Break-glass access granted', {
                doctorId: req.user.id,
                patientId,
                accessId: access.id
            });

            // [BR-45] Auto-expires in 1 hour
            // Set in service layer

            // [SR-13] Audit break-glass access
            logger.audit({
                action: 'BREAK_GRASS_ACCESS',
                userId: req.user.id,
                resource: 'patient_data',
                resourceId: patientId,
                details: { accessId: access.id, reason }
            });

            // [IR-02] Send critical alert to IT admins
            await consentService.notifyITAdminsOfBreakGlass(access.id);

            res.status(201).json({
                success: true,
                data: {
                    accessId: access.id,
                    expiresAt: access.expires_at,
                    message: 'Emergency access granted. This will be logged and reviewed.'
                }
            });
        } catch (error) {
            if (error.message.includes('witness')) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
            next(error);
        }
    },

    /**
     * Get active break-glass sessions
     * GET /api/v1/patient/consents/break-glass/active
     * 
     * SECURITY: [SR-18] Consent management
     */
    async getActiveBreakGlassSessions(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const sessions = await consentService.getActiveBreakGlassSessions(patient.id);

            res.json({
                success: true,
                data: sessions
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
    // CONSENT DASHBOARD & SUMMARY
    // ============================================

    /**
     * Get consent dashboard
     * GET /api/v1/patient/consents/dashboard
     * 
     * SECURITY: [SR-18] Consent management
     */
    async getConsentDashboard(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const dashboard = await consentService.getConsentDashboard(patient.id);

            res.json({
                success: true,
                data: dashboard
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
     * Get consent statistics
     * GET /api/v1/patient/consents/stats
     * 
     * SECURITY: [SR-18] Consent management
     */
    async getConsentStats(req, res, next) {
        try {
            const patient = await patientService.getPatientProfile(req.user.id);
            
            const stats = await consentService.getConsentStats(patient.id);

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
     * Get available consent types
     * GET /api/v1/patient/consents/types
     * 
     * SECURITY: [SR-18] Consent management
     */
    async getConsentTypes(req, res, next) {
        try {
            const types = consentService.getAvailableConsentTypes();

            res.json({
                success: true,
                data: types
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = consentController;

/**
 * ======================================================================
 * USAGE IN ROUTES:
 * ======================================================================
 * 
 * const consentController = require('./controllers/patient/consentController');
 * const authenticate = require('../middlewares/auth');
 * const validate = require('../middlewares/validator');
 * const { 
 *     validateConsent,
 *     validateDeletionRequest,
 *     validateBreakGlass
 * } = require('../validators/patientValidators');
 * 
 * // Consent management
 * router.get('/consents', authenticate, consentController.getConsents);
 * router.get('/consents/types', authenticate, consentController.getConsentTypes);
 * router.get('/consents/dashboard', authenticate, consentController.getConsentDashboard);
 * router.get('/consents/stats', authenticate, consentController.getConsentStats);
 * router.get('/consents/:id', authenticate, consentController.getConsentById);
 * router.post('/consents', authenticate, validate(validateConsent), consentController.giveConsent);
 * router.put('/consents/:id', authenticate, consentController.updateConsent);
 * router.delete('/consents/:id', authenticate, consentController.revokeConsent);
 * router.get('/consents/history', authenticate, consentController.getConsentHistory);
 * 
 * // PHI access logs
 * router.get('/consents/phi-access', authenticate, consentController.getPHIAccessLogs);
 * router.get('/consents/phi-access/:id', authenticate, consentController.getPHIAccessDetail);
 * 
 * // Break-glass access
 * router.post('/consents/break-glass', authenticate, validate(validateBreakGlass), consentController.requestBreakGlassAccess);
 * router.get('/consents/break-glass/active', authenticate, consentController.getActiveBreakGlassSessions);
 * 
 * // Data export
 * router.post('/data-export', authenticate, consentController.requestDataExport);
 * router.get('/data-export/:id', authenticate, consentController.getExportStatus);
 * router.get('/data-export/:id/download', authenticate, consentController.downloadExportedData);
 * 
 * // Deletion requests (GDPR)
 * router.post('/deletion-request', authenticate, validate(validateDeletionRequest), consentController.requestDeletion);
 * router.get('/deletion-request/:id', authenticate, consentController.getDeletionStatus);
 * router.put('/deletion-request/:id/cancel', authenticate, consentController.cancelDeletionRequest);
 * 
 * ======================================================================
 */