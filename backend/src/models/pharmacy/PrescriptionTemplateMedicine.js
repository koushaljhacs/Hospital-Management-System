/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/PrescriptionTemplateMedicine.js
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
 * PrescriptionTemplateMedicine model for database operations.
 * Handles medicines associated with prescription templates.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: prescription_template_medicines
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - template_id: UUID (foreign key to prescription_templates)
 * - medicine_name: string
 * - generic_name: string
 * - dosage: string
 * - frequency: string
 * - duration: string
 * - quantity: integer
 * - units: string
 * - route: string
 * - instructions: text
 * - display_order: integer
 * - created_at: timestamp
 * - updated_at: timestamp
 * 
 * CHANGE LOG:
 * v1.0.0 (2026-03-23) - Initial implementation
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const PrescriptionTemplateMedicine = {
    /**
     * Table name
     */
    tableName: 'prescription_template_medicines',

    /**
     * Find template medicine by ID
     * @param {string} id - TemplateMedicine UUID
     * @returns {Promise<Object|null>} TemplateMedicine object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ptm.id, ptm.template_id, ptm.medicine_name,
                    ptm.generic_name, ptm.dosage, ptm.frequency,
                    ptm.duration, ptm.quantity, ptm.units,
                    ptm.route, ptm.instructions, ptm.display_order,
                    ptm.created_at, ptm.updated_at,
                    pt.template_name, pt.doctor_id
                FROM prescription_template_medicines ptm
                JOIN prescription_templates pt ON ptm.template_id = pt.id
                WHERE ptm.id = $1 AND ptm.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Template medicine found by ID', { templateMedicineId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding template medicine by ID', {
                error: error.message,
                templateMedicineId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find medicines by template ID
     * @param {string} templateId - Prescription template UUID
     * @returns {Promise<Array>} List of template medicines
     */
    async findByTemplateId(templateId) {
        try {
            const query = `
                SELECT 
                    id, template_id, medicine_name,
                    generic_name, dosage, frequency,
                    duration, quantity, units,
                    route, instructions, display_order,
                    created_at
                FROM prescription_template_medicines
                WHERE template_id = $1 AND is_deleted = false
                ORDER BY display_order ASC, created_at ASC
            `;

            const result = await db.query(query, [templateId]);

            logger.debug('Template medicines found by template ID', {
                templateId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding template medicines by template ID', {
                error: error.message,
                templateId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new template medicine
     * @param {Object} medicineData - Template medicine data
     * @returns {Promise<Object>} Created template medicine
     */
    async create(medicineData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (medicineData.quantity <= 0) {
                throw new Error('Quantity must be positive');
            }

            // Get max display order for this template
            const maxOrderQuery = `
                SELECT COALESCE(MAX(display_order), 0) as max_order
                FROM prescription_template_medicines
                WHERE template_id = $1 AND is_deleted = false
            `;
            const maxOrderResult = await client.query(maxOrderQuery, [medicineData.template_id]);
            const displayOrder = medicineData.display_order !== undefined 
                ? medicineData.display_order 
                : maxOrderResult.rows[0].max_order + 1;

            const query = `
                INSERT INTO prescription_template_medicines (
                    id, template_id, medicine_name,
                    generic_name, dosage, frequency,
                    duration, quantity, units,
                    route, instructions, display_order,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    $6, $7, COALESCE($8, 'tablets'),
                    COALESCE($9, 'oral'), $10,
                    $11, NOW(), NOW()
                )
                RETURNING 
                    id, template_id, medicine_name,
                    dosage, frequency, quantity,
                    display_order, created_at
            `;

            const values = [
                medicineData.template_id,
                medicineData.medicine_name,
                medicineData.generic_name || null,
                medicineData.dosage,
                medicineData.frequency,
                medicineData.duration,
                medicineData.quantity,
                medicineData.units,
                medicineData.route,
                medicineData.instructions || null,
                displayOrder
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Template medicine created successfully', {
                templateMedicineId: result.rows[0].id,
                templateId: medicineData.template_id,
                medicineName: medicineData.medicine_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating template medicine', {
                error: error.message,
                templateId: medicineData.template_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update template medicine
     * @param {string} id - Template medicine ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated template medicine
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'medicine_name', 'generic_name', 'dosage',
                'frequency', 'duration', 'quantity', 'units',
                'route', 'instructions', 'display_order'
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
                UPDATE prescription_template_medicines 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, template_id, medicine_name,
                    dosage, quantity, display_order,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Template medicine not found');
            }

            await db.commitTransaction(client);

            logger.info('Template medicine updated', {
                templateMedicineId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating template medicine', {
                error: error.message,
                templateMedicineId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Bulk create template medicines
     * @param {Array} medicinesData - Array of template medicine data
     * @returns {Promise<Array>} Created medicines
     */
    async bulkCreate(medicinesData) {
        const client = await db.getClient();
        const created = [];

        try {
            await db.beginTransaction(client);

            for (let i = 0; i < medicinesData.length; i++) {
                const data = medicinesData[i];
                if (data.display_order === undefined) {
                    data.display_order = i + 1;
                }
                const result = await this.create(data);
                created.push(result);
            }

            await db.commitTransaction(client);

            logger.info('Bulk template medicines created', {
                count: created.length,
                templateId: medicinesData[0]?.template_id
            });

            return created;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error bulk creating template medicines', {
                error: error.message
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Reorder medicines within a template
     * @param {string} templateId - Template ID
     * @param {Array} orderedIds - Array of medicine IDs in desired order
     * @returns {Promise<boolean>} True if reordered
     */
    async reorder(templateId, orderedIds) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            for (let i = 0; i < orderedIds.length; i++) {
                const query = `
                    UPDATE prescription_template_medicines 
                    SET display_order = $1,
                        updated_at = NOW()
                    WHERE id = $2 
                        AND template_id = $3 
                        AND is_deleted = false
                `;
                await client.query(query, [i + 1, orderedIds[i], templateId]);
            }

            await db.commitTransaction(client);

            logger.info('Template medicines reordered', {
                templateId,
                count: orderedIds.length
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error reordering template medicines', {
                error: error.message,
                templateId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Delete all medicines for a template
     * @param {string} templateId - Template ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<number>} Number of records deleted
     */
    async deleteByTemplateId(templateId, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE prescription_template_medicines 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE template_id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, templateId]);

            await db.commitTransaction(client);

            logger.info('All template medicines deleted', {
                templateId,
                count: result.rowCount,
                deletedBy
            });

            return result.rowCount;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting template medicines by template ID', {
                error: error.message,
                templateId
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Copy medicines from one template to another
     * @param {string} sourceTemplateId - Source template ID
     * @param {string} targetTemplateId - Target template ID
     * @param {string} createdBy - User who created
     * @returns {Promise<Array>} Created medicines
     */
    async copyFromTemplate(sourceTemplateId, targetTemplateId, createdBy) {
        const sourceMedicines = await this.findByTemplateId(sourceTemplateId);
        const copiedMedicines = [];

        for (const medicine of sourceMedicines) {
            const newMedicine = await this.create({
                template_id: targetTemplateId,
                medicine_name: medicine.medicine_name,
                generic_name: medicine.generic_name,
                dosage: medicine.dosage,
                frequency: medicine.frequency,
                duration: medicine.duration,
                quantity: medicine.quantity,
                units: medicine.units,
                route: medicine.route,
                instructions: medicine.instructions,
                display_order: medicine.display_order,
                created_by: createdBy
            });
            copiedMedicines.push(newMedicine);
        }

        logger.info('Template medicines copied', {
            sourceTemplateId,
            targetTemplateId,
            count: copiedMedicines.length
        });

        return copiedMedicines;
    },

    /**
     * Get template medicine statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_template_medicines,
                    COUNT(DISTINCT template_id) as unique_templates,
                    COUNT(DISTINCT medicine_name) as unique_medicines,
                    AVG(quantity)::numeric(10,2) as avg_quantity,
                    SUM(quantity) as total_quantity
                FROM prescription_template_medicines
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Template medicine statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting template medicine statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get most common medicines in templates
     * @param {number} limit - Number of medicines
     * @returns {Promise<Array>} List of medicines with counts
     */
    async getMostCommon(limit = 10) {
        try {
            const query = `
                SELECT 
                    medicine_name,
                    generic_name,
                    COUNT(*) as template_count,
                    AVG(quantity)::numeric(10,2) as avg_quantity,
                    SUM(quantity) as total_quantity
                FROM prescription_template_medicines
                WHERE is_deleted = false
                GROUP BY medicine_name, generic_name
                ORDER BY template_count DESC
                LIMIT $1
            `;

            const result = await db.query(query, [limit]);

            logger.debug('Most common template medicines retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting most common template medicines', {
                error: error.message,
                limit
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete template medicine
     * @param {string} id - Template medicine ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE prescription_template_medicines 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Template medicine not found');
            }

            await db.commitTransaction(client);

            logger.info('Template medicine soft deleted', {
                templateMedicineId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting template medicine', {
                error: error.message,
                templateMedicineId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = PrescriptionTemplateMedicine;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */