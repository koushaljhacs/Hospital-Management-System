/**
 * ======================================================================
 * FILE: backend/src/services/patient/appointmentService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Patient appointment management service.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ======================================================================
 */

const Patient = require('../../models/Patient');
const logger = require('../../utils/logger');
const db = require('../../config/database');

const appointmentService = {
    /**
     * Get patient appointments
     */
    async getAppointments(userId, options = {}) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const { page = 1, limit = 20, status, upcoming, past } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT a.*, e.first_name as doctor_first_name, e.last_name as doctor_last_name
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

            if (upcoming) {
                query += ` AND a.appointment_date >= CURRENT_DATE`;
            }

            if (past) {
                query += ` AND a.appointment_date < CURRENT_DATE`;
            }

            query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const appointments = await db.query(query, values);
            return appointments.rows;
        } catch (error) {
            logger.error('Error getting appointments', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Book new appointment
     */
    async bookAppointment(userId, appointmentData) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            // Check doctor availability
            const checkQuery = `
                SELECT COUNT(*) as count FROM appointments
                WHERE doctor_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled')
            `;
            const check = await db.query(checkQuery, [appointmentData.doctor_id, appointmentData.appointment_date]);
            
            if (parseInt(check.rows[0].count) >= 30) {
                throw new Error('Doctor is fully booked for this date');
            }

            const query = `
                INSERT INTO appointments (
                    patient_id, doctor_id, appointment_date, appointment_time,
                    type, reason, status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW(), NOW())
                RETURNING *
            `;

            const values = [
                patient.id,
                appointmentData.doctor_id,
                appointmentData.appointment_date,
                appointmentData.appointment_time,
                appointmentData.type || 'regular_checkup',
                appointmentData.reason
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error booking appointment', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Cancel appointment
     */
    async cancelAppointment(userId, appointmentId) {
        try {
            const patient = await Patient.findByUserId(userId);
            if (!patient) {
                throw new Error('Patient profile not found');
            }

            const query = `
                UPDATE appointments 
                SET status = 'cancelled', updated_at = NOW()
                WHERE id = $1 AND patient_id = $2
                RETURNING *
            `;

            const result = await db.query(query, [appointmentId, patient.id]);
            
            if (result.rows.length === 0) {
                throw new Error('Appointment not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error cancelling appointment', { error: error.message, userId });
            throw error;
        }
    }
};

module.exports = appointmentService;