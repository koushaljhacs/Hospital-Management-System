/**
 * ======================================================================
 * FILE: backend/src/models/lab/LabInstrument.js
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
 * LabInstrument model for database operations.
 * Handles laboratory instruments/equipment used for testing.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: lab_instruments
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - instrument_code: string (unique)
 * - instrument_name: string
 * - manufacturer: string
 * - model: string
 * - serial_number: string (unique)
 * - category: string
 * - description: text
 * - location: string
 * - department_id: UUID
 * - purchase_date: date
 * - purchase_cost: decimal
 * - warranty_expiry: date
 * - calibration_frequency_days: integer
 * - last_calibration_date: date
 * - next_calibration_date: date
 * - maintenance_frequency_days: integer
 * - last_maintenance_date: date
 * - next_maintenance_date: date
 * - status: enum (operational, maintenance, calibration_due, out_of_service, retired)
 * - assigned_to: uuid
 * - assigned_at: timestamp
 * - notes: text
 * - is_active: boolean
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

const LabInstrument = {
    /**
     * Table name
     */
    tableName: 'lab_instruments',

    /**
     * Valid status values
     */
    validStatuses: ['operational', 'maintenance', 'calibration_due', 'out_of_service', 'retired'],

    /**
     * Generate instrument code
     * @returns {Promise<string>} Generated instrument code
     */
    async generateInstrumentCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM lab_instruments WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');
            return `INS-${sequence}`;
        } catch (error) {
            logger.error('Error generating instrument code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find instrument by ID
     * @param {string} id - Instrument UUID
     * @returns {Promise<Object|null>} Instrument object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    li.id, li.instrument_code, li.instrument_name,
                    li.manufacturer, li.model, li.serial_number,
                    li.category, li.description, li.location,
                    li.department_id, li.purchase_date, li.purchase_cost,
                    li.warranty_expiry,
                    li.calibration_frequency_days, li.last_calibration_date,
                    li.next_calibration_date,
                    li.maintenance_frequency_days, li.last_maintenance_date,
                    li.next_maintenance_date,
                    li.status, li.assigned_to, li.assigned_at,
                    li.notes, li.is_active,
                    li.created_at, li.updated_at,
                    d.name as department_name,
                    u.username as assigned_to_name
                FROM lab_instruments li
                LEFT JOIN departments d ON li.department_id = d.id
                LEFT JOIN users u ON li.assigned_to = u.id
                WHERE li.id = $1 AND li.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab instrument found by ID', { instrumentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab instrument by ID', {
                error: error.message,
                instrumentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find instrument by code
     * @param {string} instrumentCode - Instrument code
     * @returns {Promise<Object|null>} Instrument object or null
     */
    async findByCode(instrumentCode) {
        try {
            const query = `
                SELECT id, instrument_code, instrument_name, status, is_active
                FROM lab_instruments
                WHERE instrument_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [instrumentCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab instrument found by code', { instrumentCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab instrument by code', {
                error: error.message,
                instrumentCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find instrument by serial number
     * @param {string} serialNumber - Serial number
     * @returns {Promise<Object|null>} Instrument object or null
     */
    async findBySerialNumber(serialNumber) {
        try {
            const query = `
                SELECT id, instrument_code, instrument_name, serial_number, status
                FROM lab_instruments
                WHERE serial_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [serialNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Lab instrument found by serial number', { serialNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding lab instrument by serial number', {
                error: error.message,
                serialNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get all instruments with pagination and filters
     * @param {Object} filters - Filter conditions
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of instruments
     */
    async getAll(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_deleted = false'];

            if (filters.status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(filters.status);
            }
            if (filters.category) {
                conditions.push(`category = $${paramIndex++}`);
                values.push(filters.category);
            }
            if (filters.is_active !== undefined) {
                conditions.push(`is_active = $${paramIndex++}`);
                values.push(filters.is_active);
            }
            if (filters.calibration_due !== undefined && filters.calibration_due === true) {
                conditions.push(`next_calibration_date <= NOW() + INTERVAL '30 days'`);
            }
            if (filters.search) {
                conditions.push(`(instrument_name ILIKE $${paramIndex++} OR instrument_code ILIKE $${paramIndex++} OR serial_number ILIKE $${paramIndex++})`);
                const searchTerm = `%${filters.search}%`;
                values.push(searchTerm, searchTerm, searchTerm);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, instrument_code, instrument_name,
                    manufacturer, model, serial_number,
                    category, location, status,
                    last_calibration_date, next_calibration_date,
                    is_active, created_at
                FROM lab_instruments
                ${whereClause}
                ORDER BY instrument_name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Retrieved all lab instruments', {
                count: result.rows.length,
                filters,
                limit,
                offset
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting all lab instruments', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get instruments requiring calibration
     * @param {number} daysThreshold - Days to look ahead
     * @returns {Promise<Array>} List of instruments due for calibration
     */
    async getCalibrationDue(daysThreshold = 30) {
        try {
            const query = `
                SELECT 
                    id, instrument_code, instrument_name,
                    model, serial_number, location,
                    last_calibration_date, next_calibration_date,
                    calibration_frequency_days,
                    assigned_to, u.username as assigned_to_name
                FROM lab_instruments li
                LEFT JOIN users u ON li.assigned_to = u.id
                WHERE li.next_calibration_date <= NOW() + ($1 || ' days')::INTERVAL
                    AND li.is_active = true
                    AND li.is_deleted = false
                ORDER BY li.next_calibration_date ASC
            `;

            const result = await db.query(query, [daysThreshold]);

            logger.debug('Instruments due for calibration retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting calibration due instruments', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get instruments requiring maintenance
     * @param {number} daysThreshold - Days to look ahead
     * @returns {Promise<Array>} List of instruments due for maintenance
     */
    async getMaintenanceDue(daysThreshold = 30) {
        try {
            const query = `
                SELECT 
                    id, instrument_code, instrument_name,
                    model, serial_number, location,
                    last_maintenance_date, next_maintenance_date,
                    maintenance_frequency_days,
                    assigned_to, u.username as assigned_to_name
                FROM lab_instruments li
                LEFT JOIN users u ON li.assigned_to = u.id
                WHERE li.next_maintenance_date <= NOW() + ($1 || ' days')::INTERVAL
                    AND li.is_active = true
                    AND li.is_deleted = false
                ORDER BY li.next_maintenance_date ASC
            `;

            const result = await db.query(query, [daysThreshold]);

            logger.debug('Instruments due for maintenance retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting maintenance due instruments', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new lab instrument
     * @param {Object} instrumentData - Instrument data
     * @returns {Promise<Object>} Created instrument
     */
    async create(instrumentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (instrumentData.status && !this.validStatuses.includes(instrumentData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const instrumentCode = instrumentData.instrument_code || await this.generateInstrumentCode();

            // Calculate next calibration date
            let nextCalibrationDate = instrumentData.next_calibration_date;
            if (!nextCalibrationDate && instrumentData.last_calibration_date && instrumentData.calibration_frequency_days) {
                nextCalibrationDate = new Date(instrumentData.last_calibration_date);
                nextCalibrationDate.setDate(nextCalibrationDate.getDate() + instrumentData.calibration_frequency_days);
            }

            // Calculate next maintenance date
            let nextMaintenanceDate = instrumentData.next_maintenance_date;
            if (!nextMaintenanceDate && instrumentData.last_maintenance_date && instrumentData.maintenance_frequency_days) {
                nextMaintenanceDate = new Date(instrumentData.last_maintenance_date);
                nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + instrumentData.maintenance_frequency_days);
            }

            const query = `
                INSERT INTO lab_instruments (
                    id, instrument_code, instrument_name,
                    manufacturer, model, serial_number,
                    category, description, location,
                    department_id, purchase_date, purchase_cost,
                    warranty_expiry,
                    calibration_frequency_days, last_calibration_date, next_calibration_date,
                    maintenance_frequency_days, last_maintenance_date, next_maintenance_date,
                    status, assigned_to, assigned_at,
                    notes, is_active,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2,
                    $3, $4, $5,
                    $6, $7, $8,
                    $9, $10, $11,
                    $12,
                    $13, $14, $15,
                    $16, $17, $18,
                    COALESCE($19, 'operational'), $20, COALESCE($21, NOW()),
                    $22, COALESCE($23, true),
                    $24, NOW(), NOW()
                )
                RETURNING 
                    id, instrument_code, instrument_name,
                    serial_number, status, is_active,
                    created_at
            `;

            const values = [
                instrumentCode,
                instrumentData.instrument_name,
                instrumentData.manufacturer || null,
                instrumentData.model || null,
                instrumentData.serial_number || null,
                instrumentData.category || null,
                instrumentData.description || null,
                instrumentData.location || null,
                instrumentData.department_id || null,
                instrumentData.purchase_date || null,
                instrumentData.purchase_cost || null,
                instrumentData.warranty_expiry || null,
                instrumentData.calibration_frequency_days || null,
                instrumentData.last_calibration_date || null,
                nextCalibrationDate,
                instrumentData.maintenance_frequency_days || null,
                instrumentData.last_maintenance_date || null,
                nextMaintenanceDate,
                instrumentData.status,
                instrumentData.assigned_to || null,
                instrumentData.assigned_at || null,
                instrumentData.notes || null,
                instrumentData.is_active,
                instrumentData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Lab instrument created successfully', {
                instrumentId: result.rows[0].id,
                instrumentCode,
                instrumentName: instrumentData.instrument_name,
                serialNumber: instrumentData.serial_number
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating lab instrument', {
                error: error.message,
                instrumentName: instrumentData.instrument_name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update lab instrument
     * @param {string} id - Instrument ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated instrument
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'instrument_name', 'manufacturer', 'model', 'serial_number',
                'category', 'description', 'location', 'department_id',
                'purchase_date', 'purchase_cost', 'warranty_expiry',
                'calibration_frequency_days', 'last_calibration_date',
                'next_calibration_date', 'maintenance_frequency_days',
                'last_maintenance_date', 'next_maintenance_date',
                'status', 'assigned_to', 'assigned_at',
                'notes', 'is_active'
            ];

            const setClause = [];
            const values = [];
            let paramIndex = 1;

            // Auto-calculate next dates if needed
            let nextCalibrationDate = updates.next_calibration_date;
            if (!nextCalibrationDate && updates.last_calibration_date !== undefined && updates.calibration_frequency_days !== undefined) {
                const lastCal = updates.last_calibration_date;
                const freq = updates.calibration_frequency_days;
                if (lastCal && freq) {
                    const date = new Date(lastCal);
                    date.setDate(date.getDate() + freq);
                    nextCalibrationDate = date;
                }
            }

            let nextMaintenanceDate = updates.next_maintenance_date;
            if (!nextMaintenanceDate && updates.last_maintenance_date !== undefined && updates.maintenance_frequency_days !== undefined) {
                const lastMaint = updates.last_maintenance_date;
                const freq = updates.maintenance_frequency_days;
                if (lastMaint && freq) {
                    const date = new Date(lastMaint);
                    date.setDate(date.getDate() + freq);
                    nextMaintenanceDate = date;
                }
            }

            if (nextCalibrationDate !== undefined) {
                setClause.push(`next_calibration_date = $${paramIndex++}`);
                values.push(nextCalibrationDate);
            }
            if (nextMaintenanceDate !== undefined) {
                setClause.push(`next_maintenance_date = $${paramIndex++}`);
                values.push(nextMaintenanceDate);
            }

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key) && value !== undefined && key !== 'next_calibration_date' && key !== 'next_maintenance_date') {
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
                UPDATE lab_instruments 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, instrument_code, instrument_name,
                    status, next_calibration_date,
                    next_maintenance_date, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Lab instrument not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab instrument updated', {
                instrumentId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating lab instrument', {
                error: error.message,
                instrumentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Record calibration
     * @param {string} id - Instrument ID
     * @param {Object} calibrationData - Calibration data
     * @returns {Promise<Object>} Updated instrument
     */
    async recordCalibration(id, calibrationData) {
        const updates = {
            last_calibration_date: calibrationData.calibration_date || new Date(),
            calibration_frequency_days: calibrationData.frequency_days,
            updated_by: calibrationData.recorded_by
        };
        if (calibrationData.frequency_days) {
            const nextDate = new Date(updates.last_calibration_date);
            nextDate.setDate(nextDate.getDate() + calibrationData.frequency_days);
            updates.next_calibration_date = nextDate;
        }
        if (calibrationData.status === 'calibration_due') {
            updates.status = 'operational';
        }
        return this.update(id, updates);
    },

    /**
     * Record maintenance
     * @param {string} id - Instrument ID
     * @param {Object} maintenanceData - Maintenance data
     * @returns {Promise<Object>} Updated instrument
     */
    async recordMaintenance(id, maintenanceData) {
        const updates = {
            last_maintenance_date: maintenanceData.maintenance_date || new Date(),
            maintenance_frequency_days: maintenanceData.frequency_days,
            updated_by: maintenanceData.recorded_by
        };
        if (maintenanceData.frequency_days) {
            const nextDate = new Date(updates.last_maintenance_date);
            nextDate.setDate(nextDate.getDate() + maintenanceData.frequency_days);
            updates.next_maintenance_date = nextDate;
        }
        if (maintenanceData.status === 'maintenance') {
            updates.status = 'operational';
        }
        return this.update(id, updates);
    },

    /**
     * Change instrument status
     * @param {string} id - Instrument ID
     * @param {string} status - New status
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated instrument
     */
    async changeStatus(id, status, updatedBy) {
        if (!this.validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
        }
        return this.update(id, {
            status: status,
            updated_by: updatedBy
        });
    },

    /**
     * Assign instrument to user
     * @param {string} id - Instrument ID
     * @param {string} assignedTo - User ID
     * @param {string} assignedBy - User who assigned
     * @returns {Promise<Object>} Updated instrument
     */
    async assign(id, assignedTo, assignedBy) {
        return this.update(id, {
            assigned_to: assignedTo,
            assigned_at: new Date(),
            updated_by: assignedBy
        });
    },

    /**
     * Get instrument statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_instruments,
                    COUNT(*) FILTER (WHERE status = 'operational') as operational,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'calibration_due') as calibration_due,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                    COUNT(*) FILTER (WHERE status = 'retired') as retired,
                    COUNT(*) FILTER (WHERE is_active = true) as active,
                    COUNT(DISTINCT category) as categories_used,
                    AVG(calibration_frequency_days)::numeric(10,2) as avg_calibration_days,
                    AVG(maintenance_frequency_days)::numeric(10,2) as avg_maintenance_days
                FROM lab_instruments
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Lab instrument statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting lab instrument statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search instruments
     * @param {string} searchTerm - Search term (name, code, serial, manufacturer)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of instruments
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, instrument_code, instrument_name,
                    manufacturer, model, serial_number,
                    category, location, status,
                    is_active
                FROM lab_instruments
                WHERE (instrument_name ILIKE $1 
                    OR instrument_code ILIKE $1
                    OR serial_number ILIKE $1
                    OR manufacturer ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN instrument_name ILIKE $2 THEN 1
                        WHEN instrument_code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    instrument_name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Lab instrument search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching lab instruments', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete lab instrument
     * @param {string} id - Instrument ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE lab_instruments 
                SET is_deleted = true,
                    is_active = false,
                    status = 'retired',
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Lab instrument not found');
            }

            await db.commitTransaction(client);

            logger.info('Lab instrument soft deleted', {
                instrumentId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting lab instrument', {
                error: error.message,
                instrumentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = LabInstrument;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */