/**
 * ======================================================================
 * FILE: backend/src/models/core/PasswordPolicy.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * ⚠️ CONFIDENTIAL & PROPRIETARY ⚠️
 * This file contains sensitive security code.
 * NOT FOR PRODUCTION USE WITHOUT AUTHORIZATION.
 * Author: @koushal
 * Review Purpose Only - Faculty/Company Internal Review.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * DESCRIPTION:
 * PasswordPolicy model for database operations.
 * Defines and enforces password strength requirements.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: password_policy (singleton table)
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - policy_name: string
 * - min_length: integer
 * - require_uppercase: boolean
 * - require_lowercase: boolean
 * - require_numbers: boolean
 * - require_special: boolean
 * - special_chars: string
 * - max_age_days: integer
 * - password_history_count: integer
 * - max_login_attempts: integer
 * - lockout_duration_minutes: integer
 * - session_timeout_minutes: integer
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

const PasswordPolicy = {
    /**
     * Table name
     */
    tableName: 'password_policy',

    /**
     * Get current active policy (singleton)
     * @returns {Promise<Object|null>} Policy object or null
     */
    async getCurrent() {
        try {
            const query = `
                SELECT 
                    id, policy_name, min_length,
                    require_uppercase, require_lowercase,
                    require_numbers, require_special, special_chars,
                    max_age_days, password_history_count,
                    max_login_attempts, lockout_duration_minutes,
                    session_timeout_minutes,
                    created_at, updated_at
                FROM password_policy
                WHERE is_deleted = false
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const result = await db.query(query);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Current password policy retrieved');
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting current password policy', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Validate password against policy
     * @param {string} password - Password to validate
     * @returns {Promise<Object>} Validation result with errors
     */
    async validatePassword(password) {
        const policy = await this.getCurrent();
        
        if (!policy) {
            return { valid: true, errors: [] };
        }

        const errors = [];

        if (password.length < policy.min_length) {
            errors.push(`Password must be at least ${policy.min_length} characters long`);
        }

        if (policy.require_uppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (policy.require_lowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (policy.require_numbers && !/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (policy.require_special) {
            const specialRegex = new RegExp(`[${policy.special_chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
            if (!specialRegex.test(password)) {
                errors.push(`Password must contain at least one special character (${policy.special_chars})`);
            }
        }

        const commonPasswords = [
            'password', '123456', '12345678', 'qwerty', 'abc123',
            'admin', 'welcome', 'letmein', 'monkey', 'dragon'
        ];
        
        if (commonPasswords.includes(password.toLowerCase())) {
            errors.push('Password is too common. Please choose a stronger password');
        }

        if (/(.)\1{2,}/.test(password)) {
            errors.push('Password cannot contain repeated characters more than twice in a row');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Update password policy (admin only)
     * @param {Object} policyData - Policy data
     * @param {string} [policyData.policy_name] - Policy name
     * @param {number} [policyData.min_length] - Minimum length
     * @param {boolean} [policyData.require_uppercase] - Require uppercase
     * @param {boolean} [policyData.require_lowercase] - Require lowercase
     * @param {boolean} [policyData.require_numbers] - Require numbers
     * @param {boolean} [policyData.require_special] - Require special
     * @param {string} [policyData.special_chars] - Allowed special chars
     * @param {number} [policyData.max_age_days] - Max password age
     * @param {number} [policyData.password_history_count] - History count
     * @param {number} [policyData.max_login_attempts] - Max login attempts
     * @param {number} [policyData.lockout_duration_minutes] - Lockout duration
     * @param {number} [policyData.session_timeout_minutes] - Session timeout
     * @returns {Promise<Object>} Updated policy
     */
    async update(policyData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const current = await this.getCurrent();

            let result;
            if (current) {
                const allowedFields = [
                    'policy_name', 'min_length', 'require_uppercase',
                    'require_lowercase', 'require_numbers', 'require_special',
                    'special_chars', 'max_age_days', 'password_history_count',
                    'max_login_attempts', 'lockout_duration_minutes',
                    'session_timeout_minutes'
                ];

                const setClause = [];
                const values = [];
                let paramIndex = 1;

                for (const [key, value] of Object.entries(policyData)) {
                    if (allowedFields.includes(key) && value !== undefined) {
                        setClause.push(`${key} = $${paramIndex}`);
                        values.push(value);
                        paramIndex++;
                    }
                }

                if (setClause.length === 0) {
                    throw new Error('No valid fields to update');
                }

                setClause.push(`updated_at = NOW()`);
                values.push(current.id);

                const query = `
                    UPDATE password_policy 
                    SET ${setClause.join(', ')}
                    WHERE id = $${paramIndex} AND is_deleted = false
                    RETURNING 
                        id, policy_name, min_length,
                        require_uppercase, require_lowercase,
                        require_numbers, require_special,
                        special_chars, max_age_days,
                        password_history_count, max_login_attempts,
                        lockout_duration_minutes, session_timeout_minutes,
                        updated_at
                `;

                result = await client.query(query, values);
            } else {
                const query = `
                    INSERT INTO password_policy (
                        id, policy_name, min_length,
                        require_uppercase, require_lowercase,
                        require_numbers, require_special, special_chars,
                        max_age_days, password_history_count,
                        max_login_attempts, lockout_duration_minutes,
                        session_timeout_minutes,
                        created_at, updated_at
                    ) VALUES (
                        gen_random_uuid(), 
                        COALESCE($1, 'default'), 
                        COALESCE($2, 8),
                        COALESCE($3, true), 
                        COALESCE($4, true),
                        COALESCE($5, true), 
                        COALESCE($6, true), 
                        COALESCE($7, '!@#$%^&*'),
                        COALESCE($8, 90), 
                        COALESCE($9, 5),
                        COALESCE($10, 5), 
                        COALESCE($11, 30),
                        COALESCE($12, 30),
                        NOW(), NOW()
                    )
                    RETURNING 
                        id, policy_name, min_length,
                        require_uppercase, require_lowercase,
                        require_numbers, require_special,
                        special_chars, max_age_days,
                        password_history_count, max_login_attempts,
                        lockout_duration_minutes, session_timeout_minutes,
                        created_at
                `;

                const values = [
                    policyData.policy_name || null,
                    policyData.min_length || null,
                    policyData.require_uppercase !== undefined ? policyData.require_uppercase : null,
                    policyData.require_lowercase !== undefined ? policyData.require_lowercase : null,
                    policyData.require_numbers !== undefined ? policyData.require_numbers : null,
                    policyData.require_special !== undefined ? policyData.require_special : null,
                    policyData.special_chars || null,
                    policyData.max_age_days || null,
                    policyData.password_history_count || null,
                    policyData.max_login_attempts || null,
                    policyData.lockout_duration_minutes || null,
                    policyData.session_timeout_minutes || null
                ];

                result = await client.query(query, values);
            }

            await db.commitTransaction(client);

            logger.info('Password policy updated', {
                policyId: result.rows[0].id
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating password policy', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Check if password is expired
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} True if password needs change
     */
    async isPasswordExpired(userId) {
        try {
            const policy = await this.getCurrent();
            if (!policy || !policy.max_age_days) {
                return false;
            }

            const query = `
                SELECT created_at
                FROM password_history
                WHERE user_id = $1 AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return false;
            }

            const lastChange = result.rows[0].created_at;
            const daysSinceChange = (Date.now() - new Date(lastChange)) / (1000 * 60 * 60 * 24);

            const isExpired = daysSinceChange > policy.max_age_days;

            if (isExpired) {
                logger.debug('Password expired', { userId });
            }

            return isExpired;
        } catch (error) {
            logger.error('Error checking password expiry', {
                error: error.message,
                userId
            });
            return false;
        }
    },

    /**
     * Get policy requirements (for frontend display)
     * @returns {Promise<Object>} Policy requirements
     */
    async getRequirements() {
        const policy = await this.getCurrent();
        
        if (!policy) {
            return {
                min_length: 8,
                require_uppercase: true,
                require_lowercase: true,
                require_numbers: true,
                require_special: true,
                special_chars: '!@#$%^&*',
                max_age_days: 90,
                password_history_count: 5
            };
        }

        return {
            min_length: policy.min_length,
            require_uppercase: policy.require_uppercase,
            require_lowercase: policy.require_lowercase,
            require_numbers: policy.require_numbers,
            require_special: policy.require_special,
            special_chars: policy.special_chars,
            max_age_days: policy.max_age_days,
            password_history_count: policy.password_history_count
        };
    },

    /**
     * Get login security settings
     * @returns {Promise<Object>} Login security settings
     */
    async getLoginSettings() {
        const policy = await this.getCurrent();
        
        if (!policy) {
            return {
                max_login_attempts: 5,
                lockout_duration_minutes: 30,
                session_timeout_minutes: 30
            };
        }

        return {
            max_login_attempts: policy.max_login_attempts,
            lockout_duration_minutes: policy.lockout_duration_minutes,
            session_timeout_minutes: policy.session_timeout_minutes
        };
    },

    /**
     * Reset to default policy
     * @returns {Promise<Object>} Default policy
     */
    async resetToDefault() {
        const defaultPolicy = {
            policy_name: 'default',
            min_length: 8,
            require_uppercase: true,
            require_lowercase: true,
            require_numbers: true,
            require_special: true,
            special_chars: '!@#$%^&*',
            max_age_days: 90,
            password_history_count: 5,
            max_login_attempts: 5,
            lockout_duration_minutes: 30,
            session_timeout_minutes: 30
        };

        return this.update(defaultPolicy);
    }
};

module.exports = PasswordPolicy;

/**
 * ======================================================================
 * CONFIDENTIAL - Author: @koushal
 * This code is proprietary to OctNov.
 * Unauthorized use, copying, or distribution is prohibited.
 * For review purposes only.
 * ======================================================================
 */