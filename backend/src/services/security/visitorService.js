/**
 * ======================================================================
 * FILE: backend/src/services/security/visitorService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Security Guard visitor service - Handles business logic for visitor management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-50] Visitors must be registered before entry
 * - [BR-52] Active visitors cannot exceed capacity
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const visitorService = {
    /**
     * Get all visitors
     */
    async getAllVisitors(guardId, options = {}) {
        try {
            const { page = 1, limit = 20, status, visitor_type, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT v.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as registered_by_name,
                       CONCAT(c.first_name, ' ', c.last_name) as checked_out_by_name,
                       EXTRACT(EPOCH FROM (NOW() - v.check_in_time))/60 as minutes_since_checkin,
                       CASE 
                           WHEN v.check_out_time IS NULL THEN 'active'
                           ELSE 'completed'
                       END as current_status
                FROM visitors v
                LEFT JOIN users u ON v.registered_by = u.id
                LEFT JOIN users c ON v.checked_out_by = c.id
                WHERE v.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status === 'active') {
                query += ` AND v.check_out_time IS NULL`;
            } else if (status === 'completed') {
                query += ` AND v.check_out_time IS NOT NULL`;
            }

            if (visitor_type) {
                query += ` AND v.visitor_type = $${paramIndex}`;
                values.push(visitor_type);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND v.check_in_time >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND v.check_in_time <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY v.check_in_time DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE check_out_time IS NULL) as active,
                    COUNT(*) FILTER (WHERE check_out_time IS NOT NULL) as completed,
                    COUNT(*) FILTER (WHERE visitor_type = 'patient_relative') as patient_relative,
                    COUNT(*) FILTER (WHERE visitor_type = 'business') as business,
                    COUNT(*) FILTER (WHERE visitor_type = 'delivery') as delivery,
                    COUNT(*) FILTER (WHERE visitor_type = 'interview') as interview,
                    COUNT(*) FILTER (WHERE visitor_type = 'official') as official
                FROM visitors
                WHERE is_deleted = false
                ${visitor_type ? 'AND visitor_type = $1' : ''}
            `;
            const countValues = visitor_type ? [visitor_type] : [];
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
            logger.error('Error in getAllVisitors', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Get active visitors [BR-52]
     */
    async getActiveVisitors(guardId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT v.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as registered_by_name,
                       EXTRACT(EPOCH FROM (NOW() - v.check_in_time))/60 as minutes_since_checkin,
                       CASE 
                           WHEN EXTRACT(EPOCH FROM (NOW() - v.check_in_time))/60 > 120 THEN true
                           ELSE false
                       END as is_overdue
                FROM visitors v
                LEFT JOIN users u ON v.registered_by = u.id
                WHERE v.check_out_time IS NULL 
                    AND v.is_deleted = false
                ORDER BY v.check_in_time ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM visitors
                WHERE check_out_time IS NULL AND is_deleted = false
            `;
            const count = await db.query(countQuery);

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
            logger.error('Error in getActiveVisitors', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Get active visitor count [BR-52]
     */
    async getActiveVisitorCount(guardId) {
        try {
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM visitors
                WHERE check_out_time IS NULL AND is_deleted = false
            `);
            return parseInt(result.rows[0]?.count || 0);
        } catch (error) {
            logger.error('Error in getActiveVisitorCount', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Get visitor by ID
     */
    async getVisitorById(guardId, visitorId) {
        try {
            const query = `
                SELECT v.*, 
                       CONCAT(u1.first_name, ' ', u1.last_name) as registered_by_name,
                       CONCAT(u2.first_name, ' ', u2.last_name) as checked_out_by_name
                FROM visitors v
                LEFT JOIN users u1 ON v.registered_by = u1.id
                LEFT JOIN users u2 ON v.checked_out_by = u2.id
                WHERE v.id = $1 AND v.is_deleted = false
            `;

            const result = await db.query(query, [visitorId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getVisitorById', { error: error.message, guardId, visitorId });
            throw error;
        }
    },

    /**
     * Get visitor by ID card
     */
    async getVisitorByIdCard(guardId, idCardNumber) {
        try {
            const query = `
                SELECT v.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as registered_by_name
                FROM visitors v
                LEFT JOIN users u ON v.registered_by = u.id
                WHERE v.id_card_number = $1 
                    AND v.check_out_time IS NULL
                    AND v.is_deleted = false
            `;

            const result = await db.query(query, [idCardNumber]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getVisitorByIdCard', { error: error.message, guardId, idCardNumber });
            throw error;
        }
    },

    /**
     * Get visitor history
     */
    async getVisitorHistory(guardId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date, visitor_name, visitor_type } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT v.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as registered_by_name,
                       EXTRACT(EPOCH FROM (v.check_out_time - v.check_in_time))/60 as duration_minutes
                FROM visitors v
                LEFT JOIN users u ON v.registered_by = u.id
                WHERE v.check_out_time IS NOT NULL 
                    AND v.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                query += ` AND v.check_in_time >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND v.check_in_time <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            if (visitor_name) {
                query += ` AND v.name ILIKE $${paramIndex}`;
                values.push(`%${visitor_name}%`);
                paramIndex++;
            }

            if (visitor_type) {
                query += ` AND v.visitor_type = $${paramIndex}`;
                values.push(visitor_type);
                paramIndex++;
            }

            query += ` ORDER BY v.check_in_time DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/60)::numeric(10,2) as avg_duration
                FROM visitors
                WHERE check_out_time IS NOT NULL AND is_deleted = false
                ${from_date ? 'AND check_in_time >= $1' : ''}
                ${to_date ? 'AND check_in_time <= $2' : ''}
            `;
            const countValues = [];
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
            logger.error('Error in getVisitorHistory', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Get visitor statistics
     */
    async getVisitorStatistics(guardId, period = 'day') {
        try {
            let interval;
            switch(period) {
                case 'day':
                    interval = "INTERVAL '1 day'";
                    break;
                case 'week':
                    interval = "INTERVAL '7 days'";
                    break;
                case 'month':
                    interval = "INTERVAL '30 days'";
                    break;
                default:
                    interval = "INTERVAL '30 days'";
            }

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(check_in_time) as date,
                        COUNT(*) as total_visitors,
                        COUNT(*) FILTER (WHERE visitor_type = 'patient_relative') as patient_relatives,
                        COUNT(*) FILTER (WHERE visitor_type = 'business') as business,
                        COUNT(*) FILTER (WHERE visitor_type = 'delivery') as delivery,
                        COUNT(*) FILTER (WHERE visitor_type = 'interview') as interview,
                        COUNT(*) FILTER (WHERE visitor_type = 'official') as official,
                        AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/60)::numeric(10,2) as avg_duration,
                        COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (check_out_time - check_in_time))/60 > 120) as long_stay
                    FROM visitors
                    WHERE check_in_time > NOW() - ${interval}
                        AND is_deleted = false
                    GROUP BY DATE(check_in_time)
                )
                SELECT 
                    json_agg(daily_stats.* ORDER BY date) as daily,
                    (SELECT 
                        json_build_object(
                            'total', SUM(total_visitors),
                            'avg_daily', AVG(total_visitors),
                            'avg_duration', AVG(avg_duration),
                            'long_stay_percentage', 
                                CASE 
                                    WHEN SUM(total_visitors) > 0 
                                    THEN (SUM(long_stay)::float / SUM(total_visitors) * 100)::numeric(5,2)
                                    ELSE 0
                                END,
                            'by_type', json_build_object(
                                'patient_relative', SUM(patient_relatives),
                                'business', SUM(business),
                                'delivery', SUM(delivery),
                                'interview', SUM(interview),
                                'official', SUM(official)
                            )
                        )
                    FROM daily_stats) as summary
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getVisitorStatistics', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Register visitor [BR-50]
     */
    async registerVisitor(guardId, visitorData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate visitor ID
            const visitorIdNumber = await this.generateVisitorId();

            const query = `
                INSERT INTO visitors (
                    id, visitor_id, name, phone, visitor_type, id_card_number,
                    id_card_type, purpose, person_to_meet, department,
                    expected_duration, vehicle_number, notes, check_in_time,
                    registered_by, ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                visitorIdNumber,
                visitorData.name,
                visitorData.phone,
                visitorData.visitor_type,
                visitorData.id_card_number,
                visitorData.id_card_type,
                visitorData.purpose,
                visitorData.person_to_meet,
                visitorData.department,
                visitorData.expected_duration,
                visitorData.vehicle_number,
                visitorData.notes,
                visitorData.check_in_time,
                visitorData.registered_by,
                visitorData.ip_address,
                visitorData.user_agent
            ];

            const result = await client.query(query, values);

            // Log visitor registration
            await client.query(`
                INSERT INTO visitor_activity_logs (
                    id, visitor_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'registered', $2, $3, $4
                )
            `, [result.rows[0].id, visitorData.registered_by, visitorData.check_in_time, visitorData.notes]);

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
     * Generate visitor ID
     */
    async generateVisitorId() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM visitors
                WHERE visitor_id LIKE $1
            `, [`VIS-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `VIS-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateVisitorId', { error: error.message });
            throw error;
        }
    },

    /**
     * Check out visitor
     */
    async checkOutVisitor(guardId, visitorId, checkOutData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE visitors 
                SET check_out_time = $1,
                    check_out_notes = $2,
                    checked_out_by = $3,
                    updated_at = NOW()
                WHERE id = $4 AND check_out_time IS NULL
                RETURNING *
            `;

            const values = [
                checkOutData.check_out_time,
                checkOutData.notes,
                checkOutData.checked_out_by,
                visitorId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Visitor not found or already checked out');
            }

            // Log checkout activity
            await client.query(`
                INSERT INTO visitor_activity_logs (
                    id, visitor_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'checked_out', $2, $3, $4
                )
            `, [visitorId, checkOutData.checked_out_by, checkOutData.check_out_time, checkOutData.notes]);

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

module.exports = visitorService;