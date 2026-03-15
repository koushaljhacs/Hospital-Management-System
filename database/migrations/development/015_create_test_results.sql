-- ============================================
-- MIGRATION: 015_create_test_results.sql
-- DESCRIPTION: Create test results table for lab results management
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: test_orders table, patients table, lab_tests table, specimens table, users table
-- ============================================

-- ============================================
-- PART 1: CREATE TEST RESULTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS test_results (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_order_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    test_id UUID NOT NULL,
    
    -- ========================================
    -- RESULT VALUES
    -- ========================================
    result_value VARCHAR(100),
    result_numeric DECIMAL(15,4),
    result_text TEXT,
    result_unit VARCHAR(20),
    result_range_low DECIMAL(15,4),
    result_range_high DECIMAL(15,4),
    result_range_text TEXT,
    
    -- ========================================
    -- INTERPRETATION
    -- ========================================
    is_abnormal BOOLEAN DEFAULT FALSE,
    is_critical BOOLEAN DEFAULT FALSE,
    is_panic BOOLEAN DEFAULT FALSE,
    is_repeat_needed BOOLEAN DEFAULT FALSE,
    interpretation TEXT,
    clinical_significance TEXT,
    comments TEXT,
    
    -- ========================================
    -- FLAGS & ALERTS
    -- ========================================
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMP,
    alert_sent_to UUID[],
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    
    -- ========================================
    -- QUALITY CONTROL
    -- ========================================
    qc_passed BOOLEAN DEFAULT TRUE,
    qc_notes TEXT,
    retest_count INTEGER DEFAULT 0,
    retest_reason TEXT,
    
    -- ========================================
    -- SPECIMEN DETAILS
    -- ========================================
    specimen_id UUID,
    specimen_collected_at TIMESTAMP,
    specimen_received_at TIMESTAMP,
    specimen_condition VARCHAR(50),
    specimen_notes TEXT,
    
    -- ========================================
    -- ATTACHMENTS
    -- ========================================
    report_url TEXT,
    image_urls TEXT[],
    attachment_urls JSONB,
    
    -- ========================================
    -- AUDIT TRAIL
    -- ========================================
    tested_by UUID NOT NULL,
    tested_at TIMESTAMP NOT NULL,
    verified_by UUID,
    verified_at TIMESTAMP,
    approved_by UUID,
    approved_at TIMESTAMP,
    corrected_by UUID,
    corrected_at TIMESTAMP,
    correction_reason TEXT,
    version INTEGER DEFAULT 1,
    
    -- ========================================
    -- TIMESTAMPS
    -- ========================================
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- ========================================
    -- SOFT DELETE
    -- ========================================
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    -- ========================================
    -- CONSTRAINTS
    -- ========================================
    CONSTRAINT fk_test_results_test_order FOREIGN KEY (test_order_id) 
        REFERENCES test_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_test_results_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_test_results_test FOREIGN KEY (test_id) 
        REFERENCES lab_tests(id) ON DELETE RESTRICT,
    CONSTRAINT fk_test_results_specimen FOREIGN KEY (specimen_id) 
        REFERENCES specimens(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_results_tested_by FOREIGN KEY (tested_by) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_test_results_verified_by FOREIGN KEY (verified_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_results_approved_by FOREIGN KEY (approved_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_results_corrected_by FOREIGN KEY (corrected_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_results_acknowledged_by FOREIGN KEY (acknowledged_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_test_results_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (tested_at <= verified_at),
    CONSTRAINT check_verified_dates CHECK (verified_at <= approved_at),
    CONSTRAINT check_correction_dates CHECK (corrected_at >= created_at),
    CONSTRAINT check_retest_count CHECK (retest_count >= 0),
    CONSTRAINT check_version CHECK (version > 0),
    CONSTRAINT check_result_range CHECK (
        (result_numeric IS NULL) OR 
        (result_numeric >= result_range_low AND result_numeric <= result_range_high)
    )
);

-- ============================================
-- PART 2: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_test_results_test_order ON test_results(test_order_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_patient ON test_results(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_test ON test_results(test_id) WHERE is_deleted = FALSE;

-- Result value indexes
CREATE INDEX IF NOT EXISTS idx_test_results_numeric ON test_results(result_numeric) WHERE result_numeric IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_abnormal ON test_results(is_abnormal) WHERE is_abnormal = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_critical ON test_results(is_critical) WHERE is_critical = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_panic ON test_results(is_panic) WHERE is_panic = TRUE AND is_deleted = FALSE;

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_test_results_tested_at ON test_results(tested_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_verified_at ON test_results(verified_at) WHERE verified_at IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_approved_at ON test_results(approved_at) WHERE approved_at IS NOT NULL AND is_deleted = FALSE;

-- Alert indexes
CREATE INDEX IF NOT EXISTS idx_test_results_alert ON test_results(alert_sent) WHERE alert_sent = FALSE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_acknowledged ON test_results(acknowledged_by) WHERE acknowledged_by IS NOT NULL AND is_deleted = FALSE;

-- Specimen indexes
CREATE INDEX IF NOT EXISTS idx_test_results_specimen ON test_results(specimen_id) WHERE specimen_id IS NOT NULL AND is_deleted = FALSE;

-- User indexes
CREATE INDEX IF NOT EXISTS idx_test_results_tested_by ON test_results(tested_by) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_verified_by ON test_results(verified_by) WHERE verified_by IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_test_results_approved_by ON test_results(approved_by) WHERE approved_by IS NOT NULL AND is_deleted = FALSE;

-- Version index
CREATE INDEX IF NOT EXISTS idx_test_results_version ON test_results(version) WHERE is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_test_results_deleted ON test_results(is_deleted, deleted_at);

-- GIN indexes for arrays and JSONB
CREATE INDEX IF NOT EXISTS idx_test_results_alert_sent_to ON test_results USING gin(alert_sent_to);
CREATE INDEX IF NOT EXISTS idx_test_results_image_urls ON test_results USING gin(image_urls);
CREATE INDEX IF NOT EXISTS idx_test_results_attachment_urls ON test_results USING gin(attachment_urls);

-- ============================================
-- PART 3: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_test_results_updated_at') THEN
        CREATE TRIGGER update_test_results_updated_at
            BEFORE UPDATE ON test_results
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_test_results_updated_at';
    END IF;
END $$;

-- Function to auto-increment version on correction
CREATE OR REPLACE FUNCTION increment_test_result_version()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.corrected_by IS NOT NULL AND OLD.corrected_by IS NULL THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for version increment
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'increment_test_result_version') THEN
        CREATE TRIGGER increment_test_result_version
            BEFORE UPDATE OF corrected_by ON test_results
            FOR EACH ROW
            EXECUTE FUNCTION increment_test_result_version();
        RAISE NOTICE 'Created trigger increment_test_result_version';
    END IF;
END $$;

-- ============================================
-- PART 4: COMMENTS
-- ============================================

COMMENT ON TABLE test_results IS 'Complete test results management system';
COMMENT ON COLUMN test_results.id IS 'Primary key - UUID';
COMMENT ON COLUMN test_results.test_order_id IS 'Reference to test order';
COMMENT ON COLUMN test_results.patient_id IS 'Patient reference';
COMMENT ON COLUMN test_results.test_id IS 'Test reference';
COMMENT ON COLUMN test_results.result_value IS 'Result as string value';
COMMENT ON COLUMN test_results.result_numeric IS 'Result as numeric value';
COMMENT ON COLUMN test_results.result_text IS 'Result as text';
COMMENT ON COLUMN test_results.result_unit IS 'Unit of measurement';
COMMENT ON COLUMN test_results.result_range_low IS 'Lower limit of normal range';
COMMENT ON COLUMN test_results.result_range_high IS 'Upper limit of normal range';
COMMENT ON COLUMN test_results.result_range_text IS 'Normal range as text';
COMMENT ON COLUMN test_results.is_abnormal IS 'Whether result is abnormal';
COMMENT ON COLUMN test_results.is_critical IS 'Whether result is critical';
COMMENT ON COLUMN test_results.is_panic IS 'Whether result is panic value';
COMMENT ON COLUMN test_results.is_repeat_needed IS 'Whether test needs to be repeated';
COMMENT ON COLUMN test_results.interpretation IS 'Interpretation of results';
COMMENT ON COLUMN test_results.clinical_significance IS 'Clinical significance';
COMMENT ON COLUMN test_results.comments IS 'Additional comments';
COMMENT ON COLUMN test_results.alert_sent IS 'Whether alert was sent';
COMMENT ON COLUMN test_results.alert_sent_at IS 'When alert was sent';
COMMENT ON COLUMN test_results.alert_sent_to IS 'Users alert was sent to';
COMMENT ON COLUMN test_results.acknowledged_by IS 'User who acknowledged alert';
COMMENT ON COLUMN test_results.acknowledged_at IS 'When alert was acknowledged';
COMMENT ON COLUMN test_results.qc_passed IS 'Whether quality control passed';
COMMENT ON COLUMN test_results.qc_notes IS 'Quality control notes';
COMMENT ON COLUMN test_results.retest_count IS 'Number of times retested';
COMMENT ON COLUMN test_results.retest_reason IS 'Reason for retest';
COMMENT ON COLUMN test_results.specimen_id IS 'Reference to specimen';
COMMENT ON COLUMN test_results.specimen_collected_at IS 'When specimen was collected';
COMMENT ON COLUMN test_results.specimen_received_at IS 'When specimen was received';
COMMENT ON COLUMN test_results.specimen_condition IS 'Condition of specimen';
COMMENT ON COLUMN test_results.specimen_notes IS 'Specimen notes';
COMMENT ON COLUMN test_results.report_url IS 'URL to report';
COMMENT ON COLUMN test_results.image_urls IS 'URLs to images';
COMMENT ON COLUMN test_results.attachment_urls IS 'URLs to attachments in JSON';
COMMENT ON COLUMN test_results.tested_by IS 'User who performed test';
COMMENT ON COLUMN test_results.tested_at IS 'When test was performed';
COMMENT ON COLUMN test_results.verified_by IS 'User who verified results';
COMMENT ON COLUMN test_results.verified_at IS 'When results were verified';
COMMENT ON COLUMN test_results.approved_by IS 'User who approved results';
COMMENT ON COLUMN test_results.approved_at IS 'When results were approved';
COMMENT ON COLUMN test_results.corrected_by IS 'User who corrected results';
COMMENT ON COLUMN test_results.corrected_at IS 'When results were corrected';
COMMENT ON COLUMN test_results.correction_reason IS 'Reason for correction';
COMMENT ON COLUMN test_results.version IS 'Version number of results';
COMMENT ON COLUMN test_results.is_deleted IS 'Soft delete flag';

-- ============================================
-- PART 5: VERIFICATION
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
    index_count INTEGER;
    fk_count INTEGER;
    check_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Check table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'test_results') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'test_results';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'test_results';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'test_results'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'test_results'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'test_results';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 015_create_test_results.sql COMPLETED';
    RAISE NOTICE 'Test Results table exists: %', table_exists;
    RAISE NOTICE 'Total columns: %', column_count;
    RAISE NOTICE 'Total indexes: %', index_count;
    RAISE NOTICE 'Foreign keys: %', fk_count;
    RAISE NOTICE 'Check constraints: %', check_count;
    RAISE NOTICE 'Triggers: %', trigger_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- END OF MIGRATION - SAFE TO RUN MULTIPLE TIMES
-- ============================================