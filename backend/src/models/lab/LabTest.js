/**
 * ======================================================================
 * FILE: backend/src/models/lab/LabTest.js
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
 * LabTest model for database operations.
 * Handles laboratory test master data including reference ranges and pricing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: lab_tests
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - test_code: string (unique)
 * - test_name: string
 * - short_name: string
 * - category: enum (hematology, biochemistry, microbiology, pathology, immunology, serology, toxicology, genetics, molecular, urinalysis, stool_analysis, hormones, tumor_markers, cardiac_markers, infectious_diseases, drug_monitoring, allergy_testing, prenatal_screening, newborn_screening, other)
 * - department_id: UUID
 * - description: text
 * - methodology: string
 * - sample_type: enum (blood, serum, plasma, urine, stool, sputum, csf, tissue, swab, aspirate, fluid, hair, nail, saliva, semen, amniotic_fluid, bone_marrow, other)
 * - sample_volume: string
 * - sample_container: string
 * - storage_conditions: text
 * - transport_conditions: text
 * - turnaround_time_hours: integer
 * - fasting_required: boolean
 * - fasting_hours: integer
 * - special_preparation: text
 * - normal_range: text
 * - normal_range_low: decimal
 * - normal_range_high: decimal
 * - critical_low_value: decimal
 * - critical_high_value: decimal
 * - panic_low_value: decimal
 * - panic_high_value: decimal
 * - unit: string
 * - unit_description: text
 * - gender_specific: boolean
 * - applicable_gender: enum (male, female, other, all)
 * - age_low_limit: integer
 * - age_high_limit: integer
 * - reference_ranges_by_age: jsonb
 * - reference_ranges_by_gender: jsonb
 * - reference_ranges_by_age_gender: jsonb
 * - price: decimal
 * - discounted_price: decimal
 * - insurance_coverage: boolean
 * - cgst_percentage: decimal
 * - sgst_percentage: decimal
 * - igst_percentage: decimal
 * - total_tax_percentage: decimal (generated)
 * - price_with_tax: decimal (generated)
 * - hcpcs_code: string
 * - cpt_code: string
 * - loinc_code: string
 * - snomed_code: string
 * - internal_code: string
 * - instrument_name: string
 * - instrument_id: UUID
 * - equipment_required: jsonb
 * - qc_required: boolean
 * - qc_frequency: string
 * - qc_parameters: jsonb
 * - calibration_required: boolean
 * - calibration_frequency: string
 * - interpretation_guidelines: text
 * - clinical_significance: text
 * - differential_diagnosis: text
 * - reflex_testing_rules: jsonb
 * - is_active: boolean
 * - is_available: boolean
 * - available_days: jsonb
 * - available_time_start: time
 * - available_time_end: time
 * - max_orders_per_day: integer
 * - requires_approval: boolean
 * - approval_level: integer
 * - instruction_sheet_url: text
 * - consent_form_url: text
 * - report_template_url: text
 * - supporting_documents: jsonb
 * - tags: text[]
 * - search_keywords: text
 * - synonyms: text[]
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

const LabTest = {
    /**
     * Table name
     */
    tableName: 'lab_tests',

    /**
     * Valid categories
     */
    validCategories: [
        'hematology', 'biochemistry', 'microbiology', 'pathology',
        'immunology', 'serology', 'toxicology', 'genetics', 'molecular',
        'urinalysis', 'stool_analysis', 'hormones', 'tumor_markers',
        'cardiac_markers', 'infectious_diseases', 'drug_monitoring',
        'allergy_testing', 'prenatal_screening', 'newborn_screening', 'other'
    ],

    /**
     * Valid sample types
     */
    validSampleTypes: [
        'blood', 'serum', 'plasma', 'urine', 'stool', 'sputum', 'csf',
        'tissue', 'swab', 'aspirate', 'fluid', 'hair', 'nail', 'saliva',
        'semen', 'amniotic_fluid', 'bone_marrow', 'other'
    ],

    /**
     * Valid genders for reference ranges
     */
    validGenders: ['male', 'female', 'other', 'all'],

    /**
     * Generate test code
     * @returns {Promise<string>} Generated test code
     */
    async generateTestCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM lab_tests WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');
            return `LT-${sequence}`;
        } catch (error) {
            logger.error('Error generating test code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find lab test by ID
     * @param {string} id - Lab test UUID
     * @returns {Promise<Object|null>} Lab test object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    lt.id, lt.test_code, lt.test_name, lt.short_name,
                    lt.category, lt.department_id, lt.description,
                    lt.methodology, lt.sample_type, lt.sample_volume,
                    lt.sample_container, lt.storage_conditions,
                    lt.transport_conditions, lt.turnaround_time_hours,
                    lt.fasting_required, lt.fasting_hours,
                    lt.special_preparation,
                    lt.normal_range, lt.normal_range_low, lt.normal_range_high,
                    lt.critical_low_value, lt.critical_high_value,
                    lt.panic_low_value, lt.panic_high_value,
                    lt.unit, lt.unit_description,
                    lt.gender_specific, lt.applicable_gender,
                    lt.age_low_limit, lt.age_high_limit,
                    lt.reference_ranges_by_age, lt.reference_ranges_by_gender,
                    lt.reference_ranges_by_age_gender,
                    lt.price, lt.discounted_price, lt.insurance_coverage,
                    lt.cgst_percentage, lt.sgst_percentage, lt.igst_percentage,
                    lt.total_tax_percentage, lt.price_with_tax,
                    lt.hcpcs_code, lt.cpt_code, lt.loinc_code,
                    lt.snomed_code, lt.internal_code,
                    lt.instrument_name, lt.instrument_id,
                    lt.equipment_required,
                    lt.qc_required, lt.qc_frequency, lt.qc_parameters,
                    lt.calibration_required, lt.calibration_frequency,
                    lt.interpretation_guidelines, lt.clinical_significance,
                    lt.differential_diagnosis, lt.reflex_testing_rules,
                    lt.is_active, lt.is_available,
                    lt.available_days, lt.available_time_start, lt.available_time_end,
                    lt.max_orders_per_day, lt.requires_approval, lt.approval_level,
                    lt.instruction_sheet_url, lt.consent_form_url,
                    lt.report_template_url, lt.supporting_documents,
                    lt.tags, lt.search_keywords, lt.synonyms,
                    lt.created_at, lt.updated_at,
                    d.name as department_name
                FROM lab_tests lt
                LEFT JOIN departments d ON lt.department_id = d.id
                WHERE lt.id = $1 AND lt.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab test found by ID', { testId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab test by ID', {
                error: error.message,
                testId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find lab test by code
     * @param {string} testCode - Test code
     * @returns {Promise<Object|null>} Lab test object or null
     */
    async findByCode(testCode) {
        try {
            const query = `
                SELECT 
                    id, test_code, test_name, short_name,
                    category, price, is_active, is_available
                FROM lab_tests
                WHERE test_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [testCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab test found by code', { testCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab test by code', {
                error: error.message,
                testCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all lab tests with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of lab tests
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.category) {
                conditions.push(`category = $${paramIndex++}`);
                values.push(filters.category);
            }
            if (filters.sample_type) {
                conditions.push(`sample_type = $${paramIndex++}`);
                values.push(filters.sample_type);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }
            if (filters.is_available !== undefined) {
                conditions.push(`is_available = $${paramIndex++}`);
                values.push(filters.is_available);
            }
            if (filters.search) {
                conditions.push(`(test_name ILIKE $${paramIndex++} OR short_name ILIKE $${paramIndex++} OR test_code ILIKE $${paramIndex++})`);
                const searchTerm = `%${filters.search}%`;
                values.push(searchTerm, searchTerm, searchTerm);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, test_code, test_name, short_name,
                    category, sample_type, turnaround_time_hours,
                    price, discounted_price, price_with_tax,
                    is_active, is_available, created_at
                FROM lab_tests
                ${whereClause}
                ORDER BY test_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all lab tests', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all lab tests', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active lab tests (for dropdowns/ordering)
     * @returns {Promise<Array>} List of active tests
     */
    async getActive() {
        try {
            const query = `
                SELECT 
                    id, test_code, test_name, short_name,
                    category, sample_type, price,
                    turnaround_time_hours, fasting_required
                FROM lab_tests
                WHERE is_active = true AND is_available = true AND is_deleted = false
                ORDER BY test_name ASC
            `;

            const result = await db.query(query);

            logger.debug('Active lab tests retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active lab tests', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new lab test
     * @param {Object} testData - Lab test data
     * @returns {Promise<Object>} Created lab test
     */
    async create(testData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (testData.category && !this.validCategories.includes(testData.category)) {
                throw new Error(`Invalid category. Must be one of: ${this.validCategories.join(', ')}`);
            }

            if (testData.sample_type && !this.validSampleTypes.includes(testData.sample_type)) {
                throw new Error(`Invalid sample type. Must be one of: ${this.validSampleTypes.join(', ')}`);
            }

            if (testData.applicable_gender && !this.validGenders.includes(testData.applicable_gender)) {
                throw new Error(`Invalid applicable gender. Must be one of: ${this.validGenders.join(', ')}`);
            }

            const testCode = testData.test_code || await this.generateTestCode();

            const query = `
                INSERT INTO lab_tests (
                    id, test_code, test_name, short_name,
                    category, department_id, description,
                    methodology, sample_type, sample_volume,
                    sample_container, storage_conditions,
                    transport_conditions, turnaround_time_hours,
                    fasting_required, fasting_hours, special_preparation,
                    normal_range, normal_range_low, normal_range_high,
                    critical_low_value, critical_high_value,
                    panic_low_value, panic_high_value,
                    unit, unit_description,
                    gender_specific, applicable_gender,
                    age_low_limit, age_high_limit,
                    reference_ranges_by_age, reference_ranges_by_gender,
                    reference_ranges_by_age_gender,
                    price, discounted_price, insurance_coverage,
                    cgst_percentage, sgst_percentage, igst_percentage,
                    hcpcs_code, cpt_code, loinc_code,
                    snomed_code, internal_code,
                    instrument_name, instrument_id,
                    equipment_required,
                    qc_required, qc_frequency, qc_parameters,
                    calibration_required, calibration_frequency,
                    interpretation_guidelines, clinical_significance,
                    differential_diagnosis, reflex_testing_rules,
                    is_active, is_available,
                    available_days, available_time_start, available_time_end,
                    max_orders_per_day, requires_approval, approval_level,
                    instruction_sheet_url, consent_form_url,
                    report_template_url, supporting_documents,
                    tags, search_keywords, synonyms,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    $10, $11,
                    $12, $13,
                    COALESCE($14, false), $15, $16,
                    $17, $18, $19,
                    $20, $21,
                    $22, $23,
                    $24, $25,
                    COALESCE($26, false), $27,
                    $28, $29,
                    $30, $31, $32,
                    $33, $34, COALESCE($35, true),
                    COALESCE($36, 0), COALESCE($37, 0), COALESCE($38, 0),
                    $39, $40, $41,
                    $42, $43,
                    $44, $45,
                    $46,
                    COALESCE($47, true), $48, $49,
                    COALESCE($50, false), $51,
                    $52, $53, $54, $55,
                    COALESCE($56, true), COALESCE($57, true),
                    $58, $59, $60,
                    $61, COALESCE($62, false), $63,
                    $64, $65, $66, $67,
                    $68, $69, $70,
                    $71, NOW(), NOW()
                )
                RETURNING 
                    id, test_code, test_name, category,
                    sample_type, price, is_active,
                    created_at
            `;

            const values = [
                testCode,
                testData.test_name,
                testData.short_name || null,
                testData.category,
                testData.department_id || null,
                testData.description || null,
                testData.methodology || null,
                testData.sample_type,
                testData.sample_volume || null,
                testData.sample_container || null,
                testData.storage_conditions || null,
                testData.transport_conditions || null,
                testData.turnaround_time_hours || null,
                testData.fasting_required,
                testData.fasting_hours || null,
                testData.special_preparation || null,
                testData.normal_range || null,
                testData.normal_range_low || null,
                testData.normal_range_high || null,
                testData.critical_low_value || null,
                testData.critical_high_value || null,
                testData.panic_low_value || null,
                testData.panic_high_value || null,
                testData.unit || null,
                testData.unit_description || null,
                testData.gender_specific,
                testData.applicable_gender || null,
                testData.age_low_limit || null,
                testData.age_high_limit || null,
                testData.reference_ranges_by_age || null,
                testData.reference_ranges_by_gender || null,
                testData.reference_ranges_by_age_gender || null,
                testData.price,
                testData.discounted_price || null,
                testData.insurance_coverage,
                testData.cgst_percentage,
                testData.sgst_percentage,
                testData.igst_percentage,
                testData.hcpcs_code || null,
                testData.cpt_code || null,
                testData.loinc_code || null,
                testData.snomed_code || null,
                testData.internal_code || null,
                testData.instrument_name || null,
                testData.instrument_id || null,
                testData.equipment_required || null,
                testData.qc_required,
                testData.qc_frequency || null,
                testData.qc_parameters || null,
                testData.calibration_required,
                testData.calibration_frequency || null,
                testData.interpretation_guidelines || null,
                testData.clinical_significance || null,
                testData.differential_diagnosis || null,
                testData.reflex_testing_rules || null,
                testData.is_active,
                testData.is_available,
                testData.available_days || null,
                testData.available_time_start || null,
                testData.available_time_end || null,
                testData.max_orders_per_day || null,
                testData.requires_approval,
                testData.approval_level || 0,
                testData.instruction_sheet_url || null,
                testData.consent_form_url || null,
                testData.report_template_url || null,
                testData.supporting_documents || null,
                testData.tags || null,
                testData.search_keywords || null,
                testData.synonyms || null,
                testData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Lab test created successfully', {
                testId: result.rows[0].id,
                testCode: result.rows[0].test_code,
                testName: testData.test_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating lab test', {
                error: error.message,
                testName: testData.test_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update lab test
     * @param {string} id - Lab test ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated lab test
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'test_name', 'short_name', 'category', 'department_id',
                'description', 'methodology', 'sample_type', 'sample_volume',
                'sample_container', 'storage_conditions', 'transport_conditions',
                'turnaround_time_hours', 'fasting_required', 'fasting_hours',
                'special_preparation', 'normal_range', 'normal_range_low',
                'normal_range_high', 'critical_low_value', 'critical_high_value',
                'panic_low_value', 'panic_high_value', 'unit', 'unit_description',
                'gender_specific', 'applicable_gender', 'age_low_limit',
                'age_high_limit', 'reference_ranges_by_age',
                'reference_ranges_by_gender', 'reference_ranges_by_age_gender',
                'price', 'discounted_price', 'insurance_coverage',
                'cgst_percentage', 'sgst_percentage', 'igst_percentage',
                'hcpcs_code', 'cpt_code', 'loinc_code', 'snomed_code',
                'internal_code', 'instrument_name', 'instrument_id',
                'equipment_required', 'qc_required', 'qc_frequency',
                'qc_parameters', 'calibration_required', 'calibration_frequency',
                'interpretation_guidelines', 'clinical_significance',
                'differential_diagnosis', 'reflex_testing_rules',
                'is_active', 'is_available', 'available_days',
                'available_time_start', 'available_time_end', 'max_orders_per_day',
                'requires_approval', 'approval_level', 'instruction_sheet_url',
                'consent_form_url', 'report_template_url', 'supporting_documents',
                'tags', 'search_keywords', 'synonyms'
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
                UPDATE lab_tests 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, test_code, test_name, category,
                    price, is_active, is_available,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Lab test not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab test updated', {
                testId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating lab test', {
                error: error.message,
                testId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get lab test statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_tests,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE is_available = true) as available,
                    COUNT(DISTINCT category) as categories_used,
                    COUNT(DISTINCT sample_type) as sample_types_used,
                    AVG(price)::numeric(10,2) as avg_price,
                    MIN(price)::numeric(10,2) as min_price,
                    MAX(price)::numeric(10,2) as max_price,
                    AVG(turnaround_time_hours)::numeric(10,2) as avg_turnaround_hours
                FROM lab_tests
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Lab test statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting lab test statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search lab tests
     * @param {string} searchTerm - Search term
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of lab tests
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, test_code, test_name, short_name,
                    category, sample_type, price,
                    turnaround_time_hours, is_active
                FROM lab_tests
                WHERE (test_name ILIKE $1 
                    OR test_code ILIKE $1
                    OR short_name ILIKE $1
                    OR search_keywords ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN test_name ILIKE $2 THEN 1
                        WHEN test_code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    test_name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Lab test search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching lab tests', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete lab test
     * @param {string} id - Lab test ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE lab_tests 
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
                throw new Error('Lab test not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab test soft deleted', {
                testId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting lab test', {
                error: error.message,
                testId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = LabTest;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */