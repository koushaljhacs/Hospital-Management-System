/**
 * ======================================================================
 * FILE: backend/src/models/lab/TestOrder.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * AUTHOR: @koushal
 * 
 * RESTRICTIONS:
 * This code is proprietary to OctNov.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * DESCRIPTION:
 * TestOrder model for database operations.
 * Handles lab test orders placed by doctors for patients.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: test_orders
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - order_number: string (unique)
 * - patient_id: UUID (foreign key to patients)
 * - doctor_id: UUID (foreign key to employees)
 * - department_id: UUID (foreign key to departments)
 * - lab_id: UUID (foreign key to labs)
 * - order_date: date
 * - order_time: time
 * - priority: enum (routine, urgent, stat, timed)
 * - clinical_notes: text
 * - diagnosis: text
 * - special_instructions: text
 * - test_items: jsonb
 * - total_tests: integer
 * - status: enum (pending, ordered, collected, received, in_progress, completed, verified, reported, cancelled)
 * - is_urgent: boolean
 * - is_stat: boolean
 * - is_outside_lab: boolean
 * - outside_lab_name: string
 * - collection_date: date
 * - collection_time: time
 * - collected_by: uuid
 * - collection_location: string
 * - collection_notes: text
 * - is_billed: boolean
 * - invoice_id: UUID
 * - total_amount: decimal
 * - discount_amount: decimal
 * - tax_amount: decimal
 * - net_amount: decimal (generated)
 * - report_required: boolean
 * - report_generated: boolean
 * - report_url: text
 * - report_generated_at: timestamp
 * - consent_taken: boolean
 * - consent_form_url: text
 * - consent_taken_by: uuid
 * - notes: text
 * - internal_notes: text
 * - created_at: timestamp
 * - updated_at: timestamp
 * - created_by: uuid
 * - updated_by: uuid
 * - is_deleted: boolean
 * - deleted_at: timestamp
 * - deleted_by: uuid
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const TestOrder = {
    /**
     * Table name
     */
    tableName: 'test_orders',

    /**
     * Valid priorities
     */
    validPriorities: ['routine', 'urgent', 'stat', 'timed'],

    /**
     * Valid statuses
     */
    validStatuses: [
        'pending', 'ordered', 'collected', 'received',
        'in_progress', 'completed', 'verified', 'reported', 'cancelled'
    ],

    /**
     * Generate order number
     * @returns {Promise<string>} Generated order number
     */
    async generateOrderNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM test_orders
                WHERE order_number LIKE $1
            `;
            const result = await db.query(query, [`LAB-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `LAB-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating order number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find test order by ID
     * @param {string} id - Test order UUID
     * @returns {Promise<Object|null>} Test order object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    to.id, to.order_number, to.patient_id, to.doctor_id,
                    to.department_id, to.lab_id,
                    to.order_date, to.order_time, to.priority,
                    to.clinical_notes, to.diagnosis, to.special_instructions,
                    to.test_items, to.total_tests,
                    to.status, to.is_urgent, to.is_stat,
                    to.is_outside_lab, to.outside_lab_name,
                    to.collection_date, to.collection_time,
                    to.collected_by, to.collection_location, to.collection_notes,
                    to.is_billed, to.invoice_id,
                    to.total_amount, to.discount_amount, to.tax_amount, to.net_amount,
                    to.report_required, to.report_generated,
                    to.report_url, to.report_generated_at,
                    to.consent_taken, to.consent_form_url, to.consent_taken_by,
                    to.notes, to.internal_notes,
                    to.created_at, to.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    d.name as department_name,
                    l.lab_name,
                    u.username as collected_by_name,
                    c.username as created_by_name
                FROM test_orders to
                LEFT JOIN patients p ON to.patient_id = p.id
                LEFT JOIN employees e ON to.doctor_id = e.id
                LEFT JOIN departments d ON to.department_id = d.id
                LEFT JOIN labs l ON to.lab_id = l.id
                LEFT JOIN users u ON to.collected_by = u.id
                LEFT JOIN users c ON to.created_by = c.id
                WHERE to.id = $1 AND to.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Test order found by ID', { orderId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding test order by ID', {
                error: error.message,
                orderId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find test order by order number
     * @param {string} orderNumber - Order number
     * @returns {Promise<Object|null>} Test order object or null
     */
    async findByNumber(orderNumber) {
        try {
            const query = `
                SELECT 
                    id, order_number, patient_id, doctor_id,
                    order_date, priority, status,
                    total_tests, is_billed
                FROM test_orders
                WHERE order_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [orderNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Test order found by number', { orderNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding test order by number', {
                error: error.message,
                orderNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find test orders by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of test orders
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, status, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }
            if (from_date) {
                conditions.push(`order_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`order_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, order_number, order_date,
                    priority, status, total_tests,
                    total_amount, is_billed,
                    doctor_id,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM test_orders to
                LEFT JOIN employees e ON to.doctor_id = e.id
                ${whereClause}
                ORDER BY order_date DESC, order_time DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Test orders found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding test orders by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find test orders by doctor ID
     * @param {string} doctorId - Doctor UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of test orders
     */
    async findByDoctorId(doctorId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [doctorId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (from_date) {
                conditions.push(`order_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`order_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, order_number, patient_id,
                    order_date, priority, status,
                    total_tests, total_amount,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                ${whereClause}
                ORDER BY order_date DESC, order_time DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Test orders found by doctor ID', {
                doctorId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding test orders by doctor ID', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending test orders (awaiting processing)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of pending orders
     */
    async getPendingOrders(options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    to.id, to.order_number, to.patient_id,
                    to.order_date, to.priority, to.status,
                    to.total_tests,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                LEFT JOIN employees e ON to.doctor_id = e.id
                WHERE to.status IN ('pending', 'ordered')
                    AND to.is_deleted = false
                ORDER BY 
                    CASE to.priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        WHEN 'timed' THEN 3
                        WHEN 'routine' THEN 4
                    END,
                    to.order_date ASC,
                    to.order_time ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Pending test orders retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending test orders', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new test order
     * @param {Object} orderData - Test order data
     * @returns {Promise<Object>} Created test order
     */
    async create(orderData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (orderData.priority && !this.validPriorities.includes(orderData.priority)) {
                throw new Error(`Invalid priority. Must be one of: ${this.validPriorities.join(', ')}`);
            }

            const orderNumber = await this.generateOrderNumber();

            // Calculate totals from test items
            let totalAmount = 0;
            const testItems = orderData.test_items || [];

            for (const item of testItems) {
                totalAmount += item.price || 0;
            }

            const discountAmount = orderData.discount_amount || 0;
            const taxAmount = orderData.tax_amount || 0;
            const netAmount = totalAmount - discountAmount + taxAmount;

            const query = `
                INSERT INTO test_orders (
                    id, order_number, patient_id, doctor_id,
                    department_id, lab_id,
                    order_date, order_time, priority,
                    clinical_notes, diagnosis, special_instructions,
                    test_items, total_tests,
                    status, is_urgent, is_stat,
                    is_outside_lab, outside_lab_name,
                    is_billed, invoice_id,
                    total_amount, discount_amount, tax_amount,
                    report_required, consent_taken,
                    notes, internal_notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5,
                    COALESCE($6, CURRENT_DATE), COALESCE($7, CURRENT_TIME), $8,
                    $9, $10, $11,
                    $12, $13,
                    COALESCE($14, 'pending'), COALESCE($15, false), COALESCE($16, false),
                    COALESCE($17, false), $18,
                    false, $19,
                    $20, $21, $22,
                    COALESCE($23, true), COALESCE($24, true),
                    $25, $26,
                    $27, NOW(), NOW()
                )
                RETURNING 
                    id, order_number, patient_id, doctor_id,
                    order_date, priority, status,
                    total_tests, total_amount, net_amount,
                    created_at
            `;

            const values = [
                orderNumber,
                orderData.patient_id,
                orderData.doctor_id,
                orderData.department_id || null,
                orderData.lab_id || null,
                orderData.order_date || null,
                orderData.order_time || null,
                orderData.priority,
                orderData.clinical_notes || null,
                orderData.diagnosis || null,
                orderData.special_instructions || null,
                testItems,
                testItems.length,
                orderData.status,
                orderData.is_urgent,
                orderData.is_stat,
                orderData.is_outside_lab,
                orderData.outside_lab_name || null,
                orderData.invoice_id || null,
                totalAmount,
                discountAmount,
                taxAmount,
                orderData.report_required,
                orderData.consent_taken,
                orderData.notes || null,
                orderData.internal_notes || null,
                orderData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Test order created successfully', {
                orderId: result.rows[0].id,
                orderNumber,
                patientId: orderData.patient_id,
                totalTests: testItems.length
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating test order', {
                error: error.message,
                patientId: orderData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update test order
     * @param {string} id - Test order ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated test order
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'priority', 'clinical_notes', 'diagnosis',
                'special_instructions', 'test_items', 'total_tests',
                'status', 'is_urgent', 'is_stat',
                'is_outside_lab', 'outside_lab_name',
                'collection_date', 'collection_time',
                'collected_by', 'collection_location', 'collection_notes',
                'is_billed', 'invoice_id',
                'total_amount', 'discount_amount', 'tax_amount',
                'report_required', 'report_generated',
                'report_url', 'report_generated_at',
                'consent_taken', 'consent_form_url', 'consent_taken_by',
                'notes', 'internal_notes'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            if (updates.updated_by) {
                setClause.push(`updated_by = $${paramIndex++}`);
                values.push(updates.updated_by);
            }
            values.push(id);

            const query = `
                UPDATE test_orders 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, order_number, status,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Test order not found');
            }

            await db.commitTransaction(client);

            logger.info('Test order updated', {
                orderId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating test order', {
                error: error.message,
                orderId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update order status
     * @param {string} id - Test order ID
     * @param {string} status - New status
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated test order
     */
    async updateStatus(id, status, updatedBy) {
        if (!this.validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
        }
        return this.update(id, {
            status: status,
            updated_by: updatedBy
        });
    },

    /**
     * Mark order as collected (sample collected)
     * @param {string} id - Test order ID
     * @param {Object} collectionData - Collection data
     * @returns {Promise<Object>} Updated test order
     */
    async markCollected(id, collectionData) {
        return this.update(id, {
            status: 'collected',
            collection_date: collectionData.collection_date || new Date(),
            collection_time: collectionData.collection_time || new Date().toTimeString().slice(0, 8),
            collected_by: collectionData.collected_by,
            collection_location: collectionData.collection_location,
            collection_notes: collectionData.notes,
            updated_by: collectionData.collected_by
        });
    },

    /**
     * Mark order as received by lab
     * @param {string} id - Test order ID
     * @param {string} receivedBy - User who received
     * @returns {Promise<Object>} Updated test order
     */
    async markReceived(id, receivedBy) {
        return this.update(id, {
            status: 'received',
            updated_by: receivedBy
        });
    },

    /**
     * Mark order as in progress
     * @param {string} id - Test order ID
     * @param {string} startedBy - User who started
     * @returns {Promise<Object>} Updated test order
     */
    async markInProgress(id, startedBy) {
        return this.update(id, {
            status: 'in_progress',
            updated_by: startedBy
        });
    },

    /**
     * Mark order as completed (all tests done)
     * @param {string} id - Test order ID
     * @param {string} completedBy - User who completed
     * @returns {Promise<Object>} Updated test order
     */
    async markCompleted(id, completedBy) {
        return this.update(id, {
            status: 'completed',
            updated_by: completedBy
        });
    },

    /**
     * Cancel test order
     * @param {string} id - Test order ID
     * @param {string} cancelledBy - User who cancelled
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Object>} Updated test order
     */
    async cancel(id, cancelledBy, reason) {
        return this.update(id, {
            status: 'cancelled',
            notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
            updated_by: cancelledBy
        });
    },

    /**
     * Generate report for test order
     * @param {string} id - Test order ID
     * @param {string} reportUrl - URL of generated report
     * @param {string} generatedBy - User who generated
     * @returns {Promise<Object>} Updated test order
     */
    async generateReport(id, reportUrl, generatedBy) {
        return this.update(id, {
            report_generated: true,
            report_url: reportUrl,
            report_generated_at: new Date(),
            status: 'reported',
            updated_by: generatedBy
        });
    },

    /**
     * Get test order statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND order_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_orders,
                    SUM(total_amount) as total_revenue,
                    AVG(total_amount)::numeric(10,2) as avg_order_value,
                    COUNT(*) FILTER (WHERE priority = 'stat') as stat_orders,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_orders,
                    COUNT(*) FILTER (WHERE priority = 'routine') as routine_orders,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'reported') as reported,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE is_billed = true) as billed,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT doctor_id) as unique_doctors,
                    SUM(total_tests) as total_tests_ordered,
                    AVG(total_tests)::numeric(10,2) as avg_tests_per_order
                FROM test_orders
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Test order statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting test order statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get orders by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of orders
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    id, order_number, patient_id, doctor_id,
                    order_date, priority, status,
                    total_tests, total_amount,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                WHERE to.order_date BETWEEN $1 AND $2
                    AND to.is_deleted = false
                ORDER BY to.order_date DESC, to.order_time DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [startDate, endDate, limit, offset]);

            logger.debug('Test orders found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting test orders by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete test order
     * @param {string} id - Test order ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE test_orders 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Test order not found');
            }

            await db.commitTransaction(client);

            logger.info('Test order soft deleted', {
                orderId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting test order', {
                error: error.message,
                orderId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = TestOrder;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */