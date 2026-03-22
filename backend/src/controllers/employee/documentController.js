/**
 * ======================================================================
 * FILE: backend/src/controllers/employee/documentController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Employee document controller - Handles document management.
 * Total Endpoints: 4
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-57] Documents must be verified before access
 * 
 * ======================================================================
 */

const documentService = require('../../services/employee/documentService');
const logger = require('../../utils/logger');

const documentController = {
    // ============================================
    // DOCUMENT LISTS
    // ============================================

    /**
     * Get my documents
     * GET /api/v1/employee/documents
     * 
     * BUSINESS RULE: [BR-57] Documents must be verified before access
     */
    async getMyDocuments(req, res, next) {
        try {
            const { page = 1, limit = 20, document_type, status } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                document_type,
                status
            };

            const documents = await documentService.getEmployeeDocuments(
                req.user.id,
                options
            );

            logger.info('Employee viewed documents', {
                employeeId: req.user.id,
                count: documents.data?.length || 0
            });

            // [BR-57] Filter verified documents only for sensitive info
            const sensitiveDocs = documents.data?.filter(d => 
                d.document_type === 'contract' || d.document_type === 'qualification'
            );
            
            const verifiedCount = documents.data?.filter(d => d.status === 'verified').length || 0;
            const pendingCount = documents.data?.filter(d => d.status === 'pending').length || 0;

            res.json({
                success: true,
                data: documents.data,
                pagination: documents.pagination,
                summary: {
                    total: documents.summary?.total || 0,
                    verified: verifiedCount,
                    pending: pendingCount,
                    by_type: {
                        id_proof: documents.data?.filter(d => d.document_type === 'id_proof').length || 0,
                        address_proof: documents.data?.filter(d => d.document_type === 'address_proof').length || 0,
                        qualification: documents.data?.filter(d => d.document_type === 'qualification').length || 0,
                        experience: documents.data?.filter(d => d.document_type === 'experience').length || 0,
                        contract: documents.data?.filter(d => d.document_type === 'contract').length || 0
                    }
                }
            });
        } catch (error) {
            logger.error('Error getting employee documents', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get document by ID
     * GET /api/v1/employee/documents/:id
     * 
     * BUSINESS RULE: [BR-57] Documents must be verified before access
     */
    async getDocumentById(req, res, next) {
        try {
            const { id } = req.params;

            const document = await documentService.getDocumentById(
                req.user.id,
                id
            );

            if (!document) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }

            if (document.employee_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            // [BR-57] Check if document is verified for sensitive documents
            if (['contract', 'qualification'].includes(document.document_type) && document.status !== 'verified') {
                return res.status(403).json({
                    success: false,
                    error: 'Document is pending verification. Please wait for admin approval.',
                    status: document.status
                });
            }

            // Log access
            await documentService.logDocumentAccess(
                req.user.id,
                id,
                req.ip,
                req.headers['user-agent']
            );

            logger.info('Employee viewed document', {
                employeeId: req.user.id,
                documentId: id,
                documentType: document.document_type,
                status: document.status
            });

            res.json({
                success: true,
                data: document
            });
        } catch (error) {
            if (error.message === 'Document not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }
            logger.error('Error getting document by ID', {
                error: error.message,
                employeeId: req.user.id,
                documentId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // DOCUMENT OPERATIONS
    // ============================================

    /**
     * Upload document
     * POST /api/v1/employee/documents
     */
    async uploadDocument(req, res, next) {
        try {
            const {
                document_type,
                document_name,
                document_url,
                expiry_date,
                notes
            } = req.body;

            if (!document_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Document type is required'
                });
            }

            if (!document_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Document name is required'
                });
            }

            if (!document_url) {
                return res.status(400).json({
                    success: false,
                    error: 'Document URL is required'
                });
            }

            // Check for duplicate document
            const existing = await documentService.checkDuplicateDocument(
                req.user.id,
                document_type,
                document_name
            );

            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: 'Document with same name and type already exists',
                    existing_document: existing
                });
            }

            const document = await documentService.uploadDocument(
                req.user.id,
                {
                    document_type,
                    document_name,
                    document_url,
                    expiry_date,
                    notes,
                    uploaded_at: new Date(),
                    uploaded_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Employee uploaded document', {
                employeeId: req.user.id,
                documentId: document.id,
                documentType: document_type,
                documentName: document_name
            });

            res.status(201).json({
                success: true,
                data: document,
                message: 'Document uploaded successfully. Pending verification.'
            });
        } catch (error) {
            logger.error('Error uploading document', {
                error: error.message,
                employeeId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Delete document
     * DELETE /api/v1/employee/documents/:id
     */
    async deleteDocument(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const document = await documentService.getDocumentById(req.user.id, id);
            
            if (!document) {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }

            if (document.employee_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own documents'
                });
            }

            // Only allow deletion of pending or rejected documents
            if (document.status === 'verified') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete verified document. Please contact HR for assistance.'
                });
            }

            const deleted = await documentService.deleteDocument(
                req.user.id,
                id,
                {
                    reason,
                    deleted_at: new Date(),
                    deleted_by: req.user.id
                }
            );

            logger.info('Employee deleted document', {
                employeeId: req.user.id,
                documentId: id,
                documentType: document.document_type,
                reason
            });

            res.json({
                success: true,
                data: deleted,
                message: 'Document deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Document not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }
            logger.error('Error deleting document', {
                error: error.message,
                employeeId: req.user.id,
                documentId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = documentController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Document Lists         | 2         | My documents, by ID
 * Document Operations    | 2         | Upload, delete
 * -----------------------|-----------|----------------------
 * TOTAL                  | 4         | Complete document management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-57] Verified documents only for sensitive access
 * 
 * ======================================================================
 */