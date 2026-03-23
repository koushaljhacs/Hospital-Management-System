/**
 * ======================================================================
 * FILE: backend/src/models/core/OTPTransaction.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * OTPTransaction model for database operations.
 * Handles all OTP (One-Time Password) transactions for authentication and verification.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * - crypto: for generating OTP codes
 * 
 * TABLE: otp_transactions
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - user_id: UUID (foreign key to users, nullable)
 * - phone_number: string
 * - email: string
 * - otp_code: string (6-digit)
 * - purpose: enum (login, verification, password_reset, sensitive_action)
 * - transaction_data: jsonb
 * - expires_at: timestamp
 * - verified_at: timestamp
 * - verified_ip: inet
 * - verified_ua: text
 * - attempt_count: integer
 * - status: enum (pending, verified, expired, failed)
 * - created_at: timestamp
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation with core CRUD operations
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');

const OTPTransaction = {
    /**
     * Table name
     */
    tableName: 'otp_transactions',

    /**
     * Generate OTP code
     * @returns {string} 6-digit OTP code
     */
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    },

    /**
     * Create new OTP transaction
     * @param {Object} otpData - OTP data
     * @param {string} [otpData.user_id] - User ID (if known)
     * @param {string} [otpData.phone_number] - Phone number
     * @param {string} [otpData.email] - Email address
     * @param {string} otpData.purpose - Purpose (login, verification, password_reset, sensitive_action)
     * @param {Object} [otpData.transaction_data] - Additional transaction data
     * @param {number} [otpData.expiry_minutes] - Expiry in minutes (default: 10)
     * @returns {Promise<Object>} Created OTP transaction
     */
    async create(otpData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (!otpData.phone_number && !otpData.email) {
                throw new Error('Either phone number or email is required');
            }

            const otpCode = this.generateOTP();
            const expiryMinutes = otpData.expiry_minutes || 10;
            const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

            const query = `
                INSERT INTO otp_transactions (
                    id, user_id, phone_number, email, otp_code,
                    purpose, transaction_data, expires_at,
                    attempt_count, status, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 0, 'pending', NOW()
                )
                RETURNING 
                    id, user_id, phone_number, email, otp_code,
                    purpose, expires_at, created_at
            `;

            const values = [
                otpData.user_id || null,
                otpData.phone_number || null,
                otpData.email || null,
                otpCode,
                otpData.purpose,
                otpData.transaction_data || null,
                expiresAt
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('OTP transaction created', {
                otpId: result.rows[0].id,
                purpose: otpData.purpose,
                destination: otpData.phone_number || otpData.email
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating OTP transaction', {
                error: error.message,
                purpose: otpData.purpose
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Find OTP transaction by ID
     * @param {string} id - OTP transaction UUID
     * @returns {Promise<Object|null>} OTP transaction or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    id, user_id, phone_number, email, otp_code,
                    purpose, transaction_data, expires_at,
                    verified_at, verified_ip, verified_ua,
                    attempt_count, status, created_at
                FROM otp_transactions
                WHERE id = $1
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('OTP transaction found by ID', { otpId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding OTP transaction by ID', {
                error: error.message,
                otpId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find pending OTP by destination and purpose
     * @param {string} destination - Phone number or email
     * @param {string} purpose - OTP purpose
     * @returns {Promise<Object|null>} OTP transaction or null
     */
    async findPending(destination, purpose) {
        try {
            const query = `
                SELECT 
                    id, user_id, phone_number, email, otp_code,
                    purpose, transaction_data, expires_at,
                    attempt_count, status, created_at
                FROM otp_transactions
                WHERE (phone_number = $1 OR email = $1)
                    AND purpose = $2
                    AND status = 'pending'
                    AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const result = await db.query(query, [destination, purpose]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Pending OTP found', { destination, purpose });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding pending OTP', {
                error: error.message,
                destination,
                purpose
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find OTP by user ID and purpose
     * @param {string} userId - User ID
     * @param {string} purpose - OTP purpose
     * @returns {Promise<Object|null>} OTP transaction or null
     */
    async findByUserId(userId, purpose) {
        try {
            const query = `
                SELECT 
                    id, user_id, phone_number, email, otp_code,
                    purpose, transaction_data, expires_at,
                    attempt_count, status, created_at
                FROM otp_transactions
                WHERE user_id = $1
                    AND purpose = $2
                    AND status = 'pending'
                    AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const result = await db.query(query, [userId, purpose]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('OTP found by user ID', { userId, purpose });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding OTP by user ID', {
                error: error.message,
                userId,
                purpose
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Verify OTP code
     * @param {string} id - OTP transaction ID
     * @param {string} code - OTP code to verify
     * @param {string} ipAddress - IP address of verification
     * @param {string} userAgent - User agent of verification
     * @returns {Promise<Object>} Verification result
     */
    async verify(id, code, ipAddress, userAgent) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const otp = await this.findById(id);
            if (!otp) {
                return { success: false, reason: 'not_found' };
            }

            if (otp.status !== 'pending') {
                return { success: false, reason: 'already_used' };
            }

            if (new Date(otp.expires_at) < new Date()) {
                await this.markExpired(id);
                return { success: false, reason: 'expired' };
            }

            const attemptCount = otp.attempt_count + 1;

            if (otp.otp_code !== code) {
                await this.incrementAttempts(id, attemptCount);
                logger.warn('OTP verification failed', {
                    otpId: id,
                    attemptCount: attemptCount
                });
                return { success: false, reason: 'invalid_code', attempts_left: 3 - attemptCount };
            }

            const query = `
                UPDATE otp_transactions 
                SET status = 'verified',
                    verified_at = NOW(),
                    verified_ip = $1,
                    verified_ua = $2
                WHERE id = $3
                RETURNING id, user_id, phone_number, email, purpose
            `;

            const result = await client.query(query, [ipAddress, userAgent, id]);

            await db.commitTransaction(client);

            logger.info('OTP verified successfully', {
                otpId: id,
                purpose: otp.purpose
            });

            return { success: true, data: result.rows[0] };
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error verifying OTP', {
                error: error.message,
                otpId: id
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    },

    /**
     * Increment attempt count
     * @param {string} id - OTP transaction ID
     * @param {number} attemptCount - Current attempt count
     * @returns {Promise<void>}
     */
    async incrementAttempts(id, attemptCount) {
        try {
            const query = `
                UPDATE otp_transactions 
                SET attempt_count = $1
                WHERE id = $2
            `;

            await db.query(query, [attemptCount, id]);

            if (attemptCount >= 3) {
                await this.markFailed(id);
            }
        } catch (error) {
            logger.error('Error incrementing OTP attempts', {
                error: error.message,
                otpId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Mark OTP as expired
     * @param {string} id - OTP transaction ID
     * @returns {Promise<void>}
     */
    async markExpired(id) {
        try {
            const query = `
                UPDATE otp_transactions 
                SET status = 'expired'
                WHERE id = $1 AND status = 'pending'
            `;

            await db.query(query, [id]);

            logger.debug('OTP marked as expired', { otpId: id });
        } catch (error) {
            logger.error('Error marking OTP as expired', {
                error: error.message,
                otpId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Mark OTP as failed
     * @param {string} id - OTP transaction ID
     * @returns {Promise<void>}
     */
    async markFailed(id) {
        try {
            const query = `
                UPDATE otp_transactions 
                SET status = 'failed'
                WHERE id = $1 AND status = 'pending'
            `;

            await db.query(query, [id]);

            logger.debug('OTP marked as failed', { otpId: id });
        } catch (error) {
            logger.error('Error marking OTP as failed', {
                error: error.message,
                otpId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Invalidate all pending OTPs for a user
     * @param {string} userId - User ID
     * @param {string} purpose - OTP purpose (optional)
     * @returns {Promise<number>} Number of invalidated OTPs
     */
    async invalidateUserOtps(userId, purpose = null) {
        try {
            let query = `
                UPDATE otp_transactions 
                SET status = 'expired'
                WHERE user_id = $1 AND status = 'pending'
            `;
            const values = [userId];

            if (purpose) {
                query += ` AND purpose = $2`;
                values.push(purpose);
            }

            const result = await db.query(query, values);

            logger.debug('User OTPs invalidated', {
                userId,
                purpose,
                count: result.rowCount
            });

            return result.rowCount;
        } catch (error) {
            logger.error('Error invalidating user OTPs', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Invalidate all pending OTPs for a phone number
     * @param {string} phoneNumber - Phone number
     * @returns {Promise<number>} Number of invalidated OTPs
     */
    async invalidatePhoneOtps(phoneNumber) {
        try {
            const query = `
                UPDATE otp_transactions 
                SET status = 'expired'
                WHERE phone_number = $1 AND status = 'pending'
            `;

            const result = await db.query(query, [phoneNumber]);

            logger.debug('Phone OTPs invalidated', {
                phoneNumber,
                count: result.rowCount
            });

            return result.rowCount;
        } catch (error) {
            logger.error('Error invalidating phone OTPs', {
                error: error.message,
                phoneNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Invalidate all pending OTPs for an email
     * @param {string} email - Email address
     * @returns {Promise<number>} Number of invalidated OTPs
     */
    async invalidateEmailOtps(email) {
        try {
            const query = `
                UPDATE otp_transactions 
                SET status = 'expired'
                WHERE email = $1 AND status = 'pending'
            `;

            const result = await db.query(query, [email]);

            logger.debug('Email OTPs invalidated', {
                email,
                count: result.rowCount
            });

            return result.rowCount;
        } catch (error) {
            logger.error('Error invalidating email OTPs', {
                error: error.message,
                email
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get OTP statistics
     * @param {number} days - Days to look back
     * @returns {Promise<Object>} OTP statistics
     */
    async getStatistics(days = 7) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_otps,
                    COUNT(*) FILTER (WHERE status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE status = 'expired') as expired,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(DISTINCT purpose) as purposes_used,
                    ROUND((COUNT(*) FILTER (WHERE status = 'verified')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as verification_rate,
                    AVG(attempt_count)::numeric(10,2) as avg_attempts
                FROM otp_transactions
                WHERE created_at > NOW() - ($1 || ' days')::INTERVAL
            `;

            const result = await db.query(query, [days]);

            logger.debug('OTP statistics retrieved', { days });

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting OTP statistics', {
                error: error.message,
                days
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Clean up old OTP transactions (run via cron)
     * @param {number} daysToKeep - Days to keep OTP records
     * @returns {Promise<number>} Number of records deleted
     */
    async cleanup(daysToKeep = 7) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                DELETE FROM otp_transactions
                WHERE created_at < NOW() - ($1 || ' days')::INTERVAL
                RETURNING id
            `;

            const result = await client.query(query, [daysToKeep]);

            await db.commitTransaction(client);

            if (result.rowCount > 0) {
                logger.info('Old OTP transactions cleaned up', {
                    count: result.rowCount,
                    daysToKeep
                });
            }

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error cleaning up OTP transactions', {
                error: error.message,
                daysToKeep
            });
            throw new Error(`Database error: ${error.message}`);
        } finally {
            client.release();
        }
    }
};

module.exports = OTPTransaction;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create OTP for login
 * const otp = await OTPTransaction.create({
 *     phone_number: '+919876543210',
 *     purpose: 'login',
 *     expiry_minutes: 10
 * });
 * 
 * // Create OTP for user (with user ID)
 * const otp = await OTPTransaction.create({
 *     user_id: userId,
 *     email: 'user@example.com',
 *     purpose: 'password_reset',
 *     transaction_data: { reset_token: 'xyz' }
 * });
 * 
 * // Verify OTP
 * const result = await OTPTransaction.verify(
 *     otp.id,
 *     '123456',
 *     '192.168.1.100',
 *     'Mozilla/5.0...'
 * );
 * 
 * if (result.success) {
 *     // Allow access, process password reset, etc.
 * } else if (result.reason === 'expired') {
 *     // Resend OTP
 * } else if (result.reason === 'invalid_code') {
 *     // Show attempts left: result.attempts_left
 * }
 * 
 * // Find pending OTP
 * const pending = await OTPTransaction.findPending('+919876543210', 'login');
 * 
 * // Invalidate all user OTPs (before sending new one)
 * await OTPTransaction.invalidateUserOtps(userId, 'login');
 * 
 * // Get OTP statistics
 * const stats = await OTPTransaction.getStatistics(7);
 * 
 * // Clean up old OTPs (run via cron daily)
 * await OTPTransaction.cleanup(7);
 * 
 * ======================================================================
 */