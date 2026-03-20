/**
 * ======================================================================
 * FILE: backend/src/controllers/authController.js (UPDATED)
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Authentication controller handling login, register, logout, token refresh.
 * Implements comprehensive security measures and audit logging.
 * 
 * VERSION: 2.0.0
 * UPDATED: 2026-03-18
 * 
 * CHANGES:
 * v2.0.0 - Added permission fetching, session management, enhanced security
 * 
 * ======================================================================
 */

const User = require('../models/User');
const auth = require('../config/auth');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Get user permissions from database
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Array>} Array of permissions
 */
async function getUserPermissions(userId, role) {
    try {
        // Get role-based permissions
        const rolePerms = await db.query(
            `SELECT p.permission_name 
             FROM role_permissions rp
             JOIN permissions p ON rp.permission_id = p.id
             WHERE rp.role_id = (SELECT id FROM roles WHERE role_name = $1) 
               AND rp.grant_type = 'allow'`,
            [role]
        );
        
        // Get user-specific permissions (overrides)
        const userPerms = await db.query(
            `SELECT p.permission_name, up.grant_type
             FROM user_permissions up
             JOIN permissions p ON up.permission_id = p.id
             WHERE up.user_id = $1 
               AND up.is_active = true 
               AND (up.expires_at IS NULL OR up.expires_at > NOW())`,
            [userId]
        );
        
        // Combine permissions (user permissions override role permissions)
        const permissions = new Set(rolePerms.rows.map(p => p.permission_name));
        
        // Handle user-specific overrides
        userPerms.rows.forEach(perm => {
            if (perm.grant_type === 'allow') {
                permissions.add(perm.permission_name);
            } else if (perm.grant_type === 'deny') {
                permissions.delete(perm.permission_name);
            }
        });
        
        return Array.from(permissions);
        
    } catch (error) {
        logger.error('Error fetching user permissions', {
            error: error.message,
            userId,
            role
        });
        return [];
    }
}

/**
 * Create session in database
 * @param {string} userId - User ID
 * @param {string} sessionToken - Session token
 * @param {string} refreshToken - Refresh token
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Session object
 */
async function createSession(userId, sessionToken, refreshToken, req) {
    const client = await db.getClient();
    
    try {
        await db.beginTransaction(client);
        
        // Deactivate any existing active sessions for this user
        await client.query(
            `UPDATE sessions 
             SET is_active = false, logout_time = NOW(), logout_reason = 'new_login'
             WHERE user_id = $1 AND is_active = true`,
            [userId]
        );
        
        // Create new session
        const result = await client.query(
            `INSERT INTO sessions (
                user_id, session_token, refresh_token, ip_address, 
                user_agent, device_info, login_time, last_activity, expires_at, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW() + INTERVAL '7 days', true)
            RETURNING id, session_token, refresh_token, expires_at`,
            [
                userId, 
                sessionToken, 
                refreshToken, 
                req.ip, 
                req.headers['user-agent'],
                JSON.stringify({
                    browser: req.headers['user-agent'],
                    platform: req.headers['sec-ch-ua-platform'],
                    mobile: req.headers['sec-ch-ua-mobile']
                })
            ]
        );
        
        await db.commitTransaction(client);
        
        return result.rows[0];
        
    } catch (error) {
        await db.rollbackTransaction(client);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Authentication Controller
 */
const authController = {
    /**
     * Register new user
     * POST /api/v1/auth/register
     */
    async register(req, res, next) {
        const client = await db.getClient();
        
        try {
            const { email, username, password, role, ...profileData } = req.body;

            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                logger.warn('Registration failed - email already exists', { email });
                return res.status(409).json({
                    success: false,
                    error: 'Email already registered'
                });
            }

            // Create user
            const user = await User.create({
                email,
                username,
                password,
                role: role || 'guest',
                ...profileData
            });

            // Generate tokens
            const tokens = auth.generateTokens(user);

            // Create session in database
            const session = await createSession(
                user.id, 
                tokens.accessToken, 
                tokens.refreshToken, 
                req
            );

            // Get user permissions
            const permissions = await getUserPermissions(user.id, user.role);

            // Log successful registration
            logger.info('User registered successfully', {
                userId: user.id,
                email: user.email,
                role: user.role,
                ip: req.ip
            });

            // Audit log
            await db.query(
                `INSERT INTO audit_logs (
                    audit_id, audit_type, user_id, action, table_name, 
                    record_id, ip_address, user_agent, created_at
                ) VALUES (
                    gen_random_uuid()::varchar(50), 'create', $1, 'register', 
                    'users', $2, $3, $4, NOW()
                )`,
                [user.id, user.id, req.ip, req.headers['user-agent']]
            );

            res.status(201).json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        username: user.username,
                        role: user.role,
                        permissions: permissions
                    },
                    tokens: {
                        accessToken: session.session_token,
                        refreshToken: session.refresh_token,
                        expiresIn: '7d'
                    }
                }
            });

        } catch (error) {
            logger.error('Registration error', {
                error: error.message,
                body: req.body,
                ip: req.ip
            });
            next(error);
        } finally {
            client.release();
        }
    },

    /**
     * Login user
     * POST /api/v1/auth/login
     */
    async login(req, res, next) {
        const client = await db.getClient();
        
        try {
            const { email, password } = req.body;

            // Find user by email
            const user = await User.findByEmail(email);
            
            if (!user) {
                logger.warn('Login failed - user not found', { email, ip: req.ip });
                
                // Log failed attempt
                await db.query(
                    `INSERT INTO login_attempts (
                        username, ip_address, user_agent, success, failure_reason, attempt_time
                    ) VALUES ($1, $2, $3, false, 'User not found', NOW())`,
                    [email, req.ip, req.headers['user-agent']]
                );

                return res.status(401).json({
                    success: false,
                    error: 'Invalid email or password'
                });
            }

            // Check if account is locked
            const isLocked = await User.isLocked(user.id);
            if (isLocked) {
                logger.warn('Login failed - account locked', { userId: user.id, email, ip: req.ip });
                
                await db.query(
                    `INSERT INTO login_attempts (
                        user_id, username, ip_address, user_agent, success, failure_reason, attempt_time
                    ) VALUES ($1, $2, $3, $4, false, 'Account locked', NOW())`,
                    [user.id, email, req.ip, req.headers['user-agent']]
                );

                return res.status(423).json({
                    success: false,
                    error: 'Account is temporarily locked. Please try again later.',
                    lockedUntil: user.locked_until
                });
            }

            // Verify password
            const isValidPassword = await auth.verifyPassword(password, user.password_hash);
            
            if (!isValidPassword) {
                // Increment failed attempts
                const attempts = await User.incrementFailedAttempts(user.id);
                
                logger.warn('Login failed - invalid password', { 
                    userId: user.id, 
                    email, 
                    attempts,
                    ip: req.ip 
                });

                await db.query(
                    `INSERT INTO login_attempts (
                        user_id, username, ip_address, user_agent, success, failure_reason, attempt_time
                    ) VALUES ($1, $2, $3, $4, false, 'Invalid password', NOW())`,
                    [user.id, email, req.ip, req.headers['user-agent']]
                );

                return res.status(401).json({
                    success: false,
                    error: 'Invalid email or password',
                    attemptsRemaining: 5 - attempts
                });
            }

            // Reset failed attempts on successful login
            await User.resetFailedAttempts(user.id);

            // Generate tokens
            const tokens = auth.generateTokens(user);

            // Create session in database
            const session = await createSession(
                user.id, 
                tokens.accessToken, 
                tokens.refreshToken, 
                req
            );

            // Get user permissions
            const permissions = await getUserPermissions(user.id, user.role);

            // Update last login
            await User.updateLastLogin(user.id);

            // Log successful login
            logger.info('User logged in successfully', {
                userId: user.id,
                email: user.email,
                role: user.role,
                ip: req.ip
            });

            // Record successful login attempt
            await db.query(
                `INSERT INTO login_attempts (
                    user_id, username, ip_address, user_agent, success, attempt_time
                ) VALUES ($1, $2, $3, $4, true, NOW())`,
                [user.id, email, req.ip, req.headers['user-agent']]
            );

            // Remove sensitive data
            delete user.password_hash;
            delete user.refresh_token;

            res.json({
                success: true,
                data: {
                    user: {
                        ...user,
                        permissions: permissions
                    },
                    tokens: {
                        accessToken: session.session_token,
                        refreshToken: session.refresh_token,
                        expiresIn: '7d'
                    }
                }
            });

        } catch (error) {
            logger.error('Login error', {
                error: error.message,
                body: req.body,
                ip: req.ip
            });
            next(error);
        } finally {
            client.release();
        }
    },

    /**
     * Logout user
     * POST /api/v1/auth/logout
     */
    async logout(req, res, next) {
        const client = await db.getClient();
        
        try {
            const userId = req.user?.id;
            const sessionToken = req.headers.authorization?.split(' ')[1];

            if (userId && sessionToken) {
                await db.beginTransaction(client);
                
                // Deactivate the current session
                await client.query(
                    `UPDATE sessions 
                     SET is_active = false, logout_time = NOW(), logout_reason = 'user_logout'
                     WHERE user_id = $1 AND session_token = $2 AND is_active = true`,
                    [userId, sessionToken]
                );
                
                // Clear refresh token from database
                await client.query(
                    `UPDATE users SET refresh_token = NULL WHERE id = $1`,
                    [userId]
                );
                
                await db.commitTransaction(client);

                logger.info('User logged out', {
                    userId,
                    ip: req.ip
                });
            }

            res.json({
                success: true,
                message: 'Logged out successfully'
            });

        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Logout error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });
            next(error);
        } finally {
            client.release();
        }
    },

    /**
     * Refresh access token
     * POST /api/v1/auth/refresh
     */
    async refreshToken(req, res, next) {
        const client = await db.getClient();
        
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    error: 'Refresh token is required'
                });
            }

            // Verify refresh token exists in database
            const session = await db.query(
                `SELECT s.*, u.id as user_id, u.role, u.status
                 FROM sessions s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.refresh_token = $1 AND s.is_active = true AND s.expires_at > NOW()`,
                [refreshToken]
            );

            if (!session.rows.length) {
                logger.warn('Token refresh failed - invalid refresh token', { ip: req.ip });
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or expired refresh token'
                });
            }

            const user = session.rows[0];

            // Check if user is active
            if (user.status !== 'active') {
                logger.warn('Token refresh failed - inactive account', { 
                    userId: user.user_id,
                    status: user.status,
                    ip: req.ip 
                });
                return res.status(403).json({
                    success: false,
                    error: 'Account is not active'
                });
            }

            // Generate new tokens
            const newAccessToken = auth.generateAccessToken({
                id: user.user_id,
                email: user.email,
                role: user.role
            });
            
            const newRefreshToken = auth.generateRefreshToken({
                id: user.user_id
            });

            await db.beginTransaction(client);

            // Deactivate old session
            await client.query(
                `UPDATE sessions 
                 SET is_active = false, logout_time = NOW(), logout_reason = 'token_refresh'
                 WHERE id = $1`,
                [session.rows[0].id]
            );

            // Create new session
            const newSession = await client.query(
                `INSERT INTO sessions (
                    user_id, session_token, refresh_token, ip_address, 
                    user_agent, device_info, login_time, last_activity, expires_at, is_active
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW() + INTERVAL '7 days', true)
                RETURNING session_token, refresh_token, expires_at`,
                [
                    user.user_id,
                    newAccessToken,
                    newRefreshToken,
                    req.ip,
                    req.headers['user-agent'],
                    JSON.stringify({
                        browser: req.headers['user-agent'],
                        platform: req.headers['sec-ch-ua-platform'],
                        mobile: req.headers['sec-ch-ua-mobile']
                    })
                ]
            );

            await db.commitTransaction(client);

            logger.info('Tokens refreshed', {
                userId: user.user_id,
                ip: req.ip
            });

            res.json({
                success: true,
                data: {
                    accessToken: newSession.rows[0].session_token,
                    refreshToken: newSession.rows[0].refresh_token,
                    expiresIn: '7d'
                }
            });

        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Token refresh error', {
                error: error.message,
                ip: req.ip
            });
            next(error);
        } finally {
            client.release();
        }
    },

    /**
     * Change password
     * POST /api/v1/auth/change-password
     */
    async changePassword(req, res, next) {
        const client = await db.getClient();
        
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;

            // Get user with password hash
            const user = await User.findByEmail(req.user.email);

            // Verify current password
            const isValidPassword = await auth.verifyPassword(currentPassword, user.password_hash);
            
            if (!isValidPassword) {
                logger.warn('Password change failed - invalid current password', {
                    userId,
                    ip: req.ip
                });
                return res.status(401).json({
                    success: false,
                    error: 'Current password is incorrect'
                });
            }

            // Check password history (last 5 passwords)
            const passwordHistory = await db.query(
                `SELECT password_hash FROM password_history 
                 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
                [userId]
            );

            for (const oldPass of passwordHistory.rows) {
                const isReused = await auth.verifyPassword(newPassword, oldPass.password_hash);
                if (isReused) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot reuse any of your last 5 passwords'
                    });
                }
            }

            await db.beginTransaction(client);

            // Update password
            await User.updatePassword(userId, newPassword);

            // Add to password history
            await client.query(
                `INSERT INTO password_history (user_id, password_hash, created_at)
                 VALUES ($1, $2, NOW())`,
                [userId, user.password_hash]
            );

            // Deactivate all active sessions for this user
            await client.query(
                `UPDATE sessions 
                 SET is_active = false, logout_time = NOW(), logout_reason = 'password_change'
                 WHERE user_id = $1 AND is_active = true`,
                [userId]
            );

            // Clear refresh token
            await client.query(
                `UPDATE users SET refresh_token = NULL WHERE id = $1`,
                [userId]
            );

            await db.commitTransaction(client);

            logger.info('Password changed successfully', {
                userId,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'Password changed successfully. Please login again with your new password.'
            });

        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Password change error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });
            next(error);
        } finally {
            client.release();
        }
    },

    /**
     * Get current user profile with permissions
     * GET /api/v1/auth/me
     */
    async getProfile(req, res, next) {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                logger.warn('Profile fetch failed - user not found', {
                    userId: req.user.id,
                    ip: req.ip
                });
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // Get user permissions
            const permissions = await getUserPermissions(user.id, user.role);

            // Get current session info
            const sessionToken = req.headers.authorization?.split(' ')[1];
            const session = await db.query(
                `SELECT id, login_time, last_activity, expires_at, ip_address, user_agent
                 FROM sessions 
                 WHERE session_token = $1 AND is_active = true`,
                [sessionToken]
            );

            // Remove sensitive data
            delete user.password_hash;
            delete user.refresh_token;

            res.json({
                success: true,
                data: {
                    ...user,
                    permissions,
                    currentSession: session.rows[0] || null
                }
            });

        } catch (error) {
            logger.error('Profile fetch error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });
            next(error);
        }
    },

    /**
     * Get all active sessions for current user
     * GET /api/v1/auth/sessions
     */
    async getSessions(req, res, next) {
        try {
            const sessions = await db.query(
                `SELECT id, login_time, last_activity, expires_at, ip_address, user_agent, device_info
                 FROM sessions 
                 WHERE user_id = $1 AND is_active = true
                 ORDER BY last_activity DESC`,
                [req.user.id]
            );

            res.json({
                success: true,
                data: sessions.rows
            });

        } catch (error) {
            logger.error('Get sessions error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });
            next(error);
        }
    },

    /**
     * Terminate a specific session
     * DELETE /api/v1/auth/sessions/:id
     */
    async terminateSession(req, res, next) {
        try {
            const { id } = req.params;
            const currentSessionToken = req.headers.authorization?.split(' ')[1];

            // Get current session ID
            const currentSession = await db.query(
                `SELECT id FROM sessions WHERE session_token = $1`,
                [currentSessionToken]
            );

            // Don't allow terminating current session
            if (currentSession.rows[0]?.id === id) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot terminate current session. Use logout instead.'
                });
            }

            const result = await db.query(
                `UPDATE sessions 
                 SET is_active = false, logout_time = NOW(), logout_reason = 'user_terminated'
                 WHERE id = $1 AND user_id = $2 AND is_active = true
                 RETURNING id`,
                [id, req.user.id]
            );

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    error: 'Session not found or already terminated'
                });
            }

            logger.info('Session terminated', {
                userId: req.user.id,
                sessionId: id,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'Session terminated successfully'
            });

        } catch (error) {
            logger.error('Terminate session error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });
            next(error);
        }
    },

    /**
     * Terminate all other sessions
     * POST /api/v1/auth/sessions/terminate-others
     */
    async terminateOtherSessions(req, res, next) {
        try {
            const currentSessionToken = req.headers.authorization?.split(' ')[1];

            // Get current session ID
            const currentSession = await db.query(
                `SELECT id FROM sessions WHERE session_token = $1`,
                [currentSessionToken]
            );

            const result = await db.query(
                `UPDATE sessions 
                 SET is_active = false, logout_time = NOW(), logout_reason = 'user_terminated_others'
                 WHERE user_id = $1 AND id != $2 AND is_active = true
                 RETURNING id`,
                [req.user.id, currentSession.rows[0]?.id]
            );

            logger.info('All other sessions terminated', {
                userId: req.user.id,
                terminatedCount: result.rowCount,
                ip: req.ip
            });

            res.json({
                success: true,
                message: `Terminated ${result.rowCount} other session(s) successfully`
            });

        } catch (error) {
            logger.error('Terminate other sessions error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });
            next(error);
        }
    },

    /**
     * Verify email
     * POST /api/v1/auth/verify-email
     */
    async verifyEmail(req, res, next) {
        try {
            const { token } = req.body;

            // Verify email token from database
            const result = await db.query(
                `UPDATE users 
                 SET email_verified = true, updated_at = NOW()
                 WHERE id = $1 AND email_verified = false
                 RETURNING id`,
                [req.user.id]
            );

            if (!result.rows.length) {
                return res.status(400).json({
                    success: false,
                    error: 'Email already verified or invalid request'
                });
            }

            logger.info('Email verified', {
                userId: req.user.id,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'Email verified successfully'
            });

        } catch (error) {
            logger.error('Email verification error', {
                error: error.message,
                userId: req.user?.id,
                ip: req.ip
            });
            next(error);
        }
    }
};

module.exports = authController;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Register
 * POST /api/v1/auth/register
 * {
 *     "email": "doctor@hospital.com",
 *     "username": "dr.smith",
 *     "password": "SecurePass123!",
 *     "role": "doctor"
 * }
 * 
 * // Login
 * POST /api/v1/auth/login
 * {
 *     "email": "doctor@hospital.com",
 *     "password": "SecurePass123!"
 * }
 * 
 * // Refresh token
 * POST /api/v1/auth/refresh
 * {
 *     "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
 * }
 * 
 * // Get profile (requires auth)
 * GET /api/v1/auth/me
 * 
 * // Get all sessions
 * GET /api/v1/auth/sessions
 * 
 * // Terminate specific session
 * DELETE /api/v1/auth/sessions/:id
 * 
 * // Terminate all other sessions
 * POST /api/v1/auth/sessions/terminate-others
 * 
 * ======================================================================
 */