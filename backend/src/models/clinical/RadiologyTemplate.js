/**
 * ======================================================================
 * FILE: backend/src/models/clinical/RadiologyTemplate.js
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
 * RadiologyTemplate model for database operations.
 * Handles reusable radiology report templates for standardized reporting.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: radiology_templates
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - template_name: string
 * - template_code: string (unique)
 * - image_type: enum (xray, mri, ct_scan, ultrasound, etc.)
 * - body_part: string
 * - modality: string
 * - sections: jsonb
 * - default_findings: text
 * - default_impression: text
 * - default_conclusion: text
 * - is_public: boolean
 * - created_by: uuid
 * - usage_count: integer
 * - last_used: timestamp
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

const RadiologyTemplate = {
    /**
     * Table name
     */
    tableName: 'radiology_templates',

    /**
     * Valid image types
     */
    validImageTypes: [
        'xray', 'mri', 'ct_scan', 'ultrasound', 'mammogram',
        'fluoroscopy', 'angiography', 'pet_scan', 'bone_scan',
        'nuclear_medicine', 'other'
    ],

    /**
     * Find template by ID
     * @param {string} id - Template UUID
     * @returns {Promise<Object|null>} Template object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    rt.id, rt.template_name, rt.template_code,
                    rt.image_type, rt.body_part, rt.modality,
                    rt.sections, rt.default_findings,
                    rt.default_impression, rt.default_conclusion,
                    rt.is_public, rt.created_by, rt.usage_count,
                    rt.last_used, rt.created_at, rt.updated_at,
                    u.username as created_by_name
                FROM radiology_templates rt
                LEFT JOIN users u ON rt.created_by = u.id
                WHERE rt.id = $1 AND rt.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Radiology template found by ID', { templateId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding radiology template by ID', {
                error: error.message,
                templateId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find template by code
     * @param {string} templateCode - Template code
     * @returns {Promise<Object|null>} Template object or null
     */
    async findByCode(templateCode) {
        try {
            const query = `
                SELECT 
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    sections, default_findings,
                    default_impression, default_conclusion,
                    is_public, usage_count, last_used
                FROM radiology_templates
                WHERE template_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [templateCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Radiology template found by code', { templateCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding radiology template by code', {
                error: error.message,
                templateCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find templates by image type
     * @param {string} imageType - Image type
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of templates
     */
    async findByImageType(imageType, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    is_public, usage_count, last_used
                FROM radiology_templates
                WHERE image_type = $1 AND is_deleted = false
                ORDER BY usage_count DESC, template_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [imageType, limit, offset]);

            logger.debug('Radiology templates found by image type', {
                imageType,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology templates by image type', {
                error: error.message,
                imageType
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find templates by body part
     * @param {string} bodyPart - Body part
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of templates
     */
    async findByBodyPart(bodyPart, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    is_public, usage_count, last_used
                FROM radiology_templates
                WHERE body_part ILIKE $1 AND is_deleted = false
                ORDER BY usage_count DESC, template_name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [`%${bodyPart}%`, limit, offset]);

            logger.debug('Radiology templates found by body part', {
                bodyPart,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding radiology templates by body part', {
                error: error.message,
                bodyPart
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get public templates (shared across all radiologists)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of public templates
     */
    async getPublicTemplates(options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    usage_count, last_used
                FROM radiology_templates
                WHERE is_public = true AND is_deleted = false
                ORDER BY usage_count DESC, template_name ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Public radiology templates retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting public radiology templates', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get templates created by user
     * @param {string} userId - User UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of user templates
     */
    async getUserTemplates(userId, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    is_public, usage_count, last_used,
                    created_at
                FROM radiology_templates
                WHERE created_by = $1 AND is_deleted = false
                ORDER BY created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [userId, limit, offset]);

            logger.debug('User radiology templates retrieved', {
                userId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting user radiology templates', {
                error: error.message,
                userId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new radiology template
     * @param {Object} templateData - Template data
     * @returns {Promise<Object>} Created template
     */
    async create(templateData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (templateData.image_type && !this.validImageTypes.includes(templateData.image_type)) {
                throw new Error(`Invalid image type. Must be one of: ${this.validImageTypes.join(', ')}`);
            }

            const existingCode = await this.findByCode(templateData.template_code);
            if (existingCode) {
                throw new Error('Template code already exists');
            }

            const query = `
                INSERT INTO radiology_templates (
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    sections, default_findings,
                    default_impression, default_conclusion,
                    is_public, created_by, usage_count,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    $6, $7, $8, $9,
                    COALESCE($10, false), $11, 0,
                    NOW(), NOW()
                )
                RETURNING 
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    is_public, created_at
            `;

            const values = [
                templateData.template_name,
                templateData.template_code,
                templateData.image_type || null,
                templateData.body_part || null,
                templateData.modality || null,
                templateData.sections || null,
                templateData.default_findings || null,
                templateData.default_impression || null,
                templateData.default_conclusion || null,
                templateData.is_public,
                templateData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Radiology template created successfully', {
                templateId: result.rows[0].id,
                templateName: templateData.template_name,
                templateCode: templateData.template_code
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating radiology template', {
                error: error.message,
                templateCode: templateData.template_code
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update radiology template
     * @param {string} id - Template ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated template
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'template_name', 'image_type', 'body_part', 'modality',
                'sections', 'default_findings', 'default_impression',
                'default_conclusion', 'is_public'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            if (updates.template_code) {
                const existing = await this.findByCode(updates.template_code);
                if (existing && existing.id !== id) {
                    throw new Error('Template code already exists');
                }
                allowedFields.push('template_code');
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
                UPDATE radiology_templates 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    is_public, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Radiology template not found');
            }

            await db.commitTransaction(client);

            logger.info('Radiology template updated', {
                templateId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating radiology template', {
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
                UPDATE radiology_templates 
                SET usage_count = usage_count + 1,
                    last_used = NOW(),
                    updated_at = NOW()
                WHERE id = $1 AND is_deleted = false
                RETURNING 
                    id, template_name, usage_count, last_used
            `;

            const result = await client.query(query, [id]);

            if (result.rows.length === 0) {
                throw new Error('Radiology template not found');
            }

            await db.commitTransaction(client);

            logger.debug('Radiology template usage incremented', {
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
     * Apply template to generate report content
     * @param {string} id - Template ID
     * @param {Object} customData - Custom data to merge
     * @returns {Promise<Object>} Generated report content
     */
    async applyTemplate(id, customData = {}) {
        try {
            const template = await this.findById(id);
            if (!template) {
                throw new Error('Template not found');
            }

            await this.incrementUsage(id);

            const generatedContent = {
                sections: template.sections || {},
                findings: template.default_findings || '',
                impression: template.default_impression || '',
                conclusion: template.default_conclusion || '',
                template_used: template.template_name
            };

            if (customData.findings) {
                generatedContent.findings = customData.findings;
            }
            if (customData.impression) {
                generatedContent.impression = customData.impression;
            }
            if (customData.conclusion) {
                generatedContent.conclusion = customData.conclusion;
            }
            if (customData.sections) {
                generatedContent.sections = {
                    ...generatedContent.sections,
                    ...customData.sections
                };
            }

            logger.debug('Template applied', {
                templateId: id,
                templateName: template.template_name
            });

            return generatedContent;
        } catch (error) {
            logger.error('Error applying template', {
                error: error.message,
                templateId: id
            });
            throw error;
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
                    COUNT(DISTINCT created_by) as unique_creators,
                    COUNT(DISTINCT image_type) as image_types_covered
                FROM radiology_templates
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Radiology template statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting radiology template statistics', {
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
                    id, template_name, template_code,
                    image_type, body_part, modality,
                    usage_count, last_used
                FROM radiology_templates
                WHERE is_deleted = false
                ORDER BY usage_count DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);

            logger.debug('Most used templates retrieved', {
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
     * Soft delete radiology template
     * @param {string} id - Template ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_templates 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Radiology template not found');
            }

            await db.commitTransaction(client);

            logger.info('Radiology template soft deleted', {
                templateId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting radiology template', {
                error: error.message,
                templateId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = RadiologyTemplate;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */