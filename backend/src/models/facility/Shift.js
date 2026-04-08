/**
 * ======================================================================
 * FILE: backend/src/models/facility/Shift.js
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
 * Shift model for database operations.
 * Handles shift definitions, schedules, and rules for employee shifts.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: shifts
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - shift_code: string (unique)
 * - shift_name: string
 * - shift_type: enum (morning, evening, night, general, split, on_call, weekend)
 * - start_time: time
 * - end_time: time
 * - break_start: time
 * - break_end: time
 * - total_hours: decimal (generated)
 * - monday: boolean
 * - tuesday: boolean
 * - wednesday: boolean
 * - thursday: boolean
 * - friday: boolean
 * - saturday: boolean
 * - sunday: boolean
 * - department_id: UUID
 * - location: string
 * - min_staff_required: integer
 * - max_staff_allowed: integer
 * - current_staff_count: integer
 * - allowed_roles: uuid[]
 * - overtime_allowed: boolean
 * - overtime_rate: decimal
 * - late_grace_period: integer
 * - early_departure_grace: integer
 * - min_rest_between_shifts: integer
 * - leave_quota_per_month: integer
 * - sick_leave_quota: integer
 * - casual_leave_quota: integer
 * - paid_leave_allowed: boolean
 * - base_rate: decimal
 * - night_differential: decimal
 * - weekend_rate: decimal
 * - holiday_rate: decimal
 * - is_active: boolean
 * - effective_from: date
 * - effective_to: date
 * - notes: text
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

const Shift = {
    /**
     * Table name
     */
    tableName: 'shifts',

    /**
     * Valid shift types
     */
    validShiftTypes: ['morning', 'evening', 'night', 'general', 'split', 'on_call', 'weekend'],

    /**
     * Generate shift code
     * @returns {Promise<string>} Generated shift code
     */
    async generateShiftCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM shifts WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(3, '0');
            return `SFT-${sequence}`;
        } catch (error) {
            logger.error('Error generating shift code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find shift by ID
     * @param {string} id - Shift UUID
     * @returns {Promise<Object|null>} Shift object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    s.id, s.shift_code, s.shift_name, s.shift_type,
                    s.start_time, s.end_time, s.break_start, s.break_end,
                    s.total_hours,
                    s.monday, s.tuesday, s.wednesday, s.thursday,
                    s.friday, s.saturday, s.sunday,
                    s.department_id, s.location,
                    s.min_staff_required, s.max_staff_allowed, s.current_staff_count,
                    s.allowed_roles,
                    s.overtime_allowed, s.overtime_rate,
                    s.late_grace_period, s.early_departure_grace,
                    s.min_rest_between_shifts,
                    s.leave_quota_per_month, s.sick_leave_quota,
                    s.casual_leave_quota, s.paid_leave_allowed,
                    s.base_rate, s.night_differential,
                    s.weekend_rate, s.holiday_rate,
                    s.is_active, s.effective_from, s.effective_to,
                    s.notes,
                    s.created_at, s.updated_at,
                    d.name as department_name,
                    u.username as created_by_name
                FROM shifts s
                LEFT JOIN departments d ON s.department_id = d.id
                LEFT JOIN users u ON s.created_by = u.id
                WHERE s.id = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Shift found by ID', { shiftId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding shift by ID', {
                error: error.message,
                shiftId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find shift by code
     * @param {string} shiftCode - Shift code
     * @returns {Promise<Object|null>} Shift object or null
     */
    async findByCode(shiftCode) {
        try {
            const query = `
                SELECT id, shift_code, shift_name, shift_type,
                       start_time, end_time, is_active
                FROM shifts
                WHERE shift_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [shiftCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Shift found by code', { shiftCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding shift by code', {
                error: error.message,
                shiftCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all shifts with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of shifts
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.shift_type) {
                conditions.push(`shift_type = $${paramIndex++}`);
                values.push(filters.shift_type);
            }
            if (filters.department_id) {
                conditions.push(`department_id = $${paramIndex++}`);
                values.push(filters.department_id);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }
            if (filters.effective_date) {
                conditions.push(`effective_from <= $${paramIndex++} AND (effective_to IS NULL OR effective_to >= $${paramIndex++})`);
                values.push(filters.effective_date, filters.effective_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, shift_code, shift_name, shift_type,
                    start_time, end_time, total_hours,
                    department_id, is_active,
                    min_staff_required, current_staff_count,
                    created_at
                FROM shifts
                ${whereClause}
                ORDER BY shift_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all shifts', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all shifts', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active shifts (for dropdowns)
     * @returns {Promise<Array>} List of active shifts
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, shift_code, shift_name, shift_type,
                    start_time, end_time, total_hours,
                    department_id, location,
                    min_staff_required, current_staff_count,
                    base_rate, overtime_rate
                FROM shifts
                WHERE is_active = true
                    AND effective_from <= CURRENT_DATE
                    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                    AND is_deleted = false
                ORDER BY shift_name ASC
            `;

            const result = await db.query(query);

            logger.debug('Active shifts retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active shifts', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get shifts by department
     * @param {string} departmentId - Department UUID
     * @returns {Promise<Array>} List of shifts
     */
    async getByDepartment(departmentId) {
        try {
            const query = `
                SELECT 
                    id, shift_code, shift_name, shift_type,
                    start_time, end_time, total_hours,
                    is_active, current_staff_count,
                    min_staff_required, max_staff_allowed
                FROM shifts
                WHERE department_id = $1 AND is_deleted = false
                ORDER BY shift_name ASC
            `;

            const result = await db.query(query, [departmentId]);

            logger.debug('Shifts found by department', {
                departmentId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding shifts by department', {
                error: error.message,
                departmentId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new shift
     * @param {Object} shiftData - Shift data
     * @returns {Promise<Object>} Created shift
     */
    async create(shiftData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (shiftData.shift_type && !this.validShiftTypes.includes(shiftData.shift_type)) {
                throw new Error(`Invalid shift type. Must be one of: ${this.validShiftTypes.join(', ')}`);
            }

            const shiftCode = shiftData.shift_code || await this.generateShiftCode();

            const query = `
                INSERT INTO shifts (
                    id, shift_code, shift_name, shift_type,
                    start_time, end_time, break_start, break_end,
                    monday, tuesday, wednesday, thursday,
                    friday, saturday, sunday,
                    department_id, location,
                    min_staff_required, max_staff_allowed,
                    allowed_roles,
                    overtime_allowed, overtime_rate,
                    late_grace_period, early_departure_grace,
                    min_rest_between_shifts,
                    leave_quota_per_month, sick_leave_quota,
                    casual_leave_quota, paid_leave_allowed,
                    base_rate, night_differential,
                    weekend_rate, holiday_rate,
                    is_active, effective_from, effective_to,
                    notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6, $7,
                    $8, $9, $10, $11,
                    $12, $13, $14,
                    $15, $16,
                    $17, $18,
                    $19,
                    $20, $21,
                    $22, $23,
                    $24,
                    $25, $26,
                    $27, $28,
                    $29, $30,
                    $31, $32,
                    COALESCE($33, true), $34, $35,
                    $36,
                    $37, NOW(), NOW()
                )
                RETURNING 
                    id, shift_code, shift_name, shift_type,
                    start_time, end_time, is_active,
                    created_at
            `;

            const values = [
                shiftCode,
                shiftData.shift_name,
                shiftData.shift_type,
                shiftData.start_time,
                shiftData.end_time,
                shiftData.break_start || null,
                shiftData.break_end || null,
                shiftData.monday || false,
                shiftData.tuesday || false,
                shiftData.wednesday || false,
                shiftData.thursday || false,
                shiftData.friday || false,
                shiftData.saturday || false,
                shiftData.sunday || false,
                shiftData.department_id || null,
                shiftData.location || null,
                shiftData.min_staff_required || 1,
                shiftData.max_staff_allowed || null,
                shiftData.allowed_roles || null,
                shiftData.overtime_allowed || false,
                shiftData.overtime_rate || 1.5,
                shiftData.late_grace_period || 15,
                shiftData.early_departure_grace || 15,
                shiftData.min_rest_between_shifts || 8,
                shiftData.leave_quota_per_month || null,
                shiftData.sick_leave_quota || null,
                shiftData.casual_leave_quota || null,
                shiftData.paid_leave_allowed !== undefined ? shiftData.paid_leave_allowed : true,
                shiftData.base_rate || null,
                shiftData.night_differential || 0,
                shiftData.weekend_rate || 1,
                shiftData.holiday_rate || 2,
                shiftData.is_active,
                shiftData.effective_from || null,
                shiftData.effective_to || null,
                shiftData.notes || null,
                shiftData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Shift created successfully', {
                shiftId: result.rows[0].id,
                shiftCode,
                shiftName: shiftData.shift_name,
                shiftType: shiftData.shift_type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating shift', {
                error: error.message,
                shiftName: shiftData.shift_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update shift
     * @param {string} id - Shift ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated shift
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'shift_name', 'shift_type', 'start_time', 'end_time',
                'break_start', 'break_end',
                'monday', 'tuesday', 'wednesday', 'thursday',
                'friday', 'saturday', 'sunday',
                'department_id', 'location',
                'min_staff_required', 'max_staff_allowed',
                'allowed_roles',
                'overtime_allowed', 'overtime_rate',
                'late_grace_period', 'early_departure_grace',
                'min_rest_between_shifts',
                'leave_quota_per_month', 'sick_leave_quota',
                'casual_leave_quota', 'paid_leave_allowed',
                'base_rate', 'night_differential',
                'weekend_rate', 'holiday_rate',
                'is_active', 'effective_from', 'effective_to',
                'notes'
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
                UPDATE shifts 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, shift_code, shift_name,
                    start_time, end_time, is_active,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Shift not found');
            }

            await db.commitTransaction(client);

            logger.info('Shift updated', {
                shiftId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating shift', {
                error: error.message,
                shiftId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Increment staff count (when assigning staff to shift)
     * @param {string} id - Shift ID
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated shift
     */
    async incrementStaffCount(id, updatedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE shifts 
                SET current_staff_count = current_staff_count + 1,
                    updated_at = NOW(),
                    updated_by = $1
                WHERE id = $2 
                    AND current_staff_count < max_staff_allowed
                    AND is_deleted = false
                RETURNING 
                    id, current_staff_count, max_staff_allowed
            `;

            const result = await client.query(query, [updatedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Shift not found or max capacity reached');
            }

            await db.commitTransaction(client);

            logger.debug('Shift staff count incremented', {
                shiftId: id,
                newCount: result.rows[0].current_staff_count
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error incrementing staff count', {
                error: error.message,
                shiftId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Decrement staff count (when removing staff from shift)
     * @param {string} id - Shift ID
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated shift
     */
    async decrementStaffCount(id, updatedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE shifts 
                SET current_staff_count = current_staff_count - 1,
                    updated_at = NOW(),
                    updated_by = $1
                WHERE id = $2 
                    AND current_staff_count > 0
                    AND is_deleted = false
                RETURNING id, current_staff_count
            `;

            const result = await client.query(query, [updatedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Shift not found');
            }

            await db.commitTransaction(client);

            logger.debug('Shift staff count decremented', {
                shiftId: id,
                newCount: result.rows[0].current_staff_count
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error decrementing staff count', {
                error: error.message,
                shiftId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get shifts by day of week
     * @param {number} dayOfWeek - Day of week (0=Sunday, 1=Monday, etc.)
     * @returns {Promise<Array>} List of shifts active on that day
     */
    async getByDayOfWeek(dayOfWeek) {
        try {
            const dayMap = {
                0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
                4: 'thursday', 5: 'friday', 6: 'saturday'
            };
            const column = dayMap[dayOfWeek];
            if (!column) {
                throw new Error('Invalid day of week');
            }

            const query = `
                SELECT 
                    id, shift_code, shift_name, shift_type,
                    start_time, end_time,
                    department_id, location,
                    min_staff_required, current_staff_count
                FROM shifts
                WHERE ${column} = true
                    AND is_active = true
                    AND effective_from <= CURRENT_DATE
                    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
                    AND is_deleted = false
                ORDER BY start_time ASC
            `;

            const result = await db.query(query);

            logger.debug('Shifts found by day of week', {
                dayOfWeek,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding shifts by day of week', {
                error: error.message,
                dayOfWeek
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get shift statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_shifts,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE shift_type = 'morning') as morning,
                    COUNT(*) FILTER (WHERE shift_type = 'evening') as evening,
                    COUNT(*) FILTER (WHERE shift_type = 'night') as night,
                    COUNT(*) FILTER (WHERE shift_type = 'general') as general,
                    COUNT(DISTINCT department_id) as departments_covered,
                    SUM(min_staff_required) as total_min_staff,
                    SUM(max_staff_allowed) as total_max_capacity,
                    SUM(current_staff_count) as total_assigned_staff,
                    AVG(base_rate)::numeric(10,2) as avg_base_rate
                FROM shifts
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Shift statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting shift statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search shifts
     * @param {string} searchTerm - Search term (name, code, location)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of shifts
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, shift_code, shift_name, shift_type,
                    start_time, end_time, department_id,
                    is_active, location
                FROM shifts
                WHERE (shift_name ILIKE $1 
                    OR shift_code ILIKE $1
                    OR location ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN shift_name ILIKE $2 THEN 1
                        WHEN shift_code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    shift_name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Shift search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching shifts', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete shift
     * @param {string} id - Shift ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE shifts 
                SET is_deleted = true,
                    is_active = false,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Shift not found');
            }

            await db.commitTransaction(client);

            logger.info('Shift soft deleted', {
                shiftId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting shift', {
                error: error.message,
                shiftId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Shift;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */