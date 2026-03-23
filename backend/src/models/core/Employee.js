/**
 * ======================================================================
 * FILE: backend/src/models/core/Employee.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee model for database operations.
 * Handles all employee-related database queries for staff management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: employees
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users table)
 * - employee_id: string (unique)
 * - first_name: string
 * - last_name: string
 * - date_of_birth: date
 * - gender: enum (male, female, other, prefer_not_to_say)
 * - blood_group: enum (A+, A-, B+, B-, AB+, AB-, O+, O-, unknown)
 * - marital_status: enum (single, married, divorced, widowed, other)
 * - nationality: string
 * - religion: string
 * - language_preference: string
 * - timezone: string
 * - department_id: uuid
 * - designation: string
 * - specialization: string
 * - qualification: string
 * - license_number: string
 * - experience_years: integer
 * - joining_date: date
 * - phone: string
 * - alternate_phone: string
 * - email: string
 * - personal_email: string
 * - address: text
 * - city: string
 * - state: string
 * - country: string
 * - postal_code: string
 * - emergency_contact_name: string
 * - emergency_contact_phone: string
 * - emergency_contact_relation: string
 * - employment_status: enum (active, inactive, on_leave, terminated, retired)
 * - employment_type: enum (full_time, part_time, contract, intern, consultant)
 * - shift_type: enum (morning, evening, night, general)
 * - work_location: string
 * - reporting_to: uuid
 * - salary: decimal
 * - bank_account_number: string
 * - bank_ifsc_code: string
 * - pan_card: string
 * - uan_number: string
 * - esi_number: string
 * - profile_photo: text
 * - is_active: boolean
 * - is_deleted: boolean
 * - created_at: timestamp
 * - updated_at: timestamp
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation with core CRUD operations
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const Employee = {
    /**
     * Table name
     */
    tableName: 'employees',

    /**
     * Find employee by ID
     * @param {string} id - Employee UUID
     * @returns {Promise<Object|null>} Employee object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    e.id, e.user_id, e.employee_id, e.first_name, e.last_name,
                    e.date_of_birth, e.gender, e.blood_group, e.marital_status,
                    e.nationality, e.religion, e.language_preference, e.timezone,
                    e.department_id, d.name as department_name,
                    e.designation, e.specialization, e.qualification,
                    e.license_number, e.experience_years, e.joining_date,
                    e.phone, e.alternate_phone, e.email, e.personal_email,
                    e.address, e.city, e.state, e.country, e.postal_code,
                    e.emergency_contact_name, e.emergency_contact_phone,
                    e.emergency_contact_relation, e.employment_status,
                    e.employment_type, e.shift_type, e.work_location,
                    e.reporting_to, e.salary, e.profile_photo,
                    e.is_active, e.created_at, e.updated_at,
                    u.username, u.email as user_email, u.role, u.status as user_status
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                JOIN users u ON e.user_id = u.id
                WHERE e.id = $1 AND e.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Employee found by ID', { employeeId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding employee by ID', {
                error: error.message,
                employeeId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find employee by user ID
     * @param {string} userId - User UUID
     * @returns {Promise<Object|null>} Employee object or null
     */
    async findByUserId(userId) {
        try {
            const query = `
                SELECT 
                    e.id, e.user_id, e.employee_id, e.first_name, e.last_name,
                    e.date_of_birth, e.gender, e.blood_group, e.marital_status,
                    e.nationality, e.religion, e.language_preference, e.timezone,
                    e.department_id, d.name as department_name,
                    e.designation, e.specialization, e.qualification,
                    e.license_number, e.experience_years, e.joining_date,
                    e.phone, e.alternate_phone, e.email, e.personal_email,
                    e.address, e.city, e.state, e.country, e.postal_code,
                    e.emergency_contact_name, e.emergency_contact_phone,
                    e.emergency_contact_relation, e.employment_status,
                    e.employment_type, e.shift_type, e.work_location,
                    e.reporting_to, e.salary, e.profile_photo,
                    e.is_active, e.created_at, e.updated_at
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.user_id = $1 AND e.is_deleted = false
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Employee found by user ID', { userId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding employee by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find employee by employee ID
     * @param {string} employeeId - Employee ID (EMP-YYYY-XXXX)
     * @returns {Promise<Object|null>} Employee object or null
     */
    async findByEmployeeId(employeeId) {
        try {
            const query = `
                SELECT 
                    e.id, e.user_id, e.employee_id, e.first_name, e.last_name,
                    e.designation, e.department_id, d.name as department_name,
                    e.employment_status, e.email, e.phone,
                    e.joining_date, e.profile_photo, e.is_active
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.employee_id = $1 AND e.is_deleted = false
            `;

            const result = await db.query(query, [employeeId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Employee found by employee ID', { employeeId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding employee by employee ID', {
                error: error.message,
                employeeId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find employees by department
     * @param {string} departmentId - Department UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of employees
     */
    async findByDepartment(departmentId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    e.id, e.user_id, e.employee_id, e.first_name, e.last_name,
                    e.designation, e.specialization, e.employment_status,
                    e.email, e.phone, e.joining_date, e.profile_photo,
                    d.name as department_name
                FROM employees e
                JOIN departments d ON e.department_id = d.id
                WHERE e.department_id = $1 
                    AND e.is_deleted = false
                    AND e.is_active = true
                ORDER BY e.first_name ASC, e.last_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [departmentId, limit, offset]);

            logger.debug('Employees found by department', {
                departmentId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding employees by department', {
                error: error.message,
                departmentId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find employees by role
     * @param {string} role - User role (doctor, nurse, etc.)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of employees
     */
    async findByRole(role, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    e.id, e.user_id, e.employee_id, e.first_name, e.last_name,
                    e.designation, e.specialization, e.employment_status,
                    e.email, e.phone, e.profile_photo,
                    u.role, u.status as user_status
                FROM employees e
                JOIN users u ON e.user_id = u.id
                WHERE u.role = $1 
                    AND e.is_deleted = false
                    AND u.is_deleted = false
                ORDER BY e.first_name ASC, e.last_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [role, limit, offset]);

            logger.debug('Employees found by role', {
                role,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding employees by role', {
                error: error.message,
                role
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find doctors (role = doctor)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of doctors
     */
    async findDoctors(options = {}) {
        return this.findByRole('doctor', options);
    },

    /**
     * Find nurses (role = nurse)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of nurses
     */
    async findNurses(options = {}) {
        return this.findByRole('nurse', options);
    },

    /**
     * Create new employee
     * @param {Object} employeeData - Employee data
     * @param {string} employeeData.user_id - User ID
     * @param {string} employeeData.first_name - First name
     * @param {string} employeeData.last_name - Last name
     * @param {string} [employeeData.date_of_birth] - Date of birth
     * @param {string} [employeeData.gender] - Gender
     * @param {string} [employeeData.department_id] - Department ID
     * @param {string} employeeData.designation - Designation
     * @param {string} [employeeData.specialization] - Specialization
     * @param {string} [employeeData.qualification] - Qualification
     * @param {string} [employeeData.license_number] - License number
     * @param {number} [employeeData.experience_years] - Experience years
     * @param {string} employeeData.joining_date - Joining date
     * @param {string} [employeeData.phone] - Phone number
     * @param {string} [employeeData.email] - Work email
     * @param {string} [employeeData.address] - Address
     * @param {string} [employeeData.emergency_contact_name] - Emergency contact name
     * @param {string} [employeeData.emergency_contact_phone] - Emergency contact phone
     * @param {string} [employeeData.employment_status] - Employment status
     * @param {string} [employeeData.employment_type] - Employment type
     * @param {number} [employeeData.salary] - Salary
     * @returns {Promise<Object>} Created employee
     */
    async create(employeeData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existingEmployee = await this.findByUserId(employeeData.user_id);
            if (existingEmployee) {
                throw new Error('User already has an employee profile');
            }

            const employeeId = await this.generateEmployeeId();

            const query = `
                INSERT INTO employees (
                    id, user_id, employee_id, first_name, last_name,
                    date_of_birth, gender, department_id, designation,
                    specialization, qualification, license_number,
                    experience_years, joining_date, phone, email,
                    address, emergency_contact_name, emergency_contact_phone,
                    emergency_contact_relation, employment_status,
                    employment_type, shift_type, work_location, salary,
                    profile_photo, is_active, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                    $19, $20, $21, $22, $23, $24, $25, true, NOW(), NOW()
                )
                RETURNING 
                    id, user_id, employee_id, first_name, last_name,
                    designation, joining_date, created_at
            `;

            const values = [
                employeeData.user_id,
                employeeId,
                employeeData.first_name,
                employeeData.last_name,
                employeeData.date_of_birth || null,
                employeeData.gender || null,
                employeeData.department_id || null,
                employeeData.designation,
                employeeData.specialization || null,
                employeeData.qualification || null,
                employeeData.license_number || null,
                employeeData.experience_years || 0,
                employeeData.joining_date,
                employeeData.phone || null,
                employeeData.email || null,
                employeeData.address || null,
                employeeData.emergency_contact_name || null,
                employeeData.emergency_contact_phone || null,
                employeeData.emergency_contact_relation || null,
                employeeData.employment_status || 'active',
                employeeData.employment_type || 'full_time',
                employeeData.shift_type || 'general',
                employeeData.work_location || null,
                employeeData.salary || null,
                employeeData.profile_photo || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Employee created successfully', {
                employeeId: result.rows[0].employee_id,
                userId: employeeData.user_id,
                fullName: `${employeeData.first_name} ${employeeData.last_name}`
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating employee', {
                error: error.message,
                userId: employeeData.user_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Generate employee ID
     * @returns {Promise<string>} Generated employee ID
     */
    async generateEmployeeId() {
        try {
            const year = new Date().getFullYear();
            const yearSuffix = year.toString().slice(-2);

            const query = `
                SELECT COUNT(*) as count 
                FROM employees 
                WHERE employee_id LIKE $1
            `;
            const result = await db.query(query, [`EMP-${yearSuffix}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `EMP-${yearSuffix}-${sequence}`;
        } catch (error) {
            logger.error('Error generating employee ID', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Update employee
     * @param {string} id - Employee ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated employee
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'first_name', 'last_name', 'date_of_birth', 'gender',
                'department_id', 'designation', 'specialization',
                'qualification', 'license_number', 'experience_years',
                'phone', 'email', 'address', 'city', 'state', 'country',
                'postal_code', 'emergency_contact_name', 'emergency_contact_phone',
                'emergency_contact_relation', 'employment_status',
                'employment_type', 'shift_type', 'work_location', 'salary',
                'profile_photo', 'is_active'
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
                UPDATE employees 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, user_id, employee_id, first_name, last_name,
                    designation, department_id, employment_status,
                    is_active, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Employee not found');
            }

            await db.commitTransaction(client);

            logger.info('Employee updated successfully', {
                employeeId: result.rows[0].employee_id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating employee', {
                error: error.message,
                employeeId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get all employees with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {string} [filters.department_id] - Department ID
     * @param {string} [filters.employment_status] - Employment status
     * @param {string} [filters.employment_type] - Employment type
     * @param {string} [filters.role] - User role
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of employees
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['e.is_deleted = false', 'u.is_deleted = false'];

            if (filters.department_id) {
                conditions.push(`e.department_id = $${paramIndex++}`);
                values.push(filters.department_id);
            }
            if (filters.employment_status) {
                conditions.push(`e.employment_status = $${paramIndex++}`);
                values.push(filters.employment_status);
            }
            if (filters.employment_type) {
                conditions.push(`e.employment_type = $${paramIndex++}`);
                values.push(filters.employment_type);
            }
            if (filters.role) {
                conditions.push(`u.role = $${paramIndex++}`);
                values.push(filters.role);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`e.is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    e.id, e.user_id, e.employee_id, e.first_name, e.last_name,
                    e.designation, e.specialization, e.department_id,
                    d.name as department_name, e.employment_status,
                    e.employment_type, e.phone, e.email, e.joining_date,
                    e.salary, e.profile_photo, e.is_active, e.created_at,
                    u.role, u.status as user_status
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                JOIN users u ON e.user_id = u.id
                ${whereClause}
                ORDER BY e.created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all employees', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all employees', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get employees by reporting manager
     * @param {string} managerId - Manager employee UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of employees
     */
    async getByReportingManager(managerId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    e.id, e.user_id, e.employee_id, e.first_name, e.last_name,
                    e.designation, e.department_id, d.name as department_name,
                    e.employment_status, e.phone, e.email,
                    e.joining_date, e.profile_photo
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.reporting_to = $1 
                    AND e.is_deleted = false
                    AND e.is_active = true
                ORDER BY e.first_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [managerId, limit, offset]);

            logger.debug('Employees found by reporting manager', {
                managerId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting employees by reporting manager', {
                error: error.message,
                managerId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get employee statistics
     * @returns {Promise<Object>} Employee statistics
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_employees,
                    COUNT(*) FILTER (WHERE employment_status = 'active') as active,
                    COUNT(*) FILTER (WHERE employment_status = 'on_leave') as on_leave,
                    COUNT(*) FILTER (WHERE employment_type = 'full_time') as full_time,
                    COUNT(*) FILTER (WHERE employment_type = 'part_time') as part_time,
                    COUNT(*) FILTER (WHERE employment_type = 'contract') as contract,
                    COUNT(*) FILTER (WHERE gender = 'male') as male,
                    COUNT(*) FILTER (WHERE gender = 'female') as female,
                    COUNT(*) FILTER (WHERE u.role = 'doctor') as doctors,
                    COUNT(*) FILTER (WHERE u.role = 'nurse') as nurses,
                    COUNT(*) FILTER (WHERE u.role = 'pharmacist') as pharmacists,
                    COUNT(*) FILTER (WHERE u.role = 'lab_technician') as lab_technicians
                FROM employees e
                JOIN users u ON e.user_id = u.id
                WHERE e.is_deleted = false AND u.is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Employee statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting employee statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search employees
     * @param {string} searchTerm - Search term (name, employee ID, phone, email)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of employees
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    e.id, e.user_id, e.employee_id, e.first_name, e.last_name,
                    e.designation, e.department_id, d.name as department_name,
                    e.employment_status, e.phone, e.email, e.profile_photo,
                    u.role
                FROM employees e
                LEFT JOIN departments d ON e.department_id = d.id
                JOIN users u ON e.user_id = u.id
                WHERE (e.first_name ILIKE $1 
                    OR e.last_name ILIKE $1 
                    OR e.employee_id ILIKE $1
                    OR e.phone ILIKE $1
                    OR e.email ILIKE $1)
                    AND e.is_deleted = false
                    AND u.is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN e.employee_id ILIKE $2 THEN 1
                        WHEN e.first_name ILIKE $2 THEN 2
                        WHEN e.last_name ILIKE $2 THEN 3
                        ELSE 4
                    END,
                    e.first_name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Employee search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching employees', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count total employees
     * @param {Object} filters - Filter conditions
     * @returns {Promise<number>} Total count
     */
    async count(filters = {}) {
        try {
            let query = `
                SELECT COUNT(*) as total 
                FROM employees e
                JOIN users u ON e.user_id = u.id
                WHERE e.is_deleted = false AND u.is_deleted = false
            `;
            const values = [];
            const conditions = [];

            if (filters.department_id) {
                conditions.push(`e.department_id = $${values.length + 1}`);
                values.push(filters.department_id);
            }
            if (filters.employment_status) {
                conditions.push(`e.employment_status = $${values.length + 1}`);
                values.push(filters.employment_status);
            }
            if (filters.role) {
                conditions.push(`u.role = $${values.length + 1}`);
                values.push(filters.role);
            }

            if (conditions.length > 0) {
                query += ' AND ' + conditions.join(' AND ');
            }

            const result = await db.query(query, values);

            return parseInt(result.rows[0].total);
        } catch (error) {
            logger.error('Error counting employees', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete employee
     * @param {string} id - Employee ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE employees 
                SET is_deleted = true,
                    is_active = false,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id, user_id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Employee not found');
            }

            const userQuery = `
                UPDATE users 
                SET status = 'inactive',
                    updated_at = NOW()
                WHERE id = $1
            `;
            await client.query(userQuery, [result.rows[0].user_id]);

            await db.commitTransaction(client);

            logger.info('Employee soft deleted', {
                employeeId: id,
                userId: result.rows[0].user_id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting employee', {
                error: error.message,
                employeeId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Employee;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create new employee
 * const employee = await Employee.create({
 *     user_id: 'user-uuid-here',
 *     first_name: 'John',
 *     last_name: 'Smith',
 *     designation: 'Senior Doctor',
 *     specialization: 'Cardiology',
 *     qualification: 'MD, DM',
 *     license_number: 'MC-12345',
 *     experience_years: 10,
 *     joining_date: '2024-01-15',
 *     department_id: 'cardiology-dept-id',
 *     phone: '+919876543210',
 *     email: 'john.smith@hospital.com',
 *     salary: 150000,
 *     emergency_contact_name: 'Jane Smith',
 *     emergency_contact_phone: '+919876543211'
 * });
 * 
 * // Find employee by ID
 * const employee = await Employee.findById(employeeId);
 * 
 * // Find employee by user ID
 * const employee = await Employee.findByUserId(userId);
 * 
 * // Find doctors
 * const doctors = await Employee.findDoctors({ limit: 20 });
 * 
 * // Find nurses
 * const nurses = await Employee.findNurses({ limit: 20 });
 * 
 * // Find employees by department
 * const cardiologyStaff = await Employee.findByDepartment(deptId);
 * 
 * // Get all employees with filters
 * const employees = await Employee.getAll(
 *     { department_id: deptId, employment_status: 'active' },
 *     { limit: 20, offset: 0 }
 * );
 * 
 * // Search employees
 * const results = await Employee.search('John');
 * 
 * // Get employees by reporting manager
 * const team = await Employee.getByReportingManager(managerId);
 * 
 * // Get employee statistics
 * const stats = await Employee.getStatistics();
 * 
 * // Update employee
 * const updated = await Employee.update(employeeId, {
 *     designation: 'Senior Consultant',
 *     salary: 180000,
 *     is_active: true
 * });
 * 
 * // Count employees
 * const total = await Employee.count({ role: 'doctor' });
 * 
 * // Soft delete employee
 * await Employee.delete(employeeId, adminUserId);
 * 
 * ======================================================================
 */