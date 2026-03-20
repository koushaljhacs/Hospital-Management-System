/**
 * ======================================================================
 * FILE: backend/src/services/labTechnician/qcService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician quality control service - Handles QC records and statistics.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const qcService = {
    /**
     * Get all QC records
     */
    async getAllQCRecords(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20, status, test_id, performed_by, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT qc.*, 
                       lt.test_name, lt.test_code, lt.category,
                       CONCAT(e.first_name, ' ', e.last_name) as performed_by_name,
                       CASE 
                           WHEN qc.control_expiry < NOW() THEN 'expired'
                           WHEN qc.control_expiry <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
                           ELSE 'valid'
                       END as lot_status
                FROM quality_control qc
                JOIN lab_tests lt ON qc.test_id = lt.id
                LEFT JOIN employees e ON qc.performed_by = e.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND qc.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (test_id) {
                query += ` AND qc.test_id = $${paramIndex}`;
                values.push(test_id);
                paramIndex++;
            }

            if (performed_by) {
                query += ` AND qc.performed_by = $${paramIndex}`;
                values.push(performed_by);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND qc.performed_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND qc.performed_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY qc.performed_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM quality_control qc
                WHERE 1=1
                ${test_id ? 'AND qc.test_id = $1' : ''}
            `;
            const countValues = test_id ? [test_id] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_records,
                    COUNT(*) FILTER (WHERE status = 'passed') as passed,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed,
                    COUNT(*) FILTER (WHERE status = 'borderline') as borderline,
                    (COUNT(*) FILTER (WHERE status = 'passed')::float / NULLIF(COUNT(*), 0) * 100)::numeric(5,2) as pass_rate
                FROM quality_control qc
                WHERE 1=1
                ${test_id ? 'AND qc.test_id = $1' : ''}
            `;
            const summary = await db.query(summaryQuery, countValues);

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
            logger.error('Error in getAllQCRecords', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Add QC record
     */
    async addQCRecord(technicianId, qcData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO quality_control (
                    id, test_id, control_type, control_lot,
                    control_expiry, result, status, performed_by,
                    performed_at, notes, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
                ) RETURNING *
            `;

            const values = [
                qcData.test_id,
                qcData.control_type,
                qcData.control_lot,
                qcData.control_expiry,
                qcData.result,
                qcData.status,
                qcData.performed_by,
                qcData.performed_at,
                qcData.notes || null
            ];

            const result = await client.query(query, values);

            // If QC failed, create alert
            if (qcData.status === 'failed') {
                await client.query(`
                    INSERT INTO qc_alerts (
                        id, qc_id, test_id, severity,
                        message, created_at, status
                    ) VALUES (
                        gen_random_uuid(), $1, $2, 'critical',
                        $3, NOW(), 'active'
                    )
                `, [
                    result.rows[0].id,
                    qcData.test_id,
                    `QC failed for test ${qcData.test_id} with lot ${qcData.control_lot}`
                ]);
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
     * Get QC record by ID
     */
    async getQCRecordById(technicianId, recordId) {
        try {
            const query = `
                SELECT qc.*, 
                       lt.test_name, lt.test_code, lt.category,
                       lt.normal_range, lt.unit,
                       CONCAT(e.first_name, ' ', e.last_name) as performed_by_name,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', a.id,
                                   'severity', a.severity,
                                   'message', a.message,
                                   'created_at', a.created_at,
                                   'acknowledged', a.acknowledged,
                                   'acknowledged_by', CONCAT(emp.first_name, ' ', emp.last_name),
                                   'acknowledged_at', a.acknowledged_at
                               )
                           )
                           FROM qc_alerts a
                           LEFT JOIN employees emp ON a.acknowledged_by = emp.id
                           WHERE a.qc_id = qc.id
                       ) as alerts
                FROM quality_control qc
                JOIN lab_tests lt ON qc.test_id = lt.id
                LEFT JOIN employees e ON qc.performed_by = e.id
                WHERE qc.id = $1
            `;

            const result = await db.query(query, [recordId]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getQCRecordById', { error: error.message, technicianId, recordId });
            throw error;
        }
    },

    /**
     * Update QC record
     */
    async updateQCRecord(technicianId, recordId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = ['result', 'status', 'notes'];

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
            values.push(recordId);

            const query = `
                UPDATE quality_control 
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
     * Delete QC record
     */
    async deleteQCRecord(technicianId, recordId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                UPDATE quality_control 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    deletion_reason = $2
                WHERE id = $3
                RETURNING id
            `;

            const result = await client.query(query, [technicianId, reason, recordId]);

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
     * Get QC statistics
     */
    async getQCStatistics(technicianId, options = {}) {
        try {
            const { from_date, to_date, test_id, period = 'month' } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND performed_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else if (period === 'day') {
                dateFilter = "AND performed_at > NOW() - INTERVAL '1 day'";
            } else if (period === 'week') {
                dateFilter = "AND performed_at > NOW() - INTERVAL '7 days'";
            } else if (period === 'month') {
                dateFilter = "AND performed_at > NOW() - INTERVAL '30 days'";
            } else if (period === 'quarter') {
                dateFilter = "AND performed_at > NOW() - INTERVAL '90 days'";
            }

            let testFilter = '';
            if (test_id) {
                testFilter = `AND test_id = '${test_id}'`;
            }

            const query = `
                WITH daily_stats AS (
                    SELECT 
                        DATE(performed_at) as date,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'passed') as passed,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed,
                        COUNT(*) FILTER (WHERE status = 'borderline') as borderline
                    FROM quality_control
                    WHERE 1=1
                        ${dateFilter}
                        ${testFilter}
                    GROUP BY DATE(performed_at)
                ),
                test_stats AS (
                    SELECT 
                        test_id,
                        lt.test_name,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'passed') as passed,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed,
                        (COUNT(*) FILTER (WHERE status = 'passed')::float / NULLIF(COUNT(*), 0) * 100)::numeric(5,2) as pass_rate
                    FROM quality_control qc
                    JOIN lab_tests lt ON qc.test_id = lt.id
                    WHERE 1=1
                        ${dateFilter}
                    GROUP BY test_id, lt.test_name
                )
                SELECT 
                    (SELECT json_agg(daily_stats.* ORDER BY date) FROM daily_stats) as daily,
                    (SELECT json_agg(test_stats.* ORDER BY pass_rate) FROM test_stats) as by_test,
                    (
                        SELECT 
                            json_build_object(
                                'total', SUM(total),
                                'passed', SUM(passed),
                                'failed', SUM(failed),
                                'borderline', SUM(borderline),
                                'pass_rate', (SUM(passed)::float / NULLIF(SUM(total), 0) * 100)::numeric(5,2)
                            )
                        FROM daily_stats
                    ) as summary
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getQCStatistics', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get QC pass rate
     */
    async getQCPassRate(technicianId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND performed_at BETWEEN '${from_date}' AND '${to_date}'`;
            }

            const query = `
                SELECT 
                    lt.id as test_id,
                    lt.test_name,
                    lt.category,
                    COUNT(qc.id) as total_tests,
                    COUNT(qc.id) FILTER (WHERE qc.status = 'passed') as passed,
                    COUNT(qc.id) FILTER (WHERE qc.status = 'failed') as failed,
                    (COUNT(qc.id) FILTER (WHERE qc.status = 'passed')::float / NULLIF(COUNT(qc.id), 0) * 100)::numeric(5,2) as pass_rate,
                    MIN(qc.performed_at) as first_test,
                    MAX(qc.performed_at) as last_test
                FROM lab_tests lt
                LEFT JOIN quality_control qc ON lt.id = qc.test_id
                    ${dateFilter}
                WHERE lt.is_active = true
                GROUP BY lt.id
                ORDER BY pass_rate ASC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getQCPassRate', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get failed QC records
     */
    async getFailedQCRecords(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20, from_date, to_date } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT qc.*, 
                       lt.test_name, lt.category,
                       CONCAT(e.first_name, ' ', e.last_name) as performed_by_name,
                       a.id as alert_id,
                       a.severity as alert_severity,
                       a.acknowledged as alert_acknowledged
                FROM quality_control qc
                JOIN lab_tests lt ON qc.test_id = lt.id
                LEFT JOIN employees e ON qc.performed_by = e.id
                LEFT JOIN qc_alerts a ON qc.id = a.qc_id
                WHERE qc.status = 'failed'
            `;
            const values = [];
            let paramIndex = 1;

            if (from_date) {
                query += ` AND qc.performed_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND qc.performed_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            query += ` ORDER BY qc.performed_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM quality_control
                WHERE status = 'failed'
                ${from_date ? 'AND performed_at >= $1' : ''}
                ${to_date ? 'AND performed_at <= $2' : ''}
            `;
            const countValues = [];
            if (from_date) countValues.push(from_date);
            if (to_date) countValues.push(to_date);
            const count = await db.query(countQuery, countValues);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getFailedQCRecords', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get control charts
     */
    async getControlCharts(technicianId, testId, days = 30) {
        try {
            const query = `
                WITH levey_jennings AS (
                    SELECT 
                        performed_at,
                        result::float as value,
                        AVG(result::float) OVER (ORDER BY performed_at ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) as moving_avg,
                        STDDEV(result::float) OVER (ORDER BY performed_at ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) as moving_stddev
                    FROM quality_control
                    WHERE test_id = $1
                        AND performed_at > NOW() - INTERVAL '${days} days'
                        AND result ~ '^[0-9]+\.?[0-9]*$'
                    ORDER BY performed_at ASC
                )
                SELECT 
                    performed_at,
                    value,
                    moving_avg,
                    moving_stddev,
                    moving_avg + (2 * moving_stddev) as upper_warning,
                    moving_avg - (2 * moving_stddev) as lower_warning,
                    moving_avg + (3 * moving_stddev) as upper_control,
                    moving_avg - (3 * moving_stddev) as lower_control,
                    CASE 
                        WHEN value > moving_avg + (3 * moving_stddev) OR value < moving_avg - (3 * moving_stddev) THEN 'out_of_control'
                        WHEN value > moving_avg + (2 * moving_stddev) OR value < moving_avg - (2 * moving_stddev) THEN 'warning'
                        ELSE 'in_control'
                    END as status
                FROM levey_jennings
                WHERE moving_stddev IS NOT NULL
            `;

            const result = await db.query(query, [testId]);
            return result.rows;
        } catch (error) {
            logger.error('Error in getControlCharts', { error: error.message, technicianId, testId });
            throw error;
        }
    },

    /**
     * Get QC trends
     */
    async getQCTrends(technicianId, options = {}) {
        try {
            const { test_id, months = 6 } = options;

            let testFilter = '';
            if (test_id) {
                testFilter = `AND test_id = '${test_id}'`;
            }

            const query = `
                WITH monthly_stats AS (
                    SELECT 
                        DATE_TRUNC('month', performed_at) as month,
                        test_id,
                        lt.test_name,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'passed') as passed,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed,
                        AVG(result::float) FILTER (WHERE result ~ '^[0-9]+\.?[0-9]*$') as mean_value,
                        STDDEV(result::float) FILTER (WHERE result ~ '^[0-9]+\.?[0-9]*$') as stddev_value
                    FROM quality_control qc
                    JOIN lab_tests lt ON qc.test_id = lt.id
                    WHERE performed_at > NOW() - INTERVAL '${months} months'
                        ${testFilter}
                    GROUP BY DATE_TRUNC('month', performed_at), test_id, lt.test_name
                )
                SELECT 
                    month,
                    test_id,
                    test_name,
                    total,
                    passed,
                    failed,
                    (passed::float / NULLIF(total, 0) * 100)::numeric(5,2) as pass_rate,
                    mean_value,
                    stddev_value,
                    LAG(passed::float / NULLIF(total, 0) * 100) OVER (PARTITION BY test_id ORDER BY month) as prev_pass_rate
                FROM monthly_stats
                ORDER BY month DESC, test_name
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getQCTrends', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get QC lots
     */
    async getQCLots(technicianId, filters = {}) {
        try {
            let query = `
                SELECT 
                    control_lot as lot_number,
                    test_id,
                    lt.test_name,
                    MIN(control_expiry) as expiry_date,
                    COUNT(*) as usage_count,
                    COUNT(*) FILTER (WHERE status = 'passed') as passed_count,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
                    MIN(performed_at) as first_used,
                    MAX(performed_at) as last_used,
                    CASE 
                        WHEN MIN(control_expiry) < NOW() THEN 'expired'
                        WHEN MIN(control_expiry) <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
                        ELSE 'active'
                    END as status
                FROM quality_control qc
                JOIN lab_tests lt ON qc.test_id = lt.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.status === 'active') {
                query += ` AND qc.control_expiry > NOW()`;
            } else if (filters.status === 'expired') {
                query += ` AND qc.control_expiry <= NOW()`;
            }

            if (filters.test_id) {
                query += ` AND qc.test_id = $${paramIndex}`;
                values.push(filters.test_id);
                paramIndex++;
            }

            query += ` GROUP BY control_lot, test_id, lt.test_name
                      ORDER BY expiry_date ASC`;

            const result = await db.query(query, values);
            return result.rows;
        } catch (error) {
            logger.error('Error in getQCLots', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Add QC lot
     */
    async addQCLot(technicianId, lotData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const query = `
                INSERT INTO qc_lots (
                    id, lot_number, test_id, manufacturer,
                    manufacturing_date, expiry_date, storage_conditions,
                    certificate_url, notes, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()
                ) RETURNING *
            `;

            const values = [
                lotData.lot_number,
                lotData.test_id,
                lotData.manufacturer || null,
                lotData.manufacturing_date || null,
                lotData.expiry_date,
                lotData.storage_conditions || null,
                lotData.certificate_url || null,
                lotData.notes || null,
                technicianId
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
     * Get QC lot by number
     */
    async getQCLotByNumber(lotNumber) {
        try {
            const query = `
                SELECT * FROM qc_lots
                WHERE lot_number = $1
            `;

            const result = await db.query(query, [lotNumber]);
            return result.rows[0] || null;
        } catch (error) {
            logger.error('Error in getQCLotByNumber', { error: error.message, lotNumber });
            throw error;
        }
    },

    /**
     * Get QC alerts
     */
    async getQCAlerts(technicianId) {
        try {
            const query = `
                SELECT 
                    'failed_qc' as type,
                    a.id,
                    a.qc_id,
                    a.test_id,
                    lt.test_name,
                    a.severity,
                    a.message,
                    a.created_at,
                    a.acknowledged,
                    a.acknowledged_at,
                    CONCAT(e.first_name, ' ', e.last_name) as acknowledged_by_name
                FROM qc_alerts a
                JOIN lab_tests lt ON a.test_id = lt.id
                LEFT JOIN employees e ON a.acknowledged_by = e.id
                WHERE a.status = 'active'
                
                UNION ALL
                
                SELECT 
                    'lot_expiring' as type,
                    l.id,
                    NULL as qc_id,
                    l.test_id,
                    lt.test_name,
                    'warning' as severity,
                    CONCAT('QC lot ', l.lot_number, ' expires in ', EXTRACT(DAY FROM (l.expiry_date - NOW())), ' days') as message,
                    l.created_at,
                    false as acknowledged,
                    NULL as acknowledged_at,
                    NULL as acknowledged_by_name
                FROM qc_lots l
                JOIN lab_tests lt ON l.test_id = lt.id
                WHERE l.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                
                UNION ALL
                
                SELECT 
                    'lot_expired' as type,
                    l.id,
                    NULL as qc_id,
                    l.test_id,
                    lt.test_name,
                    'critical' as severity,
                    CONCAT('QC lot ', l.lot_number, ' expired on ', l.expiry_date) as message,
                    l.created_at,
                    false as acknowledged,
                    NULL as acknowledged_at,
                    NULL as acknowledged_by_name
                FROM qc_lots l
                JOIN lab_tests lt ON l.test_id = lt.id
                WHERE l.expiry_date < NOW()
                
                ORDER BY 
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'warning' THEN 2
                        ELSE 3
                    END,
                    created_at DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getQCAlerts', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Acknowledge QC alert
     */
    async acknowledgeQCAlert(technicianId, alertId, data) {
        try {
            const query = `
                UPDATE qc_alerts
                SET acknowledged = true,
                    acknowledged_by = $1,
                    acknowledged_at = $2,
                    acknowledgment_notes = $3,
                    status = 'acknowledged',
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                data.acknowledged_by,
                data.acknowledged_at,
                data.notes,
                alertId
            ];

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Alert not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in acknowledgeQCAlert', { error: error.message, technicianId, alertId });
            throw error;
        }
    },

    /**
     * Generate QC report
     */
    async generateQCReport(technicianId, options = {}) {
        try {
            const { format = 'pdf', from_date, to_date, test_id, include_charts = true } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND performed_at BETWEEN '${from_date}' AND '${to_date}'`;
            }

            let testFilter = '';
            if (test_id) {
                testFilter = `AND test_id = '${test_id}'`;
            }

            const query = `
                SELECT 
                    qc.*,
                    lt.test_name, lt.category,
                    CONCAT(e.first_name, ' ', e.last_name) as performed_by_name
                FROM quality_control qc
                JOIN lab_tests lt ON qc.test_id = lt.id
                LEFT JOIN employees e ON qc.performed_by = e.id
                WHERE 1=1
                    ${dateFilter}
                    ${testFilter}
                ORDER BY qc.performed_at DESC
            `;

            const result = await db.query(query);

            // Get statistics
            const statsQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'passed') as passed,
                    COUNT(*) FILTER (WHERE status = 'failed') as failed,
                    (COUNT(*) FILTER (WHERE status = 'passed')::float / NULLIF(COUNT(*), 0) * 100)::numeric(5,2) as pass_rate
                FROM quality_control
                WHERE 1=1
                    ${dateFilter}
                    ${testFilter}
            `;
            const stats = await db.query(statsQuery);

            const report = {
                generated_at: new Date(),
                filters: { from_date, to_date, test_id },
                summary: stats.rows[0],
                data: result.rows
            };

            // For now, return JSON
            // TODO: Implement actual PDF/CSV generation
            return report;
        } catch (error) {
            logger.error('Error in generateQCReport', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Export QC records
     */
    async exportQCRecords(technicianId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    qc.performed_at, qc.control_type, qc.control_lot,
                    qc.control_expiry, qc.result, qc.status,
                    lt.test_name, lt.category,
                    CONCAT(e.first_name, ' ', e.last_name) as performed_by
                FROM quality_control qc
                JOIN lab_tests lt ON qc.test_id = lt.id
                LEFT JOIN employees e ON qc.performed_by = e.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND qc.performed_at >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND qc.performed_at <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            if (filters.test_id) {
                query += ` AND qc.test_id = $${paramIndex}`;
                values.push(filters.test_id);
                paramIndex++;
            }

            query += ` ORDER BY qc.performed_at DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportQCRecords', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Add QC note
     */
    async addQCNote(technicianId, recordId, noteData) {
        try {
            const query = `
                INSERT INTO qc_notes (
                    id, qc_id, note, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4
                ) RETURNING *
            `;

            const values = [
                recordId,
                noteData.note,
                noteData.created_by,
                noteData.created_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in addQCNote', { error: error.message, technicianId, recordId });
            throw error;
        }
    },

    /**
     * Get QC notes
     */
    async getQCNotes(technicianId, recordId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT n.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as created_by_name
                FROM qc_notes n
                LEFT JOIN employees e ON n.created_by = e.id
                WHERE n.qc_id = $1
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [recordId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM qc_notes
                WHERE qc_id = $1
            `;
            const count = await db.query(countQuery, [recordId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getQCNotes', { error: error.message, technicianId, recordId });
            throw error;
        }
    },

    /**
     * Validate QC result
     */
    async validateQCResult(technicianId, data) {
        try {
            const { test_id, result, lot_number } = data;

            // Get test reference ranges
            const testQuery = `
                SELECT * FROM lab_tests
                WHERE id = $1
            `;
            const test = await db.query(testQuery, [test_id]);

            if (test.rows.length === 0) {
                throw new Error('Test not found');
            }

            const testData = test.rows[0];
            const numericResult = parseFloat(result);

            let isValid = true;
            let messages = [];

            // Check if within expected range
            if (testData.qc_low && testData.qc_high) {
                if (numericResult < testData.qc_low || numericResult > testData.qc_high) {
                    isValid = false;
                    messages.push(`Result outside expected range (${testData.qc_low}-${testData.qc_high})`);
                }
            }

            // Check lot expiry
            if (lot_number) {
                const lotQuery = `
                    SELECT * FROM qc_lots
                    WHERE lot_number = $1
                `;
                const lot = await db.query(lotQuery, [lot_number]);

                if (lot.rows.length > 0) {
                    if (new Date(lot.rows[0].expiry_date) < new Date()) {
                        isValid = false;
                        messages.push('Control lot has expired');
                    }
                }
            }

            return {
                isValid,
                messages,
                test: testData.test_name,
                result
            };
        } catch (error) {
            logger.error('Error in validateQCResult', { error: error.message, technicianId });
            throw error;
        }
    }
};

module.exports = qcService;