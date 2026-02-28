-- =====================================================
-- MASTER INSTALLATION SCRIPT
-- Hospital Management System
-- Lead Architect: Koushal Jha
-- Date: 2026-02-28
-- Database: Hospital_Management_System
-- Total Tables: 99
-- =====================================================

-- Start transaction (all or nothing)
BEGIN;

-- Verify database
SELECT current_database() AS "Installing to Database: Hospital_Management_System";

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SECTION 1: FOUNDATION (Phase 1) - 2 TABLES
-- =====================================================
-- These tables have no dependencies
\i 01_tables/01_foundation/001_departments.sql
\i 01_tables/01_foundation/002_job_roles.sql

-- =====================================================
-- SECTION 2: PUBLIC USER MODULE - 12 TABLES
-- =====================================================
-- Independent tables first
\i 01_tables/10_public/087_public_users.sql
\i 01_tables/10_public/088_user_identifiers.sql
\i 01_tables/10_public/089_user_demographics.sql
\i 01_tables/10_public/090_emergency_contacts.sql
\i 01_tables/10_public/091_consents.sql
\i 01_tables/10_public/092_login_history.sql
\i 01_tables/10_public/093_trusted_devices.sql
\i 01_tables/10_public/094_user_verification_history.sql
\i 01_tables/10_public/095_family_guardians.sql
\i 01_tables/10_public/096_communication_preferences.sql
\i 01_tables/10_public/097_deceased_records.sql
\i 01_tables/10_public/098_audit_log.sql

-- =====================================================
-- SECTION 3: EMPLOYEE MANAGEMENT (Phases 3-10) - 8 TABLES
-- =====================================================
-- Depends on: departments, job_roles, public_users
\i 01_tables/02_employee/003_employees.sql
\i 01_tables/02_employee/004_employee_family.sql
\i 01_tables/02_employee/005_employment_history.sql
\i 01_tables/02_employee/006_employee_documents.sql
\i 01_tables/02_employee/007_document_verification_log.sql
\i 01_tables/02_employee/008_background_checks.sql
\i 01_tables/02_employee/009_training_records.sql
\i 01_tables/02_employee/010_disciplinary_actions.sql

-- =====================================================
-- SECTION 4: ATTENDANCE & LEAVE (Phases 11-15) - 9 TABLES
-- =====================================================
-- Depends on: employees
\i 01_tables/03_attendance/011_leave_types.sql
\i 01_tables/03_attendance/012_holidays.sql
\i 01_tables/03_attendance/013_shifts.sql
\i 01_tables/03_attendance/014_leave_balance.sql
\i 01_tables/03_attendance/015_leave_applications.sql
\i 01_tables/03_attendance/016_attendance_records.sql
\i 01_tables/03_attendance/017_overtime_records.sql
\i 01_tables/03_attendance/018_employee_shift_assignments.sql
\i 01_tables/03_attendance/019_attendance_correction_requests.sql

-- =====================================================
-- SECTION 5: PAYROLL & FINANCE (Phases 16-20) - 12 TABLES
-- =====================================================
-- Depends on: employees
\i 01_tables/04_payroll/020_financial_year.sql
\i 01_tables/04_payroll/021_salary_components.sql
\i 01_tables/04_payroll/022_employee_salary_structure.sql
\i 01_tables/04_payroll/023_tax_slabs.sql
\i 01_tables/04_payroll/024_pf_esi_rates.sql
\i 01_tables/04_payroll/025_payroll_runs.sql
\i 01_tables/04_payroll/026_payroll_transactions.sql
\i 01_tables/04_payroll/027_loan_types.sql
\i 01_tables/04_payroll/028_employee_loans.sql
\i 01_tables/04_payroll/029_loan_repayments.sql
\i 01_tables/04_payroll/030_reimbursement_claims.sql
\i 01_tables/04_payroll/031_employee_bonus.sql

-- =====================================================
-- SECTION 6: PERFORMANCE MANAGEMENT (Phases 21-25) - 9 TABLES
-- =====================================================
-- Depends on: employees, job_roles
\i 01_tables/05_performance/032_appraisal_cycles.sql
\i 01_tables/05_performance/033_goal_types.sql
\i 01_tables/05_performance/034_appraisal_goals.sql
\i 01_tables/05_performance/035_appraisal_feedback.sql
\i 01_tables/05_performance/036_skill_matrix.sql
\i 01_tables/05_performance/037_skill_assessment.sql
\i 01_tables/05_performance/038_training_nominations.sql
\i 01_tables/05_performance/039_succession_planning.sql
\i 01_tables/05_performance/040_career_path_tracking.sql

-- =====================================================
-- SECTION 7: PATIENT MANAGEMENT (Phases 26-30) - 16 TABLES
-- =====================================================
-- Depends on: employees, departments, public_users
\i 01_tables/06_patient/041_patients.sql
\i 01_tables/06_patient/042_patient_demographics.sql
\i 01_tables/06_patient/043_patient_emergency_contacts.sql
\i 01_tables/06_patient/044_patient_insurance.sql
\i 01_tables/06_patient/045_appointment_types.sql
\i 01_tables/06_patient/046_patient_appointments.sql
\i 01_tables/06_patient/047_visit_types.sql
\i 01_tables/06_patient/048_admission_types.sql
\i 01_tables/06_patient/049_patient_visits.sql
\i 01_tables/06_patient/050_patient_diagnoses.sql
\i 01_tables/06_patient/051_patient_allergies.sql
\i 01_tables/06_patient/052_patient_medications.sql
\i 01_tables/06_patient/053_patient_lab_results.sql
\i 01_tables/06_patient/054_patient_vitals.sql
\i 01_tables/06_patient/055_patient_procedures.sql

-- =====================================================
-- SECTION 8: APPOINTMENT & SCHEDULING (Phases 31-35) - 14 TABLES
-- =====================================================
-- Depends on: employees, departments, patients
\i 01_tables/07_appointment/056_appointment_reasons.sql
\i 01_tables/07_appointment/057_block_reasons.sql
\i 01_tables/07_appointment/058_resource_types.sql
\i 01_tables/07_appointment/059_facility_schedule.sql
\i 01_tables/07_appointment/060_schedule_templates.sql
\i 01_tables/07_appointment/061_doctor_schedule.sql
\i 01_tables/07_appointment/062_schedule_blocks.sql
\i 01_tables/07_appointment/063_schedule_exceptions.sql
\i 01_tables/07_appointment/064_appointment_resources.sql
\i 01_tables/07_appointment/065_appointment_recurring.sql
\i 01_tables/07_appointment/066_appointment_reminders.sql
\i 01_tables/07_appointment/067_appointment_waitlist.sql

-- =====================================================
-- SECTION 9: BILLING & INVOICING (Phases 36-40) - 11 TABLES
-- =====================================================
-- Depends on: patients, employees, departments, patient_insurance
\i 01_tables/08_billing/068_price_list_master.sql
\i 01_tables/08_billing/069_invoices.sql
\i 01_tables/08_billing/070_invoice_items.sql
\i 01_tables/08_billing/071_payment_transactions.sql
\i 01_tables/08_billing/072_invoice_payments.sql
\i 01_tables/08_billing/073_insurance_claims.sql
\i 01_tables/08_billing/074_insurance_approvals.sql
\i 01_tables/08_billing/075_discount_coupons.sql
\i 01_tables/08_billing/076_patient_credit_balance.sql
\i 01_tables/08_billing/077_refunds.sql
\i 01_tables/08_billing/078_payment_gateway_logs.sql

-- =====================================================
-- SECTION 10: INVENTORY & PHARMACY (Phases 41-45) - 8 TABLES
-- =====================================================
-- Depends on: employees, patients, suppliers
\i 01_tables/09_inventory/079_inventory_categories.sql
\i 01_tables/09_inventory/080_suppliers.sql
\i 01_tables/09_inventory/081_inventory_items.sql
\i 01_tables/09_inventory/082_stock_batches.sql
\i 01_tables/09_inventory/083_stock_transactions.sql
\i 01_tables/09_inventory/084_pharmacy_prescriptions.sql
\i 01_tables/09_inventory/085_pharmacy_dispensing.sql
\i 01_tables/09_inventory/086_stock_alerts.sql

-- =====================================================
-- SECTION 11: CREATE INDEXES
-- =====================================================
\i 02_indexes/01_primary_keys.sql
\i 02_indexes/02_foreign_keys.sql
\i 02_indexes/03_performance_indexes.sql

-- =====================================================
-- SECTION 12: CREATE TRIGGERS
-- =====================================================
\i 03_triggers/01_audit_triggers.sql
\i 03_triggers/02_inventory_triggers.sql
\i 03_triggers/03_billing_triggers.sql

-- =====================================================
-- SECTION 13: CREATE VIEWS
-- =====================================================
\i 04_views/01_patient_views.sql
\i 04_views/02_financial_views.sql
\i 04_views/03_reporting_views.sql

-- =====================================================
-- SECTION 14: CREATE FUNCTIONS
-- =====================================================
\i 05_functions/01_calculations.sql
\i 05_functions/02_reports.sql

-- =====================================================
-- SECTION 15: VERIFICATION
-- =====================================================
SELECT '✅ HOSPITAL MANAGEMENT SYSTEM INSTALLED SUCCESSFULLY' AS message;

WITH table_counts AS (
    SELECT COUNT(*) as total_tables 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
)
SELECT 
    total_tables as "Total Tables Created",
    CASE 
        WHEN total_tables >= 99 THEN '✓ ALL TABLES INSTALLED'
        ELSE '⚠ SOME TABLES MISSING'
    END as "Status"
FROM table_counts;

-- Show list of installed tables
SELECT 
    table_name,
    '✓ CREATED' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Commit transaction
COMMIT;

-- Final message
\echo '====================================================='
\echo 'INSTALLATION COMPLETE'
\echo 'Database: Hospital_Management_System'
\echo 'Total Tables: 99'
\echo 'Lead Architect: Koushal Jha'
\echo 'Date: 2026-02-28'
\echo '====================================================='