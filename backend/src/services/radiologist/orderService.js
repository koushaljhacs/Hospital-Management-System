/**
 * ======================================================================
 * FILE: backend/src/services/radiologist/orderService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist order service - Handles business logic for radiology orders.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-41] Critical findings require immediate notification
 * - [BR-43] Images must be reviewed within 24 hours
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const orderService = {
    /**
     * Get all radiology orders
     */
    async getAllOrders(radiologistId, options = {}) {
        try {
            const { page = 1, limit = 20, status, patient_id, from_date, to_date, priority } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT o.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.phone as patient_phone,
                       d.id as doctor_id,
                       d.first_name as doctor_first_name,
                       d.last_name as doctor_last_name,
                       d.specialization as doctor_specialization,
                       COUNT(DISTINCT i.id) as image_count,
                       MAX(i.uploaded_at) as last_upload,
                       EXISTS (
                           SELECT 1 FROM radiology_reports r 
                           WHERE r.order_id = o.id AND r.status IN ('final', 'verified')
                       ) as has_report
                FROM radiology_orders o
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                LEFT JOIN radiology_images i ON o.id = i.order_id AND i.is_deleted = false
                WHERE o.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND o.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND o.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (priority) {
                query += ` AND o.priority = $${paramIndex}`;
                values.push(priority);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND o.ordered_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND o.ordered_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` GROUP BY o.id, p.id, d.id
                      ORDER BY 
                          CASE o.priority
                              WHEN 'stat' THEN 1
                              WHEN 'urgent' THEN 2
                              ELSE 3
                          END,
                          o.ordered_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE priority = 'stat') as stat_count,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
                    COUNT(*) FILTER (WHERE is_emergency = true) as emergency_count
                FROM radiology_orders
                WHERE is_deleted = false
                ${status ? 'AND status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
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
            logger.error('Error in getAllOrders', { error: error.message, radiologistId });
            throw error;
        }
    },

    /**
     * Get orders by status
     */
    async getOrdersByStatus(radiologistId, status, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT o.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       d.id as doctor_id,
                       d.first_name as doctor_first_name,
                       d.last_name as doctor_last_name,
                       EXTRACT(EPOCH FROM (NOW() - o.ordered_at))/3600 as hours_pending,
                       CASE 
                           WHEN EXTRACT(EPOCH FROM (NOW() - o.ordered_at))/3600 > 24 THEN true
                           ELSE false
                       END as is_overdue
                FROM radiology_orders o
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                WHERE o.status = $1 AND o.is_deleted = false
            `;
            const values = [status];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND o.ordered_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND o.ordered_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY 
                          CASE o.priority
                              WHEN 'stat' THEN 1
                              WHEN 'urgent' THEN 2
                              ELSE 3
                          END,
                          o.ordered_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM radiology_orders
                WHERE status = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [status]);

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0]?.total || 0),
                    overdue: result.rows.filter(r => r.is_overdue).length
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getOrdersByStatus', { error: error.message, radiologistId, status });
            throw error;
        }
    },

    /**
     * Get urgent orders
     */
    async getUrgentOrders(radiologistId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT o.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       d.id as doctor_id,
                       d.first_name as doctor_first_name,
                       d.last_name as doctor_last_name,
                       d.phone as doctor_phone,
                       EXTRACT(EPOCH FROM (NOW() - o.ordered_at))/3600 as hours_pending,
                       CASE 
                           WHEN r.critical_finding IS NOT NULL THEN true
                           ELSE false
                       END as has_critical_finding
                FROM radiology_orders o
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                LEFT JOIN radiology_reports r ON o.id = r.order_id
                WHERE (o.priority IN ('urgent', 'stat') OR o.is_emergency = true)
                    AND o.status != 'completed'
                    AND o.is_deleted = false
                ORDER BY 
                    CASE o.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        ELSE 3
                    END,
                    o.ordered_at ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM radiology_orders
                WHERE (priority IN ('urgent', 'stat') OR is_emergency = true)
                    AND status != 'completed'
                    AND is_deleted = false
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                summary: {
                    total: parseInt(count.rows[0]?.total || 0),
                    stat: result.rows.filter(r => r.priority === 'stat').length,
                    urgent: result.rows.filter(r => r.priority === 'urgent').length,
                    emergency: result.rows.filter(r => r.is_emergency).length
                },
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getUrgentOrders', { error: error.message, radiologistId });
            throw error;
        }
    },

    /**
     * Get order by ID
     */
    async getOrderById(radiologistId, orderId) {
        try {
            const query = `
                SELECT o.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.phone as patient_phone,
                       p.email as patient_email,
                       p.blood_group as patient_blood_group,
                       p.allergies as patient_allergies,
                       d.id as doctor_id,
                       d.first_name as doctor_first_name,
                       d.last_name as doctor_last_name,
                       d.specialization as doctor_specialization,
                       d.phone as doctor_phone,
                       d.email as doctor_email,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', i.id,
                                   'image_type', i.image_type,
                                   'image_url', i.image_url,
                                   'thumbnail_url', i.thumbnail_url,
                                   'modality', i.modality,
                                   'body_part', i.body_part,
                                   'uploaded_at', i.uploaded_at,
                                   'has_report', i.reported_at IS NOT NULL,
                                   'is_overdue', i.uploaded_at < NOW() - INTERVAL '24 hours' AND i.reported_at IS NULL
                               ) ORDER BY i.uploaded_at DESC
                           )
                           FROM radiology_images i
                           WHERE i.order_id = o.id AND i.is_deleted = false
                       ) as images,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', r.id,
                                   'status', r.status,
                                   'findings', LEFT(r.findings, 200),
                                   'impression', LEFT(r.impression, 200),
                                   'created_at', r.created_at,
                                   'verified_at', r.verified_at
                               ) ORDER BY r.created_at DESC
                           )
                           FROM radiology_reports r
                           WHERE r.order_id = o.id AND r.is_deleted = false
                           LIMIT 5
                       ) as reports
                FROM radiology_orders o
                JOIN patients p ON o.patient_id = p.id
                JOIN employees d ON o.doctor_id = d.id
                WHERE o.id = $1 AND o.is_deleted = false
            `;

            const result = await db.query(query, [orderId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const order = result.rows[0];
            
            // Calculate hours pending
            if (order.status === 'pending' || order.status === 'in_progress') {
                const orderedAt = new Date(order.ordered_at);
                const hoursSince = (Date.now() - orderedAt) / (1000 * 60 * 60);
                order.hours_pending = Math.floor(hoursSince);
                order.is_overdue = hoursSince > 24;
            }

            // Calculate average review time for images
            if (order.images && order.images.length > 0) {
                const reviewedImages = order.images.filter(i => i.has_report);
                if (reviewedImages.length > 0) {
                    const totalTime = reviewedImages.reduce((sum, img) => {
                        if (img.reported_at && img.uploaded_at) {
                            return sum + ((new Date(img.reported_at) - new Date(img.uploaded_at)) / (1000 * 60 * 60));
                        }
                        return sum;
                    }, 0);
                    order.avg_review_time_hours = (totalTime / reviewedImages.length).toFixed(1);
                }
            }

            return order;
        } catch (error) {
            logger.error('Error in getOrderById', { error: error.message, radiologistId, orderId });
            throw error;
        }
    },

    /**
     * Start order processing
     */
    async startOrder(radiologistId, orderId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_orders 
                SET status = 'in_progress',
                    started_at = $1,
                    started_by = $2,
                    started_notes = $3,
                    updated_at = NOW()
                WHERE id = $4 AND status = 'pending' AND is_deleted = false
                RETURNING *
            `;

            const values = [
                data.started_at,
                data.started_by,
                data.notes,
                orderId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Order not found or cannot be started');
            }

            // Log activity
            await client.query(`
                INSERT INTO radiology_activity_logs (
                    id, order_id, action, performed_by, performed_at, notes, created_at
                ) VALUES (
                    gen_random_uuid(), $1, 'started', $2, $3, $4, NOW()
                )
            `, [orderId, radiologistId, data.started_at, data.notes]);

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
     * Complete order
     */
    async completeOrder(radiologistId, orderId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if report exists
            const reportCheck = await client.query(`
                SELECT id FROM radiology_reports 
                WHERE order_id = $1 
                    AND status IN ('final', 'verified') 
                    AND is_deleted = false
            `, [orderId]);

            if (reportCheck.rows.length === 0) {
                throw new Error('Cannot complete order without a final report');
            }

            const query = `
                UPDATE radiology_orders 
                SET status = 'completed',
                    completed_at = $1,
                    completed_by = $2,
                    completed_notes = $3,
                    findings_summary = $4,
                    updated_at = NOW()
                WHERE id = $5 AND status = 'in_progress' AND is_deleted = false
                RETURNING *
            `;

            const values = [
                data.completed_at,
                data.completed_by,
                data.notes,
                data.findings_summary,
                orderId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Order not found or cannot be completed');
            }

            // Log activity
            await client.query(`
                INSERT INTO radiology_activity_logs (
                    id, order_id, action, performed_by, performed_at, notes, created_at
                ) VALUES (
                    gen_random_uuid(), $1, 'completed', $2, $3, $4, NOW()
                )
            `, [orderId, radiologistId, data.completed_at, data.notes]);

            // Calculate turnaround time
            const order = result.rows[0];
            const orderedAt = new Date(order.ordered_at);
            const completedAt = new Date(order.completed_at);
            const turnaroundHours = (completedAt - orderedAt) / (1000 * 60 * 60);

            // Log turnaround time for analytics
            await client.query(`
                INSERT INTO radiology_turnaround_metrics (
                    id, order_id, ordered_at, completed_at, turnaround_hours, 
                    priority, is_emergency, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
                )
            `, [orderId, orderedAt, completedAt, turnaroundHours, order.priority, order.is_emergency]);

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
     * Check if order has report
     */
    async hasReport(radiologistId, orderId) {
        try {
            const result = await db.query(`
                SELECT id FROM radiology_reports 
                WHERE order_id = $1 
                    AND status IN ('final', 'verified') 
                    AND is_deleted = false
            `, [orderId]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Error in hasReport', { error: error.message, radiologistId, orderId });
            throw error;
        }
    },

    /**
     * Get order statistics
     */
    async getOrderStatistics(radiologistId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND ordered_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND ordered_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE priority = 'stat') as stat_orders,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_orders,
                    COUNT(*) FILTER (WHERE is_emergency = true) as emergency_orders,
                    AVG(EXTRACT(EPOCH FROM (completed_at - ordered_at))/3600)::numeric(10,2) as avg_turnaround_hours,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - ordered_at))/3600) as median_turnaround_hours,
                    COUNT(*) FILTER (WHERE completed_at <= ordered_at + INTERVAL '24 hours') as completed_within_24h,
                    COUNT(*) FILTER (WHERE critical_finding = true) as critical_finding_orders
                FROM radiology_orders o
                LEFT JOIN radiology_reports r ON o.id = r.order_id
                WHERE o.is_deleted = false
                    ${dateFilter}
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getOrderStatistics', { error: error.message, radiologistId });
            throw error;
        }
    }
};

module.exports = orderService;