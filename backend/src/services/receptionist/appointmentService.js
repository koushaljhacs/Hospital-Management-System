/**
 * ======================================================================
 * FILE: backend/src/services/receptionist/appointmentService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist appointment service - Handles appointment business logic.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-07] Cannot book appointment in past
 * - [BR-08] Max 30 appointments per doctor per day
 * - [BR-09] Appointment duration default 30 minutes
 * - [BR-10] Cancellation allowed up to 2 hours before
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const appointmentService = {
    /**
     * Get all appointments
     */
    async getAllAppointments(receptionistId, options = {}) {
        try {
            const { page = 1, limit = 20, status, doctor_id, patient_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT a.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.specialization as doctor_specialization,
                       d.name as department_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE a.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND a.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (doctor_id) {
                query += ` AND a.doctor_id = $${paramIndex}`;
                values.push(doctor_id);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND a.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND a.appointment_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND a.appointment_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM appointments a
                WHERE a.is_deleted = false
                ${status ? 'AND a.status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
                    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE status = 'no_show') as no_show
                FROM appointments
                WHERE is_deleted = false
            `;
            const summary = await db.query(summaryQuery);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAllAppointments', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get today's appointments
     */
    async getTodaysAppointments(receptionistId) {
        try {
            const query = `
                SELECT a.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.specialization as doctor_specialization,
                       CASE 
                           WHEN a.check_in_time IS NOT NULL THEN true
                           ELSE false
                       END as is_checked_in,
                       EXTRACT(EPOCH FROM (NOW() - a.check_in_time))/60 as minutes_since_checkin
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.appointment_date = CURRENT_DATE
                    AND a.is_deleted = false
                ORDER BY a.appointment_time ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysAppointments', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get upcoming appointments
     */
    async getUpcomingAppointments(receptionistId, days = 7) {
        try {
            const query = `
                SELECT a.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.appointment_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'
                    AND a.status IN ('scheduled', 'confirmed')
                    AND a.is_deleted = false
                ORDER BY a.appointment_date ASC, a.appointment_time ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getUpcomingAppointments', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get past appointments
     */
    async getPastAppointments(receptionistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT a.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.appointment_date < CURRENT_DATE
                    AND a.is_deleted = false
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM appointments
                WHERE appointment_date < CURRENT_DATE AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getPastAppointments', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get calendar view
     */
    async getCalendarView(receptionistId, options = {}) {
        try {
            const { month, year, doctor_id } = options;

            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            let query = `
                SELECT 
                    a.appointment_date,
                    a.appointment_time,
                    a.status,
                    a.type,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.appointment_date BETWEEN $1 AND $2
                    AND a.is_deleted = false
            `;
            const values = [startDate, endDate];
            let paramIndex = 3;

            if (doctor_id) {
                query += ` AND a.doctor_id = $${paramIndex}`;
                values.push(doctor_id);
                paramIndex++;
            }

            query += ` ORDER BY a.appointment_date, a.appointment_time`;

            const result = await db.query(query, values);

            // Group by date
            const calendar = {};
            result.rows.forEach(appointment => {
                const dateStr = appointment.appointment_date.toISOString().split('T')[0];
                if (!calendar[dateStr]) {
                    calendar[dateStr] = [];
                }
                calendar[dateStr].push(appointment);
            });

            return calendar;
        } catch (error) {
            logger.error('Error in getCalendarView', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get appointment by ID
     */
    async getAppointmentById(receptionistId, appointmentId) {
        try {
            const query = `
                SELECT a.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.phone as patient_phone,
                       p.email as patient_email,
                       e.id as doctor_id,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.specialization as doctor_specialization,
                       d.name as department_name,
                       d.id as department_id
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE a.id = $1 AND a.is_deleted = false
            `;

            const result = await db.query(query, [appointmentId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getAppointmentById', { error: error.message, receptionistId, appointmentId });
            throw error;
        }
    },

    /**
     * Get doctor daily stats [BR-08]
     */
    async getDoctorDailyStats(doctorId, date) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as appointments_count,
                    COUNT(*) FILTER (WHERE status IN ('scheduled', 'confirmed')) as booked_count
                FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date = $2
                    AND status NOT IN ('cancelled', 'completed')
            `;

            const result = await db.query(query, [doctorId, date]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getDoctorDailyStats', { error: error.message, doctorId, date });
            throw error;
        }
    },

    /**
     * Check slot availability
     */
    async checkSlotAvailability(doctorId, date, time, excludeAppointmentId = null) {
        try {
            let query = `
                SELECT id FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date = $2
                    AND appointment_time = $3
                    AND status NOT IN ('cancelled', 'completed')
            `;
            const values = [doctorId, date, time];

            if (excludeAppointmentId) {
                query += ` AND id != $4`;
                values.push(excludeAppointmentId);
            }

            const result = await db.query(query, values);
            return result.rows.length === 0;
        } catch (error) {
            logger.error('Error in checkSlotAvailability', { error: error.message, doctorId, date, time });
            throw error;
        }
    },

    /**
     * Create new appointment
     */
    async createAppointment(receptionistId, appointmentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate queue number for the day
            const queueQuery = `
                SELECT COALESCE(MAX(queue_number), 0) + 1 as next_queue
                FROM appointments
                WHERE appointment_date = $1
            `;
            const queue = await client.query(queueQuery, [appointmentData.appointment_date]);
            const queueNumber = parseInt(queue.rows[0].next_queue);

            const query = `
                INSERT INTO appointments (
                    id, patient_id, doctor_id, appointment_date,
                    appointment_time, duration_minutes, status, type,
                    reason, notes, queue_number, is_emergency,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, 'scheduled',
                    $6, $7, $8, $9, $10, $11, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                appointmentData.patient_id,
                appointmentData.doctor_id,
                appointmentData.appointment_date,
                appointmentData.appointment_time,
                appointmentData.duration_minutes || 30,
                appointmentData.type,
                appointmentData.reason,
                appointmentData.notes || null,
                queueNumber,
                appointmentData.is_emergency || false,
                appointmentData.created_by
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update appointment
     */
    async updateAppointment(receptionistId, appointmentId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'appointment_date', 'appointment_time', 'duration_minutes',
                'type', 'reason', 'notes', 'status'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(appointmentId);

            const query = `
                UPDATE appointments 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Cancel appointment
     */
    async cancelAppointment(receptionistId, appointmentId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE appointments 
                SET status = 'cancelled',
                    cancellation_reason = $1,
                    cancelled_by = $2,
                    cancelled_at = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                data.reason,
                data.cancelled_by,
                data.cancelled_at,
                appointmentId
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Check-in patient
     */
    async checkInPatient(receptionistId, appointmentId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE appointments 
                SET check_in_time = $1,
                    status = $2,
                    check_in_notes = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                data.check_in_time,
                data.status,
                data.check_in_notes,
                appointmentId
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Check-out patient
     */
    async checkOutPatient(receptionistId, appointmentId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE appointments 
                SET check_out_time = $1,
                    status = $2,
                    check_out_notes = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                data.check_out_time,
                data.status,
                data.check_out_notes,
                appointmentId
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get available slots
     */
    async getAvailableSlots(doctorId, date) {
        try {
            // Get doctor's schedule
            const scheduleQuery = `
                SELECT start_time, end_time, slot_duration, break_start, break_end
                FROM doctor_schedules
                WHERE doctor_id = $1 
                    AND day = EXTRACT(DOW FROM DATE $2)
                    AND is_active = true
            `;
            const schedule = await db.query(scheduleQuery, [doctorId, date]);

            if (schedule.rows.length === 0) {
                return [];
            }

            const { start_time, end_time, slot_duration = 30, break_start, break_end } = schedule.rows[0];

            // Get booked appointments
            const bookedQuery = `
                SELECT appointment_time
                FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date = $2
                    AND status NOT IN ('cancelled', 'completed')
            `;
            const booked = await db.query(bookedQuery, [doctorId, date]);
            const bookedTimes = new Set(booked.rows.map(b => b.appointment_time));

            // Generate time slots
            const slots = [];
            let currentTime = new Date(`2000-01-01T${start_time}`);
            const endTime = new Date(`2000-01-01T${end_time}`);
            const breakStartTime = break_start ? new Date(`2000-01-01T${break_start}`) : null;
            const breakEndTime = break_end ? new Date(`2000-01-01T${break_end}`) : null;

            while (currentTime < endTime) {
                const timeString = currentTime.toTimeString().slice(0, 5);

                // Skip if within break time
                if (breakStartTime && breakEndTime && 
                    currentTime >= breakStartTime && currentTime < breakEndTime) {
                    currentTime.setMinutes(currentTime.getMinutes() + slot_duration);
                    continue;
                }

                slots.push({
                    time: timeString,
                    is_available: !bookedTimes.has(timeString)
                });

                currentTime.setMinutes(currentTime.getMinutes() + slot_duration);
            }

            return slots;
        } catch (error) {
            logger.error('Error in getAvailableSlots', { error: error.message, doctorId, date });
            throw error;
        }
    },

    /**
     * Get walk-in slots
     */
    async getWalkinSlots(date, departmentId = null) {
        try {
            let query = `
                SELECT 
                    e.id as doctor_id,
                    e.first_name,
                    e.last_name,
                    e.specialization,
                    ds.start_time,
                    ds.end_time,
                    ds.slot_duration,
                    ds.max_walkins,
                    (
                        SELECT COUNT(*)
                        FROM appointments a
                        WHERE a.doctor_id = e.id
                            AND a.appointment_date = $1
                            AND a.type = 'walkin'
                            AND a.status NOT IN ('cancelled', 'completed')
                    ) as booked_walkins
                FROM employees e
                JOIN doctor_schedules ds ON e.id = ds.doctor_id
                WHERE e.designation = 'Doctor'
                    AND ds.day = EXTRACT(DOW FROM DATE $1)
                    AND e.is_active = true
            `;
            const values = [date];

            if (departmentId) {
                query += ` AND e.department_id = $2`;
                values.push(departmentId);
            }

            const result = await db.query(query, values);

            return result.rows.map(doctor => ({
                doctor_id: doctor.doctor_id,
                doctor_name: `Dr. ${doctor.first_name} ${doctor.last_name}`,
                specialization: doctor.specialization,
                available_walkins: (doctor.max_walkins || 10) - (doctor.booked_walkins || 0),
                start_time: doctor.start_time,
                end_time: doctor.end_time
            }));
        } catch (error) {
            logger.error('Error in getWalkinSlots', { error: error.message, date, departmentId });
            throw error;
        }
    },

    /**
     * Get appointment statistics
     */
    async getAppointmentStats(receptionistId, period = 'week') {
        try {
            let interval;
            switch(period) {
                case 'day':
                    interval = "INTERVAL '1 day'";
                    break;
                case 'week':
                    interval = "INTERVAL '7 days'";
                    break;
                case 'month':
                    interval = "INTERVAL '30 days'";
                    break;
                default:
                    interval = "INTERVAL '7 days'";
            }

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(appointment_date) as date,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                        COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
                        COUNT(*) FILTER (WHERE is_emergency = true) as emergency,
                        AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/60)::numeric(10,2) as avg_duration
                    FROM appointments
                    WHERE appointment_date > NOW() - ${interval}
                    GROUP BY DATE(appointment_date)
                )
                SELECT 
                    json_agg(daily_stats.* ORDER BY date) as daily,
                    SUM(total) as total_appointments,
                    SUM(completed) as total_completed,
                    SUM(cancelled) as total_cancelled,
                    SUM(no_show) as total_no_show,
                    SUM(emergency) as total_emergency,
                    AVG(completed::float / NULLIF(total, 0) * 100)::numeric(5,2) as avg_completion_rate
                FROM daily_stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAppointmentStats', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get doctor schedule
     */
    async getDoctorSchedule(doctorId, date) {
        try {
            const query = `
                SELECT 
                    a.appointment_time,
                    a.status,
                    a.type,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    a.reason
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.doctor_id = $1 
                    AND a.appointment_date = $2
                    AND a.status NOT IN ('cancelled')
                ORDER BY a.appointment_time ASC
            `;

            const result = await db.query(query, [doctorId, date]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getDoctorSchedule', { error: error.message, doctorId, date });
            throw error;
        }
    },

    /**
     * Bulk create appointments
     */
    async bulkCreateAppointments(receptionistId, appointments) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const results = {
                success: [],
                failed: []
            };

            for (const apt of appointments) {
                try {
                    // Check availability
                    const isAvailable = await this.checkSlotAvailability(
                        apt.doctor_id,
                        apt.appointment_date,
                        apt.appointment_time
                    );

                    if (!isAvailable) {
                        results.failed.push({
                            ...apt,
                            error: 'Time slot not available'
                        });
                        continue;
                    }

                    // Check doctor's daily limit [BR-08]
                    const doctorStats = await this.getDoctorDailyStats(
                        apt.doctor_id,
                        apt.appointment_date
                    );

                    if (doctorStats.appointments_count >= 30) {
                        results.failed.push({
                            ...apt,
                            error: 'Doctor has reached maximum appointments for this day'
                        });
                        continue;
                    }

                    // Create appointment
                    const appointment = await this.createAppointment(receptionistId, apt);
                    results.success.push(appointment);
                } catch (err) {
                    results.failed.push({
                        ...apt,
                        error: err.message
                    });
                }
            }

            await db.commitTransaction(client);

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Export appointments
     */
    async exportAppointments(receptionistId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    a.appointment_date, a.appointment_time, a.status, a.type,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    e.specialization as doctor_specialization,
                    a.reason, a.notes,
                    a.check_in_time, a.check_out_time
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND a.appointment_date >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND a.appointment_date <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            if (filters.status) {
                query += ` AND a.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportAppointments', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Send appointment reminders
     */
    async sendAppointmentReminders(receptionistId, hoursBefore = 24) {
        try {
            const reminderTime = new Date();
            reminderTime.setHours(reminderTime.getHours() + hoursBefore);

            const query = `
                SELECT a.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       p.email as patient_email,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                WHERE a.appointment_date = $1::DATE
                    AND a.appointment_time BETWEEN $1::TIME - INTERVAL '1 hour' AND $1::TIME
                    AND a.status = 'scheduled'
                    AND a.reminder_sent = false
            `;

            const result = await db.query(query, [reminderTime]);

            // TODO: Send actual reminders (SMS/Email)
            // For now, just mark as sent
            for (const apt of result.rows) {
                await db.query(`
                    UPDATE appointments 
                    SET reminder_sent = true,
                        reminder_sent_at = NOW()
                    WHERE id = $1
                `, [apt.id]);
            }

            return {
                sent: result.rows.length,
                appointments: result.rows
            };
        } catch (error) {
            logger.error('Error in sendAppointmentReminders', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get appointments requiring reminder
     */
    async getAppointmentsRequiringReminder() {
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const query = `
                SELECT a.*, 
                       p.phone as patient_phone,
                       p.email as patient_email
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.appointment_date = $1::DATE
                    AND a.status = 'scheduled'
                    AND a.reminder_sent = false
            `;

            const result = await db.query(query, [tomorrow]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getAppointmentsRequiringReminder', { error: error.message });
            throw error;
        }
    }
};

module.exports = appointmentService;