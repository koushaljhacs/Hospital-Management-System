/**
 * ======================================================================
 * FILE: backend/src/services/security/exitService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Security Guard exit service - Handles business logic for exit management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-51] Exit must be recorded for all entries
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const exitService = {
    /**
     * Get entry by ID for exit validation
     */
    async getEntryById(guardId, entryId) {
        try {
            const query = `
                SELECT e.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name
                FROM entries e
                LEFT JOIN users u ON e.recorded_by = u.id
                WHERE e.id = $1 AND e.is_deleted = false
            `;

            const result = await db.query(query, [entryId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getEntryById', { error: error.message, guardId, entryId });
            throw error;
        }
    },

    /**
     * Record exit [BR-51]
     */
    async recordExit(guardId, exitData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate exit number
            const exitNumber = await this.generateExitNumber();

            const query = `
                INSERT INTO exits (
                    id, exit_number, entry_id, exit_time, notes,
                    recorded_by, ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                exitNumber,
                exitData.entry_id,
                exitData.exit_time,
                exitData.notes,
                exitData.recorded_by,
                exitData.ip_address,
                exitData.user_agent
            ];

            const result = await client.query(query, values);
            const exitRecord = result.rows[0];

            // Update the corresponding entry with exit time
            await client.query(`
                UPDATE entries 
                SET exit_time = $1,
                    exit_notes = $2,
                    exit_recorded_by = $3,
                    updated_at = NOW()
                WHERE id = $4
            `, [exitData.exit_time, exitData.notes, exitData.recorded_by, exitData.entry_id]);

            // Log exit activity
            await client.query(`
                INSERT INTO exit_activity_logs (
                    id, exit_id, entry_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, $2, 'exit_recorded', $3, $4, $5
                )
            `, [exitRecord.id, exitData.entry_id, exitData.recorded_by, exitData.exit_time, exitData.notes]);

            await db.commitTransaction(client);

            return exitRecord;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Generate exit number
     */
    async generateExitNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM exits
                WHERE exit_number LIKE $1
            `, [`EXT-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `EXT-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateExitNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Get today's exits
     */
    async getTodayExits(guardId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT ex.*, 
                       e.id as entry_id,
                       e.person_name,
                       e.entry_type,
                       e.id_type,
                       e.id_number,
                       e.entry_time,
                       e.department_to_visit,
                       e.person_to_meet,
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name,
                       EXTRACT(EPOCH FROM (ex.exit_time - e.entry_time))/60 as duration_minutes
                FROM exits ex
                JOIN entries e ON ex.entry_id = e.id
                LEFT JOIN users u ON ex.recorded_by = u.id
                WHERE DATE(ex.exit_time) = CURRENT_DATE 
                    AND ex.is_deleted = false
                ORDER BY ex.exit_time DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM exits
                WHERE DATE(exit_time) = CURRENT_DATE AND is_deleted = false
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
            logger.error('Error in getTodayExits', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Get exit by ID
     */
    async getExitById(guardId, exitId) {
        try {
            const query = `
                SELECT ex.*, 
                       e.id as entry_id,
                       e.person_name,
                       e.entry_type,
                       e.entry_time,
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name
                FROM exits ex
                JOIN entries e ON ex.entry_id = e.id
                LEFT JOIN users u ON ex.recorded_by = u.id
                WHERE ex.id = $1 AND ex.is_deleted = false
            `;

            const result = await db.query(query, [exitId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getExitById', { error: error.message, guardId, exitId });
            throw error;
        }
    },

    /**
     * Get exit statistics
     */
    async getExitStatistics(guardId, period = 'day') {
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
                WITH daily_exits AS (
                    SELECT 
                        DATE(ex.exit_time) as date,
                        COUNT(*) as total_exits,
                        AVG(EXTRACT(EPOCH FROM (ex.exit_time - e.entry_time))/60)::numeric(10,2) as avg_duration
                    FROM exits ex
                    JOIN entries e ON ex.entry_id = e.id
                    WHERE ex.exit_time > NOW() - ${interval}
                        AND ex.is_deleted = false
                    GROUP BY DATE(ex.exit_time)
                )
                SELECT 
                    json_agg(daily_exits.* ORDER BY date) as daily,
                    (SELECT 
                        json_build_object(
                            'total', SUM(total_exits),
                            'avg_daily', AVG(total_exits),
                            'overall_avg_duration', AVG(avg_duration)
                        )
                    FROM daily_exits) as summary
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getExitStatistics', { error: error.message, guardId });
            throw error;
        }
    }
};

module.exports = exitService;