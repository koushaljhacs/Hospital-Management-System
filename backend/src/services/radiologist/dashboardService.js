/**
 * ======================================================================
 * FILE: backend/src/services/radiologist/dashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Radiologist dashboard service - Handles business logic for radiology dashboard.
 * 
 * VERSION: 1.0.0
 * CREATED: 2026-03-21
 * 
 * BUSINESS RULES:
 * - [BR-41] Critical findings require immediate notification
 * - [BR-43] Images must be reviewed within 24 hours
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const dashboardService = {
    /**
     * Get main dashboard data
     */
    async getDashboard(radiologistId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // Run all queries in parallel
            const [
                stats,
                pendingOrders,
                pendingImages,
                criticalFindings,
                recentActivity,
                performanceMetrics,
                equipmentStatus
            ] = await Promise.all([
                // Key statistics
                db.query(`
                    SELECT 
                        (SELECT COUNT(*) FROM radiology_orders 
                         WHERE status = 'pending' AND is_deleted = false) as pending_orders,
                        (SELECT COUNT(*) FROM radiology_orders 
                         WHERE status = 'in_progress' AND is_deleted = false) as in_progress_orders,
                        (SELECT COUNT(*) FROM radiology_orders 
                         WHERE status = 'completed' AND is_deleted = false) as completed_orders,
                        (SELECT COUNT(*) FROM radiology_images 
                         WHERE reported_at IS NULL AND is_deleted = false) as pending_images,
                        (SELECT COUNT(*) FROM radiology_images 
                         WHERE reported_at IS NOT NULL AND is_deleted = false) as reported_images,
                        (SELECT COUNT(*) FROM radiology_reports 
                         WHERE status = 'pending' AND is_deleted = false) as pending_reports,
                        (SELECT COUNT(*) FROM radiology_reports 
                         WHERE status = 'preliminary' AND is_deleted = false) as preliminary_reports,
                        (SELECT COUNT(*) FROM radiology_reports 
                         WHERE status = 'final' AND is_deleted = false) as final_reports
                `),

                // Pending orders with priority
                db.query(`
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE priority = 'stat') as stat,
                        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
                        COUNT(*) FILTER (WHERE is_emergency = true) as emergency,
                        AVG(EXTRACT(EPOCH FROM (NOW() - ordered_at))/3600)::numeric(10,2) as avg_wait_hours
                    FROM radiology_orders
                    WHERE status = 'pending' AND is_deleted = false
                `),

                // Pending images (need review)
                db.query(`
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE uploaded_at < NOW() - INTERVAL '24 hours') as overdue,
                        COUNT(*) FILTER (WHERE priority = 'stat') as stat,
                        COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
                        AVG(EXTRACT(EPOCH FROM (NOW() - uploaded_at))/3600)::numeric(10,2) as avg_wait_hours
                    FROM radiology_images i
                    JOIN radiology_orders o ON i.order_id = o.id
                    WHERE i.reported_at IS NULL 
                        AND i.is_deleted = false 
                        AND o.is_deleted = false
                `),

                // Critical findings
                db.query(`
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE communicated_at IS NULL) as pending_communication,
                        json_agg(
                            json_build_object(
                                'id', id,
                                'patient_name', patient_name,
                                'finding', critical_finding,
                                'created_at', created_at
                            ) ORDER BY created_at DESC
                        ) FILTER (WHERE communicated_at IS NULL) as pending_list
                    FROM radiology_reports
                    WHERE critical_finding IS NOT NULL 
                        AND (communicated_at IS NULL OR critical_finding = true)
                        AND is_deleted = false
                    LIMIT 10
                `),

                // Recent activity
                db.query(`
                    (SELECT 
                        'order' as type,
                        o.id,
                        CONCAT('Order #', o.order_number) as title,
                        CONCAT('Patient: ', p.first_name, ' ', p.last_name) as description,
                        o.ordered_at as created_at
                    FROM radiology_orders o
                    JOIN patients p ON o.patient_id = p.id
                    WHERE o.is_deleted = false
                    ORDER BY o.ordered_at DESC
                    LIMIT 5)
                    
                    UNION ALL
                    
                    (SELECT 
                        'image' as type,
                        i.id,
                        CONCAT('Image uploaded - ', i.image_type) as title,
                        CONCAT('Order #', o.order_number) as description,
                        i.uploaded_at as created_at
                    FROM radiology_images i
                    JOIN radiology_orders o ON i.order_id = o.id
                    WHERE i.is_deleted = false
                    ORDER BY i.uploaded_at DESC
                    LIMIT 5)
                    
                    UNION ALL
                    
                    (SELECT 
                        'report' as type,
                        r.id,
                        CONCAT('Report ', r.status) as title,
                        CONCAT('Findings: ', LEFT(r.findings, 50)) as description,
                        r.created_at
                    FROM radiology_reports r
                    WHERE r.is_deleted = false
                    ORDER BY r.created_at DESC
                    LIMIT 5)
                    
                    ORDER BY created_at DESC
                    LIMIT 15
                `),

                // Performance metrics
                db.query(`
                    WITH daily_stats AS (
                        SELECT 
                            DATE(completed_at) as date,
                            COUNT(*) as completed_orders,
                            AVG(EXTRACT(EPOCH FROM (completed_at - ordered_at))/3600)::numeric(10,2) as avg_turnaround_hours
                        FROM radiology_orders
                        WHERE completed_at > NOW() - INTERVAL '30 days'
                            AND is_deleted = false
                        GROUP BY DATE(completed_at)
                    ),
                    weekly_stats AS (
                        SELECT 
                            DATE_TRUNC('week', completed_at) as week,
                            COUNT(*) as completed_orders,
                            AVG(EXTRACT(EPOCH FROM (completed_at - ordered_at))/3600)::numeric(10,2) as avg_turnaround_hours
                        FROM radiology_orders
                        WHERE completed_at > NOW() - INTERVAL '30 days'
                            AND is_deleted = false
                        GROUP BY DATE_TRUNC('week', completed_at)
                    )
                    SELECT 
                        (SELECT json_agg(daily_stats.* ORDER BY date DESC) FROM daily_stats) as daily,
                        (SELECT json_agg(weekly_stats.* ORDER BY week DESC) FROM weekly_stats) as weekly,
                        (SELECT 
                            json_build_object(
                                'total_orders', COUNT(*),
                                'avg_turnaround_hours', AVG(EXTRACT(EPOCH FROM (completed_at - ordered_at))/3600),
                                'on_time_rate', (COUNT(*) FILTER (WHERE completed_at <= ordered_at + INTERVAL '24 hours')::float / COUNT(*) * 100)::numeric(5,2)
                            )
                        FROM radiology_orders
                        WHERE completed_at > NOW() - INTERVAL '30 days'
                            AND is_deleted = false
                        ) as summary
                `),

                // Equipment status
                db.query(`
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'operational') as operational,
                        COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                        COUNT(*) FILTER (WHERE status = 'calibration_due') as calibration_due,
                        COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                        json_agg(
                            json_build_object(
                                'id', id,
                                'name', name,
                                'type', type,
                                'status', status,
                                'location', location
                            ) ORDER BY name
                        ) FILTER (WHERE status != 'operational') as issues
                    FROM radiology_equipment
                    WHERE is_deleted = false
                `)
            ]);

            return {
                statistics: {
                    pending_orders: parseInt(stats.rows[0]?.pending_orders || 0),
                    in_progress_orders: parseInt(stats.rows[0]?.in_progress_orders || 0),
                    completed_orders: parseInt(stats.rows[0]?.completed_orders || 0),
                    pending_images: parseInt(stats.rows[0]?.pending_images || 0),
                    reported_images: parseInt(stats.rows[0]?.reported_images || 0),
                    pending_reports: parseInt(stats.rows[0]?.pending_reports || 0),
                    preliminary_reports: parseInt(stats.rows[0]?.preliminary_reports || 0),
                    final_reports: parseInt(stats.rows[0]?.final_reports || 0)
                },
                pending_orders: {
                    total: parseInt(pendingOrders.rows[0]?.total || 0),
                    stat: parseInt(pendingOrders.rows[0]?.stat || 0),
                    urgent: parseInt(pendingOrders.rows[0]?.urgent || 0),
                    emergency: parseInt(pendingOrders.rows[0]?.emergency || 0),
                    avg_wait_hours: parseFloat(pendingOrders.rows[0]?.avg_wait_hours || 0)
                },
                pending_images: {
                    total: parseInt(pendingImages.rows[0]?.total || 0),
                    overdue: parseInt(pendingImages.rows[0]?.overdue || 0),
                    stat: parseInt(pendingImages.rows[0]?.stat || 0),
                    urgent: parseInt(pendingImages.rows[0]?.urgent || 0),
                    avg_wait_hours: parseFloat(pendingImages.rows[0]?.avg_wait_hours || 0)
                },
                critical_findings: {
                    total: parseInt(criticalFindings.rows[0]?.total || 0),
                    pending_communication: parseInt(criticalFindings.rows[0]?.pending_communication || 0),
                    pending_list: criticalFindings.rows[0]?.pending_list || []
                },
                recent_activity: recentActivity.rows,
                performance: {
                    daily_trends: performanceMetrics.rows[0]?.daily || [],
                    weekly_trends: performanceMetrics.rows[0]?.weekly || [],
                    summary: performanceMetrics.rows[0]?.summary || {
                        total_orders: 0,
                        avg_turnaround_hours: 0,
                        on_time_rate: 0
                    }
                },
                equipment: {
                    total: parseInt(equipmentStatus.rows[0]?.total || 0),
                    operational: parseInt(equipmentStatus.rows[0]?.operational || 0),
                    maintenance: parseInt(equipmentStatus.rows[0]?.maintenance || 0),
                    calibration_due: parseInt(equipmentStatus.rows[0]?.calibration_due || 0),
                    out_of_service: parseInt(equipmentStatus.rows[0]?.out_of_service || 0),
                    issues: equipmentStatus.rows[0]?.issues || []
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, radiologistId });
            throw error;
        }
    }
};

module.exports = dashboardService;