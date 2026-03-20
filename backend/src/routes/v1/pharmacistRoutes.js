/**
 * ======================================================================
 * FILE: backend/src/routes/v1/pharmacistRoutes.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Pharmacist module routes - All pharmacist-facing endpoints.
 * Total Endpoints: 61 (including root endpoint)
 * 
 * VERSION: 1.0.7
 * UPDATED: 2026-03-19
 * 
 * CHANGE LOG:
 * v1.0.1 - Fixed authorize middleware calls to use authorize.pharmacist shortcut
 *          (bypasses missing permissions check, keeps role validation)
 * v1.0.2 - Fixed authorize.pharmacist syntax error - changed to authorize('pharmacist')
 * v1.0.3 - Added comprehensive route debugging to identify callback function issues
 *          Each route now logs its registration status and handler types
 * v1.0.4 - FIXED: Destructured authenticate import from auth.js object
 *          The auth.js exports an object with multiple functions, so we need { authenticate }
 *          Previous import was importing the entire object causing "Handler not a function" error
 * v1.0.5 - PRODUCTION READY: Removed all debug code and console logs
 *          Clean production version with only route definitions
 * v1.0.6 - ADDED: Root endpoint (/) for base URL access
 *          Now GET /api/v1/pharmacist returns API information instead of 404
 * v1.0.7 - HYBRID APPROACH: Root endpoint is now public (no auth required)
 *          Health endpoint remains protected with authentication
 *          All other endpoints remain protected
 *          This provides basic module info publicly while keeping sensitive data secure
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES COVERED:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required for all medicines
 * - [BR-16] Controlled substances need special flag
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-19] Stock cannot go negative
 * - [BR-20] Alert when stock < reorder level
 * - [BR-21] Alert 30 days before expiry
 * - [BR-22] FIFO (First In First Out) dispensing
 * - [BR-23] Batch tracking mandatory
 * 
 * ======================================================================
 */

const express = require('express');
const router = express.Router();

// ============================================
// IMPORT MIDDLEWARES
// ============================================
const { authenticate } = require('../../middlewares/auth');
const authorize = require('../../middlewares/rbac');
const { standard, sensitive } = require('../../middlewares/rateLimiter');
const auditLogger = require('../../middlewares/auditLogger');

// ============================================
// IMPORT CONTROLLERS
// ============================================
const inventoryController = require('../../controllers/pharmacist/inventoryController');
const batchController = require('../../controllers/pharmacist/batchController');
const dispensingController = require('../../controllers/pharmacist/dispensingController');
const supplierController = require('../../controllers/pharmacist/supplierController');
const purchaseOrderController = require('../../controllers/pharmacist/purchaseOrderController');
const returnController = require('../../controllers/pharmacist/returnController');
const reportController = require('../../controllers/pharmacist/reportController');
const dashboardController = require('../../controllers/pharmacist/dashboardController');

// ============================================
// IMPORT VALIDATORS
// ============================================
const {
    validateInventoryItem,
    validateStockUpdate,
    validateBatch,
    validateDispensing,
    validateSupplier,
    validatePurchaseOrder,
    validateReturn,
    validatePagination,
    validateDateRange
} = require('../../validators/pharmacistValidators');

// ============================================
// ============================================
// PUBLIC ROOT ENDPOINT (No Authentication)
// ============================================
// ============================================
// v1.0.7 - Made public, removed authentication

/**
 * Public root endpoint for pharmacist module
 * GET /api/v1/pharmacist
 * No authentication required - provides basic module information
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        module: 'Pharmacist API',
        version: '1.0.7',
        status: 'operational',
        documentation: '/api/v1/pharmacist/health',
        authentication: 'Bearer token required for all data endpoints',
        // ❌ No internal endpoints listed - security through obscurity
        // Health endpoint is documented but requires auth for details
        available: {
            health: '/api/v1/pharmacist/health'
        }
    });
});

// ============================================
// ============================================
// INVENTORY MANAGEMENT ROUTES (15 endpoints)
// ============================================
// ============================================

/**
 * Get all inventory items
 * GET /api/v1/pharmacist/inventory
 */
router.get('/inventory',
    authenticate,
    authorize('pharmacist'),
    standard,
    validatePagination,
    auditLogger('PHARMACIST_VIEW_INVENTORY'),
    inventoryController.getAllInventory
);

/**
 * Search inventory
 * GET /api/v1/pharmacist/inventory/search
 */
router.get('/inventory/search',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    auditLogger('PHARMACIST_SEARCH_INVENTORY'),
    inventoryController.searchInventory
);

/**
 * Get inventory by category
 * GET /api/v1/pharmacist/inventory/category/:category
 */
router.get('/inventory/category/:category',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    auditLogger('PHARMACIST_VIEW_INVENTORY_BY_CATEGORY'),
    inventoryController.getInventoryByCategory
);

/**
 * Get inventory by manufacturer
 * GET /api/v1/pharmacist/inventory/manufacturer/:manufacturer
 */
router.get('/inventory/manufacturer/:manufacturer',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    auditLogger('PHARMACIST_VIEW_INVENTORY_BY_MANUFACTURER'),
    inventoryController.getInventoryByManufacturer
);

/**
 * Get low stock items
 * GET /api/v1/pharmacist/inventory/low-stock
 * 
 * BUSINESS RULE: [BR-20] Alert when stock < reorder level
 */
router.get('/inventory/low-stock',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    auditLogger('PHARMACIST_VIEW_LOW_STOCK'),
    inventoryController.getLowStockItems
);

/**
 * Get out of stock items
 * GET /api/v1/pharmacist/inventory/out-of-stock
 */
router.get('/inventory/out-of-stock',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    auditLogger('PHARMACIST_VIEW_OUT_OF_STOCK'),
    inventoryController.getOutOfStockItems
);

/**
 * Get expiring soon items
 * GET /api/v1/pharmacist/inventory/expiring
 * 
 * BUSINESS RULE: [BR-21] Alert 30 days before expiry
 */
router.get('/inventory/expiring',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    auditLogger('PHARMACIST_VIEW_EXPIRING'),
    inventoryController.getExpiringItems
);

/**
 * Get expired items
 * GET /api/v1/pharmacist/inventory/expired
 * 
 * BUSINESS RULE: [BR-18] Cannot dispense expired medicine
 */
router.get('/inventory/expired',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    auditLogger('PHARMACIST_VIEW_EXPIRED'),
    inventoryController.getExpiredItems
);

/**
 * Get inventory item by ID
 * GET /api/v1/pharmacist/inventory/:id
 */
router.get('/inventory/:id',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    auditLogger('PHARMACIST_VIEW_INVENTORY_ITEM'),
    inventoryController.getInventoryItemById
);

/**
 * Add new inventory item
 * POST /api/v1/pharmacist/inventory
 */
router.post('/inventory',
    authenticate,
    authorize('pharmacist', 'manage_inventory'),
    sensitive,
    validateInventoryItem,
    auditLogger('PHARMACIST_ADD_INVENTORY'),
    inventoryController.addInventoryItem
);

/**
 * Update inventory item
 * PUT /api/v1/pharmacist/inventory/:id
 */
router.put('/inventory/:id',
    authenticate,
    authorize('pharmacist', 'manage_inventory'),
    sensitive,
    validateInventoryItem,
    auditLogger('PHARMACIST_UPDATE_INVENTORY'),
    inventoryController.updateInventoryItem
);

/**
 * Delete inventory item (soft delete)
 * DELETE /api/v1/pharmacist/inventory/:id
 */
router.delete('/inventory/:id',
    authenticate,
    authorize('pharmacist', 'manage_inventory'),
    sensitive,
    auditLogger('PHARMACIST_DELETE_INVENTORY'),
    inventoryController.deleteInventoryItem
);

/**
 * Add stock to inventory
 * POST /api/v1/pharmacist/inventory/:id/stock-in
 * 
 * BUSINESS RULE: [BR-23] Batch tracking mandatory
 */
router.post('/inventory/:id/stock-in',
    authenticate,
    authorize('pharmacist', 'manage_inventory'),
    sensitive,
    validateStockUpdate,
    auditLogger('PHARMACIST_STOCK_IN'),
    inventoryController.addStock
);

/**
 * Remove stock from inventory
 * POST /api/v1/pharmacist/inventory/:id/stock-out
 * 
 * BUSINESS RULE: [BR-19] Stock cannot go negative
 */
router.post('/inventory/:id/stock-out',
    authenticate,
    authorize('pharmacist', 'manage_inventory'),
    sensitive,
    validateStockUpdate,
    auditLogger('PHARMACIST_STOCK_OUT'),
    inventoryController.removeStock
);

/**
 * Get inventory stock history
 * GET /api/v1/pharmacist/inventory/:id/history
 */
router.get('/inventory/:id/history',
    authenticate,
    authorize('pharmacist', 'view_inventory'),
    standard,
    validatePagination,
    auditLogger('PHARMACIST_VIEW_STOCK_HISTORY'),
    inventoryController.getStockHistory
);

// ============================================
// ============================================
// BATCH MANAGEMENT ROUTES (6 endpoints)
// ============================================
// ============================================

/**
 * Get all batches
 * GET /api/v1/pharmacist/batches
 */
router.get('/batches',
    authenticate,
    authorize('pharmacist', 'view_batches'),
    standard,
    validatePagination,
    auditLogger('PHARMACIST_VIEW_BATCHES'),
    batchController.getAllBatches
);

/**
 * Get expiring batches
 * GET /api/v1/pharmacist/batches/expiring
 * 
 * BUSINESS RULE: [BR-21] Alert 30 days before expiry
 */
router.get('/batches/expiring',
    authenticate,
    authorize('pharmacist', 'view_batches'),
    standard,
    auditLogger('PHARMACIST_VIEW_EXPIRING_BATCHES'),
    batchController.getExpiringBatches
);

/**
 * Get batch by ID
 * GET /api/v1/pharmacist/batches/:id
 */
router.get('/batches/:id',
    authenticate,
    authorize('pharmacist', 'view_batches'),
    standard,
    auditLogger('PHARMACIST_VIEW_BATCH'),
    batchController.getBatchById
);

/**
 * Add new batch
 * POST /api/v1/pharmacist/batches
 * 
 * BUSINESS RULE: [BR-23] Batch tracking mandatory
 */
router.post('/batches',
    authenticate,
    authorize('pharmacist', 'manage_batches'),
    sensitive,
    validateBatch,
    auditLogger('PHARMACIST_ADD_BATCH'),
    batchController.addBatch
);

/**
 * Update batch
 * PUT /api/v1/pharmacist/batches/:id
 */
router.put('/batches/:id',
    authenticate,
    authorize('pharmacist', 'manage_batches'),
    sensitive,
    validateBatch,
    auditLogger('PHARMACIST_UPDATE_BATCH'),
    batchController.updateBatch
);

/**
 * Delete batch
 * DELETE /api/v1/pharmacist/batches/:id
 */
router.delete('/batches/:id',
    authenticate,
    authorize('pharmacist', 'manage_batches'),
    sensitive,
    auditLogger('PHARMACIST_DELETE_BATCH'),
    batchController.deleteBatch
);

// ============================================
// ============================================
// PRESCRIPTION DISPENSING ROUTES (9 endpoints)
// ============================================
// ============================================

/**
 * Get all prescriptions
 * GET /api/v1/pharmacist/prescriptions
 */
router.get('/prescriptions',
    authenticate,
    authorize('pharmacist', 'view_prescriptions'),
    standard,
    validatePagination,
    auditLogger('PHARMACIST_VIEW_PRESCRIPTIONS'),
    dispensingController.getAllPrescriptions
);

/**
 * Get pending prescriptions
 * GET /api/v1/pharmacist/prescriptions/pending
 */
router.get('/prescriptions/pending',
    authenticate,
    authorize('pharmacist', 'view_prescriptions'),
    standard,
    auditLogger('PHARMACIST_VIEW_PENDING_PRESCRIPTIONS'),
    dispensingController.getPendingPrescriptions
);

/**
 * Get dispensed prescriptions
 * GET /api/v1/pharmacist/prescriptions/dispensed
 */
router.get('/prescriptions/dispensed',
    authenticate,
    authorize('pharmacist', 'view_prescriptions'),
    standard,
    auditLogger('PHARMACIST_VIEW_DISPENSED'),
    dispensingController.getDispensedPrescriptions
);

/**
 * Get prescription by ID
 * GET /api/v1/pharmacist/prescriptions/:id
 */
router.get('/prescriptions/:id',
    authenticate,
    authorize('pharmacist', 'view_prescription'),
    standard,
    auditLogger('PHARMACIST_VIEW_PRESCRIPTION'),
    dispensingController.getPrescriptionById
);

/**
 * Get prescription items
 * GET /api/v1/pharmacist/prescriptions/:id/items
 */
router.get('/prescriptions/:id/items',
    authenticate,
    authorize('pharmacist', 'view_prescription'),
    standard,
    auditLogger('PHARMACIST_VIEW_PRESCRIPTION_ITEMS'),
    dispensingController.getPrescriptionItems
);

/**
 * Dispense prescription (full)
 * POST /api/v1/pharmacist/prescriptions/:id/dispense
 * 
 * BUSINESS RULES:
 * - [BR-14] Medicine quantity must be positive
 * - [BR-15] Dosage required
 * - [BR-16] Controlled substances need special flag
 * - [BR-18] Cannot dispense expired medicine
 * - [BR-19] Stock cannot go negative
 * - [BR-22] FIFO (First In First Out) dispensing
 */
router.post('/prescriptions/:id/dispense',
    authenticate,
    authorize('pharmacist', 'dispense_medicines'),
    sensitive,
    validateDispensing,
    auditLogger('PHARMACIST_DISPENSE_FULL'),
    dispensingController.dispensePrescription
);

/**
 * Partial dispense prescription
 * POST /api/v1/pharmacist/prescriptions/:id/partial-dispense
 */
router.post('/prescriptions/:id/partial-dispense',
    authenticate,
    authorize('pharmacist', 'dispense_medicines'),
    sensitive,
    validateDispensing,
    auditLogger('PHARMACIST_DISPENSE_PARTIAL'),
    dispensingController.partialDispense
);

/**
 * Get dispensing history
 * GET /api/v1/pharmacist/dispensing/history
 */
router.get('/dispensing/history',
    authenticate,
    authorize('pharmacist', 'view_dispensing'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('PHARMACIST_VIEW_DISPENSING_HISTORY'),
    dispensingController.getDispensingHistory
);

/**
 * Get today's dispensing
 * GET /api/v1/pharmacist/dispensing/today
 */
router.get('/dispensing/today',
    authenticate,
    authorize('pharmacist', 'view_dispensing'),
    standard,
    auditLogger('PHARMACIST_VIEW_TODAY_DISPENSING'),
    dispensingController.getTodaysDispensing
);

// ============================================
// ============================================
// SUPPLIER MANAGEMENT ROUTES (7 endpoints)
// ============================================
// ============================================

/**
 * Get all suppliers
 * GET /api/v1/pharmacist/suppliers
 */
router.get('/suppliers',
    authenticate,
    authorize('pharmacist', 'view_suppliers'),
    standard,
    validatePagination,
    auditLogger('PHARMACIST_VIEW_SUPPLIERS'),
    supplierController.getAllSuppliers
);

/**
 * Get active suppliers
 * GET /api/v1/pharmacist/suppliers/active
 */
router.get('/suppliers/active',
    authenticate,
    authorize('pharmacist', 'view_suppliers'),
    standard,
    auditLogger('PHARMACIST_VIEW_ACTIVE_SUPPLIERS'),
    supplierController.getActiveSuppliers
);

/**
 * Get supplier by ID
 * GET /api/v1/pharmacist/suppliers/:id
 */
router.get('/suppliers/:id',
    authenticate,
    authorize('pharmacist', 'view_suppliers'),
    standard,
    auditLogger('PHARMACIST_VIEW_SUPPLIER'),
    supplierController.getSupplierById
);

/**
 * Add new supplier
 * POST /api/v1/pharmacist/suppliers
 */
router.post('/suppliers',
    authenticate,
    authorize('pharmacist', 'manage_suppliers'),
    sensitive,
    validateSupplier,
    auditLogger('PHARMACIST_ADD_SUPPLIER'),
    supplierController.addSupplier
);

/**
 * Update supplier
 * PUT /api/v1/pharmacist/suppliers/:id
 */
router.put('/suppliers/:id',
    authenticate,
    authorize('pharmacist', 'manage_suppliers'),
    sensitive,
    validateSupplier,
    auditLogger('PHARMACIST_UPDATE_SUPPLIER'),
    supplierController.updateSupplier
);

/**
 * Delete supplier (soft delete)
 * DELETE /api/v1/pharmacist/suppliers/:id
 */
router.delete('/suppliers/:id',
    authenticate,
    authorize('pharmacist', 'manage_suppliers'),
    sensitive,
    auditLogger('PHARMACIST_DELETE_SUPPLIER'),
    supplierController.deleteSupplier
);

/**
 * Get supplier products
 * GET /api/v1/pharmacist/suppliers/:id/products
 */
router.get('/suppliers/:id/products',
    authenticate,
    authorize('pharmacist', 'view_suppliers'),
    standard,
    auditLogger('PHARMACIST_VIEW_SUPPLIER_PRODUCTS'),
    supplierController.getSupplierProducts
);

// ============================================
// ============================================
// PURCHASE ORDER ROUTES (10 endpoints)
// ============================================
// ============================================

/**
 * Get all purchase orders
 * GET /api/v1/pharmacist/purchase-orders
 */
router.get('/purchase-orders',
    authenticate,
    authorize('pharmacist', 'view_purchase_orders'),
    standard,
    validatePagination,
    auditLogger('PHARMACIST_VIEW_PURCHASE_ORDERS'),
    purchaseOrderController.getAllPurchaseOrders
);

/**
 * Get pending purchase orders
 * GET /api/v1/pharmacist/purchase-orders/pending
 */
router.get('/purchase-orders/pending',
    authenticate,
    authorize('pharmacist', 'view_purchase_orders'),
    standard,
    auditLogger('PHARMACIST_VIEW_PENDING_POS'),
    purchaseOrderController.getPendingPurchaseOrders
);

/**
 * Get approved purchase orders
 * GET /api/v1/pharmacist/purchase-orders/approved
 */
router.get('/purchase-orders/approved',
    authenticate,
    authorize('pharmacist', 'view_purchase_orders'),
    standard,
    auditLogger('PHARMACIST_VIEW_APPROVED_POS'),
    purchaseOrderController.getApprovedPurchaseOrders
);

/**
 * Get received purchase orders
 * GET /api/v1/pharmacist/purchase-orders/received
 */
router.get('/purchase-orders/received',
    authenticate,
    authorize('pharmacist', 'view_purchase_orders'),
    standard,
    auditLogger('PHARMACIST_VIEW_RECEIVED_POS'),
    purchaseOrderController.getReceivedPurchaseOrders
);

/**
 * Get purchase order by ID
 * GET /api/v1/pharmacist/purchase-orders/:id
 */
router.get('/purchase-orders/:id',
    authenticate,
    authorize('pharmacist', 'view_purchase_order'),
    standard,
    auditLogger('PHARMACIST_VIEW_PURCHASE_ORDER'),
    purchaseOrderController.getPurchaseOrderById
);

/**
 * Create purchase order
 * POST /api/v1/pharmacist/purchase-orders
 */
router.post('/purchase-orders',
    authenticate,
    authorize('pharmacist', 'create_purchase_order'),
    sensitive,
    validatePurchaseOrder,
    auditLogger('PHARMACIST_CREATE_PO'),
    purchaseOrderController.createPurchaseOrder
);

/**
 * Update purchase order
 * PUT /api/v1/pharmacist/purchase-orders/:id
 */
router.put('/purchase-orders/:id',
    authenticate,
    authorize('pharmacist', 'update_purchase_order'),
    sensitive,
    validatePurchaseOrder,
    auditLogger('PHARMACIST_UPDATE_PO'),
    purchaseOrderController.updatePurchaseOrder
);

/**
 * Delete purchase order
 * DELETE /api/v1/pharmacist/purchase-orders/:id
 */
router.delete('/purchase-orders/:id',
    authenticate,
    authorize('pharmacist', 'delete_purchase_order'),
    sensitive,
    auditLogger('PHARMACIST_DELETE_PO'),
    purchaseOrderController.deletePurchaseOrder
);

/**
 * Submit purchase order for approval
 * PUT /api/v1/pharmacist/purchase-orders/:id/submit
 */
router.put('/purchase-orders/:id/submit',
    authenticate,
    authorize('pharmacist', 'submit_purchase_order'),
    sensitive,
    auditLogger('PHARMACIST_SUBMIT_PO'),
    purchaseOrderController.submitPurchaseOrder
);

/**
 * Receive purchase order
 * PUT /api/v1/pharmacist/purchase-orders/:id/receive
 */
router.put('/purchase-orders/:id/receive',
    authenticate,
    authorize('pharmacist', 'receive_purchase_order'),
    sensitive,
    auditLogger('PHARMACIST_RECEIVE_PO'),
    purchaseOrderController.receivePurchaseOrder
);

/**
 * Get purchase order items
 * GET /api/v1/pharmacist/purchase-orders/:id/items
 */
router.get('/purchase-orders/:id/items',
    authenticate,
    authorize('pharmacist', 'view_purchase_order'),
    standard,
    auditLogger('PHARMACIST_VIEW_PO_ITEMS'),
    purchaseOrderController.getPurchaseOrderItems
);

// ============================================
// ============================================
// RETURNS & EXPIRY ROUTES (4 endpoints)
// ============================================
// ============================================

/**
 * Return medicine
 * POST /api/v1/pharmacist/returns
 */
router.post('/returns',
    authenticate,
    authorize('pharmacist', 'process_returns'),
    sensitive,
    validateReturn,
    auditLogger('PHARMACIST_RETURN_MEDICINE'),
    returnController.returnMedicine
);

/**
 * Get returns history
 * GET /api/v1/pharmacist/returns
 */
router.get('/returns',
    authenticate,
    authorize('pharmacist', 'view_returns'),
    standard,
    validatePagination,
    validateDateRange,
    auditLogger('PHARMACIST_VIEW_RETURNS'),
    returnController.getReturnsHistory
);

/**
 * Dispose expired medicines
 * POST /api/v1/pharmacist/expiry/dispose
 * 
 * BUSINESS RULE: [BR-18] Cannot dispense expired medicine
 */
router.post('/expiry/dispose',
    authenticate,
    authorize('pharmacist', 'dispose_expired'),
    sensitive,
    auditLogger('PHARMACIST_DISPOSE_EXPIRED'),
    returnController.disposeExpired
);

/**
 * Get expiry report
 * GET /api/v1/pharmacist/expiry/report
 * 
 * BUSINESS RULE: [BR-21] Alert 30 days before expiry
 */
router.get('/expiry/report',
    authenticate,
    authorize('pharmacist', 'view_reports'),
    standard,
    auditLogger('PHARMACIST_VIEW_EXPIRY_REPORT'),
    returnController.getExpiryReport
);

// ============================================
// ============================================
// REPORTS ROUTES (6 endpoints)
// ============================================
// ============================================

/**
 * Get inventory report
 * GET /api/v1/pharmacist/reports/inventory
 */
router.get('/reports/inventory',
    authenticate,
    authorize('pharmacist', 'view_reports'),
    standard,
    validateDateRange,
    auditLogger('PHARMACIST_VIEW_INVENTORY_REPORT'),
    reportController.getInventoryReport
);

/**
 * Get consumption report
 * GET /api/v1/pharmacist/reports/consumption
 */
router.get('/reports/consumption',
    authenticate,
    authorize('pharmacist', 'view_reports'),
    standard,
    validateDateRange,
    auditLogger('PHARMACIST_VIEW_CONSUMPTION_REPORT'),
    reportController.getConsumptionReport
);

/**
 * Get dispensing report
 * GET /api/v1/pharmacist/reports/dispensing
 */
router.get('/reports/dispensing',
    authenticate,
    authorize('pharmacist', 'view_reports'),
    standard,
    validateDateRange,
    auditLogger('PHARMACIST_VIEW_DISPENSING_REPORT'),
    reportController.getDispensingReport
);

/**
 * Get expiry report
 * GET /api/v1/pharmacist/reports/expiry
 */
router.get('/reports/expiry',
    authenticate,
    authorize('pharmacist', 'view_reports'),
    standard,
    auditLogger('PHARMACIST_VIEW_EXPIRY_REPORT'),
    reportController.getExpiryReport
);

/**
 * Get purchase orders report
 * GET /api/v1/pharmacist/reports/purchase-orders
 */
router.get('/reports/purchase-orders',
    authenticate,
    authorize('pharmacist', 'view_reports'),
    standard,
    validateDateRange,
    auditLogger('PHARMACIST_VIEW_PO_REPORT'),
    reportController.getPurchaseOrdersReport
);

/**
 * Get supplier performance report
 * GET /api/v1/pharmacist/reports/supplier-performance
 */
router.get('/reports/supplier-performance',
    authenticate,
    authorize('pharmacist', 'view_reports'),
    standard,
    validateDateRange,
    auditLogger('PHARMACIST_VIEW_SUPPLIER_PERFORMANCE'),
    reportController.getSupplierPerformanceReport
);

// ============================================
// ============================================
// DASHBOARD ROUTES (3 endpoints)
// ============================================
// ============================================

/**
 * Get main dashboard
 * GET /api/v1/pharmacist/dashboard
 */
router.get('/dashboard',
    authenticate,
    authorize('pharmacist', 'view_dashboard'),
    standard,
    auditLogger('PHARMACIST_VIEW_DASHBOARD'),
    dashboardController.getDashboard
);

/**
 * Get low stock summary
 * GET /api/v1/pharmacist/dashboard/low-stock
 */
router.get('/dashboard/low-stock',
    authenticate,
    authorize('pharmacist', 'view_dashboard'),
    standard,
    auditLogger('PHARMACIST_VIEW_LOW_STOCK_SUMMARY'),
    dashboardController.getLowStockSummary
);

/**
 * Get expiring summary
 * GET /api/v1/pharmacist/dashboard/expiring
 */
router.get('/dashboard/expiring',
    authenticate,
    authorize('pharmacist', 'view_dashboard'),
    standard,
    auditLogger('PHARMACIST_VIEW_EXPIRING_SUMMARY'),
    dashboardController.getExpiringSummary
);

// ============================================
// ============================================
// PROTECTED HEALTH CHECK
// ============================================
// ============================================
// v1.0.7 - Remains protected with authentication
// Only authenticated users can see detailed endpoint information

/**
 * Health check for pharmacist module
 * GET /api/v1/pharmacist/health
 * Authentication required - provides detailed module status and endpoint list
 */
router.get('/health',
    authenticate,
    authorize('pharmacist'),
    (req, res) => {
        res.json({
            success: true,
            message: 'Pharmacist module is healthy',
            timestamp: new Date().toISOString(),
            pharmacistId: req.user.id,  // Now guaranteed to exist due to authenticate middleware
            endpoints: {
                total: 61,
                root: 1,
                inventory: 15,
                batches: 6,
                dispensing: 9,
                suppliers: 7,
                purchase_orders: 10,
                returns: 4,
                reports: 6,
                dashboard: 3
            }
        });
    }
);

module.exports = router;

/**
 * ======================================================================
 * ROUTE SUMMARY:
 * ======================================================================
 * 
 * Category           | Count | Business Rules | Authentication
 * -------------------|-------|----------------|----------------
 * Root               | 1     | Base URL info  | 🔓 Public
 * Inventory          | 15    | [BR-14][BR-15][BR-18][BR-19][BR-20][BR-21][BR-23] | 🔒 Protected
 * Batches            | 6     | [BR-21][BR-23] | 🔒 Protected
 * Dispensing         | 9     | [BR-14][BR-15][BR-16][BR-18][BR-19][BR-22] | 🔒 Protected
 * Suppliers          | 7     | Supplier management | 🔒 Protected
 * Purchase Orders    | 10    | PO workflow    | 🔒 Protected
 * Returns & Expiry   | 4     | [BR-18][BR-21] | 🔒 Protected
 * Reports            | 6     | Analytics      | 🔒 Protected
 * Dashboard          | 3     | Overview       | 🔒 Protected
 * Health             | 1     | Status & endpoints | 🔒 Protected
 * -------------------|-------|----------------|----------------
 * TOTAL              | 62    | Complete Pharmacist Module
 * 
 * HYBRID SECURITY APPROACH:
 * - Public root: Basic module info only (no internal endpoints)
 * - Protected health: Detailed status for authenticated users
 * - All data endpoints: Require valid authentication
 * 
 * ======================================================================
 */