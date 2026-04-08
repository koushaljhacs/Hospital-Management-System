/**
 * ======================================================================
 * FILE: backend/src/models/hr/EmployeePerformance.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * AUTHOR: @koushal
 * 
 * RESTRICTIONS:
 * This code is proprietary to OctNov.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * DESCRIPTION:
 * EmployeePerformance model for database operations.
 * Tracks employee performance metrics including clinical, revenue, and quality indicators.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: employee_performance
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - employee_id: UUID (foreign key to employees)
 * - period_start: date
 * - period_end: date
 * - period_type: enum (daily, weekly, monthly, quarterly, yearly)
 * - patients_seen: integer
 * - new_patients: integer
 * - followup_patients: integer
 * - appointments_completed: integer
 * - appointments_scheduled: integer
 * - appointments_cancelled: integer
 * - appointments_no_show: integer
 * - avg_appointment_duration: integer
 * - prescriptions_written: integer
 * - lab_orders_placed: integer
 * - radiology_orders_placed: integer
 * - procedures_performed: integer
 * - emergency_cases: integer
 * - consultation_revenue: decimal
 * - procedure_revenue: decimal
 * - lab_commission_revenue: decimal
 * - pharmacy_commission_revenue: decimal
 * - total_revenue: decimal
 * - avg_revenue_per_patient: decimal
 * - revenue_target: decimal
 * - revenue_achievement_percent: decimal
 * - patient_rating_avg: decimal
 * - patient_feedback_count: integer
 * - positive_feedback_count: integer
 * - negative_feedback_count: integer
 * - feedback_response_rate: decimal
 * - follow_up_rate: decimal
 * - no_show_rate: decimal
 * - on_time_percentage: decimal
 * - patient_satisfaction_score: decimal
 * - vs_previous_period_patients: decimal
 * - vs_previous_period_revenue: decimal
 * - vs_previous_period_rating: decimal
 * - vs_department_avg_patients: decimal
 * - vs_department_avg_revenue: decimal
 * - vs_hospital_avg_patients: decimal
 * - vs_hospital_avg_revenue: decimal
 * - patient_target: integer
 * - revenue_target_monthly: decimal
 * - quality_target_score: decimal
 * - targets_achieved: jsonb
 * - metrics_data: jsonb
 * - achievements: text[]
 * - notes: text
 * - calculated_at: timestamp
 * - created_at: timestamp
 * - updated_at: timestamp
 * - created_by: uuid
 * - updated_by: uuid
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

const EmployeePerformance = {
    /**
     * Table name
     */
    tableName: 'employee_performance',

    /**
     * Valid period types
     */
    validPeriodTypes: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],

    /**
     * Find performance record by ID
     * @param {string} id - Performance UUID
     * @returns {Promise<Object|null>} Performance object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ep.id, ep.employee_id, ep.period_start, ep.period_end, ep.period_type,
                    ep.patients_seen, ep.new_patients, ep.followup_patients,
                    ep.appointments_completed, ep.appointments_scheduled,
                    ep.appointments_cancelled, ep.appointments_no_show,
                    ep.avg_appointment_duration,
                    ep.prescriptions_written, ep.lab_orders_placed,
                    ep.radiology_orders_placed, ep.procedures_performed,
                    ep.emergency_cases,
                    ep.consultation_revenue, ep.procedure_revenue,
                    ep.lab_commission_revenue, ep.pharmacy_commission_revenue,
                    ep.total_revenue, ep.avg_revenue_per_patient,
                    ep.revenue_target, ep.revenue_achievement_percent,
                    ep.patient_rating_avg, ep.patient_feedback_count,
                    ep.positive_feedback_count, ep.negative_feedback_count,
                    ep.feedback_response_rate, ep.follow_up_rate,
                    ep.no_show_rate, ep.on_time_percentage,
                    ep.patient_satisfaction_score,
                    ep.vs_previous_period_patients, ep.vs_previous_period_revenue,
                    ep.vs_previous_period_rating,
                    ep.vs_department_avg_patients, ep.vs_department_avg_revenue,
                    ep.vs_hospital_avg_patients, ep.vs_hospital_avg_revenue,
                    ep.patient_target, ep.revenue_target_monthly,
                    ep.quality_target_score, ep.targets_achieved,
                    ep.metrics_data, ep.achievements, ep.notes,
                    ep.calculated_at, ep.created_at, ep.updated_at,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    d.name as department_name,
                    u.username as created_by_name
                FROM employee_performance ep
                JOIN employees e ON ep.employee_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                LEFT JOIN users u ON ep.created_by = u.id
                WHERE ep.id = $1 AND ep.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Employee performance found by ID', { performanceId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding employee performance by ID', {
                error: error.message,
                performanceId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find performance records by employee ID
     * @param {string} employeeId - Employee UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of performance records
     */
    async findByEmployeeId(employeeId, options = {}) {
        try {
            const { limit = 50, offset = 0, period_type, from_date, to_date } = options;
            const values = [employeeId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (period_type) {
                conditions.push(`period_type = $${paramIndex++}`);
                values.push(period_type);
            }
            if (from_date) {
                conditions.push(`period_start >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`period_end <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, period_start, period_end, period_type,
                    patients_seen, total_revenue, patient_rating_avg,
                    follow_up_rate, no_show_rate, revenue_achievement_percent,
                    calculated_at
                FROM employee_performance
                ${whereClause}
                ORDER BY period_start DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Performance records found by employee ID', {
                employeeId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding performance records by employee ID', {
                error: error.message,
                employeeId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get latest performance record for employee
     * @param {string} employeeId - Employee UUID
     * @returns {Promise<Object|null>} Latest performance or null
     */
    async getLatest(employeeId) {
        try {
            const query = `
                SELECT 
                    id, period_start, period_end, period_type,
                    patients_seen, total_revenue, patient_rating_avg,
                    follow_up_rate, no_show_rate, revenue_achievement_percent,
                    calculated_at
                FROM employee_performance
                WHERE employee_id = $1 AND is_deleted = false
                ORDER BY period_start DESC
                LIMIT 1
            `;

            const result = await db.query(query, [employeeId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Latest performance record retrieved', { employeeId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting latest performance record', {
                error: error.message,
                employeeId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new performance record
     * @param {Object} performanceData - Performance data
     * @returns {Promise<Object>} Created performance record
     */
    async create(performanceData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (performanceData.period_type && !this.validPeriodTypes.includes(performanceData.period_type)) {
                throw new Error(`Invalid period type. Must be one of: ${this.validPeriodTypes.join(', ')}`);
            }

            // Calculate derived metrics if not provided
            let totalRevenue = performanceData.total_revenue;
            if (!totalRevenue && (performanceData.consultation_revenue !== undefined ||
                performanceData.procedure_revenue !== undefined ||
                performanceData.lab_commission_revenue !== undefined ||
                performanceData.pharmacy_commission_revenue !== undefined)) {
                totalRevenue = (performanceData.consultation_revenue || 0) +
                              (performanceData.procedure_revenue || 0) +
                              (performanceData.lab_commission_revenue || 0) +
                              (performanceData.pharmacy_commission_revenue || 0);
            }

            let revenueAchievement = performanceData.revenue_achievement_percent;
            if (!revenueAchievement && totalRevenue && performanceData.revenue_target) {
                revenueAchievement = (totalRevenue / performanceData.revenue_target) * 100;
            }

            let avgRevenuePerPatient = performanceData.avg_revenue_per_patient;
            if (!avgRevenuePerPatient && totalRevenue && performanceData.patients_seen) {
                avgRevenuePerPatient = totalRevenue / performanceData.patients_seen;
            }

            let followUpRate = performanceData.follow_up_rate;
            if (!followUpRate && performanceData.followup_patients && performanceData.patients_seen) {
                followUpRate = (performanceData.followup_patients / performanceData.patients_seen) * 100;
            }

            let noShowRate = performanceData.no_show_rate;
            if (!noShowRate && performanceData.appointments_no_show && performanceData.appointments_scheduled) {
                noShowRate = (performanceData.appointments_no_show / performanceData.appointments_scheduled) * 100;
            }

            const query = `
                INSERT INTO employee_performance (
                    id, employee_id, period_start, period_end, period_type,
                    patients_seen, new_patients, followup_patients,
                    appointments_completed, appointments_scheduled,
                    appointments_cancelled, appointments_no_show,
                    avg_appointment_duration,
                    prescriptions_written, lab_orders_placed,
                    radiology_orders_placed, procedures_performed,
                    emergency_cases,
                    consultation_revenue, procedure_revenue,
                    lab_commission_revenue, pharmacy_commission_revenue,
                    total_revenue, avg_revenue_per_patient,
                    revenue_target, revenue_achievement_percent,
                    patient_rating_avg, patient_feedback_count,
                    positive_feedback_count, negative_feedback_count,
                    feedback_response_rate, follow_up_rate,
                    no_show_rate, on_time_percentage,
                    patient_satisfaction_score,
                    vs_previous_period_patients, vs_previous_period_revenue,
                    vs_previous_period_rating,
                    vs_department_avg_patients, vs_department_avg_revenue,
                    vs_hospital_avg_patients, vs_hospital_avg_revenue,
                    patient_target, revenue_target_monthly,
                    quality_target_score, targets_achieved,
                    metrics_data, achievements, notes,
                    calculated_at, created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7,
                    $8, $9,
                    $10, $11,
                    $12,
                    $13, $14,
                    $15, $16,
                    $17,
                    $18, $19,
                    $20, $21,
                    $22, $23,
                    $24, $25,
                    $26, $27,
                    $28, $29,
                    $30, $31,
                    $32, $33,
                    $34,
                    $35, $36,
                    $37,
                    $38, $39,
                    $40, $41,
                    $42, $43, $44,
                    $45, $46, $47, $48,
                    $49, $50, NOW(), NOW()
                )
                RETURNING 
                    id, employee_id, period_start, period_end, period_type,
                    patients_seen, total_revenue, patient_rating_avg,
                    created_at
            `;

            const values = [
                performanceData.employee_id,
                performanceData.period_start,
                performanceData.period_end,
                performanceData.period_type,
                performanceData.patients_seen || 0,
                performanceData.new_patients || 0,
                performanceData.followup_patients || 0,
                performanceData.appointments_completed || 0,
                performanceData.appointments_scheduled || 0,
                performanceData.appointments_cancelled || 0,
                performanceData.appointments_no_show || 0,
                performanceData.avg_appointment_duration || null,
                performanceData.prescriptions_written || 0,
                performanceData.lab_orders_placed || 0,
                performanceData.radiology_orders_placed || 0,
                performanceData.procedures_performed || 0,
                performanceData.emergency_cases || 0,
                performanceData.consultation_revenue || 0,
                performanceData.procedure_revenue || 0,
                performanceData.lab_commission_revenue || 0,
                performanceData.pharmacy_commission_revenue || 0,
                totalRevenue,
                avgRevenuePerPatient,
                performanceData.revenue_target || null,
                revenueAchievement,
                performanceData.patient_rating_avg || null,
                performanceData.patient_feedback_count || 0,
                performanceData.positive_feedback_count || 0,
                performanceData.negative_feedback_count || 0,
                performanceData.feedback_response_rate || null,
                followUpRate,
                noShowRate,
                performanceData.on_time_percentage || null,
                performanceData.patient_satisfaction_score || null,
                performanceData.vs_previous_period_patients || null,
                performanceData.vs_previous_period_revenue || null,
                performanceData.vs_previous_period_rating || null,
                performanceData.vs_department_avg_patients || null,
                performanceData.vs_department_avg_revenue || null,
                performanceData.vs_hospital_avg_patients || null,
                performanceData.vs_hospital_avg_revenue || null,
                performanceData.patient_target || null,
                performanceData.revenue_target_monthly || null,
                performanceData.quality_target_score || null,
                performanceData.targets_achieved || null,
                performanceData.metrics_data || null,
                performanceData.achievements || null,
                performanceData.notes || null,
                performanceData.calculated_at || new Date(),
                performanceData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Employee performance record created', {
                performanceId: result.rows[0].id,
                employeeId: performanceData.employee_id,
                periodType: performanceData.period_type,
                patientsSeen: performanceData.patients_seen
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating employee performance record', {
                error: error.message,
                employeeId: performanceData.employee_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update performance record
     * @param {string} id - Performance ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated performance record
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'patients_seen', 'new_patients', 'followup_patients',
                'appointments_completed', 'appointments_scheduled',
                'appointments_cancelled', 'appointments_no_show',
                'avg_appointment_duration',
                'prescriptions_written', 'lab_orders_placed',
                'radiology_orders_placed', 'procedures_performed',
                'emergency_cases',
                'consultation_revenue', 'procedure_revenue',
                'lab_commission_revenue', 'pharmacy_commission_revenue',
                'total_revenue', 'avg_revenue_per_patient',
                'revenue_target', 'revenue_achievement_percent',
                'patient_rating_avg', 'patient_feedback_count',
                'positive_feedback_count', 'negative_feedback_count',
                'feedback_response_rate', 'follow_up_rate',
                'no_show_rate', 'on_time_percentage',
                'patient_satisfaction_score',
                'vs_previous_period_patients', 'vs_previous_period_revenue',
                'vs_previous_period_rating',
                'vs_department_avg_patients', 'vs_department_avg_revenue',
                'vs_hospital_avg_patients', 'vs_hospital_avg_revenue',
                'patient_target', 'revenue_target_monthly',
                'quality_target_score', 'targets_achieved',
                'metrics_data', 'achievements', 'notes'
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
            if (updates.updated_by) {
                setClause.push(`updated_by = $${paramIndex++}`);
                values.push(updates.updated_by);
            }
            values.push(id);

            const query = `
                UPDATE employee_performance 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, employee_id, period_start, period_end,
                    patients_seen, total_revenue,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Employee performance record not found');
            }

            await db.commitTransaction(client);

            logger.info('Employee performance record updated', {
                performanceId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating employee performance record', {
                error: error.message,
                performanceId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get performance summary for department
     * @param {string} departmentId - Department UUID
     * @param {string} periodType - Period type
     * @param {string} periodStart - Period start date
     * @param {string} periodEnd - Period end date
     * @returns {Promise<Object>} Department summary
     */
    async getDepartmentSummary(departmentId, periodType, periodStart, periodEnd) {
        try {
            const query = `
                SELECT 
                    COUNT(DISTINCT ep.employee_id) as employee_count,
                    SUM(ep.patients_seen) as total_patients,
                    AVG(ep.patients_seen)::numeric(10,2) as avg_patients_per_employee,
                    SUM(ep.total_revenue) as total_revenue,
                    AVG(ep.total_revenue)::numeric(10,2) as avg_revenue_per_employee,
                    AVG(ep.patient_rating_avg)::numeric(10,2) as avg_patient_rating,
                    AVG(ep.follow_up_rate)::numeric(10,2) as avg_follow_up_rate,
                    AVG(ep.no_show_rate)::numeric(10,2) as avg_no_show_rate,
                    SUM(ep.prescriptions_written) as total_prescriptions,
                    SUM(ep.lab_orders_placed) as total_lab_orders
                FROM employee_performance ep
                JOIN employees e ON ep.employee_id = e.id
                WHERE e.department_id = $1
                    AND ep.period_type = $2
                    AND ep.period_start = $3
                    AND ep.period_end = $4
                    AND ep.is_deleted = false
            `;

            const result = await db.query(query, [departmentId, periodType, periodStart, periodEnd]);

            logger.debug('Department performance summary retrieved', {
                departmentId,
                periodType,
                periodStart,
                periodEnd
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting department performance summary', {
                error: error.message,
                departmentId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get top performers by metric
     * @param {string} metric - Metric name (patients_seen, total_revenue, patient_rating_avg)
     * @param {string} periodType - Period type
     * @param {string} periodStart - Period start date
     * @param {string} periodEnd - Period end date
     * @param {number} limit - Number of top performers
     * @returns {Promise<Array>} List of top performers
     */
    async getTopPerformers(metric, periodType, periodStart, periodEnd, limit = 10) {
        try {
            const allowedMetrics = ['patients_seen', 'total_revenue', 'patient_rating_avg', 'follow_up_rate'];
            if (!allowedMetrics.includes(metric)) {
                throw new Error(`Invalid metric. Must be one of: ${allowedMetrics.join(', ')}`);
            }

            const query = `
                SELECT 
                    ep.employee_id, ep.${metric} as metric_value,
                    e.first_name, e.last_name, e.employee_id as emp_id,
                    d.name as department_name
                FROM employee_performance ep
                JOIN employees e ON ep.employee_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE ep.period_type = $1
                    AND ep.period_start = $2
                    AND ep.period_end = $3
                    AND ep.is_deleted = false
                ORDER BY ep.${metric} DESC
                LIMIT $4
            `;

            const result = await db.query(query, [periodType, periodStart, periodEnd, limit]);

            logger.debug('Top performers retrieved', {
                metric,
                periodType,
                periodStart,
                periodEnd,
                limit
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting top performers', {
                error: error.message,
                metric
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete performance record
     * @param {string} id - Performance ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE employee_performance 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Employee performance record not found');
            }

            await db.commitTransaction(client);

            logger.info('Employee performance record soft deleted', {
                performanceId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting employee performance record', {
                error: error.message,
                performanceId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = EmployeePerformance;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */