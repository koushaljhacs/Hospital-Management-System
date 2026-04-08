/**
 * ======================================================================
 * FILE: backend/src/models/billing/PricingRule.js
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
 * PricingRule model for database operations.
 * Handles dynamic pricing rules for services and products.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: pricing_rules
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - rule_name: string
 * - rule_type: enum (consultation, lab, procedure, room, medicine)
 * - applies_to_id: UUID
 * - base_price: decimal
 * - price_formula: text
 * - conditions: jsonb
 * - priority: integer
 * - is_active: boolean
 * - valid_from: date
 * - valid_to: date
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

const PricingRule = {
    /**
     * Table name
     */
    tableName: 'pricing_rules',

    /**
     * Valid rule types
     */
    validRuleTypes: ['consultation', 'lab', 'procedure', 'room', 'medicine'],

    /**
     * Find pricing rule by ID
     * @param {string} id - Pricing rule UUID
     * @returns {Promise<Object|null>} Pricing rule object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    pr.id, pr.rule_name, pr.rule_type, pr.applies_to_id,
                    pr.base_price, pr.price_formula, pr.conditions,
                    pr.priority, pr.is_active,
                    pr.valid_from, pr.valid_to,
                    pr.created_at, pr.updated_at,
                    u.username as created_by_name
                FROM pricing_rules pr
                LEFT JOIN users u ON pr.created_by = u.id
                WHERE pr.id = $1 AND pr.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Pricing rule found by ID', { ruleId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding pricing rule by ID', {
                error: error.message,
                ruleId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find pricing rules by type
     * @param {string} ruleType - Rule type
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of pricing rules
     */
    async findByType(ruleType, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, rule_name, rule_type, applies_to_id,
                    base_price, price_formula, priority,
                    is_active, valid_from, valid_to
                FROM pricing_rules
                WHERE rule_type = $1 AND is_deleted = false
                ORDER BY priority DESC, valid_from DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [ruleType, limit, offset]);

            logger.debug('Pricing rules found by type', {
                ruleType,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding pricing rules by type', {
                error: error.message,
                ruleType
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get active pricing rules for a specific item
     * @param {string} ruleType - Rule type
     * @param {string} itemId - Item UUID
     * @returns {Promise<Array>} List of applicable pricing rules
     */
    async getActiveForItem(ruleType, itemId) {
        try {
            const query = `
                SELECT 
                    id, rule_name, base_price, price_formula,
                    conditions, priority
                FROM pricing_rules
                WHERE rule_type = $1
                    AND (applies_to_id IS NULL OR applies_to_id = $2)
                    AND is_active = true
                    AND valid_from <= CURRENT_DATE
                    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
                    AND is_deleted = false
                ORDER BY priority DESC
            `;

            const result = await db.query(query, [ruleType, itemId]);

            logger.debug('Active pricing rules for item', {
                ruleType,
                itemId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting active pricing rules for item', {
                error: error.message,
                ruleType,
                itemId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Calculate price using applicable rules
     * @param {string} ruleType - Rule type
     * @param {string} itemId - Item UUID
     * @param {number} basePrice - Base price
     * @param {Object} context - Additional context for condition evaluation
     * @returns {Promise<number>} Calculated price
     */
    async calculatePrice(ruleType, itemId, basePrice, context = {}) {
        try {
            const rules = await this.getActiveForItem(ruleType, itemId);
            let finalPrice = basePrice;

            for (const rule of rules) {
                let applicable = true;

                if (rule.conditions && Object.keys(rule.conditions).length > 0) {
                    for (const [key, value] of Object.entries(rule.conditions)) {
                        if (context[key] !== undefined && context[key] !== value) {
                            applicable = false;
                            break;
                        }
                    }
                }

                if (!applicable) {
                    continue;
                }

                if (rule.price_formula) {
                    try {
                        const formula = rule.price_formula
                            .replace(/base_price/g, basePrice)
                            .replace(/context\.(\w+)/g, (_, key) => context[key] || 0);
                        const calculated = Function('"use strict";return (' + formula + ')')();
                        finalPrice = Math.max(0, calculated);
                    } catch (e) {
                        logger.warn('Error evaluating price formula', {
                            ruleId: rule.id,
                            formula: rule.price_formula,
                            error: e.message
                        });
                    }
                } else if (rule.base_price !== null) {
                    finalPrice = rule.base_price;
                }

                if (rule.priority > 0) {
                    break;
                }
            }

            logger.debug('Price calculated', {
                ruleType,
                itemId,
                basePrice,
                finalPrice
            });

            return finalPrice;
        } catch (error) {
            logger.error('Error calculating price', {
                error: error.message,
                ruleType,
                itemId
            });
            return basePrice;
        }
    },

    /**
     * Create new pricing rule
     * @param {Object} ruleData - Pricing rule data
     * @returns {Promise<Object>} Created pricing rule
     */
    async create(ruleData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (ruleData.rule_type && !this.validRuleTypes.includes(ruleData.rule_type)) {
                throw new Error(`Invalid rule type. Must be one of: ${this.validRuleTypes.join(', ')}`);
            }

            const query = `
                INSERT INTO pricing_rules (
                    id, rule_name, rule_type, applies_to_id,
                    base_price, price_formula, conditions,
                    priority, is_active,
                    valid_from, valid_to,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    COALESCE($7, 0), COALESCE($8, true),
                    COALESCE($9, CURRENT_DATE), $10,
                    $11, NOW(), NOW()
                )
                RETURNING 
                    id, rule_name, rule_type, applies_to_id,
                    base_price, priority, is_active,
                    created_at
            `;

            const values = [
                ruleData.rule_name,
                ruleData.rule_type,
                ruleData.applies_to_id || null,
                ruleData.base_price || null,
                ruleData.price_formula || null,
                ruleData.conditions || null,
                ruleData.priority,
                ruleData.is_active,
                ruleData.valid_from || null,
                ruleData.valid_to || null,
                ruleData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Pricing rule created', {
                ruleId: result.rows[0].id,
                ruleName: ruleData.rule_name,
                ruleType: ruleData.rule_type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating pricing rule', {
                error: error.message,
                ruleName: ruleData.rule_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update pricing rule
     * @param {string} id - Pricing rule ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated pricing rule
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'rule_name', 'rule_type', 'applies_to_id',
                'base_price', 'price_formula', 'conditions',
                'priority', 'is_active',
                'valid_from', 'valid_to'
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
                UPDATE pricing_rules 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, rule_name, rule_type,
                    priority, is_active, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Pricing rule not found');
            }

            await db.commitTransaction(client);

            logger.info('Pricing rule updated', {
                ruleId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating pricing rule', {
                error: error.message,
                ruleId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get pricing rule statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_rules,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(*) FILTER (WHERE rule_type = 'consultation') as consultation_rules,
                    COUNT(*) FILTER (WHERE rule_type = 'lab') as lab_rules,
                    COUNT(*) FILTER (WHERE rule_type = 'procedure') as procedure_rules,
                    COUNT(*) FILTER (WHERE rule_type = 'room') as room_rules,
                    COUNT(*) FILTER (WHERE rule_type = 'medicine') as medicine_rules,
                    COUNT(*) FILTER (WHERE applies_to_id IS NOT NULL) as specific_item_rules,
                    AVG(priority)::numeric(10,2) as avg_priority
                FROM pricing_rules
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Pricing rule statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting pricing rule statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete pricing rule
     * @param {string} id - Pricing rule ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE pricing_rules 
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
                throw new Error('Pricing rule not found');
            }

            await db.commitTransaction(client);

            logger.info('Pricing rule soft deleted', {
                ruleId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting pricing rule', {
                error: error.message,
                ruleId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = PricingRule;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */