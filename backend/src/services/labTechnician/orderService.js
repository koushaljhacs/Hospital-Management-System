/**
 * ======================================================================
 * FILE: backend/src/services/labTechnician/orderService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician order service - Handles business logic for test orders.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * - [BR-39] Sample collection to result < 24 hours
 * - [BR-40] Duplicate test not allowed within 7 days
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const orderService = {
    /**
     * Get all test orders
     */
    async getAllOrders(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20, status, priority, patient_id, doctor_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT to.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.specialization as doctor_specialization,
                       COUNT(t.id) as test_count,
                       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_tests
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                JOIN employees e ON to.doctor_id = e.id
                LEFT JOIN tests t ON to.id = t.test_order_id
                WHERE to.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND to.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (priority) {
                query += ` AND to.priority = $${paramIndex}`;
                values.push(priority);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND to.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (doctor_id) {
                query += ` AND to.doctor_id = $${paramIndex}`;
                values.push(doctor_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND to.order_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND to.order_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` GROUP BY to.id, p.id, e.id
                      ORDER BY 
                        CASE to.priority
                            WHEN 'stat' THEN 1
                            WHEN 'urgent' THEN 2
                            WHEN 'routine' THEN 3
                            ELSE 4
                        END,
                        to.order_date ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM test_orders
                WHERE is_deleted = false
                ${status ? 'AND status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_orders,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'collected') as collected,
                    COUNT(*) FILTER (WHERE status = 'received') as received,
                    COUNT(*) FILTER (WHERE status = 'processing') as processing,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE priority = 'stat') as stat_count,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count
                FROM test_orders
                WHERE is_deleted = false
            `;
            const summary = await db.query(summaryQuery);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAllOrders', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get orders by status
     */
    async getOrdersByStatus(technicianId, status, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT to.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       COUNT(t.id) as test_count,
                       CASE 
                           WHEN to.collection_date IS NOT NULL 
                               AND EXTRACT(EPOCH FROM (NOW() - to.collection_date))/3600 > 24 
                               AND to.status != 'completed' 
                           THEN true ELSE false 
                       END as is_overdue
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                JOIN employees e ON to.doctor_id = e.id
                LEFT JOIN tests t ON to.id = t.test_order_id
                WHERE to.status = $1 AND to.is_deleted = false
                GROUP BY to.id, p.id, e.id
                ORDER BY 
                    CASE to.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        ELSE 3
                    END,
                    to.order_date ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM test_orders
                WHERE status = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [status]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getOrdersByStatus', { error: error.message, technicianId, status });
            throw error;
        }
    },

    /**
     * Get urgent orders [BR-36]
     */
    async getUrgentOrders(technicianId) {
        try {
            const query = `
                SELECT to.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.phone as doctor_phone,
                       COUNT(t.id) as test_count,
                       EXTRACT(EPOCH FROM (NOW() - to.order_date))/3600 as hours_pending
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                JOIN employees e ON to.doctor_id = e.id
                LEFT JOIN tests t ON to.id = t.test_order_id
                WHERE to.priority IN ('stat', 'urgent')
                    AND to.status NOT IN ('completed', 'cancelled')
                    AND to.is_deleted = false
                GROUP BY to.id, p.id, e.id
                ORDER BY 
                    CASE to.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                    END,
                    to.order_date ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getUrgentOrders', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get STAT orders
     */
    async getStatOrders(technicianId) {
        try {
            const query = `
                SELECT to.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       COUNT(t.id) as test_count
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                JOIN employees e ON to.doctor_id = e.id
                LEFT JOIN tests t ON to.id = t.test_order_id
                WHERE to.priority = 'stat'
                    AND to.status != 'completed'
                    AND to.is_deleted = false
                GROUP BY to.id, p.id, e.id
                ORDER BY to.order_date ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getStatOrders', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get order by ID
     */
    async getOrderById(technicianId, orderId) {
        try {
            const query = `
                SELECT to.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       p.blood_group as patient_blood_group,
                       e.id as doctor_id,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       e.specialization as doctor_specialization,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', t.id,
                                   'test_name', t.test_name,
                                   'test_code', t.test_code,
                                   'category', t.category,
                                   'status', t.status,
                                   'result', tr.result_value,
                                   'unit', tr.result_unit,
                                   'reference_range', tr.reference_range,
                                   'is_abnormal', tr.is_abnormal,
                                   'is_critical', tr.is_critical,
                                   'completed_at', t.completed_at
                               ) ORDER BY t.created_at
                           )
                           FROM tests t
                           LEFT JOIN test_results tr ON t.id = tr.test_id
                           WHERE t.test_order_id = to.id
                       ) as tests,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', s.id,
                                   'specimen_code', s.specimen_code,
                                   'specimen_type', s.specimen_type,
                                   'collection_date', s.collection_date,
                                   'status', s.status,
                                   'condition', s.condition
                               ) ORDER BY s.collection_date DESC
                           )
                           FROM specimens s
                           WHERE s.test_order_id = to.id
                       ) as specimens
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                JOIN employees e ON to.doctor_id = e.id
                WHERE to.id = $1 AND to.is_deleted = false
            `;

            const result = await db.query(query, [orderId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getOrderById', { error: error.message, technicianId, orderId });
            throw error;
        }
    },

    /**
     * Get order tests
     */
    async getOrderTests(technicianId, orderId) {
        try {
            const query = `
                SELECT t.*, 
                       lt.test_name, lt.test_code, lt.category,
                       lt.normal_range, lt.unit,
                       tr.result_value, tr.result_unit,
                       tr.is_abnormal, tr.is_critical,
                       tr.verified_by, tr.verified_at
                FROM tests t
                JOIN lab_tests lt ON t.test_id = lt.id
                LEFT JOIN test_results tr ON t.id = tr.test_id
                WHERE t.test_order_id = $1
                ORDER BY t.created_at ASC
            `;

            const result = await db.query(query, [orderId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getOrderTests', { error: error.message, technicianId, orderId });
            throw error;
        }
    },

    /**
     * Update order status
     */
    async updateOrderStatus(technicianId, orderId, status, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build update query
            const updates = [`status = $1`, `updated_at = NOW()`];
            const values = [status];
            let paramIndex = 2;

            if (data.collected_by) {
                updates.push(`collected_by = $${paramIndex}`);
                values.push(data.collected_by);
                paramIndex++;
            }

            if (data.collected_at) {
                updates.push(`collection_date = $${paramIndex}`);
                values.push(data.collected_at);
                paramIndex++;
            }

            if (data.collection_notes) {
                updates.push(`collection_notes = $${paramIndex}`);
                values.push(data.collection_notes);
                paramIndex++;
            }

            if (data.received_by) {
                updates.push(`received_by = $${paramIndex}`);
                values.push(data.received_by);
                paramIndex++;
            }

            if (data.received_at) {
                updates.push(`received_date = $${paramIndex}`);
                values.push(data.received_at);
                paramIndex++;
            }

            if (data.received_notes) {
                updates.push(`received_notes = $${paramIndex}`);
                values.push(data.received_notes);
                paramIndex++;
            }

            if (data.specimen_condition) {
                updates.push(`specimen_condition = $${paramIndex}`);
                values.push(data.specimen_condition);
                paramIndex++;
            }

            values.push(orderId);

            const query = `
                UPDATE test_orders 
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

            const result = await client.query(query, values);

            // Log status change
            await client.query(`
                INSERT INTO order_status_history (
                    id, order_id, status, changed_by, changed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, NOW(), $4
                )
            `, [orderId, status, technicianId, data.collection_notes || data.received_notes || null]);

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
     * Start processing
     */
    async startProcessing(technicianId, orderId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Update specific test status
            if (data.test_id) {
                await client.query(`
                    UPDATE tests 
                    SET status = 'processing',
                        started_by = $1,
                        started_at = $2,
                        updated_at = NOW()
                    WHERE id = $3 AND test_order_id = $4
                `, [technicianId, data.started_at, data.test_id, orderId]);
            }

            // Update order status if all tests are in progress
            const pendingTests = await client.query(`
                SELECT COUNT(*) as count
                FROM tests
                WHERE test_order_id = $1 AND status = 'pending'
            `, [orderId]);

            if (parseInt(pendingTests.rows[0].count) === 0) {
                await client.query(`
                    UPDATE test_orders 
                    SET status = 'processing',
                        updated_at = NOW()
                    WHERE id = $1
                `, [orderId]);
            }

            await db.commitTransaction(client);

            return await this.getOrderById(technicianId, orderId);
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Complete processing
     */
    async completeProcessing(technicianId, orderId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Update order status
            const query = `
                UPDATE test_orders 
                SET status = 'completed',
                    completed_by = $1,
                    completed_at = $2,
                    completion_notes = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                data.completed_by,
                data.completed_at,
                data.completion_notes,
                orderId
            ];

            const result = await client.query(query, values);

            // Log completion
            await client.query(`
                INSERT INTO order_status_history (
                    id, order_id, status, changed_by, changed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'completed', $2, $3, $4
                )
            `, [orderId, technicianId, data.completed_at, data.completion_notes]);

            // Calculate turnaround time [BR-39]
            const order = result.rows[0];
            if (order.collection_date) {
                const turnaroundHours = (order.completed_at - order.collection_date) / (1000 * 60 * 60);
                
                // Log if exceeding 24 hours
                if (turnaroundHours > 24) {
                    logger.warn('Order exceeded 24-hour turnaround', {
                        orderId,
                        hours: turnaroundHours
                    });
                }

                // Update turnaround time
                await client.query(`
                    UPDATE test_orders 
                    SET turnaround_hours = $1
                    WHERE id = $2
                `, [turnaroundHours, orderId]);
            }

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
     * Bulk update orders
     */
    async bulkUpdateOrders(technicianId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const results = {
                success: [],
                failed: []
            };

            for (const update of updates) {
                try {
                    const result = await this.updateOrderStatus(
                        technicianId,
                        update.order_id,
                        update.status,
                        update.data
                    );
                    results.success.push({
                        order_id: update.order_id,
                        status: update.status
                    });
                } catch (err) {
                    results.failed.push({
                        order_id: update.order_id,
                        error: err.message
                    });
                }
            }

            await db.commitTransaction(client);

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get order statistics
     */
    async getOrderStatistics(technicianId, period = 'day') {
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
                        DATE(order_date) as date,
                        COUNT(*) as total_orders,
                        COUNT(*) FILTER (WHERE priority = 'stat') as stat_orders,
                        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_orders,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        AVG(EXTRACT(EPOCH FROM (completed_at - collection_date))/3600)::numeric(10,2) as avg_turnaround
                    FROM test_orders
                    WHERE order_date > NOW() - ${interval}
                    GROUP BY DATE(order_date)
                )
                SELECT 
                    json_agg(daily_stats.* ORDER BY date) as daily,
                    SUM(total_orders) as total_orders,
                    SUM(stat_orders) as total_stat,
                    SUM(urgent_orders) as total_urgent,
                    AVG(avg_turnaround) as overall_avg_turnaround
                FROM daily_stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getOrderStatistics', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get pending counts
     */
    async getPendingCounts(technicianId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_pending,
                    COUNT(*) FILTER (WHERE priority = 'stat') as stat_pending,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_pending,
                    COUNT(*) FILTER (WHERE collection_date IS NULL) as awaiting_collection,
                    COUNT(*) FILTER (WHERE collection_date IS NOT NULL AND status = 'pending') as awaiting_processing,
                    COUNT(*) FILTER (
                        WHERE collection_date IS NOT NULL 
                            AND EXTRACT(EPOCH FROM (NOW() - collection_date))/3600 > 24
                            AND status != 'completed'
                    ) as overdue
                FROM test_orders
                WHERE status NOT IN ('completed', 'cancelled')
                    AND is_deleted = false
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPendingCounts', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Generate order label
     */
    async generateOrderLabel(technicianId, orderId) {
        try {
            const order = await this.getOrderById(technicianId, orderId);
            
            if (!order) {
                return null;
            }

            // TODO: Implement actual PDF label generation
            // For now, return JSON
            return Buffer.from(JSON.stringify({
                order_id: order.id,
                order_number: order.order_number,
                patient_name: `${order.patient_first_name} ${order.patient_last_name}`,
                doctor_name: `${order.doctor_first_name} ${order.doctor_last_name}`,
                tests: order.tests?.length || 0,
                priority: order.priority,
                order_date: order.order_date
            }, null, 2));
        } catch (error) {
            logger.error('Error in generateOrderLabel', { error: error.message, technicianId, orderId });
            throw error;
        }
    },

    /**
     * Export orders
     */
    async exportOrders(technicianId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    to.order_number, to.order_date, to.priority, to.status,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    p.phone as patient_phone,
                    CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                    e.specialization as doctor_specialization,
                    COUNT(t.id) as test_count,
                    to.collection_date, to.received_date, to.completed_at,
                    to.turnaround_hours
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                JOIN employees e ON to.doctor_id = e.id
                LEFT JOIN tests t ON to.id = t.test_order_id
                WHERE to.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND to.order_date >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND to.order_date <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            if (filters.status) {
                query += ` AND to.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            query += ` GROUP BY to.id, p.id, e.id
                      ORDER BY to.order_date DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportOrders', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Add order note
     */
    async addOrderNote(technicianId, orderId, noteData) {
        try {
            const query = `
                INSERT INTO order_notes (
                    id, order_id, note, type, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5
                ) RETURNING *
            `;

            const values = [
                orderId,
                noteData.note,
                noteData.type,
                noteData.created_by,
                noteData.created_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in addOrderNote', { error: error.message, technicianId, orderId });
            throw error;
        }
    },

    /**
     * Get order notes
     */
    async getOrderNotes(technicianId, orderId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT n.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as created_by_name
                FROM order_notes n
                LEFT JOIN employees e ON n.created_by = e.id
                WHERE n.order_id = $1
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [orderId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM order_notes
                WHERE order_id = $1
            `;
            const count = await db.query(countQuery, [orderId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getOrderNotes', { error: error.message, technicianId, orderId });
            throw error;
        }
    },

    /**
     * Check duplicate test [BR-40]
     */
    async checkDuplicateTest(patientId, testId, testDate) {
        try {
            const query = `
                SELECT to.*, t.id as test_record_id
                FROM test_orders to
                JOIN tests t ON to.id = t.test_order_id
                WHERE to.patient_id = $1 
                    AND t.test_id = $2
                    AND to.order_date > $3 - INTERVAL '7 days'
                    AND to.status != 'cancelled'
                ORDER BY to.order_date DESC
                LIMIT 1
            `;

            const result = await db.query(query, [patientId, testId, testDate]);

            return {
                hasDuplicate: result.rows.length > 0,
                previousResult: result.rows[0] || null
            };
        } catch (error) {
            logger.error('Error in checkDuplicateTest', { error: error.message, patientId, testId });
            throw error;
        }
    }
};

module.exports = orderService;