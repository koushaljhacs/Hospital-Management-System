// backend/src/validators/webhookValidators.js
/**
 * ======================================================================
 * FILE: backend/src/validators/webhookValidators.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Webhook Management module request validators.
 * Total Validators: 8 main validators with 30+ validation rules
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-WEB-01] Webhook payload must be verified with signature
 * - [BR-WEB-02] Failed deliveries retry with exponential backoff
 * - [BR-WEB-03] Webhook endpoints require verification
 * - [BR-WEB-04] All webhook events are logged
 * - [BR-WEB-05] Rate limits apply to webhook endpoints
 * 
 * ======================================================================
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Validate request and return formatted errors
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

/**
 * Custom validators for webhook module
 */
const customValidators = {
    // Valid webhook status
    isValidWebhookStatus: (status) => {
        const validStatuses = ['active', 'inactive', 'paused', 'failed', 'deleted'];
        return validStatuses.includes(status);
    },

    // Valid webhook delivery status
    isValidDeliveryStatus: (status) => {
        const validStatuses = ['pending', 'delivered', 'failed', 'retrying', 'expired'];
        return validStatuses.includes(status);
    },

    // Valid webhook format
    isValidWebhookFormat: (format) => {
        const validFormats = ['json', 'xml', 'form'];
        return validFormats.includes(format);
    },

    // Valid webhook event type
    isValidWebhookEvent: (event) => {
        const validEvents = [
            'patient.created', 'patient.updated', 'patient.deleted', 'patient.merged',
            'appointment.created', 'appointment.updated', 'appointment.cancelled',
            'appointment.rescheduled', 'appointment.completed', 'appointment.no_show',
            'appointment.checked_in', 'appointment.checked_out',
            'prescription.created', 'prescription.updated', 'prescription.dispensed',
            'lab.order.created', 'lab.order.updated', 'lab.result.ready', 'lab.result.critical',
            'radiology.order.created', 'radiology.result.ready',
            'diagnosis.added', 'diagnosis.updated',
            'invoice.created', 'invoice.updated', 'invoice.paid', 'invoice.overdue',
            'invoice.cancelled', 'payment.received', 'payment.failed', 'refund.processed',
            'insurance.claim.submitted', 'insurance.claim.approved', 'insurance.claim.rejected',
            'inventory.low_stock', 'inventory.out_of_stock', 'inventory.expiring',
            'inventory.expired', 'inventory.received',
            'purchase_order.created', 'purchase_order.approved', 'purchase_order.received',
            'bed.allocated', 'bed.vacated', 'bed.cleaned', 'bed.maintenance.required',
            'user.created', 'user.updated', 'user.deleted', 'user.login', 'user.logout',
            'user.password_changed', 'user.locked', 'user.unlocked',
            'security.alert', 'security.breach.detected', 'security.rate_limit.exceeded',
            'security.api_key.revoked', 'security.mfa.enabled', 'security.mfa.disabled',
            'system.backup.completed', 'system.backup.failed',
            'system.maintenance.started', 'system.maintenance.completed',
            'system.error', 'system.warning'
        ];
        return validEvents.includes(event);
    },

    // Valid retry reason
    isValidRetryReason: (reason) => {
        const validReasons = ['timeout', 'network_error', 'server_error', 'manual', 'rate_limited'];
        return validReasons.includes(reason);
    },

    // Valid URL format with protocol
    isValidWebhookUrl: (url) => {
        const urlRegex = /^(https?:\/\/)([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        return urlRegex.test(url);
    },

    // Valid retry delay (seconds)
    isValidRetryDelay: (delay) => {
        return Number.isInteger(delay) && delay >= 30 && delay <= 3600;
    },

    // Valid retry count
    isValidRetryCount: (count) => {
        return Number.isInteger(count) && count >= 1 && count <= 10;
    },

    // Valid timeout (seconds)
    isValidTimeout: (timeout) => {
        return Number.isInteger(timeout) && timeout >= 5 && timeout <= 30;
    },

    // Valid rate limit
    isValidRateLimit: (limit) => {
        return Number.isInteger(limit) && limit >= 10 && limit <= 10000;
    },

    // Valid payment gateway
    isValidPaymentGateway: (gateway) => {
        const validGateways = ['razorpay', 'stripe', 'phonepe', 'paytm'];
        return validGateways.includes(gateway);
    }
};

// ============================================
// WEBHOOK ENDPOINT VALIDATORS
// ============================================

const validateWebhookEndpointId = [
    param('id')
        .isUUID().withMessage('Invalid webhook endpoint ID format')
        .notEmpty().withMessage('Endpoint ID is required'),
    validate
];

const validateWebhookEndpoint = [
    body('endpoint_name')
        .notEmpty().withMessage('Endpoint name is required')
        .isString().withMessage('Endpoint name must be string')
        .isLength({ min: 3, max: 200 }).withMessage('Endpoint name must be between 3-200 characters')
        .trim()
        .escape(),

    body('endpoint_description')
        .optional()
        .isString().withMessage('Description must be string')
        .isLength({ max: 500 }).withMessage('Description too long')
        .trim()
        .escape(),

    body('endpoint_url')
        .notEmpty().withMessage('Endpoint URL is required')
        .custom(customValidators.isValidWebhookUrl).withMessage('Invalid URL format'),
    
    body('endpoint_format')
        .optional()
        .custom(customValidators.isValidWebhookFormat).withMessage('Invalid format'),

    body('subscribed_events')
        .optional()
        .isArray().withMessage('Events must be array')
        .custom((events) => {
            if (!events) return true;
            return events.every(e => customValidators.isValidWebhookEvent(e));
        }).withMessage('Invalid event type'),

    body('api_key_id')
        .optional()
        .isUUID().withMessage('Invalid API key ID format'),

    body('custom_headers')
        .optional()
        .isObject().withMessage('Headers must be object'),

    body('secret_key')
        .optional()
        .isString().withMessage('Secret key must be string')
        .isLength({ min: 16, max: 255 }).withMessage('Secret key must be 16-255 characters'),

    body('rate_limit')
        .optional()
        .custom(customValidators.isValidRateLimit).withMessage('Rate limit must be between 10-10000'),

    body('rate_limit_window')
        .optional()
        .isInt({ min: 60, max: 3600 }).withMessage('Rate limit window must be 60-3600 seconds'),

    body('retry_count')
        .optional()
        .custom(customValidators.isValidRetryCount).withMessage('Retry count must be 1-10'),

    body('retry_delay_seconds')
        .optional()
        .custom(customValidators.isValidRetryDelay).withMessage('Retry delay must be 30-3600 seconds'),

    body('retry_backoff_factor')
        .optional()
        .isFloat({ min: 1.0, max: 3.0 }).withMessage('Backoff factor must be 1.0-3.0'),

    body('timeout_seconds')
        .optional()
        .custom(customValidators.isValidTimeout).withMessage('Timeout must be 5-30 seconds'),

    body('status')
        .optional()
        .custom(customValidators.isValidWebhookStatus).withMessage('Invalid status'),

    validate
];

// ============================================
// WEBHOOK DELIVERY VALIDATORS
// ============================================

const validateWebhookDelivery = [
    param('id')
        .isUUID().withMessage('Invalid delivery ID format'),
    validate
];

const validateWebhookRetry = [
    param('id')
        .isUUID().withMessage('Invalid delivery ID format'),

    body('reason')
        .optional()
        .custom(customValidators.isValidRetryReason).withMessage('Invalid retry reason'),

    body('force')
        .optional()
        .isBoolean().withMessage('Force must be boolean'),

    validate
];

// ============================================
// WEBHOOK EVENT VALIDATOR
// ============================================

const validateWebhookEvent = [
    body('event_type')
        .notEmpty().withMessage('Event type is required')
        .custom(customValidators.isValidWebhookEvent).withMessage('Invalid event type'),

    body('payload')
        .notEmpty().withMessage('Payload is required')
        .isObject().withMessage('Payload must be object'),

    body('source_type')
        .optional()
        .isString().withMessage('Source type must be string')
        .isIn(['system', 'user', 'api', 'integration']).withMessage('Invalid source type'),

    body('priority')
        .optional()
        .isInt({ min: 0, max: 10 }).withMessage('Priority must be 0-10'),

    validate
];

// ============================================
// PAGINATION VALIDATOR
// ============================================

const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be positive integer')
        .toInt(),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100')
        .toInt(),

    query('sort_by')
        .optional()
        .isIn(['created_at', 'updated_at', 'status', 'delivered_at', 'response_time_ms'])
        .withMessage('Invalid sort field'),

    query('sort_order')
        .optional()
        .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),

    query('status')
        .optional()
        .custom(customValidators.isValidDeliveryStatus).withMessage('Invalid status'),

    query('endpoint_id')
        .optional()
        .isUUID().withMessage('Invalid endpoint ID'),

    validate
];

// ============================================
// DATE RANGE VALIDATOR
// ============================================

const validateDateRange = [
    query('from_date')
        .optional()
        .isISO8601().withMessage('Invalid from date format'),

    query('to_date')
        .optional()
        .isISO8601().withMessage('Invalid to date format')
        .custom((to, { req }) => {
            if (req.query.from_date && new Date(to) < new Date(req.query.from_date)) {
                throw new Error('To date must be after from date');
            }
            return true;
        }),

    validate
];

// ============================================
// PAYMENT WEBHOOK VALIDATORS
// ============================================

const validateRazorpayWebhook = [
    body('payload')
        .notEmpty().withMessage('Payload is required'),
    
    body('event')
        .notEmpty().withMessage('Event is required'),
    
    validate
];

const validateStripeWebhook = [
    body('id')
        .notEmpty().withMessage('Webhook ID is required'),
    
    body('type')
        .notEmpty().withMessage('Event type is required'),
    
    validate
];

// ============================================
// EXPORT ALL VALIDATORS
// ============================================

module.exports = {
    // Endpoint validators
    validateWebhookEndpointId,
    validateWebhookEndpoint,
    
    // Delivery validators
    validateWebhookDelivery,
    validateWebhookRetry,
    
    // Event validator
    validateWebhookEvent,
    
    // Filter validators
    validatePagination,
    validateDateRange,
    
    // Payment webhook validators
    validateRazorpayWebhook,
    validateStripeWebhook,
    
    // Middleware
    validate,
    
    // Export custom validators for reuse
    customValidators
};

/**
 * ======================================================================
 * VALIDATORS SUMMARY:
 * ======================================================================
 * 
 * Validator              | Used For                | Rules
 * -----------------------|-------------------------|----------------------
 * validateWebhookEndpoint| Create/Update endpoint | name, url, events, retry
 * validateWebhookEndpointId| Get/Delete endpoint   | UUID validation
 * validateWebhookDelivery| Get delivery by ID      | UUID validation
 * validateWebhookRetry   | Retry delivery          | reason, force
 * validateWebhookEvent   | Queue event             | event type, payload
 * validatePagination     | List endpoints          | page, limit, sort
 * validateDateRange      | Logs & stats            | from_date, to_date
 * validateRazorpayWebhook| Razorpay webhook        | payload, event
 * validateStripeWebhook  | Stripe webhook          | id, type
 * -----------------------|-------------------------|----------------------
 * TOTAL: 9 Validators with 35+ validation rules
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-WEB-01] Signature verification (service layer)
 * - [BR-WEB-02] Retry configuration validation
 * - [BR-WEB-03] Endpoint URL format
 * - [BR-WEB-04] All events validated
 * - [BR-WEB-05] Rate limit values validated
 * 
 * ======================================================================
 */