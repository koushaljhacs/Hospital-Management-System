/**
 * ======================================================================
 * FILE: backend/src/models/billing/InsuranceProvider.js
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
 * InsuranceProvider model for database operations.
 * Handles insurance company master data for claims and coverage.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: insurance_providers
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - name: string
 * - code: string (unique)
 * - type: enum (private, government, employer, travel, life, health)
 * - website: string
 * - logo_url: text
 * - established_date: date
 * - registration_number: string (unique)
 * - license_number: string
 * - tax_id: string
 * - contact_person: string
 * - phone: string
 * - alternate_phone: string
 * - email: string
 * - alternate_email: string
 * - address: text
 * - city: string
 * - state: string
 * - country: string
 * - postal_code: string
 * - coverage_percentage: decimal
 * - coverage_details: jsonb
 * - coverage_limits: jsonb
 * - exclusions: text
 * - pre_approval_required: boolean
 * - pre_approval_days: integer
 * - claim_deadline_days: integer
 * - max_claim_amount: decimal
 * - annual_maximum: decimal
 * - lifetime_maximum: decimal
 * - deductible_amount: decimal
 * - copay_percentage: decimal
 * - network_type: string
 * - network_providers: jsonb
 * - cashless_hospitals: jsonb
 * - is_cashless: boolean
 * - is_reimbursement: boolean
 * - policy_types: jsonb
 * - min_age: integer
 * - max_age: integer
 * - pre_existing_wait: integer
 * - maternity_coverage: boolean
 * - maternity_wait: integer
 * - daycare_procedures: boolean
 * - support_phone: string
 * - support_email: string
 * - emergency_phone: string
 * - claims_phone: string
 * - claims_email: string
 * - portal_url: string
 * - api_endpoint: string
 * - api_key_required: boolean
 * - agreement_start_date: date
 * - agreement_end_date: date
 * - agreement_document_url: text
 * - terms_conditions_url: text
 * - commission_percentage: decimal
 * - commission_structure: jsonb
 * - status: enum (active, inactive, blacklisted, pending_verification, suspended)
 * - is_preferred: boolean
 * - is_verified: boolean
 * - verified_by: uuid
 * - verified_at: timestamp
 * - blacklist_reason: text
 * - notes: text
 * - avg_claim_settlement_days: integer
 * - claim_settlement_ratio: decimal
 * - customer_rating: decimal
 * - total_policies: integer
 * - total_claims: integer
 * - total_settled_amount: decimal
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

const InsuranceProvider = {
    /**
     * Table name
     */
    tableName: 'insurance_providers',

    /**
     * Valid types
     */
    validTypes: ['private', 'government', 'employer', 'travel', 'life', 'health'],

    /**
     * Valid statuses
     */
    validStatuses: ['active', 'inactive', 'blacklisted', 'pending_verification', 'suspended'],

    /**
     * Generate provider code
     * @returns {Promise<string>} Generated provider code
     */
    async generateProviderCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM insurance_providers WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');
            return `INS-${sequence}`;
        } catch (error) {
            logger.error('Error generating provider code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find provider by ID
     * @param {string} id - Provider UUID
     * @returns {Promise<Object|null>} Provider object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ip.id, ip.name, ip.code, ip.type,
                    ip.website, ip.logo_url, ip.established_date,
                    ip.registration_number, ip.license_number, ip.tax_id,
                    ip.contact_person, ip.phone, ip.alternate_phone,
                    ip.email, ip.alternate_email,
                    ip.address, ip.city, ip.state, ip.country, ip.postal_code,
                    ip.coverage_percentage, ip.coverage_details, ip.coverage_limits,
                    ip.exclusions,
                    ip.pre_approval_required, ip.pre_approval_days,
                    ip.claim_deadline_days,
                    ip.max_claim_amount, ip.annual_maximum, ip.lifetime_maximum,
                    ip.deductible_amount, ip.copay_percentage,
                    ip.network_type, ip.network_providers, ip.cashless_hospitals,
                    ip.is_cashless, ip.is_reimbursement,
                    ip.policy_types,
                    ip.min_age, ip.max_age, ip.pre_existing_wait,
                    ip.maternity_coverage, ip.maternity_wait, ip.daycare_procedures,
                    ip.support_phone, ip.support_email, ip.emergency_phone,
                    ip.claims_phone, ip.claims_email, ip.portal_url,
                    ip.api_endpoint, ip.api_key_required,
                    ip.agreement_start_date, ip.agreement_end_date,
                    ip.agreement_document_url, ip.terms_conditions_url,
                    ip.commission_percentage, ip.commission_structure,
                    ip.status, ip.is_preferred, ip.is_verified,
                    ip.verified_by, ip.verified_at, ip.blacklist_reason,
                    ip.notes,
                    ip.avg_claim_settlement_days, ip.claim_settlement_ratio,
                    ip.customer_rating,
                    ip.total_policies, ip.total_claims, ip.total_settled_amount,
                    ip.created_at, ip.updated_at,
                    u.username as verified_by_name
                FROM insurance_providers ip
                LEFT JOIN users u ON ip.verified_by = u.id
                WHERE ip.id = $1 AND ip.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Insurance provider found by ID', { providerId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding insurance provider by ID', {
                error: error.message,
                providerId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find provider by code
     * @param {string} code - Provider code
     * @returns {Promise<Object|null>} Provider object or null
     */
    async findByCode(code) {
        try {
            const query = `
                SELECT id, name, code, type, status, is_verified
                FROM insurance_providers
                WHERE code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [code]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Insurance provider found by code', { code });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding insurance provider by code', {
                error: error.message,
                code
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all providers with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of providers
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.type) {
                conditions.push(`type = $${paramIndex++}`);
                values.push(filters.type);
            }
            if (filters.status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(filters.status);
            }
            if (filters.is_verified !== undefined) {
                conditions.push(`is_verified = $${paramIndex++}`);
                values.push(filters.is_verified);
            }
            if (filters.is_preferred !== undefined) {
                conditions.push(`is_preferred = $${paramIndex++}`);
                values.push(filters.is_preferred);
            }
            if (filters.is_cashless !== undefined) {
                conditions.push(`is_cashless = $${paramIndex++}`);
                values.push(filters.is_cashless);
            }
            if (filters.search) {
                conditions.push(`(name ILIKE $${paramIndex++} OR code ILIKE $${paramIndex++})`);
                const searchTerm = `%${filters.search}%`;
                values.push(searchTerm, searchTerm);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, name, code, type,
                    phone, email, city,
                    coverage_percentage,
                    is_cashless, is_preferred, is_verified,
                    status, customer_rating,
                    created_at
                FROM insurance_providers
                ${whereClause}
                ORDER BY name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all insurance providers', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all insurance providers', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active providers (for dropdowns)
     * @returns {Promise<Array>} List of active providers
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, name, code, type,
                    coverage_percentage, is_cashless,
                    customer_rating
                FROM insurance_providers
                WHERE status = 'active' AND is_verified = true AND is_deleted = false
                ORDER BY name ASC
            `;

            const result = await db.query(query);

            logger.debug('Active insurance providers retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active insurance providers', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new insurance provider
     * @param {Object} providerData - Provider data
     * @returns {Promise<Object>} Created provider
     */
    async create(providerData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (providerData.type && !this.validTypes.includes(providerData.type)) {
                throw new Error(`Invalid type. Must be one of: ${this.validTypes.join(', ')}`);
            }
            if (providerData.status && !this.validStatuses.includes(providerData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const providerCode = providerData.code || await this.generateProviderCode();

            const query = `
                INSERT INTO insurance_providers (
                    id, name, code, type,
                    website, logo_url, established_date,
                    registration_number, license_number, tax_id,
                    contact_person, phone, alternate_phone,
                    email, alternate_email,
                    address, city, state, country, postal_code,
                    coverage_percentage, coverage_details, coverage_limits,
                    exclusions,
                    pre_approval_required, pre_approval_days,
                    claim_deadline_days,
                    max_claim_amount, annual_maximum, lifetime_maximum,
                    deductible_amount, copay_percentage,
                    network_type, network_providers, cashless_hospitals,
                    is_cashless, is_reimbursement,
                    policy_types,
                    min_age, max_age, pre_existing_wait,
                    maternity_coverage, maternity_wait, daycare_procedures,
                    support_phone, support_email, emergency_phone,
                    claims_phone, claims_email, portal_url,
                    api_endpoint, api_key_required,
                    agreement_start_date, agreement_end_date,
                    agreement_document_url, terms_conditions_url,
                    commission_percentage, commission_structure,
                    status, is_preferred, is_verified,
                    notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    $10, $11, $12,
                    $13, $14,
                    $15, $16, $17, $18, $19,
                    $20, $21, $22,
                    $23,
                    $24, $25,
                    $26,
                    $27, $28, $29,
                    $30, $31,
                    $32, $33, $34,
                    $35, $36,
                    $37,
                    $38, $39, $40,
                    $41, $42, $43,
                    $44, $45, $46,
                    $47, $48, $49,
                    $50, $51,
                    $52, $53,
                    $54, $55,
                    $56, $57,
                    $58,
                    $59, NOW(), NOW()
                )
                RETURNING 
                    id, name, code, type,
                    status, is_verified, created_at
            `;

            const values = [
                providerData.name,
                providerCode,
                providerData.type,
                providerData.website || null,
                providerData.logo_url || null,
                providerData.established_date || null,
                providerData.registration_number || null,
                providerData.license_number || null,
                providerData.tax_id || null,
                providerData.contact_person || null,
                providerData.phone,
                providerData.alternate_phone || null,
                providerData.email || null,
                providerData.alternate_email || null,
                providerData.address || null,
                providerData.city || null,
                providerData.state || null,
                providerData.country || 'India',
                providerData.postal_code || null,
                providerData.coverage_percentage || null,
                providerData.coverage_details || null,
                providerData.coverage_limits || null,
                providerData.exclusions || null,
                providerData.pre_approval_required || false,
                providerData.pre_approval_days || null,
                providerData.claim_deadline_days || null,
                providerData.max_claim_amount || null,
                providerData.annual_maximum || null,
                providerData.lifetime_maximum || null,
                providerData.deductible_amount || 0,
                providerData.copay_percentage || 0,
                providerData.network_type || null,
                providerData.network_providers || null,
                providerData.cashless_hospitals || null,
                providerData.is_cashless || true,
                providerData.is_reimbursement || true,
                providerData.policy_types || null,
                providerData.min_age || 0,
                providerData.max_age || 100,
                providerData.pre_existing_wait || 0,
                providerData.maternity_coverage || false,
                providerData.maternity_wait || 0,
                providerData.daycare_procedures || true,
                providerData.support_phone || null,
                providerData.support_email || null,
                providerData.emergency_phone || null,
                providerData.claims_phone || null,
                providerData.claims_email || null,
                providerData.portal_url || null,
                providerData.api_endpoint || null,
                providerData.api_key_required || false,
                providerData.agreement_start_date || null,
                providerData.agreement_end_date || null,
                providerData.agreement_document_url || null,
                providerData.terms_conditions_url || null,
                providerData.commission_percentage || 0,
                providerData.commission_structure || null,
                providerData.status || 'pending_verification',
                providerData.is_preferred || false,
                providerData.is_verified || false,
                providerData.notes || null,
                providerData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Insurance provider created', {
                providerId: result.rows[0].id,
                name: providerData.name,
                code: providerCode
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating insurance provider', {
                error: error.message,
                name: providerData.name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update insurance provider
     * @param {string} id - Provider ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated provider
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'name', 'type', 'website', 'logo_url', 'established_date',
                'registration_number', 'license_number', 'tax_id',
                'contact_person', 'phone', 'alternate_phone',
                'email', 'alternate_email', 'address', 'city', 'state',
                'country', 'postal_code', 'coverage_percentage',
                'coverage_details', 'coverage_limits', 'exclusions',
                'pre_approval_required', 'pre_approval_days',
                'claim_deadline_days', 'max_claim_amount', 'annual_maximum',
                'lifetime_maximum', 'deductible_amount', 'copay_percentage',
                'network_type', 'network_providers', 'cashless_hospitals',
                'is_cashless', 'is_reimbursement', 'policy_types',
                'min_age', 'max_age', 'pre_existing_wait',
                'maternity_coverage', 'maternity_wait', 'daycare_procedures',
                'support_phone', 'support_email', 'emergency_phone',
                'claims_phone', 'claims_email', 'portal_url',
                'api_endpoint', 'api_key_required',
                'agreement_start_date', 'agreement_end_date',
                'agreement_document_url', 'terms_conditions_url',
                'commission_percentage', 'commission_structure',
                'status', 'is_preferred', 'notes',
                'avg_claim_settlement_days', 'claim_settlement_ratio',
                'customer_rating', 'total_policies', 'total_claims',
                'total_settled_amount'
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
                UPDATE insurance_providers 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, name, code, status,
                    is_verified, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Insurance provider not found');
            }

            await db.commitTransaction(client);

            logger.info('Insurance provider updated', {
                providerId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating insurance provider', {
                error: error.message,
                providerId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Verify insurance provider
     * @param {string} id - Provider ID
     * @param {string} verifiedBy - User who verified
     * @returns {Promise<Object>} Updated provider
     */
    async verify(id, verifiedBy) {
        return this.update(id, {
            is_verified: true,
            status: 'active',
            verified_by: verifiedBy,
            verified_at: new Date(),
            updated_by: verifiedBy
        });
    },

    /**
     * Blacklist provider
     * @param {string} id - Provider ID
     * @param {string} blacklistedBy - User who blacklisted
     * @param {string} reason - Blacklist reason
     * @returns {Promise<Object>} Updated provider
     */
    async blacklist(id, blacklistedBy, reason) {
        return this.update(id, {
            status: 'blacklisted',
            is_verified: false,
            blacklist_reason: reason,
            updated_by: blacklistedBy
        });
    },

    /**
     * Update provider statistics
     * @param {string} id - Provider ID
     * @param {Object} stats - Statistics to update
     * @returns {Promise<Object>} Updated provider
     */
    async updateStatistics(id, stats) {
        const updates = {};
        if (stats.claim_settlement_days !== undefined) {
            updates.avg_claim_settlement_days = stats.claim_settlement_days;
        }
        if (stats.claim_settlement_ratio !== undefined) {
            updates.claim_settlement_ratio = stats.claim_settlement_ratio;
        }
        if (stats.customer_rating !== undefined) {
            updates.customer_rating = stats.customer_rating;
        }
        if (stats.total_policies !== undefined) {
            updates.total_policies = stats.total_policies;
        }
        if (stats.total_claims !== undefined) {
            updates.total_claims = stats.total_claims;
        }
        if (stats.total_settled_amount !== undefined) {
            updates.total_settled_amount = stats.total_settled_amount;
        }
        return this.update(id, updates);
    },

    /**
     * Get provider statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_providers,
                    COUNT(*) FILTER (WHERE status = 'active') as active,
                    COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
                    COUNT(*) FILTER (WHERE status = 'blacklisted') as blacklisted,
                    COUNT(*) FILTER (WHERE is_verified = true) as verified,
                    COUNT(*) FILTER (WHERE is_preferred = true) as preferred,
                    COUNT(*) FILTER (WHERE is_cashless = true) as cashless,
                    COUNT(DISTINCT type) as types_covered,
                    AVG(coverage_percentage)::numeric(10,2) as avg_coverage,
                    AVG(customer_rating)::numeric(10,2) as avg_rating,
                    SUM(total_policies) as total_policies,
                    SUM(total_claims) as total_claims,
                    SUM(total_settled_amount) as total_settled
                FROM insurance_providers
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Insurance provider statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting insurance provider statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search providers
     * @param {string} searchTerm - Search term (name, code, contact)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of providers
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, name, code, type,
                    phone, email, city,
                    coverage_percentage, is_cashless,
                    status, customer_rating
                FROM insurance_providers
                WHERE (name ILIKE $1 
                    OR code ILIKE $1
                    OR contact_person ILIKE $1
                    OR phone ILIKE $1)
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

            logger.debug('Insurance provider search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching insurance providers', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete insurance provider
     * @param {string} id - Provider ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE insurance_providers 
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
                throw new Error('Insurance provider not found');
            }

            await db.commitTransaction(client);

            logger.info('Insurance provider soft deleted', {
                providerId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting insurance provider', {
                error: error.message,
                providerId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = InsuranceProvider;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */