/**
 * ======================================================================
 * FILE: backend/src/models/hr/Leave.js
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
 * Leave model for database operations.
 * Handles employee leave requests, approvals, and tracking.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: leaves
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - employee_id: UUID (foreign key to employees)
 * - leave_type: enum (annual, sick, casual, emergency, unpaid)
 * - start_date: date
 * - end_date: date
 * - total_days: integer (generated)
 * - reason: text
 * - status: enum (pending, approved, rejected, cancelled)
 * - applied_at: timestamp
 * - applied_by: uuid
 * - approved_by: uuid
 * - approved_at: timestamp
 * - rejection_reason: text
 * - cancelled_at: timestamp
 * - cancelled_by: uuid
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

const Leave = {
    /**
     * Table name
     */
    tableName: 'leaves',

    /**
     * Valid leave types
     */
    validLeaveTypes: ['annual', 'sick', 'casual', 'emergency', 'unpaid'],

    /**
     * Valid statuses
     */
    validStatuses: ['pending', 'approved', 'rejected', 'cancelled'],

    /**
     * Find leave by ID
     * @param {string} id - Leave UUID
     * @returns {Promise<Object|null>} Leave object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    l.id, l.employee_id, l.leave_type,
                    l.start_date, l.end_date, l.total_days,
                    l.reason, l.status,
                    l.applied_at, l.applied_by,
                    l.approved_by, l.approved_at,
                    l.rejection_reason,
                    l.cancelled_at, l.cancelled_by,
                    l.created_at, l.updated_at,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    app_user.username as applied_by_name,
                    app_user2.username as approved_by_name,
                    can_user.username as cancelled_by_name
                FROM leaves l
                JOIN employees e ON l.employee_id = e.id
                LEFT JOIN users app_user ON l.applied_by = app_user.id
                LEFT JOIN users app_user2 ON l.approved_by = app_user2.id
                LEFT JOIN users can_user ON l.cancelled_by = can_user.id
                WHERE l.id = $1 AND l.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Leave found by ID', { leaveId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding leave by ID', {
                error: error.message,
                leaveId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find leaves by employee ID
     * @param {string} employeeId - Employee UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of leaves
     */
    async findByEmployeeId(employeeId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, leave_type, from_date, to_date } = options;
            const values = [employeeId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }
            if (leave_type) {
                conditions.push(`leave_type = $${paramIndex++}`);
                values.push(leave_type);
            }
            if (from_date) {
                conditions.push(`start_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`end_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, leave_type, start_date, end_date, total_days,
                    reason, status, applied_at, approved_at
                FROM leaves
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Leaves found by employee ID', {
                employeeId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding leaves by employee ID', {
                error: error.message,
                employeeId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending leaves (for approval)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of pending leaves
     */
    async getPendingLeaves(options = {}) {
        try {
            const { limit = 50, offset = 0, department_id } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['l.status = \'pending\'', 'l.is_deleted = false'];

            if (department_id) {
                conditions.push(`e.department_id = $${paramIndex++}`);
                values.push(department_id);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    l.id, l.employee_id, l.leave_type,
                    l.start_date, l.end_date, l.total_days,
                    l.reason, l.applied_at,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    d.name as department_name
                FROM leaves l
                JOIN employees e ON l.employee_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                ${whereClause}
                ORDER BY l.start_date ASC, l.applied_at ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Pending leaves retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending leaves', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get leaves by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of leaves
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 200, offset = 0, status, department_id } = options;
            const values = [startDate, endDate];
            let paramIndex = 3;
            const conditions = ['l.is_deleted = false', 'l.start_date <= $2', 'l.end_date >= $1'];

            if (status) {
                conditions.push(`l.status = $${paramIndex++}`);
                values.push(status);
            }
            if (department_id) {
                conditions.push(`e.department_id = $${paramIndex++}`);
                values.push(department_id);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    l.id, l.employee_id, l.leave_type,
                    l.start_date, l.end_date, l.total_days,
                    l.status,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    d.name as department_name
                FROM leaves l
                JOIN employees e ON l.employee_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                ${whereClause}
                ORDER BY l.start_date ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Leaves found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding leaves by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new leave request
     * @param {Object} leaveData - Leave data
     * @returns {Promise<Object>} Created leave
     */
    async create(leaveData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (leaveData.leave_type && !this.validLeaveTypes.includes(leaveData.leave_type)) {
                throw new Error(`Invalid leave type. Must be one of: ${this.validLeaveTypes.join(', ')}`);
            }
            if (leaveData.status && !this.validStatuses.includes(leaveData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            // Calculate total days (inclusive)
            const startDate = new Date(leaveData.start_date);
            const endDate = new Date(leaveData.end_date);
            const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

            // Check for overlapping leave requests
            const overlapQuery = `
                SELECT COUNT(*) as count
                FROM leaves
                WHERE employee_id = $1
                    AND status IN ('pending', 'approved')
                    AND is_deleted = false
                    AND start_date <= $2 AND end_date >= $3
            `;
            const overlapResult = await client.query(overlapQuery, [
                leaveData.employee_id,
                leaveData.end_date,
                leaveData.start_date
            ]);
            if (parseInt(overlapResult.rows[0].count) > 0) {
                throw new Error('Leave request overlaps with existing approved or pending leave');
            }

            const query = `
                INSERT INTO leaves (
                    id, employee_id, leave_type,
                    start_date, end_date, total_days,
                    reason, status,
                    applied_at, applied_by,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    $6, $7,
                    $8, $9,
                    NOW(), NOW()
                )
                RETURNING 
                    id, employee_id, leave_type,
                    start_date, end_date, total_days,
                    status, applied_at, created_at
            `;

            const values = [
                leaveData.employee_id,
                leaveData.leave_type,
                leaveData.start_date,
                leaveData.end_date,
                totalDays,
                leaveData.reason,
                leaveData.status || 'pending',
                leaveData.applied_at || new Date(),
                leaveData.applied_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Leave request created', {
                leaveId: result.rows[0].id,
                employeeId: leaveData.employee_id,
                leaveType: leaveData.leave_type,
                totalDays
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating leave request', {
                error: error.message,
                employeeId: leaveData.employee_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update leave request
     * @param {string} id - Leave ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated leave
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'leave_type', 'start_date', 'end_date', 'reason',
                'status', 'rejection_reason',
                'approved_by', 'approved_at',
                'cancelled_by', 'cancelled_at'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Recalculate total days if dates change
            let recalcDays = false;
            let newStartDate, newEndDate;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                    if (key === 'start_date') {
                        recalcDays = true;
                        newStartDate = value;
                    }
                    if (key === 'end_date') {
                        recalcDays = true;
                        newEndDate = value;
                    }
                }
            }

            if (recalcDays) {
                const leave = await this.findById(id);
                const start = newStartDate || leave.start_date;
                const end = newEndDate || leave.end_date;
                const totalDays = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
                setClause.push(`total_days = $${paramIndex++}`);
                values.push(totalDays);
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
                UPDATE leaves 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, employee_id, leave_type,
                    start_date, end_date, total_days,
                    status, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Leave request not found');
            }

            await db.commitTransaction(client);

            logger.info('Leave request updated', {
                leaveId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating leave request', {
                error: error.message,
                leaveId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Approve leave request
     * @param {string} id - Leave ID
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated leave
     */
    async approve(id, approvedBy) {
        return this.update(id, {
            status: 'approved',
            approved_by: approvedBy,
            approved_at: new Date(),
            updated_by: approvedBy
        });
    },

    /**
     * Reject leave request
     * @param {string} id - Leave ID
     * @param {string} rejectedBy - User who rejected
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated leave
     */
    async reject(id, rejectedBy, reason) {
        return this.update(id, {
            status: 'rejected',
            rejection_reason: reason,
            updated_by: rejectedBy
        });
    },

    /**
     * Cancel leave request (by employee)
     * @param {string} id - Leave ID
     * @param {string} cancelledBy - User who cancelled
     * @returns {Promise<Object>} Updated leave
     */
    async cancel(id, cancelledBy) {
        return this.update(id, {
            status: 'cancelled',
            cancelled_by: cancelledBy,
            cancelled_at: new Date(),
            updated_by: cancelledBy
        });
    },

    /**
     * Get leave statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND start_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    SUM(total_days) FILTER (WHERE status = 'approved') as total_approved_days,
                    AVG(total_days)::numeric(10,2) as avg_days_per_request,
                    COUNT(DISTINCT employee_id) as unique_employees,
                    COUNT(*) FILTER (WHERE leave_type = 'annual') as annual,
                    COUNT(*) FILTER (WHERE leave_type = 'sick') as sick,
                    COUNT(*) FILTER (WHERE leave_type = 'casual') as casual,
                    COUNT(*) FILTER (WHERE leave_type = 'emergency') as emergency,
                    COUNT(*) FILTER (WHERE leave_type = 'unpaid') as unpaid
                FROM leaves
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Leave statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting leave statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete leave request
     * @param {string} id - Leave ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE leaves 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Leave request not found');
            }

            await db.commitTransaction(client);

            logger.info('Leave request soft deleted', {
                leaveId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting leave request', {
                error: error.message,
                leaveId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Leave;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */