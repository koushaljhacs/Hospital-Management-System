/**
 * ======================================================================
 * FILE: backend/src/controllers/public/departmentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Public department controller - No authentication required.
 * Endpoints: /public/departments, /public/departments/:id, /public/departments/:id/doctors
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const departmentController = {
    /**
     * List all departments
     * GET /api/v1/public/departments
     */
    async listDepartments(req, res, next) {
        try {
            const query = `
                SELECT 
                    d.id, d.name, d.code, d.floor, d.description,
                    d.phone, d.email,
                    e.first_name as hod_first_name,
                    e.last_name as hod_last_name,
                    COUNT(doc.id) as doctor_count
                FROM departments d
                LEFT JOIN employees e ON d.head_of_department = e.id
                LEFT JOIN employees doc ON doc.department_id = d.id 
                    AND doc.designation = 'Doctor' 
                    AND doc.is_active = true
                WHERE d.is_active = true
                GROUP BY d.id, e.id
                ORDER BY d.name ASC
            `;

            const result = await db.query(query);

            logger.info('Public list departments accessed', {
                count: result.rows.length
            });

            res.json({
                success: true,
                data: result.rows
            });
        } catch (error) {
            logger.error('Error in public list departments', { error: error.message });
            next(error);
        }
    },

    /**
     * Get department details by ID
     * GET /api/v1/public/departments/:id
     */
    async getDepartmentDetails(req, res, next) {
        try {
            const { id } = req.params;

            const query = `
                SELECT 
                    d.id, d.name, d.code, d.floor, d.description,
                    d.phone, d.email, d.opening_hours, d.services,
                    e.id as hod_id,
                    e.first_name as hod_first_name,
                    e.last_name as hod_last_name,
                    e.qualification as hod_qualification,
                    e.profile_photo as hod_photo
                FROM departments d
                LEFT JOIN employees e ON d.head_of_department = e.id
                WHERE d.id = $1 AND d.is_active = true
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Department not found'
                });
            }

            logger.info('Public department details accessed', { departmentId: id });

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            logger.error('Error in public department details', { error: error.message, departmentId: req.params.id });
            next(error);
        }
    },

    /**
     * Get doctors in a department
     * GET /api/v1/public/departments/:id/doctors
     */
    async getDepartmentDoctors(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const query = `
                SELECT 
                    e.id, e.first_name, e.last_name, e.specialization,
                    e.qualification, e.experience_years, e.profile_photo,
                    e.about, e.languages
                FROM employees e
                WHERE e.department_id = $1 
                    AND e.designation = 'Doctor'
                    AND e.is_active = true 
                    AND e.is_deleted = false
                ORDER BY e.first_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [id, limit, offset]);

            const countResult = await db.query(
                `SELECT COUNT(*) as total FROM employees e
                 WHERE e.department_id = $1 AND e.designation = 'Doctor' 
                    AND e.is_active = true AND e.is_deleted = false`,
                [id]
            );

            logger.info('Public department doctors accessed', {
                departmentId: id,
                count: result.rows.length
            });

            res.json({
                success: true,
                data: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
                }
            });
        } catch (error) {
            logger.error('Error in public department doctors', { error: error.message, departmentId: req.params.id });
            next(error);
        }
    }
};

module.exports = departmentController;