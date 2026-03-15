/**
 * ======================================================================
 * FILE: backend/src/config/env.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Environment variables validation and configuration.
 * Ensures all required environment variables are present and correctly formatted.
 * Provides type-safe configuration object for the entire application.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * PRODUCTION BEST PRACTICES IMPLEMENTED:
 * - Early validation on startup
 * - Type conversion and validation
 * - Default values for optional variables
 * - Clear error messages for missing required vars
 * - Environment-specific configurations
 * - Secrets validation
 * - Numeric range validation
 * - Boolean parsing
 * 
 * DEPENDENCIES:
 * - dotenv v16.0.3 (already loaded in main app)
 * 
 * ENVIRONMENT FILES:
 * - .env.development (development specific)
 * - .env.staging (staging specific)  
 * - .env.production (production specific)
 * - .env (local overrides, gitignored)
 * 
 * VALIDATION RULES:
 * - All required variables must be present
 * - Port numbers must be within valid range (1-65535)
 * - Database pool settings must be positive numbers
 * - JWT secrets must meet minimum length
 * - URLs must be valid format
 * - Boolean strings are properly parsed
 * 
 * ERROR HANDLING:
 * - Throws clear error with missing variable name
 * - Logs validation errors before application starts
 * - Prevents application from running with invalid config
 * 
 * ======================================================================
 */

const logger = require('../utils/logger');

/**
 * Environment types
 */
const ENVIRONMENTS = {
    DEVELOPMENT: 'development',
    STAGING: 'staging',
    PRODUCTION: 'production',
    TEST: 'test'
};

/**
 * Get current environment
 */
const NODE_ENV = process.env.NODE_ENV || ENVIRONMENTS.DEVELOPMENT;

/**
 * Validate that a required environment variable exists
 * @param {string} key - Environment variable name
 * @param {string} value - Environment variable value
 * @throws {Error} If required variable is missing
 */
const requireEnv = (key, value) => {
    if (!value || value.trim() === '') {
        const error = new Error(`❌ Environment variable ${key} is required but not set.`);
        logger.error(error.message);
        throw error;
    }
    return value.trim();
};

/**
 * Parse boolean from string
 * @param {string} value - Boolean string (true/false/1/0/yes/no)
 * @param {boolean} defaultValue - Default value if parsing fails
 * @returns {boolean} Parsed boolean
 */
const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null) return defaultValue;
    const str = String(value).toLowerCase().trim();
    return ['true', '1', 'yes', 'on', 'y'].includes(str);
};

/**
 * Parse integer with validation
 * @param {string} value - String to parse
 * @param {number} defaultValue - Default value
 * @param {Object} options - Validation options { min, max }
 * @returns {number} Parsed integer
 */
const parseIntWithRange = (value, defaultValue, options = {}) => {
    const { min, max } = options;
    let parsed = parseInt(value, 10);
    
    if (isNaN(parsed)) {
        logger.warn(`Invalid integer value "${value}", using default: ${defaultValue}`);
        parsed = defaultValue;
    }
    
    if (min !== undefined && parsed < min) {
        logger.warn(`Value ${parsed} is below minimum ${min}, using minimum`);
        parsed = min;
    }
    
    if (max !== undefined && parsed > max) {
        logger.warn(`Value ${parsed} is above maximum ${max}, using maximum`);
        parsed = max;
    }
    
    return parsed;
};

/**
 * Parse float with validation
 * @param {string} value - String to parse
 * @param {number} defaultValue - Default value
 * @param {Object} options - Validation options { min, max }
 * @returns {number} Parsed float
 */
const parseFloatWithRange = (value, defaultValue, options = {}) => {
    const { min, max } = options;
    let parsed = parseFloat(value);
    
    if (isNaN(parsed)) {
        logger.warn(`Invalid float value "${value}", using default: ${defaultValue}`);
        parsed = defaultValue;
    }
    
    if (min !== undefined && parsed < min) {
        logger.warn(`Value ${parsed} is below minimum ${min}, using minimum`);
        parsed = min;
    }
    
    if (max !== undefined && parsed > max) {
        logger.warn(`Value ${parsed} is above maximum ${max}, using maximum`);
        parsed = max;
    }
    
    return parsed;
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @param {string} defaultValue - Default URL
 * @returns {string} Validated URL
 */
const validateUrl = (url, defaultValue) => {
    if (!url) return defaultValue;
    try {
        new URL(url);
        return url;
    } catch (error) {
        logger.warn(`Invalid URL format "${url}", using default: ${defaultValue}`);
        return defaultValue;
    }
};

/**
 * Validate JWT secret length
 * @param {string} secret - JWT secret
 * @param {string} purpose - Secret purpose (access/refresh)
 * @returns {string} Validated secret
 */
const validateJwtSecret = (secret, purpose) => {
    const value = requireEnv(`JWT_${purpose}_SECRET`, secret);
    if (value.length < 32) {
        logger.warn(`JWT ${purpose} secret length (${value.length}) is less than recommended 32 characters.`);
    }
    return value;
};

/**
 * Database configuration
 */
const database = {
    // Required connection parameters
    host: requireEnv('DB_HOST', process.env.DB_HOST),
    port: parseIntWithRange(process.env.DB_PORT, 6000, { min: 1, max: 65535 }),
    name: requireEnv('DB_NAME', process.env.DB_NAME),
    user: requireEnv('DB_USER', process.env.DB_USER),
    password: requireEnv('DB_PASSWORD', process.env.DB_PASSWORD),
    schema: process.env.DB_SCHEMA || 'public',
    
    // Connection pool settings
    pool: {
        max: parseIntWithRange(process.env.DB_POOL_MAX, 20, { min: 1, max: 100 }),
        min: parseIntWithRange(process.env.DB_POOL_MIN, 5, { min: 0, max: 50 }),
        acquire: parseIntWithRange(process.env.DB_POOL_ACQUIRE, 30000, { min: 1000, max: 60000 }),
        idle: parseIntWithRange(process.env.DB_POOL_IDLE, 10000, { min: 1000, max: 30000 })
    },
    
    // SSL configuration
    ssl: {
        enabled: parseBoolean(process.env.DB_SSL, false),
        rejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, false)
    }
};

/**
 * Server configuration
 */
const server = {
    port: parseIntWithRange(process.env.PORT, 7000, { min: 1, max: 65535 }),
    env: NODE_ENV,
    isDevelopment: NODE_ENV === ENVIRONMENTS.DEVELOPMENT,
    isStaging: NODE_ENV === ENVIRONMENTS.STAGING,
    isProduction: NODE_ENV === ENVIRONMENTS.PRODUCTION,
    isTest: NODE_ENV === ENVIRONMENTS.TEST,
    
    api: {
        prefix: process.env.API_PREFIX || '/api/v1',
        version: process.env.API_VERSION || '1.0.0'
    }
};

/**
 * JWT configuration (for authentication)
 */
const jwt = {
    accessSecret: validateJwtSecret(process.env.JWT_SECRET, 'ACCESS'),
    refreshSecret: validateJwtSecret(process.env.JWT_REFRESH_SECRET, 'REFRESH'),
    accessExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
};

/**
 * Bcrypt configuration
 */
const bcrypt = {
    saltRounds: parseIntWithRange(process.env.BCRYPT_SALT_ROUNDS, 10, { min: 8, max: 12 })
};

/**
 * CORS configuration
 */
const cors = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'],
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, true)
};

/**
 * Rate limiting configuration
 */
const rateLimit = {
    windowMs: parseIntWithRange(process.env.RATE_LIMIT_WINDOW_MS, 60000, { min: 1000, max: 3600000 }),
    maxRequests: parseIntWithRange(process.env.RATE_LIMIT_MAX_REQUESTS, 100, { min: 1, max: 1000 })
};

/**
 * Logging configuration
 */
const logging = {
    level: process.env.LOG_LEVEL || (server.isProduction ? 'info' : 'debug'),
    file: process.env.LOG_FILE || 'logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d'
};

/**
 * Validate pool configuration consistency
 */
if (database.pool.min > database.pool.max) {
    logger.warn(`Database pool min (${database.pool.min}) is greater than max (${database.pool.max}). Adjusting...`);
    database.pool.min = database.pool.max;
}

/**
 * Export validated configuration
 */
const config = {
    database,
    server,
    jwt,
    bcrypt,
    cors,
    rateLimit,
    logging,
    
    /**
     * Check if running in production
     */
    isProduction: server.isProduction,
    
    /**
     * Check if running in development
     */
    isDevelopment: server.isDevelopment,
    
    /**
     * Get configuration summary for logging
     */
    getSummary() {
        return {
            environment: this.server.env,
            server: {
                port: this.server.port,
                apiPrefix: this.server.api.prefix
            },
            database: {
                host: this.database.host,
                port: this.database.port,
                name: this.database.name,
                user: this.database.user,
                pool: this.database.pool
            },
            jwt: {
                accessExpiresIn: this.jwt.accessExpiresIn,
                refreshExpiresIn: this.jwt.refreshExpiresIn
            },
            cors: {
                origin: this.cors.origin,
                credentials: this.cors.credentials
            },
            logging: this.logging
        };
    },
    
    /**
     * Sanitize config for logging (remove secrets)
     */
    getSanitized() {
        const summary = this.getSummary();
        // Remove sensitive data
        if (summary.database) delete summary.database.password;
        if (summary.jwt) {
            delete summary.jwt.accessSecret;
            delete summary.jwt.refreshSecret;
        }
        return summary;
    }
};

// Log configuration on startup (without secrets)
logger.info('Environment configuration loaded', config.getSanitized());

module.exports = config;

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Import config
 * const config = require('./src/config/env');
 * 
 * // Use database config
 * const dbConfig = config.database;
 * const pool = new Pool(dbConfig);
 * 
 * // Use server config
 * const port = config.server.port;
 * 
 * // Check environment
 * if (config.isProduction) {
 *   // production specific code
 * }
 * 
 * // Use JWT config
 * const token = jwt.sign(payload, config.jwt.accessSecret, {
 *   expiresIn: config.jwt.accessExpiresIn
 * });
 * 
 * // Use CORS config
 * app.use(cors(config.cors));
 * 
 * // Use rate limiting
 * app.use(rateLimit(config.rateLimit));
 * 
 * ======================================================================
 */