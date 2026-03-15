/**
 * ======================================================================
 * FILE: backend/src/services/patient/medicalService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient medical records service.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ======================================================================
 */

const Patient = require('../../models/Patient');
const logger = require('../../utils/logger');
const db = require('../../config/database');

const medicalService = {
    /**
     * Get complete medical history
     */
    async getMedicalHistory(userId, filters = {}) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const history = await Patient.getMedicalHistory(patient.id);

            // Apply filters
            if (filters.startDate || filters.endDate) {
                // Filter logic here
            }

            return history;
        } catch (error) {
            logger.error('Error getting medical history', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get prescriptions only
     */
    async getPrescriptions(userId, options = {}) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const { active = false } = options;
            let query = `
                SELECT p.*, e.first_name as doctor_first_name, e.last_name as doctor_last_name
                FROM prescriptions p
                JOIN employees e ON p.doctor_id = e.id
                WHERE p.patient_id = $1
            `;
            const values = [patient.id];

            if (active) {
                query += ` AND p.created_at > NOW() - INTERVAL '30 days'`;
            }

            query += ` ORDER BY p.created_at DESC`;

            const result = await db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error getting prescriptions', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get lab results
     */
    async getLabResults(userId, options = {}) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const { critical = false } = options;
            let query = `
                SELECT tr.*, lt.test_name, lt.category, lt.unit
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                WHERE tr.patient_id = $1
            `;
            const values = [patient.id];

            if (critical) {
                query += ` AND tr.is_critical = true`;
            }

            query += ` ORDER BY tr.tested_at DESC`;

            const result = await db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error getting lab results', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get radiology images
     */
    async getRadiologyImages(userId) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const result = await db.query(`
                SELECT * FROM radiology_images
                WHERE patient_id = $1
                ORDER BY uploaded_at DESC
            `, [patient.id]);

            return result.rows;
        } catch (error) {
            logger.error('Error getting radiology images', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get vital signs
     */
    async getVitals(userId) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const result = await db.query(`
                SELECT * FROM vital_signs
                WHERE patient_id = $1
                ORDER BY recorded_at DESC
            `, [patient.id]);

            return result.rows;
        } catch (error) {
            logger.error('Error getting vitals', { error: error.message, userId });
            throw error;
        }
    }
};

module.exports = medicalService;