/**
 * ======================================================================
 * FILE: backend/src/services/security/entryService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Security Guard entry service - Handles business logic for entry management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-49] All entries must be logged with ID verification
 * - [BR-51] Exit must be recorded for all entries
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const entryService = {
    /**
     * Get all entries
     */
    async getAllEntries(guardId, options = {}) {
        try {
            const { page = 1, limit = 20, entry_type, status, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT e.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name,
                       CASE 
                           WHEN e.exit_time IS NOT NULL THEN 'exited'
                           ELSE 'active'
                       END as current_status
                FROM entries e
                LEFT JOIN users u ON e.recorded_by = u.id
                WHERE e.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (entry_type) {
                query += ` AND e.entry_type = $${paramIndex}`;
                values.push(entry_type);
                paramIndex++;
            }

            if (status === 'active') {
                query += ` AND e.exit_time IS NULL`;
            } else if (status === 'exited') {
                query += ` AND e.exit_time IS NOT NULL`;
            }

            if (from_date) {
                query += ` AND e.entry_time >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND e.entry_time <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY e.entry_time DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE entry_type = 'employee') as employee_count,
                    COUNT(*) FILTER (WHERE entry_type = 'patient') as patient_count,
                    COUNT(*) FILTER (WHERE entry_type = 'visitor') as visitor_count,
                    COUNT(*) FILTER (WHERE entry_type = 'vendor') as vendor_count,
                    COUNT(*) FILTER (WHERE entry_type = 'emergency') as emergency_count,
                    COUNT(*) FILTER (WHERE exit_time IS NULL) as active_count
                FROM entries
                WHERE is_deleted = false
                ${entry_type ? 'AND entry_type = $1' : ''}
            `;
            const countValues = entry_type ? [entry_type] : [];
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
            logger.error('Error in getAllEntries', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Get today's entries
     */
    async getTodayEntries(guardId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT e.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name,
                       EXTRACT(EPOCH FROM (NOW() - e.entry_time))/60 as minutes_since_entry
                FROM entries e
                LEFT JOIN users u ON e.recorded_by = u.id
                WHERE DATE(e.entry_time) = CURRENT_DATE 
                    AND e.is_deleted = false
                ORDER BY e.entry_time DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM entries
                WHERE DATE(entry_time) = CURRENT_DATE AND is_deleted = false
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
            logger.error('Error in getTodayEntries', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Get entry by ID
     */
    async getEntryById(guardId, entryId) {
        try {
            const query = `
                SELECT e.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name,
                       CONCAT(ex.first_name, ' ', ex.last_name) as exit_recorded_by_name
                FROM entries e
                LEFT JOIN users u ON e.recorded_by = u.id
                LEFT JOIN users ex ON e.exit_recorded_by = ex.id
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
     * Get active entries
     */
    async getActiveEntries(guardId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT e.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as recorded_by_name,
                       EXTRACT(EPOCH FROM (NOW() - e.entry_time))/60 as minutes_active
                FROM entries e
                LEFT JOIN users u ON e.recorded_by = u.id
                WHERE e.exit_time IS NULL AND e.is_deleted = false
                ORDER BY e.entry_time ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM entries
                WHERE exit_time IS NULL AND is_deleted = false
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
            logger.error('Error in getActiveEntries', { error: error.message, guardId });
            throw error;
        }
    },

    /**
     * Record entry [BR-49]
     */
    async recordEntry(guardId, entryData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate entry number
            const entryNumber = await this.generateEntryNumber();

            const query = `
                INSERT INTO entries (
                    id, entry_number, person_name, entry_type, id_type,
                    id_number, purpose, department_to_visit, person_to_meet,
                    vehicle_number, notes, entry_time, recorded_by,
                    ip_address, user_agent, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                entryNumber,
                entryData.person_name,
                entryData.entry_type,
                entryData.id_type,
                entryData.id_number,
                entryData.purpose,
                entryData.department_to_visit,
                entryData.person_to_meet,
                entryData.vehicle_number,
                entryData.notes,
                entryData.entry_time,
                entryData.recorded_by,
                entryData.ip_address,
                entryData.user_agent
            ];

            const result = await client.query(query, values);

            // Log entry activity
            await client.query(`
                INSERT INTO entry_activity_logs (
                    id, entry_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'entry_recorded', $2, $3, $4
                )
            `, [result.rows[0].id, entryData.recorded_by, entryData.entry_time, entryData.notes]);

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
     * Generate entry number
     */
    async generateEntryNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM entries
                WHERE entry_number LIKE $1
            `, [`ENT-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `ENT-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateEntryNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Mark exit for entry [BR-51]
     */
    async markExit(guardId, entryId, exitData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE entries 
                SET exit_time = $1,
                    exit_notes = $2,
                    exit_recorded_by = $3,
                    updated_at = NOW()
                WHERE id = $4 AND exit_time IS NULL
                RETURNING *
            `;

            const values = [
                exitData.exit_time,
                exitData.notes,
                exitData.recorded_by,
                entryId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Entry not found or already exited');
            }

            // Log exit activity
            await client.query(`
                INSERT INTO entry_activity_logs (
                    id, entry_id, action, performed_by, performed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'exit_recorded', $2, $3, $4
                )
            `, [entryId, exitData.recorded_by, exitData.exit_time, exitData.notes]);

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
     * Get entry statistics
     */
    async getEntryStatistics(guardId, period = 'day') {
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
                        DATE(entry_time) as date,
                        COUNT(*) as total_entries,
                        COUNT(*) FILTER (WHERE entry_type = 'employee') as employees,
                        COUNT(*) FILTER (WHERE entry_type = 'patient') as patients,
                        COUNT(*) FILTER (WHERE entry_type = 'visitor') as visitors,
                        COUNT(*) FILTER (WHERE entry_type = 'vendor') as vendors,
                        COUNT(*) FILTER (WHERE entry_type = 'emergency') as emergencies,
                        AVG(EXTRACT(EPOCH FROM (exit_time - entry_time))/60)::numeric(10,2) as avg_duration
                    FROM entries
                    WHERE entry_time > NOW() - ${interval}
                        AND is_deleted = false
                    GROUP BY DATE(entry_time)
                )
                SELECT 
                    json_agg(daily_stats.* ORDER BY date) as daily,
                    (SELECT 
                        json_build_object(
                            'total', SUM(total_entries),
                            'employees', SUM(employees),
                            'patients', SUM(patients),
                            'visitors', SUM(visitors),
                            'vendors', SUM(vendors),
                            'emergencies', SUM(emergencies),
                            'avg_daily', AVG(total_entries)
                        )
                    FROM daily_stats) as summary
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getEntryStatistics', { error: error.message, guardId });
            throw error;
        }
    }
};

module.exports = entryService;