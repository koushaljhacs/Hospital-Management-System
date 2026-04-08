/**
 * ======================================================================
 * FILE: backend/src/models/pharmacy/Dispensing.js
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
 * Dispensing model for database operations.
 * Handles medicine dispensing records for prescriptions.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: dispensing
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - prescription_id: UUID (foreign key to prescriptions)
 * - patient_id: UUID (foreign key to patients)
 * - pharmacist_id: UUID (foreign key to employees)
 * - dispense_date: timestamp
 * - dispense_number: string (unique)
 * - items: jsonb
 * - total_items: integer
 * - total_quantity: integer
 * - subtotal: decimal
 * - discount: decimal
 * - tax_amount: decimal
 * - total_amount: decimal
 * - payment_method: string
 * - payment_status: enum (pending, paid, insurance)
 * - invoice_id: UUID
 * - is_partial: boolean
 * - parent_dispense_id: UUID
 * - notes: text
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

const Dispensing = {
    /**
     * Table name
     */
    tableName: 'dispensing',

    /**
     * Valid payment statuses
     */
    validPaymentStatuses: ['pending', 'paid', 'insurance'],

    /**
     * Generate dispense number
     * @returns {Promise<string>} Generated dispense number
     */
    async generateDispenseNumber() {
        try {
            const year = new Date().getFullYear();
            const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
            const day = new Date().getDate().toString().padStart(2, '0');

            const query = `
                SELECT COUNT(*) as count
                FROM dispensing
                WHERE dispense_number LIKE $1
            `;
            const result = await db.query(query, [`DISP-${year}${month}${day}-%`]);

            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');

            return `DISP-${year}${month}${day}-${sequence}`;
        } catch (error) {
            logger.error('Error generating dispense number', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find dispensing record by ID
     * @param {string} id - Dispensing UUID
     * @returns {Promise<Object|null>} Dispensing object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    d.id, d.prescription_id, d.patient_id, d.pharmacist_id,
                    d.dispense_date, d.dispense_number,
                    d.items, d.total_items, d.total_quantity,
                    d.subtotal, d.discount, d.tax_amount, d.total_amount,
                    d.payment_method, d.payment_status, d.invoice_id,
                    d.is_partial, d.parent_dispense_id, d.notes,
                    d.created_at, d.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    ph.first_name as pharmacist_first_name,
                    ph.last_name as pharmacist_last_name,
                    pr.diagnosis as prescription_diagnosis
                FROM dispensing d
                LEFT JOIN patients p ON d.patient_id = p.id
                LEFT JOIN employees ph ON d.pharmacist_id = ph.id
                LEFT JOIN prescriptions pr ON d.prescription_id = pr.id
                WHERE d.id = $1 AND d.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Dispensing record found by ID', { dispenseId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding dispensing record by ID', {
                error: error.message,
                dispenseId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find dispensing record by dispense number
     * @param {string} dispenseNumber - Dispense number
     * @returns {Promise<Object|null>} Dispensing object or null
     */
    async findByNumber(dispenseNumber) {
        try {
            const query = `
                SELECT 
                    id, prescription_id, patient_id, pharmacist_id,
                    dispense_date, dispense_number,
                    total_amount, payment_status, is_partial
                FROM dispensing
                WHERE dispense_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [dispenseNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Dispensing record found by number', { dispenseNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding dispensing record by number', {
                error: error.message,
                dispenseNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find dispensing records by prescription ID
     * @param {string} prescriptionId - Prescription UUID
     * @returns {Promise<Array>} List of dispensing records
     */
    async findByPrescriptionId(prescriptionId) {
        try {
            const query = `
                SELECT 
                    id, dispense_number, dispense_date,
                    total_items, total_quantity, total_amount,
                    payment_status, is_partial, notes
                FROM dispensing
                WHERE prescription_id = $1 AND is_deleted = false
                ORDER BY dispense_date DESC
            `;

            const result = await db.query(query, [prescriptionId]);

            logger.debug('Dispensing records found by prescription ID', {
                prescriptionId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding dispensing records by prescription ID', {
                error: error.message,
                prescriptionId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find dispensing records by patient ID
     * @param {string} patientId - Patient UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of dispensing records
     */
    async findByPatientId(patientId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [patientId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (from_date) {
                conditions.push(`dispense_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`dispense_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, dispense_number, dispense_date,
                    total_items, total_quantity, total_amount,
                    payment_status, is_partial,
                    pharmacist_id,
                    ph.first_name as pharmacist_first_name,
                    ph.last_name as pharmacist_last_name
                FROM dispensing d
                LEFT JOIN employees ph ON d.pharmacist_id = ph.id
                ${whereClause}
                ORDER BY dispense_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Dispensing records found by patient ID', {
                patientId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding dispensing records by patient ID', {
                error: error.message,
                patientId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find dispensing records by pharmacist ID
     * @param {string} pharmacistId - Pharmacist UUID
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of dispensing records
     */
    async findByPharmacistId(pharmacistId, options = {}) {
        try {
            const { limit = 50, offset = 0, from_date, to_date } = options;
            const values = [pharmacistId];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (from_date) {
                conditions.push(`dispense_date >= $${paramIndex++}`);
                values.push(from_date);
            }
            if (to_date) {
                conditions.push(`dispense_date <= $${paramIndex++}`);
                values.push(to_date);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, prescription_id, patient_id,
                    dispense_number, dispense_date,
                    total_items, total_quantity, total_amount,
                    payment_status,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM dispensing d
                JOIN patients p ON d.patient_id = p.id
                ${whereClause}
                ORDER BY dispense_date DESC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Dispensing records found by pharmacist ID', {
                pharmacistId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding dispensing records by pharmacist ID', {
                error: error.message,
                pharmacistId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get pending payments (insurance claims awaiting payment)
     * @returns {Promise<Array>} List of pending payment records
     */
    async getPendingPayments() {
        try {
            const query = `
                SELECT 
                    d.id, d.dispense_number, d.patient_id,
                    d.total_amount, d.dispense_date,
                    d.payment_status, d.invoice_id,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone
                FROM dispensing d
                JOIN patients p ON d.patient_id = p.id
                WHERE d.payment_status = 'pending' AND d.is_deleted = false
                ORDER BY d.dispense_date ASC
            `;

            const result = await db.query(query);

            logger.debug('Pending payment records retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting pending payments', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new dispensing record
     * @param {Object} dispenseData - Dispensing data
     * @returns {Promise<Object>} Created dispensing record
     */
    async create(dispenseData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (dispenseData.payment_status && !this.validPaymentStatuses.includes(dispenseData.payment_status)) {
                throw new Error(`Invalid payment status. Must be one of: ${this.validPaymentStatuses.join(', ')}`);
            }

            const dispenseNumber = await this.generateDispenseNumber();

            // Calculate totals from items
            let subtotal = 0;
            let totalQuantity = 0;
            const items = dispenseData.items || [];

            for (const item of items) {
                subtotal += item.quantity * item.unit_price;
                totalQuantity += item.quantity;
            }

            const discount = dispenseData.discount || 0;
            const taxAmount = dispenseData.tax_amount || 0;
            const totalAmount = subtotal - discount + taxAmount;

            const query = `
                INSERT INTO dispensing (
                    id, prescription_id, patient_id, pharmacist_id,
                    dispense_date, dispense_number,
                    items, total_items, total_quantity,
                    subtotal, discount, tax_amount, total_amount,
                    payment_method, payment_status, invoice_id,
                    is_partial, parent_dispense_id, notes,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    COALESCE($4, NOW()), $5,
                    $6, $7, $8,
                    $9, $10, $11, $12,
                    $13, $14, $15,
                    COALESCE($16, false), $17, $18,
                    $19, NOW(), NOW()
                )
                RETURNING 
                    id, prescription_id, patient_id,
                    dispense_number, total_amount,
                    payment_status, is_partial, created_at
            `;

            const values = [
                dispenseData.prescription_id,
                dispenseData.patient_id,
                dispenseData.pharmacist_id,
                dispenseData.dispense_date || null,
                dispenseNumber,
                items,
                items.length,
                totalQuantity,
                subtotal,
                discount,
                taxAmount,
                totalAmount,
                dispenseData.payment_method || null,
                dispenseData.payment_status || 'pending',
                dispenseData.invoice_id || null,
                dispenseData.is_partial,
                dispenseData.parent_dispense_id || null,
                dispenseData.notes || null,
                dispenseData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Dispensing record created successfully', {
                dispenseId: result.rows[0].id,
                dispenseNumber,
                prescriptionId: dispenseData.prescription_id,
                totalAmount
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating dispensing record', {
                error: error.message,
                prescriptionId: dispenseData.prescription_id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update dispensing record
     * @param {string} id - Dispensing ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated dispensing record
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'payment_method', 'payment_status', 'invoice_id',
                'notes'
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
                UPDATE dispensing 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, dispense_number, payment_status,
                    invoice_id, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Dispensing record not found');
            }

            await db.commitTransaction(client);

            logger.info('Dispensing record updated', {
                dispenseId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating dispensing record', {
                error: error.message,
                dispenseId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Mark payment as completed
     * @param {string} id - Dispensing ID
     * @param {string} paymentMethod - Payment method
     * @param {string} invoiceId - Invoice ID
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated dispensing record
     */
    async markAsPaid(id, paymentMethod, invoiceId, updatedBy) {
        return this.update(id, {
            payment_status: 'paid',
            payment_method: paymentMethod,
            invoice_id: invoiceId,
            updated_by: updatedBy
        });
    },

    /**
     * Create partial dispense (linked to parent)
     * @param {string} parentId - Parent dispensing ID
     * @param {Object} partialData - Partial dispense data
     * @returns {Promise<Object>} Created partial dispense
     */
    async createPartial(parentId, partialData) {
        const parent = await this.findById(parentId);
        if (!parent) {
            throw new Error('Parent dispensing record not found');
        }

        return this.create({
            ...partialData,
            parent_dispense_id: parentId,
            is_partial: true,
            prescription_id: parent.prescription_id,
            patient_id: parent.patient_id
        });
    },

    /**
     * Get dispensing statistics
     * @param {Object} options - Date range options
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics(options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND dispense_date BETWEEN $1 AND $2`;
                values.push(from_date, to_date);
            }

            const query = `
                SELECT 
                    COUNT(*) as total_dispenses,
                    SUM(total_amount) as total_revenue,
                    AVG(total_amount)::numeric(10,2) as avg_dispense_value,
                    COUNT(*) FILTER (WHERE payment_status = 'paid') as paid,
                    COUNT(*) FILTER (WHERE payment_status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE payment_status = 'insurance') as insurance,
                    COUNT(*) FILTER (WHERE is_partial = true) as partial_dispenses,
                    SUM(total_quantity) as total_items_dispensed,
                    COUNT(DISTINCT patient_id) as unique_patients,
                    COUNT(DISTINCT pharmacist_id) as unique_pharmacists
                FROM dispensing
                WHERE is_deleted = false
                ${dateCondition}
            `;

            const result = await db.query(query, values);

            logger.debug('Dispensing statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting dispensing statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get daily dispensing report
     * @param {string} date - Date to report
     * @returns {Promise<Object>} Daily report
     */
    async getDailyReport(date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];

            const query = `
                SELECT 
                    COUNT(*) as total_transactions,
                    SUM(total_amount) as total_revenue,
                    COUNT(*) FILTER (WHERE payment_method = 'cash') as cash_transactions,
                    COUNT(*) FILTER (WHERE payment_method = 'card') as card_transactions,
                    COUNT(*) FILTER (WHERE payment_method = 'upi') as upi_transactions,
                    COUNT(*) FILTER (WHERE payment_method = 'insurance') as insurance_transactions,
                    SUM(total_quantity) as total_units_dispensed,
                    COUNT(DISTINCT patient_id) as unique_patients
                FROM dispensing
                WHERE DATE(dispense_date) = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [targetDate]);

            logger.debug('Daily dispensing report retrieved', { date: targetDate });

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting daily dispensing report', {
                error: error.message,
                date
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get top dispensed medicines
     * @param {number} limit - Number of medicines
     * @param {Object} options - Date range options
     * @returns {Promise<Array>} List of top medicines
     */
    async getTopDispensedMedicines(limit = 10, options = {}) {
        try {
            const { from_date, to_date } = options;
            const values = [];
            let dateCondition = '';

            if (from_date && to_date) {
                dateCondition = `AND d.dispense_date BETWEEN $${values.length + 1} AND $${values.length + 2}`;
                values.push(from_date, to_date);
            }
            values.push(limit);

            const query = `
                SELECT 
                    i.id, i.medicine_name, i.generic_name, i.category,
                    SUM(di.quantity) as total_dispensed,
                    COUNT(DISTINCT d.id) as prescription_count,
                    AVG(di.unit_price)::numeric(10,2) as avg_price
                FROM dispensing d
                CROSS JOIN LATERAL jsonb_to_recordset(d.items) AS di(
                    medicine_id UUID,
                    medicine_name TEXT,
                    quantity INTEGER,
                    unit_price DECIMAL
                )
                JOIN inventory i ON di.medicine_id = i.id
                WHERE d.is_deleted = false
                ${dateCondition}
                GROUP BY i.id, i.medicine_name, i.generic_name, i.category
                ORDER BY total_dispensed DESC
                LIMIT $${values.length + 1}
            `;

            const result = await db.query(query, values);

            logger.debug('Top dispensed medicines retrieved', {
                limit,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting top dispensed medicines', {
                error: error.message,
                limit
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete dispensing record
     * @param {string} id - Dispensing ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE dispensing 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Dispensing record not found');
            }

            await db.commitTransaction(client);

            logger.info('Dispensing record soft deleted', {
                dispenseId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting dispensing record', {
                error: error.message,
                dispenseId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Dispensing;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */