/**
 * ======================================================================
 * FILE: backend/src/middlewares/auth.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Authentication and authorization middleware.
 * Handles JWT verification, role-based access control, and permission checking.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-15
 * 
 * DEPENDENCIES:
 * - auth utilities
 * - User model
 * - logger
 * 
 * MIDDLEWARE FUNCTIONS:
 * - authenticate: Verify JWT token and attach user to request
 * - authorize: Check if user has required role
 * - hasPermission: Check if user has specific permission
 * - optionalAuth: Try to authenticate but don't fail if no token
 * 
 * SECURITY:
 * - Token extraction from Authorization header
 * - Token validation and expiry check
 * - User status verification
 * - Role-based access control
 * - Permission-based access control
 * - Audit logging for access attempts
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation
 * 
 * ======================================================================
 */

const auth = require('../config/auth');
const User = require('../models/User');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Role hierarchy for authorization
 * Higher level roles have access to lower level permissions
 */
const ROLE_HIERARCHY = {
    'super_admin': 100,
    'it_admin': 90,
    'billing_admin': 85,
    'doctor': 80,
    'radiologist': 75,
    'lab_technician': 70,
    'pharmacist': 70,
    'nurse': 65,
    'receptionist': 60,
    'billing_staff': 55,
    'ground_staff': 50,
    'security_guard': 45,
    'patient': 40,
    'guest': 10
};

/**
 * Permission definitions
 * Format: 'resource:action'
 * Example: 'patient:read', 'appointment:create', 'user:delete'
 */
const PERMISSIONS = {
    // User management
    'user:create': ['super_admin'],
    'user:read': ['super_admin', 'it_admin', 'doctor', 'nurse', 'receptionist'],
    'user:update': ['super_admin', 'it_admin'],
    'user:delete': ['super_admin'],
    
    // Patient management
    'patient:create': ['receptionist', 'doctor', 'nurse'],
    'patient:read': ['doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_technician', 'radiologist', 'patient'],
    'patient:update': ['doctor', 'nurse', 'receptionist', 'patient'],
    'patient:delete': ['super_admin'],
    
    // Appointment management
    'appointment:create': ['patient', 'receptionist', 'doctor', 'nurse'],
    'appointment:read': ['doctor', 'nurse', 'receptionist', 'patient'],
    'appointment:update': ['doctor', 'nurse', 'receptionist'],
    'appointment:delete': ['receptionist', 'doctor', 'patient'],
    'appointment:approve': ['doctor'],
    
    // Medical records
    'medical:read': ['doctor', 'nurse', 'patient'],
    'medical:write': ['doctor', 'nurse'],
    'medical:delete': ['super_admin'],
    
    // Prescriptions
    'prescription:create': ['doctor'],
    'prescription:read': ['doctor', 'nurse', 'patient', 'pharmacist'],
    'prescription:update': ['doctor'],
    'prescription:dispense': ['pharmacist'],
    
    // Lab tests
    'lab:order': ['doctor'],
    'lab:read': ['doctor', 'nurse', 'patient', 'lab_technician'],
    'lab:write': ['lab_technician'],
    'lab:verify': ['doctor', 'pathologist'],
    
    // Radiology
    'radiology:order': ['doctor'],
    'radiology:read': ['doctor', 'patient', 'radiologist'],
    'radiology:write': ['radiologist'],
    'radiology:upload': ['radiologist'],
    
    // Pharmacy
    'pharmacy:read': ['pharmacist', 'doctor', 'nurse'],
    'pharmacy:write': ['pharmacist'],
    'pharmacy:dispense': ['pharmacist'],
    
    // Billing
    'billing:read': ['billing_staff', 'billing_admin', 'patient'],
    'billing:write': ['billing_staff', 'billing_admin'],
    'billing:delete': ['billing_admin'],
    'billing:refund': ['billing_admin'],
    
    // Inventory
    'inventory:read': ['pharmacist', 'store_manager', 'doctor', 'nurse'],
    'inventory:write': ['pharmacist', 'store_manager'],
    'inventory:order': ['pharmacist', 'store_manager'],
    
    // Bed management
    'bed:read': ['nurse', 'receptionist', 'doctor'],
    'bed:assign': ['receptionist', 'nurse'],
    'bed:update': ['nurse'],
    
    // Admin
    'admin:access': ['super_admin', 'it_admin', 'billing_admin'],
    'admin:users': ['super_admin'],
    'admin:roles': ['super_admin'],
    'admin:system': ['super_admin', 'it_admin'],
    'admin:audit': ['super_admin', 'it_admin'],
    'admin:config': ['super_admin'],
    
    // Reports
    'report:generate': ['super_admin', 'billing_admin', 'doctor', 'nurse', 'pharmacist'],
    'report:export': ['super_admin', 'billing_admin']
};

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object
 */
const authenticate = async (req, res, next) => {
    try {
        // Extract token from header
        const authHeader = req.headers.authorization;
        const token = auth.extractTokenFromHeader(authHeader);

        if (!token) {
            logger.warn('Authentication failed - no token provided', {
                ip: req.ip,
                path: req.path,
                method: req.method
            });
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Please provide a valid token.'
            });
        }

        // Verify token
        const decoded = auth.verifyAccessToken(token);

        // Get user from database
        const user = await User.findById(decoded.id);

        if (!user) {
            logger.warn('Authentication failed - user not found', {
                userId: decoded.id,
                ip: req.ip,
                path: req.path
            });
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        // Check if user is active
        if (user.status !== 'active') {
            logger.warn('Authentication failed - inactive account', {
                userId: user.id,
                status: user.status,
                ip: req.ip,
                path: req.path
            });
            return res.status(403).json({
                success: false,
                error: 'Account is not active. Please contact administrator.'
            });
        }

        // Attach user to request object
        req.user = {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            status: user.status
        };

        logger.debug('Authentication successful', {
            userId: user.id,
            role: user.role,
            path: req.path,
            method: req.method
        });

        next();
    } catch (error) {
        if (error.message === 'Token expired') {
            logger.warn('Authentication failed - token expired', {
                ip: req.ip,
                path: req.path
            });
            return res.status(401).json({
                success: false,
                error: 'Token expired. Please refresh your token.'
            });
        }

        if (error.message === 'Invalid token') {
            logger.warn('Authentication failed - invalid token', {
                ip: req.ip,
                path: req.path
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid token. Please login again.'
            });
        }

        logger.error('Authentication error', {
            error: error.message,
            ip: req.ip,
            path: req.path
        });
        return res.status(500).json({
            success: false,
            error: 'Authentication failed due to server error'
        });
    }
};

/**
 * Optional authentication middleware
 * Tries to authenticate but doesn't fail if no token
 * Useful for public routes that can show personalized content if logged in
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = auth.extractTokenFromHeader(authHeader);

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = auth.verifyAccessToken(token);
        const user = await User.findById(decoded.id);

        if (user && user.status === 'active') {
            req.user = {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                status: user.status
            };
        } else {
            req.user = null;
        }

        next();
    } catch (error) {
        // On error, just set user to null and continue
        req.user = null;
        next();
    }
};

/**
 * Authorization middleware - role based
 * @param {string|string[]} allowedRoles - Single role or array of allowed roles
 */
const authorize = (allowedRoles, requiredPermission) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                logger.warn('Authorization failed - no user in request', {
                    ip: req.ip,
                    path: req.path
                });
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const userRole = req.user.role;
            const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;

            const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

            let hasRole = roles.includes(userRole);

            if (!hasRole) {
                const minRequiredLevel = Math.min(
                    ...roles.map(role => ROLE_HIERARCHY[role] || 0)
                );
                if (userRoleLevel >= minRequiredLevel) {
                    hasRole = true;
                }
            }

            if (!hasRole) {
                logger.warn('Authorization failed - insufficient role', {
                    userId: req.user.id,
                    userRole,
                    requiredRoles: roles,
                    path: req.path,
                    method: req.method,
                });
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Insufficient role permissions.',
                });
            }

            if (requiredPermission) {
                const allowedRolesForPermission = PERMISSIONS[requiredPermission];

                if (!allowedRolesForPermission) {
                    logger.warn('Permission check failed - unknown permission', {
                        userId: req.user.id,
                        userRole,
                        permission: requiredPermission,
                        path: req.path,
                    });
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied. Unknown permission.',
                    });
                }

                let hasPermission = allowedRolesForPermission.includes(userRole);

                if(!hasPermission) {
                    const minRequiredLevelForPermission = Math.min(
                        ...allowedRolesForPermission.map(role => ROLE_HIERARCHY[role] || 0)
                    );
                    if (userRoleLevel >= minRequiredLevelForPermission) {
                        hasPermission = true;
                    }
                }

                if (!hasPermission) {
                    db.query(
                        `INSERT INTO phi_access_logs (user_id, access_type, table_name, record_id, ip_address, user_agent, is_authorized, justification)
                         VALUES ($1, 'unauthorized_access', 'permission_check', $2, $3, $4, false, $5)`,
                        [req.user.id, requiredPermission, req.ip, req.headers['user-agent'], 'Insufficient permissions']
                    ).catch(err => logger.error('Audit log failed', { error: err.message }));

                  logger.warn(
                    'Permission check failed - insufficient permissions',
                    {
                      userId: req.user.id,
                      userRole,
                      permission: requiredPermission,
                      requiredRoles: allowedRolesForPermission,
                      path: req.path,
                      method: req.method,
                    }
                  );
                  return res.status(403).json({
                    success: false,
                    error: 'Access denied. Insufficient permissions for this action.',
                  });
                }
            }
            
            logger.debug('Authorization successful', {
                userId: req.user.id,
                userRole,
                requiredRole: roles,
                requiredPermission,
            });
            return next();

        } catch (error) {
            logger.error('Authorization error', {
                error: error.message,
                userId: req.user?.id,
                path: req.path
            });
            return res.status(500).json({
                success: false,
                error: 'Authorization failed due to server error'
            });
        }
    };
};

/**
 * Permission-based authorization middleware
 * @param {string} permission - Permission string (e.g., 'patient:read')
 */
const hasPermission = (permission) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                logger.warn('Permission check failed - no user in request', {
                    ip: req.ip,
                    path: req.path,
                    permission
                });
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const userRole = req.user.role;
            
            // Get allowed roles for this permission
            const allowedRoles = PERMISSIONS[permission];

            if (!allowedRoles) {
                logger.warn('Permission check failed - unknown permission', {
                    userId: req.user.id,
                    userRole,
                    permission,
                    path: req.path
                });
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Unknown permission.'
                });
            }

            // Check if user role is in allowed roles
            if (allowedRoles.includes(userRole)) {
                logger.debug('Permission check successful', {
                    userId: req.user.id,
                    userRole,
                    permission
                });
                return next();
            }

            // Check hierarchy
            const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
            const minRequiredLevel = Math.min(
                ...allowedRoles.map(role => ROLE_HIERARCHY[role] || 0)
            );

            if (userRoleLevel >= minRequiredLevel) {
                logger.debug('Permission check successful - hierarchy match', {
                    userId: req.user.id,
                    userRole,
                    permission,
                    userLevel: userRoleLevel,
                    minRequiredLevel
                });
                return next();
            }

            logger.warn('Permission check failed - insufficient permissions', {
                userId: req.user.id,
                userRole,
                permission,
                requiredRoles: allowedRoles,
                path: req.path,
                method: req.method
            });

            // Log to audit for security monitoring
            db.query(
                `INSERT INTO phi_access_logs (user_id, access_type, table_name, record_id, ip_address, user_agent, is_authorized, justification)
                 VALUES ($1, 'unauthorized_access', 'permission_check', $2, $3, $4, false, $5)`,
                [req.user.id, permission, req.ip, req.headers['user-agent'], 'Insufficient permissions']
            ).catch(err => logger.error('Audit log failed', { error: err.message }));

            return res.status(403).json({
                success: false,
                error: 'Access denied. Insufficient permissions.'
            });

        } catch (error) {
            logger.error('Permission check error', {
                error: error.message,
                userId: req.user?.id,
                permission,
                path: req.path
            });
            return res.status(500).json({
                success: false,
                error: 'Permission check failed due to server error'
            });
        }
    };
};

/**
 * Check if user is accessing their own resource
 * @param {Function} getResourceUserId - Function to extract user ID from resource
 */
const isOwnResource = (getResourceUserId) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            // Admin can access any resource
            if (req.user.role === 'super_admin' || req.user.role === 'it_admin') {
                return next();
            }

            const resourceUserId = await getResourceUserId(req);
            
            if (resourceUserId === req.user.id) {
                return next();
            }

            logger.warn('Resource access denied - not owner', {
                userId: req.user.id,
                resourceOwnerId: resourceUserId,
                path: req.path,
                method: req.method
            });

            return res.status(403).json({
                success: false,
                error: 'Access denied. You can only access your own resources.'
            });

        } catch (error) {
            logger.error('Own resource check error', {
                error: error.message,
                userId: req.user?.id,
                path: req.path
            });
            return res.status(500).json({
                success: false,
                error: 'Access check failed due to server error'
            });
        }
    };
};

/**
 * Department-based authorization
 * @param {Function} getResourceDepartmentId - Function to extract department ID
 */
const sameDepartment = (getResourceDepartmentId) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            // Admin can access any department
            if (req.user.role === 'super_admin' || req.user.role === 'it_admin') {
                return next();
            }

            // Get user's department from database
            const userResult = await db.query(
                'SELECT department_id FROM employees WHERE user_id = $1',
                [req.user.id]
            );

            const userDepartmentId = userResult.rows[0]?.department_id;

            if (!userDepartmentId) {
                logger.warn('Department check failed - user has no department', {
                    userId: req.user.id,
                    path: req.path
                });
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. User not assigned to any department.'
                });
            }

            const resourceDepartmentId = await getResourceDepartmentId(req);

            if (userDepartmentId === resourceDepartmentId) {
                return next();
            }

            logger.warn('Department access denied - different department', {
                userId: req.user.id,
                userDepartment: userDepartmentId,
                resourceDepartment: resourceDepartmentId,
                path: req.path
            });

            return res.status(403).json({
                success: false,
                error: 'Access denied. You can only access resources in your department.'
            });

        } catch (error) {
            logger.error('Department check error', {
                error: error.message,
                userId: req.user?.id,
                path: req.path
            });
            return res.status(500).json({
                success: false,
                error: 'Department check failed due to server error'
            });
        }
    };
};

module.exports = {
    authenticate,
    optionalAuth,
    authorize,
    hasPermission,
    isOwnResource,
    sameDepartment,
    ROLE_HIERARCHY,
    PERMISSIONS
};

/**
 * ======================================================================
 * USAGE EXAMPLES:
 * ======================================================================
 * 
 * // Protect route with authentication
 * router.get('/profile', authenticate, userController.getProfile);
 * 
 * // Role-based authorization
 * router.post('/patients', authenticate, authorize(['doctor', 'receptionist']), patientController.create);
 * 
 * // Permission-based authorization
 * router.put('/prescriptions/:id', authenticate, hasPermission('prescription:update'), prescriptionController.update);
 * 
 * // Own resource check
 * router.get('/patients/:id', authenticate, 
 *   isOwnResource(async (req) => {
 *     const patient = await Patient.findById(req.params.id);
 *     return patient.user_id;
 *   }),
 *   patientController.getById
 * );
 * 
 * // Department-based access
 * router.get('/lab-orders', authenticate, 
 *   sameDepartment(async (req) => {
 *     return req.query.department_id;
 *   }),
 *   labController.getOrders
 * );
 * 
 * // Optional authentication for public routes
 * router.get('/doctors', optionalAuth, doctorController.list);
 * 
 * ======================================================================
 */