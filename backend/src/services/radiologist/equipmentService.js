/**
 * ======================================================================
 * FILE: backend/src/services/radiologist/equipmentService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist equipment service - Handles business logic for radiology equipment.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const equipmentService = {
    /**
     * Get all equipment
     */
    async getAllEquipment(radiologistId, options = {}) {
        try {
            const { page = 1, limit = 20, status, type, location, manufacturer } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT e.*,
                       COUNT(DISTINCT o.id) as total_orders,
                       COUNT(DISTINCT i.id) as total_images,
                       CASE 
                           WHEN e.next_calibration < NOW() THEN 'overdue'
                           WHEN e.next_calibration <= NOW() + INTERVAL '30 days' THEN 'due_soon'
                           ELSE 'ok'
                       END as calibration_status,
                       EXTRACT(DAY FROM (e.next_calibration - NOW())) as days_until_calibration
                FROM radiology_equipment e
                LEFT JOIN radiology_orders o ON e.id = o.equipment_id
                LEFT JOIN radiology_images i ON e.id = i.equipment_id
                WHERE e.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND e.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (type) {
                query += ` AND e.type = $${paramIndex}`;
                values.push(type);
                paramIndex++;
            }

            if (location) {
                query += ` AND e.location ILIKE $${paramIndex}`;
                values.push(`%${location}%`);
                paramIndex++;
            }

            if (manufacturer) {
                query += ` AND e.manufacturer ILIKE $${paramIndex}`;
                values.push(`%${manufacturer}%`);
                paramIndex++;
            }

            query += ` GROUP BY e.id
                      ORDER BY e.name ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total,
                       COUNT(*) FILTER (WHERE status = 'operational') as operational,
                       COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                       COUNT(*) FILTER (WHERE status = 'calibration_due') as calibration_due,
                       COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service
                FROM radiology_equipment
                WHERE is_deleted = false
                ${status ? 'AND status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                summary: count.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAllEquipment', { error: error.message, radiologistId });
            throw error;
        }
    },

    /**
     * Get equipment by ID
     */
    async getEquipmentById(radiologistId, equipmentId) {
        try {
            const query = `
                SELECT e.*,
                       COUNT(DISTINCT o.id) as total_orders,
                       COUNT(DISTINCT i.id) as total_images,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', m.id,
                                   'type', m.maintenance_type,
                                   'description', m.description,
                                   'performed_at', m.performed_at,
                                   'performed_by', CONCAT(u.first_name, ' ', u.last_name)
                               ) ORDER BY m.performed_at DESC
                           )
                           FROM radiology_maintenance_logs m
                           LEFT JOIN users u ON m.performed_by = u.id
                           WHERE m.equipment_id = e.id
                           LIMIT 10
                       ) as maintenance_logs
                FROM radiology_equipment e
                WHERE e.id = $1 AND e.is_deleted = false
                GROUP BY e.id
            `;

            const result = await db.query(query, [equipmentId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getEquipmentById', { error: error.message, radiologistId, equipmentId });
            throw error;
        }
    },

    /**
     * Update equipment status
     */
    async updateEquipmentStatus(radiologistId, equipmentId, updateData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE radiology_equipment 
                SET status = $1,
                    status_notes = $2,
                    status_updated_at = $3,
                    status_updated_by = $4,
                    updated_at = NOW()
                WHERE id = $5 AND is_deleted = false
                RETURNING *
            `;

            const values = [
                updateData.status,
                updateData.notes,
                updateData.updated_at,
                updateData.updated_by,
                equipmentId
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Equipment not found');
            }

            // Log status change
            await client.query(`
                INSERT INTO radiology_equipment_logs (
                    id, equipment_id, action, old_status, new_status, notes, performed_by, performed_at
                ) VALUES (
                    gen_random_uuid(), $1, 'status_change', $2, $3, $4, $5, $6
                )
            `, [
                equipmentId,
                result.rows[0].status,
                updateData.status,
                updateData.notes,
                radiologistId,
                updateData.updated_at
            ]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    }
};

module.exports = equipmentService;