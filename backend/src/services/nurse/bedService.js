/**
 * ======================================================================
 * FILE: backend/src/services/nurse/bedService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse bed management service - Handles business logic for beds.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * - [BR-26] Cleaning required between patients
 * - [BR-27] Max occupancy time 30 days
 * - [BR-28] ICU beds require special authorization
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const bedService = {
    /**
     * Get all beds
     */
    async getAllBeds(nurseId, options = {}) {
        try {
            const { page = 1, limit = 50, ward, status, type, floor } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       EXTRACT(DAY FROM (NOW() - b.assigned_at)) as occupancy_days
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (ward) {
                query += ` AND b.ward = $${paramIndex}`;
                values.push(ward);
                paramIndex++;
            }

            if (status) {
                query += ` AND b.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (type) {
                query += ` AND b.type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            if (floor) {
                query += ` AND b.floor = $${paramIndex}`;
                values.push(floor);
                paramIndex++;
            }

            query += ` ORDER BY b.floor, b.room_number, b.bed_number
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service
                FROM beds
                WHERE 1=1 ${ward ? 'AND ward = $1' : ''}
            `;
            const summaryValues = ward ? [ward] : [];
            const summary = await db.query(summaryQuery, summaryValues);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(summary.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAllBeds', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get beds by ward
     */
    async getBedsByWard(nurseId, ward, options = {}) {
        try {
            const { page = 1, limit = 50, status, type } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       EXTRACT(DAY FROM (NOW() - b.assigned_at)) as occupancy_days
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE b.ward = $1
            `;
            const values = [ward];
            let paramIndex = 2;

            if (status) {
                query += ` AND b.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (type) {
                query += ` AND b.type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            query += ` ORDER BY b.floor, b.room_number, b.bed_number
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
                FROM beds
                WHERE ward = $1
            `;
            const summary = await db.query(summaryQuery, [ward]);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(summary.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getBedsByWard', { error: error.message, nurseId, ward });
            throw error;
        }
    },

    /**
     * Get available beds
     */
    async getAvailableBeds(nurseId, options = {}) {
        try {
            const { page = 1, limit = 50, ward, type, required_equipment } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*
                FROM beds b
                WHERE b.status = 'available'
            `;
            const values = [];
            let paramIndex = 1;

            if (ward) {
                query += ` AND b.ward = $${paramIndex}`;
                values.push(ward);
                paramIndex++;
            }

            if (type) {
                query += ` AND b.type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            if (required_equipment && required_equipment.length > 0) {
                query += ` AND b.equipment_list ?| $${paramIndex}`;
                values.push(required_equipment);
                paramIndex++;
            }

            query += ` ORDER BY b.floor, b.room_number, b.bed_number
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM beds
                WHERE status = 'available'
                ${ward ? 'AND ward = $1' : ''}
            `;
            const countValues = ward ? [ward] : [];
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
            logger.error('Error in getAvailableBeds', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get occupied beds
     */
    async getOccupiedBeds(nurseId, options = {}) {
        try {
            const { page = 1, limit = 50, ward, type, floor } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.medical_conditions,
                       EXTRACT(DAY FROM (NOW() - b.assigned_at)) as occupancy_days,
                       b.assigned_at
                FROM beds b
                JOIN patients p ON b.current_patient_id = p.id
                WHERE b.status = 'occupied'
            `;
            const values = [];
            let paramIndex = 1;

            if (ward) {
                query += ` AND b.ward = $${paramIndex}`;
                values.push(ward);
                paramIndex++;
            }

            if (type) {
                query += ` AND b.type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            if (floor) {
                query += ` AND b.floor = $${paramIndex}`;
                values.push(floor);
                paramIndex++;
            }

            query += ` ORDER BY b.assigned_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Calculate nearing limit [BR-27]
            const now = new Date();
            const bedsWithAlert = result.rows.map(bed => ({
                ...bed,
                nearing_limit: bed.occupancy_days > 25, // Alert 5 days before 30 day limit
                exceeds_limit: bed.occupancy_days > 30
            }));

            const countQuery = `
                SELECT COUNT(*) as total
                FROM beds
                WHERE status = 'occupied'
                ${ward ? 'AND ward = $1' : ''}
            `;
            const countValues = ward ? [ward] : [];
            const count = await db.query(countQuery, countValues);

            // Get average occupancy
            const avgQuery = `
                SELECT AVG(EXTRACT(DAY FROM (NOW() - assigned_at))) as avg_occupancy
                FROM beds
                WHERE status = 'occupied'
                ${ward ? 'AND ward = $1' : ''}
            `;
            const avg = await db.query(avgQuery, countValues);

            return {
                data: bedsWithAlert,
                summary: {
                    total: parseInt(count.rows[0].total),
                    average_occupancy: parseFloat(avg.rows[0].avg_occupancy || 0).toFixed(1),
                    nearing_limit: bedsWithAlert.filter(b => b.nearing_limit).length,
                    exceeds_limit: bedsWithAlert.filter(b => b.exceeds_limit).length
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getOccupiedBeds', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get bed by ID
     */
    async getBedById(nurseId, bedId) {
        try {
            const query = `
                SELECT b.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.medical_conditions,
                       p.allergies,
                       EXTRACT(DAY FROM (NOW() - b.assigned_at)) as occupancy_days,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'cleaned_at', cleaned_at,
                                   'cleaned_by', CONCAT(e.first_name, ' ', e.last_name),
                                   'method', cleaning_method
                               ) ORDER BY cleaned_at DESC
                           )
                           FROM bed_cleaning_logs l
                           LEFT JOIN employees e ON l.cleaned_by = e.id
                           WHERE l.bed_id = b.id
                           LIMIT 5
                       ) as recent_cleaning
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE b.id = $1
            `;

            const result = await db.query(query, [bedId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getBedById', { error: error.message, nurseId, bedId });
            throw error;
        }
    },

    /**
     * Update bed status
     */
    async updateBedStatus(nurseId, bedId, status, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build update query
            const updates = ['status = $1', 'updated_at = NOW()'];
            const values = [status];
            let paramIndex = 2;

            if (data.cleaning_notes) {
                updates.push(`cleaning_notes = $${paramIndex}`);
                values.push(data.cleaning_notes);
                paramIndex++;
            }

            if (data.cleaning_method) {
                updates.push(`cleaning_method = $${paramIndex}`);
                values.push(data.cleaning_method);
                paramIndex++;
            }

            if (data.cleaned_at) {
                updates.push(`last_cleaned = $${paramIndex}`);
                values.push(data.cleaned_at);
                paramIndex++;
            }

            if (data.cleaned_by) {
                updates.push(`last_cleaned_by = $${paramIndex}`);
                values.push(data.cleaned_by);
                paramIndex++;
            }

            if (data.next_cleaning_due) {
                updates.push(`next_cleaning_due = $${paramIndex}`);
                values.push(data.next_cleaning_due);
                paramIndex++;
            }

            if (data.maintenance_reason) {
                updates.push(`maintenance_reason = $${paramIndex}`);
                values.push(data.maintenance_reason);
                paramIndex++;
            }

            values.push(bedId);

            const query = `
                UPDATE beds 
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await client.query(query, values);

            // Log cleaning if applicable
            if (status === 'available' && data.cleaned_by) {
                await client.query(`
                    INSERT INTO bed_cleaning_logs (
                        id, bed_id, cleaned_by, cleaned_at, cleaning_method, notes
                    ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
                `, [
                    bedId,
                    data.cleaned_by,
                    data.cleaned_at || new Date(),
                    data.cleaning_method,
                    data.cleaning_notes
                ]);
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
     * Prepare bed for patient
     */
    async prepareBedForPatient(nurseId, bedId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE beds 
                SET prepared_for = $1,
                    prepared_at = $2,
                    prepared_by = $3,
                    required_equipment = $4,
                    special_requirements = $5,
                    updated_at = NOW()
                WHERE id = $6
                RETURNING *
            `;

            const values = [
                data.patient_type,
                data.prepared_at,
                data.prepared_by,
                data.required_equipment ? JSON.stringify(data.required_equipment) : null,
                data.special_requirements,
                bedId
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
     * Get cleaning schedule
     */
    async getCleaningSchedule(nurseId, options = {}) {
        try {
            const { page = 1, limit = 50, ward, date, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    b.id, b.bed_number, b.room_number, b.ward, b.floor,
                    b.last_cleaned, b.next_cleaning_due,
                    b.cleaning_notes,
                    CASE 
                        WHEN b.next_cleaning_due < NOW() THEN 'overdue'
                        WHEN b.next_cleaning_due <= NOW() + INTERVAL '2 hours' THEN 'due_soon'
                        ELSE 'scheduled'
                    END as cleaning_status,
                    EXTRACT(EPOCH FROM (b.next_cleaning_due - NOW()))/3600 as hours_until_due
                FROM beds b
                WHERE b.next_cleaning_due IS NOT NULL
            `;
            const values = [];
            let paramIndex = 1;

            if (ward) {
                query += ` AND b.ward = $${paramIndex}`;
                values.push(ward);
                paramIndex++;
            }

            if (date) {
                query += ` AND DATE(b.next_cleaning_due) = $${paramIndex}`;
                values.push(date);
                paramIndex++;
            }

            if (status) {
                if (status === 'overdue') {
                    query += ` AND b.next_cleaning_due < NOW()`;
                } else if (status === 'due_soon') {
                    query += ` AND b.next_cleaning_due BETWEEN NOW() AND NOW() + INTERVAL '2 hours'`;
                } else if (status === 'scheduled') {
                    query += ` AND b.next_cleaning_due > NOW() + INTERVAL '2 hours'`;
                }
            }

            query += ` ORDER BY b.next_cleaning_due ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM beds
                WHERE next_cleaning_due IS NOT NULL
                ${ward ? 'AND ward = $1' : ''}
            `;
            const countValues = ward ? [ward] : [];
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
            logger.error('Error in getCleaningSchedule', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Update cleaning task
     */
    async updateCleaningTask(nurseId, taskId, status, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE cleaning_tasks
                SET status = $1,
                    ${status === 'completed' ? 'completed_at = NOW(), completed_by = $2' : ''}
                    notes = COALESCE($3, notes),
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [status, nurseId, data.notes, taskId];
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
     * Get bed statistics
     */
    async getBedStatistics(nurseId, options = {}) {
        try {
            const { ward, from_date, to_date, period = 'day' } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND created_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else if (period === 'day') {
                dateFilter = "AND created_at > NOW() - INTERVAL '1 day'";
            } else if (period === 'week') {
                dateFilter = "AND created_at > NOW() - INTERVAL '7 days'";
            } else if (period === 'month') {
                dateFilter = "AND created_at > NOW() - INTERVAL '30 days'";
            }

            const query = `
                SELECT 
                    COUNT(*) as total_admissions,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    AVG(EXTRACT(EPOCH FROM (discharge_time - admission_time))/86400)::numeric(10,2) as avg_stay_days,
                    COUNT(*) FILTER (WHERE discharge_time IS NULL) as current_inpatients,
                    MAX(EXTRACT(EPOCH FROM (NOW() - admission_time))/86400)::numeric(10,2) as max_stay_days,
                    (
                        SELECT json_agg(
                            json_build_object(
                                'date', date,
                                'admissions', admissions,
                                'discharges', discharges
                            )
                        )
                        FROM (
                            SELECT 
                                DATE(admission_time) as date,
                                COUNT(*) as admissions,
                                COUNT(discharge_time) as discharges
                            FROM bed_assignments
                            WHERE 1=1
                                ${dateFilter}
                            GROUP BY DATE(admission_time)
                            ORDER BY date DESC
                            LIMIT 30
                        ) daily
                    ) as daily_trend
                FROM bed_assignments
                WHERE 1=1
                    ${ward ? 'AND ward = $1' : ''}
                    ${dateFilter}
            `;

            const values = ward ? [ward] : [];
            const result = await db.query(query, values);

            return result.rows[0];
        } catch (error) {
            logger.error('Error in getBedStatistics', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get bed turnover rate
     */
    async getBedTurnoverRate(nurseId, options = {}) {
        try {
            const { ward, days = 30 } = options;

            const query = `
                WITH bed_usage AS (
                    SELECT 
                        bed_id,
                        COUNT(*) as admissions,
                        AVG(EXTRACT(EPOCH FROM (discharge_time - admission_time))/86400) as avg_stay
                    FROM bed_assignments
                    WHERE admission_time > NOW() - INTERVAL '${days} days'
                        ${ward ? 'AND ward = $1' : ''}
                    GROUP BY bed_id
                )
                SELECT 
                    COUNT(DISTINCT bed_id) as total_beds_used,
                    SUM(admissions) as total_admissions,
                    AVG(admissions) as avg_turnover,
                    AVG(avg_stay) as avg_stay_days,
                    (SUM(admissions)::float / COUNT(DISTINCT bed_id)) as turnover_rate
                FROM bed_usage
            `;

            const values = ward ? [ward] : [];
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getBedTurnoverRate', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Export bed report
     */
    async exportBedReport(nurseId, options = {}) {
        try {
            const { ward, from_date, to_date, format = 'pdf' } = options;

            const query = `
                SELECT 
                    b.bed_number, b.room_number, b.ward, b.floor,
                    b.type, b.status,
                    p.id as patient_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    b.assigned_at,
                    EXTRACT(DAY FROM (NOW() - b.assigned_at)) as occupancy_days,
                    b.last_cleaned,
                    b.next_cleaning_due,
                    b.maintenance_reason
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE 1=1
                    ${ward ? 'AND b.ward = $1' : ''}
                ORDER BY b.ward, b.floor, b.room_number, b.bed_number
            `;

            const values = ward ? [ward] : [];
            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual PDF/CSV generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportBedReport', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get bed equipment
     */
    async getBedEquipment(nurseId, bedId) {
        try {
            const query = `
                SELECT 
                    equipment_list,
                    required_equipment,
                    special_requirements
                FROM beds
                WHERE id = $1
            `;

            const result = await db.query(query, [bedId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getBedEquipment', { error: error.message, nurseId, bedId });
            throw error;
        }
    },

    /**
     * Request bed equipment
     */
    async requestBedEquipment(nurseId, bedId, requestData) {
        try {
            const query = `
                INSERT INTO equipment_requests (
                    id, bed_id, equipment_type, quantity,
                    reason, priority, required_by,
                    requested_by, requested_at, status,
                    created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW()
                ) RETURNING *
            `;

            const values = [
                bedId,
                requestData.equipment_type,
                requestData.quantity,
                requestData.reason,
                requestData.priority,
                requestData.required_by,
                requestData.requested_by,
                requestData.requested_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in requestBedEquipment', { error: error.message, nurseId, bedId });
            throw error;
        }
    },

    /**
     * Assign patient to bed
     */
    async assignPatientToBed(nurseId, bedId, assignmentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Update bed
            const bedQuery = `
                UPDATE beds 
                SET current_patient_id = $1,
                    status = 'occupied',
                    assigned_at = $2,
                    assigned_by = $3,
                    expected_discharge = $4,
                    assignment_notes = $5,
                    updated_at = NOW()
                WHERE id = $6
                RETURNING *
            `;

            const bedValues = [
                assignmentData.patient_id,
                assignmentData.assigned_at,
                assignmentData.assigned_by,
                assignmentData.expected_discharge,
                assignmentData.notes,
                bedId
            ];

            const bedResult = await client.query(bedQuery, bedValues);

            // Create assignment record
            await client.query(`
                INSERT INTO bed_assignments (
                    id, bed_id, patient_id, ward, room_number, bed_number,
                    admission_time, assigned_by, expected_discharge, notes
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9
                )
            `, [
                bedId,
                assignmentData.patient_id,
                bedResult.rows[0].ward,
                bedResult.rows[0].room_number,
                bedResult.rows[0].bed_number,
                assignmentData.assigned_at,
                assignmentData.assigned_by,
                assignmentData.expected_discharge,
                assignmentData.notes
            ]);

            await db.commitTransaction(client);

            return bedResult.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Validate patient for assignment
     */
    async validatePatientForAssignment(patientId, bedType) {
        try {
            const query = `
                SELECT p.*, 
                       b.id as bed_id
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id AND b.status = 'occupied'
                WHERE p.id = $1 AND p.is_deleted = false
            `;

            const result = await db.query(query, [patientId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const patient = result.rows[0];

            // Check if already assigned
            if (patient.bed_id) {
                throw new Error('Patient already assigned to a bed');
            }

            // Check if bed type matches patient needs
            if (bedType === 'icu' && !patient.requires_icu) {
                // Can still assign, but will be flagged
            }

            return patient;
        } catch (error) {
            logger.error('Error in validatePatientForAssignment', { error: error.message, patientId });
            throw error;
        }
    },

    /**
     * Discharge patient from bed
     */
    async dischargePatientFromBed(nurseId, bedId, dischargeData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get current patient
            const bedQuery = `SELECT current_patient_id FROM beds WHERE id = $1`;
            const bed = await client.query(bedQuery, [bedId]);
            
            const patientId = bed.rows[0]?.current_patient_id;

            // Update bed
            const updateQuery = `
                UPDATE beds 
                SET current_patient_id = NULL,
                    status = $1,
                    discharged_at = $2,
                    discharged_by = $3,
                    discharge_notes = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const updateValues = [
                dischargeData.next_status || 'cleaning',
                dischargeData.discharged_at,
                dischargeData.discharged_by,
                dischargeData.discharge_notes,
                bedId
            ];

            const result = await client.query(updateQuery, updateValues);

            // Update assignment record
            if (patientId) {
                await client.query(`
                    UPDATE bed_assignments
                    SET discharge_time = $1,
                        discharged_by = $2,
                        discharge_notes = $3
                    WHERE bed_id = $4 AND discharge_time IS NULL
                `, [
                    dischargeData.discharged_at,
                    dischargeData.discharged_by,
                    dischargeData.discharge_notes,
                    bedId
                ]);
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
     * Notify maintenance department
     */
    async notifyMaintenanceDepartment(maintenanceData) {
        try {
            // TODO: Implement actual notification
            // - Send email to maintenance department
            // - Create maintenance ticket
            // - Push notification to maintenance staff
            
            logger.info('Maintenance notification sent', maintenanceData);
            
            // For now, just log it
            await db.query(`
                INSERT INTO maintenance_notifications (
                    id, bed_id, issue_type, priority,
                    requested_by, description, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
                )
            `, [
                maintenanceData.bedId,
                maintenanceData.issueType,
                maintenanceData.priority,
                maintenanceData.requestedBy,
                maintenanceData.description
            ]);
        } catch (error) {
            logger.error('Error in notifyMaintenanceDepartment', { error: error.message });
        }
    }
};

module.exports = bedService;