/**
 * ======================================================================
 * FILE: backend/src/services/employee/leaveService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee leave service - Handles business logic for leave management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-55] Leave balance cannot go negative
 * - [BR-56] Leave request requires minimum 2 days advance notice
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const leaveService = {
    /**
     * Get employee leaves
     */
    async getEmployeeLeaves(employeeId, options = {}) {
        try {
            const { page = 1, limit = 20, status, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT l.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as applied_by_name,
                       CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
                FROM leave_requests l
                LEFT JOIN users u ON l.applied_by = u.id
                LEFT JOIN users a ON l.approved_by = a.id
                WHERE l.employee_id = $1 AND l.is_deleted = false
            `;
            const values = [employeeId];
            let paramIndex = 2;

            if (status) {
                query += ` AND l.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND l.start_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND l.end_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY l.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    SUM(leave_days) FILTER (WHERE status = 'approved') as total_approved_days
                FROM leave_requests
                WHERE employee_id = $1 AND is_deleted = false
                ${status ? 'AND status = $2' : ''}
            `;
            const countValues = [employeeId];
            if (status) countValues.push(status);
            const count = await db.query(countQuery, countValues);

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
            logger.error('Error in getEmployeeLeaves', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get leave balance [BR-55]
     */
    async getLeaveBalance(employeeId) {
        try {
            // Get leave policy for employee
            const policyQuery = `
                SELECT annual_leaves, sick_leaves, casual_leaves, carry_forward_limit
                FROM leave_policies
                WHERE employee_id = $1 AND is_active = true
            `;
            let policy = await db.query(policyQuery, [employeeId]);
            
            let annualLimit = 12;
            let sickLimit = 10;
            let casualLimit = 6;
            
            if (policy.rows.length > 0) {
                annualLimit = policy.rows[0].annual_leaves;
                sickLimit = policy.rows[0].sick_leaves;
                casualLimit = policy.rows[0].casual_leaves;
            }

            // Get taken leaves for current year
            const currentYear = new Date().getFullYear();
            const startOfYear = new Date(currentYear, 0, 1);
            const endOfYear = new Date(currentYear, 11, 31);

            const takenQuery = `
                SELECT 
                    SUM(CASE WHEN leave_type = 'annual' THEN leave_days ELSE 0 END) as annual_taken,
                    SUM(CASE WHEN leave_type = 'sick' THEN leave_days ELSE 0 END) as sick_taken,
                    SUM(CASE WHEN leave_type = 'casual' THEN leave_days ELSE 0 END) as casual_taken
                FROM leave_requests
                WHERE employee_id = $1 
                    AND status = 'approved'
                    AND start_date >= $2
                    AND end_date <= $3
                    AND is_deleted = false
            `;
            const taken = await db.query(takenQuery, [employeeId, startOfYear, endOfYear]);

            // Calculate balance
            const annualTaken = parseFloat(taken.rows[0]?.annual_taken || 0);
            const sickTaken = parseFloat(taken.rows[0]?.sick_taken || 0);
            const casualTaken = parseFloat(taken.rows[0]?.casual_taken || 0);

            const balance = {
                annual: Math.max(0, annualLimit - annualTaken),
                sick: Math.max(0, sickLimit - sickTaken),
                casual: Math.max(0, casualLimit - casualTaken),
                total: Math.max(0, (annualLimit + sickLimit + casualLimit) - (annualTaken + sickTaken + casualTaken)),
                taken: {
                    annual: annualTaken,
                    sick: sickTaken,
                    casual: casualTaken,
                    total: annualTaken + sickTaken + casualTaken
                },
                policy: {
                    annual: annualLimit,
                    sick: sickLimit,
                    casual: casualLimit
                }
            };

            return balance;
        } catch (error) {
            logger.error('Error in getLeaveBalance', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get leave history
     */
    async getLeaveHistory(employeeId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT l.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as approved_by_name
                FROM leave_requests l
                LEFT JOIN users u ON l.approved_by = u.id
                WHERE l.employee_id = $1 
                    AND l.status IN ('approved', 'rejected', 'cancelled')
                    AND l.is_deleted = false
            `;
            const values = [employeeId];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND l.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND l.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY l.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total,
                       SUM(leave_days) as total_days
                FROM leave_requests
                WHERE employee_id = $1 
                    AND status IN ('approved', 'rejected', 'cancelled')
                    AND is_deleted = false
                ${from_date ? 'AND created_at >= $2' : ''}
                ${to_date ? 'AND created_at <= $3' : ''}
            `;
            const countValues = [employeeId];
            if (from_date) countValues.push(from_date);
            if (to_date) countValues.push(to_date);
            const count = await db.query(countQuery, countValues);

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
            logger.error('Error in getLeaveHistory', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get leave by ID
     */
    async getLeaveById(employeeId, leaveId) {
        try {
            const query = `
                SELECT l.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as applied_by_name,
                       CONCAT(a.first_name, ' ', a.last_name) as approved_by_name
                FROM leave_requests l
                LEFT JOIN users u ON l.applied_by = u.id
                LEFT JOIN users a ON l.approved_by = a.id
                WHERE l.id = $1 AND l.is_deleted = false
            `;

            const result = await db.query(query, [leaveId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getLeaveById', { error: error.message, employeeId, leaveId });
            throw error;
        }
    },

    /**
     * Apply for leave [BR-55][BR-56]
     */
    async applyLeave(employeeId, leaveData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate leave number
            const leaveNumber = await this.generateLeaveNumber();

            const query = `
                INSERT INTO leave_requests (
                    id, leave_number, employee_id, leave_type, start_date,
                    end_date, leave_days, reason, contact_number,
                    address_during_leave, status, applied_at, applied_by,
                    ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    'pending', $10, $11, $12, $13, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                leaveNumber,
                employeeId,
                leaveData.leave_type,
                leaveData.start_date,
                leaveData.end_date,
                leaveData.leave_days,
                leaveData.reason,
                leaveData.contact_number,
                leaveData.address_during_leave,
                leaveData.applied_at,
                leaveData.applied_by,
                leaveData.ip_address,
                leaveData.user_agent
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
     * Generate leave number
     */
    async generateLeaveNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM leave_requests
                WHERE leave_number LIKE $1
            `, [`LV-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `LV-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateLeaveNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Cancel leave
     */
    async cancelLeave(employeeId, leaveId, cancelData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE leave_requests 
                SET status = 'cancelled',
                    cancelled_at = $1,
                    cancelled_by = $2,
                    cancellation_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 
                    AND employee_id = $5 
                    AND status = 'pending'
                    AND is_deleted = false
                RETURNING *
            `;

            const values = [
                cancelData.cancelled_at,
                cancelData.cancelled_by,
                cancelData.reason,
                leaveId,
                employeeId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Leave request not found or cannot be cancelled');
            }

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

module.exports = leaveService;