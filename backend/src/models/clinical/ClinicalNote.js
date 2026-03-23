/**
 * ======================================================================
 * FILE: backend/src/models/clinical/ClinicalNote.js
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
 * ClinicalNote model for database operations.
 * Handles all clinical note-related queries for SOAP format documentation.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: clinical_notes
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients)
 * - doctor_id: UUID (foreign key to employees)
 * - appointment_id: UUID (foreign key to appointments)
 * - note_type: enum (progress, subjective, objective, assessment, plan)
 * - title: string
 * - content: text
 * - is_structured: boolean
 * - sections: jsonb (SOAP format)
 * - is_urgent: boolean
 * - requires_follow_up: boolean
 * - follow_up_date: date
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

const ClinicalNote = {
    /**
     * Table name
     */
    tableName: 'clinical_notes',

    /**
     * Find clinical note by ID
     * @param {string} id - ClinicalNote UUID
     * @returns {Promise<Object|null>} ClinicalNote object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    cn.id, cn.patient_id, cn.doctor_id, cn.appointment_id,
                    cn.note_type, cn.title, cn.content,
                    cn.is_structured, cn.sections,
                    cn.is_urgent, cn.requires_follow_up, cn.follow_up_date,
                    cn.created_at, cn.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    e.designation as doctor_designation
                FROM clinical_notes cn
                JOIN patients p ON cn.patient_id = p.id
                JOIN employees e ON cn.doctor_id = e.id
                WHERE cn.id = $1 AND cn.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Clinical note found by ID', { noteId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding clinical note by ID', {
                error: error.message,
                noteId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find clinical notes by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of clinical notes
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, note_type, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['cn.is_deleted = false'];

            if (note_type) {
                conditions.push(`cn.note_type = $${paramIndex++}`);
                values.push(note_type);
            }
            if (from_date) {
                conditions.push(`cn.created_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`cn.created_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    cn.id, cn.patient_id, cn.doctor_id,
                    cn.note_type, cn.title, cn.content,
                    cn.is_structured, cn.sections,
                    cn.is_urgent, cn.requires_follow_up, cn.follow_up_date,
                    cn.created_at,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM clinical_notes cn
                JOIN employees e ON cn.doctor_id = e.id
                ${whereClause}
                ORDER BY cn.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Clinical notes found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding clinical notes by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find clinical notes by doctor ID
     * @param {string} doctorId - Doctor UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of clinical notes
     */
    async findByDoctorId(doctorId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [doctorId];
            let paramIndex = 2;
            const conditions = ['cn.is_deleted = false'];

            if (from_date) {
                conditions.push(`cn.created_at >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`cn.created_at <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    cn.id, cn.patient_id, cn.doctor_id,
                    cn.note_type, cn.title, cn.content,
                    cn.is_structured, cn.sections,
                    cn.is_urgent, cn.requires_follow_up, cn.follow_up_date,
                    cn.created_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM clinical_notes cn
                JOIN patients p ON cn.patient_id = p.id
                ${whereClause}
                ORDER BY cn.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Clinical notes found by doctor ID', {
                doctorId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding clinical notes by doctor ID', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find clinical notes by appointment ID
     * @param {string} appointmentId - Appointment UUID
     * @returns {Promise<Array>} List of clinical notes
     */
    async findByAppointmentId(appointmentId) {
        try {
            const query = `
                SELECT 
                    cn.id, cn.patient_id, cn.doctor_id,
                    cn.note_type, cn.title, cn.content,
                    cn.is_structured, cn.sections,
                    cn.is_urgent, cn.requires_follow_up, cn.follow_up_date,
                    cn.created_at,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM clinical_notes cn
                JOIN employees e ON cn.doctor_id = e.id
                WHERE cn.appointment_id = $1 AND cn.is_deleted = false
                ORDER BY cn.created_at ASC
            `;

            const result = await db.query(query, [appointmentId]);

            logger.debug('Clinical notes found by appointment ID', {
                appointmentId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding clinical notes by appointment ID', {
                error: error.message,
                appointmentId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new clinical note
     * @param {Object} noteData - Clinical note data
     * @returns {Promise<Object>} Created clinical note
     */
    async create(noteData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (noteData.content && (!noteData.content || noteData.content.trim().length === 0)) {
                throw new Error('Clinical note content cannot be empty');
            }

            const query = `
                INSERT INTO clinical_notes (
                    id, patient_id, doctor_id, appointment_id,
                    note_type, title, content,
                    is_structured, sections,
                    is_urgent, requires_follow_up, follow_up_date,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6,
                    COALESCE($7, false), $8,
                    COALESCE($9, false), COALESCE($10, false), $11,
                    $12, NOW(), NOW()
                )
                RETURNING 
                    id, patient_id, doctor_id, appointment_id,
                    note_type, title, content,
                    is_structured, sections,
                    is_urgent, requires_follow_up, follow_up_date,
                    created_at
            `;

            const values = [
                noteData.patient_id,
                noteData.doctor_id,
                noteData.appointment_id || null,
                noteData.note_type,
                noteData.title || null,
                noteData.content,
                noteData.is_structured,
                noteData.sections || null,
                noteData.is_urgent,
                noteData.requires_follow_up,
                noteData.follow_up_date || null,
                noteData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Clinical note created successfully', {
                noteId: result.rows[0].id,
                patientId: noteData.patient_id,
                noteType: noteData.note_type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating clinical note', {
                error: error.message,
                patientId: noteData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Create SOAP note (structured)
     * @param {Object} soapData - SOAP format data
     * @returns {Promise<Object>} Created clinical note
     */
    async createSOAPNote(soapData) {
        const sections = {
            subjective: soapData.subjective || null,
            objective: soapData.objective || null,
            assessment: soapData.assessment || null,
            plan: soapData.plan || null
        };

        const content = `
            SUBJECTIVE: ${soapData.subjective || ''}
            OBJECTIVE: ${soapData.objective || ''}
            ASSESSMENT: ${soapData.assessment || ''}
            PLAN: ${soapData.plan || ''}
        `.trim();

        return this.create({
            patient_id: soapData.patient_id,
            doctor_id: soapData.doctor_id,
            appointment_id: soapData.appointment_id,
            note_type: 'progress',
            title: soapData.title || 'SOAP Note',
            content: content,
            is_structured: true,
            sections: sections,
            is_urgent: soapData.is_urgent || false,
            requires_follow_up: soapData.requires_follow_up || false,
            follow_up_date: soapData.follow_up_date || null,
            created_by: soapData.created_by
        });
    },

    /**
     * Update clinical note
     * @param {string} id - Clinical note ID
     * @param {Object} updates - Fields to update
     * @param {string} [updates.updated_by] - User who updated
     * @returns {Promise<Object>} Updated clinical note
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'note_type', 'title', 'content',
                'is_structured', 'sections',
                'is_urgent', 'requires_follow_up', 'follow_up_date'
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
                UPDATE clinical_notes 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, patient_id, doctor_id,
                    note_type, title, content,
                    is_structured, sections,
                    is_urgent, requires_follow_up, follow_up_date,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Clinical note not found');
            }

            await db.commitTransaction(client);

            logger.info('Clinical note updated successfully', {
                noteId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating clinical note', {
                error: error.message,
                noteId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get urgent notes for patient
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Array>} List of urgent notes
     */
    async getUrgentNotes(patientId) {
        try {
            const query = `
                SELECT 
                    cn.id, cn.patient_id, cn.doctor_id,
                    cn.note_type, cn.title, cn.content,
                    cn.is_urgent, cn.created_at,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM clinical_notes cn
                JOIN employees e ON cn.doctor_id = e.id
                WHERE cn.patient_id = $1 
                    AND cn.is_urgent = true
                    AND cn.is_deleted = false
                ORDER BY cn.created_at DESC
            `;

            const result = await db.query(query, [patientId]);

            logger.debug('Urgent notes retrieved', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting urgent notes', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get notes requiring follow-up
     * @param {string} date - Date to check (optional)
     * @returns {Promise<Array>} List of notes
     */
    async getFollowUpNotes(date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                SELECT 
                    cn.id, cn.patient_id, cn.doctor_id,
                    cn.note_type, cn.title, cn.content,
                    cn.follow_up_date,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM clinical_notes cn
                JOIN patients p ON cn.patient_id = p.id
                JOIN employees e ON cn.doctor_id = e.id
                WHERE cn.follow_up_date = $1
                    AND cn.requires_follow_up = true
                    AND cn.is_deleted = false
                ORDER BY cn.follow_up_date ASC
            `;

            const result = await db.query(query, [targetDate]);

            logger.debug('Follow-up notes retrieved', {
                date: targetDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting follow-up notes', {
                error: error.message,
                date
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get clinical note statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND created_at BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_notes,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT doctor_id) as unique_doctors,
                    COUNT(*) FILTER (WHERE note_type = 'progress') as progress_notes,
                    COUNT(*) FILTER (WHERE note_type = 'subjective') as subjective_notes,
                    COUNT(*) FILTER (WHERE note_type = 'objective') as objective_notes,
                    COUNT(*) FILTER (WHERE note_type = 'assessment') as assessment_notes,
                    COUNT(*) FILTER (WHERE note_type = 'plan') as plan_notes,
                    COUNT(*) FILTER (WHERE is_structured = true) as structured_notes,
                    COUNT(*) FILTER (WHERE is_urgent = true) as urgent_notes,
                    COUNT(*) FILTER (WHERE requires_follow_up = true) as follow_up_required
                FROM clinical_notes
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Clinical note statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting clinical note statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search clinical notes by content
     * @param {string} patientId - Patient UUID
     * @param {string} searchTerm - Search term
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of notes
     */
    async searchByContent(patientId, searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    cn.id, cn.patient_id, cn.doctor_id,
                    cn.note_type, cn.title, cn.content,
                    cn.created_at,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM clinical_notes cn
                JOIN employees e ON cn.doctor_id = e.id
                WHERE cn.patient_id = $1 
                    AND (cn.content ILIKE $2 OR cn.title ILIKE $2)
                    AND cn.is_deleted = false
                ORDER BY cn.created_at DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [patientId, `%${searchTerm}%`, limit, offset]);

            logger.debug('Clinical notes search completed', {
                patientId,
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching clinical notes', {
                error: error.message,
                patientId,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete clinical note
     * @param {string} id - Clinical note ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE clinical_notes 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Clinical note not found');
            }

            await db.commitTransaction(client);

            logger.info('Clinical note soft deleted', {
                noteId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting clinical note', {
                error: error.message,
                noteId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = ClinicalNote;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */