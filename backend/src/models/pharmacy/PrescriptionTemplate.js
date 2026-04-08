/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/PrescriptionTemplate.js
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
 * PrescriptionTemplate model for database operations.
 * Handles reusable prescription templates for doctors.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: prescription_templates
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - doctor_id: UUID (foreign key to employees)
 * - template_name: string
 * - description: text
 * - diagnosis_template: text
 * - notes_template: text
 * - is_public: boolean
 * - usage_count: integer
 * - last_used: timestamp
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

const PrescriptionTemplate = {
    /**
     * Table name
     */
    tableName: 'prescription_templates',

    /**
     * Find template by ID
     * @param {string} id - Template UUID
     * @returns {Promise<Object|null>} Template object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    pt.id, pt.doctor_id, pt.template_name,
                    pt.description, pt.diagnosis_template,
                    pt.notes_template, pt.is_public,
                    pt.usage_count, pt.last_used,
                    pt.created_at, pt.updated_at,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name,
                    e.designation as doctor_designation
                FROM prescription_templates pt
                LEFT JOIN employees e ON pt.doctor_id = e.id
                WHERE pt.id = $1 AND pt.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Prescription template found by ID', { templateId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding prescription template by ID', {
                error: error.message,
                templateId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find templates by doctor ID
     * @param {string} doctorId - Doctor UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of templates
     */
    async findByDoctorId(doctorId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, template_name, description,
                    is_public, usage_count, last_used,
                    created_at
                FROM prescription_templates
                WHERE doctor_id = $1 AND is_deleted = false
                ORDER BY usage_count DESC, template_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [doctorId, limit, offset]);

            logger.debug('Prescription templates found by doctor ID', {
                doctorId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding prescription templates by doctor ID', {
                error: error.message,
                doctorId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get public templates (shared across all doctors)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of public templates
     */
    async getPublicTemplates(options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    pt.id, pt.template_name, pt.description,
                    pt.usage_count, pt.last_used,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM prescription_templates pt
                LEFT JOIN employees e ON pt.doctor_id = e.id
                WHERE pt.is_public = true AND pt.is_deleted = false
                ORDER BY pt.usage_count DESC, pt.template_name ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Public prescription templates retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting public prescription templates', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new prescription template
     * @param {Object} templateData - Template data
     * @returns {Promise<Object>} Created template
     */
    async create(templateData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO prescription_templates (
                    id, doctor_id, template_name,
                    description, diagnosis_template,
                    notes_template, is_public,
                    usage_count, created_by,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4,
                    $5, COALESCE($6, false),
                    0, $7,
                    NOW(), NOW()
                )
                RETURNING 
                    id, doctor_id, template_name,
                    is_public, created_at
            `;

            const values = [
                templateData.doctor_id,
                templateData.template_name,
                templateData.description || null,
                templateData.diagnosis_template || null,
                templateData.notes_template || null,
                templateData.is_public,
                templateData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Prescription template created successfully', {
                templateId: result.rows[0].id,
                doctorId: templateData.doctor_id,
                templateName: templateData.template_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating prescription template', {
                error: error.message,
                doctorId: templateData.doctor_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update prescription template
     * @param {string} id - Template ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated template
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'template_name', 'description',
                'diagnosis_template', 'notes_template', 'is_public'
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
                UPDATE prescription_templates 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, template_name, is_public,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Prescription template not found');
            }

            await db.commitTransaction(client);

            logger.info('Prescription template updated', {
                templateId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating prescription template', {
                error: error.message,
                templateId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Increment usage count for template
     * @param {string} id - Template ID
     * @returns {Promise<Object>} Updated template
     */
    async incrementUsage(id) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE prescription_templates 
                SET usage_count = usage_count + 1,
                    last_used = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING 
                    id, template_name, usage_count, last_used
            `;

            const result = await client.query(query, [id]);

            if (result.rows.length === 0) {
                throw new Error('Prescription template not found');
            }

            await db.commitTransaction(client);

            logger.debug('Prescription template usage incremented', {
                templateId: id,
                usageCount: result.rows[0].usage_count
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error incrementing template usage', {
                error: error.message,
                templateId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get template statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_templates,
                    COUNT(*) FILTER (WHERE is_public = true) as public_templates,
                    COUNT(*) FILTER (WHERE is_public = false) as private_templates,
                    SUM(usage_count) as total_usage,
                    AVG(usage_count)::numeric(10,2) as avg_usage,
                    COUNT(DISTINCT doctor_id) as unique_doctors
                FROM prescription_templates
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Prescription template statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting prescription template statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get most used templates
     * @param {number} limit - Number of templates
     * @returns {Promise<Array>} List of most used templates
     */
    async getMostUsed(limit = 10) {
        try {
            const query = `
                SELECT 
                    id, template_name, doctor_id,
                    usage_count, last_used,
                    is_public,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM prescription_templates pt
                LEFT JOIN employees e ON pt.doctor_id = e.id
                WHERE pt.is_deleted = false
                ORDER BY pt.usage_count DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);

            logger.debug('Most used prescription templates retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting most used templates', {
                error: error.message,
                limit
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search templates by name
     * @param {string} searchTerm - Search term
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of templates
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, template_name, description,
                    is_public, usage_count,
                    doctor_id,
                    e.first_name as doctor_first_name,
                    e.last_name as doctor_last_name
                FROM prescription_templates pt
                LEFT JOIN employees e ON pt.doctor_id = e.id
                WHERE (pt.template_name ILIKE $1 
                    OR pt.description ILIKE $1)
                    AND pt.is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN pt.template_name ILIKE $2 THEN 1
                        WHEN pt.description ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    pt.usage_count DESC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Prescription template search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching prescription templates', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete prescription template
     * @param {string} id - Template ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE prescription_templates 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Prescription template not found');
            }

            await db.commitTransaction(client);

            logger.info('Prescription template soft deleted', {
                templateId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting prescription template', {
                error: error.message,
                templateId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = PrescriptionTemplate;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */