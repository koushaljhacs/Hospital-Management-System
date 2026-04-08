/**
 * ======================================================================
 * FILE: backend/src/models/facility/Bed.js
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
 * Bed model for database operations.
 * Handles hospital bed management including allocation, status tracking,
 * cleaning schedules, and maintenance.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-23
 * 
 * DEPENDENCIES:
 * - db: database connection pool
 * - logger: logging utility
 * 
 * TABLE: beds
 * 
 * FIELDS:
 * - id: UUID (primary key)
 * - bed_number: string (unique)
 * - ward: string
 * - room_number: string
 * - floor: integer
 * - building: string
 * - zone: string
 * - type: enum (general, semi_private, private, icu, nicu, picu, emergency, operation_theater, recovery, isolation, negative_pressure, burn_unit, cardiac_care)
 * - status: enum (available, occupied, reserved, cleaning, maintenance, out_of_service, blocked)
 * - sub_type: string
 * - capacity: integer
 * - is_isolated: boolean
 * - is_private: boolean
 * - has_ventilator: boolean
 * - has_cardiac_monitor: boolean
 * - has_oxygen_supply: boolean
 * - has_suction: boolean
 * - has_call_bell: boolean
 * - equipment_list: jsonb
 * - current_patient_id: uuid
 * - expected_discharge: timestamp
 * - assigned_at: timestamp
 * - assigned_by: uuid
 * - previous_patient_id: uuid
 * - last_occupied_from: timestamp
 * - last_occupied_to: timestamp
 * - last_cleaned: timestamp
 * - last_cleaned_by: uuid
 * - cleaning_due: timestamp
 * - cleaning_status: enum (clean, dirty, in_progress, disinfected, sterile)
 * - last_maintenance: timestamp
 * - maintenance_due: date
 * - maintenance_notes: text
 * - is_out_of_service: boolean
 * - out_of_service_reason: text
 * - out_of_service_since: timestamp
 * - expected_service_restoration: date
 * - has_attached_bathroom: boolean
 * - has_tv: boolean
 * - has_wifi: boolean
 * - has_ac: boolean
 * - has_fridge: boolean
 * - amenities: jsonb
 * - daily_rate: decimal
 * - hourly_rate: decimal
 * - deposit_required: decimal
 * - insurance_coverage: boolean
 * - rate_category: string
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

const Bed = {
    /**
     * Table name
     */
    tableName: 'beds',

    /**
     * Valid bed types
     */
    validTypes: [
        'general', 'semi_private', 'private', 'icu', 'nicu', 'picu',
        'emergency', 'operation_theater', 'recovery', 'isolation',
        'negative_pressure', 'burn_unit', 'cardiac_care'
    ],

    /**
     * Valid status values
     */
    validStatuses: ['available', 'occupied', 'reserved', 'cleaning', 'maintenance', 'out_of_service', 'blocked'],

    /**
     * Valid cleaning statuses
     */
    validCleaningStatuses: ['clean', 'dirty', 'in_progress', 'disinfected', 'sterile'],

    /**
     * Find bed by ID
     * @param {string} id - Bed UUID
     * @returns {Promise<Object|null>} Bed object or null
     */
    async findById(id) {
        try {
            const query = `
                SELECT 
                    b.id, b.bed_number, b.ward, b.room_number,
                    b.floor, b.building, b.zone,
                    b.type, b.status, b.sub_type, b.capacity,
                    b.is_isolated, b.is_private,
                    b.has_ventilator, b.has_cardiac_monitor,
                    b.has_oxygen_supply, b.has_suction, b.has_call_bell,
                    b.equipment_list,
                    b.current_patient_id, b.expected_discharge,
                    b.assigned_at, b.assigned_by,
                    b.previous_patient_id,
                    b.last_occupied_from, b.last_occupied_to,
                    b.last_cleaned, b.last_cleaned_by, b.cleaning_due,
                    b.cleaning_status,
                    b.last_maintenance, b.maintenance_due, b.maintenance_notes,
                    b.is_out_of_service, b.out_of_service_reason,
                    b.out_of_service_since, b.expected_service_restoration,
                    b.has_attached_bathroom, b.has_tv, b.has_wifi,
                    b.has_ac, b.has_fridge, b.amenities,
                    b.daily_rate, b.hourly_rate, b.deposit_required,
                    b.insurance_coverage, b.rate_category,
                    b.notes, b.special_instructions, b.metadata,
                    b.created_at, b.updated_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    assigned_by_user.username as assigned_by_name,
                    cleaned_by_user.username as last_cleaned_by_name
                FROM beds b
                LEFT JOIN patients p ON b.current_patient_id = p.id
                LEFT JOIN users assigned_by_user ON b.assigned_by = assigned_by_user.id
                LEFT JOIN users cleaned_by_user ON b.last_cleaned_by = cleaned_by_user.id
                WHERE b.id = $1 AND b.is_deleted = false
            `;

            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Bed found by ID', { bedId: id });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding bed by ID', {
                error: error.message,
                bedId: id
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find bed by bed number
     * @param {string} bedNumber - Bed number
     * @returns {Promise<Object|null>} Bed object or null
     */
    async findByNumber(bedNumber) {
        try {
            const query = `
                SELECT 
                    id, bed_number, ward, room_number,
                    type, status, current_patient_id
                FROM beds
                WHERE bed_number = $1 AND is_deleted = false
            `;

            const result = await db.query(query, [bedNumber]);

            if (result.rows.length === 0) {
                return null;
            }

            logger.debug('Bed found by number', { bedNumber });
            return result.rows[0];
        } catch (error) {
            logger.error('Error finding bed by number', {
                error: error.message,
                bedNumber
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Find beds by ward
     * @param {string} ward - Ward name
     * @param {Object} options - Pagination and filter options
     * @returns {Promise<Array>} List of beds
     */
    async findByWard(ward, options = {}) {
        try {
            const { limit = 100, offset = 0, status } = options;
            const values = [ward];
            let paramIndex = 2;
            const conditions = ['is_deleted = false'];

            if (status) {
                conditions.push(`status = $${paramIndex++}`);
                values.push(status);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, bed_number, room_number, type, status,
                    current_patient_id, is_isolated, daily_rate
                FROM beds
                ${whereClause}
                ORDER BY room_number ASC, bed_number ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Beds found by ward', {
                ward,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error finding beds by ward', {
                error: error.message,
                ward
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get available beds
     * @param {Object} filters - Filter conditions (type, ward, is_isolated, etc.)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of available beds
     */
    async getAvailable(filters = {}, options = {}) {
        try {
            const { limit = 50, offset = 0 } = options;
            const values = [];
            let paramIndex = 1;
            const conditions = ['status = \'available\'', 'is_deleted = false'];

            if (filters.type) {
                conditions.push(`type = $${paramIndex++}`);
                values.push(filters.type);
            }
            if (filters.ward) {
                conditions.push(`ward = $${paramIndex++}`);
                values.push(filters.ward);
            }
            if (filters.is_isolated !== undefined) {
                conditions.push(`is_isolated = $${paramIndex++}`);
                values.push(filters.is_isolated);
            }
            if (filters.has_ventilator !== undefined) {
                conditions.push(`has_ventilator = $${paramIndex++}`);
                values.push(filters.has_ventilator);
            }
            if (filters.has_oxygen_supply !== undefined) {
                conditions.push(`has_oxygen_supply = $${paramIndex++}`);
                values.push(filters.has_oxygen_supply);
            }
            if (filters.min_rate !== undefined) {
                conditions.push(`daily_rate >= $${paramIndex++}`);
                values.push(filters.min_rate);
            }
            if (filters.max_rate !== undefined) {
                conditions.push(`daily_rate <= $${paramIndex++}`);
                values.push(filters.max_rate);
            }

            const whereClause = `WHERE ${conditions.join(' AND ')}`;

            const query = `
                SELECT 
                    id, bed_number, ward, room_number, floor,
                    type, daily_rate, hourly_rate,
                    has_ventilator, has_oxygen_supply,
                    is_isolated, has_attached_bathroom
                FROM beds
                ${whereClause}
                ORDER BY daily_rate ASC, bed_number ASC
                LIMIT $${paramIndex++} OFFSET $${paramIndex++}
            `;

            values.push(limit, offset);

            const result = await db.query(query, values);

            logger.debug('Available beds retrieved', {
                count: result.rows.length,
                filters
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting available beds', {
                error: error.message,
                filters
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Get occupied beds
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of occupied beds
     */
    async getOccupied(options = {}) {
        try {
            const { limit = 100, offset = 0 } = options;

            const query = `
                SELECT 
                    b.id, b.bed_number, b.ward, b.room_number,
                    b.type, b.current_patient_id, b.expected_discharge,
                    b.assigned_at,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name
                FROM beds b
                JOIN patients p ON b.current_patient_id = p.id
                WHERE b.status = 'occupied' AND b.is_deleted = false
                ORDER BY b.expected_discharge ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            logger.debug('Occupied beds retrieved', {
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error getting occupied beds', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Create new bed
     * @param {Object} bedData - Bed data
     * @returns {Promise<Object>} Created bed
     */
    async create(bedData) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            if (bedData.type && !this.validTypes.includes(bedData.type)) {
                throw new Error(`Invalid bed type. Must be one of: ${this.validTypes.join(', ')}`);
            }
            if (bedData.status && !this.validStatuses.includes(bedData.status)) {
                throw new Error(`Invalid status. Must be one of: ${this.validStatuses.join(', ')}`);
            }
            if (bedData.cleaning_status && !this.validCleaningStatuses.includes(bedData.cleaning_status)) {
                throw new Error(`Invalid cleaning status. Must be one of: ${this.validCleaningStatuses.join(', ')}`);
            }

            const existingBed = await this.findByNumber(bedData.bed_number);
            if (existingBed) {
                throw new Error('Bed number already exists');
            }

            const query = `
                INSERT INTO beds (
                    id, bed_number, ward, room_number,
                    floor, building, zone,
                    type, status, sub_type, capacity,
                    is_isolated, is_private,
                    has_ventilator, has_cardiac_monitor,
                    has_oxygen_supply, has_suction, has_call_bell,
                    equipment_list,
                    cleaning_status,
                    has_attached_bathroom, has_tv, has_wifi,
                    has_ac, has_fridge, amenities,
                    daily_rate, hourly_rate, deposit_required,
                    insurance_coverage, rate_category,
                    notes, special_instructions, metadata,
                    created_by, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    $4, $5, $6,
                    $7, $8, $9, $10,
                    $11, $12,
                    $13, $14,
                    $15, $16, $17,
                    $18,
                    $19,
                    $20, $21, $22,
                    $23, $24, $25,
                    $26, $27, $28,
                    $29, $30,
                    $31, $32, $33,
                    $34, NOW(), NOW()
                )
                RETURNING 
                    id, bed_number, ward, room_number,
                    type, status, daily_rate, created_at
            `;

            const values = [
                bedData.bed_number,
                bedData.ward,
                bedData.room_number,
                bedData.floor || null,
                bedData.building || null,
                bedData.zone || null,
                bedData.type,
                bedData.status || 'available',
                bedData.sub_type || null,
                bedData.capacity || 1,
                bedData.is_isolated || false,
                bedData.is_private || false,
                bedData.has_ventilator || false,
                bedData.has_cardiac_monitor || false,
                bedData.has_oxygen_supply !== undefined ? bedData.has_oxygen_supply : true,
                bedData.has_suction || false,
                bedData.has_call_bell !== undefined ? bedData.has_call_bell : true,
                bedData.equipment_list || null,
                bedData.cleaning_status || 'clean',
                bedData.has_attached_bathroom || false,
                bedData.has_tv || false,
                bedData.has_wifi || false,
                bedData.has_ac !== undefined ? bedData.has_ac : true,
                bedData.has_fridge || false,
                bedData.amenities || null,
                bedData.daily_rate || null,
                bedData.hourly_rate || null,
                bedData.deposit_required || null,
                bedData.insurance_coverage !== undefined ? bedData.insurance_coverage : true,
                bedData.rate_category || null,
                bedData.notes || null,
                bedData.special_instructions || null,
                bedData.metadata || null,
                bedData.created_by || null
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            logger.info('Bed created successfully', {
                bedId: result.rows[0].id,
                bedNumber: bedData.bed_number,
                ward: bedData.ward,
                type: bedData.type
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error creating bed', {
                error: error.message,
                bedNumber: bedData.bed_number
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Update bed
     * @param {string} id - Bed ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated bed
     */
    async update(id, updates) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const allowedFields = [
                'ward', 'room_number', 'floor', 'building', 'zone',
                'type', 'status', 'sub_type', 'capacity',
                'is_isolated', 'is_private',
                'has_ventilator', 'has_cardiac_monitor',
                'has_oxygen_supply', 'has_suction', 'has_call_bell',
                'equipment_list',
                'current_patient_id', 'expected_discharge',
                'assigned_at', 'assigned_by',
                'previous_patient_id',
                'last_occupied_from', 'last_occupied_to',
                'last_cleaned', 'last_cleaned_by', 'cleaning_due',
                'cleaning_status',
                'last_maintenance', 'maintenance_due', 'maintenance_notes',
                'is_out_of_service', 'out_of_service_reason',
                'out_of_service_since', 'expected_service_restoration',
                'has_attached_bathroom', 'has_tv', 'has_wifi',
                'has_ac', 'has_fridge', 'amenities',
                'daily_rate', 'hourly_rate', 'deposit_required',
                'insurance_coverage', 'rate_category',
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
                UPDATE beds 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex} AND is_deleted = false
                RETURNING 
                    id, bed_number, status,
                    current_patient_id, updated_at
            `;

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Bed not found');
            }

            await db.commitTransaction(client);

            logger.info('Bed updated', {
                bedId: id,
                updates: Object.keys(updates)
            });

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error updating bed', {
                error: error.message,
                bedId: id
            });
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Assign patient to bed
     * @param {string} id - Bed ID
     * @param {Object} assignmentData - Assignment data
     * @returns {Promise<Object>} Updated bed
     */
    async assignPatient(id, assignmentData) {
        const bed = await this.findById(id);
        if (!bed) {
            throw new Error('Bed not found');
        }
        if (bed.status !== 'available') {
            throw new Error(`Bed is not available. Current status: ${bed.status}`);
        }

        const updates = {
            status: 'occupied',
            current_patient_id: assignmentData.patient_id,
            assigned_at: new Date(),
            assigned_by: assignmentData.assigned_by,
            expected_discharge: assignmentData.expected_discharge,
            updated_by: assignmentData.assigned_by
        };
        return this.update(id, updates);
    },

    /**
     * Vacate bed (patient discharged)
     * @param {string} id - Bed ID
     * @param {string} vacatedBy - User who vacated
     * @returns {Promise<Object>} Updated bed
     */
    async vacate(id, vacatedBy) {
        const bed = await this.findById(id);
        if (!bed) {
            throw new Error('Bed not found');
        }
        if (bed.status !== 'occupied') {
            throw new Error(`Bed is not occupied. Current status: ${bed.status}`);
        }

        const updates = {
            status: 'cleaning',
            cleaning_status: 'dirty',
            previous_patient_id: bed.current_patient_id,
            last_occupied_from: bed.assigned_at,
            last_occupied_to: new Date(),
            current_patient_id: null,
            assigned_at: null,
            assigned_by: null,
            expected_discharge: null,
            updated_by: vacatedBy
        };
        return this.update(id, updates);
    },

    /**
     * Mark bed as cleaned
     * @param {string} id - Bed ID
     * @param {string} cleanedBy - User who cleaned
     * @returns {Promise<Object>} Updated bed
     */
    async markCleaned(id, cleanedBy) {
        const updates = {
            cleaning_status: 'clean',
            last_cleaned: new Date(),
            last_cleaned_by: cleanedBy,
            status: 'available',
            updated_by: cleanedBy
        };
        return this.update(id, updates);
    },

    /**
     * Mark bed for maintenance
     * @param {string} id - Bed ID
     * @param {Object} maintenanceData - Maintenance data
     * @returns {Promise<Object>} Updated bed
     */
    async markMaintenance(id, maintenanceData) {
        const updates = {
            status: 'maintenance',
            is_out_of_service: true,
            out_of_service_reason: maintenanceData.reason,
            out_of_service_since: new Date(),
            expected_service_restoration: maintenanceData.expected_restoration,
            maintenance_notes: maintenanceData.notes,
            updated_by: maintenanceData.updated_by
        };
        return this.update(id, updates);
    },

    /**
     * Restore bed from maintenance
     * @param {string} id - Bed ID
     * @param {string} restoredBy - User who restored
     * @returns {Promise<Object>} Updated bed
     */
    async restoreFromMaintenance(id, restoredBy) {
        const updates = {
            status: 'available',
            is_out_of_service: false,
            out_of_service_reason: null,
            out_of_service_since: null,
            expected_service_restoration: null,
            updated_by: restoredBy
        };
        return this.update(id, updates);
    },

    /**
     * Get bed statistics
     * @returns {Promise<Object>} Statistics object
     */
    async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_beds,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                    COUNT(*) FILTER (WHERE type = 'icu') as icu_beds,
                    COUNT(*) FILTER (WHERE type = 'general') as general_beds,
                    COUNT(*) FILTER (WHERE type = 'private') as private_beds,
                    COUNT(*) FILTER (WHERE is_isolated = true) as isolation_beds,
                    AVG(daily_rate)::numeric(10,2) as avg_daily_rate,
                    SUM(CASE WHEN status = 'occupied' THEN daily_rate ELSE 0 END) as potential_daily_revenue
                FROM beds
                WHERE is_deleted = false
            `;

            const result = await db.query(query);

            logger.debug('Bed statistics retrieved');

            return result.rows[0];
        } catch (error) {
            logger.error('Error getting bed statistics', {
                error: error.message
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Search beds
     * @param {string} searchTerm - Search term (number, ward, room)
     * @param {Object} options - Pagination options
     * @returns {Promise<Array>} List of beds
     */
    async search(searchTerm, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;

            const query = `
                SELECT 
                    id, bed_number, ward, room_number,
                    type, status, daily_rate,
                    current_patient_id
                FROM beds
                WHERE (bed_number ILIKE $1 
                    OR ward ILIKE $1
                    OR room_number ILIKE $1)
                    AND is_deleted = false
                ORDER BY 
                    CASE 
                        WHEN bed_number ILIKE $2 THEN 1
                        WHEN ward ILIKE $2 THEN 2
                        ELSE 3
                    END,
                    bed_number ASC
                LIMIT $3 OFFSET $4
            `;

            const values = [
                `%${searchTerm}%`,
                `${searchTerm}%`,
                limit,
                offset
            ];

            const result = await db.query(query, values);

            logger.debug('Bed search completed', {
                searchTerm,
                count: result.rows.length
            });

            return result.rows;
        } catch (error) {
            logger.error('Error searching beds', {
                error: error.message,
                searchTerm
            });
            throw new Error(`Database error: ${error.message}`);
        }
    },

    /**
     * Soft delete bed
     * @param {string} id - Bed ID
     * @param {string} deletedBy - User who performed deletion
     * @returns {Promise<boolean>} True if deleted
     */
    async delete(id, deletedBy) {
        const client = await db.getClient();

        try {
            await db.beginTransaction(client);

            const bed = await this.findById(id);
            if (!bed) {
                throw new Error('Bed not found');
            }
            if (bed.status === 'occupied') {
                throw new Error('Cannot delete an occupied bed');
            }

            const query = `
                UPDATE beds 
                SET is_deleted = true,
                    status = 'out_of_service',
                    deleted_at = NOW(),
                    deleted_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND is_deleted = false
                RETURNING id
            `;

            const result = await client.query(query, [deletedBy, id]);

            if (result.rows.length === 0) {
                throw new Error('Bed not found');
            }

            await db.commitTransaction(client);

            logger.info('Bed soft deleted', {
                bedId: id,
                deletedBy
            });

            return true;
        } catch (error) {
            await db.rollbackTransaction(client);
            logger.error('Error deleting bed', {
                error: error.message,
                bedId: id
            });
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = Bed;

/**
 * ======================================================================
 * AUTHOR: @koushal
 * RESTRICTIONS: Proprietary code. Unauthorized copying or distribution prohibited.
 * ======================================================================
 */