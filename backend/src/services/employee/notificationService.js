/**
 * ======================================================================
 * FILE: backend/src/services/employee/notificationService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee notification service - Handles business logic for notification management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const notificationService = {
    /**
     * Get notifications
     */
    async getNotifications(employeeId, options = {}) {
        try {
            const { page = 1, limit = 20, type, is_read } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT n.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as created_by_name
                FROM employee_notifications n
                LEFT JOIN users u ON n.created_by = u.id
                WHERE n.employee_id = $1 AND n.is_deleted = false
            `;
            const values = [employeeId];
            let paramIndex = 2;

            if (type) {
                query += ` AND n.type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            if (is_read !== undefined) {
                query += ` AND n.is_read = $${paramIndex}`;
                values.push(is_read);
                paramIndex++;
            }

            query += ` ORDER BY n.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE is_read = false) as unread_count,
                    COUNT(*) FILTER (WHERE type = 'shift') as shift_count,
                    COUNT(*) FILTER (WHERE type = 'leave') as leave_count,
                    COUNT(*) FILTER (WHERE type = 'attendance') as attendance_count,
                    COUNT(*) FILTER (WHERE type = 'document') as document_count,
                    COUNT(*) FILTER (WHERE type = 'system') as system_count
                FROM employee_notifications
                WHERE employee_id = $1 AND is_deleted = false
                ${type ? 'AND type = $2' : ''}
            `;
            const countValues = [employeeId];
            if (type) countValues.push(type);
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                unread_count: parseInt(count.rows[0]?.unread_count || 0),
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getNotifications', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get unread notifications
     */
    async getUnreadNotifications(employeeId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT n.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as created_by_name
                FROM employee_notifications n
                LEFT JOIN users u ON n.created_by = u.id
                WHERE n.employee_id = $1 
                    AND n.is_read = false 
                    AND n.is_deleted = false
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [employeeId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM employee_notifications
                WHERE employee_id = $1 AND is_read = false AND is_deleted = false
            `;
            const count = await db.query(countQuery, [employeeId]);

            return {
                data: result.rows,
                unread_count: parseInt(count.rows[0]?.total || 0),
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getUnreadNotifications', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get notification by ID
     */
    async getNotificationById(employeeId, notificationId) {
        try {
            const query = `
                SELECT n.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as created_by_name
                FROM employee_notifications n
                LEFT JOIN users u ON n.created_by = u.id
                WHERE n.id = $1 AND n.employee_id = $2 AND n.is_deleted = false
            `;

            const result = await db.query(query, [notificationId, employeeId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getNotificationById', { error: error.message, employeeId, notificationId });
            throw error;
        }
    },

    /**
     * Mark notification as read
     */
    async markAsRead(employeeId, notificationId, readData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE employee_notifications 
                SET is_read = true,
                    read_at = $1,
                    read_by = $2,
                    updated_at = NOW()
                WHERE id = $3 
                    AND employee_id = $4 
                    AND is_read = false
                    AND is_deleted = false
                RETURNING *
            `;

            const values = [
                readData.read_at,
                readData.read_by,
                notificationId,
                employeeId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Notification not found or already read');
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
     * Mark all notifications as read
     */
    async markAllAsRead(employeeId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE employee_notifications 
                SET is_read = true,
                    read_at = NOW(),
                    read_by = $1,
                    updated_at = NOW()
                WHERE employee_id = $2 
                    AND is_read = false 
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [employeeId, employeeId]);

            await db.commitTransaction(client);

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete notification
     */
    async deleteNotification(employeeId, notificationId, deleteData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE employee_notifications 
                SET is_deleted = true,
                    deleted_at = $1,
                    deleted_by = $2,
                    updated_at = NOW()
                WHERE id = $3 
                    AND employee_id = $4 
                    AND is_deleted = false
                RETURNING id
            `;

            const values = [
                deleteData.deleted_at,
                deleteData.deleted_by,
                notificationId,
                employeeId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Notification not found');
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
     * Create notification
     */
    async createNotification(notificationData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO employee_notifications (
                    id, employee_id, type, title, message,
                    link, icon, priority, created_by, created_at,
                    updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                notificationData.employee_id,
                notificationData.type,
                notificationData.title,
                notificationData.message,
                notificationData.link,
                notificationData.icon,
                notificationData.priority || 'normal',
                notificationData.created_by
            ];

            const result = await client.query(query, values);

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
     * Get notification statistics
     */
    async getNotificationStatistics(employeeId, options = {}) {
        try {
            const { days = 30 } = options;

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE is_read = true) as read_count,
                        COUNT(*) FILTER (WHERE type = 'shift') as shift_count,
                        COUNT(*) FILTER (WHERE type = 'leave') as leave_count,
                        COUNT(*) FILTER (WHERE type = 'attendance') as attendance_count
                    FROM employee_notifications
                    WHERE employee_id = $1 
                        AND created_at > NOW() - INTERVAL '${days} days'
                        AND is_deleted = false
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                )
                SELECT 
                    json_agg(daily_stats.*) as daily,
                    (SELECT 
                        json_build_object(
                            'total', COUNT(*),
                            'unread', COUNT(*) FILTER (WHERE is_read = false),
                            'by_type', json_build_object(
                                'shift', COUNT(*) FILTER (WHERE type = 'shift'),
                                'leave', COUNT(*) FILTER (WHERE type = 'leave'),
                                'attendance', COUNT(*) FILTER (WHERE type = 'attendance'),
                                'document', COUNT(*) FILTER (WHERE type = 'document'),
                                'system', COUNT(*) FILTER (WHERE type = 'system')
                            )
                        )
                    FROM employee_notifications
                    WHERE employee_id = $1 AND is_deleted = false
                    ) as summary
            `;

            const result = await db.query(query, [employeeId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getNotificationStatistics', { error: error.message, employeeId });
            throw error;
        }
    }
};

module.exports = notificationService;