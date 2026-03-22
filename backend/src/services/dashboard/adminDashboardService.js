/**
 * ======================================================================
 * FILE: backend/src/services/dashboard/adminDashboardService.js
 * ======================================================================
 * 
 * PROJECT: Hospital Management System
 * TEAM: OctNov
 * LEAD ARCHITECT: Koushal Jha
 * BACKEND DEVELOPER: Koushal Jha
 * 
 * DESCRIPTION:
 * Admin dashboard service - Handles business logic for admin dashboard.
 * Provides comprehensive system overview, user analytics, financial insights,
 * and operational metrics for super_admin and it_admin roles.
 * 
 * VERSION: 1.1.0
 * CREATED: 2026-03-22
 * UPDATED: 2026-03-22
 * 
 * CHANGE LOG:
 * v1.0.0 - Initial implementation with basic dashboard metrics
 * v1.1.0 - Added financial summary, department stats, doctor performance,
 *          lab stats, pharmacy stats, and daily/weekly/monthly trends
 * 
 * ENDPOINTS SUPPORTED:
 * - GET /api/v1/dashboard/admin - Main dashboard
 * - GET /api/v1/dashboard/admin/stats - Key statistics
 * - GET /api/v1/dashboard/admin/users - User statistics
 * - GET /api/v1/dashboard/admin/revenue - Revenue statistics
 * - GET /api/v1/dashboard/admin/appointments - Appointment statistics
 * - GET /api/v1/dashboard/admin/patients - Patient statistics
 * - GET /api/v1/dashboard/admin/beds - Bed occupancy statistics
 * - GET /api/v1/dashboard/admin/inventory - Inventory statistics
 * - GET /api/v1/dashboard/admin/performance - Performance metrics
 * - GET /api/v1/dashboard/admin/alerts - System alerts
 * - GET /api/v1/dashboard/admin/financial-summary - Financial summary
 * - GET /api/v1/dashboard/admin/department-stats - Department statistics
 * - GET /api/v1/dashboard/admin/doctor-performance - Doctor performance
 * - GET /api/v1/dashboard/admin/lab-stats - Laboratory statistics
 * - GET /api/v1/dashboard/admin/pharmacy-stats - Pharmacy statistics
 * - GET /api/v1/dashboard/admin/trends - Daily/weekly/monthly trends
 * 
 * BUSINESS RULES COVERED:
 * - [BR-30] Invoice number uniqueness tracking
 * - [BR-31] Payment verification monitoring
 * - [BR-32] Refund processing analytics
 * - [BR-33] Insurance claim tracking
 * - [BR-34] Discount usage analytics
 * - [BR-35] Tax collection summary
 * 
 * ======================================================================
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

const adminDashboardService = {
    /**
     * Get admin main dashboard
     * GET /api/v1/dashboard/admin
     */
    async getDashboard(adminId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const [
                keyStats,
                userStats,
                revenueStats,
                appointmentStats,
                patientStats,
                bedStats,
                inventoryStats,
                performanceMetrics,
                systemAlerts,
                financialSummary,
                departmentStats,
                doctorPerformance,
                labStats,
                pharmacyStats,
                trends
            ] = await Promise.all([
                this.getKeyStats(adminId),
                this.getUserStats(adminId),
                this.getRevenueStats(adminId, { from_date: firstDayOfMonth, to_date: today }),
                this.getAppointmentStats(adminId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getPatientStats(adminId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getBedStats(adminId),
                this.getInventoryStats(adminId),
                this.getPerformanceMetrics(adminId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getSystemAlerts(adminId),
                this.getFinancialSummary(adminId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getDepartmentStats(adminId),
                this.getDoctorPerformance(adminId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getLabStats(adminId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getPharmacyStats(adminId, { from_date: thirtyDaysAgo, to_date: today }),
                this.getTrends(adminId, { from_date: sevenDaysAgo, to_date: today })
            ]);

            return {
                key_statistics: keyStats,
                user_statistics: userStats,
                revenue_statistics: revenueStats,
                appointment_statistics: appointmentStats,
                patient_statistics: patientStats,
                bed_statistics: bedStats,
                inventory_statistics: inventoryStats,
                performance_metrics: performanceMetrics,
                system_alerts: systemAlerts,
                financial_summary: financialSummary,
                department_statistics: departmentStats,
                doctor_performance: doctorPerformance,
                lab_statistics: labStats,
                pharmacy_statistics: pharmacyStats,
                trends: trends,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error in getDashboard', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get key statistics
     * GET /api/v1/dashboard/admin/stats
     */
    async getKeyStats(adminId) {
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM users WHERE is_deleted = false) as total_users,
                    (SELECT COUNT(*) FROM patients WHERE is_deleted = false) as total_patients,
                    (SELECT COUNT(*) FROM employees WHERE is_deleted = false) as total_employees,
                    (SELECT COUNT(*) FROM appointments WHERE is_deleted = false) as total_appointments,
                    (SELECT COUNT(*) FROM invoices WHERE is_deleted = false) as total_invoices,
                    (SELECT COUNT(*) FROM prescriptions WHERE is_deleted = false) as total_prescriptions,
                    (SELECT COUNT(*) FROM lab_tests WHERE is_deleted = false) as total_lab_tests,
                    (SELECT COUNT(*) FROM inventory WHERE is_deleted = false) as total_inventory_items,
                    (SELECT COUNT(*) FROM beds WHERE is_deleted = false) as total_beds,
                    (SELECT COUNT(*) FROM departments WHERE is_deleted = false) as total_departments,
                    (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_week,
                    (SELECT COUNT(*) FROM patients WHERE created_at > NOW() - INTERVAL '7 days') as new_patients_week,
                    (SELECT COUNT(*) FROM appointments WHERE created_at > NOW() - INTERVAL '7 days') as new_appointments_week
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getKeyStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get user statistics
     * GET /api/v1/dashboard/admin/users
     */
    async getUserStats(adminId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(*) FILTER (WHERE role = 'super_admin') as super_admins,
                    COUNT(*) FILTER (WHERE role = 'it_admin') as it_admins,
                    COUNT(*) FILTER (WHERE role = 'billing_admin') as billing_admins,
                    COUNT(*) FILTER (WHERE role = 'doctor') as doctors,
                    COUNT(*) FILTER (WHERE role = 'nurse') as nurses,
                    COUNT(*) FILTER (WHERE role = 'pharmacist') as pharmacists,
                    COUNT(*) FILTER (WHERE role = 'lab_technician') as lab_technicians,
                    COUNT(*) FILTER (WHERE role = 'radiologist') as radiologists,
                    COUNT(*) FILTER (WHERE role = 'receptionist') as receptionists,
                    COUNT(*) FILTER (WHERE role = 'billing_staff') as billing_staff,
                    COUNT(*) FILTER (WHERE role = 'ground_staff') as ground_staff,
                    COUNT(*) FILTER (WHERE role = 'security_guard') as security_guards,
                    COUNT(*) FILTER (WHERE role = 'patient') as patients,
                    COUNT(*) FILTER (WHERE role = 'guest') as guests,
                    COUNT(*) FILTER (WHERE status = 'active') as active_users,
                    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_users,
                    COUNT(*) FILTER (WHERE status = 'locked') as locked_users,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_this_month,
                    COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days') as active_this_week
                FROM users
                WHERE is_deleted = false
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getUserStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get revenue statistics
     * GET /api/v1/dashboard/admin/revenue
     */
    async getRevenueStats(adminId, options = {}) {
        try {
            const { from_date, to_date, period = 'month' } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND i.issue_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND i.issue_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH revenue_data AS (
                    SELECT 
                        DATE_TRUNC('${period}', i.issue_date) as period,
                        COUNT(DISTINCT i.id) as invoice_count,
                        SUM(i.total_amount) as gross_revenue,
                        SUM(i.discount) as total_discount,
                        SUM(i.tax_amount) as total_tax,
                        COUNT(DISTINCT p.id) as payment_count,
                        SUM(p.amount) as collected_amount,
                        COUNT(DISTINCT r.id) as refund_count,
                        SUM(r.refund_amount) as total_refund
                    FROM invoices i
                    LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'completed'
                    LEFT JOIN refunds r ON i.id = r.invoice_id AND r.status = 'completed'
                    WHERE i.is_deleted = false
                        ${dateFilter}
                    GROUP BY DATE_TRUNC('${period}', i.issue_date)
                    ORDER BY period DESC
                ),
                totals AS (
                    SELECT 
                        SUM(gross_revenue) as total_gross_revenue,
                        SUM(total_discount) as total_discount,
                        SUM(total_tax) as total_tax,
                        SUM(collected_amount) as total_collected,
                        SUM(total_refund) as total_refund,
                        COUNT(*) as period_count
                    FROM revenue_data
                )
                SELECT 
                    json_agg(revenue_data.*) as breakdown,
                    (SELECT * FROM totals) as totals
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getRevenueStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get appointment statistics
     * GET /api/v1/dashboard/admin/appointments
     */
    async getAppointmentStats(adminId, options = {}) {
        try {
            const { from_date, to_date, group_by = 'day' } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND appointment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND appointment_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                WITH appointment_data AS (
                    SELECT 
                        DATE_TRUNC('${group_by}', appointment_date) as period,
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
                        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
                        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
                        COUNT(*) FILTER (WHERE status = 'completed') as completed,
                        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                        COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
                        COUNT(*) FILTER (WHERE is_emergency = true) as emergency,
                        AVG(duration_minutes) as avg_duration
                    FROM appointments
                    WHERE is_deleted = false
                        ${dateFilter}
                    GROUP BY DATE_TRUNC('${group_by}', appointment_date)
                    ORDER BY period DESC
                ),
                totals AS (
                    SELECT 
                        SUM(total) as total_appointments,
                        SUM(completed) as completed_appointments,
                        SUM(cancelled) as cancelled_appointments,
                        SUM(no_show) as no_show_appointments,
                        ROUND(SUM(completed)::float / NULLIF(SUM(total), 0) * 100, 2) as completion_rate,
                        ROUND(SUM(cancelled)::float / NULLIF(SUM(total), 0) * 100, 2) as cancellation_rate,
                        ROUND(SUM(no_show)::float / NULLIF(SUM(total), 0) * 100, 2) as no_show_rate,
                        AVG(avg_duration) as avg_consultation_minutes
                    FROM appointment_data
                )
                SELECT 
                    json_agg(appointment_data.*) as breakdown,
                    (SELECT * FROM totals) as totals
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getAppointmentStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get patient statistics
     * GET /api/v1/dashboard/admin/patients
     */
    async getPatientStats(adminId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND created_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND created_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    COUNT(*) as total_patients,
                    COUNT(*) FILTER (WHERE gender = 'male') as male,
                    COUNT(*) FILTER (WHERE gender = 'female') as female,
                    COUNT(*) FILTER (WHERE gender = 'other') as other,
                    COUNT(*) FILTER (WHERE blood_group IS NOT NULL) as blood_group_known,
                    COUNT(*) FILTER (WHERE insurance_provider IS NOT NULL) as insured,
                    AVG(EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)))::numeric(10,2) as avg_age,
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) < 18) as minors,
                    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) >= 60) as seniors,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
                    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_this_month,
                    COUNT(*) FILTER (WHERE emergency_contact_name IS NOT NULL) as has_emergency_contact
                FROM patients
                WHERE is_deleted = false
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPatientStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get bed statistics
     * GET /api/v1/dashboard/admin/beds
     */
    async getBedStats(adminId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_beds,
                    COUNT(*) FILTER (WHERE status = 'available') as available,
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance,
                    COUNT(*) FILTER (WHERE status = 'out_of_service') as out_of_service,
                    COUNT(*) FILTER (WHERE type = 'icu') as icu_beds,
                    COUNT(*) FILTER (WHERE type = 'general') as general_beds,
                    COUNT(*) FILTER (WHERE type = 'emergency') as emergency_beds,
                    COUNT(*) FILTER (WHERE type = 'isolation') as isolation_beds,
                    COUNT(*) FILTER (WHERE type = 'private') as private_beds,
                    ROUND(COUNT(*) FILTER (WHERE status = 'occupied')::float / NULLIF(COUNT(*), 0) * 100, 2) as occupancy_rate,
                    ROUND(COUNT(*) FILTER (WHERE type = 'icu' AND status = 'occupied')::float / NULLIF(COUNT(*) FILTER (WHERE type = 'icu'), 0) * 100, 2) as icu_occupancy_rate
                FROM beds
                WHERE is_deleted = false
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getBedStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get inventory statistics
     * GET /api/v1/dashboard/admin/inventory
     */
    async getInventoryStats(adminId) {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_items,
                    SUM(quantity) as total_quantity,
                    SUM(quantity * unit_price) as total_value,
                    COUNT(*) FILTER (WHERE quantity <= reorder_level) as low_stock_count,
                    COUNT(*) FILTER (WHERE quantity = 0) as out_of_stock_count,
                    COUNT(*) FILTER (WHERE expiry_date < NOW()) as expired_count,
                    COUNT(*) FILTER (WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_count,
                    AVG(unit_price) as avg_unit_price,
                    AVG(selling_price) as avg_selling_price,
                    SUM(quantity * (selling_price - unit_price)) as estimated_profit
                FROM inventory
                WHERE is_deleted = false
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getInventoryStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get performance metrics
     * GET /api/v1/dashboard/admin/performance
     */
    async getPerformanceMetrics(adminId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND created_at BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND created_at > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM appointments WHERE is_deleted = false ${dateFilter}) as total_appointments,
                    (SELECT COUNT(*) FROM appointments WHERE status = 'completed' ${dateFilter}) as completed_appointments,
                    (SELECT COUNT(*) FROM prescriptions WHERE is_deleted = false ${dateFilter}) as total_prescriptions,
                    (SELECT COUNT(*) FROM lab_tests WHERE is_deleted = false ${dateFilter}) as total_lab_tests,
                    (SELECT COUNT(*) FROM invoices WHERE is_deleted = false ${dateFilter}) as total_invoices,
                    (SELECT COUNT(*) FROM payments WHERE status = 'completed' ${dateFilter}) as total_payments,
                    (SELECT COUNT(*) FROM users WHERE created_at ${dateFilter}) as new_users,
                    (SELECT COUNT(*) FROM patients WHERE created_at ${dateFilter}) as new_patients,
                    ROUND(
                        (SELECT COUNT(*) FROM appointments WHERE status = 'completed' ${dateFilter})::float / 
                        NULLIF((SELECT COUNT(*) FROM appointments WHERE is_deleted = false ${dateFilter}), 0) * 100, 2
                    ) as appointment_completion_rate,
                    ROUND(
                        (SELECT AVG(EXTRACT(EPOCH FROM (check_out_time - check_in_time))/3600) FROM attendance WHERE is_deleted = false ${dateFilter})::numeric, 2
                    ) as avg_work_hours,
                    (SELECT COUNT(*) FROM login_attempts WHERE success = false AND attempt_time ${dateFilter}) as failed_logins
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPerformanceMetrics', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get system alerts
     * GET /api/v1/dashboard/admin/alerts
     */
    async getSystemAlerts(adminId) {
        try {
            const query = `
                SELECT 
                    'low_stock' as type,
                    i.id,
                    i.medicine_name as name,
                    i.quantity as current_value,
                    i.reorder_level as threshold,
                    CASE 
                        WHEN i.quantity = 0 THEN 'critical'
                        WHEN i.quantity <= i.minimum_stock THEN 'critical'
                        ELSE 'warning'
                    END as severity,
                    'Low stock alert' as message,
                    NOW() as created_at
                FROM inventory i
                WHERE i.quantity <= i.reorder_level AND i.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'expiring' as type,
                    b.id,
                    i.medicine_name as name,
                    b.quantity as current_value,
                    EXTRACT(DAY FROM (b.expiry_date - NOW())) as threshold,
                    CASE 
                        WHEN b.expiry_date <= NOW() + INTERVAL '7 days' THEN 'critical'
                        WHEN b.expiry_date <= NOW() + INTERVAL '15 days' THEN 'warning'
                        ELSE 'info'
                    END as severity,
                    'Expiring soon' as message,
                    b.created_at
                FROM batches b
                JOIN inventory i ON b.medicine_id = i.id
                WHERE b.expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
                    AND b.quantity > 0
                
                UNION ALL
                
                SELECT 
                    'overdue_invoice' as type,
                    i.id,
                    i.invoice_number as name,
                    i.total_amount - COALESCE(p.paid_amount, 0) as current_value,
                    EXTRACT(DAY FROM (NOW() - i.due_date)) as threshold,
                    CASE 
                        WHEN EXTRACT(DAY FROM (NOW() - i.due_date)) > 90 THEN 'critical'
                        WHEN EXTRACT(DAY FROM (NOW() - i.due_date)) > 30 THEN 'warning'
                        ELSE 'info'
                    END as severity,
                    'Overdue invoice' as message,
                    i.due_date as created_at
                FROM invoices i
                LEFT JOIN (
                    SELECT invoice_id, SUM(amount) as paid_amount
                    FROM payments
                    WHERE status = 'completed'
                    GROUP BY invoice_id
                ) p ON i.id = p.invoice_id
                WHERE i.due_date < NOW() 
                    AND i.status NOT IN ('paid', 'cancelled')
                    AND i.is_deleted = false
                
                UNION ALL
                
                SELECT 
                    'maintenance' as type,
                    id,
                    name as name,
                    EXTRACT(DAY FROM (next_maintenance_date - NOW())) as current_value,
                    EXTRACT(DAY FROM (next_maintenance_date - NOW())) as threshold,
                    CASE 
                        WHEN next_maintenance_date <= NOW() THEN 'critical'
                        WHEN next_maintenance_date <= NOW() + INTERVAL '7 days' THEN 'warning'
                        ELSE 'info'
                    END as severity,
                    'Maintenance due' as message,
                    created_at
                FROM equipment
                WHERE next_maintenance_date <= NOW() + INTERVAL '30 days'
                    AND is_deleted = false
                
                ORDER BY 
                    CASE severity
                        WHEN 'critical' THEN 1
                        WHEN 'warning' THEN 2
                        ELSE 3
                    END,
                    created_at DESC
                LIMIT 20
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getSystemAlerts', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get financial summary
     * GET /api/v1/dashboard/admin/financial-summary
     */
    async getFinancialSummary(adminId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND payment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND payment_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END), 0) as cash_payments,
                    COALESCE(SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END), 0) as card_payments,
                    COALESCE(SUM(CASE WHEN payment_method = 'upi' THEN amount ELSE 0 END), 0) as upi_payments,
                    COALESCE(SUM(CASE WHEN payment_method = 'net_banking' THEN amount ELSE 0 END), 0) as net_banking_payments,
                    COALESCE(SUM(CASE WHEN payment_method = 'insurance' THEN amount ELSE 0 END), 0) as insurance_payments,
                    COALESCE(SUM(amount), 0) as total_collections,
                    COUNT(*) as total_transactions,
                    COALESCE(SUM(refund_amount), 0) as total_refunds,
                    COUNT(*) FILTER (WHERE refund_amount > 0) as refund_count
                FROM payments
                WHERE status = 'completed'
                    AND is_deleted = false
                    ${dateFilter}
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getFinancialSummary', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get department statistics
     * GET /api/v1/dashboard/admin/department-stats
     */
    async getDepartmentStats(adminId) {
        try {
            const query = `
                SELECT 
                    d.id,
                    d.name,
                    d.code,
                    COUNT(DISTINCT e.id) as total_doctors,
                    COUNT(DISTINCT e.id) FILTER (WHERE e.is_available = true) as available_doctors,
                    COUNT(DISTINCT a.id) as total_appointments,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed') as completed_appointments,
                    COUNT(DISTINCT p.id) as total_prescriptions,
                    COUNT(DISTINCT lt.id) as total_lab_orders,
                    AVG(a.duration_minutes) as avg_consultation_time,
                    ROUND(COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed')::float / NULLIF(COUNT(DISTINCT a.id), 0) * 100, 2) as completion_rate
                FROM departments d
                LEFT JOIN employees e ON d.id = e.department_id AND e.role = 'doctor'
                LEFT JOIN appointments a ON e.id = a.doctor_id AND a.appointment_date > NOW() - INTERVAL '30 days'
                LEFT JOIN prescriptions p ON a.id = p.appointment_id
                LEFT JOIN lab_orders lo ON a.id = lo.appointment_id
                LEFT JOIN lab_tests lt ON lo.id = lt.order_id
                WHERE d.is_deleted = false
                GROUP BY d.id, d.name, d.code
                ORDER BY total_appointments DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getDepartmentStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get doctor performance
     * GET /api/v1/dashboard/admin/doctor-performance
     */
    async getDoctorPerformance(adminId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND a.appointment_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND a.appointment_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    e.id as doctor_id,
                    e.first_name,
                    e.last_name,
                    e.specialization,
                    COUNT(DISTINCT a.id) as total_appointments,
                    COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed') as completed_appointments,
                    COUNT(DISTINCT p.id) as total_prescriptions,
                    COUNT(DISTINCT lo.id) as total_lab_orders,
                    COUNT(DISTINCT ro.id) as total_radiology_orders,
                    COUNT(DISTINCT a.patient_id) as unique_patients,
                    ROUND(COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'completed')::float / NULLIF(COUNT(DISTINCT a.id), 0) * 100, 2) as completion_rate,
                    AVG(a.duration_minutes) as avg_consultation_minutes,
                    AVG(f.patient_rating) as avg_rating
                FROM employees e
                LEFT JOIN appointments a ON e.id = a.doctor_id ${dateFilter}
                LEFT JOIN prescriptions p ON a.id = p.appointment_id
                LEFT JOIN lab_orders lo ON a.id = lo.appointment_id
                LEFT JOIN radiology_orders ro ON a.id = ro.appointment_id
                LEFT JOIN feedback f ON a.id = f.appointment_id
                WHERE e.role = 'doctor'
                    AND e.is_deleted = false
                GROUP BY e.id, e.first_name, e.last_name, e.specialization
                HAVING COUNT(DISTINCT a.id) > 0
                ORDER BY total_appointments DESC
                LIMIT 20
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getDoctorPerformance', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get laboratory statistics
     * GET /api/v1/dashboard/admin/lab-stats
     */
    async getLabStats(adminId, options = {}) {
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
                    COUNT(DISTINCT tr.id) as total_tests,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.is_abnormal = true) as abnormal_tests,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.is_critical = true) as critical_tests,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'pending') as pending_tests,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'completed') as completed_tests,
                    COUNT(DISTINCT tr.id) FILTER (WHERE tr.status = 'verified') as verified_tests,
                    COUNT(DISTINCT sp.id) as total_specimens,
                    COUNT(DISTINCT sp.id) FILTER (WHERE sp.status = 'rejected') as rejected_specimens,
                    AVG(EXTRACT(EPOCH FROM (tr.tested_at - sp.collection_date))/3600) as avg_turnaround_hours,
                    ROUND(COUNT(DISTINCT tr.id) FILTER (WHERE EXTRACT(EPOCH FROM (tr.tested_at - sp.collection_date)) <= 86400)::float / NULLIF(COUNT(DISTINCT tr.id), 0) * 100, 2) as within_24h_rate
                FROM test_results tr
                LEFT JOIN specimens sp ON tr.test_order_id = sp.test_order_id
                WHERE tr.is_deleted = false
                    ${dateFilter}
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getLabStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get pharmacy statistics
     * GET /api/v1/dashboard/admin/pharmacy-stats
     */
    async getPharmacyStats(adminId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND d.dispense_date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND d.dispense_date > NOW() - INTERVAL '30 days'`;
            }

            const query = `
                SELECT 
                    COUNT(DISTINCT d.id) as total_dispenses,
                    SUM(d.total_items) as total_items_dispensed,
                    SUM(d.total_quantity) as total_quantity_dispensed,
                    SUM(d.total_amount) as total_revenue,
                    COUNT(DISTINCT d.id) FILTER (WHERE d.is_partial = true) as partial_dispenses,
                    COUNT(DISTINCT r.id) as total_returns,
                    SUM(r.quantity) as total_returned_quantity,
                    AVG(d.total_amount) as avg_dispense_value,
                    COUNT(DISTINCT po.id) as total_purchase_orders,
                    SUM(po.total_amount) as total_purchase_value
                FROM dispensing d
                LEFT JOIN returns r ON d.id = r.dispense_id
                LEFT JOIN purchase_orders po ON d.id = po.dispense_id
                WHERE d.is_deleted = false
                    ${dateFilter}
            `;

            const result = await db.query(query);
            return result.rows[0];
        } catch (error) {
            logger.error('Error in getPharmacyStats', { error: error.message, adminId });
            throw error;
        }
    },

    /**
     * Get trends (daily/weekly/monthly)
     * GET /api/v1/dashboard/admin/trends
     */
    async getTrends(adminId, options = {}) {
        try {
            const { from_date, to_date } = options;

            let dateFilter = '';
            if (from_date && to_date) {
                dateFilter = `AND date BETWEEN '${from_date}' AND '${to_date}'`;
            } else {
                dateFilter = `AND date > NOW() - INTERVAL '7 days'`;
            }

            const query = `
                WITH daily_trends AS (
                    SELECT 
                        DATE_TRUNC('day', created_at) as date,
                        'appointments' as metric,
                        COUNT(*) as value
                    FROM appointments
                    WHERE is_deleted = false
                        ${dateFilter.replace('date', 'created_at')}
                    GROUP BY DATE_TRUNC('day', created_at)
                    
                    UNION ALL
                    
                    SELECT 
                        DATE_TRUNC('day', created_at) as date,
                        'patients' as metric,
                        COUNT(*) as value
                    FROM patients
                    WHERE is_deleted = false
                        ${dateFilter.replace('date', 'created_at')}
                    GROUP BY DATE_TRUNC('day', created_at)
                    
                    UNION ALL
                    
                    SELECT 
                        DATE_TRUNC('day', created_at) as date,
                        'prescriptions' as metric,
                        COUNT(*) as value
                    FROM prescriptions
                    WHERE is_deleted = false
                        ${dateFilter.replace('date', 'created_at')}
                    GROUP BY DATE_TRUNC('day', created_at)
                    
                    UNION ALL
                    
                    SELECT 
                        DATE_TRUNC('day', created_at) as date,
                        'invoices' as metric,
                        COUNT(*) as value
                    FROM invoices
                    WHERE is_deleted = false
                        ${dateFilter.replace('date', 'created_at')}
                    GROUP BY DATE_TRUNC('day', created_at)
                )
                SELECT 
                    date,
                    json_object_agg(metric, value) as metrics
                FROM daily_trends
                GROUP BY date
                ORDER BY date DESC
            `;

            const result = await db.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Error in getTrends', { error: error.message, adminId });
            throw error;
        }
    }
};

module.exports = adminDashboardService;