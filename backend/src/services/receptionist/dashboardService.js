/**
 * ======================================================================
 * FILE: backend/src/services/receptionist/dashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist dashboard service - Provides comprehensive reception overview
 * including appointments, bed availability, patient registrations, OPD queue,
 * and walk-in status.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const dashboardService = {
    /**
     * Get main dashboard with all metrics
     * GET /api/v1/reception/dashboard
     */
    async getDashboard(receptionistId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Run all queries in parallel for performance
            const [
                todaySummary,
                bedSummary,
                patientStats,
                queueStatus,
                appointments,
                walkins,
                recentActivities
            ] = await Promise.all([
                this.getTodaySummary(receptionistId),
                this.getBedSummary(receptionistId),
                this.getPatientStats(receptionistId),
                this.getQueueStatus(receptionistId),
                this.getTodaysAppointmentsDetail(receptionistId),
                this.getTodaysWalkinsSummary(receptionistId),
                this.getRecentActivities(receptionistId)
            ]);

            return {
                timestamp: new Date().toISOString(),
                date: today,
                summary: todaySummary,
                beds: bedSummary,
                patients: patientStats,
                queue: queueStatus,
                appointments: {
                    list: appointments,
                    count: appointments.length,
                    by_status: this._groupAppointmentsByStatus(appointments)
                },
                walkins: {
                    list: walkins,
                    count: walkins.length,
                    waiting: walkins.filter(w => w.status === 'waiting').length
                },
                recent_activities: recentActivities,
                alerts: await this.getCriticalAlerts(receptionistId)
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get today's summary statistics
     * GET /api/v1/reception/dashboard/today
     */
    async getTodaySummary(receptionistId) {
        try {
            const query = `
                WITH appointment_stats AS (
                    SELECT 
                        COUNT(*) as total_appointments,
                        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
                        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
                        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                        COUNT(*) FILTER (WHERE status = 'no_show') as no_show
                    FROM appointments
                    WHERE appointment_date = CURRENT_DATE 
                        AND is_deleted = false
                ),
                registration_stats AS (
                    SELECT 
                        COUNT(*) as new_registrations,
                        COUNT(*) FILTER (WHERE referred_by = 'walkin') as walkin_registrations,
                        COUNT(*) FILTER (WHERE insurance_provider IS NOT NULL) as insured_patients
                    FROM patients
                    WHERE DATE(created_at) = CURRENT_DATE
                        AND is_deleted = false
                ),
                opd_stats AS (
                    SELECT 
                        COUNT(*) as total_opd,
                        COUNT(*) FILTER (WHERE status = 'waiting') as opd_waiting,
                        COUNT(*) FILTER (WHERE status = 'in_consultation') as opd_in_progress
                    FROM opd_registrations
                    WHERE DATE(created_at) = CURRENT_DATE
                ),
                walkin_stats AS (
                    SELECT 
                        COUNT(*) as total_walkins,
                        COUNT(*) FILTER (WHERE status = 'waiting') as walkins_waiting,
                        AVG(EXTRACT(EPOCH FROM (NOW() - registered_at))/60)::numeric(10,2) as avg_wait_time
                    FROM walkin_queue
                    WHERE DATE(created_at) = CURRENT_DATE
                )
                SELECT 
                    (SELECT * FROM appointment_stats) as appointments,
                    (SELECT * FROM registration_stats) as registrations,
                    (SELECT * FROM opd_stats) as opd,
                    (SELECT * FROM walkin_stats) as walkins
            `;

            const result = await db.query(query);
            
            const data = result.rows[0];
            return {
                appointments: data.appointments || {},
                registrations: data.registrations || {},
                opd: data.opd || {},
                walkins: data.walkins || {},
                checkins: await this._getTodayCheckins(),
                occupancy_rate: await this._getCurrentOccupancyRate()
            };
        } catch (error) {
            logger.error('Error in getTodaySummary', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get detailed today's appointments
     * GET /api/v1/reception/dashboard/today/appointments
     */
    async getTodaysAppointmentsDetail(receptionistId) {
        try {
            const query = `
                SELECT 
                    a.id,
                    a.appointment_time,
                    a.status,
                    a.type,
                    a.is_emergency,
                    a.check_in_time,
                    p.id as patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    e.id as doctor_id,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    e.specialization as doctor_specialization,
                    d.name as department_name,
                    CASE 
                        WHEN a.check_in_time IS NOT NULL THEN true
                        ELSE false
                    END as is_checked_in,
                    EXTRACT(EPOCH FROM (NOW() - a.check_in_time))/60 as minutes_since_checkin
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                JOIN employees e ON a.doctor_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE a.appointment_date = CURRENT_DATE
                    AND a.is_deleted = false
                ORDER BY 
                    CASE a.status
                        WHEN 'in_progress' THEN 1
                        WHEN 'confirmed' THEN 2
                        WHEN 'scheduled' THEN 3
                        ELSE 4
                    END,
                    a.appointment_time ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysAppointmentsDetail', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get today's registrations detail
     * GET /api/v1/reception/dashboard/today/registrations
     */
    async getTodaysRegistrationsDetail(receptionistId) {
        try {
            const query = `
                SELECT 
                    p.id,
                    p.first_name,
                    p.last_name,
                    p.phone,
                    p.email,
                    p.date_of_birth,
                    p.gender,
                    p.blood_group,
                    p.insurance_provider,
                    p.referred_by,
                    p.created_at as registration_time,
                    CONCAT(e.first_name, ' ', e.last_name) as registered_by
                FROM patients p
                LEFT JOIN employees e ON p.created_by = e.id
                WHERE DATE(p.created_at) = CURRENT_DATE
                    AND p.is_deleted = false
                ORDER BY p.created_at DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysRegistrationsDetail', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get today's OPD summary
     * GET /api/v1/reception/dashboard/today/opd
     */
    async getTodaysOPDSummary(receptionistId) {
        try {
            const query = `
                SELECT 
                    o.*,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
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
                    AND o.status IN ('waiting', 'called', 'in_consultation')
                ORDER BY queue_position
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysOPDSummary', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get today's walk-ins summary
     * GET /api/v1/reception/dashboard/today/walkins
     */
    async getTodaysWalkinsSummary(receptionistId) {
        try {
            const query = `
                SELECT 
                    w.*,
                    CASE 
                        WHEN w.patient_id IS NOT NULL THEN CONCAT(p.first_name, ' ', p.last_name)
                        ELSE NULL
                    END as patient_name,
                    d.name as department_name,
                    CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                    EXTRACT(EPOCH FROM (NOW() - w.registered_at))/60 as waiting_minutes
                FROM walkin_queue w
                LEFT JOIN patients p ON w.patient_id = p.id
                LEFT JOIN departments d ON w.preferred_department = d.id
                LEFT JOIN employees e ON w.preferred_doctor = e.id
                WHERE DATE(w.created_at) = CURRENT_DATE
                ORDER BY 
                    CASE w.status
                        WHEN 'waiting' THEN 1
                        WHEN 'called' THEN 2
                        WHEN 'in_progress' THEN 3
                        ELSE 4
                    END,
                    w.registered_at ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysWalkinsSummary', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get bed availability summary
     * GET /api/v1/reception/dashboard/beds
     */
    async getBedSummary(receptionistId) {
        try {
            const query = `
                WITH bed_stats AS (
                    SELECT 
                        COUNT(*) as total_beds,
                        COUNT(*) FILTER (WHERE status = 'available') as available,
                        COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                        COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                        COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service
                    FROM beds
                    WHERE is_deleted = false
                ),
                ward_wise AS (
                    SELECT 
                        ward,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'available') as available,
                        COUNT(*) FILTER (WHERE status = 'occupied') as occupied
                    FROM beds
                    WHERE is_deleted = false
                    GROUP BY ward
                ),
                type_wise AS (
                    SELECT 
                        type,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'available') as available
                    FROM beds
                    WHERE is_deleted = false
                    GROUP BY type
                )
                SELECT 
                    (SELECT * FROM bed_stats) as summary,
                    (SELECT json_agg(ward_wise.*) FROM ward_wise) as by_ward,
                    (SELECT json_agg(type_wise.*) FROM type_wise) as by_type
            `;

            const result = await db.query(query);
            
            const data = result.rows[0];
            const summary = data.summary || {};
            
            return {
                total: parseInt(summary.total_beds) || 0,
                available: parseInt(summary.available) || 0,
                occupied: parseInt(summary.occupied) || 0,
                cleaning: parseInt(summary.cleaning) || 0,
                maintenance: parseInt(summary.maintenance) || 0,
                out_of_service: parseInt(summary.out_of_service) || 0,
                occupancy_rate: summary.total_beds ? 
                    ((summary.occupied / summary.total_beds) * 100).toFixed(1) : 0,
                by_ward: data.by_ward || [],
                by_type: data.by_type || []
            };
        } catch (error) {
            logger.error('Error in getBedSummary', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get bed availability by ward
     * GET /api/v1/reception/dashboard/beds/ward-wise
     */
    async getBedAvailabilityByWard(receptionistId) {
        try {
            const query = `
                SELECT 
                    ward,
                    COUNT(*) as total_beds,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    (COUNT(*) FILTER (WHERE status = 'occupied')::float / COUNT(*) * 100)::numeric(5,2) as occupancy_rate,
                    json_agg(
                        json_build_object(
                            'bed_id', id,
                            'bed_number', bed_number,
                            'room_number', room_number,
                            'status', status,
                            'type', type
                        ) ORDER BY room_number, bed_number
                    ) FILTER (WHERE status = 'available') as available_beds
                FROM beds
                WHERE is_deleted = false
                GROUP BY ward
                ORDER BY ward
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getBedAvailabilityByWard', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get bed availability by type
     * GET /api/v1/reception/dashboard/beds/type-wise
     */
    async getBedAvailabilityByType(receptionistId) {
        try {
            const query = `
                SELECT 
                    type,
                    COUNT(*) as total_beds,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'available' AND next_cleaning < NOW()) as available_but_needs_cleaning,
                    json_agg(
                        json_build_object(
                            'bed_id', id,
                            'bed_number', bed_number,
                            'ward', ward,
                            'room_number', room_number,
                            'status', status
                        ) ORDER BY ward, room_number
                    ) FILTER (WHERE status = 'available') as available_beds
                FROM beds
                WHERE is_deleted = false
                GROUP BY type
                ORDER BY type
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getBedAvailabilityByType', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get beds needing cleaning
     * GET /api/v1/reception/dashboard/beds/cleaning-needed
     */
    async getBedsNeedingCleaning(receptionistId) {
        try {
            const query = `
                SELECT 
                    b.id,
                    b.bed_number,
                    b.room_number,
                    b.ward,
                    b.type,
                    b.status,
                    b.next_cleaning,
                    EXTRACT(EPOCH FROM (NOW() - b.next_cleaning))/3600 as hours_overdue,
                    CASE 
                        WHEN b.current_patient_id IS NOT NULL THEN 
                            CONCAT(p.first_name, ' ', p.last_name)
                        ELSE NULL
                    END as current_patient
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE b.next_cleaning < NOW() 
                    AND b.is_deleted = false
                ORDER BY b.next_cleaning ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getBedsNeedingCleaning', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get patient statistics
     * GET /api/v1/reception/dashboard/patients
     */
    async getPatientStats(receptionistId) {
        try {
            const query = `
                WITH stats AS (
                    SELECT 
                        COUNT(*) as total_patients,
                        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as new_today,
                        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
                        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_this_month,
                        COUNT(*) FILTER (WHERE gender = 'male') as male,
                        COUNT(*) FILTER (WHERE gender = 'female') as female,
                        COUNT(*) FILTER (WHERE blood_group IS NOT NULL) as blood_group_known,
                        COUNT(*) FILTER (WHERE insurance_provider IS NOT NULL) as insured,
                        AVG(EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)))::numeric(10,2) as avg_age
                    FROM patients
                    WHERE is_deleted = false
                ),
                age_groups AS (
                    SELECT 
                        CASE 
                            WHEN AGE(NOW(), date_of_birth) < INTERVAL '18 years' THEN '0-17'
                            WHEN AGE(NOW(), date_of_birth) < INTERVAL '30 years' THEN '18-29'
                            WHEN AGE(NOW(), date_of_birth) < INTERVAL '45 years' THEN '30-44'
                            WHEN AGE(NOW(), date_of_birth) < INTERVAL '60 years' THEN '45-59'
                            ELSE '60+'
                        END as age_group,
                        COUNT(*) as count
                    FROM patients
                    WHERE is_deleted = false
                    GROUP BY age_group
                )
                SELECT 
                    (SELECT * FROM stats) as summary,
                    (SELECT json_agg(age_groups.*) FROM age_groups) as age_distribution
            `;

            const result = await db.query(query);
            
            const data = result.rows[0];
            return {
                ...data.summary,
                age_distribution: data.age_distribution || []
            };
        } catch (error) {
            logger.error('Error in getPatientStats', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get patient demographics
     * GET /api/v1/reception/dashboard/patients/demographics
     */
    async getPatientDemographics(receptionistId) {
        try {
            const query = `
                SELECT 
                    COALESCE(city, 'Unknown') as city,
                    COUNT(*) as count,
                    COUNT(*) FILTER (WHERE gender = 'male') as male,
                    COUNT(*) FILTER (WHERE gender = 'female') as female,
                    AVG(EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)))::numeric(10,2) as avg_age
                FROM patients
                WHERE is_deleted = false
                GROUP BY city
                ORDER BY count DESC
                LIMIT 10
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPatientDemographics', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get patient registration trends
     * GET /api/v1/reception/dashboard/patients/trends
     */
    async getPatientTrends(receptionistId, days = 30) {
        try {
            const query = `
                WITH daily AS (
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as registrations,
                        COUNT(*) FILTER (WHERE referred_by = 'walkin') as walkins,
                        COUNT(*) FILTER (WHERE insurance_provider IS NOT NULL) as insured
                    FROM patients
                    WHERE created_at > NOW() - INTERVAL '${days} days'
                        AND is_deleted = false
                    GROUP BY DATE(created_at)
                )
                SELECT 
                    date,
                    registrations,
                    walkins,
                    insured,
                    SUM(registrations) OVER (ORDER BY date) as cumulative
                FROM daily
                ORDER BY date DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPatientTrends', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get appointment statistics
     * GET /api/v1/reception/dashboard/appointments
     */
    async getAppointmentStats(receptionistId) {
        try {
            const query = `
                WITH today AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                        COUNT(*) FILTER (WHERE status = 'no_show') as no_show
                    FROM appointments
                    WHERE appointment_date = CURRENT_DATE
                        AND is_deleted = false
                ),
                weekly AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed
                    FROM appointments
                    WHERE appointment_date BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
                        AND is_deleted = false
                ),
                by_doctor AS (
                    SELECT 
                        e.id as doctor_id,
                        CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                        e.specialization,
                        COUNT(a.id) as appointments,
                        COUNT(a.id) FILTER (WHERE a.status = 'completed') as completed
                    FROM employees e
                    LEFT JOIN appointments a ON e.id = a.doctor_id 
                        AND a.appointment_date = CURRENT_DATE
                        AND a.is_deleted = false
                    WHERE e.designation = 'Doctor' AND e.is_active = true
                    GROUP BY e.id
                    ORDER BY appointments DESC
                )
                SELECT 
                    (SELECT * FROM today) as today,
                    (SELECT * FROM weekly) as weekly,
                    (SELECT json_agg(by_doctor.*) FROM by_doctor) as by_doctor
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAppointmentStats', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get appointment trends
     * GET /api/v1/reception/dashboard/appointments/trends
     */
    async getAppointmentTrends(receptionistId, days = 30) {
        try {
            const query = `
                WITH daily AS (
                    SELECT 
                        DATE(appointment_date) as date,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                        COUNT(*) FILTER (WHERE status = 'no_show') as no_show
                    FROM appointments
                    WHERE appointment_date > NOW() - INTERVAL '${days} days'
                        AND is_deleted = false
                    GROUP BY DATE(appointment_date)
                )
                SELECT 
                    date,
                    total,
                    completed,
                    cancelled,
                    no_show,
                    (completed::float / NULLIF(total, 0) * 100)::numeric(5,2) as completion_rate
                FROM daily
                ORDER BY date DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getAppointmentTrends', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get doctor workload for today
     * GET /api/v1/reception/dashboard/appointments/doctor-workload
     */
    async getDoctorWorkload(receptionistId, date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                SELECT 
                    e.id as doctor_id,
                    CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                    e.specialization,
                    d.name as department_name,
                    COUNT(a.id) as total_appointments,
                    COUNT(a.id) FILTER (WHERE a.status IN ('scheduled', 'confirmed')) as scheduled,
                    COUNT(a.id) FILTER (WHERE a.status = 'in_progress') as in_progress,
                    COUNT(a.id) FILTER (WHERE a.status = 'completed') as completed,
                    COUNT(a.id) FILTER (WHERE a.is_emergency = true) as emergency,
                    MIN(a.appointment_time) as first_appointment,
                    MAX(a.appointment_time) as last_appointment,
                    CASE 
                        WHEN ds.max_patients_per_day IS NOT NULL THEN
                            (COUNT(a.id)::float / ds.max_patients_per_day * 100)::numeric(5,2)
                        ELSE NULL
                    END as workload_percentage
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                LEFT JOIN doctor_schedules ds ON e.id = ds.doctor_id 
                    AND ds.day = EXTRACT(DOW FROM DATE '${targetDate}')
                LEFT JOIN appointments a ON e.id = a.doctor_id 
                    AND a.appointment_date = '${targetDate}'
                    AND a.is_deleted = false
                WHERE e.designation = 'Doctor' AND e.is_active = true
                GROUP BY e.id, d.name, ds.max_patients_per_day
                ORDER BY total_appointments DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getDoctorWorkload', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get current queue status
     * GET /api/v1/reception/dashboard/queue
     */
    async getQueueStatus(receptionistId) {
        try {
            const [opdQueue, walkinQueue] = await Promise.all([
                this._getOPDQueueSummary(),
                this._getWalkinQueueSummary()
            ]);

            return {
                opd: opdQueue,
                walkins: walkinQueue,
                total_waiting: opdQueue.waiting + walkinQueue.waiting,
                estimated_wait_time: this._calculateEstimatedWaitTime(opdQueue, walkinQueue)
            };
        } catch (error) {
            logger.error('Error in getQueueStatus', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get department-wise queue
     * GET /api/v1/reception/dashboard/queue/by-department
     */
    async getQueueByDepartment(receptionistId) {
        try {
            const query = `
                SELECT 
                    d.id as department_id,
                    d.name as department_name,
                    COUNT(DISTINCT o.id) as opd_waiting,
                    COUNT(DISTINCT w.id) as walkins_waiting,
                    AVG(o.waiting_time) as avg_opd_wait_time,
                    AVG(w.waiting_time) as avg_walkin_wait_time
                FROM departments d
                LEFT JOIN (
                    SELECT department_id, id,
                        EXTRACT(EPOCH FROM (NOW() - registration_date))/60 as waiting_time
                    FROM opd_registrations
                    WHERE DATE(created_at) = CURRENT_DATE
                        AND status = 'waiting'
                ) o ON d.id = o.department_id
                LEFT JOIN (
                    SELECT preferred_department as department_id, id,
                        EXTRACT(EPOCH FROM (NOW() - registered_at))/60 as waiting_time
                    FROM walkin_queue
                    WHERE DATE(created_at) = CURRENT_DATE
                        AND status = 'waiting'
                ) w ON d.id = w.department_id
                GROUP BY d.id
                ORDER BY d.name
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getQueueByDepartment', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get estimated wait times
     * GET /api/v1/reception/dashboard/queue/wait-times
     */
    async getEstimatedWaitTimes(receptionistId) {
        try {
            const query = `
                WITH opd_avg AS (
                    SELECT 
                        AVG(EXTRACT(EPOCH FROM (consultation_started_at - registration_date))/60)::numeric(10,2) as avg_time
                    FROM opd_registrations
                    WHERE consultation_started_at IS NOT NULL
                        AND DATE(created_at) = CURRENT_DATE
                ),
                walkin_avg AS (
                    SELECT 
                        AVG(EXTRACT(EPOCH FROM (started_at - registered_at))/60)::numeric(10,2) as avg_time
                    FROM walkin_queue
                    WHERE started_at IS NOT NULL
                        AND DATE(created_at) = CURRENT_DATE
                )
                SELECT 
                    (SELECT * FROM opd_avg) as opd,
                    (SELECT * FROM walkin_avg) as walkin
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getEstimatedWaitTimes', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get performance metrics
     * GET /api/v1/reception/dashboard/performance
     */
    async getPerformanceMetrics(receptionistId, period = 'day') {
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
                    interval = "INTERVAL '1 day'";
            }

            const query = `
                SELECT 
                    COUNT(DISTINCT p.id) as patients_registered,
                    COUNT(DISTINCT a.id) as appointments_booked,
                    COUNT(DISTINCT w.id) as walkins_registered,
                    COUNT(DISTINCT o.id) as opd_registered,
                    AVG(EXTRACT(EPOCH FROM (a.check_in_time - a.created_at))/60)::numeric(10,2) as avg_checkin_time,
                    COUNT(DISTINCT CASE WHEN a.check_in_time IS NOT NULL THEN a.id END) as checkins_done
                FROM (
                    SELECT id, created_at
                    FROM patients
                    WHERE created_at > NOW() - ${interval}
                ) p
                CROSS JOIN (
                    SELECT id, created_at, check_in_time
                    FROM appointments
                    WHERE created_at > NOW() - ${interval}
                ) a
                CROSS JOIN (
                    SELECT id
                    FROM walkin_queue
                    WHERE created_at > NOW() - ${interval}
                ) w
                CROSS JOIN (
                    SELECT id
                    FROM opd_registrations
                    WHERE created_at > NOW() - ${interval}
                ) o
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPerformanceMetrics', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get registration efficiency
     * GET /api/v1/reception/dashboard/performance/registration
     */
    async getRegistrationEfficiency(receptionistId, days = 30) {
        try {
            const query = `
                SELECT 
                    DATE(p.created_at) as date,
                    COUNT(p.id) as registrations,
                    AVG(EXTRACT(EPOCH FROM (p.created_at - p.created_at)))/60 as avg_time
                FROM patients p
                WHERE p.created_at > NOW() - INTERVAL '${days} days'
                GROUP BY DATE(p.created_at)
                ORDER BY date DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getRegistrationEfficiency', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get check-in/out efficiency
     * GET /api/v1/reception/dashboard/performance/checkin
     */
    async getCheckinEfficiency(receptionistId, days = 30) {
        try {
            const query = `
                SELECT 
                    DATE(appointment_date) as date,
                    COUNT(*) as total_appointments,
                    COUNT(*) FILTER (WHERE check_in_time IS NOT NULL) as checked_in,
                    COUNT(*) FILTER (WHERE check_out_time IS NOT NULL) as checked_out,
                    AVG(EXTRACT(EPOCH FROM (check_in_time - appointment_time::time))/60)::numeric(10,2) as avg_checkin_time,
                    AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/60)::numeric(10,2) as avg_visit_duration
                FROM appointments
                WHERE appointment_date > NOW() - INTERVAL '${days} days'
                GROUP BY DATE(appointment_date)
                ORDER BY date DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCheckinEfficiency', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get notifications
     * GET /api/v1/reception/dashboard/notifications
     */
    async getNotifications(receptionistId, options = {}) {
        try {
            const { page = 1, limit = 20, unread_only = false } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT *
                FROM reception_notifications
                WHERE user_id = $1
            `;
            const values = [receptionistId];
            let paramIndex = 2;

            if (unread_only) {
                query += ` AND is_read = false`;
            }

            query += ` ORDER BY created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const unreadCountQuery = `
                SELECT COUNT(*) as unread_count
                FROM reception_notifications
                WHERE user_id = $1 AND is_read = false
            `;
            const unreadCount = await db.query(unreadCountQuery, [receptionistId]);

            return {
                data: result.rows,
                unread_count: parseInt(unreadCount.rows[0].unread_count),
                pagination: {
                    page,
                    limit,
                    total: result.rows.length // This should be actual count
                }
            };
        } catch (error) {
            logger.error('Error in getNotifications', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Mark notification as read
     * PUT /api/v1/reception/dashboard/notifications/:id/read
     */
    async markNotificationRead(receptionistId, notificationId) {
        try {
            const query = `
                UPDATE reception_notifications
                SET is_read = true,
                    read_at = NOW()
                WHERE id = $1 AND user_id = $2
                RETURNING *
            `;

            const result = await db.query(query, [notificationId, receptionistId]);

            if (result.rows.length === 0) {
                throw new Error('Notification not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in markNotificationRead', { error: error.message, receptionistId, notificationId });
            throw error;
        }
    },

    /**
     * Mark all notifications as read
     * PUT /api/v1/reception/dashboard/notifications/read-all
     */
    async markAllNotificationsRead(receptionistId) {
        try {
            const query = `
                UPDATE reception_notifications
                SET is_read = true,
                    read_at = NOW()
                WHERE user_id = $1 AND is_read = false
                RETURNING id
            `;

            const result = await db.query(query, [receptionistId]);
            return result.rowCount;
        } catch (error) {
            logger.error('Error in markAllNotificationsRead', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get critical alerts
     * GET /api/v1/reception/dashboard/alerts
     */
    async getCriticalAlerts(receptionistId) {
        try {
            const query = `
                -- Low bed availability alerts
                SELECT 
                    'bed_availability' as type,
                    ward,
                    COUNT(*) as available_beds,
                    CASE 
                        WHEN COUNT(*) = 0 THEN 'critical'
                        WHEN COUNT(*) <= 2 THEN 'high'
                        WHEN COUNT(*) <= 5 THEN 'medium'
                        ELSE 'low'
                    END as severity,
                    CONCAT('Only ', COUNT(*), ' beds available in ', ward, ' ward') as message,
                    NOW() as timestamp
                FROM beds
                WHERE status = 'available' AND is_deleted = false
                GROUP BY ward
                HAVING COUNT(*) <= 5
                
                UNION ALL
                
                -- Overdue cleaning alerts
                SELECT 
                    'cleaning_due' as type,
                    ward,
                    COUNT(*) as count,
                    CASE 
                        WHEN COUNT(*) >= 3 THEN 'high'
                        ELSE 'medium'
                    END as severity,
                    CONCAT(COUNT(*), ' beds need cleaning in ', ward, ' ward') as message,
                    NOW() as timestamp
                FROM beds
                WHERE next_cleaning < NOW() AND is_deleted = false
                GROUP BY ward
                
                UNION ALL
                
                -- Long waiting patients (OPD)
                SELECT 
                    'patient_waiting' as type,
                    'OPD' as ward,
                    COUNT(*) as count,
                    CASE 
                        WHEN MAX(EXTRACT(EPOCH FROM (NOW() - registration_date))/60) > 60 THEN 'high'
                        WHEN MAX(EXTRACT(EPOCH FROM (NOW() - registration_date))/60) > 30 THEN 'medium'
                        ELSE 'low'
                    END as severity,
                    CONCAT(COUNT(*), ' patients waiting >30min in OPD') as message,
                    NOW() as timestamp
                FROM opd_registrations
                WHERE DATE(created_at) = CURRENT_DATE 
                    AND status = 'waiting'
                    AND EXTRACT(EPOCH FROM (NOW() - registration_date))/60 > 30
                
                UNION ALL
                
                -- Long waiting walk-ins
                SELECT 
                    'walkin_waiting' as type,
                    'Reception' as ward,
                    COUNT(*) as count,
                    CASE 
                        WHEN MAX(EXTRACT(EPOCH FROM (NOW() - registered_at))/60) > 45 THEN 'high'
                        WHEN MAX(EXTRACT(EPOCH FROM (NOW() - registered_at))/60) > 20 THEN 'medium'
                        ELSE 'low'
                    END as severity,
                    CONCAT(COUNT(*), ' walk-ins waiting >20min') as message,
                    NOW() as timestamp
                FROM walkin_queue
                WHERE DATE(created_at) = CURRENT_DATE 
                    AND status = 'waiting'
                    AND EXTRACT(EPOCH FROM (NOW() - registered_at))/60 > 20
                    
                ORDER BY 
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        ELSE 4
                    END
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCriticalAlerts', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get recent activities for dashboard
     * @private
     */
    async getRecentActivities(receptionistId) {
        try {
            const query = `
                (SELECT 
                    'appointment' as type,
                    a.id as reference_id,
                    CONCAT('Appointment booked for ', p.first_name, ' ', p.last_name) as description,
                    a.created_at as timestamp
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.created_at > NOW() - INTERVAL '24 hours'
                ORDER BY a.created_at DESC
                LIMIT 5)
                
                UNION ALL
                
                (SELECT 
                    'registration' as type,
                    p.id as reference_id,
                    CONCAT('New patient registered: ', p.first_name, ' ', p.last_name) as description,
                    p.created_at as timestamp
                FROM patients p
                WHERE p.created_at > NOW() - INTERVAL '24 hours'
                ORDER BY p.created_at DESC
                LIMIT 5)
                
                UNION ALL
                
                (SELECT 
                    'walkin' as type,
                    w.id as reference_id,
                    CONCAT('Walk-in registered: ', w.name) as description,
                    w.created_at as timestamp
                FROM walkin_queue w
                WHERE w.created_at > NOW() - INTERVAL '24 hours'
                ORDER BY w.created_at DESC
                LIMIT 5)
                
                UNION ALL
                
                (SELECT 
                    'checkin' as type,
                    a.id as reference_id,
                    CONCAT('Patient checked in: ', p.first_name, ' ', p.last_name) as description,
                    a.check_in_time as timestamp
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.check_in_time > NOW() - INTERVAL '24 hours'
                ORDER BY a.check_in_time DESC
                LIMIT 5)
                
                ORDER BY timestamp DESC
                LIMIT 15
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getRecentActivities', { error: error.message, receptionistId });
            return [];
        }
    },

    /**
     * Export dashboard data
     * GET /api/v1/reception/dashboard/export
     */
    async exportDashboard(receptionistId, format, sections) {
        try {
            const data = {};
            
            if (sections.includes('all') || sections.includes('summary')) {
                data.summary = await this.getTodaySummary(receptionistId);
            }
            if (sections.includes('all') || sections.includes('beds')) {
                data.beds = await this.getBedSummary(receptionistId);
            }
            if (sections.includes('all') || sections.includes('patients')) {
                data.patients = await this.getPatientStats(receptionistId);
            }
            if (sections.includes('all') || sections.includes('queue')) {
                data.queue = await this.getQueueStatus(receptionistId);
            }
            if (sections.includes('all') || sections.includes('appointments')) {
                data.appointments = await this.getTodaysAppointmentsDetail(receptionistId);
            }

            if (format === 'json') {
                return data;
            }

            // For CSV/PDF, convert to appropriate format
            return this._convertToExportFormat(data, format);
        } catch (error) {
            logger.error('Error in exportDashboard', { error: error.message, receptionistId });
            throw error;
        }
    },

    // ============================================
    // PRIVATE HELPER METHODS
    // ============================================

    /**
     * Get today's check-ins count
     * @private
     */
    async _getTodayCheckins() {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM appointments
                WHERE appointment_date = CURRENT_DATE
                    AND check_in_time IS NOT NULL
            `;
            const result = await db.query(query);
            return parseInt(result.rows[0].count);
        } catch (error) {
            logger.error('Error in _getTodayCheckins', { error: error.message });
            return 0;
        }
    },

    /**
     * Get current occupancy rate
     * @private
     */
    async _getCurrentOccupancyRate() {
        try {
            const query = `
                SELECT 
                    (COUNT(*) FILTER (WHERE status = 'occupied')::float / COUNT(*) * 100)::numeric(5,2) as rate
                FROM beds
                WHERE is_deleted = false
            `;
            const result = await db.query(query);
            return result.rows[0]?.rate || 0;
        } catch (error) {
            logger.error('Error in _getCurrentOccupancyRate', { error: error.message });
            return 0;
        }
    },

    /**
     * Get OPD queue summary
     * @private
     */
    async _getOPDQueueSummary() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as waiting,
                    COUNT(*) FILTER (WHERE priority = 'emergency') as emergency,
                    COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
                    AVG(EXTRACT(EPOCH FROM (NOW() - registration_date))/60)::numeric(10,2) as avg_wait_time
                FROM opd_registrations
                WHERE DATE(created_at) = CURRENT_DATE
                    AND status = 'waiting'
            `;
            const result = await db.query(query);
            return result.rows[0] || { waiting: 0, avg_wait_time: 0 };
        } catch (error) {
            logger.error('Error in _getOPDQueueSummary', { error: error.message });
            return { waiting: 0, avg_wait_time: 0 };
        }
    },

    /**
     * Get walk-in queue summary
     * @private
     */
    async _getWalkinQueueSummary() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as waiting,
                    AVG(EXTRACT(EPOCH FROM (NOW() - registered_at))/60)::numeric(10,2) as avg_wait_time
                FROM walkin_queue
                WHERE DATE(created_at) = CURRENT_DATE
                    AND status = 'waiting'
            `;
            const result = await db.query(query);
            return result.rows[0] || { waiting: 0, avg_wait_time: 0 };
        } catch (error) {
            logger.error('Error in _getWalkinQueueSummary', { error: error.message });
            return { waiting: 0, avg_wait_time: 0 };
        }
    },

    /**
     * Group appointments by status
     * @private
     */
    _groupAppointmentsByStatus(appointments) {
        const groups = {
            scheduled: 0,
            confirmed: 0,
            in_progress: 0,
            completed: 0,
            cancelled: 0,
            no_show: 0
        };

        appointments.forEach(apt => {
            if (groups.hasOwnProperty(apt.status)) {
                groups[apt.status]++;
            }
        });

        return groups;
    },

    /**
     * Calculate estimated wait time
     * @private
     */
    _calculateEstimatedWaitTime(opdQueue, walkinQueue) {
        const avgConsultationTime = 15; // minutes per patient
        const totalWaiting = (opdQueue.waiting || 0) + (walkinQueue.waiting || 0);
        
        if (totalWaiting === 0) return 0;
        
        // Assume 3 doctors are available concurrently
        const concurrentDoctors = 3;
        return Math.ceil((totalWaiting * avgConsultationTime) / concurrentDoctors);
    },

    /**
     * Convert data to export format
     * @private
     */
    _convertToExportFormat(data, format) {
        if (format === 'csv') {
            // Convert to CSV string
            let csv = '';
            for (const [key, value] of Object.entries(data)) {
                if (Array.isArray(value)) {
                    csv += `${key}\n`;
                    if (value.length > 0) {
                        csv += Object.keys(value[0]).join(',') + '\n';
                        value.forEach(row => {
                            csv += Object.values(row).join(',') + '\n';
                        });
                    }
                }
            }
            return csv;
        }
        
        // For PDF, would generate PDF buffer
        return data;
    }
};

module.exports = dashboardService;