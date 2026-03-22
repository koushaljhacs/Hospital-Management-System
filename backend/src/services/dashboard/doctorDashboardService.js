/**
 * ======================================================================
 * FILE: backend/src/services/dashboard/doctorDashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Doctor dashboard service - Handles business logic for doctor dashboard.
 * Provides comprehensive clinical overview, patient analytics, and performance metrics.
 * 
 * VERSION: 1.1.0
 * CREATED: 2026-03-22
 * UPDATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with basic dashboard metrics
 * v1.1.0 - Added patient demographics, condition analysis, revenue stats,
 *          follow-up tracking, and clinical outcome metrics
 * 
 * ENDPOINTS SUPPORTED:
 * - GET /api/v1/dashboard/doctor - Main dashboard
 * - GET /api/v1/dashboard/doctor/today - Today's schedule
 * - GET /api/v1/dashboard/doctor/patients - Patient statistics
 * - GET /api/v1/dashboard/doctor/appointments - Appointment statistics
 * - GET /api/v1/dashboard/doctor/prescriptions - Prescription statistics
 * - GET /api/v1/dashboard/doctor/lab-results - Lab results summary
 * - GET /api/v1/dashboard/doctor/performance - Performance metrics
 * - GET /api/v1/dashboard/doctor/patient-demographics - Patient demographics
 * - GET /api/v1/dashboard/doctor/conditions - Common conditions analysis
 * - GET /api/v1/dashboard/doctor/follow-ups - Follow-up tracking
 * - GET /api/v1/dashboard/doctor/revenue - Revenue statistics
 * - GET /api/v1/dashboard/doctor/clinical-outcomes - Clinical outcomes
 * 
 * BUSINESS RULES COVERED:
 * - [BR-07] Cannot book appointment in past
 * - [BR-08] Max 30 appointments per day
 * - [BR-10] Cancellation allowed up to 2 hours before
 * - [BR-13] One prescription per appointment
 * - [BR-14] Medicine quantity positive
 * - [BR-15] Dosage required
 * - [BR-16] Controlled substances need flag
 * - [BR-17] Prescription validity 30 days
 * - [BR-36] Critical values require notification
 * - [BR-38] Abnormal results flagged
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const doctorDashboardService = {
    /**
     * Get doctor main dashboard
     * GET /api/v1/dashboard/doctor
     */
    async getDashboard(doctorId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const [
                todaySchedule,
                patientStats,
                appointmentStats,
                prescriptionStats,
                labResultsSummary,
                performanceMetrics,
                patientDemographics,
                commonConditions,
                followUpTracking,
                revenueStats,
                clinicalOutcomes
            ] = await Promise.all([
                this.getTodaySchedule(doctorId),
                this.getPatientStats(doctorId),
                this.getAppointmentStats(doctorId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getPrescriptionStats(doctorId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getLabResultsSummary(doctorId),
                this.getPerformanceMetrics(doctorId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getPatientDemographics(doctorId),
                this.getCommonConditions(doctorId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getFollowUpTracking(doctorId),
                this.getRevenueStats(doctorId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getClinicalOutcomes(doctorId, { from_date: thirtyDaysAgo, to_date: today })
            ]);

            return {
                today_schedule: todaySchedule,
                patient_statistics: patientStats,
                appointment_statistics: appointmentStats,
                prescription_statistics: prescriptionStats,
                lab_results_summary: labResultsSummary,
                performance_metrics: performanceMetrics,
                patient_demographics: patientDemographics,
                common_conditions: commonConditions,
                follow_up_tracking: followUpTracking,
                revenue_statistics: revenueStats,
                clinical_outcomes: clinicalOutcomes,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get today's schedule
     * GET /api/v1/dashboard/doctor/today
     */
    async getTodaySchedule(doctorId) {
        try {
            const query = `
                SELECT a.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.phone as patient_phone,
                       p.email as patient_email,
                       p.allergies,
                       p.medical_conditions,
                       p.blood_group,
                       CASE 
                           WHEN a.check_in_time IS NOT NULL THEN true
                           ELSE false
                       END as is_checked_in,
                       EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth)) as patient_age
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE a.doctor_id = $1 
                    AND a.appointment_date = CURRENT_DATE
                    AND a.is_deleted = false
                ORDER BY a.appointment_time ASC
            `;

            const result = await db.query(query, [doctorId]);

            const appointments = result.rows;
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5);

            const updatedAppointments = appointments.map(apt => {
                const aptTime = apt.appointment_time;
                const isCurrent = aptTime <= currentTime && 
                                 (apt.status === 'scheduled' || apt.status === 'confirmed' || apt.status === 'in_progress');
                
                let waitingTime = null;
                if (apt.check_in_time) {
                    waitingTime = Math.floor((now - new Date(apt.check_in_time)) / (1000 * 60));
                }
                
                return {
                    ...apt,
                    is_current: isCurrent,
                    waiting_time: waitingTime,
                    estimated_start: this._calculateEstimatedStart(apt, appointments)
                };
            });

            // Calculate waiting room stats
            const waitingPatients = updatedAppointments.filter(a => a.check_in_time && a.status !== 'completed');
            const avgWaitTime = waitingPatients.length > 0 
                ? Math.floor(waitingPatients.reduce((sum, a) => sum + a.waiting_time, 0) / waitingPatients.length)
                : 0;

            return {
                appointments: updatedAppointments,
                summary: {
                    total: appointments.length,
                    completed: appointments.filter(a => a.status === 'completed').length,
                    pending: appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length,
                    in_progress: appointments.filter(a => a.status === 'in_progress').length,
                    checked_in: appointments.filter(a => a.check_in_time).length,
                    waiting_count: waitingPatients.length,
                    avg_wait_time_minutes: avgWaitTime,
                    next_appointment: updatedAppointments.find(a => !a.check_in_time && a.status !== 'completed')
                }
            };
        } catch (error) {
            logger.error('Error in getTodaySchedule', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get patient statistics
     * GET /api/v1/dashboard/doctor/patients
     */
    async getPatientStats(doctorId) {
        try {
            const query = `
                WITH patient_visits AS (
                    SELECT 
                        patient_id,
                        COUNT(*) as total_visits,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed_visits,
                        MIN(appointment_date) as first_visit,
                        MAX(appointment_date) as last_visit
                    FROM appointments
                    WHERE doctor_id = $1 AND is_deleted = false
                    GROUP BY patient_id
                )
                SELECT 
                    COUNT(DISTINCT pv.patient_id) as total_patients,
                    COUNT(DISTINCT pv.patient_id) FILTER (WHERE pv.last_visit > NOW() - INTERVAL '30 days') as active_patients,
                    COUNT(DISTINCT pv.patient_id) FILTER (WHERE pv.first_visit > NOW() - INTERVAL '30 days') as new_patients_30d,
                    COUNT(DISTINCT pv.patient_id) FILTER (WHERE pv.first_visit > NOW() - INTERVAL '90 days') as new_patients_90d,
                    COUNT(DISTINCT pv.patient_id) FILTER (WHERE pv.total_visits > 1) as returning_patients,
                    AVG(pv.total_visits)::numeric(10,2) as avg_visits_per_patient,
                    AVG(EXTRACT(YEAR FROM AGE(NOW(), p.date_of_birth)))::numeric(10,2) as avg_patient_age,
                    COUNT(DISTINCT pv.patient_id) FILTER (WHERE p.gender = 'male') as male_patients,
                    COUNT(DISTINCT pv.patient_id) FILTER (WHERE p.gender = 'female') as female_patients,
                    COUNT(DISTINCT pv.patient_id) FILTER (WHERE p.insurance_provider IS NOT NULL) as insured_patients
                FROM patient_visits pv
                JOIN patients p ON pv.patient_id = p.id
                WHERE p.is_deleted = false
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPatientStats', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get appointment statistics
     * GET /api/v1/dashboard/doctor/appointments
     */
    async getAppointmentStats(doctorId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND appointment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND appointment_date > NOW() - INTERVAL '30 days'`;
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
                        AVG(duration_minutes) as avg_duration
                    FROM appointments
                    WHERE doctor_id = $1 AND is_deleted = false
                        ${dateFilter}
                    GROUP BY DATE(appointment_date)
                    ORDER BY date DESC
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total_appointments,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                        COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
                        ROUND(COUNT(*) FILTER (WHERE status = 'completed')::float / NULLIF(COUNT(*), 0) * 100, 2) as completion_rate,
                        ROUND(COUNT(*) FILTER (WHERE status = 'cancelled')::float / NULLIF(COUNT(*), 0) * 100, 2) as cancellation_rate,
                        ROUND(COUNT(*) FILTER (WHERE status = 'no_show')::float / NULLIF(COUNT(*), 0) * 100, 2) as no_show_rate,
                        ROUND(AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/60)::numeric, 2) as avg_consultation_minutes,
                        COUNT(*) FILTER (WHERE check_in_time IS NOT NULL) as patients_checked_in
                    FROM appointments
                    WHERE doctor_id = $1 AND is_deleted = false
                        ${dateFilter}
                )
                SELECT 
                    (SELECT json_agg(daily_stats.*) FROM daily_stats) as daily_trend,
                    (SELECT * FROM summary) as summary
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAppointmentStats', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get prescription statistics
     * GET /api/v1/dashboard/doctor/prescriptions
     */
    async getPrescriptionStats(doctorId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND p.created_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND p.created_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH prescription_data AS (
                    SELECT 
                        p.id,
                        p.created_at,
                        COUNT(pm.id) as medicine_count,
                        SUM(pm.quantity) as total_quantity,
                        COUNT(pm.id) FILTER (WHERE i.is_narcotic = true) as controlled_count
                    FROM prescriptions p
                    LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
                    LEFT JOIN inventory i ON pm.medicine_id = i.id
                    WHERE p.doctor_id = $1 AND p.is_deleted = false
                        ${dateFilter}
                    GROUP BY p.id
                ),
                top_medicines AS (
                    SELECT 
                        i.medicine_name,
                        i.generic_name,
                        i.category,
                        COUNT(*) as prescription_count,
                        SUM(pm.quantity) as total_quantity
                    FROM prescriptions p
                    JOIN prescription_medicines pm ON p.id = pm.prescription_id
                    JOIN inventory i ON pm.medicine_id = i.id
                    WHERE p.doctor_id = $1 AND p.is_deleted = false
                        ${dateFilter}
                    GROUP BY i.medicine_name, i.generic_name, i.category
                    ORDER BY prescription_count DESC
                    LIMIT 10
                ),
                summary AS (
                    SELECT 
                        COUNT(DISTINCT p.id) as total_prescriptions,
                        SUM(pm.quantity) as total_medicines,
                        AVG(pm.quantity)::numeric(10,2) as avg_medicines_per_prescription,
                        COUNT(*) FILTER (WHERE i.is_narcotic = true) as controlled_substances_count,
                        AVG(pm.quantity) FILTER (WHERE i.is_narcotic = true)::numeric(10,2) as avg_controlled_quantity
                    FROM prescriptions p
                    LEFT JOIN prescription_medicines pm ON p.id = pm.prescription_id
                    LEFT JOIN inventory i ON pm.medicine_id = i.id
                    WHERE p.doctor_id = $1 AND p.is_deleted = false
                        ${dateFilter}
                )
                SELECT 
                    (SELECT json_agg(top_medicines.*) FROM top_medicines) as top_medicines,
                    (SELECT * FROM summary) as summary,
                    (SELECT json_agg(prescription_data.*) FROM prescription_data LIMIT 20) as recent_prescriptions
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPrescriptionStats', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get lab results summary
     * GET /api/v1/dashboard/doctor/lab-results
     * 
     * BUSINESS RULES: [BR-36], [BR-38]
     */
    async getLabResultsSummary(doctorId) {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT tr.id) as total_results,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'pending') as pending_results,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'completed') as completed_results,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'verified') as verified_results,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.is_abnormal = true) as abnormal_results,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.is_critical = true) as critical_results,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.is_panic = true) as panic_results,
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'result_id', tr.id,
                            'patient_id', p.id,
                            'patient_name', CONCAT(p.first_name, ' ', p.last_name),
                            'test_name', lt.test_name,
                            'result_value', tr.result_value,
                            'result_numeric', tr.result_numeric,
                            'reference_range', CONCAT(tr.reference_range_low, ' - ', tr.reference_range_high),
                            'result_date', tr.completed_at,
                            'is_abnormal', tr.is_abnormal,
                            'is_critical', tr.is_critical,
                            'is_panic', tr.is_panic,
                            'acknowledged', tr.acknowledged
                        )
                        ORDER BY tr.completed_at DESC
                    ) FILTER (WHERE tr.is_critical = true OR tr.is_panic = true) as critical_results
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                JOIN test_orders to ON tr.test_order_id = to.id
                JOIN patients p ON tr.patient_id = p.id
                WHERE to.doctor_id = $1 
                    AND tr.is_deleted = false
                    AND (tr.is_critical = true OR tr.is_panic = true OR tr.status = 'pending')
                GROUP BY tr.is_critical
            `;

            const result = await db.query(query, [doctorId]);
            
            const data = result.rows[0] || {
                total_results: 0,
                pending_results: 0,
                completed_results: 0,
                verified_results: 0,
                abnormal_results: 0,
                critical_results: 0,
                panic_results: 0,
                critical_results: []
            };

            // Calculate unacknowledged critical results
            const unacknowledgedCritical = (data.critical_results || []).filter(r => !r.acknowledged).length;

            return {
                ...data,
                unacknowledged_critical: unacknowledgedCritical,
                requires_attention: unacknowledgedCritical > 0 || data.panic_results > 0
            };
        } catch (error) {
            logger.error('Error in getLabResultsSummary', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get performance metrics
     * GET /api/v1/dashboard/doctor/performance
     */
    async getPerformanceMetrics(doctorId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND a.appointment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND a.appointment_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    COUNT(DISTINCT a.id) as total_consultations,
                    COUNT(DISTINCT p.id) as unique_patients,
                    COUNT(DISTINCT pr.id) as total_prescriptions,
                    COUNT(DISTINCT lo.id) as total_lab_orders,
                    COUNT(DISTINCT ro.id) as total_radiology_orders,
                    AVG(EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/60)::numeric(10,2) as avg_consultation_minutes,
                    ROUND(COUNT(*) FILTER (WHERE a.status = 'completed')::float / NULLIF(COUNT(*), 0) * 100, 2) as completion_rate,
                    COUNT(*) FILTER (WHERE a.is_emergency = true) as emergency_consultations,
                    COUNT(*) FILTER (WHERE a.status = 'no_show') as no_shows,
                    COUNT(DISTINCT CASE WHEN a.check_in_time IS NOT NULL THEN a.id END) as patients_checked_in,
                    (SELECT COUNT(*) FROM prescriptions WHERE doctor_id = $1 AND created_at > NOW() - INTERVAL '7 days') as prescriptions_this_week,
                    (SELECT ROUND(AVG(patient_rating), 2) FROM feedback WHERE doctor_id = $1 AND created_at > NOW() - INTERVAL '30 days') as avg_patient_rating,
                    (SELECT COUNT(*) FROM feedback WHERE doctor_id = $1 AND created_at > NOW() - INTERVAL '30 days') as total_feedback_count
                FROM appointments a
                LEFT JOIN patients p ON a.patient_id = p.id
                LEFT JOIN prescriptions pr ON a.id = pr.appointment_id
                LEFT JOIN lab_orders lo ON a.id = lo.appointment_id
                LEFT JOIN radiology_orders ro ON a.id = ro.appointment_id
                WHERE a.doctor_id = $1 AND a.is_deleted = false
                    ${dateFilter}
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPerformanceMetrics', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get patient demographics
     * GET /api/v1/dashboard/doctor/patient-demographics
     */
    async getPatientDemographics(doctorId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) FILTER (WHERE gender = 'male') as male,
                    COUNT(*) FILTER (WHERE gender = 'female') as female,
                    COUNT(*) FILTER (WHERE gender = 'other') as other,
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) < 18) as age_0_17,
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) BETWEEN 18 AND 30) as age_18_30,
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) BETWEEN 31 AND 50) as age_31_50,
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) BETWEEN 51 AND 70) as age_51_70,
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) > 70) as age_70_plus,
                    COUNT(*) FILTER (WHERE blood_group = 'A+') as blood_group_a_positive,
                    COUNT(*) FILTER (WHERE blood_group = 'A-') as blood_group_a_negative,
                    COUNT(*) FILTER (WHERE blood_group = 'B+') as blood_group_b_positive,
                    COUNT(*) FILTER (WHERE blood_group = 'B-') as blood_group_b_negative,
                    COUNT(*) FILTER (WHERE blood_group = 'AB+') as blood_group_ab_positive,
                    COUNT(*) FILTER (WHERE blood_group = 'AB-') as blood_group_ab_negative,
                    COUNT(*) FILTER (WHERE blood_group = 'O+') as blood_group_o_positive,
                    COUNT(*) FILTER (WHERE blood_group = 'O-') as blood_group_o_negative,
                    COUNT(*) FILTER (WHERE insurance_provider IS NOT NULL) as insured,
                    COUNT(*) FILTER (WHERE emergency_contact_name IS NOT NULL) as has_emergency_contact
                FROM patients p
                WHERE EXISTS (
                    SELECT 1 FROM appointments a 
                    WHERE a.patient_id = p.id AND a.doctor_id = $1
                )
                AND p.is_deleted = false
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPatientDemographics', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get common conditions
     * GET /api/v1/dashboard/doctor/conditions
     */
    async getCommonConditions(doctorId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND d.diagnosed_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND d.diagnosed_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    d.icd_code,
                    d.diagnosis_name,
                    COUNT(*) as occurrence_count,
                    COUNT(DISTINCT d.patient_id) as unique_patients,
                    AVG(CASE WHEN d.resolved_at IS NOT NULL THEN 1 ELSE 0 END) * 100 as resolution_rate,
                    MIN(d.diagnosed_at) as first_diagnosis,
                    MAX(d.diagnosed_at) as last_diagnosis
                FROM diagnosis d
                WHERE d.doctor_id = $1
                    AND d.is_deleted = false
                    ${dateFilter}
                GROUP BY d.icd_code, d.diagnosis_name
                ORDER BY occurrence_count DESC
                LIMIT 20
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCommonConditions', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get follow-up tracking
     * GET /api/v1/dashboard/doctor/follow-ups
     */
    async getFollowUpTracking(doctorId) {
        try {
            const query = `
                WITH follow_ups AS (
                    SELECT 
                        a.id as appointment_id,
                        a.patient_id,
                        a.appointment_date,
                        p.first_name,
                        p.last_name,
                        p.phone,
                        a.follow_up_required,
                        a.follow_up_date,
                        CASE 
                            WHEN a.follow_up_date < CURRENT_DATE THEN 'overdue'
                            WHEN a.follow_up_date = CURRENT_DATE THEN 'today'
                            WHEN a.follow_up_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7 THEN 'upcoming'
                            ELSE 'future'
                        END as status,
                        EXTRACT(DAY FROM (a.follow_up_date - CURRENT_DATE)) as days_until
                    FROM appointments a
                    JOIN patients p ON a.patient_id = p.id
                    WHERE a.doctor_id = $1
                        AND a.follow_up_required = true
                        AND a.follow_up_date IS NOT NULL
                        AND a.is_deleted = false
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total_follow_ups,
                        COUNT(*) FILTER (WHERE status = 'overdue') as overdue,
                        COUNT(*) FILTER (WHERE status = 'today') as today,
                        COUNT(*) FILTER (WHERE status = 'upcoming') as upcoming,
                        MIN(days_until) FILTER (WHERE days_until >= 0) as next_follow_up_days
                    FROM follow_ups
                )
                SELECT 
                    (SELECT json_agg(follow_ups.*) FROM follow_ups ORDER BY days_until ASC LIMIT 20) as follow_ups,
                    (SELECT * FROM summary) as summary
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getFollowUpTracking', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get revenue statistics
     * GET /api/v1/dashboard/doctor/revenue
     */
    async getRevenueStats(doctorId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND a.appointment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND a.appointment_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH revenue_data AS (
                    SELECT 
                        DATE_TRUNC('week', a.appointment_date) as period,
                        COUNT(DISTINCT a.id) as consultation_count,
                        SUM(i.total_amount) as consultation_revenue,
                        SUM(i.discount) as discount_given,
                        SUM(i.tax_amount) as tax_collected,
                        COUNT(DISTINCT p.id) as payment_count,
                        SUM(p.amount) as collected_amount
                    FROM appointments a
                    JOIN invoices i ON a.id = i.appointment_id
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    WHERE a.doctor_id = $1
                        AND i.is_deleted = false
                        ${dateFilter}
                    GROUP BY DATE_TRUNC('week', a.appointment_date)
                    ORDER BY period DESC
                ),
                summary AS (
                    SELECT 
                        SUM(consultation_revenue) as total_revenue,
                        SUM(collected_amount) as total_collected,
                        SUM(discount_given) as total_discount,
                        SUM(tax_collected) as total_tax,
                        ROUND(SUM(collected_amount)::float / NULLIF(SUM(consultation_revenue), 0) * 100, 2) as collection_rate,
                        AVG(consultation_revenue) as avg_revenue_per_consultation
                    FROM revenue_data
                )
                SELECT 
                    (SELECT json_agg(revenue_data.*) FROM revenue_data) as weekly_trend,
                    (SELECT * FROM summary) as summary
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getRevenueStats', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Get clinical outcomes
     * GET /api/v1/dashboard/doctor/clinical-outcomes
     */
    async getClinicalOutcomes(doctorId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND a.appointment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND a.appointment_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    COUNT(DISTINCT a.id) as total_consultations,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed') as completed_consultations,
                    COUNT(DISTINCT d.id) as total_diagnoses,
                    COUNT(DISTINCT d.id) FILTER (WHERE d.resolved_at IS NOT NULL) as resolved_diagnoses,
                    COUNT(DISTINCT pr.id) as total_prescriptions,
                    COUNT(DISTINCT lo.id) as lab_orders_placed,
                    COUNT(DISTINCT ro.id) as radiology_orders_placed,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.follow_up_required = true) as follow_up_required,
                    ROUND(AVG(f.patient_rating), 2) as avg_patient_rating,
                    ROUND(
                        COUNT(DISTINCT d.id) FILTER (WHERE d.resolved_at IS NOT NULL)::float / 
                        NULLIF(COUNT(DISTINCT d.id), 0) * 100, 2
                    ) as diagnosis_resolution_rate
                FROM appointments a
                LEFT JOIN diagnosis d ON a.id = d.appointment_id
                LEFT JOIN prescriptions pr ON a.id = pr.appointment_id
                LEFT JOIN lab_orders lo ON a.id = lo.appointment_id
                LEFT JOIN radiology_orders ro ON a.id = ro.appointment_id
                LEFT JOIN feedback f ON a.id = f.appointment_id
                WHERE a.doctor_id = $1
                    AND a.is_deleted = false
                    ${dateFilter}
            `;

            const result = await db.query(query, [doctorId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getClinicalOutcomes', { error: error.message, doctorId });
            throw error;
        }
    },

    /**
     * Helper: Calculate estimated start time
     */
    _calculateEstimatedStart(currentAppointment, allAppointments) {
        // Simplified calculation - can be enhanced with actual durations
        const previousApps = allAppointments.filter(a => 
            a.appointment_time < currentAppointment.appointment_time && 
            a.status === 'completed'
        );
        
        const totalDuration = previousApps.reduce((sum, a) => sum + (a.duration_minutes || 30), 0);
        const baseTime = new Date(`${currentAppointment.appointment_date}T${currentAppointment.appointment_time}`);
        
        return new Date(baseTime.getTime() + totalDuration * 60000);
    }
};

module.exports = doctorDashboardService;