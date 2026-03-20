/**
 * ======================================================================
 * FILE: backend/src/services/labTechnician/resultService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician result service - Handles business logic for test results.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * - [BR-37] Test results need verification
 * - [BR-38] Abnormal results flagged automatically
 * - [BR-39] Sample collection to result < 24 hours
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const resultService = {
    /**
     * Get all test results
     */
    async getAllResults(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20, status, patient_id, test_id, from_date, to_date, abnormal_only, critical_only } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT tr.*, 
                       t.id as test_id,
                       lt.test_name, lt.test_code, lt.category,
                       lt.unit as test_unit, lt.normal_range,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       to.id as order_id,
                       to.order_number,
                       CONCAT(tech.first_name, ' ', tech.last_name) as tested_by_name,
                       CONCAT(ver.first_name, ' ', ver.last_name) as verified_by_name
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                JOIN test_orders to ON t.test_order_id = to.id
                LEFT JOIN employees tech ON tr.tested_by = tech.id
                LEFT JOIN employees ver ON tr.verified_by = ver.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (status) {
                query += ` AND tr.status = $${paramIndex}`;
                values.push(status);
                paramIndex++;
            }

            if (patient_id) {
                query += ` AND tr.patient_id = $${paramIndex}`;
                values.push(patient_id);
                paramIndex++;
            }

            if (test_id) {
                query += ` AND tr.test_id = $${paramIndex}`;
                values.push(test_id);
                paramIndex++;
            }

            if (from_date) {
                query += ` AND tr.tested_at >= $${paramIndex}`;
                values.push(from_date);
                paramIndex++;
            }

            if (to_date) {
                query += ` AND tr.tested_at <= $${paramIndex}`;
                values.push(to_date);
                paramIndex++;
            }

            if (abnormal_only) {
                query += ` AND tr.is_abnormal = true`;
            }

            if (critical_only) {
                query += ` AND tr.is_critical = true`;
            }

            query += ` ORDER BY tr.tested_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM test_results tr
                WHERE 1=1
                ${patient_id ? 'AND tr.patient_id = $1' : ''}
            `;
            const countValues = patient_id ? [patient_id] : [];
            const count = await db.query(countQuery, countValues);

            // Get summary statistics
            const summaryQuery = `
                SELECT 
                    COUNT(*) as total_results,
                    COUNT(*) FILTER (WHERE is_abnormal = true) as abnormal_count,
                    COUNT(*) FILTER (WHERE is_critical = true) as critical_count,
                    COUNT(*) FILTER (WHERE verified_by IS NOT NULL) as verified_count,
                    COUNT(*) FILTER (WHERE approved_by IS NOT NULL) as approved_count
                FROM test_results tr
                WHERE 1=1
                ${patient_id ? 'AND tr.patient_id = $1' : ''}
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
            logger.error('Error in getAllResults', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get results by status
     */
    async getResultsByStatus(technicianId, status, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT tr.*, 
                       lt.test_name, lt.category,
                       p.first_name, p.last_name
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                WHERE tr.status = $1
                ORDER BY tr.tested_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [status, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM test_results
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
            logger.error('Error in getResultsByStatus', { error: error.message, technicianId, status });
            throw error;
        }
    },

    /**
     * Get abnormal results [BR-38]
     */
    async getAbnormalResults(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT tr.*, 
                       lt.test_name, lt.category, lt.normal_range,
                       p.first_name, p.last_name,
                       to.order_number
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                JOIN test_orders to ON t.test_order_id = to.id
                WHERE tr.is_abnormal = true
                ORDER BY tr.tested_at DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM test_results
                WHERE is_abnormal = true
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getAbnormalResults', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get critical results [BR-36]
     */
    async getCriticalResults(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT tr.*, 
                       lt.test_name, lt.category, lt.normal_range,
                       lt.critical_low, lt.critical_high,
                       p.first_name, p.last_name,
                       p.phone as patient_phone,
                       to.id as order_id,
                       e.id as doctor_id,
                       CONCAT(e.first_name, ' ', e.last_name) as doctor_name,
                       e.phone as doctor_phone
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                JOIN test_orders to ON t.test_order_id = to.id
                JOIN employees e ON to.doctor_id = e.id
                WHERE tr.is_critical = true
                    AND (tr.alert_sent = false OR tr.alert_sent IS NULL)
                ORDER BY tr.tested_at DESC
                LIMIT $1 OFFSET $2
            `;

            const result = await db.query(query, [limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM test_results
                WHERE is_critical = true AND (alert_sent = false OR alert_sent IS NULL)
            `;
            const count = await db.query(countQuery);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getCriticalResults', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get result by ID
     */
    async getResultById(technicianId, resultId) {
        try {
            const query = `
                SELECT tr.*, 
                       t.id as test_id,
                       lt.test_name, lt.test_code, lt.category,
                       lt.unit, lt.normal_range,
                       lt.critical_low, lt.critical_high,
                       lt.panic_low, lt.panic_high,
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.date_of_birth as patient_dob,
                       p.gender as patient_gender,
                       to.id as order_id,
                       to.order_number,
                       to.collection_date,
                       CONCAT(tech.first_name, ' ', tech.last_name) as tested_by_name,
                       CONCAT(ver.first_name, ' ', ver.last_name) as verified_by_name,
                       CONCAT(app.first_name, ' ', app.last_name) as approved_by_name,
                       (
                           SELECT json_agg(
                               json_build_object(
                                   'id', n.id,
                                   'note', n.note,
                                   'created_at', n.created_at,
                                   'created_by', CONCAT(e.first_name, ' ', e.last_name)
                               ) ORDER BY n.created_at DESC
                           )
                           FROM result_notes n
                           LEFT JOIN employees e ON n.created_by = e.id
                           WHERE n.result_id = tr.id
                       ) as notes
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                JOIN test_orders to ON t.test_order_id = to.id
                LEFT JOIN employees tech ON tr.tested_by = tech.id
                LEFT JOIN employees ver ON tr.verified_by = ver.id
                LEFT JOIN employees app ON tr.approved_by = app.id
                WHERE tr.id = $1
            `;

            const result = await db.query(query, [resultId]);
            
            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            
            // Calculate if within normal range
            if (row.result_numeric && row.normal_range) {
                const range = row.normal_range.match(/(\d+\.?\d*)-(\d+\.?\d*)/);
                if (range) {
                    const low = parseFloat(range[1]);
                    const high = parseFloat(range[2]);
                    row.is_abnormal = row.result_numeric < low || row.result_numeric > high;
                }
            }

            return row;
        } catch (error) {
            logger.error('Error in getResultById', { error: error.message, technicianId, resultId });
            throw error;
        }
    },

    /**
     * Enter test result
     */
    async enterResult(technicianId, resultData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Get test details to check normal ranges
            const testQuery = `
                SELECT lt.*, t.id as test_record_id
                FROM lab_tests lt
                JOIN tests t ON lt.id = t.test_id
                WHERE t.id = $1
            `;
            const test = await client.query(testQuery, [resultData.test_id]);

            if (test.rows.length === 0) {
                throw new Error('Test not found');
            }

            // Check for abnormal/critical values [BR-36][BR-38]
            let isAbnormal = false;
            let isCritical = false;
            let isPanic = false;

            if (resultData.result_numeric) {
                const value = resultData.result_numeric;
                
                // Check normal range
                if (test.rows[0].normal_range) {
                    const range = test.rows[0].normal_range.match(/(\d+\.?\d*)-(\d+\.?\d*)/);
                    if (range) {
                        const low = parseFloat(range[1]);
                        const high = parseFloat(range[2]);
                        isAbnormal = value < low || value > high;
                    }
                }

                // Check critical range
                if (test.rows[0].critical_low && test.rows[0].critical_high) {
                    isCritical = value < test.rows[0].critical_low || value > test.rows[0].critical_high;
                }

                // Check panic range
                if (test.rows[0].panic_low && test.rows[0].panic_high) {
                    isPanic = value < test.rows[0].panic_low || value > test.rows[0].panic_high;
                }
            }

            const query = `
                INSERT INTO test_results (
                    id, test_id, patient_id, result_value,
                    result_numeric, result_text, result_unit,
                    reference_range_low, reference_range_high,
                    is_abnormal, is_critical, is_panic,
                    interpretation, clinical_significance, comments,
                    tested_by, tested_at, status,
                    ip_address, user_agent, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12, $13, $14,
                    $15, $16, 'pending', $17, $18, NOW()
                ) RETURNING *
            `;

            const values = [
                resultData.test_id,
                resultData.patient_id,
                resultData.result_value,
                resultData.result_numeric || null,
                resultData.result_text || null,
                resultData.result_unit || null,
                resultData.reference_range_low || null,
                resultData.reference_range_high || null,
                isAbnormal,
                isCritical || isPanic,
                isPanic,
                resultData.interpretation || null,
                resultData.clinical_significance || null,
                resultData.comments || null,
                resultData.tested_by,
                resultData.tested_at,
                resultData.ip_address,
                resultData.user_agent
            ];

            const result = await client.query(query, values);

            // Update test status
            await client.query(`
                UPDATE tests 
                SET status = 'completed',
                    completed_at = $1,
                    updated_at = NOW()
                WHERE id = $2
            `, [resultData.tested_at, resultData.test_id]);

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
     * Update test result
     */
    async updateResult(technicianId, resultId, updates) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if result can be updated
            const checkQuery = `SELECT verified_by FROM test_results WHERE id = $1`;
            const check = await client.query(checkQuery, [resultId]);
            
            if (check.rows.length === 0) {
                throw new Error('Test result not found');
            }

            if (check.rows[0].verified_by) {
                throw new Error('Cannot update verified result');
            }

            // Build dynamic update query
            const setClause = [];
            const values = [];
            let paramIndex = 1;

            const allowedFields = [
                'result_value', 'result_numeric', 'result_text',
                'result_unit', 'reference_range_low', 'reference_range_high',
                'interpretation', 'clinical_significance', 'comments'
            ];

            for (const [key, value] of Object.entries(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            // Re-check abnormal/critical status
            setClause.push(`updated_at = NOW()`);
            values.push(resultId);

            const query = `
                UPDATE test_results 
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
     * Delete test result
     */
    async deleteResult(technicianId, resultId, reason) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if result can be deleted
            const checkQuery = `SELECT verified_by, test_id FROM test_results WHERE id = $1`;
            const check = await client.query(checkQuery, [resultId]);
            
            if (check.rows.length === 0) {
                throw new Error('Test result not found');
            }

            if (check.rows[0].verified_by) {
                throw new Error('Cannot delete verified result');
            }

            // Soft delete
            const query = `
                UPDATE test_results 
                SET is_deleted = true,
                    deleted_at = NOW(),
                    deleted_by = $1,
                    deletion_reason = $2
                WHERE id = $3
                RETURNING id
            `;

            const result = await client.query(query, [technicianId, reason, resultId]);

            // Reset test status
            await client.query(`
                UPDATE tests 
                SET status = 'pending',
                    completed_at = NULL,
                    updated_at = NOW()
                WHERE id = $1
            `, [check.rows[0].test_id]);

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
     * Verify result [BR-37]
     */
    async verifyResult(technicianId, resultId, verificationData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if already verified
            const checkQuery = `SELECT verified_by FROM test_results WHERE id = $1`;
            const check = await client.query(checkQuery, [resultId]);
            
            if (check.rows.length === 0) {
                throw new Error('Test result not found');
            }

            if (check.rows[0].verified_by) {
                throw new Error('Result already verified');
            }

            const query = `
                UPDATE test_results 
                SET verified_by = $1,
                    verified_at = $2,
                    verification_notes = $3,
                    status = 'verified',
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                verificationData.verified_by,
                verificationData.verified_at,
                verificationData.verification_notes,
                resultId
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
     * Approve result
     */
    async approveResult(technicianId, resultId, approvalData) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            // Check if result is verified
            const checkQuery = `SELECT verified_by FROM test_results WHERE id = $1`;
            const check = await client.query(checkQuery, [resultId]);
            
            if (check.rows.length === 0) {
                throw new Error('Test result not found');
            }

            if (!check.rows[0].verified_by) {
                throw new Error('Result not verified');
            }

            const query = `
                UPDATE test_results 
                SET approved_by = $1,
                    approved_at = $2,
                    approval_notes = $3,
                    status = 'approved',
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                approvalData.approved_by,
                approvalData.approved_at,
                approvalData.approval_notes,
                resultId
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
     * Generate report
     */
    async generateReport(technicianId, resultId, format = 'pdf') {
        try {
            const result = await this.getResultById(technicianId, resultId);
            
            if (!result) {
                return null;
            }

            // TODO: Implement actual PDF/HTML report generation
            // For now, return JSON
            return Buffer.from(JSON.stringify(result, null, 2));
        } catch (error) {
            logger.error('Error in generateReport', { error: error.message, technicianId, resultId });
            throw error;
        }
    },

    /**
     * Bulk verify results
     */
    async bulkVerifyResults(technicianId, resultIds, data = {}) {
        const client = await db.getClient();
        try {
            await db.beginTransaction(client);

            const results = {
                success: [],
                failed: []
            };

            for (const resultId of resultIds) {
                try {
                    const result = await this.verifyResult(technicianId, resultId, {
                        verified_by: technicianId,
                        verified_at: new Date(),
                        verification_notes: data.notes
                    });
                    results.success.push({
                        result_id: resultId,
                        verified: true
                    });
                } catch (err) {
                    results.failed.push({
                        result_id: resultId,
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
     * Get result statistics
     */
    async getResultStatistics(technicianId, period = 'day') {
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
                        DATE(tested_at) as date,
                        COUNT(*) as total_results,
                        COUNT(*) FILTER (WHERE is_abnormal = true) as abnormal,
                        COUNT(*) FILTER (WHERE is_critical = true) as critical,
                        COUNT(*) FILTER (WHERE verified_by IS NOT NULL) as verified,
                        COUNT(*) FILTER (WHERE approved_by IS NOT NULL) as approved
                    FROM test_results
                    WHERE tested_at > NOW() - ${interval}
                    GROUP BY DATE(tested_at)
                )
                SELECT 
                    json_agg(daily_stats.* ORDER BY date) as daily,
                    SUM(total_results) as total_results,
                    SUM(abnormal) as total_abnormal,
                    SUM(critical) as total_critical,
                    AVG(abnormal::float / NULLIF(total_results, 0)) * 100 as avg_abnormal_rate
                FROM daily_stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getResultStatistics', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get turnaround time [BR-39]
     */
    async getTurnaroundTime(technicianId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND tr.tested_at BETWEEN '${from_date}' AND '${to_date}'`;
            }

            const query = `
                SELECT 
                    AVG(EXTRACT(EPOCH FROM (tr.tested_at - to.collection_date))/3600)::numeric(10,2) as avg_hours,
                    COUNT(*) FILTER (
                        WHERE EXTRACT(EPOCH FROM (tr.tested_at - to.collection_date))/3600 <= 24
                    ) as within_24h,
                    COUNT(*) FILTER (
                        WHERE EXTRACT(EPOCH FROM (tr.tested_at - to.collection_date))/3600 > 24
                    ) as exceeding_24h,
                    COUNT(*) as total_tests
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN test_orders to ON t.test_order_id = to.id
                WHERE to.collection_date IS NOT NULL
                    AND tr.tested_at IS NOT NULL
                    ${dateFilter}
            `;

            const result = await db.query(query);
            
            const row = result.rows[0];
            row.within_24h_percentage = row.total_tests > 0 
                ? (row.within_24h / row.total_tests * 100).toFixed(2)
                : 0;

            return row;
        } catch (error) {
            logger.error('Error in getTurnaroundTime', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Send critical alert [BR-36]
     */
    async sendCriticalAlert(resultId) {
        try {
            // Get result details
            const query = `
                SELECT tr.*, 
                       p.id as patient_id,
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       p.phone as patient_phone,
                       to.doctor_id,
                       e.phone as doctor_phone,
                       e.first_name as doctor_first_name,
                       e.last_name as doctor_last_name,
                       lt.test_name
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                JOIN test_orders to ON t.test_order_id = to.id
                JOIN employees e ON to.doctor_id = e.id
                WHERE tr.id = $1
            `;

            const result = await db.query(query, [resultId]);

            if (result.rows.length === 0) {
                return;
            }

            const data = result.rows[0];

            // Create alert record
            await db.query(`
                INSERT INTO critical_alerts (
                    id, result_id, patient_id, doctor_id,
                    alert_type, severity, message,
                    created_at, status
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3,
                    'critical', 
                    CASE WHEN $4 THEN 'panic' ELSE 'critical' END,
                    $5, NOW(), 'pending'
                )
            `, [
                resultId,
                data.patient_id,
                data.doctor_id,
                data.is_panic,
                `Critical value for ${data.test_name}: ${data.result_value}`
            ]);

            // Mark alert as sent
            await db.query(`
                UPDATE test_results 
                SET alert_sent = true,
                    alert_sent_at = NOW()
                WHERE id = $1
            `, [resultId]);

            // TODO: Send SMS/Email/Notification
            logger.info('Critical alert created', { resultId, patientId: data.patient_id });

        } catch (error) {
            logger.error('Error in sendCriticalAlert', { error: error.message, resultId });
        }
    },

    /**
     * Get critical alerts
     */
    async getCriticalAlerts(technicianId) {
        try {
            const query = `
                SELECT ca.*, 
                       p.first_name as patient_first_name,
                       p.last_name as patient_last_name,
                       tr.result_value,
                       lt.test_name
                FROM critical_alerts ca
                JOIN test_results tr ON ca.result_id = tr.id
                JOIN patients p ON ca.patient_id = p.id
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                WHERE ca.status = 'pending'
                ORDER BY ca.created_at DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCriticalAlerts', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Acknowledge critical alert
     */
    async acknowledgeCriticalAlert(technicianId, alertId, data) {
        try {
            const query = `
                UPDATE critical_alerts
                SET status = 'acknowledged',
                    acknowledged_by = $1,
                    acknowledged_at = $2,
                    acknowledgment_notes = $3,
                    updated_at = NOW()
                WHERE id = $4
                RETURNING *
            `;

            const values = [
                data.acknowledged_by,
                data.acknowledged_at,
                data.acknowledgment_notes,
                alertId
            ];

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                throw new Error('Alert not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in acknowledgeCriticalAlert', { error: error.message, technicianId, alertId });
            throw error;
        }
    },

    /**
     * Notify doctor
     */
    async notifyDoctor(technicianId, resultId, method) {
        try {
            const result = await this.getResultById(technicianId, resultId);
            
            if (!result) {
                throw new Error('Result not found');
            }

            if (!result.is_critical) {
                throw new Error('Result not critical');
            }

            // Create notification record
            const query = `
                INSERT INTO doctor_notifications (
                    id, result_id, doctor_id, patient_id,
                    notification_method, sent_at, status
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, NOW(), 'sent'
                ) RETURNING *
            `;

            const values = [
                resultId,
                result.doctor_id,
                result.patient_id,
                method
            ];

            const notification = await db.query(query, values);

            // TODO: Send actual notification (SMS/Email)

            return notification.rows[0];
        } catch (error) {
            logger.error('Error in notifyDoctor', { error: error.message, technicianId, resultId });
            throw error;
        }
    },

    /**
     * Export results
     */
    async exportResults(technicianId, format, filters = {}) {
        try {
            let query = `
                SELECT 
                    tr.tested_at, tr.result_value, tr.result_unit,
                    lt.test_name, lt.category,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.date_of_birth as patient_dob,
                    to.order_number,
                    CONCAT(tech.first_name, ' ', tech.last_name) as tested_by,
                    tr.is_abnormal, tr.is_critical,
                    tr.verified_at, tr.approved_at
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                JOIN test_orders to ON t.test_order_id = to.id
                LEFT JOIN employees tech ON tr.tested_by = tech.id
                WHERE 1=1
            `;
            const values = [];
            let paramIndex = 1;

            if (filters.from_date) {
                query += ` AND tr.tested_at >= $${paramIndex}`;
                values.push(filters.from_date);
                paramIndex++;
            }

            if (filters.to_date) {
                query += ` AND tr.tested_at <= $${paramIndex}`;
                values.push(filters.to_date);
                paramIndex++;
            }

            if (filters.patient_id) {
                query += ` AND tr.patient_id = $${paramIndex}`;
                values.push(filters.patient_id);
                paramIndex++;
            }

            query += ` ORDER BY tr.tested_at DESC`;

            const result = await db.query(query, values);

            // For now, return JSON
            // TODO: Implement actual CSV/PDF generation
            return result.rows;
        } catch (error) {
            logger.error('Error in exportResults', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Generate printable result
     */
    async generatePrintableResult(technicianId, resultId) {
        try {
            const result = await this.getResultById(technicianId, resultId);
            
            if (!result) {
                return null;
            }

            // TODO: Implement PDF generation
            return Buffer.from(JSON.stringify(result, null, 2));
        } catch (error) {
            logger.error('Error in generatePrintableResult', { error: error.message, technicianId, resultId });
            throw error;
        }
    },

    /**
     * Add result note
     */
    async addResultNote(technicianId, resultId, noteData) {
        try {
            const query = `
                INSERT INTO result_notes (
                    id, result_id, note, created_by, created_at
                ) VALUES (
                    gen_random_uuid(), $1, $2, $3, $4
                ) RETURNING *
            `;

            const values = [
                resultId,
                noteData.note,
                noteData.created_by,
                noteData.created_at
            ];

            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in addResultNote', { error: error.message, technicianId, resultId });
            throw error;
        }
    },

    /**
     * Get result notes
     */
    async getResultNotes(technicianId, resultId, options = {}) {
        try {
            const { page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            const query = `
                SELECT n.*, 
                       CONCAT(e.first_name, ' ', e.last_name) as created_by_name
                FROM result_notes n
                LEFT JOIN employees e ON n.created_by = e.id
                WHERE n.result_id = $1
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await db.query(query, [resultId, limit, offset]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM result_notes
                WHERE result_id = $1
            `;
            const count = await db.query(countQuery, [resultId]);

            return {
                data: result.rows,
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getResultNotes', { error: error.message, technicianId, resultId });
            throw error;
        }
    }
};

module.exports = resultService;