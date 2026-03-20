/**
 * ======================================================================
 * FILE: backend/src/middlewares/rbac.js (FIXED WITH DATABASE)
 * ======================================================================
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * VERSION: 2.0.0
 * ======================================================================
 * DESCRIPTION:
 * Role-Based Access Control (RBAC) middleware with database integration
 * Fetches permissions from database and caches them for performance
 * ======================================================================
 */

const logger = require('../utils/logger');
const db = require('../config/database');

// Cache permissions for 5 minutes to reduce database hits
const permissionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get user permissions from database
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Array>} Array of permissions
 */
async function getUserPermissions(userId, role) {
    const cacheKey = `${userId}-${role}`;
    const cached = permissionCache.get(cacheKey);
    
    // Return cached permissions if valid
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.permissions;
    }
    
    try {
        // Get role-based permissions
        const rolePerms = await db.query(
            `SELECT p.permission_name 
             FROM role_permissions rp
             JOIN permissions p ON rp.permission_id = p.id
             WHERE rp.role_id = $1 AND rp.grant_type = 'allow'`,
            [role]
        );
        
        // Get user-specific permissions (overrides)
        const userPerms = await db.query(
            `SELECT p.permission_name, up.grant_type
             FROM user_permissions up
             JOIN permissions p ON up.permission_id = p.id
             WHERE up.user_id = $1 AND (up.expires_at IS NULL OR up.expires_at > NOW())`,
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
        
        const permissionArray = Array.from(permissions);
        
        // Cache the permissions
        permissionCache.set(cacheKey, {
            permissions: permissionArray,
            timestamp: Date.now()
        });
        
        return permissionArray;
        
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
 * Clear permission cache for a user
 * @param {string} userId - User ID
 */
function clearUserPermissionCache(userId) {
    for (const [key, value] of permissionCache.entries()) {
        if (key.startsWith(userId)) {
            permissionCache.delete(key);
        }
    }
}

/**
 * Authorize middleware - checks if user has required role/permissions
 * @param {string|string[]} requiredRoles - Single role or array of allowed roles
 * @param {string[]} requiredPermissions - Optional specific permissions
 * @returns {Function} Express middleware
 */
const authorize = (requiredRoles, requiredPermissions = []) => {
    return async (req, res, next) => {
        try {
            // Check if user exists (authenticate middleware should run first)
            if (!req.user) {
                logger.warn('Authorization failed: No user found', {
                    path: req.path,
                    method: req.method,
                    ip: req.ip
                });
                return res.status(401).json({
                    success: false,
                    error: 'Authentication required'
                });
            }

            const userRole = req.user.role;
            
            // Get user permissions from database
            const userPermissions = await getUserPermissions(req.user.id, userRole);
            
            // Attach permissions to request for later use
            req.user.permissions = userPermissions;

            // Convert single role to array for uniform handling
            const allowedRoles = Array.isArray(requiredRoles) 
                ? requiredRoles 
                : [requiredRoles];

            // Role hierarchy (higher level roles have access to lower)
            const roleHierarchy = {
                'super_admin': 100,
                'it_admin': 90,
                'billing_admin': 85,
                'doctor': 80,
                'radiologist': 75,
                'lab_technician': 70,
                'pharmacist': 70,
                'nurse': 65,
                'receptionist': 60,
                'ground_staff': 50,
                'security_guard': 45,
                'patient': 40,
                'guest': 10
            };

            // Check if user's role is allowed (direct match or hierarchy)
            let hasRequiredRole = allowedRoles.includes(userRole);
            
            if (!hasRequiredRole) {
                // Check hierarchy
                const userLevel = roleHierarchy[userRole] || 0;
                const requiredLevel = Math.min(
                    ...allowedRoles.map(role => roleHierarchy[role] || 0)
                );
                
                if (userLevel >= requiredLevel) {
                    hasRequiredRole = true;
                }
            }

            if (!hasRequiredRole) {
                // Log to audit
                await db.query(
                    `INSERT INTO phi_access_logs 
                     (user_id, access_type, table_name, ip_address, user_agent, is_authorized, justification)
                     VALUES ($1, 'unauthorized_access', 'rbac', $2, $3, false, 'Insufficient role')`,
                    [req.user.id, req.ip, req.headers['user-agent']]
                );

                logger.warn('Authorization failed: Insufficient role', {
                    userId: req.user.id,
                    userRole,
                    requiredRoles: allowedRoles,
                    path: req.path,
                    method: req.method
                });
                
                return res.status(403).json({
                    success: false,
                    error: 'Access denied. Insufficient permissions.',
                    code: 'INSUFFICIENT_ROLE'
                });
            }

            // If specific permissions are required, check those too
            if (requiredPermissions.length > 0) {
                const hasAllPermissions = requiredPermissions.every(
                    permission => userPermissions.includes(permission)
                );

                if (!hasAllPermissions) {
                    // Log to audit
                    await db.query(
                        `INSERT INTO phi_access_logs 
                         (user_id, access_type, table_name, ip_address, user_agent, is_authorized, justification, required_permission)
                         VALUES ($1, 'unauthorized_access', 'rbac', $2, $3, false, 'Missing permissions', $4)`,
                        [req.user.id, req.ip, req.headers['user-agent'], requiredPermissions.join(',')]
                    );

                    logger.warn('Authorization failed: Missing permissions', {
                        userId: req.user.id,
                        userRole,
                        userPermissions,
                        requiredPermissions,
                        path: req.path,
                        method: req.method
                    });
                    
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied. Missing required permissions.',
                        code: 'MISSING_PERMISSIONS',
                        required: requiredPermissions,
                        missing: requiredPermissions.filter(p => !userPermissions.includes(p))
                    });
                }
            }

            // Authorization successful - log access for sensitive operations
            if (requiredPermissions.some(p => p.includes('phi') || p.includes('sensitive'))) {
                await db.query(
                    `INSERT INTO phi_access_logs 
                     (user_id, access_type, table_name, record_id, ip_address, user_agent, is_authorized, justification)
                     VALUES ($1, $2, $3, $4, $5, $6, true, 'Authorized access')`,
                    [req.user.id, 'authorized_access', req.path, req.params.id, req.ip, req.headers['user-agent']]
                );
            }

            logger.debug('Authorization successful', {
                userId: req.user.id,
                userRole,
                path: req.path,
                method: req.method,
                permissions: requiredPermissions
            });

            next();
        } catch (error) {
            logger.error('Authorization error', {
                error: error.message,
                stack: error.stack,
                path: req.path,
                method: req.method
            });
            
            return res.status(500).json({
                success: false,
                error: 'Authorization failed due to server error',
                code: 'AUTH_ERROR'
            });
        }
    };
};

/**
 * Role-based middleware shortcuts
 */
authorize.admin = authorize(['super_admin', 'it_admin', 'billing_admin']);
authorize.superAdmin = authorize(['super_admin']);
authorize.itAdmin = authorize(['it_admin']);
authorize.billingAdmin = authorize(['billing_admin']);

authorize.doctor = authorize(['doctor', 'super_admin', 'it_admin']);
authorize.nurse = authorize(['nurse', 'doctor', 'super_admin']);
authorize.pharmacist = authorize(['pharmacist', 'super_admin']);
authorize.patient = authorize(['patient']);
authorize.receptionist = authorize(['receptionist', 'super_admin']);
authorize.labTechnician = authorize(['lab_technician', 'super_admin']);
authorize.radiologist = authorize(['radiologist', 'doctor', 'super_admin']);
authorize.groundStaff = authorize(['ground_staff', 'super_admin']);
authorize.securityGuard = authorize(['security_guard', 'super_admin']);

// Staff groupings
authorize.medicalStaff = authorize(['doctor', 'nurse', 'super_admin']);
authorize.clinicalStaff = authorize(['doctor', 'nurse', 'pharmacist', 'lab_technician', 'radiologist', 'super_admin']);
authorize.allStaff = authorize([
    'super_admin', 'it_admin', 'billing_admin', 'doctor', 'nurse', 
    'pharmacist', 'lab_technician', 'radiologist', 'receptionist', 
    'ground_staff', 'security_guard'
]);

// Permission-based shortcuts
authorize.canViewPHI = authorize(['doctor', 'nurse', 'super_admin'], ['phi:read']);
authorize.canModifyPHI = authorize(['doctor', 'super_admin'], ['phi:write']);
authorize.canViewBilling = authorize(['billing_admin', 'super_admin'], ['billing:read']);
authorize.canProcessPayment = authorize(['billing_admin', 'receptionist'], ['payment:process']);
authorize.canDispenseMeds = authorize(['pharmacist'], ['prescription:dispense']);

// Custom with permissions
authorize.withPermissions = (requiredRoles, requiredPermissions) => 
    authorize(requiredRoles, requiredPermissions);

// Export cache clear function for admin use
authorize.clearUserCache = clearUserPermissionCache;

module.exports = authorize;