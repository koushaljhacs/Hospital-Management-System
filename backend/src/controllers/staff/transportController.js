/**
 * ======================================================================
 * FILE: backend/src/controllers/staff/transportController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Ground Staff transport controller - Handles transport request management.
 * Total Endpoints: 7
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-47] Transport requests require driver assignment
 * 
 * ======================================================================
 */

const transportService = require('../../services/staff/transportService');
const logger = require('../../utils/logger');

const transportController = {
    // ============================================
    // TRANSPORT REQUEST LISTS
    // ============================================

    /**
     * Get all transport requests
     * GET /api/v1/staff/transport
     */
    async getAllRequests(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                request_type,
                priority,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                request_type,
                priority,
                from_date,
                to_date
            };

            const requests = await transportService.getAllRequests(
                req.user.id,
                options
            );

            logger.info('Ground staff retrieved transport requests', {
                staffId: req.user.id,
                count: requests.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: requests.data,
                pagination: requests.pagination,
                summary: requests.summary
            });
        } catch (error) {
            logger.error('Error getting all transport requests', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending transport requests
     * GET /api/v1/staff/transport/pending
     */
    async getPendingRequests(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const requests = await transportService.getRequestsByStatus(
                req.user.id,
                'pending',
                options
            );

            logger.info('Ground staff viewed pending transport requests', {
                staffId: req.user.id,
                count: requests.data?.length || 0
            });

            res.json({
                success: true,
                data: requests.data,
                pagination: requests.pagination,
                summary: {
                    total: requests.summary?.total || 0,
                    urgent: requests.data?.filter(r => r.priority === 'urgent').length || 0,
                    high: requests.data?.filter(r => r.priority === 'high').length || 0,
                    patient_transfer: requests.data?.filter(r => r.request_type === 'patient_transfer').length || 0,
                    sample_transport: requests.data?.filter(r => r.request_type === 'sample_transport').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting pending transport requests', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get completed transport requests
     * GET /api/v1/staff/transport/completed
     */
    async getCompletedRequests(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const requests = await transportService.getRequestsByStatus(
                req.user.id,
                'completed',
                options
            );

            logger.info('Ground staff viewed completed transport requests', {
                staffId: req.user.id,
                count: requests.data?.length || 0
            });

            // Calculate average completion time
            const avgCompletionTime = requests.data?.reduce((sum, r) => {
                if (r.completed_at && r.accepted_at) {
                    const minutes = (new Date(r.completed_at) - new Date(r.accepted_at)) / (1000 * 60);
                    return sum + minutes;
                }
                return sum;
            }, 0) / (requests.data?.length || 1);

            res.json({
                success: true,
                data: requests.data,
                pagination: requests.pagination,
                summary: {
                    total: requests.summary?.total || 0,
                    avg_completion_time_minutes: Math.round(avgCompletionTime),
                    on_time: requests.data?.filter(r => {
                        if (r.completed_at && r.scheduled_time) {
                            return new Date(r.completed_at) <= new Date(r.scheduled_time);
                        }
                        return true;
                    }).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting completed transport requests', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get transport request by ID
     * GET /api/v1/staff/transport/:id
     */
    async getRequestById(req, res, next) {
        try {
            const { id } = req.params;

            const request = await transportService.getRequestById(
                req.user.id,
                id
            );

            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Transport request not found'
                });
            }

            logger.info('Ground staff viewed transport request details', {
                staffId: req.user.id,
                requestId: id,
                status: request.status,
                type: request.request_type
            });

            res.json({
                success: true,
                data: request
            });
        } catch (error) {
            if (error.message === 'Transport request not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Transport request not found'
                });
            }
            logger.error('Error getting transport request by ID', {
                error: error.message,
                staffId: req.user.id,
                requestId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // TRANSPORT OPERATIONS
    // ============================================

    /**
     * Accept transport request
     * PUT /api/v1/staff/transport/:id/accept
     * 
     * BUSINESS RULE: [BR-47] Transport requests require driver assignment
     */
    async acceptRequest(req, res, next) {
        try {
            const { id } = req.params;
            const { driver_id, vehicle_number, notes } = req.body;

            const request = await transportService.getRequestById(req.user.id, id);
            
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Transport request not found'
                });
            }

            // [BR-47] Driver assignment required
            if (!driver_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Driver assignment is required for transport request'
                });
            }

            if (request.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot accept request with status: ${request.status}`
                });
            }

            const accepted = await transportService.acceptRequest(
                req.user.id,
                id,
                {
                    driver_id,
                    vehicle_number,
                    notes,
                    accepted_at: new Date(),
                    accepted_by: req.user.id
                }
            );

            logger.info('Ground staff accepted transport request', {
                staffId: req.user.id,
                requestId: id,
                driverId: driver_id,
                vehicleNumber: vehicle_number
            });

            res.json({
                success: true,
                data: accepted,
                message: 'Transport request accepted'
            });
        } catch (error) {
            if (error.message === 'Transport request not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Transport request not found'
                });
            }
            logger.error('Error accepting transport request', {
                error: error.message,
                staffId: req.user.id,
                requestId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Start transport
     * PUT /api/v1/staff/transport/:id/start
     */
    async startTransport(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, start_location } = req.body;

            const request = await transportService.getRequestById(req.user.id, id);
            
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Transport request not found'
                });
            }

            if (request.status !== 'accepted') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot start transport with status: ${request.status}`
                });
            }

            const started = await transportService.startTransport(
                req.user.id,
                id,
                {
                    notes,
                    start_location,
                    started_at: new Date(),
                    started_by: req.user.id
                }
            );

            logger.info('Ground staff started transport', {
                staffId: req.user.id,
                requestId: id,
                startLocation: start_location
            });

            res.json({
                success: true,
                data: started,
                message: 'Transport started'
            });
        } catch (error) {
            if (error.message === 'Transport request not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Transport request not found'
                });
            }
            logger.error('Error starting transport', {
                error: error.message,
                staffId: req.user.id,
                requestId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Complete transport
     * PUT /api/v1/staff/transport/:id/complete
     */
    async completeTransport(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, end_location, delivery_signature } = req.body;

            const request = await transportService.getRequestById(req.user.id, id);
            
            if (!request) {
                return res.status(404).json({
                    success: false,
                    error: 'Transport request not found'
                });
            }

            if (request.status !== 'in_progress') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot complete transport with status: ${request.status}`
                });
            }

            const completed = await transportService.completeTransport(
                req.user.id,
                id,
                {
                    notes,
                    end_location,
                    delivery_signature,
                    completed_at: new Date(),
                    completed_by: req.user.id
                }
            );

            // Calculate completion time
            const startedAt = new Date(request.started_at);
            const completedAt = new Date(completed.completed_at);
            const durationMinutes = (completedAt - startedAt) / (1000 * 60);

            logger.info('Ground staff completed transport', {
                staffId: req.user.id,
                requestId: id,
                durationMinutes: Math.floor(durationMinutes)
            });

            res.json({
                success: true,
                data: completed,
                message: 'Transport completed',
                duration_minutes: Math.floor(durationMinutes)
            });
        } catch (error) {
            if (error.message === 'Transport request not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Transport request not found'
                });
            }
            logger.error('Error completing transport', {
                error: error.message,
                staffId: req.user.id,
                requestId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get transport history
     * GET /api/v1/staff/transport/history
     */
    async getTransportHistory(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                from_date, 
                to_date,
                driver_id,
                request_type
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date,
                driver_id,
                request_type
            };

            const history = await transportService.getTransportHistory(
                req.user.id,
                options
            );

            logger.info('Ground staff viewed transport history', {
                staffId: req.user.id,
                count: history.data?.length || 0
            });

            res.json({
                success: true,
                data: history.data,
                pagination: history.pagination,
                summary: history.summary
            });
        } catch (error) {
            logger.error('Error getting transport history', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = transportController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Request Lists          | 3         | All, pending, completed, by ID
 * Transport Operations   | 3         | Accept, start, complete
 * History                | 1         | Transport history
 * -----------------------|-----------|----------------------
 * TOTAL                  | 7         | Complete transport management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-47] Driver assignment validation
 * 
 * ======================================================================
 */