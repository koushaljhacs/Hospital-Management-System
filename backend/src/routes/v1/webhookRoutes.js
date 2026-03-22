// backend/src/routes/v1/webhookRoutes.js
/**
 * ======================================================================
 * FILE: backend/src/routes/v1/webhookRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Webhook Management module routes - Handles incoming webhooks and endpoint management.
 * Total Endpoints: 19
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with all webhook endpoints
 * 
 * BUSINESS RULES:
 * - [BR-WEB-01] Webhook payload must be verified with signature
 * - [BR-WEB-02] Failed deliveries retry with exponential backoff
 * - [BR-WEB-03] Webhook endpoints require verification
 * - [BR-WEB-04] All webhook events are logged
 * - [BR-WEB-05] Rate limits apply to webhook endpoints
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();

// ============================================
// IMPORT MIDDLEWARES
// ============================================
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/rbac');
const { standard, sensitive } = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');

// ============================================
// IMPORT CONTROLLERS
// ============================================
const webhookController = require('../../controllers/webhook/webhookController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateWebhookEndpoint,
    validateWebhookEndpointId,
    validateWebhookDelivery,
    validateWebhookRetry,
    validateWebhookEvent,
    validatePagination,
    validateDateRange
} = require('../../validators/webhookValidators');

// ============================================
// PUBLIC WEBHOOK RECEIVERS (No Auth - External Services)
// ============================================

/**
 * Razorpay payment webhook
 * POST /api/v1/webhooks/payment/razorpay
 * No authentication - signature verification only
 */
router.post('/webhooks/payment/razorpay',
    standard,
    webhookController.handleRazorpayWebhook
);

/**
 * Stripe payment webhook
 * POST /api/v1/webhooks/payment/stripe
 */
router.post('/webhooks/payment/stripe',
    standard,
    webhookController.handleStripeWebhook
);

/**
 * PhonePe payment webhook
 * POST /api/v1/webhooks/payment/phonepe
 */
router.post('/webhooks/payment/phonepe',
    standard,
    webhookController.handlePhonePeWebhook
);

/**
 * Paytm payment webhook
 * POST /api/v1/webhooks/payment/paytm
 */
router.post('/webhooks/payment/paytm',
    standard,
    webhookController.handlePaytmWebhook
);

/**
 * SMS delivery status webhook
 * POST /api/v1/webhooks/sms/delivery
 */
router.post('/webhooks/sms/delivery',
    standard,
    webhookController.handleSmsDeliveryWebhook
);

/**
 * Email bounce webhook
 * POST /api/v1/webhooks/email/bounce
 */
router.post('/webhooks/email/bounce',
    standard,
    webhookController.handleEmailBounceWebhook
);

/**
 * Email open webhook
 * POST /api/v1/webhooks/email/open
 */
router.post('/webhooks/email/open',
    standard,
    webhookController.handleEmailOpenWebhook
);

// ============================================
// PUBLIC ROOT ENDPOINT
// ============================================

/**
 * Public root endpoint for Webhook Management module
 * GET /api/v1/webhooks
 */
router.get('/webhooks', (req, res) => {
    res.json({
        success: true,
        module: 'Webhook Management API',
        version: '1.0.0',
        status: 'operational',
        documentation: '/api/v1/webhooks/health',
        authentication: 'Admin access required for management endpoints',
        public_endpoints: {
            payment: '/api/v1/webhooks/payment/{razorpay|stripe|phonepe|paytm}',
            sms: '/api/v1/webhooks/sms/delivery',
            email: '/api/v1/webhooks/email/{bounce|open}'
        },
        timestamp: new Date().toISOString()
    });
});

// ============================================
// WEBHOOK ENDPOINT MANAGEMENT (Admin Only)
// ============================================

/**
 * List all webhook endpoints
 * GET /api/v1/webhooks/endpoints
 */
router.get('/webhooks/endpoints',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    auditLogger('WEBHOOK_ENDPOINTS_LIST'),
    webhookController.listEndpoints
);

/**
 * Get webhook endpoint by ID
 * GET /api/v1/webhooks/endpoints/:id
 */
router.get('/webhooks/endpoints/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateWebhookEndpointId,
    auditLogger('WEBHOOK_ENDPOINT_VIEW'),
    webhookController.getEndpointById
);

/**
 * Create webhook endpoint
 * POST /api/v1/webhooks/endpoints
 * 
 * BUSINESS RULE: [BR-WEB-03] Webhook endpoints require verification
 */
router.post('/webhooks/endpoints',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateWebhookEndpoint,
    auditLogger('WEBHOOK_ENDPOINT_CREATE'),
    webhookController.createEndpoint
);

/**
 * Update webhook endpoint
 * PUT /api/v1/webhooks/endpoints/:id
 */
router.put('/webhooks/endpoints/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateWebhookEndpoint,
    auditLogger('WEBHOOK_ENDPOINT_UPDATE'),
    webhookController.updateEndpoint
);

/**
 * Delete webhook endpoint
 * DELETE /api/v1/webhooks/endpoints/:id
 */
router.delete('/webhooks/endpoints/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateWebhookEndpointId,
    auditLogger('WEBHOOK_ENDPOINT_DELETE'),
    webhookController.deleteEndpoint
);

/**
 * Test webhook endpoint
 * POST /api/v1/webhooks/endpoints/:id/test
 */
router.post('/webhooks/endpoints/:id/test',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateWebhookEndpointId,
    auditLogger('WEBHOOK_ENDPOINT_TEST'),
    webhookController.testEndpoint
);

// ============================================
// WEBHOOK DELIVERY MANAGEMENT
// ============================================

/**
 * List webhook deliveries
 * GET /api/v1/webhooks/deliveries
 */
router.get('/webhooks/deliveries',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('WEBHOOK_DELIVERIES_LIST'),
    webhookController.listDeliveries
);

/**
 * Get webhook delivery by ID
 * GET /api/v1/webhooks/deliveries/:id
 */
router.get('/webhooks/deliveries/:id',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validateWebhookDelivery,
    auditLogger('WEBHOOK_DELIVERY_VIEW'),
    webhookController.getDeliveryById
);

/**
 * Retry failed webhook delivery
 * POST /api/v1/webhooks/deliveries/:id/retry
 * 
 * BUSINESS RULE: [BR-WEB-02] Failed deliveries retry with exponential backoff
 */
router.post('/webhooks/deliveries/:id/retry',
    authenticate,
    authorize('super_admin', 'it_admin'),
    sensitive,
    validateWebhookRetry,
    auditLogger('WEBHOOK_DELIVERY_RETRY'),
    webhookController.retryDelivery
);

// ============================================
// WEBHOOK LOGS & STATISTICS
// ============================================

/**
 * Get webhook logs
 * GET /api/v1/webhooks/logs
 */
router.get('/webhooks/logs',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('WEBHOOK_LOGS_VIEW'),
    webhookController.getWebhookLogs
);

/**
 * Get webhook statistics
 * GET /api/v1/webhooks/statistics
 */
router.get('/webhooks/statistics',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    auditLogger('WEBHOOK_STATS_VIEW'),
    webhookController.getWebhookStats
);

/**
 * Get available webhook events
 * GET /api/v1/webhooks/events
 */
router.get('/webhooks/events',
    authenticate,
    authorize('super_admin', 'it_admin'),
    standard,
    auditLogger('WEBHOOK_EVENTS_VIEW'),
    webhookController.getAvailableEvents
);

// ============================================
// PROTECTED HEALTH CHECK
// ============================================

/**
 * Health check for Webhook module
 * GET /api/v1/webhooks/health
 */
router.get('/webhooks/health',
    authenticate,
    authorize('super_admin', 'it_admin'),
    (req, res) => {
        res.json({
            success: true,
            module: 'Webhook Management API',
            version: '1.0.0',
            status: 'healthy',
            timestamp: new Date().toISOString(),
            userId: req.user.id,
            endpoints: {
                total: 19,
                public: 7,
                management: 7,
                deliveries: 3,
                logs_stats: 3,
                health: 1
            },
            business_rules: [
                'BR-WEB-01: Payload signature verification',
                'BR-WEB-02: Exponential backoff retry',
                'BR-WEB-03: Endpoint verification',
                'BR-WEB-04: Full audit logging',
                'BR-WEB-05: Rate limit enforcement'
            ]
        });
    }
);

module.exports = router;

/**
 * ======================================================================
 * ROUTE SUMMARY:
 * ======================================================================
 * 
 * Category           | Endpoints | Business Rules | Authentication
 * -------------------|-----------|----------------|----------------
 * Public Webhooks    | 7         | [BR-WEB-01]    | 🔓 Public (Signature)
 * Root               | 1         | Base URL info  | 🔓 Public
 * Endpoint Mgmt      | 6         | [BR-WEB-03]    | 🔒 Admin Only
 * Delivery Mgmt      | 3         | [BR-WEB-02]    | 🔒 Admin Only
 * Logs & Stats       | 3         | [BR-WEB-04]    | 🔒 Admin Only
 * Health             | 1         | Status & info  | 🔒 Admin Only
 * -------------------|-----------|----------------|----------------
 * TOTAL              | 21        | Complete Webhook Management
 * 
 * PAYMENT GATEWAYS SUPPORTED:
 * - Razorpay (India)
 * - Stripe (International)
 * - PhonePe (India)
 * - Paytm (India)
 * 
 * COMMUNICATION WEBHOOKS:
 * - SMS Delivery Status
 * - Email Bounce
 * - Email Open Tracking
 * 
 * AVAILABLE EVENTS:
 * - patient.created, patient.updated
 * - appointment.created, appointment.cancelled
 * - invoice.paid, invoice.overdue
 * - prescription.created
 * - lab.result.ready
 * - bed.allocated, bed.vacated
 * - inventory.low_stock
 * 
 * ======================================================================
 */