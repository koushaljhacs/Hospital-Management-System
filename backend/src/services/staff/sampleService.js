/**
 * ======================================================================
 * FILE: backend/src/services/staff/sampleService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Ground Staff sample service - Handles business logic for sample collection.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-48] Samples must be delivered within 2 hours of collection
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const sampleService = {
    /**
     * Get all samples
     */
    async getAllSamples(staffId, options = {}) {
        try {
            const { page = 1, limit = 20, status, sample_type, priority, patient_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT s.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       lo.order_number,
                       CONCAT(coll.first_name, ' ', coll.last_name) as collected_by_name,
                       CONCAT(del.first_name, ' ', del.last_name) as delivered_by_name,
                       CASE 
                           WHEN s.status = 'collected' AND s.collected_at < NOW() - INTERVAL '2 hours' THEN true
                           ELSE false
                       END as is_overdue,
                       EXTRACT(EPOCH FROM (NOW() - s.collected_at))/3600 as hours_since_collection
                FROM samples s
                JOIN patients p ON s.patient_id = p.id
                LEFT JOIN lab_orders lo ON s.lab_order_id = lo.id
                LEFT JOIN users coll ON s.collected_by = coll.id
                LEFT JOIN users del ON s.delivered_by = del.id
                WHERE s.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND s.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (sample_type) {
                query += ` AND s.sample_type = $${paramIndex}`;
                values.push(sample_type);
                paramIndex++;
            }

            if (priority) {
                query += ` AND s.priority = $${paramIndex}`;
                values.push(priority);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND s.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND s.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND s.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY 
                          CASE s.priority
                              WHEN 'urgent' THEN 1
                              WHEN 'high' THEN 2
                              WHEN 'medium' THEN 3
                              ELSE 4
                          END,
                          s.created_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'collected') as collected,
                    COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
                    COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE sample_type = 'blood') as blood,
                    COUNT(*) FILTER (WHERE sample_type = 'urine') as urine,
                    COUNT(*) FILTER (WHERE sample_type = 'tissue') as tissue,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent
                FROM samples
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
            logger.error('Error in getAllSamples', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get samples by status
     */
    async getSamplesByStatus(staffId, status, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT s.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       lo.order_number,
                       EXTRACT(EPOCH FROM (NOW() - s.collected_at))/3600 as hours_since_collection
                FROM samples s
                JOIN patients p ON s.patient_id = p.id
                LEFT JOIN lab_orders lo ON s.lab_order_id = lo.id
                WHERE s.status = $1 AND s.is_deleted = false
            `;
            const values = [status];
            let paramIndex = 2;

            if (from_date) {
                query += ` AND s.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND s.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY s.created_at ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM samples
                WHERE status = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [status]);

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
            logger.error('Error in getSamplesByStatus', { error: error.message, staffId });
            throw error;
        }
    },

    /**
     * Get sample by ID
     */
    async getSampleById(staffId, sampleId) {
        try {
            const query = `
                SELECT s.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       p.date_of_birth as patient_dob,
                       lo.order_number,
                       lo.test_type,
                       CONCAT(coll.first_name, ' ', coll.last_name) as collected_by_name,
                       CONCAT(del.first_name, ' ', del.last_name) as delivered_by_name,
                       CONCAT(req.first_name, ' ', req.last_name) as requested_by_name,
                       EXTRACT(EPOCH FROM (s.delivered_at - s.collected_at))/60 as delivery_time_minutes
                FROM samples s
                JOIN patients p ON s.patient_id = p.id
                LEFT JOIN lab_orders lo ON s.lab_order_id = lo.id
                LEFT JOIN users coll ON s.collected_by = coll.id
                LEFT JOIN users del ON s.delivered_by = del.id
                LEFT JOIN users req ON s.requested_by = req.id
                WHERE s.id = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [sampleId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getSampleById', { error: error.message, staffId, sampleId });
            throw error;
        }
    },

    /**
     * Collect sample
     */
    async collectSample(staffId, sampleId, collectData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE samples 
                SET status = 'collected',
                    collected_at = $1,
                    collected_by = $2,
                    collection_notes = $3,
                    collection_location = $4,
                    updated_at = NOW()
                WHERE id = $5 AND status = 'pending'
                RETURNING *
            `;

            const values = [
                collectData.collected_at,
                collectData.collected_by,
                collectData.notes,
                collectData.collection_location,
                sampleId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Sample not found or cannot be collected');
            }

            // Log sample collection
            await client.query(`
                INSERT INTO sample_activity_logs (
                    id, sample_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'collected', $2, $3, $4
                )
            `, [sampleId, collectData.collected_by, collectData.collected_at, collectData.notes]);

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
     * Deliver sample [BR-48]
     */
    async deliverSample(staffId, sampleId, deliverData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get sample details to check collection time
            const sampleCheck = await client.query(`
                SELECT collected_at FROM samples 
                WHERE id = $1 AND status IN ('collected', 'in_transit')
            `, [sampleId]);

            if (sampleCheck.rows.length === 0) {
                throw new Error('Sample not found or cannot be delivered');
            }

            const collectedAt = sampleCheck.rows[0].collected_at;
            const deliveryTime = new Date(deliverData.delivered_at);
            const hoursSinceCollection = (deliveryTime - new Date(collectedAt)) / (1000 * 60 * 60);

            // [BR-48] Check delivery window
            if (hoursSinceCollection > 2) {
                logger.warn('Sample delivered after 2-hour window', {
                    sampleId,
                    hoursSinceCollection: hoursSinceCollection.toFixed(1)
                });
            }

            const query = `
                UPDATE samples 
                SET status = 'delivered',
                    delivered_at = $1,
                    delivered_by = $2,
                    delivery_notes = $3,
                    delivery_location = $4,
                    received_by = $5,
                    delivery_time_minutes = $6,
                    updated_at = NOW()
                WHERE id = $7 AND status IN ('collected', 'in_transit')
                RETURNING *
            `;

            const deliveryMinutes = (deliveryTime - new Date(collectedAt)) / (1000 * 60);

            const values = [
                deliverData.delivered_at,
                deliverData.delivered_by,
                deliverData.notes,
                deliverData.delivery_location,
                deliverData.received_by,
                deliveryMinutes,
                sampleId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Sample not found or cannot be delivered');
            }

            // Log sample delivery
            await client.query(`
                INSERT INTO sample_activity_logs (
                    id, sample_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'delivered', $2, $3, $4
                )
            `, [sampleId, deliverData.delivered_by, deliverData.delivered_at, deliverData.notes]);

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
     * Get sample statistics
     */
    async getSampleStatistics(staffId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND created_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND created_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH sample_stats AS (
                    SELECT 
                        COUNT(*) as total_samples,
                        COUNT(*) FILTER (WHERE status = 'pending') as pending,
                        COUNT(*) FILTER (WHERE status = 'collected') as collected,
                        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
                        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
                        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                        COUNT(*) FILTER (WHERE sample_type = 'blood') as blood_samples,
                        COUNT(*) FILTER (WHERE sample_type = 'urine') as urine_samples,
                        COUNT(*) FILTER (WHERE sample_type = 'tissue') as tissue_samples,
                        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_samples,
                        AVG(EXTRACT(EPOCH FROM (delivered_at - collected_at))/60)::numeric(10,2) as avg_delivery_time_minutes,
                        COUNT(*) FILTER (WHERE delivered_at - collected_at <= INTERVAL '2 hours') as on_time_deliveries
                    FROM samples
                    WHERE is_deleted = false
                        ${dateFilter}
                ),
                daily_trend AS (
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as samples_count,
                        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
                        AVG(EXTRACT(EPOCH FROM (delivered_at - collected_at))/60)::numeric(10,2) as avg_delivery_time
                    FROM samples
                    WHERE is_deleted = false
                        ${dateFilter}
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                    LIMIT 30
                )
                SELECT 
                    (SELECT * FROM sample_stats) as summary,
                    (SELECT json_agg(daily_trend.*) FROM daily_trend) as daily_trend
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getSampleStatistics', { error: error.message, staffId });
            throw error;
        }
    }
};

module.exports = sampleService;