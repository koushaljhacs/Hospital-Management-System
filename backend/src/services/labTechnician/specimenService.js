/**
 * ======================================================================
 * FILE: backend/src/services/labTechnician/specimenService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician specimen service - Handles business logic for specimens.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-39] Sample collection to result < 24 hours
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const specimenService = {
    /**
     * Get all specimens
     */
    async getAllSpecimens(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20, status, specimen_type, patient_id, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT s.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       to.order_number,
                       CONCAT(e.first_name, ' ', e.last_name) as collected_by_name,
                       CASE 
                           WHEN s.expiry_date < NOW() THEN 'expired'
                           WHEN s.expiry_date <= NOW() + INTERVAL '7 days' THEN 'expiring_soon'
                           ELSE 'valid'
                       END as expiry_status,
                       EXTRACT(DAY FROM (s.expiry_date - NOW())) as days_until_expiry
                FROM specimens s
                JOIN patients p ON s.patient_id = p.id
                JOIN test_orders to ON s.test_order_id = to.id
                LEFT JOIN employees e ON s.collected_by = e.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND s.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (specimen_type) {
                query += ` AND s.specimen_type = $${paramIndex}`;
                values.push(specimen_type);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND s.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND s.collection_date >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND s.collection_date <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY s.collection_date DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM specimens s
                WHERE 1=1
                ${status ? 'AND s.status = $1' : ''}
            `;
            const countValues = status ? [status] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_specimens,
                    COUNT(*) FILTER (WHERE status = 'collected') as collected,
                    COUNT(*) FILTER (WHERE status = 'received') as received,
                    COUNT(*) FILTER (WHERE status = 'processed') as processed,
                    COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                    COUNT(*) FILTER (WHERE status = 'disposed') as disposed,
                    COUNT(*) FILTER (WHERE expiry_date < NOW()) as expired
                FROM specimens s
                WHERE 1=1
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
            logger.error('Error in getAllSpecimens', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get specimens by status
     */
    async getSpecimensByStatus(technicianId, status, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT s.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       to.order_number
                FROM specimens s
                JOIN patients p ON s.patient_id = p.id
                JOIN test_orders to ON s.test_order_id = to.id
                WHERE s.status = $1
                ORDER BY s.collection_date DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM specimens
                WHERE status = $1
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
            logger.error('Error in getSpecimensByStatus', { error: error.message, technicianId, status });
            throw error;
        }
    },

    /**
     * Get specimen by ID
     */
    async getSpecimenById(technicianId, specimenId) {
        try {
            const query = `
                SELECT s.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       to.id as order_id,
                       to.order_number,
                       to.collection_date as order_collection_date,
                       CONCAT(e_collect.first_name, ' ', e_collect.last_name) as collected_by_name,
                       CONCAT(e_receive.first_name, ' ', e_receive.last_name) as received_by_name,
                       CONCAT(e_process.first_name, ' ', e_process.last_name) as processed_by_name,
                       CONCAT(e_reject.first_name, ' ', e_reject.last_name) as rejected_by_name,
                       CONCAT(e_dispose.first_name, ' ', e_dispose.last_name) as disposed_by_name,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', sh.id,
                                   'status', sh.status,
                                   'changed_at', sh.changed_at,
                                   'changed_by', CONCAT(e.first_name, ' ', e.last_name),
                                   'notes', sh.notes
                               ) ORDER BY sh.changed_at DESC
                           )
                           FROM specimen_history sh
                           LEFT JOIN employees e ON sh.changed_by = e.id
                           WHERE sh.specimen_id = s.id
                       ) as history
                FROM specimens s
                JOIN patients p ON s.patient_id = p.id
                JOIN test_orders to ON s.test_order_id = to.id
                LEFT JOIN employees e_collect ON s.collected_by = e_collect.id
                LEFT JOIN employees e_receive ON s.received_by = e_receive.id
                LEFT JOIN employees e_process ON s.processed_by = e_process.id
                LEFT JOIN employees e_reject ON s.rejected_by = e_reject.id
                LEFT JOIN employees e_dispose ON s.disposed_by = e_dispose.id
                WHERE s.id = $1
            `;

            const result = await db.query(query, [specimenId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getSpecimenById', { error: error.message, technicianId, specimenId });
            throw error;
        }
    },

    /**
     * Generate specimen code
     */
    async generateSpecimenCode(specimenType) {
        try {
            const prefix = specimenType.substring(0, 2).toUpperCase();
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            
            const result = await db.query(`
                SELECT COUNT(*) as count
                FROM specimens
                WHERE specimen_code LIKE $1
            `, [`${prefix}${year}${month}${day}%`]);

            const count = parseInt(result.rows[0].count) + 1;
            return `${prefix}${year}${month}${day}${count.toString().padStart(4, '0')}`;
        } catch (error) {
            logger.error('Error in generateSpecimenCode', { error: error.message });
            throw error;
        }
    },

    /**
     * Register new specimen
     */
    async registerSpecimen(technicianId, specimenData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if specimen code already exists
            if (specimenData.specimen_code) {
                const checkQuery = `
                    SELECT id FROM specimens 
                    WHERE specimen_code = $1
                `;
                const check = await client.query(checkQuery, [specimenData.specimen_code]);
                
                if (check.rows.length > 0) {
                    throw new Error('Specimen code already exists');
                }
            }

            const query = `
                INSERT INTO specimens (
                    id, specimen_code, specimen_type, specimen_name,
                    collection_date, collected_by, collection_site,
                    collection_method, collection_notes, patient_id,
                    test_order_id, volume, volume_unit, container_type,
                    preservative, storage_conditions, status,
                    created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
                    $9, $10, $11, $12, $13, $14, $15, 'collected',
                    NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                specimenData.specimen_code,
                specimenData.specimen_type,
                specimenData.specimen_name,
                specimenData.collection_date,
                specimenData.collected_by,
                specimenData.collection_site || null,
                specimenData.collection_method || null,
                specimenData.collection_notes || null,
                specimenData.patient_id,
                specimenData.test_order_id,
                specimenData.volume || null,
                specimenData.volume_unit || null,
                specimenData.container_type || null,
                specimenData.preservative || null,
                specimenData.storage_conditions || null
            ];

            const result = await client.query(query, values);

            // Log in history
            await client.query(`
                INSERT INTO specimen_history (
                    id, specimen_id, status, changed_by, changed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'collected', $2, $3, 'Specimen registered'
                )
            `, [result.rows[0].id, technicianId, specimenData.collection_date]);

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
     * Update specimen
     */
    async updateSpecimen(technicianId, specimenId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'specimen_name', 'volume', 'volume_unit',
                'container_type', 'preservative', 'storage_conditions',
                'location', 'freezer_id', 'rack_number',
                'shelf_number', 'box_number', 'position'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (setClause.length === 0) {
                throw new Error('No valid fields to update');
            }

            setClause.push(`updated_at = NOW()`);
            values.push(specimenId);

            const query = `
                UPDATE specimens 
                SET ${setClause.join(', ')}
                WHERE id = $${paramIndex}
                RETURNING *
            `;

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
     * Update specimen condition
     */
    async updateSpecimenCondition(technicianId, specimenId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE specimens 
                SET condition = $1,
                    condition_notes = $2,
                    condition_updated_by = $3,
                    condition_updated_at = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const values = [
                data.condition,
                data.notes,
                data.updated_by,
                data.updated_at,
                specimenId
            ];

            const result = await client.query(query, values);

            // Log condition change
            await client.query(`
                INSERT INTO specimen_history (
                    id, specimen_id, status, changed_by, changed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'condition_updated', $2, $3, 
                    CONCAT('Condition updated to: ', $4)
                )
            `, [specimenId, technicianId, data.updated_at, data.condition]);

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
     * Reject specimen
     */
    async rejectSpecimen(technicianId, specimenId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if specimen can be rejected
            const checkQuery = `SELECT status FROM specimens WHERE id = $1`;
            const check = await client.query(checkQuery, [specimenId]);
            
            if (check.rows.length === 0) {
                throw new Error('Specimen not found');
            }

            if (check.rows[0].status === 'processed') {
                throw new Error('Cannot reject processed specimen');
            }

            const query = `
                UPDATE specimens 
                SET status = 'rejected',
                    rejection_reason = $1,
                    rejection_notes = $2,
                    rejected_by = $3,
                    rejected_at = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const values = [
                data.rejection_reason,
                data.rejection_notes,
                data.rejected_by,
                data.rejected_at,
                specimenId
            ];

            const result = await client.query(query, values);

            // Log rejection
            await client.query(`
                INSERT INTO specimen_history (
                    id, specimen_id, status, changed_by, changed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'rejected', $2, $3, $4
                )
            `, [specimenId, technicianId, data.rejected_at, data.rejection_reason]);

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
     * Dispose specimen
     */
    async disposeSpecimen(technicianId, specimenId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE specimens 
                SET status = 'disposed',
                    disposal_method = $1,
                    disposal_notes = $2,
                    disposed_by = $3,
                    disposed_at = $4,
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const values = [
                data.disposal_method,
                data.disposal_notes,
                data.disposed_by,
                data.disposed_at,
                specimenId
            ];

            const result = await client.query(query, values);

            // Log disposal
            await client.query(`
                INSERT INTO specimen_history (
                    id, specimen_id, status, changed_by, changed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'disposed', $2, $3, 
                    CONCAT('Disposed via: ', $4)
                )
            `, [specimenId, technicianId, data.disposed_at, data.disposal_method]);

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
     * Track specimens
     */
    async trackSpecimens(technicianId, filters = {}) {
        try {
            let query = `
                SELECT s.id, s.specimen_code, s.specimen_type,
                       s.status, s.storage_location, s.freezer_id,
                       s.rack_number, s.shelf_number, s.box_number,
                       s.position, s.condition,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       to.order_number
                FROM specimens s
                JOIN patients p ON s.patient_id = p.id
                JOIN test_orders to ON s.test_order_id = to.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.location) {
                query += ` AND s.storage_location = $${paramIndex}`;
                values.push(filters.location);
                paramIndex++;
            }

            if (filters.status) {
                query += ` AND s.status = $${paramIndex}`;
                values.push(filters.status);
                paramIndex++;
            }

            query += ` ORDER BY s.storage_location, s.freezer_id, s.rack_number`;

            const result = await db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error in trackSpecimens', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get specimen history
     */
    async getSpecimenHistory(technicianId, specimenId) {
        try {
            const query = `
                SELECT sh.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as changed_by_name
                FROM specimen_history sh
                LEFT JOIN employees e ON sh.changed_by = e.id
                WHERE sh.specimen_id = $1
                ORDER BY sh.changed_at DESC
            `;

            const result = await db.query(query, [specimenId]);
            
            if (result.rows.length === 0) {
                const specimen = await this.getSpecimenById(technicianId, specimenId);
                if (!specimen) {
                    return null;
                }
            }

            return result.rows;
        } catch (error) {
            logger.error('Error in getSpecimenHistory', { error: error.message, technicianId, specimenId });
            throw error;
        }
    },

    /**
     * Transfer specimen
     */
    async transferSpecimen(technicianId, specimenId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get current location
            const currentQuery = `SELECT storage_location FROM specimens WHERE id = $1`;
            const current = await client.query(currentQuery, [specimenId]);
            
            if (current.rows.length === 0) {
                throw new Error('Specimen not found');
            }

            const query = `
                UPDATE specimens 
                SET storage_location = $1,
                    freezer_id = $2,
                    rack_number = $3,
                    shelf_number = $4,
                    box_number = $5,
                    position = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING *
            `;

            const values = [
                data.to_location,
                data.freezer_id || null,
                data.rack_number || null,
                data.shelf_number || null,
                data.box_number || null,
                data.position || null,
                specimenId
            ];

            const result = await client.query(query, values);

            // Log transfer
            await client.query(`
                INSERT INTO specimen_history (
                    id, specimen_id, status, changed_by, changed_at, notes
                ) VALUES (
                    gen_random_uuid(), $1, 'transferred', $2, $3, 
                    CONCAT('Transferred from ', $4, ' to ', $5)
                )
            `, [
                specimenId,
                data.transferred_by,
                data.transferred_at,
                current.rows[0].storage_location || 'unknown',
                data.to_location
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
     * Bulk update specimens
     */
    async bulkUpdateSpecimens(technicianId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const results = {
                success: [],
                failed: []
            };

            for (const update of updates) {
                try {
                    if (update.type === 'condition') {
                        const result = await this.updateSpecimenCondition(
                            technicianId,
                            update.specimen_id,
                            {
                                condition: update.condition,
                                notes: update.notes,
                                updated_by: technicianId,
                                updated_at: new Date()
                            }
                        );
                        results.success.push({
                            specimen_id: update.specimen_id,
                            type: 'condition',
                            condition: update.condition
                        });
                    } else if (update.type === 'transfer') {
                        const result = await this.transferSpecimen(
                            technicianId,
                            update.specimen_id,
                            {
                                to_location: update.to_location,
                                freezer_id: update.freezer_id,
                                rack_number: update.rack_number,
                                transferred_by: technicianId,
                                transferred_at: new Date(),
                                reason: update.reason
                            }
                        );
                        results.success.push({
                            specimen_id: update.specimen_id,
                            type: 'transfer',
                            to_location: update.to_location
                        });
                    }
                } catch (err) {
                    results.failed.push({
                        specimen_id: update.specimen_id,
                        type: update.type,
                        error: err.message
                    });
                }
            }

            await db.commitTransaction(client);

            return results;
        } catch (error) {
            await db.rollbackTransaction(client);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Get specimen statistics
     */
    async getSpecimenStatistics(technicianId, period = 'day') {
        try {
            let interval;
            switch(period) {
                case 'day':
                    interval = "INTERVAL '1 day'";
                    break;
                case 'week':
                    interval = "INTERVAL '7 days'";
                    break;
                case 'month':
                    interval = "INTERVAL '30 days'";
                    break;
                default:
                    interval = "INTERVAL '30 days'";
            }

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(collection_date) as date,
                        COUNT(*) as total_collected,
                        COUNT(*) FILTER (WHERE status = 'received') as received,
                        COUNT(*) FILTER (WHERE status = 'processed') as processed,
                        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
                        COUNT(*) FILTER (WHERE condition = 'hemolyzed') as hemolyzed,
                        COUNT(*) FILTER (WHERE condition = 'clotted') as clotted,
                        COUNT(*) FILTER (WHERE condition = 'insufficient') as insufficient
                    FROM specimens
                    WHERE collection_date > NOW() - ${interval}
                    GROUP BY DATE(collection_date)
                )
                SELECT 
                    json_agg(daily_stats.* ORDER BY date) as daily,
                    SUM(total_collected) as total_collected,
                    SUM(received) as total_received,
                    SUM(processed) as total_processed,
                    SUM(rejected) as total_rejected,
                    (SUM(rejected)::float / NULLIF(SUM(total_collected), 0) * 100)::numeric(5,2) as rejection_rate
                FROM daily_stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getSpecimenStatistics', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get specimen by barcode
     */
    async getSpecimenByBarcode(technicianId, barcode) {
        try {
            const query = `
                SELECT s.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       to.order_number
                FROM specimens s
                JOIN patients p ON s.patient_id = p.id
                JOIN test_orders to ON s.test_order_id = to.id
                WHERE s.specimen_code = $1
            `;

            const result = await db.query(query, [barcode]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getSpecimenByBarcode', { error: error.message, technicianId, barcode });
            throw error;
        }
    },

    /**
     * Generate specimen label
     */
    async generateSpecimenLabel(technicianId, specimenId) {
        try {
            const specimen = await this.getSpecimenById(technicianId, specimenId);
            
            if (!specimen) {
                return null;
            }

            // TODO: Implement actual PDF label generation
            // For now, return JSON
            return Buffer.from(JSON.stringify({
                specimen_code: specimen.specimen_code,
                specimen_type: specimen.specimen_type,
                patient_name: `${specimen.patient_first_name} ${specimen.patient_last_name}`,
                collection_date: specimen.collection_date,
                order_number: specimen.order_number,
                barcode: specimen.specimen_code
            }, null, 2));
        } catch (error) {
            logger.error('Error in generateSpecimenLabel', { error: error.message, technicianId, specimenId });
            throw error;
        }
    },

    /**
     * Generate multiple labels
     */
    async generateMultipleLabels(technicianId, specimenIds) {
        try {
            const labels = [];
            for (const id of specimenIds) {
                const label = await this.generateSpecimenLabel(technicianId, id);
                if (label) {
                    labels.push(JSON.parse(label.toString()));
                }
            }

            // TODO: Combine into single PDF
            return Buffer.from(JSON.stringify(labels, null, 2));
        } catch (error) {
            logger.error('Error in generateMultipleLabels', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Record quality check
     */
    async recordQualityCheck(technicianId, specimenId, data) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO specimen_quality_checks (
                    id, specimen_id, passed, notes,
                    checked_by, checked_at, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
                ) RETURNING *
            `;

            const values = [
                specimenId,
                data.passed,
                data.notes,
                data.checked_by,
                data.checked_at
            ];

            const result = await client.query(query, values);

            // If failed, update specimen status
            if (!data.passed) {
                await client.query(`
                    UPDATE specimens 
                    SET status = 'rejected',
                        rejection_reason = 'Failed quality check',
                        rejected_by = $1,
                        rejected_at = $2,
                        updated_at = NOW()
                    WHERE id = $3
                `, [technicianId, data.checked_at, specimenId]);
            }

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
     * Get quality pending specimens
     */
    async getQualityPendingSpecimens(technicianId) {
        try {
            const query = `
                SELECT s.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name
                FROM specimens s
                JOIN patients p ON s.patient_id = p.id
                WHERE s.quality_check_required = true
                    AND s.quality_checked = false
                    AND s.status != 'rejected'
                ORDER BY s.collection_date ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getQualityPendingSpecimens', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Add specimen note
     */
    async addSpecimenNote(technicianId, specimenId, noteData) {
        try {
            const query = `
                INSERT INTO specimen_notes (
                    id, specimen_id, note, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4
                ) RETURNING *
            `;

            const values = [
                specimenId,
                noteData.note,
                noteData.created_by,
                noteData.created_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in addSpecimenNote', { error: error.message, technicianId, specimenId });
            throw error;
        }
    },

    /**
     * Get specimen notes
     */
    async getSpecimenNotes(technicianId, specimenId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT n.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as created_by_name
                FROM specimen_notes n
                LEFT JOIN employees e ON n.created_by = e.id
                WHERE n.specimen_id = $1
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [specimenId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM specimen_notes
                WHERE specimen_id = $1
            `;
            const count = await db.query(countQuery, [specimenId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getSpecimenNotes', { error: error.message, technicianId, specimenId });
            throw error;
        }
    }
};

module.exports = specimenService;