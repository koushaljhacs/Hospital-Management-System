-- ============================================
-- MIGRATION: 022_create_audit_logs.sql
-- DESCRIPTION: Create audit_logs table for comprehensive system auditing
-- SAFE MIGRATION: Can be run multiple times without errors
-- DEPENDS ON: users table, departments table
-- ============================================

-- ============================================
-- PART 1: SAFE ENUM TYPE CREATION
-- ============================================

-- Create audit_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_type_enum') THEN
        CREATE TYPE audit_type_enum AS ENUM (
            'create', 'read', 'update', 'delete',
            'login', 'logout', 'export', 'import',
            'print', 'share', 'view', 'search',
            'api_call', 'system_event', 'security_event',
            'compliance_event'
        );
        RAISE NOTICE 'Created audit_type_enum type';
    END IF;
END $$;

-- Create action_category enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_category_enum') THEN
        CREATE TYPE action_category_enum AS ENUM (
            'data_operation', 'authentication', 'authorization',
            'configuration', 'maintenance', 'reporting',
            'integration', 'user_management', 'patient_management',
            'clinical', 'billing', 'pharmacy', 'laboratory',
            'radiology', 'emergency'
        );
        RAISE NOTICE 'Created action_category_enum type';
    END IF;
END $$;

-- Create action_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_status_enum') THEN
        CREATE TYPE action_status_enum AS ENUM (
            'success', 'failure', 'pending', 'cancelled',
            'timeout', 'error', 'unauthorized', 'forbidden',
            'not_found', 'validation_error'
        );
        RAISE NOTICE 'Created action_status_enum type';
    END IF;
END $$;

-- ============================================
-- PART 2: CREATE AUDIT LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    -- ========================================
    -- CORE FIELDS
    -- ========================================
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id VARCHAR(50) UNIQUE NOT NULL,
    audit_type audit_type_enum NOT NULL,
    audit_sub_type VARCHAR(100),
    
    -- ========================================
    -- USER INFORMATION
    -- ========================================
    user_id UUID NOT NULL,
    username VARCHAR(100),
    user_role VARCHAR(50),
    user_department UUID,
    user_email VARCHAR(255),
    session_id VARCHAR(100),
    auth_method VARCHAR(50),
    impersonated_by UUID,
    delegation_chain JSONB,
    
    -- ========================================
    -- ACTION DETAILS
    -- ========================================
    action VARCHAR(100) NOT NULL,
    action_category action_category_enum NOT NULL,
    action_status action_status_enum NOT NULL,
    action_duration_ms INTEGER,
    http_method VARCHAR(10),
    endpoint_url TEXT,
    query_parameters JSONB,
    request_payload JSONB,
    response_status_code INTEGER,
    response_payload JSONB,
    error_message TEXT,
    error_stack_trace TEXT,
    
    -- ========================================
    -- DATABASE OBJECTS
    -- ========================================
    table_name VARCHAR(100) NOT NULL,
    schema_name VARCHAR(50) DEFAULT 'public',
    record_id VARCHAR(100),
    record_id_type VARCHAR(20),
    record_identifier_field VARCHAR(50),
    record_identifier_value TEXT,
    
    -- ========================================
    -- DATA CHANGES
    -- ========================================
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[],
    field_changes JSONB,
    data_diff JSONB,
    data_hash_old VARCHAR(64),
    data_hash_new VARCHAR(64),
    data_size_bytes_old INTEGER,
    data_size_bytes_new INTEGER,
    
    -- ========================================
    -- BEFORE & AFTER STATE
    -- ========================================
    before_state JSONB,
    after_state JSONB,
    before_version INTEGER,
    after_version INTEGER,
    before_checksum VARCHAR(64),
    after_checksum VARCHAR(64),
    
    -- ========================================
    -- REQUEST INFORMATION
    -- ========================================
    ip_address INET,
    ip_location JSONB,
    user_agent TEXT,
    device_type VARCHAR(50),
    browser_name VARCHAR(50),
    browser_version VARCHAR(50),
    os_name VARCHAR(50),
    os_version VARCHAR(50),
    referer_url TEXT,
    origin_url TEXT,
    
    -- ========================================
    -- SESSION & CONTEXT
    -- ========================================
    session_context JSONB,
    request_id UUID,
    correlation_id UUID,
    transaction_id UUID,
    workflow_instance_id UUID,
    business_process_id VARCHAR(100),
    business_process_step INTEGER,
    
    -- ========================================
    -- COMPLIANCE & SECURITY
    -- ========================================
    contains_phi BOOLEAN DEFAULT FALSE,
    contains_pii BOOLEAN DEFAULT FALSE,
    contains_financial BOOLEAN DEFAULT FALSE,
    sensitivity_level INTEGER DEFAULT 1,
    encryption_status VARCHAR(50),
    retention_period_days INTEGER,
    legal_hold_applied BOOLEAN DEFAULT FALSE,
    legal_hold_reason TEXT,
    data_classification VARCHAR(50),
    
    -- ========================================
    -- APPROVAL & AUTHORIZATION
    -- ========================================
    required_approval BOOLEAN DEFAULT FALSE,
    approval_id UUID,
    approved_by UUID,
    approved_at TIMESTAMP,
    approval_notes TEXT,
    authorization_token VARCHAR(255),
    authorization_method VARCHAR(50),
    
    -- ========================================
    -- NOTIFICATIONS
    -- ========================================
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP,
    notified_to UUID[],
    alert_triggered BOOLEAN DEFAULT FALSE,
    alert_severity INTEGER,
    alert_rule_id UUID,
    
    -- ========================================
    -- METADATA
    -- ========================================
    environment VARCHAR(50),
    version VARCHAR(20),
    release_id VARCHAR(100),
    build_number INTEGER,
    deployment_id VARCHAR(100),
    server_hostname VARCHAR(255),
    server_ip INET,
    instance_id UUID,
    
    -- ========================================
    -- TAGS & LABELS
    -- ========================================
    tags TEXT[],
    labels JSONB,
    custom_fields JSONB,
    
    -- ========================================
    -- TIMESTAMPS
    -- ========================================
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    archived_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    -- ========================================
    -- PARTITIONING
    -- ========================================
    year_partition INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM created_at)) STORED,
    month_partition INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM created_at)) STORED,
    day_partition INTEGER GENERATED ALWAYS AS (EXTRACT(DAY FROM created_at)) STORED,
    
    -- ========================================
    -- SOFT DELETE (rarely used for audit logs)
    -- ========================================
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    deletion_reason TEXT,
    
    -- ========================================
    -- CONSTRAINTS
    -- ========================================
    CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_audit_logs_user_department FOREIGN KEY (user_department) 
        REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_logs_impersonated_by FOREIGN KEY (impersonated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_logs_approved_by FOREIGN KEY (approved_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_logs_deleted_by FOREIGN KEY (deleted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    
    -- Check constraints
    CONSTRAINT check_dates CHECK (processed_at >= created_at),
    CONSTRAINT check_expiry CHECK (expires_at >= created_at),
    CONSTRAINT check_archive CHECK (archived_at >= created_at),
    CONSTRAINT check_approval CHECK (approved_at >= created_at),
    CONSTRAINT check_sensitivity CHECK (sensitivity_level BETWEEN 1 AND 5),
    CONSTRAINT check_alert_severity CHECK (alert_severity BETWEEN 1 AND 5),
    CONSTRAINT check_retention CHECK (retention_period_days >= 0),
    CONSTRAINT check_business_step CHECK (business_process_step >= 0),
    CONSTRAINT check_duration CHECK (action_duration_ms >= 0)
);

-- ============================================
-- PART 3: CREATE INDEXES
-- ============================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_audit_id ON audit_logs(audit_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_type ON audit_logs(audit_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(action_category) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(action_status) WHERE is_deleted = FALSE;

-- User indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_role ON audit_logs(user_role) WHERE user_role IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_dept ON audit_logs(user_department) WHERE user_department IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs(session_id) WHERE session_id IS NOT NULL AND is_deleted = FALSE;

-- Action indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_http_method ON audit_logs(http_method) WHERE http_method IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_response_code ON audit_logs(response_status_code) WHERE response_status_code IS NOT NULL AND is_deleted = FALSE;

-- Database object indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_schema ON audit_logs(schema_name) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON audit_logs(record_id) WHERE record_id IS NOT NULL AND is_deleted = FALSE;

-- Date indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_processed_at ON audit_logs(processed_at) WHERE processed_at IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_expires_at ON audit_logs(expires_at) WHERE expires_at IS NOT NULL AND is_deleted = FALSE;

-- Partition indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_year ON audit_logs(year_partition) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_month ON audit_logs(month_partition) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_day ON audit_logs(day_partition) WHERE is_deleted = FALSE;

-- Compliance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_phi ON audit_logs(contains_phi) WHERE contains_phi = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_pii ON audit_logs(contains_pii) WHERE contains_pii = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_sensitivity ON audit_logs(sensitivity_level) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_legal_hold ON audit_logs(legal_hold_applied) WHERE legal_hold_applied = TRUE AND is_deleted = FALSE;

-- Request indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip_address) WHERE ip_address IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_device ON audit_logs(device_type) WHERE device_type IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_browser ON audit_logs(browser_name) WHERE browser_name IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_os ON audit_logs(os_name) WHERE os_name IS NOT NULL AND is_deleted = FALSE;

-- Correlation indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id) WHERE correlation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_transaction_id ON audit_logs(transaction_id) WHERE transaction_id IS NOT NULL AND is_deleted = FALSE;

-- Approval indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_approval ON audit_logs(required_approval) WHERE required_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_approved_by ON audit_logs(approved_by) WHERE approved_by IS NOT NULL AND is_deleted = FALSE;

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_notification ON audit_logs(notification_sent) WHERE notification_sent = FALSE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_alert ON audit_logs(alert_triggered) WHERE alert_triggered = TRUE AND is_deleted = FALSE;

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_audit_logs_deleted ON audit_logs(is_deleted, deleted_at);

-- GIN indexes for arrays and JSONB
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_fields ON audit_logs USING gin(changed_fields);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tags ON audit_logs USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_audit_logs_notified_to ON audit_logs USING gin(notified_to);

CREATE INDEX IF NOT EXISTS idx_audit_logs_delegation_chain ON audit_logs USING gin(delegation_chain);
CREATE INDEX IF NOT EXISTS idx_audit_logs_query_params ON audit_logs USING gin(query_parameters);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request_payload ON audit_logs USING gin(request_payload);
CREATE INDEX IF NOT EXISTS idx_audit_logs_response_payload ON audit_logs USING gin(response_payload);
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_data ON audit_logs USING gin(old_data);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_data ON audit_logs USING gin(new_data);
CREATE INDEX IF NOT EXISTS idx_audit_logs_field_changes ON audit_logs USING gin(field_changes);
CREATE INDEX IF NOT EXISTS idx_audit_logs_data_diff ON audit_logs USING gin(data_diff);
CREATE INDEX IF NOT EXISTS idx_audit_logs_before_state ON audit_logs USING gin(before_state);
CREATE INDEX IF NOT EXISTS idx_audit_logs_after_state ON audit_logs USING gin(after_state);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_location ON audit_logs USING gin(ip_location);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_context ON audit_logs USING gin(session_context);
CREATE INDEX IF NOT EXISTS idx_audit_logs_labels ON audit_logs USING gin(labels);
CREATE INDEX IF NOT EXISTS idx_audit_logs_custom_fields ON audit_logs USING gin(custom_fields);

-- ============================================
-- PART 4: CREATE TRIGGERS
-- ============================================

-- Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_audit_logs_updated_at') THEN
        CREATE TRIGGER update_audit_logs_updated_at
            BEFORE UPDATE ON audit_logs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE 'Created trigger update_audit_logs_updated_at';
    END IF;
END $$;

-- Function to calculate data hash
CREATE OR REPLACE FUNCTION calculate_audit_data_hash()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.old_data IS NOT NULL THEN
        NEW.data_hash_old = encode(sha256(NEW.old_data::text::bytea), 'hex');
        NEW.data_size_bytes_old = octet_length(NEW.old_data::text::bytea);
    END IF;
    
    IF NEW.new_data IS NOT NULL THEN
        NEW.data_hash_new = encode(sha256(NEW.new_data::text::bytea), 'hex');
        NEW.data_size_bytes_new = octet_length(NEW.new_data::text::bytea);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for data hash calculation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'calculate_audit_data_hash') THEN
        CREATE TRIGGER calculate_audit_data_hash
            BEFORE INSERT OR UPDATE OF old_data, new_data ON audit_logs
            FOR EACH ROW
            EXECUTE FUNCTION calculate_audit_data_hash();
        RAISE NOTICE 'Created trigger calculate_audit_data_hash';
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE audit_logs IS 'Comprehensive audit logging system for HIPAA/GDPR compliance';
COMMENT ON COLUMN audit_logs.id IS 'Primary key - UUID';
COMMENT ON COLUMN audit_logs.audit_id IS 'Unique audit identifier';
COMMENT ON COLUMN audit_logs.audit_type IS 'Type of audit event';
COMMENT ON COLUMN audit_logs.user_id IS 'User who performed action';
COMMENT ON COLUMN audit_logs.username IS 'Username snapshot at time of action';
COMMENT ON COLUMN audit_logs.user_role IS 'User role snapshot at time of action';
COMMENT ON COLUMN audit_logs.action IS 'Action performed';
COMMENT ON COLUMN audit_logs.action_category IS 'Category of action';
COMMENT ON COLUMN audit_logs.action_status IS 'Status of action';
COMMENT ON COLUMN audit_logs.table_name IS 'Database table affected';
COMMENT ON COLUMN audit_logs.record_id IS 'ID of affected record';
COMMENT ON COLUMN audit_logs.old_data IS 'Data before change';
COMMENT ON COLUMN audit_logs.new_data IS 'Data after change';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of requester';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string';
COMMENT ON COLUMN audit_logs.contains_phi IS 'Whether audit contains PHI';
COMMENT ON COLUMN audit_logs.contains_pii IS 'Whether audit contains PII';
COMMENT ON COLUMN audit_logs.sensitivity_level IS 'Data sensitivity level (1-5)';
COMMENT ON COLUMN audit_logs.retention_period_days IS 'Retention period in days';
COMMENT ON COLUMN audit_logs.legal_hold_applied IS 'Whether on legal hold';
COMMENT ON COLUMN audit_logs.year_partition IS 'Year for partitioning';
COMMENT ON COLUMN audit_logs.month_partition IS 'Month for partitioning';
COMMENT ON COLUMN audit_logs.day_partition IS 'Day for partitioning';

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
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') INTO table_exists;
    
    -- Count columns
    SELECT COUNT(*) INTO column_count FROM information_schema.columns WHERE table_name = 'audit_logs';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count FROM pg_indexes WHERE tablename = 'audit_logs';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO fk_count FROM pg_constraint WHERE conrelid = 'audit_logs'::regclass AND contype = 'f';
    
    -- Count check constraints
    SELECT COUNT(*) INTO check_count FROM pg_constraint WHERE conrelid = 'audit_logs'::regclass AND contype = 'c';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count FROM information_schema.triggers WHERE event_object_table = 'audit_logs';
    
    -- Count enums
    SELECT COUNT(*) INTO enum_count FROM pg_type WHERE typname IN ('audit_type_enum', 'action_category_enum', 'action_status_enum');
    
    -- Count generated columns
    SELECT COUNT(*) INTO generated_count FROM information_schema.columns WHERE table_name = 'audit_logs' AND is_generated = 'ALWAYS';
    
    -- Report
    RAISE NOTICE '============================================';
    RAISE NOTICE 'MIGRATION 022_create_audit_logs.sql COMPLETED';
    RAISE NOTICE 'Audit Logs table exists: %', table_exists;
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