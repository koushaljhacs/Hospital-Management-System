/**
 * ======================================================================
 * FILE: backend/src/models/core/MFASetting.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * MFASetting model for database operations.
 * Handles multi-factor authentication settings for users.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * - crypto: for generating backup codes
 * 
 * TABLE: mfa_settings
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users, unique)
 * - mfa_enabled: boolean
 * - mfa_method: enum (totp, sms, email)
 * - secret_key: string (encrypted TOTP secret)
 * - backup_codes: text[] (10 backup codes)
 * - recovery_email: string
 * - recovery_phone: string
 * - last_used: timestamp
 * - created_at: timestamp
 * - updated_at: timestamp
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
const crypto = require('crypto');

const MFASetting = {
    /**
     * Table name
     */
    tableName: 'mfa_settings',

    /**
     * Generate backup codes (10 codes)
     * @returns {Promise<Array>} Array of 10 backup codes
     */
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            codes.push(code);
        }
        return codes;
    },

    /**
     * Hash backup code for storage
     * @param {string} code - Raw backup code
     * @returns {string} Hashed backup code
     */
    hashBackupCode(code) {
        return crypto.createHash('sha256').update(code).digest('hex');
    },

    /**
     * Find MFA setting by ID
     * @param {string} id - MFASetting UUID
     * @returns {Promise<Object|null>} MFASetting object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ms.id, ms.user_id, ms.mfa_enabled, ms.mfa_method,
                    ms.secret_key, ms.backup_codes, ms.recovery_email,
                    ms.recovery_phone, ms.last_used,
                    ms.created_at, ms.updated_at,
                    u.username, u.email, u.role
                FROM mfa_settings ms
                JOIN users u ON ms.user_id = u.id
                WHERE ms.id = $1 AND ms.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('MFA setting found by ID', { mfaId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding MFA setting by ID', {
                error: error.message,
                mfaId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find MFA setting by user ID
     * @param {string} userId - User UUID
     * @returns {Promise<Object|null>} MFASetting object or null
     */
    async findByUserId(userId) {
        try {
            const query = `
                SELECT 
                    id, user_id, mfa_enabled, mfa_method,
                    secret_key, backup_codes, recovery_email,
                    recovery_phone, last_used,
                    created_at, updated_at
                FROM mfa_settings
                WHERE user_id = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('MFA setting found by user ID', { userId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding MFA setting by user ID', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create MFA setting for user
     * @param {Object} settingData - MFA setting data
     * @param {string} settingData.user_id - User ID
     * @param {string} settingData.mfa_method - MFA method (totp/sms/email)
     * @param {string} settingData.secret_key - Encrypted TOTP secret
     * @param {string} [settingData.recovery_email] - Recovery email
     * @param {string} [settingData.recovery_phone] - Recovery phone
     * @returns {Promise<Object>} Created MFA setting
     */
    async create(settingData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existing = await this.findByUserId(settingData.user_id);
            if (existing) {
                throw new Error('MFA setting already exists for this user');
            }

            const backupCodes = this.generateBackupCodes();
            const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

            const query = `
                INSERT INTO mfa_settings (
                    id, user_id, mfa_enabled, mfa_method,
                    secret_key, backup_codes, recovery_email,
                    recovery_phone, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, true, $2, $3, $4, $5, $6, NOW(), NOW()
                )
                RETURNING 
                    id, user_id, mfa_enabled, mfa_method,
                    created_at
            `;

            const values = [
                settingData.user_id,
                settingData.mfa_method,
                settingData.secret_key,
                hashedBackupCodes,
                settingData.recovery_email || null,
                settingData.recovery_phone || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('MFA setting created successfully', {
                userId: settingData.user_id,
                method: settingData.mfa_method
            });

            return {
                ...result.rows[0],
                backup_codes: backupCodes
            };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating MFA setting', {
                error: error.message,
                userId: settingData.user_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Enable MFA for user
     * @param {string} userId - User ID
     * @param {string} method - MFA method
     * @param {string} secretKey - TOTP secret key
     * @returns {Promise<Object>} Updated MFA setting
     */
    async enable(userId, method, secretKey) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const existing = await this.findByUserId(userId);

            let result;
            if (existing) {
                const backupCodes = this.generateBackupCodes();
                const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

                const query = `
                    UPDATE mfa_settings 
                    SET mfa_enabled = true,
                        mfa_method = $1,
                        secret_key = $2,
                        backup_codes = $3,
                        updated_at = NOW()
                    WHERE user_id = $4 AND is_deleted = false
                    RETURNING 
                        id, user_id, mfa_enabled, mfa_method,
                        updated_at
                `;

                const values = [method, secretKey, hashedBackupCodes, userId];
                result = await client.query(query, values);
            } else {
                const backupCodes = this.generateBackupCodes();
                const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

                const query = `
                    INSERT INTO mfa_settings (
                        id, user_id, mfa_enabled, mfa_method,
                        secret_key, backup_codes, created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), $1, true, $2, $3, $4, NOW(), NOW()
                    )
                    RETURNING 
                        id, user_id, mfa_enabled, mfa_method,
                        created_at
                `;

                const values = [userId, method, secretKey, hashedBackupCodes];
                result = await client.query(query, values);
            }

            if (result.rows.length === 0) {
                throw new Error('Failed to enable MFA');
            }

            await db.commitTransaction(client);

            logger.info('MFA enabled for user', {
                userId,
                method
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error enabling MFA', {
                error: error.message,
                userId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Disable MFA for user
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} True if disabled
     */
    async disable(userId) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE mfa_settings 
                SET mfa_enabled = false,
                    secret_key = NULL,
                    backup_codes = NULL,
                    updated_at = NOW()
                WHERE user_id = $1 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [userId]);

            if (result.rows.length === 0) {
                return false;
            }

            await db.commitTransaction(client);

            logger.info('MFA disabled for user', { userId });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error disabling MFA', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Verify backup code
     * @param {string} userId - User ID
     * @param {string} code - Backup code to verify
     * @returns {Promise<boolean>} True if code is valid
     */
    async verifyBackupCode(userId, code) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const setting = await this.findByUserId(userId);
            if (!setting || !setting.mfa_enabled || !setting.backup_codes) {
                return false;
            }

            const hashedCode = this.hashBackupCode(code);
            const codes = setting.backup_codes;

            const index = codes.findIndex(c => c === hashedCode);
            if (index === -1) {
                return false;
            }

            codes.splice(index, 1);

            const updateQuery = `
                UPDATE mfa_settings 
                SET backup_codes = $1,
                    last_used = NOW(),
                    updated_at = NOW()
                WHERE user_id = $2 AND is_deleted = false
            `;

            await client.query(updateQuery, [codes, userId]);

            await db.commitTransaction(client);

            logger.info('Backup code verified and consumed', { userId });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error verifying backup code', {
                error: error.message,
                userId
            });
            return false;
        } finally {
            client.release();
        }
    },

    /**
     * Generate new backup codes
     * @param {string} userId - User ID
     * @returns {Promise<Array>} New backup codes
     */
    async regenerateBackupCodes(userId) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const setting = await this.findByUserId(userId);
            if (!setting || !setting.mfa_enabled) {
                throw new Error('MFA not enabled for this user');
            }

            const backupCodes = this.generateBackupCodes();
            const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

            const query = `
                UPDATE mfa_settings 
                SET backup_codes = $1,
                    updated_at = NOW()
                WHERE user_id = $2 AND is_deleted = false
                RETURNING id
            `;

            await client.query(query, [hashedBackupCodes, userId]);

            await db.commitTransaction(client);

            logger.info('Backup codes regenerated', { userId });

            return backupCodes;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error regenerating backup codes', {
                error: error.message,
                userId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update recovery contact
     * @param {string} userId - User ID
     * @param {Object} contactData - Recovery contact data
     * @param {string} [contactData.recovery_email] - Recovery email
     * @param {string} [contactData.recovery_phone] - Recovery phone
     * @returns {Promise<Object>} Updated MFA setting
     */
    async updateRecoveryContact(userId, contactData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const setting = await this.findByUserId(userId);
            if (!setting) {
                throw new Error('MFA setting not found');
            }

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            if (contactData.recovery_email !== undefined) {
                setClause.push(`recovery_email = $${paramIndex++}`);
                values.push(contactData.recovery_email);
            }
            if (contactData.recovery_phone !== undefined) {
                setClause.push(`recovery_phone = $${paramIndex++}`);
                values.push(contactData.recovery_phone);
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(userId);

            const query = `
                UPDATE mfa_settings 
                SET ${setClause.join(', ')}
                WHERE user_id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, user_id, mfa_enabled, mfa_method,
                    recovery_email, recovery_phone, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('MFA setting not found');
            }

            await db.commitTransaction(client);

            logger.info('Recovery contact updated', { userId });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating recovery contact', {
                error: error.message,
                userId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update last used timestamp
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async updateLastUsed(userId) {
        try {
            const query = `
                UPDATE mfa_settings 
                SET last_used = NOW(),
                    updated_at = NOW()
                WHERE user_id = $1 AND is_deleted = false
            `;

            await db.query(query, [userId]);

            logger.debug('MFA last used updated', { userId });
        } catch (error) {
            logger.error('Error updating MFA last used', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get MFA statistics
     * @returns {Promise<Object>} MFA statistics
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_mfa_users,
                    COUNT(*) FILTER (WHERE mfa_enabled = true) as enabled,
                    COUNT(*) FILTER (WHERE mfa_enabled = false) as disabled,
                    COUNT(*) FILTER (WHERE mfa_method = 'totp') as totp_users,
                    COUNT(*) FILTER (WHERE mfa_method = 'sms') as sms_users,
                    COUNT(*) FILTER (WHERE mfa_method = 'email') as email_users,
                    ROUND((COUNT(*) FILTER (WHERE mfa_enabled = true)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as adoption_rate
                FROM mfa_settings
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('MFA statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting MFA statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get users with MFA enabled (for reports)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of users with MFA enabled
     */
    async getEnabledUsers(options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    ms.user_id, ms.mfa_method, ms.last_used,
                    u.username, u.email, u.role
                FROM mfa_settings ms
                JOIN users u ON ms.user_id = u.id
                WHERE ms.mfa_enabled = true AND ms.is_deleted = false
                ORDER BY ms.created_at DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('MFA enabled users retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting MFA enabled users', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = MFASetting;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Enable MFA for user (during setup)
 * const result = await MFASetting.enable(userId, 'totp', secretKey);
 * console.log('Backup codes:', result.backup_codes); // Show to user
 * 
 * // Verify backup code
 * const isValid = await MFASetting.verifyBackupCode(userId, backupCode);
 * if (isValid) {
 *     // Allow access
 * }
 * 
 * // Regenerate backup codes
 * const newCodes = await MFASetting.regenerateBackupCodes(userId);
 * 
 * // Disable MFA
 * await MFASetting.disable(userId);
 * 
 * // Update recovery contact
 * await MFASetting.updateRecoveryContact(userId, {
 *     recovery_email: 'backup@example.com',
 *     recovery_phone: '+919876543210'
 * });
 * 
 * // Update last used timestamp
 * await MFASetting.updateLastUsed(userId);
 * 
 * // Get MFA settings for user
 * const settings = await MFASetting.findByUserId(userId);
 * 
 * // Get MFA statistics for dashboard
 * const stats = await MFASetting.getStatistics();
 * 
 * // Get users with MFA enabled
 * const users = await MFASetting.getEnabledUsers({ limit: 20 });
 * 
 * ======================================================================
 */