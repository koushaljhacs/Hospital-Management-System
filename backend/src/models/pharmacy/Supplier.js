/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/Supplier.js
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
 * Supplier model for database operations.
 * Handles vendor/supplier management for pharmacy inventory.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: suppliers
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - name: string
 * - code: string (unique)
 * - contact_person: string
 * - phone: string
 * - alternate_phone: string
 * - email: string
 * - website: string
 * - address: text
 * - city: string
 * - state: string
 * - country: string
 * - postal_code: string
 * - gst_number: string (unique)
 * - pan_number: string
 * - license_number: string
 * - business_type: string
 * - payment_terms: string
 * - credit_limit: decimal
 * - credit_days: integer
 * - minimum_order: decimal
 * - bank_name: string
 * - bank_account_number: string
 * - bank_ifsc_code: string
 * - bank_swift_code: string
 * - bank_branch: string
 * - gst_certificate_url: text
 * - pan_card_url: text
 * - license_document_url: text
 * - agreement_url: text
 * - other_documents: jsonb
 * - delivery_time_avg: integer
 * - quality_rating: decimal
 * - price_competitiveness: decimal
 * - total_orders: integer
 * - total_spent: decimal
 * - last_order_date: timestamp
 * - last_payment_date: timestamp
 * - status: enum (active, inactive, blacklisted, on_hold)
 * - approval_status: enum (pending, approved, rejected, under_review)
 * - approved_by: uuid
 * - approved_at: timestamp
 * - blacklist_reason: text
 * - hold_reason: text
 * - notes: text
 * - metadata: jsonb
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

const Supplier = {
    /**
     * Table name
     */
    tableName: 'suppliers',

    /**
     * Valid status values
     */
    validStatuses: ['active', 'inactive', 'blacklisted', 'on_hold'],

    /**
     * Valid approval statuses
     */
    validApprovalStatuses: ['pending', 'approved', 'rejected', 'under_review'],

    /**
     * Generate supplier code
     * @returns {Promise<string>} Generated supplier code
     */
    async generateSupplierCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM suppliers WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');
            return `SUP-${sequence}`;
        } catch (error) {
            logger.error('Error generating supplier code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find supplier by ID
     * @param {string} id - Supplier UUID
     * @returns {Promise<Object|null>} Supplier object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    s.id, s.name, s.code, s.contact_person,
                    s.phone, s.alternate_phone, s.email, s.website,
                    s.address, s.city, s.state, s.country, s.postal_code,
                    s.gst_number, s.pan_number, s.license_number, s.business_type,
                    s.payment_terms, s.credit_limit, s.credit_days, s.minimum_order,
                    s.bank_name, s.bank_account_number, s.bank_ifsc_code,
                    s.bank_swift_code, s.bank_branch,
                    s.gst_certificate_url, s.pan_card_url, s.license_document_url,
                    s.agreement_url, s.other_documents,
                    s.delivery_time_avg, s.quality_rating, s.price_competitiveness,
                    s.total_orders, s.total_spent,
                    s.last_order_date, s.last_payment_date,
                    s.status, s.approval_status,
                    s.approved_by, s.approved_at,
                    s.blacklist_reason, s.hold_reason,
                    s.notes, s.metadata,
                    s.created_at, s.updated_at,
                    u.username as approved_by_name,
                    c.username as created_by_name
                FROM suppliers s
                LEFT JOIN users u ON s.approved_by = u.id
                LEFT JOIN users c ON s.created_by = c.id
                WHERE s.id = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Supplier found by ID', { supplierId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding supplier by ID', {
                error: error.message,
                supplierId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find supplier by code
     * @param {string} code - Supplier code
     * @returns {Promise<Object|null>} Supplier object or null
     */
    async findByCode(code) {
        try {
            const query = `
                SELECT id, name, code, status, approval_status,
                       phone, email, contact_person
                FROM suppliers
                WHERE code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [code]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Supplier found by code', { code });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding supplier by code', {
                error: error.message,
                code
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find supplier by GST number
     * @param {string} gstNumber - GST number
     * @returns {Promise<Object|null>} Supplier object or null
     */
    async findByGstNumber(gstNumber) {
        try {
            const query = `
                SELECT id, name, code, gst_number, status
                FROM suppliers
                WHERE gst_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [gstNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Supplier found by GST number', { gstNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding supplier by GST number', {
                error: error.message,
                gstNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all suppliers with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of suppliers
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(filters.status);
            }
            if (filters.approval_status) {
                conditions.push(`approval_status = $${paramIndex++}`);
                values.push(filters.approval_status);
            }
            if (filters.city) {
                conditions.push(`city ILIKE $${paramIndex++}`);
                values.push(`%${filters.city}%`);
            }
            if (filters.state) {
                conditions.push(`state ILIKE $${paramIndex++}`);
                values.push(`%${filters.state}%`);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, name, code, contact_person,
                    phone, email, city, state,
                    gst_number, payment_terms, credit_limit,
                    delivery_time_avg, quality_rating,
                    total_orders, total_spent,
                    status, approval_status,
                    last_order_date, created_at
                FROM suppliers
                ${whereClause}
                ORDER BY name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all suppliers', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all suppliers', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active suppliers (for dropdowns)
     * @returns {Promise<Array>} List of active suppliers
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, name, code, contact_person, phone, email,
                    payment_terms, credit_limit, credit_days
                FROM suppliers
                WHERE status = 'active' 
                    AND approval_status = 'approved'
                    AND is_deleted = false
                ORDER BY name ASC
            `;

            const result = await db.query(query);

            logger.debug('Active suppliers retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active suppliers', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new supplier
     * @param {Object} supplierData - Supplier data
     * @returns {Promise<Object>} Created supplier
     */
    async create(supplierData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (supplierData.status && !this.validStatuses.includes(supplierData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            if (supplierData.approval_status && !this.validApprovalStatuses.includes(supplierData.approval_status)) {
                throw new Error(`Invalid approval status. Must be one of: ${this.validApprovalStatuses.join(', ')}`);
            }

            const existingCode = await this.findByCode(supplierData.code);
            if (existingCode) {
                throw new Error('Supplier code already exists');
            }

            if (supplierData.gst_number) {
                const existingGst = await this.findByGstNumber(supplierData.gst_number);
                if (existingGst) {
                    throw new Error('GST number already registered');
                }
            }

            const supplierCode = supplierData.code || await this.generateSupplierCode();

            const query = `
                INSERT INTO suppliers (
                    id, name, code, contact_person,
                    phone, alternate_phone, email, website,
                    address, city, state, country, postal_code,
                    gst_number, pan_number, license_number, business_type,
                    payment_terms, credit_limit, credit_days, minimum_order,
                    bank_name, bank_account_number, bank_ifsc_code,
                    bank_swift_code, bank_branch,
                    gst_certificate_url, pan_card_url, license_document_url,
                    agreement_url, other_documents,
                    delivery_time_avg, quality_rating, price_competitiveness,
                    total_orders, total_spent,
                    status, approval_status,
                    notes, metadata,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6, $7,
                    $8, $9, $10, $11, $12,
                    $13, $14, $15, $16,
                    $17, $18, $19, $20,
                    $21, $22, $23, $24, $25,
                    $26, $27, $28, $29, $30,
                    $31, $32, $33,
                    0, 0,
                    COALESCE($34, 'active'), COALESCE($35, 'pending'),
                    $36, $37,
                    $38, NOW(), NOW()
                )
                RETURNING 
                    id, name, code, contact_person,
                    phone, email, gst_number,
                    status, approval_status, created_at
            `;

            const values = [
                supplierData.name,
                supplierCode,
                supplierData.contact_person || null,
                supplierData.phone,
                supplierData.alternate_phone || null,
                supplierData.email || null,
                supplierData.website || null,
                supplierData.address || null,
                supplierData.city || null,
                supplierData.state || null,
                supplierData.country || 'India',
                supplierData.postal_code || null,
                supplierData.gst_number || null,
                supplierData.pan_number || null,
                supplierData.license_number || null,
                supplierData.business_type || null,
                supplierData.payment_terms || null,
                supplierData.credit_limit || 0,
                supplierData.credit_days || 30,
                supplierData.minimum_order || 0,
                supplierData.bank_name || null,
                supplierData.bank_account_number || null,
                supplierData.bank_ifsc_code || null,
                supplierData.bank_swift_code || null,
                supplierData.bank_branch || null,
                supplierData.gst_certificate_url || null,
                supplierData.pan_card_url || null,
                supplierData.license_document_url || null,
                supplierData.agreement_url || null,
                supplierData.other_documents || null,
                supplierData.delivery_time_avg || null,
                supplierData.quality_rating || null,
                supplierData.price_competitiveness || null,
                supplierData.status,
                supplierData.approval_status,
                supplierData.notes || null,
                supplierData.metadata || null,
                supplierData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Supplier created successfully', {
                supplierId: result.rows[0].id,
                supplierName: supplierData.name,
                supplierCode
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating supplier', {
                error: error.message,
                supplierName: supplierData.name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update supplier
     * @param {string} id - Supplier ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated supplier
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const supplier = await this.findById(id);
            if (!supplier) {
                throw new Error('Supplier not found');
            }

            const allowedFields = [
                'name', 'contact_person', 'phone', 'alternate_phone',
                'email', 'website', 'address', 'city', 'state',
                'country', 'postal_code', 'gst_number', 'pan_number',
                'license_number', 'business_type', 'payment_terms',
                'credit_limit', 'credit_days', 'minimum_order',
                'bank_name', 'bank_account_number', 'bank_ifsc_code',
                'bank_swift_code', 'bank_branch', 'gst_certificate_url',
                'pan_card_url', 'license_document_url', 'agreement_url',
                'other_documents', 'delivery_time_avg', 'quality_rating',
                'price_competitiveness', 'status', 'approval_status',
                'notes', 'metadata'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            if (updates.gst_number && updates.gst_number !== supplier.gst_number) {
                const existing = await this.findByGstNumber(updates.gst_number);
                if (existing && existing.id !== id) {
                    throw new Error('GST number already registered to another supplier');
                }
            }

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
                UPDATE suppliers 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, name, code, status,
                    approval_status, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Supplier not found');
            }

            await db.commitTransaction(client);

            logger.info('Supplier updated successfully', {
                supplierId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating supplier', {
                error: error.message,
                supplierId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Approve supplier
     * @param {string} id - Supplier ID
     * @param {string} approvedBy - User who approved
     * @returns {Promise<Object>} Updated supplier
     */
    async approve(id, approvedBy) {
        return this.update(id, {
            approval_status: 'approved',
            approved_by: approvedBy,
            approved_at: new Date(),
            updated_by: approvedBy
        });
    },

    /**
     * Reject supplier
     * @param {string} id - Supplier ID
     * @param {string} rejectedBy - User who rejected
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated supplier
     */
    async reject(id, rejectedBy, reason) {
        return this.update(id, {
            approval_status: 'rejected',
            status: 'inactive',
            blacklist_reason: reason,
            updated_by: rejectedBy
        });
    },

    /**
     * Blacklist supplier
     * @param {string} id - Supplier ID
     * @param {string} blacklistedBy - User who blacklisted
     * @param {string} reason - Blacklist reason
     * @returns {Promise<Object>} Updated supplier
     */
    async blacklist(id, blacklistedBy, reason) {
        return this.update(id, {
            status: 'blacklisted',
            blacklist_reason: reason,
            updated_by: blacklistedBy
        });
    },

    /**
     * Update order statistics
     * @param {string} id - Supplier ID
     * @param {number} orderAmount - Amount of the order
     * @returns {Promise<Object>} Updated supplier
     */
    async updateOrderStats(id, orderAmount) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE suppliers 
                SET total_orders = total_orders + 1,
                    total_spent = total_spent + $1,
                    last_order_date = NOW(),
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING 
                    id, total_orders, total_spent, last_order_date
            `;

            const result = await client.query(query, [orderAmount, id]);

            if (result.rows.length === 0) {
                throw new Error('Supplier not found');
            }

            await db.commitTransaction(client);

            logger.debug('Supplier order statistics updated', {
                supplierId: id,
                orderAmount,
                totalOrders: result.rows[0].total_orders,
                totalSpent: result.rows[0].total_spent
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating supplier order stats', {
                error: error.message,
                supplierId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Search suppliers
     * @param {string} searchTerm - Search term (name, code, contact, GST)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of suppliers
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, name, code, contact_person,
                    phone, email, city, gst_number,
                    status, approval_status,
                    total_orders, quality_rating
                FROM suppliers
                WHERE (name ILIKE $1 
                    OR code ILIKE $1
                    OR contact_person ILIKE $1
                    OR phone ILIKE $1
                    OR gst_number ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN name ILIKE $2 THEN 1
                        WHEN code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Supplier search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching suppliers', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get supplier statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_suppliers,
                    COUNT(*) FILTER (WHERE status = 'active') as active,
                    COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
                    COUNT(*) FILTER (WHERE status = 'blacklisted') as blacklisted,
                    COUNT(*) FILTER (WHERE status = 'on_hold') as on_hold,
                    COUNT(*) FILTER (WHERE approval_status = 'approved') as approved,
                    COUNT(*) FILTER (WHERE approval_status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE approval_status = 'rejected') as rejected,
                    SUM(total_orders) as total_orders_placed,
                    SUM(total_spent) as total_amount_spent,
                    AVG(quality_rating)::numeric(10,2) as avg_quality_rating,
                    AVG(delivery_time_avg)::numeric(10,2) as avg_delivery_days,
                    COUNT(DISTINCT city) as cities_covered,
                    COUNT(DISTINCT state) as states_covered
                FROM suppliers
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Supplier statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting supplier statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get top suppliers by total spent
     * @param {number} limit - Number of suppliers
     * @returns {Promise<Array>} List of top suppliers
     */
    async getTopSuppliers(limit = 10) {
        try {
            const query = `
                SELECT 
                    id, name, code,
                    total_orders, total_spent,
                    quality_rating, delivery_time_avg,
                    contact_person, phone
                FROM suppliers
                WHERE is_deleted = false
                ORDER BY total_spent DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);

            logger.debug('Top suppliers retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting top suppliers', {
                error: error.message,
                limit
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete supplier
     * @param {string} id - Supplier ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE suppliers 
                SET is_deleted = true,
                    status = 'inactive',
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Supplier not found');
            }

            await db.commitTransaction(client);

            logger.info('Supplier soft deleted', {
                supplierId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting supplier', {
                error: error.message,
                supplierId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Supplier;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */