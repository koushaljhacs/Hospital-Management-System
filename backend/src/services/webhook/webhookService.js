// backend/src/services/webhook/webhookService.js
/**
 * ======================================================================
 * FILE: backend/src/services/webhook/webhookService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Webhook Management service - Handles business logic for webhook operations.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-WEB-01] Webhook payload must be verified with signature
 * - [BR-WEB-02] Failed deliveries retry with exponential backoff
 * - [BR-WEB-03] Webhook endpoints require verification
 * - [BR-WEB-04] All webhook events are logged
 * - [BR-WEB-05] Rate limits apply to webhook endpoints
 * 
 * DATABASE TABLES:
 * - webhook_endpoints
 * - webhook_events_queue
 * - webhook_deliveries
 * - webhook_logs
 * - webhook_stats
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

const webhookService = {
    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    /**
     * Generate webhook endpoint number
     */
    async generateEndpointNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM webhook_endpoints
                WHERE endpoint_number LIKE $1
            `, [`WH-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `WH-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error generating endpoint number', { error: error.message });
            throw error;
        }
    },

    /**
     * Generate delivery number
     */
    async generateDeliveryNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM webhook_deliveries
                WHERE delivery_number LIKE $1
            `, [`DLV-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `DLV-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error generating delivery number', { error: error.message });
            throw error;
        }
    },

    /**
     * Generate webhook signature
     */
    generateSignature(payload, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
    },

    /**
     * Verify webhook signature
     */
    verifySignature(payload, signature, secret) {
        const expectedSignature = this.generateSignature(payload, secret);
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    },

    /**
     * Calculate exponential backoff delay
     */
    calculateBackoffDelay(attempt, baseDelay, backoffFactor) {
        return baseDelay * Math.pow(backoffFactor, attempt - 1);
    },

    /**
     * Format webhook payload
     */
    formatPayload(eventType, payload, format = 'json') {
        const basePayload = {
            id: crypto.randomUUID(),
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
        };

        if (format === 'json') {
            return JSON.stringify(basePayload);
        } else if (format === 'xml') {
            // Simple XML conversion
            return `<?xml version="1.0" encoding="UTF-8"?>
<webhook>
    <id>${basePayload.id}</id>
    <event>${basePayload.event}</event>
    <timestamp>${basePayload.timestamp}</timestamp>
    <data>${JSON.stringify(basePayload.data)}</data>
</webhook>`;
        }
        return JSON.stringify(basePayload);
    },

    // ============================================
    // WEBHOOK ENDPOINT MANAGEMENT
    // ============================================

    /**
     * List webhook endpoints
     */
    async listEndpoints(userId, options = {}) {
        try {
            const { page = 1, limit = 20, sort_by = 'created_at', sort_order = 'desc', status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    we.id,
                    we.endpoint_number,
                    we.endpoint_name,
                    we.endpoint_description,
                    we.endpoint_url,
                    we.endpoint_format,
                    we.subscribed_events,
                    we.rate_limit,
                    we.rate_limit_window,
                    we.retry_count,
                    we.retry_delay_seconds,
                    we.retry_backoff_factor,
                    we.timeout_seconds,
                    we.status,
                    we.failure_count,
                    we.last_failure_at,
                    we.is_verified,
                    we.verified_at,
                    we.created_at,
                    we.updated_at,
                    COUNT(wd.id) as total_deliveries,
                    COUNT(wd.id) FILTER (WHERE wd.status = 'delivered') as successful_deliveries
                FROM webhook_endpoints we
                LEFT JOIN webhook_deliveries wd ON we.id = wd.endpoint_id
                WHERE we.user_id = $1 AND we.is_deleted = false
            `;

            const values = [userId];
            let paramIndex = 2;

            if (status) {
                query += ` AND we.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` GROUP BY we.id ORDER BY we.${sort_by} ${sort_order === 'desc' ? 'DESC' : 'ASC'}
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM webhook_endpoints
                WHERE user_id = $1 AND is_deleted = false
                ${status ? 'AND status = $2' : ''}
            `;
            const countValues = [userId];
            if (status) countValues.push(status);
            const countResult = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error listing webhook endpoints', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get endpoint by ID
     */
    async getEndpointById(endpointId, userId = null) {
        try {
            let query = `
                SELECT 
                    we.*,
                    COUNT(wd.id) as total_deliveries,
                    COUNT(wd.id) FILTER (WHERE wd.status = 'delivered') as successful_deliveries,
                    COUNT(wd.id) FILTER (WHERE wd.status = 'failed') as failed_deliveries,
                    AVG(wd.response_time_ms)::INTEGER as avg_response_time
                FROM webhook_endpoints we
                LEFT JOIN webhook_deliveries wd ON we.id = wd.endpoint_id
                WHERE we.id = $1 AND we.is_deleted = false
                GROUP BY we.id
            `;
            const values = [endpointId];

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return null;
            }

            const endpoint = result.rows[0];

            if (userId && endpoint.user_id !== userId) {
                return null;
            }

            // Get recent deliveries
            const deliveriesQuery = `
                SELECT id, delivery_number, status, response_status, response_time_ms, created_at
                FROM webhook_deliveries
                WHERE endpoint_id = $1
                ORDER BY created_at DESC
                LIMIT 10
            `;
            const deliveriesResult = await db.query(deliveriesQuery, [endpointId]);
            endpoint.recent_deliveries = deliveriesResult.rows;

            return endpoint;
        } catch (error) {
            logger.error('Error getting webhook endpoint', { error: error.message, endpointId });
            throw error;
        }
    },

    /**
     * Create webhook endpoint [BR-WEB-03]
     */
    async createEndpoint(userId, endpointData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const endpointNumber = await this.generateEndpointNumber();

            const query = `
                INSERT INTO webhook_endpoints (
                    id, endpoint_number, user_id, endpoint_name, endpoint_description,
                    endpoint_url, endpoint_format, subscribed_events, api_key_id,
                    custom_headers, secret_key, rate_limit, rate_limit_window,
                    retry_count, retry_delay_seconds, retry_backoff_factor,
                    timeout_seconds, status, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14,
                    $15, $16, 'active', NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                endpointNumber,
                userId,
                endpointData.endpoint_name,
                endpointData.endpoint_description || null,
                endpointData.endpoint_url,
                endpointData.endpoint_format || 'json',
                JSON.stringify(endpointData.subscribed_events || []),
                endpointData.api_key_id || null,
                endpointData.custom_headers ? JSON.stringify(endpointData.custom_headers) : null,
                endpointData.secret_key || null,
                endpointData.rate_limit || 100,
                endpointData.rate_limit_window || 60,
                endpointData.retry_count || 3,
                endpointData.retry_delay_seconds || 60,
                endpointData.retry_backoff_factor || 1.5,
                endpointData.timeout_seconds || 10
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Webhook endpoint created', {
                userId,
                endpointId: result.rows[0].id,
                endpointName: endpointData.endpoint_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating webhook endpoint', { error: error.message, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update webhook endpoint
     */
    async updateEndpoint(endpointId, userId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'endpoint_name', 'endpoint_description', 'endpoint_url',
                'endpoint_format', 'subscribed_events', 'api_key_id',
                'custom_headers', 'secret_key', 'rate_limit', 'rate_limit_window',
                'retry_count', 'retry_delay_seconds', 'retry_backoff_factor',
                'timeout_seconds', 'status'
            ];

            const updates = [];
            const values = [];
            let paramIndex = 1;

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    let value = updateData[field];
                    if (['subscribed_events', 'custom_headers'].includes(field)) {
                        value = JSON.stringify(value);
                    }
                    updates.push(`${field} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (updates.length === 0) {
                throw new Error('No fields to update');
            }

            updates.push(`updated_at = NOW()`);
            values.push(endpointId);
            values.push(userId);

            const query = `
                UPDATE webhook_endpoints 
                SET ${updates.join(', ')}
                WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND is_deleted = false
                RETURNING *
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Webhook endpoint not found');
            }

            await db.commitTransaction(client);

            logger.info('Webhook endpoint updated', {
                userId,
                endpointId,
                endpointName: result.rows[0].endpoint_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating webhook endpoint', { error: error.message, endpointId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete webhook endpoint
     */
    async deleteEndpoint(endpointId, userId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE webhook_endpoints 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    status = 'deleted',
                    updated_at = NOW()
                WHERE id = $2 AND user_id = $3 AND is_deleted = false
                RETURNING id, endpoint_name
            `;

            const result = await client.query(query, [userId, endpointId, userId]);

            if (result.rows.length === 0) {
                throw new Error('Webhook endpoint not found');
            }

            await db.commitTransaction(client);

            logger.info('Webhook endpoint deleted', {
                userId,
                endpointId,
                endpointName: result.rows[0].endpoint_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting webhook endpoint', { error: error.message, endpointId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Test webhook endpoint
     */
    async testEndpoint(endpointId, userId) {
        const endpoint = await this.getEndpointById(endpointId, userId);
        if (!endpoint) {
            throw new Error('Webhook endpoint not found');
        }

        const testPayload = {
            test: true,
            message: 'Webhook endpoint test',
            timestamp: new Date().toISOString()
        };

        const payload = this.formatPayload('test.webhook', testPayload, endpoint.endpoint_format);
        const signature = endpoint.secret_key ? this.generateSignature(testPayload, endpoint.secret_key) : null;

        try {
            const startTime = Date.now();
            const response = await axios.post(endpoint.endpoint_url, payload, {
                headers: {
                    'Content-Type': endpoint.endpoint_format === 'json' ? 'application/json' : 'application/xml',
                    ...(signature && { 'X-Webhook-Signature': signature }),
                    ...(endpoint.custom_headers || {})
                },
                timeout: endpoint.timeout_seconds * 1000
            });
            const responseTime = Date.now() - startTime;

            return {
                success: true,
                status: response.status,
                response_time_ms: responseTime,
                response: response.data
            };
        } catch (error) {
            return {
                success: false,
                status: error.response?.status || 500,
                error: error.message,
                response_time_ms: Date.now() - startTime
            };
        }
    },

    // ============================================
    // WEBHOOK DELIVERY MANAGEMENT
    // ============================================

    /**
     * Queue webhook event
     */
    async queueEvent(eventType, payload, sourceType = 'system', sourceId = null, priority = 0) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const eventId = crypto.randomUUID();
            const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

            const query = `
                INSERT INTO webhook_events_queue (
                    id, event_id, event_type, payload, payload_hash,
                    source_type, source_id, priority, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4,
                    $5, $6, $7, NOW()
                ) RETURNING id
            `;

            const values = [
                eventId,
                eventType,
                JSON.stringify(payload),
                payloadHash,
                sourceType,
                sourceId,
                priority
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Webhook event queued', {
                eventId,
                eventType,
                sourceType,
                priority
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error queueing webhook event', { error: error.message, eventType });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Process pending webhook events
     */
    async processPendingEvents() {
        try {
            const eventsQuery = `
                SELECT weq.*, we.endpoint_url, we.endpoint_format, we.secret_key,
                       we.retry_count, we.retry_delay_seconds, we.retry_backoff_factor,
                       we.timeout_seconds, we.custom_headers
                FROM webhook_events_queue weq
                CROSS JOIN webhook_endpoints we
                WHERE weq.scheduled_for <= NOW()
                    AND we.status = 'active'
                    AND we.is_deleted = false
                    AND weq.is_processed = false
                    AND (weq.expires_at IS NULL OR weq.expires_at > NOW())
                ORDER BY weq.priority DESC, weq.created_at ASC
                LIMIT 100
            `;

            const events = await db.query(eventsQuery);

            for (const event of events.rows) {
                await this.processEventForEndpoint(event);
            }

            return events.rows.length;
        } catch (error) {
            logger.error('Error processing pending events', { error: error.message });
            throw error;
        }
    },

    /**
     * Process event for specific endpoint
     */
    async processEventForEndpoint(event) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if endpoint subscribes to this event
            const subscribedEvents = JSON.parse(event.subscribed_events || '[]');
            if (!subscribedEvents.includes(event.event_type)) {
                return;
            }

            const deliveryNumber = await this.generateDeliveryNumber();
            const payload = this.formatPayload(event.event_type, event.payload, event.endpoint_format);
            const signature = event.secret_key ? this.generateSignature(event.payload, event.secret_key) : null;

            const deliveryQuery = `
                INSERT INTO webhook_deliveries (
                    id, delivery_number, endpoint_id, event_id, status,
                    request_url, request_method, request_headers, request_body,
                    request_size_bytes, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, 'pending',
                    $4, 'POST', $5, $6, $7, NOW()
                ) RETURNING id
            `;

            const headers = {
                'Content-Type': event.endpoint_format === 'json' ? 'application/json' : 'application/xml',
                ...(signature && { 'X-Webhook-Signature': signature }),
                ...(event.custom_headers || {})
            };

            const deliveryResult = await client.query(deliveryQuery, [
                deliveryNumber,
                event.endpoint_id,
                event.id,
                event.endpoint_url,
                JSON.stringify(headers),
                payload,
                Buffer.byteLength(payload, 'utf8')
            ]);

            const deliveryId = deliveryResult.rows[0].id;

            // Attempt delivery
            await this.attemptDelivery(client, deliveryId, event);

            await db.commitTransaction(client);
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error processing event for endpoint', { error: error.message, eventId: event.id });
        } finally {
            client.release();
        }
    },

    /**
     * Attempt webhook delivery
     */
    async attemptDelivery(client, deliveryId, event) {
        const startTime = Date.now();
        let response = null;

        try {
            const payload = this.formatPayload(event.event_type, event.payload, event.endpoint_format);
            const signature = event.secret_key ? this.generateSignature(event.payload, event.secret_key) : null;

            const headers = {
                'Content-Type': event.endpoint_format === 'json' ? 'application/json' : 'application/xml',
                ...(signature && { 'X-Webhook-Signature': signature }),
                ...(event.custom_headers || {})
            };

            response = await axios.post(event.endpoint_url, payload, {
                headers,
                timeout: event.timeout_seconds * 1000
            });

            const responseTime = Date.now() - startTime;

            const updateQuery = `
                UPDATE webhook_deliveries 
                SET status = 'delivered',
                    response_status = $1,
                    response_headers = $2,
                    response_body = $3,
                    response_size_bytes = $4,
                    response_time_ms = $5,
                    completed_at = NOW()
                WHERE id = $6
                RETURNING *
            `;

            await client.query(updateQuery, [
                response.status,
                JSON.stringify(response.headers),
                JSON.stringify(response.data),
                Buffer.byteLength(JSON.stringify(response.data), 'utf8'),
                responseTime,
                deliveryId
            ]);

            // Update endpoint stats
            await client.query(`
                UPDATE webhook_endpoints 
                SET failure_count = 0,
                    last_failure_at = NULL,
                    updated_at = NOW()
                WHERE id = $1
            `, [event.endpoint_id]);

            logger.info('Webhook delivered successfully', {
                deliveryId,
                endpointId: event.endpoint_id,
                status: response.status,
                responseTime
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;
            const responseStatus = error.response?.status || 500;
            const responseData = error.response?.data || { error: error.message };

            const attemptCount = await this.getDeliveryAttemptCount(client, deliveryId);

            let status = 'failed';
            let nextRetryAt = null;

            if (attemptCount < event.retry_count) {
                status = 'retrying';
                const delay = this.calculateBackoffDelay(
                    attemptCount + 1,
                    event.retry_delay_seconds,
                    event.retry_backoff_factor
                );
                nextRetryAt = new Date(Date.now() + delay * 1000);
            }

            const updateQuery = `
                UPDATE webhook_deliveries 
                SET status = $1,
                    attempt_count = attempt_count + 1,
                    next_retry_at = $2,
                    response_status = $3,
                    response_headers = $4,
                    response_body = $5,
                    response_size_bytes = $6,
                    response_time_ms = $7,
                    error_message = $8,
                    ${status === 'delivered' ? 'completed_at = NOW()' : ''}
                WHERE id = $9
                RETURNING *
            `;

            await client.query(updateQuery, [
                status,
                nextRetryAt,
                responseStatus,
                JSON.stringify(error.response?.headers || {}),
                JSON.stringify(responseData),
                Buffer.byteLength(JSON.stringify(responseData), 'utf8'),
                responseTime,
                error.message,
                deliveryId
            ]);

            // Update endpoint failure count
            await client.query(`
                UPDATE webhook_endpoints 
                SET failure_count = failure_count + 1,
                    last_failure_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
            `, [event.endpoint_id]);

            logger.warn('Webhook delivery failed', {
                deliveryId,
                endpointId: event.endpoint_id,
                attemptCount: attemptCount + 1,
                error: error.message,
                nextRetryAt
            });
        }
    },

    /**
     * Get delivery attempt count
     */
    async getDeliveryAttemptCount(client, deliveryId) {
        const result = await client.query(`
            SELECT attempt_count FROM webhook_deliveries WHERE id = $1
        `, [deliveryId]);
        return result.rows[0]?.attempt_count || 0;
    },

    /**
     * Retry failed delivery
     */
    async retryDelivery(deliveryId, userId, retryData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const deliveryQuery = `
                SELECT wd.*, we.*
                FROM webhook_deliveries wd
                JOIN webhook_endpoints we ON wd.endpoint_id = we.id
                WHERE wd.id = $1 AND we.user_id = $2
            `;
            const deliveryResult = await client.query(deliveryQuery, [deliveryId, userId]);

            if (deliveryResult.rows.length === 0) {
                throw new Error('Delivery not found');
            }

            const eventQuery = `
                SELECT * FROM webhook_events_queue WHERE id = $1
            `;
            const eventResult = await client.query(eventQuery, [deliveryResult.rows[0].event_id]);

            const delivery = deliveryResult.rows[0];
            const event = eventResult.rows[0];

            const updateQuery = `
                UPDATE webhook_deliveries 
                SET status = 'pending',
                    next_retry_at = NULL,
                    error_message = NULL,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `;
            const result = await client.query(updateQuery, [deliveryId]);

            // Attempt delivery immediately
            await this.attemptDelivery(client, deliveryId, { ...event, ...delivery });

            await db.commitTransaction(client);

            logger.info('Webhook delivery retry triggered', {
                deliveryId,
                userId,
                reason: retryData.reason || 'manual'
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error retrying delivery', { error: error.message, deliveryId, userId });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * List deliveries
     */
    async listDeliveries(userId, options = {}) {
        try {
            const { page = 1, limit = 20, status, endpoint_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT wd.*, we.endpoint_name, we.endpoint_url
                FROM webhook_deliveries wd
                JOIN webhook_endpoints we ON wd.endpoint_id = we.id
                WHERE we.user_id = $1
            `;
            const values = [userId];
            let paramIndex = 2;

            if (status) {
                query += ` AND wd.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (endpoint_id) {
                query += ` AND wd.endpoint_id = $${paramIndex}`;
                values.push(endpoint_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND wd.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND wd.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY wd.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM webhook_deliveries wd
                JOIN webhook_endpoints we ON wd.endpoint_id = we.id
                WHERE we.user_id = $1
                ${status ? 'AND wd.status = $2' : ''}
                ${endpoint_id ? 'AND wd.endpoint_id = $3' : ''}
            `;
            const countValues = [userId];
            if (status) countValues.push(status);
            if (endpoint_id) countValues.push(endpoint_id);
            const countResult = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error listing deliveries', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get delivery by ID
     */
    async getDeliveryById(deliveryId, userId) {
        try {
            const query = `
                SELECT wd.*, we.endpoint_name, we.endpoint_url, we.endpoint_format
                FROM webhook_deliveries wd
                JOIN webhook_endpoints we ON wd.endpoint_id = we.id
                WHERE wd.id = $1 AND we.user_id = $2
            `;
            const result = await db.query(query, [deliveryId, userId]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error getting delivery', { error: error.message, deliveryId, userId });
            throw error;
        }
    },

    // ============================================
    // LOGS & STATISTICS
    // ============================================

    /**
     * Get webhook logs
     */
    async getWebhookLogs(userId, options = {}) {
        try {
            const { page = 1, limit = 50, endpoint_id, log_level, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT wl.*, we.endpoint_name
                FROM webhook_logs wl
                JOIN webhook_endpoints we ON wl.endpoint_id = we.id
                WHERE we.user_id = $1
            `;
            const values = [userId];
            let paramIndex = 2;

            if (endpoint_id) {
                query += ` AND wl.endpoint_id = $${paramIndex}`;
                values.push(endpoint_id);
                paramIndex++;
            }

            if (log_level) {
                query += ` AND wl.log_level = $${paramIndex}`;
                values.push(log_level);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND wl.created_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND wl.created_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY wl.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM webhook_logs wl
                JOIN webhook_endpoints we ON wl.endpoint_id = we.id
                WHERE we.user_id = $1
                ${endpoint_id ? 'AND wl.endpoint_id = $2' : ''}
                ${log_level ? 'AND wl.log_level = $3' : ''}
            `;
            const countValues = [userId];
            if (endpoint_id) countValues.push(endpoint_id);
            if (log_level) countValues.push(log_level);
            const countResult = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(countResult.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error getting webhook logs', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get webhook statistics
     */
    async getWebhookStats(userId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_endpoints,
                    COUNT(*) FILTER (WHERE status = 'active') as active_endpoints,
                    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_endpoints,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed_endpoints,
                    SUM(failure_count) as total_failures,
                    AVG(failure_count)::INTEGER as avg_failures
                FROM webhook_endpoints
                WHERE user_id = $1 AND is_deleted = false
            `;
            const result = await db.query(query, [userId]);

            const deliveriesQuery = `
                SELECT 
                    COUNT(*) as total_deliveries,
                    COUNT(*) FILTER (WHERE status = 'delivered') as successful,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed,
                    COUNT(*) FILTER (WHERE status = 'retrying') as retrying,
                    AVG(response_time_ms)::INTEGER as avg_response_time,
                    MIN(response_time_ms) as min_response_time,
                    MAX(response_time_ms) as max_response_time
                FROM webhook_deliveries wd
                JOIN webhook_endpoints we ON wd.endpoint_id = we.id
                WHERE we.user_id = $1
            `;
            const deliveriesResult = await db.query(deliveriesQuery, [userId]);

            // Daily stats for last 30 days
            const dailyQuery = `
                SELECT 
                    DATE(wd.created_at) as date,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE wd.status = 'delivered') as successful,
                    AVG(wd.response_time_ms)::INTEGER as avg_response_time
                FROM webhook_deliveries wd
                JOIN webhook_endpoints we ON wd.endpoint_id = we.id
                WHERE we.user_id = $1
                    AND wd.created_at >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(wd.created_at)
                ORDER BY date DESC
            `;
            const dailyResult = await db.query(dailyQuery, [userId]);

            return {
                endpoints: result.rows[0],
                deliveries: deliveriesResult.rows[0],
                daily_stats: dailyResult.rows
            };
        } catch (error) {
            logger.error('Error getting webhook stats', { error: error.message, userId });
            throw error;
        }
    },

    /**
     * Get available webhook events
     */
    async getAvailableEvents() {
        const events = {
            patient: ['created', 'updated', 'deleted', 'merged'],
            appointment: ['created', 'updated', 'cancelled', 'rescheduled', 'completed', 'no_show', 'checked_in', 'checked_out'],
            prescription: ['created', 'updated', 'dispensed'],
            lab: ['order.created', 'order.updated', 'result.ready', 'result.critical'],
            radiology: ['order.created', 'result.ready'],
            diagnosis: ['added', 'updated'],
            invoice: ['created', 'updated', 'paid', 'overdue', 'cancelled'],
            payment: ['received', 'failed', 'refund.processed'],
            insurance: ['claim.submitted', 'claim.approved', 'claim.rejected'],
            inventory: ['low_stock', 'out_of_stock', 'expiring', 'expired', 'received'],
            purchase_order: ['created', 'approved', 'received'],
            bed: ['allocated', 'vacated', 'cleaned', 'maintenance.required'],
            user: ['created', 'updated', 'deleted', 'login', 'logout', 'password_changed', 'locked', 'unlocked'],
            security: ['alert', 'breach.detected', 'rate_limit.exceeded', 'api_key.revoked', 'mfa.enabled', 'mfa.disabled'],
            system: ['backup.completed', 'backup.failed', 'maintenance.started', 'maintenance.completed', 'error', 'warning']
        };

        return {
            total_categories: Object.keys(events).length,
            events
        };
    }
};

module.exports = webhookService;