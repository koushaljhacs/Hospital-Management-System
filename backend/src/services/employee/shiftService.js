/**
 * ======================================================================
 * FILE: backend/src/services/employee/shiftService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee shift service - Handles business logic for shift management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-53] Shift change requires 24 hours notice
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const shiftService = {
    /**
     * Get employee shifts
     */
    async getEmployeeShifts(employeeId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT s.*, 
                       st.name as shift_type_name,
                       st.start_time,
                       st.end_time,
                       st.duration_hours,
                       CASE 
                           WHEN s.status = 'scheduled' AND s.date < CURRENT_DATE THEN 'past'
                           WHEN s.status = 'scheduled' AND s.date = CURRENT_DATE THEN 'today'
                           WHEN s.status = 'scheduled' AND s.date > CURRENT_DATE THEN 'upcoming'
                           ELSE s.status
                       END as shift_status
                FROM employee_shifts s
                JOIN shift_types st ON s.shift_type_id = st.id
                WHERE s.employee_id = $1 AND s.is_deleted = false
            `;
            const values = [employeeId];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND s.date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND s.date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY s.date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE date = CURRENT_DATE) as today,
                    COUNT(*) FILTER (WHERE date > CURRENT_DATE) as upcoming,
                    COUNT(*) FILTER (WHERE date < CURRENT_DATE) as past,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
                FROM employee_shifts
                WHERE employee_id = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [employeeId]);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getEmployeeShifts', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get current shift
     */
    async getCurrentShift(employeeId) {
        try {
            const query = `
                SELECT s.*, 
                       st.name as shift_type_name,
                       st.start_time,
                       st.end_time,
                       st.duration_hours
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
     * Get upcoming shifts
     */
    async getUpcomingShifts(employeeId, options = {}) {
        try {
            const { days = 7, page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT s.*, 
                       st.name as shift_type_name,
                       st.start_time,
                       st.end_time,
                       st.duration_hours
                FROM employee_shifts s
                JOIN shift_types st ON s.shift_type_id = st.id
                WHERE s.employee_id = $1 
                    AND s.date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($2 || ' days')::INTERVAL
                    AND s.status = 'scheduled'
                    AND s.is_deleted = false
                ORDER BY s.date ASC, st.start_time ASC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [employeeId, days, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM employee_shifts
                WHERE employee_id = $1 
                    AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($2 || ' days')::INTERVAL
                    AND status = 'scheduled'
                    AND is_deleted = false
            `;
            const count = await db.query(countQuery, [employeeId, days]);

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
            logger.error('Error in getUpcomingShifts', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get shift history
     */
    async getShiftHistory(employeeId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT s.*, 
                       st.name as shift_type_name,
                       st.start_time,
                       st.end_time,
                       st.duration_hours,
                       a.check_in_time,
                       a.check_out_time,
                       a.status as attendance_status
                FROM employee_shifts s
                JOIN shift_types st ON s.shift_type_id = st.id
                LEFT JOIN attendance a ON s.id = a.shift_id AND a.employee_id = s.employee_id
                WHERE s.employee_id = $1 
                    AND s.date < CURRENT_DATE
                    AND s.is_deleted = false
            `;
            const values = [employeeId];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND s.date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND s.date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY s.date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM employee_shifts
                WHERE employee_id = $1 AND date < CURRENT_DATE AND is_deleted = false
            `;
            const count = await db.query(countQuery, [employeeId]);

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
            logger.error('Error in getShiftHistory', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get shift calendar
     */
    async getShiftCalendar(employeeId, options = {}) {
        try {
            const { month, year } = options;
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);

            const query = `
                SELECT s.date,
                       st.name as shift_type_name,
                       st.start_time,
                       st.end_time,
                       s.status
                FROM employee_shifts s
                JOIN shift_types st ON s.shift_type_id = st.id
                WHERE s.employee_id = $1 
                    AND s.date BETWEEN $2 AND $3
                    AND s.is_deleted = false
                ORDER BY s.date ASC
            `;

            const result = await db.query(query, [employeeId, startDate, endDate]);

            // Group by date
            const calendar = {};
            result.rows.forEach(shift => {
                const dateStr = shift.date.toISOString().split('T')[0];
                if (!calendar[dateStr]) {
                    calendar[dateStr] = [];
                }
                calendar[dateStr].push(shift);
            });

            return calendar;
        } catch (error) {
            logger.error('Error in getShiftCalendar', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get shift by ID
     */
    async getShiftById(employeeId, shiftId) {
        try {
            const query = `
                SELECT s.*, 
                       st.name as shift_type_name,
                       st.start_time,
                       st.end_time,
                       st.duration_hours
                FROM employee_shifts s
                JOIN shift_types st ON s.shift_type_id = st.id
                WHERE s.id = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [shiftId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getShiftById', { error: error.message, employeeId, shiftId });
            throw error;
        }
    },

    /**
     * Request shift change [BR-53]
     */
    async requestShiftChange(employeeId, shiftId, requestData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if shift change is within notice period
            const shiftQuery = await client.query(`
                SELECT date FROM employee_shifts WHERE id = $1
            `, [shiftId]);

            if (shiftQuery.rows.length === 0) {
                throw new Error('Shift not found');
            }

            const shiftDate = new Date(shiftQuery.rows[0].date);
            const now = new Date();
            const hoursNotice = (shiftDate - now) / (1000 * 60 * 60);

            if (hoursNotice < 24) {
                throw new Error('Shift change requires at least 24 hours notice');
            }

            const query = `
                INSERT INTO shift_change_requests (
                    id, shift_id, employee_id, requested_shift_type,
                    requested_date, reason, status, requested_at,
                    requested_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', $6, $7, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                shiftId,
                employeeId,
                requestData.requested_shift_type,
                requestData.requested_date,
                requestData.reason,
                requestData.requested_at,
                requestData.requested_by
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
    }
};

module.exports = shiftService;