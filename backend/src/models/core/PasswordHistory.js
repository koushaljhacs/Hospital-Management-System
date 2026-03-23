/**
 * ======================================================================
 * FILE: backend/src/models/core/PasswordHistory.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * PasswordHistory model for database operations.
 * Tracks password changes to prevent password reuse.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * - auth: for password hashing
 * 
 * TABLE: password_history
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users)
 * - password_hash: string
 * - created_at: timestamp
 * - expires_at: timestamp
 * - is_active: boolean
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation with core CRUD operations
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const auth = require('../../config/auth');

const PasswordHistory = {
    /**
     * Table name
     */
    tableName: 'password_history',

    /**
     * Add password to history
     * @param {string} userId - User ID
     * @param {string} passwordHash - Password hash
     * @returns {Promise<Object>} Created history record
     */
    async add(userId, passwordHash) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO password_history (
                    id, user_id, password_hash, created_at, is_active
                ) VALUES (
                    gen_random_uuid(), $1, $2, NOW(), true
                )
                RETURNING id, user_id, created_at
            `;

            const result = await client.query(query, [userId, passwordHash]);

            await db.commitTransaction(client);

            logger.debug('Password added to history', { userId });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error adding password to history', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Check if password was used before
     * @param {string} userId - User ID
     * @param {string} newPassword - New password (plain text)
     * @param {number} historyLimit - Number of previous passwords to check (default: 5)
     * @returns {Promise<boolean>} True if password was used before
     */
    async isPasswordReused(userId, newPassword, historyLimit = 5) {
        try {
            const query = `
                SELECT password_hash
                FROM password_history
                WHERE user_id = $1 
                    AND is_active = true
                    AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT $2
            `;

            const result = await db.query(query, [userId, historyLimit]);

            for (const record of result.rows) {
                const isMatch = await auth.verifyPassword(newPassword, record.password_hash);
                if (isMatch) {
                    logger.debug('Password reuse detected', { userId });
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error('Error checking password reuse', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get password history for user
     * @param {string} userId - User ID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} Password history records
     */
    async getHistory(userId, options = {}) {
        try {
            const { limit = 10, offset = 0 } = options;

            const query = `
                SELECT 
                    id, user_id, created_at, is_active
                FROM password_history
                WHERE user_id = $1 AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, limit, offset]);

            logger.debug('Password history retrieved', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting password history', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get last password change date
     * @param {string} userId - User ID
     * @returns {Promise<Date|null>} Last password change date
     */
    async getLastChangeDate(userId) {
        try {
            const query = `
                SELECT created_at
                FROM password_history
                WHERE user_id = $1 AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return null;
            }

            return result.rows[0].created_at;
        } catch (error) {
            logger.error('Error getting last password change date', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Deactivate old password entries
     * @param {string} userId - User ID
     * @param {number} keepCount - Number of recent passwords to keep active
     * @returns {Promise<number>} Number of records deactivated
     */
    async deactivateOldEntries(userId, keepCount = 5) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                WITH ranked AS (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
                    FROM password_history
                    WHERE user_id = $1 AND is_deleted = false
                )
                UPDATE password_history 
                SET is_active = false,
                    updated_at = NOW()
                WHERE id IN (
                    SELECT id FROM ranked WHERE rn > $2
                )
                RETURNING id
            `;

            const result = await client.query(query, [userId, keepCount]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.debug('Old password entries deactivated', {
                    userId,
                    count: result.rowCount
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deactivating old password entries', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Clean up old password history (run via cron)
     * @param {number} daysToKeep - Days to keep history records (default: 365)
     * @returns {Promise<number>} Number of records deleted
     */
    async cleanup(daysToKeep = 365) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE password_history 
                SET is_deleted = true,
                    deleted_at = NOW()
                WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
                    AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [daysToKeep]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Old password history cleaned up', {
                    count: result.rowCount,
                    daysToKeep
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cleaning up password history', {
                error: error.message,
                daysToKeep
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Get password history statistics
     * @returns {Promise<Object>} Statistics
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_entries,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(entry_count.entry_count)::numeric(10,2) as avg_entries_per_user,
                    MAX(entry_count.entry_count) as max_entries_per_user
                FROM password_history ph
                JOIN (
                    SELECT user_id, COUNT(*) as entry_count
                    FROM password_history
                    WHERE is_deleted = false
                    GROUP BY user_id
                ) entry_count ON ph.user_id = entry_count.user_id
                WHERE ph.is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Password history statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting password history statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get users with password older than threshold (for expiry notifications)
     * @param {number} daysThreshold - Days threshold (default: 90)
     * @returns {Promise<Array>} List of users
     */
    async getUsersWithOldPasswords(daysThreshold = 90) {
        try {
            const query = `
                SELECT DISTINCT ON (ph.user_id)
                    ph.user_id,
                    ph.created_at as last_password_change,
                    u.username, u.email, u.role
                FROM password_history ph
                JOIN users u ON ph.user_id = u.id
                WHERE ph.is_deleted = false
                    AND ph.created_at < NOW() - ($1 || ' days')::INTERVAL
                ORDER BY ph.user_id, ph.created_at DESC
            `;

            const result = await db.query(query, [daysThreshold]);

            logger.debug('Users with old passwords retrieved', {
                count: result.rows.length,
                daysThreshold
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting users with old passwords', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = PasswordHistory;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Add password to history after password change
 * const passwordHash = await auth.hashPassword(newPassword);
 * await PasswordHistory.add(userId, passwordHash);
 * 
 * // Check if password was used before
 * const isReused = await PasswordHistory.isPasswordReused(userId, newPassword, 5);
 * if (isReused) {
 *     throw new Error('Cannot reuse previous password');
 * }
 * 
 * // Get password history for user
 * const history = await PasswordHistory.getHistory(userId, { limit: 10 });
 * 
 * // Get last password change date
 * const lastChange = await PasswordHistory.getLastChangeDate(userId);
 * 
 * // Deactivate old entries (keep last 5)
 * await PasswordHistory.deactivateOldEntries(userId, 5);
 * 
 * // Get users with passwords older than 90 days
 * const usersToNotify = await PasswordHistory.getUsersWithOldPasswords(90);
 * 
 * // Clean up old history (run via cron monthly)
 * await PasswordHistory.cleanup(365);
 * 
 * // Get password history statistics
 * const stats = await PasswordHistory.getStatistics();
 * 
 * ======================================================================
 */