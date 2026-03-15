/**
 * ======================================================================
 * FILE: backend/src/middlewares/rateLimiter.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Rate limiting middleware for API endpoints.
 * Prevents abuse by limiting requests per IP/user.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - express-rate-limit v6.7.0
 * 
 * ======================================================================
 */

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create a rate limiter middleware with custom options
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware
 */
const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: 15 * 60 * 1000, // 15 minutes default
        max: 100, // Default 100 requests per window
        message: {
            success: false,
            error: 'Too many requests. Please try again later.'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Use user ID if authenticated, otherwise use IP
            return req.user?.id || req.ip;
        },
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                userId: req.user?.id,
                path: req.path,
                method: req.method
            });
            
            res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(options.windowMs / 1000 / 60) // minutes
            });
        },
        skip: (req) => {
            // Skip rate limiting for health checks
            return req.path === '/health';
        }
    };

    const mergedOptions = { ...defaultOptions, ...options };
    return rateLimit(mergedOptions);
};

/**
 * Pre-configured rate limiters for different use cases
 */
const standard = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: {
        success: false,
        error: 'Too many requests. Limit: 60 per minute.'
    }
});

const sensitive = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: {
        success: false,
        error: 'Too many sensitive operations. Limit: 10 per minute.'
    }
});

const exportLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: {
        success: false,
        error: 'Too many export requests. Limit: 5 per hour.'
    }
});

const auth = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: {
        success: false,
        error: 'Too many authentication attempts. Please slow down.'
    },
    skip: () => false // Don't skip auth endpoints
});

const publicLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: {
        success: false,
        error: 'Too many requests. Limit: 100 per minute.'
    }
});

const admin = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    message: {
        success: false,
        error: 'Too many admin requests. Limit: 200 per minute.'
    }
});

// Export all rate limiters directly
module.exports = {
    standard,
    sensitive,
    export: exportLimiter,
    auth,
    publicLimiter,
    admin,
    // Also export the factory function if needed
    createRateLimiter
};