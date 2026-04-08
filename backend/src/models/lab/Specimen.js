/**
 * ======================================================================
 * FILE: backend/src/models/lab/Specimen.js
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
 * Specimen model for database operations.
 * Handles laboratory specimen/sample management for test orders.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: specimens
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - specimen_code: string (unique)
 * - specimen_type: enum (blood, urine, stool, sputum, csf, tissue, swab, aspirate, fluid, hair, nail, saliva, semen, amniotic_fluid, bone_marrow, other)
 * - specimen_name: string
 * - collection_date: timestamp
 * - collected_by: uuid
 * - collection_site: string
 * - collection_method: string
 * - collection_notes: text
 * - patient_id: UUID
 * - patient_type: string
 * - visit_id: UUID
 * - test_order_id: UUID
 * - lab_id: UUID
 * - volume: decimal
 * - volume_unit: string
 * - container_type: string
 * - preservative: string
 * - appearance: string
 * - color: string
 * - odor: string
 * - consistency: string
 * - storage_conditions: text
 * - transport_conditions: text
 * - received_date: timestamp
 * - received_by: uuid
 * - received_condition: string
 * - received_notes: text
 * - is_hemolyzed: boolean
 * - is_icteric: boolean
 * - is_lipemic: boolean
 * - is_clotted: boolean
 * - is_contaminated: boolean
 * - is_insufficient: boolean
 * - qc_status: string
 * - qc_notes: text
 * - status: enum (collected, received, processing, processed, analyzing, completed, rejected, expired, discarded)
 * - rejection_reason: text
 * - rejected_by: uuid
 * - rejected_at: timestamp
 * - processed_by: uuid
 * - processed_at: timestamp
 * - processed_notes: text
 * - aliquots: integer
 * - storage_location: string
 * - freezer_id: UUID
 * - rack_number: string
 * - shelf_number: string
 * - box_number: string
 * - position: string
 * - expiry_date: date
 * - expiry_alert_sent: boolean
 * - image_urls: text[]
 * - documents: jsonb
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

const Specimen = {
    /**
     * Table name
     */
    tableName: 'specimens',

    /**
     * Valid specimen types
     */
    validSpecimenTypes: [
        'blood', 'urine', 'stool', 'sputum', 'csf', 'tissue', 'swab',
        'aspirate', 'fluid', 'hair', 'nail', 'saliva', 'semen',
        'amniotic_fluid', 'bone_marrow', 'other'
    ],

    /**
     * Valid statuses
     */
    validStatuses: [
        'collected', 'received', 'processing', 'processed',
        'analyzing', 'completed', 'rejected', 'expired', 'discarded'
    ],

    /**
     * Generate specimen code
     * @returns {Promise<string>} Generated specimen code
     */
    async generateSpecimenCode() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM specimens
                WHERE specimen_code LIKE $1
            `;
            const result = await db.query(query, [`SPC-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `SPC-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating specimen code', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find specimen by ID
     * @param {string} id - Specimen UUID
     * @returns {Promise<Object|null>} Specimen object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    s.id, s.specimen_code, s.specimen_type, s.specimen_name,
                    s.collection_date, s.collected_by, s.collection_site,
                    s.collection_method, s.collection_notes,
                    s.patient_id, s.patient_type, s.visit_id,
                    s.test_order_id, s.lab_id,
                    s.volume, s.volume_unit, s.container_type,
                    s.preservative, s.appearance, s.color,
                    s.odor, s.consistency,
                    s.storage_conditions, s.transport_conditions,
                    s.received_date, s.received_by, s.received_condition,
                    s.received_notes,
                    s.is_hemolyzed, s.is_icteric, s.is_lipemic,
                    s.is_clotted, s.is_contaminated, s.is_insufficient,
                    s.qc_status, s.qc_notes,
                    s.status, s.rejection_reason,
                    s.rejected_by, s.rejected_at,
                    s.processed_by, s.processed_at, s.processed_notes,
                    s.aliquots, s.storage_location,
                    s.freezer_id, s.rack_number, s.shelf_number,
                    s.box_number, s.position,
                    s.expiry_date, s.expiry_alert_sent,
                    s.image_urls, s.documents,
                    s.notes, s.internal_notes, s.metadata,
                    s.created_at, s.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    u.username as collected_by_name,
                    ru.username as received_by_name,
                    rej.username as rejected_by_name,
                    pr.username as processed_by_name
                FROM specimens s
                LEFT JOIN patients p ON s.patient_id = p.id
                LEFT JOIN users u ON s.collected_by = u.id
                LEFT JOIN users ru ON s.received_by = ru.id
                LEFT JOIN users rej ON s.rejected_by = rej.id
                LEFT JOIN users pr ON s.processed_by = pr.id
                WHERE s.id = $1 AND s.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Specimen found by ID', { specimenId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding specimen by ID', {
                error: error.message,
                specimenId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find specimen by code
     * @param {string} specimenCode - Specimen code
     * @returns {Promise<Object|null>} Specimen object or null
     */
    async findByCode(specimenCode) {
        try {
            const query = `
                SELECT 
                    id, specimen_code, specimen_type, patient_id,
                    status, collection_date, received_date
                FROM specimens
                WHERE specimen_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [specimenCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Specimen found by code', { specimenCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding specimen by code', {
                error: error.message,
                specimenCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find specimens by test order ID
     * @param {string} testOrderId - Test order UUID
     * @returns {Promise<Array>} List of specimens
     */
    async findByTestOrderId(testOrderId) {
        try {
            const query = `
                SELECT 
                    id, specimen_code, specimen_type,
                    collection_date, received_date, status,
                    volume, container_type,
                    is_hemolyzed, is_insufficient
                FROM specimens
                WHERE test_order_id = $1 AND is_deleted = false
                ORDER BY collection_date ASC
            `;

            const result = await db.query(query, [testOrderId]);

            logger.debug('Specimens found by test order ID', {
                testOrderId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding specimens by test order ID', {
                error: error.message,
                testOrderId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find specimens by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of specimens
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
                conditions.push(`collection_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`collection_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, specimen_code, specimen_type,
                    collection_date, received_date, status,
                    volume, container_type
                FROM specimens
                ${whereClause}
                ORDER BY collection_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Specimens found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding specimens by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending specimens (collected but not yet processed)
     * @returns {Promise<Array>} List of pending specimens
     */
    async getPendingSpecimens() {
        try {
            const query = `
                SELECT 
                    s.id, s.specimen_code, s.specimen_type,
                    s.collection_date, s.patient_id, s.test_order_id,
                    s.storage_location,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    to.order_number
                FROM specimens s
                JOIN patients p ON s.patient_id = p.id
                LEFT JOIN test_orders to ON s.test_order_id = to.id
                WHERE s.status IN ('collected', 'received')
                    AND s.is_deleted = false
                ORDER BY s.collection_date ASC
            `;

            const result = await db.query(query);

            logger.debug('Pending specimens retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending specimens', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new specimen
     * @param {Object} specimenData - Specimen data
     * @returns {Promise<Object>} Created specimen
     */
    async create(specimenData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (specimenData.specimen_type && !this.validSpecimenTypes.includes(specimenData.specimen_type)) {
                throw new Error(`Invalid specimen type. Must be one of: ${this.validSpecimenTypes.join(', ')}`);
            }

            const specimenCode = await this.generateSpecimenCode();

            const query = `
                INSERT INTO specimens (
                    id, specimen_code, specimen_type, specimen_name,
                    collection_date, collected_by, collection_site,
                    collection_method, collection_notes,
                    patient_id, patient_type, visit_id,
                    test_order_id, lab_id,
                    volume, volume_unit, container_type,
                    preservative, appearance, color,
                    odor, consistency,
                    storage_conditions, transport_conditions,
                    status, notes, internal_notes, metadata,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    COALESCE($4, NOW()), $5, $6,
                    $7, $8,
                    $9, $10, $11,
                    $12, $13,
                    $14, $15, $16,
                    $17, $18, $19,
                    $20, $21,
                    $22, $23,
                    COALESCE($24, 'collected'), $25, $26, $27,
                    $28, NOW(), NOW()
                )
                RETURNING 
                    id, specimen_code, specimen_type,
                    collection_date, status, created_at
            `;

            const values = [
                specimenCode,
                specimenData.specimen_type,
                specimenData.specimen_name || null,
                specimenData.collection_date || null,
                specimenData.collected_by,
                specimenData.collection_site || null,
                specimenData.collection_method || null,
                specimenData.collection_notes || null,
                specimenData.patient_id,
                specimenData.patient_type || null,
                specimenData.visit_id || null,
                specimenData.test_order_id || null,
                specimenData.lab_id || null,
                specimenData.volume || null,
                specimenData.volume_unit || null,
                specimenData.container_type || null,
                specimenData.preservative || null,
                specimenData.appearance || null,
                specimenData.color || null,
                specimenData.odor || null,
                specimenData.consistency || null,
                specimenData.storage_conditions || null,
                specimenData.transport_conditions || null,
                specimenData.status,
                specimenData.notes || null,
                specimenData.internal_notes || null,
                specimenData.metadata || null,
                specimenData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Specimen created successfully', {
                specimenId: result.rows[0].id,
                specimenCode,
                patientId: specimenData.patient_id,
                specimenType: specimenData.specimen_type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating specimen', {
                error: error.message,
                patientId: specimenData.patient_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update specimen
     * @param {string} id - Specimen ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated specimen
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'specimen_type', 'specimen_name', 'collection_site',
                'collection_method', 'collection_notes',
                'volume', 'volume_unit', 'container_type',
                'preservative', 'appearance', 'color',
                'odor', 'consistency',
                'storage_conditions', 'transport_conditions',
                'received_date', 'received_by', 'received_condition',
                'received_notes',
                'is_hemolyzed', 'is_icteric', 'is_lipemic',
                'is_clotted', 'is_contaminated', 'is_insufficient',
                'qc_status', 'qc_notes',
                'status', 'rejection_reason',
                'rejected_by', 'rejected_at',
                'processed_by', 'processed_at', 'processed_notes',
                'aliquots', 'storage_location',
                'freezer_id', 'rack_number', 'shelf_number',
                'box_number', 'position',
                'expiry_date', 'expiry_alert_sent',
                'image_urls', 'documents',
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
                UPDATE specimens 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, specimen_code, status,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Specimen not found');
            }

            await db.commitTransaction(client);

            logger.info('Specimen updated', {
                specimenId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating specimen', {
                error: error.message,
                specimenId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Mark specimen as received by lab
     * @param {string} id - Specimen ID
     * @param {Object} receiveData - Receive data
     * @returns {Promise<Object>} Updated specimen
     */
    async markReceived(id, receiveData) {
        return this.update(id, {
            status: 'received',
            received_date: receiveData.received_date || new Date(),
            received_by: receiveData.received_by,
            received_condition: receiveData.condition,
            received_notes: receiveData.notes,
            updated_by: receiveData.received_by
        });
    },

    /**
     * Mark specimen as processing
     * @param {string} id - Specimen ID
     * @param {string} processedBy - User who started processing
     * @returns {Promise<Object>} Updated specimen
     */
    async markProcessing(id, processedBy) {
        return this.update(id, {
            status: 'processing',
            updated_by: processedBy
        });
    },

    /**
     * Mark specimen as processed
     * @param {string} id - Specimen ID
     * @param {Object} processData - Process data
     * @returns {Promise<Object>} Updated specimen
     */
    async markProcessed(id, processData) {
        return this.update(id, {
            status: 'processed',
            processed_by: processData.processed_by,
            processed_at: new Date(),
            processed_notes: processData.notes,
            aliquots: processData.aliquots,
            updated_by: processData.processed_by
        });
    },

    /**
     * Mark specimen as completed (all tests done)
     * @param {string} id - Specimen ID
     * @param {string} completedBy - User who completed
     * @returns {Promise<Object>} Updated specimen
     */
    async markCompleted(id, completedBy) {
        return this.update(id, {
            status: 'completed',
            updated_by: completedBy
        });
    },

    /**
     * Reject specimen
     * @param {string} id - Specimen ID
     * @param {Object} rejectData - Reject data
     * @returns {Promise<Object>} Updated specimen
     */
    async reject(id, rejectData) {
        return this.update(id, {
            status: 'rejected',
            rejection_reason: rejectData.reason,
            rejected_by: rejectData.rejected_by,
            rejected_at: new Date(),
            qc_notes: rejectData.notes,
            updated_by: rejectData.rejected_by
        });
    },

    /**
     * Discard specimen (after use or expiry)
     * @param {string} id - Specimen ID
     * @param {string} discardedBy - User who discarded
     * @param {string} reason - Discard reason
     * @returns {Promise<Object>} Updated specimen
     */
    async discard(id, discardedBy, reason) {
        return this.update(id, {
            status: 'discarded',
            notes: reason ? `Discarded: ${reason}` : 'Discarded',
            updated_by: discardedBy
        });
    },

    /**
     * Get specimen statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_specimens,
                    COUNT(*) FILTER (WHERE status = 'collected') as collected,
                    COUNT(*) FILTER (WHERE status = 'received') as received,
                    COUNT(*) FILTER (WHERE status = 'processing') as processing,
                    COUNT(*) FILTER (WHERE status = 'processed') as processed,
                    COUNT(*) FILTER (WHERE status = 'completed') as completed,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE status = 'discarded') as discarded,
                    COUNT(DISTINCT specimen_type) as specimen_types_used,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    AVG(EXTRACT(EPOCH FROM (received_date - collection_date))/3600)::numeric(10,2) as avg_transport_hours
                FROM specimens
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Specimen statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting specimen statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get specimens by storage location
     * @param {string} location - Storage location
     * @returns {Promise<Array>} List of specimens
     */
    async getByStorageLocation(location) {
        try {
            const query = `
                SELECT 
                    id, specimen_code, specimen_type,
                    patient_id, status, storage_location,
                    rack_number, shelf_number, box_number, position,
                    expiry_date
                FROM specimens
                WHERE storage_location = $1 
                    AND status NOT IN ('discarded', 'expired')
                    AND is_deleted = false
                ORDER BY expiry_date ASC
            `;

            const result = await db.query(query, [location]);

            logger.debug('Specimens found by storage location', {
                location,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting specimens by storage location', {
                error: error.message,
                location
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete specimen
     * @param {string} id - Specimen ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE specimens 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Specimen not found');
            }

            await db.commitTransaction(client);

            logger.info('Specimen soft deleted', {
                specimenId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting specimen', {
                error: error.message,
                specimenId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Specimen;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */