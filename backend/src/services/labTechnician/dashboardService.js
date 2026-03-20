/**
 * ======================================================================
 * FILE: backend/src/services/labTechnician/dashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Lab Technician dashboard service - Provides comprehensive lab overview.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-16
 * 
 * BUSINESS RULES:
 * - [BR-36] Critical values require immediate notification
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const dashboardService = {
    /**
     * Get main dashboard
     */
    async getDashboard(technicianId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Run all dashboard queries in parallel
            const [
                stats,
                pendingTests,
                criticalResults,
                equipmentStatus,
                todayActivities,
                performance,
                quality,
                alerts
            ] = await Promise.all([
                // Key statistics
                db.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM test_orders WHERE status = 'pending') as pending_orders,
                        (SELECT COUNT(*) FROM test_orders WHERE status = 'processing') as processing_orders,
                        (SELECT COUNT(*) FROM specimens WHERE status = 'collected') as pending_specimens,
                        (SELECT COUNT(*) FROM test_results WHERE is_critical = true AND alert_sent = false) as critical_alerts,
                        (SELECT COUNT(*) FROM equipment WHERE status = 'maintenance') as maintenance_due,
                        (SELECT COUNT(*) FROM equipment WHERE next_calibration_date < NOW()) as calibration_overdue
                `),

                // Pending tests by priority
                db.query(`
                    SELECT 
                        priority,
                        COUNT(*) as count
                    FROM test_orders
                    WHERE status IN ('pending', 'processing')
                    GROUP BY priority
                    ORDER BY 
                        CASE priority
                            WHEN 'stat' THEN 1
                            WHEN 'urgent' THEN 2
                            ELSE 3
                        END
                `),

                // Critical results [BR-36]
                db.query(`
                    SELECT 
                        tr.id, tr.result_value,
                        lt.test_name,
                        p.first_name as patient_first_name,
                        p.last_name as patient_last_name,
                        to.id as order_id,
                        tr.tested_at,
                        EXTRACT(EPOCH FROM (NOW() - tr.tested_at))/60 as minutes_ago
                    FROM test_results tr
                    JOIN tests t ON tr.test_id = t.id
                    JOIN lab_tests lt ON t.test_id = lt.id
                    JOIN patients p ON tr.patient_id = p.id
                    JOIN test_orders to ON t.test_order_id = to.id
                    WHERE tr.is_critical = true 
                        AND (tr.alert_sent = false OR tr.alert_sent IS NULL)
                    ORDER BY tr.tested_at DESC
                    LIMIT 10
                `),

                // Equipment status summary
                db.query(`
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'operational') as operational,
                        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                        COUNT(*) FILTER (WHERE status = 'calibration') as calibration,
                        COUNT(*) FILTER (WHERE status = 'repair') as repair,
                        COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                        COUNT(*) FILTER (WHERE next_calibration_date < NOW()) as calibration_overdue,
                        COUNT(*) FILTER (WHERE next_maintenance_date < NOW()) as maintenance_overdue
                    FROM equipment
                    WHERE is_deleted = false
                `),

                // Today's activities
                db.query(`
                    SELECT 
                        COUNT(*) FILTER (WHERE DATE(collection_date) = CURRENT_DATE) as specimens_collected,
                        COUNT(*) FILTER (WHERE DATE(received_date) = CURRENT_DATE) as specimens_received,
                        COUNT(*) FILTER (WHERE DATE(completed_at) = CURRENT_DATE) as tests_completed,
                        COUNT(*) FILTER (WHERE DATE(tested_at) = CURRENT_DATE) as results_entered
                    FROM test_orders to
                    FULL JOIN test_results tr ON DATE(tr.tested_at) = CURRENT_DATE
                `),

                // Performance metrics
                db.query(`
                    WITH daily_stats AS (
                        SELECT 
                            DATE(completed_at) as date,
                            COUNT(*) as completed,
                            AVG(EXTRACT(EPOCH FROM (completed_at - collection_date))/3600)::numeric(10,2) as avg_turnaround
                        FROM test_orders
                        WHERE completed_at > NOW() - INTERVAL '30 days'
                            AND collection_date IS NOT NULL
                        GROUP BY DATE(completed_at)
                    )
                    SELECT 
                        AVG(completed) as avg_daily_completed,
                        AVG(avg_turnaround) as avg_turnaround_hours,
                        SUM(completed) as total_completed_30d,
                        COUNT(*) FILTER (WHERE avg_turnaround > 24) as exceeded_24h_count
                    FROM daily_stats
                `),

                // Quality metrics
                db.query(`
                    SELECT 
                        COUNT(*) as total_qc,
                        COUNT(*) FILTER (WHERE status = 'passed') as passed_qc,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed_qc,
                        (COUNT(*) FILTER (WHERE status = 'passed')::float / NULLIF(COUNT(*), 0) * 100)::numeric(5,2) as pass_rate
                    FROM quality_control
                    WHERE performed_at > NOW() - INTERVAL '30 days'
                `),

                // All alerts
                this.getAllAlerts(technicianId)
            ]);

            return {
                statistics: {
                    pending_orders: parseInt(stats.rows[0]?.pending_orders || 0),
                    processing_orders: parseInt(stats.rows[0]?.processing_orders || 0),
                    pending_specimens: parseInt(stats.rows[0]?.pending_specimens || 0),
                    critical_alerts: parseInt(stats.rows[0]?.critical_alerts || 0),
                    maintenance_due: parseInt(stats.rows[0]?.maintenance_due || 0),
                    calibration_overdue: parseInt(stats.rows[0]?.calibration_overdue || 0)
                },
                pending_by_priority: pendingTests.rows,
                critical_results: criticalResults.rows,
                equipment: {
                    total: parseInt(equipmentStatus.rows[0]?.total || 0),
                    operational: parseInt(equipmentStatus.rows[0]?.operational || 0),
                    maintenance: parseInt(equipmentStatus.rows[0]?.maintenance || 0),
                    calibration: parseInt(equipmentStatus.rows[0]?.calibration || 0),
                    repair: parseInt(equipmentStatus.rows[0]?.repair || 0),
                    out_of_service: parseInt(equipmentStatus.rows[0]?.out_of_service || 0),
                    calibration_overdue: parseInt(equipmentStatus.rows[0]?.calibration_overdue || 0),
                    maintenance_overdue: parseInt(equipmentStatus.rows[0]?.maintenance_overdue || 0)
                },
                today: {
                    specimens_collected: parseInt(todayActivities.rows[0]?.specimens_collected || 0),
                    specimens_received: parseInt(todayActivities.rows[0]?.specimens_received || 0),
                    tests_completed: parseInt(todayActivities.rows[0]?.tests_completed || 0),
                    results_entered: parseInt(todayActivities.rows[0]?.results_entered || 0)
                },
                performance: {
                    avg_daily_completed: parseFloat(performance.rows[0]?.avg_daily_completed || 0),
                    avg_turnaround_hours: parseFloat(performance.rows[0]?.avg_turnaround_hours || 0),
                    total_completed_30d: parseInt(performance.rows[0]?.total_completed_30d || 0),
                    exceeded_24h_count: parseInt(performance.rows[0]?.exceeded_24h_count || 0)
                },
                quality: {
                    total_qc: parseInt(quality.rows[0]?.total_qc || 0),
                    passed_qc: parseInt(quality.rows[0]?.passed_qc || 0),
                    failed_qc: parseInt(quality.rows[0]?.failed_qc || 0),
                    pass_rate: parseFloat(quality.rows[0]?.pass_rate || 0)
                },
                alerts: alerts,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get pending counts
     */
    async getPendingCount(technicianId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE priority = 'stat') as stat,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
                    COUNT(*) FILTER (WHERE priority = 'routine') as routine,
                    COUNT(*) FILTER (WHERE status = 'pending') as pending,
                    COUNT(*) FILTER (WHERE status = 'processing') as processing
                FROM test_orders
                WHERE status NOT IN ('completed', 'cancelled')
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPendingCount', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get pending by priority
     */
    async getPendingByPriority(technicianId) {
        try {
            const query = `
                SELECT 
                    priority,
                    COUNT(*) as count,
                    json_agg(
                        json_build_object(
                            'id', id,
                            'order_number', order_number,
                            'patient_name', CONCAT(p.first_name, ' ', p.last_name),
                            'order_date', order_date,
                            'hours_pending', EXTRACT(EPOCH FROM (NOW() - order_date))/3600
                        ) ORDER BY order_date
                    ) as orders
                FROM test_orders to
                JOIN patients p ON to.patient_id = p.id
                WHERE status NOT IN ('completed', 'cancelled')
                GROUP BY priority
                ORDER BY 
                    CASE priority
                        WHEN 'stat' THEN 1
                        WHEN 'urgent' THEN 2
                        ELSE 3
                    END
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPendingByPriority', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get pending by type
     */
    async getPendingByType(technicianId) {
        try {
            const query = `
                SELECT 
                    lt.category,
                    COUNT(*) as count
                FROM test_orders to
                JOIN tests t ON to.id = t.test_order_id
                JOIN lab_tests lt ON t.test_id = lt.id
                WHERE to.status NOT IN ('completed', 'cancelled')
                GROUP BY lt.category
                ORDER BY count DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPendingByType', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get critical alerts [BR-36]
     */
    async getCriticalAlerts(technicianId) {
        try {
            const query = `
                SELECT 
                    tr.id,
                    tr.result_value,
                    lt.test_name,
                    lt.category,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.phone as patient_phone,
                    to.id as order_id,
                    to.priority,
                    tr.tested_at,
                    EXTRACT(EPOCH FROM (NOW() - tr.tested_at))/60 as minutes_ago,
                    CASE 
                        WHEN tr.is_panic THEN 'panic'
                        ELSE 'critical'
                    END as severity,
                    tr.alert_sent,
                    tr.alert_sent_at
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                JOIN test_orders to ON t.test_order_id = to.id
                WHERE tr.is_critical = true
                    AND (tr.alert_sent = false OR tr.alert_sent IS NULL)
                ORDER BY 
                    CASE 
                        WHEN tr.is_panic THEN 1
                        ELSE 2
                    END,
                    tr.tested_at DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCriticalAlerts', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get critical alerts history
     */
    async getCriticalAlertsHistory(technicianId, days = 7) {
        try {
            const query = `
                SELECT 
                    DATE(tr.tested_at) as date,
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE tr.is_panic = true) as panic,
                    COUNT(*) FILTER (WHERE tr.alert_sent = true) as alerted
                FROM test_results tr
                WHERE tr.is_critical = true
                    AND tr.tested_at > NOW() - INTERVAL '${days} days'
                GROUP BY DATE(tr.tested_at)
                ORDER BY date DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getCriticalAlertsHistory', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get equipment status
     */
    async getEquipmentStatus(technicianId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'operational') as operational,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'calibration') as calibration,
                    COUNT(*) FILTER (WHERE status = 'repair') as repair,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                    COUNT(*) FILTER (WHERE next_calibration_date < NOW()) as calibration_overdue,
                    COUNT(*) FILTER (WHERE next_maintenance_date < NOW()) as maintenance_overdue,
                    json_agg(
                        json_build_object(
                            'id', id,
                            'name', name,
                            'status', status,
                            'next_calibration', next_calibration_date,
                            'next_maintenance', next_maintenance_date
                        ) FILTER (WHERE status != 'operational' OR next_calibration_date < NOW() + INTERVAL '7 days')
                    ) as attention_needed
                FROM equipment
                WHERE is_deleted = false
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getEquipmentStatus', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get equipment needing attention
     */
    async getEquipmentNeedingAttention(technicianId) {
        try {
            const query = `
                SELECT 
                    id, name, model, serial_number,
                    status, location,
                    next_calibration_date,
                    next_maintenance_date,
                    CASE 
                        WHEN next_calibration_date < NOW() THEN 'Calibration overdue'
                        WHEN next_calibration_date <= NOW() + INTERVAL '7 days' THEN 'Calibration due soon'
                        WHEN next_maintenance_date < NOW() THEN 'Maintenance overdue'
                        WHEN next_maintenance_date <= NOW() + INTERVAL '7 days' THEN 'Maintenance due soon'
                        WHEN status != 'operational' THEN status
                        ELSE NULL
                    END as reason,
                    EXTRACT(DAY FROM (next_calibration_date - NOW())) as days_to_calibration,
                    EXTRACT(DAY FROM (next_maintenance_date - NOW())) as days_to_maintenance
                FROM equipment
                WHERE is_deleted = false
                    AND (
                        status != 'operational'
                        OR next_calibration_date < NOW() + INTERVAL '7 days'
                        OR next_maintenance_date < NOW() + INTERVAL '7 days'
                    )
                ORDER BY 
                    CASE 
                        WHEN next_calibration_date < NOW() THEN 1
                        WHEN next_maintenance_date < NOW() THEN 2
                        ELSE 3
                    END,
                    next_calibration_date,
                    next_maintenance_date
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getEquipmentNeedingAttention', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get today's activities
     */
    async getTodaysActivities(technicianId) {
        try {
            const query = `
                WITH today_stats AS (
                    SELECT 
                        COUNT(*) FILTER (WHERE DATE(collection_date) = CURRENT_DATE) as specimens_collected,
                        COUNT(*) FILTER (WHERE DATE(received_date) = CURRENT_DATE) as specimens_received,
                        COUNT(*) FILTER (WHERE DATE(completed_at) = CURRENT_DATE) as tests_completed,
                        COUNT(*) FILTER (WHERE DATE(tested_at) = CURRENT_DATE) as results_entered,
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'type', 'specimen',
                                'id', s.id,
                                'code', s.specimen_code,
                                'time', s.collection_date,
                                'patient', CONCAT(p.first_name, ' ', p.last_name)
                            )
                        ) FILTER (WHERE DATE(s.collection_date) = CURRENT_DATE) as collected_specimens,
                        json_agg(
                            DISTINCT jsonb_build_object(
                                'type', 'result',
                                'id', tr.id,
                                'test', lt.test_name,
                                'time', tr.tested_at,
                                'patient', CONCAT(pat.first_name, ' ', pat.last_name)
                            )
                        ) FILTER (WHERE DATE(tr.tested_at) = CURRENT_DATE) as entered_results
                    FROM test_orders to
                    FULL JOIN specimens s ON to.id = s.test_order_id AND DATE(s.collection_date) = CURRENT_DATE
                    FULL JOIN test_results tr ON DATE(tr.tested_at) = CURRENT_DATE
                    FULL JOIN tests t ON tr.test_id = t.id
                    FULL JOIN lab_tests lt ON t.test_id = lt.id
                    FULL JOIN patients p ON s.patient_id = p.id
                    FULL JOIN patients pat ON tr.patient_id = pat.id
                )
                SELECT * FROM today_stats
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getTodaysActivities', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get today's test counts
     */
    async getTodaysTestCounts(technicianId) {
        try {
            const query = `
                SELECT 
                    EXTRACT(HOUR FROM completed_at) as hour,
                    COUNT(*) as count
                FROM test_orders
                WHERE DATE(completed_at) = CURRENT_DATE
                GROUP BY EXTRACT(HOUR FROM completed_at)
                ORDER BY hour
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTodaysTestCounts', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get performance metrics
     */
    async getPerformanceMetrics(technicianId, period = 'week') {
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
                    interval = "INTERVAL '7 days'";
            }

            const query = `
                WITH daily_performance AS (
                    SELECT 
                        DATE(completed_at) as date,
                        COUNT(*) as tests_completed,
                        AVG(EXTRACT(EPOCH FROM (completed_at - collection_date))/3600)::numeric(10,2) as avg_turnaround,
                        COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (completed_at - collection_date))/3600 <= 24) as within_24h,
                        COUNT(*) FILTER (WHERE priority = 'stat') as stat_completed
                    FROM test_orders
                    WHERE completed_at > NOW() - ${interval}
                        AND collection_date IS NOT NULL
                    GROUP BY DATE(completed_at)
                )
                SELECT 
                    json_agg(daily_performance.* ORDER BY date) as daily,
                    AVG(tests_completed) as avg_daily_tests,
                    AVG(avg_turnaround) as overall_avg_turnaround,
                    SUM(within_24h)::float / NULLIF(SUM(tests_completed), 0) * 100 as within_24h_percentage
                FROM daily_performance
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPerformanceMetrics', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get turnaround metrics [BR-39]
     */
    async getTurnaroundMetrics(technicianId, days = 30) {
        try {
            const query = `
                WITH turnaround_data AS (
                    SELECT 
                        to.id,
                        to.priority,
                        to.collection_date,
                        to.completed_at,
                        EXTRACT(EPOCH FROM (to.completed_at - to.collection_date))/3600 as hours,
                        lt.category
                    FROM test_orders to
                    JOIN tests t ON to.id = t.test_order_id
                    JOIN lab_tests lt ON t.test_id = lt.id
                    WHERE to.completed_at > NOW() - INTERVAL '${days} days'
                        AND to.collection_date IS NOT NULL
                )
                SELECT 
                    AVG(hours)::numeric(10,2) as avg_hours,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hours) as median_hours,
                    MIN(hours)::numeric(10,2) as min_hours,
                    MAX(hours)::numeric(10,2) as max_hours,
                    COUNT(*) FILTER (WHERE hours <= 24) as within_24h,
                    COUNT(*) FILTER (WHERE hours > 24) as exceeding_24h,
                    COUNT(*) as total,
                    json_agg(
                        json_build_object(
                            'priority', priority,
                            'avg_hours', AVG(hours) OVER (PARTITION BY priority)
                        )
                    ) FILTER (WHERE priority IS NOT NULL) as by_priority,
                    json_agg(
                        json_build_object(
                            'category', category,
                            'avg_hours', AVG(hours) OVER (PARTITION BY category)
                        )
                    ) FILTER (WHERE category IS NOT NULL) as by_category
                FROM turnaround_data
                GROUP BY priority, category
            `;

            const result = await db.query(query);
            
            const data = result.rows[0];
            if (data) {
                data.within_24h_percentage = data.total > 0 
                    ? (data.within_24h / data.total * 100).toFixed(2)
                    : 0;
            }

            return data;
        } catch (error) {
            logger.error('Error in getTurnaroundMetrics', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get accuracy metrics
     */
    async getAccuracyMetrics(technicianId, days = 30) {
        try {
            const query = `
                WITH result_stats AS (
                    SELECT 
                        COUNT(*) as total_results,
                        COUNT(*) FILTER (WHERE is_abnormal = true) as abnormal,
                        COUNT(*) FILTER (WHERE is_critical = true) as critical,
                        COUNT(*) FILTER (WHERE verified_by IS NOT NULL) as verified,
                        COUNT(*) FILTER (WHERE approved_by IS NOT NULL) as approved
                    FROM test_results
                    WHERE tested_at > NOW() - INTERVAL '${days} days'
                ),
                correction_stats AS (
                    SELECT 
                        COUNT(*) as total_corrections,
                        COUNT(DISTINCT test_id) as tests_with_corrections
                    FROM result_corrections
                    WHERE corrected_at > NOW() - INTERVAL '${days} days'
                )
                SELECT 
                    rs.*,
                    cs.total_corrections,
                    cs.tests_with_corrections,
                    (cs.total_corrections::float / NULLIF(rs.total_results, 0) * 100)::numeric(5,2) as correction_rate,
                    (rs.verified::float / NULLIF(rs.total_results, 0) * 100)::numeric(5,2) as verification_rate
                FROM result_stats rs, correction_stats cs
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAccuracyMetrics', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get workload analysis
     */
    async getWorkloadAnalysis(technicianId, period = 'day') {
        try {
            let interval;
            let groupBy;
            switch(period) {
                case 'day':
                    interval = "INTERVAL '1 day'";
                    groupBy = "EXTRACT(HOUR FROM created_at)";
                    break;
                case 'week':
                    interval = "INTERVAL '7 days'";
                    groupBy = "EXTRACT(DOW FROM created_at)";
                    break;
                case 'month':
                    interval = "INTERVAL '30 days'";
                    groupBy = "EXTRACT(DAY FROM created_at)";
                    break;
                default:
                    interval = "INTERVAL '7 days'";
                    groupBy = "EXTRACT(DOW FROM created_at)";
            }

            const query = `
                SELECT 
                    ${groupBy} as period,
                    COUNT(*) FILTER (WHERE DATE(collection_date) = CURRENT_DATE) as collections,
                    COUNT(*) FILTER (WHERE DATE(received_date) = CURRENT_DATE) as receptions,
                    COUNT(*) FILTER (WHERE DATE(completed_at) = CURRENT_DATE) as completions
                FROM test_orders
                WHERE created_at > NOW() - ${interval}
                GROUP BY period
                ORDER BY period
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getWorkloadAnalysis', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get peak hours
     */
    async getPeakHours(technicianId) {
        try {
            const query = `
                SELECT 
                    EXTRACT(HOUR FROM completed_at) as hour,
                    COUNT(*) as completions,
                    AVG(COUNT(*)) OVER() as avg_completions
                FROM test_orders
                WHERE completed_at > NOW() - INTERVAL '30 days'
                GROUP BY EXTRACT(HOUR FROM completed_at)
                ORDER BY hour
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getPeakHours', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get quality metrics
     */
    async getQualityMetrics(technicianId, days = 30) {
        try {
            const query = `
                WITH qc_stats AS (
                    SELECT 
                        COUNT(*) as total_qc,
                        COUNT(*) FILTER (WHERE status = 'passed') as passed,
                        COUNT(*) FILTER (WHERE status = 'failed') as failed,
                        COUNT(*) FILTER (WHERE status = 'borderline') as borderline
                    FROM quality_control
                    WHERE performed_at > NOW() - INTERVAL '${days} days'
                ),
                rejection_stats AS (
                    SELECT 
                        COUNT(*) as total_rejections,
                        rejection_reason,
                        COUNT(*) as reason_count
                    FROM specimens
                    WHERE rejected_at > NOW() - INTERVAL '${days} days'
                        AND rejection_reason IS NOT NULL
                    GROUP BY rejection_reason
                ),
                retest_stats AS (
                    SELECT 
                        COUNT(*) as total_retests,
                        COUNT(DISTINCT test_id) as tests_retested
                    FROM test_retests
                    WHERE retested_at > NOW() - INTERVAL '${days} days'
                )
                SELECT 
                    (SELECT * FROM qc_stats) as qc,
                    (SELECT json_agg(rejection_stats.*) FROM rejection_stats) as rejections,
                    (SELECT * FROM retest_stats) as retests
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getQualityMetrics', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get rejection analysis
     */
    async getRejectionAnalysis(technicianId, days = 30) {
        try {
            const query = `
                SELECT 
                    rejection_reason,
                    COUNT(*) as count,
                    specimen_type,
                    COUNT(*) as type_count
                FROM specimens
                WHERE rejected_at > NOW() - INTERVAL '${days} days'
                    AND rejection_reason IS NOT NULL
                GROUP BY ROLLUP(rejection_reason, specimen_type)
                ORDER BY rejection_reason, specimen_type
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getRejectionAnalysis', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get equipment utilization
     */
    async getEquipmentUtilization(technicianId, days = 30) {
        try {
            const query = `
                SELECT 
                    e.id, e.name, e.model,
                    COUNT(u.id) as usage_count,
                    SUM(u.duration_minutes) as total_minutes,
                    AVG(u.duration_minutes) as avg_duration,
                    MAX(u.used_at) as last_used
                FROM equipment e
                LEFT JOIN equipment_usage u ON e.id = u.equipment_id
                    AND u.used_at > NOW() - INTERVAL '${days} days'
                WHERE e.is_deleted = false
                GROUP BY e.id
                ORDER BY usage_count DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getEquipmentUtilization', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get technician utilization
     */
    async getTechnicianUtilization(technicianId, days = 30) {
        try {
            const query = `
                SELECT 
                    e.id, e.first_name, e.last_name,
                    COUNT(DISTINCT to.id) as orders_processed,
                    COUNT(DISTINCT tr.id) as results_entered,
                    COUNT(DISTINCT s.id) as specimens_handled
                FROM employees e
                LEFT JOIN test_orders to ON e.id = to.completed_by
                    AND to.completed_at > NOW() - INTERVAL '${days} days'
                LEFT JOIN test_results tr ON e.id = tr.tested_by
                    AND tr.tested_at > NOW() - INTERVAL '${days} days'
                LEFT JOIN specimens s ON e.id = s.collected_by
                    AND s.collection_date > NOW() - INTERVAL '${days} days'
                WHERE e.designation = 'Lab Technician'
                GROUP BY e.id
                ORDER BY orders_processed DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTechnicianUtilization', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get test volume trends
     */
    async getTestVolumeTrends(technicianId, months = 6) {
        try {
            const query = `
                SELECT 
                    DATE_TRUNC('month', completed_at) as month,
                    COUNT(*) as total_tests,
                    COUNT(*) FILTER (WHERE priority = 'stat') as stat_tests,
                    COUNT(*) FILTER (WHERE priority = 'urgent') as urgent_tests,
                    AVG(EXTRACT(EPOCH FROM (completed_at - collection_date))/3600)::numeric(10,2) as avg_turnaround
                FROM test_orders
                WHERE completed_at > NOW() - INTERVAL '${months} months'
                    AND collection_date IS NOT NULL
                GROUP BY DATE_TRUNC('month', completed_at)
                ORDER BY month DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTestVolumeTrends', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get test distribution
     */
    async getTestDistribution(technicianId, days = 30) {
        try {
            const query = `
                SELECT 
                    lt.category,
                    lt.test_name,
                    COUNT(*) as count,
                    COUNT(*) FILTER (WHERE to.priority = 'stat') as stat_count,
                    COUNT(*) FILTER (WHERE to.priority = 'urgent') as urgent_count
                FROM test_orders to
                JOIN tests t ON to.id = t.test_order_id
                JOIN lab_tests lt ON t.test_id = lt.id
                WHERE to.completed_at > NOW() - INTERVAL '${days} days'
                GROUP BY lt.category, lt.test_name
                ORDER BY category, count DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTestDistribution', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get notifications
     */
    async getNotifications(technicianId, options = {}) {
        try {
            const { page = 1, limit = 20, unread_only = false } = options;
            const offset = (page - 1) * limit;

            let query = `
                SELECT * FROM lab_notifications
                WHERE technician_id = $1
            `;
            const values = [technicianId];
            let paramIndex = 2;

            if (unread_only) {
                query += ` AND read_at IS NULL`;
            }

            query += ` ORDER BY created_at DESC
                      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            values.push(limit, offset);

            const result = await db.query(query, values);

            const unreadQuery = `
                SELECT COUNT(*) as unread_count
                FROM lab_notifications
                WHERE technician_id = $1 AND read_at IS NULL
            `;
            const unread = await db.query(unreadQuery, [technicianId]);

            const countQuery = `
                SELECT COUNT(*) as total
                FROM lab_notifications
                WHERE technician_id = $1
            `;
            const count = await db.query(countQuery, [technicianId]);

            return {
                data: result.rows,
                unread_count: parseInt(unread.rows[0].unread_count),
                pagination: {
                    page,
                    limit,
                    total: parseInt(count.rows[0].total)
                }
            };
        } catch (error) {
            logger.error('Error in getNotifications', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Mark notification as read
     */
    async markNotificationRead(technicianId, notificationId) {
        try {
            const query = `
                UPDATE lab_notifications
                SET read_at = NOW()
                WHERE id = $1 AND technician_id = $2
                RETURNING *
            `;

            const result = await db.query(query, [notificationId, technicianId]);
            
            if (result.rows.length === 0) {
                throw new Error('Notification not found');
            }

            return result.rows[0];
        } catch (error) {
            logger.error('Error in markNotificationRead', { error: error.message, technicianId, notificationId });
            throw error;
        }
    },

    /**
     * Mark all notifications as read
     */
    async markAllNotificationsRead(technicianId) {
        try {
            const query = `
                UPDATE lab_notifications
                SET read_at = NOW()
                WHERE technician_id = $1 AND read_at IS NULL
                RETURNING id
            `;

            const result = await db.query(query, [technicianId]);
            return result.rowCount;
        } catch (error) {
            logger.error('Error in markAllNotificationsRead', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get quick stats
     */
    async getQuickStats(technicianId) {
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM test_orders WHERE status = 'pending') as pending_tests,
                    (SELECT COUNT(*) FROM test_orders WHERE status = 'processing') as processing_tests,
                    (SELECT COUNT(*) FROM specimens WHERE status = 'collected') as pending_specimens,
                    (SELECT COUNT(*) FROM test_results WHERE is_critical = true AND alert_sent = false) as critical_results,
                    (SELECT COUNT(*) FROM equipment WHERE status = 'maintenance') as maintenance_due,
                    (SELECT COUNT(*) FROM quality_control WHERE status = 'failed' AND performed_at > NOW() - INTERVAL '7 days') as failed_qc_week
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getQuickStats', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get stats by department
     */
    async getStatsByDepartment(technicianId, days = 30) {
        try {
            const query = `
                SELECT 
                    d.name as department,
                    COUNT(DISTINCT to.id) as test_orders,
                    COUNT(DISTINCT s.id) as specimens,
                    COUNT(DISTINCT tr.id) as results
                FROM departments d
                LEFT JOIN test_orders to ON d.id = to.department_id
                    AND to.created_at > NOW() - INTERVAL '${days} days'
                LEFT JOIN specimens s ON to.id = s.test_order_id
                LEFT JOIN test_results tr ON to.id = tr.test_id
                GROUP BY d.id
                ORDER BY test_orders DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getStatsByDepartment', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get stats by category
     */
    async getStatsByCategory(technicianId, days = 30) {
        try {
            const query = `
                SELECT 
                    lt.category,
                    COUNT(DISTINCT to.id) as orders,
                    COUNT(DISTINCT tr.id) as results,
                    COUNT(DISTINCT s.id) as specimens,
                    AVG(EXTRACT(EPOCH FROM (tr.tested_at - s.collection_date))/3600)::numeric(10,2) as avg_turnaround
                FROM lab_tests lt
                LEFT JOIN tests t ON lt.id = t.test_id
                LEFT JOIN test_orders to ON t.test_order_id = to.id
                    AND to.created_at > NOW() - INTERVAL '${days} days'
                LEFT JOIN test_results tr ON t.id = tr.test_id
                LEFT JOIN specimens s ON to.id = s.test_order_id
                GROUP BY lt.category
                ORDER BY orders DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getStatsByCategory', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Export dashboard
     */
    async exportDashboard(technicianId, format, sections) {
        try {
            const dashboardData = {};

            if (sections.includes('all') || sections.includes('statistics')) {
                dashboardData.statistics = (await this.getDashboard(technicianId)).statistics;
            }
            if (sections.includes('alerts') || sections.includes('all')) {
                dashboardData.alerts = await this.getAllAlerts(technicianId);
            }
            if (sections.includes('pending') || sections.includes('all')) {
                dashboardData.pending = await this.getPendingByPriority(technicianId);
            }
            if (sections.includes('equipment') || sections.includes('all')) {
                dashboardData.equipment = await this.getEquipmentStatus(technicianId);
            }
            if (sections.includes('performance') || sections.includes('all')) {
                dashboardData.performance = await this.getPerformanceMetrics(technicianId);
            }
            if (sections.includes('quality') || sections.includes('all')) {
                dashboardData.quality = await this.getQualityMetrics(technicianId);
            }
            if (sections.includes('trends') || sections.includes('all')) {
                dashboardData.trends = {
                    volume: await this.getTestVolumeTrends(technicianId),
                    turnaround: await this.getTurnaroundMetrics(technicianId)
                };
            }

            // For now, return JSON
            // TODO: Implement actual PDF/CSV generation
            return dashboardData;
        } catch (error) {
            logger.error('Error in exportDashboard', { error: error.message, technicianId });
            throw error;
        }
    },

    /**
     * Get all alerts
     */
    async getAllAlerts(technicianId) {
        try {
            const query = `
                SELECT 
                    'critical_result' as type,
                    tr.id,
                    lt.test_name,
                    tr.result_value,
                    CONCAT(p.first_name, ' ', p.last_name) as patient_name,
                    tr.tested_at as created_at,
                    'critical' as severity,
                    'Critical value detected' as message
                FROM test_results tr
                JOIN tests t ON tr.test_id = t.id
                JOIN lab_tests lt ON t.test_id = lt.id
                JOIN patients p ON tr.patient_id = p.id
                WHERE tr.is_critical = true AND (tr.alert_sent = false OR tr.alert_sent IS NULL)
                
                UNION ALL
                
                SELECT 
                    'calibration_due' as type,
                    e.id,
                    e.name,
                    NULL as result_value,
                    NULL as patient_name,
                    e.next_calibration_date as created_at,
                    CASE 
                        WHEN e.next_calibration_date < NOW() THEN 'critical'
                        WHEN e.next_calibration_date <= NOW() + INTERVAL '7 days' THEN 'warning'
                        ELSE 'info'
                    END as severity,
                    'Calibration due' as message
                FROM equipment e
                WHERE e.next_calibration_date <= NOW() + INTERVAL '7 days'
                
                UNION ALL
                
                SELECT 
                    'maintenance_due' as type,
                    e.id,
                    e.name,
                    NULL,
                    NULL,
                    e.next_maintenance_date,
                    CASE 
                        WHEN e.next_maintenance_date < NOW() THEN 'critical'
                        WHEN e.next_maintenance_date <= NOW() + INTERVAL '7 days' THEN 'warning'
                        ELSE 'info'
                    END,
                    'Maintenance due'
                FROM equipment e
                WHERE e.next_maintenance_date <= NOW() + INTERVAL '7 days'
                
                UNION ALL
                
                SELECT 
                    'qc_failed' as type,
                    qc.id,
                    lt.test_name,
                    qc.result,
                    NULL,
                    qc.performed_at,
                    'warning' as severity,
                    'QC failed'
                FROM quality_control qc
                JOIN lab_tests lt ON qc.test_id = lt.id
                WHERE qc.status = 'failed' AND qc.performed_at > NOW() - INTERVAL '7 days'
                
                ORDER BY 
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'warning' THEN 2
                        ELSE 3
                    END,
                    created_at DESC
                LIMIT 50
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getAllAlerts', { error: error.message, technicianId });
            throw error;
        }
    }
};

module.exports = dashboardService;