/**
 * ======================================================================
 * FILE: backend/src/config/auth.js (UPDATED)
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
 * Updated with enhanced security features and better error handling.
 * 
 * VERSION: 2.0.0
 * CREATED: 2026-03-15
 * UPDATED: 2026-03-18
 * 
 * CHANGES:
 * v2.0.0 - Added token versioning, enhanced security, better validation
 * 
 * ======================================================================
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('./env');
const logger = require('../utils/logger');

/**
 * JWT token configuration with enhanced security
 */
const tokenConfig = {
    access: {
        secret: config.jwt.accessSecret,
        expiresIn: config.jwt.accessExpiresIn || '7d',  // 7 days as per .env
        algorithm: 'HS256',
        audience: 'hospital-management-system',
        issuer: 'octnov-backend'
    },
    refresh: {
        secret: config.jwt.refreshSecret,
        expiresIn: config.jwt.refreshExpiresIn || '30d', // 30 days as per .env
        algorithm: 'HS256',
        audience: 'hospital-management-system',
        issuer: 'octnov-backend'
    }
};

/**
 * Password hashing configuration
 */
const passwordConfig = {
    saltRounds: config.bcrypt.saltRounds || 10,
    minLength: 8,
    maxLength: 100,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    specialChars: '!@#$%^&*'
};

/**
 * Token versioning for additional security
 * Can be incremented to invalidate all existing tokens
 */
let tokenVersion = 1;

/**
 * Validate password complexity
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
const validatePasswordComplexity = (password) => {
    const errors = [];
    
    if (!password || typeof password !== 'string') {
        return { isValid: false, errors: ['Password must be a string'] };
    }
    
    if (password.length < passwordConfig.minLength) {
        errors.push(`Password must be at least ${passwordConfig.minLength} characters long`);
    }
    
    if (password.length > passwordConfig.maxLength) {
        errors.push(`Password must not exceed ${passwordConfig.maxLength} characters`);
    }
    
    if (passwordConfig.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (passwordConfig.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (passwordConfig.requireNumbers && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (passwordConfig.requireSpecialChars) {
        const specialRegex = new RegExp(`[${passwordConfig.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
        if (!specialRegex.test(password)) {
            errors.push(`Password must contain at least one special character (${passwordConfig.specialChars})`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Hash a plain text password with enhanced security
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 * @throws {Error} If password is invalid or hashing fails
 */
const hashPassword = async (password) => {
    try {
        // Validate password complexity
        const validation = validatePasswordComplexity(password);
        if (!validation.isValid) {
            throw new Error(validation.errors.join('. '));
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
        throw error;
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
 * Generate access token with enhanced payload
 * @param {Object} user - User object
 * @returns {string} JWT access token
 */
const generateAccessToken = (user) => {
    try {
        if (!user || !user.id) {
            throw new Error('User ID is required');
        }

        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            departmentId: user.department_id,
            type: 'access',
            version: tokenVersion,
            jti: crypto.randomBytes(16).toString('hex') // Unique token ID
        };

        const token = jwt.sign(
            payload,
            tokenConfig.access.secret,
            {
                expiresIn: tokenConfig.access.expiresIn,
                algorithm: tokenConfig.access.algorithm,
                audience: tokenConfig.access.audience,
                issuer: tokenConfig.access.issuer
            }
        );

        logger.debug('Access token generated', { 
            userId: user.id,
            tokenId: payload.jti,
            expiresIn: tokenConfig.access.expiresIn
        });

        return token;
    } catch (error) {
        logger.error('Access token generation failed', { 
            error: error.message,
            userId: user?.id 
        });
        throw new Error(`Access token generation failed: ${error.message}`);
    }
};

/**
 * Generate refresh token with enhanced payload
 * @param {Object} user - User object
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (user) => {
    try {
        if (!user || !user.id) {
            throw new Error('User ID is required');
        }

        const payload = {
            id: user.id,
            type: 'refresh',
            version: tokenVersion,
            jti: crypto.randomBytes(16).toString('hex') // Unique token ID
        };

        const token = jwt.sign(
            payload,
            tokenConfig.refresh.secret,
            {
                expiresIn: tokenConfig.refresh.expiresIn,
                algorithm: tokenConfig.refresh.algorithm,
                audience: tokenConfig.refresh.audience,
                issuer: tokenConfig.refresh.issuer
            }
        );

        logger.debug('Refresh token generated', { 
            userId: user.id,
            tokenId: payload.jti,
            expiresIn: tokenConfig.refresh.expiresIn
        });

        return token;
    } catch (error) {
        logger.error('Refresh token generation failed', { 
            error: error.message,
            userId: user?.id 
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
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        // Calculate expiry timestamps
        const now = Math.floor(Date.now() / 1000);
        const accessExpiry = now + parseExpiryToSeconds(tokenConfig.access.expiresIn);
        const refreshExpiry = now + parseExpiryToSeconds(tokenConfig.refresh.expiresIn);

        return {
            accessToken,
            refreshToken,
            expiresIn: tokenConfig.access.expiresIn,
            accessExpiresAt: new Date(accessExpiry * 1000).toISOString(),
            refreshExpiresAt: new Date(refreshExpiry * 1000).toISOString()
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
 * Parse expiry string to seconds
 * @param {string} expiry - Expiry string (e.g., '7d', '30d', '15m')
 * @returns {number} Seconds
 */
const parseExpiryToSeconds = (expiry) => {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));
    
    switch(unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 60 * 60;
        case 'd': return value * 24 * 60 * 60;
        default: return value;
    }
};

/**
 * Verify access token with enhanced validation
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyAccessToken = (token) => {
    try {
        if (!token) {
            throw new Error('Token is required');
        }

        const decoded = jwt.verify(token, tokenConfig.access.secret, {
            algorithms: [tokenConfig.access.algorithm],
            audience: tokenConfig.access.audience,
            issuer: tokenConfig.access.issuer
        });

        // Verify token type
        if (decoded.type !== 'access') {
            throw new Error('Invalid token type');
        }

        // Verify token version (optional - can be used to invalidate all tokens)
        if (decoded.version && decoded.version !== tokenVersion) {
            throw new Error('Token version mismatch');
        }

        logger.debug('Access token verified', { 
            userId: decoded.id,
            tokenId: decoded.jti,
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
            throw error;
        }
    }
};

/**
 * Verify refresh token with enhanced validation
 * @param {string} token - Refresh token to verify
 * @returns {Object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
    try {
        if (!token) {
            throw new Error('Refresh token is required');
        }

        const decoded = jwt.verify(token, tokenConfig.refresh.secret, {
            algorithms: [tokenConfig.refresh.algorithm],
            audience: tokenConfig.refresh.audience,
            issuer: tokenConfig.refresh.issuer
        });

        // Verify token type
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        // Verify token version
        if (decoded.version && decoded.version !== tokenVersion) {
            throw new Error('Token version mismatch');
        }

        logger.debug('Refresh token verified', { 
            userId: decoded.id,
            tokenId: decoded.jti
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
            throw error;
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
        
        // Create user object from decoded
        const user = {
            id: decoded.id
        };

        // Generate new tokens
        return generateTokens(user);
    } catch (error) {
        logger.error('Token refresh failed', { error: error.message });
        throw error;
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

/**
 * Get remaining time for token in seconds
 * @param {string} token - JWT token
 * @returns {number} Remaining seconds
 */
const getTokenRemainingTime = (token) => {
    const expiry = getTokenExpiry(token);
    if (!expiry) return 0;
    
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, expiry - now);
};

/**
 * Check if token is about to expire
 * @param {string} token - JWT token
 * @param {number} thresholdSeconds - Threshold in seconds
 * @returns {boolean} True if token will expire within threshold
 */
const isTokenExpiringSoon = (token, thresholdSeconds = 300) => {
    const remaining = getTokenRemainingTime(token);
    return remaining > 0 && remaining < thresholdSeconds;
};

/**
 * Invalidate all tokens by incrementing version
 * Call this when security is compromised or during critical updates
 */
const incrementTokenVersion = () => {
    tokenVersion++;
    logger.info('Token version incremented', { newVersion: tokenVersion });
    return tokenVersion;
};

/**
 * Generate a secure random token (for password reset, email verification)
 * @param {number} length - Token length in bytes
 * @returns {string} Secure random token
 */
const generateSecureToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash a token for storage (for password reset, email verification)
 * @param {string} token - Plain token
 * @returns {string} Hashed token
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Verify a token against its hash
 * @param {string} token - Plain token
 * @param {string} hashedToken - Stored hash
 * @returns {boolean} True if token matches
 */
const verifyToken = (token, hashedToken) => {
    const hash = hashToken(token);
    return hash === hashedToken;
};

module.exports = {
    // Password functions
    hashPassword,
    verifyPassword,
    validatePasswordComplexity,
    passwordConfig,
    
    // Token functions
    generateAccessToken,
    generateRefreshToken,
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    refreshTokens,
    
    // Token utility functions
    extractTokenFromHeader,
    getTokenExpiry,
    getTokenRemainingTime,
    isTokenExpiringSoon,
    
    // Token management
    incrementTokenVersion,
    tokenVersion,
    
    // Secure token functions (for reset/verify emails)
    generateSecureToken,
    hashToken,
    verifyToken,
    
    // Config exports
    tokenConfig,
    
    // Version info
    version: '2.0.0'
};

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Hash password during registration
 * const hashedPassword = await auth.hashPassword('SecurePass123!');
 * 
 * // Validate password complexity
 * const validation = auth.validatePasswordComplexity('SecurePass123!');
 * if (!validation.isValid) {
 *   console.log(validation.errors);
 * }
 * 
 * // Verify password during login
 * const isValid = await auth.verifyPassword('SecurePass123!', hashedPassword);
 * 
 * // Generate tokens after successful login
 * const tokens = auth.generateTokens({ 
 *   id: '550e8400-e29b-41d4-a716-446655440000', 
 *   email: 'doctor@hospital.com', 
 *   role: 'doctor' 
 * });
 * 
 * // Verify token in middleware
 * try {
 *   const user = auth.verifyAccessToken(token);
 *   req.user = user;
 * } catch (error) {
 *   // Handle error
 * }
 * 
 * // Refresh tokens
 * const newTokens = auth.refreshTokens(refreshToken);
 * 
 * // Extract token from header
 * const token = auth.extractTokenFromHeader(req.headers.authorization);
 * 
 * // Check if token is expiring soon
 * if (auth.isTokenExpiringSoon(token, 600)) {
 *   // Refresh token
 * }
 * 
 * // Generate secure token for password reset
 * const resetToken = auth.generateSecureToken();
 * const hashedResetToken = auth.hashToken(resetToken);
 * // Store hashedResetToken in database, send resetToken to user email
 * 
 * // Verify reset token
 * if (auth.verifyToken(resetToken, storedHash)) {
 *   // Allow password reset
 * }
 * 
 * ======================================================================
 */