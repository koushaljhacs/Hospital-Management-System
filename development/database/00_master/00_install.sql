-- =====================================================
-- MASTER INSTALLATION SCRIPT
-- Hospital Management System
-- Lead Architect: Koushal Jha
-- Date: 2026-02-28
-- Database: hospital_management_system
-- Total Tables: 131 (98 original + 33 new)
-- =====================================================

-- Start transaction
BEGIN;

-- Select the database
\c hospital_management_system;

-- =====================================================
-- SECTION 1: ENABLE EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- SECTION 2: FOUNDATION (Tables 001-002)
-- =====================================================
-- No dependencies
\i ../01_schemas/01_department.sql
\i ../01_schemas/02_job_roles.sql

-- =====================================================
-- SECTION 3: PUBLIC USER MODULE (Tables 087-098)
-- =====================================================
-- Independent tables
\i ../01_schemas/11_public.sql

-- =====================================================
-- SECTION 4: EMPLOYEE MANAGEMENT (Tables 003-010)
-- =====================================================
-- Depends on: departments, job_roles, public_users
\i ../01_schemas/03_employee.sql

-- =====================================================
-- SECTION 5: ATTENDANCE & LEAVE (Tables 011-019)
-- =====================================================
-- Depends on: employees
\i ../01_schemas/04_attendance.sql

-- =====================================================
-- SECTION 6: PAYROLL & FINANCE (Tables 020-031)
-- =====================================================
-- Depends on: employees
\i ../01_schemas/05_payroll_and_finance_management.sql

-- =====================================================
-- SECTION 7: PERFORMANCE MANAGEMENT (Tables 032-040)
-- =====================================================
-- Depends on: employees, job_roles
\i ../01_schemas/06_performance_management.sql

-- =====================================================
-- SECTION 8: PATIENT MANAGEMENT (Tables 041-055)
-- =====================================================
-- Depends on: employees, departments, public_users
\i ../01_schemas/07_patient_management.sql

-- =====================================================
-- SECTION 9: APPOINTMENT & SCHEDULING (Tables 056-067)
-- =====================================================
-- Depends on: employees, departments, patients
\i ../01_schemas/08_appointment_scheduling.sql

-- =====================================================
-- SECTION 10: BILLING & INVOICING (Tables 068-078)
-- =====================================================
-- Depends on: patients, employees, departments
\i ../01_schemas/09_billing_and_invoice.sql

-- =====================================================
-- SECTION 11: INVENTORY & PHARMACY (Tables 079-086)
-- =====================================================
-- Depends on: employees, patients, suppliers
\i ../01_schemas/10_inventory.sql

-- =====================================================
-- SECTION 12: BED MANAGEMENT (Phases 46-50) (Tables 099-131)
-- =====================================================
-- Depends on: departments, employees, patients, inventory (for equipment)

-- Location Hierarchy
\i 01_tables/11_bed_management/099_facilities.sql
\i 01_tables/11_bed_management/100_floors.sql
\i 01_tables/11_bed_management/101_wings.sql
\i 01_tables/11_bed_management/102_wards.sql
\i 01_tables/11_bed_management/103_rooms.sql

-- Bed Master Data
\i 01_tables/11_bed_management/104_bed_types.sql
\i 01_tables/11_bed_management/105_bed_manufacturers.sql
\i 01_tables/11_bed_management/106_beds.sql
\i 01_tables/11_bed_management/107_bed_features.sql
\i 01_tables/11_bed_management/108_bed_attributes_history.sql

-- State Management
\i 01_tables/11_bed_management/109_bed_status_reasons.sql
\i 01_tables/11_bed_management/110_bed_status_history.sql

-- Patient Assignments
\i 01_tables/11_bed_management/111_bed_assignments.sql
\i 01_tables/11_bed_management/112_bed_transfers.sql

-- Bed Requests
\i 01_tables/11_bed_management/113_bed_requests.sql
\i 01_tables/11_bed_management/114_bed_allocations.sql
\i 01_tables/11_bed_management/115_bed_waitlist.sql

-- Maintenance & Cleaning
\i 01_tables/11_bed_management/116_bed_maintenance_vendors.sql
\i 01_tables/11_bed_management/117_bed_maintenance.sql
\i 01_tables/11_bed_management/118_cleaning_protocols.sql
\i 01_tables/11_bed_management/119_bed_cleaning_log.sql
\i 01_tables/11_bed_management/120_bed_isolation_log.sql

-- Billing & Reporting
\i 01_tables/11_bed_management/121_bed_charges.sql
\i 01_tables/11_bed_management/122_bed_occupancy_daily.sql
\i 01_tables/11_bed_management/123_bed_performance_metrics.sql
\i 01_tables/11_bed_management/124_bed_revenue_analysis.sql

-- Hold & Blocking
\i 01_tables/11_bed_management/125_bed_hold.sql
\i 01_tables/11_bed_management/126_bed_block_reasons.sql
\i 01_tables/11_bed_management/127_bed_blackout.sql

-- Incident & Safety
\i 01_tables/11_bed_management/128_bed_incidents.sql
\i 01_tables/11_bed_management/129_bed_safety_checks.sql

-- Staff Assignment
\i 01_tables/11_bed_management/130_bed_nurse_assignments.sql

-- Equipment Integration
\i 01_tables/11_bed_management/131_bed_equipment_link.sql

-- =====================================================
-- SECTION 13: CREATE INDEXES (Optional - can be run separately)
-- =====================================================
-- \i ../02_indexes/01_primary_keys.sql
-- \i ../02_indexes/02_foreign_keys.sql
-- \i ../02_indexes/03_performance_indexes.sql

-- =====================================================
-- SECTION 14: CREATE TRIGGERS (Optional - can be run separately)
-- =====================================================
-- \i ../03_triggers/01_audit_triggers.sql
-- \i ../03_triggers/02_inventory_triggers.sql
-- \i ../03_triggers/03_billing_triggers.sql

-- =====================================================
-- SECTION 15: CREATE VIEWS (Optional - can be run separately)
-- =====================================================
-- \i ../04_views/01_patient_views.sql
-- \i ../04_views/02_financial_views.sql
-- \i ../04_views/03_reporting_views.sql

-- =====================================================
-- SECTION 16: VERIFICATION
-- =====================================================
SELECT '✅ HOSPITAL MANAGEMENT SYSTEM INSTALLED SUCCESSFULLY' AS message;

SELECT 
    COUNT(*) as total_tables_created,
    '✓ INSTALLATION COMPLETE' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- Commit transaction
COMMIT;

-- Final message
\echo '====================================================='
\echo 'INSTALLATION COMPLETE'
\echo 'Database: hospital_management_system'
\echo 'Total Tables: 131 (98 original + 33 bed management)'
\echo 'Lead Architect: Koushal Jha'
\echo 'Date: 2026-03-01'
\echo '====================================================='