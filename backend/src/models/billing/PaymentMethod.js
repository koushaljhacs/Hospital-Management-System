/**
 * ======================================================================
 * FILE: backend/src/models/billing/PaymentMethod.js
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
 * PaymentMethod model for database operations.
 * Handles saved payment methods for patients (cards, UPI, wallets, etc.).
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * - crypto: for token encryption (simulated)
 * 
 * TABLE: payment_methods
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - patient_id: UUID (foreign key to patients)
 * - method_type: enum (card, upi, netbanking, wallet)
 * - provider: string (visa, mastercard, gpay, phonepe, etc.)
 * - token: string (tokenized payment info, encrypted)
 * - masked_details: string (masked card/account details for display)
 * - expiry_month: integer
 * - expiry_year: integer
 * - is_default: boolean
 * - is_active: boolean
 * - last_used: timestamp
 * - metadata: jsonb
 * - created_at: timestamp
 * - updated_at: timestamp
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
const crypto = require('crypto');

const PaymentMethod = {
    /**
     * Table name
     */
    tableName: 'payment_methods',

    /**
     * Valid method types
     */
    validMethodTypes: ['card', 'upi', 'netbanking', 'wallet'],

    /**
     * Find payment method by ID
     * @param {string} id - Payment method UUID
     * @returns {Promise<Object|null>} Payment method object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    pm.id, pm.patient_id, pm.method_type, pm.provider,
                    pm.masked_details, pm.expiry_month, pm.expiry_year,
                    pm.is_default, pm.is_active, pm.last_used,
                    pm.metadata, pm.created_at, pm.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM payment_methods pm
                JOIN patients p ON pm.patient_id = p.id
                WHERE pm.id = $1 AND pm.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Payment method found by ID', { methodId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding payment method by ID', {
                error: error.message,
                methodId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find payment methods by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Options (include_inactive, limit, offset)
     * @returns {Promise<Array>} List of payment methods
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { include_inactive = false, limit = 50, offset = 0 } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (!include_inactive) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(true);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, method_type, provider, masked_details,
                    expiry_month, expiry_year, is_default, is_active,
                    last_used, created_at
                FROM payment_methods
                ${whereClause}
                ORDER BY is_default DESC, created_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Payment methods found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding payment methods by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get default payment method for patient
     * @param {string} patientId - Patient UUID
     * @returns {Promise<Object|null>} Default payment method or null
     */
    async getDefault(patientId) {
        try {
            const query = `
                SELECT 
                    id, method_type, provider, masked_details,
                    expiry_month, expiry_year, is_default
                FROM payment_methods
                WHERE patient_id = $1 
                    AND is_default = true 
                    AND is_active = true 
                    AND is_deleted = false
                LIMIT 1
            `;

            const result = await db.query(query, [patientId]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Default payment method found', { patientId });
            return result.rows[0];
        } catch (error) {
            logger.error('Error getting default payment method', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new payment method
     * @param {Object} methodData - Payment method data
     * @returns {Promise<Object>} Created payment method
     */
    async create(methodData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (methodData.method_type && !this.validMethodTypes.includes(methodData.method_type)) {
                throw new Error(`Invalid method type. Must be one of: ${this.validMethodTypes.join(', ')}`);
            }

            // If this is the first method or marked as default, ensure only one default
            if (methodData.is_default) {
                await client.query(
                    `UPDATE payment_methods 
                     SET is_default = false 
                     WHERE patient_id = $1 AND is_deleted = false`,
                    [methodData.patient_id]
                );
            } else {
                // Check if any existing method exists; if not, make this default
                const existingCount = await client.query(
                    `SELECT COUNT(*) as count FROM payment_methods 
                     WHERE patient_id = $1 AND is_deleted = false`,
                    [methodData.patient_id]
                );
                if (parseInt(existingCount.rows[0].count) === 0) {
                    methodData.is_default = true;
                }
            }

            // In production, token should be encrypted using a proper encryption service
            // For this model, we simulate token storage (should be encrypted in real implementation)
            const tokenHash = methodData.token ? 
                crypto.createHash('sha256').update(methodData.token).digest('hex') : null;

            const query = `
                INSERT INTO payment_methods (
                    id, patient_id, method_type, provider,
                    token, masked_details,
                    expiry_month, expiry_year,
                    is_default, is_active, metadata,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5,
                    $6, $7,
                    $8, true, $9,
                    NOW(), NOW()
                )
                RETURNING 
                    id, patient_id, method_type, provider,
                    masked_details, is_default, created_at
            `;

            const values = [
                methodData.patient_id,
                methodData.method_type,
                methodData.provider || null,
                tokenHash,
                methodData.masked_details || null,
                methodData.expiry_month || null,
                methodData.expiry_year || null,
                methodData.is_default || false,
                methodData.metadata || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Payment method created', {
                methodId: result.rows[0].id,
                patientId: methodData.patient_id,
                methodType: methodData.method_type,
                isDefault: result.rows[0].is_default
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating payment method', {
                error: error.message,
                patientId: methodData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update payment method
     * @param {string} id - Payment method ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated payment method
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const method = await this.findById(id);
            if (!method) {
                throw new Error('Payment method not found');
            }

            const allowedFields = [
                'provider', 'masked_details', 'expiry_month', 'expiry_year',
                'is_default', 'is_active', 'metadata'
            ];

            // If setting as default, unset other defaults for this patient
            if (updates.is_default === true) {
                await client.query(
                    `UPDATE payment_methods 
                     SET is_default = false 
                     WHERE patient_id = $1 AND id != $2 AND is_deleted = false`,
                    [method.patient_id, id]
                );
            }

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
            values.push(id);

            const query = `
                UPDATE payment_methods 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, patient_id, method_type, provider,
                    masked_details, is_default, is_active,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Payment method not found');
            }

            await db.commitTransaction(client);

            logger.info('Payment method updated', {
                methodId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating payment method', {
                error: error.message,
                methodId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Set a payment method as default
     * @param {string} id - Payment method ID
     * @param {string} updatedBy - User who performed update
     * @returns {Promise<Object>} Updated payment method
     */
    async setDefault(id, updatedBy) {
        const method = await this.findById(id);
        if (!method) {
            throw new Error('Payment method not found');
        }
        return this.update(id, {
            is_default: true,
            updated_by: updatedBy
        });
    },

    /**
     * Deactivate payment method (soft delete)
     * @param {string} id - Payment method ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deactivated
     */
    async deactivate(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE payment_methods 
                SET is_active = false,
                    is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id, patient_id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Payment method not found');
            }

            // If this was the default method, set another active method as default
            const method = await this.findById(id);
            if (method && method.is_default) {
                const nextMethod = await client.query(
                    `SELECT id FROM payment_methods 
                     WHERE patient_id = $1 
                       AND is_active = true 
                       AND id != $2 
                       AND is_deleted = false 
                     ORDER BY created_at ASC LIMIT 1`,
                    [result.rows[0].patient_id, id]
                );
                if (nextMethod.rows.length > 0) {
                    await this.update(nextMethod.rows[0].id, { is_default: true });
                }
            }

            await db.commitTransaction(client);

            logger.info('Payment method deactivated', {
                methodId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deactivating payment method', {
                error: error.message,
                methodId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update last used timestamp
     * @param {string} id - Payment method ID
     * @returns {Promise<Object>} Updated payment method
     */
    async updateLastUsed(id) {
        try {
            const query = `
                UPDATE payment_methods 
                SET last_used = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING id, last_used
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                throw new Error('Payment method not found');
            }

            logger.debug('Last used updated for payment method', { methodId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error updating last used', {
                error: error.message,
                methodId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get payment method statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_methods,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE method_type = 'card') as card_methods,
                    COUNT(*) FILTER (WHERE method_type = 'upi') as upi_methods,
                    COUNT(*) FILTER (WHERE method_type = 'netbanking') as netbanking_methods,
                    COUNT(*) FILTER (WHERE method_type = 'wallet') as wallet_methods,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(*) FILTER (WHERE is_default = true) as default_methods
                FROM payment_methods
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Payment method statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting payment method statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete payment method
     * @param {string} id - Payment method ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        return this.deactivate(id, deletedBy);
    }
};

module.exports = PaymentMethod;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */