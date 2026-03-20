/**
 * ======================================================================
 * FILE: backend/src/services/labTechnician/equipmentService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician equipment service - Handles business logic for lab equipment.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const equipmentService = {
    /**
     * Get all equipment
     */
    async getAllEquipment(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20, status, category, department, search } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT e.*, 
                       d.name as department_name,
                       CASE 
                           WHEN e.next_calibration_date < NOW() THEN 'overdue'
                           WHEN e.next_calibration_date <= NOW() + INTERVAL '7 days' THEN 'due_soon'
                           ELSE 'ok'
                       END as calibration_status,
                       CASE 
                           WHEN e.next_maintenance_date < NOW() THEN 'overdue'
                           WHEN e.next_maintenance_date <= NOW() + INTERVAL '7 days' THEN 'due_soon'
                           ELSE 'ok'
                       END as maintenance_status,
                       EXTRACT(DAY FROM (e.next_calibration_date - NOW())) as days_to_calibration,
                       EXTRACT(DAY FROM (e.next_maintenance_date - NOW())) as days_to_maintenance
                FROM equipment e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND e.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (category) {
                query += ` AND e.category = $${paramIndex}`;
                values.push(category);
                paramIndex++;
            }

            if (department) {
                query += ` AND e.department_id = $${paramIndex}`;
                values.push(department);
                paramIndex++;
            }

            if (search) {
                query += ` AND (e.name ILIKE $${paramIndex} OR e.model ILIKE $${paramIndex} OR e.serial_number ILIKE $${paramIndex})`;
                values.push(`%${search}%`);
                paramIndex++;
            }

            query += ` ORDER BY e.name ASC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM equipment e
                WHERE e.is_deleted = false
                ${status ? 'AND e.status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_equipment,
                    COUNT(*) FILTER (WHERE status = 'operational') as operational,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'calibration') as calibration,
                    COUNT(*) FILTER (WHERE status = 'repair') as repair,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                    COUNT(*) FILTER (WHERE next_calibration_date < NOW()) as calibration_overdue,
                    COUNT(*) FILTER (WHERE next_maintenance_date < NOW()) as maintenance_overdue
                FROM equipment e
                WHERE e.is_deleted = false
            `;
            const summary = await db.query(summaryQuery);

            return {
                data: result.rows,
                summary: summary.rows[0],
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAllEquipment', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get equipment by status
     */
    async getEquipmentByStatus(technicianId, status, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT e.*, d.name as department_name
                FROM equipment e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.status = $1 AND e.is_deleted = false
                ORDER BY e.name ASC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM equipment
                WHERE status = $1 AND is_deleted = false
            `;
            const count = await db.query(countQuery, [status]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getEquipmentByStatus', { error: error.message, technicianId, status });
            throw error;
        }
    },

    /**
     * Get calibration due equipment
     */
    async getCalibrationDueEquipment(technicianId, days = 30) {
        try {
            const query = `
                SELECT e.*, d.name as department_name,
                       EXTRACT(DAY FROM (e.next_calibration_date - NOW())) as days_until_calibration,
                       CASE 
                           WHEN e.next_calibration_date < NOW() THEN 'overdue'
                           WHEN e.next_calibration_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                           WHEN e.next_calibration_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                           ELSE 'notice'
                       END as urgency
                FROM equipment e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.next_calibration_date <= NOW() + INTERVAL '${days} days'
                    AND e.is_deleted = false
                ORDER BY e.next_calibration_date ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCalibrationDueEquipment', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get equipment by ID
     */
    async getEquipmentById(technicianId, equipmentId) {
        try {
            const query = `
                SELECT e.*, 
                       d.name as department_name,
                       d.id as department_id,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', m.id,
                                   'maintenance_date', m.maintenance_date,
                                   'maintenance_type', m.maintenance_type,
                                   'description', m.description,
                                   'performed_by', CONCAT(emp.first_name, ' ', emp.last_name),
                                   'cost', m.cost,
                                   'notes', m.notes
                               ) ORDER BY m.maintenance_date DESC
                           )
                           FROM maintenance_records m
                           LEFT JOIN employees emp ON m.performed_by = emp.id
                           WHERE m.equipment_id = e.id
                           LIMIT 10
                       ) as recent_maintenance,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', c.id,
                                   'calibration_date', c.calibration_date,
                                   'next_calibration_date', c.next_calibration_date,
                                   'certificate_number', c.certificate_number,
                                   'performed_by', CONCAT(emp.first_name, ' ', emp.last_name)
                               ) ORDER BY c.calibration_date DESC
                           )
                           FROM calibration_records c
                           LEFT JOIN employees emp ON c.performed_by = emp.id
                           WHERE c.equipment_id = e.id
                           LIMIT 10
                       ) as recent_calibration
                FROM equipment e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.id = $1 AND e.is_deleted = false
            `;

            const result = await db.query(query, [equipmentId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getEquipmentById', { error: error.message, technicianId, equipmentId });
            throw error;
        }
    },

    /**
     * Update equipment status
     */
    async updateEquipmentStatus(technicianId, equipmentId, status, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE equipment 
                SET status = $1,
                    status_reason = $2,
                    status_updated_by = $3,
                    status_updated_at = $4,
                    estimated_repair_date = $5,
                    updated_at = NOW()
                WHERE id = $6
                RETURNING *
            `;

            const values = [
                status,
                data.reason || null,
                data.updated_by,
                data.updated_at,
                data.estimated_repair_date || null,
                equipmentId
            ];

            const result = await client.query(query, values);

            // Log status change
            await client.query(`
                INSERT INTO equipment_status_history (
                    id, equipment_id, status, changed_by, changed_at, reason
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5
                )
            `, [equipmentId, status, technicianId, data.updated_at, data.reason]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Log calibration
     */
    async logCalibration(technicianId, calibrationData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO calibration_records (
                    id, equipment_id, calibration_date, next_calibration_date,
                    calibrated_by, certificate_number, notes, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
                ) RETURNING *
            `;

            const values = [
                calibrationData.equipment_id,
                calibrationData.calibration_date,
                calibrationData.next_calibration_date,
                calibrationData.calibrated_by,
                calibrationData.certificate_number,
                calibrationData.notes
            ];

            const result = await client.query(query, values);

            // Update equipment with next calibration date
            await client.query(`
                UPDATE equipment 
                SET last_calibration_date = $1,
                    next_calibration_date = $2,
                    status = 'operational',
                    updated_at = NOW()
                WHERE id = $3
            `, [
                calibrationData.calibration_date,
                calibrationData.next_calibration_date,
                calibrationData.equipment_id
            ]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Schedule maintenance
     */
    async scheduleMaintenance(technicianId, equipmentId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO maintenance_schedule (
                    id, equipment_id, maintenance_date, maintenance_type,
                    description, technician, estimated_duration,
                    scheduled_by, scheduled_at, status, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', NOW()
                ) RETURNING *
            `;

            const values = [
                equipmentId,
                data.maintenance_date,
                data.maintenance_type,
                data.description,
                data.technician,
                data.estimated_duration,
                data.scheduled_by,
                data.scheduled_at
            ];

            const result = await client.query(query, values);

            // Update equipment status
            await client.query(`
                UPDATE equipment 
                SET status = 'maintenance',
                    next_maintenance_date = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [data.maintenance_date, equipmentId]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Complete maintenance
     */
    async completeMaintenance(technicianId, equipmentId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Update maintenance record
            await client.query(`
                UPDATE maintenance_schedule
                SET status = 'completed',
                    completed_at = $1,
                    completion_notes = $2,
                    performed_by = $3,
                    updated_at = NOW()
                WHERE id = $4
            `, [
                data.completed_at,
                data.completion_notes,
                data.completed_by,
                data.maintenance_id
            ]);

            // Add to maintenance history
            const historyQuery = `
                INSERT INTO maintenance_records (
                    id, equipment_id, maintenance_date, maintenance_type,
                    description, performed_by, cost, notes, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
                ) RETURNING *
            `;

            const historyValues = [
                equipmentId,
                data.completed_at,
                data.maintenance_type || 'scheduled',
                data.completion_notes,
                data.completed_by,
                data.cost || 0,
                data.completion_notes
            ];

            const history = await client.query(historyQuery, historyValues);

            // Update equipment status
            await client.query(`
                UPDATE equipment 
                SET status = $1,
                    last_maintenance_date = $2,
                    next_maintenance_date = $3,
                    updated_at = NOW()
                WHERE id = $4
            `, [
                data.status_after,
                data.completed_at,
                data.next_maintenance_date,
                equipmentId
            ]);

            await db.commitTransaction(client);

            return history.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get equipment usage
     */
    async getEquipmentUsage(technicianId, options = {}) {
        try {
            const { from_date, to_date, equipment_id } = options;

            let query = `
                SELECT 
                    e.id, e.name, e.model,
                    COUNT(u.id) as usage_count,
                    SUM(u.duration_minutes) as total_duration_minutes,
                    AVG(u.duration_minutes) as avg_duration,
                    MAX(u.used_at) as last_used,
                    json_agg(
                        json_build_object(
                            'id', u.id,
                            'used_at', u.used_at,
                            'duration', u.duration_minutes,
                            'test_id', u.test_id,
                            'used_by', CONCAT(emp.first_name, ' ', emp.last_name)
                        ) ORDER BY u.used_at DESC
                    ) FILTER (WHERE u.id IS NOT NULL) as usage_details
                FROM equipment e
                LEFT JOIN equipment_usage u ON e.id = u.equipment_id
                LEFT JOIN employees emp ON u.used_by = emp.id
                WHERE e.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (from_date && to_date) {
                query += ` AND u.used_at BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
                values.push(from_date, to_date);
                paramIndex += 2;
            }

            if (equipment_id) {
                query += ` AND e.id = $${paramIndex}`;
                values.push(equipment_id);
                paramIndex++;
            }

            query += ` GROUP BY e.id
                      ORDER BY usage_count DESC`;

            const result = await db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error in getEquipmentUsage', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Log equipment usage
     */
    async logEquipmentUsage(technicianId, equipmentId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO equipment_usage (
                    id, equipment_id, usage_type, duration_minutes,
                    test_id, notes, used_by, used_at, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
                ) RETURNING *
            `;

            const values = [
                equipmentId,
                data.usage_type,
                data.duration_minutes,
                data.test_id || null,
                data.notes || null,
                data.used_by,
                data.used_at
            ];

            const result = await client.query(query, values);

            // Update equipment usage stats
            await client.query(`
                UPDATE equipment 
                SET total_usage_hours = total_usage_hours + $1,
                    total_usage_count = total_usage_count + 1,
                    last_used_date = $2,
                    last_used_by = $3,
                    updated_at = NOW()
                WHERE id = $4
            `, [
                (data.duration_minutes || 0) / 60,
                data.used_at,
                data.used_by,
                equipmentId
            ]);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get maintenance history
     */
    async getMaintenanceHistory(technicianId, equipmentId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT m.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as performed_by_name
                FROM maintenance_records m
                LEFT JOIN employees e ON m.performed_by = e.id
                WHERE m.equipment_id = $1
                ORDER BY m.maintenance_date DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [equipmentId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM maintenance_records
                WHERE equipment_id = $1
            `;
            const count = await db.query(countQuery, [equipmentId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getMaintenanceHistory', { error: error.message, technicianId, equipmentId });
            throw error;
        }
    },

    /**
     * Get calibration history
     */
    async getCalibrationHistory(technicianId, equipmentId) {
        try {
            const query = `
                SELECT c.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as calibrated_by_name
                FROM calibration_records c
                LEFT JOIN employees e ON c.calibrated_by = e.id
                WHERE c.equipment_id = $1
                ORDER BY c.calibration_date DESC
            `;

            const result = await db.query(query, [equipmentId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCalibrationHistory', { error: error.message, technicianId, equipmentId });
            throw error;
        }
    },

    /**
     * Generate equipment report
     */
    async generateEquipmentReport(technicianId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    e.name, e.model, e.serial_number,
                    e.category, e.status,
                    d.name as department,
                    e.last_calibration_date, e.next_calibration_date,
                    e.last_maintenance_date, e.next_maintenance_date,
                    e.total_usage_hours, e.total_usage_count,
                    CASE 
                        WHEN e.next_calibration_date < NOW() THEN 'Overdue'
                        WHEN e.next_calibration_date <= NOW() + INTERVAL '30 days' THEN 'Due Soon'
                        ELSE 'OK'
                    END as calibration_status,
                    CASE 
                        WHEN e.next_maintenance_date < NOW() THEN 'Overdue'
                        WHEN e.next_maintenance_date <= NOW() + INTERVAL '30 days' THEN 'Due Soon'
                        ELSE 'OK'
                    END as maintenance_status
                FROM equipment e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.status) {
                query += ` AND e.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            if (filters.category) {
                query += ` AND e.category = $${paramIndex}`;
                values.push(filters.category);
                paramIndex++;
            }

            query += ` ORDER BY e.name ASC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual PDF/CSV generation
            return result.rows;
        } catch (error) {
            logger.error('Error in generateEquipmentReport', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Export equipment
     */
    async exportEquipment(technicianId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    e.name, e.model, e.serial_number,
                    e.category, e.manufacturer,
                    e.status,
                    d.name as department,
                    e.location, e.room_number,
                    e.purchase_date, e.purchase_cost,
                    e.warranty_expiry,
                    e.last_calibration_date, e.next_calibration_date,
                    e.last_maintenance_date, e.next_maintenance_date,
                    e.total_usage_hours, e.total_usage_count
                FROM equipment e
                LEFT JOIN departments d ON e.department_id = d.id
                WHERE e.is_deleted = false
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.status) {
                query += ` AND e.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            query += ` ORDER BY e.name ASC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportEquipment', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get equipment alerts
     */
    async getEquipmentAlerts(technicianId) {
        try {
            const query = `
                SELECT 
                    'calibration_due' as type,
                    e.id,
                    e.name,
                    e.next_calibration_date,
                    EXTRACT(DAY FROM (e.next_calibration_date - NOW())) as days_until_due,
                    CASE 
                        WHEN e.next_calibration_date < NOW() THEN 'critical'
                        WHEN e.next_calibration_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                        WHEN e.next_calibration_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                        ELSE 'info'
                    END as severity
                FROM equipment e
                WHERE e.next_calibration_date <= NOW() + INTERVAL '30 days'
                    AND e.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'maintenance_due' as type,
                    e.id,
                    e.name,
                    e.next_maintenance_date,
                    EXTRACT(DAY FROM (e.next_maintenance_date - NOW())) as days_until_due,
                    CASE 
                        WHEN e.next_maintenance_date < NOW() THEN 'critical'
                        WHEN e.next_maintenance_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                        WHEN e.next_maintenance_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                        ELSE 'info'
                    END as severity
                FROM equipment e
                WHERE e.next_maintenance_date <= NOW() + INTERVAL '30 days'
                    AND e.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'out_of_service' as type,
                    e.id,
                    e.name,
                    e.status_updated_at,
                    0 as days_until_due,
                    'critical' as severity
                FROM equipment e
                WHERE e.status IN ('out_of_service', 'repair')
                    AND e.is_deleted = false
                
                ORDER BY severity DESC, days_until_due ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getEquipmentAlerts', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Acknowledge equipment alert
     */
    async acknowledgeEquipmentAlert(technicianId, alertId, data) {
        try {
            const query = `
                INSERT INTO equipment_alerts_ack (
                    id, alert_id, acknowledged_by, acknowledged_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4
                ) RETURNING *
            `;

            const values = [
                alertId,
                data.acknowledged_by,
                data.acknowledged_at,
                data.notes
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in acknowledgeEquipmentAlert', { error: error.message, technicianId, alertId });
            throw error;
        }
    },

    /**
     * Upload equipment document
     */
    async uploadEquipmentDocument(technicianId, equipmentId, documentData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO equipment_documents (
                    id, equipment_id, document_type, document_name,
                    document_url, expiry_date, notes, uploaded_by,
                    uploaded_at, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
                ) RETURNING *
            `;

            const values = [
                equipmentId,
                documentData.document_type,
                documentData.document_name,
                documentData.document_url,
                documentData.expiry_date || null,
                documentData.notes || null,
                documentData.uploaded_by,
                documentData.uploaded_at
            ];

            const result = await client.query(query, values);

            await db.commitTransaction(client);

            return result.rows[0];
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get equipment documents
     */
    async getEquipmentDocuments(technicianId, equipmentId) {
        try {
            const query = `
                SELECT ed.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as uploaded_by_name
                FROM equipment_documents ed
                LEFT JOIN employees e ON ed.uploaded_by = e.id
                WHERE ed.equipment_id = $1
                ORDER BY ed.uploaded_at DESC
            `;

            const result = await db.query(query, [equipmentId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getEquipmentDocuments', { error: error.message, technicianId, equipmentId });
            throw error;
        }
    },

    /**
     * Delete equipment document
     */
    async deleteEquipmentDocument(technicianId, equipmentId, documentId) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                DELETE FROM equipment_documents
                WHERE id = $1 AND equipment_id = $2
                RETURNING id
            `;

            const result = await client.query(query, [documentId, equipmentId]);

            if (result.rows.length === 0) {
                throw new Error('Document not found');
            }

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