/**
 * ======================================================================
 * FILE: backend/src/services/employee/attendanceService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee attendance service - Handles business logic for attendance management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-54] Attendance check-in must be within 15 minutes of shift start
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const attendanceService = {
    /**
     * Get current shift for employee
     */
    async getCurrentShift(employeeId) {
        try {
            const query = `
                SELECT s.*, st.start_time, st.end_time, st.duration_hours
                FROM employee_shifts s
                JOIN shift_types st ON s.shift_type_id = st.id
                WHERE s.employee_id = $1 
                    AND s.date = CURRENT_DATE
                    AND s.status = 'scheduled'
                    AND s.is_deleted = false
            `;

            const result = await db.query(query, [employeeId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getCurrentShift', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get today's attendance
     */
    async getTodayAttendance(employeeId) {
        try {
            const query = `
                SELECT a.*, s.shift_type_id, st.name as shift_name,
                       st.start_time, st.end_time
                FROM attendance a
                JOIN employee_shifts s ON a.shift_id = s.id
                JOIN shift_types st ON s.shift_type_id = st.id
                WHERE a.employee_id = $1 
                    AND DATE(a.created_at) = CURRENT_DATE
                    AND a.is_deleted = false
            `;

            const result = await db.query(query, [employeeId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getTodayAttendance', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Check in [BR-54]
     */
    async checkIn(employeeId, checkInData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate attendance number
            const attendanceNumber = await this.generateAttendanceNumber();

            const query = `
                INSERT INTO attendance (
                    id, attendance_number, employee_id, shift_id, check_in_time,
                    check_in_location, check_in_device, status, notes,
                    ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                attendanceNumber,
                employeeId,
                checkInData.shift_id,
                checkInData.check_in_time,
                checkInData.check_in_location ? JSON.stringify(checkInData.check_in_location) : null,
                checkInData.check_in_device,
                checkInData.status,
                checkInData.notes,
                checkInData.ip_address,
                checkInData.user_agent
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
     * Generate attendance number
     */
    async generateAttendanceNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM attendance
                WHERE attendance_number LIKE $1
            `, [`ATT-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `ATT-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateAttendanceNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Check out
     */
    async checkOut(employeeId, attendanceId, checkOutData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE attendance 
                SET check_out_time = $1,
                    check_out_location = $2,
                    check_out_device = $3,
                    notes = COALESCE(CONCAT(notes, E'\\n', $4), $4),
                    updated_at = NOW()
                WHERE id = $5 AND employee_id = $6 AND check_out_time IS NULL
                RETURNING *
            `;

            const values = [
                checkOutData.check_out_time,
                checkOutData.check_out_location ? JSON.stringify(checkOutData.check_out_location) : null,
                checkOutData.check_out_device,
                checkOutData.notes,
                attendanceId,
                employeeId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Attendance record not found or already checked out');
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
     * Get attendance history
     */
    async getAttendanceHistory(employeeId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT a.*, 
                       s.shift_type_id,
                       st.name as shift_name,
                       st.start_time,
                       st.end_time,
                       EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600 as hours_worked
                FROM attendance a
                JOIN employee_shifts s ON a.shift_id = s.id
                JOIN shift_types st ON s.shift_type_id = st.id
                WHERE a.employee_id = $1 AND a.is_deleted = false
            `;
            const values = [employeeId];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND DATE(a.check_in_time) >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND DATE(a.check_in_time) <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY a.check_in_time DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM attendance
                WHERE employee_id = $1 AND is_deleted = false
                ${from_date ? 'AND DATE(check_in_time) >= $2' : ''}
                ${to_date ? 'AND DATE(check_in_time) <= $3' : ''}
            `;
            const countValues = [employeeId];
            if (from_date) countValues.push(from_date);
            if (to_date) countValues.push(to_date);
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                summary: { total: parseInt(count.rows[0]?.total || 0) },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getAttendanceHistory', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get attendance summary
     */
    async getAttendanceSummary(employeeId, options = {}) {
        try {
            const { year, month } = options;
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            const query = `
                SELECT 
                    COUNT(*) as total_days,
                    COUNT(*) FILTER (WHERE a.status = 'present') as present,
                    COUNT(*) FILTER (WHERE a.status = 'absent') as absent,
                    COUNT(*) FILTER (WHERE a.status = 'late') as late,
                    COUNT(*) FILTER (WHERE a.status = 'half_day') as half_day,
                    COUNT(*) FILTER (WHERE a.status = 'leave') as leave,
                    COUNT(*) FILTER (WHERE a.status = 'holiday') as holiday,
                    SUM(EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600)::numeric(10,2) as total_hours,
                    AVG(EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600)::numeric(10,2) as avg_hours
                FROM attendance a
                WHERE a.employee_id = $1 
                    AND DATE(a.check_in_time) BETWEEN $2 AND $3
                    AND a.is_deleted = false
            `;

            const result = await db.query(query, [employeeId, startDate, endDate]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAttendanceSummary', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get monthly attendance
     */
    async getMonthlyAttendance(employeeId, options = {}) {
        try {
            const { year, month } = options;
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            const query = `
                SELECT 
                    DATE(a.check_in_time) as date,
                    a.status,
                    a.check_in_time,
                    a.check_out_time,
                    EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time))/3600 as hours_worked,
                    a.notes
                FROM attendance a
                WHERE a.employee_id = $1 
                    AND DATE(a.check_in_time) BETWEEN $2 AND $3
                    AND a.is_deleted = false
                ORDER BY date ASC
            `;

            const result = await db.query(query, [employeeId, startDate, endDate]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getMonthlyAttendance', { error: error.message, employeeId });
            throw error;
        }
    }
};

module.exports = attendanceService;