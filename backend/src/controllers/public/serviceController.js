/**
 * ======================================================================
 * FILE: backend/src/controllers/public/serviceController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Public services and facilities controller - No authentication required.
 * Endpoints: /public/facilities, /public/services, /public/services/:id, /public/services/pricing
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const serviceController = {
    /**
     * List hospital facilities
     * GET /api/v1/public/facilities
     */
    async listFacilities(req, res, next) {
        try {
            const query = `
                SELECT 
                    id, name, description, icon, category,
                    location, floor, opening_time, closing_time,
                    is_available, available_days
                FROM facilities
                WHERE is_active = true
                ORDER BY category, name ASC
            `;

            const result = await db.query(query);

            // Group by category for better frontend display
            const grouped = result.rows.reduce((acc, facility) => {
                if (!acc[facility.category]) {
                    acc[facility.category] = [];
                }
                acc[facility.category].push(facility);
                return acc;
            }, {});

            logger.info('Public list facilities accessed', {
                total: result.rows.length,
                categories: Object.keys(grouped).length
            });

            res.json({
                success: true,
                data: grouped,
                summary: {
                    total: result.rows.length,
                    categories: Object.keys(grouped)
                }
            });
        } catch (error) {
            logger.error('Error in public list facilities', { error: error.message });
            next(error);
        }
    },

    /**
     * List all services
     * GET /api/v1/public/services
     */
    async listServices(req, res, next) {
        try {
            const { category, department_id } = req.query;
            let query = `
                SELECT 
                    s.id, s.name, s.description, s.category,
                    s.duration_minutes, s.department_id,
                    d.name as department_name,
                    MIN(sp.price) as starting_price
                FROM services s
                JOIN departments d ON s.department_id = d.id
                LEFT JOIN service_pricing sp ON s.id = sp.service_id
                WHERE s.is_active = true
            `;
            const values = [];
            let paramIndex = 1;

            if (category) {
                query += ` AND s.category = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            if (department_id) {
                query += ` AND s.department_id = $${paramIndex}`;
                values.push(department_id);
                paramIndex++;
            }

            query += ` GROUP BY s.id, d.id ORDER BY s.category, s.name ASC`;

            const result = await db.query(query, values);

            // Get unique categories for filter
            const categories = await db.query(`
                SELECT DISTINCT category FROM services WHERE is_active = true ORDER BY category
            `);

            logger.info('Public list services accessed', {
                count: result.rows.length,
                filters: { category, department_id }
            });

            res.json({
                success: true,
                data: result.rows,
                filters: {
                    categories: categories.rows.map(c => c.category),
                    total: result.rows.length
                }
            });
        } catch (error) {
            logger.error('Error in public list services', { error: error.message });
            next(error);
        }
    },

    /**
     * Get service details by ID
     * GET /api/v1/public/services/:id
     */
    async getServiceDetails(req, res, next) {
        try {
            const { id } = req.params;

            const query = `
                SELECT 
                    s.id, s.name, s.description, s.category,
                    s.duration_minutes, s.preparation_instructions,
                    s.department_id, d.name as department_name,
                    d.floor as department_floor, d.phone as department_phone
                FROM services s
                JOIN departments d ON s.department_id = d.id
                WHERE s.id = $1 AND s.is_active = true
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Service not found'
                });
            }

            // Get pricing for this service
            const pricingQuery = `
                SELECT 
                    id, price, currency, description,
                    is_insurance_covered, is_discountable,
                    valid_from, valid_to
                FROM service_pricing
                WHERE service_id = $1 
                    AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
                    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
                ORDER BY price ASC
            `;
            const pricing = await db.query(pricingQuery, [id]);

            // Get doctors who provide this service
            const doctorsQuery = `
                SELECT 
                    e.id, e.first_name, e.last_name, e.specialization,
                    e.qualification, e.experience_years, e.profile_photo
                FROM employee_services es
                JOIN employees e ON es.employee_id = e.id
                WHERE es.service_id = $1 
                    AND e.designation = 'Doctor'
                    AND e.is_active = true
                ORDER BY e.first_name ASC
                LIMIT 10
            `;
            const doctors = await db.query(doctorsQuery, [id]);

            logger.info('Public service details accessed', { serviceId: id });

            res.json({
                success: true,
                data: {
                    ...result.rows[0],
                    pricing: pricing.rows,
                    doctors: doctors.rows
                }
            });
        } catch (error) {
            logger.error('Error in public service details', { error: error.message, serviceId: req.params.id });
            next(error);
        }
    },

    /**
     * Get service pricing
     * GET /api/v1/public/services/pricing
     */
    async getServicePricing(req, res, next) {
        try {
            const { service_id, department_id } = req.query;

            let query = `
                SELECT 
                    sp.id, sp.price, sp.currency, sp.description,
                    sp.is_insurance_covered, sp.is_discountable,
                    s.id as service_id, s.name as service_name,
                    s.category as service_category,
                    d.id as department_id, d.name as department_name
                FROM service_pricing sp
                JOIN services s ON sp.service_id = s.id
                JOIN departments d ON s.department_id = d.id
                WHERE sp.valid_from <= CURRENT_DATE 
                    AND (sp.valid_to IS NULL OR sp.valid_to >= CURRENT_DATE)
            `;
            const values = [];
            let paramIndex = 1;

            if (service_id) {
                query += ` AND s.id = $${paramIndex}`;
                values.push(service_id);
                paramIndex++;
            }

            if (department_id) {
                query += ` AND d.id = $${paramIndex}`;
                values.push(department_id);
                paramIndex++;
            }

            query += ` ORDER BY d.name, s.category, sp.price ASC`;

            const result = await db.query(query, values);

            // Calculate price ranges
            const priceRanges = {
                min: Math.min(...result.rows.map(r => parseFloat(r.price))),
                max: Math.max(...result.rows.map(r => parseFloat(r.price))),
                avg: (result.rows.reduce((acc, r) => acc + parseFloat(r.price), 0) / result.rows.length).toFixed(2)
            };

            logger.info('Public service pricing accessed', {
                count: result.rows.length,
                filters: { service_id, department_id }
            });

            res.json({
                success: true,
                data: result.rows,
                summary: {
                    total: result.rows.length,
                    price_range: priceRanges,
                    insurance_covered: result.rows.filter(r => r.is_insurance_covered).length,
                    discountable: result.rows.filter(r => r.is_discountable).length
                }
            });
        } catch (error) {
            logger.error('Error in public service pricing', { error: error.message });
            next(error);
        }
    }
};

module.exports = serviceController;