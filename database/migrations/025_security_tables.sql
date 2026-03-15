-- ============================================
-- FILE: database/migrations/024_security_tables.sql
-- DESCRIPTION: Complete security implementation tables for authentication, authorization, data protection, and compliance
-- SAFE MIGRATION: Can be run multiple times without errors
-- ============================================

-- ============================================
-- PART 1: AUTHENTICATION TABLES (SR-01 to SR-05)
-- ============================================

-- [SR-01] Strong password policy
CREATE TABLE IF NOT EXISTS password_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(100) NOT NULL,
    min_length INTEGER DEFAULT 8,
    require_uppercase BOOLEAN DEFAULT TRUE,
    require_lowercase BOOLEAN DEFAULT TRUE,
    require_numbers BOOLEAN DEFAULT TRUE,
    require_special BOOLEAN DEFAULT TRUE,
    special_chars VARCHAR(50) DEFAULT '!@#$%^&*',
    max_age_days INTEGER DEFAULT 90,
    password_history_count INTEGER DEFAULT 5,
    max_login_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    session_timeout_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT FALSE,
    failure_reason VARCHAR(255),
    CONSTRAINT fk_login_attempts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- [SR-02] Multi-factor authentication (future)
CREATE TABLE IF NOT EXISTS mfa_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_method VARCHAR(50), -- totp/sms/email
    secret_key VARCHAR(255),
    backup_codes TEXT[],
    recovery_email VARCHAR(255),
    recovery_phone VARCHAR(20),
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mfa_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mfa_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_token VARCHAR(500),
    mfa_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    expires_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mfa_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [SR-03] Session management
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    refresh_token VARCHAR(500) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    logout_time TIMESTAMP,
    logout_reason VARCHAR(100),
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- [SR-04] Remember me functionality
CREATE TABLE IF NOT EXISTS remember_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    series_identifier VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_remember_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_series UNIQUE (user_id, series_identifier)
);

-- [SR-05] OTP for sensitive operations
CREATE TABLE IF NOT EXISTS otp_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(100), -- login/payment/password_reset/sensitive_action
    transaction_data JSONB,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    verified_ip INET,
    verified_ua TEXT,
    attempt_count INTEGER DEFAULT 0,
    status VARCHAR(50), -- pending/verified/expired/failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_otp_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- PART 2: AUTHORIZATION TABLES (SR-06 to SR-09)
-- ============================================

-- [SR-06] Role-based access control
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(50) UNIQUE NOT NULL,
    role_description TEXT,
    role_level INTEGER, -- 1-10 (higher = more privileged)
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    CONSTRAINT fk_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- [SR-07] Permission matrix
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    permission_category VARCHAR(50), -- patient/clinical/billing/admin/report
    resource_type VARCHAR(50), -- table/api/page/feature
    resource_name VARCHAR(100),
    action_type VARCHAR(50), -- create/read/update/delete/execute
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    grant_type VARCHAR(20), -- allow/deny
    conditions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_role_permission UNIQUE (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    assigned_by UUID,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- [SR-08] Data-level security
CREATE TABLE IF NOT EXISTS data_access_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    row_filter_condition TEXT, -- SQL condition for row filtering
    applies_to_roles UUID[],
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    CONSTRAINT fk_data_access_policies_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- [SR-09] Field-level security for PHI
CREATE TABLE IF NOT EXISTS field_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100) NOT NULL,
    phi_level VARCHAR(50), -- phi/pii/financial/public
    masking_rule VARCHAR(50), -- full/partial/none
    masking_pattern VARCHAR(100), -- 'XXX-XX-1234' for SSN
    encryption_required BOOLEAN DEFAULT FALSE,
    allowed_roles UUID[], -- roles that can view unredacted
    audit_access BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_table_column UNIQUE (table_name, column_name)
);

-- ============================================
-- PART 3: DATA PROTECTION TABLES (SR-10 to SR-14)
-- ============================================

-- [SR-10] Encrypt sensitive data at rest (AES-256)
CREATE TABLE IF NOT EXISTS encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_identifier VARCHAR(100) UNIQUE NOT NULL,
    key_type VARCHAR(50), -- master/data/backup
    algorithm VARCHAR(50), -- AES-256-GCM/AES-256-CBC
    key_status VARCHAR(50), -- active/rotated/compromised/expired
    key_version INTEGER NOT NULL,
    encrypted_key TEXT, -- encrypted master key
    key_checksum VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activated_at TIMESTAMP,
    expires_at TIMESTAMP,
    rotated_at TIMESTAMP,
    rotated_by UUID,
    notes TEXT,
    CONSTRAINT fk_encryption_keys_rotated_by FOREIGN KEY (rotated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS encrypted_data_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    column_name VARCHAR(100) NOT NULL,
    encrypted_value TEXT,
    key_id UUID NOT NULL,
    encryption_iv VARCHAR(64),
    encryption_auth_tag VARCHAR(64),
    encrypted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    encrypted_by UUID,
    CONSTRAINT fk_encrypted_data_key FOREIGN KEY (key_id) REFERENCES encryption_keys(id) ON DELETE RESTRICT,
    CONSTRAINT fk_encrypted_data_by FOREIGN KEY (encrypted_by) REFERENCES users(id) ON DELETE SET NULL
);

-- [SR-13] Audit all access to PHI
CREATE TABLE IF NOT EXISTS phi_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    access_type VARCHAR(50), -- view/export/print/modify
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    field_name VARCHAR(100),
    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    purpose TEXT,
    is_authorized BOOLEAN,
    justification TEXT,
    CONSTRAINT fk_phi_access_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_phi_access_logs_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- [SR-14] Data masking for non-privileged users
CREATE TABLE IF NOT EXISTS data_masking_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    column_name VARCHAR(100) NOT NULL,
    mask_type VARCHAR(50), -- full/partial/dynamic/null
    mask_expression TEXT, -- SQL expression for masking
    unmasked_roles UUID[], -- roles that see original
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PART 4: COMPLIANCE TABLES (SR-15 to SR-19)
-- ============================================

-- [SR-16] Data retention policy (7 years)
CREATE TABLE IF NOT EXISTS retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(100) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    retention_period_days INTEGER NOT NULL,
    archive_action VARCHAR(50), -- delete/anonymize/archive
    archive_location VARCHAR(500),
    exempt_roles UUID[], -- roles exempt from deletion
    notification_days_before INTEGER DEFAULT 30,
    last_executed TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    CONSTRAINT fk_retention_policies_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS data_retention_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action_taken VARCHAR(50), -- deleted/anonymized/archived
    action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_by VARCHAR(50), -- system/admin
    user_id UUID,
    details JSONB,
    CONSTRAINT fk_data_retention_logs_policy FOREIGN KEY (policy_id) REFERENCES retention_policies(id) ON DELETE CASCADE,
    CONSTRAINT fk_data_retention_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- [SR-17] Right to deletion (GDPR ready)
CREATE TABLE IF NOT EXISTS deletion_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requestor_type VARCHAR(50), -- patient/user
    requestor_id UUID NOT NULL,
    request_reason TEXT,
    request_status VARCHAR(50), -- pending/approved/rejected/processing/completed
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID,
    reviewed_date TIMESTAMP,
    review_notes TEXT,
    completion_date TIMESTAMP,
    deletion_details JSONB,
    consent_withdrawn BOOLEAN DEFAULT FALSE,
    data_exported BOOLEAN DEFAULT FALSE,
    export_file_url TEXT,
    CONSTRAINT fk_deletion_requests_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- [SR-18] Consent management
CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL,
    consent_type VARCHAR(100), -- treatment/data_sharing/marketing/research
    consent_version VARCHAR(20),
    consent_text TEXT,
    is_granted BOOLEAN NOT NULL,
    granted_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP,
    revocation_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    document_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    CONSTRAINT fk_consent_records_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    CONSTRAINT fk_consent_records_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consent_id UUID NOT NULL,
    action VARCHAR(50), -- grant/update/revoke/expire
    action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performed_by UUID,
    ip_address INET,
    user_agent TEXT,
    changes JSONB,
    CONSTRAINT fk_consent_logs_consent FOREIGN KEY (consent_id) REFERENCES consent_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_consent_logs_performed_by FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- [SR-19] Breach notification protocol
CREATE TABLE IF NOT EXISTS breach_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breach_type VARCHAR(100), -- data/security/phi
    breach_date TIMESTAMP NOT NULL,
    discovery_date TIMESTAMP NOT NULL,
    description TEXT NOT NULL,
    affected_records INTEGER,
    affected_patients INTEGER,
    severity VARCHAR(50), -- low/medium/high/critical
    status VARCHAR(50), -- investigating/contained/resolved/closed
    containment_actions TEXT,
    notification_required BOOLEAN DEFAULT FALSE,
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_date TIMESTAMP,
    regulatory_report_required BOOLEAN DEFAULT FALSE,
    regulatory_report_date TIMESTAMP,
    reported_by UUID,
    closed_by UUID,
    closed_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_breach_records_reported_by FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_breach_records_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS breach_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breach_id UUID NOT NULL,
    notification_type VARCHAR(50), -- patient/regulatory/media
    recipient TEXT,
    notification_method VARCHAR(50), -- email/sms/letter
    notification_date TIMESTAMP,
    notification_content TEXT,
    sent_by UUID,
    delivery_status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_breach_notifications_breach FOREIGN KEY (breach_id) REFERENCES breach_records(id) ON DELETE CASCADE,
    CONSTRAINT fk_breach_notifications_sent_by FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- PART 5: INDEXES FOR PERFORMANCE
-- ============================================

-- Authentication indexes
CREATE INDEX idx_password_history_user ON password_history(user_id);
CREATE INDEX idx_login_attempts_user ON login_attempts(user_id);
CREATE INDEX idx_login_attempts_time ON login_attempts(attempt_time);
CREATE INDEX idx_mfa_settings_user ON mfa_settings(user_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_refresh ON sessions(refresh_token);
CREATE INDEX idx_sessions_active ON sessions(is_active);
CREATE INDEX idx_remember_tokens_user ON remember_tokens(user_id);
CREATE INDEX idx_remember_tokens_series ON remember_tokens(series_identifier);
CREATE INDEX idx_otp_transactions_user ON otp_transactions(user_id);
CREATE INDEX idx_otp_transactions_status ON otp_transactions(status);

-- Authorization indexes
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_active ON user_roles(is_active);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);
CREATE INDEX idx_permissions_category ON permissions(permission_category);
CREATE INDEX idx_data_access_policies_table ON data_access_policies(table_name);
CREATE INDEX idx_field_security_table ON field_security(table_name);

-- Data protection indexes
CREATE INDEX idx_encrypted_data_key ON encrypted_data_references(key_id);
CREATE INDEX idx_encrypted_data_record ON encrypted_data_references(table_name, record_id);
CREATE INDEX idx_phi_access_logs_user ON phi_access_logs(user_id);
CREATE INDEX idx_phi_access_logs_time ON phi_access_logs(access_time);
CREATE INDEX idx_phi_access_logs_record ON phi_access_logs(table_name, record_id);

-- Compliance indexes
CREATE INDEX idx_retention_policies_table ON retention_policies(table_name);
CREATE INDEX idx_retention_policies_active ON retention_policies(is_active);
CREATE INDEX idx_deletion_requests_status ON deletion_requests(request_status);
CREATE INDEX idx_consent_records_patient ON consent_records(patient_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);
CREATE INDEX idx_consent_logs_consent ON consent_logs(consent_id);
CREATE INDEX idx_breach_records_status ON breach_records(status);
CREATE INDEX idx_breach_notifications_breach ON breach_notifications(breach_id);

-- ============================================
-- PART 6: TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_password_policy_updated_at
    BEFORE UPDATE ON password_policy
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mfa_settings_updated_at
    BEFORE UPDATE ON mfa_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_access_policies_updated_at
    BEFORE UPDATE ON data_access_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_field_security_updated_at
    BEFORE UPDATE ON field_security
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_encryption_keys_updated_at
    BEFORE UPDATE ON encryption_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retention_policies_updated_at
    BEFORE UPDATE ON retention_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consent_records_updated_at
    BEFORE UPDATE ON consent_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_breach_records_updated_at
    BEFORE UPDATE ON breach_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 7: VERIFICATION
-- ============================================

DO $$
DECLARE
    auth_tables INTEGER;
    authz_tables INTEGER;
    data_tables INTEGER;
    compliance_tables INTEGER;
    total_tables INTEGER;
BEGIN
    -- Count tables by category
    SELECT COUNT(*) INTO auth_tables FROM information_schema.tables WHERE table_name IN (
        'password_policy', 'password_history', 'login_attempts', 'mfa_settings', 
        'mfa_sessions', 'sessions', 'remember_tokens', 'otp_transactions'
    );
    
    SELECT COUNT(*) INTO authz_tables FROM information_schema.tables WHERE table_name IN (
        'roles', 'permissions', 'role_permissions', 'user_roles', 
        'data_access_policies', 'field_security'
    );
    
    SELECT COUNT(*) INTO data_tables FROM information_schema.tables WHERE table_name IN (
        'encryption_keys', 'encrypted_data_references', 'phi_access_logs', 'data_masking_rules'
    );
    
    SELECT COUNT(*) INTO compliance_tables FROM information_schema.tables WHERE table_name IN (
        'retention_policies', 'data_retention_logs', 'deletion_requests',
        'consent_records', 'consent_logs', 'breach_records', 'breach_notifications'
    );
    
    total_tables := auth_tables + authz_tables + data_tables + compliance_tables;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'SECURITY TABLES MIGRATION COMPLETED';
    RAISE NOTICE 'Authentication: % tables', auth_tables;
    RAISE NOTICE 'Authorization: % tables', authz_tables;
    RAISE NOTICE 'Data Protection: % tables', data_tables;
    RAISE NOTICE 'Compliance: % tables', compliance_tables;
    RAISE NOTICE 'Total Tables: %', total_tables;
    RAISE NOTICE 'Requirements Covered: SR-01 to SR-19';
    RAISE NOTICE '============================================';
END $$;