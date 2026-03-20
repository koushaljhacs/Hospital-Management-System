/**
 * ======================================================================
 * FILE: backend/src/services/receptionist/bedService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Receptionist bed service - Handles bed allocation and management business logic.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-24] Bed status workflow
 * - [BR-25] Cannot assign occupied bed
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const bedService = {
    /**
     * Get all beds
     */
    async getAllBeds(receptionistId, options = {}) {
        try {
            const { page = 1, limit = 50, ward, status, type, floor } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       EXTRACT(DAY FROM (NOW() - b.assigned_at)) as occupancy_days,
                       CASE 
                           WHEN b.next_cleaning < NOW() THEN true
                           ELSE false
                       END as cleaning_overdue
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE b.is_deleted = false
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

            const countQuery = `
                SELECT COUNT(*) as total
                FROM beds
                WHERE is_deleted = false
                ${ward ? 'AND ward = $1' : ''}
            `;
            const countValues = ward ? [ward] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service
                FROM beds
                WHERE is_deleted = false
                ${ward ? 'AND ward = $1' : ''}
            `;
            const summary = await db.query(summaryQuery, countValues);

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
            logger.error('Error in getAllBeds', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get available beds [BR-25]
     */
    async getAvailableBeds(receptionistId, options = {}) {
        try {
            const { page = 1, limit = 50, ward, type, required_equipment } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*,
                       CASE 
                           WHEN b.next_cleaning < NOW() THEN 'cleaning_needed'
                           ELSE 'ready'
                       END as readiness
                FROM beds b
                WHERE b.status = 'available' 
                    AND b.is_deleted = false
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
                WHERE status = 'available' AND is_deleted = false
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
            logger.error('Error in getAvailableBeds', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get beds by ward
     */
    async getBedsByWard(receptionistId, ward, options = {}) {
        try {
            const { page = 1, limit = 50, status, type } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE b.ward = $1 AND b.is_deleted = false
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

            const countQuery = `
                SELECT COUNT(*) as total
                FROM beds
                WHERE ward = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [ward]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getBedsByWard', { error: error.message, receptionistId, ward });
            throw error;
        }
    },

    /**
     * Get beds by type
     */
    async getBedsByType(receptionistId, type, options = {}) {
        try {
            const { page = 1, limit = 50, ward, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT b.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE b.type = $1 AND b.is_deleted = false
            `;
            const values = [type];
            let paramIndex = 2;

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

            query += ` ORDER BY b.floor, b.room_number, b.bed_number
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM beds
                WHERE type = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [type]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getBedsByType', { error: error.message, receptionistId, type });
            throw error;
        }
    },

    /**
     * Get bed by ID
     */
    async getBedById(receptionistId, bedId) {
        try {
            const query = `
                SELECT b.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.medical_conditions,
                       EXTRACT(DAY FROM (NOW() - b.assigned_at)) as occupancy_days,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', bh.id,
                                   'patient_id', bh.patient_id,
                                   'assigned_at', bh.assigned_at,
                                   'discharged_at', bh.discharged_at,
                                   'patient_name', CONCAT(pat.first_name, ' ', pat.last_name)
                               ) ORDER BY bh.assigned_at DESC
                           )
                           FROM bed_history bh
                           LEFT JOIN patients pat ON bh.patient_id = pat.id
                           WHERE bh.bed_id = b.id
                           LIMIT 10
                       ) as recent_history
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                WHERE b.id = $1 AND b.is_deleted = false
            `;

            const result = await db.query(query, [bedId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getBedById', { error: error.message, receptionistId, bedId });
            throw error;
        }
    },

    /**
     * Validate patient for allocation
     */
    async validatePatientForAllocation(patientId) {
        try {
            const query = `
                SELECT p.*, 
                       b.id as current_bed_id,
                       b.bed_number as current_bed
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id AND b.status = 'occupied'
                WHERE p.id = $1 AND p.is_deleted = false
            `;

            const result = await db.query(query, [patientId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in validatePatientForAllocation', { error: error.message, patientId });
            throw error;
        }
    },

    /**
     * Allocate bed to patient
     */
    async allocateBed(receptionistId, allocationData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if bed is still available [BR-25]
            const bedCheck = await client.query(`
                SELECT status FROM beds WHERE id = $1
            `, [allocationData.bed_id]);

            if (bedCheck.rows.length === 0) {
                throw new Error('Bed not found');
            }

            if (bedCheck.rows[0].status !== 'available') {
                throw new Error('Bed is no longer available');
            }

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
                allocationData.patient_id,
                allocationData.allocated_at,
                allocationData.allocated_by,
                allocationData.expected_discharge,
                allocationData.notes,
                allocationData.bed_id
            ];

            const bedResult = await client.query(bedQuery, bedValues);

            // Create history record
            await client.query(`
                INSERT INTO bed_history (
                    id, bed_id, patient_id, ward, room_number, bed_number,
                    assigned_at, assigned_by, expected_discharge, notes
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9
                )
            `, [
                allocationData.bed_id,
                allocationData.patient_id,
                bedResult.rows[0].ward,
                bedResult.rows[0].room_number,
                bedResult.rows[0].bed_number,
                allocationData.allocated_at,
                allocationData.allocated_by,
                allocationData.expected_discharge,
                allocationData.notes
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
     * Vacate bed [BR-24]
     */
    async vacateBed(receptionistId, bedId, vacateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get current patient
            const bedQuery = `SELECT current_patient_id, ward, room_number, bed_number FROM beds WHERE id = $1`;
            const bed = await client.query(bedQuery, [bedId]);
            
            const patientId = bed.rows[0]?.current_patient_id;

            // Update bed history
            if (patientId) {
                await client.query(`
                    UPDATE bed_history
                    SET discharged_at = $1,
                        discharge_notes = $2
                    WHERE bed_id = $3 AND discharged_at IS NULL
                `, [vacateData.vacated_at, vacateData.discharge_notes, bedId]);
            }

            // Update bed status [BR-24]
            const updateQuery = `
                UPDATE beds 
                SET current_patient_id = NULL,
                    status = $1,
                    vacated_at = $2,
                    vacated_by = $3,
                    discharge_notes = $4,
                    next_cleaning = NOW() + INTERVAL '1 hour',
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const updateValues = [
                vacateData.next_status,
                vacateData.vacated_at,
                vacateData.vacated_by,
                vacateData.discharge_notes,
                bedId
            ];

            const result = await client.query(updateQuery, updateValues);

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
     * Get occupancy report
     */
    async getOccupancyReport(receptionistId, options = {}) {
        try {
            const { ward, from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND bh.assigned_at BETWEEN '${from_date}' AND '${to_date}'`;
            }

            let wardFilter = '';
            if (ward) {
                wardFilter = `AND b.ward = '${ward}'`;
            }

            const query = `
                WITH occupancy_stats AS (
                    SELECT 
                        b.id, b.bed_number, b.room_number, b.ward,
                        b.type, b.status,
                        COUNT(bh.id) as total_assignments,
                        AVG(EXTRACT(EPOCH FROM (bh.discharged_at - bh.assigned_at))/86400)::numeric(10,2) as avg_stay_days,
                        SUM(EXTRACT(EPOCH FROM (bh.discharged_at - bh.assigned_at))/86400)::numeric(10,2) as total_occupied_days
                    FROM beds b
                    LEFT JOIN bed_history bh ON b.id = bh.bed_id
                        ${dateFilter}
                    WHERE b.is_deleted = false
                        ${wardFilter}
                    GROUP BY b.id
                ),
                daily_occupancy AS (
                    SELECT 
                        DATE(bh.assigned_at) as date,
                        COUNT(DISTINCT bh.bed_id) as occupied_beds,
                        COUNT(DISTINCT bh.patient_id) as unique_patients
                    FROM bed_history bh
                    WHERE 1=1
                        ${dateFilter}
                        ${wardFilter}
                    GROUP BY DATE(bh.assigned_at)
                    ORDER BY date
                )
                SELECT 
                    (SELECT json_agg(occupancy_stats.*) FROM occupancy_stats) as bed_stats,
                    (SELECT json_agg(daily_occupancy.*) FROM daily_occupancy) as daily_trend,
                    (
                        SELECT 
                            json_build_object(
                                'total_beds', COUNT(*),
                                'occupied_beds', COUNT(*) FILTER (WHERE status = 'occupied'),
                                'available_beds', COUNT(*) FILTER (WHERE status = 'available'),
                                'occupancy_rate', (COUNT(*) FILTER (WHERE status = 'occupied')::float / COUNT(*) * 100)::numeric(5,2)
                            )
                        FROM beds b
                        WHERE b.is_deleted = false
                            ${wardFilter}
                    ) as summary
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getOccupancyReport', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get ward-wise occupancy
     */
    async getWardWiseOccupancy(receptionistId) {
        try {
            const query = `
                SELECT 
                    ward,
                    COUNT(*) as total_beds,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    (COUNT(*) FILTER (WHERE status = 'occupied')::float / COUNT(*) * 100)::numeric(5,2) as occupancy_rate
                FROM beds
                WHERE is_deleted = false
                GROUP BY ward
                ORDER BY ward
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getWardWiseOccupancy', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get occupancy trends
     */
    async getOccupancyTrends(receptionistId, days = 30) {
        try {
            const query = `
                WITH daily AS (
                    SELECT 
                        DATE(bh.assigned_at) as date,
                        COUNT(DISTINCT bh.bed_id) as occupied_beds,
                        COUNT(DISTINCT bh.patient_id) as admissions,
                        COUNT(DISTINCT CASE WHEN bh.discharged_at IS NOT NULL THEN bh.patient_id END) as discharges
                    FROM bed_history bh
                    WHERE bh.assigned_at > NOW() - INTERVAL '${days} days'
                    GROUP BY DATE(bh.assigned_at)
                )
                SELECT 
                    date,
                    occupied_beds,
                    admissions,
                    discharges,
                    occupied_beds - LAG(occupied_beds) OVER (ORDER BY date) as daily_change
                FROM daily
                ORDER BY date DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getOccupancyTrends', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get bed statistics
     */
    async getBedStatistics(receptionistId, period = 'day') {
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
                WITH stats AS (
                    SELECT 
                        COUNT(*) as total_beds,
                        COUNT(*) FILTER (WHERE status = 'occupied') as currently_occupied,
                        COUNT(*) FILTER (WHERE status = 'available') as available,
                        (
                            SELECT COUNT(*)
                            FROM bed_history
                            WHERE assigned_at > NOW() - ${interval}
                        ) as admissions,
                        (
                            SELECT COUNT(*)
                            FROM bed_history
                            WHERE discharged_at > NOW() - ${interval}
                        ) as discharges,
                        (
                            SELECT AVG(EXTRACT(EPOCH FROM (discharged_at - assigned_at))/86400)::numeric(10,2)
                            FROM bed_history
                            WHERE discharged_at > NOW() - ${interval}
                        ) as avg_stay_days
                    FROM beds
                    WHERE is_deleted = false
                )
                SELECT * FROM stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getBedStatistics', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get bed turnover rate
     */
    async getBedTurnoverRate(receptionistId, days = 30) {
        try {
            const query = `
                WITH bed_usage AS (
                    SELECT 
                        bed_id,
                        COUNT(*) as admissions,
                        AVG(EXTRACT(EPOCH FROM (discharged_at - assigned_at))/86400) as avg_stay
                    FROM bed_history
                    WHERE assigned_at > NOW() - INTERVAL '${days} days'
                    GROUP BY bed_id
                )
                SELECT 
                    COUNT(DISTINCT bed_id) as active_beds,
                    SUM(admissions) as total_admissions,
                    AVG(admissions) as avg_turnover,
                    AVG(avg_stay) as avg_stay_days,
                    (SUM(admissions)::float / COUNT(DISTINCT bed_id)) as turnover_rate
                FROM bed_usage
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getBedTurnoverRate', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Request maintenance
     */
    async requestMaintenance(receptionistId, bedId, requestData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Update bed status
            await client.query(`
                UPDATE beds 
                SET status = 'maintenance',
                    maintenance_reason = $1,
                    maintenance_requested_at = $2,
                    maintenance_requested_by = $3,
                    updated_at = NOW()
                WHERE id = $4
            `, [
                requestData.reason,
                requestData.requested_at,
                requestData.requested_by,
                bedId
            ]);

            // Create maintenance request
            const query = `
                INSERT INTO maintenance_requests (
                    id, bed_id, issue_type, priority, description,
                    requested_by, requested_at, status, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'pending', NOW()
                ) RETURNING *
            `;

            const values = [
                bedId,
                requestData.issue_type,
                requestData.priority,
                requestData.description,
                requestData.requested_by,
                requestData.requested_at
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
     * Get maintenance requests
     */
    async getMaintenanceRequests(receptionistId, options = {}) {
        try {
            const { page = 1, limit = 20, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT mr.*, 
                       b.bed_number, b.room_number, b.ward,
                       CONCAT(e.first_name, ' ', e.last_name) as requested_by_name
                FROM maintenance_requests mr
                JOIN beds b ON mr.bed_id = b.id
                LEFT JOIN employees e ON mr.requested_by = e.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND mr.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` ORDER BY mr.requested_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM maintenance_requests
                WHERE 1=1
                ${status ? 'AND status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
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
            logger.error('Error in getMaintenanceRequests', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Get bed history
     */
    async getBedHistory(receptionistId, bedId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT bh.*, 
                       CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                       CONCAT(e.first_name, ' ', e.last_name) as assigned_by_name
                FROM bed_history bh
                LEFT JOIN patients p ON bh.patient_id = p.id
                LEFT JOIN employees e ON bh.assigned_by = e.id
                WHERE bh.bed_id = $1
                ORDER BY bh.assigned_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [bedId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM bed_history
                WHERE bed_id = $1
            `;
            const count = await db.query(countQuery, [bedId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getBedHistory', { error: error.message, receptionistId, bedId });
            throw error;
        }
    },

    /**
     * Get patient bed history
     */
    async getPatientBedHistory(receptionistId, patientId) {
        try {
            const query = `
                SELECT bh.*, 
                       b.bed_number, b.room_number, b.ward, b.type,
                       CONCAT(e.first_name, ' ', e.last_name) as assigned_by_name
                FROM bed_history bh
                JOIN beds b ON bh.bed_id = b.id
                LEFT JOIN employees e ON bh.assigned_by = e.id
                WHERE bh.patient_id = $1
                ORDER BY bh.assigned_at DESC
            `;

            const result = await db.query(query, [patientId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPatientBedHistory', { error: error.message, receptionistId, patientId });
            throw error;
        }
    },

    /**
     * Get bed alerts
     */
    async getBedAlerts(receptionistId) {
        try {
            const query = `
                SELECT 
                    'low_availability' as type,
                    ward,
                    COUNT(*) as available_beds,
                    CASE 
                        WHEN COUNT(*) <= 2 THEN 'critical'
                        WHEN COUNT(*) <= 5 THEN 'warning'
                        ELSE 'info'
                    END as severity
                FROM beds
                WHERE status = 'available' AND is_deleted = false
                GROUP BY ward
                HAVING COUNT(*) <= 5
                
                UNION ALL
                
                SELECT 
                    'maintenance_due' as type,
                    b.ward,
                    COUNT(*) as count,
                    CASE 
                        WHEN COUNT(*) >= 3 THEN 'critical'
                        WHEN COUNT(*) >= 1 THEN 'warning'
                        ELSE 'info'
                    END as severity
                FROM beds b
                WHERE b.status = 'maintenance' AND b.is_deleted = false
                GROUP BY b.ward
                
                UNION ALL
                
                SELECT 
                    'cleaning_due' as type,
                    b.ward,
                    COUNT(*) as count,
                    CASE 
                        WHEN COUNT(*) >= 3 THEN 'critical'
                        ELSE 'warning'
                    END as severity
                FROM beds b
                WHERE b.next_cleaning < NOW() 
                    AND b.status = 'occupied'
                    AND b.is_deleted = false
                GROUP BY b.ward
                
                ORDER BY 
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'warning' THEN 2
                        ELSE 3
                    END
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getBedAlerts', { error: error.message, receptionistId });
            throw error;
        }
    },

    /**
     * Set bed notification
     */
    async setBedNotification(receptionistId, notificationData) {
        try {
            const query = `
                INSERT INTO bed_notifications (
                    id, bed_type, ward, notification_email,
                    notify_when_available, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6
                ) RETURNING *
            `;

            const values = [
                notificationData.bed_type || null,
                notificationData.ward || null,
                notificationData.notification_email,
                notificationData.notify_when_available,
                receptionistId,
                notificationData.created_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in setBedNotification', { error: error.message, receptionistId });
            throw error;
        }
    }
};

module.exports = bedService;