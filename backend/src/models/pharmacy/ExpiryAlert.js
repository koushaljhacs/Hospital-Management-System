/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/ExpiryAlert.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * AUTHOR: @koushal
 * 
 * RESTRICTIONS:
 * This code is proprietary to OctNov.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * DESCRIPTION:
 * ExpiryAlert model for database operations.
 * Tracks medicine expiry alerts and notifications for inventory management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: expiry_alerts
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - inventory_id: UUID (foreign key to inventory)
 * - batch_id: UUID (foreign key to batches)
 * - medicine_name: string
 * - batch_number: string
 * - expiry_date: date
 * - days_until_expiry: integer
 * - alert_type: enum (warning, critical, expired)
 * - alert_sent: boolean
 * - alert_sent_at: timestamp
 * - alert_sent_to: uuid[]
 * - resolved: boolean
 * - resolved_at: timestamp
 * - resolved_by: uuid
 * - resolution_notes: text
 * - created_at: timestamp
 * - updated_at: timestamp
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const ExpiryAlert = {
    /**
     * Table name
     */
    tableName: 'expiry_alerts',

    /**
     * Valid alert types
     */
    validAlertTypes: ['warning', 'critical', 'expired'],

    /**
     * Find alert by ID
     * @param {string} id - Alert UUID
     * @returns {Promise<Object|null>} Alert object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ea.id, ea.inventory_id, ea.batch_id,
                    ea.medicine_name, ea.batch_number,
                    ea.expiry_date, ea.days_until_expiry,
                    ea.alert_type, ea.alert_sent,
                    ea.alert_sent_at, ea.alert_sent_to,
                    ea.resolved, ea.resolved_at,
                    ea.resolved_by, ea.resolution_notes,
                    ea.created_at, ea.updated_at,
                    i.category, i.location,
                    u.username as resolved_by_name
                FROM expiry_alerts ea
                LEFT JOIN inventory i ON ea.inventory_id = i.id
                LEFT JOIN users u ON ea.resolved_by = u.id
                WHERE ea.id = $1 AND ea.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Expiry alert found by ID', { alertId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding expiry alert by ID', {
                error: error.message,
                alertId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find alerts by inventory ID
     * @param {string} inventoryId - Inventory UUID
     * @returns {Promise<Array>} List of alerts
     */
    async findByInventoryId(inventoryId) {
        try {
            const query = `
                SELECT 
                    id, batch_id, batch_number,
                    expiry_date, days_until_expiry,
                    alert_type, alert_sent, resolved
                FROM expiry_alerts
                WHERE inventory_id = $1 AND is_deleted = false
                ORDER BY expiry_date ASC
            `;

            const result = await db.query(query, [inventoryId]);

            logger.debug('Expiry alerts found by inventory ID', {
                inventoryId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding expiry alerts by inventory ID', {
                error: error.message,
                inventoryId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active (unresolved) alerts
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of active alerts
     */
    async getActiveAlerts(options = {}) {
        try {
            const { limit = 100, offset = 0, alert_type } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['resolved = false', 'is_deleted = false'];

            if (alert_type) {
                conditions.push(`alert_type = $${paramIndex++}`);
                values.push(alert_type);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    ea.id, ea.inventory_id, ea.batch_id,
                    ea.medicine_name, ea.batch_number,
                    ea.expiry_date, ea.days_until_expiry,
                    ea.alert_type, ea.alert_sent,
                    i.category, i.location, i.rack_number
                FROM expiry_alerts ea
                JOIN inventory i ON ea.inventory_id = i.id
                ${whereClause}
                ORDER BY ea.expiry_date ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Active expiry alerts retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active expiry alerts', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get alerts by expiry date range
     * @param {number} daysStart - Start days from now
     * @param {number} daysEnd - End days from now
     * @returns {Promise<Array>} List of alerts
     */
    async getByExpiryRange(daysStart, daysEnd) {
        try {
            const query = `
                SELECT 
                    ea.id, ea.inventory_id, ea.batch_id,
                    ea.medicine_name, ea.batch_number,
                    ea.expiry_date, ea.days_until_expiry,
                    ea.alert_type, ea.alert_sent,
                    i.category, i.location
                FROM expiry_alerts ea
                JOIN inventory i ON ea.inventory_id = i.id
                WHERE ea.days_until_expiry BETWEEN $1 AND $2
                    AND ea.resolved = false
                    AND ea.is_deleted = false
                ORDER BY ea.days_until_expiry ASC
            `;

            const result = await db.query(query, [daysStart, daysEnd]);

            logger.debug('Expiry alerts found by range', {
                daysStart,
                daysEnd,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiry alerts by range', {
                error: error.message,
                daysStart,
                daysEnd
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new expiry alert
     * @param {Object} alertData - Alert data
     * @returns {Promise<Object>} Created alert
     */
    async create(alertData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (alertData.alert_type && !this.validAlertTypes.includes(alertData.alert_type)) {
                throw new Error(`Invalid alert type. Must be one of: ${this.validAlertTypes.join(', ')}`);
            }

            const query = `
                INSERT INTO expiry_alerts (
                    id, inventory_id, batch_id,
                    medicine_name, batch_number,
                    expiry_date, days_until_expiry,
                    alert_type, alert_sent,
                    alert_sent_to, resolved,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4,
                    $5, $6,
                    $7, false,
                    $8, false,
                    NOW(), NOW()
                )
                RETURNING 
                    id, inventory_id, batch_id,
                    medicine_name, expiry_date,
                    days_until_expiry, alert_type,
                    created_at
            `;

            const values = [
                alertData.inventory_id,
                alertData.batch_id || null,
                alertData.medicine_name,
                alertData.batch_number,
                alertData.expiry_date,
                alertData.days_until_expiry,
                alertData.alert_type,
                alertData.alert_sent_to || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Expiry alert created successfully', {
                alertId: result.rows[0].id,
                medicineName: alertData.medicine_name,
                expiryDate: alertData.expiry_date,
                daysUntilExpiry: alertData.days_until_expiry
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating expiry alert', {
                error: error.message,
                inventoryId: alertData.inventory_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Mark alert as sent
     * @param {string} id - Alert ID
     * @param {Array} sentTo - Users notified
     * @returns {Promise<Object>} Updated alert
     */
    async markAsSent(id, sentTo) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE expiry_alerts 
                SET alert_sent = true,
                    alert_sent_at = NOW(),
                    alert_sent_to = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING 
                    id, alert_sent, alert_sent_at,
                    alert_sent_to
            `;

            const result = await client.query(query, [sentTo, id]);

            if (result.rows.length === 0) {
                throw new Error('Expiry alert not found');
            }

            await db.commitTransaction(client);

            logger.info('Expiry alert marked as sent', {
                alertId: id,
                notifiedCount: sentTo?.length || 0
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error marking expiry alert as sent', {
                error: error.message,
                alertId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Resolve alert
     * @param {string} id - Alert ID
     * @param {string} resolvedBy - User who resolved
     * @param {string} resolutionNotes - Resolution notes
     * @returns {Promise<Object>} Updated alert
     */
    async resolve(id, resolvedBy, resolutionNotes = null) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE expiry_alerts 
                SET resolved = true,
                    resolved_at = NOW(),
                    resolved_by = $1,
                    resolution_notes = COALESCE($2, resolution_notes),
                    updated_at = NOW()
                WHERE id = $3 AND is_deleted = false
                RETURNING 
                    id, resolved, resolved_at,
                    resolved_by, resolution_notes
            `;

            const result = await client.query(query, [resolvedBy, resolutionNotes, id]);

            if (result.rows.length === 0) {
                throw new Error('Expiry alert not found');
            }

            await db.commitTransaction(client);

            logger.info('Expiry alert resolved', {
                alertId: id,
                resolvedBy
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error resolving expiry alert', {
                error: error.message,
                alertId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Generate alerts for all expiring batches (run via cron)
     * @param {number} warningDays - Days for warning alert
     * @param {number} criticalDays - Days for critical alert
     * @returns {Promise<number>} Number of alerts created
     */
    async generateAlerts(warningDays = 90, criticalDays = 30) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            // Find batches that are expiring but don't have unresolved alerts
            const query = `
                WITH expiring_batches AS (
                    SELECT 
                        b.id as batch_id,
                        b.inventory_id,
                        b.batch_number,
                        b.expiry_date,
                        i.medicine_name,
                        EXTRACT(DAY FROM (b.expiry_date - CURRENT_DATE)) as days_until_expiry
                    FROM batches b
                    JOIN inventory i ON b.inventory_id = i.id
                    WHERE b.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
                        AND b.quantity_remaining > 0
                        AND b.is_deleted = false
                        AND NOT EXISTS (
                            SELECT 1 FROM expiry_alerts ea
                            WHERE ea.batch_id = b.id
                                AND ea.resolved = false
                                AND ea.is_deleted = false
                        )
                )
                INSERT INTO expiry_alerts (
                    id, inventory_id, batch_id,
                    medicine_name, batch_number,
                    expiry_date, days_until_expiry,
                    alert_type, created_at, updated_at
                )
                SELECT 
                    gen_random_uuid(),
                    inventory_id, batch_id,
                    medicine_name, batch_number,
                    expiry_date, days_until_expiry,
                    CASE 
                        WHEN days_until_expiry <= $2 THEN 'critical'
                        ELSE 'warning'
                    END,
                    NOW(), NOW()
                FROM expiring_batches
                WHERE days_until_expiry <= $1
                RETURNING id
            `;

            const result = await client.query(query, [warningDays, criticalDays]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Expiry alerts generated', {
                    count: result.rowCount,
                    warningDays,
                    criticalDays
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error generating expiry alerts', {
                error: error.message,
                warningDays,
                criticalDays
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Get alert statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_alerts,
                    COUNT(*) FILTER (WHERE resolved = true) as resolved,
                    COUNT(*) FILTER (WHERE resolved = false) as active,
                    COUNT(*) FILTER (WHERE alert_type = 'warning') as warning,
                    COUNT(*) FILTER (WHERE alert_type = 'critical') as critical,
                    COUNT(*) FILTER (WHERE alert_type = 'expired') as expired,
                    COUNT(*) FILTER (WHERE alert_sent = true) as notifications_sent,
                    COUNT(DISTINCT inventory_id) as unique_items,
                    AVG(days_until_expiry)::numeric(10,2) as avg_days_until_expiry
                FROM expiry_alerts
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Expiry alert statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting expiry alert statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Clean up resolved alerts older than days
     * @param {number} daysToKeep - Days to keep resolved alerts
     * @returns {Promise<number>} Number of alerts deleted
     */
    async cleanup(daysToKeep = 30) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE expiry_alerts 
                SET is_deleted = true,
                    deleted_at = NOW()
                WHERE resolved = true
                    AND resolved_at < NOW() - ($1 || ' days')::INTERVAL
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [daysToKeep]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Old resolved expiry alerts cleaned up', {
                    count: result.rowCount,
                    daysToKeep
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cleaning up expiry alerts', {
                error: error.message,
                daysToKeep
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Soft delete expiry alert
     * @param {string} id - Alert ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE expiry_alerts 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Expiry alert not found');
            }

            await db.commitTransaction(client);

            logger.info('Expiry alert soft deleted', {
                alertId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting expiry alert', {
                error: error.message,
                alertId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = ExpiryAlert;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */