/**
 * ======================================================================
 * FILE: backend/src/models/clinical/HandoverNote.js
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
 * HandoverNote model for database operations.
 * Handles nurse shift handover notes for patient care continuity.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: handover_notes
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - from_shift_id: UUID (foreign key to shifts)
 * - to_shift_id: UUID (foreign key to shifts)
 * - from_nurse_id: UUID (foreign key to employees)
 * - to_nurse_id: UUID (foreign key to employees)
 * - handover_time: timestamp
 * - content: text
 * - priority_patients: jsonb
 * - pending_tasks: jsonb
 * - alerts: jsonb
 * - equipment_issues: text
 * - is_acknowledged: boolean
 * - acknowledged_at: timestamp
 * - acknowledged_by: uuid
 * - attachment_urls: text[]
 * - created_at: timestamp
 * - updated_at: timestamp
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

const HandoverNote = {
    /**
     * Table name
     */
    tableName: 'handover_notes',

    /**
     * Find handover note by ID
     * @param {string} id - HandoverNote UUID
     * @returns {Promise<Object|null>} HandoverNote object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    hn.id, hn.from_shift_id, hn.to_shift_id,
                    hn.from_nurse_id, hn.to_nurse_id,
                    hn.handover_time, hn.content,
                    hn.priority_patients, hn.pending_tasks,
                    hn.alerts, hn.equipment_issues,
                    hn.is_acknowledged, hn.acknowledged_at,
                    hn.acknowledged_by, hn.attachment_urls,
                    hn.created_at, hn.updated_at,
                    fs.shift_type as from_shift_type,
                    fs.start_time as from_shift_start,
                    fs.end_time as from_shift_end,
                    ts.shift_type as to_shift_type,
                    ts.start_time as to_shift_start,
                    ts.end_time as to_shift_end,
                    fn.first_name as from_nurse_first_name,
                    fn.last_name as from_nurse_last_name,
                    tn.first_name as to_nurse_first_name,
                    tn.last_name as to_nurse_last_name,
                    ack.username as acknowledged_by_name
                FROM handover_notes hn
                LEFT JOIN shifts fs ON hn.from_shift_id = fs.id
                LEFT JOIN shifts ts ON hn.to_shift_id = ts.id
                LEFT JOIN employees fn ON hn.from_nurse_id = fn.id
                LEFT JOIN employees tn ON hn.to_nurse_id = tn.id
                LEFT JOIN users ack ON hn.acknowledged_by = ack.id
                WHERE hn.id = $1 AND hn.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Handover note found by ID', { handoverId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding handover note by ID', {
                error: error.message,
                handoverId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find handover notes by shift
     * @param {string} shiftId - Shift UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of handover notes
     */
    async findByShiftId(shiftId, options = {}) {
        try {
            const { limit = 50, offset = 0, direction = 'from' } = options;
            const shiftField = direction === 'from' ? 'from_shift_id' : 'to_shift_id';

            const query = `
                SELECT 
                    hn.id, hn.from_shift_id, hn.to_shift_id,
                    hn.from_nurse_id, hn.to_nurse_id,
                    hn.handover_time, hn.content,
                    hn.priority_patients, hn.pending_tasks,
                    hn.alerts, hn.equipment_issues,
                    hn.is_acknowledged, hn.created_at,
                    fn.first_name as from_nurse_first_name,
                    fn.last_name as from_nurse_last_name,
                    tn.first_name as to_nurse_first_name,
                    tn.last_name as to_nurse_last_name
                FROM handover_notes hn
                LEFT JOIN employees fn ON hn.from_nurse_id = fn.id
                LEFT JOIN employees tn ON hn.to_nurse_id = tn.id
                WHERE hn.${shiftField} = $1 AND hn.is_deleted = false
                ORDER BY hn.handover_time DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [shiftId, limit, offset]);

            logger.debug('Handover notes found by shift', {
                shiftId,
                direction,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding handover notes by shift', {
                error: error.message,
                shiftId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find handover notes by nurse
     * @param {string} nurseId - Nurse UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of handover notes
     */
    async findByNurseId(nurseId, options = {}) {
        try {
            const { limit = 50, offset = 0, role = 'from' } = options;
            const nurseField = role === 'from' ? 'from_nurse_id' : 'to_nurse_id';

            const query = `
                SELECT 
                    hn.id, hn.from_shift_id, hn.to_shift_id,
                    hn.from_nurse_id, hn.to_nurse_id,
                    hn.handover_time, hn.content,
                    hn.priority_patients, hn.pending_tasks,
                    hn.alerts, hn.equipment_issues,
                    hn.is_acknowledged, hn.created_at,
                    fs.shift_type as from_shift_type,
                    ts.shift_type as to_shift_type
                FROM handover_notes hn
                LEFT JOIN shifts fs ON hn.from_shift_id = fs.id
                LEFT JOIN shifts ts ON hn.to_shift_id = ts.id
                WHERE hn.${nurseField} = $1 AND hn.is_deleted = false
                ORDER BY hn.handover_time DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [nurseId, limit, offset]);

            logger.debug('Handover notes found by nurse', {
                nurseId,
                role,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding handover notes by nurse', {
                error: error.message,
                nurseId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending handover notes (not acknowledged)
     * @returns {Promise<Array>} List of pending handover notes
     */
    async getPending() {
        try {
            const query = `
                SELECT 
                    hn.id, hn.from_shift_id, hn.to_shift_id,
                    hn.from_nurse_id, hn.to_nurse_id,
                    hn.handover_time, hn.content,
                    hn.priority_patients, hn.pending_tasks,
                    hn.alerts, hn.equipment_issues,
                    hn.created_at,
                    fn.first_name as from_nurse_first_name,
                    fn.last_name as from_nurse_last_name,
                    fs.shift_type as from_shift_type,
                    ts.shift_type as to_shift_type
                FROM handover_notes hn
                LEFT JOIN employees fn ON hn.from_nurse_id = fn.id
                LEFT JOIN shifts fs ON hn.from_shift_id = fs.id
                LEFT JOIN shifts ts ON hn.to_shift_id = ts.id
                WHERE hn.is_acknowledged = false AND hn.is_deleted = false
                ORDER BY hn.handover_time ASC
            `;

            const result = await db.query(query);

            logger.debug('Pending handover notes retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending handover notes', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new handover note
     * @param {Object} handoverData - Handover data
     * @returns {Promise<Object>} Created handover note
     */
    async create(handoverData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (!handoverData.content || handoverData.content.trim().length === 0) {
                throw new Error('Handover note content cannot be empty');
            }

            const query = `
                INSERT INTO handover_notes (
                    id, from_shift_id, to_shift_id,
                    from_nurse_id, to_nurse_id,
                    handover_time, content,
                    priority_patients, pending_tasks,
                    alerts, equipment_issues,
                    attachment_urls,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    COALESCE($5, NOW()), $6,
                    $7, $8, $9, $10, $11,
                    NOW(), NOW()
                )
                RETURNING 
                    id, from_shift_id, to_shift_id,
                    from_nurse_id, to_nurse_id,
                    handover_time, content,
                    priority_patients, pending_tasks,
                    alerts, equipment_issues,
                    attachment_urls, created_at
            `;

            const values = [
                handoverData.from_shift_id || null,
                handoverData.to_shift_id || null,
                handoverData.from_nurse_id,
                handoverData.to_nurse_id || null,
                handoverData.handover_time || null,
                handoverData.content,
                handoverData.priority_patients || null,
                handoverData.pending_tasks || null,
                handoverData.alerts || null,
                handoverData.equipment_issues || null,
                handoverData.attachment_urls || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Handover note created successfully', {
                handoverId: result.rows[0].id,
                fromNurseId: handoverData.from_nurse_id,
                toNurseId: handoverData.to_nurse_id
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating handover note', {
                error: error.message,
                fromNurseId: handoverData.from_nurse_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update handover note
     * @param {string} id - Handover note ID
     * @param {Object} updates - Fields to update
     * @param {string} [updates.updated_by] - User who updated
     * @returns {Promise<Object>} Updated handover note
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'content', 'priority_patients', 'pending_tasks',
                'alerts', 'equipment_issues', 'attachment_urls'
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
            values.push(id);

            const query = `
                UPDATE handover_notes 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, content, priority_patients,
                    pending_tasks, alerts, equipment_issues,
                    attachment_urls, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Handover note not found');
            }

            await db.commitTransaction(client);

            logger.info('Handover note updated successfully', {
                handoverId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating handover note', {
                error: error.message,
                handoverId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Acknowledge handover note
     * @param {string} id - Handover note ID
     * @param {string} acknowledgedBy - User who acknowledged
     * @returns {Promise<Object>} Updated handover note
     */
    async acknowledge(id, acknowledgedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE handover_notes 
                SET is_acknowledged = true,
                    acknowledged_at = NOW(),
                    acknowledged_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_acknowledged = false AND is_deleted = false
                RETURNING 
                    id, is_acknowledged, acknowledged_at,
                    acknowledged_by
            `;

            const result = await client.query(query, [acknowledgedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Handover note not found or already acknowledged');
            }

            await db.commitTransaction(client);

            logger.info('Handover note acknowledged', {
                handoverId: id,
                acknowledgedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error acknowledging handover note', {
                error: error.message,
                handoverId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get handover notes for a date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of handover notes
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    hn.id, hn.from_shift_id, hn.to_shift_id,
                    hn.from_nurse_id, hn.to_nurse_id,
                    hn.handover_time, hn.content,
                    hn.priority_patients, hn.pending_tasks,
                    hn.alerts, hn.equipment_issues,
                    hn.is_acknowledged, hn.created_at,
                    fn.first_name as from_nurse_first_name,
                    fn.last_name as from_nurse_last_name,
                    tn.first_name as to_nurse_first_name,
                    tn.last_name as to_nurse_last_name
                FROM handover_notes hn
                LEFT JOIN employees fn ON hn.from_nurse_id = fn.id
                LEFT JOIN employees tn ON hn.to_nurse_id = tn.id
                WHERE hn.handover_time BETWEEN $1 AND $2
                    AND hn.is_deleted = false
                ORDER BY hn.handover_time DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [startDate, endDate, limit, offset]);

            logger.debug('Handover notes retrieved by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting handover notes by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get handover statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND handover_time BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_handovers,
                    COUNT(*) FILTER (WHERE is_acknowledged = true) as acknowledged,
                    COUNT(*) FILTER (WHERE is_acknowledged = false) as pending,
                    COUNT(DISTINCT from_nurse_id) as unique_from_nurses,
                    COUNT(DISTINCT to_nurse_id) as unique_to_nurses,
                    AVG(EXTRACT(EPOCH FROM (acknowledged_at - handover_time))/60)::numeric(10,2) as avg_ack_time_minutes,
                    COUNT(*) FILTER (WHERE priority_patients IS NOT NULL) as has_priority_patients,
                    COUNT(*) FILTER (WHERE pending_tasks IS NOT NULL) as has_pending_tasks,
                    COUNT(*) FILTER (WHERE alerts IS NOT NULL) as has_alerts,
                    COUNT(*) FILTER (WHERE equipment_issues IS NOT NULL) as has_equipment_issues
                FROM handover_notes
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Handover statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting handover statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete handover note
     * @param {string} id - Handover note ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE handover_notes 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Handover note not found');
            }

            await db.commitTransaction(client);

            logger.info('Handover note soft deleted', {
                handoverId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting handover note', {
                error: error.message,
                handoverId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = HandoverNote;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */