/**
 * ======================================================================
 * FILE: backend/src/services/dashboard/receptionDashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Reception dashboard service - Handles business logic for reception dashboard.
 * Provides real-time appointment tracking, patient registration, and bed availability.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-01] Patient email must be unique
 * - [BR-02] Patient phone must be unique
 * - [BR-03] Emergency contact required
 * - [BR-04] Min age 0, Max age 150
 * - [BR-07] Cannot book appointment in past
 * - [BR-08] Max 30 appointments per doctor per day
 * - [BR-09] Appointment duration default 30 minutes
 * - [BR-10] Cancellation allowed up to 2 hours before
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * 
 * ENDPOINTS SUPPORTED:
 * - GET /api/v1/dashboard/reception - Main dashboard
 * - GET /api/v1/dashboard/reception/appointments - Today's appointments
 * - GET /api/v1/dashboard/reception/beds - Bed availability
 * - GET /api/v1/dashboard/reception/patients - New patients
 * - GET /api/v1/dashboard/reception/walk-in - Walk-in statistics
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const receptionDashboardService = {
    /**
     * Get reception main dashboard
     * GET /api/v1/dashboard/reception
     */
    async getDashboard(receptionistId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [
                todayAppointments,
                bedAvailability,
                newPatients,
                walkinStats,
                departmentQueue,
                opdStats
            ] = await Promise.all([
                this.getTodayAppointments(receptionistId),
                this.getBedAvailability(receptionistId),
                this.getNewPatients(receptionistId, { days: 7, page: 1, limit: 5 }),
                this.getWalkinStats(receptionistId, { period: 'day' }),
                this.getDepartmentQueue(receptionistId),
                this.getOPDStats(receptionistId, { from_date: thirtyDaysAgo, to_date: today })
            ]);

            return {
                today_appointments: todayAppointments,
                bed_availability: bedAvailability,
                new_patients: newPatients,
                walkin_stats: walkinStats,
                department_queue: departmentQueue,
                opd_stats: opdStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get today's appointments
     * GET /api/v1/dashboard/reception/appointments
     */
    async getTodayAppointments(receptionistId) {
        try {
            const query = `
                WITH today_appointments AS (
                    SELECT 
                        a.id,
                        a.appointment_number,
                        a.appointment_time,
                        a.duration_minutes,
                        a.status,
                        a.type,
                        a.reason,
                        a.is_emergency,
                        a.check_in_time,
                        a.queue_number,
                        p.id as patient_id,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        p.phone as patient_phone,
                        p.date_of_birth as patient_dob,
                        p.gender as patient_gender,
                        e.id as doctor_id,
                        e.first_name as doctor_first_name,
                        e.last_name as doctor_last_name,
                        e.specialization,
                        CASE 
                            WHEN a.check_in_time IS NOT NULL AND a.status = 'checked_in' THEN 'checked_in'
                            WHEN a.status = 'in_progress' THEN 'in_progress'
                            WHEN a.status = 'completed' THEN 'completed'
                            WHEN a.status = 'cancelled' THEN 'cancelled'
                            WHEN a.appointment_time < NOW()::time AND a.status NOT IN ('completed', 'cancelled') THEN 'missed'
                            ELSE 'waiting'
                        END as current_status,
                        EXTRACT(EPOCH FROM (NOW() - a.check_in_time))/60 as waiting_minutes
                    FROM appointments a
                    JOIN patients p ON a.patient_id = p.id
                    JOIN employees e ON a.doctor_id = e.id
                    WHERE a.appointment_date = CURRENT_DATE
                        AND a.is_deleted = false
                    ORDER BY 
                        CASE 
                            WHEN a.is_emergency = true THEN 1
                            WHEN a.queue_number IS NOT NULL THEN 2
                            ELSE 3
                        END,
                        a.appointment_time ASC,
                        a.queue_number ASC
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
                        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
                        COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
                        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                        COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
                        COUNT(*) FILTER (WHERE is_emergency = true) as emergency,
                        COUNT(*) FILTER (WHERE current_status = 'waiting') as waiting,
                        COUNT(*) FILTER (WHERE current_status = 'missed') as missed,
                        AVG(waiting_minutes) FILTER (WHERE waiting_minutes > 0) as avg_waiting_minutes
                    FROM today_appointments
                )
                SELECT 
                    (SELECT json_agg(today_appointments.*) FROM today_appointments) as appointments,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query);
            
            return {
                appointments: result.rows[0]?.appointments || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    scheduled: 0,
                    confirmed: 0,
                    checked_in: 0,
                    in_progress: 0,
                    completed: 0,
                    cancelled: 0,
                    no_show: 0,
                    emergency: 0,
                    waiting: 0,
                    missed: 0,
                    avg_waiting_minutes: 0
                }
            };
        } catch (error) {
            logger.error('Error in getTodayAppointments', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get bed availability
     * GET /api/v1/dashboard/reception/beds
     * 
     * BUSINESS RULES: [BR-24], [BR-25]
     */
    async getBedAvailability(receptionistId) {
        try {
            const query = `
                WITH bed_stats AS (
                    SELECT 
                        b.id,
                        b.bed_number,
                        b.ward,
                        b.room_number,
                        b.floor,
                        b.type,
                        b.status,
                        b.capacity,
                        b.has_ventilator,
                        b.has_cardiac_monitor,
                        b.has_oxygen_supply,
                        b.last_cleaned,
                        b.cleaning_status,
                        p.id as patient_id,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        CASE 
                            WHEN b.status = 'occupied' AND b.type = 'icu' THEN 'ICU_occupied'
                            WHEN b.status = 'available' AND b.type = 'icu' THEN 'ICU_available'
                            WHEN b.status = 'cleaning' THEN 'cleaning_in_progress'
                            WHEN b.status = 'maintenance' THEN 'under_maintenance'
                            WHEN b.status = 'available' AND b.cleaning_status = 'dirty' THEN 'needs_cleaning'
                            ELSE b.status
                        END as display_status
                    FROM beds b
                    LEFT JOIN admissions a ON b.id = a.bed_id AND a.discharge_date IS NULL
                    LEFT JOIN patients p ON a.patient_id = p.id
                    WHERE b.is_deleted = false
                    ORDER BY b.ward, b.room_number, b.bed_number
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total_beds,
                        COUNT(*) FILTER (WHERE status = 'available') as available,
                        COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                        COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                        COUNT(*) FILTER (WHERE type = 'icu') as icu_total,
                        COUNT(*) FILTER (WHERE type = 'icu' AND status = 'available') as icu_available,
                        COUNT(*) FILTER (WHERE type = 'general') as general_total,
                        COUNT(*) FILTER (WHERE type = 'general' AND status = 'available') as general_available,
                        COUNT(*) FILTER (WHERE type = 'emergency') as emergency_total,
                        COUNT(*) FILTER (WHERE type = 'emergency' AND status = 'available') as emergency_available,
                        COUNT(*) FILTER (WHERE type = 'isolation') as isolation_total,
                        COUNT(*) FILTER (WHERE type = 'isolation' AND status = 'available') as isolation_available,
                        ROUND(COUNT(*) FILTER (WHERE status = 'occupied')::float / NULLIF(COUNT(*), 0) * 100, 2) as occupancy_rate
                    FROM bed_stats
                ),
                by_ward AS (
                    SELECT 
                        ward,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'available') as available,
                        COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                        ROUND(COUNT(*) FILTER (WHERE status = 'occupied')::float / NULLIF(COUNT(*), 0) * 100, 2) as occupancy_rate
                    FROM bed_stats
                    GROUP BY ward
                    ORDER BY occupancy_rate DESC
                ),
                by_type AS (
                    SELECT 
                        type,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'available') as available,
                        COUNT(*) FILTER (WHERE status = 'occupied') as occupied
                    FROM bed_stats
                    GROUP BY type
                    ORDER BY type
                )
                SELECT 
                    (SELECT row_to_json(summary.*) FROM summary) as summary,
                    (SELECT json_agg(by_ward.*) FROM by_ward) as by_ward,
                    (SELECT json_agg(by_type.*) FROM by_type) as by_type,
                    (SELECT json_agg(bed_stats.*) FROM bed_stats LIMIT 20) as recent_beds
            `;

            const result = await db.query(query);
            
            return {
                summary: result.rows[0]?.summary || {
                    total_beds: 0,
                    available: 0,
                    occupied: 0,
                    cleaning: 0,
                    maintenance: 0,
                    icu_total: 0,
                    icu_available: 0,
                    general_total: 0,
                    general_available: 0,
                    emergency_total: 0,
                    emergency_available: 0,
                    isolation_total: 0,
                    isolation_available: 0,
                    occupancy_rate: 0
                },
                by_ward: result.rows[0]?.by_ward || [],
                by_type: result.rows[0]?.by_type || [],
                recent_beds: result.rows[0]?.recent_beds || []
            };
        } catch (error) {
            logger.error('Error in getBedAvailability', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get new patients
     * GET /api/v1/dashboard/reception/patients
     * 
     * BUSINESS RULES: [BR-01], [BR-02], [BR-03], [BR-04]
     */
    async getNewPatients(receptionistId, options = {}) {
        try {
            const { days = 7, page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                WITH new_patients AS (
                    SELECT 
                        p.id,
                        p.first_name,
                        p.last_name,
                        p.date_of_birth,
                        p.gender,
                        p.phone,
                        p.email,
                        p.address,
                        p.emergency_contact_name,
                        p.emergency_contact_phone,
                        p.emergency_contact_relation,
                        p.registration_date,
                        p.referred_by,
                        p.insurance_provider,
                        p.insurance_policy,
                        p.consent_form_signed,
                        EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth)) as age,
                        (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = p.id) as total_appointments
                    FROM patients p
                    WHERE p.registration_date >= CURRENT_DATE - INTERVAL '${days} days'
                        AND p.is_deleted = false
                    ORDER BY p.registration_date DESC
                    LIMIT $1 OFFSET $2
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE gender = 'male') as male,
                        COUNT(*) FILTER (WHERE gender = 'female') as female,
                        COUNT(*) FILTER (WHERE age < 18) as minors,
                        COUNT(*) FILTER (WHERE age >= 60) as seniors,
                        COUNT(*) FILTER (WHERE insurance_provider IS NOT NULL) as insured,
                        COUNT(*) FILTER (WHERE emergency_contact_name IS NOT NULL) as has_emergency_contact,
                        AVG(age) as avg_age,
                        MIN(registration_date) as earliest,
                        MAX(registration_date) as latest
                    FROM new_patients
                ),
                daily_trend AS (
                    SELECT 
                        DATE(registration_date) as reg_date,
                        COUNT(*) as count
                    FROM patients
                    WHERE registration_date >= CURRENT_DATE - INTERVAL '${days} days'
                        AND is_deleted = false
                    GROUP BY DATE(registration_date)
                    ORDER BY reg_date DESC
                )
                SELECT 
                    (SELECT json_agg(new_patients.*) FROM new_patients) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary,
                    (SELECT json_agg(daily_trend.*) FROM daily_trend) as daily_trend
            `;

            const result = await db.query(query, [limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    male: 0,
                    female: 0,
                    minors: 0,
                    seniors: 0,
                    insured: 0,
                    has_emergency_contact: 0,
                    avg_age: 0,
                    earliest: null,
                    latest: null
                },
                daily_trend: result.rows[0]?.daily_trend || [],
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getNewPatients', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get walk-in statistics
     * GET /api/v1/dashboard/reception/walk-in
     */
    async getWalkinStats(receptionistId, options = {}) {
        try {
            const { period = 'day' } = options;

            let periodFilter = '';
            if (period === 'day') {
                periodFilter = `AND visit_date = CURRENT_DATE`;
            } else if (period === 'week') {
                periodFilter = `AND visit_date >= CURRENT_DATE - INTERVAL '7 days'`;
            } else if (period === 'month') {
                periodFilter = `AND visit_date >= CURRENT_DATE - INTERVAL '30 days'`;
            }

            const query = `
                WITH walkin_data AS (
                    SELECT 
                        w.id,
                        w.visitor_name,
                        w.phone,
                        w.purpose,
                        w.department_to_visit,
                        w.person_to_meet,
                        w.check_in_time,
                        w.check_out_time,
                        w.status,
                        w.waiting_number,
                        w.assigned_doctor_id,
                        e.first_name as doctor_first_name,
                        e.last_name as doctor_last_name,
                        CASE 
                            WHEN w.check_in_time IS NOT NULL AND w.check_out_time IS NULL THEN 'waiting'
                            WHEN w.check_out_time IS NOT NULL THEN 'completed'
                            WHEN w.status = 'cancelled' THEN 'cancelled'
                            ELSE 'registered'
                        END as current_status,
                        EXTRACT(EPOCH FROM (NOW() - w.check_in_time))/60 as waiting_minutes
                    FROM walkin_visits w
                    LEFT JOIN employees e ON w.assigned_doctor_id = e.id
                    WHERE w.is_deleted = false
                        ${periodFilter}
                    ORDER BY w.check_in_time DESC
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE current_status = 'waiting') as waiting,
                        COUNT(*) FILTER (WHERE current_status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE current_status = 'cancelled') as cancelled,
                        COUNT(*) FILTER (WHERE purpose = 'consultation') as consultation,
                        COUNT(*) FILTER (WHERE purpose = 'emergency') as emergency,
                        COUNT(*) FILTER (WHERE purpose = 'followup') as followup,
                        AVG(waiting_minutes) FILTER (WHERE waiting_minutes > 0) as avg_waiting_minutes
                    FROM walkin_data
                ),
                hourly_breakdown AS (
                    SELECT 
                        EXTRACT(HOUR FROM check_in_time) as hour,
                        COUNT(*) as count
                    FROM walkin_visits
                    WHERE check_in_time IS NOT NULL
                        AND is_deleted = false
                        ${periodFilter}
                    GROUP BY EXTRACT(HOUR FROM check_in_time)
                    ORDER BY hour
                )
                SELECT 
                    (SELECT row_to_json(summary.*) FROM summary) as summary,
                    (SELECT json_agg(hourly_breakdown.*) FROM hourly_breakdown) as hourly_breakdown,
                    (SELECT json_agg(walkin_data.*) FROM walkin_data LIMIT 20) as recent_walkins
            `;

            const result = await db.query(query);
            
            return {
                summary: result.rows[0]?.summary || {
                    total: 0,
                    waiting: 0,
                    completed: 0,
                    cancelled: 0,
                    consultation: 0,
                    emergency: 0,
                    followup: 0,
                    avg_waiting_minutes: 0
                },
                hourly_breakdown: result.rows[0]?.hourly_breakdown || [],
                recent_walkins: result.rows[0]?.recent_walkins || []
            };
        } catch (error) {
            logger.error('Error in getWalkinStats', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get department queue
     * GET /api/v1/dashboard/reception/department-queue
     */
    async getDepartmentQueue(receptionistId) {
        try {
            const query = `
                WITH department_queue AS (
                    SELECT 
                        d.id as department_id,
                        d.name as department_name,
                        d.code,
                        COUNT(DISTINCT a.id) as total_appointments,
                        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'scheduled') as scheduled,
                        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'confirmed') as confirmed,
                        COUNT(DISTINCT a.id) FILTER (WHERE a.check_in_time IS NOT NULL AND a.status != 'completed') as waiting,
                        COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'in_progress') as in_progress,
                        COUNT(DISTINCT e.id) as doctors_count,
                        COUNT(DISTINCT e.id) FILTER (WHERE e.is_available = true) as available_doctors,
                        AVG(a.duration_minutes) as avg_consultation_time
                    FROM departments d
                    LEFT JOIN employees e ON d.id = e.department_id AND e.role = 'doctor'
                    LEFT JOIN appointments a ON e.id = a.doctor_id 
                        AND a.appointment_date = CURRENT_DATE
                        AND a.is_deleted = false
                    WHERE d.is_deleted = false
                    GROUP BY d.id, d.name, d.code
                    HAVING COUNT(DISTINCT a.id) > 0 OR COUNT(DISTINCT e.id) > 0
                    ORDER BY waiting DESC, total_appointments DESC
                )
                SELECT 
                    json_agg(department_queue.*) as departments,
                    (SELECT 
                        json_build_object(
                            'total_waiting', SUM(waiting),
                            'total_doctors', SUM(doctors_count),
                            'available_doctors', SUM(available_doctors),
                            'avg_waiting_per_doctor', ROUND(SUM(waiting)::float / NULLIF(SUM(available_doctors), 0), 2)
                        )
                    FROM department_queue) as summary
                FROM department_queue
            `;

            const result = await db.query(query);
            
            return {
                departments: result.rows[0]?.departments || [],
                summary: result.rows[0]?.summary || {
                    total_waiting: 0,
                    total_doctors: 0,
                    available_doctors: 0,
                    avg_waiting_per_doctor: 0
                }
            };
        } catch (error) {
            logger.error('Error in getDepartmentQueue', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get OPD statistics
     * GET /api/v1/dashboard/reception/opd-stats
     */
    async getOPDStats(receptionistId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND visit_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND visit_date >= CURRENT_DATE - INTERVAL '30 days'`;
            }

            const query = `
                WITH opd_data AS (
                    SELECT 
                        o.id,
                        o.visit_date,
                        o.token_number,
                        o.department_id,
                        o.doctor_id,
                        o.consultation_type,
                        o.fees,
                        o.payment_status,
                        o.status,
                        d.name as department_name,
                        e.first_name as doctor_first_name,
                        e.last_name as doctor_last_name,
                        p.id as patient_id,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name
                    FROM opd_visits o
                    LEFT JOIN departments d ON o.department_id = d.id
                    LEFT JOIN employees e ON o.doctor_id = e.id
                    LEFT JOIN patients p ON o.patient_id = p.id
                    WHERE o.is_deleted = false
                        ${dateFilter}
                    ORDER BY o.visit_date DESC, o.token_number ASC
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total_visits,
                        COUNT(*) FILTER (WHERE payment_status = 'paid') as paid,
                        COUNT(*) FILTER (WHERE payment_status = 'pending') as pending,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                        COUNT(*) FILTER (WHERE consultation_type = 'new') as new_patients,
                        COUNT(*) FILTER (WHERE consultation_type = 'followup') as followup,
                        SUM(fees) as total_fees,
                        AVG(fees) as avg_fee
                    FROM opd_data
                ),
                daily_breakdown AS (
                    SELECT 
                        visit_date,
                        COUNT(*) as count,
                        SUM(fees) as total_fees
                    FROM opd_visits
                    WHERE is_deleted = false
                        ${dateFilter}
                    GROUP BY visit_date
                    ORDER BY visit_date DESC
                    LIMIT 10
                )
                SELECT 
                    (SELECT row_to_json(summary.*) FROM summary) as summary,
                    (SELECT json_agg(daily_breakdown.*) FROM daily_breakdown) as daily_breakdown,
                    (SELECT json_agg(opd_data.*) FROM opd_data LIMIT 20) as recent_visits
            `;

            const result = await db.query(query);
            
            return {
                summary: result.rows[0]?.summary || {
                    total_visits: 0,
                    paid: 0,
                    pending: 0,
                    completed: 0,
                    in_progress: 0,
                    new_patients: 0,
                    followup: 0,
                    total_fees: 0,
                    avg_fee: 0
                },
                daily_breakdown: result.rows[0]?.daily_breakdown || [],
                recent_visits: result.rows[0]?.recent_visits || []
            };
        } catch (error) {
            logger.error('Error in getOPDStats', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get doctor availability today
     * GET /api/v1/dashboard/reception/doctor-availability
     */
    async getDoctorAvailability(receptionistId) {
        try {
            const query = `
                WITH doctor_availability AS (
                    SELECT 
                        e.id as doctor_id,
                        e.first_name,
                        e.last_name,
                        e.specialization,
                        e.department_id,
                        d.name as department_name,
                        COUNT(a.id) as total_appointments,
                        COUNT(a.id) FILTER (WHERE a.status IN ('scheduled', 'confirmed')) as scheduled,
                        COUNT(a.id) FILTER (WHERE a.status = 'in_progress') as in_progress,
                        COUNT(a.id) FILTER (WHERE a.status = 'completed') as completed,
                        e.max_appointments_per_day,
                        e.is_available,
                        CASE 
                            WHEN e.is_available = false THEN 'off_duty'
                            WHEN COUNT(a.id) >= e.max_appointments_per_day THEN 'fully_booked'
                            WHEN COUNT(a.id) >= e.max_appointments_per_day * 0.8 THEN 'almost_booked'
                            WHEN COUNT(a.id) >= e.max_appointments_per_day * 0.5 THEN 'moderately_booked'
                            ELSE 'available'
                        END as availability_status,
                        e.max_appointments_per_day - COUNT(a.id) as slots_remaining
                    FROM employees e
                    LEFT JOIN departments d ON e.department_id = d.id
                    LEFT JOIN appointments a ON e.id = a.doctor_id 
                        AND a.appointment_date = CURRENT_DATE
                        AND a.status NOT IN ('cancelled', 'no_show')
                        AND a.is_deleted = false
                    WHERE e.role = 'doctor'
                        AND e.is_deleted = false
                    GROUP BY e.id, e.first_name, e.last_name, e.specialization, e.department_id, d.name, e.max_appointments_per_day, e.is_available
                    HAVING e.is_available = true OR COUNT(a.id) > 0
                    ORDER BY slots_remaining DESC, total_appointments DESC
                )
                SELECT 
                    json_agg(doctor_availability.*) as doctors,
                    (SELECT 
                        json_build_object(
                            'total_doctors', COUNT(*),
                            'available_doctors', COUNT(*) FILTER (WHERE availability_status IN ('available', 'moderately_booked')),
                            'fully_booked', COUNT(*) FILTER (WHERE availability_status = 'fully_booked'),
                            'off_duty', COUNT(*) FILTER (WHERE availability_status = 'off_duty'),
                            'total_slots', SUM(max_appointments_per_day),
                            'total_booked', SUM(total_appointments),
                            'remaining_slots', SUM(slots_remaining)
                        )
                    FROM doctor_availability) as summary
                FROM doctor_availability
            `;

            const result = await db.query(query);
            
            return {
                doctors: result.rows[0]?.doctors || [],
                summary: result.rows[0]?.summary || {
                    total_doctors: 0,
                    available_doctors: 0,
                    fully_booked: 0,
                    off_duty: 0,
                    total_slots: 0,
                    total_booked: 0,
                    remaining_slots: 0
                }
            };
        } catch (error) {
            logger.error('Error in getDoctorAvailability', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get waiting time prediction
     * GET /api/v1/dashboard/reception/waiting-time-prediction
     */
    async getWaitingTimePrediction(receptionistId, options = {}) {
        try {
            const { department_id } = options;

            let departmentFilter = '';
            if (department_id) {
                departmentFilter = `AND d.id = '${department_id}'`;
            }

            const query = `
                WITH current_waiting AS (
                    SELECT 
                        d.id as department_id,
                        d.name as department_name,
                        COUNT(a.id) as waiting_count,
                        AVG(a.duration_minutes) as avg_consultation_time,
                        COUNT(e.id) as active_doctors
                    FROM departments d
                    LEFT JOIN employees e ON d.id = e.department_id 
                        AND e.role = 'doctor' 
                        AND e.is_available = true
                    LEFT JOIN appointments a ON e.id = a.doctor_id 
                        AND a.appointment_date = CURRENT_DATE
                        AND a.check_in_time IS NOT NULL 
                        AND a.status NOT IN ('completed', 'cancelled')
                    WHERE d.is_deleted = false
                        ${departmentFilter}
                    GROUP BY d.id, d.name
                ),
                historical_avg AS (
                    SELECT 
                        department_id,
                        AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/60) as avg_consultation_time_historical
                    FROM appointments a
                    JOIN employees e ON a.doctor_id = e.id
                    WHERE a.status = 'completed'
                        AND a.check_in_time IS NOT NULL
                        AND a.check_out_time IS NOT NULL
                        AND a.appointment_date >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY e.department_id
                )
                SELECT 
                    c.department_id,
                    c.department_name,
                    c.waiting_count,
                    c.active_doctors,
                    COALESCE(c.avg_consultation_time, h.avg_consultation_time_historical, 30) as avg_consultation_minutes,
                    ROUND(
                        (c.waiting_count * COALESCE(c.avg_consultation_time, h.avg_consultation_time_historical, 30)) / NULLIF(c.active_doctors, 1), 2
                    ) as estimated_wait_minutes,
                    CASE 
                        WHEN c.waiting_count = 0 THEN 'No wait time'
                        WHEN (c.waiting_count * COALESCE(c.avg_consultation_time, h.avg_consultation_time_historical, 30)) / NULLIF(c.active_doctors, 1) < 15 THEN 'Short wait'
                        WHEN (c.waiting_count * COALESCE(c.avg_consultation_time, h.avg_consultation_time_historical, 30)) / NULLIF(c.active_doctors, 1) < 30 THEN 'Moderate wait'
                        WHEN (c.waiting_count * COALESCE(c.avg_consultation_time, h.avg_consultation_time_historical, 30)) / NULLIF(c.active_doctors, 1) < 60 THEN 'Long wait'
                        ELSE 'Very long wait'
                    END as wait_category
                FROM current_waiting c
                LEFT JOIN historical_avg h ON c.department_id = h.department_id
                ORDER BY estimated_wait_minutes DESC
            `;

            const result = await db.query(query);
            
            return result.rows.map(row => ({
                department_id: row.department_id,
                department_name: row.department_name,
                waiting_count: parseInt(row.waiting_count),
                active_doctors: parseInt(row.active_doctors),
                avg_consultation_minutes: parseFloat(row.avg_consultation_minutes),
                estimated_wait_minutes: parseFloat(row.estimated_wait_minutes),
                wait_category: row.wait_category
            }));
        } catch (error) {
            logger.error('Error in getWaitingTimePrediction', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get today's token status
     * GET /api/v1/dashboard/reception/token-status
     */
    async getTokenStatus(receptionistId) {
        try {
            const query = `
                WITH token_queue AS (
                    SELECT 
                        token_number,
                        patient_id,
                        first_name,
                        last_name,
                        department_name,
                        doctor_name,
                        status,
                        issued_at,
                        called_at,
                        completed_at,
                        CASE 
                            WHEN status = 'waiting' AND called_at IS NULL THEN 
                                ROW_NUMBER() OVER (ORDER BY token_number) 
                            ELSE NULL 
                        END as position_in_queue
                    FROM (
                        SELECT 
                            o.token_number,
                            o.patient_id,
                            p.first_name,
                            p.last_name,
                            d.name as department_name,
                            CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                            o.status,
                            o.created_at as issued_at,
                            o.called_at,
                            o.completed_at
                        FROM opd_visits o
                        JOIN patients p ON o.patient_id = p.id
                        LEFT JOIN departments d ON o.department_id = d.id
                        LEFT JOIN employees e ON o.doctor_id = e.id
                        WHERE o.visit_date = CURRENT_DATE
                            AND o.is_deleted = false
                        ORDER BY o.token_number ASC
                    ) subquery
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total_tokens,
                        COUNT(*) FILTER (WHERE status = 'waiting') as waiting,
                        COUNT(*) FILTER (WHERE status = 'called') as called,
                        COUNT(*) FILTER (WHERE status = 'in_consultation') as in_consultation,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                        MIN(token_number) FILTER (WHERE status = 'waiting') as next_token
                    FROM token_queue
                )
                SELECT 
                    (SELECT json_agg(token_queue.*) FROM token_queue) as queue,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query);
            
            return {
                queue: result.rows[0]?.queue || [],
                summary: result.rows[0]?.summary || {
                    total_tokens: 0,
                    waiting: 0,
                    called: 0,
                    in_consultation: 0,
                    completed: 0,
                    cancelled: 0,
                    next_token: null
                }
            };
        } catch (error) {
            logger.error('Error in getTokenStatus', { error: error.message, receptionistId });
            throw error;
        }
    }
};

module.exports = receptionDashboardService;