/**
 * ======================================================================
 * FILE: backend/src/controllers/nurse/vitalController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse vital signs controller - Handles recording, updating, and 
 * monitoring patient vital signs with critical value alerts.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * 
 * ENDPOINTS:
 * GET    /nurse/vitals                    - All vitals (paginated)
 * GET    /nurse/vitals/recent              - Recent vitals (ward)
 * GET    /nurse/vitals/:id                  - Get vital record
 * POST   /nurse/vitals                       - Record vitals
 * POST   /nurse/patients/:id/vitals          - Record for specific patient
 * PUT    /nurse/vitals/:id                    - Update vitals
 * DELETE /nurse/vitals/:id                     - Delete vitals
 * GET    /nurse/vitals/charts                  - Charts data
 * GET    /nurse/vitals/trends                   - Trend analysis
 * 
 * ======================================================================
 */

const vitalService = require('../../services/nurse/vitalService');
const logger = require('../../utils/logger');

/**
 * Nurse Vital Signs Controller
 */
const vitalController = {
    // ============================================
    // VITAL LISTS
    // ============================================

    /**
     * Get all vitals (paginated)
     * GET /api/v1/nurse/vitals
     */
    async getAllVitals(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                ward,
                patient_id,
                from_date,
                to_date,
                type,
                critical_only = false
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                ward: ward || req.user.ward,
                patient_id,
                from_date,
                to_date,
                type,
                critical_only: critical_only === 'true'
            };

            const vitals = await vitalService.getAllVitals(
                req.user.id,
                options
            );

            logger.info('Nurse retrieved vitals', {
                nurseId: req.user.id,
                count: vitals.data?.length || 0,
                ward: options.ward,
                critical_only: options.critical_only
            });

            res.json({
                success: true,
                data: vitals.data,
                pagination: vitals.pagination,
                summary: vitals.summary
            });
        } catch (error) {
            logger.error('Error getting all vitals', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get recent vitals (ward)
     * GET /api/v1/nurse/vitals/recent
     */
    async getRecentVitals(req, res, next) {
        try {
            const { limit = 50, ward } = req.query;

            const vitals = await vitalService.getRecentVitals(
                req.user.id,
                {
                    ward: ward || req.user.ward,
                    limit: parseInt(limit)
                }
            );

            logger.info('Nurse retrieved recent vitals', {
                nurseId: req.user.id,
                count: vitals.length,
                ward: ward || req.user.ward
            });

            // Group by patient for better display
            const byPatient = vitals.reduce((acc, vital) => {
                if (!acc[vital.patient_id]) {
                    acc[vital.patient_id] = {
                        patient_name: vital.patient_name,
                        patient_room: vital.patient_room,
                        vitals: []
                    };
                }
                acc[vital.patient_id].vitals.push(vital);
                return acc;
            }, {});

            res.json({
                success: true,
                data: vitals,
                by_patient: byPatient,
                summary: {
                    total: vitals.length,
                    unique_patients: Object.keys(byPatient).length,
                    critical_count: vitals.filter(v => v.is_critical).length
                }
            });
        } catch (error) {
            logger.error('Error getting recent vitals', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get vital by ID
     * GET /api/v1/nurse/vitals/:id
     */
    async getVitalById(req, res, next) {
        try {
            const { id } = req.params;

            const vital = await vitalService.getVitalById(
                req.user.id,
                id
            );

            if (!vital) {
                return res.status(404).json({
                    success: false,
                    error: 'Vital record not found'
                });
            }

            logger.info('Nurse viewed vital record', {
                nurseId: req.user.id,
                vitalId: id,
                patientId: vital.patient_id
            });

            // [SR-13] Audit PHI access
            logger.audit({
                action: 'NURSE_VIEW_VITAL',
                userId: req.user.id,
                resource: 'vitals',
                resourceId: id,
                patientId: vital.patient_id
            });

            res.json({
                success: true,
                data: vital
            });
        } catch (error) {
            if (error.message === 'Vital record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Vital record not found'
                });
            }
            logger.error('Error getting vital by ID', {
                error: error.message,
                nurseId: req.user.id,
                vitalId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // RECORD VITALS
    // ============================================

    /**
     * Record vitals (general)
     * POST /api/v1/nurse/vitals
     */
    async recordVitals(req, res, next) {
        try {
            const vitalData = {
                patient_id: req.body.patient_id,
                blood_pressure_systolic: req.body.blood_pressure_systolic,
                blood_pressure_diastolic: req.body.blood_pressure_diastolic,
                heart_rate: req.body.heart_rate,
                temperature: req.body.temperature,
                respiratory_rate: req.body.respiratory_rate,
                oxygen_saturation: req.body.oxygen_saturation,
                blood_glucose: req.body.blood_glucose,
                pain_scale: req.body.pain_scale,
                height: req.body.height,
                weight: req.body.weight,
                bmi: req.body.bmi,
                notes: req.body.notes,
                recorded_by: req.user.id,
                recorded_at: new Date(),
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!vitalData.patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            // At least one vital sign must be recorded
            const hasVitals = 
                vitalData.blood_pressure_systolic ||
                vitalData.blood_pressure_diastolic ||
                vitalData.heart_rate ||
                vitalData.temperature ||
                vitalData.respiratory_rate ||
                vitalData.oxygen_saturation ||
                vitalData.blood_glucose ||
                vitalData.pain_scale;

            if (!hasVitals) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one vital sign must be recorded'
                });
            }

            const vital = await vitalService.recordVitals(
                req.user.id,
                vitalData
            );

            logger.info('Nurse recorded vitals', {
                nurseId: req.user.id,
                vitalId: vital.id,
                patientId: vitalData.patient_id
            });

            // [BR-36] Check for critical values
            if (vital.critical_alerts && vital.critical_alerts.length > 0) {
                logger.warn('Critical vitals recorded', {
                    nurseId: req.user.id,
                    vitalId: vital.id,
                    patientId: vitalData.patient_id,
                    alerts: vital.critical_alerts
                });

                // Send notifications for critical values
                await vitalService.sendCriticalAlerts(vital.id, vital.critical_alerts);
            }

            res.status(201).json({
                success: true,
                data: vital,
                message: vital.critical_alerts?.length > 0 
                    ? 'Vitals recorded with critical alerts' 
                    : 'Vitals recorded successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error recording vitals', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.body.patient_id
            });
            next(error);
        }
    },

    /**
     * Record vitals for specific patient
     * POST /api/v1/nurse/patients/:id/vitals
     */
    async recordPatientVitals(req, res, next) {
        try {
            const { id } = req.params;

            const vitalData = {
                patient_id: id,
                blood_pressure_systolic: req.body.blood_pressure_systolic,
                blood_pressure_diastolic: req.body.blood_pressure_diastolic,
                heart_rate: req.body.heart_rate,
                temperature: req.body.temperature,
                respiratory_rate: req.body.respiratory_rate,
                oxygen_saturation: req.body.oxygen_saturation,
                blood_glucose: req.body.blood_glucose,
                pain_scale: req.body.pain_scale,
                height: req.body.height,
                weight: req.body.weight,
                bmi: req.body.bmi,
                notes: req.body.notes,
                recorded_by: req.user.id,
                recorded_at: new Date(),
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // At least one vital sign must be recorded
            const hasVitals = 
                vitalData.blood_pressure_systolic ||
                vitalData.blood_pressure_diastolic ||
                vitalData.heart_rate ||
                vitalData.temperature ||
                vitalData.respiratory_rate ||
                vitalData.oxygen_saturation ||
                vitalData.blood_glucose ||
                vitalData.pain_scale;

            if (!hasVitals) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one vital sign must be recorded'
                });
            }

            const vital = await vitalService.recordVitals(
                req.user.id,
                vitalData
            );

            logger.info('Nurse recorded patient vitals', {
                nurseId: req.user.id,
                vitalId: vital.id,
                patientId: id
            });

            // [BR-36] Check for critical values
            if (vital.critical_alerts && vital.critical_alerts.length > 0) {
                logger.warn('Critical patient vitals recorded', {
                    nurseId: req.user.id,
                    vitalId: vital.id,
                    patientId: id,
                    alerts: vital.critical_alerts
                });

                // Send notifications for critical values
                await vitalService.sendCriticalAlerts(vital.id, vital.critical_alerts);
            }

            res.status(201).json({
                success: true,
                data: vital,
                message: vital.critical_alerts?.length > 0 
                    ? 'Vitals recorded with critical alerts' 
                    : 'Vitals recorded successfully'
            });
        } catch (error) {
            if (error.message === 'Patient not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }
            logger.error('Error recording patient vitals', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // UPDATE VITALS
    // ============================================

    /**
     * Update vital record
     * PUT /api/v1/nurse/vitals/:id
     */
    async updateVital(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating patient_id or recorded_by
            delete updates.patient_id;
            delete updates.recorded_by;
            delete updates.id;

            const vital = await vitalService.updateVital(
                req.user.id,
                id,
                updates
            );

            logger.info('Nurse updated vital record', {
                nurseId: req.user.id,
                vitalId: id,
                patientId: vital.patient_id
            });

            // [BR-36] Re-check for critical values after update
            if (vital.critical_alerts && vital.critical_alerts.length > 0) {
                await vitalService.sendCriticalAlerts(vital.id, vital.critical_alerts);
            }

            res.json({
                success: true,
                data: vital,
                message: 'Vital record updated successfully'
            });
        } catch (error) {
            if (error.message === 'Vital record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Vital record not found'
                });
            }
            if (error.message === 'Cannot update old records') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot update vitals older than 24 hours'
                });
            }
            logger.error('Error updating vital record', {
                error: error.message,
                nurseId: req.user.id,
                vitalId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete vital record
     * DELETE /api/v1/nurse/vitals/:id
     */
    async deleteVital(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await vitalService.deleteVital(
                req.user.id,
                id,
                reason
            );

            logger.info('Nurse deleted vital record', {
                nurseId: req.user.id,
                vitalId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Vital record deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Vital record not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Vital record not found'
                });
            }
            if (error.message === 'Cannot delete verified records') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete verified vital records'
                });
            }
            logger.error('Error deleting vital record', {
                error: error.message,
                nurseId: req.user.id,
                vitalId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // VITAL CHARTS & TRENDS
    // ============================================

    /**
     * Get vitals charts data
     * GET /api/v1/nurse/vitals/charts
     */
    async getVitalsCharts(req, res, next) {
        try {
            const { 
                patient_id, 
                from_date, 
                to_date,
                type = 'all' 
            } = req.query;

            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            const charts = await vitalService.getVitalsCharts(
                req.user.id,
                patient_id,
                {
                    from_date,
                    to_date,
                    type
                }
            );

            logger.info('Nurse viewed vitals charts', {
                nurseId: req.user.id,
                patientId: patient_id
            });

            res.json({
                success: true,
                data: charts
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
            logger.error('Error getting vitals charts', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.query.patient_id
            });
            next(error);
        }
    },

    /**
     * Get vitals trends analysis
     * GET /api/v1/nurse/vitals/trends
     */
    async getVitalsTrends(req, res, next) {
        try {
            const { 
                patient_id, 
                days = 7,
                types = ['heart_rate', 'blood_pressure', 'temperature', 'oxygen_saturation']
            } = req.query;

            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            const trendTypes = Array.isArray(types) ? types : types.split(',');

            const trends = await vitalService.getVitalsTrends(
                req.user.id,
                patient_id,
                {
                    days: parseInt(days),
                    types: trendTypes
                }
            );

            logger.info('Nurse viewed vitals trends', {
                nurseId: req.user.id,
                patientId: patient_id,
                days: parseInt(days)
            });

            // Identify significant changes
            const significantChanges = trends.filter(t => t.significant_change);

            res.json({
                success: true,
                data: trends,
                summary: {
                    total_readings: trends.length,
                    significant_changes: significantChanges.length,
                    average_values: trends.averages,
                    trend_direction: trends.direction
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
            logger.error('Error getting vitals trends', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.query.patient_id
            });
            next(error);
        }
    },

    // ============================================
    // VITAL STATISTICS & REPORTS
    // ============================================

    /**
     * Get vital statistics for ward
     * GET /api/v1/nurse/vitals/statistics
     */
    async getVitalStatistics(req, res, next) {
        try {
            const { 
                ward,
                from_date,
                to_date 
            } = req.query;

            const stats = await vitalService.getVitalStatistics(
                req.user.id,
                {
                    ward: ward || req.user.ward,
                    from_date,
                    to_date
                }
            );

            logger.info('Nurse viewed vital statistics', {
                nurseId: req.user.id,
                ward: ward || req.user.ward
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting vital statistics', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export vitals report
     * GET /api/v1/nurse/vitals/export
     */
    async exportVitalsReport(req, res, next) {
        try {
            const { 
                patient_id,
                from_date,
                to_date,
                format = 'pdf' 
            } = req.query;

            if (!patient_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Patient ID is required'
                });
            }

            const report = await vitalService.exportVitalsReport(
                req.user.id,
                patient_id,
                {
                    from_date,
                    to_date,
                    format
                }
            );

            logger.info('Nurse exported vitals report', {
                nurseId: req.user.id,
                patientId: patient_id,
                format
            });

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=vitals-${patient_id}-${Date.now()}.pdf`);
                return res.send(report);
            }

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=vitals-${patient_id}-${Date.now()}.csv`);
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
            logger.error('Error exporting vitals report', {
                error: error.message,
                nurseId: req.user.id,
                patientId: req.query.patient_id
            });
            next(error);
        }
    },

    // ============================================
    // CRITICAL ALERTS MANAGEMENT
    // ============================================

    /**
     * Get critical alerts
     * GET /api/v1/nurse/vitals/critical-alerts
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getCriticalAlerts(req, res, next) {
        try {
            const { ward, acknowledged = false } = req.query;

            const alerts = await vitalService.getCriticalAlerts(
                req.user.id,
                {
                    ward: ward || req.user.ward,
                    acknowledged: acknowledged === 'true'
                }
            );

            logger.info('Nurse viewed critical alerts', {
                nurseId: req.user.id,
                alertCount: alerts.length,
                ward: ward || req.user.ward
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    critical: alerts.filter(a => a.severity === 'critical').length,
                    warning: alerts.filter(a => a.severity === 'warning').length,
                    acknowledged: alerts.filter(a => a.acknowledged).length
                }
            });
        } catch (error) {
            logger.error('Error getting critical alerts', {
                error: error.message,
                nurseId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Acknowledge critical alert
     * PUT /api/v1/nurse/vitals/alerts/:id/acknowledge
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async acknowledgeCriticalAlert(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const alert = await vitalService.acknowledgeCriticalAlert(
                req.user.id,
                id,
                notes
            );

            logger.info('Nurse acknowledged critical alert', {
                nurseId: req.user.id,
                alertId: id,
                patientId: alert.patient_id
            });

            res.json({
                success: true,
                data: alert,
                message: 'Alert acknowledged'
            });
        } catch (error) {
            if (error.message === 'Alert not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found'
                });
            }
            logger.error('Error acknowledging critical alert', {
                error: error.message,
                nurseId: req.user.id,
                alertId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = vitalController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Vital Lists            | 3         | All vitals, recent, by ID
 * Record Vitals          | 2         | Record general, record for patient
 * Update/Delete          | 2         | Update, delete
 * Charts & Trends        | 2         | Charts, trends analysis
 * Statistics & Reports   | 2         | Statistics, export
 * Critical Alerts        | 2         | Get alerts, acknowledge
 * -----------------------|-----------|----------------------
 * TOTAL                  | 13        | Complete vital signs management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-36] Critical values require immediate notification
 * - [SR-13] PHI access logging
 * 
 * ======================================================================
 */