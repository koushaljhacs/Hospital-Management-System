/**
 * ======================================================================
 * FILE: backend/src/services/dashboard/labDashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab dashboard service - Handles business logic for laboratory dashboard.
 * Provides real-time test tracking, quality control metrics, and equipment status.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-22
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * - [BR-37] Test results need verification
 * - [BR-38] Abnormal results flagged automatically
 * - [BR-39] Sample collection to result < 24 hours
 * - [BR-40] Duplicate test not allowed within 7 days
 * 
 * ENDPOINTS SUPPORTED:
 * - GET /api/v1/dashboard/lab - Main dashboard
 * - GET /api/v1/dashboard/lab/pending - Pending tests
 * - GET /api/v1/dashboard/lab/critical - Critical values
 * - GET /api/v1/dashboard/lab/equipment - Equipment status
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const labDashboardService = {
    /**
     * Get lab main dashboard
     * GET /api/v1/dashboard/lab
     */
    async getDashboard(technicianId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const [
                pendingTests,
                criticalValues,
                equipmentStatus,
                testVolumeStats,
                turnaroundStats,
                qualityControlStats
            ] = await Promise.all([
                this.getPendingTests(technicianId, { page: 1, limit: 5 }),
                this.getCriticalValues(technicianId, { acknowledged: false }),
                this.getEquipmentStatus(technicianId),
                this.getTestVolumeStats(technicianId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getTurnaroundStats(technicianId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getQualityControlStats(technicianId, { from_date: thirtyDaysAgo, to_date: today })
            ]);

            return {
                pending_tests: pendingTests,
                critical_values: criticalValues,
                equipment_status: equipmentStatus,
                test_volume_stats: testVolumeStats,
                turnaround_stats: turnaroundStats,
                quality_control_stats: qualityControlStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get pending tests
     * GET /api/v1/dashboard/lab/pending
     */
    async getPendingTests(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20, priority = 'all' } = options;
            const offset = (page - 1) * limit;

            let priorityFilter = '';
            if (priority !== 'all') {
                priorityFilter = `AND lo.priority = '${priority}'`;
            }

            const query = `
                WITH pending_orders AS (
                    SELECT 
                        lo.id as order_id,
                        lo.order_number,
                        lo.priority,
                        lo.ordered_at,
                        lo.clinical_notes,
                        p.id as patient_id,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        p.date_of_birth as patient_dob,
                        p.gender as patient_gender,
                        e.id as doctor_id,
                        e.first_name as doctor_first_name,
                        e.last_name as doctor_last_name,
                        (
                            SELECT COUNT(*) 
                            FROM test_results tr 
                            WHERE tr.test_order_id = lo.id 
                                AND tr.status = 'pending'
                        ) as pending_test_count,
                        (
                            SELECT COUNT(*) 
                            FROM test_results tr 
                            WHERE tr.test_order_id = lo.id 
                                AND tr.status = 'completed'
                        ) as completed_test_count,
                        EXTRACT(EPOCH FROM (NOW() - lo.ordered_at))/3600 as hours_pending
                    FROM test_orders lo
                    JOIN patients p ON lo.patient_id = p.id
                    JOIN employees e ON lo.doctor_id = e.id
                    WHERE lo.status IN ('pending', 'collected', 'received')
                        AND lo.is_deleted = false
                        ${priorityFilter}
                    ORDER BY 
                        CASE lo.priority
                            WHEN 'stat' THEN 1
                            WHEN 'urgent' THEN 2
                            ELSE 3
                        END,
                        lo.ordered_at ASC
                    LIMIT $1 OFFSET $2
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE priority = 'stat') as stat_count,
                        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_count,
                        COUNT(*) FILTER (WHERE priority = 'routine') as routine_count,
                        COUNT(*) FILTER (WHERE hours_pending > 24) as overdue_count,
                        AVG(hours_pending) FILTER (WHERE hours_pending > 0) as avg_waiting_hours
                    FROM pending_orders
                )
                SELECT 
                    (SELECT json_agg(pending_orders.*) FROM pending_orders) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    stat_count: 0,
                    urgent_count: 0,
                    routine_count: 0,
                    overdue_count: 0,
                    avg_waiting_hours: 0
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getPendingTests', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get critical values
     * GET /api/v1/dashboard/lab/critical
     * 
     * BUSINESS RULE: [BR-36] Critical values require immediate notification
     */
    async getCriticalValues(technicianId, options = {}) {
        try {
            const { acknowledged = false, page = 1, limit = 20 } = options;
            const offset = (page - 1) * limit;

            let acknowledgedFilter = '';
            if (acknowledged === false) {
                acknowledgedFilter = 'AND tr.acknowledged = false';
            }

            const query = `
                WITH critical_results AS (
                    SELECT 
                        tr.id,
                        tr.test_order_id,
                        tr.result_value,
                        tr.result_numeric,
                        tr.result_unit,
                        tr.reference_range_low,
                        tr.reference_range_high,
                        tr.is_critical,
                        tr.is_panic,
                        tr.interpretation,
                        tr.acknowledged,
                        tr.acknowledged_at,
                        tr.acknowledged_by,
                        lt.test_name,
                        lt.category,
                        lt.normal_range,
                        p.id as patient_id,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        p.date_of_birth as patient_dob,
                        p.gender as patient_gender,
                        p.phone as patient_phone,
                        e.id as doctor_id,
                        e.first_name as doctor_first_name,
                        e.last_name as doctor_last_name,
                        e.specialization as doctor_specialization,
                        tr.tested_at,
                        EXTRACT(EPOCH FROM (NOW() - tr.tested_at))/3600 as hours_since_test
                    FROM test_results tr
                    JOIN lab_tests lt ON tr.test_id = lt.id
                    JOIN patients p ON tr.patient_id = p.id
                    JOIN test_orders to ON tr.test_order_id = to.id
                    JOIN employees e ON to.doctor_id = e.id
                    WHERE tr.is_critical = true
                        AND tr.is_deleted = false
                        ${acknowledgedFilter}
                    ORDER BY 
                        tr.is_panic DESC,
                        tr.tested_at DESC
                    LIMIT $1 OFFSET $2
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE is_panic = true) as panic_count,
                        COUNT(*) FILTER (WHERE acknowledged = false) as unacknowledged_count,
                        AVG(EXTRACT(EPOCH FROM (NOW() - tested_at))/3600) as avg_hours_since_test
                    FROM critical_results
                )
                SELECT 
                    (SELECT json_agg(critical_results.*) FROM critical_results) as data,
                    (SELECT row_to_json(summary.*) FROM summary) as summary
            `;

            const result = await db.query(query, [limit, offset]);
            
            return {
                data: result.rows[0]?.data || [],
                summary: result.rows[0]?.summary || {
                    total: 0,
                    panic_count: 0,
                    unacknowledged_count: 0,
                    avg_hours_since_test: 0
                },
                pagination: {
                    page,
                    limit,
                    total: result.rows[0]?.summary?.total || 0,
                    pages: Math.ceil((result.rows[0]?.summary?.total || 0) / limit)
                }
            };
        } catch (error) {
            logger.error('Error in getCriticalValues', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get equipment status
     * GET /api/v1/dashboard/lab/equipment
     */
    async getEquipmentStatus(technicianId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'operational') as operational,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'calibration_due') as calibration_due,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                    COUNT(*) FILTER (WHERE status = 'repair_required') as repair_required,
                    json_agg(
                        json_build_object(
                            'id', id,
                            'equipment_code', equipment_code,
                            'name', name,
                            'category', category,
                            'status', status,
                            'last_calibration', last_calibration_date,
                            'next_calibration', next_calibration_date,
                            'days_until_calibration', EXTRACT(DAY FROM (next_calibration_date - NOW())),
                            'manufacturer', manufacturer,
                            'model', model,
                            'location', location
                        )
                        ORDER BY 
                            CASE status
                                WHEN 'calibration_due' THEN 1
                                WHEN 'maintenance' THEN 2
                                WHEN 'repair_required' THEN 3
                                WHEN 'out_of_service' THEN 4
                                ELSE 5
                            END
                    ) FILTER (WHERE status != 'operational' OR next_calibration_date <= NOW() + INTERVAL '30 days') as critical_equipment
                FROM equipment
                WHERE is_deleted = false
                    AND department_id IN (
                        SELECT id FROM departments WHERE name = 'Laboratory'
                    )
            `;

            const result = await db.query(query);
            const data = result.rows[0];
            
            // Group by category
            const byCategoryQuery = `
                SELECT 
                    category,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'operational') as operational,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
                FROM equipment
                WHERE is_deleted = false
                    AND department_id IN (
                        SELECT id FROM departments WHERE name = 'Laboratory'
                    )
                GROUP BY category
                ORDER BY total DESC
            `;
            
            const byCategoryResult = await db.query(byCategoryQuery);

            return {
                total: parseInt(data.total) || 0,
                operational: parseInt(data.operational) || 0,
                maintenance: parseInt(data.maintenance) || 0,
                calibration_due: parseInt(data.calibration_due) || 0,
                out_of_service: parseInt(data.out_of_service) || 0,
                repair_required: parseInt(data.repair_required) || 0,
                operational_rate: data.total > 0 
                    ? (parseInt(data.operational) / parseInt(data.total) * 100).toFixed(1)
                    : 0,
                critical_equipment: data.critical_equipment || [],
                by_category: byCategoryResult.rows.map(row => ({
                    category: row.category,
                    total: parseInt(row.total),
                    operational: parseInt(row.operational),
                    maintenance: parseInt(row.maintenance),
                    operational_rate: row.total > 0 
                        ? (parseInt(row.operational) / parseInt(row.total) * 100).toFixed(1)
                        : 0
                }))
            };
        } catch (error) {
            logger.error('Error in getEquipmentStatus', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get test volume statistics
     * GET /api/v1/dashboard/lab/test-volume-stats
     */
    async getTestVolumeStats(technicianId, options = {}) {
        try {
            const { from_date, to_date, group_by = 'day' } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND tr.tested_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND tr.tested_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH test_volume AS (
                    SELECT 
                        DATE_TRUNC('${group_by}', tr.tested_at) as period,
                        COUNT(*) as total_tests,
                        COUNT(*) FILTER (WHERE tr.is_abnormal = true) as abnormal_tests,
                        COUNT(*) FILTER (WHERE tr.is_critical = true) as critical_tests,
                        COUNT(*) FILTER (WHERE lt.category = 'hematology') as hematology,
                        COUNT(*) FILTER (WHERE lt.category = 'biochemistry') as biochemistry,
                        COUNT(*) FILTER (WHERE lt.category = 'microbiology') as microbiology,
                        COUNT(*) FILTER (WHERE lt.category = 'pathology') as pathology,
                        COUNT(*) FILTER (WHERE lt.category = 'immunology') as immunology
                    FROM test_results tr
                    JOIN lab_tests lt ON tr.test_id = lt.id
                    WHERE tr.is_deleted = false
                        ${dateFilter}
                    GROUP BY DATE_TRUNC('${group_by}', tr.tested_at)
                    ORDER BY period DESC
                ),
                totals AS (
                    SELECT 
                        SUM(total_tests) as total_tests,
                        SUM(abnormal_tests) as total_abnormal,
                        SUM(critical_tests) as total_critical,
                        AVG(abnormal_tests * 100.0 / NULLIF(total_tests, 0)) as avg_abnormal_rate
                    FROM test_volume
                )
                SELECT 
                    (SELECT json_agg(test_volume.*) FROM test_volume) as breakdown,
                    (SELECT row_to_json(totals.*) FROM totals) as totals
            `;

            const result = await db.query(query);
            const data = result.rows[0];
            const totals = data?.totals || {};

            return {
                breakdown: data?.breakdown || [],
                totals: {
                    total_tests: parseInt(totals.total_tests) || 0,
                    total_abnormal: parseInt(totals.total_abnormal) || 0,
                    total_critical: parseInt(totals.total_critical) || 0,
                    abnormal_rate: parseFloat(totals.avg_abnormal_rate).toFixed(1) || 0
                }
            };
        } catch (error) {
            logger.error('Error in getTestVolumeStats', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get turnaround statistics
     * GET /api/v1/dashboard/lab/turnaround-stats
     * 
     * BUSINESS RULE: [BR-39] Sample collection to result < 24 hours
     */
    async getTurnaroundStats(technicianId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND tr.tested_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND tr.tested_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH turnaround_data AS (
                    SELECT 
                        tr.id,
                        tr.test_order_id,
                        tr.tested_at,
                        sp.collection_date,
                        EXTRACT(EPOCH FROM (tr.tested_at - sp.collection_date))/3600 as hours_turnaround
                    FROM test_results tr
                    JOIN test_orders to ON tr.test_order_id = to.id
                    JOIN specimens sp ON to.id = sp.test_order_id
                    WHERE sp.collection_date IS NOT NULL
                        AND tr.tested_at IS NOT NULL
                        AND tr.is_deleted = false
                        ${dateFilter}
                ),
                stats AS (
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE hours_turnaround <= 24) as within_24h,
                        COUNT(*) FILTER (WHERE hours_turnaround > 24) as exceeding_24h,
                        AVG(hours_turnaround) as avg_hours,
                        MIN(hours_turnaround) as min_hours,
                        MAX(hours_turnaround) as max_hours,
                        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours_turnaround) as median_hours,
                        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY hours_turnaround) as p95_hours
                    FROM turnaround_data
                )
                SELECT * FROM stats
            `;

            const result = await db.query(query);
            const data = result.rows[0] || {};

            return {
                total_tests: parseInt(data.total) || 0,
                within_24h: parseInt(data.within_24h) || 0,
                exceeding_24h: parseInt(data.exceeding_24h) || 0,
                compliance_rate: data.total > 0 
                    ? (parseInt(data.within_24h) / parseInt(data.total) * 100).toFixed(1)
                    : 0,
                avg_hours: parseFloat(data.avg_hours).toFixed(1) || 0,
                min_hours: parseFloat(data.min_hours).toFixed(1) || 0,
                max_hours: parseFloat(data.max_hours).toFixed(1) || 0,
                median_hours: parseFloat(data.median_hours).toFixed(1) || 0,
                p95_hours: parseFloat(data.p95_hours).toFixed(1) || 0
            };
        } catch (error) {
            logger.error('Error in getTurnaroundStats', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get quality control statistics
     * GET /api/v1/dashboard/lab/quality-control-stats
     */
    async getQualityControlStats(technicianId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND qc_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND qc_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH qc_stats AS (
                    SELECT 
                        qc_date,
                        test_name,
                        is_passed,
                        COUNT(*) as daily_count
                    FROM qc_records
                    WHERE is_deleted = false
                        ${dateFilter}
                    GROUP BY qc_date, test_name, is_passed
                ),
                summary AS (
                    SELECT 
                        COUNT(*) as total_qc_runs,
                        COUNT(*) FILTER (WHERE is_passed = true) as passed,
                        COUNT(*) FILTER (WHERE is_passed = false) as failed,
                        ROUND(COUNT(*) FILTER (WHERE is_passed = true)::float / NULLIF(COUNT(*), 0) * 100, 2) as pass_rate,
                        COUNT(DISTINCT test_name) as tests_covered
                    FROM qc_stats
                ),
                by_test AS (
                    SELECT 
                        test_name,
                        COUNT(*) as runs,
                        COUNT(*) FILTER (WHERE is_passed = true) as passed,
                        ROUND(COUNT(*) FILTER (WHERE is_passed = true)::float / NULLIF(COUNT(*), 0) * 100, 2) as pass_rate
                    FROM qc_stats
                    GROUP BY test_name
                    ORDER BY pass_rate ASC
                )
                SELECT 
                    (SELECT row_to_json(summary.*) FROM summary) as summary,
                    (SELECT json_agg(by_test.*) FROM by_test) as by_test
            `;

            const result = await db.query(query);
            const data = result.rows[0];

            return {
                summary: data?.summary || {
                    total_qc_runs: 0,
                    passed: 0,
                    failed: 0,
                    pass_rate: 0,
                    tests_covered: 0
                },
                by_test: data?.by_test || []
            };
        } catch (error) {
            logger.error('Error in getQualityControlStats', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get test category distribution
     * GET /api/v1/dashboard/lab/test-category-distribution
     */
    async getTestCategoryDistribution(technicianId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND tr.tested_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND tr.tested_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    lt.category,
                    COUNT(*) as test_count,
                    COUNT(*) FILTER (WHERE tr.is_abnormal = true) as abnormal_count,
                    COUNT(*) FILTER (WHERE tr.is_critical = true) as critical_count,
                    ROUND(AVG(EXTRACT(EPOCH FROM (tr.tested_at - sp.collection_date))/3600), 1) as avg_turnaround_hours
                FROM test_results tr
                JOIN lab_tests lt ON tr.test_id = lt.id
                LEFT JOIN specimens sp ON tr.test_order_id = sp.test_order_id
                WHERE tr.is_deleted = false
                    ${dateFilter}
                GROUP BY lt.category
                ORDER BY test_count DESC
            `;

            const result = await db.query(query);
            
            return result.rows.map(row => ({
                category: row.category,
                test_count: parseInt(row.test_count),
                abnormal_count: parseInt(row.abnormal_count),
                critical_count: parseInt(row.critical_count),
                abnormal_rate: row.test_count > 0 
                    ? (parseInt(row.abnormal_count) / parseInt(row.test_count) * 100).toFixed(1)
                    : 0,
                avg_turnaround_hours: parseFloat(row.avg_turnaround_hours) || 0
            }));
        } catch (error) {
            logger.error('Error in getTestCategoryDistribution', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get technician workload
     * GET /api/v1/dashboard/lab/technician-workload
     */
    async getTechnicianWorkload(technicianId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND tr.tested_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND tr.tested_at > NOW() - INTERVAL '7 days'`;
            }

            const query = `
                SELECT 
                    u.id as technician_id,
                    u.username,
                    COUNT(tr.id) as tests_processed,
                    COUNT(DISTINCT tr.test_order_id) as orders_processed,
                    AVG(EXTRACT(EPOCH FROM (tr.tested_at - sp.collection_date))/3600) as avg_turnaround_hours,
                    COUNT(tr.id) FILTER (WHERE tr.is_critical = true) as critical_tests,
                    COUNT(tr.id) FILTER (WHERE tr.is_abnormal = true) as abnormal_tests
                FROM test_results tr
                JOIN users u ON tr.tested_by = u.id
                LEFT JOIN specimens sp ON tr.test_order_id = sp.test_order_id
                WHERE tr.is_deleted = false
                    AND u.role = 'lab_technician'
                    ${dateFilter}
                GROUP BY u.id, u.username
                ORDER BY tests_processed DESC
            `;

            const result = await db.query(query);
            
            return result.rows.map(row => ({
                technician_id: row.technician_id,
                username: row.username,
                tests_processed: parseInt(row.tests_processed),
                orders_processed: parseInt(row.orders_processed),
                avg_turnaround_hours: parseFloat(row.avg_turnaround_hours).toFixed(1) || 0,
                critical_tests: parseInt(row.critical_tests),
                abnormal_tests: parseInt(row.abnormal_tests)
            }));
        } catch (error) {
            logger.error('Error in getTechnicianWorkload', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get specimen rejection analysis
     * GET /api/v1/dashboard/lab/specimen-rejection-analysis
     */
    async getSpecimenRejectionAnalysis(technicianId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND sp.received_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND sp.received_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH rejection_stats AS (
                    SELECT 
                        sp.specimen_type,
                        COUNT(*) as total_received,
                        COUNT(*) FILTER (WHERE sp.status = 'rejected') as rejected,
                        sp.rejection_reason,
                        COUNT(*) FILTER (WHERE sp.status = 'rejected') as rejected_by_reason
                    FROM specimens sp
                    WHERE sp.is_deleted = false
                        ${dateFilter}
                    GROUP BY sp.specimen_type, sp.rejection_reason
                ),
                summary AS (
                    SELECT 
                        SUM(total_received) as total_specimens,
                        SUM(rejected) as total_rejected,
                        ROUND(SUM(rejected)::float / NULLIF(SUM(total_received), 0) * 100, 2) as rejection_rate
                    FROM rejection_stats
                ),
                by_type AS (
                    SELECT 
                        specimen_type,
                        SUM(total_received) as received,
                        SUM(rejected) as rejected,
                        ROUND(SUM(rejected)::float / NULLIF(SUM(total_received), 0) * 100, 2) as rejection_rate
                    FROM rejection_stats
                    GROUP BY specimen_type
                    ORDER BY rejection_rate DESC
                ),
                by_reason AS (
                    SELECT 
                        rejection_reason,
                        SUM(rejected_by_reason) as count
                    FROM rejection_stats
                    WHERE rejection_reason IS NOT NULL
                    GROUP BY rejection_reason
                    ORDER BY count DESC
                    LIMIT 5
                )
                SELECT 
                    (SELECT row_to_json(summary.*) FROM summary) as summary,
                    (SELECT json_agg(by_type.*) FROM by_type) as by_type,
                    (SELECT json_agg(by_reason.*) FROM by_reason) as by_reason
            `;

            const result = await db.query(query);
            const data = result.rows[0];

            return {
                summary: data?.summary || {
                    total_specimens: 0,
                    total_rejected: 0,
                    rejection_rate: 0
                },
                by_type: data?.by_type || [],
                by_reason: data?.by_reason || []
            };
        } catch (error) {
            logger.error('Error in getSpecimenRejectionAnalysis', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get instrument utilization
     * GET /api/v1/dashboard/lab/instrument-utilization
     */
    async getInstrumentUtilization(technicianId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND usage_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND usage_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    e.name as instrument_name,
                    e.model,
                    COUNT(DISTINCT tr.id) as tests_performed,
                    COUNT(DISTINCT DATE(tr.tested_at)) as days_used,
                    ROUND(COUNT(DISTINCT tr.id)::float / 30, 1) as avg_tests_per_day,
                    e.status,
                    e.last_calibration_date,
                    e.next_calibration_date
                FROM test_results tr
                JOIN equipment e ON tr.instrument_id = e.id
                WHERE tr.is_deleted = false
                    AND e.department_id IN (
                        SELECT id FROM departments WHERE name = 'Laboratory'
                    )
                    ${dateFilter}
                GROUP BY e.id, e.name, e.model, e.status, e.last_calibration_date, e.next_calibration_date
                ORDER BY tests_performed DESC
            `;

            const result = await db.query(query);
            
            return result.rows.map(row => ({
                instrument_name: row.instrument_name,
                model: row.model,
                tests_performed: parseInt(row.tests_performed),
                days_used: parseInt(row.days_used),
                avg_tests_per_day: parseFloat(row.avg_tests_per_day),
                status: row.status,
                last_calibration: row.last_calibration_date,
                next_calibration: row.next_calibration_date,
                calibration_due_days: row.next_calibration_date 
                    ? Math.ceil((new Date(row.next_calibration_date) - new Date()) / (1000 * 60 * 60 * 24))
                    : null
            }));
        } catch (error) {
            logger.error('Error in getInstrumentUtilization', { error: error.message, technicianId });
            throw error;
        }
    }
};

module.exports = labDashboardService;