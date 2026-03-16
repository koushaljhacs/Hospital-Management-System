/**
 * ======================================================================
 * FILE: backend/src/services/nurse/patientCareService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Nurse patient care service - Handles business logic for patient care.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const patientCareService = {
    /**
     * Get assigned patients for nurse
     */
    async getAssignedPatients(nurseId, options = {}) {
        try {
            const { page = 1, limit = 20, ward, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.date_of_birth,
                    p.gender, p.blood_group, p.phone,
                    b.bed_number, b.room_number, b.ward,
                    b.status as bed_status,
                    (
                        SELECT COUNT(*) FROM vitals v 
                        WHERE v.patient_id = p.id AND v.created_at > NOW() - INTERVAL '24 hours'
                    ) as vitals_today,
                    (
                        SELECT COUNT(*) FROM medications m 
                        WHERE m.patient_id = p.id AND m.status = 'scheduled'
                    ) as pending_medications,
                    (
                        SELECT COUNT(*) FROM tasks t 
                        WHERE t.patient_id = p.id AND t.status = 'pending'
                    ) as pending_tasks
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id
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

            query += ` ORDER BY b.room_number, b.bed_number
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `SELECT COUNT(*) as total FROM patients p
                                LEFT JOIN beds b ON p.id = b.current_patient_id
                                WHERE 1=1 ${ward ? 'AND b.ward = $1' : ''}`;
            const countValues = ward ? [ward] : [];
            const countResult = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getAssignedPatients', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Search patients
     */
    async searchPatients(nurseId, searchTerm, options = {}) {
        try {
            const { page = 1, limit = 20, ward } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.date_of_birth,
                    p.gender, p.blood_group, p.phone,
                    b.bed_number, b.room_number, b.ward,
                    b.status as bed_status
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE (
                    p.first_name ILIKE $1 OR 
                    p.last_name ILIKE $1 OR 
                    p.phone ILIKE $1
                )
                ${ward ? 'AND b.ward = $2' : ''}
                ORDER BY p.first_name
                LIMIT $${ward ? 3 : 2} OFFSET $${ward ? 4 : 3}
            `;

            const values = [`%${searchTerm}%`];
            if (ward) values.push(ward);
            values.push(limit, offset);

            const result = await db.query(query, values);
            return { data: result.rows };
        } catch (error) {
            logger.error('Error in searchPatients', { error: error.message, nurseId });
            throw error;
        }
    },

    /**
     * Get patient by ID
     */
    async getPatientById(nurseId, patientId) {
        try {
            const query = `
                SELECT 
                    p.*,
                    b.bed_number, b.room_number, b.ward,
                    b.status as bed_status,
                    b.assigned_at as bed_assigned_at
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE p.id = $1 AND p.is_deleted = false
            `;

            const result = await db.query(query, [patientId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPatientById', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get patient vitals
     */
    async getPatientVitals(nurseId, patientId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT * FROM vitals
                WHERE patient_id = $1
            `;
            const values = [patientId];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND recorded_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND recorded_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY recorded_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get latest vitals
            const latestQuery = `
                SELECT * FROM vitals
                WHERE patient_id = $1
                ORDER BY recorded_at DESC
                LIMIT 1
            `;
            const latest = await db.query(latestQuery, [patientId]);

            return {
                data: result.rows,
                latest: latest.rows[0] || null,
                pagination: {
                    page,
                    limit,
                    total: result.rows.length
                }
            };
        } catch (error) {
            logger.error('Error in getPatientVitals', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get patient medications
     */
    async getPatientMedications(nurseId, patientId, options = {}) {
        try {
            const { page = 1, limit = 20, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT * FROM medications
                WHERE patient_id = $1
            `;
            const values = [patientId];
            let paramIndex = 2;

            if (status) {
                query += ` AND status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` ORDER BY scheduled_time ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get summary
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
                    COUNT(*) FILTER (WHERE status = 'administered') as administered,
                    COUNT(*) FILTER (WHERE status = 'missed') as missed
                FROM medications
                WHERE patient_id = $1
            `;
            const summary = await db.query(summaryQuery, [patientId]);

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
            logger.error('Error in getPatientMedications', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get patient tasks
     */
    async getPatientTasks(nurseId, patientId, options = {}) {
        try {
            const { page = 1, limit = 20, status, priority } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT * FROM tasks
                WHERE patient_id = $1
            `;
            const values = [patientId];
            let paramIndex = 2;

            if (status) {
                query += ` AND status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (priority) {
                query += ` AND priority = $${paramIndex}`;
                values.push(priority);
                paramIndex++;
            }

            query += ` ORDER BY due_time ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            return { data: result.rows };
        } catch (error) {
            logger.error('Error in getPatientTasks', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get patient summary
     */
    async getPatientSummary(nurseId, patientId) {
        try {
            const query = `
                SELECT 
                    p.id, p.first_name, p.last_name, p.date_of_birth,
                    p.gender, p.blood_group, p.allergies, p.medical_conditions,
                    b.bed_number, b.room_number, b.ward,
                    (
                        SELECT json_agg(v.* ORDER BY v.recorded_at DESC)
                        FROM vitals v
                        WHERE v.patient_id = p.id
                        LIMIT 5
                    ) as recent_vitals,
                    (
                        SELECT json_agg(m.* ORDER BY m.scheduled_time ASC)
                        FROM medications m
                        WHERE m.patient_id = p.id AND m.status = 'scheduled'
                        LIMIT 5
                    ) as upcoming_medications,
                    (
                        SELECT json_agg(t.* ORDER BY t.due_time ASC)
                        FROM tasks t
                        WHERE t.patient_id = p.id AND t.status = 'pending'
                        LIMIT 5
                    ) as pending_tasks
                FROM patients p
                LEFT JOIN beds b ON p.id = b.current_patient_id
                WHERE p.id = $1
            `;

            const result = await db.query(query, [patientId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getPatientSummary', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get patient alerts
     */
    async getPatientAlerts(nurseId, patientId) {
        try {
            const query = `
                SELECT 
                    p.allergies,
                    p.medical_conditions,
                    (
                        SELECT json_agg(v.*)
                        FROM vitals v
                        WHERE v.patient_id = p.id 
                            AND v.is_critical = true
                            AND v.acknowledged = false
                    ) as critical_vitals,
                    (
                        SELECT json_agg(m.*)
                        FROM medications m
                        WHERE m.patient_id = p.id 
                            AND m.is_controlled = true
                            AND m.status = 'scheduled'
                    ) as controlled_medications
                FROM patients p
                WHERE p.id = $1
            `;

            const result = await db.query(query, [patientId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getPatientAlerts', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get patients by room
     */
    async getPatientsByRoom(nurseId, room) {
        try {
            const query = `
                SELECT 
                    p.id, p.first_name, p.last_name,
                    b.bed_number, b.bed_number
                FROM patients p
                JOIN beds b ON p.id = b.current_patient_id
                WHERE b.room_number = $1
                ORDER BY b.bed_number
            `;

            const result = await db.query(query, [room]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPatientsByRoom', { error: error.message, nurseId, room });
            throw error;
        }
    },

    /**
     * Get ward census
     */
    async getWardCensus(nurseId, ward) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_beds,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied_beds,
                    COUNT(*) FILTER (WHERE status = 'available') as available_beds,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning_beds,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance_beds,
                    json_agg(
                        json_build_object(
                            'bed_id', id,
                            'bed_number', bed_number,
                            'room_number', room_number,
                            'status', status,
                            'patient_name', (
                                SELECT CONCAT(first_name, ' ', last_name)
                                FROM patients
                                WHERE id = current_patient_id
                            )
                        )
                    ) as beds
                FROM beds
                WHERE ward = $1
                GROUP BY ward
            `;

            const result = await db.query(query, [ward]);
            return result.rows[0] || {
                total_beds: 0,
                occupied_beds: 0,
                available_beds: 0,
                beds: []
            };
        } catch (error) {
            logger.error('Error in getWardCensus', { error: error.message, nurseId, ward });
            throw error;
        }
    },

    /**
     * Add patient note
     */
    async addPatientNote(nurseId, patientId, noteData) {
        try {
            const query = `
                INSERT INTO patient_notes (
                    id, patient_id, nurse_id, note, type,
                    created_at
                ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
                RETURNING *
            `;

            const values = [
                patientId,
                nurseId,
                noteData.note,
                noteData.type,
                noteData.created_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in addPatientNote', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Get patient notes
     */
    async getPatientNotes(nurseId, patientId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT n.*, e.first_name, e.last_name
                FROM patient_notes n
                JOIN employees e ON n.nurse_id = e.id
                WHERE n.patient_id = $1
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [patientId, limit, offset]);
            return { data: result.rows };
        } catch (error) {
            logger.error('Error in getPatientNotes', { error: error.message, nurseId, patientId });
            throw error;
        }
    },

    /**
     * Transfer patient
     */
    async transferPatient(nurseId, patientId, transferData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get current bed
            const currentBedQuery = `
                SELECT * FROM beds WHERE current_patient_id = $1
            `;
            const currentBed = await client.query(currentBedQuery, [patientId]);

            if (currentBed.rows.length > 0) {
                // Vacate current bed
                await client.query(`
                    UPDATE beds 
                    SET current_patient_id = NULL,
                        status = 'cleaning',
                        updated_at = NOW()
                    WHERE id = $1
                `, [currentBed.rows[0].id]);
            }

            // Get target bed
            const targetBedQuery = `
                SELECT * FROM beds 
                WHERE ward = $1 AND room_number = $2 AND bed_number = $3
            `;
            const targetBed = await client.query(targetBedQuery, [
                transferData.target_ward,
                transferData.target_room,
                transferData.target_bed
            ]);

            if (targetBed.rows.length === 0) {
                throw new Error('Target bed not found');
            }

            if (targetBed.rows[0].status !== 'available') {
                throw new Error('Target bed not available');
            }

            // Assign new bed
            await client.query(`
                UPDATE beds 
                SET current_patient_id = $1,
                    status = 'occupied',
                    assigned_at = NOW(),
                    assigned_by = $2,
                    updated_at = NOW()
                WHERE id = $3
            `, [patientId, nurseId, targetBed.rows[0].id]);

            // Log transfer
            await client.query(`
                INSERT INTO patient_transfers (
                    id, patient_id, from_bed_id, to_bed_id,
                    transferred_by, reason, transferred_at
                ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
            `, [
                patientId,
                currentBed.rows[0]?.id || null,
                targetBed.rows[0].id,
                nurseId,
                transferData.reason
            ]);

            await db.commitTransaction(client);

            return {
                from_ward: currentBed.rows[0]?.ward,
                to_ward: transferData.target_ward
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Discharge patient
     */
    async dischargePatient(nurseId, patientId, dischargeData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get current bed
            const bedQuery = `
                SELECT * FROM beds WHERE current_patient_id = $1
            `;
            const bed = await client.query(bedQuery, [patientId]);

            if (bed.rows.length > 0) {
                // Vacate bed
                await client.query(`
                    UPDATE beds 
                    SET current_patient_id = NULL,
                        status = 'cleaning',
                        updated_at = NOW()
                    WHERE id = $1
                `, [bed.rows[0].id]);
            }

            // Update patient status
            await client.query(`
                UPDATE patients 
                SET status = 'discharged',
                    discharge_date = $1,
                    discharge_notes = $2,
                    discharged_by = $3,
                    updated_at = NOW()
                WHERE id = $4
            `, [
                dischargeData.discharge_date,
                dischargeData.discharge_notes,
                dischargeData.discharged_by,
                patientId
            ]);

            await db.commitTransaction(client);

            return { success: true };
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = patientCareService;