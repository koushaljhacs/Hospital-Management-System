/**
 * ======================================================================
 * FILE: backend/src/utils/logger.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Winston logger configuration for application logging.
 * Supports multiple transports: console, file, and error file.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-02
 * 
 * DEPENDENCIES:
 * - winston v3.9.0
 * - winston-daily-rotate-file v4.7.1 (must be installed separately)
 * 
 * ======================================================================
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Determine log level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    const isDevelopment = env === 'development';
    return isDevelopment ? 'debug' : 'warn';
};

// Custom format for console
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// Custom format for files (no colors)
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.json()
);

// Define transports
const transports = [
    // Console transport
    new winston.transports.Console({
        format: consoleFormat,
    }),
    
    // Info log file (all logs) - using DailyRotateFile
    new DailyRotateFile({
        filename: path.join(logsDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: fileFormat,
        level: 'info',
    }),
    
    // Error log file (only errors)
    new DailyRotateFile({
        filename: path.join(logsDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: fileFormat,
        level: 'error',
    }),
    
    // HTTP log file (API calls)
    new DailyRotateFile({
        filename: path.join(logsDir, 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d',
        format: fileFormat,
        level: 'http',
    }),
];

// Create the logger
const logger = winston.createLogger({
    level: level(),
    levels,
    transports,
    exitOnError: false,
});

/**
 * Mask sensitive data in logs
 * @param {Object} data - Data object to mask
 * @returns {Object} Masked data
 */
logger.maskSensitiveData = (data) => {
    if (!data) return data;
    
    const masked = { ...data };
    const sensitiveFields = ['password', 'password_hash', 'token', 'authorization', 'otp_code', 'refresh_token'];
    
    sensitiveFields.forEach(field => {
        if (masked[field]) {
            masked[field] = '***MASKED***';
        }
    });
    
    return masked;
};

/**
 * Log API request details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} duration - Request duration in ms
 */
logger.logRequest = (req, res, duration) => {
    const logData = {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        userRole: req.user?.role,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
    };
    
    if (res.statusCode >= 400) {
        logger.error('HTTP Request Failed', logData);
    } else {
        logger.http('HTTP Request', logData);
    }
};

/**
 * Log database query
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @param {number} duration - Query duration in ms
 * @param {Error} error - Error if any
 */
logger.logQuery = (query, params, duration, error = null) => {
    const logData = {
        query: query.substring(0, 200),
        paramCount: params?.length || 0,
        duration: `${duration}ms`,
    };
    
    if (error) {
        logger.error('Database query failed', {
            ...logData,
            error: error.message,
            code: error.code,
        });
    } else if (duration > 1000) {
        logger.warn('Slow database query', logData);
    } else {
        logger.debug('Database query executed', logData);
    }
};

/**
 * Log authentication events
 * @param {string} event - Auth event type
 * @param {Object} data - Event data
 */
logger.logAuth = (event, data) => {
    const maskedData = logger.maskSensitiveData(data);
    logger.info(`Auth: ${event}`, maskedData);
};

/**
 * Log security events
 * @param {string} event - Security event type
 * @param {Object} data - Event data
 * @param {string} severity - Severity level
 */
logger.logSecurity = (event, data, severity = 'info') => {
    const logData = {
        event,
        ...logger.maskSensitiveData(data),
        timestamp: new Date().toISOString(),
    };
    
    if (severity === 'critical') {
        logger.error('SECURITY CRITICAL', logData);
    } else if (severity === 'warning') {
        logger.warn('SECURITY WARNING', logData);
    } else {
        logger.info('SECURITY INFO', logData);
    }
};

/**
 * Log business events
 * @param {string} event - Business event type
 * @param {Object} data - Event data
 */
logger.logBusiness = (event, data) => {
    logger.info(`BUSINESS: ${event}`, logger.maskSensitiveData(data));
};

// Stream for morgan HTTP logging
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    },
};

module.exports = logger;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Basic logging
 * logger.info('User logged in', { userId: 123, role: 'doctor' });
 * logger.warn('Invalid login attempt', { ip: '192.168.1.1', attempts: 3 });
 * logger.error('Database connection failed', { error: err.message });
 * 
 * // Request logging (use in middleware)
 * logger.logRequest(req, res, 150);
 * 
 * ======================================================================
 */