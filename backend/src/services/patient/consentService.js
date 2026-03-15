/**
 * ======================================================================
 * FILE: backend/src/services/patient/consentService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient consent and GDPR compliance service.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ======================================================================
 */

const Patient = require('../../models/Patient');
const ConsentRecord = require('../../models/ConsentRecord');
const DeletionRequest = require('../../models/DeletionRequest');
const logger = require('../../utils/logger');
const db = require('../../config/database');

const consentService = {
    /**
     * Get all consents for patient
     */
    async getConsents(userId) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const consents = await ConsentRecord.getByPatient(patient.id);
            return consents;
        } catch (error) {
            logger.error('Error getting consents', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Give consent
     */
    async giveConsent(userId, consentType, metadata = {}) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            if (!ConsentRecord.isValidType(consentType)) {
                throw new Error('Invalid consent type');
            }

            const consent = await ConsentRecord.create({
                patient_id: patient.id,
                consent_type: consentType,
                is_granted: true,
                ip_address: metadata.ip,
                user_agent: metadata.userAgent
            }, userId);

            return consent;
        } catch (error) {
            logger.error('Error giving consent', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Revoke consent
     */
    async revokeConsent(userId, consentType, metadata = {}) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

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

            return revoked;
        } catch (error) {
            logger.error('Error revoking consent', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Request data deletion (GDPR)
     */
    async requestDeletion(userId, reason, withdrawConsent = true) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            if (withdrawConsent) {
                const activeConsents = await ConsentRecord.getActiveByPatient(patient.id);
                for (const consent of activeConsents) {
                    await ConsentRecord.revoke(consent.id, 'Data deletion requested', userId, {});
                }
            }

            const request = await DeletionRequest.create({
                requestor_type: 'patient',
                requestor_id: patient.id,
                request_reason: reason,
                consent_withdrawn: withdrawConsent
            });

            await db.commitTransaction(client);
            return request;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Check deletion request status
     */
    async getDeletionStatus(userId) {
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
                requestDate: latest.request_date
            };
        } catch (error) {
            logger.error('Error getting deletion status', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Cancel deletion request
     */
    async cancelDeletion(userId, reason) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const requests = await DeletionRequest.getByRequestor(patient.id, 'patient');
            const activeRequest = requests.find(r => ['pending', 'approved'].includes(r.request_status));

            if (!activeRequest) {
                throw new Error('No active deletion request found');
            }

            return await DeletionRequest.cancel(activeRequest.id, reason);
        } catch (error) {
            logger.error('Error cancelling deletion', { error: error.message, userId });
            throw error;
        }
    }
};

module.exports = consentService;