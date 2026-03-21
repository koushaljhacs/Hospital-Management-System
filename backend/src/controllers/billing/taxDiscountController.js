/**
 * ======================================================================
 * FILE: backend/src/controllers/billing/taxDiscountController.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Billing tax & discount controller - Handles tax rates and discount management.
 * Total Endpoints: 8
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-34] Discount cannot exceed maximum allowed
 * - [BR-35] Tax calculation follows government rules
 * 
 * ======================================================================
 */

const taxDiscountService = require('../../services/billing/taxDiscountService');
const logger = require('../../utils/logger');

const taxDiscountController = {
    // ============================================
    // TAX RATE MANAGEMENT
    // ============================================

    /**
     * Get all tax rates
     * GET /api/v1/billing/tax-rates
     * 
     * BUSINESS RULE: [BR-35] Tax calculation follows government rules
     */
    async getAllTaxRates(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                type,
                is_active,
                include_expired = false
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                type,
                is_active: is_active === 'true',
                include_expired: include_expired === 'true'
            };

            const taxRates = await taxDiscountService.getAllTaxRates(
                req.user.id,
                options
            );

            logger.info('Billing admin retrieved tax rates', {
                staffId: req.user.id,
                count: taxRates.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Group by type for summary
            const byType = {
                cgst: taxRates.data?.filter(t => t.type === 'cgst').length || 0,
                sgst: taxRates.data?.filter(t => t.type === 'sgst').length || 0,
                igst: taxRates.data?.filter(t => t.type === 'igst').length || 0,
                cess: taxRates.data?.filter(t => t.type === 'cess').length || 0,
                other: taxRates.data?.filter(t => t.type === 'other').length || 0
            };

            res.json({
                success: true,
                data: taxRates.data,
                pagination: taxRates.pagination,
                summary: {
                    total: taxRates.summary?.total || 0,
                    active: taxRates.summary?.active || 0,
                    by_type: byType,
                    avg_rate: taxRates.data?.reduce((sum, t) => sum + parseFloat(t.rate), 0) / (taxRates.data?.length || 1) || 0
                }
            });
        } catch (error) {
            logger.error('Error getting tax rates', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Add tax rate
     * POST /api/v1/billing/tax-rates
     * 
     * BUSINESS RULE: [BR-35] Tax rate must be within valid range
     */
    async addTaxRate(req, res, next) {
        try {
            const {
                name,
                rate,
                type,
                description,
                effective_from,
                effective_to,
                is_active
            } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Tax name is required'
                });
            }

            if (rate === undefined || rate === null) {
                return res.status(400).json({
                    success: false,
                    error: 'Tax rate is required'
                });
            }

            if (rate < 0 || rate > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Tax rate must be between 0 and 100'
                });
            }

            if (!type) {
                return res.status(400).json({
                    success: false,
                    error: 'Tax type is required'
                });
            }

            // Check for existing tax rate with same name
            const existing = await taxDiscountService.getTaxRateByName(
                req.user.id,
                name
            );

            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: 'Tax rate with this name already exists'
                });
            }

            const taxRate = await taxDiscountService.addTaxRate(
                req.user.id,
                {
                    name,
                    rate,
                    type,
                    description,
                    effective_from: effective_from || new Date(),
                    effective_to,
                    is_active: is_active !== false,
                    created_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Billing admin added tax rate', {
                staffId: req.user.id,
                taxRateId: taxRate.id,
                name,
                rate,
                type
            });

            res.status(201).json({
                success: true,
                data: taxRate,
                message: 'Tax rate added successfully'
            });
        } catch (error) {
            logger.error('Error adding tax rate', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update tax rate
     * PUT /api/v1/billing/tax-rates/:id
     */
    async updateTaxRate(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const taxRate = await taxDiscountService.getTaxRateById(
                req.user.id,
                id
            );

            if (!taxRate) {
                return res.status(404).json({
                    success: false,
                    error: 'Tax rate not found'
                });
            }

            // Validate rate if being updated
            if (updates.rate !== undefined && (updates.rate < 0 || updates.rate > 100)) {
                return res.status(400).json({
                    success: false,
                    error: 'Tax rate must be between 0 and 100'
                });
            }

            const updated = await taxDiscountService.updateTaxRate(
                req.user.id,
                id,
                {
                    ...updates,
                    updated_at: new Date(),
                    updated_by: req.user.id
                }
            );

            logger.info('Billing admin updated tax rate', {
                staffId: req.user.id,
                taxRateId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: updated,
                message: 'Tax rate updated successfully'
            });
        } catch (error) {
            if (error.message === 'Tax rate not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Tax rate not found'
                });
            }
            logger.error('Error updating tax rate', {
                error: error.message,
                staffId: req.user.id,
                taxRateId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete tax rate
     * DELETE /api/v1/billing/tax-rates/:id
     */
    async deleteTaxRate(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const taxRate = await taxDiscountService.getTaxRateById(
                req.user.id,
                id
            );

            if (!taxRate) {
                return res.status(404).json({
                    success: false,
                    error: 'Tax rate not found'
                });
            }

            // Check if tax rate is in use
            const isInUse = await taxDiscountService.isTaxRateInUse(
                req.user.id,
                id
            );

            if (isInUse) {
                return res.status(409).json({
                    success: false,
                    error: 'Cannot delete tax rate that is already used in invoices'
                });
            }

            const deleted = await taxDiscountService.deleteTaxRate(
                req.user.id,
                id,
                {
                    reason,
                    deleted_at: new Date(),
                    deleted_by: req.user.id
                }
            );

            logger.info('Billing admin deleted tax rate', {
                staffId: req.user.id,
                taxRateId: id,
                reason
            });

            res.json({
                success: true,
                data: deleted,
                message: 'Tax rate deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Tax rate not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Tax rate not found'
                });
            }
            logger.error('Error deleting tax rate', {
                error: error.message,
                staffId: req.user.id,
                taxRateId: req.params.id
            });
            next(error);
        }
    },

    // ============================================
    // DISCOUNT MANAGEMENT
    // ============================================

    /**
     * Get all discounts
     * GET /api/v1/billing/discounts
     * 
     * BUSINESS RULE: [BR-34] Discount cannot exceed maximum allowed
     */
    async getAllDiscounts(req, res, next) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                type,
                is_active,
                applicable_to,
                include_expired = false
            } = req.query;

            const options = {
                page: parseInt(page),
                limit: parseInt(limit),
                type,
                is_active: is_active === 'true',
                applicable_to,
                include_expired: include_expired === 'true'
            };

            const discounts = await taxDiscountService.getAllDiscounts(
                req.user.id,
                options
            );

            logger.info('Billing admin retrieved discounts', {
                staffId: req.user.id,
                count: discounts.data?.length || 0,
                filters: Object.keys(options).filter(k => options[k])
            });

            // Group by type for summary
            const byType = {
                percentage: discounts.data?.filter(d => d.type === 'percentage').length || 0,
                fixed: discounts.data?.filter(d => d.type === 'fixed').length || 0
            };

            // Group by applicable_to
            const byApplicableTo = {
                all: discounts.data?.filter(d => d.applicable_to === 'all').length || 0,
                services: discounts.data?.filter(d => d.applicable_to === 'services').length || 0,
                medicines: discounts.data?.filter(d => d.applicable_to === 'medicines').length || 0,
                consultation: discounts.data?.filter(d => d.applicable_to === 'consultation').length || 0
            };

            res.json({
                success: true,
                data: discounts.data,
                pagination: discounts.pagination,
                summary: {
                    total: discounts.summary?.total || 0,
                    active: discounts.summary?.active || 0,
                    by_type: byType,
                    by_applicable_to: byApplicableTo
                }
            });
        } catch (error) {
            logger.error('Error getting discounts', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Add discount
     * POST /api/v1/billing/discounts
     * 
     * BUSINESS RULE: [BR-34] Discount percentage cannot exceed 100
     */
    async addDiscount(req, res, next) {
        try {
            const {
                name,
                type,
                value,
                max_discount,
                minimum_purchase,
                applicable_to,
                valid_from,
                valid_to,
                description,
                is_active
            } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    error: 'Discount name is required'
                });
            }

            if (!type) {
                return res.status(400).json({
                    success: false,
                    error: 'Discount type is required'
                });
            }

            if (value === undefined || value === null) {
                return res.status(400).json({
                    success: false,
                    error: 'Discount value is required'
                });
            }

            // [BR-34] Validate discount value
            if (type === 'percentage' && (value < 0 || value > 100)) {
                return res.status(400).json({
                    success: false,
                    error: 'Percentage discount must be between 0 and 100'
                });
            }

            if (type === 'fixed' && value < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Fixed discount must be 0 or more'
                });
            }

            // Check for existing discount with same name
            const existing = await taxDiscountService.getDiscountByName(
                req.user.id,
                name
            );

            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: 'Discount with this name already exists'
                });
            }

            const discount = await taxDiscountService.addDiscount(
                req.user.id,
                {
                    name,
                    type,
                    value,
                    max_discount,
                    minimum_purchase,
                    applicable_to: applicable_to || 'all',
                    valid_from,
                    valid_to,
                    description,
                    is_active: is_active !== false,
                    created_by: req.user.id,
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
                }
            );

            logger.info('Billing admin added discount', {
                staffId: req.user.id,
                discountId: discount.id,
                name,
                type,
                value
            });

            res.status(201).json({
                success: true,
                data: discount,
                message: 'Discount added successfully'
            });
        } catch (error) {
            logger.error('Error adding discount', {
                error: error.message,
                staffId: req.user.id
            });
            next(error);
        }
    },

    /**
     * Update discount
     * PUT /api/v1/billing/discounts/:id
     */
    async updateDiscount(req, res, next) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const discount = await taxDiscountService.getDiscountById(
                req.user.id,
                id
            );

            if (!discount) {
                return res.status(404).json({
                    success: false,
                    error: 'Discount not found'
                });
            }

            // Validate discount value if being updated
            if (updates.type === 'percentage' && updates.value !== undefined) {
                if (updates.value < 0 || updates.value > 100) {
                    return res.status(400).json({
                        success: false,
                        error: 'Percentage discount must be between 0 and 100'
                    });
                }
            }

            if (updates.type === 'fixed' && updates.value !== undefined && updates.value < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Fixed discount must be 0 or more'
                });
            }

            const updated = await taxDiscountService.updateDiscount(
                req.user.id,
                id,
                {
                    ...updates,
                    updated_at: new Date(),
                    updated_by: req.user.id
                }
            );

            logger.info('Billing admin updated discount', {
                staffId: req.user.id,
                discountId: id,
                updates: Object.keys(updates)
            });

            res.json({
                success: true,
                data: updated,
                message: 'Discount updated successfully'
            });
        } catch (error) {
            if (error.message === 'Discount not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Discount not found'
                });
            }
            logger.error('Error updating discount', {
                error: error.message,
                staffId: req.user.id,
                discountId: req.params.id
            });
            next(error);
        }
    },

    /**
     * Delete discount
     * DELETE /api/v1/billing/discounts/:id
     */
    async deleteDiscount(req, res, next) {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const discount = await taxDiscountService.getDiscountById(
                req.user.id,
                id
            );

            if (!discount) {
                return res.status(404).json({
                    success: false,
                    error: 'Discount not found'
                });
            }

            // Check if discount is in use
            const isInUse = await taxDiscountService.isDiscountInUse(
                req.user.id,
                id
            );

            if (isInUse) {
                return res.status(409).json({
                    success: false,
                    error: 'Cannot delete discount that is already used in invoices'
                });
            }

            const deleted = await taxDiscountService.deleteDiscount(
                req.user.id,
                id,
                {
                    reason,
                    deleted_at: new Date(),
                    deleted_by: req.user.id
                }
            );

            logger.info('Billing admin deleted discount', {
                staffId: req.user.id,
                discountId: id,
                reason
            });

            res.json({
                success: true,
                data: deleted,
                message: 'Discount deleted successfully'
            });
        } catch (error) {
            if (error.message === 'Discount not found') {
                return res.status(404).json({
                    success: false,
                    error: 'Discount not found'
                });
            }
            logger.error('Error deleting discount', {
                error: error.message,
                staffId: req.user.id,
                discountId: req.params.id
            });
            next(error);
        }
    }
};

module.exports = taxDiscountController;

/**
 * ======================================================================
 * CONTROLLER SUMMARY:
 * ======================================================================
 * 
 * Category               | Endpoints | Description
 * -----------------------|-----------|----------------------
 * Tax Rate Management    | 4         | List, add, update, delete
 * Discount Management    | 4         | List, add, update, delete
 * -----------------------|-----------|----------------------
 * TOTAL                  | 8         | Complete tax & discount management
 * 
 * BUSINESS RULES ENFORCED:
 * - [BR-34] Discount percentage validation (0-100)
 * - [BR-35] Tax rate validation (0-100)
 * 
 * ======================================================================
 */