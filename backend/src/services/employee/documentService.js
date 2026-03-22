/**
 * ======================================================================
 * FILE: backend/src/services/employee/documentService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee document service - Handles business logic for document management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-57] Documents must be verified before access
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const documentService = {
    /**
     * Get employee documents
     */
    async getEmployeeDocuments(employeeId, options = {}) {
        try {
            const { page = 1, limit = 20, document_type, status } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT d.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name,
                       CASE 
                           WHEN d.expiry_date IS NOT NULL AND d.expiry_date < NOW() THEN true
                           ELSE false
                       END as is_expired
                FROM employee_documents d
                LEFT JOIN users u ON d.uploaded_by = u.id
                WHERE d.employee_id = $1 AND d.is_deleted = false
            `;
            const values = [employeeId];
            let paramIndex = 2;

            if (document_type) {
                query += ` AND d.document_type = $${paramIndex}`;
                values.push(document_type);
                paramIndex++;
            }

            if (status) {
                query += ` AND d.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            query += ` ORDER BY d.created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'verified') as verified,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE status = 'expired') as expired,
                    COUNT(*) FILTER (WHERE document_type = 'id_proof') as id_proof_count,
                    COUNT(*) FILTER (WHERE document_type = 'address_proof') as address_proof_count,
                    COUNT(*) FILTER (WHERE document_type = 'qualification') as qualification_count,
                    COUNT(*) FILTER (WHERE document_type = 'experience') as experience_count,
                    COUNT(*) FILTER (WHERE document_type = 'contract') as contract_count
                FROM employee_documents
                WHERE employee_id = $1 AND is_deleted = false
                ${document_type ? 'AND document_type = $2' : ''}
            `;
            const countValues = [employeeId];
            if (document_type) countValues.push(document_type);
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0]?.total || 0)
                }
            };
        } catch (error) {
            logger.error('Error in getEmployeeDocuments', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Get document by ID
     */
    async getDocumentById(employeeId, documentId) {
        try {
            const query = `
                SELECT d.*, 
                       CONCAT(u.first_name, ' ', u.last_name) as uploaded_by_name,
                       CONCAT(v.first_name, ' ', v.last_name) as verified_by_name
                FROM employee_documents d
                LEFT JOIN users u ON d.uploaded_by = u.id
                LEFT JOIN users v ON d.verified_by = v.id
                WHERE d.id = $1 AND d.is_deleted = false
            `;

            const result = await db.query(query, [documentId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getDocumentById', { error: error.message, employeeId, documentId });
            throw error;
        }
    },

    /**
     * Check for duplicate document
     */
    async checkDuplicateDocument(employeeId, documentType, documentName) {
        try {
            const result = await db.query(`
                SELECT id, document_name, status
                FROM employee_documents
                WHERE employee_id = $1 
                    AND document_type = $2 
                    AND document_name = $3
                    AND is_deleted = false
            `, [employeeId, documentType, documentName]);

            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in checkDuplicateDocument', { error: error.message, employeeId });
            throw error;
        }
    },

    /**
     * Upload document
     */
    async uploadDocument(employeeId, documentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Generate document number
            const documentNumber = await this.generateDocumentNumber();

            // Save file to storage
            const storagePath = await this._saveDocumentFile(documentData);

            const query = `
                INSERT INTO employee_documents (
                    id, document_number, employee_id, document_type, document_name,
                    document_url, storage_path, file_size, mime_type, expiry_date,
                    status, notes, uploaded_by, uploaded_at, ip_address, user_agent,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    'pending', $10, $11, $12, $13, $14, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                documentNumber,
                employeeId,
                documentData.document_type,
                documentData.document_name,
                documentData.document_url,
                storagePath,
                documentData.file_size,
                documentData.mime_type,
                documentData.expiry_date,
                documentData.notes,
                documentData.uploaded_by,
                documentData.uploaded_at,
                documentData.ip_address,
                documentData.user_agent
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Generate document number
     */
    async generateDocumentNumber() {
        try {
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');

            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM employee_documents
                WHERE document_number LIKE $1
            `, [`DOC-${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `DOC-${year}${month}${day}-${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateDocumentNumber', { error: error.message });
            throw error;
        }
    },

    /**
     * Save document file to storage
     * @private
     */
    async _saveDocumentFile(documentData) {
        try {
            const uploadDir = path.join(__dirname, '../../../uploads/employee-documents');
            await fs.mkdir(uploadDir, { recursive: true });

            const fileName = `${Date.now()}_${documentData.file_name}`;
            const filePath = path.join(uploadDir, fileName);

            await fs.writeFile(filePath, documentData.file_buffer);

            return filePath;
        } catch (error) {
            logger.error('Error saving document file', { error: error.message });
            throw error;
        }
    },

    /**
     * Delete document
     */
    async deleteDocument(employeeId, documentId, deleteData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get document path before deletion
            const docQuery = await client.query(`
                SELECT storage_path FROM employee_documents
                WHERE id = $1 AND employee_id = $2 AND status IN ('pending', 'rejected')
            `, [documentId, employeeId]);

            if (docQuery.rows.length === 0) {
                throw new Error('Document not found or cannot be deleted');
            }

            const query = `
                UPDATE employee_documents 
                SET is_deleted = true,
                    deleted_at = $1,
                    deleted_by = $2,
                    deletion_reason = $3,
                    updated_at = NOW()
                WHERE id = $4 AND employee_id = $5
                RETURNING storage_path
            `;

            const values = [
                deleteData.deleted_at,
                deleteData.deleted_by,
                deleteData.reason,
                documentId,
                employeeId
            ];

            const result = await client.query(query, values);

            // Delete physical file
            if (result.rows[0]?.storage_path) {
                try {
                    await fs.unlink(result.rows[0].storage_path);
                } catch (err) {
                    logger.warn('Failed to delete physical document file', {
                        path: result.rows[0].storage_path,
                        error: err.message
                    });
                }
            }

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Log document access [BR-57]
     */
    async logDocumentAccess(employeeId, documentId, ipAddress, userAgent) {
        try {
            await db.query(`
                INSERT INTO document_access_logs (
                    id, document_id, employee_id, accessed_at, ip_address, user_agent
                ) VALUES (
                    gen_random_uuid(), $1, $2, NOW(), $3, $4
                )
            `, [documentId, employeeId, ipAddress, userAgent]);
        } catch (error) {
            logger.error('Error logging document access', { error: error.message, employeeId, documentId });
            // Don't throw, just log the error
        }
    }
};

module.exports = documentService;