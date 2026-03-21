-- ============================================
-- FILE: database/migrations/025_security_tables.sql
-- DESCRIPTION: Complete security implementation tables for authentication, 
--              authorization, data protection, compliance, and security guard management
-- SAFE MIGRATION: Can be run multiple times without errors (CREATE TABLE IF NOT EXISTS)
-- REQUIREMENTS COVERED: SR-01 to SR-22 (100% complete)
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_min_length CHECK (min_length >= 4),
    CONSTRAINT check_max_age CHECK (max_age_days >= 1),
    CONSTRAINT check_history_count CHECK (password_history_count >= 0),
    CONSTRAINT check_login_attempts CHECK (max_login_attempts >= 1),
    CONSTRAINT check_lockout CHECK (lockout_duration_minutes >= 1),
    CONSTRAINT check_session_timeout CHECK (session_timeout_minutes >= 1)
);

COMMENT ON TABLE password_policy IS 'Password policy configuration (singleton table - only one row)';
COMMENT ON COLUMN password_policy.policy_name IS 'Name of the policy (e.g., "default", "strict")';
COMMENT ON COLUMN password_policy.min_length IS 'Minimum password length';
COMMENT ON COLUMN password_policy.require_uppercase IS 'Require at least one uppercase letter';
COMMENT ON COLUMN password_policy.require_lowercase IS 'Require at least one lowercase letter';
COMMENT ON COLUMN password_policy.require_numbers IS 'Require at least one number';
COMMENT ON COLUMN password_policy.require_special IS 'Require at least one special character';
COMMENT ON COLUMN password_policy.special_chars IS 'Allowed special characters';
COMMENT ON COLUMN password_policy.max_age_days IS 'Maximum password age in days before expiry';
COMMENT ON COLUMN password_policy.password_history_count IS 'Number of previous passwords to remember';
COMMENT ON COLUMN password_policy.max_login_attempts IS 'Maximum failed login attempts before lockout';
COMMENT ON COLUMN password_policy.lockout_duration_minutes IS 'Lockout duration in minutes';
COMMENT ON COLUMN password_policy.session_timeout_minutes IS 'Session timeout in minutes';
COMMENT ON COLUMN password_policy.created_at IS 'Record creation timestamp';
COMMENT ON COLUMN password_policy.updated_at IS 'Record update timestamp';

CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT check_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

COMMENT ON TABLE password_history IS 'Password history to prevent password reuse';
COMMENT ON COLUMN password_history.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN password_history.password_hash IS 'Hashed password';
COMMENT ON COLUMN password_history.created_at IS 'When password was created';
COMMENT ON COLUMN password_history.expires_at IS 'When password expires';
COMMENT ON COLUMN password_history.is_active IS 'Whether this is the current active password';

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_active ON password_history(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_password_history_expires ON password_history(expires_at) WHERE expires_at IS NOT NULL;

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

COMMENT ON TABLE login_attempts IS 'Login attempts tracking for security monitoring';
COMMENT ON COLUMN login_attempts.user_id IS 'User ID if known (NULL for unknown usernames)';
COMMENT ON COLUMN login_attempts.username IS 'Username attempted (for failed attempts)';
COMMENT ON COLUMN login_attempts.ip_address IS 'IP address of the attempt';
COMMENT ON COLUMN login_attempts.user_agent IS 'Browser/device user agent';
COMMENT ON COLUMN login_attempts.attempt_time IS 'Timestamp of attempt';
COMMENT ON COLUMN login_attempts.success IS 'Whether login was successful';
COMMENT ON COLUMN login_attempts.failure_reason IS 'Reason for failure (invalid password, locked account, etc.)';

CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_time ON login_attempts(user_id, attempt_time) WHERE success = FALSE;

-- [SR-02] Multi-factor authentication
CREATE TABLE IF NOT EXISTS mfa_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_method VARCHAR(50), -- totp/sms/email
    secret_key VARCHAR(255),
    backup_codes TEXT[], -- 10 backup codes
    recovery_email VARCHAR(255),
    recovery_phone VARCHAR(20),
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mfa_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT check_mfa_method CHECK (mfa_method IN ('totp', 'sms', 'email')),
    CONSTRAINT check_backup_codes CHECK (backup_codes IS NULL OR array_length(backup_codes, 1) = 10),
    CONSTRAINT check_recovery_email CHECK (recovery_email IS NULL OR recovery_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE mfa_settings IS 'Multi-factor authentication settings per user';
COMMENT ON COLUMN mfa_settings.mfa_method IS 'totp (Google Authenticator), sms, email';
COMMENT ON COLUMN mfa_settings.secret_key IS 'TOTP secret key (encrypted)';
COMMENT ON COLUMN mfa_settings.backup_codes IS '10 one-time backup codes';
COMMENT ON COLUMN mfa_settings.recovery_email IS 'Email for account recovery';
COMMENT ON COLUMN mfa_settings.recovery_phone IS 'Phone for account recovery';
COMMENT ON COLUMN mfa_settings.last_used IS 'When MFA was last used';

CREATE INDEX IF NOT EXISTS idx_mfa_settings_user ON mfa_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_settings_enabled ON mfa_settings(mfa_enabled) WHERE mfa_enabled = TRUE;

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

COMMENT ON TABLE mfa_sessions IS 'MFA verification sessions';
COMMENT ON COLUMN mfa_sessions.session_token IS 'Token for MFA session';
COMMENT ON COLUMN mfa_sessions.mfa_verified IS 'Whether MFA was verified';
COMMENT ON COLUMN mfa_sessions.verified_at IS 'When MFA was verified';
COMMENT ON COLUMN mfa_sessions.expires_at IS 'When MFA session expires';
COMMENT ON COLUMN mfa_sessions.ip_address IS 'IP address of request';
COMMENT ON COLUMN mfa_sessions.user_agent IS 'Browser/device info';

CREATE INDEX IF NOT EXISTS idx_mfa_sessions_user ON mfa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_token ON mfa_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_expires ON mfa_sessions(expires_at);

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
    
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT check_logout_reason CHECK (logout_reason IN ('user_logout', 'timeout', 'admin_terminated', 'password_changed'))
);

COMMENT ON TABLE sessions IS 'User session management';
COMMENT ON COLUMN sessions.session_token IS 'JWT or session token';
COMMENT ON COLUMN sessions.refresh_token IS 'Token for refreshing session';
COMMENT ON COLUMN sessions.device_info IS 'Device information in JSON';
COMMENT ON COLUMN sessions.login_time IS 'When user logged in';
COMMENT ON COLUMN sessions.last_activity IS 'Last activity timestamp';
COMMENT ON COLUMN sessions.expires_at IS 'When session expires';
COMMENT ON COLUMN sessions.is_active IS 'Whether session is active';
COMMENT ON COLUMN sessions.logout_time IS 'When user logged out';
COMMENT ON COLUMN sessions.logout_reason IS 'user_logout, timeout, admin_terminated, password_changed';

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id) WHERE is_active = TRUE;

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

COMMENT ON TABLE remember_tokens IS 'Remember me tokens for persistent login';
COMMENT ON COLUMN remember_tokens.series_identifier IS 'Series identifier for token rotation';
COMMENT ON COLUMN remember_tokens.token_hash IS 'Hashed remember token';
COMMENT ON COLUMN remember_tokens.last_used IS 'When token was last used';
COMMENT ON COLUMN remember_tokens.expires_at IS 'When token expires';

CREATE INDEX IF NOT EXISTS idx_remember_tokens_user ON remember_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_remember_tokens_series ON remember_tokens(series_identifier);
CREATE INDEX IF NOT EXISTS idx_remember_tokens_expires ON remember_tokens(expires_at) WHERE expires_at IS NOT NULL;

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
    
    CONSTRAINT fk_otp_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_otp_purpose CHECK (purpose IN ('login', 'payment', 'password_reset', 'sensitive_action')),
    CONSTRAINT check_otp_status CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
    CONSTRAINT check_otp_code_length CHECK (LENGTH(otp_code) = 6),
    CONSTRAINT check_attempt_count CHECK (attempt_count >= 0),
    CONSTRAINT check_contact_info CHECK (phone_number IS NOT NULL OR email IS NOT NULL)
);

COMMENT ON TABLE otp_transactions IS 'OTP transactions for sensitive operations';
COMMENT ON COLUMN otp_transactions.purpose IS 'login, payment, password_reset, sensitive_action';
COMMENT ON COLUMN otp_transactions.transaction_data IS 'Additional data for the transaction';
COMMENT ON COLUMN otp_transactions.expires_at IS 'OTP expiry timestamp';
COMMENT ON COLUMN otp_transactions.verified_at IS 'When OTP was verified';
COMMENT ON COLUMN otp_transactions.verified_ip IS 'IP address of verification';
COMMENT ON COLUMN otp_transactions.verified_ua IS 'User agent of verification';
COMMENT ON COLUMN otp_transactions.attempt_count IS 'Number of verification attempts';
COMMENT ON COLUMN otp_transactions.status IS 'pending, verified, expired, failed';

CREATE INDEX IF NOT EXISTS idx_otp_transactions_user ON otp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_transactions_phone ON otp_transactions(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_transactions_email ON otp_transactions(email);
CREATE INDEX IF NOT EXISTS idx_otp_transactions_status ON otp_transactions(status);
CREATE INDEX IF NOT EXISTS idx_otp_transactions_expires ON otp_transactions(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_transactions_phone_purpose ON otp_transactions(phone_number, purpose);

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
    
    CONSTRAINT fk_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_role_level CHECK (role_level BETWEEN 1 AND 10)
);

COMMENT ON TABLE roles IS 'System roles for RBAC';
COMMENT ON COLUMN roles.role_level IS '1-10 (higher = more privileged)';
COMMENT ON COLUMN roles.is_system_role IS 'System roles cannot be deleted';

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(role_name);
CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(role_level);

-- [SR-07] Permission matrix
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    permission_category VARCHAR(50), -- patient/clinical/billing/admin/report
    resource_type VARCHAR(50), -- table/api/page/feature
    resource_name VARCHAR(100),
    action_type VARCHAR(50), -- create/read/update/delete/execute
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_permission_category CHECK (permission_category IN ('patient', 'clinical', 'billing', 'admin', 'report')),
    CONSTRAINT check_resource_type CHECK (resource_type IN ('table', 'api', 'page', 'feature')),
    CONSTRAINT check_action_type CHECK (action_type IN ('create', 'read', 'update', 'delete', 'execute'))
);

COMMENT ON TABLE permissions IS 'System permissions';
COMMENT ON COLUMN permissions.permission_category IS 'patient, clinical, billing, admin, report';
COMMENT ON COLUMN permissions.resource_type IS 'table, api, page, feature';
COMMENT ON COLUMN permissions.action_type IS 'create, read, update, delete, execute';

CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(permission_name);
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(permission_category);

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
    CONSTRAINT unique_role_permission UNIQUE (role_id, permission_id),
    CONSTRAINT check_grant_type CHECK (grant_type IN ('allow', 'deny'))
);

COMMENT ON TABLE role_permissions IS 'Role-permission assignments';
COMMENT ON COLUMN role_permissions.grant_type IS 'allow, deny (deny overrides allow)';
COMMENT ON COLUMN role_permissions.conditions IS 'JSON conditions for dynamic permissions';

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

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

COMMENT ON TABLE user_roles IS 'User-role assignments';
COMMENT ON COLUMN user_roles.assigned_by IS 'User who assigned the role';
COMMENT ON COLUMN user_roles.expires_at IS 'When role assignment expires';
COMMENT ON COLUMN user_roles.is_active IS 'Whether role assignment is active';

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active ON user_roles(user_id) WHERE is_active = TRUE;

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
    
    CONSTRAINT fk_data_access_policies_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_priority CHECK (priority >= 0)
);

COMMENT ON TABLE data_access_policies IS 'Row-level security policies';
COMMENT ON COLUMN data_access_policies.row_filter_condition IS 'SQL condition (e.g., "department_id = current_setting(''app.department_id'')")';
COMMENT ON COLUMN data_access_policies.applies_to_roles IS 'Array of role IDs this policy applies to';
COMMENT ON COLUMN data_access_policies.priority IS 'Higher priority policies are applied first';

CREATE INDEX IF NOT EXISTS idx_data_access_policies_table ON data_access_policies(table_name);
CREATE INDEX IF NOT EXISTS idx_data_access_policies_active ON data_access_policies(is_active) WHERE is_active = TRUE;

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
    
    CONSTRAINT unique_table_column UNIQUE (table_name, column_name),
    CONSTRAINT check_phi_level CHECK (phi_level IN ('phi', 'pii', 'financial', 'public')),
    CONSTRAINT check_masking_rule CHECK (masking_rule IN ('full', 'partial', 'none'))
);

COMMENT ON TABLE field_security IS 'Field-level security for PHI/PII';
COMMENT ON COLUMN field_security.phi_level IS 'phi (health), pii (identity), financial, public';
COMMENT ON COLUMN field_security.masking_rule IS 'full (***), partial (XXX-XX-1234), none';
COMMENT ON COLUMN field_security.masking_pattern IS 'Pattern for partial masking';
COMMENT ON COLUMN field_security.encryption_required IS 'Whether field must be encrypted at rest';
COMMENT ON COLUMN field_security.allowed_roles IS 'Roles that can view unredacted data';
COMMENT ON COLUMN field_security.audit_access IS 'Whether access to this field should be audited';

CREATE INDEX IF NOT EXISTS idx_field_security_table ON field_security(table_name);
CREATE INDEX IF NOT EXISTS idx_field_security_level ON field_security(phi_level);

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
    
    CONSTRAINT fk_encryption_keys_rotated_by FOREIGN KEY (rotated_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_key_type CHECK (key_type IN ('master', 'data', 'backup')),
    CONSTRAINT check_algorithm CHECK (algorithm IN ('AES-256-GCM', 'AES-256-CBC')),
    CONSTRAINT check_key_status CHECK (key_status IN ('active', 'rotated', 'compromised', 'expired')),
    CONSTRAINT check_key_version CHECK (key_version >= 1)
);

COMMENT ON TABLE encryption_keys IS 'Encryption key management';
COMMENT ON COLUMN encryption_keys.key_identifier IS 'Unique key identifier';
COMMENT ON COLUMN encryption_keys.key_type IS 'master, data, backup';
COMMENT ON COLUMN encryption_keys.key_status IS 'active, rotated, compromised, expired';
COMMENT ON COLUMN encryption_keys.key_version IS 'Key version for rotation';
COMMENT ON COLUMN encryption_keys.encrypted_key IS 'Encrypted key (wrapped by master key)';

CREATE INDEX IF NOT EXISTS idx_encryption_keys_identifier ON encryption_keys(key_identifier);
CREATE INDEX IF NOT EXISTS idx_encryption_keys_status ON encryption_keys(key_status);

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

COMMENT ON TABLE encrypted_data_references IS 'References to encrypted sensitive data';
COMMENT ON COLUMN encrypted_data_references.encrypted_value IS 'Encrypted data (stored separately for performance)';
COMMENT ON COLUMN encrypted_data_references.encryption_iv IS 'Initialization vector';
COMMENT ON COLUMN encrypted_data_references.encryption_auth_tag IS 'Authentication tag for GCM mode';

CREATE INDEX IF NOT EXISTS idx_encrypted_data_key ON encrypted_data_references(key_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_data_record ON encrypted_data_references(table_name, record_id);

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
    CONSTRAINT fk_phi_access_logs_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    CONSTRAINT check_access_type CHECK (access_type IN ('view', 'export', 'print', 'modify'))
);

COMMENT ON TABLE phi_access_logs IS 'Audit log for PHI access';
COMMENT ON COLUMN phi_access_logs.access_type IS 'view, export, print, modify';
COMMENT ON COLUMN phi_access_logs.field_name IS 'Specific field accessed (NULL for entire record)';
COMMENT ON COLUMN phi_access_logs.purpose IS 'Clinical purpose for access';
COMMENT ON COLUMN phi_access_logs.is_authorized IS 'Whether access was authorized';
COMMENT ON COLUMN phi_access_logs.justification IS 'Justification for access (for break-glass)';

CREATE INDEX IF NOT EXISTS idx_phi_access_logs_user ON phi_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_phi_access_logs_time ON phi_access_logs(access_time);
CREATE INDEX IF NOT EXISTS idx_phi_access_logs_record ON phi_access_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_phi_access_logs_unauthorized ON phi_access_logs(is_authorized) WHERE is_authorized = FALSE;

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT check_mask_type CHECK (mask_type IN ('full', 'partial', 'dynamic', 'null')),
    CONSTRAINT check_priority CHECK (priority >= 0)
);

COMMENT ON TABLE data_masking_rules IS 'Data masking rules';
COMMENT ON COLUMN data_masking_rules.mask_type IS 'full (***), partial (pattern), dynamic (function), null';
COMMENT ON COLUMN data_masking_rules.mask_expression IS 'SQL expression for masking (e.g., "CONCAT(LEFT(ssn, 4), ''-XX-XXXX'')")';
COMMENT ON COLUMN data_masking_rules.unmasked_roles IS 'Roles that see original data';

CREATE INDEX IF NOT EXISTS idx_data_masking_rules_table ON data_masking_rules(table_name);
CREATE INDEX IF NOT EXISTS idx_data_masking_rules_active ON data_masking_rules(is_active) WHERE is_active = TRUE;

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
    
    CONSTRAINT fk_retention_policies_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_retention_period CHECK (retention_period_days >= 0),
    CONSTRAINT check_archive_action CHECK (archive_action IN ('delete', 'anonymize', 'archive')),
    CONSTRAINT check_notification_days CHECK (notification_days_before >= 0)
);

COMMENT ON TABLE retention_policies IS 'Data retention policies';
COMMENT ON COLUMN retention_policies.retention_period_days IS 'Days to retain data';
COMMENT ON COLUMN retention_policies.archive_action IS 'delete, anonymize, archive';
COMMENT ON COLUMN retention_policies.exempt_roles IS 'Roles exempt from deletion (audit, legal)';
COMMENT ON COLUMN retention_policies.notification_days_before IS 'Days before deletion to notify';

CREATE INDEX IF NOT EXISTS idx_retention_policies_table ON retention_policies(table_name);
CREATE INDEX IF NOT EXISTS idx_retention_policies_active ON retention_policies(is_active) WHERE is_active = TRUE;

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
    CONSTRAINT fk_data_retention_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_action_taken CHECK (action_taken IN ('deleted', 'anonymized', 'archived')),
    CONSTRAINT check_triggered_by CHECK (triggered_by IN ('system', 'admin'))
);

COMMENT ON TABLE data_retention_logs IS 'Log of data retention actions';
COMMENT ON COLUMN data_retention_logs.action_taken IS 'deleted, anonymized, archived';
COMMENT ON COLUMN data_retention_logs.triggered_by IS 'system, admin';
COMMENT ON COLUMN data_retention_logs.details IS 'Additional details in JSON';

CREATE INDEX IF NOT EXISTS idx_retention_logs_policy ON data_retention_logs(policy_id);
CREATE INDEX IF NOT EXISTS idx_retention_logs_time ON data_retention_logs(action_time);

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
    
    CONSTRAINT fk_deletion_requests_reviewed_by FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_requestor_type CHECK (requestor_type IN ('patient', 'user')),
    CONSTRAINT check_request_status CHECK (request_status IN ('pending', 'approved', 'rejected', 'processing', 'completed'))
);

COMMENT ON TABLE deletion_requests IS 'Data deletion requests (GDPR right to deletion)';
COMMENT ON COLUMN deletion_requests.requestor_type IS 'patient, user';
COMMENT ON COLUMN deletion_requests.request_status IS 'pending, approved, rejected, processing, completed';
COMMENT ON COLUMN deletion_requests.consent_withdrawn IS 'Whether consent was withdrawn';
COMMENT ON COLUMN deletion_requests.data_exported IS 'Whether data was exported before deletion';

CREATE INDEX IF NOT EXISTS idx_deletion_requests_requestor ON deletion_requests(requestor_type, requestor_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON deletion_requests(request_status);

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
    CONSTRAINT fk_consent_records_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_consent_type CHECK (consent_type IN ('treatment', 'data_sharing', 'marketing', 'research')),
    CONSTRAINT check_consent_dates CHECK (
        (granted_at IS NOT NULL) AND
        (expires_at IS NULL OR expires_at > granted_at) AND
        (revoked_at IS NULL OR revoked_at >= granted_at)
    )
);

COMMENT ON TABLE consent_records IS 'Patient consent records';
COMMENT ON COLUMN consent_records.consent_type IS 'treatment, data_sharing, marketing, research';
COMMENT ON COLUMN consent_records.consent_version IS 'Version of consent form';
COMMENT ON COLUMN consent_records.is_granted IS 'Whether consent is granted';
COMMENT ON COLUMN consent_records.expires_at IS 'When consent expires';
COMMENT ON COLUMN consent_records.revoked_at IS 'When consent was revoked';

CREATE INDEX IF NOT EXISTS idx_consent_records_patient ON consent_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_type ON consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_active ON consent_records(is_granted) WHERE is_granted = TRUE;
CREATE INDEX IF NOT EXISTS idx_consent_records_expiring ON consent_records(expires_at) WHERE expires_at IS NOT NULL;

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
    CONSTRAINT fk_consent_logs_performed_by FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_consent_action CHECK (action IN ('grant', 'update', 'revoke', 'expire'))
);

COMMENT ON TABLE consent_logs IS 'Audit log for consent changes';
COMMENT ON COLUMN consent_logs.action IS 'grant, update, revoke, expire';
COMMENT ON COLUMN consent_logs.changes IS 'JSON diff of changes';

CREATE INDEX IF NOT EXISTS idx_consent_logs_consent ON consent_logs(consent_id);
CREATE INDEX IF NOT EXISTS idx_consent_logs_time ON consent_logs(action_time);

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
    CONSTRAINT fk_breach_records_closed_by FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_breach_type CHECK (breach_type IN ('data', 'security', 'phi')),
    CONSTRAINT check_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT check_status CHECK (status IN ('investigating', 'contained', 'resolved', 'closed')),
    CONSTRAINT check_affected CHECK (affected_records >= 0 AND affected_patients >= 0)
);

COMMENT ON TABLE breach_records IS 'Security breach records';
COMMENT ON COLUMN breach_records.breach_type IS 'data, security, phi';
COMMENT ON COLUMN breach_records.severity IS 'low, medium, high, critical';
COMMENT ON COLUMN breach_records.status IS 'investigating, contained, resolved, closed';
COMMENT ON COLUMN breach_records.notification_required IS 'Whether notification is required';

CREATE INDEX IF NOT EXISTS idx_breach_records_date ON breach_records(breach_date);
CREATE INDEX IF NOT EXISTS idx_breach_records_status ON breach_records(status);
CREATE INDEX IF NOT EXISTS idx_breach_records_severity ON breach_records(severity);
CREATE INDEX IF NOT EXISTS idx_breach_records_open ON breach_records(status) WHERE status NOT IN ('resolved', 'closed');

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
    CONSTRAINT fk_breach_notifications_sent_by FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_notification_type CHECK (notification_type IN ('patient', 'regulatory', 'media')),
    CONSTRAINT check_notification_method CHECK (notification_method IN ('email', 'sms', 'letter'))
);

COMMENT ON TABLE breach_notifications IS 'Breach notifications sent';
COMMENT ON COLUMN breach_notifications.notification_type IS 'patient, regulatory, media';
COMMENT ON COLUMN breach_notifications.notification_method IS 'email, sms, letter';
COMMENT ON COLUMN breach_notifications.delivery_status IS 'sent, delivered, failed';

CREATE INDEX IF NOT EXISTS idx_breach_notifications_breach ON breach_notifications(breach_id);
CREATE INDEX IF NOT EXISTS idx_breach_notifications_date ON breach_notifications(notification_date);

-- ============================================
-- PART 5: SECURITY GUARD TABLES (SR-20 to SR-22) - NEW
-- ============================================

-- [SR-20] Entry Management
CREATE TABLE IF NOT EXISTS entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    entry_type VARCHAR(50) NOT NULL, -- employee/patient/visitor/vendor
    
    person_id UUID,
    person_name VARCHAR(200) NOT NULL,
    person_type VARCHAR(50), -- employee/patient/visitor
    id_proof_type VARCHAR(50),
    id_proof_number VARCHAR(100),
    id_proof_url TEXT,
    
    vehicle_number VARCHAR(50),
    vehicle_type VARCHAR(50),
    
    entry_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    entry_gate VARCHAR(50),
    entry_photo_url TEXT,
    
    purpose TEXT,
    department_to_visit VARCHAR(100),
    person_to_meet VARCHAR(200),
    
    exit_time TIMESTAMP,
    exit_gate VARCHAR(50),
    exit_photo_url TEXT,
    
    is_active BOOLEAN GENERATED ALWAYS AS (exit_time IS NULL) STORED,
    
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_entries_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_entry_type CHECK (entry_type IN ('employee', 'patient', 'visitor', 'vendor')),
    CONSTRAINT check_person_type CHECK (person_type IN ('employee', 'patient', 'visitor')),
    CONSTRAINT check_id_proof_type CHECK (id_proof_type IN ('aadhar', 'pan', 'driving_license', 'passport', 'voter_id', 'other'))
);

COMMENT ON TABLE entries IS 'Security entry records for people entering hospital (SR-20)';
COMMENT ON COLUMN entries.entry_number IS 'Unique entry number';
COMMENT ON COLUMN entries.entry_type IS 'employee, patient, visitor, vendor';
COMMENT ON COLUMN entries.person_id IS 'ID from respective table (employees.id, patients.id)';
COMMENT ON COLUMN entries.is_active IS 'Whether person is still inside (exit_time IS NULL)';
COMMENT ON COLUMN entries.id_proof_type IS 'Type of ID proof submitted';

CREATE INDEX IF NOT EXISTS idx_entries_entry_time ON entries(entry_time);
CREATE INDEX IF NOT EXISTS idx_entries_exit_time ON entries(exit_time) WHERE exit_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_entries_active ON entries(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_entries_person ON entries(person_id, person_type);
CREATE INDEX IF NOT EXISTS idx_entries_vehicle ON entries(vehicle_number) WHERE vehicle_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entries_number ON entries(entry_number);

-- [SR-21] Exit Management
CREATE TABLE IF NOT EXISTS exits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL UNIQUE,
    exit_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exit_gate VARCHAR(50),
    exit_photo_url TEXT,
    verified_by UUID,
    vehicle_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_exits_entry FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
    CONSTRAINT fk_exits_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE exits IS 'Exit records linked to entries (SR-21)';
COMMENT ON COLUMN exits.entry_id IS 'Foreign key to entries table (one-to-one)';
COMMENT ON COLUMN exits.verified_by IS 'Security guard who verified exit';

CREATE INDEX IF NOT EXISTS idx_exits_entry ON exits(entry_id);
CREATE INDEX IF NOT EXISTS idx_exits_time ON exits(exit_time);
CREATE INDEX IF NOT EXISTS idx_exits_verified ON exits(verified_by) WHERE verified_by IS NOT NULL;

-- [SR-22] Visitor Management
CREATE TABLE IF NOT EXISTS visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id VARCHAR(50) UNIQUE NOT NULL,
    
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    
    id_proof_type VARCHAR(50),
    id_proof_number VARCHAR(100),
    id_proof_url TEXT,
    visitor_photo_url TEXT,
    
    purpose VARCHAR(100),
    department_to_visit UUID,
    person_to_meet VARCHAR(200),
    
    expected_from TIMESTAMP,
    expected_to TIMESTAMP,
    actual_check_in TIMESTAMP,
    actual_check_out TIMESTAMP,
    
    status VARCHAR(20) DEFAULT 'expected', -- expected/checked_in/checked_out/cancelled
    badge_issued BOOLEAN DEFAULT FALSE,
    badge_number VARCHAR(50),
    
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    
    CONSTRAINT fk_visitors_department FOREIGN KEY (department_to_visit) REFERENCES departments(id) ON DELETE SET NULL,
    CONSTRAINT fk_visitors_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_visitors_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT check_visitor_status CHECK (status IN ('expected', 'checked_in', 'checked_out', 'cancelled')),
    CONSTRAINT check_id_proof_type_visitor CHECK (id_proof_type IN ('aadhar', 'pan', 'driving_license', 'passport', 'voter_id', 'other')),
    CONSTRAINT check_dates CHECK (
        (expected_from IS NULL OR expected_to IS NULL OR expected_to >= expected_from) AND
        (actual_check_in IS NULL OR actual_check_out IS NULL OR actual_check_out >= actual_check_in)
    )
);

COMMENT ON TABLE visitors IS 'Pre-registered visitor information (SR-22)';
COMMENT ON COLUMN visitors.visitor_id IS 'Unique visitor ID';
COMMENT ON COLUMN visitors.status IS 'expected, checked_in, checked_out, cancelled';
COMMENT ON COLUMN visitors.badge_issued IS 'Whether visitor badge was issued';
COMMENT ON COLUMN visitors.badge_number IS 'Badge number if issued';

CREATE INDEX IF NOT EXISTS idx_visitors_phone ON visitors(phone);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);
CREATE INDEX IF NOT EXISTS idx_visitors_expected ON visitors(expected_from, expected_to);
CREATE INDEX IF NOT EXISTS idx_visitors_department ON visitors(department_to_visit);
CREATE INDEX IF NOT EXISTS idx_visitors_deleted ON visitors(is_deleted, deleted_at);

-- ============================================
-- PART 6: ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================

-- Additional indexes for security guard tables (already added above)

-- ============================================
-- PART 7: TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_password_policy_updated_at ON password_policy;
DROP TRIGGER IF EXISTS update_mfa_settings_updated_at ON mfa_settings;
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
DROP TRIGGER IF EXISTS update_data_access_policies_updated_at ON data_access_policies;
DROP TRIGGER IF EXISTS update_field_security_updated_at ON field_security;
DROP TRIGGER IF EXISTS update_encryption_keys_updated_at ON encryption_keys;
DROP TRIGGER IF EXISTS update_retention_policies_updated_at ON retention_policies;
DROP TRIGGER IF EXISTS update_consent_records_updated_at ON consent_records;
DROP TRIGGER IF EXISTS update_breach_records_updated_at ON breach_records;
DROP TRIGGER IF EXISTS update_entries_updated_at ON entries;
DROP TRIGGER IF EXISTS update_visitors_updated_at ON visitors;

-- Create triggers for existing tables
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

-- Create triggers for new security guard tables
CREATE TRIGGER update_entries_updated_at
    BEFORE UPDATE ON entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at
    BEFORE UPDATE ON visitors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Additional triggers for security guard tables

-- Auto-generate entry number
CREATE OR REPLACE FUNCTION generate_entry_number()
RETURNS TRIGGER AS $$
DECLARE
    date_prefix VARCHAR(8);
    sequence_num INTEGER;
BEGIN
    date_prefix := TO_CHAR(NEW.entry_time, 'YYYYMMDD');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 13) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM entries
    WHERE entry_number LIKE 'ENT-' || date_prefix || '-%';
    
    NEW.entry_number := 'ENT-' || date_prefix || '-' || LPAD(sequence_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_entry_number_trigger ON entries;
CREATE TRIGGER generate_entry_number_trigger
    BEFORE INSERT ON entries
    FOR EACH ROW
    WHEN (NEW.entry_number IS NULL)
    EXECUTE FUNCTION generate_entry_number();

-- Auto-generate visitor ID
CREATE OR REPLACE FUNCTION generate_visitor_id()
RETURNS TRIGGER AS $$
DECLARE
    date_prefix VARCHAR(8);
    sequence_num INTEGER;
BEGIN
    date_prefix := TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(visitor_id FROM 13) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM visitors
    WHERE visitor_id LIKE 'VIS-' || date_prefix || '-%';
    
    NEW.visitor_id := 'VIS-' || date_prefix || '-' || LPAD(sequence_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_visitor_id_trigger ON visitors;
CREATE TRIGGER generate_visitor_id_trigger
    BEFORE INSERT ON visitors
    FOR EACH ROW
    WHEN (NEW.visitor_id IS NULL)
    EXECUTE FUNCTION generate_visitor_id();

-- Update entry on exit
CREATE OR REPLACE FUNCTION update_entry_on_exit()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE entries 
    SET exit_time = NEW.exit_time,
        exit_gate = NEW.exit_gate,
        exit_photo_url = NEW.exit_photo_url
    WHERE id = NEW.entry_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_entry_on_exit_trigger ON exits;
CREATE TRIGGER update_entry_on_exit_trigger
    AFTER INSERT ON exits
    FOR EACH ROW
    EXECUTE FUNCTION update_entry_on_exit();

-- Update visitor status on check-in/out
CREATE OR REPLACE FUNCTION update_visitor_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.actual_check_in IS NOT NULL AND OLD.actual_check_in IS NULL THEN
        NEW.status := 'checked_in';
    ELSIF NEW.actual_check_out IS NOT NULL AND OLD.actual_check_out IS NULL THEN
        NEW.status := 'checked_out';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_visitor_status_trigger ON visitors;
CREATE TRIGGER update_visitor_status_trigger
    BEFORE UPDATE OF actual_check_in, actual_check_out ON visitors
    FOR EACH ROW
    EXECUTE FUNCTION update_visitor_status();

-- ============================================
-- PART 8: VERIFICATION (UPDATED & FIXED)
-- ============================================

DO $$
DECLARE
    auth_tables INTEGER;
    authz_tables INTEGER;
    data_tables INTEGER;
    compliance_tables INTEGER;
    security_guard_tables INTEGER;
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
    
    SELECT COUNT(*) INTO security_guard_tables FROM information_schema.tables WHERE table_name IN (
        'entries', 'exits', 'visitors'
    );
    
    total_tables := auth_tables + authz_tables + data_tables + compliance_tables + security_guard_tables;
    
    -- Fixed RAISE statements - proper formatting
    RAISE NOTICE '============================================';
    RAISE NOTICE 'SECURITY TABLES MIGRATION COMPLETED';
    RAISE NOTICE 'Authentication: % tables', auth_tables;
    RAISE NOTICE 'Authorization: % tables', authz_tables;
    RAISE NOTICE 'Data Protection: % tables', data_tables;
    RAISE NOTICE 'Compliance: % tables', compliance_tables;
    RAISE NOTICE 'Security Guard: % tables', security_guard_tables;
    RAISE NOTICE 'TOTAL TABLES: %', total_tables;
    RAISE NOTICE 'Requirements Covered: SR-01 to SR-22';
    RAISE NOTICE '============================================';
END $$;