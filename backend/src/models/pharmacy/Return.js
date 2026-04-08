/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/Return.js
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
 * Return model for database operations.
 * Handles medicine returns from patients with refund processing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: returns
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - return_number: string (unique)
 * - patient_id: UUID (foreign key to patients)
 * - prescription_id: UUID (foreign key to prescriptions)
 * - dispense_id: UUID (foreign key to dispensing)
 * - pharmacist_id: UUID (foreign key to employees)
 * - return_date: timestamp
 * - return_type: enum (expired, damaged, unwanted, other)
 * - reason: text
 * - items: jsonb
 * - total_items: integer
 * - total_quantity: integer
 * - refund_amount: decimal
 * - refund_method: string
 * - refund_status: enum (pending, processed, rejected)
 * - approved_by: uuid
 * - approved_at: timestamp
 * - processed_by: uuid
 * - processed_at: timestamp
 * - rejection_reason: text
 * - notes: text
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

const Return = {
    /**
     * Table name
     */
    tableName: 'returns',

    /**
     * Valid return types
     */
    validReturnTypes: ['expired', 'damaged', 'unwanted', 'other'],

    /**
     * Valid refund statuses
     */
    validRefundStatuses: ['pending', 'processed', 'rejected'],

    /**
     * Generate return number
     * @returns {Promise<string>} Generated return number
     */
    async generateReturnNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM returns
                WHERE return_number LIKE $1
            `;
            const result = await db.query(query, [`RET-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `RET-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating return number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find return by ID
     * @param {string} id - Return UUID
     * @returns {Promise<Object|null>} Return object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    r.id, r.return_number, r.patient_id,
                    r.prescription_id, r.dispense_id, r.pharmacist_id,
                    r.return_date, r.return_type, r.reason,
                    r.items, r.total_items, r.total_quantity,
                    r.refund_amount, r.refund_method, r.refund_status,
                    r.approved_by, r.approved_at,
                    r.processed_by, r.processed_at,
                    r.rejection_reason, r.notes,
                    r.created_at, r.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    ph.first_name as pharmacist_first_name,
                    ph.last_name as pharmacist_last_name,
                    app.username as approved_by_name,
                    proc.username as processed_by_name
                FROM returns r
                LEFT JOIN patients p ON r.patient_id = p.id
                LEFT JOIN employees ph ON r.pharmacist_id = ph.id
                LEFT JOIN users app ON r.approved_by = app.id
                LEFT JOIN users proc ON r.processed_by = proc.id
                WHERE r.id = $1 AND r.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Return found by ID', { returnId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding return by ID', {
                error: error.message,
                returnId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find return by return number
     * @param {string} returnNumber - Return number
     * @returns {Promise<Object|null>} Return object or null
     */
    async findByNumber(returnNumber) {
        try {
            const query = `
                SELECT 
                    id, return_number, patient_id,
                    refund_amount, refund_status, return_date
                FROM returns
                WHERE return_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [returnNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Return found by number', { returnNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding return by number', {
                error: error.message,
                returnNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find returns by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of returns
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, refund_status, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (refund_status) {
                conditions.push(`refund_status = $${paramIndex++}`);
                values.push(refund_status);
            }
            if (from_date) {
                conditions.push(`return_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`return_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, return_number, return_date,
                    return_type, total_items, total_quantity,
                    refund_amount, refund_status,
                    pharmacist_id,
                    ph.first_name as pharmacist_first_name,
                    ph.last_name as pharmacist_last_name
                FROM returns r
                LEFT JOIN employees ph ON r.pharmacist_id = ph.id
                ${whereClause}
                ORDER BY return_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Returns found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding returns by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find returns by prescription ID
     * @param {string} prescriptionId - Prescription UUID
     * @returns {Promise<Array>} List of returns
     */
    async findByPrescriptionId(prescriptionId) {
        try {
            const query = `
                SELECT 
                    id, return_number, return_date,
                    return_type, refund_amount, refund_status,
                    notes
                FROM returns
                WHERE prescription_id = $1 AND is_deleted = false
                ORDER BY return_date DESC
            `;

            const result = await db.query(query, [prescriptionId]);

            logger.debug('Returns found by prescription ID', {
                prescriptionId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding returns by prescription ID', {
                error: error.message,
                prescriptionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find returns by dispense ID
     * @param {string} dispenseId - Dispensing UUID
     * @returns {Promise<Array>} List of returns
     */
    async findByDispenseId(dispenseId) {
        try {
            const query = `
                SELECT 
                    id, return_number, return_date,
                    return_type, refund_amount, refund_status,
                    notes
                FROM returns
                WHERE dispense_id = $1 AND is_deleted = false
                ORDER BY return_date DESC
            `;

            const result = await db.query(query, [dispenseId]);

            logger.debug('Returns found by dispense ID', {
                dispenseId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding returns by dispense ID', {
                error: error.message,
                dispenseId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending returns (awaiting approval/processing)
     * @returns {Promise<Array>} List of pending returns
     */
    async getPendingReturns() {
        try {
            const query = `
                SELECT 
                    r.id, r.return_number, r.patient_id,
                    r.return_date, r.return_type,
                    r.refund_amount, r.refund_status,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone
                FROM returns r
                JOIN patients p ON r.patient_id = p.id
                WHERE r.refund_status = 'pending' AND r.is_deleted = false
                ORDER BY r.return_date ASC
            `;

            const result = await db.query(query);

            logger.debug('Pending returns retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending returns', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new return request
     * @param {Object} returnData - Return data
     * @returns {Promise<Object>} Created return
     */
    async create(returnData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (returnData.return_type && !this.validReturnTypes.includes(returnData.return_type)) {
                throw new Error(`Invalid return type. Must be one of: ${this.validReturnTypes.join(', ')}`);
            }

            if (returnData.refund_status && !this.validRefundStatuses.includes(returnData.refund_status)) {
                throw new Error(`Invalid refund status. Must be one of: ${this.validRefundStatuses.join(', ')}`);
            }

            const returnNumber = await this.generateReturnNumber();

            // Calculate totals from items
            let totalQuantity = 0;
            const items = returnData.items || [];

            for (const item of items) {
                totalQuantity += item.quantity;
            }

            const query = `
                INSERT INTO returns (
                    id, return_number, patient_id,
                    prescription_id, dispense_id, pharmacist_id,
                    return_date, return_type, reason,
                    items, total_items, total_quantity,
                    refund_amount, refund_method, refund_status,
                    notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    COALESCE($6, NOW()), $7, $8,
                    $9, $10, $11,
                    $12, $13, $14,
                    $15,
                    $16, NOW(), NOW()
                )
                RETURNING 
                    id, return_number, patient_id,
                    return_date, return_type,
                    refund_amount, refund_status, created_at
            `;

            const values = [
                returnNumber,
                returnData.patient_id,
                returnData.prescription_id || null,
                returnData.dispense_id || null,
                returnData.pharmacist_id,
                returnData.return_date || null,
                returnData.return_type,
                returnData.reason,
                items,
                items.length,
                totalQuantity,
                returnData.refund_amount,
                returnData.refund_method || null,
                returnData.refund_status || 'pending',
                returnData.notes || null,
                returnData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Return request created successfully', {
                returnId: result.rows[0].id,
                returnNumber,
                patientId: returnData.patient_id,
                refundAmount: returnData.refund_amount
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating return request', {
                error: error.message,
                patientId: returnData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update return
     * @param {string} id - Return ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated return
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'return_type', 'reason', 'refund_amount',
                'refund_method', 'refund_status', 'notes'
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
                UPDATE returns 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, return_number, refund_status,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Return not found');
            }

            await db.commitTransaction(client);

            logger.info('Return updated', {
                returnId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating return', {
                error: error.message,
                returnId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Approve return
     * @param {string} id - Return ID
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated return
     */
    async approve(id, approvedBy) {
        return this.update(id, {
            approved_by: approvedBy,
            approved_at: new Date(),
            updated_by: approvedBy
        });
    },

    /**
     * Process refund
     * @param {string} id - Return ID
     * @param {string} processedBy - User who processed
     * @param {string} refundMethod - Refund method
     * @returns {Promise<Object>} Updated return
     */
    async processRefund(id, processedBy, refundMethod) {
        return this.update(id, {
            refund_status: 'processed',
            refund_method: refundMethod,
            processed_by: processedBy,
            processed_at: new Date(),
            updated_by: processedBy
        });
    },

    /**
     * Reject return
     * @param {string} id - Return ID
     * @param {string} rejectedBy - User who rejected
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated return
     */
    async reject(id, rejectedBy, reason) {
        return this.update(id, {
            refund_status: 'rejected',
            rejection_reason: reason,
            updated_by: rejectedBy
        });
    },

    /**
     * Get return statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND return_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_returns,
                    SUM(refund_amount) as total_refund_amount,
                    AVG(refund_amount)::numeric(10,2) as avg_refund_amount,
                    COUNT(*) FILTER (WHERE refund_status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE refund_status = 'processed') as processed,
                    COUNT(*) FILTER (WHERE refund_status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE return_type = 'expired') as expired_returns,
                    COUNT(*) FILTER (WHERE return_type = 'damaged') as damaged_returns,
                    COUNT(*) FILTER (WHERE return_type = 'unwanted') as unwanted_returns,
                    COUNT(*) FILTER (WHERE return_type = 'other') as other_returns,
                    SUM(total_quantity) as total_items_returned,
                    COUNT(DISTINCT patient_id) as unique_patients
                FROM returns
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Return statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting return statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get returns by date range
     * @param {string} startDate - Start date
     * @param {string} endDate - End date
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of returns
     */
    async getByDateRange(startDate, endDate, options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    r.id, r.return_number, r.patient_id,
                    r.return_date, r.return_type,
                    r.refund_amount, r.refund_status,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM returns r
                JOIN patients p ON r.patient_id = p.id
                WHERE r.return_date BETWEEN $1 AND $2
                    AND r.is_deleted = false
                ORDER BY r.return_date DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await db.query(query, [startDate, endDate, limit, offset]);

            logger.debug('Returns found by date range', {
                startDate,
                endDate,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting returns by date range', {
                error: error.message,
                startDate,
                endDate
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete return
     * @param {string} id - Return ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE returns 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Return not found');
            }

            await db.commitTransaction(client);

            logger.info('Return soft deleted', {
                returnId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting return', {
                error: error.message,
                returnId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Return;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */