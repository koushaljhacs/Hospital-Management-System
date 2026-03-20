/**
 * ======================================================================
 * FILE: backend/src/controllers/pharmacist/supplierController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist supplier controller - Handles supplier management.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ENDPOINTS: 7 endpoints
 * ======================================================================
 */

const supplierService = require('../../services/pharmacist/supplierService');
const logger = require('../../utils/logger');

/**
 * Pharmacist Supplier Controller
 */
const supplierController = {
    // ============================================
    // SUPPLIER LISTS
    // ============================================

    /**
     * Get all suppliers
     * GET /api/v1/pharmacist/suppliers
     */
    async getAllSuppliers(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                status,
                search,
                category
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                search,
                category
            };

            const suppliers = await supplierService.getAllSuppliers(
                req.user.id,
                options
            );

            logger.info('Pharmacist retrieved suppliers', {
                pharmacistId: req.user.id,
                count: suppliers.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: suppliers.data,
                pagination: suppliers.pagination,
                summary: suppliers.summary
            });
        } catch (error) {
            logger.error('Error getting suppliers', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get active suppliers
     * GET /api/v1/pharmacist/suppliers/active
     */
    async getActiveSuppliers(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const suppliers = await supplierService.getActiveSuppliers(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed active suppliers', {
                pharmacistId: req.user.id,
                count: suppliers.data?.length || 0
            });

            res.json({
                success: true,
                data: suppliers.data,
                pagination: suppliers.pagination
            });
        } catch (error) {
            logger.error('Error getting active suppliers', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get supplier by ID
     * GET /api/v1/pharmacist/suppliers/:id
     */
    async getSupplierById(req, res, next) {
        try {
            const { id } = req.params;

            const supplier = await supplierService.getSupplierById(
                req.user.id,
                id
            );

            if (!supplier) {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }

            logger.info('Pharmacist viewed supplier details', {
                pharmacistId: req.user.id,
                supplierId: id,
                supplierName: supplier.name
            });

            res.json({
                success: true,
                data: supplier
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error getting supplier', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // SUPPLIER CRUD OPERATIONS
    // ============================================

    /**
     * Add new supplier
     * POST /api/v1/pharmacist/suppliers
     */
    async addSupplier(req, res, next) {
        try {
            const supplierData = {
                name: req.body.name,
                code: req.body.code,
                contact_person: req.body.contact_person,
                phone: req.body.phone,
                alternate_phone: req.body.alternate_phone,
                email: req.body.email,
                website: req.body.website,
                address: req.body.address,
                city: req.body.city,
                state: req.body.state,
                country: req.body.country || 'India',
                postal_code: req.body.postal_code,
                gst_number: req.body.gst_number,
                pan_number: req.body.pan_number,
                license_number: req.body.license_number,
                business_type: req.body.business_type,
                payment_terms: req.body.payment_terms,
                credit_limit: req.body.credit_limit,
                credit_days: req.body.credit_days,
                minimum_order: req.body.minimum_order,
                bank_name: req.body.bank_name,
                bank_account_number: req.body.bank_account_number,
                bank_ifsc_code: req.body.bank_ifsc_code,
                bank_swift_code: req.body.bank_swift_code,
                bank_branch: req.body.bank_branch,
                status: req.body.status || 'active',
                notes: req.body.notes,
                created_by: req.user.id,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!supplierData.name) {
                return res.status(400).json({
                    success: false,
                    error: 'Supplier name is required'
                });
            }

            if (!supplierData.phone) {
                return res.status(400).json({
                    success: false,
                    error: 'Phone number is required'
                });
            }

            // Generate supplier code if not provided
            if (!supplierData.code) {
                supplierData.code = await supplierService.generateSupplierCode(supplierData.name);
            }

            const supplier = await supplierService.addSupplier(
                req.user.id,
                supplierData
            );

            logger.info('Pharmacist added new supplier', {
                pharmacistId: req.user.id,
                supplierId: supplier.id,
                supplierName: supplier.name,
                supplierCode: supplier.code
            });

            res.status(201).json({
                success: true,
                data: supplier,
                message: 'Supplier added successfully'
            });
        } catch (error) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: 'Supplier with this code or GST already exists'
                });
            }
            logger.error('Error adding supplier', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update supplier
     * PUT /api/v1/pharmacist/suppliers/:id
     */
    async updateSupplier(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.code;
            delete updates.created_by;
            delete updates.created_at;

            const supplier = await supplierService.updateSupplier(
                req.user.id,
                id,
                updates
            );

            logger.info('Pharmacist updated supplier', {
                pharmacistId: req.user.id,
                supplierId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: supplier,
                message: 'Supplier updated successfully'
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error updating supplier', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete supplier (soft delete)
     * DELETE /api/v1/pharmacist/suppliers/:id
     */
    async deleteSupplier(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await supplierService.deleteSupplier(
                req.user.id,
                id,
                reason
            );

            logger.info('Pharmacist deleted supplier', {
                pharmacistId: req.user.id,
                supplierId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Supplier deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            if (error.message === 'Cannot delete supplier with active orders') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete supplier with active purchase orders'
                });
            }
            logger.error('Error deleting supplier', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // SUPPLIER PRODUCTS
    // ============================================

    /**
     * Get supplier products
     * GET /api/v1/pharmacist/suppliers/:id/products
     */
    async getSupplierProducts(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const products = await supplierService.getSupplierProducts(
                req.user.id,
                id,
                options
            );

            logger.info('Pharmacist viewed supplier products', {
                pharmacistId: req.user.id,
                supplierId: id,
                productCount: products.data?.length || 0
            });

            res.json({
                success: true,
                data: products.data,
                pagination: products.pagination,
                summary: products.summary
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error getting supplier products', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Add product to supplier catalog
     * POST /api/v1/pharmacist/suppliers/:id/products
     */
    async addSupplierProduct(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                medicine_id,
                supplier_sku,
                unit_price,
                minimum_order_quantity,
                lead_time_days,
                notes
            } = req.body;

            if (!medicine_id) {
                return res.status(400).json({
                    success: false,
                    error: 'Medicine ID is required'
                });
            }

            const product = await supplierService.addSupplierProduct(
                req.user.id,
                id,
                {
                    medicine_id,
                    supplier_sku,
                    unit_price,
                    minimum_order_quantity: minimum_order_quantity || 1,
                    lead_time_days: lead_time_days || 0,
                    notes,
                    added_by: req.user.id,
                    added_at: new Date()
                }
            );

            logger.info('Pharmacist added product to supplier catalog', {
                pharmacistId: req.user.id,
                supplierId: id,
                medicineId: medicine_id
            });

            res.status(201).json({
                success: true,
                data: product,
                message: 'Product added to supplier catalog'
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: 'Product already exists in supplier catalog'
                });
            }
            logger.error('Error adding supplier product', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update supplier product
     * PUT /api/v1/pharmacist/suppliers/:supplierId/products/:productId
     */
    async updateSupplierProduct(req, res, next) {
        try {
            const { supplierId, productId } = req.params;
            const updates = req.body;

            const product = await supplierService.updateSupplierProduct(
                req.user.id,
                supplierId,
                productId,
                updates
            );

            logger.info('Pharmacist updated supplier product', {
                pharmacistId: req.user.id,
                supplierId,
                productId
            });

            res.json({
                success: true,
                data: product,
                message: 'Supplier product updated'
            });
        } catch (error) {
            if (error.message === 'Product not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found'
                });
            }
            logger.error('Error updating supplier product', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.supplierId,
                productId: req.params.productId
            });
            next(error);
        }
    },

    /**
     * Remove product from supplier catalog
     * DELETE /api/v1/pharmacist/suppliers/:supplierId/products/:productId
     */
    async removeSupplierProduct(req, res, next) {
        try {
            const { supplierId, productId } = req.params;

            await supplierService.removeSupplierProduct(
                req.user.id,
                supplierId,
                productId
            );

            logger.info('Pharmacist removed product from supplier catalog', {
                pharmacistId: req.user.id,
                supplierId,
                productId
            });

            res.json({
                success: true,
                message: 'Product removed from supplier catalog'
            });
        } catch (error) {
            if (error.message === 'Product not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Product not found'
                });
            }
            logger.error('Error removing supplier product', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.supplierId,
                productId: req.params.productId
            });
            next(error);
        }
    },

    // ============================================
    // SUPPLIER PERFORMANCE
    // ============================================

    /**
     * Get supplier performance metrics
     * GET /api/v1/pharmacist/suppliers/:id/performance
     */
    async getSupplierPerformance(req, res, next) {
        try {
            const { id } = req.params;
            const { from_date, to_date } = req.query;

            const performance = await supplierService.getSupplierPerformance(
                req.user.id,
                id,
                { from_date, to_date }
            );

            logger.info('Pharmacist viewed supplier performance', {
                pharmacistId: req.user.id,
                supplierId: id
            });

            res.json({
                success: true,
                data: performance
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error getting supplier performance', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Update supplier performance rating
     * PUT /api/v1/pharmacist/suppliers/:id/rating
     */
    async updateSupplierRating(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                quality_rating,
                price_rating,
                delivery_rating,
                comments 
            } = req.body;

            if (!quality_rating && !price_rating && !delivery_rating) {
                return res.status(400).json({
                    success: false,
                    error: 'At least one rating is required'
                });
            }

            const rating = await supplierService.updateSupplierRating(
                req.user.id,
                id,
                {
                    quality_rating,
                    price_rating,
                    delivery_rating,
                    comments,
                    rated_by: req.user.id,
                    rated_at: new Date()
                }
            );

            logger.info('Pharmacist updated supplier rating', {
                pharmacistId: req.user.id,
                supplierId: id,
                ratings: { quality_rating, price_rating, delivery_rating }
            });

            res.json({
                success: true,
                data: rating,
                message: 'Supplier rating updated'
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error updating supplier rating', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // SUPPLIER PAYMENTS
    // ============================================

    /**
     * Get supplier payment history
     * GET /api/v1/pharmacist/suppliers/:id/payments
     */
    async getSupplierPayments(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const payments = await supplierService.getSupplierPayments(
                req.user.id,
                id,
                options
            );

            res.json({
                success: true,
                data: payments.data,
                pagination: payments.pagination,
                summary: payments.summary
            });
        } catch (error) {
            logger.error('Error getting supplier payments', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Record payment to supplier
     * POST /api/v1/pharmacist/suppliers/:id/payments
     */
    async recordPayment(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                amount,
                payment_date,
                payment_method,
                reference_number,
                notes,
                purchase_order_ids
            } = req.body;

            if (!amount || amount <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid amount is required'
                });
            }

            const payment = await supplierService.recordPayment(
                req.user.id,
                id,
                {
                    amount,
                    payment_date: payment_date || new Date(),
                    payment_method,
                    reference_number,
                    notes,
                    purchase_order_ids,
                    recorded_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Pharmacist recorded supplier payment', {
                pharmacistId: req.user.id,
                supplierId: id,
                amount,
                method: payment_method
            });

            res.status(201).json({
                success: true,
                data: payment,
                message: 'Payment recorded successfully'
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error recording payment', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // SUPPLIER DOCUMENTS
    // ============================================

    /**
     * Get supplier documents
     * GET /api/v1/pharmacist/suppliers/:id/documents
     */
    async getSupplierDocuments(req, res, next) {
        try {
            const { id } = req.params;

            const documents = await supplierService.getSupplierDocuments(
                req.user.id,
                id
            );

            res.json({
                success: true,
                data: documents
            });
        } catch (error) {
            logger.error('Error getting supplier documents', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Upload supplier document
     * POST /api/v1/pharmacist/suppliers/:id/documents
     */
    async uploadSupplierDocument(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                document_type,
                document_name,
                document_url,
                expiry_date,
                notes 
            } = req.body;

            if (!document_type || !document_name || !document_url) {
                return res.status(400).json({
                    success: false,
                    error: 'Document type, name, and URL are required'
                });
            }

            const document = await supplierService.uploadSupplierDocument(
                req.user.id,
                id,
                {
                    document_type,
                    document_name,
                    document_url,
                    expiry_date,
                    notes,
                    uploaded_by: req.user.id,
                    uploaded_at: new Date()
                }
            );

            logger.info('Pharmacist uploaded supplier document', {
                pharmacistId: req.user.id,
                supplierId: id,
                documentType: document_type
            });

            res.status(201).json({
                success: true,
                data: document,
                message: 'Document uploaded successfully'
            });
        } catch (error) {
            if (error.message === 'Supplier not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Supplier not found'
                });
            }
            logger.error('Error uploading supplier document', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete supplier document
     * DELETE /api/v1/pharmacist/suppliers/:supplierId/documents/:documentId
     */
    async deleteSupplierDocument(req, res, next) {
        try {
            const { supplierId, documentId } = req.params;

            await supplierService.deleteSupplierDocument(
                req.user.id,
                supplierId,
                documentId
            );

            logger.info('Pharmacist deleted supplier document', {
                pharmacistId: req.user.id,
                supplierId,
                documentId
            });

            res.json({
                success: true,
                message: 'Document deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Document not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Document not found'
                });
            }
            logger.error('Error deleting supplier document', {
                error: error.message,
                pharmacistId: req.user.id,
                supplierId: req.params.supplierId,
                documentId: req.params.documentId
            });
            next(error);
        }
    },

    // ============================================
    // SUPPLIER REPORTS
    // ============================================

    /**
     * Get supplier report
     * GET /api/v1/pharmacist/suppliers/reports/summary
     */
    async getSupplierReport(req, res, next) {
        try {
            const { from_date, to_date } = req.query;

            const report = await supplierService.getSupplierReport(
                req.user.id,
                { from_date, to_date }
            );

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error getting supplier report', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export suppliers list
     * GET /api/v1/pharmacist/suppliers/export
     */
    async exportSuppliers(req, res, next) {
        try {
            const { format = 'csv', status } = req.query;

            const data = await supplierService.exportSuppliers(
                req.user.id,
                format,
                { status }
            );

            logger.info('Pharmacist exported suppliers list', {
                pharmacistId: req.user.id,
                format
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=suppliers-${Date.now()}.csv`);
                return res.send(data);
            }

            res.json({
                success: true,
                data
            });
        } catch (error) {
            logger.error('Error exporting suppliers', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    }
};

module.exports = supplierController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Supplier Lists         | 3         | All, active, by ID
 * CRUD Operations        | 3         | Add, update, delete
 * Supplier Products      | 4         | Get products, add, update, remove
 * Performance            | 2         | Get performance, update rating
 * Payments               | 2         | Get payments, record payment
 * Documents              | 3         | Get documents, upload, delete
 * Reports                | 2         | Get report, export
 * -----------------------|-----------|----------------------
 * TOTAL                  | 19        | Complete supplier management
 * 
 * ======================================================================
 */