-- ============================================
-- MIGRATION: 005_create_prescriptions.sql
-- DESCRIPTION: Create prescriptions table (normalized)
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: 002_patients.sql, 003_employees.sql, 004_appointments.sql
-- ============================================

-- ============================================
-- PART 1: CREATE PRESCRIPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS prescriptions (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ========================================
    -- FOREIGN KEYS (Links to other tables)
    -- ========================================
    appointment_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    
    -- ========================================
    -- PRESCRIPTION DETAILS
    -- ========================================
    diagnosis TEXT NOT NULL,
    notes TEXT,
    follow_up_date DATE,
    
    -- ========================================
    -- AUDIT COLUMNS
    -- ========================================
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- ========================================
    -- SOFT DELETE (Optional)
    -- ========================================
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    -- ========================================
    -- CONSTRAINTS
    -- ========================================
    CONSTRAINT fk_prescriptions_appointment FOREIGN KEY (appointment_id) 
        REFERENCES appointments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_prescriptions_doctor FOREIGN KEY (doctor_id) 
        REFERENCES employees(id) ON DELETE RESTRICT,
    CONSTRAINT fk_prescriptions_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_prescriptions_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_follow_up_date CHECK (
        follow_up_date IS NULL OR follow_up_date > CURRENT_DATE
    ),
    CONSTRAINT check_diagnosis_not_empty CHECK (
        LENGTH(TRIM(diagnosis)) > 0
    )
);

-- ============================================
-- PART 2: CREATE INDEXES
-- ============================================

-- Core foreign key indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment_id 
    ON prescriptions(appointment_id) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id 
    ON prescriptions(doctor_id) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id 
    ON prescriptions(patient_id) WHERE is_deleted = FALSE;

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_created 
    ON prescriptions(patient_id, created_at) WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_created 
    ON prescriptions(doctor_id, created_at) WHERE is_deleted = FALSE;

-- Follow-up date index
CREATE INDEX IF NOT EXISTS idx_prescriptions_follow_up 
    ON prescriptions(follow_up_date) WHERE follow_up_date IS NOT NULL AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_prescriptions_deleted 
    ON prescriptions(is_deleted, deleted_at);

-- ============================================
-- PART 3: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_prescriptions_updated_at') THEN
        CREATE TRIGGER update_prescriptions_updated_at
            BEFORE UPDATE ON prescriptions
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_prescriptions_updated_at';
    END IF;
END $$;

-- ============================================
-- PART 4: COMMENTS
-- ============================================

COMMENT ON TABLE prescriptions IS 'Patient prescriptions - normalized table linking to patients, doctors, and appointments';
COMMENT ON COLUMN prescriptions.id IS 'Primary key - UUID';
COMMENT ON COLUMN prescriptions.appointment_id IS 'Foreign key to appointments table';
COMMENT ON COLUMN prescriptions.doctor_id IS 'Foreign key to employees table (doctor who prescribed)';
COMMENT ON COLUMN prescriptions.patient_id IS 'Foreign key to patients table';
COMMENT ON COLUMN prescriptions.diagnosis IS 'Medical diagnosis from doctor';
COMMENT ON COLUMN prescriptions.notes IS 'Additional instructions or notes';
COMMENT ON COLUMN prescriptions.follow_up_date IS 'Recommended follow-up appointment date';
COMMENT ON COLUMN prescriptions.created_at IS 'When prescription was created';
COMMENT ON COLUMN prescriptions.updated_at IS 'When prescription was last updated';
COMMENT ON COLUMN prescriptions.is_deleted IS 'Soft delete flag';
COMMENT ON COLUMN prescriptions.deleted_at IS 'Timestamp when soft deleted';
COMMENT ON COLUMN prescriptions.deleted_by IS 'User who soft deleted the record';

-- ============================================
-- PART 5: COMPLETE DATA RETRIEVAL VIEW (Optional)
-- ============================================

CREATE OR REPLACE VIEW vw_prescriptions_full AS
SELECT 
    -- Prescription details
    p.id as prescription_id,
    p.diagnosis,
    p.notes,
    p.follow_up_date,
    p.created_at as prescribed_date,
    p.updated_at as last_updated,
    
    -- Patient information
    pat.id as patient_id,
    pat.first_name as patient_first_name,
    pat.last_name as patient_last_name,
    pat.phone as patient_phone,
    pat.email as patient_email,
    pat.date_of_birth as patient_dob,
    
    -- Doctor information
    emp.id as doctor_id,
    emp.first_name as doctor_first_name,
    emp.last_name as doctor_last_name,
    emp.designation as doctor_designation,
    emp.specialization as doctor_specialization,
    emp.license_number as doctor_license,
    
    -- Appointment information
    app.id as appointment_id,
    app.appointment_date,
    app.appointment_time,
    app.status as appointment_status,
    app.type as appointment_type
    
FROM prescriptions p
JOIN patients pat ON p.patient_id = pat.id AND pat.is_deleted = FALSE
JOIN employees emp ON p.doctor_id = emp.id AND emp.is_deleted = FALSE
JOIN appointments app ON p.appointment_id = app.id AND app.is_deleted = FALSE
WHERE p.is_deleted = FALSE;

COMMENT ON VIEW vw_prescriptions_full IS 'Complete view of prescriptions with patient, doctor, and appointment details';

-- ============================================
-- PART 6: VERIFICATION
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
    index_count INTEGER;
    trigger_count INTEGER;
    column_count INTEGER;
    constraint_count INTEGER;
    view_exists BOOLEAN;
BEGIN
    -- Check table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prescriptions') INTO table_exists;
    
    -- Check view
    SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'vw_prescriptions_full') INTO view_exists;
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'prescriptions';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'prescriptions';
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'prescriptions';
    
    -- Count constraints
    SELECT COUNT(*) INTO constraint_count FROM pg_constraint WHERE conrelid = 'prescriptions'::regclass;
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 005_create_prescriptions.sql COMPLETED';
    RAISE NOTICE 'Prescriptions table exists: %', table_exists;
    RAISE NOTICE 'Total columns: %', column_count;
    RAISE NOTICE 'Total indexes: %', index_count;
    RAISE NOTICE 'Total triggers: %', trigger_count;
    RAISE NOTICE 'Total constraints: %', constraint_count;
    RAISE NOTICE 'View created: %', view_exists;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- END OF MIGRATION - SAFE TO RUN MULTIPLE TIMES
-- ============================================