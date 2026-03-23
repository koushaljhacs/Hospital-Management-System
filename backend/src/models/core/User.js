/**
 * ======================================================================
 * FILE: backend/src/models/core/User.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * User model for database operations.
 * Handles all user-related database queries.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - auth: authentication utilities
 * - logger: logging utility
 * 
 * TABLE: users
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - email: string (unique)
 * - username: string (unique)
 * - password_hash: string
 * - role: enum (super_admin, it_admin, billing_admin, doctor, nurse, receptionist, pharmacist, lab_technician, radiologist, ground_staff, patient, guest)
 * - status: enum (active, inactive, suspended, locked)
 * - profile_picture: text
 * - email_verified: boolean
 * - phone_verified: boolean
 * - two_factor_enabled: boolean
 * - last_login: timestamp
 * - last_password_change: timestamp
 * - failed_login_attempts: integer
 * - locked_until: timestamp
 * - refresh_token: text
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
const auth = require('../../config/auth');
const logger = require('../../utils/logger');

const User = {
    /**
     * Table name
     */
    tableName: 'users',

    /**
     * Find user by ID
     * @param {string} id - User UUID
     * @returns {Promise<Object|null>} User object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    id, username, email, role, status, 
                    profile_picture, email_verified, phone_verified,
                    two_factor_enabled, last_login, last_password_change,
                    failed_login_attempts, locked_until,
                    created_at, updated_at
                FROM users 
                WHERE id = $1 AND is_deleted = false
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('User found by ID', { userId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding user by ID', { 
                error: error.message,
                userId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object|null>} User object with password hash or null
     */
    async findByEmail(email) {
        try {
            const query = `
                SELECT 
                    id, username, email, password_hash, role, status,
                    profile_picture, email_verified, phone_verified,
                    two_factor_enabled, last_login, last_password_change,
                    failed_login_attempts, locked_until, refresh_token,
                    created_at, updated_at
                FROM users 
                WHERE email = $1 AND is_deleted = false
            `;
            
            const result = await db.query(query, [email]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('User found by email', { email });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding user by email', { 
                error: error.message,
                email 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find user by username
     * @param {string} username - Username
     * @returns {Promise<Object|null>} User object or null
     */
    async findByUsername(username) {
        try {
            const query = `
                SELECT 
                    id, username, email, role, status,
                    profile_picture, email_verified, phone_verified,
                    created_at, updated_at
                FROM users 
                WHERE username = $1 AND is_deleted = false
            `;
            
            const result = await db.query(query, [username]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            logger.debug('User found by username', { username });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding user by username', { 
                error: error.message,
                username 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new user
     * @param {Object} userData - User data
     * @param {string} userData.email - User email
     * @param {string} userData.password - User password
     * @param {string} [userData.username] - Username
     * @param {string} [userData.role] - User role (default: guest)
     * @param {string} [userData.status] - User status (default: active)
     * @param {string} [userData.profile_picture] - Profile picture URL
     * @param {boolean} [userData.email_verified] - Email verification status
     * @param {boolean} [userData.phone_verified] - Phone verification status
     * @param {boolean} [userData.two_factor_enabled] - Two-factor authentication status
     * @returns {Promise<Object>} Created user
     */
    async create(userData) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const passwordHash = await auth.hashPassword(userData.password);

            const existingUser = await this.findByEmail(userData.email);
            if (existingUser) {
                throw new Error('Email already registered');
            }

            if (userData.username) {
                const existingUsername = await this.findByUsername(userData.username);
                if (existingUsername) {
                    throw new Error('Username already taken');
                }
            }

            const query = `
                INSERT INTO users (
                    username, email, password_hash, role, status,
                    profile_picture, email_verified, phone_verified,
                    two_factor_enabled, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                RETURNING 
                    id, username, email, role, status,
                    profile_picture, email_verified, phone_verified,
                    two_factor_enabled, created_at
            `;

            const values = [
                userData.username || null,
                userData.email,
                passwordHash,
                userData.role || 'guest',
                userData.status || 'active',
                userData.profile_picture || null,
                userData.email_verified || false,
                userData.phone_verified || false,
                userData.two_factor_enabled || false
            ];

            const result = await client.query(query, values);
            
            await db.commitTransaction(client);
            
            logger.info('User created successfully', { 
                userId: result.rows[0].id,
                email: userData.email,
                role: result.rows[0].role
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating user', { 
                error: error.message,
                email: userData.email 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update user
     * @param {string} id - User ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated user
     */
    async update(id, updates) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'username', 'profile_picture', 'status',
                'email_verified', 'phone_verified', 'two_factor_enabled'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
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
            values.push(id);

            const query = `
                UPDATE users 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, username, email, role, status,
                    profile_picture, email_verified, phone_verified,
                    two_factor_enabled, updated_at
            `;

            const result = await client.query(query, values);
            
            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            await db.commitTransaction(client);
            
            logger.info('User updated successfully', { 
                userId: id,
                updates: Object.keys(updates)
            });
            
            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating user', { 
                error: error.message,
                userId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update last login timestamp
     * @param {string} id - User ID
     * @returns {Promise<void>}
     */
    async updateLastLogin(id) {
        try {
            const query = `
                UPDATE users 
                SET last_login = NOW()
                WHERE id = $1
            `;
            
            await db.query(query, [id]);
            
            logger.debug('Last login updated', { userId: id });
        } catch (error) {
            logger.error('Error updating last login', { 
                error: error.message,
                userId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Update password
     * @param {string} id - User ID
     * @param {string} newPassword - New password
     * @returns {Promise<void>}
     */
    async updatePassword(id, newPassword) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const passwordHash = await auth.hashPassword(newPassword);

            const query = `
                UPDATE users 
                SET password_hash = $1, 
                    last_password_change = NOW(),
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [passwordHash, id]);
            
            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            const historyQuery = `
                INSERT INTO password_history (user_id, password_hash, created_at)
                VALUES ($1, $2, NOW())
            `;
            await client.query(historyQuery, [id, passwordHash]);

            await db.commitTransaction(client);
            
            logger.info('Password updated successfully', { userId: id });
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating password', { 
                error: error.message,
                userId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update refresh token
     * @param {string} id - User ID
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<void>}
     */
    async updateRefreshToken(id, refreshToken) {
        try {
            const query = `
                UPDATE users 
                SET refresh_token = $1,
                    updated_at = NOW()
                WHERE id = $2
            `;
            
            await db.query(query, [refreshToken, id]);
            
            logger.debug('Refresh token updated', { userId: id });
        } catch (error) {
            logger.error('Error updating refresh token', { 
                error: error.message,
                userId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Increment failed login attempts
     * @param {string} id - User ID
     * @param {number} maxAttempts - Max attempts before lock (default: 5)
     * @returns {Promise<number>} Current failed attempt count
     */
    async incrementFailedAttempts(id, maxAttempts = 5) {
        const client = await db.getClient();
        
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE users 
                SET failed_login_attempts = failed_login_attempts + 1,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING failed_login_attempts
            `;

            const result = await client.query(query, [id]);
            const attempts = result.rows[0].failed_login_attempts;

            if (attempts >= maxAttempts) {
                const lockQuery = `
                    UPDATE users 
                    SET status = 'locked',
                        locked_until = NOW() + INTERVAL '30 minutes',
                        updated_at = NOW()
                    WHERE id = $1
                `;
                await client.query(lockQuery, [id]);
                
                logger.warn('Account locked due to failed attempts', { 
                    userId: id,
                    attempts 
                });
            }

            await db.commitTransaction(client);
            
            return attempts;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error incrementing failed attempts', { 
                error: error.message,
                userId: id 
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Reset failed login attempts
     * @param {string} id - User ID
     * @returns {Promise<void>}
     */
    async resetFailedAttempts(id) {
        try {
            const query = `
                UPDATE users 
                SET failed_login_attempts = 0,
                    locked_until = NULL,
                    updated_at = NOW()
                WHERE id = $1
            `;
            
            await db.query(query, [id]);
            
            logger.debug('Failed attempts reset', { userId: id });
        } catch (error) {
            logger.error('Error resetting failed attempts', { 
                error: error.message,
                userId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Check if account is locked
     * @param {string} id - User ID
     * @returns {Promise<boolean>} True if locked
     */
    async isLocked(id) {
        try {
            const query = `
                SELECT status, locked_until 
                FROM users 
                WHERE id = $1
            `;
            
            const result = await db.query(query, [id]);
            
            if (result.rows.length === 0) {
                return false;
            }

            const user = result.rows[0];
            
            if (user.status === 'locked' && user.locked_until) {
                if (new Date() < user.locked_until) {
                    return true;
                }
                await this.resetFailedAttempts(id);
            }
            
            return false;
        } catch (error) {
            logger.error('Error checking lock status', { 
                error: error.message,
                userId: id 
            });
            return false;
        }
    },

    /**
     * Soft delete user
     * @param {string} id - User ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        try {
            const query = `
                UPDATE users 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    status = 'inactive',
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;
            
            const result = await db.query(query, [deletedBy, id]);
            
            if (result.rows.length === 0) {
                throw new Error('User not found');
            }

            logger.info('User soft deleted', { 
                userId: id,
                deletedBy 
            });
            
            return true;
        } catch (error) {
            logger.error('Error deleting user', { 
                error: error.message,
                userId: id 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all users with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {string} [filters.role] - User role
     * @param {string} [filters.status] - User status
     * @param {Object} options - Pagination options
     * @param {number} [options.limit=20] - Items per page
     * @param {number} [options.offset=0] - Items to skip
     * @returns {Promise<Array>} List of users
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = [];

            if (filters.role) {
                conditions.push(`role = $${paramIndex++}`);
                values.push(filters.role);
            }
            if (filters.status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(filters.status);
            }

            const whereClause = conditions.length > 0 
                ? `WHERE ${conditions.join(' AND ')} AND is_deleted = false` 
                : 'WHERE is_deleted = false';

            const query = `
                SELECT 
                    id, username, email, role, status, 
                    profile_picture, email_verified, phone_verified,
                    two_factor_enabled, last_login, created_at
                FROM users 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);
            
            const result = await db.query(query, values);
            
            logger.debug('Retrieved all users', { 
                count: result.rows.length,
                filters,
                limit,
                offset
            });
            
            return result.rows;
        } catch (error) {
            logger.error('Error getting all users', { 
                error: error.message,
                filters 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get users by role
     * @param {string} role - User role
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of users
     */
    async findByRole(role, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, username, email, role, status,
                    profile_picture, email_verified, phone_verified,
                    created_at
                FROM users 
                WHERE role = $1 AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [role, limit, offset]);
            
            logger.debug('Users found by role', { 
                role,
                count: result.rows.length 
            });
            
            return result.rows;
        } catch (error) {
            logger.error('Error finding users by role', { 
                error: error.message,
                role 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search users
     * @param {string} searchTerm - Search term
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of users
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, username, email, role, status,
                    profile_picture, created_at
                FROM users 
                WHERE (email ILIKE $1 OR username ILIKE $1) 
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN email ILIKE $2 THEN 1
                        WHEN username ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    created_at DESC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);
            
            logger.debug('Users search completed', { 
                searchTerm,
                count: result.rows.length 
            });
            
            return result.rows;
        } catch (error) {
            logger.error('Error searching users', { 
                error: error.message,
                searchTerm 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Count total users
     * @param {Object} filters - Filter conditions
     * @returns {Promise<number>} Total count
     */
    async count(filters = {}) {
        try {
            let query = 'SELECT COUNT(*) as total FROM users WHERE is_deleted = false';
            const values = [];
            const conditions = [];

            if (filters.role) {
                conditions.push(`role = $${values.length + 1}`);
                values.push(filters.role);
            }

            if (filters.status) {
                conditions.push(`status = $${values.length + 1}`);
                values.push(filters.status);
            }

            if (conditions.length > 0) {
                query += ' AND ' + conditions.join(' AND ');
            }

            const result = await db.query(query, values);
            
            return parseInt(result.rows[0].total);
        } catch (error) {
            logger.error('Error counting users', { 
                error: error.message,
                filters 
            });
            throw new Error(`Database error: ${error.message}`);
        }
    }
};

module.exports = User;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Create new user
 * const user = await User.create({
 *     email: 'john.doe@hospital.com',
 *     username: 'johndoe',
 *     password: 'SecurePass123!',
 *     role: 'doctor',
 *     status: 'active'
 * });
 * 
 * // Find user by email (for login)
 * const user = await User.findByEmail('john.doe@hospital.com');
 * 
 * // Verify password
 * const isValid = await auth.verifyPassword(password, user.password_hash);
 * 
 * // Update user profile
 * const updated = await User.update(userId, {
 *     profile_picture: 'https://storage.hospital.com/profiles/john.jpg',
 *     phone_verified: true
 * });
 * 
 * // Update password
 * await User.updatePassword(userId, 'NewSecurePass123!');
 * 
 * // Handle failed login
 * const attempts = await User.incrementFailedAttempts(userId);
 * if (attempts >= 5) {
 *     // Account locked
 * }
 * 
 * // Get all doctors with pagination
 * const doctors = await User.findByRole('doctor', { limit: 20, offset: 0 });
 * 
 * // Search users
 * const searchResults = await User.search('john');
 * 
 * // Get all active users
 * const allUsers = await User.getAll({ status: 'active' }, { limit: 50 });
 * 
 * // Count patients
 * const patientCount = await User.count({ role: 'patient' });
 * 
 * ======================================================================
 */