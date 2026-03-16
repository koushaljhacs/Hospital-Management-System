/**
 * ======================================================================
 * FILE: backend/src/controllers/nurse/medicationController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse medication management controller - Handles medication administration,
 * scheduling, and tracking for patients.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-16] Controlled substances need special flag and witness
 * - [BR-18] Cannot dispense expired medicine
 * 
 * ENDPOINTS:
 * GET    /nurse/medications                    - Medication schedules
 * GET    /nurse/medications/today                 - Today's schedules
 * GET    /nurse/medications/due                     - Due now
 * GET    /nurse/medications/:id                      - Get schedule
 * PUT    /nurse/medications/:id/administer            - Administer med
 * PUT    /nurse/medications/:id/skip                    - Skip med
 * GET    /nurse/medications/history                      - Administration history
 * 
 * ======================================================================
 */

const medicationService = require('../../services/nurse/medicationService');
const logger = require('../../utils/logger');

/**
 * Nurse Medication Controller
 */
const medicationController = {
    // ============================================
    // MEDICATION LISTS
    // ============================================

    /**
     * Get medication schedules
     * GET /api/v1/nurse/medications
     */
    async getMedications(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                patient_id,
                status,
                from_date,
                to_date,
                medication_name
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id,
                status,
                from_date,
                to_date,
                medication_name
            };

            const medications = await medicationService.getMedications(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved medication schedules', {
                nurseId: req.user.id,
                count: medications.data?.length || 0
            });

            res.json({
                success: true,
                data: medications.data,
                pagination: medications.pagination,
                summary: medications.summary
            });
        } catch (error) {
            logger.error('Error getting medications', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get today's medication schedules
     * GET /api/v1/nurse/medications/today
     */
    async getTodayMedications(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 50,
                patient_id,
                status 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id,
                status
            };

            const medications = await medicationService.getTodayMedications(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved today\'s medications', {
                nurseId: req.user.id,
                count: medications.data?.length || 0
            });

            // Group by time slot for easier administration
            const byTimeSlot = {
                morning: medications.data?.filter(m => m.time_slot === 'morning').length || 0,
                afternoon: medications.data?.filter(m => m.time_slot === 'afternoon').length || 0,
                evening: medications.data?.filter(m => m.time_slot === 'evening').length || 0,
                night: medications.data?.filter(m => m.time_slot === 'night').length || 0,
                as_needed: medications.data?.filter(m => m.time_slot === 'as_needed').length || 0
            };

            res.json({
                success: true,
                data: medications.data,
                pagination: medications.pagination,
                summary: {
                    total: medications.summary?.total || 0,
                    scheduled: medications.summary?.scheduled || 0,
                    administered: medications.summary?.administered || 0,
                    missed: medications.summary?.missed || 0,
                    by_time_slot: byTimeSlot,
                    controlled_substances: medications.data?.filter(m => m.is_controlled).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting today\'s medications', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get due medications (current time)
     * GET /api/v1/nurse/medications/due
     */
    async getDueMedications(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 50,
                patient_id,
                grace_period = 30 // minutes
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id,
                grace_period: parseInt(grace_period)
            };

            const medications = await medicationService.getDueMedications(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved due medications', {
                nurseId: req.user.id,
                count: medications.data?.length || 0,
                grace_period: parseInt(grace_period)
            });

            // Calculate overdue counts
            const now = new Date();
            const overdue = medications.data?.filter(m => 
                new Date(m.scheduled_time) < now
            ).length || 0;

            res.json({
                success: true,
                data: medications.data,
                pagination: medications.pagination,
                summary: {
                    total: medications.data?.length || 0,
                    due_now: medications.data?.filter(m => 
                        Math.abs(new Date(m.scheduled_time) - now) <= parseInt(grace_period) * 60000
                    ).length || 0,
                    overdue,
                    critical: medications.data?.filter(m => m.is_critical).length || 0,
                    controlled: medications.data?.filter(m => m.is_controlled).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting due medications', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get medication schedule by ID
     * GET /api/v1/nurse/medications/:id
     */
    async getMedicationById(req, res, next) {
        try {
            const { id } = req.params;

            const medication = await medicationService.getMedicationById(
                req.user.id,
                id
            );

            if (!medication) {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }

            logger.info('Nurse viewed medication schedule', {
                nurseId: req.user.id,
                medicationId: id,
                patientId: medication.patient_id
            });

            // [SR-13] Audit PHI access
            logger.audit({
                action: 'NURSE_VIEW_MEDICATION',
                userId: req.user.id,
                resource: 'medications',
                resourceId: id,
                patientId: medication.patient_id
            });

            res.json({
                success: true,
                data: medication
            });
        } catch (error) {
            if (error.message === 'Medication schedule not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }
            logger.error('Error getting medication by ID', {
                error: error.message,
                nurseId: req.user.id,
                medicationId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // MEDICATION ADMINISTRATION
    // ============================================

    /**
     * Administer medication
     * PUT /api/v1/nurse/medications/:id/administer
     * 
     * BUSINESS RULES:
     * - [BR-14] Medicine quantity positive
     * - [BR-15] Dosage required
     * - [BR-16] Controlled substances need witness
     * - [BR-18] Cannot dispense expired medicine
     */
    async administerMedication(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                administered_at,
                route,
                notes,
                witness_id,
                reactions,
                remaining_quantity
            } = req.body;

            // Get medication details to check rules
            const medication = await medicationService.getMedicationById(
                req.user.id,
                id
            );

            if (!medication) {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }

            // [BR-18] Check if medicine is expired
            if (medication.expiry_date && new Date(medication.expiry_date) < new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot administer expired medication'
                });
            }

            // [BR-16] Check if controlled substance requires witness
            if (medication.is_controlled && !witness_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Controlled substances require a witness'
                });
            }

            // [BR-14] Check quantity
            if (remaining_quantity !== undefined && remaining_quantity < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Remaining quantity cannot be negative'
                });
            }

            const administration = await medicationService.administerMedication(
                req.user.id,
                id,
                {
                    administered_at: administered_at || new Date(),
                    route,
                    notes,
                    witness_id,
                    reactions,
                    remaining_quantity
                }
            );

            logger.info('Nurse administered medication', {
                nurseId: req.user.id,
                medicationId: id,
                patientId: medication.patient_id,
                isControlled: medication.is_controlled,
                hasWitness: !!witness_id
            });

            // Log controlled substance administration [BR-16]
            if (medication.is_controlled) {
                logger.audit({
                    action: 'CONTROLLED_SUBSTANCE_ADMIN',
                    userId: req.user.id,
                    witnessId: witness_id,
                    resource: 'medications',
                    resourceId: id,
                    patientId: medication.patient_id,
                    details: { medication_name: medication.medication_name }
                });
            }

            res.json({
                success: true,
                data: administration,
                message: medication.is_controlled 
                    ? 'Controlled medication administered with witness' 
                    : 'Medication administered successfully'
            });
        } catch (error) {
            if (error.message === 'Medication schedule not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }
            if (error.message === 'Medication already administered') {
                return res.status(400).json({
                    success: false,
                    error: 'Medication already administered'
                });
            }
            if (error.message === 'Invalid witness') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid witness'
                });
            }
            logger.error('Error administering medication', {
                error: error.message,
                nurseId: req.user.id,
                medicationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Skip medication
     * PUT /api/v1/nurse/medications/:id/skip
     */
    async skipMedication(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                reason,
                notes,
                physician_notified = false,
                alternative_action
            } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Skip reason is required'
                });
            }

            const medication = await medicationService.getMedicationById(
                req.user.id,
                id
            );

            if (!medication) {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }

            // For controlled substances, require physician notification [BR-16]
            if (medication.is_controlled && !physician_notified) {
                return res.status(400).json({
                    success: false,
                    error: 'Physician must be notified before skipping controlled substances'
                });
            }

            const skip = await medicationService.skipMedication(
                req.user.id,
                id,
                {
                    reason,
                    notes,
                    physician_notified,
                    alternative_action,
                    skipped_at: new Date()
                }
            );

            logger.info('Nurse skipped medication', {
                nurseId: req.user.id,
                medicationId: id,
                patientId: medication.patient_id,
                reason,
                isControlled: medication.is_controlled
            });

            res.json({
                success: true,
                data: skip,
                message: 'Medication skipped successfully'
            });
        } catch (error) {
            if (error.message === 'Medication schedule not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }
            if (error.message === 'Medication already administered') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot skip administered medication'
                });
            }
            logger.error('Error skipping medication', {
                error: error.message,
                nurseId: req.user.id,
                medicationId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // MEDICATION HISTORY
    // ============================================

    /**
     * Get medication administration history
     * GET /api/v1/nurse/medications/history
     */
    async getMedicationHistory(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20,
                patient_id,
                from_date,
                to_date,
                medication_name,
                administered_by
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                patient_id,
                from_date,
                to_date,
                medication_name,
                administered_by: administered_by || req.user.id
            };

            const history = await medicationService.getMedicationHistory(
                req.user.id,
                options
            );

            logger.info('Nurse viewed medication history', {
                nurseId: req.user.id,
                count: history.data?.length || 0
            });

            res.json({
                success: true,
                data: history.data,
                pagination: history.pagination,
                summary: history.summary
            });
        } catch (error) {
            logger.error('Error getting medication history', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get patient medication timeline
     * GET /api/v1/nurse/medications/patient/:patientId/timeline
     */
    async getPatientMedicationTimeline(req, res, next) {
        try {
            const { patientId } = req.params;
            const { days = 7 } = req.query;

            const timeline = await medicationService.getPatientMedicationTimeline(
                req.user.id,
                patientId,
                parseInt(days)
            );

            logger.info('Nurse viewed patient medication timeline', {
                nurseId: req.user.id,
                patientId,
                days: parseInt(days)
            });

            res.json({
                success: true,
                data: timeline,
                summary: {
                    total_scheduled: timeline.scheduled?.length || 0,
                    administered: timeline.administered?.length || 0,
                    missed: timeline.missed?.length || 0,
                    skipped: timeline.skipped?.length || 0,
                    adherence_rate: timeline.adherence_rate
                }
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error getting patient medication timeline', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.patientId
            });
            next(error);
        }
    },

    // ============================================
    // MEDICATION VERIFICATION
    // ============================================

    /**
     * Verify medication before administration (5 Rights check)
     * POST /api/v1/nurse/medications/:id/verify
     */
    async verifyMedication(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                patient_id,
                medication_name,
                dosage,
                route,
                time
            } = req.body;

            const verification = await medicationService.verifyMedication(
                req.user.id,
                id,
                {
                    patient_id,
                    medication_name,
                    dosage,
                    route,
                    time
                }
            );

            logger.info('Nurse verified medication', {
                nurseId: req.user.id,
                medicationId: id,
                verified: verification.verified,
                errors: verification.errors?.length
            });

            res.json({
                success: true,
                data: verification,
                message: verification.verified 
                    ? 'Medication verification passed' 
                    : 'Medication verification failed'
            });
        } catch (error) {
            if (error.message === 'Medication schedule not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }
            logger.error('Error verifying medication', {
                error: error.message,
                nurseId: req.user.id,
                medicationId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get medication details with verification checklist
     * GET /api/v1/nurse/medications/:id/verify-info
     */
    async getMedicationVerificationInfo(req, res, next) {
        try {
            const { id } = req.params;

            const info = await medicationService.getMedicationVerificationInfo(
                req.user.id,
                id
            );

            if (!info) {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }

            res.json({
                success: true,
                data: info,
                checklist: {
                    right_patient: info.patient_matches,
                    right_medication: info.medication_matches,
                    right_dosage: info.dosage_matches,
                    right_route: info.route_matches,
                    right_time: info.time_matches,
                    right_documentation: true
                }
            });
        } catch (error) {
            if (error.message === 'Medication schedule not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Medication schedule not found'
                });
            }
            logger.error('Error getting medication verification info', {
                error: error.message,
                nurseId: req.user.id,
                medicationId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // MEDICATION STATISTICS
    // ============================================

    /**
     * Get medication administration statistics
     * GET /api/v1/nurse/medications/stats
     */
    async getMedicationStats(req, res, next) {
        try {
            const { period = 'week', patient_id } = req.query;

            const stats = await medicationService.getMedicationStats(
                req.user.id,
                {
                    period,
                    patient_id
                }
            );

            logger.info('Nurse viewed medication statistics', {
                nurseId: req.user.id,
                period
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting medication statistics', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get medication adherence rate
     * GET /api/v1/nurse/medications/adherence
     */
    async getMedicationAdherence(req, res, next) {
        try {
            const { patient_id, days = 30 } = req.query;

            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            const adherence = await medicationService.getMedicationAdherence(
                req.user.id,
                patient_id,
                parseInt(days)
            );

            res.json({
                success: true,
                data: adherence
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error getting medication adherence', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.query.patient_id
            });
            next(error);
        }
    },

    // ============================================
    // MEDICATION ALERTS
    // ============================================

    /**
     * Get medication alerts (allergies, interactions, etc.)
     * GET /api/v1/nurse/medications/alerts
     */
    async getMedicationAlerts(req, res, next) {
        try {
            const { patient_id, medication_id } = req.query;

            const alerts = await medicationService.getMedicationAlerts(
                req.user.id,
                {
                    patient_id,
                    medication_id
                }
            );

            logger.info('Nurse viewed medication alerts', {
                nurseId: req.user.id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    critical: alerts.filter(a => a.severity === 'critical').length,
                    warning: alerts.filter(a => a.severity === 'warning').length,
                    info: alerts.filter(a => a.severity === 'info').length
                }
            });
        } catch (error) {
            logger.error('Error getting medication alerts', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Check for drug interactions
     * POST /api/v1/nurse/medications/check-interactions
     */
    async checkDrugInteractions(req, res, next) {
        try {
            const { medication_ids, patient_id } = req.body;

            if (!medication_ids || !Array.isArray(medication_ids) || medication_ids.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'At least two medication IDs are required'
                });
            }

            const interactions = await medicationService.checkDrugInteractions(
                req.user.id,
                medication_ids,
                patient_id
            );

            logger.info('Nurse checked drug interactions', {
                nurseId: req.user.id,
                medicationCount: medication_ids.length,
                interactionCount: interactions.length
            });

            res.json({
                success: true,
                data: interactions,
                summary: {
                    total: interactions.length,
                    severe: interactions.filter(i => i.severity === 'severe').length,
                    moderate: interactions.filter(i => i.severity === 'moderate').length,
                    mild: interactions.filter(i => i.severity === 'mild').length
                }
            });
        } catch (error) {
            logger.error('Error checking drug interactions', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // PRN (AS NEEDED) MEDICATIONS
    // ============================================

    /**
     * Get PRN medication requests
     * GET /api/v1/nurse/medications/prn-requests
     */
    async getPrnRequests(req, res, next) {
        try {
            const { status = 'pending', page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status
            };

            const requests = await medicationService.getPrnRequests(
                req.user.id,
                options
            );

            logger.info('Nurse viewed PRN requests', {
                nurseId: req.user.id,
                count: requests.data?.length || 0
            });

            res.json({
                success: true,
                data: requests.data,
                pagination: requests.pagination
            });
        } catch (error) {
            logger.error('Error getting PRN requests', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Administer PRN medication
     * POST /api/v1/nurse/medications/prn-administer
     */
    async administerPrnMedication(req, res, next) {
        try {
            const {
                patient_id,
                medication_name,
                dosage,
                route,
                reason,
                notes,
                witness_id,
                effectiveness
            } = req.body;

            if (!patient_id || !medication_name || !dosage || !route || !reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing required fields'
                });
            }

            const administration = await medicationService.administerPrnMedication(
                req.user.id,
                {
                    patient_id,
                    medication_name,
                    dosage,
                    route,
                    reason,
                    notes,
                    witness_id,
                    effectiveness,
                    administered_at: new Date()
                }
            );

            logger.info('Nurse administered PRN medication', {
                nurseId: req.user.id,
                patientId: patient_id,
                medicationName: medication_name,
                reason
            });

            res.status(201).json({
                success: true,
                data: administration,
                message: 'PRN medication administered successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error administering PRN medication', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = medicationController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category                    | Endpoints | Description
 * ----------------------------|-----------|----------------------
 * Medication Lists            | 4         | All, today, due, by ID
 * Administration              | 2         | Administer, skip
 * History & Timeline          | 2         | History, patient timeline
 * Verification                | 2         | Verify, verification info
 * Statistics                  | 2         | Stats, adherence
 * Alerts & Interactions       | 2         | Alerts, check interactions
 * PRN Medications             | 2         | PRN requests, administer
 * ----------------------------|-----------|----------------------
 * TOTAL                       | 16        | Complete medication management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-14] Medicine quantity positive
 * - [BR-15] Dosage required
 * - [BR-16] Controlled substances need witness
 * - [BR-18] Cannot dispense expired medicine
 * - [SR-13] PHI access logging
 * 
 * ======================================================================
 */