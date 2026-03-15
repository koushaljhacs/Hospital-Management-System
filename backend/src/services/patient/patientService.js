/**
 * ======================================================================
 * FILE: backend/src/services/patient/patientService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient service handling business logic for patient operations.
 * Includes patient profile management, medical records, and consent handling.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - Patient model
 * - User model
 * - ConsentRecord model
 * - DeletionRequest model
 * - logger
 * 
 * BUSINESS RULES:
 * - Patient must have associated user account
 * - Email must be unique across system
 * - Phone must be unique across patients
 * - Emergency contact is required
 * - Medical records cannot be deleted (only archived)
 * - Consent required for data processing
 * - GDPR right to deletion support
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const Patient = require('../../models/Patient');
const User = require('../../models/User');
const ConsentRecord = require('../../models/ConsentRecord');
const DeletionRequest = require('../../models/DeletionRequest');
const logger = require('../../utils/logger');
const db = require('../../config/database');

/**
 * Patient Service - Business logic for patient operations
 */
const patientService = {
    /**
     * Get patient profile by user ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Patient profile
     */
    async getPatientProfile(userId) {
        try {
            const patient = await Patient.findByUserId(userId);
            
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            // Get active consents
            const consents = await ConsentRecord.getActiveByPatient(patient.id);

            // Get summary statistics
            const stats = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM appointments WHERE patient_id = $1) as total_appointments,
                    (SELECT COUNT(*) FROM prescriptions WHERE patient_id = $1) as total_prescriptions,
                    (SELECT COUNT(*) FROM test_results WHERE patient_id = $1) as total_lab_results,
                    (SELECT COUNT(*) FROM radiology_images WHERE patient_id = $1) as total_radiology,
                    (SELECT COUNT(*) FROM invoices WHERE patient_id = $1 AND status != 'paid') as pending_invoices
            `, [patient.id]);

            return {
                ...patient,
                consents,
                stats: stats.rows[0]
            };
        } catch (error) {
            logger.error('Error getting patient profile', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Update patient profile
     * @param {string} userId - User ID
     * @param {Object} updates - Fields to update
     * @param {string} updatedBy - User ID performing update
     * @returns {Promise<Object>} Updated patient
     */
    async updatePatientProfile(userId, updates, updatedBy) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            // Check phone uniqueness if updating
            if (updates.phone && updates.phone !== patient.phone) {
                const existing = await Patient.findByPhone(updates.phone);
                if (existing && existing.id !== patient.id) {
                    throw new Error('Phone number already registered');
                }
            }

            // Update patient
            const updatedPatient = await Patient.update(patient.id, updates, updatedBy);

            // If email is being updated, also update user email
            if (updates.email) {
                await User.update(userId, { email: updates.email }, updatedBy);
            }

            await db.commitTransaction(client);

            logger.info('Patient profile updated', { 
                patientId: patient.id,
                userId,
                updatedBy,
                updates: Object.keys(updates)
            });

            return updatedPatient;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating patient profile', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get patient medical history
     * @param {string} userId - User ID
     * @param {Object} filters - Filter options
     * @returns {Promise<Object>} Medical history
     */
    async getMedicalHistory(userId, filters = {}) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const history = await Patient.getMedicalHistory(patient.id);

            // Apply filters if any
            if (filters.startDate || filters.endDate) {
                const filterDate = (item) => {
                    const date = new Date(item.created_at || item.appointment_date || item.tested_at);
                    if (filters.startDate && date < new Date(filters.startDate)) return false;
                    if (filters.endDate && date > new Date(filters.endDate)) return false;
                    return true;
                };

                history.medical_history.appointments = history.medical_history.appointments.filter(filterDate);
                history.medical_history.prescriptions = history.medical_history.prescriptions.filter(filterDate);
                history.medical_history.lab_results = history.medical_history.lab_results.filter(filterDate);
                history.medical_history.radiology = history.medical_history.radiology.filter(filterDate);
                history.medical_history.vitals = history.medical_history.vitals.filter(filterDate);
                history.medical_history.invoices = history.medical_history.invoices.filter(filterDate);

                // Update summary
                history.summary = {
                    total_appointments: history.medical_history.appointments.length,
                    total_prescriptions: history.medical_history.prescriptions.length,
                    total_lab_results: history.medical_history.lab_results.length,
                    total_radiology: history.medical_history.radiology.length,
                    total_vitals: history.medical_history.vitals.length,
                    total_invoices: history.medical_history.invoices.length
                };
            }

            return history;
        } catch (error) {
            logger.error('Error getting medical history', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get patient appointments
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Appointments list
     */
    async getAppointments(userId, options = {}) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                fromDate,
                toDate
            } = options;

            const offset = (page - 1) * limit;
            const patient = await Patient.findByUserId(userId);
            
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            let query = `
                SELECT a.*, 
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.specialization as doctor_specialization
                FROM appointments a
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.patient_id = $1
            `;
            const values = [patient.id];
            let paramIndex = 2;

            if (status) {
                query += ` AND a.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (fromDate) {
                query += ` AND a.appointment_date >= $${paramIndex}`;
                values.push(fromDate);
                paramIndex++;
            }

            if (toDate) {
                query += ` AND a.appointment_date <= $${paramIndex}`;
                values.push(toDate);
                paramIndex++;
            }

            query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const appointments = await db.query(query, values);

            const total = await db.query(`
                SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1
            `, [patient.id]);

            return {
                data: appointments.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(total.rows[0].count),
                    pages: Math.ceil(parseInt(total.rows[0].count) / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting patient appointments', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get patient prescriptions
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Prescriptions list
     */
    async getPrescriptions(userId, options = {}) {
        try {
            const { active = false } = options;
            const patient = await Patient.findByUserId(userId);
            
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            let query = `
                SELECT p.*, 
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.specialization as doctor_specialization,
                       array_agg(
                           jsonb_build_object(
                               'id', m.id,
                               'medicine_name', m.medicine_name,
                               'dosage', m.dosage,
                               'frequency', m.frequency,
                               'duration', m.duration,
                               'quantity', m.quantity,
                               'instructions', m.instructions
                           )
                       ) as medicines
                FROM prescriptions p
                JOIN employees e ON p.doctor_id = e.id
                LEFT JOIN medicines m ON p.id = m.prescription_id
                WHERE p.patient_id = $1
            `;
            const values = [patient.id];

            if (active) {
                query += ` AND p.created_at > NOW() - INTERVAL '30 days'`;
            }

            query += ` GROUP BY p.id, e.id ORDER BY p.created_at DESC`;

            const prescriptions = await db.query(query, values);

            return prescriptions.rows;
        } catch (error) {
            logger.error('Error getting patient prescriptions', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get patient lab results
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Lab results list
     */
    async getLabResults(userId, options = {}) {
        try {
            const { critical = false } = options;
            const patient = await Patient.findByUserId(userId);
            
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            let query = `
                SELECT tr.*, 
                       lt.test_name, lt.category, lt.unit, lt.normal_range,
                       e.first_name as tested_by_first_name,
                       e.last_name as tested_by_last_name
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                LEFT JOIN employees e ON tr.tested_by = e.id
                WHERE tr.patient_id = $1
            `;
            const values = [patient.id];

            if (critical) {
                query += ` AND tr.is_critical = true`;
            }

            query += ` ORDER BY tr.tested_at DESC`;

            const results = await db.query(query, values);

            return results.rows;
        } catch (error) {
            logger.error('Error getting patient lab results', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get patient invoices
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Invoices list
     */
    async getInvoices(userId, options = {}) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                unpaid = false
            } = options;

            const offset = (page - 1) * limit;
            const patient = await Patient.findByUserId(userId);
            
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            let query = `
                SELECT * FROM invoices
                WHERE patient_id = $1
            `;
            const values = [patient.id];
            let paramIndex = 2;

            if (status) {
                query += ` AND status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (unpaid) {
                query += ` AND paid_amount < total`;
            }

            query += ` ORDER BY issue_date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const invoices = await db.query(query, values);

            const total = await db.query(`
                SELECT COUNT(*) as count FROM invoices WHERE patient_id = $1
            `, [patient.id]);

            // Get summary
            const summary = await db.query(`
                SELECT 
                    COUNT(*) as total_invoices,
                    SUM(total) as total_amount,
                    SUM(paid_amount) as total_paid,
                    SUM(total - paid_amount) as total_due,
                    COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
                    COUNT(*) FILTER (WHERE status = 'overdue') as overdue_count
                FROM invoices
                WHERE patient_id = $1
            `, [patient.id]);

            return {
                data: invoices.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(total.rows[0].count),
                    pages: Math.ceil(parseInt(total.rows[0].count) / limit)
                }
            };
        } catch (error) {
            logger.error('Error getting patient invoices', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Manage patient consents
     * @param {string} userId - User ID
     * @param {string} consentType - Type of consent
     * @param {boolean} grant - Grant or revoke
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} Consent record
     */
    async manageConsent(userId, consentType, grant, metadata = {}) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            if (!ConsentRecord.isValidType(consentType)) {
                throw new Error('Invalid consent type');
            }

            if (grant) {
                // Grant consent
                const consent = await ConsentRecord.create({
                    patient_id: patient.id,
                    consent_type: consentType,
                    is_granted: true,
                    ip_address: metadata.ip,
                    user_agent: metadata.userAgent
                }, userId);

                logger.info('Consent granted', {
                    patientId: patient.id,
                    consentType,
                    userId
                });

                return consent;
            } else {
                // Revoke consent
                const activeConsents = await ConsentRecord.getActiveByPatient(patient.id, consentType);
                
                if (activeConsents.length === 0) {
                    throw new Error('No active consent found');
                }

                const revoked = await ConsentRecord.revoke(
                    activeConsents[0].id,
                    'User requested revocation',
                    userId,
                    { ip_address: metadata.ip, user_agent: metadata.userAgent }
                );

                logger.info('Consent revoked', {
                    patientId: patient.id,
                    consentType,
                    userId
                });

                return revoked;
            }
        } catch (error) {
            logger.error('Error managing consent', { error: error.message, userId, consentType });
            throw error;
        }
    },

    /**
     * Request data deletion (GDPR)
     * @param {string} userId - User ID
     * @param {string} reason - Deletion reason
     * @param {boolean} withdrawConsent - Whether to withdraw all consents
     * @returns {Promise<Object>} Deletion request
     */
    async requestDataDeletion(userId, reason, withdrawConsent = true) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            // Withdraw all consents if requested
            if (withdrawConsent) {
                const activeConsents = await ConsentRecord.getActiveByPatient(patient.id);
                for (const consent of activeConsents) {
                    await ConsentRecord.revoke(
                        consent.id,
                        'Data deletion requested',
                        userId,
                        {}
                    );
                }
            }

            // Create deletion request
            const request = await DeletionRequest.create({
                requestor_type: 'patient',
                requestor_id: patient.id,
                request_reason: reason,
                consent_withdrawn: withdrawConsent
            });

            await db.commitTransaction(client);

            logger.info('Data deletion requested', {
                patientId: patient.id,
                requestId: request.id,
                userId
            });

            return request;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error requesting data deletion', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get deletion request status
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Deletion request status
     */
    async getDeletionRequestStatus(userId) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const requests = await DeletionRequest.getByRequestor(patient.id, 'patient');
            
            if (requests.length === 0) {
                return { hasActiveRequest: false };
            }

            const latest = requests[0];
            
            return {
                hasActiveRequest: true,
                requestId: latest.id,
                status: latest.request_status,
                requestDate: latest.request_date,
                estimatedCompletion: latest.request_status === 'approved' ? 
                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
                canCancel: ['pending', 'approved'].includes(latest.request_status)
            };
        } catch (error) {
            logger.error('Error getting deletion request status', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Cancel deletion request
     * @param {string} userId - User ID
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Cancelled request
     */
    async cancelDeletionRequest(userId, reason) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const requests = await DeletionRequest.getByRequestor(patient.id, 'patient');
            
            if (requests.length === 0) {
                throw new Error('No deletion request found');
            }

            const activeRequest = requests.find(r => 
                ['pending', 'approved'].includes(r.request_status)
            );

            if (!activeRequest) {
                throw new Error('No active deletion request found');
            }

            const cancelled = await DeletionRequest.cancel(activeRequest.id, reason);

            logger.info('Deletion request cancelled', {
                patientId: patient.id,
                requestId: activeRequest.id,
                userId
            });

            return cancelled;
        } catch (error) {
            logger.error('Error cancelling deletion request', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get patient dashboard data
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Dashboard data
     */
    async getDashboard(userId) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            // Get upcoming appointments
            const upcomingAppointments = await db.query(`
                SELECT a.*, 
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.specialization
                FROM appointments a
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.patient_id = $1 
                    AND a.appointment_date >= CURRENT_DATE
                    AND a.status NOT IN ('completed', 'cancelled', 'no_show')
                ORDER BY a.appointment_date ASC, a.appointment_time ASC
                LIMIT 5
            `, [patient.id]);

            // Get recent prescriptions
            const recentPrescriptions = await db.query(`
                SELECT p.*, e.first_name as doctor_first_name, e.last_name as doctor_last_name
                FROM prescriptions p
                JOIN employees e ON p.doctor_id = e.id
                WHERE p.patient_id = $1
                ORDER BY p.created_at DESC
                LIMIT 5
            `, [patient.id]);

            // Get recent lab results
            const recentLabResults = await db.query(`
                SELECT tr.*, lt.test_name, lt.category
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                WHERE tr.patient_id = $1
                ORDER BY tr.tested_at DESC
                LIMIT 5
            `, [patient.id]);

            // Get pending invoices
            const pendingInvoices = await db.query(`
                SELECT * FROM invoices
                WHERE patient_id = $1 AND paid_amount < total
                ORDER BY due_date ASC
                LIMIT 5
            `, [patient.id]);

            // Get health alerts
            const healthAlerts = await db.query(`
                SELECT * FROM test_results
                WHERE patient_id = $1 AND is_critical = true
                ORDER BY tested_at DESC
                LIMIT 5
            `, [patient.id]);

            return {
                profile: {
                    name: `${patient.first_name} ${patient.last_name}`,
                    blood_group: patient.blood_group,
                    age: patient.date_of_birth ? 
                        Math.floor((new Date() - new Date(patient.date_of_birth)) / (365.25 * 24 * 60 * 60 * 1000)) : null
                },
                upcoming_appointments: upcomingAppointments.rows,
                recent_prescriptions: recentPrescriptions.rows,
                recent_lab_results: recentLabResults.rows,
                pending_invoices: pendingInvoices.rows,
                health_alerts: healthAlerts.rows,
                stats: {
                    total_appointments: await this.getAppointmentCount(patient.id),
                    total_prescriptions: await this.getPrescriptionCount(patient.id),
                    total_lab_results: await this.getLabResultCount(patient.id)
                }
            };
        } catch (error) {
            logger.error('Error getting patient dashboard', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Helper: Get appointment count
     */
    async getAppointmentCount(patientId) {
        const result = await db.query(
            'SELECT COUNT(*) as count FROM appointments WHERE patient_id = $1',
            [patientId]
        );
        return parseInt(result.rows[0].count);
    },

    /**
     * Helper: Get prescription count
     */
    async getPrescriptionCount(patientId) {
        const result = await db.query(
            'SELECT COUNT(*) as count FROM prescriptions WHERE patient_id = $1',
            [patientId]
        );
        return parseInt(result.rows[0].count);
    },

    /**
     * Helper: Get lab result count
     */
    async getLabResultCount(patientId) {
        const result = await db.query(
            'SELECT COUNT(*) as count FROM test_results WHERE patient_id = $1',
            [patientId]
        );
        return parseInt(result.rows[0].count);
    }
};

module.exports = patientService;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Get patient profile
 * const profile = await patientService.getPatientProfile(userId);
 * 
 * // Update profile
 * const updated = await patientService.updatePatientProfile(userId, {
 *     phone: '+91-9876543210',
 *     address: 'New Address'
 * }, userId);
 * 
 * // Get medical history
 * const history = await patientService.getMedicalHistory(userId, {
 *     startDate: '2026-01-01'
 * });
 * 
 * // Get appointments
 * const appointments = await patientService.getAppointments(userId, {
 *     page: 1,
 *     limit: 10,
 *     status: 'scheduled'
 * });
 * 
 * // Manage consent
 * await patientService.manageConsent(userId, 'treatment', true, {
 *     ip: req.ip,
 *     userAgent: req.headers['user-agent']
 * });
 * 
 * // Request data deletion
 * const request = await patientService.requestDataDeletion(
 *     userId,
 *     'No longer using service',
 *     true
 * );
 * 
 * // Get dashboard
 * const dashboard = await patientService.getDashboard(userId);
 * 
 * ======================================================================
 */