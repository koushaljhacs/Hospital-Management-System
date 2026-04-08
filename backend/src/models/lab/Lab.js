/**
 * ======================================================================
 * FILE: backend/src/models/lab/Lab.js
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
 * Lab model for database operations.
 * Handles laboratory master data including location, accreditations, and services.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: labs
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - lab_code: string (unique)
 * - lab_name: string
 * - lab_type: enum (in_house, reference, external, partner, mobile)
 * - address: text
 * - city: string
 * - state: string
 * - country: string
 * - postal_code: string
 * - phone: string
 * - alternate_phone: string
 * - email: string
 * - website: string
 * - contact_person: string
 * - contact_person_phone: string
 * - contact_person_email: string
 * - contact_person_designation: string
 * - registration_number: string (unique)
 * - license_number: string
 * - accreditation: string
 * - established_date: date
 * - nabl_accredited: boolean
 * - nabl_certificate_url: text
 * - department_id: UUID
 * - floor: integer
 * - building: string
 * - has_emergency_service: boolean
 * - has_home_collection: boolean
 * - operating_hours: jsonb
 * - holiday_list: jsonb
 * - services_offered: jsonb
 * - test_categories: jsonb
 * - equipment_list: jsonb
 * - total_technicians: integer
 * - accreditations: jsonb
 * - certifications: jsonb
 * - certificates_url: text[]
 * - contract_start_date: date
 * - contract_end_date: date
 * - contract_document_url: text
 * - agreement_terms: text
 * - commission_percentage: decimal
 * - payment_terms: string
 * - avg_turnaround_time: integer
 * - total_tests_per_day: integer
 * - max_tests_per_day: integer
 * - quality_rating: decimal
 * - customer_rating: decimal
 * - is_active: boolean
 * - is_preferred: boolean
 * - is_verified: boolean
 * - verified_by: uuid
 * - verified_at: timestamp
 * - blacklist_reason: text
 * - notes: text
 * - internal_notes: text
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

const Lab = {
    /**
     * Table name
     */
    tableName: 'labs',

    /**
     * Valid lab types
     */
    validLabTypes: ['in_house', 'reference', 'external', 'partner', 'mobile'],

    /**
     * Generate lab code
     * @returns {Promise<string>} Generated lab code
     */
    async generateLabCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM labs WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');
            return `LAB-${sequence}`;
        } catch (error) {
            logger.error('Error generating lab code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find lab by ID
     * @param {string} id - Lab UUID
     * @returns {Promise<Object|null>} Lab object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    l.id, l.lab_code, l.lab_name, l.lab_type,
                    l.address, l.city, l.state, l.country, l.postal_code,
                    l.phone, l.alternate_phone, l.email, l.website,
                    l.contact_person, l.contact_person_phone,
                    l.contact_person_email, l.contact_person_designation,
                    l.registration_number, l.license_number, l.accreditation,
                    l.established_date, l.nabl_accredited, l.nabl_certificate_url,
                    l.department_id, l.floor, l.building,
                    l.has_emergency_service, l.has_home_collection,
                    l.operating_hours, l.holiday_list,
                    l.services_offered, l.test_categories, l.equipment_list,
                    l.total_technicians,
                    l.accreditations, l.certifications, l.certificates_url,
                    l.contract_start_date, l.contract_end_date,
                    l.contract_document_url, l.agreement_terms,
                    l.commission_percentage, l.payment_terms,
                    l.avg_turnaround_time, l.total_tests_per_day,
                    l.max_tests_per_day, l.quality_rating, l.customer_rating,
                    l.is_active, l.is_preferred, l.is_verified,
                    l.verified_by, l.verified_at, l.blacklist_reason,
                    l.notes, l.internal_notes, l.metadata,
                    l.created_at, l.updated_at,
                    d.name as department_name,
                    u.username as verified_by_name
                FROM labs l
                LEFT JOIN departments d ON l.department_id = d.id
                LEFT JOIN users u ON l.verified_by = u.id
                WHERE l.id = $1 AND l.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab found by ID', { labId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab by ID', {
                error: error.message,
                labId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find lab by code
     * @param {string} labCode - Lab code
     * @returns {Promise<Object|null>} Lab object or null
     */
    async findByCode(labCode) {
        try {
            const query = `
                SELECT id, lab_code, lab_name, lab_type,
                       phone, email, is_active
                FROM labs
                WHERE lab_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [labCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab found by code', { labCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab by code', {
                error: error.message,
                labCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all labs with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of labs
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.lab_type) {
                conditions.push(`lab_type = $${paramIndex++}`);
                values.push(filters.lab_type);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }
            if (filters.is_verified !== undefined) {
                conditions.push(`is_verified = $${paramIndex++}`);
                values.push(filters.is_verified);
            }
            if (filters.city) {
                conditions.push(`city ILIKE $${paramIndex++}`);
                values.push(`%${filters.city}%`);
            }
            if (filters.nabl_accredited !== undefined) {
                conditions.push(`nabl_accredited = $${paramIndex++}`);
                values.push(filters.nabl_accredited);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, lab_code, lab_name, lab_type,
                    city, state, phone, email,
                    nabl_accredited, total_technicians,
                    avg_turnaround_time, quality_rating,
                    is_active, is_verified, is_preferred,
                    created_at
                FROM labs
                ${whereClause}
                ORDER BY lab_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all labs', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all labs', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active labs (for dropdowns)
     * @returns {Promise<Array>} List of active labs
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, lab_code, lab_name, lab_type,
                    phone, email, city,
                    nabl_accredited, avg_turnaround_time
                FROM labs
                WHERE is_active = true AND is_verified = true AND is_deleted = false
                ORDER BY lab_name ASC
            `;

            const result = await db.query(query);

            logger.debug('Active labs retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active labs', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new lab
     * @param {Object} labData - Lab data
     * @returns {Promise<Object>} Created lab
     */
    async create(labData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (labData.lab_type && !this.validLabTypes.includes(labData.lab_type)) {
                throw new Error(`Invalid lab type. Must be one of: ${this.validLabTypes.join(', ')}`);
            }

            const labCode = labData.lab_code || await this.generateLabCode();

            const query = `
                INSERT INTO labs (
                    id, lab_code, lab_name, lab_type,
                    address, city, state, country, postal_code,
                    phone, alternate_phone, email, website,
                    contact_person, contact_person_phone,
                    contact_person_email, contact_person_designation,
                    registration_number, license_number, accreditation,
                    established_date, nabl_accredited, nabl_certificate_url,
                    department_id, floor, building,
                    has_emergency_service, has_home_collection,
                    operating_hours, holiday_list,
                    services_offered, test_categories, equipment_list,
                    total_technicians,
                    accreditations, certifications, certificates_url,
                    contract_start_date, contract_end_date,
                    contract_document_url, agreement_terms,
                    commission_percentage, payment_terms,
                    avg_turnaround_time, total_tests_per_day, max_tests_per_day,
                    quality_rating, customer_rating,
                    is_active, is_preferred, is_verified,
                    notes, internal_notes, metadata,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6, $7, $8,
                    $9, $10, $11, $12,
                    $13, $14, $15, $16,
                    $17, $18, $19,
                    $20, COALESCE($21, false), $22,
                    $23, $24, $25,
                    COALESCE($26, false), COALESCE($27, false),
                    $28, $29,
                    $30, $31, $32,
                    $33,
                    $34, $35, $36,
                    $37, $38, $39, $40,
                    $41, $42,
                    $43, $44, $45,
                    $46, $47,
                    COALESCE($48, true), COALESCE($49, false), COALESCE($50, false),
                    $51, $52, $53,
                    $54, NOW(), NOW()
                )
                RETURNING 
                    id, lab_code, lab_name, lab_type,
                    phone, email, is_active, created_at
            `;

            const values = [
                labCode,
                labData.lab_name,
                labData.lab_type,
                labData.address || null,
                labData.city || null,
                labData.state || null,
                labData.country || 'India',
                labData.postal_code || null,
                labData.phone,
                labData.alternate_phone || null,
                labData.email || null,
                labData.website || null,
                labData.contact_person || null,
                labData.contact_person_phone || null,
                labData.contact_person_email || null,
                labData.contact_person_designation || null,
                labData.registration_number || null,
                labData.license_number || null,
                labData.accreditation || null,
                labData.established_date || null,
                labData.nabl_accredited,
                labData.nabl_certificate_url || null,
                labData.department_id || null,
                labData.floor || null,
                labData.building || null,
                labData.has_emergency_service,
                labData.has_home_collection,
                labData.operating_hours || null,
                labData.holiday_list || null,
                labData.services_offered || null,
                labData.test_categories || null,
                labData.equipment_list || null,
                labData.total_technicians || 0,
                labData.accreditations || null,
                labData.certifications || null,
                labData.certificates_url || null,
                labData.contract_start_date || null,
                labData.contract_end_date || null,
                labData.contract_document_url || null,
                labData.agreement_terms || null,
                labData.commission_percentage || 0,
                labData.payment_terms || null,
                labData.avg_turnaround_time || null,
                labData.total_tests_per_day || 0,
                labData.max_tests_per_day || 0,
                labData.quality_rating || null,
                labData.customer_rating || null,
                labData.is_active,
                labData.is_preferred,
                labData.is_verified,
                labData.notes || null,
                labData.internal_notes || null,
                labData.metadata || null,
                labData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Lab created successfully', {
                labId: result.rows[0].id,
                labCode,
                labName: labData.lab_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating lab', {
                error: error.message,
                labName: labData.lab_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update lab
     * @param {string} id - Lab ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated lab
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'lab_name', 'lab_type', 'address', 'city', 'state',
                'country', 'postal_code', 'phone', 'alternate_phone',
                'email', 'website', 'contact_person', 'contact_person_phone',
                'contact_person_email', 'contact_person_designation',
                'registration_number', 'license_number', 'accreditation',
                'established_date', 'nabl_accredited', 'nabl_certificate_url',
                'department_id', 'floor', 'building',
                'has_emergency_service', 'has_home_collection',
                'operating_hours', 'holiday_list',
                'services_offered', 'test_categories', 'equipment_list',
                'total_technicians', 'accreditations', 'certifications',
                'certificates_url', 'contract_start_date', 'contract_end_date',
                'contract_document_url', 'agreement_terms',
                'commission_percentage', 'payment_terms',
                'avg_turnaround_time', 'total_tests_per_day', 'max_tests_per_day',
                'quality_rating', 'customer_rating',
                'is_active', 'is_preferred', 'is_verified',
                'verified_by', 'verified_at', 'blacklist_reason',
                'notes', 'internal_notes', 'metadata'
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
                UPDATE labs 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, lab_code, lab_name, lab_type,
                    is_active, is_verified, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Lab not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab updated', {
                labId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating lab', {
                error: error.message,
                labId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Verify lab (set verified status)
     * @param {string} id - Lab ID
     * @param {string} verifiedBy - User who verified
     * @returns {Promise<Object>} Updated lab
     */
    async verify(id, verifiedBy) {
        return this.update(id, {
            is_verified: true,
            verified_by: verifiedBy,
            verified_at: new Date(),
            updated_by: verifiedBy
        });
    },

    /**
     * Blacklist lab
     * @param {string} id - Lab ID
     * @param {string} blacklistedBy - User who blacklisted
     * @param {string} reason - Blacklist reason
     * @returns {Promise<Object>} Updated lab
     */
    async blacklist(id, blacklistedBy, reason) {
        return this.update(id, {
            is_active: false,
            is_verified: false,
            blacklist_reason: reason,
            updated_by: blacklistedBy
        });
    },

    /**
     * Get lab statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_labs,
                    COUNT(*) FILTER (WHERE lab_type = 'in_house') as in_house,
                    COUNT(*) FILTER (WHERE lab_type = 'reference') as reference,
                    COUNT(*) FILTER (WHERE lab_type = 'external') as external,
                    COUNT(*) FILTER (WHERE lab_type = 'partner') as partner,
                    COUNT(*) FILTER (WHERE lab_type = 'mobile') as mobile,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE is_verified = true) as verified,
                    COUNT(*) FILTER (WHERE is_preferred = true) as preferred,
                    COUNT(*) FILTER (WHERE nabl_accredited = true) as nabl_accredited,
                    SUM(total_technicians) as total_technicians,
                    AVG(quality_rating)::numeric(10,2) as avg_quality_rating,
                    AVG(avg_turnaround_time)::numeric(10,2) as avg_turnaround_time
                FROM labs
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Lab statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting lab statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search labs
     * @param {string} searchTerm - Search term (name, code, city)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of labs
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, lab_code, lab_name, lab_type,
                    city, phone, email,
                    nabl_accredited, quality_rating,
                    is_active, is_verified
                FROM labs
                WHERE (lab_name ILIKE $1 
                    OR lab_code ILIKE $1
                    OR city ILIKE $1
                    OR contact_person ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN lab_name ILIKE $2 THEN 1
                        WHEN lab_code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    lab_name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Lab search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching labs', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete lab
     * @param {string} id - Lab ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE labs 
                SET is_deleted = true,
                    is_active = false,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Lab not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab soft deleted', {
                labId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting lab', {
                error: error.message,
                labId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Lab;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */