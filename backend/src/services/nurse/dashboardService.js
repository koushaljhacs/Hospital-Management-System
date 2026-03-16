/**
 * ======================================================================
 * FILE: backend/src/services/nurse/dashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse dashboard service - Handles business logic for nurse dashboard.
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
     * Get main dashboard
     */
    async getDashboard(nurseId) {
        try {
            // Get nurse details and ward
            const nurseQuery = `
                SELECT id, first_name, last_name, ward, shift_type
                FROM employees
                WHERE id = $1
            `;
            const nurse = await db.query(nurseQuery, [nurseId]);
            const ward = nurse.rows[0]?.ward;

            // Get all dashboard components in parallel
            const [
                patientOverview,
                taskOverview,
                vitalAlerts,
                bedOccupancy,
                currentShift,
                medicationReminders
            ] = await Promise.all([
                this.getPatientOverview(nurseId),
                this.getTaskOverview(nurseId),
                this.getVitalAlerts(nurseId),
                this.getBedOccupancy(nurseId),
                this.getCurrentShift(nurseId),
                this.getMedicationReminders(nurseId)
            ]);

            return {
                nurse: {
                    id: nurse.rows[0].id,
                    name: `${nurse.rows[0].first_name} ${nurse.rows[0].last_name}`,
                    ward: nurse.rows[0].ward,
                    shift: nurse.rows[0].shift_type
                },
                ward_name: ward,
                patient_overview: patientOverview,
                task_overview: taskOverview,
                vital_alerts: vitalAlerts,
                bed_occupancy: bedOccupancy,
                current_shift: currentShift,
                medication_reminders: medicationReminders,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get patient overview
     */
    async getPatientOverview(nurseId) {
        try {
            const nurseQuery = `SELECT ward FROM employees WHERE id = $1`;
            const nurse = await db.query(nurseQuery, [nurseId]);
            const ward = nurse.rows[0]?.ward;

            const query = `
                SELECT 
                    COUNT(DISTINCT p.id) as total_patients,
                    COUNT(DISTINCT p.id) FILTER (
                        WHERE EXISTS (
                            SELECT 1 FROM vitals v 
                            WHERE v.patient_id = p.id 
                            AND v.created_at > NOW() - INTERVAL '24 hours'
                        )
                    ) as vitals_today,
                    COUNT(DISTINCT p.id) FILTER (
                        WHERE EXISTS (
                            SELECT 1 FROM medications m 
                            WHERE m.patient_id = p.id 
                            AND m.status = 'scheduled'
                            AND m.scheduled_time <= NOW() + INTERVAL '2 hours'
                        )
                    ) as medications_due,
                    COUNT(DISTINCT p.id) FILTER (
                        WHERE EXISTS (
                            SELECT 1 FROM tasks t 
                            WHERE t.patient_id = p.id 
                            AND t.status = 'pending'
                            AND t.priority IN ('urgent', 'high')
                        )
                    ) as critical_patients,
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id', p.id,
                            'name', CONCAT(p.first_name, ' ', p.last_name),
                            'room', b.room_number,
                            'bed', b.bed_number,
                            'admitted_days', EXTRACT(DAY FROM (NOW() - b.assigned_at)),
                            'pending_tasks', (
                                SELECT COUNT(*) FROM tasks t 
                                WHERE t.patient_id = p.id AND t.status = 'pending'
                            )
                        )
                    ) FILTER (WHERE b.id IS NOT NULL) as patients
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE b.ward = $1 AND b.status = 'occupied'
            `;

            const result = await db.query(query, [ward]);

            return {
                total: parseInt(result.rows[0].total_patients) || 0,
                vitals_today: parseInt(result.rows[0].vitals_today) || 0,
                medications_due: parseInt(result.rows[0].medications_due) || 0,
                critical_patients: parseInt(result.rows[0].critical_patients) || 0,
                patients: result.rows[0].patients || []
            };
        } catch (error) {
            logger.error('Error in getPatientOverview', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get task overview
     */
    async getTaskOverview(nurseId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_today,
                    COUNT(*) FILTER (WHERE priority = 'urgent' AND status != 'completed') as urgent,
                    COUNT(*) FILTER (WHERE priority = 'high' AND status != 'completed') as high,
                    COUNT(*) FILTER (WHERE due_time < NOW() AND status NOT IN ('completed', 'cancelled')) as overdue,
                    json_agg(
                        jsonb_build_object(
                            'id', id,
                            'title', title,
                            'priority', priority,
                            'due_time', due_time,
                            'patient_name', CONCAT(p.first_name, ' ', p.last_name),
                            'room', b.room_number,
                            'bed', b.bed_number
                        ) ORDER BY 
                            CASE priority
                                WHEN 'urgent' THEN 1
                                WHEN 'high' THEN 2
                                WHEN 'medium' THEN 3
                                WHEN 'low' THEN 4
                            END,
                            due_time ASC
                    ) FILTER (WHERE status = 'pending' AND priority IN ('urgent', 'high')) as critical_tasks
                FROM tasks t
                LEFT JOIN patients p ON t.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE t.assigned_to = $1
            `;

            const result = await db.query(query, [nurseId]);

            return {
                pending: parseInt(result.rows[0].pending) || 0,
                in_progress: parseInt(result.rows[0].in_progress) || 0,
                completed_today: parseInt(result.rows[0].completed_today) || 0,
                urgent: parseInt(result.rows[0].urgent) || 0,
                high: parseInt(result.rows[0].high) || 0,
                overdue: parseInt(result.rows[0].overdue) || 0,
                critical_tasks: result.rows[0].critical_tasks || []
            };
        } catch (error) {
            logger.error('Error in getTaskOverview', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get vital alerts [BR-36]
     */
    async getVitalAlerts(nurseId) {
        try {
            const nurseQuery = `SELECT ward FROM employees WHERE id = $1`;
            const nurse = await db.query(nurseQuery, [nurseId]);
            const ward = nurse.rows[0]?.ward;

            const query = `
                SELECT 
                    v.id,
                    v.patient_id,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    b.room_number,
                    b.bed_number,
                    v.recorded_at,
                    v.blood_pressure_systolic,
                    v.blood_pressure_diastolic,
                    v.heart_rate,
                    v.temperature,
                    v.oxygen_saturation,
                    v.critical_alerts,
                    ca.acknowledged,
                    ca.acknowledged_at,
                    EXTRACT(EPOCH FROM (NOW() - v.recorded_at))/60 as minutes_ago
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                LEFT JOIN beds b ON p.id = b.current_patient_id
                LEFT JOIN critical_alerts ca ON v.id = ca.vital_id
                WHERE v.is_critical = true
                    AND (ca.acknowledged = false OR ca.acknowledged IS NULL)
                    AND b.ward = $1
                    AND v.recorded_at > NOW() - INTERVAL '2 hours'
                ORDER BY v.recorded_at DESC
            `;

            const result = await db.query(query, [ward]);

            return result.rows.map(alert => ({
                ...alert,
                severity: this._determineSeverity(alert),
                requires_action: !alert.acknowledged && 
                    (parseInt(alert.minutes_ago) < 30) // Less than 30 minutes old
            }));
        } catch (error) {
            logger.error('Error in getVitalAlerts', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get bed occupancy
     */
    async getBedOccupancy(nurseId) {
        try {
            const nurseQuery = `SELECT ward FROM employees WHERE id = $1`;
            const nurse = await db.query(nurseQuery, [nurseId]);
            const ward = nurse.rows[0]?.ward;

            const query = `
                SELECT 
                    COUNT(*) as total_beds,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'occupied' AND EXTRACT(DAY FROM (NOW() - assigned_at)) > 25) as nearing_limit,
                    json_agg(
                        jsonb_build_object(
                            'bed_id', id,
                            'bed_number', bed_number,
                            'room', room_number,
                            'status', status,
                            'patient_name', CONCAT(p.first_name, ' ', p.last_name),
                            'occupancy_days', EXTRACT(DAY FROM (NOW() - assigned_at)),
                            'cleaning_due', next_cleaning_due
                        ) ORDER BY room_number, bed_number
                    ) FILTER (WHERE status IN ('occupied', 'cleaning')) as bed_details
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE b.ward = $1
                GROUP BY b.ward
            `;

            const result = await db.query(query, [ward]);

            const data = result.rows[0] || {
                total_beds: 0,
                occupied: 0,
                available: 0,
                cleaning: 0,
                maintenance: 0,
                nearing_limit: 0
            };

            return {
                ...data,
                occupancy_rate: data.total_beds > 0 
                    ? ((data.occupied / data.total_beds) * 100).toFixed(1) 
                    : 0,
                available_rate: data.total_beds > 0
                    ? ((data.available / data.total_beds) * 100).toFixed(1)
                    : 0
            };
        } catch (error) {
            logger.error('Error in getBedOccupancy', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get current shift
     */
    async getCurrentShift(nurseId) {
        try {
            const query = `
                SELECT 
                    s.id, s.shift_name, s.start_time, s.end_time,
                    s.break_start, s.break_end,
                    EXTRACT(EPOCH FROM (NOW() - (CURRENT_DATE + s.start_time)))/3600 as hours_elapsed,
                    EXTRACT(EPOCH FROM ((CURRENT_DATE + s.end_time) - NOW()))/3600 as hours_remaining
                FROM shifts s
                JOIN employees e ON s.id = e.shift_id
                WHERE e.id = $1
            `;

            const result = await db.query(query, [nurseId]);

            if (result.rows.length === 0) {
                return null;
            }

            const shift = result.rows[0];
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();

            return {
                ...shift,
                is_on_break: shift.break_start && shift.break_end &&
                    currentTime >= this._timeToMinutes(shift.break_start) &&
                    currentTime <= this._timeToMinutes(shift.break_end),
                status: shift.hours_remaining > 0 ? 'active' : 'completed'
            };
        } catch (error) {
            logger.error('Error in getCurrentShift', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get shift schedule
     */
    async getShiftSchedule(nurseId, options = {}) {
        try {
            const { from_date, to_date, days = 7 } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND shift_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND shift_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'`;
            }

            const query = `
                SELECT 
                    ns.id, ns.shift_date,
                    s.shift_name, s.start_time, s.end_time,
                    s.break_start, s.break_end,
                    ns.status,
                    ns.check_in_time, ns.check_out_time,
                    ns.notes
                FROM nurse_shifts ns
                JOIN shifts s ON ns.shift_id = s.id
                WHERE ns.nurse_id = $1
                    ${dateFilter}
                ORDER BY ns.shift_date, s.start_time
            `;

            const result = await db.query(query, [nurseId]);

            return result.rows;
        } catch (error) {
            logger.error('Error in getShiftSchedule', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Submit handover
     */
    async submitHandover(nurseId, handoverData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO shift_handovers (
                    id, from_nurse_id, shift_id, handover_notes,
                    patient_updates, task_updates, pending_issues,
                    next_shift_notes, submitted_at, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
                ) RETURNING *
            `;

            const values = [
                nurseId,
                handoverData.shift_id,
                handoverData.handover_notes,
                handoverData.patient_updates ? JSON.stringify(handoverData.patient_updates) : null,
                handoverData.task_updates ? JSON.stringify(handoverData.task_updates) : null,
                handoverData.pending_issues,
                handoverData.next_shift_notes,
                handoverData.submitted_at
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error in submitHandover', { error: error.message, nurseId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get handover notes
     */
    async getHandoverNotes(nurseId, options = {}) {
        try {
            const { shift_id, from_date, to_date, page = 1, limit = 10 } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT h.*, 
                       e.first_name, e.last_name,
                       s.shift_name, s.start_time, s.end_time
                FROM shift_handovers h
                JOIN employees e ON h.from_nurse_id = e.id
                JOIN shifts s ON h.shift_id = s.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (shift_id) {
                query += ` AND h.shift_id = $${paramIndex}`;
                values.push(shift_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND h.submitted_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND h.submitted_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY h.submitted_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total FROM shift_handovers
                WHERE 1=1 ${shift_id ? 'AND shift_id = $1' : ''}
            `;
            const countValues = shift_id ? [shift_id] : [];
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
            logger.error('Error in getHandoverNotes', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get medication reminders
     */
    async getMedicationReminders(nurseId) {
        try {
            const nurseQuery = `SELECT ward FROM employees WHERE id = $1`;
            const nurse = await db.query(nurseQuery, [nurseId]);
            const ward = nurse.rows[0]?.ward;

            const query = `
                SELECT 
                    m.id,
                    m.patient_id,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    b.room_number,
                    b.bed_number,
                    med.name as medication_name,
                    m.dosage,
                    m.route,
                    m.scheduled_time,
                    EXTRACT(EPOCH FROM (m.scheduled_time - NOW()))/60 as minutes_until_due,
                    CASE 
                        WHEN m.scheduled_time < NOW() THEN 'overdue'
                        WHEN m.scheduled_time <= NOW() + INTERVAL '30 minutes' THEN 'due_soon'
                        ELSE 'scheduled'
                    END as reminder_status
                FROM medication_schedules m
                JOIN patients p ON m.patient_id = p.id
                JOIN beds b ON p.id = b.current_patient_id
                JOIN medications med ON m.medication_id = med.id
                WHERE m.status = 'scheduled'
                    AND b.ward = $1
                    AND m.scheduled_time <= NOW() + INTERVAL '2 hours'
                ORDER BY 
                    CASE 
                        WHEN m.scheduled_time < NOW() THEN 1
                        WHEN m.scheduled_time <= NOW() + INTERVAL '30 minutes' THEN 2
                        ELSE 3
                    END,
                    m.scheduled_time ASC
            `;

            const result = await db.query(query, [ward]);

            return {
                overdue: result.rows.filter(r => r.reminder_status === 'overdue'),
                due_soon: result.rows.filter(r => r.reminder_status === 'due_soon'),
                upcoming: result.rows.filter(r => r.reminder_status === 'scheduled')
            };
        } catch (error) {
            logger.error('Error in getMedicationReminders', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get activity feed
     */
    async getActivityFeed(nurseId, limit = 20) {
        try {
            const nurseQuery = `SELECT ward FROM employees WHERE id = $1`;
            const nurse = await db.query(nurseQuery, [nurseId]);
            const ward = nurse.rows[0]?.ward;

            const query = `
                (
                    SELECT 
                        'vital' as type,
                        v.id,
                        v.patient_id,
                        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                        v.recorded_at as timestamp,
                        CONCAT(e.first_name, ' ', e.last_name) as performed_by,
                        'Vitals recorded' as description,
                        CASE WHEN v.is_critical THEN 'critical' ELSE 'info' END as severity
                    FROM vitals v
                    JOIN patients p ON v.patient_id = p.id
                    JOIN employees e ON v.recorded_by = e.id
                    JOIN beds b ON p.id = b.current_patient_id
                    WHERE b.ward = $1
                )
                UNION ALL
                (
                    SELECT 
                        'medication' as type,
                        m.id,
                        m.patient_id,
                        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                        m.administered_at as timestamp,
                        CONCAT(e.first_name, ' ', e.last_name) as performed_by,
                        CONCAT('Medication administered: ', med.name) as description,
                        CASE WHEN med.is_controlled THEN 'warning' ELSE 'info' END as severity
                    FROM medication_schedules m
                    JOIN patients p ON m.patient_id = p.id
                    JOIN employees e ON m.administered_by = e.id
                    JOIN medications med ON m.medication_id = med.id
                    JOIN beds b ON p.id = b.current_patient_id
                    WHERE b.ward = $1 AND m.administered_at IS NOT NULL
                )
                UNION ALL
                (
                    SELECT 
                        'task' as type,
                        t.id,
                        t.patient_id,
                        CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                        t.completed_at as timestamp,
                        CONCAT(e.first_name, ' ', e.last_name) as performed_by,
                        CONCAT('Task completed: ', t.title) as description,
                        CASE t.priority WHEN 'urgent' THEN 'warning' ELSE 'info' END as severity
                    FROM tasks t
                    JOIN patients p ON t.patient_id = p.id
                    JOIN employees e ON t.completed_by = e.id
                    JOIN beds b ON p.id = b.current_patient_id
                    WHERE b.ward = $1 AND t.completed_at IS NOT NULL
                )
                ORDER BY timestamp DESC
                LIMIT $2
            `;

            const result = await db.query(query, [ward, limit]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getActivityFeed', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get critical alerts summary [BR-36]
     */
    async getCriticalAlertsSummary(nurseId) {
        try {
            const nurseQuery = `SELECT ward FROM employees WHERE id = $1`;
            const nurse = await db.query(nurseQuery, [nurseId]);
            const ward = nurse.rows[0]?.ward;

            const query = `
                SELECT 
                    COUNT(*) FILTER (
                        WHERE v.is_critical = true 
                        AND ca.acknowledged = false
                        AND v.recorded_at > NOW() - INTERVAL '1 hour'
                    ) as critical_last_hour,
                    COUNT(*) FILTER (
                        WHERE v.is_critical = true 
                        AND ca.acknowledged = false
                    ) as total_unacknowledged,
                    COUNT(*) FILTER (
                        WHERE v.is_critical = true 
                        AND v.recorded_at > NOW() - INTERVAL '24 hours'
                    ) as last_24h,
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'type', 'vital',
                            'patient', CONCAT(p.first_name, ' ', p.last_name),
                            'value', 
                            CASE 
                                WHEN v.blood_pressure_systolic > 180 OR v.blood_pressure_diastolic > 110 THEN 'BP: ' || v.blood_pressure_systolic || '/' || v.blood_pressure_diastolic
                                WHEN v.heart_rate > 140 OR v.heart_rate < 40 THEN 'HR: ' || v.heart_rate
                                WHEN v.temperature > 39 OR v.temperature < 36 THEN 'Temp: ' || v.temperature
                                WHEN v.oxygen_saturation < 90 THEN 'O2: ' || v.oxygen_saturation
                            END,
                            'time', v.recorded_at
                        )
                    ) FILTER (
                        WHERE v.is_critical = true 
                        AND ca.acknowledged = false
                        AND v.recorded_at > NOW() - INTERVAL '1 hour'
                    ) as recent_critical
                FROM vitals v
                JOIN patients p ON v.patient_id = p.id
                JOIN beds b ON p.id = b.current_patient_id
                LEFT JOIN critical_alerts ca ON v.id = ca.vital_id
                WHERE b.ward = $1
            `;

            const result = await db.query(query, [ward]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getCriticalAlertsSummary', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get workload distribution
     */
    async getWorkloadDistribution(nurseId) {
        try {
            const nurseQuery = `SELECT ward FROM employees WHERE id = $1`;
            const nurse = await db.query(nurseQuery, [nurseId]);
            const ward = nurse.rows[0]?.ward;

            const query = `
                SELECT 
                    e.id,
                    CONCAT(e.first_name, ' ', e.last_name) as nurse_name,
                    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'pending') as pending_tasks,
                    COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'in_progress') as in_progress_tasks,
                    COUNT(DISTINCT t.id) FILTER (WHERE t.priority = 'urgent' AND t.status != 'completed') as urgent_tasks,
                    COUNT(DISTINCT p.id) as assigned_patients,
                    COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'scheduled' AND m.scheduled_time <= NOW() + INTERVAL '2 hours') as upcoming_medications
                FROM employees e
                LEFT JOIN tasks t ON e.id = t.assigned_to
                LEFT JOIN patients p ON e.id = p.assigned_nurse_id
                LEFT JOIN medication_schedules m ON p.id = m.patient_id
                WHERE e.designation = 'Nurse' 
                    AND e.ward = $1
                    AND e.is_active = true
                GROUP BY e.id
            `;

            const result = await db.query(query, [ward]);

            // Calculate workload score
            const nurses = result.rows.map(nurse => ({
                ...nurse,
                workload_score: this._calculateWorkloadScore(nurse)
            }));

            return {
                nurses,
                average_workload: nurses.reduce((acc, n) => acc + n.workload_score, 0) / nurses.length,
                most_loaded: nurses.sort((a, b) => b.workload_score - a.workload_score)[0],
                least_loaded: nurses.sort((a, b) => a.workload_score - b.workload_score)[0]
            };
        } catch (error) {
            logger.error('Error in getWorkloadDistribution', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get patient dashboard
     */
    async getPatientDashboard(nurseId, patientId) {
        try {
            const query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.date_of_birth,
                    p.gender, p.blood_group, p.allergies, p.medical_conditions,
                    b.room_number, b.bed_number, b.ward,
                    b.assigned_at as admitted_since,
                    EXTRACT(DAY FROM (NOW() - b.assigned_at)) as days_admitted,
                    (
                        SELECT json_agg(v.* ORDER BY v.recorded_at DESC)
                        FROM vitals v
                        WHERE v.patient_id = p.id
                        LIMIT 10
                    ) as recent_vitals,
                    (
                        SELECT json_agg(t.* ORDER BY t.due_time)
                        FROM tasks t
                        WHERE t.patient_id = p.id AND t.status != 'completed'
                    ) as pending_tasks,
                    (
                        SELECT json_agg(m.* ORDER BY m.scheduled_time)
                        FROM medication_schedules m
                        WHERE m.patient_id = p.id AND m.status = 'scheduled'
                    ) as scheduled_medications,
                    (
                        SELECT json_agg(n.* ORDER BY n.created_at DESC)
                        FROM patient_notes n
                        WHERE n.patient_id = p.id
                        LIMIT 5
                    ) as recent_notes
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE p.id = $1
            `;

            const result = await db.query(query, [patientId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPatientDashboard', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get patient quick view
     */
    async getPatientQuickView(nurseId, patientId) {
        try {
            const query = `
                SELECT 
                    p.id,
                    CONCAT(p.first_name, ' ', p.last_name) as name,
                    p.date_of_birth,
                    EXTRACT(YEAR FROM AGE(p.date_of_birth)) as age,
                    p.gender,
                    p.blood_group,
                    p.allergies,
                    b.room_number,
                    b.bed_number,
                    (
                        SELECT v.* FROM vitals v
                        WHERE v.patient_id = p.id
                        ORDER BY v.recorded_at DESC
                        LIMIT 1
                    ) as latest_vitals,
                    (
                        SELECT COUNT(*) FROM tasks t
                        WHERE t.patient_id = p.id AND t.status = 'pending'
                    ) as pending_tasks,
                    (
                        SELECT COUNT(*) FROM medication_schedules m
                        WHERE m.patient_id = p.id 
                            AND m.status = 'scheduled'
                            AND m.scheduled_time <= NOW() + INTERVAL '2 hours'
                    ) as upcoming_medications
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE p.id = $1
            `;

            const result = await db.query(query, [patientId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getPatientQuickView', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Export dashboard report
     */
    async exportDashboardReport(nurseId, options = {}) {
        try {
            const { format = 'pdf', sections = [] } = options;

            const dashboard = await this.getDashboard(nurseId);

            // Filter sections if specified
            if (sections.length > 0) {
                const filtered = {};
                sections.forEach(section => {
                    if (dashboard[section]) {
                        filtered[section] = dashboard[section];
                    }
                });
                return filtered;
            }

            // For now, return JSON
            // TODO: Implement actual PDF generation
            return dashboard;
        } catch (error) {
            logger.error('Error in exportDashboardReport', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get notifications
     */
    async getNotifications(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20, unread_only = false } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT * FROM notifications
                WHERE user_id = $1
            `;
            const values = [nurseId];
            let paramIndex = 2;

            if (unread_only) {
                query += ` AND read_at IS NULL`;
            }

            query += ` ORDER BY created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const unreadQuery = `
                SELECT COUNT(*) as unread_count
                FROM notifications
                WHERE user_id = $1 AND read_at IS NULL
            `;
            const unread = await db.query(unreadQuery, [nurseId]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM notifications
                WHERE user_id = $1
            `;
            const count = await db.query(countQuery, [nurseId]);

            return {
                data: result.rows,
                unread_count: parseInt(unread.rows[0].unread_count),
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getNotifications', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Mark notification as read
     */
    async markNotificationRead(nurseId, notificationId) {
        try {
            const query = `
                UPDATE notifications
                SET read_at = NOW()
                WHERE id = $1 AND user_id = $2
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
     */
    async markAllNotificationsRead(nurseId) {
        try {
            const query = `
                UPDATE notifications
                SET read_at = NOW()
                WHERE user_id = $1 AND read_at IS NULL
                RETURNING id
            `;

            const result = await db.query(query, [nurseId]);
            return result.rowCount;
        } catch (error) {
            logger.error('Error in markAllNotificationsRead', { error: error.message, nurseId });
            throw error;
        }
    },

    // ============================================
    // PRIVATE HELPER METHODS
    // ============================================

    /**
     * Determine alert severity
     */
    _determineSeverity(alert) {
        if (alert.blood_pressure_systolic > 180 || alert.blood_pressure_diastolic > 110) {
            return 'critical';
        }
        if (alert.heart_rate > 140 || alert.heart_rate < 40) {
            return 'critical';
        }
        if (alert.temperature > 39.5 || alert.temperature < 35) {
            return 'critical';
        }
        if (alert.oxygen_saturation < 85) {
            return 'critical';
        }
        if (alert.oxygen_saturation < 90) {
            return 'warning';
        }
        return 'info';
    },

    /**
     * Convert time string to minutes
     */
    _timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    },

    /**
     * Calculate workload score
     */
    _calculateWorkloadScore(nurse) {
        return (
            (parseInt(nurse.pending_tasks) || 0) * 2 +
            (parseInt(nurse.in_progress_tasks) || 0) * 1.5 +
            (parseInt(nurse.urgent_tasks) || 0) * 3 +
            (parseInt(nurse.assigned_patients) || 0) * 2 +
            (parseInt(nurse.upcoming_medications) || 0) * 1
        );
    }
};

module.exports = dashboardService;