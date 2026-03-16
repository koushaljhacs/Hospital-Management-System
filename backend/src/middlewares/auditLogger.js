/**
 * ======================================================================
 * FILE: backend/src/middlewares/auditLogger.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Audit logging middleware for tracking PHI access and sensitive operations.
 * Complies with [SR-13] Audit all PHI access.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * ======================================================================
 */

const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Audit logger middleware
 * Logs all access to sensitive data
 */
const auditLogger = (action) => {
    return async (req, res, next) => {
        // Store original send function
        const originalSend = res.json;
        
        // Override json send to capture response
        res.json = function(data) {
            // Log after response is sent
            setImmediate(async () => {
                try {
                    const logData = {
                        action,
                        user_id: req.user?.id,
                        user_role: req.user?.role,
                        ip_address: req.ip,
                        user_agent: req.headers['user-agent'],
                        method: req.method,
                        path: req.path,
                        query: req.query,
                        params: req.params,
                        timestamp: new Date().toISOString()
                    };

                    // Log to database
                    await db.query(
                        `INSERT INTO audit_logs (
                            user_id, action, ip_address, user_agent, 
                            method, path, query_params, route_params,
                            created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
                        [
                            logData.user_id,
                            logData.action,
                            logData.ip_address,
                            logData.user_agent,
                            logData.method,
                            logData.path,
                            JSON.stringify(logData.query),
                            JSON.stringify(logData.params)
                        ]
                    );

                    // Also log to file
                    logger.audit(logData);
                } catch (error) {
                    logger.error('Audit log failed', { error: error.message });
                }
            });

            // Call original send
            return originalSend.call(this, data);
        };

        next();
    };
};

module.exports = auditLogger;