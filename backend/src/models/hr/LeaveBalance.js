/**
 * ======================================================================
 * FILE: backend/src/models/hr/LeaveBalance.js
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
 * LeaveBalance model for database operations.
 * Tracks employee leave balances by year for different leave types.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: leave_balances
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - employee_id: UUID (foreign key to employees, unique per year)
 * - year: integer
 * - annual_total: integer
 * - annual_used: integer
 * - annual_remaining: integer (generated)
 * - sick_total: integer
 * - sick_used: integer
 * - sick_remaining: integer (generated)
 * - casual_total: integer
 * - casual_used: integer
 * - casual_remaining: integer (generated)
 * - unpaid_total: integer
 * - unpaid_used: integer
 * - unpaid_remaining: integer (generated)
 * - last_updated: timestamp
 * - updated_by: uuid
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

const LeaveBalance = {
    /**
     * Table name
     */
    tableName: 'leave_balances',

    /**
     * Find balance by ID
     * @param {string} id - Balance UUID
     * @returns {Promise<Object|null>} Balance object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    lb.id, lb.employee_id, lb.year,
                    lb.annual_total, lb.annual_used, lb.annual_remaining,
                    lb.sick_total, lb.sick_used, lb.sick_remaining,
                    lb.casual_total, lb.casual_used, lb.casual_remaining,
                    lb.unpaid_total, lb.unpaid_used, lb.unpaid_remaining,
                    lb.last_updated, lb.updated_by,
                    lb.created_at, lb.updated_at,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    u.username as updated_by_name
                FROM leave_balances lb
                JOIN employees e ON lb.employee_id = e.id
                LEFT JOIN users u ON lb.updated_by = u.id
                WHERE lb.id = $1 AND lb.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Leave balance found by ID', { balanceId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding leave balance by ID', {
                error: error.message,
                balanceId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find balance by employee ID and year
     * @param {string} employeeId - Employee UUID
     * @param {number} year - Year (defaults to current year)
     * @returns {Promise<Object|null>} Balance object or null
     */
    async findByEmployeeAndYear(employeeId, year = null) {
        try {
            const targetYear = year || new Date().getFullYear();
            const query = `
                SELECT 
                    id, employee_id, year,
                    annual_total, annual_used, annual_remaining,
                    sick_total, sick_used, sick_remaining,
                    casual_total, casual_used, casual_remaining,
                    unpaid_total, unpaid_used, unpaid_remaining,
                    last_updated, updated_by
                FROM leave_balances
                WHERE employee_id = $1 AND year = $2 AND is_deleted = false
                LIMIT 1
            `;

            const result = await db.query(query, [employeeId, targetYear]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Leave balance found by employee and year', {
                employeeId,
                year: targetYear
            });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding leave balance by employee and year', {
                error: error.message,
                employeeId,
                year
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all leave balances with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of leave balances
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['lb.is_deleted = false'];

            if (filters.year) {
                conditions.push(`lb.year = $${paramIndex++}`);
                values.push(filters.year);
            }
            if (filters.department_id) {
                conditions.push(`e.department_id = $${paramIndex++}`);
                values.push(filters.department_id);
            }
            if (filters.low_balance !== undefined) {
                conditions.push(`(lb.annual_remaining < $${paramIndex++} OR lb.sick_remaining < $${paramIndex++} OR lb.casual_remaining < $${paramIndex++})`);
                const threshold = filters.low_balance_threshold || 2;
                values.push(threshold, threshold, threshold);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    lb.id, lb.employee_id, lb.year,
                    lb.annual_total, lb.annual_used, lb.annual_remaining,
                    lb.sick_total, lb.sick_used, lb.sick_remaining,
                    lb.casual_total, lb.casual_used, lb.casual_remaining,
                    lb.unpaid_total, lb.unpaid_used, lb.unpaid_remaining,
                    lb.last_updated,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    d.name as department_name
                FROM leave_balances lb
                JOIN employees e ON lb.employee_id = e.id
                LEFT JOIN departments d ON e.department_id = d.id
                ${whereClause}
                ORDER BY e.first_name ASC, e.last_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all leave balances', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all leave balances', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create or update leave balance (upsert)
     * @param {Object} balanceData - Balance data
     * @returns {Promise<Object>} Created/updated balance
     */
    async upsert(balanceData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existing = await this.findByEmployeeAndYear(
                balanceData.employee_id,
                balanceData.year || new Date().getFullYear()
            );

            let result;
            if (existing) {
                // Update existing
                const allowedFields = [
                    'annual_total', 'annual_used',
                    'sick_total', 'sick_used',
                    'casual_total', 'casual_used',
                    'unpaid_total', 'unpaid_used'
                ];

                const setClause = [];
                const values = [];
                let paramIndex = 1;

                for (const [key, value] of Object.entries(balanceData)) {
                    if (allowedFields.includes(key) && value !== undefined) {
                        setClause.push(`${key} = $${paramIndex}`);
                        values.push(value);
                        paramIndex++;
                    }
                }

                if (setClause.length === 0) {
                    throw new Error('No valid fields to update');
                }

                setClause.push(`last_updated = NOW()`);
                if (balanceData.updated_by) {
                    setClause.push(`updated_by = $${paramIndex++}`);
                    values.push(balanceData.updated_by);
                }
                setClause.push(`updated_at = NOW()`);
                values.push(existing.id);

                const query = `
                    UPDATE leave_balances 
                    SET ${setClause.join(', ')}
                    WHERE id = $${paramIndex} AND is_deleted = false
                    RETURNING 
                        id, employee_id, year,
                        annual_total, annual_used, annual_remaining,
                        sick_total, sick_used, sick_remaining,
                        casual_total, casual_used, casual_remaining,
                        unpaid_total, unpaid_used, unpaid_remaining,
                        last_updated
                `;

                const updateResult = await client.query(query, values);
                result = updateResult.rows[0];
            } else {
                // Create new
                const year = balanceData.year || new Date().getFullYear();

                const query = `
                    INSERT INTO leave_balances (
                        id, employee_id, year,
                        annual_total, annual_used,
                        sick_total, sick_used,
                        casual_total, casual_used,
                        unpaid_total, unpaid_used,
                        last_updated, updated_by,
                        created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2,
                        $3, $4,
                        $5, $6,
                        $7, $8,
                        $9, $10,
                        NOW(), $11,
                        NOW(), NOW()
                    )
                    RETURNING 
                        id, employee_id, year,
                        annual_total, annual_used, annual_remaining,
                        sick_total, sick_used, sick_remaining,
                        casual_total, casual_used, casual_remaining,
                        unpaid_total, unpaid_used, unpaid_remaining,
                        last_updated
                `;

                const values = [
                    balanceData.employee_id,
                    year,
                    balanceData.annual_total || 0,
                    balanceData.annual_used || 0,
                    balanceData.sick_total || 0,
                    balanceData.sick_used || 0,
                    balanceData.casual_total || 0,
                    balanceData.casual_used || 0,
                    balanceData.unpaid_total || 0,
                    balanceData.unpaid_used || 0,
                    balanceData.updated_by || null
                ];

                const insertResult = await client.query(query, values);
                result = insertResult.rows[0];
            }

            await db.commitTransaction(client);

            logger.info('Leave balance upserted', {
                employeeId: balanceData.employee_id,
                year: balanceData.year || new Date().getFullYear(),
                annualRemaining: result.annual_remaining
            });

            return result;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error upserting leave balance', {
                error: error.message,
                employeeId: balanceData.employee_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Adjust leave balance (add/subtract from used)
     * @param {string} employeeId - Employee UUID
     * @param {string} leaveType - Type of leave (annual, sick, casual, unpaid)
     * @param {number} adjustment - Amount to add (positive) or subtract (negative) from used
     * @param {string} reason - Reason for adjustment
     * @param {string} adjustedBy - User who adjusted
     * @param {number} year - Year (optional)
     * @returns {Promise<Object>} Updated balance
     */
    async adjustBalance(employeeId, leaveType, adjustment, reason, adjustedBy, year = null) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const targetYear = year || new Date().getFullYear();
            const balance = await this.findByEmployeeAndYear(employeeId, targetYear);
            if (!balance) {
                throw new Error('Leave balance not found for this employee and year');
            }

            const fieldMap = {
                annual: { total: 'annual_total', used: 'annual_used', remaining: 'annual_remaining' },
                sick: { total: 'sick_total', used: 'sick_used', remaining: 'sick_remaining' },
                casual: { total: 'casual_total', used: 'casual_used', remaining: 'casual_remaining' },
                unpaid: { total: 'unpaid_total', used: 'unpaid_used', remaining: 'unpaid_remaining' }
            };

            const field = fieldMap[leaveType];
            if (!field) {
                throw new Error('Invalid leave type');
            }

            const newUsed = balance[field.used] + adjustment;
            if (newUsed < 0) {
                throw new Error('Leave used cannot be negative');
            }
            if (newUsed > balance[field.total]) {
                throw new Error(`Cannot exceed total ${leaveType} leave balance`);
            }

            const query = `
                UPDATE leave_balances 
                SET ${field.used} = $1,
                    last_updated = NOW(),
                    updated_by = $2,
                    updated_at = NOW()
                WHERE employee_id = $3 AND year = $4 AND is_deleted = false
                RETURNING 
                    id, employee_id, year,
                    annual_total, annual_used, annual_remaining,
                    sick_total, sick_used, sick_remaining,
                    casual_total, casual_used, casual_remaining,
                    unpaid_total, unpaid_used, unpaid_remaining
            `;

            const result = await client.query(query, [newUsed, adjustedBy, employeeId, targetYear]);

            if (result.rows.length === 0) {
                throw new Error('Leave balance not found');
            }

            // Log adjustment (could be stored in a separate table, but for now just log)
            logger.info('Leave balance adjusted', {
                employeeId,
                leaveType,
                adjustment,
                newUsed: result.rows[0][field.used],
                reason,
                adjustedBy,
                year: targetYear
            });

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error adjusting leave balance', {
                error: error.message,
                employeeId,
                leaveType,
                adjustment
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Initialize default leave balances for an employee for a given year
     * @param {string} employeeId - Employee UUID
     * @param {number} year - Year
     * @param {Object} defaultAllocations - Default allocation values (optional)
     * @returns {Promise<Object>} Created balance
     */
    async initialize(employeeId, year, defaultAllocations = {}) {
        const allocations = {
            annual_total: defaultAllocations.annual_total || 12,
            sick_total: defaultAllocations.sick_total || 10,
            casual_total: defaultAllocations.casual_total || 6,
            unpaid_total: defaultAllocations.unpaid_total || 0,
            annual_used: 0,
            sick_used: 0,
            casual_used: 0,
            unpaid_used: 0
        };

        return this.upsert({
            employee_id: employeeId,
            year: year,
            ...allocations
        });
    },

    /**
     * Get leave balance statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const currentYear = new Date().getFullYear();
            const query = `
                SELECT 
                    COUNT(*) as total_balances,
                    COUNT(DISTINCT employee_id) as unique_employees,
                    AVG(annual_total)::numeric(10,2) as avg_annual_total,
                    AVG(annual_used)::numeric(10,2) as avg_annual_used,
                    AVG(annual_remaining)::numeric(10,2) as avg_annual_remaining,
                    AVG(sick_total)::numeric(10,2) as avg_sick_total,
                    AVG(sick_used)::numeric(10,2) as avg_sick_used,
                    AVG(sick_remaining)::numeric(10,2) as avg_sick_remaining,
                    AVG(casual_total)::numeric(10,2) as avg_casual_total,
                    AVG(casual_used)::numeric(10,2) as avg_casual_used,
                    AVG(casual_remaining)::numeric(10,2) as avg_casual_remaining,
                    SUM(annual_remaining) as total_annual_remaining,
                    SUM(sick_remaining) as total_sick_remaining,
                    SUM(casual_remaining) as total_casual_remaining
                FROM leave_balances
                WHERE year = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [currentYear]);

            logger.debug('Leave balance statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting leave balance statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get employees with low leave balance (for alerts)
     * @param {number} threshold - Threshold for low balance (default 2 days)
     * @returns {Promise<Array>} List of employees
     */
    async getLowBalanceEmployees(threshold = 2) {
        try {
            const currentYear = new Date().getFullYear();
            const query = `
                SELECT 
                    lb.employee_id, lb.year,
                    lb.annual_remaining, lb.sick_remaining, lb.casual_remaining,
                    e.first_name, e.last_name, e.employee_id as emp_id,
                    e.email, e.phone
                FROM leave_balances lb
                JOIN employees e ON lb.employee_id = e.id
                WHERE lb.year = $1
                    AND (lb.annual_remaining < $2 OR lb.sick_remaining < $2 OR lb.casual_remaining < $2)
                    AND lb.is_deleted = false
                ORDER BY 
                    LEAST(lb.annual_remaining, lb.sick_remaining, lb.casual_remaining) ASC
            `;

            const result = await db.query(query, [currentYear, threshold]);

            logger.debug('Low balance employees retrieved', {
                threshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting low balance employees', {
                error: error.message,
                threshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete leave balance
     * @param {string} id - Balance ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE leave_balances 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Leave balance not found');
            }

            await db.commitTransaction(client);

            logger.info('Leave balance soft deleted', {
                balanceId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting leave balance', {
                error: error.message,
                balanceId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = LeaveBalance;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */