/**
 * ======================================================================
 * FILE: backend/src/models/core/Department.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Department model for database operations.
 * Handles all department-related database queries for hospital departments.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: departments
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - name: string (unique)
 * - code: string (unique)
 * - description: text
 * - floor: integer
 * - head_of_department: uuid (foreign key to employees)
 * - phone: string
 * - email: string
 * - is_active: boolean
 * - created_at: timestamp
 * - updated_at: timestamp
 * - created_by: uuid
 * - updated_by: uuid
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation with core CRUD operations
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const Department = {
    /**
     * Table name
     */
    tableName: 'departments',

    /**
     * Find department by ID
     * @param {string} id - Department UUID
     * @returns {Promise<Object|null>} Department object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    d.id, d.name, d.code, d.description,
                    d.floor, d.head_of_department,
                    CONCAT(e.first_name, ' ', e.last_name) as hod_name,
                    e.employee_id as hod_employee_id,
                    d.phone, d.email, d.is_active,
                    d.created_at, d.updated_at
                FROM departments d
                LEFT JOIN employees e ON d.head_of_department = e.id
                WHERE d.id = $1 AND d.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Department found by ID', { departmentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding department by ID', {
                error: error.message,
                departmentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find department by code
     * @param {string} code - Department code
     * @returns {Promise<Object|null>} Department object or null
     */
    async findByCode(code) {
        try {
            const query = `
                SELECT 
                    id, name, code, description,
                    floor, head_of_department,
                    phone, email, is_active,
                    created_at, updated_at
                FROM departments 
                WHERE code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [code]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Department found by code', { code });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding department by code', {
                error: error.message,
                code
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find department by name
     * @param {string} name - Department name
     * @returns {Promise<Object|null>} Department object or null
     */
    async findByName(name) {
        try {
            const query = `
                SELECT 
                    id, name, code, description,
                    floor, head_of_department,
                    phone, email, is_active,
                    created_at, updated_at
                FROM departments 
                WHERE name = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [name]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Department found by name', { name });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding department by name', {
                error: error.message,
                name
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all departments with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {boolean} [filters.is_active] - Active status
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of departments
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    d.id, d.name, d.code, d.description,
                    d.floor, d.head_of_department,
                    CONCAT(e.first_name, ' ', e.last_name) as hod_name,
                    e.employee_id as hod_employee_id,
                    d.phone, d.email, d.is_active,
                    d.created_at,
                    COUNT(emp.id) as employee_count
                FROM departments d
                LEFT JOIN employees e ON d.head_of_department = e.id
                LEFT JOIN employees emp ON emp.department_id = d.id 
                    AND emp.is_deleted = false
                ${whereClause}
                GROUP BY d.id, e.id
                ORDER BY d.name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all departments', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all departments', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active departments (for dropdowns, etc.)
     * @returns {Promise<Array>} List of active departments
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, name, code, description,
                    floor, phone, email
                FROM departments 
                WHERE is_active = true AND is_deleted = false
                ORDER BY name ASC
            `;

            const result = await db.query(query);

            logger.debug('Active departments retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active departments', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new department
     * @param {Object} departmentData - Department data
     * @param {string} departmentData.name - Department name
     * @param {string} departmentData.code - Department code
     * @param {string} [departmentData.description] - Description
     * @param {number} [departmentData.floor] - Floor number
     * @param {string} [departmentData.head_of_department] - HOD employee ID
     * @param {string} [departmentData.phone] - Phone number
     * @param {string} [departmentData.email] - Email address
     * @param {boolean} [departmentData.is_active] - Active status
     * @param {string} [departmentData.created_by] - User who created
     * @returns {Promise<Object>} Created department
     */
    async create(departmentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existingCode = await this.findByCode(departmentData.code);
            if (existingCode) {
                throw new Error('Department code already exists');
            }

            const existingName = await this.findByName(departmentData.name);
            if (existingName) {
                throw new Error('Department name already exists');
            }

            const query = `
                INSERT INTO departments (
                    id, name, code, description, floor,
                    head_of_department, phone, email, is_active,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
                )
                RETURNING 
                    id, name, code, description, floor,
                    head_of_department, phone, email, is_active,
                    created_at
            `;

            const values = [
                departmentData.name,
                departmentData.code,
                departmentData.description || null,
                departmentData.floor || null,
                departmentData.head_of_department || null,
                departmentData.phone || null,
                departmentData.email || null,
                departmentData.is_active !== undefined ? departmentData.is_active : true,
                departmentData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Department created successfully', {
                departmentId: result.rows[0].id,
                name: departmentData.name,
                code: departmentData.code
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating department', {
                error: error.message,
                name: departmentData.name,
                code: departmentData.code
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update department
     * @param {string} id - Department ID
     * @param {Object} updates - Fields to update
     * @param {string} [updates.updated_by] - User who updated
     * @returns {Promise<Object>} Updated department
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const department = await this.findById(id);
            if (!department) {
                throw new Error('Department not found');
            }

            if (updates.code) {
                const existingCode = await this.findByCode(updates.code);
                if (existingCode && existingCode.id !== id) {
                    throw new Error('Department code already exists');
                }
            }

            if (updates.name) {
                const existingName = await this.findByName(updates.name);
                if (existingName && existingName.id !== id) {
                    throw new Error('Department name already exists');
                }
            }

            const allowedFields = [
                'name', 'code', 'description', 'floor',
                'head_of_department', 'phone', 'email', 'is_active'
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
                UPDATE departments 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, name, code, description, floor,
                    head_of_department, phone, email, is_active,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Department not found');
            }

            await db.commitTransaction(client);

            logger.info('Department updated successfully', {
                departmentId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating department', {
                error: error.message,
                departmentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get department with employees
     * @param {string} id - Department ID
     * @param {Object} options - Pagination options for employees
     * @returns {Promise<Object>} Department with employees
     */
    async getWithEmployees(id, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const departmentQuery = `
                SELECT 
                    d.id, d.name, d.code, d.description,
                    d.floor, d.head_of_department,
                    CONCAT(e.first_name, ' ', e.last_name) as hod_name,
                    e.employee_id as hod_employee_id,
                    d.phone, d.email, d.is_active,
                    d.created_at
                FROM departments d
                LEFT JOIN employees e ON d.head_of_department = e.id
                WHERE d.id = $1 AND d.is_deleted = false
            `;

            const departmentResult = await db.query(departmentQuery, [id]);

            if (departmentResult.rows.length === 0) {
                return null;
            }

            const employeesQuery = `
                SELECT 
                    emp.id, emp.user_id, emp.employee_id,
                    emp.first_name, emp.last_name,
                    emp.designation, emp.specialization,
                    emp.phone, emp.email, emp.joining_date,
                    emp.employment_status, emp.is_active,
                    u.role
                FROM employees emp
                JOIN users u ON emp.user_id = u.id
                WHERE emp.department_id = $1 
                    AND emp.is_deleted = false
                ORDER BY emp.employment_status DESC, emp.first_name ASC
                LIMIT $2 OFFSET $3
            `;

            const employeesResult = await db.query(employeesQuery, [id, limit, offset]);

            const employeesCountQuery = `
                SELECT COUNT(*) as total
                FROM employees
                WHERE department_id = $1 AND is_deleted = false
            `;
            const countResult = await db.query(employeesCountQuery, [id]);

            const department = departmentResult.rows[0];
            department.employees = employeesResult.rows;
            department.employee_count = parseInt(countResult.rows[0].total);

            logger.debug('Department with employees retrieved', {
                departmentId: id,
                employeeCount: employeesResult.rows.length
            });

            return department;
        } catch (error) {
            logger.error('Error getting department with employees', {
                error: error.message,
                departmentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get department statistics
     * @returns {Promise<Object>} Department statistics
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_departments,
                    COUNT(*) FILTER (WHERE is_active = true) as active_departments,
                    COUNT(*) FILTER (WHERE is_active = false) as inactive_departments,
                    COUNT(DISTINCT head_of_department) as departments_with_hod,
                    COUNT(*) FILTER (WHERE head_of_department IS NULL) as departments_without_hod,
                    COUNT(emp.id) as total_employees,
                    AVG(emp_count.employee_count)::numeric(10,2) as avg_employees_per_department
                FROM departments d
                LEFT JOIN employees emp ON emp.department_id = d.id 
                    AND emp.is_deleted = false
                LEFT JOIN (
                    SELECT department_id, COUNT(*) as employee_count
                    FROM employees
                    WHERE is_deleted = false
                    GROUP BY department_id
                ) emp_count ON d.id = emp_count.department_id
                WHERE d.is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Department statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting department statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search departments
     * @param {string} searchTerm - Search term (name, code)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of departments
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    d.id, d.name, d.code, d.description,
                    d.floor, d.phone, d.email, d.is_active,
                    CONCAT(e.first_name, ' ', e.last_name) as hod_name,
                    COUNT(emp.id) as employee_count
                FROM departments d
                LEFT JOIN employees e ON d.head_of_department = e.id
                LEFT JOIN employees emp ON emp.department_id = d.id 
                    AND emp.is_deleted = false
                WHERE (d.name ILIKE $1 
                    OR d.code ILIKE $1
                    OR d.description ILIKE $1)
                    AND d.is_deleted = false
                GROUP BY d.id, e.id
                ORDER BY 
                    CASE 
                        WHEN d.name ILIKE $2 THEN 1
                        WHEN d.code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    d.name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Department search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching departments', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get departments by floor
     * @param {number} floor - Floor number
     * @returns {Promise<Array>} List of departments
     */
    async getByFloor(floor) {
        try {
            const query = `
                SELECT 
                    id, name, code, description,
                    floor, phone, email, is_active
                FROM departments 
                WHERE floor = $1 AND is_deleted = false
                ORDER BY name ASC
            `;

            const result = await db.query(query, [floor]);

            logger.debug('Departments found by floor', {
                floor,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting departments by floor', {
                error: error.message,
                floor
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count total departments
     * @param {Object} filters - Filter conditions
     * @returns {Promise<number>} Total count
     */
    async count(filters = {}) {
        try {
            let query = 'SELECT COUNT(*) as total FROM departments WHERE is_deleted = false';
            const values = [];
            const conditions = [];

            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${values.length + 1}`);
                values.push(filters.is_active);
            }
            if (filters.floor !== undefined) {
                conditions.push(`floor = $${values.length + 1}`);
                values.push(filters.floor);
            }

            if (conditions.length > 0) {
                query += ' AND ' + conditions.join(' AND ');
            }

            const result = await db.query(query, values);

            return parseInt(result.rows[0].total);
        } catch (error) {
            logger.error('Error counting departments', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete department
     * @param {string} id - Department ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const department = await this.findById(id);
            if (!department) {
                throw new Error('Department not found');
            }

            const employeeQuery = `
                SELECT COUNT(*) as count FROM employees 
                WHERE department_id = $1 AND is_deleted = false
            `;
            const employeeResult = await client.query(employeeQuery, [id]);

            if (parseInt(employeeResult.rows[0].count) > 0) {
                throw new Error('Cannot delete department with active employees');
            }

            const query = `
                UPDATE departments 
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
                throw new Error('Department not found');
            }

            await db.commitTransaction(client);

            logger.info('Department soft deleted', {
                departmentId: id,
                name: department.name,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting department', {
                error: error.message,
                departmentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get department hierarchy (for reporting)
     * @returns {Promise<Array>} Department hierarchy
     */
    async getHierarchy() {
        try {
            const query = `
                SELECT 
                    d.id, d.name, d.code, d.floor,
                    COUNT(emp.id) as employee_count,
                    json_agg(
                        json_build_object(
                            'id', emp.id,
                            'employee_id', emp.employee_id,
                            'name', CONCAT(emp.first_name, ' ', emp.last_name),
                            'designation', emp.designation,
                            'role', u.role
                        )
                    ) FILTER (WHERE emp.id IS NOT NULL) as employees
                FROM departments d
                LEFT JOIN employees emp ON emp.department_id = d.id 
                    AND emp.is_deleted = false
                LEFT JOIN users u ON emp.user_id = u.id
                WHERE d.is_deleted = false
                GROUP BY d.id
                ORDER BY d.name ASC
            `;

            const result = await db.query(query);

            logger.debug('Department hierarchy retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting department hierarchy', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = Department;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create new department
 * const department = await Department.create({
 *     name: 'Cardiology',
 *     code: 'CARD',
 *     description: 'Department of Cardiology',
 *     floor: 3,
 *     phone: '+911234567890',
 *     email: 'cardiology@hospital.com',
 *     is_active: true,
 *     created_by: adminUserId
 * });
 * 
 * // Find department by ID
 * const department = await Department.findById(deptId);
 * 
 * // Find department by code
 * const department = await Department.findByCode('CARD');
 * 
 * // Get all active departments
 * const departments = await Department.getActive();
 * 
 * // Get all departments with filters
 * const allDepts = await Department.getAll(
 *     { is_active: true },
 *     { limit: 20, offset: 0 }
 * );
 * 
 * // Get department with employees
 * const deptWithEmployees = await Department.getWithEmployees(deptId);
 * 
 * // Search departments
 * const results = await Department.search('cardio');
 * 
 * // Get departments by floor
 * const thirdFloorDepts = await Department.getByFloor(3);
 * 
 * // Get department statistics
 * const stats = await Department.getStatistics();
 * 
 * // Get department hierarchy
 * const hierarchy = await Department.getHierarchy();
 * 
 * // Update department
 * const updated = await Department.update(deptId, {
 *     head_of_department: hodEmployeeId,
 *     is_active: true,
 *     updated_by: adminUserId
 * });
 * 
 * // Count departments
 * const total = await Department.count({ is_active: true });
 * 
 * // Soft delete department (only if no employees)
 * await Department.delete(deptId, adminUserId);
 * 
 * ======================================================================
 */