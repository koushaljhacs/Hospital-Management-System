/**
 * ======================================================================
 * FILE: backend/src/models/hr/Attendance.js
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
 * Attendance model for database operations.
 * Tracks employee attendance, check-in/out times, and attendance status.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: attendance
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - employee_id: UUID (foreign key to employees)
 * - attendance_date: date
 * - check_in_time: timestamp
 * - check_out_time: timestamp
 * - total_hours: decimal (generated)
 * - status: enum (present, absent, holiday, leave, half_day)
 * - check_in_method: string
 * - check_out_method: string
 * - check_in_location: string
 * - check_out_location: string
 * - check_in_ip: inet
 * - check_out_ip: inet
 * - check_in_device_info: jsonb
 * - check_out_device_info: jsonb
 * - verified_by: uuid
 * - verified_at: timestamp
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

const Attendance = {
    /**
     * Table name
     */
    tableName: 'attendance',

    /**
     * Valid status values
     */
    validStatuses: ['present', 'absent', 'holiday', 'leave', 'half_day'],

    /**
     * Find attendance by ID
     * @param {string} id - Attendance UUID
     * @returns {Promise<Object|null>} Attendance object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    a.id, a.employee_id, a.attendance_date,
                    a.check_in_time, a.check_out_time, a.total_hours,
                    a.status,
                    a.check_in_method, a.check_out_method,
                    a.check_in_location, a.check_out_location,
                    a.check_in_ip, a.check_out_ip,
                    a.check_in_device_info, a.check_out_device_info,
                    a.verified_by, a.verified_at,
                    a.notes,
                    a.created_at, a.updated_at,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    u.username as verified_by_name
                FROM attendance a
                JOIN employees e ON a.employee_id = e.id
                LEFT JOIN users u ON a.verified_by = u.id
                WHERE a.id = $1 AND a.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Attendance found by ID', { attendanceId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding attendance by ID', {
                error: error.message,
                attendanceId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find attendance by employee ID and date
     * @param {string} employeeId - Employee UUID
     * @param {string} date - Date (YYYY-MM-DD)
     * @returns {Promise<Object|null>} Attendance object or null
     */
    async findByEmployeeAndDate(employeeId, date) {
        try {
            const query = `
                SELECT 
                    id, employee_id, attendance_date,
                    check_in_time, check_out_time, total_hours,
                    status, check_in_method, check_out_method,
                    notes
                FROM attendance
                WHERE employee_id = $1 AND attendance_date = $2 AND is_deleted = false
                LIMIT 1
            `;

            const result = await db.query(query, [employeeId, date]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Attendance found by employee and date', { employeeId, date });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding attendance by employee and date', {
                error: error.message,
                employeeId,
                date
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find attendance records by employee ID
     * @param {string} employeeId - Employee UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of attendance records
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
                conditions.push(`attendance_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`attendance_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, attendance_date, check_in_time, check_out_time,
                    total_hours, status, created_at
                FROM attendance
                ${whereClause}
                ORDER BY attendance_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Attendance records found by employee ID', {
                employeeId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding attendance records by employee ID', {
                error: error.message,
                employeeId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get attendance records by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of attendance records
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 200, offset = 0, status, department_id } = options;
            const values = [startDate, endDate];
            let paramIndex = 3;
            const conditions = ['a.is_deleted = false', 'a.attendance_date BETWEEN $1 AND $2'];

            if (status) {
                conditions.push(`a.status = $${paramIndex++}`);
                values.push(status);
            }
            if (department_id) {
                conditions.push(`e.department_id = $${paramIndex++}`);
                values.push(department_id);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    a.id, a.employee_id, a.attendance_date,
                    a.check_in_time, a.check_out_time, a.total_hours,
                    a.status,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    d.name as department_name
                FROM attendance a
                JOIN employees e ON a.employee_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                ${whereClause}
                ORDER BY a.attendance_date ASC, e.first_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Attendance records found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding attendance records by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get today's attendance records
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of today's attendance records
     */
    async getTodayAttendance(options = {}) {
        const today = new Date().toISOString().split('T')[0];
        return this.getByDateRange(today, today, options);
    },

    /**
     * Create new attendance record (check-in)
     * @param {Object} attendanceData - Attendance data
     * @returns {Promise<Object>} Created attendance record
     */
    async create(attendanceData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (attendanceData.status && !this.validStatuses.includes(attendanceData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            // Check if attendance already exists for this employee and date
            const existing = await this.findByEmployeeAndDate(
                attendanceData.employee_id,
                attendanceData.attendance_date || new Date().toISOString().split('T')[0]
            );
            if (existing) {
                throw new Error('Attendance record already exists for this employee on this date');
            }

            const query = `
                INSERT INTO attendance (
                    id, employee_id, attendance_date,
                    check_in_time, check_in_method, check_in_location,
                    check_in_ip, check_in_device_info,
                    status, notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    $6, $7,
                    $8, $9,
                    $10, NOW(), NOW()
                )
                RETURNING 
                    id, employee_id, attendance_date,
                    check_in_time, status, created_at
            `;

            const values = [
                attendanceData.employee_id,
                attendanceData.attendance_date || new Date().toISOString().split('T')[0],
                attendanceData.check_in_time || new Date(),
                attendanceData.check_in_method || null,
                attendanceData.check_in_location || null,
                attendanceData.check_in_ip || null,
                attendanceData.check_in_device_info || null,
                attendanceData.status || 'present',
                attendanceData.notes || null,
                attendanceData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Attendance record created (check-in)', {
                attendanceId: result.rows[0].id,
                employeeId: attendanceData.employee_id,
                attendanceDate: result.rows[0].attendance_date
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating attendance record', {
                error: error.message,
                employeeId: attendanceData.employee_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update attendance record (check-out)
     * @param {string} id - Attendance ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated attendance record
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'check_out_time', 'check_out_method', 'check_out_location',
                'check_out_ip', 'check_out_device_info',
                'status', 'notes',
                'verified_by', 'verified_at'
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
                UPDATE attendance 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, employee_id, attendance_date,
                    check_in_time, check_out_time, total_hours,
                    status, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Attendance record not found');
            }

            await db.commitTransaction(client);

            logger.info('Attendance record updated (check-out)', {
                attendanceId: id,
                employeeId: result.rows[0].employee_id
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating attendance record', {
                error: error.message,
                attendanceId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Record check-out
     * @param {string} id - Attendance ID
     * @param {Object} checkoutData - Check-out data
     * @returns {Promise<Object>} Updated attendance record
     */
    async checkOut(id, checkoutData) {
        const updates = {
            check_out_time: new Date(),
            check_out_method: checkoutData.method,
            check_out_location: checkoutData.location,
            check_out_ip: checkoutData.ip,
            check_out_device_info: checkoutData.device_info,
            updated_by: checkoutData.checked_out_by
        };
        return this.update(id, updates);
    },

    /**
     * Verify attendance record
     * @param {string} id - Attendance ID
     * @param {string} verifiedBy - User who verified
     * @returns {Promise<Object>} Updated attendance record
     */
    async verify(id, verifiedBy) {
        return this.update(id, {
            verified_by: verifiedBy,
            verified_at: new Date(),
            updated_by: verifiedBy
        });
    },

    /**
     * Get attendance summary for employee (monthly)
     * @param {string} employeeId - Employee UUID
     * @param {number} year - Year
     * @param {number} month - Month (1-12)
     * @returns {Promise<Object>} Summary statistics
     */
    async getMonthlySummary(employeeId, year, month) {
        try {
            const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0];

            const query = `
                SELECT 
                    COUNT(*) as total_days,
                    COUNT(*) FILTER (WHERE status = 'present') as present,
                    COUNT(*) FILTER (WHERE status = 'absent') as absent,
                    COUNT(*) FILTER (WHERE status = 'late') as late,
                    COUNT(*) FILTER (WHERE status = 'half_day') as half_day,
                    COUNT(*) FILTER (WHERE status = 'leave') as leave,
                    COUNT(*) FILTER (WHERE status = 'holiday') as holiday,
                    SUM(total_hours) as total_hours,
                    AVG(total_hours)::numeric(10,2) as avg_hours_per_day,
                    (SELECT COUNT(*) FROM calendar_days WHERE date BETWEEN $1 AND $2 AND is_working_day = true) as working_days
                FROM attendance
                WHERE employee_id = $3
                    AND attendance_date BETWEEN $1 AND $2
                    AND is_deleted = false
            `;

            const result = await db.query(query, [startDate, endDate, employeeId]);

            const summary = result.rows[0];
            summary.attendance_percentage = summary.working_days > 0 
                ? ((summary.present + summary.half_day * 0.5) / summary.working_days * 100).toFixed(2)
                : 0;

            logger.debug('Monthly attendance summary retrieved', {
                employeeId,
                year,
                month,
                summary
            });

            return summary;
        } catch (error) {
            logger.error('Error getting monthly attendance summary', {
                error: error.message,
                employeeId,
                year,
                month
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get attendance statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND attendance_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(*) FILTER (WHERE status = 'present') as present,
                    COUNT(*) FILTER (WHERE status = 'absent') as absent,
                    COUNT(*) FILTER (WHERE status = 'late') as late,
                    COUNT(*) FILTER (WHERE status = 'half_day') as half_day,
                    COUNT(*) FILTER (WHERE status = 'leave') as leave,
                    COUNT(*) FILTER (WHERE status = 'holiday') as holiday,
                    COUNT(DISTINCT employee_id) as unique_employees,
                    SUM(total_hours) as total_hours,
                    AVG(total_hours)::numeric(10,2) as avg_hours_per_day,
                    AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/3600)::numeric(10,2) as avg_working_hours
                FROM attendance
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Attendance statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting attendance statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Bulk create attendance records (e.g., for holidays or leaves)
     * @param {Array} attendanceDataArray - Array of attendance data
     * @returns {Promise<Array>} Created attendance records
     */
    async bulkCreate(attendanceDataArray) {
        const client = await db.getClient();
        const created = [];

        try {
            await db.beginTransaction(client);

            for (const data of attendanceDataArray) {
                const result = await this.create(data);
                created.push(result);
            }

            await db.commitTransaction(client);

            logger.info('Bulk attendance records created', {
                count: created.length
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk creating attendance records', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Soft delete attendance record
     * @param {string} id - Attendance ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE attendance 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Attendance record not found');
            }

            await db.commitTransaction(client);

            logger.info('Attendance record soft deleted', {
                attendanceId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting attendance record', {
                error: error.message,
                attendanceId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Attendance;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */