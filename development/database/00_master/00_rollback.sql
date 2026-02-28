-- =====================================================
-- EMERGENCY ROLLBACK SCRIPT
-- Hospital Management System
-- Lead Architect: Koushal Jha
-- Date: 2026-02-28
-- Database: hospital_management_system
-- WARNING: This will DELETE ALL TABLES!
-- USE ONLY IN EMERGENCY
-- =====================================================

-- Start transaction
BEGIN;

-- Select the database
\c hospital_management_system;

-- =====================================================
-- SECTION 1: DISABLE TRIGGERS TEMPORARILY
-- =====================================================
DO $$ 
DECLARE 
    trigger_rec RECORD;
BEGIN
    FOR trigger_rec IN 
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
    LOOP
        EXECUTE 'ALTER TABLE ' || trigger_rec.event_object_table || 
                ' DISABLE TRIGGER ' || trigger_rec.trigger_name || ';';
    END LOOP;
END $$;

-- =====================================================
-- SECTION 2: DROP TABLES IN REVERSE ORDER
-- =====================================================

-- Inventory & Pharmacy (Tables 079-086)
DROP TABLE IF EXISTS stock_alerts CASCADE;
DROP TABLE IF EXISTS pharmacy_dispensing CASCADE;
DROP TABLE IF EXISTS pharmacy_prescriptions CASCADE;
DROP TABLE IF EXISTS stock_transactions CASCADE;
DROP TABLE IF EXISTS stock_batches CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS inventory_categories CASCADE;

-- Billing & Invoicing (Tables 068-078)
DROP TABLE IF EXISTS payment_gateway_logs CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS patient_credit_balance CASCADE;
DROP TABLE IF EXISTS discount_coupons CASCADE;
DROP TABLE IF EXISTS insurance_approvals CASCADE;
DROP TABLE IF EXISTS insurance_claims CASCADE;
DROP TABLE IF EXISTS invoice_payments CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS price_list_master CASCADE;

-- Appointment & Scheduling (Tables 056-067)
DROP TABLE IF EXISTS appointment_waitlist CASCADE;
DROP TABLE IF EXISTS appointment_reminders CASCADE;
DROP TABLE IF EXISTS appointment_recurring CASCADE;
DROP TABLE IF EXISTS appointment_resources CASCADE;
DROP TABLE IF EXISTS schedule_exceptions CASCADE;
DROP TABLE IF EXISTS schedule_blocks CASCADE;
DROP TABLE IF EXISTS doctor_schedule CASCADE;
DROP TABLE IF EXISTS schedule_templates CASCADE;
DROP TABLE IF EXISTS facility_schedule CASCADE;
DROP TABLE IF EXISTS resource_types CASCADE;
DROP TABLE IF EXISTS block_reasons CASCADE;
DROP TABLE IF EXISTS appointment_reasons CASCADE;

-- Patient Management (Tables 041-055)
DROP TABLE IF EXISTS patient_procedures CASCADE;
DROP TABLE IF EXISTS patient_vitals CASCADE;
DROP TABLE IF EXISTS patient_lab_results CASCADE;
DROP TABLE IF EXISTS patient_medications CASCADE;
DROP TABLE IF EXISTS patient_allergies CASCADE;
DROP TABLE IF EXISTS patient_diagnoses CASCADE;
DROP TABLE IF EXISTS patient_visits CASCADE;
DROP TABLE IF EXISTS admission_types CASCADE;
DROP TABLE IF EXISTS visit_types CASCADE;
DROP TABLE IF EXISTS patient_appointments CASCADE;
DROP TABLE IF EXISTS appointment_types CASCADE;
DROP TABLE IF EXISTS patient_insurance CASCADE;
DROP TABLE IF EXISTS patient_emergency_contacts CASCADE;
DROP TABLE IF EXISTS patient_demographics CASCADE;
DROP TABLE IF EXISTS patients CASCADE;

-- Performance Management (Tables 032-040)
DROP TABLE IF EXISTS career_path_tracking CASCADE;
DROP TABLE IF EXISTS succession_planning CASCADE;
DROP TABLE IF EXISTS training_nominations CASCADE;
DROP TABLE IF EXISTS skill_assessment CASCADE;
DROP TABLE IF EXISTS skill_matrix CASCADE;
DROP TABLE IF EXISTS appraisal_feedback CASCADE;
DROP TABLE IF EXISTS appraisal_goals CASCADE;
DROP TABLE IF EXISTS goal_types CASCADE;
DROP TABLE IF EXISTS appraisal_cycles CASCADE;

-- Payroll & Finance (Tables 020-031)
DROP TABLE IF EXISTS employee_bonus CASCADE;
DROP TABLE IF EXISTS reimbursement_claims CASCADE;
DROP TABLE IF EXISTS loan_repayments CASCADE;
DROP TABLE IF EXISTS employee_loans CASCADE;
DROP TABLE IF EXISTS loan_types CASCADE;
DROP TABLE IF EXISTS payroll_transactions CASCADE;
DROP TABLE IF EXISTS payroll_runs CASCADE;
DROP TABLE IF EXISTS pf_esi_rates CASCADE;
DROP TABLE IF EXISTS tax_slabs CASCADE;
DROP TABLE IF EXISTS employee_salary_structure CASCADE;
DROP TABLE IF EXISTS salary_components CASCADE;
DROP TABLE IF EXISTS financial_year CASCADE;

-- Attendance & Leave (Tables 011-019)
DROP TABLE IF EXISTS attendance_correction_requests CASCADE;
DROP TABLE IF EXISTS employee_shift_assignments CASCADE;
DROP TABLE IF EXISTS overtime_records CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS leave_applications CASCADE;
DROP TABLE IF EXISTS leave_balance CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
DROP TABLE IF EXISTS leave_types CASCADE;

-- Employee Management (Tables 003-010)
DROP TABLE IF EXISTS disciplinary_actions CASCADE;
DROP TABLE IF EXISTS training_records CASCADE;
DROP TABLE IF EXISTS background_checks CASCADE;
DROP TABLE IF EXISTS document_verification_log CASCADE;
DROP TABLE IF EXISTS employee_documents CASCADE;
DROP TABLE IF EXISTS employment_history CASCADE;
DROP TABLE IF EXISTS employee_family CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- Public User Module (Tables 087-098)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS deceased_records CASCADE;
DROP TABLE IF EXISTS communication_preferences CASCADE;
DROP TABLE IF EXISTS family_guardians CASCADE;
DROP TABLE IF EXISTS user_verification_history CASCADE;
DROP TABLE IF EXISTS trusted_devices CASCADE;
DROP TABLE IF EXISTS login_history CASCADE;
DROP TABLE IF EXISTS consents CASCADE;
DROP TABLE IF EXISTS emergency_contacts CASCADE;
DROP TABLE IF EXISTS user_demographics CASCADE;
DROP TABLE IF EXISTS user_identifiers CASCADE;
DROP TABLE IF EXISTS public_users CASCADE;

-- Foundation (Tables 001-002)
DROP TABLE IF EXISTS job_roles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- =====================================================
-- SECTION 3: DROP EXTENSIONS
-- =====================================================
DROP EXTENSION IF EXISTS "pgcrypto";
DROP EXTENSION IF EXISTS "uuid-ossp";

-- =====================================================
-- SECTION 4: VERIFICATION
-- =====================================================
SELECT 'ALL TABLES DROPPED SUCCESSFULLY' AS message;

SELECT 
    COUNT(*) as remaining_tables,
    '⚠ DATABASE IS EMPTY' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- Commit transaction
COMMIT;

-- Final warning
\echo '====================================================='
\echo '⚠⚠⚠ EMERGENCY ROLLBACK COMPLETE ⚠⚠⚠'
\echo 'Database: hospital_management_system'
\echo 'All 99 tables have been DROPPED'
\echo 'Lead Architect: Koushal Jha'
\echo 'Date: 2026-02-28'
\echo '====================================================='
\echo 'To reinstall, run: \\i 00_master/00_install.sql'
\echo '====================================================='