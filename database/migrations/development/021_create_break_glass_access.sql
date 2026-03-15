-- ============================================
-- MIGRATION: 021_create_break_glass_access.sql
-- DESCRIPTION: Create break glass access table for emergency data access logging
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: users table, patients table, departments table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create break_glass_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'break_glass_type_enum') THEN
        CREATE TYPE break_glass_type_enum AS ENUM (
            'emergency',
            'life_threatening',
            'clinical_necessity',
            'system_failure',
            'testing',
            'audit',
            'other'
        );
        RAISE NOTICE 'Created break_glass_type_enum type';
    END IF;
END $$;

-- Create break_glass_reason enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'break_glass_reason_enum') THEN
        CREATE TYPE break_glass_reason_enum AS ENUM (
            'cardiac_arrest',
            'respiratory_failure',
            'severe_trauma',
            'stroke',
            'sepsis',
            'emergency_surgery',
            'medication_error',
            'allergic_reaction',
            'patient_unconscious',
            'no_next_of_kin',
            'system_outage',
            'other'
        );
        RAISE NOTICE 'Created break_glass_reason_enum type';
    END IF;
END $$;

-- Create break_glass_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'break_glass_status_enum') THEN
        CREATE TYPE break_glass_status_enum AS ENUM (
            'active',
            'expired',
            'completed',
            'reviewed',
            'escalated',
            'violation',
            'under_investigation'
        );
        RAISE NOTICE 'Created break_glass_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE BREAK GLASS ACCESS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS break_glass_access (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_request_id VARCHAR(50) UNIQUE NOT NULL,
    access_type break_glass_type_enum NOT NULL,
    
    -- ========================================
    -- REQUESTOR DETAILS
    -- ========================================
    user_id UUID NOT NULL,
    user_role VARCHAR(50),
    user_department UUID,
    user_ip_address INET,
    user_device_info JSONB,
    
    -- ========================================
    -- PATIENT DETAILS
    -- ========================================
    patient_id UUID NOT NULL,
    patient_consent_obtained BOOLEAN DEFAULT FALSE,
    patient_consent_time TIMESTAMP,
    patient_representative_name VARCHAR(200),
    patient_representative_relation VARCHAR(100),
    
    -- ========================================
    -- ACCESS REASON
    -- ========================================
    reason TEXT NOT NULL,
    reason_category break_glass_reason_enum NOT NULL,
    clinical_context TEXT,
    emergency_details TEXT,
    incident_number VARCHAR(100),
    
    -- ========================================
    -- WITNESS DETAILS
    -- ========================================
    witness_id UUID,
    witness_name VARCHAR(200),
    witness_role VARCHAR(100),
    witness_department UUID,
    witness_statement TEXT,
    witness_consent BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- ACCESS TIMELINE
    -- ========================================
    access_start TIMESTAMP NOT NULL,
    access_end TIMESTAMP,
    actual_access_duration INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (access_end - access_start)) / 60
    ) STORED,
    auto_expiry_time TIMESTAMP,
    is_auto_expired BOOLEAN DEFAULT FALSE,
    
    -- ========================================
    -- ACCESSED DATA
    -- ========================================
    accessed_tables TEXT[],
    accessed_records UUID[],
    data_accessed_at TIMESTAMP[],
    data_exported BOOLEAN DEFAULT FALSE,
    data_exported_to TEXT,
    data_exported_at TIMESTAMP,
    
    -- ========================================
    -- STATUS & REVIEW
    -- ========================================
    status break_glass_status_enum DEFAULT 'active',
    it_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    review_outcome VARCHAR(50),
    
    -- ========================================
    -- COMPLIANCE
    -- ========================================
    hipaa_compliant BOOLEAN DEFAULT FALSE,
    gdpr_compliant BOOLEAN DEFAULT FALSE,
    consent_form_url TEXT,
    incident_report_url TEXT,
    compliance_notes TEXT,
    
    -- ========================================
    -- NOTIFICATIONS
    -- ========================================
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP,
    notified_to UUID[],
    escalation_level INTEGER DEFAULT 0,
    escalated_at TIMESTAMP,
    escalation_notes TEXT,
    
    -- ========================================
    -- AUDIT
    -- ========================================
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    
    -- ========================================
    -- SOFT DELETE
    -- ========================================
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    -- ========================================
    -- CONSTRAINTS
    -- ========================================
    CONSTRAINT fk_break_glass_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_break_glass_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_break_glass_witness FOREIGN KEY (witness_id) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_break_glass_reviewed_by FOREIGN KEY (reviewed_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_break_glass_user_department FOREIGN KEY (user_department) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_break_glass_witness_department FOREIGN KEY (witness_department) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_break_glass_created_by FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_break_glass_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_break_glass_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (access_end >= access_start),
    CONSTRAINT check_auto_expiry CHECK (auto_expiry_time >= access_start),
    CONSTRAINT check_review_dates CHECK (reviewed_at >= created_at),
    CONSTRAINT check_witness_consent CHECK (witness_id IS NOT NULL OR witness_consent = FALSE),
    CONSTRAINT check_escalation CHECK (escalation_level >= 0),
    CONSTRAINT check_duration CHECK (actual_access_duration >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_break_glass_request_id ON break_glass_access(access_request_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_type ON break_glass_access(access_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_status ON break_glass_access(status) WHERE is_deleted = FALSE;

-- User & patient indexes
CREATE INDEX IF NOT EXISTS idx_break_glass_user ON break_glass_access(user_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_patient ON break_glass_access(patient_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_witness ON break_glass_access(witness_id) WHERE witness_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_user_dept ON break_glass_access(user_department) WHERE user_department IS NOT NULL AND is_deleted = FALSE;

-- Reason indexes
CREATE INDEX IF NOT EXISTS idx_break_glass_reason ON break_glass_access(reason_category) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_incident ON break_glass_access(incident_number) WHERE incident_number IS NOT NULL AND is_deleted = FALSE;

-- Timeline indexes
CREATE INDEX IF NOT EXISTS idx_break_glass_access_start ON break_glass_access(access_start) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_access_end ON break_glass_access(access_end) WHERE access_end IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_auto_expiry ON break_glass_access(auto_expiry_time) WHERE auto_expiry_time IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_expired ON break_glass_access(is_auto_expired) WHERE is_auto_expired = TRUE AND is_deleted = FALSE;

-- Review indexes
CREATE INDEX IF NOT EXISTS idx_break_glass_reviewed ON break_glass_access(it_reviewed) WHERE it_reviewed = FALSE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_reviewed_by ON break_glass_access(reviewed_by) WHERE reviewed_by IS NOT NULL AND is_deleted = FALSE;

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_break_glass_notification ON break_glass_access(notification_sent) WHERE notification_sent = FALSE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_break_glass_escalation ON break_glass_access(escalation_level) WHERE escalation_level > 0 AND is_deleted = FALSE;

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_break_glass_hipaa ON break_glass_access(hipaa_compliant) WHERE hipaa_compliant = FALSE AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_break_glass_deleted ON break_glass_access(is_deleted, deleted_at);

-- GIN indexes for arrays and JSONB
CREATE INDEX IF NOT EXISTS idx_break_glass_accessed_tables ON break_glass_access USING gin(accessed_tables);
CREATE INDEX IF NOT EXISTS idx_break_glass_accessed_records ON break_glass_access USING gin(accessed_records);
CREATE INDEX IF NOT EXISTS idx_break_glass_notified_to ON break_glass_access USING gin(notified_to);
CREATE INDEX IF NOT EXISTS idx_break_glass_device_info ON break_glass_access USING gin(user_device_info);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_break_glass_updated_at') THEN
        CREATE TRIGGER update_break_glass_updated_at
            BEFORE UPDATE ON break_glass_access
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_break_glass_updated_at';
    END IF;
END $$;

-- Function to auto-expire access
CREATE OR REPLACE FUNCTION auto_expire_break_glass()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.auto_expiry_time IS NOT NULL AND NEW.auto_expiry_time <= CURRENT_TIMESTAMP THEN
        NEW.is_auto_expired = TRUE;
        NEW.status = 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-expiry
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'check_break_glass_expiry') THEN
        CREATE TRIGGER check_break_glass_expiry
            BEFORE INSERT OR UPDATE OF auto_expiry_time ON break_glass_access
            FOR EACH ROW
            EXECUTE FUNCTION auto_expire_break_glass();
        RAISE NOTICE 'Created trigger check_break_glass_expiry';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE break_glass_access IS 'Complete break glass access logging for emergency data access';
COMMENT ON COLUMN break_glass_access.id IS 'Primary key - UUID';
COMMENT ON COLUMN break_glass_access.access_request_id IS 'Unique access request identifier';
COMMENT ON COLUMN break_glass_access.access_type IS 'Type of break glass access';
COMMENT ON COLUMN break_glass_access.user_id IS 'User who requested access';
COMMENT ON COLUMN break_glass_access.user_role IS 'User role at time of access (snapshot)';
COMMENT ON COLUMN break_glass_access.user_department IS 'User department at time of access';
COMMENT ON COLUMN break_glass_access.user_ip_address IS 'IP address of user';
COMMENT ON COLUMN break_glass_access.user_device_info IS 'Device information of user';
COMMENT ON COLUMN break_glass_access.patient_id IS 'Patient whose data was accessed';
COMMENT ON COLUMN break_glass_access.patient_consent_obtained IS 'Whether patient consent was obtained';
COMMENT ON COLUMN break_glass_access.patient_consent_time IS 'When patient consent was obtained';
COMMENT ON COLUMN break_glass_access.patient_representative_name IS 'Name of patient representative';
COMMENT ON COLUMN break_glass_access.patient_representative_relation IS 'Relation to patient';
COMMENT ON COLUMN break_glass_access.reason IS 'Detailed reason for access';
COMMENT ON COLUMN break_glass_access.reason_category IS 'Category of reason';
COMMENT ON COLUMN break_glass_access.clinical_context IS 'Clinical context of emergency';
COMMENT ON COLUMN break_glass_access.emergency_details IS 'Emergency details';
COMMENT ON COLUMN break_glass_access.incident_number IS 'Incident/emergency number';
COMMENT ON COLUMN break_glass_access.witness_id IS 'Witness user ID';
COMMENT ON COLUMN break_glass_access.witness_name IS 'Witness name (if not a user)';
COMMENT ON COLUMN break_glass_access.witness_role IS 'Witness role';
COMMENT ON COLUMN break_glass_access.witness_department IS 'Witness department';
COMMENT ON COLUMN break_glass_access.witness_statement IS 'Witness statement';
COMMENT ON COLUMN break_glass_access.witness_consent IS 'Whether witness consented';
COMMENT ON COLUMN break_glass_access.access_start IS 'When access started';
COMMENT ON COLUMN break_glass_access.access_end IS 'When access ended';
COMMENT ON COLUMN break_glass_access.actual_access_duration IS 'Actual access duration in minutes';
COMMENT ON COLUMN break_glass_access.auto_expiry_time IS 'Automatic expiry time';
COMMENT ON COLUMN break_glass_access.is_auto_expired IS 'Whether auto-expired';
COMMENT ON COLUMN break_glass_access.accessed_tables IS 'Tables accessed';
COMMENT ON COLUMN break_glass_access.accessed_records IS 'Records accessed';
COMMENT ON COLUMN break_glass_access.data_accessed_at IS 'Timestamps of data access';
COMMENT ON COLUMN break_glass_access.data_exported IS 'Whether data was exported';
COMMENT ON COLUMN break_glass_access.data_exported_to IS 'Where data was exported';
COMMENT ON COLUMN break_glass_access.data_exported_at IS 'When data was exported';
COMMENT ON COLUMN break_glass_access.status IS 'Current status';
COMMENT ON COLUMN break_glass_access.it_reviewed IS 'Whether IT reviewed';
COMMENT ON COLUMN break_glass_access.reviewed_by IS 'User who reviewed';
COMMENT ON COLUMN break_glass_access.reviewed_at IS 'When reviewed';
COMMENT ON COLUMN break_glass_access.review_notes IS 'Review notes';
COMMENT ON COLUMN break_glass_access.review_outcome IS 'Review outcome';
COMMENT ON COLUMN break_glass_access.hipaa_compliant IS 'Whether HIPAA compliant';
COMMENT ON COLUMN break_glass_access.gdpr_compliant IS 'Whether GDPR compliant';
COMMENT ON COLUMN break_glass_access.consent_form_url IS 'URL to consent form';
COMMENT ON COLUMN break_glass_access.incident_report_url IS 'URL to incident report';
COMMENT ON COLUMN break_glass_access.compliance_notes IS 'Compliance notes';
COMMENT ON COLUMN break_glass_access.notification_sent IS 'Whether notification sent';
COMMENT ON COLUMN break_glass_access.notification_sent_at IS 'When notification sent';
COMMENT ON COLUMN break_glass_access.notified_to IS 'Users notified';
COMMENT ON COLUMN break_glass_access.escalation_level IS 'Escalation level';
COMMENT ON COLUMN break_glass_access.escalated_at IS 'When escalated';
COMMENT ON COLUMN break_glass_access.escalation_notes IS 'Escalation notes';
COMMENT ON COLUMN break_glass_access.is_deleted IS 'Soft delete flag';

-- ============================================
-- PART 6: VERIFICATION
-- ============================================

DO $$
DECLARE
    table_exists BOOLEAN;
    column_count INTEGER;
    index_count INTEGER;
    fk_count INTEGER;
    check_count INTEGER;
    trigger_count INTEGER;
    enum_count INTEGER;
    generated_count INTEGER;
BEGIN
    -- Check table
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'break_glass_access') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'break_glass_access';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'break_glass_access';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'break_glass_access'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'break_glass_access'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'break_glass_access';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('break_glass_type_enum', 'break_glass_reason_enum', 'break_glass_status_enum');
    
    -- Count generated columns
    SELECT COUNT(*) INTO generated_count FROM information_schema.columns WHERE table_name = 'break_glass_access' AND is_generated = 'ALWAYS';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 021_create_break_glass_access.sql COMPLETED';
    RAISE NOTICE 'Break Glass Access table exists: %', table_exists;
    RAISE NOTICE 'Total columns: %', column_count;
    RAISE NOTICE 'Generated columns: %', generated_count;
    RAISE NOTICE 'Total indexes: %', index_count;
    RAISE NOTICE 'Foreign keys: %', fk_count;
    RAISE NOTICE 'Check constraints: %', check_count;
    RAISE NOTICE 'Triggers: %', trigger_count;
    RAISE NOTICE 'Enums created: %', enum_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================
-- END OF MIGRATION - SAFE TO RUN MULTIPLE TIMES
-- ============================================