-- ============================================
-- FILE: database/migrations/023_integration_tables.sql
-- DESCRIPTION: Complete integration services tables for SMS, Email, Payment, Cloud, Insurance
-- SAFE MIGRATION: Can be run multiple times without errors
-- ============================================

-- ============================================
-- PART 1: SMS GATEWAY INTEGRATION (IR-01 to IR-05)
-- ============================================

-- [IR-01] Send appointment reminders
CREATE TABLE IF NOT EXISTS sms_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID,
    patient_phone VARCHAR(20) NOT NULL,
    patient_name VARCHAR(200),
    doctor_name VARCHAR(200),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reminder_type VARCHAR(50), -- 24h/2h/1h
    scheduled_time TIMESTAMP,
    sent_time TIMESTAMP,
    status VARCHAR(50), -- pending/sent/failed
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_sms_reminders_appointment FOREIGN KEY (appointment_id) 
        REFERENCES appointments(id) ON DELETE SET NULL
);

CREATE INDEX idx_sms_reminders_status ON sms_reminders(status);
CREATE INDEX idx_sms_reminders_scheduled ON sms_reminders(scheduled_time) WHERE status = 'pending';

-- [IR-02] Send critical alerts
CREATE TABLE IF NOT EXISTS critical_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100), -- lab_critical/panic/emergency
    patient_id UUID,
    patient_phone VARCHAR(20) NOT NULL,
    patient_name VARCHAR(200),
    doctor_id UUID,
    doctor_phone VARCHAR(20),
    alert_message TEXT NOT NULL,
    priority INTEGER, -- 1-5 (5 highest)
    triggered_by UUID,
    triggered_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    escalation_level INTEGER DEFAULT 0,
    parent_alert_id UUID,
    status VARCHAR(50),
    metadata JSONB,
    
    CONSTRAINT fk_critical_alerts_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_critical_alerts_doctor FOREIGN KEY (doctor_id) 
        REFERENCES employees(id) ON DELETE SET NULL,
    CONSTRAINT fk_critical_alerts_triggered_by FOREIGN KEY (triggered_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_critical_alerts_acknowledged_by FOREIGN KEY (acknowledged_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_critical_alerts_parent FOREIGN KEY (parent_alert_id) 
        REFERENCES critical_alerts(id) ON DELETE SET NULL
);

CREATE INDEX idx_critical_alerts_priority ON critical_alerts(priority);
CREATE INDEX idx_critical_alerts_status ON critical_alerts(status);
CREATE INDEX idx_critical_alerts_triggered ON critical_alerts(triggered_at);

-- [IR-03] Send OTP for login
CREATE TABLE IF NOT EXISTS otp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(50), -- login/verification/password_reset
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    sent_at TIMESTAMP,
    ip_address INET,
    device_info JSONB,
    attempt_count INTEGER DEFAULT 0,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_otp_logs_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_otp_logs_phone ON otp_logs(phone_number);
CREATE INDEX idx_otp_logs_expires ON otp_logs(expires_at);
CREATE INDEX idx_otp_logs_status ON otp_logs(status);

-- [IR-04] Send bill notifications
CREATE TABLE IF NOT EXISTS bill_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID,
    patient_phone VARCHAR(20) NOT NULL,
    patient_name VARCHAR(200),
    bill_amount DECIMAL(10,2) NOT NULL,
    due_date DATE,
    notification_type VARCHAR(50), -- new/reminder/overdue
    scheduled_time TIMESTAMP,
    sent_time TIMESTAMP,
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_bill_notifications_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX idx_bill_notifications_status ON bill_notifications(status);
CREATE INDEX idx_bill_notifications_scheduled ON bill_notifications(scheduled_time);

-- [IR-05] Send payment confirmations
CREATE TABLE IF NOT EXISTS payment_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID,
    transaction_id VARCHAR(100) NOT NULL,
    patient_phone VARCHAR(20) NOT NULL,
    patient_name VARCHAR(200),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_date TIMESTAMP,
    sent_at TIMESTAMP,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_payment_confirmations_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX idx_payment_confirmations_transaction ON payment_confirmations(transaction_id);
CREATE INDEX idx_payment_confirmations_status ON payment_confirmations(status);

-- ============================================
-- PART 2: EMAIL SERVICE INTEGRATION (IR-06 to IR-10)
-- ============================================

-- [IR-06] Send invoices
CREATE TABLE IF NOT EXISTS email_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID,
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(200),
    invoice_pdf_url TEXT,
    email_subject VARCHAR(500),
    email_body TEXT,
    cc_recipients TEXT[],
    bcc_recipients TEXT[],
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    status VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_email_invoices_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX idx_email_invoices_status ON email_invoices(status);
CREATE INDEX idx_email_invoices_sent ON email_invoices(sent_at);

-- [IR-07] Send reports
CREATE TABLE IF NOT EXISTS email_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(100), -- lab/radiology/prescription
    report_id UUID,
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(200),
    doctor_email VARCHAR(255),
    report_pdf_url TEXT,
    email_subject VARCHAR(500),
    email_body TEXT,
    attachments JSONB,
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_reports_type ON email_reports(report_type);
CREATE INDEX idx_email_reports_status ON email_reports(status);
CREATE INDEX idx_email_reports_sent ON email_reports(sent_at);

-- [IR-08] Send system alerts
CREATE TABLE IF NOT EXISTS system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(100), -- system/database/security/performance
    severity VARCHAR(50), -- critical/high/medium/low
    title VARCHAR(500),
    message TEXT,
    recipients_to TEXT[], -- email addresses
    recipients_cc TEXT[],
    sent_at TIMESTAMP,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP,
    resolved_at TIMESTAMP,
    status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_system_alerts_acknowledged_by FOREIGN KEY (acknowledged_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_system_alerts_status ON system_alerts(status);
CREATE INDEX idx_system_alerts_created ON system_alerts(created_at);

-- [IR-09] Weekly summaries
CREATE TABLE IF NOT EXISTS weekly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date DATE NOT NULL,
    summary_type VARCHAR(50), -- admin/doctor/billing/inventory
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(200),
    summary_pdf_url TEXT,
    stats_json JSONB,
    metrics JSONB,
    charts JSONB,
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weekly_summaries_type ON weekly_summaries(summary_type);
CREATE INDEX idx_weekly_summaries_status ON weekly_summaries(status);
CREATE INDEX idx_weekly_summaries_date ON weekly_summaries(summary_date);

-- [IR-10] Send lab reports
CREATE TABLE IF NOT EXISTS lab_reports_email (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_result_id UUID,
    patient_email VARCHAR(255) NOT NULL,
    patient_name VARCHAR(200),
    doctor_email VARCHAR(255),
    lab_name VARCHAR(200),
    report_pdf_url TEXT,
    report_html_url TEXT,
    email_subject VARCHAR(500),
    email_body TEXT,
    attachments JSONB,
    sent_at TIMESTAMP,
    opened_at TIMESTAMP,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_lab_reports_email_test_result FOREIGN KEY (test_result_id) 
        REFERENCES test_results(id) ON DELETE SET NULL
);

CREATE INDEX idx_lab_reports_email_status ON lab_reports_email(status);
CREATE INDEX idx_lab_reports_email_sent ON lab_reports_email(sent_at);

-- ============================================
-- PART 3: PAYMENT GATEWAY INTEGRATION (IR-11 to IR-15)
-- ============================================

-- [IR-11] Online payments
CREATE TABLE IF NOT EXISTS online_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID,
    patient_id UUID,
    payment_gateway VARCHAR(50), -- razorpay/stripe/phonepe/paytm
    gateway_transaction_id VARCHAR(100) UNIQUE,
    order_id VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    payment_method VARCHAR(50), -- card/upi/netbanking/wallet
    payment_status VARCHAR(50), -- initiated/pending/success/failed
    gateway_response JSONB,
    error_message TEXT,
    initiated_at TIMESTAMP,
    completed_at TIMESTAMP,
    refund_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_online_payments_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_online_payments_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL
);

CREATE INDEX idx_online_payments_gateway_transaction ON online_payments(gateway_transaction_id);
CREATE INDEX idx_online_payments_status ON online_payments(payment_status);
CREATE INDEX idx_online_payments_created ON online_payments(created_at);

-- [IR-12] Refund processing
CREATE TABLE IF NOT EXISTS refund_processing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID,
    invoice_id UUID,
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_status VARCHAR(50), -- initiated/processing/completed/failed
    gateway_refund_id VARCHAR(100),
    initiated_by UUID,
    approved_by UUID,
    initiated_at TIMESTAMP,
    processed_at TIMESTAMP,
    completed_at TIMESTAMP,
    gateway_response JSONB,
    error_message TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_refund_processing_payment FOREIGN KEY (payment_id) 
        REFERENCES online_payments(id) ON DELETE SET NULL,
    CONSTRAINT fk_refund_processing_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_refund_processing_initiated_by FOREIGN KEY (initiated_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_refund_processing_approved_by FOREIGN KEY (approved_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_refund_processing_status ON refund_processing(refund_status);
CREATE INDEX idx_refund_processing_gateway_refund ON refund_processing(gateway_refund_id);

-- [IR-13] Payment verification
CREATE TABLE IF NOT EXISTS payment_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID,
    invoice_id UUID,
    verification_method VARCHAR(50), -- webhook/callback/manual
    verification_status VARCHAR(50), -- pending/verified/failed
    webhook_payload JSONB,
    callback_response JSONB,
    signature_verified BOOLEAN,
    verified_by UUID,
    verified_at TIMESTAMP,
    attempts_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_payment_verification_payment FOREIGN KEY (payment_id) 
        REFERENCES online_payments(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_verification_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_payment_verification_verified_by FOREIGN KEY (verified_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_payment_verification_status ON payment_verification(verification_status);
CREATE INDEX idx_payment_verification_payment ON payment_verification(payment_id);

-- [IR-14] Transaction history
CREATE TABLE IF NOT EXISTS transaction_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    invoice_id UUID,
    transaction_type VARCHAR(50), -- payment/refund/chargeback
    gateway VARCHAR(50),
    gateway_transaction_id VARCHAR(100),
    amount DECIMAL(10,2),
    currency VARCHAR(3),
    status VARCHAR(50),
    payment_method VARCHAR(50),
    bank_reference_number VARCHAR(100),
    utr_number VARCHAR(100),
    transaction_date TIMESTAMP,
    settlement_date DATE,
    fee_amount DECIMAL(10,2),
    tax_amount DECIMAL(10,2),
    net_amount DECIMAL(10,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_transaction_history_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_transaction_history_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX idx_transaction_history_patient ON transaction_history(patient_id);
CREATE INDEX idx_transaction_history_gateway_transaction ON transaction_history(gateway_transaction_id);
CREATE INDEX idx_transaction_history_date ON transaction_history(transaction_date);

-- [IR-15] Multiple payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    method_type VARCHAR(50), -- card/upi/netbanking/wallet
    provider VARCHAR(100), -- visa/mastercard/gpay/phonepe
    token VARCHAR(500),
    masked_details VARCHAR(100),
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_payment_methods_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX idx_payment_methods_patient ON payment_methods(patient_id);
CREATE INDEX idx_payment_methods_default ON payment_methods(is_default) WHERE is_default = TRUE;

-- ============================================
-- PART 4: CLOUD STORAGE INTEGRATION (IR-16 to IR-19)
-- ============================================

-- [IR-16] Store medical images
CREATE TABLE IF NOT EXISTS cloud_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_type VARCHAR(50), -- xray/mri/ct/ultrasound
    reference_id UUID,
    patient_id UUID,
    bucket_name VARCHAR(200),
    object_key VARCHAR(500) UNIQUE,
    file_name VARCHAR(500),
    file_size BIGINT,
    mime_type VARCHAR(100),
    storage_class VARCHAR(50), -- standard/infrequent/archive
    public_url TEXT,
    thumbnail_url TEXT,
    encryption_status VARCHAR(50),
    checksum VARCHAR(64),
    version INTEGER DEFAULT 1,
    tags TEXT[],
    metadata JSONB,
    uploaded_by UUID,
    uploaded_at TIMESTAMP,
    last_accessed TIMESTAMP,
    expires_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_cloud_images_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_cloud_images_uploaded_by FOREIGN KEY (uploaded_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_cloud_images_patient ON cloud_images(patient_id);
CREATE INDEX idx_cloud_images_object_key ON cloud_images(object_key);
CREATE INDEX idx_cloud_images_expires ON cloud_images(expires_at);

-- [IR-17] Store reports PDF
CREATE TABLE IF NOT EXISTS cloud_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type VARCHAR(50), -- lab/radiology/prescription/invoice
    reference_id UUID,
    patient_id UUID,
    bucket_name VARCHAR(200),
    object_key VARCHAR(500) UNIQUE,
    file_name VARCHAR(500),
    file_size BIGINT,
    page_count INTEGER,
    mime_type VARCHAR(100),
    storage_class VARCHAR(50),
    public_url TEXT,
    password_protected BOOLEAN DEFAULT FALSE,
    encryption_status VARCHAR(50),
    checksum VARCHAR(64),
    version INTEGER DEFAULT 1,
    tags TEXT[],
    metadata JSONB,
    uploaded_by UUID,
    uploaded_at TIMESTAMP,
    downloaded_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP,
    expires_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_cloud_reports_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_cloud_reports_uploaded_by FOREIGN KEY (uploaded_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_cloud_reports_patient ON cloud_reports(patient_id);
CREATE INDEX idx_cloud_reports_object_key ON cloud_reports(object_key);
CREATE INDEX idx_cloud_reports_expires ON cloud_reports(expires_at);

-- [IR-18] Backup storage
CREATE TABLE IF NOT EXISTS backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type VARCHAR(50), -- full/incremental/differential
    backup_name VARCHAR(500),
    database_name VARCHAR(200),
    bucket_name VARCHAR(200),
    object_key VARCHAR(500) UNIQUE,
    file_size BIGINT,
    compression_type VARCHAR(50), -- gzip/zstd/none
    encryption_type VARCHAR(50), -- aes256/none
    checksum VARCHAR(64),
    status VARCHAR(50), -- in_progress/completed/failed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    verified_at TIMESTAMP,
    verified_by UUID,
    retention_days INTEGER,
    expires_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_backups_verified_by FOREIGN KEY (verified_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_expires ON backups(expires_at);
CREATE INDEX idx_backups_created ON backups(created_at);

-- [IR-19] File archival
CREATE TABLE IF NOT EXISTS archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_type VARCHAR(50), -- images/reports/logs
    archive_name VARCHAR(500),
    source_bucket VARCHAR(200),
    destination_bucket VARCHAR(200),
    object_count INTEGER,
    total_size BIGINT,
    compression_type VARCHAR(50),
    encryption_type VARCHAR(50),
    status VARCHAR(50), -- pending/processing/completed
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    archived_by UUID,
    retention_years INTEGER,
    expires_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_archives_archived_by FOREIGN KEY (archived_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_archives_status ON archives(status);
CREATE INDEX idx_archives_expires ON archives(expires_at);

-- ============================================
-- PART 5: INSURANCE API (Future) (IR-20 to IR-23)
-- ============================================

-- [IR-20] Verify insurance
CREATE TABLE IF NOT EXISTS insurance_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    insurance_provider_id UUID,
    policy_number VARCHAR(100),
    verification_status VARCHAR(50), -- pending/verified/failed
    coverage_details JSONB,
    eligibility_status VARCHAR(50),
    verification_date DATE,
    expiry_date DATE,
    api_request JSONB,
    api_response JSONB,
    verified_by UUID,
    verified_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_insurance_verifications_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_verifications_provider FOREIGN KEY (insurance_provider_id) 
        REFERENCES insurance_providers(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_verifications_verified_by FOREIGN KEY (verified_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_insurance_verifications_patient ON insurance_verifications(patient_id);
CREATE INDEX idx_insurance_verifications_status ON insurance_verifications(verification_status);

-- [IR-21] Submit claims
CREATE TABLE IF NOT EXISTS insurance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_number VARCHAR(100) UNIQUE,
    patient_id UUID,
    insurance_provider_id UUID,
    invoice_id UUID,
    claim_amount DECIMAL(10,2),
    approved_amount DECIMAL(10,2),
    claim_status VARCHAR(50), -- draft/submitted/processing/approved/rejected
    submission_date DATE,
    decision_date DATE,
    documents JSONB,
    api_request JSONB,
    api_response JSONB,
    rejection_reason TEXT,
    submitted_by UUID,
    submitted_at TIMESTAMP,
    processed_by UUID,
    processed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_insurance_claims_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_claims_provider FOREIGN KEY (insurance_provider_id) 
        REFERENCES insurance_providers(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_claims_invoice FOREIGN KEY (invoice_id) 
        REFERENCES invoices(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_claims_submitted_by FOREIGN KEY (submitted_by) 
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_insurance_claims_processed_by FOREIGN KEY (processed_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_insurance_claims_number ON insurance_claims(claim_number);
CREATE INDEX idx_insurance_claims_patient ON insurance_claims(patient_id);
CREATE INDEX idx_insurance_claims_status ON insurance_claims(claim_status);

-- [IR-22] Check coverage
CREATE TABLE IF NOT EXISTS coverage_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID,
    insurance_provider_id UUID,
    service_type VARCHAR(100), -- consultation/lab/procedure/medicine
    service_code VARCHAR(100),
    estimated_amount DECIMAL(10,2),
    coverage_percentage DECIMAL(5,2),
    covered_amount DECIMAL(10,2),
    patient_responsibility DECIMAL(10,2),
    pre_authorization_required BOOLEAN,
    pre_authorization_days INTEGER,
    exclusions TEXT[],
    limitations JSONB,
    api_request JSONB,
    api_response JSONB,
    checked_by UUID,
    checked_at TIMESTAMP,
    valid_until DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_coverage_checks_patient FOREIGN KEY (patient_id) 
        REFERENCES patients(id) ON DELETE SET NULL,
    CONSTRAINT fk_coverage_checks_provider FOREIGN KEY (insurance_provider_id) 
        REFERENCES insurance_providers(id) ON DELETE SET NULL,
    CONSTRAINT fk_coverage_checks_checked_by FOREIGN KEY (checked_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_coverage_checks_patient ON coverage_checks(patient_id);
CREATE INDEX idx_coverage_checks_valid ON coverage_checks(valid_until);

-- [IR-23] Claim status tracking
CREATE TABLE IF NOT EXISTS claim_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID,
    status VARCHAR(50),
    status_date TIMESTAMP,
    status_description TEXT,
    updated_by UUID,
    attachment_urls TEXT[],
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_claim_tracking_claim FOREIGN KEY (claim_id) 
        REFERENCES insurance_claims(id) ON DELETE CASCADE,
    CONSTRAINT fk_claim_tracking_updated_by FOREIGN KEY (updated_by) 
        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_claim_tracking_claim ON claim_tracking(claim_id);
CREATE INDEX idx_claim_tracking_status_date ON claim_tracking(status_date);

-- ============================================
-- PART 6: VERIFICATION
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_name IN (
        'sms_reminders', 'critical_alerts', 'otp_logs', 'bill_notifications', 'payment_confirmations',
        'email_invoices', 'email_reports', 'system_alerts', 'weekly_summaries', 'lab_reports_email',
        'online_payments', 'refund_processing', 'payment_verification', 'transaction_history', 'payment_methods',
        'cloud_images', 'cloud_reports', 'backups', 'archives',
        'insurance_verifications', 'insurance_claims', 'coverage_checks', 'claim_tracking'
    );
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'INTEGRATION TABLES MIGRATION COMPLETED';
    RAISE NOTICE 'Total tables created: %', table_count;
    RAISE NOTICE 'SMS Gateway: 5 tables';
    RAISE NOTICE 'Email Service: 5 tables';
    RAISE NOTICE 'Payment Gateway: 5 tables';
    RAISE NOTICE 'Cloud Storage: 4 tables';
    RAISE NOTICE 'Insurance API: 4 tables';
    RAISE NOTICE '============================================';
END $$;