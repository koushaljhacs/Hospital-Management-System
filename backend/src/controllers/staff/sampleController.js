/**
 * ======================================================================
 * FILE: backend/src/controllers/staff/sampleController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Ground Staff sample controller - Handles sample collection and delivery.
 * Total Endpoints: 7
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-48] Samples must be delivered within 2 hours of collection
 * 
 * ======================================================================
 */

const sampleService = require('../../services/staff/sampleService');
const logger = require('../../utils/logger');

const sampleController = {
    // ============================================
    // SAMPLE LISTS
    // ============================================

    /**
     * Get all samples
     * GET /api/v1/staff/samples
     */
    async getAllSamples(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                sample_type,
                priority,
                patient_id,
                from_date,
                to_date
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                sample_type,
                priority,
                patient_id,
                from_date,
                to_date
            };

            const samples = await sampleService.getAllSamples(
                req.user.id,
                options
            );

            logger.info('Ground staff retrieved samples', {
                staffId: req.user.id,
                count: samples.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: samples.data,
                pagination: samples.pagination,
                summary: samples.summary
            });
        } catch (error) {
            logger.error('Error getting all samples', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get pending samples (awaiting collection)
     * GET /api/v1/staff/samples/pending
     */
    async getPendingSamples(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const samples = await sampleService.getSamplesByStatus(
                req.user.id,
                'pending',
                options
            );

            logger.info('Ground staff viewed pending samples', {
                staffId: req.user.id,
                count: samples.data?.length || 0
            });

            // Check for samples pending beyond expected time
            const overdueSamples = samples.data?.filter(s => {
                if (s.created_at) {
                    const created = new Date(s.created_at);
                    const hoursSince = (Date.now() - created) / (1000 * 60 * 60);
                    return hoursSince > 2;
                }
                return false;
            }).length || 0;

            res.json({
                success: true,
                data: samples.data,
                pagination: samples.pagination,
                summary: {
                    total: samples.summary?.total || 0,
                    overdue: overdueSamples,
                    urgent: samples.data?.filter(s => s.priority === 'urgent').length || 0,
                    high: samples.data?.filter(s => s.priority === 'high').length || 0,
                    by_type: {
                        blood: samples.data?.filter(s => s.sample_type === 'blood').length || 0,
                        urine: samples.data?.filter(s => s.sample_type === 'urine').length || 0,
                        tissue: samples.data?.filter(s => s.sample_type === 'tissue').length || 0,
                        other: samples.data?.filter(s => !['blood', 'urine', 'tissue'].includes(s.sample_type)).length || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting pending samples', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get collected samples
     * GET /api/v1/staff/samples/collected
     */
    async getCollectedSamples(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const samples = await sampleService.getSamplesByStatus(
                req.user.id,
                'collected',
                options
            );

            logger.info('Ground staff viewed collected samples', {
                staffId: req.user.id,
                count: samples.data?.length || 0
            });

            // [BR-48] Check samples that need urgent delivery (collected > 1 hour)
            const urgentDelivery = samples.data?.filter(s => {
                if (s.collected_at) {
                    const collected = new Date(s.collected_at);
                    const hoursSince = (Date.now() - collected) / (1000 * 60 * 60);
                    return hoursSince > 1;
                }
                return false;
            }).length || 0;

            res.json({
                success: true,
                data: samples.data,
                pagination: samples.pagination,
                summary: {
                    total: samples.summary?.total || 0,
                    urgent_delivery: urgentDelivery,
                    in_transit: samples.data?.filter(s => s.status === 'in_transit').length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting collected samples', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get delivered samples
     * GET /api/v1/staff/samples/delivered
     */
    async getDeliveredSamples(req, res, next) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const samples = await sampleService.getSamplesByStatus(
                req.user.id,
                'delivered',
                options
            );

            logger.info('Ground staff viewed delivered samples', {
                staffId: req.user.id,
                count: samples.data?.length || 0
            });

            // Calculate average delivery time [BR-48]
            const avgDeliveryTime = samples.data?.reduce((sum, s) => {
                if (s.delivered_at && s.collected_at) {
                    const minutes = (new Date(s.delivered_at) - new Date(s.collected_at)) / (1000 * 60);
                    return sum + minutes;
                }
                return sum;
            }, 0) / (samples.data?.length || 1);

            // Count samples delivered within 2 hours [BR-48]
            const onTimeDelivery = samples.data?.filter(s => {
                if (s.delivered_at && s.collected_at) {
                    const minutes = (new Date(s.delivered_at) - new Date(s.collected_at)) / (1000 * 60);
                    return minutes <= 120;
                }
                return false;
            }).length || 0;

            res.json({
                success: true,
                data: samples.data,
                pagination: samples.pagination,
                summary: {
                    total: samples.summary?.total || 0,
                    avg_delivery_time_minutes: Math.round(avgDeliveryTime),
                    on_time_delivery: onTimeDelivery,
                    on_time_rate: samples.data?.length > 0 
                        ? ((onTimeDelivery / samples.data.length) * 100).toFixed(1) 
                        : 0
                }
            });
        } catch (error) {
            logger.error('Error getting delivered samples', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get sample by ID
     * GET /api/v1/staff/samples/:id
     */
    async getSampleById(req, res, next) {
        try {
            const { id } = req.params;

            const sample = await sampleService.getSampleById(
                req.user.id,
                id
            );

            if (!sample) {
                return res.status(404).json({
                    success: false,
                    error: 'Sample not found'
                });
            }

            logger.info('Ground staff viewed sample details', {
                staffId: req.user.id,
                sampleId: id,
                status: sample.status,
                type: sample.sample_type
            });

            // [BR-48] Check if sample is within delivery window
            if (sample.status === 'collected' && sample.collected_at) {
                const collected = new Date(sample.collected_at);
                const hoursSince = (Date.now() - collected) / (1000 * 60 * 60);
                sample.hours_since_collection = hoursSince.toFixed(1);
                sample.requires_urgent_delivery = hoursSince > 1;
                sample.overdue_for_delivery = hoursSince > 2;
            }

            res.json({
                success: true,
                data: sample
            });
        } catch (error) {
            if (error.message === 'Sample not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Sample not found'
                });
            }
            logger.error('Error getting sample by ID', {
                error: error.message,
                staffId: req.user.id,
                sampleId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // SAMPLE OPERATIONS
    // ============================================

    /**
     * Collect sample
     * PUT /api/v1/staff/samples/:id/collect
     */
    async collectSample(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, collection_location } = req.body;

            const sample = await sampleService.getSampleById(req.user.id, id);
            
            if (!sample) {
                return res.status(404).json({
                    success: false,
                    error: 'Sample not found'
                });
            }

            if (sample.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot collect sample with status: ${sample.status}`
                });
            }

            const collected = await sampleService.collectSample(
                req.user.id,
                id,
                {
                    notes,
                    collection_location,
                    collected_at: new Date(),
                    collected_by: req.user.id
                }
            );

            logger.info('Ground staff collected sample', {
                staffId: req.user.id,
                sampleId: id,
                patientId: sample.patient_id,
                sampleType: sample.sample_type
            });

            res.json({
                success: true,
                data: collected,
                message: 'Sample collected successfully'
            });
        } catch (error) {
            if (error.message === 'Sample not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Sample not found'
                });
            }
            logger.error('Error collecting sample', {
                error: error.message,
                staffId: req.user.id,
                sampleId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Deliver sample
     * PUT /api/v1/staff/samples/:id/deliver
     * 
     * BUSINESS RULE: [BR-48] Samples must be delivered within 2 hours of collection
     */
    async deliverSample(req, res, next) {
        try {
            const { id } = req.params;
            const { notes, delivery_location, received_by } = req.body;

            const sample = await sampleService.getSampleById(req.user.id, id);
            
            if (!sample) {
                return res.status(404).json({
                    success: false,
                    error: 'Sample not found'
                });
            }

            if (sample.status !== 'collected' && sample.status !== 'in_transit') {
                return res.status(400).json({
                    success: false,
                    error: `Cannot deliver sample with status: ${sample.status}`
                });
            }

            // [BR-48] Check delivery time
            if (sample.collected_at) {
                const collected = new Date(sample.collected_at);
                const hoursSince = (Date.now() - collected) / (1000 * 60 * 60);
                
                if (hoursSince > 2) {
                    logger.warn('Sample delivered after 2-hour window', {
                        sampleId: id,
                        hoursSince: hoursSince.toFixed(1)
                    });
                }
            }

            const delivered = await sampleService.deliverSample(
                req.user.id,
                id,
                {
                    notes,
                    delivery_location,
                    received_by,
                    delivered_at: new Date(),
                    delivered_by: req.user.id
                }
            );

            // Calculate delivery time
            let deliveryMinutes = null;
            if (sample.collected_at && delivered.delivered_at) {
                deliveryMinutes = (new Date(delivered.delivered_at) - new Date(sample.collected_at)) / (1000 * 60);
            }

            const isOnTime = deliveryMinutes !== null && deliveryMinutes <= 120;

            logger.info('Ground staff delivered sample', {
                staffId: req.user.id,
                sampleId: id,
                patientId: sample.patient_id,
                deliveryMinutes: deliveryMinutes ? Math.floor(deliveryMinutes) : null,
                onTime: isOnTime
            });

            res.json({
                success: true,
                data: delivered,
                message: 'Sample delivered successfully',
                delivery_time_minutes: deliveryMinutes ? Math.floor(deliveryMinutes) : null,
                delivered_on_time: isOnTime
            });
        } catch (error) {
            if (error.message === 'Sample not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Sample not found'
                });
            }
            logger.error('Error delivering sample', {
                error: error.message,
                staffId: req.user.id,
                sampleId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = sampleController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Sample Lists           | 4         | All, pending, collected, delivered, by ID
 * Sample Operations      | 2         | Collect, deliver
 * -----------------------|-----------|----------------------
 * TOTAL                  | 6         | Complete sample management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-48] 2-hour delivery window monitoring
 * 
 * ======================================================================
 */