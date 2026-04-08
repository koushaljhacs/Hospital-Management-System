/**
 * ======================================================================
 * FILE: backend/src/models/hr/EmployeeDocument.js
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
 * EmployeeDocument model for database operations.
 * Handles employee documents including verification and expiry tracking.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: employee_documents
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - employee_id: UUID (foreign key to employees)
 * - document_type: enum (resume, id_proof, degree, certificate, other)
 * - document_name: string
 * - description: text
 * - file_url: text
 * - file_size: integer
 * - mime_type: string
 * - file_hash: string
 * - is_verified: boolean
 * - verified_by: uuid
 * - verified_at: timestamp
 * - verification_notes: text
 * - expiry_date: date
 * - expiry_alert_sent: boolean
 * - is_active: boolean
 * - uploaded_at: timestamp
 * - uploaded_by: uuid
 * - updated_at: timestamp
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
const crypto = require('crypto');

const EmployeeDocument = {
    /**
     * Table name
     */
    tableName: 'employee_documents',

    /**
     * Valid document types
     */
    validDocumentTypes: ['resume', 'id_proof', 'degree', 'certificate', 'other'],

    /**
     * Find document by ID
     * @param {string} id - Document UUID
     * @returns {Promise<Object|null>} Document object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    ed.id, ed.employee_id, ed.document_type, ed.document_name,
                    ed.description, ed.file_url, ed.file_size, ed.mime_type,
                    ed.file_hash, ed.is_verified, ed.verified_by, ed.verified_at,
                    ed.verification_notes, ed.expiry_date, ed.expiry_alert_sent,
                    ed.is_active, ed.uploaded_at, ed.uploaded_by,
                    ed.updated_at, ed.updated_by,
                    ed.created_at, ed.updated_at,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.employee_id as emp_id,
                    vu.username as verified_by_name,
                    uu.username as uploaded_by_name
                FROM employee_documents ed
                JOIN employees e ON ed.employee_id = e.id
                LEFT JOIN users vu ON ed.verified_by = vu.id
                LEFT JOIN users uu ON ed.uploaded_by = uu.id
                WHERE ed.id = $1 AND ed.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Employee document found by ID', { documentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding employee document by ID', {
                error: error.message,
                documentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find documents by employee ID
     * @param {string} employeeId - Employee UUID
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of documents
     */
    async findByEmployeeId(employeeId, options = {}) {
        try {
            const { limit = 50, offset = 0, document_type, is_verified, is_active } = options;
            const values = [employeeId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (document_type) {
                conditions.push(`document_type = $${paramIndex++}`);
                values.push(document_type);
            }
            if (is_verified !== undefined) {
                conditions.push(`is_verified = $${paramIndex++}`);
                values.push(is_verified);
            }
            if (is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(is_active);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, document_type, document_name,
                    file_url, file_size, is_verified,
                    expiry_date, is_active, uploaded_at
                FROM employee_documents
                ${whereClause}
                ORDER BY uploaded_at DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Documents found by employee ID', {
                employeeId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding documents by employee ID', {
                error: error.message,
                employeeId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get documents expiring soon
     * @param {number} daysThreshold - Days to look ahead
     * @returns {Promise<Array>} List of documents expiring soon
     */
    async getExpiringSoon(daysThreshold = 30) {
        try {
            const query = `
                SELECT 
                    ed.id, ed.employee_id, ed.document_type,
                    ed.document_name, ed.expiry_date,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.email as employee_email
                FROM employee_documents ed
                JOIN employees e ON ed.employee_id = e.id
                WHERE ed.expiry_date IS NOT NULL
                    AND ed.expiry_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
                    AND ed.expiry_date > CURRENT_DATE
                    AND ed.is_active = true
                    AND ed.is_deleted = false
                ORDER BY ed.expiry_date ASC
            `;

            const result = await db.query(query, [daysThreshold]);

            logger.debug('Documents expiring soon retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expiring documents', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get expired documents
     * @returns {Promise<Array>} List of expired documents
     */
    async getExpired() {
        try {
            const query = `
                SELECT 
                    ed.id, ed.employee_id, ed.document_type,
                    ed.document_name, ed.expiry_date,
                    e.first_name as employee_first_name,
                    e.last_name as employee_last_name,
                    e.email as employee_email
                FROM employee_documents ed
                JOIN employees e ON ed.employee_id = e.id
                WHERE ed.expiry_date IS NOT NULL
                    AND ed.expiry_date <= CURRENT_DATE
                    AND ed.is_active = true
                    AND ed.is_deleted = false
                ORDER BY ed.expiry_date ASC
            `;

            const result = await db.query(query);

            logger.debug('Expired documents retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting expired documents', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new employee document
     * @param {Object} documentData - Document data
     * @returns {Promise<Object>} Created document
     */
    async create(documentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (documentData.document_type && !this.validDocumentTypes.includes(documentData.document_type)) {
                throw new Error(`Invalid document type. Must be one of: ${this.validDocumentTypes.join(', ')}`);
            }

            // Calculate file hash if file_buffer provided (simulated)
            let fileHash = documentData.file_hash;
            if (documentData.file_buffer && !fileHash) {
                fileHash = crypto.createHash('sha256').update(documentData.file_buffer).digest('hex');
            }

            const query = `
                INSERT INTO employee_documents (
                    id, employee_id, document_type, document_name,
                    description, file_url, file_size, mime_type,
                    file_hash, is_verified, expiry_date,
                    is_active, uploaded_at, uploaded_by,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6, $7,
                    $8, false, $9,
                    true, NOW(), $10,
                    NOW(), NOW()
                )
                RETURNING 
                    id, employee_id, document_type, document_name,
                    file_url, is_verified, expiry_date,
                    uploaded_at, created_at
            `;

            const values = [
                documentData.employee_id,
                documentData.document_type,
                documentData.document_name,
                documentData.description || null,
                documentData.file_url,
                documentData.file_size || null,
                documentData.mime_type || null,
                fileHash,
                documentData.expiry_date || null,
                documentData.uploaded_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Employee document created', {
                documentId: result.rows[0].id,
                employeeId: documentData.employee_id,
                documentType: documentData.document_type,
                documentName: documentData.document_name
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating employee document', {
                error: error.message,
                employeeId: documentData.employee_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update employee document
     * @param {string} id - Document ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated document
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'document_name', 'description', 'file_url',
                'file_size', 'mime_type', 'file_hash',
                'is_verified', 'verified_by', 'verified_at',
                'verification_notes', 'expiry_date', 'expiry_alert_sent',
                'is_active', 'updated_by'
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
                // Already handled above
            }
            values.push(id);

            const query = `
                UPDATE employee_documents 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, employee_id, document_type, document_name,
                    is_verified, is_active, expiry_date,
                    updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Employee document not found');
            }

            await db.commitTransaction(client);

            logger.info('Employee document updated', {
                documentId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating employee document', {
                error: error.message,
                documentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Verify document
     * @param {string} id - Document ID
     * @param {string} verifiedBy - User who verified
     * @param {string} notes - Verification notes
     * @returns {Promise<Object>} Updated document
     */
    async verify(id, verifiedBy, notes = null) {
        return this.update(id, {
            is_verified: true,
            verified_by: verifiedBy,
            verified_at: new Date(),
            verification_notes: notes,
            updated_by: verifiedBy
        });
    },

    /**
     * Reject document verification
     * @param {string} id - Document ID
     * @param {string} rejectedBy - User who rejected
     * @param {string} reason - Rejection reason
     * @returns {Promise<Object>} Updated document
     */
    async reject(id, rejectedBy, reason) {
        return this.update(id, {
            is_verified: false,
            verification_notes: reason,
            updated_by: rejectedBy
        });
    },

    /**
     * Deactivate document (e.g., expired or superseded)
     * @param {string} id - Document ID
     * @param {string} deactivatedBy - User who deactivated
     * @returns {Promise<Object>} Updated document
     */
    async deactivate(id, deactivatedBy) {
        return this.update(id, {
            is_active: false,
            updated_by: deactivatedBy
        });
    },

    /**
     * Mark expiry alert as sent
     * @param {string} id - Document ID
     * @returns {Promise<Object>} Updated document
     */
    async markExpiryAlertSent(id) {
        return this.update(id, {
            expiry_alert_sent: true
        });
    },

    /**
     * Get document statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_documents,
                    COUNT(DISTINCT employee_id) as unique_employees,
                    COUNT(*) FILTER (WHERE is_verified = true) as verified,
                    COUNT(*) FILTER (WHERE is_verified = false) as unverified,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE document_type = 'resume') as resumes,
                    COUNT(*) FILTER (WHERE document_type = 'id_proof') as id_proofs,
                    COUNT(*) FILTER (WHERE document_type = 'degree') as degrees,
                    COUNT(*) FILTER (WHERE document_type = 'certificate') as certificates,
                    COUNT(*) FILTER (WHERE expiry_date IS NOT NULL) as has_expiry,
                    COUNT(*) FILTER (WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days') as expiring_soon
                FROM employee_documents
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Employee document statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting employee document statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete employee document
     * @param {string} id - Document ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE employee_documents 
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
                throw new Error('Employee document not found');
            }

            await db.commitTransaction(client);

            logger.info('Employee document soft deleted', {
                documentId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting employee document', {
                error: error.message,
                documentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = EmployeeDocument;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */