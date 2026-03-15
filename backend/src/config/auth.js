/**
 * ======================================================================
 * FILE: backend/src/config/auth.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Authentication configuration module.
 * Handles JWT token generation, verification, and password hashing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - jsonwebtoken v9.0.0
 * - bcryptjs v2.4.3
 * 
 * CONFIGURATION:
 * - JWT_ACCESS_SECRET: Secret for access tokens
 * - JWT_REFRESH_SECRET: Secret for refresh tokens  
 * - JWT_ACCESS_EXPIRES_IN: Access token expiry (default: 15m)
 * - JWT_REFRESH_EXPIRES_IN: Refresh token expiry (default: 7d)
 * - BCRYPT_SALT_ROUNDS: Salt rounds for bcrypt (default: 10)
 * 
 * SECURITY NOTES:
 * - Access tokens: Short-lived (15 minutes default)
 * - Refresh tokens: Long-lived (7 days default)
 * - Passwords: Hashed with bcrypt, never stored in plain text
 * - Tokens: Signed with HMAC SHA256
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./env');
const logger = require('../utils/logger');

/**
 * JWT token configuration
 */
const tokenConfig = {
    access: {
        secret: config.jwt.accessSecret,
        expiresIn: config.jwt.accessExpiresIn || '15m',
        algorithm: 'HS256'
    },
    refresh: {
        secret: config.jwt.refreshSecret,
        expiresIn: config.jwt.refreshExpiresIn || '7d',
        algorithm: 'HS256'
    }
};

/**
 * Password hashing configuration
 */
const passwordConfig = {
    saltRounds: config.bcrypt.saltRounds || 10
};

/**
 * Hash a plain text password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 * @throws {Error} If password is invalid or hashing fails
 */
const hashPassword = async (password) => {
    try {
        if (!password || typeof password !== 'string') {
            throw new Error('Password must be a non-empty string');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        const salt = await bcrypt.genSalt(passwordConfig.saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        logger.debug('Password hashed successfully', { 
            passwordLength: password.length 
        });
        
        return hashedPassword;
    } catch (error) {
        logger.error('Password hashing failed', { 
            error: error.message 
        });
        throw new Error(`Password hashing failed: ${error.message}`);
    }
};

/**
 * Verify a plain text password against a hash
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if password matches
 */
const verifyPassword = async (password, hashedPassword) => {
    try {
        if (!password || !hashedPassword) {
            throw new Error('Password and hash are required');
        }

        const isValid = await bcrypt.compare(password, hashedPassword);
        
        logger.debug('Password verification completed', { 
            isValid 
        });
        
        return isValid;
    } catch (error) {
        logger.error('Password verification failed', { 
            error: error.message 
        });
        throw new Error(`Password verification failed: ${error.message}`);
    }
};

/**
 * Generate access token
 * @param {Object} payload - Token payload (user id, role, etc.)
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
    try {
        if (!payload || !payload.id) {
            throw new Error('User ID is required in payload');
        }

        const token = jwt.sign(
            payload,
            tokenConfig.access.secret,
            {
                expiresIn: tokenConfig.access.expiresIn,
                algorithm: tokenConfig.access.algorithm
            }
        );

        logger.debug('Access token generated', { 
            userId: payload.id,
            expiresIn: tokenConfig.access.expiresIn
        });

        return token;
    } catch (error) {
        logger.error('Access token generation failed', { 
            error: error.message,
            userId: payload?.id 
        });
        throw new Error(`Token generation failed: ${error.message}`);
    }
};

/**
 * Generate refresh token
 * @param {Object} payload - Token payload (user id)
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload) => {
    try {
        if (!payload || !payload.id) {
            throw new Error('User ID is required in payload');
        }

        // Refresh token should have minimal payload
        const refreshPayload = {
            id: payload.id,
            type: 'refresh'
        };

        const token = jwt.sign(
            refreshPayload,
            tokenConfig.refresh.secret,
            {
                expiresIn: tokenConfig.refresh.expiresIn,
                algorithm: tokenConfig.refresh.algorithm
            }
        );

        logger.debug('Refresh token generated', { 
            userId: payload.id,
            expiresIn: tokenConfig.refresh.expiresIn
        });

        return token;
    } catch (error) {
        logger.error('Refresh token generation failed', { 
            error: error.message,
            userId: payload?.id 
        });
        throw new Error(`Refresh token generation failed: ${error.message}`);
    }
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Tokens object
 */
const generateTokens = (user) => {
    try {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            departmentId: user.department_id
        };

        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        return {
            accessToken,
            refreshToken,
            expiresIn: tokenConfig.access.expiresIn
        };
    } catch (error) {
        logger.error('Token generation failed', { 
            error: error.message,
            userId: user?.id 
        });
        throw new Error(`Token generation failed: ${error.message}`);
    }
};

/**
 * Verify access token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
    try {
        if (!token) {
            throw new Error('Token is required');
        }

        const decoded = jwt.verify(token, tokenConfig.access.secret, {
            algorithms: [tokenConfig.access.algorithm]
        });

        logger.debug('Access token verified', { 
            userId: decoded.id,
            role: decoded.role
        });

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            logger.warn('Access token expired', { error: error.message });
            throw new Error('Token expired');
        } else if (error.name === 'JsonWebTokenError') {
            logger.warn('Invalid access token', { error: error.message });
            throw new Error('Invalid token');
        } else {
            logger.error('Token verification failed', { error: error.message });
            throw new Error(`Token verification failed: ${error.message}`);
        }
    }
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
    try {
        if (!token) {
            throw new Error('Refresh token is required');
        }

        const decoded = jwt.verify(token, tokenConfig.refresh.secret, {
            algorithms: [tokenConfig.refresh.algorithm]
        });

        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        logger.debug('Refresh token verified', { 
            userId: decoded.id 
        });

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            logger.warn('Refresh token expired', { error: error.message });
            throw new Error('Refresh token expired');
        } else if (error.name === 'JsonWebTokenError') {
            logger.warn('Invalid refresh token', { error: error.message });
            throw new Error('Invalid refresh token');
        } else {
            logger.error('Refresh token verification failed', { error: error.message });
            throw new Error(`Refresh token verification failed: ${error.message}`);
        }
    }
};

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Valid refresh token
 * @returns {Object} New tokens
 */
const refreshTokens = (refreshToken) => {
    try {
        const decoded = verifyRefreshToken(refreshToken);
        
        // Generate new tokens
        const payload = {
            id: decoded.id
        };

        const newAccessToken = generateAccessToken(payload);
        const newRefreshToken = generateRefreshToken(payload);

        logger.info('Tokens refreshed successfully', { 
            userId: decoded.id 
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: tokenConfig.access.expiresIn
        };
    } catch (error) {
        logger.error('Token refresh failed', { error: error.message });
        throw new Error(`Token refresh failed: ${error.message}`);
    }
};

/**
 * Extract token from authorization header
 * @param {string} authHeader - Authorization header
 * @returns {string|null} Extracted token or null
 */
const extractTokenFromHeader = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    return token || null;
};

/**
 * Get token expiry in seconds
 * @param {string} token - JWT token
 * @returns {number} Expiry timestamp in seconds
 */
const getTokenExpiry = (token) => {
    try {
        const decoded = jwt.decode(token);
        return decoded?.exp || null;
    } catch (error) {
        logger.error('Failed to decode token for expiry', { error: error.message });
        return null;
    }
};

module.exports = {
    hashPassword,
    verifyPassword,
    generateAccessToken,
    generateRefreshToken,
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    refreshTokens,
    extractTokenFromHeader,
    getTokenExpiry,
    tokenConfig,
    passwordConfig
};

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Hash password during registration
 * const hashedPassword = await auth.hashPassword('userPassword123');
 * 
 * // Verify password during login
 * const isValid = await auth.verifyPassword('userPassword123', hashedPassword);
 * 
 * // Generate tokens after successful login
 * const tokens = auth.generateTokens({ id: 1, email: 'user@example.com', role: 'doctor' });
 * 
 * // Verify token in middleware
 * const user = auth.verifyAccessToken(token);
 * 
 * // Refresh tokens
 * const newTokens = auth.refreshTokens(refreshToken);
 * 
 * // Extract token from header
 * const token = auth.extractTokenFromHeader(req.headers.authorization);
 * 
 * ======================================================================
 */