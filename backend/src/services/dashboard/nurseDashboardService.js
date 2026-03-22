/**
 * ======================================================================
 * FILE: backend/src/services/dashboard/nurseDashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse dashboard service - Handles business logic for nurse dashboard.
 * Provides real-time patient care monitoring, task management, and bed occupancy.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * - [BR-26] Cleaning required between patients
 * - [BR-27] Max occupancy time 30 days
 * - [BR-28] ICU beds require special authorization
 * - [BR-36] Critical values require immediate notification
 * 
 * ENDPOINTS SUPPORTED:
 * - GET /api/v1/dashboard/nurse - Main dashboard
 * - GET /api/v1/dashboard/nurse/patients - Assigned patients
 * - GET /api/v1/dashboard/nurse/tasks - Pending tasks
 * - GET /api/v1/dashboard/nurse/vitals - Recent vitals
 * - GET /api/v1/dashboard/nurse/medications - Medication schedules
 * - GET /api/v1/dashboard/nurse/beds - Bed occupancy
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const nurseDashboardService = {
    /**
     * Get nurse main dashboard
     * GET /api/v1/dashboard/nurse
     */
    async getDashboard(nurseId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [
                assignedPatients,
                pendingTasks,
                recentVitals,
                medicationSchedules,
                bedOccupancy,
                shiftInfo
            ] = await Promise.all([
                this.getAssignedPatients(nurseId, { page: 1, limit: 5 }),
                this.getPendingTasks(nurseId, { page: 1, limit: 10 }),
                this.getRecentVitals(nurseId, { limit: 10 }),
                this.getMedicationSchedules(nurseId, { time: 'today' }),
                this.getBedOccupancy(nurseId),
                this.getShiftInfo(nurseId)
            ]);

            return {
                assigned_patients: assignedPatients,
                pending_tasks: pendingTasks,
                recent_vitals: recentVitals,
                medication_schedules: medicationSchedules,
                bed_occupancy: bedOccupancy,
                shift_info: shiftInfo,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get assigned patients
     * GET /api/v1/dashboard/nurse/patients
     */
    async getAssignedPatients(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20, status = 'all' } = options;
            const offset = (page - 1) * limit;

            let statusFilter = '';
            if (status !== 'all') {
                statusFilter = `AND p.status = '${status}'`;
            }

            const query = `
                WITH assigned_patients AS (
                    SELECT 
                        p.id as patient_id,
                        p.first_name,
                        p.last_name,
                        p.date_of_birth,
                        p.gender,
                        p.phone,
                        p.emergency_contact_name,
                        p.emergency_contact_phone,
                        b.id as bed_id,
                        b.bed_number,
                        b.ward,
                        b.room_number,
                        b.type as bed_type,
                        b.status as bed_status,
                        a.id as admission_id,
                        a.admission_date,
                        a.discharge_date,
                        a.diagnosis,
                        a.is_emergency,
                        EXTRACT(DAY FROM (NOW() - a.admission_date)) as days_admitted,
                        CASE 
                            WHEN EXTRACT(DAY FROM (NOW() - a.admission_date)) > 25 THEN 'critical'
                            WHEN EXTRACT(DAY FROM (NOW() - a.admission_date)) > 20 THEN 'warning'
                            ELSE 'normal'
                        END as occupancy_alert,
                        (
                            SELECT COUNT(*) FROM tasks 
                            WHERE patient_id = p.id 
                                AND status = 'pending'
                                AND assigned_to = $1
                        ) as pending_task_count
                    FROM patients p
                    JOIN admissions a ON p.id = a.patient_id
                    LEFT JOIN beds b ON a.bed_id = b.id
                    WHERE a.discharge_date IS NULL
                        AND a.is_deleted = false
                        AND a.assigned_nurse_id = $1
                        ${statusFilter}
                    ORDER BY 
                        CASE 
                            WHEN EXTRACT(DAY FROM (NOW() - a.admission_date)) > 25 THEN 1
                            WHEN EXTRACT(DAY FROM (NOW() - a.admission_date)) > 20 THEN 2
                            ELSE 3
                        END,
                        a.admission_date ASC
                    LIMIT $2 OFFSET $3
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE bed_type = 'icu') as icu_patients,
                        COUNT(*) FILTER (WHERE is_emergency = true) as emergency_patients,
                        COUNT(*) FILTER (WHERE occupancy_alert = 'critical') as critical_occupancy,
                        AVG(days_admitted) as avg_days_admitted
                    FROM assigned_patients
                )
                SELECT 
                    (SELECT json_agg(assigned_patients.*) FROM assigned_patients) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [nurseId, limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    icu_patients: 0,
                    emergency_patients: 0,
                    critical_occupancy: 0,
                    avg_days_admitted: 0
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getAssignedPatients', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get pending tasks
     * GET /api/v1/dashboard/nurse/tasks
     */
    async getPendingTasks(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20, priority = 'all' } = options;
            const offset = (page - 1) * limit;

            let priorityFilter = '';
            if (priority !== 'all') {
                priorityFilter = `AND t.priority = '${priority}'`;
            }

            const query = `
                WITH pending_tasks AS (
                    SELECT 
                        t.id,
                        t.task_number,
                        t.title,
                        t.description,
                        t.priority,
                        t.due_time,
                        t.created_at,
                        t.instructions,
                        t.location,
                        p.id as patient_id,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        p.room_number as patient_room,
                        p.bed_number as patient_bed,
                        CASE 
                            WHEN t.due_time < NOW() THEN 'overdue'
                            WHEN t.due_time < NOW() + INTERVAL '30 minutes' THEN 'due_soon'
                            ELSE 'pending'
                        END as urgency_status,
                        EXTRACT(EPOCH FROM (t.due_time - NOW()))/60 as minutes_remaining
                    FROM tasks t
                    LEFT JOIN patients p ON t.patient_id = p.id
                    WHERE t.assigned_to = $1
                        AND t.status IN ('pending', 'assigned', 'accepted')
                        AND t.is_deleted = false
                        ${priorityFilter}
                    ORDER BY 
                        CASE t.priority
                            WHEN 'urgent' THEN 1
                            WHEN 'high' THEN 2
                            WHEN 'medium' THEN 3
                            ELSE 4
                        END,
                        t.due_time ASC
                    LIMIT $2 OFFSET $3
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
                        COUNT(*) FILTER (WHERE priority = 'high') as high_count,
                        COUNT(*) FILTER (WHERE urgency_status = 'overdue') as overdue_count,
                        COUNT(*) FILTER (WHERE urgency_status = 'due_soon') as due_soon_count,
                        AVG(minutes_remaining) FILTER (WHERE minutes_remaining > 0) as avg_minutes_remaining
                    FROM pending_tasks
                )
                SELECT 
                    (SELECT json_agg(pending_tasks.*) FROM pending_tasks) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [nurseId, limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    urgent_count: 0,
                    high_count: 0,
                    overdue_count: 0,
                    due_soon_count: 0,
                    avg_minutes_remaining: 0
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getPendingTasks', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get recent vitals
     * GET /api/v1/dashboard/nurse/vitals
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getRecentVitals(nurseId, options = {}) {
        try {
            const { limit = 20, patient_id } = options;
            
            let patientFilter = '';
            if (patient_id) {
                patientFilter = `AND v.patient_id = '${patient_id}'`;
            }

            const query = `
                WITH recent_vitals AS (
                    SELECT 
                        v.id,
                        v.patient_id,
                        v.recorded_at,
                        v.blood_pressure_systolic,
                        v.blood_pressure_diastolic,
                        v.heart_rate,
                        v.temperature,
                        v.respiratory_rate,
                        v.oxygen_saturation,
                        v.blood_glucose,
                        v.pain_scale,
                        v.notes,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        p.room_number,
                        p.bed_number,
                        p.ward,
                        CASE 
                            WHEN v.heart_rate > 120 OR v.heart_rate < 50 THEN true
                            WHEN v.temperature > 39 OR v.temperature < 36 THEN true
                            WHEN v.blood_pressure_systolic > 180 OR v.blood_pressure_systolic < 90 THEN true
                            WHEN v.oxygen_saturation < 90 THEN true
                            ELSE false
                        END as is_critical,
                        CASE 
                            WHEN v.heart_rate > 120 THEN 'Tachycardia'
                            WHEN v.heart_rate < 50 THEN 'Bradycardia'
                            WHEN v.temperature > 39 THEN 'Hyperthermia'
                            WHEN v.temperature < 36 THEN 'Hypothermia'
                            WHEN v.blood_pressure_systolic > 180 THEN 'Severe Hypertension'
                            WHEN v.blood_pressure_systolic < 90 THEN 'Hypotension'
                            WHEN v.oxygen_saturation < 90 THEN 'Hypoxia'
                            ELSE NULL
                        END as critical_reason
                    FROM vitals v
                    JOIN patients p ON v.patient_id = p.id
                    WHERE v.is_deleted = false
                        ${patientFilter}
                    ORDER BY v.recorded_at DESC
                    LIMIT $1
                ),
                critical_alerts AS (
                    SELECT * FROM recent_vitals WHERE is_critical = true
                )
                SELECT 
                    (SELECT json_agg(recent_vitals.*) FROM recent_vitals) as vitals,
                    (SELECT json_agg(critical_alerts.*) FROM critical_alerts) as critical_alerts,
                    (SELECT COUNT(*) FROM critical_alerts) as critical_count
            `;

            const result = await db.query(query, [limit]);
            
            return {
                vitals: result.rows[0]?.vitals || [],
                critical_alerts: result.rows[0]?.critical_alerts || [],
                critical_count: parseInt(result.rows[0]?.critical_count) || 0
            };
        } catch (error) {
            logger.error('Error in getRecentVitals', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get medication schedules
     * GET /api/v1/dashboard/nurse/medications
     */
    async getMedicationSchedules(nurseId, options = {}) {
        try {
            const { time = 'all', patient_id } = options;

            let timeFilter = '';
            const now = new Date();
            const currentHour = now.getHours();
            
            if (time === 'today') {
                timeFilter = `AND DATE(m.scheduled_time) = CURRENT_DATE`;
            } else if (time === 'morning') {
                timeFilter = `AND EXTRACT(HOUR FROM m.scheduled_time) BETWEEN 6 AND 11`;
            } else if (time === 'afternoon') {
                timeFilter = `AND EXTRACT(HOUR FROM m.scheduled_time) BETWEEN 12 AND 16`;
            } else if (time === 'evening') {
                timeFilter = `AND EXTRACT(HOUR FROM m.scheduled_time) BETWEEN 17 AND 21`;
            } else if (time === 'night') {
                timeFilter = `AND EXTRACT(HOUR FROM m.scheduled_time) BETWEEN 22 AND 5`;
            }

            let patientFilter = '';
            if (patient_id) {
                patientFilter = `AND m.patient_id = '${patient_id}'`;
            }

            const query = `
                WITH medication_schedules AS (
                    SELECT 
                        m.id,
                        m.patient_id,
                        m.medicine_name,
                        m.dosage,
                        m.route,
                        m.scheduled_time,
                        m.status,
                        m.administered_by,
                        m.administered_at,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        p.room_number,
                        p.bed_number,
                        p.ward,
                        CASE 
                            WHEN m.scheduled_time < NOW() AND m.status = 'pending' THEN true
                            ELSE false
                        END as is_overdue,
                        EXTRACT(EPOCH FROM (m.scheduled_time - NOW()))/60 as minutes_until_due
                    FROM medications m
                    JOIN patients p ON m.patient_id = p.id
                    WHERE m.is_deleted = false
                        AND m.status IN ('pending', 'scheduled')
                        ${timeFilter}
                        ${patientFilter}
                    ORDER BY 
                        CASE 
                            WHEN m.scheduled_time < NOW() THEN 1
                            ELSE 2
                        END,
                        m.scheduled_time ASC
                    LIMIT 50
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE is_overdue = true) as overdue_count,
                        COUNT(*) FILTER (WHERE minutes_until_due <= 30 AND minutes_until_due > 0) as due_soon_count,
                        MIN(minutes_until_due) FILTER (WHERE minutes_until_due > 0) as next_due_minutes
                    FROM medication_schedules
                )
                SELECT 
                    (SELECT json_agg(medication_schedules.*) FROM medication_schedules) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    overdue_count: 0,
                    due_soon_count: 0,
                    next_due_minutes: null
                }
            };
        } catch (error) {
            logger.error('Error in getMedicationSchedules', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get bed occupancy
     * GET /api/v1/dashboard/nurse/beds
     * 
     * BUSINESS RULES: [BR-24], [BR-25], [BR-26], [BR-27], [BR-28]
     */
    async getBedOccupancy(nurseId) {
        try {
            // Get nurse's assigned ward from user data
            const nurseQuery = `
                SELECT ward FROM nurses WHERE user_id = $1
            `;
            const nurseResult = await db.query(nurseQuery, [nurseId]);
            const nurseWard = nurseResult.rows[0]?.ward || null;

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
                        b.maintenance_due,
                        b.daily_rate,
                        p.id as patient_id,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        p.admission_date,
                        EXTRACT(DAY FROM (NOW() - p.admission_date)) as days_occupied,
                        CASE 
                            WHEN b.type = 'icu' THEN 'Requires ICU authorization'
                            WHEN b.status = 'occupied' AND p.admission_date < NOW() - INTERVAL '30 days' THEN 'Exceeds 30-day limit'
                            WHEN b.status = 'occupied' AND b.last_cleaned IS NULL THEN 'Cleaning required'
                            WHEN b.status = 'available' AND b.last_cleaned < NOW() - INTERVAL '7 days' THEN 'Cleaning due'
                            ELSE NULL
                        END as alert_reason
                    FROM beds b
                    LEFT JOIN admissions p ON b.id = p.bed_id AND p.discharge_date IS NULL
                    WHERE b.is_deleted = false
                        ${nurseWard ? `AND b.ward = '${nurseWard}'` : ''}
                    ORDER BY 
                        CASE b.status
                            WHEN 'occupied' THEN 1
                            WHEN 'cleaning' THEN 2
                            WHEN 'maintenance' THEN 3
                            ELSE 4
                        END,
                        b.ward,
                        b.room_number,
                        b.bed_number
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total_beds,
                        COUNT(*) FILTER (WHERE status = 'available') as available,
                        COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                        COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                        COUNT(*) FILTER (WHERE type = 'icu') as icu_beds,
                        COUNT(*) FILTER (WHERE type = 'general') as general_beds,
                        COUNT(*) FILTER (WHERE type = 'emergency') as emergency_beds,
                        COUNT(*) FILTER (WHERE type = 'isolation') as isolation_beds,
                        COUNT(*) FILTER (WHERE status = 'occupied' AND type = 'icu') as occupied_icu,
                        COUNT(*) FILTER (WHERE alert_reason IS NOT NULL) as beds_with_alerts,
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
                alerts AS (
                    SELECT * FROM bed_stats WHERE alert_reason IS NOT NULL
                )
                SELECT 
                    (SELECT row_to_json(summary.*) FROM summary) as summary,
                    (SELECT json_agg(by_ward.*) FROM by_ward) as by_ward,
                    (SELECT json_agg(alerts.*) FROM alerts) as alerts
            `;

            const result = await db.query(query);
            
            return {
                summary: result.rows[0]?.summary || {
                    total_beds: 0,
                    available: 0,
                    occupied: 0,
                    cleaning: 0,
                    maintenance: 0,
                    icu_beds: 0,
                    general_beds: 0,
                    emergency_beds: 0,
                    isolation_beds: 0,
                    occupied_icu: 0,
                    beds_with_alerts: 0,
                    occupancy_rate: 0
                },
                by_ward: result.rows[0]?.by_ward || [],
                alerts: result.rows[0]?.alerts || []
            };
        } catch (error) {
            logger.error('Error in getBedOccupancy', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get shift information
     * GET /api/v1/dashboard/nurse/shift-info
     */
    async getShiftInfo(nurseId) {
        try {
            const query = `
                WITH current_shift AS (
                    SELECT 
                        s.id,
                        s.shift_name,
                        s.shift_type,
                        s.start_time,
                        s.end_time,
                        s.break_start,
                        s.break_end,
                        s.total_hours,
                        sa.id as assignment_id,
                        sa.assignment_date,
                        sa.check_in_time,
                        sa.check_out_time,
                        CASE 
                            WHEN sa.check_in_time IS NULL THEN 'not_started'
                            WHEN sa.check_in_time IS NOT NULL AND sa.check_out_time IS NULL THEN 'in_progress'
                            WHEN sa.check_out_time IS NOT NULL THEN 'completed'
                        END as status,
                        CASE 
                            WHEN sa.check_in_time IS NULL AND s.start_time < NOW() THEN true
                            ELSE false
                        END as is_late
                    FROM shift_assignments sa
                    JOIN shifts s ON sa.shift_id = s.id
                    WHERE sa.employee_id = $1
                        AND sa.assignment_date = CURRENT_DATE
                    LIMIT 1
                ),
                upcoming_shifts AS (
                    SELECT 
                        s.shift_name,
                        s.shift_type,
                        s.start_time,
                        s.end_time,
                        sa.assignment_date
                    FROM shift_assignments sa
                    JOIN shifts s ON sa.shift_id = s.id
                    WHERE sa.employee_id = $1
                        AND sa.assignment_date > CURRENT_DATE
                        AND sa.is_deleted = false
                    ORDER BY sa.assignment_date ASC
                    LIMIT 3
                ),
                handover_notes AS (
                    SELECT 
                        content,
                        handover_time,
                        from_nurse_id,
                        to_nurse_id,
                        is_acknowledged,
                        created_at
                    FROM handover_notes
                    WHERE to_nurse_id = $1
                        AND DATE(handover_time) = CURRENT_DATE
                    ORDER BY handover_time DESC
                    LIMIT 1
                )
                SELECT 
                    (SELECT row_to_json(current_shift.*) FROM current_shift) as current_shift,
                    (SELECT json_agg(upcoming_shifts.*) FROM upcoming_shifts) as upcoming_shifts,
                    (SELECT row_to_json(handover_notes.*) FROM handover_notes) as handover_notes
            `;

            const result = await db.query(query, [nurseId]);
            
            const currentShift = result.rows[0]?.current_shift || null;
            
            // Calculate time remaining if shift in progress
            if (currentShift && currentShift.status === 'in_progress') {
                const now = new Date();
                const endTime = new Date();
                const [endHour, endMinute] = currentShift.end_time.split(':');
                endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
                
                const minutesRemaining = Math.floor((endTime - now) / (1000 * 60));
                currentShift.minutes_remaining = minutesRemaining > 0 ? minutesRemaining : 0;
                currentShift.hours_remaining = (minutesRemaining / 60).toFixed(1);
            }

            return {
                current_shift: currentShift,
                upcoming_shifts: result.rows[0]?.upcoming_shifts || [],
                handover_notes: result.rows[0]?.handover_notes || null
            };
        } catch (error) {
            logger.error('Error in getShiftInfo', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get handover notes
     * GET /api/v1/dashboard/nurse/handover-notes
     */
    async getHandoverNotes(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20, unread_only = false } = options;
            const offset = (page - 1) * limit;

            let unreadFilter = '';
            if (unread_only) {
                unreadFilter = 'AND hn.is_acknowledged = false';
            }

            const query = `
                WITH handover_notes_list AS (
                    SELECT 
                        hn.id,
                        hn.content,
                        hn.handover_time,
                        hn.priority_patients,
                        hn.pending_tasks,
                        hn.alerts,
                        hn.equipment_issues,
                        hn.is_acknowledged,
                        hn.acknowledged_at,
                        hn.created_at,
                        e_from.id as from_nurse_id,
                        e_from.first_name as from_nurse_first_name,
                        e_from.last_name as from_nurse_last_name,
                        e_to.id as to_nurse_id,
                        e_to.first_name as to_nurse_first_name,
                        e_to.last_name as to_nurse_last_name,
                        s_from.shift_name as from_shift,
                        s_to.shift_name as to_shift
                    FROM handover_notes hn
                    LEFT JOIN employees e_from ON hn.from_nurse_id = e_from.id
                    LEFT JOIN employees e_to ON hn.to_nurse_id = e_to.id
                    LEFT JOIN shifts s_from ON hn.from_shift_id = s_from.id
                    LEFT JOIN shifts s_to ON hn.to_shift_id = s_to.id
                    WHERE (hn.to_nurse_id = $1 OR hn.from_nurse_id = $1)
                        AND hn.is_deleted = false
                        ${unreadFilter}
                    ORDER BY hn.handover_time DESC
                    LIMIT $2 OFFSET $3
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE is_acknowledged = false) as unread_count,
                        MAX(handover_time) as last_handover
                    FROM handover_notes_list
                )
                SELECT 
                    (SELECT json_agg(handover_notes_list.*) FROM handover_notes_list) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [nurseId, limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    unread_count: 0,
                    last_handover: null
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getHandoverNotes', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Acknowledge handover note
     * PUT /api/v1/dashboard/nurse/handover-notes/:id/acknowledge
     */
    async acknowledgeHandoverNote(nurseId, noteId, notes = null) {
        try {
            const query = `
                UPDATE handover_notes
                SET is_acknowledged = true,
                    acknowledged_at = NOW(),
                    acknowledged_by = $1,
                    updated_at = NOW()
                WHERE id = $2
                    AND to_nurse_id = $1
                    AND is_deleted = false
                RETURNING *
            `;

            const result = await db.query(query, [nurseId, noteId]);
            
            if (result.rows.length === 0) {
                throw new Error('Handover note not found or you are not the recipient');
            }
            
            // Add acknowledgment note if provided
            if (notes) {
                await db.query(`
                    UPDATE handover_notes
                    SET content = content || E'\n\n[Acknowledged on ' || NOW() || ']: ' || $1
                    WHERE id = $2
                `, [notes, noteId]);
            }
            
            logger.info('Handover note acknowledged', { nurseId, noteId });
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error in acknowledgeHandoverNote', { error: error.message, nurseId, noteId });
            throw error;
        }
    },

    /**
     * Get patient quick view for nurse
     * GET /api/v1/dashboard/nurse/patient/:patientId/quick-view
     */
    async getPatientQuickView(nurseId, patientId) {
        try {
            const query = `
                SELECT 
                    p.id,
                    p.first_name,
                    p.last_name,
                    p.date_of_birth,
                    p.gender,
                    p.phone,
                    p.emergency_contact_name,
                    p.emergency_contact_phone,
                    p.allergies,
                    p.medical_conditions,
                    b.id as bed_id,
                    b.bed_number,
                    b.ward,
                    b.room_number,
                    b.type as bed_type,
                    a.admission_date,
                    a.diagnosis as admission_diagnosis,
                    (
                        SELECT json_agg(v.* ORDER BY v.recorded_at DESC LIMIT 1)
                        FROM vitals v
                        WHERE v.patient_id = p.id
                    ) as latest_vitals,
                    (
                        SELECT json_agg(m.* ORDER BY m.scheduled_time ASC LIMIT 5)
                        FROM medications m
                        WHERE m.patient_id = p.id AND m.status = 'pending'
                    ) as pending_medications,
                    (
                        SELECT json_agg(t.* ORDER BY t.due_time ASC LIMIT 5)
                        FROM tasks t
                        WHERE t.patient_id = p.id AND t.status = 'pending'
                    ) as pending_tasks
                FROM patients p
                LEFT JOIN admissions a ON p.id = a.patient_id AND a.discharge_date IS NULL
                LEFT JOIN beds b ON a.bed_id = b.id
                WHERE p.id = $1 AND p.is_deleted = false
            `;

            const result = await db.query(query, [patientId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const patient = result.rows[0];
            
            // Calculate age
            const dob = new Date(patient.date_of_birth);
            const ageDiff = Date.now() - dob.getTime();
            const ageDate = new Date(ageDiff);
            patient.age = Math.abs(ageDate.getUTCFullYear() - 1970);
            
            return patient;
        } catch (error) {
            logger.error('Error in getPatientQuickView', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get nurse notifications
     * GET /api/v1/dashboard/nurse/notifications
     */
    async getNotifications(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20, unread_only = false } = options;
            const offset = (page - 1) * limit;

            let unreadFilter = '';
            if (unread_only) {
                unreadFilter = 'AND n.is_read = false';
            }

            const query = `
                WITH notifications_list AS (
                    SELECT 
                        n.id,
                        n.title,
                        n.message,
                        n.type,
                        n.priority,
                        n.is_read,
                        n.created_at,
                        n.data,
                        CASE 
                            WHEN n.priority = 'urgent' AND n.is_read = false THEN 'critical'
                            WHEN n.priority = 'high' AND n.is_read = false THEN 'warning'
                            ELSE 'info'
                        END as severity
                    FROM notifications n
                    WHERE n.user_id = $1
                        AND n.is_deleted = false
                        ${unreadFilter}
                    ORDER BY 
                        CASE n.priority
                            WHEN 'urgent' THEN 1
                            WHEN 'high' THEN 2
                            ELSE 3
                        END,
                        n.created_at DESC
                    LIMIT $2 OFFSET $3
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE is_read = false) as unread_count,
                        COUNT(*) FILTER (WHERE priority = 'urgent' AND is_read = false) as urgent_unread
                    FROM notifications_list
                )
                SELECT 
                    (SELECT json_agg(notifications_list.*) FROM notifications_list) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [nurseId, limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    unread_count: 0,
                    urgent_unread: 0
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getNotifications', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Mark notification as read
     * PUT /api/v1/dashboard/nurse/notifications/:id/read
     */
    async markNotificationRead(nurseId, notificationId) {
        try {
            const query = `
                UPDATE notifications
                SET is_read = true,
                    read_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND user_id = $2 AND is_deleted = false
                RETURNING *
            `;

            const result = await db.query(query, [notificationId, nurseId]);
            
            if (result.rows.length === 0) {
                throw new Error('Notification not found');
            }
            
            return result.rows[0];
        } catch (error) {
            logger.error('Error in markNotificationRead', { error: error.message, nurseId, notificationId });
            throw error;
        }
    },

    /**
     * Mark all notifications as read
     * PUT /api/v1/dashboard/nurse/notifications/read-all
     */
    async markAllNotificationsRead(nurseId) {
        try {
            const query = `
                UPDATE notifications
                SET is_read = true,
                    read_at = NOW(),
                    updated_at = NOW()
                WHERE user_id = $1 AND is_read = false AND is_deleted = false
                RETURNING id
            `;

            const result = await db.query(query, [nurseId]);
            
            return result.rowCount;
        } catch (error) {
            logger.error('Error in markAllNotificationsRead', { error: error.message, nurseId });
            throw error;
        }
    }
};

module.exports = nurseDashboardService;