/**
 * ======================================================================
 * FILE: backend/src/services/receptionist/opdService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist OPD service - Handles OPD registration, token generation, and queue.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const opdService = {
    /**
     * Get patient by ID
     */
    async getPatientById(patientId) {
        try {
            const query = `
                SELECT id, first_name, last_name, phone, email, date_of_birth
                FROM patients
                WHERE id = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [patientId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getPatientById', { error: error.message, patientId });
            throw error;
        }
    },

    /**
     * Generate token number
     */
    async generateTokenNumber(entityId) {
        try {
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            
            const query = `
                SELECT COALESCE(MAX(token_number), 0) + 1 as next_token
                FROM opd_registrations
                WHERE DATE(created_at) = CURRENT_DATE
                    AND (doctor_id = $1 OR department_id = $1)
            `;

            const result = await db.query(query, [entityId]);
            const nextToken = parseInt(result.rows[0].next_token);
            
            return `${today}${nextToken.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateTokenNumber', { error: error.message, entityId });
            throw error;
        }
    },

    /**
     * Get queue position
     */
    async getQueuePosition(entityId) {
        try {
            const query = `
                SELECT COUNT(*) as position
                FROM opd_registrations
                WHERE DATE(created_at) = CURRENT_DATE
                    AND (doctor_id = $1 OR department_id = $1)
                    AND status = 'waiting'
            `;

            const result = await db.query(query, [entityId]);
            return parseInt(result.rows[0].position);
        } catch (error) {
            logger.error('Error in getQueuePosition', { error: error.message, entityId });
            throw error;
        }
    },

    /**
     * Check doctor availability
     */
    async checkDoctorAvailability(doctorId) {
        try {
            const query = `
                SELECT is_available
                FROM doctor_schedules
                WHERE doctor_id = $1 
                    AND day = EXTRACT(DOW FROM CURRENT_DATE)
                    AND start_time <= CURRENT_TIME
                    AND end_time >= CURRENT_TIME
                    AND is_active = true
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error in checkDoctorAvailability', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Register for OPD
     */
    async registerOPD(receptionistId, registrationData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO opd_registrations (
                    id, patient_id, doctor_id, department_id,
                    consultation_type, token_number, queue_position,
                    fees, payment_method, payment_status,
                    priority, symptoms, notes, status,
                    registered_by, registration_date, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12, 'waiting',
                    $13, $14, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                registrationData.patient_id,
                registrationData.doctor_id || null,
                registrationData.department_id || null,
                registrationData.consultation_type,
                registrationData.token_number,
                registrationData.queue_position,
                registrationData.fees || null,
                registrationData.payment_method || null,
                registrationData.payment_status || 'pending',
                registrationData.priority || 'normal',
                registrationData.symptoms || null,
                registrationData.notes || null,
                registrationData.registered_by,
                registrationData.registration_date
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
     * Get OPD queue
     */
    async getOPDQueue(receptionistId, options = {}) {
        try {
            const { page = 1, limit = 50, status = 'waiting', doctor_id, department_id } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT o.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       p.date_of_birth as patient_dob,
                       d.name as department_name,
                       CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                       EXTRACT(EPOCH FROM (NOW() - o.registration_date))/60 as waiting_minutes,
                       ROW_NUMBER() OVER (ORDER BY 
                           CASE o.priority
                               WHEN 'emergency' THEN 1
                               WHEN 'high' THEN 2
                               WHEN 'normal' THEN 3
                               ELSE 4
                           END,
                           o.registration_date
                       ) as queue_position
                FROM opd_registrations o
                JOIN patients p ON o.patient_id = p.id
                LEFT JOIN departments d ON o.department_id = d.id
                LEFT JOIN employees e ON o.doctor_id = e.id
                WHERE DATE(o.created_at) = CURRENT_DATE
                    AND o.status = $1
            `;
            const values = [status];
            let paramIndex = 2;

            if (doctor_id) {
                query += ` AND o.doctor_id = $${paramIndex}`;
                values.push(doctor_id);
                paramIndex++;
            }

            if (department_id) {
                query += ` AND o.department_id = $${paramIndex}`;
                values.push(department_id);
                paramIndex++;
            }

            query += ` ORDER BY queue_position
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
                    COUNT(*) FILTER (WHERE status = 'in_consultation') as in_consultation,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    AVG(EXTRACT(EPOCH FROM (NOW() - registration_date))/60)::numeric(10,2) as avg_wait_time
                FROM opd_registrations
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
            logger.error('Error in getOPDQueue', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Update OPD status
     */
    async updateOPDStatus(receptionistId, registrationId, status, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            let additionalFields = '';
            const values = [status, registrationId];
            let paramIndex = 3;

            if (status === 'called') {
                additionalFields = `, called_at = $${paramIndex}, called_by = $${paramIndex + 1}`;
                values.push(new Date(), receptionistId);
                paramIndex += 2;
            } else if (status === 'in_consultation') {
                additionalFields = `, consultation_started_at = $${paramIndex}, consultation_started_by = $${paramIndex + 1}`;
                values.push(new Date(), receptionistId);
                paramIndex += 2;
            } else if (status === 'completed') {
                additionalFields = `, consultation_ended_at = $${paramIndex}, consultation_ended_by = $${paramIndex + 1}`;
                values.push(new Date(), receptionistId);
                paramIndex += 2;
            }

            if (data.notes) {
                additionalFields += `, notes = CONCAT(notes, E'\\n', $${paramIndex})`;
                values.push(data.notes);
                paramIndex++;
            }

            const query = `
                UPDATE opd_registrations 
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
     * Get OPD by ID
     */
    async getOPDById(registrationId) {
        try {
            const query = `
                SELECT o.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       p.date_of_birth as patient_dob,
                       d.name as department_name,
                       CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                       CONCAT(reg.first_name, ' ', reg.last_name) as registered_by_name
                FROM opd_registrations o
                JOIN patients p ON o.patient_id = p.id
                LEFT JOIN departments d ON o.department_id = d.id
                LEFT JOIN employees e ON o.doctor_id = e.id
                LEFT JOIN employees reg ON o.registered_by = reg.id
                WHERE o.id = $1
            `;

            const result = await db.query(query, [registrationId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getOPDById', { error: error.message, registrationId });
            throw error;
        }
    },

    /**
     * Get today's OPD registrations
     */
    async getTodaysOPD(receptionistId, filters = {}) {
        try {
            const { doctor_id, department_id } = filters;

            let query = `
                SELECT o.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       d.name as department_name,
                       CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                       EXTRACT(EPOCH FROM (NOW() - o.registration_date))/60 as waiting_minutes
                FROM opd_registrations o
                JOIN patients p ON o.patient_id = p.id
                LEFT JOIN departments d ON o.department_id = d.id
                LEFT JOIN employees e ON o.doctor_id = e.id
                WHERE DATE(o.created_at) = CURRENT_DATE
            `;
            const values = [];

            if (doctor_id) {
                query += ` AND o.doctor_id = $1`;
                values.push(doctor_id);
            }

            if (department_id) {
                query += ` AND o.department_id = $1`;
                values.push(department_id);
            }

            query += ` ORDER BY 
                CASE o.priority
                    WHEN 'emergency' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    ELSE 4
                END,
                o.registration_date`;

            const result = await db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysOPD', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get OPD statistics
     */
    async getOPDStatistics(receptionistId, period = 'day') {
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
                        AVG(EXTRACT(EPOCH FROM (consultation_ended_at - consultation_started_at))/60)::numeric(10,2) as avg_consultation_time,
                        SUM(fees) as total_fees,
                        COUNT(*) FILTER (WHERE payment_status = 'paid') as paid_count
                    FROM opd_registrations
                    WHERE created_at > NOW() - ${interval}
                    GROUP BY DATE(created_at)
                )
                SELECT 
                    json_agg(daily_stats.* ORDER BY date) as daily,
                    SUM(total) as total_registrations,
                    SUM(completed) as total_completed,
                    AVG(avg_consultation_time) as overall_avg_time,
                    SUM(total_fees) as total_revenue,
                    (SUM(paid_count)::float / NULLIF(SUM(total), 0) * 100)::numeric(5,2) as payment_rate
                FROM daily_stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getOPDStatistics', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get doctor-wise OPD count
     */
    async getDoctorWiseOPD(receptionistId, date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                SELECT 
                    e.id as doctor_id,
                    CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                    e.specialization,
                    COUNT(o.id) as patient_count,
                    COUNT(o.id) FILTER (WHERE o.status = 'completed') as completed_count,
                    AVG(EXTRACT(EPOCH FROM (o.consultation_ended_at - o.consultation_started_at))/60)::numeric(10,2) as avg_consultation_time
                FROM employees e
                LEFT JOIN opd_registrations o ON e.id = o.doctor_id
                    AND DATE(o.created_at) = $1
                WHERE e.designation = 'Doctor'
                GROUP BY e.id
                ORDER BY patient_count DESC
            `;

            const result = await db.query(query, [targetDate]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getDoctorWiseOPD', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get department-wise OPD count
     */
    async getDepartmentWiseOPD(receptionistId, date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                SELECT 
                    d.id as department_id,
                    d.name as department_name,
                    COUNT(o.id) as patient_count,
                    COUNT(o.id) FILTER (WHERE o.status = 'completed') as completed_count,
                    AVG(EXTRACT(EPOCH FROM (o.consultation_ended_at - o.consultation_started_at))/60)::numeric(10,2) as avg_consultation_time
                FROM departments d
                LEFT JOIN opd_registrations o ON d.id = o.department_id
                    AND DATE(o.created_at) = $1
                GROUP BY d.id
                ORDER BY patient_count DESC
            `;

            const result = await db.query(query, [targetDate]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getDepartmentWiseOPD', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get next patient
     */
    async getNextPatient(doctorId = null, departmentId = null) {
        try {
            let query = `
                SELECT o.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name
                FROM opd_registrations o
                JOIN patients p ON o.patient_id = p.id
                WHERE o.status = 'waiting'
                    AND DATE(o.created_at) = CURRENT_DATE
            `;
            const values = [];

            if (doctorId) {
                query += ` AND o.doctor_id = $1`;
                values.push(doctorId);
            } else if (departmentId) {
                query += ` AND o.department_id = $1`;
                values.push(departmentId);
            }

            query += ` ORDER BY 
                CASE o.priority
                    WHEN 'emergency' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    ELSE 4
                END,
                o.registration_date
                LIMIT 1`;

            const result = await db.query(query, values);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getNextPatient', { error: error.message, doctorId, departmentId });
            throw error;
        }
    },

    /**
     * Search OPD registrations
     */
    async searchOPD(receptionistId, searchTerm, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT o.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       d.name as department_name,
                       CONCAT(e.first_name, ' ', e.last_name) as doctor_name
                FROM opd_registrations o
                JOIN patients p ON o.patient_id = p.id
                LEFT JOIN departments d ON o.department_id = d.id
                LEFT JOIN employees e ON o.doctor_id = e.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (searchTerm) {
                query += ` AND (
                    p.first_name ILIKE $${paramIndex} OR 
                    p.last_name ILIKE $${paramIndex} OR 
                    p.phone ILIKE $${paramIndex} OR
                    o.token_number ILIKE $${paramIndex}
                )`;
                values.push(`%${searchTerm}%`);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND o.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND o.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            if (status) {
                query += ` AND o.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` ORDER BY o.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM opd_registrations o
                JOIN patients p ON o.patient_id = p.id
                WHERE 1=1
                ${searchTerm ? 'AND (p.first_name ILIKE $1 OR p.last_name ILIKE $1 OR p.phone ILIKE $1)' : ''}
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
            logger.error('Error in searchOPD', { error: error.message, receptionistId, searchTerm });
            throw error;
        }
    },

    /**
     * Export OPD records
     */
    async exportOPD(receptionistId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    o.created_at, o.token_number, o.consultation_type,
                    o.status, o.priority, o.fees, o.payment_status,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    d.name as department_name,
                    CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                    o.registration_date, o.called_at,
                    o.consultation_started_at, o.consultation_ended_at,
                    EXTRACT(EPOCH FROM (o.consultation_ended_at - o.consultation_started_at))/60 as consultation_duration,
                    o.symptoms, o.notes
                FROM opd_registrations o
                JOIN patients p ON o.patient_id = p.id
                LEFT JOIN departments d ON o.department_id = d.id
                LEFT JOIN employees e ON o.doctor_id = e.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND o.created_at >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND o.created_at <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            if (filters.doctor_id) {
                query += ` AND o.doctor_id = $${paramIndex}`;
                values.push(filters.doctor_id);
                paramIndex++;
            }

            if (filters.department_id) {
                query += ` AND o.department_id = $${paramIndex}`;
                values.push(filters.department_id);
                paramIndex++;
            }

            query += ` ORDER BY o.created_at DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportOPD', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get average consultation time
     */
    async getAverageConsultationTime(receptionistId, filters = {}) {
        try {
            const { doctor_id, department_id, days = 30 } = filters;

            let query = `
                SELECT 
                    AVG(EXTRACT(EPOCH FROM (consultation_ended_at - consultation_started_at))/60)::numeric(10,2) as avg_time,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (consultation_ended_at - consultation_started_at))/60) as median_time,
                    MIN(EXTRACT(EPOCH FROM (consultation_ended_at - consultation_started_at))/60)::numeric(10,2) as min_time,
                    MAX(EXTRACT(EPOCH FROM (consultation_ended_at - consultation_started_at))/60)::numeric(10,2) as max_time,
                    COUNT(*) as total_consultations
                FROM opd_registrations
                WHERE consultation_started_at IS NOT NULL
                    AND consultation_ended_at IS NOT NULL
                    AND created_at > NOW() - INTERVAL '${days} days'
            `;
            const values = [];

            if (doctor_id) {
                query += ` AND doctor_id = $1`;
                values.push(doctor_id);
            }

            if (department_id) {
                query += ` AND department_id = $1`;
                values.push(department_id);
            }

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAverageConsultationTime', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get peak OPD hours
     */
    async getPeakOPDHours(receptionistId, days = 30) {
        try {
            const query = `
                SELECT 
                    EXTRACT(HOUR FROM created_at) as hour,
                    COUNT(*) as registrations,
                    AVG(EXTRACT(EPOCH FROM (waiting_time))) / 60 as avg_wait_time
                FROM opd_registrations
                WHERE created_at > NOW() - INTERVAL '${days} days'
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPeakOPDHours', { error: error.message, receptionistId });
            throw error;
        }
    }
};

module.exports = opdService;