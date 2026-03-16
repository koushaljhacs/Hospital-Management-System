/**
 * ======================================================================
 * FILE: backend/src/controllers/public/doctorController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Public doctor controller - No authentication required.
 * Endpoints: /public/doctors, /public/doctors/:id, /public/doctors/:id/schedule
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const doctorController = {
    /**
     * List all doctors (paginated)
     * GET /api/v1/public/doctors
     */
    async listDoctors(req, res, next) {
        try {
            const { page = 1, limit = 20, specialization, name } = req.query;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    e.id, e.first_name, e.last_name, e.specialization,
                    e.qualification, e.experience_years, e.profile_photo,
                    d.name as department_name, d.id as department_id
                FROM employees e
                JOIN departments d ON e.department_id = d.id
                WHERE e.designation = 'Doctor' 
                    AND e.is_active = true 
                    AND e.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (specialization) {
                query += ` AND e.specialization ILIKE $${paramIndex}`;
                values.push(`%${specialization}%`);
                paramIndex++;
            }

            if (name) {
                query += ` AND (e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex})`;
                values.push(`%${name}%`);
                paramIndex++;
            }

            query += ` ORDER BY e.first_name ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            // Get total count for pagination
            const countResult = await db.query(
                `SELECT COUNT(*) as total FROM employees e
                 WHERE e.designation = 'Doctor' AND e.is_active = true AND e.is_deleted = false`
            );

            logger.info('Public list doctors accessed', {
                count: result.rows.length,
                filters: { specialization, name }
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
            logger.error('Error in public list doctors', { error: error.message });
            next(error);
        }
    },

    /**
     * Get doctor details by ID
     * GET /api/v1/public/doctors/:id
     */
    async getDoctorDetails(req, res, next) {
        try {
            const { id } = req.params;

            const query = `
                SELECT 
                    e.id, e.first_name, e.last_name, e.specialization,
                    e.qualification, e.experience_years, e.profile_photo,
                    e.bio, e.education, e.awards, e.publications,
                    d.name as department_name, d.id as department_id,
                    d.floor as department_floor
                FROM employees e
                JOIN departments d ON e.department_id = d.id
                WHERE e.id = $1 AND e.designation = 'Doctor' 
                    AND e.is_active = true AND e.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Doctor not found'
                });
            }

            logger.info('Public doctor details accessed', { doctorId: id });

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            logger.error('Error in public doctor details', { error: error.message, doctorId: req.params.id });
            next(error);
        }
    },

    /**
     * Get doctor schedule
     * GET /api/v1/public/doctors/:id/schedule
     */
    async getDoctorSchedule(req, res, next) {
        try {
            const { id } = req.params;
            const { week_start } = req.query;

            // Default to current week
            const startDate = week_start ? new Date(week_start) : new Date();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);

            // Get doctor's regular schedule
            const scheduleQuery = `
                SELECT * FROM doctor_schedules
                WHERE doctor_id = $1 AND is_active = true
            `;
            const schedule = await db.query(scheduleQuery, [id]);

            // Get already booked appointments for this week
            const appointmentsQuery = `
                SELECT appointment_date, appointment_time
                FROM appointments
                WHERE doctor_id = $1 
                    AND appointment_date BETWEEN $2 AND $3
                    AND status NOT IN ('cancelled', 'completed')
            `;
            const appointments = await db.query(appointmentsQuery, [id, startDate, endDate]);

            // Mark booked slots
            const bookedSlots = appointments.rows.map(apt => 
                `${apt.appointment_date.toISOString().split('T')[0]}_${apt.appointment_time}`
            );

            const scheduleWithAvailability = schedule.rows.map(slot => ({
                ...slot,
                is_available: !bookedSlots.includes(`${slot.day}_${slot.start_time}`)
            }));

            logger.info('Public doctor schedule accessed', { doctorId: id });

            res.json({
                success: true,
                data: {
                    doctor_id: id,
                    week_start: startDate,
                    week_end: endDate,
                    schedule: scheduleWithAvailability
                }
            });
        } catch (error) {
            logger.error('Error in public doctor schedule', { error: error.message, doctorId: req.params.id });
            next(error);
        }
    }
};

module.exports = doctorController;