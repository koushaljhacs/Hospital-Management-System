/**
 * ======================================================================
 * FILE: backend/src/controllers/security/visitorController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Security Guard visitor controller - Handles visitor management.
 * Total Endpoints: 8
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-50] Visitors must be registered before entry
 * - [BR-52] Active visitors cannot exceed capacity
 * 
 * ======================================================================
 */

const visitorService = require('../../services/security/visitorService');
const logger = require('../../utils/logger');

const visitorController = {
    // ============================================
    // VISITOR LISTS
    // ============================================

    /**
     * Get all visitors
     * GET /api/v1/security/visitors
     */
    async getAllVisitors(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                visitor_type,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                visitor_type,
                from_date,
                to_date
            };

            const visitors = await visitorService.getAllVisitors(
                req.user.id,
                options
            );

            logger.info('Security guard retrieved visitors', {
                guardId: req.user.id,
                count: visitors.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: visitors.data,
                pagination: visitors.pagination,
                summary: visitors.summary
            });
        } catch (error) {
            logger.error('Error getting all visitors', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get active visitors
     * GET /api/v1/security/visitors/active
     * 
     * BUSINESS RULE: [BR-52] Active visitors cannot exceed capacity
     */
    async getActiveVisitors(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const visitors = await visitorService.getActiveVisitors(
                req.user.id,
                options
            );

            logger.info('Security guard viewed active visitors', {
                guardId: req.user.id,
                count: visitors.data?.length || 0
            });

            // [BR-52] Check capacity
            const activeCount = visitors.data?.length || 0;
            const maxCapacity = 100; // Configurable
            const isNearCapacity = activeCount >= maxCapacity * 0.8;
            const isAtCapacity = activeCount >= maxCapacity;

            res.json({
                success: true,
                data: visitors.data,
                pagination: visitors.pagination,
                summary: {
                    total: visitors.summary?.total || 0,
                    active_count: activeCount,
                    max_capacity: maxCapacity,
                    is_near_capacity: isNearCapacity,
                    is_at_capacity: isAtCapacity,
                    capacity_remaining: Math.max(0, maxCapacity - activeCount),
                    by_type: {
                        patient_relative: visitors.data?.filter(v => v.visitor_type === 'patient_relative').length || 0,
                        business: visitors.data?.filter(v => v.visitor_type === 'business').length || 0,
                        delivery: visitors.data?.filter(v => v.visitor_type === 'delivery').length || 0,
                        interview: visitors.data?.filter(v => v.visitor_type === 'interview').length || 0,
                        official: visitors.data?.filter(v => v.visitor_type === 'official').length || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting active visitors', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get visitor by ID
     * GET /api/v1/security/visitors/:id
     */
    async getVisitorById(req, res, next) {
        try {
            const { id } = req.params;

            const visitor = await visitorService.getVisitorById(
                req.user.id,
                id
            );

            if (!visitor) {
                return res.status(404).json({
                    success: false,
                    error: 'Visitor not found'
                });
            }

            logger.info('Security guard viewed visitor details', {
                guardId: req.user.id,
                visitorId: id,
                visitorName: visitor.name,
                visitorType: visitor.visitor_type
            });

            // Calculate time since check-in
            if (visitor.check_in_time && !visitor.check_out_time) {
                const checkInTime = new Date(visitor.check_in_time);
                const now = new Date();
                const durationMinutes = (now - checkInTime) / (1000 * 60);
                visitor.duration_minutes = Math.floor(durationMinutes);
                visitor.duration_hours = (durationMinutes / 60).toFixed(1);
            }

            res.json({
                success: true,
                data: visitor
            });
        } catch (error) {
            if (error.message === 'Visitor not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Visitor not found'
                });
            }
            logger.error('Error getting visitor by ID', {
                error: error.message,
                guardId: req.user.id,
                visitorId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get visitor by ID card
     * GET /api/v1/security/visitors/id-card/:id_card
     */
    async getVisitorByIdCard(req, res, next) {
        try {
            const { id_card } = req.params;

            const visitor = await visitorService.getVisitorByIdCard(
                req.user.id,
                id_card
            );

            if (!visitor) {
                return res.status(404).json({
                    success: false,
                    error: 'Visitor not found'
                });
            }

            logger.info('Security guard retrieved visitor by ID card', {
                guardId: req.user.id,
                idCard: id_card,
                visitorName: visitor.name
            });

            res.json({
                success: true,
                data: visitor
            });
        } catch (error) {
            logger.error('Error getting visitor by ID card', {
                error: error.message,
                guardId: req.user.id,
                idCard: req.params.id_card
            });
            next(error);
        }
    },

    /**
     * Get visitor history
     * GET /api/v1/security/visitors/history
     */
    async getVisitorHistory(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                from_date, 
                to_date,
                visitor_name,
                visitor_type
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date,
                visitor_name,
                visitor_type
            };

            const history = await visitorService.getVisitorHistory(
                req.user.id,
                options
            );

            logger.info('Security guard viewed visitor history', {
                guardId: req.user.id,
                count: history.data?.length || 0
            });

            res.json({
                success: true,
                data: history.data,
                pagination: history.pagination,
                summary: history.summary
            });
        } catch (error) {
            logger.error('Error getting visitor history', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get visitor statistics
     * GET /api/v1/security/visitors/stats
     */
    async getVisitorStats(req, res, next) {
        try {
            const { period = 'day' } = req.query;

            const stats = await visitorService.getVisitorStatistics(
                req.user.id,
                period
            );

            logger.info('Security guard viewed visitor statistics', {
                guardId: req.user.id,
                period
            });

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting visitor statistics', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // VISITOR OPERATIONS
    // ============================================

    /**
     * Register visitor
     * POST /api/v1/security/visitors
     * 
     * BUSINESS RULE: [BR-50] Visitors must be registered before entry
     */
    async registerVisitor(req, res, next) {
        try {
            const {
                name,
                phone,
                visitor_type,
                id_card_number,
                id_card_type,
                purpose,
                person_to_meet,
                department,
                expected_duration,
                vehicle_number,
                notes
            } = req.body;

            // Validate required fields [BR-50]
            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Visitor name is required'
                });
            }

            if (!phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
            }

            if (!visitor_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Visitor type is required'
                });
            }

            // [BR-52] Check capacity before registration
            const activeCount = await visitorService.getActiveVisitorCount(req.user.id);
            const maxCapacity = 100; // Configurable
            
            if (activeCount >= maxCapacity) {
                return res.status(409).json({
                    success: false,
                    error: 'Visitor capacity reached. Please try again later.',
                    active_visitors: activeCount,
                    max_capacity: maxCapacity
                });
            }

            const visitor = await visitorService.registerVisitor(
                req.user.id,
                {
                    name,
                    phone,
                    visitor_type,
                    id_card_number,
                    id_card_type,
                    purpose,
                    person_to_meet,
                    department,
                    expected_duration,
                    vehicle_number,
                    notes,
                    check_in_time: new Date(),
                    registered_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Security guard registered visitor', {
                guardId: req.user.id,
                visitorId: visitor.id,
                visitorName: name,
                visitorType: visitor_type,
                activeCount: activeCount + 1
            });

            res.status(201).json({
                success: true,
                data: visitor,
                message: 'Visitor registered successfully',
                id_card_number: visitor.id_card_number,
                check_in_time: visitor.check_in_time
            });
        } catch (error) {
            logger.error('Error registering visitor', {
                error: error.message,
                guardId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Check out visitor
     * PUT /api/v1/security/visitors/:id/check-out
     */
    async checkOutVisitor(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, check_out_time } = req.body;

            const visitor = await visitorService.getVisitorById(req.user.id, id);
            
            if (!visitor) {
                return res.status(404).json({
                    success: false,
                    error: 'Visitor not found'
                });
            }

            if (visitor.check_out_time) {
                return res.status(400).json({
                    success: false,
                    error: 'Visitor already checked out'
                });
            }

            const checkedOut = await visitorService.checkOutVisitor(
                req.user.id,
                id,
                {
                    notes,
                    check_out_time: check_out_time || new Date(),
                    checked_out_by: req.user.id
                }
            );

            // Calculate duration
            const checkInTime = new Date(visitor.check_in_time);
            const checkOutTime = new Date(checkedOut.check_out_time);
            const durationMinutes = (checkOutTime - checkInTime) / (1000 * 60);

            logger.info('Security guard checked out visitor', {
                guardId: req.user.id,
                visitorId: id,
                visitorName: visitor.name,
                durationMinutes: Math.floor(durationMinutes)
            });

            res.json({
                success: true,
                data: checkedOut,
                message: 'Visitor checked out successfully',
                duration_minutes: Math.floor(durationMinutes),
                duration_hours: (durationMinutes / 60).toFixed(1)
            });
        } catch (error) {
            if (error.message === 'Visitor not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Visitor not found'
                });
            }
            logger.error('Error checking out visitor', {
                error: error.message,
                guardId: req.user.id,
                visitorId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = visitorController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Visitor Lists          | 4         | All, active, by ID, by ID card
 * Visitor History        | 1         | Visitor history
 * Visitor Statistics     | 1         | Visitor statistics
 * Visitor Operations     | 2         | Register, check out
 * -----------------------|-----------|----------------------
 * TOTAL                  | 8         | Complete visitor management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-50] Registration before entry
 * - [BR-52] Capacity check before registration
 * 
 * ======================================================================
 */