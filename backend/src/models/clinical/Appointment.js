/**
 * ======================================================================
 * FILE: backend/src/models/clinical/Appointment.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * ⚠️ CONFIDENTIAL & PROPRIETARY ⚠️
 * This file contains sensitive clinical data handling code.
 * NOT FOR PRODUCTION USE WITHOUT AUTHORIZATION.
 * Author: @koushal
 * Review Purpose Only - Faculty/Company Internal Review.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * DESCRIPTION:
 * Appointment model for database operations.
 * Handles all appointment-related queries for scheduling and management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: appointments
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients)
 * - doctor_id: UUID (foreign key to employees)
 * - appointment_date: date
 * - appointment_time: time
 * - duration_minutes: integer
 * - status: enum (scheduled, confirmed, checked_in, in_progress, completed, cancelled, no_show, rescheduled)
 * - type: enum (regular_checkup, consultation, follow_up, emergency, surgery_consultation, lab_test, vaccination, physical_therapy, telemedicine, home_visit)
 * - reason: text
 * - notes: text
 * - queue_number: integer
 * - estimated_wait_time: integer
 * - is_emergency: boolean
 * - blood_pressure_systolic: integer
 * - blood_pressure_diastolic: integer
 * - heart_rate: integer
 * - temperature: decimal
 * - weight: decimal
 * - height: decimal
 * - consultation_fee: decimal
 * - insurance_verified: boolean
 * - pre_authorization_number: string
 * - check_in_time: timestamp
 * - check_out_time: timestamp
 * - cancellation_reason: text
 * - cancelled_by: uuid
 * - cancelled_at: timestamp
 * - rescheduled_from: uuid
 * - follow_up_required: boolean
 * - follow_up_date: date
 * - follow_up_instructions: text
 * - reminder_sent: boolean
 * - reminder_sent_at: timestamp
 * - patient_feedback: text
 * - patient_rating: integer
 * - created_at: timestamp
 * - updated_at: timestamp
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const Appointment = {
    /**
     * Table name
     */
    tableName: 'appointments',

    /**
     * Find appointment by ID
     * @param {string} id - Appointment UUID
     * @returns {Promise<Object|null>} Appointment object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    a.id, a.patient_id, a.doctor_id,
                    a.appointment_date, a.appointment_time, a.duration_minutes,
                    a.status, a.type, a.reason, a.notes,
                    a.queue_number, a.estimated_wait_time, a.is_emergency,
                    a.blood_pressure_systolic, a.blood_pressure_diastolic,
                    a.heart_rate, a.temperature, a.weight, a.height,
                    a.consultation_fee, a.insurance_verified,
                    a.pre_authorization_number,
                    a.check_in_time, a.check_out_time,
                    a.cancellation_reason, a.cancelled_at,
                    a.rescheduled_from, a.follow_up_required,
                    a.follow_up_date, a.follow_up_instructions,
                    a.reminder_sent, a.reminder_sent_at,
                    a.patient_feedback, a.patient_rating,
                    a.created_at, a.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    p.email as patient_email,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    e.designation as doctor_designation,
                    e.specialization as doctor_specialization
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.id = $1 AND a.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Appointment found by ID', { appointmentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding appointment by ID', {
                error: error.message,
                appointmentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find appointments by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of appointments
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['a.is_deleted = false'];

            if (status) {
                conditions.push(`a.status = $${paramIndex++}`);
                values.push(status);
            }
            if (from_date) {
                conditions.push(`a.appointment_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`a.appointment_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    a.id, a.appointment_date, a.appointment_time,
                    a.duration_minutes, a.status, a.type, a.reason,
                    a.queue_number, a.is_emergency,
                    a.consultation_fee, a.check_in_time, a.check_out_time,
                    a.follow_up_required, a.follow_up_date,
                    a.patient_rating, a.created_at,
                    e.id as doctor_id,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    e.designation as doctor_designation,
                    e.specialization as doctor_specialization
                FROM appointments a
                JOIN employees e ON a.doctor_id = e.id
                ${whereClause}
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Appointments found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding appointments by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find appointments by doctor ID
     * @param {string} doctorId - Doctor employee UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of appointments
     */
    async findByDoctorId(doctorId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, date } = options;
            const values = [doctorId];
            let paramIndex = 2;
            const conditions = ['a.is_deleted = false'];

            if (status) {
                conditions.push(`a.status = $${paramIndex++}`);
                values.push(status);
            }
            if (date) {
                conditions.push(`a.appointment_date = $${paramIndex++}`);
                values.push(date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    a.id, a.appointment_date, a.appointment_time,
                    a.duration_minutes, a.status, a.type, a.reason,
                    a.queue_number, a.is_emergency,
                    a.consultation_fee, a.check_in_time, a.check_out_time,
                    a.follow_up_required, a.follow_up_date,
                    a.patient_rating, a.created_at,
                    p.id as patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    p.date_of_birth as patient_dob,
                    p.gender as patient_gender
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                ${whereClause}
                ORDER BY a.appointment_date ASC, a.appointment_time ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Appointments found by doctor ID', {
                doctorId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding appointments by doctor ID', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new appointment
     * @param {Object} appointmentData - Appointment data
     * @returns {Promise<Object>} Created appointment
     */
    async create(appointmentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO appointments (
                    id, patient_id, doctor_id,
                    appointment_date, appointment_time, duration_minutes,
                    status, type, reason, notes,
                    is_emergency, consultation_fee,
                    insurance_verified, pre_authorization_number,
                    follow_up_required, follow_up_date, follow_up_instructions,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, 
                    COALESCE($5, 30), COALESCE($6, 'scheduled'), $7, $8, $9,
                    COALESCE($10, false), $11, COALESCE($12, false), $13,
                    COALESCE($14, false), $15, $16, NOW(), NOW()
                )
                RETURNING 
                    id, patient_id, doctor_id,
                    appointment_date, appointment_time, duration_minutes,
                    status, type, is_emergency, created_at
            `;

            const values = [
                appointmentData.patient_id,
                appointmentData.doctor_id,
                appointmentData.appointment_date,
                appointmentData.appointment_time,
                appointmentData.duration_minutes,
                appointmentData.status,
                appointmentData.type,
                appointmentData.reason,
                appointmentData.notes || null,
                appointmentData.is_emergency,
                appointmentData.consultation_fee || null,
                appointmentData.insurance_verified,
                appointmentData.pre_authorization_number || null,
                appointmentData.follow_up_required,
                appointmentData.follow_up_date || null,
                appointmentData.follow_up_instructions || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Appointment created successfully', {
                appointmentId: result.rows[0].id,
                patientId: appointmentData.patient_id,
                doctorId: appointmentData.doctor_id,
                date: appointmentData.appointment_date
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating appointment', {
                error: error.message,
                patientId: appointmentData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update appointment
     * @param {string} id - Appointment ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated appointment
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'appointment_date', 'appointment_time', 'duration_minutes',
                'status', 'type', 'reason', 'notes', 'is_emergency',
                'consultation_fee', 'insurance_verified',
                'pre_authorization_number', 'follow_up_required',
                'follow_up_date', 'follow_up_instructions',
                'blood_pressure_systolic', 'blood_pressure_diastolic',
                'heart_rate', 'temperature', 'weight', 'height',
                'check_in_time', 'check_out_time',
                'cancellation_reason', 'cancelled_by', 'cancelled_at',
                'rescheduled_from', 'patient_feedback', 'patient_rating'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(id);

            const query = `
                UPDATE appointments 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, patient_id, doctor_id,
                    appointment_date, appointment_time, status,
                    type, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Appointment not found');
            }

            await db.commitTransaction(client);

            logger.info('Appointment updated successfully', {
                appointmentId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating appointment', {
                error: error.message,
                appointmentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Cancel appointment
     * @param {string} id - Appointment ID
     * @param {string} reason - Cancellation reason
     * @param {string} cancelledBy - User who cancelled
     * @returns {Promise<Object>} Updated appointment
     */
    async cancel(id, reason, cancelledBy) {
        return this.update(id, {
            status: 'cancelled',
            cancellation_reason: reason,
            cancelled_by: cancelledBy,
            cancelled_at: new Date()
        });
    },

    /**
     * Check in patient
     * @param {string} id - Appointment ID
     * @returns {Promise<Object>} Updated appointment
     */
    async checkIn(id) {
        return this.update(id, {
            status: 'checked_in',
            check_in_time: new Date()
        });
    },

    /**
     * Check out patient
     * @param {string} id - Appointment ID
     * @returns {Promise<Object>} Updated appointment
     */
    async checkOut(id) {
        return this.update(id, {
            status: 'completed',
            check_out_time: new Date()
        });
    },

    /**
     * Mark appointment as no-show
     * @param {string} id - Appointment ID
     * @returns {Promise<Object>} Updated appointment
     */
    async markNoShow(id) {
        return this.update(id, {
            status: 'no_show'
        });
    },

    /**
     * Get today's appointments for doctor
     * @param {string} doctorId - Doctor ID
     * @returns {Promise<Array>} List of today's appointments
     */
    async getTodayAppointments(doctorId) {
        const today = new Date().toISOString().split('T')[0];
        return this.findByDoctorId(doctorId, { date: today });
    },

    /**
     * Get upcoming appointments for patient
     * @param {string} patientId - Patient ID
     * @returns {Promise<Array>} List of upcoming appointments
     */
    async getUpcomingAppointments(patientId) {
        const today = new Date().toISOString().split('T')[0];
        return this.findByPatientId(patientId, {
            status: ['scheduled', 'confirmed', 'checked_in'],
            from_date: today
        });
    },

    /**
     * Get appointment statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND appointment_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_appointments,
                    COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
                    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
                    COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
                    COUNT(*) FILTER (WHERE type = 'emergency') as emergency,
                    COUNT(*) FILTER (WHERE is_emergency = true) as emergency_flag,
                    ROUND(AVG(patient_rating), 2) as avg_rating,
                    SUM(consultation_fee) as total_consultation_fee
                FROM appointments
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Appointment statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting appointment statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Check doctor availability for time slot
     * @param {string} doctorId - Doctor ID
     * @param {string} date - Appointment date
     * @param {string} time - Appointment time
     * @returns {Promise<boolean>} True if slot is available
     */
    async isSlotAvailable(doctorId, date, time) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM appointments
                WHERE doctor_id = $1
                    AND appointment_date = $2
                    AND appointment_time = $3
                    AND status NOT IN ('cancelled', 'no_show')
                    AND is_deleted = false
            `;

            const result = await db.query(query, [doctorId, date, time]);

            const isAvailable = parseInt(result.rows[0].count) === 0;

            logger.debug('Slot availability checked', {
                doctorId,
                date,
                time,
                available: isAvailable
            });

            return isAvailable;
        } catch (error) {
            logger.error('Error checking slot availability', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get available time slots for doctor on a date
     * @param {string} doctorId - Doctor ID
     * @param {string} date - Appointment date
     * @param {number} durationMinutes - Appointment duration
     * @returns {Promise<Array>} List of available time slots
     */
    async getAvailableSlots(doctorId, date, durationMinutes = 30) {
        try {
            const startHour = 9;
            const endHour = 17;
            const slots = [];

            const bookedQuery = `
                SELECT appointment_time
                FROM appointments
                WHERE doctor_id = $1
                    AND appointment_date = $2
                    AND status NOT IN ('cancelled', 'no_show')
                    AND is_deleted = false
            `;

            const bookedResult = await db.query(bookedQuery, [doctorId, date]);
            const bookedTimes = new Set(bookedResult.rows.map(r => r.appointment_time));

            for (let hour = startHour; hour < endHour; hour++) {
                for (let minute = 0; minute < 60; minute += durationMinutes) {
                    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
                    if (!bookedTimes.has(timeStr)) {
                        slots.push(timeStr);
                    }
                }
            }

            logger.debug('Available slots retrieved', {
                doctorId,
                date,
                slotCount: slots.length
            });

            return slots;
        } catch (error) {
            logger.error('Error getting available slots', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = Appointment;

/**
 * ======================================================================
 * CONFIDENTIAL - Author: @koushal
 * This code is proprietary to OctNov.
 * Unauthorized use, copying, or distribution is prohibited.
 * For review purposes only.
 * ======================================================================
 */