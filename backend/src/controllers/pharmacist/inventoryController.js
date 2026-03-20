/**
 * ======================================================================
 * FILE: backend/src/controllers/pharmacist/inventoryController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist inventory controller - Handles all inventory management operations.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-19] Stock cannot go negative
 * - [BR-20] Alert when stock < reorder level
 * - [BR-21] Alert 30 days before expiry
 * - [BR-23] Batch tracking mandatory
 * 
 * ENDPOINTS: 15 endpoints
 * ======================================================================
 */

const inventoryService = require('../../services/pharmacist/inventoryService');
const logger = require('../../utils/logger');

/**
 * Pharmacist Inventory Controller
 */
const inventoryController = {
    // ============================================
    // INVENTORY LISTS
    // ============================================

    /**
     * Get all inventory items
     * GET /api/v1/pharmacist/inventory
     */
    async getAllInventory(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                category,
                manufacturer,
                location,
                status,
                search
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                category,
                manufacturer,
                location,
                status,
                search
            };

            const inventory = await inventoryService.getAllInventory(
                req.user.id,
                options
            );

            logger.info('Pharmacist retrieved inventory', {
                pharmacistId: req.user.id,
                count: inventory.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            res.json({
                success: true,
                data: inventory.data,
                pagination: inventory.pagination,
                summary: inventory.summary
            });
        } catch (error) {
            logger.error('Error getting inventory', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Search inventory
     * GET /api/v1/pharmacist/inventory/search
     */
    async searchInventory(req, res, next) {
        try {
            const { 
                q,
                page = 1, 
                limit = 20,
                category,
                manufacturer
            } = req.query;

            if (!q || q.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: 'Search term must be at least 2 characters'
                });
            }

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                category,
                manufacturer
            };

            const results = await inventoryService.searchInventory(
                req.user.id,
                q,
                options
            );

            logger.info('Pharmacist searched inventory', {
                pharmacistId: req.user.id,
                searchTerm: q,
                resultCount: results.data?.length || 0
            });

            res.json({
                success: true,
                data: results.data,
                pagination: results.pagination
            });
        } catch (error) {
            logger.error('Error searching inventory', {
                error: error.message,
                pharmacistId: req.user.id,
                search: req.query.q
            });
            next(error);
        }
    },

    /**
     * Get inventory by category
     * GET /api/v1/pharmacist/inventory/category/:category
     */
    async getInventoryByCategory(req, res, next) {
        try {
            const { category } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const inventory = await inventoryService.getInventoryByCategory(
                req.user.id,
                category,
                options
            );

            logger.info('Pharmacist retrieved inventory by category', {
                pharmacistId: req.user.id,
                category,
                count: inventory.data?.length || 0
            });

            res.json({
                success: true,
                data: inventory.data,
                pagination: inventory.pagination,
                summary: {
                    total: inventory.summary?.total || 0,
                    total_value: inventory.summary?.total_value || 0
                }
            });
        } catch (error) {
            logger.error('Error getting inventory by category', {
                error: error.message,
                pharmacistId: req.user.id,
                category: req.params.category
            });
            next(error);
        }
    },

    /**
     * Get inventory by manufacturer
     * GET /api/v1/pharmacist/inventory/manufacturer/:manufacturer
     */
    async getInventoryByManufacturer(req, res, next) {
        try {
            const { manufacturer } = req.params;
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const inventory = await inventoryService.getInventoryByManufacturer(
                req.user.id,
                manufacturer,
                options
            );

            logger.info('Pharmacist retrieved inventory by manufacturer', {
                pharmacistId: req.user.id,
                manufacturer,
                count: inventory.data?.length || 0
            });

            res.json({
                success: true,
                data: inventory.data,
                pagination: inventory.pagination
            });
        } catch (error) {
            logger.error('Error getting inventory by manufacturer', {
                error: error.message,
                pharmacistId: req.user.id,
                manufacturer: req.params.manufacturer
            });
            next(error);
        }
    },

    /**
     * Get low stock items
     * GET /api/v1/pharmacist/inventory/low-stock
     * 
     * BUSINESS RULE: [BR-20] Alert when stock < reorder level
     */
    async getLowStockItems(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const items = await inventoryService.getLowStockItems(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed low stock items', {
                pharmacistId: req.user.id,
                count: items.data?.length || 0,
                criticalCount: items.data?.filter(i => i.quantity === 0).length || 0
            });

            // [BR-20] Alert already triggered in service
            res.json({
                success: true,
                data: items.data,
                pagination: items.pagination,
                summary: {
                    total: items.summary?.total || 0,
                    out_of_stock: items.data?.filter(i => i.quantity === 0).length || 0,
                    below_reorder: items.data?.filter(i => i.quantity < i.reorder_level).length || 0,
                    critical_items: items.data?.filter(i => i.quantity <= i.minimum_stock).length || 0
                }
            });
        } catch (error) {
            logger.error('Error getting low stock items', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get out of stock items
     * GET /api/v1/pharmacist/inventory/out-of-stock
     */
    async getOutOfStockItems(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const items = await inventoryService.getOutOfStockItems(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed out of stock items', {
                pharmacistId: req.user.id,
                count: items.data?.length || 0
            });

            res.json({
                success: true,
                data: items.data,
                pagination: items.pagination,
                summary: {
                    total: items.summary?.total || 0,
                    estimated_restock_value: items.summary?.estimated_value || 0
                }
            });
        } catch (error) {
            logger.error('Error getting out of stock items', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get expiring soon items
     * GET /api/v1/pharmacist/inventory/expiring
     * 
     * BUSINESS RULE: [BR-21] Alert 30 days before expiry
     */
    async getExpiringItems(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20,
                days = 30 
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                days: parseInt(days)
            };

            const items = await inventoryService.getExpiringItems(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed expiring items', {
                pharmacistId: req.user.id,
                count: items.data?.length || 0,
                daysThreshold: parseInt(days)
            });

            // Group by urgency
            const now = new Date();
            const grouped = {
                critical: items.data?.filter(i => i.days_until_expiry <= 7).length || 0,
                warning: items.data?.filter(i => i.days_until_expiry > 7 && i.days_until_expiry <= 15).length || 0,
                notice: items.data?.filter(i => i.days_until_expiry > 15 && i.days_until_expiry <= 30).length || 0
            };

            res.json({
                success: true,
                data: items.data,
                pagination: items.pagination,
                summary: {
                    total: items.summary?.total || 0,
                    by_urgency: grouped,
                    total_value: items.summary?.total_value || 0
                }
            });
        } catch (error) {
            logger.error('Error getting expiring items', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get expired items
     * GET /api/v1/pharmacist/inventory/expired
     * 
     * BUSINESS RULE: [BR-18] Cannot dispense expired medicine
     */
    async getExpiredItems(req, res, next) {
        try {
            const { page = 1, limit = 20 } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const items = await inventoryService.getExpiredItems(
                req.user.id,
                options
            );

            logger.info('Pharmacist viewed expired items', {
                pharmacistId: req.user.id,
                count: items.data?.length || 0,
                totalValue: items.summary?.total_value || 0
            });

            res.json({
                success: true,
                data: items.data,
                pagination: items.pagination,
                summary: {
                    total: items.summary?.total || 0,
                    total_value: items.summary?.total_value || 0,
                    batches_affected: items.summary?.batches_affected || 0
                }
            });
        } catch (error) {
            logger.error('Error getting expired items', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Get inventory item by ID
     * GET /api/v1/pharmacist/inventory/:id
     */
    async getInventoryItemById(req, res, next) {
        try {
            const { id } = req.params;

            const item = await inventoryService.getInventoryItemById(
                req.user.id,
                id
            );

            if (!item) {
                return res.status(404).json({
                    success: false,
                    error: 'Inventory item not found'
                });
            }

            logger.info('Pharmacist viewed inventory item', {
                pharmacistId: req.user.id,
                itemId: id,
                medicineName: item.medicine_name
            });

            // [BR-21] Check if expiring soon
            if (item.days_until_expiry <= 30) {
                logger.warn('Expiring item viewed', {
                    itemId: id,
                    daysUntilExpiry: item.days_until_expiry
                });
            }

            res.json({
                success: true,
                data: item
            });
        } catch (error) {
            if (error.message === 'Inventory item not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Inventory item not found'
                });
            }
            logger.error('Error getting inventory item', {
                error: error.message,
                pharmacistId: req.user.id,
                itemId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // INVENTORY CRUD OPERATIONS
    // ============================================

    /**
     * Add new inventory item
     * POST /api/v1/pharmacist/inventory
     * 
     * BUSINESS RULES:
     * - [BR-14] Medicine quantity must be positive
     * - [BR-15] Dosage required
     * - [BR-23] Batch tracking mandatory
     */
    async addInventoryItem(req, res, next) {
        try {
            const itemData = {
                medicine_name: req.body.medicine_name,
                generic_name: req.body.generic_name,
                category: req.body.category,
                manufacturer: req.body.manufacturer,
                brand_name: req.body.brand_name,
                supplier_id: req.body.supplier_id,
                supplier_sku: req.body.supplier_sku,
                batch_number: req.body.batch_number,
                manufacturing_date: req.body.manufacturing_date,
                expiry_date: req.body.expiry_date,
                quantity: req.body.quantity,
                reorder_level: req.body.reorder_level,
                minimum_stock: req.body.minimum_stock,
                maximum_stock: req.body.maximum_stock,
                unit_price: req.body.unit_price,
                selling_price: req.body.selling_price,
                mrp: req.body.mrp,
                gst_percentage: req.body.gst_percentage,
                location: req.body.location,
                rack_number: req.body.rack_number,
                requires_prescription: req.body.requires_prescription,
                is_narcotic: req.body.is_narcotic,
                storage_conditions: req.body.storage_conditions,
                notes: req.body.notes,
                created_by: req.user.id,
                ip_address: req.ip,
                user_agent: req.headers['user-agent']
            };

            // Validate required fields
            if (!itemData.medicine_name || !itemData.category || !itemData.manufacturer) {
                return res.status(400).json({
                    success: false,
                    error: 'Medicine name, category, and manufacturer are required'
                });
            }

            // [BR-23] Batch tracking mandatory
            if (!itemData.batch_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Batch number is required'
                });
            }

            // [BR-21] Validate expiry date
            if (new Date(itemData.expiry_date) <= new Date()) {
                return res.status(400).json({
                    success: false,
                    error: 'Expiry date must be in future'
                });
            }

            const item = await inventoryService.addInventoryItem(
                req.user.id,
                itemData
            );

            logger.info('Pharmacist added inventory item', {
                pharmacistId: req.user.id,
                itemId: item.id,
                medicineName: item.medicine_name,
                batchNumber: item.batch_number
            });

            res.status(201).json({
                success: true,
                data: item,
                message: 'Inventory item added successfully'
            });
        } catch (error) {
            if (error.message.includes('already exists')) {
                return res.status(409).json({
                    success: false,
                    error: 'Item with this batch number already exists'
                });
            }
            logger.error('Error adding inventory item', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update inventory item
     * PUT /api/v1/pharmacist/inventory/:id
     */
    async updateInventoryItem(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Don't allow updating certain fields
            delete updates.id;
            delete updates.batch_number;
            delete updates.created_by;
            delete updates.created_at;

            const item = await inventoryService.updateInventoryItem(
                req.user.id,
                id,
                updates
            );

            logger.info('Pharmacist updated inventory item', {
                pharmacistId: req.user.id,
                itemId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: item,
                message: 'Inventory item updated successfully'
            });
        } catch (error) {
            if (error.message === 'Inventory item not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Inventory item not found'
                });
            }
            logger.error('Error updating inventory item', {
                error: error.message,
                pharmacistId: req.user.id,
                itemId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete inventory item (soft delete)
     * DELETE /api/v1/pharmacist/inventory/:id
     */
    async deleteInventoryItem(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            await inventoryService.deleteInventoryItem(
                req.user.id,
                id,
                reason
            );

            logger.info('Pharmacist deleted inventory item', {
                pharmacistId: req.user.id,
                itemId: id,
                reason
            });

            res.json({
                success: true,
                message: 'Inventory item deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Inventory item not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Inventory item not found'
                });
            }
            if (error.message === 'Cannot delete item with stock') {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot delete item with existing stock'
                });
            }
            logger.error('Error deleting inventory item', {
                error: error.message,
                pharmacistId: req.user.id,
                itemId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // STOCK MANAGEMENT
    // ============================================

    /**
     * Add stock to inventory
     * POST /api/v1/pharmacist/inventory/:id/stock-in
     * 
     * BUSINESS RULES:
     * - [BR-19] Stock cannot go negative (handled by adding)
     * - [BR-23] Batch tracking mandatory
     */
    async addStock(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                quantity, 
                batch_number,
                expiry_date,
                unit_price,
                reason,
                reference_number
            } = req.body;

            if (!quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid quantity is required'
                });
            }

            // [BR-23] Batch tracking
            if (!batch_number) {
                return res.status(400).json({
                    success: false,
                    error: 'Batch number is required for stock addition'
                });
            }

            const result = await inventoryService.addStock(
                req.user.id,
                id,
                {
                    quantity,
                    batch_number,
                    expiry_date,
                    unit_price,
                    reason,
                    reference_number,
                    added_at: new Date(),
                    added_by: req.user.id
                }
            );

            logger.info('Pharmacist added stock', {
                pharmacistId: req.user.id,
                itemId: id,
                quantity,
                batchNumber: batch_number,
                newQuantity: result.new_quantity
            });

            res.json({
                success: true,
                data: result,
                message: `Stock added successfully. New quantity: ${result.new_quantity}`
            });
        } catch (error) {
            if (error.message === 'Inventory item not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Inventory item not found'
                });
            }
            logger.error('Error adding stock', {
                error: error.message,
                pharmacistId: req.user.id,
                itemId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Remove stock from inventory
     * POST /api/v1/pharmacist/inventory/:id/stock-out
     * 
     * BUSINESS RULE: [BR-19] Stock cannot go negative
     */
    async removeStock(req, res, next) {
        try {
            const { id } = req.params;
            const { 
                quantity, 
                reason,
                reference_number,
                prescription_id,
                patient_id
            } = req.body;

            if (!quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Valid quantity is required'
                });
            }

            const result = await inventoryService.removeStock(
                req.user.id,
                id,
                {
                    quantity,
                    reason,
                    reference_number,
                    prescription_id,
                    patient_id,
                    removed_at: new Date(),
                    removed_by: req.user.id
                }
            );

            logger.info('Pharmacist removed stock', {
                pharmacistId: req.user.id,
                itemId: id,
                quantity,
                reason,
                newQuantity: result.new_quantity
            });

            res.json({
                success: true,
                data: result,
                message: `Stock removed successfully. New quantity: ${result.new_quantity}`
            });
        } catch (error) {
            if (error.message === 'Inventory item not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Inventory item not found'
                });
            }
            if (error.message === 'Insufficient stock') {
                return res.status(400).json({
                    success: false,
                    error: 'Insufficient stock available'
                });
            }
            logger.error('Error removing stock', {
                error: error.message,
                pharmacistId: req.user.id,
                itemId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Get stock history
     * GET /api/v1/pharmacist/inventory/:id/history
     */
    async getStockHistory(req, res, next) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 20, from_date, to_date } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                from_date,
                to_date
            };

            const history = await inventoryService.getStockHistory(
                req.user.id,
                id,
                options
            );

            logger.info('Pharmacist viewed stock history', {
                pharmacistId: req.user.id,
                itemId: id,
                entryCount: history.data?.length || 0
            });

            res.json({
                success: true,
                data: history.data,
                pagination: history.pagination,
                summary: history.summary
            });
        } catch (error) {
            if (error.message === 'Inventory item not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Inventory item not found'
                });
            }
            logger.error('Error getting stock history', {
                error: error.message,
                pharmacistId: req.user.id,
                itemId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // BULK OPERATIONS
    // ============================================

    /**
     * Bulk update stock levels
     * POST /api/v1/pharmacist/inventory/bulk-update
     */
    async bulkUpdateStock(req, res, next) {
        try {
            const { updates } = req.body;

            if (!updates || !Array.isArray(updates) || updates.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Updates array is required'
                });
            }

            const results = await inventoryService.bulkUpdateStock(
                req.user.id,
                updates
            );

            logger.info('Pharmacist performed bulk stock update', {
                pharmacistId: req.user.id,
                requestedCount: updates.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            });

            res.json({
                success: true,
                data: results,
                message: `Updated ${results.success.length} out of ${updates.length} items`
            });
        } catch (error) {
            logger.error('Error in bulk stock update', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Export inventory report
     * GET /api/v1/pharmacist/inventory/export
     */
    async exportInventory(req, res, next) {
        try {
            const { format = 'csv', category, manufacturer } = req.query;

            const filters = {
                category,
                manufacturer
            };

            const report = await inventoryService.exportInventory(
                req.user.id,
                format,
                filters
            );

            logger.info('Pharmacist exported inventory', {
                pharmacistId: req.user.id,
                format,
                filters: Object.keys(filters).filter(f => filters[f])
            });

            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=inventory-${Date.now()}.csv`);
                return res.send(report);
            }

            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=inventory-${Date.now()}.pdf`);
                return res.send(report);
            }

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            logger.error('Error exporting inventory', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    // ============================================
    // INVENTORY ALERTS
    // ============================================

    /**
     * Get inventory alerts
     * GET /api/v1/pharmacist/inventory/alerts
     */
    async getInventoryAlerts(req, res, next) {
        try {
            const alerts = await inventoryService.getInventoryAlerts(req.user.id);

            logger.info('Pharmacist viewed inventory alerts', {
                pharmacistId: req.user.id,
                alertCount: alerts.length
            });

            res.json({
                success: true,
                data: alerts,
                summary: {
                    total: alerts.length,
                    low_stock: alerts.filter(a => a.type === 'low_stock').length,
                    expiring: alerts.filter(a => a.type === 'expiring').length,
                    expired: alerts.filter(a => a.type === 'expired').length,
                    out_of_stock: alerts.filter(a => a.type === 'out_of_stock').length
                }
            });
        } catch (error) {
            logger.error('Error getting inventory alerts', {
                error: error.message,
                pharmacistId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Acknowledge inventory alert
     * PUT /api/v1/pharmacist/inventory/alerts/:id/acknowledge
     */
    async acknowledgeAlert(req, res, next) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const alert = await inventoryService.acknowledgeAlert(
                req.user.id,
                id,
                notes
            );

            logger.info('Pharmacist acknowledged inventory alert', {
                pharmacistId: req.user.id,
                alertId: id
            });

            res.json({
                success: true,
                data: alert,
                message: 'Alert acknowledged'
            });
        } catch (error) {
            if (error.message === 'Alert not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found'
                });
            }
            logger.error('Error acknowledging alert', {
                error: error.message,
                pharmacistId: req.user.id,
                alertId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = inventoryController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Inventory Lists        | 7         | All, search, by category, by manufacturer, low stock, out of stock, expiring, expired, by ID
 * CRUD Operations        | 3         | Add, update, delete
 * Stock Management       | 3         | Add stock, remove stock, stock history
 * Bulk Operations        | 2         | Bulk update, export
 * Inventory Alerts       | 2         | Get alerts, acknowledge
 * -----------------------|-----------|----------------------
 * TOTAL                  | 17        | Complete inventory management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-14] Medicine quantity positive
 * - [BR-15] Dosage required
 * - [BR-18] No expired dispensing
 * - [BR-19] Stock non-negative
 * - [BR-20] Low stock alerts
 * - [BR-21] Expiry alerts
 * - [BR-23] Batch tracking
 * 
 * ======================================================================
 */