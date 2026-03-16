/**
 * ======================================================================
 * FILE: backend/src/services/patient/profileService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient profile service handling personal information management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ======================================================================
 */

const Patient = require('../../models/Patient');
const User = require('../../models/User');
const logger = require('../../utils/logger');
const db = require('../../config/database');

const profileService = {
    /**
     * Get patient profile by user ID
     */
    async getProfile(userId) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }
            return patient;
        } catch (error) {
            logger.error('Error getting patient profile', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Update patient profile
     */
    async updateProfile(userId, updates, updatedBy) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            // Check phone uniqueness
            if (updates.phone && updates.phone !== patient.phone) {
                const existing = await Patient.findByPhone(updates.phone);
                if (existing && existing.id !== patient.id) {
                    throw new Error('Phone number already registered');
                }
            }

            const updatedPatient = await Patient.update(patient.id, updates, updatedBy);

            if (updates.email) {
                await User.update(userId, { email: updates.email }, updatedBy);
            }

            await db.commitTransaction(client);
            return updatedPatient;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Upload profile photo
     */
    async uploadPhoto(userId, photoUrl) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            await Patient.update(patient.id, { profile_photo: photoUrl }, userId);
            return { photoUrl };
        } catch (error) {
            logger.error('Error uploading photo', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Delete profile photo
     */
    async deletePhoto(userId) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            await Patient.update(patient.id, { profile_photo: null }, userId);
            return true;
        } catch (error) {
            logger.error('Error deleting photo', { error: error.message, userId });
            throw error;
        }
    }
};

module.exports = profileService;