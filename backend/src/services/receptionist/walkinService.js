/**
 * ======================================================================
 * FILE: backend/src/services/receptionist/walkinService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist walk-in service - Handles walk-in patient registration and queue.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const bcrypt = require('bcrypt');

const walkinService = {
    /**
     * Register walk-in patient
     */
    async registerWalkin(receptionistId, walkinData, existingPatientId = null) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate walk-in token
            const tokenQuery = `
                SELECT COALESCE(MAX(token_number), 0) + 1 as next_token
                FROM walkin_queue
                WHERE DATE(created_at) = CURRENT_DATE
            `;
            const token = await client.query(tokenQuery);
            const tokenNumber = parseInt(token.rows[0].next_token);

            const query = `
                INSERT INTO walkin_queue (
                    id, token_number, name, phone, email,
                    purpose, preferred_doctor, preferred_department,
                    patient_id, registered_by, registered_at,
                    status, ip_address, user_agent, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, 'waiting', $11, $12, NOW()
                ) RETURNING *
            `;

            const values = [
                tokenNumber,
                walkinData.name,
                walkinData.phone,
                walkinData.email || null,
                walkinData.purpose,
                walkinData.preferred_doctor || null,
                walkinData.preferred_department || null,
                existingPatientId,
                walkinData.registered_by,
                walkinData.registered_at,
                walkinData.ip_address,
                walkinData.user_agent
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
     * Find patient by phone
     */
    async findPatientByPhone(phone) {
        try {
            const query = `
                SELECT id, first_name, last_name, phone, email
                FROM patients
                WHERE phone = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [phone]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in findPatientByPhone', { error: error.message, phone });
            throw error;
        }
    },

    /**
     * Get walk-in by ID
     */
    async getWalkinById(walkinId) {
        try {
            const query = `
                SELECT w.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       d.name as department_name,
                       CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                       CONCAT(reg.first_name, ' ', reg.last_name) as registered_by_name
                FROM walkin_queue w
                LEFT JOIN patients p ON w.patient_id = p.id
                LEFT JOIN departments d ON w.preferred_department = d.id
                LEFT JOIN employees e ON w.preferred_doctor = e.id
                LEFT JOIN employees reg ON w.registered_by = reg.id
                WHERE w.id = $1
            `;

            const result = await db.query(query, [walkinId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getWalkinById', { error: error.message, walkinId });
            throw error;
        }
    },

    /**
     * Get walk-in queue
     */
    async getWalkinQueue(receptionistId, options = {}) {
        try {
            const { page = 1, limit = 20, status = 'waiting', department } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT w.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       d.name as department_name,
                       CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                       EXTRACT(EPOCH FROM (NOW() - w.registered_at))/60 as waiting_minutes,
                       ROW_NUMBER() OVER (ORDER BY w.registered_at) as queue_position
                FROM walkin_queue w
                LEFT JOIN patients p ON w.patient_id = p.id
                LEFT JOIN departments d ON w.preferred_department = d.id
                LEFT JOIN employees e ON w.preferred_doctor = e.id
                WHERE w.status = $1
            `;
            const values = [status];
            let paramIndex = 2;

            if (department) {
                query += ` AND (w.preferred_department = $${paramIndex} OR w.preferred_department IS NULL)`;
                values.push(department);
                paramIndex++;
            }

            query += ` ORDER BY w.registered_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    AVG(EXTRACT(EPOCH FROM (NOW() - registered_at))/60)::numeric(10,2) as avg_wait_time
                FROM walkin_queue
                WHERE DATE(created_at) = CURRENT_DATE
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getWalkinQueue', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Update walk-in status
     */
    async updateWalkinStatus(receptionistId, walkinId, status, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            let additionalFields = '';
            const values = [status, walkinId];
            let paramIndex = 3;

            if (status === 'called') {
                additionalFields = `, called_at = $${paramIndex}, called_by = $${paramIndex + 1}`;
                values.push(new Date(), receptionistId);
                paramIndex += 2;
            } else if (status === 'in_progress') {
                additionalFields = `, started_at = $${paramIndex}, started_by = $${paramIndex + 1}`;
                values.push(new Date(), receptionistId);
                paramIndex += 2;
            } else if (status === 'completed') {
                additionalFields = `, completed_at = $${paramIndex}, completed_by = $${paramIndex + 1}`;
                values.push(new Date(), receptionistId);
                paramIndex += 2;
            }

            if (data.notes) {
                additionalFields += `, notes = CONCAT(notes, E'\\n', $${paramIndex})`;
                values.push(data.notes);
                paramIndex++;
            }

            const query = `
                UPDATE walkin_queue 
                SET status = $1,
                    updated_at = NOW()
                    ${additionalFields}
                WHERE id = $2
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
     * Mark walk-in as processed
     */
    async markWalkinProcessed(walkinId, appointmentId) {
        try {
            const query = `
                UPDATE walkin_queue 
                SET appointment_id = $1,
                    status = 'completed',
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = $2
                RETURNING id
            `;

            const result = await db.query(query, [appointmentId, walkinId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in markWalkinProcessed', { error: error.message, walkinId, appointmentId });
            throw error;
        }
    },

    /**
     * Create patient from walk-in data
     */
    async createPatientFromWalkin(walkin, createdBy) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Create user account
            const userQuery = `
                INSERT INTO users (
                    id, username, email, password_hash,
                    role, status, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, 'patient', 'active', NOW(), NOW()
                ) RETURNING id
            `;

            const username = `${walkin.name.split(' ')[0].toLowerCase()}.${Math.floor(Math.random() * 1000)}`;
            const tempPassword = await bcrypt.hash('Welcome@123', 10);

            const user = await client.query(userQuery, [
                username,
                walkin.email || `${username}@temp.com`,
                tempPassword
            ]);

            // Create patient record
            const patientQuery = `
                INSERT INTO patients (
                    id, user_id, first_name, last_name, phone, email,
                    registration_date, referred_by, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), 'walkin', $6, NOW(), NOW()
                ) RETURNING *
            `;

            const nameParts = walkin.name.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || '';

            const patient = await client.query(patientQuery, [
                user.rows[0].id,
                firstName,
                lastName,
                walkin.phone,
                walkin.email || null,
                createdBy
            ]);

            await db.commitTransaction(client);

            return patient.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Check doctor availability
     */
    async checkDoctorAvailability(doctorId, date, time) {
        try {
            const query = `
                SELECT COUNT(*) as appointments
                FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date = $2
                    AND appointment_time = $3
                    AND status NOT IN ('cancelled', 'completed')
            `;

            const result = await db.query(query, [doctorId, date, time]);
            return parseInt(result.rows[0].appointments) === 0;
        } catch (error) {
            logger.error('Error in checkDoctorAvailability', { error: error.message, doctorId, date, time });
            throw error;
        }
    },

    /**
     * Check slot availability
     */
    async checkSlotAvailability(doctorId, date, time) {
        try {
            const query = `
                SELECT COUNT(*) as booked
                FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date = $2
                    AND appointment_time = $3
                    AND status NOT IN ('cancelled', 'completed')
            `;

            const result = await db.query(query, [doctorId, date, time]);
            return parseInt(result.rows[0].booked) === 0;
        } catch (error) {
            logger.error('Error in checkSlotAvailability', { error: error.message, doctorId, date, time });
            throw error;
        }
    },

    /**
     * Create walk-in appointment
     */
    async createWalkinAppointment(receptionistId, appointmentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO appointments (
                    id, patient_id, doctor_id, appointment_date,
                    appointment_time, type, reason, notes,
                    is_emergency, status, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
                    $8, 'scheduled', $9, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                appointmentData.patient_id,
                appointmentData.doctor_id,
                appointmentData.appointment_date,
                appointmentData.appointment_time,
                appointmentData.type,
                appointmentData.reason,
                appointmentData.notes || null,
                appointmentData.is_emergency || false,
                appointmentData.created_by
            ];

            const result = await client.query(query, values);

            // Link to walk-in record if provided
            if (appointmentData.walkin_id) {
                await client.query(`
                    UPDATE walkin_queue 
                    SET appointment_id = $1,
                        status = 'completed',
                        completed_at = NOW()
                    WHERE id = $2
                `, [result.rows[0].id, appointmentData.walkin_id]);
            }

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
     * Get next walk-in
     */
    async getNextWalkin(filters = {}) {
        try {
            const { department, doctor_id } = filters;

            let query = `
                SELECT w.*
                FROM walkin_queue w
                WHERE w.status = 'waiting'
            `;
            const values = [];

            if (doctor_id) {
                query += ` AND w.preferred_doctor = $1`;
                values.push(doctor_id);
            } else if (department) {
                query += ` AND w.preferred_department = $1`;
                values.push(department);
            }

            query += ` ORDER BY w.registered_at ASC
                      LIMIT 1`;

            const result = await db.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getNextWalkin', { error: error.message, filters });
            throw error;
        }
    },

    /**
     * Get walk-in statistics
     */
    async getWalkinStatistics(receptionistId, period = 'day') {
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
                    interval = "INTERVAL '30 days'";
            }

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        AVG(EXTRACT(EPOCH FROM (completed_at - registered_at))/60)::numeric(10,2) as avg_wait_time
                    FROM walkin_queue
                    WHERE created_at > NOW() - ${interval}
                    GROUP BY DATE(created_at)
                )
                SELECT 
                    json_agg(daily_stats.* ORDER BY date) as daily,
                    SUM(total) as total_walkins,
                    SUM(completed) as total_completed,
                    AVG(avg_wait_time) as overall_avg_wait_time,
                    COUNT(*) FILTER (WHERE appointment_id IS NOT NULL) as converted_to_appointment
                FROM daily_stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getWalkinStatistics', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get walk-in trends
     */
    async getWalkinTrends(receptionistId, days = 30) {
        try {
            const query = `
                SELECT 
                    DATE(created_at) as date,
                    EXTRACT(HOUR FROM created_at) as hour,
                    COUNT(*) as count,
                    AVG(EXTRACT(EPOCH FROM (completed_at - registered_at))/60)::numeric(10,2) as avg_wait_time
                FROM walkin_queue
                WHERE created_at > NOW() - INTERVAL '${days} days'
                GROUP BY DATE(created_at), EXTRACT(HOUR FROM created_at)
                ORDER BY date DESC, hour
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getWalkinTrends', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Search walk-in records
     */
    async searchWalkins(receptionistId, searchTerm, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT w.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       CONCAT(reg.first_name, ' ', reg.last_name) as registered_by_name
                FROM walkin_queue w
                LEFT JOIN patients p ON w.patient_id = p.id
                LEFT JOIN employees reg ON w.registered_by = reg.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (searchTerm) {
                query += ` AND (
                    w.name ILIKE $${paramIndex} OR 
                    w.phone ILIKE $${paramIndex} OR 
                    w.email ILIKE $${paramIndex}
                )`;
                values.push(`%${searchTerm}%`);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND w.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND w.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            if (status) {
                query += ` AND w.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` ORDER BY w.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM walkin_queue
                WHERE 1=1
                ${searchTerm ? 'AND (name ILIKE $1 OR phone ILIKE $1)' : ''}
            `;
            const countValues = searchTerm ? [`%${searchTerm}%`] : [];
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in searchWalkins', { error: error.message, receptionistId, searchTerm });
            throw error;
        }
    },

    /**
     * Export walk-in records
     */
    async exportWalkins(receptionistId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    w.created_at, w.token_number, w.name, w.phone,
                    w.email, w.purpose, w.status,
                    CASE 
                        WHEN w.patient_id IS NOT NULL THEN CONCAT(p.first_name, ' ', p.last_name)
                        ELSE NULL
                    END as patient_name,
                    w.registered_at, w.called_at, w.completed_at,
                    EXTRACT(EPOCH FROM (w.completed_at - w.registered_at))/60 as total_wait_minutes
                FROM walkin_queue w
                LEFT JOIN patients p ON w.patient_id = p.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND w.created_at >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND w.created_at <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            if (filters.status) {
                query += ` AND w.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            query += ` ORDER BY w.created_at DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportWalkins', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get average wait time
     */
    async getAverageWaitTime(receptionistId, period = 'day') {
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
                    interval = "INTERVAL '30 days'";
            }

            const query = `
                SELECT 
                    AVG(EXTRACT(EPOCH FROM (completed_at - registered_at))/60)::numeric(10,2) as avg_wait_time,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - registered_at))/60) as median_wait_time,
                    MIN(EXTRACT(EPOCH FROM (completed_at - registered_at))/60)::numeric(10,2) as min_wait_time,
                    MAX(EXTRACT(EPOCH FROM (completed_at - registered_at))/60)::numeric(10,2) as max_wait_time
                FROM walkin_queue
                WHERE completed_at IS NOT NULL
                    AND created_at > NOW() - ${interval}
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAverageWaitTime', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get peak hours
     */
    async getPeakHours(receptionistId, days = 30) {
        try {
            const query = `
                SELECT 
                    EXTRACT(HOUR FROM created_at) as hour,
                    COUNT(*) as count,
                    AVG(EXTRACT(EPOCH FROM (completed_at - registered_at))/60)::numeric(10,2) as avg_wait_time
                FROM walkin_queue
                WHERE created_at > NOW() - INTERVAL '${days} days'
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPeakHours', { error: error.message, receptionistId });
            throw error;
        }
    }
};

module.exports = walkinService;