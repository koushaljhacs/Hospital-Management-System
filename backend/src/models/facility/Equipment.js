/**
 * ======================================================================
 * FILE: backend/src/models/facility/Equipment.js
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
 * Equipment model for database operations.
 * Handles biomedical equipment management including maintenance, calibration,
 * and usage tracking.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: equipment
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - equipment_code: string (unique)
 * - name: string
 * - description: text
 * - category: enum (diagnostic, therapeutic, surgical, monitoring, laboratory, imaging, sterilization, patient_care, emergency, office, other)
 * - type: string
 * - sub_type: string
 * - manufacturer: string
 * - model: string
 * - serial_number: string (unique)
 * - year_of_manufacture: integer
 * - country_of_origin: string
 * - department_id: UUID
 * - location: string
 * - room_number: string
 * - floor: integer
 * - building: string
 * - purchase_date: date
 * - purchase_cost: decimal
 * - supplier_id: UUID
 * - invoice_number: string
 * - warranty_start_date: date
 * - warranty_end_date: date
 * - warranty_terms: text
 * - amc_start_date: date
 * - amc_end_date: date
 * - amc_provider: string
 * - amc_cost: decimal
 * - specifications: jsonb
 * - power_requirements: string
 * - voltage: string
 * - frequency: string
 * - power_consumption: string
 * - dimensions: string
 * - weight: decimal
 * - color: string
 * - accessories: jsonb
 * - calibration_required: boolean
 * - calibration_frequency: string
 * - last_calibration_date: date
 * - next_calibration_date: date
 * - calibration_due_alert: integer
 * - maintenance_required: boolean
 * - maintenance_frequency: string
 * - last_maintenance_date: date
 * - next_maintenance_date: date
 * - maintenance_due_alert: integer
 * - maintenance_instructions: text
 * - maintenance_log: jsonb
 * - status: enum (operational, under_maintenance, repair_required, calibration_due, out_of_service, retired, reserved)
 * - operational_status: string
 * - is_available: boolean
 * - available_from: timestamp
 * - available_to: timestamp
 * - downtime_reason: text
 * - downtime_start: timestamp
 * - downtime_end: timestamp
 * - estimated_repair_date: date
 * - total_usage_hours: integer
 * - total_usage_count: integer
 * - last_used_date: date
 * - last_used_by: uuid
 * - assigned_to: uuid
 * - assigned_date: timestamp
 * - manual_url: text
 * - certificate_url: text
 * - warranty_document_url: text
 * - amc_document_url: text
 * - calibration_certificate_url: text
 * - insurance_document_url: text
 * - other_documents: jsonb
 * - insurance_required: boolean
 * - insurance_provider: string
 * - insurance_policy_number: string
 * - insurance_cover_amount: decimal
 * - insurance_start_date: date
 * - insurance_end_date: date
 * - notes: text
 * - special_instructions: text
 * - metadata: jsonb
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

const Equipment = {
    /**
     * Table name
     */
    tableName: 'equipment',

    /**
     * Valid categories
     */
    validCategories: [
        'diagnostic', 'therapeutic', 'surgical', 'monitoring',
        'laboratory', 'imaging', 'sterilization', 'patient_care',
        'emergency', 'office', 'other'
    ],

    /**
     * Valid statuses
     */
    validStatuses: [
        'operational', 'under_maintenance', 'repair_required',
        'calibration_due', 'out_of_service', 'retired', 'reserved'
    ],

    /**
     * Generate equipment code
     * @returns {Promise<string>} Generated equipment code
     */
    async generateEquipmentCode() {
        try {
            const query = `SELECT COUNT(*) as count FROM equipment WHERE is_deleted = false`;
            const result = await db.query(query);
            const count = parseInt(result.rows[0].count) + 1;
            const sequence = count.toString().padStart(4, '0');
            return `EQ-${sequence}`;
        } catch (error) {
            logger.error('Error generating equipment code', { error: error.message });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find equipment by ID
     * @param {string} id - Equipment UUID
     * @returns {Promise<Object|null>} Equipment object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    e.id, e.equipment_code, e.name, e.description,
                    e.category, e.type, e.sub_type,
                    e.manufacturer, e.model, e.serial_number,
                    e.year_of_manufacture, e.country_of_origin,
                    e.department_id, e.location, e.room_number,
                    e.floor, e.building,
                    e.purchase_date, e.purchase_cost, e.supplier_id,
                    e.invoice_number,
                    e.warranty_start_date, e.warranty_end_date, e.warranty_terms,
                    e.amc_start_date, e.amc_end_date, e.amc_provider, e.amc_cost,
                    e.specifications, e.power_requirements,
                    e.voltage, e.frequency, e.power_consumption,
                    e.dimensions, e.weight, e.color, e.accessories,
                    e.calibration_required, e.calibration_frequency,
                    e.last_calibration_date, e.next_calibration_date,
                    e.calibration_due_alert,
                    e.maintenance_required, e.maintenance_frequency,
                    e.last_maintenance_date, e.next_maintenance_date,
                    e.maintenance_due_alert, e.maintenance_instructions,
                    e.maintenance_log,
                    e.status, e.operational_status, e.is_available,
                    e.available_from, e.available_to,
                    e.downtime_reason, e.downtime_start, e.downtime_end,
                    e.estimated_repair_date,
                    e.total_usage_hours, e.total_usage_count,
                    e.last_used_date, e.last_used_by,
                    e.assigned_to, e.assigned_date,
                    e.manual_url, e.certificate_url,
                    e.warranty_document_url, e.amc_document_url,
                    e.calibration_certificate_url, e.insurance_document_url,
                    e.other_documents,
                    e.insurance_required, e.insurance_provider,
                    e.insurance_policy_number, e.insurance_cover_amount,
                    e.insurance_start_date, e.insurance_end_date,
                    e.notes, e.special_instructions, e.metadata,
                    e.created_at, e.updated_at,
                    d.name as department_name,
                    s.name as supplier_name,
                    u.username as assigned_to_name,
                    lu.username as last_used_by_name
                FROM equipment e
                LEFT JOIN departments d ON e.department_id = d.id
                LEFT JOIN suppliers s ON e.supplier_id = s.id
                LEFT JOIN users u ON e.assigned_to = u.id
                LEFT JOIN users lu ON e.last_used_by = lu.id
                WHERE e.id = $1 AND e.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Equipment found by ID', { equipmentId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding equipment by ID', {
                error: error.message,
                equipmentId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find equipment by code
     * @param {string} equipmentCode - Equipment code
     * @returns {Promise<Object|null>} Equipment object or null
     */
    async findByCode(equipmentCode) {
        try {
            const query = `
                SELECT id, equipment_code, name, category, status, is_available
                FROM equipment
                WHERE equipment_code = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [equipmentCode]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Equipment found by code', { equipmentCode });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding equipment by code', {
                error: error.message,
                equipmentCode
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find equipment by serial number
     * @param {string} serialNumber - Serial number
     * @returns {Promise<Object|null>} Equipment object or null
     */
    async findBySerialNumber(serialNumber) {
        try {
            const query = `
                SELECT id, equipment_code, name, serial_number, status
                FROM equipment
                WHERE serial_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [serialNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Equipment found by serial number', { serialNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding equipment by serial number', {
                error: error.message,
                serialNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find equipment by category
     * @param {string} category - Equipment category
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of equipment
     */
    async findByCategory(category, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;

            const query = `
                SELECT 
                    id, equipment_code, name, category,
                    manufacturer, model, status, is_available,
                    location, department_id
                FROM equipment
                WHERE category = $1 AND is_deleted = false
                ORDER BY name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [category, limit, offset]);

            logger.debug('Equipment found by category', {
                category,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding equipment by category', {
                error: error.message,
                category
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get equipment by department
     * @param {string} departmentId - Department UUID
     * @returns {Promise<Array>} List of equipment
     */
    async findByDepartment(departmentId) {
        try {
            const query = `
                SELECT 
                    id, equipment_code, name, category,
                    status, is_available, location
                FROM equipment
                WHERE department_id = $1 AND is_deleted = false
                ORDER BY name ASC
            `;

            const result = await db.query(query, [departmentId]);

            logger.debug('Equipment found by department', {
                departmentId,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding equipment by department', {
                error: error.message,
                departmentId
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get available equipment
     * @param {Object} filters - Filter conditions (category, department)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of available equipment
     */
    async getAvailable(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['is_available = true', 'status = \'operational\'', 'is_deleted = false'];

            if (filters.category) {
                conditions.push(`category = $${paramIndex++}`);
                values.push(filters.category);
            }
            if (filters.department_id) {
                conditions.push(`department_id = $${paramIndex++}`);
                values.push(filters.department_id);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, equipment_code, name, category,
                    manufacturer, model, location
                FROM equipment
                ${whereClause}
                ORDER BY name ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Available equipment retrieved', {
                count: result.rows.length,
                filters
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting available equipment', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get equipment requiring calibration
     * @param {number} daysThreshold - Days to look ahead
     * @returns {Promise<Array>} List of equipment due for calibration
     */
    async getCalibrationDue(daysThreshold = 30) {
        try {
            const query = `
                SELECT 
                    id, equipment_code, name, model,
                    last_calibration_date, next_calibration_date,
                    calibration_frequency, location
                FROM equipment
                WHERE calibration_required = true
                    AND next_calibration_date <= NOW() + ($1 || ' days')::INTERVAL
                    AND is_deleted = false
                ORDER BY next_calibration_date ASC
            `;

            const result = await db.query(query, [daysThreshold]);

            logger.debug('Equipment requiring calibration retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting calibration due equipment', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get equipment requiring maintenance
     * @param {number} daysThreshold - Days to look ahead
     * @returns {Promise<Array>} List of equipment due for maintenance
     */
    async getMaintenanceDue(daysThreshold = 30) {
        try {
            const query = `
                SELECT 
                    id, equipment_code, name, model,
                    last_maintenance_date, next_maintenance_date,
                    maintenance_frequency, location
                FROM equipment
                WHERE maintenance_required = true
                    AND next_maintenance_date <= NOW() + ($1 || ' days')::INTERVAL
                    AND is_deleted = false
                ORDER BY next_maintenance_date ASC
            `;

            const result = await db.query(query, [daysThreshold]);

            logger.debug('Equipment requiring maintenance retrieved', {
                daysThreshold,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting maintenance due equipment', {
                error: error.message,
                daysThreshold
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new equipment
     * @param {Object} equipmentData - Equipment data
     * @returns {Promise<Object>} Created equipment
     */
    async create(equipmentData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (equipmentData.category && !this.validCategories.includes(equipmentData.category)) {
                throw new Error(`Invalid category. Must be one of: ${this.validCategories.join(', ')}`);
            }
            if (equipmentData.status && !this.validStatuses.includes(equipmentData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }

            const equipmentCode = equipmentData.equipment_code || await this.generateEquipmentCode();

            // Calculate next calibration date
            let nextCalibrationDate = equipmentData.next_calibration_date;
            if (!nextCalibrationDate && equipmentData.calibration_required && equipmentData.last_calibration_date && equipmentData.calibration_frequency) {
                const freqMap = { 'monthly': 30, 'quarterly': 90, 'half_yearly': 180, 'yearly': 365 };
                const days = freqMap[equipmentData.calibration_frequency] || 365;
                const date = new Date(equipmentData.last_calibration_date);
                date.setDate(date.getDate() + days);
                nextCalibrationDate = date;
            }

            // Calculate next maintenance date
            let nextMaintenanceDate = equipmentData.next_maintenance_date;
            if (!nextMaintenanceDate && equipmentData.maintenance_required && equipmentData.last_maintenance_date && equipmentData.maintenance_frequency) {
                const freqMap = { 'monthly': 30, 'quarterly': 90, 'half_yearly': 180, 'yearly': 365 };
                const days = freqMap[equipmentData.maintenance_frequency] || 365;
                const date = new Date(equipmentData.last_maintenance_date);
                date.setDate(date.getDate() + days);
                nextMaintenanceDate = date;
            }

            const query = `
                INSERT INTO equipment (
                    id, equipment_code, name, description,
                    category, type, sub_type,
                    manufacturer, model, serial_number,
                    year_of_manufacture, country_of_origin,
                    department_id, location, room_number,
                    floor, building,
                    purchase_date, purchase_cost, supplier_id,
                    invoice_number,
                    warranty_start_date, warranty_end_date, warranty_terms,
                    amc_start_date, amc_end_date, amc_provider, amc_cost,
                    specifications, power_requirements,
                    voltage, frequency, power_consumption,
                    dimensions, weight, color, accessories,
                    calibration_required, calibration_frequency,
                    last_calibration_date, next_calibration_date,
                    calibration_due_alert,
                    maintenance_required, maintenance_frequency,
                    last_maintenance_date, next_maintenance_date,
                    maintenance_due_alert, maintenance_instructions,
                    maintenance_log,
                    status, operational_status, is_available,
                    available_from, available_to,
                    notes, special_instructions, metadata,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9,
                    $10, $11,
                    $12, $13, $14,
                    $15, $16,
                    $17, $18, $19,
                    $20,
                    $21, $22, $23,
                    $24, $25, $26, $27,
                    $28, $29,
                    $30, $31, $32,
                    $33, $34, $35, $36,
                    $37, $38,
                    $39, $40,
                    $41,
                    $42, $43,
                    $44, $45,
                    $46, $47,
                    $48,
                    COALESCE($49, 'operational'), $50, $51,
                    $52, $53,
                    $54, $55, $56,
                    $57, NOW(), NOW()
                )
                RETURNING 
                    id, equipment_code, name, category,
                    status, created_at
            `;

            const values = [
                equipmentCode,
                equipmentData.name,
                equipmentData.description || null,
                equipmentData.category,
                equipmentData.type || null,
                equipmentData.sub_type || null,
                equipmentData.manufacturer || null,
                equipmentData.model || null,
                equipmentData.serial_number || null,
                equipmentData.year_of_manufacture || null,
                equipmentData.country_of_origin || null,
                equipmentData.department_id || null,
                equipmentData.location || null,
                equipmentData.room_number || null,
                equipmentData.floor || null,
                equipmentData.building || null,
                equipmentData.purchase_date || null,
                equipmentData.purchase_cost || null,
                equipmentData.supplier_id || null,
                equipmentData.invoice_number || null,
                equipmentData.warranty_start_date || null,
                equipmentData.warranty_end_date || null,
                equipmentData.warranty_terms || null,
                equipmentData.amc_start_date || null,
                equipmentData.amc_end_date || null,
                equipmentData.amc_provider || null,
                equipmentData.amc_cost || null,
                equipmentData.specifications || null,
                equipmentData.power_requirements || null,
                equipmentData.voltage || null,
                equipmentData.frequency || null,
                equipmentData.power_consumption || null,
                equipmentData.dimensions || null,
                equipmentData.weight || null,
                equipmentData.color || null,
                equipmentData.accessories || null,
                equipmentData.calibration_required !== undefined ? equipmentData.calibration_required : false,
                equipmentData.calibration_frequency || null,
                equipmentData.last_calibration_date || null,
                nextCalibrationDate,
                equipmentData.calibration_due_alert || 30,
                equipmentData.maintenance_required !== undefined ? equipmentData.maintenance_required : false,
                equipmentData.maintenance_frequency || null,
                equipmentData.last_maintenance_date || null,
                nextMaintenanceDate,
                equipmentData.maintenance_due_alert || 15,
                equipmentData.maintenance_instructions || null,
                equipmentData.maintenance_log || null,
                equipmentData.status,
                equipmentData.operational_status || null,
                equipmentData.is_available !== undefined ? equipmentData.is_available : true,
                equipmentData.available_from || null,
                equipmentData.available_to || null,
                equipmentData.notes || null,
                equipmentData.special_instructions || null,
                equipmentData.metadata || null,
                equipmentData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Equipment created successfully', {
                equipmentId: result.rows[0].id,
                equipmentCode,
                name: equipmentData.name,
                category: equipmentData.category
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating equipment', {
                error: error.message,
                name: equipmentData.name
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update equipment
     * @param {string} id - Equipment ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated equipment
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'name', 'description', 'category', 'type', 'sub_type',
                'manufacturer', 'model', 'serial_number',
                'year_of_manufacture', 'country_of_origin',
                'department_id', 'location', 'room_number',
                'floor', 'building',
                'purchase_date', 'purchase_cost', 'supplier_id',
                'invoice_number',
                'warranty_start_date', 'warranty_end_date', 'warranty_terms',
                'amc_start_date', 'amc_end_date', 'amc_provider', 'amc_cost',
                'specifications', 'power_requirements',
                'voltage', 'frequency', 'power_consumption',
                'dimensions', 'weight', 'color', 'accessories',
                'calibration_required', 'calibration_frequency',
                'last_calibration_date', 'next_calibration_date',
                'calibration_due_alert',
                'maintenance_required', 'maintenance_frequency',
                'last_maintenance_date', 'next_maintenance_date',
                'maintenance_due_alert', 'maintenance_instructions',
                'maintenance_log',
                'status', 'operational_status', 'is_available',
                'available_from', 'available_to',
                'downtime_reason', 'downtime_start', 'downtime_end',
                'estimated_repair_date',
                'total_usage_hours', 'total_usage_count',
                'last_used_date', 'last_used_by',
                'assigned_to', 'assigned_date',
                'manual_url', 'certificate_url',
                'warranty_document_url', 'amc_document_url',
                'calibration_certificate_url', 'insurance_document_url',
                'other_documents',
                'insurance_required', 'insurance_provider',
                'insurance_policy_number', 'insurance_cover_amount',
                'insurance_start_date', 'insurance_end_date',
                'notes', 'special_instructions', 'metadata'
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
                UPDATE equipment 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, equipment_code, name, status,
                    is_available, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Equipment not found');
            }

            await db.commitTransaction(client);

            logger.info('Equipment updated', {
                equipmentId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating equipment', {
                error: error.message,
                equipmentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Record calibration
     * @param {string} id - Equipment ID
     * @param {Object} calibrationData - Calibration data
     * @returns {Promise<Object>} Updated equipment
     */
    async recordCalibration(id, calibrationData) {
        const updates = {
            last_calibration_date: calibrationData.calibration_date || new Date(),
            calibration_frequency: calibrationData.frequency,
            calibration_certificate_url: calibrationData.certificate_url,
            updated_by: calibrationData.recorded_by
        };
        if (calibrationData.frequency) {
            const freqMap = { 'monthly': 30, 'quarterly': 90, 'half_yearly': 180, 'yearly': 365 };
            const days = freqMap[calibrationData.frequency] || 365;
            const nextDate = new Date(updates.last_calibration_date);
            nextDate.setDate(nextDate.getDate() + days);
            updates.next_calibration_date = nextDate;
        }
        if (updates.next_calibration_date && new Date(updates.next_calibration_date) > new Date()) {
            updates.status = 'operational';
        }
        return this.update(id, updates);
    },

    /**
     * Record maintenance
     * @param {string} id - Equipment ID
     * @param {Object} maintenanceData - Maintenance data
     * @returns {Promise<Object>} Updated equipment
     */
    async recordMaintenance(id, maintenanceData) {
        const updates = {
            last_maintenance_date: maintenanceData.maintenance_date || new Date(),
            maintenance_frequency: maintenanceData.frequency,
            updated_by: maintenanceData.recorded_by
        };
        if (maintenanceData.frequency) {
            const freqMap = { 'monthly': 30, 'quarterly': 90, 'half_yearly': 180, 'yearly': 365 };
            const days = freqMap[maintenanceData.frequency] || 365;
            const nextDate = new Date(updates.last_maintenance_date);
            nextDate.setDate(nextDate.getDate() + days);
            updates.next_maintenance_date = nextDate;
        }
        if (maintenanceData.notes) {
            updates.maintenance_instructions = maintenanceData.notes;
        }
        if (updates.next_maintenance_date && new Date(updates.next_maintenance_date) > new Date()) {
            updates.status = 'operational';
        }
        return this.update(id, updates);
    },

    /**
     * Update equipment status
     * @param {string} id - Equipment ID
     * @param {string} status - New status
     * @param {string} updatedBy - User who updated
     * @returns {Promise<Object>} Updated equipment
     */
    async updateStatus(id, status, updatedBy) {
        if (!this.validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
        }
        return this.update(id, {
            status: status,
            updated_by: updatedBy
        });
    },

    /**
     * Mark equipment as in use (record usage)
     * @param {string} id - Equipment ID
     * @param {Object} usageData - Usage data
     * @returns {Promise<Object>} Updated equipment
     */
    async recordUsage(id, usageData) {
        const equipment = await this.findById(id);
        if (!equipment) {
            throw new Error('Equipment not found');
        }
        const updates = {
            total_usage_count: (equipment.total_usage_count || 0) + 1,
            total_usage_hours: (equipment.total_usage_hours || 0) + (usageData.hours || 0),
            last_used_date: new Date(),
            last_used_by: usageData.used_by,
            updated_by: usageData.used_by
        };
        return this.update(id, updates);
    },

    /**
     * Assign equipment to user
     * @param {string} id - Equipment ID
     * @param {string} assignedTo - User ID
     * @param {string} assignedBy - User who assigned
     * @returns {Promise<Object>} Updated equipment
     */
    async assign(id, assignedTo, assignedBy) {
        return this.update(id, {
            assigned_to: assignedTo,
            assigned_date: new Date(),
            updated_by: assignedBy
        });
    },

    /**
     * Get equipment statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_equipment,
                    COUNT(*) FILTER (WHERE status = 'operational') as operational,
                    COUNT(*) FILTER (WHERE status = 'under_maintenance') as under_maintenance,
                    COUNT(*) FILTER (WHERE status = 'calibration_due') as calibration_due,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                    COUNT(*) FILTER (WHERE status = 'retired') as retired,
                    COUNT(*) FILTER (WHERE is_available = true) as available,
                    COUNT(DISTINCT category) as categories_used,
                    COUNT(DISTINCT department_id) as departments_using,
                    SUM(total_usage_hours) as total_usage_hours,
                    SUM(total_usage_count) as total_usage_count
                FROM equipment
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Equipment statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting equipment statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search equipment
     * @param {string} searchTerm - Search term (name, code, serial, manufacturer)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of equipment
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, equipment_code, name, category,
                    manufacturer, model, status, is_available,
                    location
                FROM equipment
                WHERE (name ILIKE $1 
                    OR equipment_code ILIKE $1
                    OR serial_number ILIKE $1
                    OR manufacturer ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN name ILIKE $2 THEN 1
                        WHEN equipment_code ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    name ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Equipment search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching equipment', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete equipment
     * @param {string} id - Equipment ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE equipment 
                SET is_deleted = true,
                    status = 'retired',
                    is_available = false,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Equipment not found');
            }

            await db.commitTransaction(client);

            logger.info('Equipment soft deleted', {
                equipmentId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting equipment', {
                error: error.message,
                equipmentId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Equipment;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */