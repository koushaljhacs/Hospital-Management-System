/**
 * ======================================================================
 * FILE: backend/src/models/facility/ShiftAssignment.js
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
 * ShiftAssignment model for database operations.
 * Handles employee shift assignments, scheduling, and attendance tracking.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: shift_assignments
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - shift_id: UUID (foreign key to shifts)
 * - employee_id: UUID (foreign key to employees)
 * - assignment_date: date
 * - start_time: timestamp
 * - end_time: timestamp
 * - is_confirmed: boolean
 * - confirmed_by: uuid
 * - confirmed_at: timestamp
 * - check_in_time: timestamp
 * - check_out_time: timestamp
 * - actual_hours: decimal (generated)
 * - status: enum (scheduled, confirmed, checked_in, checked_out, cancelled)
 * - cancellation_reason: text
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

const ShiftAssignment = {
    /**
     * Table name
     */
    tableName: 'shift_assignments',

    /**
     * Valid statuses
     */
    validStatuses: ['scheduled', 'confirmed', 'checked_in', 'checked_out', 'cancelled'],

    /**
     * Find assignment by ID
     * @param {string} id - Assignment UUID
     * @returns {Promise<Object|null>} Assignment object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    sa.id, sa.shift_id, sa.employee_id, sa.assignment_date,
                    sa.start_time, sa.end_time,
                    sa.is_confirmed, sa.confirmed_by, sa.confirmed_at,
                    sa.check_in_time, sa.check_out_time, sa.actual_hours,
                    sa.status, sa.cancellation_reason,
                    sa.created_at, sa.updated_at,
                    s.shift_code, s.shift_name, s.shift_type,
                    s.start_time as shift_start, s.end_time as shift_end,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    u.username as confirmed_by_name,
                    cu.username as created_by_name
                FROM shift_assignments sa
                JOIN shifts s ON sa.shift_id = s.id
                JOIN employees e ON sa.employee_id = e.id
                LEFT JOIN users u ON sa.confirmed_by = u.id
                LEFT JOIN users cu ON sa.created_by = cu.id
                WHERE sa.id = $1 AND sa.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Shift assignment found by ID', { assignmentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding shift assignment by ID', {
                error: error.message,
                assignmentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find assignments by employee ID
     * @param {string} employeeId - Employee UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of assignments
     */
    async findByEmployeeId(employeeId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, from_date, to_date } = options;
            const values = [employeeId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }
            if (from_date) {
                conditions.push(`assignment_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`assignment_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    sa.id, sa.shift_id, sa.assignment_date,
                    sa.start_time, sa.end_time,
                    sa.status, sa.is_confirmed,
                    sa.check_in_time, sa.check_out_time, sa.actual_hours,
                    s.shift_code, s.shift_name, s.shift_type,
                    s.start_time as shift_start, s.end_time as shift_end
                FROM shift_assignments sa
                JOIN shifts s ON sa.shift_id = s.id
                ${whereClause}
                ORDER BY sa.assignment_date DESC, sa.start_time DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Shift assignments found by employee ID', {
                employeeId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding shift assignments by employee ID', {
                error: error.message,
                employeeId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find assignments by shift ID
     * @param {string} shiftId - Shift UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of assignments
     */
    async findByShiftId(shiftId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, date } = options;
            const values = [shiftId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }
            if (date) {
                conditions.push(`assignment_date = $${paramIndex++}`);
                values.push(date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    sa.id, sa.employee_id, sa.assignment_date,
                    sa.start_time, sa.end_time,
                    sa.status, sa.is_confirmed,
                    sa.check_in_time, sa.check_out_time, sa.actual_hours,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id
                FROM shift_assignments sa
                JOIN employees e ON sa.employee_id = e.id
                ${whereClause}
                ORDER BY e.first_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Shift assignments found by shift ID', {
                shiftId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding shift assignments by shift ID', {
                error: error.message,
                shiftId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get assignments for a specific date
     * @param {string} date - Assignment date (YYYY-MM-DD)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of assignments
     */
    async getByDate(date, options = {}) {
        try {
            const { limit = 200, offset = 0, status } = options;
            const values = [date];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    sa.id, sa.shift_id, sa.employee_id,
                    sa.start_time, sa.end_time,
                    sa.status, sa.is_confirmed,
                    s.shift_code, s.shift_name, s.shift_type,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name
                FROM shift_assignments sa
                JOIN shifts s ON sa.shift_id = s.id
                JOIN employees e ON sa.employee_id = e.id
                ${whereClause}
                ORDER BY sa.start_time ASC, e.first_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Shift assignments found by date', {
                date,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding shift assignments by date', {
                error: error.message,
                date
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get current shift assignment for employee
     * @param {string} employeeId - Employee UUID
     * @returns {Promise<Object|null>} Current assignment or null
     */
    async getCurrentAssignment(employeeId) {
        try {
            const query = `
                SELECT 
                    sa.id, sa.shift_id, sa.assignment_date,
                    sa.start_time, sa.end_time,
                    sa.status, sa.check_in_time,
                    s.shift_code, s.shift_name, s.shift_type,
                    s.start_time as shift_start, s.end_time as shift_end
                FROM shift_assignments sa
                JOIN shifts s ON sa.shift_id = s.id
                WHERE sa.employee_id = $1
                    AND sa.status IN ('confirmed', 'checked_in')
                    AND sa.assignment_date = CURRENT_DATE
                    AND sa.is_deleted = false
                ORDER BY sa.start_time ASC
                LIMIT 1
            `;

            const result = await db.query(query, [employeeId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Current shift assignment found', { employeeId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting current shift assignment', {
                error: error.message,
                employeeId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new shift assignment
     * @param {Object} assignmentData - Assignment data
     * @returns {Promise<Object>} Created assignment
     */
    async create(assignmentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (assignmentData.status && !this.validStatuses.includes(assignmentData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            // Check for overlapping assignments
            const overlapQuery = `
                SELECT COUNT(*) as count
                FROM shift_assignments
                WHERE employee_id = $1
                    AND assignment_date = $2
                    AND status != 'cancelled'
                    AND is_deleted = false
                    AND (
                        (start_time <= $3 AND end_time >= $3) OR
                        (start_time <= $4 AND end_time >= $4) OR
                        (start_time >= $3 AND end_time <= $4)
                    )
            `;
            const overlapResult = await client.query(overlapQuery, [
                assignmentData.employee_id,
                assignmentData.assignment_date,
                assignmentData.start_time,
                assignmentData.end_time
            ]);
            if (parseInt(overlapResult.rows[0].count) > 0) {
                throw new Error('Employee already has a shift assignment that overlaps with this time');
            }

            const query = `
                INSERT INTO shift_assignments (
                    id, shift_id, employee_id, assignment_date,
                    start_time, end_time,
                    is_confirmed, status,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5,
                    COALESCE($6, false), COALESCE($7, 'scheduled'),
                    $8, NOW(), NOW()
                )
                RETURNING 
                    id, shift_id, employee_id, assignment_date,
                    start_time, end_time, status, created_at
            `;

            const values = [
                assignmentData.shift_id,
                assignmentData.employee_id,
                assignmentData.assignment_date,
                assignmentData.start_time,
                assignmentData.end_time,
                assignmentData.is_confirmed,
                assignmentData.status,
                assignmentData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Shift assignment created', {
                assignmentId: result.rows[0].id,
                employeeId: assignmentData.employee_id,
                shiftId: assignmentData.shift_id,
                assignmentDate: assignmentData.assignment_date
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating shift assignment', {
                error: error.message,
                employeeId: assignmentData.employee_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update shift assignment
     * @param {string} id - Assignment ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated assignment
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'start_time', 'end_time', 'is_confirmed',
                'confirmed_by', 'confirmed_at',
                'check_in_time', 'check_out_time',
                'status', 'cancellation_reason'
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
                UPDATE shift_assignments 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, shift_id, employee_id, status,
                    check_in_time, check_out_time,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Shift assignment not found');
            }

            await db.commitTransaction(client);

            logger.info('Shift assignment updated', {
                assignmentId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating shift assignment', {
                error: error.message,
                assignmentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Confirm shift assignment
     * @param {string} id - Assignment ID
     * @param {string} confirmedBy - User who confirmed
     * @returns {Promise<Object>} Updated assignment
     */
    async confirm(id, confirmedBy) {
        return this.update(id, {
            is_confirmed: true,
            confirmed_by: confirmedBy,
            confirmed_at: new Date(),
            status: 'confirmed',
            updated_by: confirmedBy
        });
    },

    /**
     * Record check-in
     * @param {string} id - Assignment ID
     * @param {string} checkedInBy - User who checked in
     * @returns {Promise<Object>} Updated assignment
     */
    async checkIn(id, checkedInBy) {
        return this.update(id, {
            check_in_time: new Date(),
            status: 'checked_in',
            updated_by: checkedInBy
        });
    },

    /**
     * Record check-out
     * @param {string} id - Assignment ID
     * @param {string} checkedOutBy - User who checked out
     * @returns {Promise<Object>} Updated assignment
     */
    async checkOut(id, checkedOutBy) {
        const assignment = await this.findById(id);
        if (!assignment) {
            throw new Error('Shift assignment not found');
        }
        const updates = {
            check_out_time: new Date(),
            status: 'checked_out',
            updated_by: checkedOutBy
        };
        // actual_hours is generated by DB, but we can also calculate here for logging
        if (assignment.check_in_time) {
            const hours = (new Date(updates.check_out_time) - new Date(assignment.check_in_time)) / (1000 * 60 * 60);
            logger.debug('Check-out recorded', { assignmentId: id, hoursWorked: hours.toFixed(2) });
        }
        return this.update(id, updates);
    },

    /**
     * Cancel shift assignment
     * @param {string} id - Assignment ID
     * @param {string} cancelledBy - User who cancelled
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Updated assignment
     */
    async cancel(id, cancelledBy, reason) {
        return this.update(id, {
            status: 'cancelled',
            cancellation_reason: reason,
            updated_by: cancelledBy
        });
    },

    /**
     * Bulk create shift assignments (e.g., weekly schedule)
     * @param {Array} assignmentsData - Array of assignment data
     * @returns {Promise<Array>} Created assignments
     */
    async bulkCreate(assignmentsData) {
        const client = await db.getClient();
        const created = [];

        try {
            await db.beginTransaction(client);

            for (const data of assignmentsData) {
                const result = await this.create(data);
                created.push(result);
            }

            await db.commitTransaction(client);

            logger.info('Bulk shift assignments created', {
                count: created.length
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk creating shift assignments', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get assignment statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND assignment_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_assignments,
                    COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
                    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
                    COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
                    COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE is_confirmed = true) as confirmed_count,
                    COUNT(DISTINCT employee_id) as unique_employees,
                    COUNT(DISTINCT shift_id) as unique_shifts,
                    AVG(actual_hours)::numeric(10,2) as avg_actual_hours
                FROM shift_assignments
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Shift assignment statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting shift assignment statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete shift assignment
     * @param {string} id - Assignment ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE shift_assignments 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Shift assignment not found');
            }

            await db.commitTransaction(client);

            logger.info('Shift assignment soft deleted', {
                assignmentId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting shift assignment', {
                error: error.message,
                assignmentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = ShiftAssignment;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */