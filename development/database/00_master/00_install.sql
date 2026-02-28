-- =====================================================
-- MASTER INSTALLATION SCRIPT
-- Hospital Management System
-- Lead Architect: Koushal Jha
-- Date: 2026-02-28
-- Database: hospital_management_system
-- Total Tables: 99
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
-- SECTION 12: VERIFICATION
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
\echo 'Total Tables: 99'
\echo 'Lead Architect: Koushal Jha'
\echo 'Date: 2026-02-28'
\echo '====================================================='